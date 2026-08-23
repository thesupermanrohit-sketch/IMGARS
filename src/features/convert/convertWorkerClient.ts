import { wrap, type Remote } from 'comlink';
import type { ConvertWorkerApi } from './types';

let cachedWorker: Worker | null = null;
let cachedApi: Remote<ConvertWorkerApi> | null = null;

export function getConvertWorkerApi(): Remote<ConvertWorkerApi> | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return null;
  }

  if (!cachedApi) {
    try {
      cachedWorker = new Worker(new URL('./convert.worker.ts', import.meta.url), {
        type: 'module',
      });
      cachedApi = wrap<ConvertWorkerApi>(cachedWorker) as Remote<ConvertWorkerApi>;
    } catch (e) {
      console.warn('Failed to initialize convert Web Worker, falling back to main thread.', e);
      return null;
    }
  }

  return cachedApi;
}
