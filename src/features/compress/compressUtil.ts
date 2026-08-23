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
    return compressedFile;
  } catch (error) {
    console.error('Compression failed:', error);
    // If the compression fails or cannot meet the constraints, try a fallback with minimal constraints
    try {
      const fallbackOptions: Parameters<typeof imageCompression>[1] = {
        maxSizeMB: Math.max(maxSizeMB * 1.5, 1),
        useWebWorker: true,
        ...(maxWidthOrHeight !== undefined ? { maxWidthOrHeight } : {}),
      };
      return await imageCompression(file, fallbackOptions);
    } catch (fallbackError) {
      const primaryMsg = error instanceof Error ? error.message : String(error);
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Failed to compress image: ${primaryMsg} (fallback: ${fallbackMsg})`);
    }
  }
}
