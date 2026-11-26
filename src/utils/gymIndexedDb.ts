import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export const GYM_IDB_NAME = 'budget_gym_offline_db';
export const GYM_IDB_VERSION = 1;
export const GYM_STATE_STORE = 'gym_state';
export const SYNC_OUTBOX_STORE = 'sync_outbox';
export const DEFAULT_GYM_STATE_RECORD_KEY = 'active_gym_state';

export type SyncOutboxStatus = 'pending';

export interface GymStateIndexedDbRecord {
  key: string;
  gymState: Record<string, any>;
  lastUpdated: string;
  savedAtMs: number;
}

export interface SyncOutboxRecord {
  id: string;
  seq: number;
  createdAtMs: number;
  status: SyncOutboxStatus;
  actionType: string;
  setKey?: string | null;
  exerciseId?: string | null;
  endpoint: string;
  payloadJson: string;
  reason: string;
  queuedAt: string;
  lastUpdated: string;
  attempts: number;
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
let monotonicOutboxSeq = 0;

function allocateNextOutboxSeq(): number {
  monotonicOutboxSeq += 1;
  return monotonicOutboxSeq;
}

function normalizeOutboxRecord(raw: Partial<SyncOutboxRecord> & { id?: string }): SyncOutboxRecord {
  const createdAtMs =
    typeof raw.createdAtMs === 'number' && Number.isFinite(raw.createdAtMs)
      ? raw.createdAtMs
      : Date.parse(String(raw.queuedAt || raw.lastUpdated || '')) || Date.now();
  const seq =
    typeof raw.seq === 'number' && Number.isFinite(raw.seq) ? raw.seq : 0;
  const nowIso = new Date(createdAtMs).toISOString();
  return {
    id: String(raw.id || `fifo_${createdAtMs}_${allocateNextOutboxSeq()}`),
    seq,
    createdAtMs,
    status: 'pending',
    actionType: String(raw.actionType || raw.reason || 'set_logged'),
    setKey: raw.setKey ?? null,
    exerciseId: raw.exerciseId ?? null,
    endpoint: String(raw.endpoint || '').trim(),
    payloadJson: String(raw.payloadJson || '{}'),
    reason: String(raw.reason || raw.actionType || 'local_write'),
    queuedAt: String(raw.queuedAt || nowIso),
    lastUpdated: String(raw.lastUpdated || raw.queuedAt || nowIso),
    attempts: typeof raw.attempts === 'number' && Number.isFinite(raw.attempts) ? raw.attempts : 0
  };
}

export function sortSyncOutboxRecordsFifo<
  T extends { createdAtMs?: number; seq?: number; queuedAt?: string; id?: string }
>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    const aMs =
      typeof a.createdAtMs === 'number' && Number.isFinite(a.createdAtMs)
        ? a.createdAtMs
        : Date.parse(String(a.queuedAt || '')) || 0;
    const bMs =
      typeof b.createdAtMs === 'number' && Number.isFinite(b.createdAtMs)
        ? b.createdAtMs
        : Date.parse(String(b.queuedAt || '')) || 0;
    if (aMs !== bMs) return aMs - bMs;

    const aSeq = typeof a.seq === 'number' && Number.isFinite(a.seq) ? a.seq : 0;
    const bSeq = typeof b.seq === 'number' && Number.isFinite(b.seq) ? b.seq : 0;
    if (aSeq !== bSeq) return aSeq - bSeq;

    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

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

/**
 * Appends a unique pending FIFO record into the IndexedDB `sync_outbox` object store.
 */
export async function enqueueIndexedDbSyncItem(item: {
  id?: string;
  endpoint: string;
  payloadJson: string;
  reason?: string;
  actionType?: string;
  setKey?: string | null;
  exerciseId?: string | null;
  lastUpdated?: string;
  queuedAt?: string;
  createdAtMs?: number;
  seq?: number;
  status?: SyncOutboxStatus;
  attempts?: number;
}): Promise<SyncOutboxRecord> {
  const endpoint = String(item.endpoint || '').trim();
  const createdAtMs =
    typeof item.createdAtMs === 'number' && Number.isFinite(item.createdAtMs)
      ? item.createdAtMs
      : Date.now();
  const seq =
    typeof item.seq === 'number' && Number.isFinite(item.seq)
      ? item.seq
      : allocateNextOutboxSeq();
  const nowIso = item.queuedAt || new Date(createdAtMs).toISOString();
  const id =
    item.id && String(item.id).trim()
      ? String(item.id).trim()
      : `fifo_${createdAtMs}_${seq}_${Math.random().toString(36).slice(2, 7)}`;

  const record: SyncOutboxRecord = {
    id,
    seq,
    createdAtMs,
    status: 'pending',
    actionType: String(item.actionType || item.reason || 'set_logged'),
    setKey: item.setKey ?? null,
    exerciseId: item.exerciseId ?? null,
    endpoint,
    payloadJson: String(item.payloadJson || '{}'),
    reason: String(item.reason || item.actionType || 'local_write'),
    queuedAt: nowIso,
    lastUpdated: String(item.lastUpdated || nowIso),
    attempts: typeof item.attempts === 'number' && Number.isFinite(item.attempts) ? item.attempts : 0
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

export async function updateIndexedDbSyncItem(
  record: SyncOutboxRecord
): Promise<SyncOutboxRecord> {
  const normalized = normalizeOutboxRecord(record);
  memoryFallback.syncOutboxRecords.set(normalized.id, normalized);

  const db = await getGymIndexedDb();
  if (db) {
    try {
      await db.put(SYNC_OUTBOX_STORE, normalized);
    } catch {
      // Memory fallback already updated
    }
  }
  return normalized;
}

/**
 * Reads all pending records from IndexedDB `sync_outbox` in strict FIFO order.
 */
export async function getPendingIndexedDbSyncItems(): Promise<SyncOutboxRecord[]> {
  let rawItems: SyncOutboxRecord[] = [];
  const db = await getGymIndexedDb();
  if (db) {
    try {
      const items = await db.getAll(SYNC_OUTBOX_STORE);
      rawItems = Array.isArray(items) ? items : [];
    } catch {
      rawItems = Array.from(memoryFallback.syncOutboxRecords.values());
    }
  } else {
    rawItems = Array.from(memoryFallback.syncOutboxRecords.values());
  }

  const pendingOnly = rawItems
    .filter((entry) => entry && (!entry.status || entry.status === 'pending'))
    .map((entry) => normalizeOutboxRecord(entry));

  return sortSyncOutboxRecordsFifo(pendingOnly);
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
