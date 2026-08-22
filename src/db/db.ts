import Dexie, { type Table } from 'dexie';

export interface SavedImage {
  id: string;          // Maps to the file item id in Zustand
  originalBlob: Blob;
  processedBlob?: Blob;
}

export class ImgarsDatabase extends Dexie {
  images!: Table<SavedImage>;

  constructor() {
    super('ImgarsDatabase');
    this.version(1).stores({
      images: 'id' // 'id' is our primary key
    });
  }

  // Helper method to clear everything on startup or reset
  async clearAll() {
    await this.images.clear();
  }
}

export const db = new ImgarsDatabase();
