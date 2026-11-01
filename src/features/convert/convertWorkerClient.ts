import { wrap } from 'comlink';
import type { ConvertWorkerApi } from './types';

const WORKER_TIMEOUT_MS = 120_000;

export function getConvertWorkerApi(): ConvertWorkerApi | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return null;
  }

  return {
    async convertImageInWorker(blob, targetFormat, quality) {
      // Each job owns its worker: a bad image cannot interrupt other batch jobs.
      const worker = new Worker(new URL('./convert.worker.ts', import.meta.url), {
        type: 'module',
      });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const failure = new Promise<never>((_, reject) => {
        worker.onerror = () => reject(new Error('Image conversion worker failed.'));
        worker.onmessageerror = () => reject(new Error('Could not read the worker response.'));
        timeout = setTimeout(() => reject(new Error('Image conversion worker timed out.')), WORKER_TIMEOUT_MS);
      });

      try {
        const api = wrap<ConvertWorkerApi>(worker);
        return await Promise.race([
          api.convertImageInWorker(blob, targetFormat, quality),
          failure,
        ]);
      } finally {
        clearTimeout(timeout);
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
    },
  };
}
