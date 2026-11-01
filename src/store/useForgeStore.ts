import { create } from 'zustand';
import type { FileItem, ForgeState } from '../types/store';
import { createNavigationSlice } from './slices/createNavigationSlice';
import { createQueueSlice } from './slices/createQueueSlice';
import { createCompressSlice } from './slices/createCompressSlice';
import { createIncreaseSizeSlice } from './slices/createIncreaseSizeSlice';
import { createConvertSlice } from './slices/createConvertSlice';
import { createImagePdfSlice } from './slices/createImagePdfSlice';
import { getQueueItemMode } from '../utils/queueMode';

export type { FileItem, ForgeState };

export const useForgeStore = create<ForgeState>()((set, get, api) => {
  const setQueueState: typeof set = (partial, replace) => {
    let next = typeof partial === 'function' ? partial(get()) : partial;
    if (next.queue?.some((item) => item.mode === undefined)) {
      next = {
        ...next,
        queue: next.queue.map((item) => item.mode === undefined
          ? { ...item, mode: getQueueItemMode(item) }
          : item),
      };
    }
    if (replace) set(next as ForgeState, true);
    else set(next);
  };

  // Normalize queue entries at the store boundary, including legacy callers of
  // setState, so navigation and later settings changes cannot reinterpret them.
  api.setState = setQueueState;
  return {
    ...createNavigationSlice(setQueueState, get, api),
    ...createQueueSlice(setQueueState, get, api),
    ...createCompressSlice(setQueueState, get, api),
    ...createIncreaseSizeSlice(setQueueState, get, api),
    ...createConvertSlice(setQueueState, get, api),
    ...createImagePdfSlice(setQueueState, get, api),
  };
});
