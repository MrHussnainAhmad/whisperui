/**
 * Ephemeral X25519 + XSalsa20-Poly1305 encryption.
 *
 * Keys are generated and used in JavaScript memory because tweetnacl cannot
 * operate on non-exportable platform-keystore keys. The private key is never
 * written to storage and its byte buffer is wiped after key agreement.
 * Invite chats mix in an 80-bit client-only secret that the relay never sees.
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
let derivationPromise = null;
let keyEpoch = 0;

export function setInviteBinding(code) {
  inviteBinding = code ? code.toUpperCase().trim() : null;
}

async function applyInviteBinding(baseKey) {
  if (!inviteBinding) return baseKey;

  // The full invite code contains an 80-bit client-only authentication secret.
  // Only its independent 80-bit routing locator was sent to the relay.
  const context = new TextEncoder().encode(`whisper-invite-v1|${inviteBinding}`);
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

  let derived;
  try {
    derived = nacl.box.before(peerPublicKey, privateKey);
  } finally {
    privateKey.fill(0);
    privateKey = null;
    peerPublicKey.fill(0);
  }

  if (derived.every((byte) => byte === 0)) {
    derived.fill(0);
    throw new Error('Unsafe peer public key');
  }
  const finalKey = await applyInviteBinding(derived);
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
  if (!ourPubBase64 || !peerPubBase64) return null;
  const sorted = [ourPubBase64, peerPubBase64].sort();
  const hash = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    `${sorted[0]}|${sorted[1]}`
  );
  const digits = [];
  for (let i = 0; i < 18; i += 2) digits.push(parseInt(hash.slice(i, i + 2), 16) % 10);
  const code = digits.join('');
  return `${code.slice(0, 3)} ${code.slice(3, 6)} ${code.slice(6, 9)}`;
}

export function encrypt(plaintext) {
  if (!sharedKey) throw new Error('E2E not ready');
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const message = new TextEncoder().encode(plaintext);
  const cipher = nacl.box.after(message, nonce, sharedKey);
  const packed = new Uint8Array(nonce.length + cipher.length);
  packed.set(nonce);
  packed.set(cipher, nonce.length);
  const result = toBase64(packed);
  message.fill(0);
  packed.fill(0);
  return result;
}

export function decrypt(packedBase64) {
  if (!sharedKey) return null;
  try {
    const packed = fromBase64(packedBase64);
    if (packed.length <= nacl.box.nonceLength) return null;
    const nonce = packed.slice(0, nacl.box.nonceLength);
    const cipher = packed.slice(nacl.box.nonceLength);
    const plaintext = nacl.box.open.after(cipher, nonce, sharedKey);
    packed.fill(0);
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
  derivationPromise = null;
}
