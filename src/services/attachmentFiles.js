import { File, Directory, Paths } from 'expo-file-system';
import * as Legacy from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';

const root = new Directory(Paths.cache, 'whisper-chat-media');
let initialized = false;
let generation = 0;
const owned = new Set();
export function initializeAttachmentFiles() {
  if (initialized) return;
  if (root.exists) root.delete();
  root.create({ intermediates: true });
  initialized = true;
}
export function newAttachmentFile(extension = 'bin') {
  initializeAttachmentFiles();
  const suffix = /^[a-z0-9]{1,8}$/i.test(extension) ? extension : 'bin';
  const file = new File(root, `${Crypto.randomUUID()}.${suffix}`);
  file.create();
  owned.add(file.uri);
  return file;
}
export function isOwnedAttachment(uri) { return typeof uri === 'string' && owned.has(uri); }
export function deleteAttachment(uri) {
  if (!owned.delete(uri)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Startup cleanup retries. */ }
}
export function clearAttachmentFiles() {
  generation += 1;
  for (const uri of [...owned]) deleteAttachment(uri);
}
export async function stageAttachment(uri, extension = 'bin', ownedSource = false) {
  if (isOwnedAttachment(uri)) return { fileUri: uri, fileSize: new File(uri).size };
  const epoch = generation;
  const file = newAttachmentFile(extension);
  try {
    const movable = ownedSource || (Legacy.cacheDirectory && uri.startsWith(Legacy.cacheDirectory));
    requireStorage(movable ? 0 : new File(uri).size);
    file.delete();
    if (movable) await Legacy.moveAsync({ from: uri, to: file.uri });
    else await Legacy.copyAsync({ from: uri, to: file.uri });
    if (epoch !== generation) throw new Error('Chat ended');
    return { fileUri: file.uri, fileSize: file.size };
  } catch (error) {
    deleteAttachment(file.uri);
    try { if (file.exists) file.delete(); } catch {}
    throw error;
  }
}
export function encodeChunk(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 16384) result += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(result);
}
export function decodeChunk(data) { return Uint8Array.from(atob(data), (char) => char.charCodeAt(0)); }
export function requireStorage(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > Paths.availableDiskSpace - 16 * 1024 * 1024) {
    throw new Error('Not enough private storage for this attachment');
  }
}
export function mediaExtension(mime) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4', 'audio/mp4': 'm4a',
    'application/pdf': 'pdf', 'text/plain': 'txt' })[mime] || 'bin';
}

// Strip JPEG application metadata without reading the compressed image into RAM.
export function cleanJpegFile(uri, brandedHeader = null) {
  const source = new File(uri);
  const output = newAttachmentFile('jpg');
  let reader; let writer;
  try {
    reader = source.open(); writer = output.open();
    const first = reader.readBytes(2);
    if (first[0] !== 255 || first[1] !== 216) throw new Error('Invalid JPEG');
    writer.writeBytes(first);
    if (brandedHeader) writer.writeBytes(brandedHeader);
    while (reader.offset < source.size) {
      const marker = reader.readBytes(2);
      if (marker.length !== 2 || marker[0] !== 255) throw new Error('Invalid JPEG segment');
      if (marker[1] === 218 || marker[1] === 217) {
        writer.writeBytes(marker);
        while (reader.offset < source.size) {
          const bytes = reader.readBytes(98304);
          requireStorage(bytes.length);
          writer.writeBytes(bytes);
        }
        return { fileUri: output.uri, fileSize: output.size };
      }
      const lengthBytes = reader.readBytes(2);
      const length = (lengthBytes[0] << 8) | lengthBytes[1];
      if (lengthBytes.length !== 2 || length < 2 || reader.offset + length - 2 > source.size) throw new Error('Invalid JPEG segment');
      const bytes = reader.readBytes(length - 2);
      if (!(marker[1] >= 225 && marker[1] <= 239) && marker[1] !== 254) {
        writer.writeBytes(marker); writer.writeBytes(lengthBytes); writer.writeBytes(bytes);
      }
    }
    throw new Error('Incomplete JPEG');
  } catch (error) { deleteAttachment(output.uri); throw error; }
  finally { reader?.close(); writer?.close(); }
}
