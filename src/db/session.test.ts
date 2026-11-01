import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const heldLocks = new Set<string>();
const storage = new Map<string, string>();

beforeEach(() => {
  vi.resetModules();
  heldLocks.clear();
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal('navigator', {
    locks: {
      async request(name: string, options: unknown, callback?: (lock: object | null) => Promise<void>) {
        const action = typeof options === 'function'
          ? options as (lock: object | null) => Promise<void>
          : callback!;
        if (heldLocks.has(name)) return action(null);
        heldLocks.add(name);
        try { await action({ name }); } finally { heldLocks.delete(name); }
      },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('database session leases', () => {
  it('deletes abandoned blobs while preserving live-tab and active queue records', async () => {
    const { ImgarsDatabase, getDbSessionId } = await import('./db');
    heldLocks.add('imgars:locked:live');
    const records = [
      { id: 'abandoned', ownerId: 'locked:closed' },
      { id: 'live', ownerId: 'locked:live' },
      { id: 'queued', ownerId: 'locked:closed' },
      { id: 'uploading', ownerId: getDbSessionId() },
    ];
    const deleteImages = vi.fn().mockResolvedValue(undefined);
    const database = {
      images: { toCollection: () => ({
        each: async (visit: (image: typeof records[number]) => void) => records.forEach(visit),
      }) },
      deleteImages,
    };
    await ImgarsDatabase.prototype.cleanupStaleImages.call(database as unknown as InstanceType<typeof ImgarsDatabase>, ['queued']);
    expect(deleteImages).toHaveBeenCalledExactlyOnceWith(['abandoned']);
  });

  it('cleans a previous session immediately after its browser lease is released', async () => {
    const session = await import('./session');
    const cleanup = vi.fn().mockResolvedValue(undefined);
    heldLocks.add('imgars:locked:previous');
    await session.withAbandonedSession('locked:previous', cleanup);
    expect(cleanup).not.toHaveBeenCalled();
    heldLocks.delete('imgars:locked:previous');
    await session.withAbandonedSession('locked:previous', cleanup);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('protects a suspended tab even when its heartbeat has expired', async () => {
    const session = await import('./session');
    storage.set('imgars-active-db-sessions', JSON.stringify({ 'locked:sleeping': 1 }));
    heldLocks.add('imgars:locked:sleeping');
    const cleanup = vi.fn();
    await session.withAbandonedSession('locked:sleeping', cleanup);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('acquires its lease before writes and protects current-session records', async () => {
    const session = await import('./session');
    await session.ensureDbSession();
    expect(heldLocks.has(`imgars:${session.getDbSessionId()}`)).toBe(true);
    const cleanup = vi.fn();
    await session.withAbandonedSession(session.getDbSessionId(), cleanup);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('retains live legacy sessions but cleans expired ones', async () => {
    const session = await import('./session');
    storage.set('imgars-active-db-sessions', JSON.stringify({ old: Date.now() }));
    const cleanup = vi.fn().mockResolvedValue(undefined);
    await session.withAbandonedSession('old', cleanup);
    expect(cleanup).not.toHaveBeenCalled();
    storage.set('imgars-active-db-sessions', JSON.stringify({ old: 1 }));
    await session.withAbandonedSession('old', cleanup);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('does not delete unknown legacy ownership when session storage is unreadable', async () => {
    const session = await import('./session');
    storage.set('imgars-active-db-sessions', 'invalid JSON');
    const cleanup = vi.fn();
    await session.withAbandonedSession('old', cleanup);
    expect(cleanup).not.toHaveBeenCalled();
  });
});
