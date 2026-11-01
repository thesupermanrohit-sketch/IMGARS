import Dexie, { type Table } from 'dexie';
import { ensureDbSession, getDbSessionId, withAbandonedSession } from './session';
export { ensureDbSession, getDbSessionId, registerDbSession, unregisterDbSession } from './session';

export interface SavedImage {
  id: string;          // Maps to the file item id in Zustand
  originalBlob: Blob;
  processedBlob?: Blob;
  ownerId?: string;
}

export function getStaleImageIds(storedIds: (string | number)[], activeIds: string[]) {
  const active = new Set(activeIds);
  return storedIds.filter((id) => !active.has(String(id)));
}

export function getStaleOwnedImageIds(
  images: Pick<SavedImage, 'id' | 'ownerId'>[],
  activeIds: string[],
  ownerId: string
) {
  const active = new Set(activeIds);
  return images
    .filter((image) => image.ownerId === ownerId && !active.has(image.id))
    .map((image) => image.id);
}

export class ImgarsDatabase extends Dexie {
  images!: Table<SavedImage>;

  constructor() {
    super('ImgarsDatabase');
    this.version(1).stores({
      images: 'id' // 'id' is our primary key
    });
  }

  // Helper method to clear specific items by IDs
  async deleteImages(ids: string[]) {
    if (ids.length === 0) return;
    await this.images.bulkDelete(ids);
  }

  async cleanupStaleImages(activeIds: string[]) {
    await ensureDbSession();
    const active = new Set(activeIds);
    const recordsByOwner = new Map<string | undefined, string[]>();
    // Retain only IDs and ownership while iterating over stored image records.
    await this.images.toCollection().each((image) => {
      if (active.has(image.id) || image.ownerId === getDbSessionId()) return;
      const ids = recordsByOwner.get(image.ownerId) ?? [];
      ids.push(image.id);
      recordsByOwner.set(image.ownerId, ids);
    });
    for (const [ownerId, ids] of recordsByOwner) {
      await withAbandonedSession(ownerId, () => this.deleteImages(ids));
    }
  }

  // Helper method to clear everything on reset
  async clearAll() {
    await this.images.clear();
  }
}

export const db = new ImgarsDatabase();
