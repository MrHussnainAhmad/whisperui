/**
 * Ephemeral X25519 + XSalsa20-Poly1305 encryption.
 *
 * Keys are generated and used in JavaScript memory because tweetnacl cannot
 * operate on non-exportable platform-keystore keys. The private key is never
 * written to storage and its byte buffer is wiped after key agreement.
 * Invite chats mix in a 256-bit client-only secret that the relay never sees.
 * This is the legacy crypto construction, not a post-quantum ratchet.
 * Random chats have no trust anchor; safety-code comparison is only meaningful
 * when users have a separate trusted channel.
 */
import * as ExpoCrypto from 'expo-crypto';

if (!globalThis.crypto) globalThis.crypto = {};
if (!globalThis.crypto.getRandomValues) {
  globalThis.crypto.getRandomValues = (arr) => {
    arr.set(ExpoCrypto.getRandomBytes(arr.length));
    return arr;
  };
}

const nacl = require('tweetnacl');

function toBase64(bytes) {
  let value = '';
  for (let i = 0; i < bytes.length; i++) value += String.fromCharCode(bytes[i]);
  return btoa(value);
}

function fromBase64(value) {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

let privateKey = null;
let sharedKey = null;
let ourPubBase64 = null;
let peerPubBase64 = null;
let inviteBinding = null;
let roomBinding = null;
let derivationPromise = null;
let keyEpoch = 0;

export function setInviteBinding(code) {
  inviteBinding = code ? code.toUpperCase().trim() : null;
}

export function setRoomBinding(roomId) {
  roomBinding = typeof roomId === 'string' && roomId ? roomId : null;
}

async function deriveSessionKey(baseKey) {
  // The full invite code contains a 256-bit client-only authentication secret.
  // Domain separation and the room binding prevent keys from being reused
  // across protocol versions, modes, or rooms.
  const context = new TextEncoder().encode(
    `whisper-session-v6|${roomBinding || 'no-room'}|${inviteBinding || 'random'}`
  );
  const input = new Uint8Array(baseKey.length + context.length);
  input.set(baseKey);
  input.set(context, baseKey.length);
  const digest = await ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, input);
  const derived = new Uint8Array(digest);
  baseKey.fill(0);
  input.fill(0);
  return derived;
}

export async function generateKeys() {
  keyEpoch += 1;
  if (privateKey) privateKey.fill(0);
  if (sharedKey) sharedKey.fill(0);
  const keypair = nacl.box.keyPair();
  privateKey = keypair.secretKey;
  ourPubBase64 = toBase64(keypair.publicKey);
  sharedKey = null;
  peerPubBase64 = null;
  return ourPubBase64;
}

export function deriveSharedKey(peerPublicKeyBase64) {
  if (sharedKey) {
    if (peerPubBase64 !== peerPublicKeyBase64) {
      throw new Error('E2E already established with a different peer key');
    }
    return Promise.resolve();
  }
  if (typeof peerPublicKeyBase64 !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(peerPublicKeyBase64)) {
    return Promise.reject(new Error('Invalid peer public key'));
  }
  if (peerPubBase64 && peerPubBase64 !== peerPublicKeyBase64) {
    return Promise.reject(new Error('Peer public key changed during key agreement'));
  }
  if (derivationPromise) return derivationPromise;
  if (!privateKey) return Promise.reject(new Error('Private key not available'));

  peerPubBase64 = peerPublicKeyBase64;
  const epoch = keyEpoch;
  const operation = (async () => {
    try {
      await completeKeyAgreement(peerPublicKeyBase64, epoch);
    } finally {
      if (derivationPromise === operation) derivationPromise = null;
    }
  })();
  derivationPromise = operation;
  return operation;
}

async function completeKeyAgreement(peerPublicKeyBase64, epoch) {

  const peerPublicKey = fromBase64(peerPublicKeyBase64);
  if (peerPublicKey.length !== nacl.box.publicKeyLength) throw new Error('Invalid peer public key');

  let rawShared;
  let derived;
  try {
    rawShared = nacl.scalarMult(privateKey, peerPublicKey);
    if (rawShared.every((byte) => byte === 0)) {
      throw new Error('Unsafe peer public key');
    }
    derived = nacl.box.before(peerPublicKey, privateKey);
  } finally {
    if (rawShared) rawShared.fill(0);
    privateKey.fill(0);
    privateKey = null;
    peerPublicKey.fill(0);
  }

  const finalKey = await deriveSessionKey(derived);
  if (epoch !== keyEpoch) {
    finalKey.fill(0);
    throw new Error('Key agreement was cancelled');
  }
  sharedKey = finalKey;
}

export function isReady() {
  return sharedKey !== null;
}

export async function getSafetyCode() {
  if (!sharedKey || !ourPubBase64 || !peerPubBase64) return null;
  const sorted = [ourPubBase64, peerPubBase64].sort();
  const context = new TextEncoder().encode(
    `whisper-safety-v2|${roomBinding || 'no-room'}|${sorted[0]}|${sorted[1]}`
  );
  const input = new Uint8Array(sharedKey.length + context.length);
  input.set(sharedKey);
  input.set(context, sharedKey.length);
  const digest = new Uint8Array(
    await ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, input)
  );
  input.fill(0);
  const digits = [];
  for (let i = 0; i < 15; i++) digits.push(digest[i] % 10);
  digest.fill(0);
  const code = digits.join('');
  return code.match(/.{3}/g).join(' ');
}

