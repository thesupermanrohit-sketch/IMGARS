import { describe, it, expect } from 'vitest';
import { formatSizeDelta } from './formatSizeDelta';
import type { FileItem } from '../types/store';

describe('formatSizeDelta', () => {
  it('returns original size when status is not done or processedSize is missing', () => {
    const item: FileItem = {
      id: '1',
      name: 'test.jpg',
      type: 'image/jpeg',
      originalSize: 102400, // 100 KB
      status: 'pending',
    };
    expect(formatSizeDelta(item)).toBe('100 KB');
  });

  it('returns original size if skipped with skipReason', () => {
    const item: FileItem = {
      id: '1',
      name: 'test.jpg',
      type: 'image/jpeg',
      originalSize: 102400,
      processedSize: 102400,
      status: 'done',
      skipReason: 'Already meets target size',
    };
    expect(formatSizeDelta(item)).toBe('100 KB');
  });

  it('formats size reduction correctly with minus sign', () => {
    const item: FileItem = {
      id: '1',
      name: 'test.jpg',
      type: 'image/jpeg',
      originalSize: 204800, // 200 KB
      processedSize: 102400, // 100 KB
      status: 'done',
    };
    expect(formatSizeDelta(item)).toBe('200 KB → 100 KB (−50%)');
  });

  it('formats size increase correctly with plus sign', () => {
    const item: FileItem = {
      id: '1',
      name: 'test.png',
      type: 'image/png',
      originalSize: 102400, // 100 KB
      processedSize: 307200, // 300 KB
      status: 'done',
    };
    expect(formatSizeDelta(item)).toBe('100 KB → 300 KB (+200%)');
  });

  it('handles identical sizes (0% change)', () => {
    const item: FileItem = {
      id: '1',
      name: 'test.webp',
      type: 'image/webp',
      originalSize: 102400,
      processedSize: 102400,
      status: 'done',
    };
    expect(formatSizeDelta(item)).toBe('100 KB → 100 KB (0%)');
  });
});
