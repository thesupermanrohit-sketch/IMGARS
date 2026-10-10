import type { OutputFormat } from './types';
import { FORMAT_MIME_MAP } from './constants';
import { isFormatSupported, getSupportedFormats } from './formatSupport';
import { getConvertWorkerApi, resetConvertWorker } from './convertWorkerClient';

export type { OutputFormat };
export { isFormatSupported, getSupportedFormats };

async function convertImageMainThread(
  blob: Blob,
  targetFormat: OutputFormat,
  quality = 0.9
): Promise<Blob> {
  const targetMime = FORMAT_MIME_MAP[targetFormat];

  // 1. Create an HTMLImageElement and load the blob
  const img = new Image();
  const objectUrl = URL.createObjectURL(blob);
  img.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image in canvas'));
    });

    // 2. Create Canvas and draw the image
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not available');
    }

    // Optional: Draw a white background for JPEGs to avoid black background on transparent PNGs
    if (targetFormat === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0);

    // 3. Export Canvas to Blob
    const convertedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) {
            reject(new Error(`Failed to export canvas to ${targetFormat}`));
          } else if (b.type !== targetMime) {
            reject(new Error(`Browser does not support exporting to ${targetFormat} (fell back to ${b.type})`));
          } else {
            resolve(b);
          }
        },
        targetMime,
        targetFormat === 'jpeg' || targetFormat === 'webp' || targetFormat === 'avif' ? quality : undefined
      );
    });

    return convertedBlob;
  } finally {
    // 4. Clean up Object URL
    URL.revokeObjectURL(objectUrl);
  }
}

export async function convertImage(
  blob: Blob,
  targetFormat: OutputFormat,
  quality = 0.9
): Promise<Blob> {
  const workerApi = getConvertWorkerApi();
  if (workerApi) {
    try {
      return await workerApi.convertImageInWorker(blob, targetFormat, quality);
    } catch (err) {
      console.warn('Worker conversion failed, terminating and resetting worker:', err);
      resetConvertWorker();
    }
  }

  return convertImageMainThread(blob, targetFormat, quality);
}
