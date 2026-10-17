// Only JPEGs produced by the photo re-encoder use this sanitizer. Generic
// documents/videos require their own format-aware sanitizers.
export function jpegMetadata(base64, branded = false) {
  const source = atob(base64);
  if (source.charCodeAt(0) !== 255 || source.charCodeAt(1) !== 216) throw new Error('Invalid JPEG');
  const parts = [source.slice(0, 2)];
  let offset = 2;
  while (offset < source.length) {
    if (source.charCodeAt(offset) !== 255) throw new Error('Invalid JPEG segment');
    const marker = source.charCodeAt(offset + 1);
    if (marker === 218 || marker === 217) {
      parts.push(source.slice(offset));
      break;
    }
    const length = (source.charCodeAt(offset + 2) << 8) | source.charCodeAt(offset + 3);
    if (length < 2 || offset + length + 2 > source.length) throw new Error('Invalid JPEG length');
    // Strip application metadata and comments, retaining only JFIF APP0.
    if (!(marker >= 225 && marker <= 239) && marker !== 254) parts.push(source.slice(offset, offset + length + 2));
    offset += length + 2;
  }
  if (branded) {
    const label = 'Whisperchat\0';
    const tiff = new Uint8Array(62 + label.length);
    const view = new DataView(tiff.buffer);
    tiff.set([73, 73, 42, 0, 8, 0, 0, 0]);
    view.setUint16(8, 4, true);
    [0x010e, 0x0131, 0x013b, 0x8298].forEach((tag, index) => {
      const at = 10 + index * 12;
      view.setUint16(at, tag, true); view.setUint16(at + 2, 2, true);
      view.setUint32(at + 4, label.length, true); view.setUint32(at + 8, 62, true);
    });
    tiff.set(Array.from(label, (c) => c.charCodeAt(0)), 62);
    const payload = 'Exif\0\0' + String.fromCharCode(...tiff);
    const size = payload.length + 2;
    parts.splice(1, 0, String.fromCharCode(255, 225, size >> 8, size & 255) + payload);
  }
  return btoa(parts.join(''));
}
