import {
  DEFAULT_GYM_STATE_RECORD_KEY,
  enqueueIndexedDbSyncItem,
  getPendingIndexedDbSyncItems,
  loadGymStateFromIndexedDB,
  removeIndexedDbSyncItem,
  saveGymStateToIndexedDB,
  type SyncOutboxRecord
} from './gymIndexedDb';
import {
  enqueueOfflineGymStateSync,
  flushOfflineGymStateQueue,
  isNetworkOnline
} from './offlineSyncQueue';
import { parseTimestampMs } from './workoutSyncEngine';

export interface PersistLocalFirstOptions {
  stateObj: Record<string, any>;
  endpoint?: string | null;
  reason?: string;
  localStateStorageKey?: string;
  recordKey?: string;
  skipCloudPush?: boolean;
  fetchImpl?: typeof fetch;
  onlineOverride?: boolean;
}

export interface PersistLocalFirstResult {
  savedToIndexedDb: boolean;
  queuedForSync: boolean;
  pushedToSupabase: boolean;
  pendingCount: number;
  lastUpdated: string;
}

export interface FlushIndexedDbSyncResult {
  attempted: number;
  flushed: number;
  remaining: number;
  syncedAtIso: string | null;
}

export function notifyServiceWorkerToSync(message: {
  type: 'QUEUE_GYM_STATE_SYNC' | 'FLUSH_GYM_STATE_SYNC';
  item?: SyncOutboxRecord;
}): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    }
    navigator.serviceWorker.ready
      .then((reg) => {
        if (reg.active) {
          reg.active.postMessage(message);
        }
        const syncManager = (reg as any).sync;
        if (syncManager && typeof syncManager.register === 'function') {
          syncManager.register('sync-gym-state').catch(() => {});
        }
      })
      .catch(() => {});
  } catch {
    // Service worker messaging is best-effort
  }
}

export async function hydrateGymStateLocalFirst(options: {
  localStorageState?: Record<string, any> | null;
  recordKey?: string;
}): Promise<{
  state: Record<string, any> | null;
  source: 'indexeddb' | 'localstorage' | 'none';
}> {
  const idbRecord = await loadGymStateFromIndexedDB(
    options.recordKey || DEFAULT_GYM_STATE_RECORD_KEY
  );
  const lsState = options.localStorageState || null;

  if (!idbRecord && !lsState) {
    return { state: null, source: 'none' };
  }
  if (idbRecord && !lsState) {
    return { state: idbRecord.gymState, source: 'indexeddb' };
  }
  if (!idbRecord && lsState) {
    await saveGymStateToIndexedDB(lsState, options.recordKey || DEFAULT_GYM_STATE_RECORD_KEY);
    return { state: lsState, source: 'localstorage' };
  }

  const idbMs = parseTimestampMs(idbRecord?.gymState?.last_updated || idbRecord?.lastUpdated);
  const lsMs = parseTimestampMs(lsState?.last_updated);

  if (idbMs >= lsMs && idbRecord) {
    return { state: idbRecord.gymState, source: 'indexeddb' };
  }
  if (lsState) {
    await saveGymStateToIndexedDB(lsState, options.recordKey || DEFAULT_GYM_STATE_RECORD_KEY);
    return { state: lsState, source: 'localstorage' };
  }
  return { state: idbRecord?.gymState || null, source: 'indexeddb' };
}

export async function flushIndexedDbSyncOutbox(options?: {
  fetchImpl?: typeof fetch;
  onlineOverride?: boolean;
}): Promise<FlushIndexedDbSyncResult> {
  const onlineNow =
    typeof options?.onlineOverride === 'boolean' ? options.onlineOverride : isNetworkOnline();
  const pending = await getPendingIndexedDbSyncItems();

  if (!onlineNow || pending.length === 0) {
    return {
      attempted: 0,
      flushed: 0,
      remaining: pending.length,
      syncedAtIso: null
    };
  }

  const fetcher = options?.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetcher) {
    return {
      attempted: 0,
      flushed: 0,
      remaining: pending.length,
      syncedAtIso: null
    };
  }

  let flushed = 0;
  for (const item of pending) {
    if (!item.endpoint) {
      await removeIndexedDbSyncItem(item.id);
      continue;
    }
    try {
      const isApi = item.endpoint.includes('/api/state');
      const res = await fetcher(item.endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': isApi ? 'application/json' : 'text/plain;charset=utf-8'
        },
        body: item.payloadJson
      });
      if (res && res.ok) {
        flushed += 1;
        await removeIndexedDbSyncItem(item.id);
      }
    } catch {
      // Keep item in IndexedDB outbox for next reconnection retry
    }
  }

  const after = await getPendingIndexedDbSyncItems();
  if (after.length === 0) {
    // Also drain legacy localStorage queue for backwards compatibility
    try {
      await flushOfflineGymStateQueue({ fetchImpl: fetcher });
    } catch {
      // Ignore legacy flush failures
    }
  }

  return {
    attempted: pending.length,
    flushed,
    remaining: after.length,
    syncedAtIso: flushed > 0 ? new Date().toISOString() : null
  };
}

