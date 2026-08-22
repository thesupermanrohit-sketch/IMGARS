import { wrap, type Remote } from 'comlink';
import type { ImagePdfWorkerApi } from './types';

export function createImagePdfWorker() {
  const worker = new Worker(new URL('./imagePdf.worker.ts', import.meta.url), {
    type: 'module',
  });

  return {
    worker,
    api: wrap<ImagePdfWorkerApi>(worker) as Remote<ImagePdfWorkerApi>,
  };
}
