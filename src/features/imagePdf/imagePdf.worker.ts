/// <reference lib="webworker" />

import { expose } from 'comlink';
import { PDFDocument, rgb } from 'pdf-lib';
import type {
  ImagePdfResult,
  ImagePdfWorkerApi,
  ImagePdfWorkerInput,
  ImagePdfWorkerOptions,
  ImagePdfProgress,
} from './types';

const PDF_PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89 },
};


async function decodeImage(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Image decoding is not supported in this browser worker.');
  }

  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error(`Could not decode ${file.name}. The image may be corrupted or unsupported.`);
  }
}

async function fileToJpegBytes(file: File, bitmap: ImageBitmap): Promise<ArrayBuffer> {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('Canvas processing is not supported in this browser worker.');
  }

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create a canvas context for image processing.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, bitmap.width, bitmap.height);
  context.drawImage(bitmap, 0, 0);
  const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  const jpegBytes = await jpegBlob.arrayBuffer();
  if (file.size === 0 || jpegBytes.byteLength === 0) {
    throw new Error(`Could not prepare ${file.name} for PDF embedding.`);
  }

  return jpegBytes;
}

function resolvePageDimensions(
  options: ImagePdfWorkerOptions,
  bitmap: ImageBitmap
) {
  if (options.pageSize === 'match') {
    return { width: bitmap.width, height: bitmap.height };
  }

  const baseSize = PDF_PAGE_SIZES.a4;
  if (options.orientation === 'landscape') {
    return { width: baseSize.height, height: baseSize.width };
  }

  return baseSize;
}

function resolveImagePlacement(
  options: ImagePdfWorkerOptions,
  pageDimensions: { width: number; height: number },
  bitmap: ImageBitmap
) {
  if (options.pageSize === 'match') {
    return {
      x: 0,
      y: 0,
      width: pageDimensions.width,
      height: pageDimensions.height,
    };
  }

  const scale = Math.min(
    pageDimensions.width / bitmap.width,
    pageDimensions.height / bitmap.height
  );
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;

  return {
    x: (pageDimensions.width - width) / 2,
    y: (pageDimensions.height - height) / 2,
    width,
    height,
  };
}

async function generatePdf(
  images: ImagePdfWorkerInput[],
  options: ImagePdfWorkerOptions,
  onProgress: ImagePdfProgress
): Promise<ImagePdfResult> {
  if (images.length === 0) {
    throw new Error('Add at least one image before generating a PDF.');
  }

  onProgress('Generating PDF...');
  const pdfDoc = await PDFDocument.create();

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    onProgress(`Processing image ${index + 1} of ${images.length}...`);

    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await decodeImage(image.file);
      const pageDimensions = resolvePageDimensions(options, bitmap);
      const page = pdfDoc.addPage([pageDimensions.width, pageDimensions.height]);
      let embeddedImage;
      if (image.file.type === 'image/jpeg') {
        const sourceBytes = await image.file.arrayBuffer();
        try {
          embeddedImage = await pdfDoc.embedJpg(sourceBytes);
        } catch {
          const fallbackBytes = await fileToJpegBytes(image.file, bitmap);
          embeddedImage = await pdfDoc.embedJpg(fallbackBytes);
        }
      } else if (image.file.type === 'image/png') {
        const sourceBytes = await image.file.arrayBuffer();
        try {
          embeddedImage = await pdfDoc.embedPng(sourceBytes);
        } catch {
          // Fall back to canvas rasterized JPEG on non-standard / interlaced PNGs
          const fallbackBytes = await fileToJpegBytes(image.file, bitmap);
          embeddedImage = await pdfDoc.embedJpg(fallbackBytes);
        }
      } else {
        const sourceBytes = await fileToJpegBytes(image.file, bitmap);
        embeddedImage = await pdfDoc.embedJpg(sourceBytes);
      }
      const imagePlacement = resolveImagePlacement(options, pageDimensions, bitmap);

      if (options.pageSize === 'a4') {
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageDimensions.width,
          height: pageDimensions.height,
          color: rgb(1, 1, 1),
        });
      }

      page.drawImage(embeddedImage, {
        x: imagePlacement.x,
        y: imagePlacement.y,
        width: imagePlacement.width,
        height: imagePlacement.height,
      });
    } finally {
      bitmap?.close();
    }
  }

  onProgress('Finalizing PDF...');
  const pdfBytes = await pdfDoc.save();
  const pdfData = new Uint8Array(pdfBytes);
  const blob = new Blob([pdfData.buffer], { type: 'application/pdf' });

  return { blob, size: blob.size };
}

const api: ImagePdfWorkerApi = {
  generatePdf,
};

expose(api);