export async function persistGymStateLocalFirst(
  options: PersistLocalFirstOptions
): Promise<PersistLocalFirstResult> {
  const {
    stateObj,
    endpoint,
    reason = 'local_update',
    localStateStorageKey = 'bws_5day_gym_state_v1',
    recordKey = DEFAULT_GYM_STATE_RECORD_KEY,
    skipCloudPush = false,
    fetchImpl,
    onlineOverride
  } = options;

  // 1. Always write to IndexedDB immediately (local-first truth)
  const savedRecord = await saveGymStateToIndexedDB(stateObj, recordKey);
  const payloadJson = JSON.stringify(savedRecord.gymState);

  if (skipCloudPush || !endpoint || !String(endpoint).trim()) {
    const pending = await getPendingIndexedDbSyncItems();
    return {
      savedToIndexedDb: true,
      queuedForSync: false,
      pushedToSupabase: false,
      pendingCount: pending.length,
      lastUpdated: savedRecord.lastUpdated
    };
  }

  const trimmedEndpoint = String(endpoint).trim();
  const outboxItem = await enqueueIndexedDbSyncItem({
    endpoint: trimmedEndpoint,
    payloadJson,
    reason,
    lastUpdated: savedRecord.lastUpdated
  });

  const onlineNow =
    typeof onlineOverride === 'boolean' ? onlineOverride : isNetworkOnline();

  if (!onlineNow) {
    // Mirror into legacy localStorage queue + notify SW for Background Sync
    enqueueOfflineGymStateSync({
      stateObj: savedRecord.gymState,
      endpoint: trimmedEndpoint,
      reason,
      localStateStorageKey
    });
    notifyServiceWorkerToSync({ type: 'QUEUE_GYM_STATE_SYNC', item: outboxItem });
    const pending = await getPendingIndexedDbSyncItems();
    return {
      savedToIndexedDb: true,
      queuedForSync: true,
      pushedToSupabase: false,
      pendingCount: pending.length,
      lastUpdated: savedRecord.lastUpdated
    };
  }

  // Online: push immediately in background to Supabase backend
  const flushRes = await flushIndexedDbSyncOutbox({
    fetchImpl,
    onlineOverride: onlineNow
  });

  if (flushRes.remaining > 0) {
    notifyServiceWorkerToSync({ type: 'QUEUE_GYM_STATE_SYNC', item: outboxItem });
  }

  return {
    savedToIndexedDb: true,
    queuedForSync: flushRes.remaining > 0,
    pushedToSupabase: flushRes.flushed > 0,
    pendingCount: flushRes.remaining,
    lastUpdated: savedRecord.lastUpdated
  };
}

export function startOfflineFirstBackgroundSync(callbacks?: {
  onSynced?: (detail: { flushedCount: number; remainingCount: number }) => void;
  onStatusChange?: (status: { online: boolean; pendingCount: number }) => void;
}): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    notifyServiceWorkerToSync({ type: 'FLUSH_GYM_STATE_SYNC' });
    flushIndexedDbSyncOutbox()
      .then((res) => {
        if (res.flushed > 0) {
          callbacks?.onSynced?.({
            flushedCount: res.flushed,
            remainingCount: res.remaining
          });
        }
        callbacks?.onStatusChange?.({
          online: true,
          pendingCount: res.remaining
        });
      })
      .catch(() => {});
  };

  const handleOffline = () => {
    getPendingIndexedDbSyncItems()
      .then((items) => {
        callbacks?.onStatusChange?.({
          online: false,
          pendingCount: items.length
        });
      })
      .catch(() => {});
  };

  const handleSwMessage = (event: MessageEvent) => {
    const data = event?.data;
    if (data && data.type === 'OFFLINE_GYM_STATE_SYNCED') {
      callbacks?.onSynced?.({
        flushedCount: Number(data.flushedCount || 0),
        remainingCount: Number(data.remainingCount || 0)
      });
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
  }

  // Trigger an initial background check if already online with pending outbox items
  if (isNetworkOnline()) {
    handleOnline();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
  };
}
