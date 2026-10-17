const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { transformSync } = require('@babel/core');

const sourcePath = path.resolve(__dirname, '../src/services/e2e.js');
const reconnectPolicyPath = path.resolve(__dirname, '../src/services/reconnectPolicy.js');
const proofOfWorkPath = path.resolve(__dirname, '../src/services/proofOfWork.js');

function arrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function loadIndependentE2E() {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const { code } = transformSync(source, {
    filename: sourcePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const module = { exports: {} };
  const expoCrypto = {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: async (_algorithm, input) =>
      arrayBuffer(crypto.createHash('sha256').update(Buffer.from(input)).digest()),
    digestStringAsync: async (_algorithm, input) =>
      crypto.createHash('sha256').update(input).digest('hex'),
    getRandomBytes: (length) => new Uint8Array(crypto.randomBytes(length)),
  };
  const localRequire = (id) => {
    if (id === 'expo-crypto') return expoCrypto;
    return require(id);
  };

  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}

function loadReconnectPolicy() {
  const source = fs.readFileSync(reconnectPolicyPath, 'utf8');
  const { code } = transformSync(source, {
    filename: reconnectPolicyPath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}

function loadProofOfWork() {
  const source = fs.readFileSync(proofOfWorkPath, 'utf8');
  const { code } = transformSync(source, {
    filename: proofOfWorkPath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}

async function establishPair(inviteA, inviteB, roomA = 'room-1', roomB = roomA) {
  const first = loadIndependentE2E();
  const second = loadIndependentE2E();
  first.setInviteBinding(inviteA);
  second.setInviteBinding(inviteB);
  first.setRoomBinding(roomA);
  second.setRoomBinding(roomB);
  const firstPublic = await first.generateKeys();
  const secondPublic = await second.generateKeys();
  await Promise.all([
    first.deriveSharedKey(secondPublic),
    second.deriveSharedKey(firstPublic),
  ]);
  return { first, second, roomA, roomB };
}

test('matching clients mutually confirm, share a safety code, and decrypt protocol 6 payloads', async () => {
  const pair = await establishPair('TALK-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH',
    'TALK-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH');
  try {
    const firstProof = pair.first.createKeyConfirmation(pair.roomA);
    const secondProof = pair.second.createKeyConfirmation(pair.roomB);
    assert.equal(pair.second.verifyKeyConfirmation(firstProof, pair.roomB), true);
    assert.equal(pair.first.verifyKeyConfirmation(secondProof, pair.roomA), true);
    assert.equal(await pair.first.getSafetyCode(), await pair.second.getSafetyCode());
    assert.match(await pair.first.getSafetyCode(), /^\d{3}(?: \d{3}){4}$/);
    assert.equal(pair.second.decrypt(pair.first.encrypt('authenticated message', 1)), 'authenticated message');
    assert.equal(pair.second.decrypt(pair.first.encrypt('next message', 2)), 'next message');
  } finally {
    pair.first.destroy();
    pair.second.destroy();
  }
});

test('different invite secrets or room bindings cannot confirm each other', async () => {
  const differentSecrets = await establishPair(
    'TALK-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH',
    'TALK-AAAA-BBBB-CCCC-DDDD-JJJJ-KKKK-LLLL-MMMM'
  );
  const differentRooms = await establishPair(null, null, 'room-a', 'room-b');
  try {
    assert.equal(differentSecrets.second.verifyKeyConfirmation(
      differentSecrets.first.createKeyConfirmation(differentSecrets.roomA),
      differentSecrets.roomB
    ), false);
    assert.notEqual(
      await differentSecrets.first.getSafetyCode(),
      await differentSecrets.second.getSafetyCode()
    );
    assert.equal(differentRooms.second.verifyKeyConfirmation(
      differentRooms.first.createKeyConfirmation(differentRooms.roomA),
      differentRooms.roomB
    ), false);
  } finally {
    differentSecrets.first.destroy();
    differentSecrets.second.destroy();
    differentRooms.first.destroy();
    differentRooms.second.destroy();
  }
});

test('low-order X25519 public keys are rejected', async () => {
  const client = loadIndependentE2E();
  await client.generateKeys();
  await assert.rejects(
    client.deriveSharedKey(Buffer.alloc(32).toString('base64')),
    /Unsafe peer public key/
  );
  client.destroy();
});

test('automatic reconnection is limited to two attempts and two seconds', () => {
  const policy = loadReconnectPolicy();
  assert.equal(policy.MAX_RECONNECT_ATTEMPTS, 2);
  assert.equal(policy.RECONNECT_WINDOW_MS, 2000);
  assert.equal(policy.shouldStopReconnect(2, 1999), false);
  assert.equal(policy.shouldStopReconnect(3, 1000), true);
  assert.equal(policy.shouldStopReconnect(1, 2000), true);
});

test('group proof-of-work is solved locally and cheaply verified by the backend', async () => {
  const proof = loadProofOfWork();
  const id = '20000000-0000-4000-8000-000000000002';
  const nonce = '0123456789abcdef0123456789abcdef';
  const solution = await proof.solveProofOfWork(id, nonce, 8);
  const digest = crypto.createHash('sha512').update(`${id}|${nonce}|${solution}`).digest();
  assert.equal(digest[0], 0);
});
