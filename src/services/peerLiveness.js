// Authenticated challenges use the encrypted channel. Server pings alone do
// not prove that a peer is still participating. Defaults need real Tor/device
// measurements before release; they are not an instantaneous-close guarantee.
const INTERVAL_MS = 10_000;
const EXPIRY_MS = 35_000;
const now = () => globalThis.performance.now();

export function startPeerLiveness({ createChallenge, sendChallenge, onExpired }) {
  let stopped = false;
  let lastResponse = now();
  const pending = new Map();
  const expire = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    pending.clear();
    onExpired();
  };
  const check = () => {
    if (!stopped && now() - lastResponse >= EXPIRY_MS) expire();
    return !stopped;
  };
  const tick = () => {
    if (!check()) return;
    for (const [challenge, sentAt] of pending) {
      if (now() - sentAt >= EXPIRY_MS) pending.delete(challenge);
    }
    if (pending.size >= 4) return;
    const challenge = createChallenge();
    pending.set(challenge, now());
    sendChallenge(challenge).catch(() => {});
  };
  const timer = setInterval(tick, INTERVAL_MS);
  tick();
  return {
    check,
    accept(challenge) {
      if (!check() || !pending.has(challenge)) return;
      pending.delete(challenge);
      lastResponse = now();
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      pending.clear();
    },
  };
}
