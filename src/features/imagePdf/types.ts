export type ImagePdfOrientation = 'portrait' | 'landscape';
export type ImagePdfPageSize = 'a4' | 'match';

export interface ImagePdfItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  type: string;
  size: number;
  position: number;
}

export interface ImagePdfResult {
  blob: Blob;
  size: number;
}

export interface ImagePdfWorkerInput {
  id: string;
  file: File;
}

export interface ImagePdfWorkerOptions {
  pageSize: ImagePdfPageSize;
  orientation: ImagePdfOrientation;
}

export type ImagePdfProgress = (message: string) => void;

export interface ImagePdfWorkerApi {
  generatePdf: (
    images: ImagePdfWorkerInput[],
    options: ImagePdfWorkerOptions,
    onProgress: ImagePdfProgress
  ) => Promise<ImagePdfResult>;
}
