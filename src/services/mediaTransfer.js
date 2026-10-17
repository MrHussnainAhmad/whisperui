import { newAttachmentFile, deleteAttachment, decodeChunk, requireStorage, mediaExtension, clearAttachmentFiles } from './attachmentFiles';
export const CHUNK_BYTES = 98304;
export const CHUNK_CHARS = 131072;
const incoming = new Map();
function dispose(id) {
  const transfer = incoming.get(id);
  if (!transfer) return;
  incoming.delete(id);
  clearTimeout(transfer.timer);
  for (const part of transfer.parts.values()) part.fill(0);
  transfer.parts.clear();
  try { transfer.handle.close(); } catch { }
  deleteAttachment(transfer.file.uri);
}
export function clearMediaTransfers() {
  for (const id of [...incoming.keys()]) dispose(id);
  clearAttachmentFiles();
}
export function acceptMediaChunk(chunk) {
  let transfer = incoming.get(chunk.transferId);
  try {
    if (!transfer) {
      if (incoming.size >= 2 || chunk.index >= 4) throw new Error('Too many pending attachments');
      requireStorage(chunk.descriptor.fileSize);
      const file = newAttachmentFile(mediaExtension(chunk.descriptor.mimeType));
      let handle;
      try { handle = file.open(); } catch (error) { deleteAttachment(file.uri); throw error; }
      transfer = { file, handle, descriptor: JSON.stringify(chunk.descriptor), count: chunk.count,
        parts: new Map(), next: 0, bytes: 0, timer: null };
      incoming.set(chunk.transferId, transfer);
    }
    if (transfer.count !== chunk.count || transfer.descriptor !== JSON.stringify(chunk.descriptor) ||
        chunk.index < transfer.next || chunk.index >= transfer.next + 4 || transfer.parts.has(chunk.index)) {
      throw new Error('Invalid attachment sequence');
    }
    const bytes = decodeChunk(chunk.data);
    const expected = Math.min(CHUNK_BYTES, chunk.descriptor.fileSize - chunk.index * CHUNK_BYTES);
    if (bytes.length !== expected) throw new Error('Attachment size mismatch');
    transfer.parts.set(chunk.index, bytes);
    while (transfer.parts.has(transfer.next)) {
      const part = transfer.parts.get(transfer.next);
      requireStorage(part.length);
      transfer.handle.writeBytes(part);
      transfer.bytes += part.length;
      part.fill(0);
      transfer.parts.delete(transfer.next++);
    }
    clearTimeout(transfer.timer);
    transfer.timer = setTimeout(() => dispose(chunk.transferId), 60_000); // Idle timeout, not total duration.
    if (transfer.next !== transfer.count) return null;
    if (transfer.bytes !== chunk.descriptor.fileSize) throw new Error('Attachment size mismatch');
    transfer.handle.close();
    clearTimeout(transfer.timer);
    incoming.delete(chunk.transferId);
    const { type, mimeType, fileName, fileSize, allowSaving } = chunk.descriptor;
    return { type, mimeType, fileName, fileSize, allowSaving, messageId: chunk.transferId, fileUri: transfer.file.uri };
  } catch (error) { dispose(chunk.transferId); throw error; }
}
