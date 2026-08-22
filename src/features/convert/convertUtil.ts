import type { OutputFormat } from './types';
export type { OutputFormat };

const FORMAT_MIME_MAP: Record<OutputFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

export async function convertImage(
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
          if (b) {
            resolve(b);
          } else {
            reject(new Error(`Failed to export canvas to ${targetFormat}`));
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

/**
 * Checks if the browser supports canvas export to a specific MIME type
 */
export async function isFormatSupported(format: OutputFormat): Promise<boolean> {
  const mime = FORMAT_MIME_MAP[format];
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return new Promise<boolean>((resolve) => {
      canvas.toBlob((b) => {
        resolve(b !== null && b.type === mime);
      }, mime);
    });
  } catch {
    return false;
  }
}
