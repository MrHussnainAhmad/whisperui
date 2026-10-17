const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('@babel/core');

function load({ dev = true, expoGo = true, native = null, available = true, captureError = null } = {}) {
  const calls = [];
  const filename = path.resolve(__dirname, '../src/services/captureProtection.js');
  const { code } = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const modules = {
    'react-native': { Platform: { OS: 'ios' } },
    expo: { isRunningInExpoGo: () => expoGo },
    'expo-modules-core': { requireOptionalNativeModule: () => native },
    'expo-screen-capture': {
      isAvailableAsync: async () => available,
      preventScreenCaptureAsync: async () => { calls.push('prevent'); if (captureError) throw captureError; },
      enableAppSwitcherProtectionAsync: async () => { calls.push('switcher'); },
    },
  };
  const result = { exports: {} };
  new Function('require', 'module', 'exports', '__DEV__', code)((id) => modules[id], result, result.exports, dev);
  return { ...result.exports, calls };
}
test('iOS Expo Go development chat enables available Expo protections without requiring custom native code', async () => {
  const api = load();
  const [first, second] = await Promise.all([api.ensureCaptureProtection(), api.ensureCaptureProtection()]);
  assert.equal(first.featureTest, true);
  assert.equal(first.nativePrivacy, false);
  assert.equal(first.expoCaptureProtection, true);
  assert.equal(first, second);
  assert.deepEqual(api.calls, ['prevent', 'switcher']);
});
test('Expo Go can test features when its capture API is unavailable or fails', async () => {
  for (const options of [{ available: false }, { captureError: new Error('unsupported host') }]) {
    const api = load(options);
    const result = await api.ensureCaptureProtection();
    assert.equal(result.featureTest, true);
    assert.equal(result.expoCaptureProtection, false);
    assert.equal(result.nativePrivacy, false);
  }
});
test('installed iOS builds never bypass a missing custom privacy module', async () => {
  for (const dev of [true, false]) {
    const api = load({ dev, expoGo: false });
    assert.equal(api.isExpoGoFeatureTest, false);
    await assert.rejects(api.ensureCaptureProtection(), /native privacy module is missing/);
  }
});
test('release JavaScript cannot enable the Expo Go fallback', async () => {
  const api = load({ dev: false, expoGo: true });
  assert.equal(api.isExpoGoFeatureTest, false);
  await assert.rejects(api.ensureCaptureProtection(), /native privacy module is missing/);
});
test('native initialization failures stay terminal in installed builds', async () => {
  let attempts = 0;
  const api = load({ expoGo: false, native: {
    initialize: async () => { attempts++; throw new Error('native failure'); },
  } });
  await assert.rejects(api.ensureCaptureProtection(), /native failure/);
  await assert.rejects(api.ensureCaptureProtection(), /native failure/);
  assert.equal(attempts, 1);
});
test('installed builds retain native captured-state and event reporting', async () => {
  const listener = () => {};
  const subscription = { remove() {} };
  const api = load({ expoGo: false, native: {
    initialize: async () => {}, isCaptured: async () => true,
    addListener: (event, callback) => { assert.equal(event, 'onCaptureState'); assert.equal(callback, listener); return subscription; },
  } });
  assert.equal((await api.ensureCaptureProtection()).nativePrivacy, true);
  assert.equal(await api.isScreenBeingCaptured(), true);
  assert.equal(api.observeCaptureState(listener), subscription);
});
