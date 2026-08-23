export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif';

export interface ConvertWorkerApi {
  convertImageInWorker: (
    blob: Blob,
    targetFormat: OutputFormat,
    quality?: number
  ) => Promise<Blob>;
}
