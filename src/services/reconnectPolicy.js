export const MAX_RECONNECT_ATTEMPTS = 2;
export const RECONNECT_WINDOW_MS = 2000;
// A phone may need a few seconds to wake its radio and complete TLS on launch.
// This only applies to the initial connection; reconnection remains bounded below.
export const INITIAL_CONNECTION_TIMEOUT_MS = 10000;
export const CONNECTION_ATTEMPT_TIMEOUT_MS = 5000;

export function shouldStopReconnect(attempt, elapsedMs) {
  return attempt > MAX_RECONNECT_ATTEMPTS || elapsedMs >= RECONNECT_WINDOW_MS;
}
