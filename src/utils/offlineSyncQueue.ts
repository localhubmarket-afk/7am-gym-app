import { serializeStateForPersistence } from './workoutLogic';
import { stampGymStateLastUpdated } from './workoutSyncEngine';

export const OFFLINE_SYNC_QUEUE_STORAGE_KEY = 'budget_gym_offline_sync_queue_v1';

export interface OfflineSyncQueueItem {
  id: string;
  endpoint: string;
  payloadJson: string;
  reason: string;
  queuedAt: string;
  attempts: number;
}

export interface OfflineSyncFlushSummary {
  flushedCount: number;
  remainingCount: number;
  online: boolean;
  lastError: string | null;
}

export interface StorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

function getDefaultStorage(): StorageAdapter | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Restricted storage environment
  }
  return null;
}

export function isNetworkOnline(navigatorLike?: { onLine?: boolean } | null): boolean {
  const nav = navigatorLike ?? (typeof navigator !== 'undefined' ? navigator : null);
  if (!nav || typeof nav.onLine !== 'boolean') return true;
  return nav.onLine;
}

export function readOfflineSyncQueue(storage?: StorageAdapter | null): OfflineSyncQueueItem[] {
  const store = storage ?? getDefaultStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(OFFLINE_SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeOfflineSyncQueue(items: OfflineSyncQueueItem[], storage?: StorageAdapter | null): void {
  const store = storage ?? getDefaultStorage();
  if (!store) return;
  try {
    if (!items || items.length === 0) {
      if (typeof store.removeItem === 'function') {
        store.removeItem(OFFLINE_SYNC_QUEUE_STORAGE_KEY);
      } else {
        store.setItem(OFFLINE_SYNC_QUEUE_STORAGE_KEY, '[]');
      }
      return;
    }
    store.setItem(OFFLINE_SYNC_QUEUE_STORAGE_KEY, JSON.stringify(items.slice(-10)));
  } catch {
    // Ignore quota errors
  }
}

export function enqueueOfflineGymStateSync(options: {
  stateObj: Record<string, any>;
  endpoint: string;
  reason?: string;
  localStateStorageKey?: string;
  storage?: StorageAdapter | null;
}): {
  savedLocally: boolean;
  queuedForCloud: boolean;
  queueLength: number;
  item: OfflineSyncQueueItem | null;
} {
  const store = options.storage ?? getDefaultStorage();
  const nowIso = new Date().toISOString();
  const stamped = stampGymStateLastUpdated({ ...options.stateObj }, nowIso);
  const payloadJson = serializeStateForPersistence(stamped);

  let savedLocally = false;
  if (store && options.localStateStorageKey) {
    try {
      store.setItem(options.localStateStorageKey, payloadJson);
      savedLocally = true;
    } catch {
      savedLocally = false;
    }
  }

  const endpoint = String(options.endpoint || '').trim();
  if (!endpoint) {
    return {
      savedLocally,
      queuedForCloud: false,
      queueLength: readOfflineSyncQueue(store).length,
      item: null
    };
  }

  const queue = readOfflineSyncQueue(store);
  const filtered = queue.filter((entry) => entry.endpoint !== endpoint);
  const nextItem: OfflineSyncQueueItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    endpoint,
    payloadJson,
    reason: options.reason || 'offline_local_save',
    queuedAt: nowIso,
    attempts: 0
  };
  filtered.push(nextItem);
  writeOfflineSyncQueue(filtered, store);

  notifyServiceWorkerToQueueSync(nextItem);

  return {
    savedLocally,
    queuedForCloud: true,
    queueLength: filtered.length,
    item: nextItem
  };
}

export function notifyServiceWorkerToQueueSync(item: OfflineSyncQueueItem): void {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => {
        if (reg && reg.active) {
          reg.active.postMessage({
            type: 'QUEUE_GYM_STATE_SYNC',
            item
          });
        }
        const syncMgr = (reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync;
        if (syncMgr && typeof syncMgr.register === 'function') {
          syncMgr.register('sync-gym-state').catch(() => {});
        }
      })
      .catch(() => {});
  } catch {
    // Non-fatal in unsupported browsers
  }
}

export async function flushOfflineGymStateQueue(options?: {
  storage?: StorageAdapter | null;
  fetchImpl?: typeof fetch;
  navigatorLike?: { onLine?: boolean } | null;
}): Promise<OfflineSyncFlushSummary> {
  const store = options?.storage ?? getDefaultStorage();
  const online = isNetworkOnline(options?.navigatorLike);
  const queue = readOfflineSyncQueue(store);

  if (!online) {
    return {
      flushedCount: 0,
      remainingCount: queue.length,
      online: false,
      lastError: 'Device is offline. Saved safely on this device.'
    };
  }

  if (queue.length === 0) {
    return {
      flushedCount: 0,
      remainingCount: 0,
      online: true,
      lastError: null
    };
  }

  const fetchFn = options?.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!fetchFn) {
    return {
      flushedCount: 0,
      remainingCount: queue.length,
      online: true,
      lastError: 'Fetch unavailable.'
    };
  }

  const remaining: OfflineSyncQueueItem[] = [];
  let flushedCount = 0;
  let lastError: string | null = null;

  for (const item of queue) {
    try {
      const isSupabaseApi = item.endpoint.includes('/api/state');
      const resp = await fetchFn(item.endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': isSupabaseApi ? 'application/json' : 'text/plain;charset=utf-8'
        },
        body: item.payloadJson
      });
      if (resp && resp.ok) {
        flushedCount += 1;
      } else {
        lastError = `HTTP ${resp ? resp.status : 'error'}`;
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  writeOfflineSyncQueue(remaining, store);

  return {
    flushedCount,
    remainingCount: remaining.length,
    online: true,
    lastError
  };
}
