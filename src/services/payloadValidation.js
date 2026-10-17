// Validate without a recursive regular expression or allocating decoded bytes.
export function isValidBase64(value, maxCharacters) {
  if (typeof value !== 'string' || value.length === 0 ||
      value.length > maxCharacters || value.length % 4 !== 0) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  for (let i = 0; i < value.length - padding; i += 1) {
    const c = value.charCodeAt(i);
    if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
          (c >= 48 && c <= 57) || c === 43 || c === 47)) return false;
  }
  return true;
}

export function base64ByteLength(value) {
  return value.length / 4 * 3 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0);
}
