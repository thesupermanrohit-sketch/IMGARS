import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImagePdfWorkerApi } from './types';
import { getJpegOrientation } from './jpegOrientation';

const mocks = vi.hoisted(() => ({
  api: undefined as ImagePdfWorkerApi | undefined,
  embedJpg: vi.fn(),
  drawImage: vi.fn(),
  addPage: vi.fn(),
  rasterize: vi.fn(),
  drawBitmap: vi.fn(),
}));

vi.mock('comlink', () => ({ expose: (api: ImagePdfWorkerApi) => { mocks.api = api; } }));
vi.mock('pdf-lib', () => ({
  rgb: vi.fn(),
  PDFDocument: { create: async () => ({
    embedJpg: mocks.embedJpg,
    addPage: mocks.addPage,
    save: async () => new Uint8Array([37, 80, 68, 70]),
  }) },
}));

import './imagePdf.worker';

function jpegWithOrientation(orientation: number, littleEndian = true): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(40);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8, 0xff, 0xe1, 0, 34, 69, 120, 105, 102, 0, 0]);
  view.setUint16(12, littleEndian ? 0x4949 : 0x4d4d);
  view.setUint16(14, 42, littleEndian);
  view.setUint32(16, 8, littleEndian);
  view.setUint16(20, 1, littleEndian);
  view.setUint16(22, 0x0112, littleEndian);
  view.setUint16(24, 3, littleEndian);
  view.setUint32(26, 1, littleEndian);
  view.setUint16(30, orientation, littleEndian);
  bytes.set([0xff, 0xd9], 38);
  return bytes;
}

describe('JPEG EXIF orientation', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('reads orientation %i in both TIFF byte orders', (orientation) => {
    expect(getJpegOrientation(jpegWithOrientation(orientation).buffer)).toBe(orientation);
    expect(getJpegOrientation(jpegWithOrientation(orientation, false).buffer)).toBe(orientation);
  });

  it('handles truncated or invalid metadata without reading beyond the buffer', () => {
    const bytes = jpegWithOrientation(6);
    for (let length = 0; length < 38; length++) {
      expect(getJpegOrientation(bytes.slice(0, length).buffer)).toBe(1);
    }
    new DataView(bytes.buffer).setUint32(16, 0xffffffff, true);
    expect(getJpegOrientation(bytes.buffer)).toBe(1);
    expect(getJpegOrientation(jpegWithOrientation(9).buffer)).toBe(1);
  });
});

describe('PDF JPEG embedding', () => {
  const normalizedJpeg = new Blob(['oriented pixels'], { type: 'image/jpeg' });
  const bitmap = { width: 300, height: 600, close: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.embedJpg.mockResolvedValue({});
    mocks.addPage.mockReturnValue({ drawImage: mocks.drawImage, drawRectangle: vi.fn() });
    mocks.rasterize.mockResolvedValue(normalizedJpeg);
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal('OffscreenCanvas', class {
      getContext() { return { fillStyle: '', fillRect: vi.fn(), drawImage: mocks.drawBitmap }; }
      convertToBlob = mocks.rasterize;
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([2, 3, 4, 5, 6, 7, 8])('normalizes orientation %i before embedding', async (orientation) => {
    const file = new File([jpegWithOrientation(orientation)], 'phone.jpg', { type: 'image/jpeg' });
    await mocks.api!.generatePdf([{ id: 'photo', file }], { pageSize: 'match', orientation: 'portrait' }, vi.fn());
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect(mocks.drawBitmap).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(mocks.embedJpg).toHaveBeenCalledWith(await normalizedJpeg.arrayBuffer());
    expect(mocks.addPage).toHaveBeenCalledWith([300, 600]);
    expect(mocks.drawImage).toHaveBeenCalledWith(expect.anything(), { x: 0, y: 0, width: 300, height: 600 });
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('embeds already-upright JPEGs without lossy re-encoding', async () => {
    const bytes = jpegWithOrientation(1);
    const file = new File([bytes], 'upright.jpg', { type: 'image/jpeg' });
    await mocks.api!.generatePdf([{ id: 'photo', file }], { pageSize: 'match', orientation: 'portrait' }, vi.fn());
    expect(mocks.embedJpg).toHaveBeenCalledWith(bytes.buffer);
    expect(mocks.rasterize).not.toHaveBeenCalled();
  });
});
