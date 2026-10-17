import { zlibSync } from 'fflate';
const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

export function createInviteMatrix(value) {
  if (typeof value !== 'string' || !value.length || value.length > 256) throw new Error('Invalid invite');
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(value);
  qr.make();
  return qr.modules;
}

function chunk(type, data) {
  const output = new Uint8Array(data.length + 12);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(Array.from(type, (char) => char.charCodeAt(0)), 4);
  output.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of output.subarray(4, output.length - 4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(output.length - 4, (crc ^ 0xffffffff) >>> 0);
  return output;
}

// Generate opaque grayscale PNG pixels from the QR matrix, not a screen capture.
export function inviteQrPng(value) {
  const matrix = createInviteMatrix(value);
  const scale = 8;
  const quiet = 4;
  const size = (matrix.length + quiet * 2) * scale;
  const pixels = new Uint8Array((size + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / scale) - quiet;
    for (let x = 0; x < size; x++) {
      const column = Math.floor(x / scale) - quiet;
      pixels[y * (size + 1) + x + 1] = matrix[row]?.[column] ? 0 : 255;
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, size); view.setUint32(4, size);
  header[8] = 8; // 8-bit grayscale, no alpha, no interlacing.
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', zlibSync(pixels)), chunk('IEND', new Uint8Array())];
  let binary = '';
  for (const part of parts) {
    for (let offset = 0; offset < part.length; offset += 16384) {
      binary += String.fromCharCode(...part.subarray(offset, offset + 16384));
    }
  }
  return btoa(binary);
}
