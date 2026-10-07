import { crc32 } from './crc32';
import type { IncreaseSizeResult } from './types';

/**
 * Increases image file size by padding format-compliant metadata chunks
 * (COM segments for JPEG, tEXt chunk for PNG, VP8X+EXIF chunk for WebP).
 * Pixel data is not modified and image format is preserved.
 */
export async function increaseImageSize(
  blob: Blob,
  targetSizeKb: number,
  mimeType?: string,
  _fileName?: string
): Promise<IncreaseSizeResult> {
  const targetSizeBytes = Math.round(targetSizeKb * 1024);
  const currentSizeBytes = blob.size;

  if (currentSizeBytes >= targetSizeBytes) {
    return {
      blob,
      skipped: true,
      reason: 'Already meets target size',
    };
  }

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);

  // Detect image type by magic bytes or MIME type
  const isJpeg =
    bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const isWebP =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if (isJpeg) {
    const paddedBlob = padJpeg(bytes, dataView, targetSizeBytes, blob.type || mimeType || 'image/jpeg');
    return { blob: paddedBlob, skipped: false };
  }

  if (isPng) {
    const paddedBlob = padPng(bytes, dataView, targetSizeBytes, blob.type || mimeType || 'image/png');
    return { blob: paddedBlob, skipped: false };
  }

  if (isWebP) {
    const paddedBlob = padWebP(bytes, dataView, targetSizeBytes, blob.type || mimeType || 'image/webp');
    return { blob: paddedBlob, skipped: false };
  }

  throw new Error('Unsupported image format. Please upload JPEG, PNG, or WebP.');
}

/**
 * Pads a JPEG image by inserting one or more COM (0xFF 0xFE) chunks after SOI (0xFF 0xD8).
 */
function padJpeg(
  bytes: Uint8Array,
  _dataView: DataView,
  targetSizeBytes: number,
  type: string
): Blob {
  const currentLen = bytes.byteLength;
  const bytesToAdd = targetSizeBytes - currentLen;

  // Determine insertion offset for COM segments.
  // In standard JFIF/EXIF, APP0 (0xFF 0xE0) or APP1 (0xFF 0xE1) markers must immediately
  // follow SOI (0xFF 0xD8) at offset 2. We preserve all initial APP markers (APP0..APP15)
  // so APP0/APP1 remain immediately after SOI, inserting COM segments after them.
  let insertOffset = 2;
  while (insertOffset + 4 <= currentLen && bytes[insertOffset] === 0xff) {
    const marker = bytes[insertOffset + 1];
    if (marker >= 0xe0 && marker <= 0xef) {
      const segLen = (bytes[insertOffset + 2] << 8) | bytes[insertOffset + 3];
      insertOffset += 2 + segLen;
    } else {
      break;
    }
  }

  // Split bytesToAdd into valid JPEG COM segments (max 65535 bytes per segment, min 4 bytes)
  const segments: number[] = [];
  let rem = Math.max(bytesToAdd, 4);

  while (rem > 0) {
    let seg = Math.min(rem, 65535);
    if (rem - seg > 0 && rem - seg < 4) {
      seg = rem - 4; // leave at least 4 bytes for next segment
    }
    segments.push(seg);
    rem -= seg;
  }

  const totalPadding = segments.reduce((sum, s) => sum + s, 0);
  const finalSize = currentLen + totalPadding;
  const outBuffer = new ArrayBuffer(finalSize);
  const outBytes = new Uint8Array(outBuffer);
  const outView = new DataView(outBuffer);

  // Copy everything up to insertOffset (preserves SOI and all APP headers)
  outBytes.set(bytes.subarray(0, insertOffset), 0);

  // Write COM segments starting at insertOffset
  let outPos = insertOffset;
  for (const segSize of segments) {
    outBytes[outPos] = 0xff;
    outBytes[outPos + 1] = 0xfe; // COM marker
    outView.setUint16(outPos + 2, segSize - 2, false); // Length field (includes length bytes)
    outPos += segSize;
  }

  // Copy remaining original JPEG content from insertOffset
  outBytes.set(bytes.subarray(insertOffset), outPos);

  return new Blob([outBuffer], { type });
}

