export interface IncreaseSizeOptions {
  targetSizeKb: number;
}

export interface IncreaseSizeResult {
  blob: Blob;
  skipped: boolean;
  reason?: string;
}
