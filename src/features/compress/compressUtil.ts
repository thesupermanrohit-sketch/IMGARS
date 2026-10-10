import imageCompression from 'browser-image-compression';

export async function compressImage(
  blob: Blob,
  targetSizeKb: number,
  fileName: string,
  maxWidthOrHeight?: number
): Promise<Blob> {
  const maxSizeMB = targetSizeKb / 1024;
  
  // Convert blob back to a File object because browser-image-compression works best with File
  const file = new File([blob], fileName, { type: blob.type });

  const options: Parameters<typeof imageCompression>[1] = {
    maxSizeMB: maxSizeMB,
    useWebWorker: true,
    initialQuality: 0.9,
    ...(maxWidthOrHeight !== undefined ? { maxWidthOrHeight } : {}),
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return ensureTargetSize(compressedFile, targetSizeKb);
  } catch (error) {
    console.error('Compression failed:', error);
    // Retry without a worker, but preserve the requested size ceiling.
    try {
      const fallbackOptions: Parameters<typeof imageCompression>[1] = {
        maxSizeMB,
        useWebWorker: false,
        ...(maxWidthOrHeight !== undefined ? { maxWidthOrHeight } : {}),
      };
      const fallbackFile = await imageCompression(file, fallbackOptions);
      return ensureTargetSize(fallbackFile, targetSizeKb);
    } catch (fallbackError) {
      const primaryMsg = error instanceof Error ? error.message : String(error);
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Failed to compress image: ${primaryMsg} (fallback: ${fallbackMsg})`);
    }
  }
}

function ensureTargetSize(blob: Blob, targetSizeKb: number): Blob {
  const targetSizeBytes = Math.round(targetSizeKb * 1024);
  if (blob.size > targetSizeBytes) {
    throw new Error(`Compression could not meet the ${targetSizeKb} KB target.`);
  }
  return blob;
}
