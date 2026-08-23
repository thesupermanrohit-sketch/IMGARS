import type { StateCreator } from 'zustand';
import { DEFAULT_TARGET_SIZE_KB, MAX_TARGET_SIZE_KB } from '../../constants/tabs';
import type { ForgeState, CompressSlice } from '../../types/store';

export const createCompressSlice: StateCreator<
  ForgeState,
  [],
  [],
  CompressSlice
> = (set) => ({
  compressTargetSizeKb: DEFAULT_TARGET_SIZE_KB,
  compressResolutionPreset: 'web',

  setCompressTargetSizeKb: (targetSizeKb) => {
    const nextTarget = Math.min(Math.max(Math.round(targetSizeKb || 1), 1), MAX_TARGET_SIZE_KB);
    set({ compressTargetSizeKb: nextTarget });
  },

  setCompressResolutionPreset: (preset) => {
    set({ compressResolutionPreset: preset });
  },
});
