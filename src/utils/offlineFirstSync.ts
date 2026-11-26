import {
  DEFAULT_GYM_STATE_RECORD_KEY,
  enqueueIndexedDbSyncItem,
  getPendingIndexedDbSyncItems,
  loadGymStateFromIndexedDB,
  removeIndexedDbSyncItem,
  saveGymStateToIndexedDB,
  updateIndexedDbSyncItem,
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
  actionType?: string;
  setKey?: string | null;
  exerciseId?: string | null;
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
  stoppedOnError: boolean;
}

let activeIdbFlushPromise: Promise<FlushIndexedDbSyncResult> | null = null;

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

async function runFlushIndexedDbSyncOutbox(options?: {
  fetchImpl?: typeof fetch;
  onlineOverride?: boolean;
  resolveEndpoint?: () => string;
}): Promise<FlushIndexedDbSyncResult> {
  const onlineNow =
    typeof options?.onlineOverride === 'boolean' ? options.onlineOverride : isNetworkOnline();
  const pending = await getPendingIndexedDbSyncItems();

  if (!onlineNow || pending.length === 0) {
    return {
      attempted: 0,
      flushed: 0,
      remaining: pending.length,
      syncedAtIso: null,
      stoppedOnError: false
    };
  }

  const fetcher = options?.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetcher) {
    return {
      attempted: 0,
      flushed: 0,
      remaining: pending.length,
      syncedAtIso: null,
      stoppedOnError: false
    };
  }

  const dynamicEndpoint = String(options?.resolveEndpoint?.() || '').trim();
  let attempted = 0;
  let flushed = 0;
  let stoppedOnError = false;

  // Strict FIFO processing: upload items one by one in creation order.
  // If any upload fails, keep it pending and STOP immediately so newer writes never leapfrog it.
  for (const item of pending) {
    const itemEndpoint =
      item.endpoint && item.endpoint !== 'pending_endpoint' ? item.endpoint : '';
    const targetEndpoint = dynamicEndpoint || itemEndpoint;
    if (!targetEndpoint) {
      stoppedOnError = true;
      break;
    }

    attempted += 1;
    try {
      const isApi = targetEndpoint.includes('/api/state');
      const isFirebase =
        targetEndpoint.includes('firebaseio.com') || targetEndpoint.endsWith('.json');
      const res = await fetcher(targetEndpoint, {
        method: isFirebase ? 'PUT' : 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': isApi ? 'application/json' : 'text/plain;charset=utf-8'
        },
        body: item.payloadJson
      });

      if (!res || !res.ok) {
        await updateIndexedDbSyncItem({
          ...item,
          status: 'pending',
          attempts: (item.attempts || 0) + 1
        });
        stoppedOnError = true;
        break;
      }

      const json =
        typeof (res as any).json === 'function'
          ? await (res as any).json().catch(() => ({}))
          : {};
      if (json && (json.configured === false || json.saved === false)) {
        await updateIndexedDbSyncItem({
          ...item,
          status: 'pending',
          attempts: (item.attempts || 0) + 1
        });
        stoppedOnError = true;
        break;
      }

      flushed += 1;
      await removeIndexedDbSyncItem(item.id);
    } catch {
      await updateIndexedDbSyncItem({
        ...item,
        status: 'pending',
        attempts: (item.attempts || 0) + 1
      });
      stoppedOnError = true;
      break;
    }
  }

  const after = await getPendingIndexedDbSyncItems();
  if (after.length === 0 && !stoppedOnError) {
    try {
      await flushOfflineGymStateQueue({ fetchImpl: fetcher });
    } catch {
      // Ignore legacy flush failures
    }
  }

  return {
    attempted,
    flushed,
    remaining: after.length,
    syncedAtIso: flushed > 0 ? new Date().toISOString() : null,
    stoppedOnError
  };
}

export async function flushIndexedDbSyncOutbox(options?: {
  fetchImpl?: typeof fetch;
  onlineOverride?: boolean;
  resolveEndpoint?: () => string;
}): Promise<FlushIndexedDbSyncResult> {
  // Use lock only for standard runtime calls (not custom fetchImpl tests running sequentially)
  if (!options?.fetchImpl && activeIdbFlushPromise) {
    return activeIdbFlushPromise;
  }
  const promise = runFlushIndexedDbSyncOutbox(options);
  if (!options?.fetchImpl) {
    activeIdbFlushPromise = promise.finally(() => {
      activeIdbFlushPromise = null;
    });
    return activeIdbFlushPromise;
  }
  return promise;
}

export async function persistGymStateLocalFirst(
  options: PersistLocalFirstOptions
): Promise<PersistLocalFirstResult> {
  const {
    stateObj,
    endpoint,
    reason = 'local_update',
    actionType,
    setKey = null,
    exerciseId = null,
    localStateStorageKey = 'bws_5day_gym_state_v1',
    recordKey = DEFAULT_GYM_STATE_RECORD_KEY,
    skipCloudPush = false,
    fetchImpl,
    onlineOverride
  } = options;

  // 1. Always write to local gym_state immediately (local-first truth)
  const savedRecord = await saveGymStateToIndexedDB(stateObj, recordKey);
  const payloadJson = JSON.stringify(savedRecord.gymState);

  if (skipCloudPush) {
    const pending = await getPendingIndexedDbSyncItems();
    return {
      savedToIndexedDb: true,
      queuedForSync: false,
      pushedToSupabase: false,
      pendingCount: pending.length,
      lastUpdated: savedRecord.lastUpdated
    };
  }

  const trimmedEndpoint = String(endpoint || '').trim();
  // 2. Simultaneously append a pending FIFO record into sync_outbox
  const outboxItem = await enqueueIndexedDbSyncItem({
    endpoint: trimmedEndpoint || 'pending_endpoint',
    payloadJson,
    reason,
    actionType: actionType || reason,
    setKey,
    exerciseId,
    lastUpdated: savedRecord.lastUpdated
  });

  const onlineNow =
    typeof onlineOverride === 'boolean' ? onlineOverride : isNetworkOnline();

  if (!onlineNow || !trimmedEndpoint) {
    if (trimmedEndpoint) {
      enqueueOfflineGymStateSync({
        stateObj: savedRecord.gymState,
        endpoint: trimmedEndpoint,
        reason,
        localStateStorageKey
      });
    }
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

  // Online: process pending FIFO outbox immediately in the background
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
  resolveEndpoint?: () => string;
  onSynced?: (detail: { flushedCount: number; remainingCount: number }) => void;
  onStatusChange?: (status: { online: boolean; pendingCount: number }) => void;
}): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    notifyServiceWorkerToSync({ type: 'FLUSH_GYM_STATE_SYNC' });
    flushIndexedDbSyncOutbox({ resolveEndpoint: callbacks?.resolveEndpoint })
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
