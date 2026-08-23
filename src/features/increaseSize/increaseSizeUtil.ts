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

  // Write SOI (2 bytes)
  outBytes[0] = 0xff;
  outBytes[1] = 0xd8;

  // Write COM segments starting at offset 2
  let outPos = 2;
  for (const segSize of segments) {
    outBytes[outPos] = 0xff;
    outBytes[outPos + 1] = 0xfe; // COM marker
    outView.setUint16(outPos + 2, segSize - 2, false); // Length field (includes length bytes)
    // Payload bytes are automatically 0 in newly allocated ArrayBuffer
    outPos += segSize;
  }

  // Copy remaining original JPEG content from offset 2
  outBytes.set(bytes.subarray(2), outPos);

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

  // Remainder of data is text (padding zeroes)
  pos = typeAndDataStart + 4 + dataLen;

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

  // Read first chunk FourCC at offset 12
  const firstFourCC = String.fromCharCode(
    bytes[12],
    bytes[13],
    bytes[14],
    bytes[15]
  );

  if (firstFourCC === 'VP8X') {
    // Already extended WebP
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

    // Copy original data
    outBytes.set(bytes, 0);

    // Set EXIF flag in VP8X (offset 20, bit 3 = 0x08)
    outBytes[20] = outBytes[20] | 0x08;

    // Append EXIF chunk at currentLen
    let pos = currentLen;
    outBytes[pos] = 0x45; // 'E'
    outBytes[pos + 1] = 0x58; // 'X'
    outBytes[pos + 2] = 0x49; // 'I'
    outBytes[pos + 3] = 0x46; // 'F'
    pos += 4;

    outView.setUint32(pos, exifPayloadLen, true); // Little-endian chunk size
    pos += 4;

    // Write minimal standard TIFF header if space permits
    if (exifPayloadLen >= 8) {
      outBytes[pos] = 0x49; // 'I'
      outBytes[pos + 1] = 0x49; // 'I'
      outBytes[pos + 2] = 0x2a; // 42
      outBytes[pos + 3] = 0x00;
      outBytes[pos + 4] = 0x08; // Offset to IFD0
      outBytes[pos + 5] = 0x00;
      outBytes[pos + 6] = 0x00;
      outBytes[pos + 7] = 0x00;
    }

    // Update RIFF total size header (fileSize - 8)
    outView.setUint32(4, finalSize - 8, true);

    return new Blob([outBuffer], { type });
  }

  // Simple WebP (VP8 or VP8L) -> upgrade container to VP8X + EXIF chunk
  let width = 0;
  let height = 0;
  let hasAlpha = false;

  if (firstFourCC === 'VP8 ') {
    // Lossy VP8 bitstream parse dimensions
    if (currentLen >= 30) {
      const startCode =
        (bytes[23] << 16) | (bytes[24] << 8) | bytes[25];
      if (startCode === 0x9d012a) {
        width = dataView.getUint16(26, true) & 0x3fff;
        height = dataView.getUint16(28, true) & 0x3fff;
      }
    }
  } else if (firstFourCC === 'VP8L') {
    // Lossless VP8L bitstream parse dimensions
    if (currentLen >= 25 && bytes[20] === 0x2f) {
      const val = dataView.getUint32(21, true);
      width = (val & 0x3fff) + 1;
      height = ((val >> 14) & 0x3fff) + 1;
      hasAlpha = ((val >> 28) & 0x01) === 1;
    }
  }

  // VP8X chunk takes 18 bytes
  // Remainder is for EXIF chunk (min 8 bytes)
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

  outView.setUint32(pos, 10, true); // VP8X payload size = 10
  pos += 4;

  // Flags: bit 3 is EXIF (0x08), bit 4 is Alpha (0x10)
  outBytes[pos] = 0x08 | (hasAlpha ? 0x10 : 0x00);
  pos += 1;
  // 3 reserved bytes (0x00)
  pos += 3;

  // Canvas width - 1 (24-bit LE)
  const canvasW = Math.max(0, width - 1);
  outBytes[pos] = canvasW & 0xff;
  outBytes[pos + 1] = (canvasW >> 8) & 0xff;
  outBytes[pos + 2] = (canvasW >> 16) & 0xff;
  pos += 3;

  // Canvas height - 1 (24-bit LE)
  const canvasH = Math.max(0, height - 1);
  outBytes[pos] = canvasH & 0xff;
  outBytes[pos + 1] = (canvasH >> 8) & 0xff;
  outBytes[pos + 2] = (canvasH >> 16) & 0xff;
  pos += 3;

  // Copy image chunks (from offset 12 of original)
  outBytes.set(bytes.subarray(12), pos);
  pos += currentLen - 12;

  // Write EXIF chunk at pos
  outBytes[pos] = 0x45; // 'E'
  outBytes[pos + 1] = 0x58; // 'X'
  outBytes[pos + 2] = 0x49; // 'I'
  outBytes[pos + 3] = 0x46; // 'F'
  pos += 4;

  outView.setUint32(pos, exifPayloadLen, true);
  pos += 4;

  // Minimal standard TIFF header if space permits
  if (exifPayloadLen >= 8) {
    outBytes[pos] = 0x49; // 'I'
    outBytes[pos + 1] = 0x49; // 'I'
    outBytes[pos + 2] = 0x2a; // 42
    outBytes[pos + 3] = 0x00;
    outBytes[pos + 4] = 0x08; // Offset to IFD0
    outBytes[pos + 5] = 0x00;
    outBytes[pos + 6] = 0x00;
    outBytes[pos + 7] = 0x00;
  }

  // Update RIFF total size header
  outView.setUint32(4, finalSize - 8, true);

  return new Blob([outBuffer], { type });
}
