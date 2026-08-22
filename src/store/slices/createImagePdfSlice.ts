import type { StateCreator } from 'zustand';
import type { ForgeState, ImagePdfSlice } from '../../types/store';

export const createImagePdfSlice: StateCreator<
  ForgeState,
  [],
  [],
  ImagePdfSlice
> = (set, get) => ({
  imagePdfItems: [],
  imagePdfPageSize: 'a4',
  imagePdfOrientation: 'portrait',
  imagePdfResult: null,
  imagePdfReady: false,
  imagePdfIsGenerating: false,
  imagePdfProgress: '',
  imagePdfError: undefined,

  addImagePdfFiles: (files) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
    const newItems = files
      .filter((file) => allowedTypes.has(file.type))
      .map((file, index) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        type: file.type,
        size: file.size,
        position: get().imagePdfItems.length + index,
      }));

    if (newItems.length === 0) {
      set({ imagePdfError: 'Upload JPEG, PNG, WebP, or AVIF images.' });
      return;
    }

    set((state) => ({
      imagePdfItems: [...state.imagePdfItems, ...newItems],
      imagePdfResult: null,
      imagePdfReady: false,
      imagePdfError: files.length !== newItems.length ? 'Some unsupported files were skipped.' : undefined,
    }));
  },

  removeImagePdfFile: (id) => {
    const item = get().imagePdfItems.find((image) => image.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);

    set((state) => ({
      imagePdfItems: state.imagePdfItems
        .filter((image) => image.id !== id)
        .map((image, position) => ({ ...image, position })),
      imagePdfResult: null,
      imagePdfReady: false,
    }));
  },

  clearImagePdfFiles: () => {
    get().imagePdfItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    set({
      imagePdfItems: [],
      imagePdfPageSize: 'a4',
      imagePdfOrientation: 'portrait',
      imagePdfResult: null,
      imagePdfReady: false,
      imagePdfProgress: '',
      imagePdfError: undefined,
    });
  },

  reorderImagePdfFiles: (activeId, overId) => {
    if (activeId === overId) return;

    set((state) => {
      const oldIndex = state.imagePdfItems.findIndex((item) => item.id === activeId);
      const newIndex = state.imagePdfItems.findIndex((item) => item.id === overId);
      if (oldIndex === -1 || newIndex === -1) return state;

      const nextItems = [...state.imagePdfItems];
      const [movedItem] = nextItems.splice(oldIndex, 1);
      nextItems.splice(newIndex, 0, movedItem);

      return {
        imagePdfItems: nextItems.map((item, position) => ({ ...item, position })),
        imagePdfResult: null,
        imagePdfReady: false,
      };
    });
  },

  setImagePdfPageSize: (pageSize) => {
    set({ imagePdfPageSize: pageSize, imagePdfResult: null, imagePdfReady: false });
  },

  setImagePdfOrientation: (orientation) => {
    set({ imagePdfOrientation: orientation, imagePdfResult: null, imagePdfReady: false });
  },

  setImagePdfGenerating: (isGenerating) => {
    set({ imagePdfIsGenerating: isGenerating });
  },

  setImagePdfProgress: (progress) => {
    set({ imagePdfProgress: progress });
  },

  setImagePdfResult: (result) => {
    if (result) {
      get().imagePdfItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    }

    set({
      imagePdfResult: result,
      imagePdfReady: result !== null,
      imagePdfProgress: result ? 'PDF Ready' : '',
      imagePdfItems: result ? [] : get().imagePdfItems,
    });
  },

  setImagePdfError: (error) => {
    set({ imagePdfError: error });
  },
});
