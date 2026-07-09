import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Server URL for Socket.IO.
 *
 * Priority:
 * 1. EXPO_PUBLIC_SERVER_URL from .env
 * 2. extra.serverUrl from app.json
 * 3. Dev auto-detect (Android emulator / iOS simulator)
 * 4. Fail closed in production
 */
export function getServerUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_SERVER_URL?.trim();
  const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
  const configured = fromEnv || extra.serverUrl?.trim();

  if (configured) {
    if (!__DEV__) {
      let parsed;
      try {
        parsed = new URL(configured);
      } catch {
        throw new Error('Production server URL is invalid');
      }
      if (parsed.protocol !== 'https:') throw new Error('Production server URL must use HTTPS');
      if (parsed.username || parsed.password) throw new Error('Production server URL cannot contain credentials');
    }
    return configured;
  }

  if (__DEV__) {
    if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  throw new Error('EXPO_PUBLIC_SERVER_URL is required for production builds');
}
