import { describe, expect, it } from 'vitest';
import { isSupportedImageMimeType } from './imageMime';

describe('isSupportedImageMimeType', () => {
  it('accepts the image formats supported by the processing queue', () => {
    expect(isSupportedImageMimeType('image/jpeg')).toBe(true);
    expect(isSupportedImageMimeType('image/png')).toBe(true);
    expect(isSupportedImageMimeType('image/webp')).toBe(true);
    expect(isSupportedImageMimeType('image/avif')).toBe(true);
    expect(isSupportedImageMimeType('image/avif', 'increaseSize')).toBe(false);
  });

  it('rejects other image MIME types before queue insertion', () => {
    expect(isSupportedImageMimeType('image/gif')).toBe(false);
    expect(isSupportedImageMimeType('image/bmp')).toBe(false);
  });
});
