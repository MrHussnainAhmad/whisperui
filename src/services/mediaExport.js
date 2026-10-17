import { isOwnedAttachment, cleanJpegFile, decodeChunk, deleteAttachment } from './attachmentFiles';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import { isValidBase64 } from './payloadValidation';
import { jpegMetadata } from './photoMetadata';
import { nativeAttachments, rebuildPdf, initializeAttachmentTools, hasNativeDocumentTools } from './documentMedia';

const exportDirectory = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}whisper-exports/` : null;
let exporting = false;
let startupCleanup = null;

export function cleanAbandonedExports() {
  if (!startupCleanup) {
    const cleanup = exportDirectory
      ? FileSystem.deleteAsync(exportDirectory, { idempotent: true })
      : Promise.resolve();
    startupCleanup = Promise.all([cleanup, initializeAttachmentTools()]);
  }
  return startupCleanup;
}

function attachmentData(message) {
  if (message?.isSent || message?.allowSaving !== true) throw new Error('The sender has not allowed saving this attachment');
  if (isOwnedAttachment(message.fileUri)) return { fileUri: message.fileUri };
  const data = message.type === 'image' ? message.imageData
    : message.type === 'video' ? message.videoData
      : message.type === 'file' ? message.fileData : null;
  if (!isValidBase64(data, 4_000_000)) throw new Error('Invalid attachment');
  return data;
}

function exportName(message) {
  // Never use a peer-controlled path. Keep only a short, plain extension.
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
    'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
    'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/webm': 'webm' };
  const extension = extensions[message.mimeType] || message.fileName?.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1] || 'bin';
  return `Whisperchat-${Crypto.randomUUID()}.${extension}`;
}

export async function saveReceivedMedia(message, isSessionActive) {
  if (exporting) throw new Error('An export is already in progress');
  const original = attachmentData(message);
  if (!isSessionActive()) throw new Error('Chat ended');
  exporting = true;
  let temporaryUri = null;
  let destination = null;
  let complete = false;
  let brandedUri = null;
  try {
    let data = original;
    if (original.fileUri) {
      if (message.mimeType === 'image/jpeg') {
        const header = decodeChunk(jpegMetadata(btoa(String.fromCharCode(255, 216, 255, 217)), true)).slice(2, -2);
        data = cleanJpegFile(original.fileUri, header);
        brandedUri = data.fileUri;
      } else if (message.mimeType === 'application/pdf' && message.fileSize <= 3_000_000 && hasNativeDocumentTools()) {
        const base64 = await FileSystem.readAsStringAsync(original.fileUri, { encoding: 'base64' });
        data = await rebuildPdf(base64, true, isSessionActive);
      }
    } else if (message.mimeType === 'image/jpeg') data = jpegMetadata(original, true);
    else if (message.mimeType === 'application/pdf' && hasNativeDocumentTools()) data = await rebuildPdf(original, true, isSessionActive);
    await cleanAbandonedExports();
    if (!isSessionActive()) throw new Error('Chat ended');
    const name = exportName(message);
    if (Platform.OS === 'android') {
      if (!nativeAttachments) throw new Error('Install the updated native build to save attachments');
      destination = await nativeAttachments.chooseSaveFile(name, message.mimeType);
      if (!destination) return false;
      if (!isSessionActive()) throw new Error('Chat ended');
      if (data.fileUri) {
        if (!nativeAttachments.copyChosenFile) throw new Error('Install the updated native build to save attachments');
        await nativeAttachments.copyChosenFile(destination, data.fileUri);
      } else await nativeAttachments.writeChosenFile(destination, data);
      if (!isSessionActive()) throw new Error('Chat ended');
      complete = true;
      return true;
    }
    if (Platform.OS !== 'ios' || !exportDirectory || !(await Sharing.isAvailableAsync())) {
      throw new Error('Saving is unavailable on this device');
    }
    if (!isSessionActive()) throw new Error('Chat ended');
    await FileSystem.makeDirectoryAsync(exportDirectory, { intermediates: true });
    temporaryUri = `${exportDirectory}${name}`;
    if (data.fileUri) await FileSystem.copyAsync({ from: data.fileUri, to: temporaryUri });
    else await FileSystem.writeAsStringAsync(temporaryUri, data, { encoding: FileSystem.EncodingType.Base64 });
    if (!isSessionActive()) throw new Error('Chat ended');
    // An explicit export leaves the app's privacy boundary. The OS share sheet
    // may create persistent copies; its completion is not proof a file saved.
    await Sharing.shareAsync(temporaryUri, { mimeType: message.mimeType, dialogTitle: 'Save attachment' });
    return true;
  } finally {
    try {
      if (brandedUri) deleteAttachment(brandedUri);
      if (temporaryUri) await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
      if (destination) await nativeAttachments.finishExport(complete);
    } finally { exporting = false; }
  }
}
