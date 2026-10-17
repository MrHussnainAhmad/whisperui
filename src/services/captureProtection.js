import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  isAvailableAsync,
  preventScreenCaptureAsync,
  enableAppSwitcherProtectionAsync,
} from 'expo-screen-capture';

// The fallback is restricted to development JavaScript running inside Expo Go.
// A broken/missing native module in an installed build must still fail closed.
export const isExpoGoFeatureTest = typeof __DEV__ !== 'undefined' && __DEV__ && isRunningInExpoGo();
const nativePrivacy = Platform.OS === 'ios' ? requireOptionalNativeModule('WhisperPrivacy') : null;
let initialization = null;
export function ensureCaptureProtection() {
  if (!initialization) {
    initialization = (async () => {
      if (Platform.OS === 'ios' && !nativePrivacy && !isExpoGoFeatureTest) {
        throw new Error('The native privacy module is missing. Install a current Whisper iOS build.');
      }
      // Use the protection bundled with Expo Go where supported; never claim it
      // exercises our custom native recording/lifecycle cover or Android plugin.
      try {
        if (!(await isAvailableAsync())) throw new Error('Capture protection unavailable');
        await preventScreenCaptureAsync('whisper-app');
        if (Platform.OS === 'ios') {
          if (nativePrivacy) await nativePrivacy.initialize();
          await enableAppSwitcherProtectionAsync(1);
        }
      } catch (error) {
        if (!isExpoGoFeatureTest) throw error;
        return { featureTest: true, expoCaptureProtection: false, nativePrivacy: false };
      }
      return { featureTest: isExpoGoFeatureTest, expoCaptureProtection: true,
        nativePrivacy: Platform.OS === 'ios' ? Boolean(nativePrivacy) : !isExpoGoFeatureTest };
    })();
  }
  return initialization;
}

export async function isScreenBeingCaptured() {
  await ensureCaptureProtection();
  // Expo Go has no custom recording-state bridge. Unknown is not proof that
  // capture is absent; the persistent test banner explains this limitation.
  return nativePrivacy ? nativePrivacy.isCaptured() : false;
}
export function observeCaptureState(listener) {
  return nativePrivacy?.addListener('onCaptureState', listener) || { remove() {} };
}
