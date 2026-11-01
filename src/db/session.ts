const ACTIVE_SESSIONS_KEY = 'imgars-active-db-sessions';
const SESSION_TTL_MS = 30 * 60 * 1000;
const LOCKED_SESSION_PREFIX = 'locked:';
const lockManager = typeof navigator !== 'undefined' ? navigator.locks : undefined;
const sessionId = `${lockManager ? LOCKED_SESSION_PREFIX : ''}${crypto.randomUUID()}`;
let sessionReady: Promise<void> | undefined;

export function getDbSessionId(): string {
  return sessionId;
}

// The browser releases this lease when the document closes or crashes, including
// reloads. Unlike a heartbeat, it also protects tabs whose timers are suspended.
export function ensureDbSession(): Promise<void> {
  if (!lockManager) return Promise.resolve();
  if (!sessionReady) {
    sessionReady = new Promise<void>((resolve, reject) => {
      void lockManager.request(`imgars:${sessionId}`, async () => {
        resolve();
        await new Promise<void>(() => {});
      }).catch(reject);
    });
  }
  return sessionReady;
}

function readActiveSessions(): Record<string, number> | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ACTIVE_SESSIONS_KEY) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (Object.values(value).some((timestamp) => typeof timestamp !== 'number')) return null;
    return value as Record<string, number>;
  } catch {
    // Unknown ownership is not evidence that a session is abandoned.
    return null;
  }
}

export function registerDbSession(): void {
  if (lockManager) return;
  try {
    const sessions = readActiveSessions() ?? {};
    sessions[sessionId] = Date.now();
    localStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // Web Locks still protect this session if localStorage is unavailable.
  }
}

export function unregisterDbSession(): void {
  if (lockManager) return;
  try {
    const sessions = readActiveSessions();
    if (!sessions) return;
    delete sessions[sessionId];
    localStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // The browser releases the lease independently of localStorage.
  }
}

export async function withAbandonedSession(
  ownerId: string | undefined,
  cleanup: () => Promise<void>
): Promise<void> {
  if (ownerId === sessionId) return;

  if (ownerId?.startsWith(LOCKED_SESSION_PREFIX)) {
    if (!lockManager) return;
    await lockManager.request(`imgars:${ownerId}`, { ifAvailable: true }, async (lock) => {
      if (lock) await cleanup();
    });
    return;
  }

  // Compatibility for records created before leases were introduced. Retain
  // them while their old heartbeat is live, or ownership cannot be established.
  const sessions = readActiveSessions();
  if (!sessions) return;
  const now = Date.now();
  const isLive = (timestamp: number) => now - timestamp <= SESSION_TTL_MS;
  if (ownerId ? isLive(sessions[ownerId]) : Object.entries(sessions).some(
    ([id, timestamp]) => id !== sessionId && !id.startsWith(LOCKED_SESSION_PREFIX) && isLive(timestamp)
  )) return;
  await cleanup();
}
