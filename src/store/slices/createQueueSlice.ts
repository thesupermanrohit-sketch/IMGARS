import type { StateCreator } from 'zustand';
import { db } from '../../db/db';
import type { OutputFormat } from '../../features/convert/types';
import type { ForgeState, QueueSlice, FileItem } from '../../types/store';

const BATCH_CONCURRENCY = 4;

export const createQueueSlice: StateCreator<
  ForgeState,
  [],
  [],
  QueueSlice
> = (set, get) => ({
  queue: [],
  isProcessingAll: false,

  addFiles: async (files) => {
    const newItems: FileItem[] = [];
    const currentTab = get().activeTab;
    const defaultFormat: OutputFormat = get().globalConvertFormat || 'webp';

    for (const file of files) {
      const id = crypto.randomUUID();

      await db.images.put({
        id,
        originalBlob: file,
      });

      newItems.push({
        id,
        name: file.name,
        type: file.type,
        originalSize: file.size,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
        mode: currentTab,
        ...(currentTab === 'convert' ? { outputFormat: defaultFormat } : {}),
      });
    }

    set((state) => ({
      queue: [...state.queue, ...newItems],
    }));
  },

  removeFile: async (id) => {
    const item = get().queue.find((queuedItem) => queuedItem.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);

    await db.images.delete(id);

    set((state) => ({
      queue: state.queue.filter((item) => item.id !== id),
    }));
  },

  clearQueue: async () => {
    const queue = get().queue;
    const ids = queue.map((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return item.id;
    });

    if (ids.length > 0) {
      await db.deleteImages(ids);
    }
    set({ queue: [] });
  },

  reorderQueue: (activeId, overId) => {
    if (activeId === overId) return;

    set((state) => {
      const oldIndex = state.queue.findIndex((item) => item.id === activeId);
      const newIndex = state.queue.findIndex((item) => item.id === overId);
      if (oldIndex === -1 || newIndex === -1) return state;

      const nextQueue = [...state.queue];
      const [movedItem] = nextQueue.splice(oldIndex, 1);
      nextQueue.splice(newIndex, 0, movedItem);

      return { queue: nextQueue };
    });
  },

  updateFileConfig: (id, updates) => {
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  },

  processFile: async (id) => {
    const { queue, activeTab } = get();
    const item = queue.find((i) => i.id === id);
    if (!item) return;

    set((state) => ({
      queue: state.queue.map((i) =>
        i.id === id ? { ...i, status: 'processing', error: undefined } : i
      ),
    }));

    try {
      const savedData = await db.images.get(id);
      if (!savedData) {
        throw new Error('Original file not found in storage.');
      }

      let processedBlob: Blob;
      let skipReason: string | undefined;
      const targetMode = item.mode || activeTab;

      if (targetMode === 'compress') {
        const { compressImage } = await import('../../features/compress/compressUtil');
        const targetKb = get().compressTargetSizeKb || 100;

        let maxWidthOrHeight: number | undefined;
        const preset = get().compressResolutionPreset ?? 'web';
        if (preset === 'web') maxWidthOrHeight = 1024;
        else if (preset === 'fullHd' || (preset as string) === 'hd') maxWidthOrHeight = 1920;

        processedBlob = await compressImage(savedData.originalBlob, targetKb, item.name, maxWidthOrHeight);
      } else if (targetMode === 'increaseSize') {
        const { increaseImageSize } = await import('../../features/increaseSize/increaseSizeUtil');
        const targetKb = get().increaseSizeTargetSizeKb || 500;
        const result = await increaseImageSize(savedData.originalBlob, targetKb, item.type, item.name);
        processedBlob = result.blob;
        skipReason = result.skipped ? (result.reason || 'Already meets target size') : undefined;
      } else {
        const { convertImage } = await import('../../features/convert/convertUtil');
        const targetFormat = item.outputFormat || get().globalConvertFormat || 'webp';
        processedBlob = await convertImage(savedData.originalBlob, targetFormat);
      }

      await db.images.update(id, { processedBlob });

      set((state) => ({
        queue: state.queue.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'done',
                processedSize: processedBlob.size,
                skipReason,
              }
            : i
        ),
      }));
    } catch (error) {
      console.error(`Error processing file ${item.name}:`, error);
      set((state) => ({
        queue: state.queue.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error occurred',
              }
            : i
        ),
      }));
    }
  },

  processAll: async () => {
    const { queue, processFile } = get();
    const pendingItems = queue.filter((i) => i.status === 'pending' || i.status === 'failed');
    if (pendingItems.length === 0) return;

    set({ isProcessingAll: true });

    try {
      // Chunk processing in batches to avoid OOM when processing large queues (TASK-11)
      for (let i = 0; i < pendingItems.length; i += BATCH_CONCURRENCY) {
        const chunk = pendingItems.slice(i, i + BATCH_CONCURRENCY);
        await Promise.all(chunk.map((item) => processFile(item.id)));
      }
    } finally {
      set({ isProcessingAll: false });
    }
  },

  getDownloadItem: async (id) => {
    const savedData = await db.images.get(id);
    if (!savedData || !savedData.processedBlob) return null;

    const item = get().queue.find((i) => i.id === id);
    if (!item) return null;

    let fileName = item.name;
    const { activeTab } = get();
    const itemMode = item.mode || activeTab;

    if (itemMode === 'compress') {
      const lastDotIndex = fileName.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        fileName = `${fileName.slice(0, lastDotIndex)}-compressed${fileName.slice(lastDotIndex)}`;
      } else {
        fileName = `${fileName}-compressed`;
      }
    } else if (itemMode === 'increaseSize') {
      const lastDotIndex = fileName.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        fileName = `${fileName.slice(0, lastDotIndex)}-increased${fileName.slice(lastDotIndex)}`;
      } else {
        fileName = `${fileName}-increased`;
      }
    } else {
      const targetFormat = item.outputFormat || 'webp';
      const lastDotIndex = fileName.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        fileName = `${fileName.slice(0, lastDotIndex)}.${targetFormat}`;
      } else {
        fileName = `${fileName}.${targetFormat}`;
      }
    }

    return { blob: savedData.processedBlob, fileName };
  },
});

