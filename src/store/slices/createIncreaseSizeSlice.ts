import type { StateCreator } from 'zustand';
import { DEFAULT_INCREASE_SIZE_KB, MAX_TARGET_SIZE_KB } from '../../constants/tabs';
import type { ForgeState, IncreaseSizeSlice } from '../../types/store';

export const createIncreaseSizeSlice: StateCreator<
  ForgeState,
  [],
  [],
  IncreaseSizeSlice
> = (set) => ({
  increaseSizeTargetSizeKb: DEFAULT_INCREASE_SIZE_KB,

  setIncreaseSizeTargetSizeKb: (targetSizeKb) => {
    const nextTarget = Math.min(Math.max(Math.round(targetSizeKb || 1), 1), MAX_TARGET_SIZE_KB);
    set({ increaseSizeTargetSizeKb: nextTarget });
  },
});
