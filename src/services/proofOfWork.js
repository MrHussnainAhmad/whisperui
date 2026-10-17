const nacl = require('tweetnacl');

function hasLeadingZeroBits(bytes, bits) {
  const fullBytes = Math.floor(bits / 8);
  for (let index = 0; index < fullBytes; index += 1) {
    if (bytes[index] !== 0) return false;
  }
  const remainder = bits % 8;
  return remainder === 0 || (bytes[fullBytes] & (0xff << (8 - remainder))) === 0;
}

export async function solveProofOfWork(id, nonce, difficultyBits) {
  if (typeof id !== 'string' || typeof nonce !== 'string' ||
      !Number.isInteger(difficultyBits) || difficultyBits < 4 || difficultyBits > 20) {
    throw new Error('Invalid security challenge');
  }
  const encoder = new TextEncoder();
  for (let solution = 0; solution <= 1_000_000; solution += 1) {
    const digest = nacl.hash(encoder.encode(`${id}|${nonce}|${solution}`));
    if (hasLeadingZeroBits(digest, difficultyBits)) return solution;
    if (solution > 0 && solution % 512 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  throw new Error('Security challenge could not be completed');
}