function confirmationText(senderPublicKey, receiverPublicKey, roomId) {
  return `whisper-key-confirm-v6|${roomId}|${senderPublicKey}|${receiverPublicKey}`;
}

export function createKeyConfirmation(roomId) {
  if (!sharedKey || !ourPubBase64 || !peerPubBase64 || roomId !== roomBinding) {
    throw new Error('E2E confirmation is not ready');
  }
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const message = new TextEncoder().encode(
    confirmationText(ourPubBase64, peerPubBase64, roomId)
  );
  const cipher = nacl.secretbox(message, nonce, sharedKey);
  const packed = new Uint8Array(nonce.length + cipher.length);
  packed.set(nonce);
  packed.set(cipher, nonce.length);
  const result = toBase64(packed);
  message.fill(0);
  nonce.fill(0);
  cipher.fill(0);
  packed.fill(0);
  return result;
}

export function verifyKeyConfirmation(proof, roomId) {
  if (!sharedKey || !ourPubBase64 || !peerPubBase64 || roomId !== roomBinding) return false;
  try {
    const packed = fromBase64(proof);
    if (packed.length <= nacl.secretbox.nonceLength) return false;
    const nonce = packed.slice(0, nacl.secretbox.nonceLength);
    const cipher = packed.slice(nacl.secretbox.nonceLength);
    const plaintext = nacl.secretbox.open(cipher, nonce, sharedKey);
    packed.fill(0);
    nonce.fill(0);
    cipher.fill(0);
    if (!plaintext) return false;
    const actual = new TextDecoder().decode(plaintext);
    plaintext.fill(0);
    return actual === confirmationText(peerPubBase64, ourPubBase64, roomId);
  } catch {
    return false;
  }
}

function messageKey(sequence, senderPublicKey, receiverPublicKey) {
  if (!Number.isSafeInteger(sequence) || sequence < 1 ||
      !senderPublicKey || !receiverPublicKey || !sharedKey) {
    throw new Error('Invalid message key context');
  }
  const context = new TextEncoder().encode(
    `whisper-message-v3|${roomBinding || 'no-room'}|${senderPublicKey}|${receiverPublicKey}|${sequence}`
  );
  const input = new Uint8Array(sharedKey.length + context.length);
  input.set(sharedKey);
  input.set(context, sharedKey.length);
  const digest = nacl.hash(input);
  const key = digest.slice(0, nacl.secretbox.keyLength);
  input.fill(0);
  digest.fill(0);
  return key;
}

function encodeSequence(sequence) {
  const bytes = new Uint8Array(8);
  let remaining = sequence;
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  return bytes;
}

function decodeSequence(bytes) {
  let value = 0;
  for (const byte of bytes) value = value * 256 + byte;
  return Number.isSafeInteger(value) ? value : null;
}

export function encrypt(plaintext, sequence) {
  if (!sharedKey) throw new Error('E2E not ready');
  const sequenceBytes = encodeSequence(sequence);
  const key = messageKey(sequence, ourPubBase64, peerPubBase64);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const message = new TextEncoder().encode(plaintext);
  const cipher = nacl.secretbox(message, nonce, key);
  const packed = new Uint8Array(sequenceBytes.length + nonce.length + cipher.length);
  packed.set(sequenceBytes);
  packed.set(nonce, sequenceBytes.length);
  packed.set(cipher, sequenceBytes.length + nonce.length);
  const result = toBase64(packed);
  message.fill(0);
  sequenceBytes.fill(0);
  key.fill(0);
  nonce.fill(0);
  cipher.fill(0);
  packed.fill(0);
  return result;
}

export function decrypt(packedBase64) {
  if (!sharedKey) return null;
  try {
    const packed = fromBase64(packedBase64);
    const sequenceLength = 8;
    if (packed.length <= sequenceLength + nacl.secretbox.nonceLength) return null;
    const sequenceBytes = packed.slice(0, sequenceLength);
    const sequence = decodeSequence(sequenceBytes);
    if (!sequence || sequence < 1) return null;
    const key = messageKey(sequence, peerPubBase64, ourPubBase64);
    const nonce = packed.slice(sequenceLength, sequenceLength + nacl.secretbox.nonceLength);
    const cipher = packed.slice(sequenceLength + nacl.secretbox.nonceLength);
    const plaintext = nacl.secretbox.open(cipher, nonce, key);
    packed.fill(0);
    sequenceBytes.fill(0);
    key.fill(0);
    nonce.fill(0);
    cipher.fill(0);
    if (!plaintext) return null;
    const result = new TextDecoder().decode(plaintext);
    plaintext.fill(0);
    return result;
  } catch {
    return null;
  }
}

export function destroy() {
  keyEpoch += 1;
  if (privateKey) privateKey.fill(0);
  if (sharedKey) sharedKey.fill(0);
  privateKey = null;
  sharedKey = null;
  ourPubBase64 = null;
  peerPubBase64 = null;
  inviteBinding = null;
  roomBinding = null;
  derivationPromise = null;
}