/**
 * Pads a PNG image by inserting a tEXt chunk before the IEND chunk.
 */
function padPng(
  bytes: Uint8Array,
  dataView: DataView,
  targetSizeBytes: number,
  type: string
): Blob {
  const currentLen = bytes.byteLength;
  const bytesToAdd = targetSizeBytes - currentLen;

  // Find IEND chunk location by scanning PNG chunks
  let iendOffset = currentLen - 12;
  let scanPos = 8;

  while (scanPos + 8 <= currentLen) {
    const chunkDataLen = dataView.getUint32(scanPos, false);
    const chunkType = String.fromCharCode(
      bytes[scanPos + 4],
      bytes[scanPos + 5],
      bytes[scanPos + 6],
      bytes[scanPos + 7]
    );

    if (chunkType === 'IEND') {
      iendOffset = scanPos;
      break;
    }

    scanPos += 12 + chunkDataLen;
  }

  // PNG chunk structure:
  // 4 bytes Length + 4 bytes Type ('tEXt') + Data + 4 bytes CRC = 12 + DataLen
  // Data: Keyword (1..79 bytes) + 0x00 + Text
  const totalChunkSize = Math.max(bytesToAdd, 14);
  const dataLen = totalChunkSize - 12;

  let keyword = 'Comment';
  let keywordLen = 7;
  if (dataLen < 8) {
    keywordLen = Math.max(1, dataLen - 1);
    keyword = 'C'.repeat(keywordLen);
  }

  const finalSize = currentLen + totalChunkSize;
  const outBuffer = new ArrayBuffer(finalSize);
  const outBytes = new Uint8Array(outBuffer);
  const outView = new DataView(outBuffer);

  // Copy bytes up to IEND
  outBytes.set(bytes.subarray(0, iendOffset), 0);

  // Write tEXt chunk
  let pos = iendOffset;
  outView.setUint32(pos, dataLen, false); // Length
  pos += 4;

  const typeAndDataStart = pos;
  outBytes[pos] = 0x74; // 't'
  outBytes[pos + 1] = 0x45; // 'E'
  outBytes[pos + 2] = 0x58; // 'X'
  outBytes[pos + 3] = 0x74; // 't'
  pos += 4;

  for (let i = 0; i < keyword.length; i++) {
    outBytes[pos + i] = keyword.charCodeAt(i);
  }
  pos += keyword.length;
  outBytes[pos] = 0x00; // Null separator
  pos += 1;

  // Remainder of data is text: MUST NOT contain null bytes per W3C PNG spec (Section 11.3.3)
  const textEnd = typeAndDataStart + 4 + dataLen;
  outBytes.fill(0x20, pos, textEnd);
  pos = textEnd;

  // Calculate CRC-32 over Type + Data
  const chunkCrc = crc32(outBytes, typeAndDataStart, 4 + dataLen);
  outView.setUint32(pos, chunkCrc, false);
  pos += 4;

  // Copy IEND chunk
  outBytes.set(bytes.subarray(iendOffset), pos);

  return new Blob([outBuffer], { type });
}

/**
 * Pads a WebP image by adding or expanding VP8X and EXIF metadata chunks in the RIFF container.
 */
