import * as FileSystem from 'expo-file-system/legacy';
let cleanup;
// Expo Camera owns this private cache folder. Run once before any new captures.
export function cleanAbandonedCaptures() {
  if (!cleanup) cleanup = FileSystem.cacheDirectory
    ? FileSystem.deleteAsync(`${FileSystem.cacheDirectory}Camera/`, { idempotent: true })
    : Promise.resolve();
  return cleanup;
}
