# Security policy

## Reporting

Use GitHub private vulnerability reporting for this repository. Never attach
production secrets, signing keys, private conversations, or real user data.

## Implementation status

Development and release builds connect directly over HTTPS to
`https://mywhisperchat.duckdns.org` by default, as requested for the deployed
server. `EXPO_PUBLIC_SERVER_URL` can override the HTTPS origin at build time.
Direct connections expose the device IP to the destination; native Tor transport
is unfinished. This deployment does not provide IP anonymity.

The following describe intended behavior of the current source, not verified
guarantees. No tests or native builds were run for this implementation pass.

- Production networking requires HTTPS and Android trusts system certificate
  authorities only.
- One-to-one payloads use authenticated X25519-derived session keys and a
  distinct direction- and sequence-bound encryption key per message.
- Authenticated peer receipts distinguish relay acceptance from peer receipt.
- Encryption keys and text conversations are held in memory. Chunked media is
  staged and received in private temporary plaintext files on the device, not
  Photos/Gallery or shared storage; chat teardown and startup clean these files. Explicitly authorized
  media exports create files. Native attachment preparation also uses private
  temporary files, deleted on completion and cleaned on initialization after an
  interrupted run; this is not a forensic-erasure guarantee. App-owned temporary files are cleaned up, but
  recipient copies cannot be recalled or controlled cryptographically.
- Group chat is public and is not presented as end-to-end encrypted.

Protocol v6 retains room binding and encrypted control messages and adds bounded
encrypted attachment chunks with a 256-sequence replay window. Both clients and
server must be upgraded together. The current custom
X25519/XSalsa20 protocol is NOT post-quantum and has NO forward-secret message
ratchet. A reviewed replacement is still required. Old invites/clients are
incompatible with this version.

Android secure windows and overlay restrictions, and an iOS native privacy
cover with Expo capture protection, require native builds and device testing.
iOS screenshot prevention for arbitrary UI is not an Apple-supported guarantee.
Recorder detection cannot identify every third-party recorder or external camera.

Saving permission is independent in each direction and applies to future media.
It never disables capture protection. Peer liveness currently expires after a
provisional 35 seconds without an authenticated response; remote shutdown cannot
be instantaneous during a network partition.

Certificate pinning, Play Integrity, and Apple App Attest require production
certificate lifecycle control and platform credentials. They must not be
enabled with placeholder pins or unverified tokens.

The protocol has not received an independent professional cryptographic audit.

## Native build configuration (October 15, 2026)

EAS builds exclude `/android/` and `/ios/` through `.easignore` and generate
native projects from Expo config. Existing local Android sources are retained;
`.gitignore` does not untrack previously committed files. Apply native changes
through config plugins so EAS receives them. The privacy plugin recreates secure
window/overlay/audio restrictions and system-only certificate trust settings.
Playback now uses expo-video with caching, background playback, native controls,
fullscreen and picture-in-picture disabled.

`npx expo-doctor@latest` passed 21/21 checks after these changes. Only the local
`whisper-privacy` module is excluded from React Native Directory validation,
because it is private source in this repository, not a published directory entry.
This diagnostic result is not native-build, playback or security verification.

## Large attachment transfers

Protocol 6 removes the 3 MB total media-transfer limit. The sender reads 96 KiB
chunks from private files; the receiver writes chunks incrementally and sends
encrypted per-chunk acknowledgements. Each transfer permits four chunks in flight
and at most two concurrent attachments per device. A stalled incoming transfer
expires after 60 seconds without a chunk. Storage exhaustion, chat expiry, session
closure and connectivity loss can still stop a transfer; there is no unlimited
storage or successful-delivery guarantee. Device storage keeps a 16 MiB reserve.

Both clients and the backend require protocol 6. Updated native builds are needed
for file-based video remux and streamed Android export. The relay keeps bounded
packet queues only, with per-second count/byte rate limits and retry responses.
It does not store attachment files or plaintext.

Document conversion and preview retain separate parser/resource limits. Larger
or unsupported documents can be sent unchanged after explicit confirmation that
original metadata/embedded content will be included. Encryption does not remove
that metadata. Camera recording no longer has the previous 30-second/2.8 MB stop.

## Expo Go development feature-test mode

Development JavaScript running in Expo Go can exercise matching, invites, E2EE,
photos and chunked file transfer without the custom WhisperPrivacy bridge.
Available Expo capture protection is attempted. A persistent chat banner and an
encrypted notice to the peer identify the feature-test session. Missing native
protection never receives a successful security-verification claim from this mode.
An installed app with a missing/failing native privacy module still fails closed,
and release JavaScript cannot select the fallback.

Expo Go cannot validate our custom recording-state detection, native privacy
covers, Android window plugins, native video metadata removal or PDF renderer.
Original video/audio can be sent for testing only after explicit metadata consent;
PDF originals follow the existing metadata-consent flow. Native PDF previews are
unavailable. Full security acceptance testing still requires installed builds.
