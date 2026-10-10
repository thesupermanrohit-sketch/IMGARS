import type { OutputFormat } from './types';
import { FORMAT_MIME_MAP } from './constants';


/**
 * Checks if the browser supports a specific image format (export and native capability)
 */
export async function isFormatSupported(format: OutputFormat): Promise<boolean> {
  const mime = FORMAT_MIME_MAP[format];

  // 1. Try OffscreenCanvas if available (used by convert.worker)
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const offscreen = new OffscreenCanvas(1, 1);
      const blob = await offscreen.convertToBlob({ type: mime });
      if (blob && blob.type === mime) {
        return true;
      }
    } catch {
      // Continue to next checks
    }
  }

  // 2. Try HTMLCanvasElement if document is available
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;

      const dataUrl = canvas.toDataURL(mime);
      if (dataUrl && dataUrl.startsWith(`data:${mime}`)) {
        return true;
      }

      const isBlobSupported = await new Promise<boolean>((resolve) => {
        canvas.toBlob((b) => {
          resolve(b !== null && b.type === mime);
        }, mime);
      });

      if (isBlobSupported) {
        return true;
      }
    } catch {
      // Continue to next checks
    }
  }

  return false;
}

/**
 * Returns a map of supported output formats for the current browser
 */
export async function getSupportedFormats(): Promise<Record<OutputFormat, boolean>> {
  const formats: OutputFormat[] = ['jpeg', 'webp', 'avif', 'png'];
  const results = await Promise.all(
    formats.map(async (fmt) => [fmt, await isFormatSupported(fmt)] as const)
  );
  return Object.fromEntries(results) as Record<OutputFormat, boolean>;
}
