import type { StateCreator } from 'zustand';
import type { OutputFormat } from '../../features/convert/types';
import type { ForgeState, ConvertSlice } from '../../types/store';

export const createConvertSlice: StateCreator<
  ForgeState,
  [],
  [],
  ConvertSlice
> = (set) => ({
  globalConvertFormat: 'webp' as OutputFormat,
  setGlobalConvertFormat: (format) => {
    set((state) => ({
      globalConvertFormat: format,
      queue: state.queue.map((item) =>
        (item.mode === 'convert' || !item.mode) && item.outputFormat !== format
          ? {
              ...item,
              outputFormat: format,
              configVersion: (item.configVersion ?? 0) + 1,
              status: 'pending',
              processedSize: undefined,
              error: undefined,
              skipReason: undefined,
            }
          : item
      ),
    }));
  },
});
