import Dexie, { type Table } from 'dexie';

export interface SavedImage {
  id: string;          // Maps to the file item id in Zustand
  originalBlob: Blob;
  processedBlob?: Blob;
  ownerId?: string;
}

const DB_SESSION_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ACTIVE_SESSIONS_KEY = 'imgars-active-db-sessions';
const SESSION_TTL_MS = 30 * 60 * 1000;

export function getDbSessionId() {
  return DB_SESSION_ID;
}

function readActiveSessions(): Record<string, number> {
  if (typeof localStorage === 'undefined') return { [DB_SESSION_ID]: Date.now() };

  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_SESSIONS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function registerDbSession() {
  if (typeof localStorage === 'undefined') return;
  const now = Date.now();
  const sessions = readActiveSessions();
  for (const [id, lastSeen] of Object.entries(sessions)) {
    if (now - lastSeen > SESSION_TTL_MS) delete sessions[id];
  }
  sessions[DB_SESSION_ID] = now;
  localStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(sessions));
}

export function unregisterDbSession() {
  if (typeof localStorage === 'undefined') return;
  const sessions = readActiveSessions();
  delete sessions[DB_SESSION_ID];
  localStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(sessions));
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

  // Remove records left behind by this session's interrupted uploads. Records
  // owned by other sessions must remain untouched.
  async cleanupStaleImages(activeIds: string[], ownerId = getDbSessionId()) {
    registerDbSession();
    const staleIds = await this.images
      .filter((image) => image.ownerId === ownerId && !activeIds.includes(image.id))
      .primaryKeys();
    if (staleIds.length > 0) {
      await this.images.bulkDelete(staleIds);
    }
  }

  // Helper method to clear everything on reset
  async clearAll() {
    await this.images.clear();
  }
}

export const db = new ImgarsDatabase();
