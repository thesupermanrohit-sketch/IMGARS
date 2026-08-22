import { create } from 'zustand';
import type { DimensionPreset, FileItem, ForgeState } from '../types/store';
import { createQueueSlice } from './slices/createQueueSlice';
import { createCompressSlice } from './slices/createCompressSlice';
import { createConvertSlice } from './slices/createConvertSlice';
import { createImagePdfSlice } from './slices/createImagePdfSlice';

export type { DimensionPreset, FileItem, ForgeState };

export const useForgeStore = create<ForgeState>()((...a) => ({
  ...createQueueSlice(...a),
  ...createCompressSlice(...a),
  ...createConvertSlice(...a),
  ...createImagePdfSlice(...a),
}));
