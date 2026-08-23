import type { OutputFormat } from '../features/convert/types';
import type { CompressResolutionPreset } from '../features/compress/types';
import type {
  ImagePdfItem,
  ImagePdfOrientation,
  ImagePdfPageSize,
  ImagePdfResult,
} from '../features/imagePdf/types';
import type { Tab } from '../constants/tabs';

export type DimensionPreset = 'web' | 'hd' | 'original' | 'custom';

export interface FileItem {
  id: string;
  name: string;
  type: string;
  originalSize: number;
  processedSize?: number;
  previewUrl?: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  error?: string;
  targetSizeKb?: number;
  outputFormat?: OutputFormat;
  dimensionPreset?: DimensionPreset;
  customDimension?: number;
}

export interface NavigationSlice {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export interface QueueSlice {
  queue: FileItem[];
  isProcessingAll: boolean;
  addFiles: (files: File[]) => Promise<void>;
  removeFile: (id: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  reorderQueue: (activeId: string, overId: string) => void;
  updateFileConfig: (id: string, updates: Partial<FileItem>) => void;
  processFile: (id: string) => Promise<void>;
  processAll: () => Promise<void>;
  getDownloadItem: (id: string) => Promise<{ blob: Blob; fileName: string } | null>;
}

export interface CompressSlice {
  compressTargetSizeKb: number;
  compressResolutionPreset: CompressResolutionPreset;
  setCompressTargetSizeKb: (targetSizeKb: number) => void;
  setCompressResolutionPreset: (preset: CompressResolutionPreset) => void;
}

export interface ConvertSlice {
  globalConvertFormat: OutputFormat;
  setGlobalConvertFormat: (format: OutputFormat) => void;
}

export interface ImagePdfSlice {
  imagePdfItems: ImagePdfItem[];
  imagePdfPageSize: ImagePdfPageSize;
  imagePdfOrientation: ImagePdfOrientation;
  imagePdfResult: ImagePdfResult | null;
  imagePdfReady: boolean;
  imagePdfIsGenerating: boolean;
  imagePdfProgress: string;
  imagePdfError?: string;
  addImagePdfFiles: (files: File[]) => void;
  removeImagePdfFile: (id: string) => void;
  clearImagePdfFiles: () => void;
  reorderImagePdfFiles: (activeId: string, overId: string) => void;
  setImagePdfPageSize: (pageSize: ImagePdfPageSize) => void;
  setImagePdfOrientation: (orientation: ImagePdfOrientation) => void;
  setImagePdfGenerating: (isGenerating: boolean) => void;
  setImagePdfProgress: (progress: string) => void;
  setImagePdfResult: (result: ImagePdfResult | null) => void;
  setImagePdfError: (error?: string) => void;
}

export type ForgeState = NavigationSlice & QueueSlice & CompressSlice & ConvertSlice & ImagePdfSlice;
