import type { StateCreator } from 'zustand';
import { db } from '../../db/db';
import { DEFAULT_TARGET_SIZE_KB, MAX_TARGET_SIZE_KB } from '../../constants/tabs';
import type { CompressionResultItem } from '../../features/compress/types';
import type { ForgeState, CompressSlice } from '../../types/store';

export const createCompressSlice: StateCreator<
  ForgeState,
  [],
  [],
  CompressSlice
> = (set, get) => ({
  compressTargetSizeKb: DEFAULT_TARGET_SIZE_KB,
  compressResolutionPreset: 'web',
  compressIsProcessing: false,
  compressProgress: '',
  compressError: undefined,
  compressResults: [],
  compressReady: false,

  setCompressTargetSizeKb: (targetSizeKb) => {
    const nextTarget = Math.min(Math.max(Math.round(targetSizeKb || 1), 1), MAX_TARGET_SIZE_KB);
    set({ compressTargetSizeKb: nextTarget, compressReady: false, compressError: undefined });
  },

  setCompressResolutionPreset: (preset) => {
    set({ compressResolutionPreset: preset, compressReady: false, compressError: undefined });
  },

  resetCompressWorkflow: async () => {
    get().queue.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    get().compressResults.forEach((result) => URL.revokeObjectURL(result.previewUrl));
    await db.clearAll();

    set({
      queue: [],
      compressTargetSizeKb: DEFAULT_TARGET_SIZE_KB,
      compressResolutionPreset: 'web', // Fixed inconsistent default (TASK-09)
      compressIsProcessing: false,
      compressProgress: '',
      compressError: undefined,
      compressResults: [],
      compressReady: false,
    });
  },

  processCompressionBatch: async () => {
    const { queue, compressTargetSizeKb, compressResolutionPreset } = get();
    if (queue.length === 0) return;

    set({
      compressIsProcessing: true,
      compressProgress: 'Compressing...',
      compressError: undefined,
      compressReady: false,
    });

    const results: CompressionResultItem[] = [];

    try {
      const { compressImage } = await import('../../features/compress/compressUtil');
      const maxWidthOrHeight =
        compressResolutionPreset === 'web'
          ? 1024
          : compressResolutionPreset === 'fullHd'
            ? 1920
            : undefined;

      for (let index = 0; index < queue.length; index += 1) {
        const item = queue[index];
        set({ compressProgress: `Processing image ${index + 1} of ${queue.length}...` });

        const savedData = await db.images.get(item.id);
        if (!savedData) {
          throw new Error(`Original file not found for ${item.name}.`);
        }

        const compressedBlob = await compressImage(
          savedData.originalBlob,
          compressTargetSizeKb,
          item.name,
          maxWidthOrHeight
        );

        results.push({
          id: item.id,
          name: item.name,
          originalSize: item.originalSize,
          compressedSize: compressedBlob.size,
          blob: compressedBlob,
          previewUrl: URL.createObjectURL(compressedBlob),
        });
      }

      set({ compressProgress: 'Finalizing...' });
      get().queue.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      await db.clearAll();

      set({
        queue: [],
        compressResults: results,
        compressReady: true,
        compressProgress: 'Compression Complete',
      });
    } catch (error) {
      results.forEach((result) => URL.revokeObjectURL(result.previewUrl));
      set({
        compressError: error instanceof Error ? error.message : 'Compression failed.',
        compressProgress: '',
      });
    } finally {
      set({ compressIsProcessing: false });
    }
  },
});
