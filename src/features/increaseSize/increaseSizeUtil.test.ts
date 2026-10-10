import { describe, it, expect } from 'vitest';
import { increaseImageSize } from './increaseSizeUtil';
import { crc32 } from './crc32';

// Helper to create a minimal valid JPEG ArrayBuffer
function createMinimalJpeg(): Uint8Array {
  // SOI (2) + APP0 (16) + DQT (69) + SOF0 (17) + SOS (14) + minimal scan data (2) + EOI (2) = 122 bytes
  const bytes = new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // APP0 JFIF
    0xff, 0xdb, 0x00, 0x43, 0x00, ...new Array(64).fill(1), // DQT
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, // SOF0 (1x1)
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, // SOS
    0x7f, 0xff, // scan data
    0xff, 0xd9, // EOI
  ]);
  return bytes;
}

// Helper to create a minimal valid 1x1 PNG ArrayBuffer
function createMinimalPng(): Uint8Array {
  // Signature (8) + IHDR (25) + IDAT (18) + IEND (12)
  const ihdrData = new Uint8Array([
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x06, 0x00, 0x00, 0x00, // 8-bit RGBA
  ]);
  const ihdrTypeAndData = new Uint8Array([0x49, 0x48, 0x44, 0x52, ...ihdrData]); // 'IHDR'
  const ihdrCrc = crc32(ihdrTypeAndData);

  const idatData = new Uint8Array([0x78, 0x9c, 0x62, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01]);
  const idatTypeAndData = new Uint8Array([0x49, 0x44, 0x41, 0x54, ...idatData]); // 'IDAT'
  const idatCrc = crc32(idatTypeAndData);

  const iendTypeAndData = new Uint8Array([0x49, 0x45, 0x4e, 0x44]); // 'IEND'
  const iendCrc = crc32(iendTypeAndData);

  const totalLen = 8 + 12 + ihdrData.length + 12 + idatData.length + 12;
  const out = new Uint8Array(totalLen);
  const view = new DataView(out.buffer);

  // PNG Signature
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

  // IHDR
  let pos = 8;
  view.setUint32(pos, ihdrData.length, false);
  out.set(ihdrTypeAndData, pos + 4);
  view.setUint32(pos + 8 + ihdrData.length, ihdrCrc, false);
  pos += 12 + ihdrData.length;

  // IDAT
  view.setUint32(pos, idatData.length, false);
  out.set(idatTypeAndData, pos + 4);
  view.setUint32(pos + 8 + idatData.length, idatCrc, false);
  pos += 12 + idatData.length;

  // IEND
  view.setUint32(pos, 0, false);
  out.set(iendTypeAndData, pos + 4);
  view.setUint32(pos + 8, iendCrc, false);

  return out;
}

// Helper to create a minimal valid WebP (VP8 lossy 1x1)
function createMinimalWebP(): Uint8Array {
  // RIFF header (12) + VP8 chunk (8 + 10 = 18) = 30 bytes
  const vp8Payload = new Uint8Array([
    0x30, 0x01, 0x00, // 3-byte frame tag (keyframe, 1x1)
    0x9d, 0x01, 0x2a, // start code
    0x01, 0x00, // width: 1
    0x01, 0x00, // height: 1
  ]);

  const totalSize = 12 + 8 + vp8Payload.length;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // 'RIFF'
  out.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, totalSize - 8, true);
  // 'WEBP'
  out.set([0x57, 0x45, 0x42, 0x50], 8);

  // 'VP8 '
  out.set([0x56, 0x50, 0x38, 0x20], 12);
  view.setUint32(16, vp8Payload.length, true);
  out.set(vp8Payload, 20);

  return out;
}

