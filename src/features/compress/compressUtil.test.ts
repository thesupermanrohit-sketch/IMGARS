import { beforeEach, describe, expect, it, vi } from 'vitest';
import imageCompression from 'browser-image-compression';
import { compressImage } from './compressUtil';

vi.mock('browser-image-compression', () => ({
  default: vi.fn(),
}));

const mockedCompression = vi.mocked(imageCompression);

describe('compressImage', () => {
  beforeEach(() => {
    mockedCompression.mockReset();
  });

  it('keeps the fallback compression within the requested size', async () => {
    const source = new Blob(['source'], { type: 'image/png' });
    const compressed = new Blob([new Uint8Array(1024)], { type: 'image/png' });
    mockedCompression
      .mockRejectedValueOnce(new Error('worker failed'))
      .mockResolvedValueOnce(compressed as File);

    const result = await compressImage(source, 2, 'image.png');
    const fallbackOptions = mockedCompression.mock.calls[1][1];

    expect(result).toBe(compressed);
    expect(fallbackOptions.maxSizeMB).toBe(2 / 1024);
    expect(fallbackOptions.useWebWorker).toBe(false);
  });

  it('rejects output that exceeds the target after fallback', async () => {
    const source = new Blob(['source'], { type: 'image/png' });
    const oversized = new Blob([new Uint8Array(3 * 1024)], { type: 'image/png' });
    mockedCompression
      .mockRejectedValueOnce(new Error('worker failed'))
      .mockResolvedValueOnce(oversized as File);

    await expect(compressImage(source, 2, 'image.png')).rejects.toThrow(
      'Compression could not meet the 2 KB target.'
    );
  });
});
