import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export const GYM_IDB_NAME = 'budget_gym_offline_db';
export const GYM_IDB_VERSION = 1;
export const GYM_STATE_STORE = 'gym_state';
export const SYNC_OUTBOX_STORE = 'sync_outbox';
export const DEFAULT_GYM_STATE_RECORD_KEY = 'active_gym_state';

export interface GymStateIndexedDbRecord {
  key: string;
  gymState: Record<string, any>;
  lastUpdated: string;
  savedAtMs: number;
}

export interface SyncOutboxRecord {
  id: string;
  endpoint: string;
  payloadJson: string;
  reason: string;
  queuedAt: string;
  lastUpdated: string;
}

interface BudgetGymDbSchema extends DBSchema {
  gym_state: {
    key: string;
    value: GymStateIndexedDbRecord;
  };
  sync_outbox: {
    key: string;
    value: SyncOutboxRecord;
  };
}

export interface IndexedDbMemoryFallback {
  gymStateRecords: Map<string, GymStateIndexedDbRecord>;
  syncOutboxRecords: Map<string, SyncOutboxRecord>;
}

const memoryFallback: IndexedDbMemoryFallback = {
  gymStateRecords: new Map(),
  syncOutboxRecords: new Map()
};

let dbPromise: Promise<IDBPDatabase<BudgetGymDbSchema>> | null = null;

function canUseBrowserIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
}

export async function getGymIndexedDb(): Promise<IDBPDatabase<BudgetGymDbSchema> | null> {
  if (!canUseBrowserIndexedDB()) {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<BudgetGymDbSchema>(GYM_IDB_NAME, GYM_IDB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(GYM_STATE_STORE)) {
          db.createObjectStore(GYM_STATE_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(SYNC_OUTBOX_STORE)) {
          db.createObjectStore(SYNC_OUTBOX_STORE, { keyPath: 'id' });
        }
      }
    }).catch(() => {
      dbPromise = null;
      return null as any;
    });
  }
  try {
    return await dbPromise;
  } catch {
    return null;
  }
}

export function cloneCleanGymStateForIdb(stateObj: Record<string, any>): Record<string, any> {
  try {
    const clean = JSON.parse(JSON.stringify(stateObj || {}));
    if (clean && typeof clean === 'object' && 'fullStateUndoBackup' in clean) {
      delete clean.fullStateUndoBackup;
    }
    return clean;
  } catch {
    return { ...(stateObj || {}) };
  }
}

export async function saveGymStateToIndexedDB(
  stateObj: Record<string, any>,
  recordKey: string = DEFAULT_GYM_STATE_RECORD_KEY
): Promise<GymStateIndexedDbRecord> {
  const cleanState = cloneCleanGymStateForIdb(stateObj);
  const nowIso =
    typeof cleanState.last_updated === 'string' && cleanState.last_updated.trim()
      ? cleanState.last_updated
      : new Date().toISOString();
  cleanState.last_updated = nowIso;

  const record: GymStateIndexedDbRecord = {
    key: recordKey,
    gymState: cleanState,
    lastUpdated: nowIso,
    savedAtMs: Date.now()
  };

  memoryFallback.gymStateRecords.set(recordKey, record);

  const db = await getGymIndexedDb();
  if (db) {
    try {
      await db.put(GYM_STATE_STORE, record);
    } catch {
      // Fallback map already holds latest state safely
    }
  }
  return record;
}

export async function loadGymStateFromIndexedDB(
  recordKey: string = DEFAULT_GYM_STATE_RECORD_KEY
): Promise<GymStateIndexedDbRecord | null> {
  const db = await getGymIndexedDb();
  if (db) {
    try {
      const stored = await db.get(GYM_STATE_STORE, recordKey);
      if (stored && stored.gymState && typeof stored.gymState === 'object') {
        memoryFallback.gymStateRecords.set(recordKey, stored);
        return stored;
      }
    } catch {
      // Fall through to memory fallback
    }
  }
  return memoryFallback.gymStateRecords.get(recordKey) || null;
}

export async function enqueueIndexedDbSyncItem(item: {
  endpoint: string;
  payloadJson: string;
  reason?: string;
  lastUpdated?: string;
}): Promise<SyncOutboxRecord> {
  const endpoint = String(item.endpoint || '').trim();
  const nowIso = new Date().toISOString();
  const record: SyncOutboxRecord = {
    id: `outbox:${endpoint || 'default'}`,
    endpoint,
    payloadJson: String(item.payloadJson || '{}'),
    reason: String(item.reason || 'local_write'),
    queuedAt: nowIso,
    lastUpdated: String(item.lastUpdated || nowIso)
  };

  memoryFallback.syncOutboxRecords.set(record.id, record);

  const db = await getGymIndexedDb();
  if (db) {
    try {
      await db.put(SYNC_OUTBOX_STORE, record);
    } catch {
      // Memory fallback already updated
    }
  }
  return record;
}

export async function getPendingIndexedDbSyncItems(): Promise<SyncOutboxRecord[]> {
  const db = await getGymIndexedDb();
  if (db) {
    try {
      const items = await db.getAll(SYNC_OUTBOX_STORE);
      return Array.isArray(items) ? items : [];
    } catch {
      // Fall through to memory fallback
    }
  }
  return Array.from(memoryFallback.syncOutboxRecords.values());
}

export async function removeIndexedDbSyncItem(id: string): Promise<void> {
  memoryFallback.syncOutboxRecords.delete(id);
  const db = await getGymIndexedDb();
  if (db) {
    try {
      await db.delete(SYNC_OUTBOX_STORE, id);
    } catch {
      // Ignore storage errors
    }
  }
}

export async function clearIndexedDbSyncOutbox(): Promise<void> {
  memoryFallback.syncOutboxRecords.clear();
  const db = await getGymIndexedDb();
  if (db) {
    try {
      await db.clear(SYNC_OUTBOX_STORE);
    } catch {
      // Ignore storage errors
    }
  }
}

export async function clearAllGymIndexedDbStores(): Promise<void> {
  memoryFallback.gymStateRecords.clear();
  memoryFallback.syncOutboxRecords.clear();
  const db = await getGymIndexedDb();
  if (db) {
    try {
      await db.clear(GYM_STATE_STORE);
      await db.clear(SYNC_OUTBOX_STORE);
    } catch {
      // Ignore storage errors
    }
  }
}