describe('increaseSizeUtil', () => {
  describe('JPEG padding', () => {
    it('increases JPEG file size to exact target size', async () => {
      const originalBytes = createMinimalJpeg();
      const originalBlob = new Blob([originalBytes.buffer as ArrayBuffer], { type: 'image/jpeg' });
      const targetSizeKb = 50; // 50 * 1024 = 51200 bytes

      const result = await increaseImageSize(originalBlob, targetSizeKb, 'image/jpeg', 'test.jpg');

      expect(result.skipped).toBe(false);
      expect(result.blob.size).toBe(50 * 1024);
      expect(result.blob.type).toBe('image/jpeg');

      // Verify JPEG SOI, preserved APP0, then COM padding
      const buf = new Uint8Array(await result.blob.arrayBuffer());
      expect(buf[0]).toBe(0xff);
      expect(buf[1]).toBe(0xd8); // SOI
      expect(buf[2]).toBe(0xff);
      expect(buf[3]).toBe(0xe0); // APP0 JFIF remains first
      expect(buf[20]).toBe(0xff);
      expect(buf[21]).toBe(0xfe); // COM follows APP0
      expect(buf[24]).toBeGreaterThanOrEqual(0x20);
      expect(buf[24]).toBeLessThanOrEqual(0x7e);
    });

    it('keeps APP1 EXIF before padding', async () => {
      const original = createMinimalJpeg();
      const exif = new Uint8Array([0xff, 0xe1, 0x00, 0x0a, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49, 0x49]);
      const withExif = new Uint8Array(original.length + exif.length);
      withExif.set(original.subarray(0, 2));
      withExif.set(exif, 2);
      withExif.set(original.subarray(2), 2 + exif.length);

      const result = await increaseImageSize(new Blob([withExif], { type: 'image/jpeg' }), 50, 'image/jpeg');
      const buf = new Uint8Array(await result.blob.arrayBuffer());
      expect(buf[2]).toBe(0xff);
      expect(buf[3]).toBe(0xe1);
      expect(buf[2 + exif.length]).toBe(0xff); // APP0 remains after APP1
      expect(buf[3 + exif.length]).toBe(0xe0);
      expect(buf[2 + exif.length + 18]).toBe(0xff);
      expect(buf[3 + exif.length + 18]).toBe(0xfe);
    });
  });

  describe('PNG padding', () => {
    it('increases PNG file size to exact target size with valid tEXt chunk', async () => {
      const originalBytes = createMinimalPng();
      const originalBlob = new Blob([originalBytes.buffer as ArrayBuffer], { type: 'image/png' });
      const targetSizeKb = 30; // 30 * 1024 = 30720 bytes

      const result = await increaseImageSize(originalBlob, targetSizeKb, 'image/png', 'test.png');

      expect(result.skipped).toBe(false);
      expect(result.blob.size).toBe(30 * 1024);
      expect(result.blob.type).toBe('image/png');

      // Verify PNG signature and IEND at the end
      const buf = new Uint8Array(await result.blob.arrayBuffer());
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);

      // Verify that tEXt chunk text padding does not contain null bytes (0x00) per PNG spec
      // tEXt starts after IHDR and IDAT, before IEND
      // Search for 'tEXt'
      let textChunkPos = -1;
      for (let i = 8; i < buf.length - 12; i++) {
        if (buf[i] === 0x74 && buf[i + 1] === 0x45 && buf[i + 2] === 0x58 && buf[i + 3] === 0x74) {
          textChunkPos = i;
          break;
        }
      }
      expect(textChunkPos).toBeGreaterThan(0);
      // Keyword is 'Comment' (7 bytes) + 1 null separator
      const textStart = textChunkPos + 4 + 7 + 1;
      // All text padding bytes must be ASCII spaces (0x20), not 0x00
      expect(buf[textStart]).toBe(0x20);

      // Verify last 12 bytes is IEND
      const iend = buf.subarray(buf.length - 12);
      expect(iend[4]).toBe(0x49); // 'I'
      expect(iend[5]).toBe(0x45); // 'E'
      expect(iend[6]).toBe(0x4e); // 'N'
      expect(iend[7]).toBe(0x44); // 'D'
    });
  });

  describe('WebP padding', () => {
    it('increases WebP file size to exact target size with VP8X and EXIF', async () => {
      const originalBytes = createMinimalWebP();
      const originalBlob = new Blob([originalBytes.buffer as ArrayBuffer], { type: 'image/webp' });
      const targetSizeKb = 25; // 25 * 1024 = 25600 bytes

      const result = await increaseImageSize(originalBlob, targetSizeKb, 'image/webp', 'test.webp');

      expect(result.skipped).toBe(false);
      expect(result.blob.size).toBe(25 * 1024);
      expect(result.blob.type).toBe('image/webp');

      // Verify RIFF header and updated file size field
      const buf = new Uint8Array(await result.blob.arrayBuffer());
      const view = new DataView(buf.buffer);
      expect(buf[0]).toBe(0x52); // 'R'
      expect(buf[1]).toBe(0x49); // 'I'
      expect(buf[2]).toBe(0x46); // 'F'
      expect(buf[3]).toBe(0x46); // 'F'
      expect(view.getUint32(4, true)).toBe(25 * 1024 - 8);

      // Verify VP8X chunk exists
      expect(buf[12]).toBe(0x56); // 'V'
       expect(buf[13]).toBe(0x50); // 'P'
       expect(buf[14]).toBe(0x38); // '8'
       expect(buf[15]).toBe(0x58); // 'X'

       // EXIF is non-empty and every RIFF chunk has an even payload size.
       let pos = 12;
       while (pos < buf.length) {
         const chunkSize = view.getUint32(pos + 4, true);
         expect(chunkSize % 2).toBe(0);
         pos += 8 + chunkSize;
       }
       expect(pos).toBe(buf.length);
       const exifOffset = buf.findIndex((value, index) => index >= 12 && value === 0x45 && buf[index + 1] === 0x58 && buf[index + 2] === 0x49 && buf[index + 3] === 0x46);
       expect(exifOffset).toBeGreaterThan(0);
       expect(view.getUint32(exifOffset + 4, true)).toBeGreaterThanOrEqual(14);
       expect(buf[exifOffset + 8]).toBe(0x49);
       expect(buf[exifOffset + 9]).toBe(0x49);
       expect(buf.slice(exifOffset + 18, exifOffset + 22)).toEqual(new Uint8Array([0, 0, 0, 0]));
     });

     it('rejects WebP with unparseable dimensions', async () => {
       const invalid = createMinimalWebP();
       invalid[23] = 0;
       invalid[24] = 0;
       invalid[25] = 0;
       await expect(
         increaseImageSize(new Blob([invalid.buffer as ArrayBuffer], { type: 'image/webp' }), 25, 'image/webp')
       ).rejects.toThrow('invalid WebP dimensions');
     });
  });

  describe('Skipping logic', () => {
    it('skips images that already meet or exceed the target size', async () => {
      const originalBytes = new Uint8Array(50 * 1024);
      originalBytes[0] = 0xff;
      originalBytes[1] = 0xd8;
      const originalBlob = new Blob([originalBytes.buffer as ArrayBuffer], { type: 'image/jpeg' });

      // Target size 40 KB is smaller than 50 KB image
      const result = await increaseImageSize(originalBlob, 40, 'image/jpeg', 'test.jpg');

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Already meets target size');
      expect(result.blob.size).toBe(50 * 1024);
    });

    it('skips images that exactly equal the target size', async () => {
      const originalBytes = new Uint8Array(10 * 1024);
      originalBytes[0] = 0xff;
      originalBytes[1] = 0xd8;
      const originalBlob = new Blob([originalBytes.buffer as ArrayBuffer], { type: 'image/jpeg' });

      const result = await increaseImageSize(originalBlob, 10, 'image/jpeg', 'test.jpg');

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Already meets target size');
      expect(result.blob.size).toBe(10 * 1024);
    });
  });


  describe('Unsupported formats', () => {
    it('throws an error for unrecognized image formats', async () => {
      const invalidBlob = new Blob(['not an image content'], { type: 'text/plain' });
      await expect(
        increaseImageSize(invalidBlob, 50, 'text/plain', 'test.txt')
      ).rejects.toThrow('Unsupported image format');
    });
  });
});
