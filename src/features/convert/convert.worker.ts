import { expose } from 'comlink';
import type { OutputFormat, ConvertWorkerApi } from './types';
import { FORMAT_MIME_MAP } from './constants';

async function convertImageInWorker(
  blob: Blob,
  targetFormat: OutputFormat,
  quality = 0.9
): Promise<Blob> {
  const targetMime = FORMAT_MIME_MAP[targetFormat];

  // 1. Decode image bitmap off the main thread
  const bitmap = await createImageBitmap(blob);

  try {
    // 2. Create OffscreenCanvas with image dimensions
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('OffscreenCanvas 2D context is not available');
    }

    // 3. For JPEG, fill background with white to avoid black background on transparent PNGs
    if (targetFormat === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 4. Draw decoded image bitmap
    ctx.drawImage(bitmap, 0, 0);

    // 5. Export to target format Blob
    const convertedBlob = await canvas.convertToBlob({
      type: targetMime,
      quality: targetFormat === 'jpeg' || targetFormat === 'webp' || targetFormat === 'avif' ? quality : undefined,
    });

    return convertedBlob;
  } finally {
    bitmap.close();
  }
}

const api: ConvertWorkerApi = {
  convertImageInWorker,
};

expose(api);
