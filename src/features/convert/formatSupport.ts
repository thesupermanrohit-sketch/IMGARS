import type { OutputFormat } from './types';

const FORMAT_MIME_MAP: Record<OutputFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

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
