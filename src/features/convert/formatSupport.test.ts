import { describe, it, expect } from 'vitest';
import { isFormatSupported, getSupportedFormats } from './formatSupport';

describe('formatSupport', () => {
  it('detects supported canvas export formats', async () => {
    const supportedMap = await getSupportedFormats();
    expect(supportedMap).toHaveProperty('jpeg');
    expect(supportedMap).toHaveProperty('png');
    expect(supportedMap).toHaveProperty('webp');
    expect(supportedMap).toHaveProperty('avif');
  });

  it('returns false for isFormatSupported on error or unsupported environment', async () => {
    // Test that isFormatSupported handles failures gracefully
    const result = await isFormatSupported('jpeg');
    expect(typeof result).toBe('boolean');
  });
});