function padWebP(
  bytes: Uint8Array,
  dataView: DataView,
  targetSizeBytes: number,
  type: string
): Blob {
  const currentLen = bytes.byteLength;
  const bytesToAdd = targetSizeBytes - currentLen;

  // Scan WebP chunks starting at offset 12
  let scanPos = 12;
  let isVp8x = false;
  let vp8xPos = -1;
  let existingExifPos = -1;
  let existingExifPayloadLen = 0;
  let width = 0;
  let height = 0;
  let hasAlpha = false;

  while (scanPos + 8 <= currentLen) {
    const fourCC = String.fromCharCode(
      bytes[scanPos],
      bytes[scanPos + 1],
      bytes[scanPos + 2],
      bytes[scanPos + 3]
    );
    const chunkSize = dataView.getUint32(scanPos + 4, true);

    if (fourCC === 'VP8X') {
      isVp8x = true;
      vp8xPos = scanPos;
      if (scanPos + 18 <= currentLen) {
        hasAlpha = (bytes[scanPos + 8] & 0x10) !== 0;
        const wLE = bytes[scanPos + 12] | (bytes[scanPos + 13] << 8) | (bytes[scanPos + 14] << 16);
        const hLE = bytes[scanPos + 15] | (bytes[scanPos + 16] << 8) | (bytes[scanPos + 17] << 16);
        width = wLE + 1;
        height = hLE + 1;
      }
    } else if (fourCC === 'EXIF') {
      existingExifPos = scanPos;
      existingExifPayloadLen = chunkSize;
    } else if (fourCC === 'VP8 ') {
      if (width === 0 && height === 0 && scanPos + 18 <= currentLen) {
        const startCode = (bytes[scanPos + 11] << 16) | (bytes[scanPos + 12] << 8) | bytes[scanPos + 13];
        if (startCode === 0x9d012a) {
          width = dataView.getUint16(scanPos + 14, true) & 0x3fff;
          height = dataView.getUint16(scanPos + 16, true) & 0x3fff;
        }
      }
    } else if (fourCC === 'VP8L') {
      if (width === 0 && height === 0 && scanPos + 13 <= currentLen && bytes[scanPos + 8] === 0x2f) {
        const val = dataView.getUint32(scanPos + 9, true);
        width = (val & 0x3fff) + 1;
        height = ((val >> 14) & 0x3fff) + 1;
        hasAlpha = ((val >> 28) & 0x01) === 1;
      }
    }

    scanPos += 8 + chunkSize + (chunkSize % 2);
  }

  // 1. If an EXIF chunk already exists, expand it to avoid violating the WebP spec (max 1 EXIF chunk)
  if (existingExifPos !== -1) {
    const oldPadByte = existingExifPayloadLen % 2;
    const oldTotalExifChunkSize = 8 + existingExifPayloadLen + oldPadByte;
    const targetTotalExifChunkSize = oldTotalExifChunkSize + bytesToAdd;

    let newPayloadLen: number;
    let newPadByte = 0;
    if (targetTotalExifChunkSize % 2 === 0) {
      newPayloadLen = targetTotalExifChunkSize - 8;
    } else {
      newPayloadLen = targetTotalExifChunkSize - 9;
      newPadByte = 1;
    }

    const finalSize = currentLen + bytesToAdd;
    const outBuffer = new ArrayBuffer(finalSize);
    const outBytes = new Uint8Array(outBuffer);
    const outView = new DataView(outBuffer);

    // Copy original data up to existing EXIF payload
    const existingPayloadEnd = existingExifPos + 8 + existingExifPayloadLen;
    outBytes.set(bytes.subarray(0, existingPayloadEnd), 0);

    // Update EXIF chunk length in output
    outView.setUint32(existingExifPos + 4, newPayloadLen, true);

    // Copy any chunks that followed the old EXIF chunk
    const afterOldExif = existingExifPos + oldTotalExifChunkSize;
    const newExifEnd = existingExifPos + 8 + newPayloadLen + newPadByte;

    if (afterOldExif < currentLen) {
      outBytes.set(bytes.subarray(afterOldExif), newExifEnd);
    }

    // Update RIFF total size header
    outView.setUint32(4, finalSize - 8, true);

    return new Blob([outBuffer], { type });
  }

  // 2. Already VP8X without EXIF chunk -> append EXIF chunk
  if (isVp8x) {
    const exifChunkBytes = Math.max(bytesToAdd, 8);
    let exifPayloadLen: number;
    let padByte = 0;

    if (exifChunkBytes % 2 === 0) {
      exifPayloadLen = exifChunkBytes - 8;
    } else {
      exifPayloadLen = exifChunkBytes - 9;
      padByte = 1;
    }

    const totalAdded = 8 + exifPayloadLen + padByte;
    const finalSize = currentLen + totalAdded;
    const outBuffer = new ArrayBuffer(finalSize);
    const outBytes = new Uint8Array(outBuffer);
    const outView = new DataView(outBuffer);

    outBytes.set(bytes, 0);

    // Set EXIF flag in VP8X chunk (bit 3 = 0x08)
    if (vp8xPos !== -1 && vp8xPos + 8 < currentLen) {
      outBytes[vp8xPos + 8] = outBytes[vp8xPos + 8] | 0x08;
    }

    let pos = currentLen;
    outBytes[pos] = 0x45; // 'E'
    outBytes[pos + 1] = 0x58; // 'X'
    outBytes[pos + 2] = 0x49; // 'I'
    outBytes[pos + 3] = 0x46; // 'F'
    pos += 4;

    outView.setUint32(pos, exifPayloadLen, true);
    pos += 4;

    if (exifPayloadLen >= 8) {
      outBytes[pos] = 0x49;
      outBytes[pos + 1] = 0x49;
      outBytes[pos + 2] = 0x2a;
      outBytes[pos + 3] = 0x00;
      outBytes[pos + 4] = 0x08;
      outBytes[pos + 5] = 0x00;
      outBytes[pos + 6] = 0x00;
      outBytes[pos + 7] = 0x00;
    }

    outView.setUint32(4, finalSize - 8, true);
    return new Blob([outBuffer], { type });
  }

  // 3. Simple WebP (VP8 or VP8L) -> upgrade container to VP8X + EXIF chunk
  if (width === 0 || height === 0) {
    throw new Error('Unable to determine image dimensions from WebP bitstream.');
  }

  const exifChunkBytes = Math.max(bytesToAdd - 18, 8);
  let exifPayloadLen: number;
  let padByte = 0;

  if (exifChunkBytes % 2 === 0) {
    exifPayloadLen = exifChunkBytes - 8;
  } else {
    exifPayloadLen = exifChunkBytes - 9;
    padByte = 1;
  }

  const totalExifChunkSize = 8 + exifPayloadLen + padByte;
  const finalSize = currentLen + 18 + totalExifChunkSize;
  const outBuffer = new ArrayBuffer(finalSize);
  const outBytes = new Uint8Array(outBuffer);
  const outView = new DataView(outBuffer);

  // Copy RIFF header (12 bytes)
  outBytes.set(bytes.subarray(0, 12), 0);

  // Write VP8X chunk at offset 12 (18 bytes)
  let pos = 12;
  outBytes[pos] = 0x56; // 'V'
  outBytes[pos + 1] = 0x50; // 'P'
  outBytes[pos + 2] = 0x38; // '8'
  outBytes[pos + 3] = 0x58; // 'X'
  pos += 4;

  outView.setUint32(pos, 10, true);
  pos += 4;

  outBytes[pos] = 0x08 | (hasAlpha ? 0x10 : 0x00);
  pos += 1;
  pos += 3; // 3 reserved bytes

  const canvasW = Math.max(0, width - 1);
  outBytes[pos] = canvasW & 0xff;
  outBytes[pos + 1] = (canvasW >> 8) & 0xff;
  outBytes[pos + 2] = (canvasW >> 16) & 0xff;
  pos += 3;

  const canvasH = Math.max(0, height - 1);
  outBytes[pos] = canvasH & 0xff;
  outBytes[pos + 1] = (canvasH >> 8) & 0xff;
  outBytes[pos + 2] = (canvasH >> 16) & 0xff;
  pos += 3;

  // Copy image chunks (from offset 12 of original)
  outBytes.set(bytes.subarray(12), pos);
  pos += currentLen - 12;

  // Write EXIF chunk
  outBytes[pos] = 0x45; // 'E'
  outBytes[pos + 1] = 0x58; // 'X'
  outBytes[pos + 2] = 0x49; // 'I'
  outBytes[pos + 3] = 0x46; // 'F'
  pos += 4;

  outView.setUint32(pos, exifPayloadLen, true);
  pos += 4;

  if (exifPayloadLen >= 8) {
    outBytes[pos] = 0x49;
    outBytes[pos + 1] = 0x49;
    outBytes[pos + 2] = 0x2a;
    outBytes[pos + 3] = 0x00;
    outBytes[pos + 4] = 0x08;
    outBytes[pos + 5] = 0x00;
    outBytes[pos + 6] = 0x00;
    outBytes[pos + 7] = 0x00;
  }

  outView.setUint32(4, finalSize - 8, true);
  return new Blob([outBuffer], { type });
}
