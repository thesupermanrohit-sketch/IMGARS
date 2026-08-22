export type CompressResolutionPreset = 'original' | 'web' | 'fullHd';

export interface CompressionResultItem {
  id: string;
  name: string;
  originalSize: number;
  compressedSize: number;
  blob: Blob;
  previewUrl: string;
}
