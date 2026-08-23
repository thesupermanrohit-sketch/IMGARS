import { create } from 'zustand';
import type { FileItem, ForgeState } from '../types/store';
import { createNavigationSlice } from './slices/createNavigationSlice';
import { createQueueSlice } from './slices/createQueueSlice';
import { createCompressSlice } from './slices/createCompressSlice';
import { createIncreaseSizeSlice } from './slices/createIncreaseSizeSlice';
import { createConvertSlice } from './slices/createConvertSlice';
import { createImagePdfSlice } from './slices/createImagePdfSlice';

export type { FileItem, ForgeState };

export const useForgeStore = create<ForgeState>()((...a) => ({
  ...createNavigationSlice(...a),
  ...createQueueSlice(...a),
  ...createCompressSlice(...a),
  ...createIncreaseSizeSlice(...a),
  ...createConvertSlice(...a),
  ...createImagePdfSlice(...a),
}));

