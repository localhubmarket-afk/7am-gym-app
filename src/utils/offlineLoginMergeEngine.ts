import {
  clearIndexedDbSyncOutbox,
  enqueueIndexedDbSyncItem,
  getPendingIndexedDbSyncItems,
  removeIndexedDbSyncItem,
  saveGymStateToIndexedDB,
  sortSyncOutboxRecordsFifo,
  updateIndexedDbSyncItem,
  type SyncOutboxRecord,
  type SyncOutboxStatus
} from './gymIndexedDb';
import { notifyServiceWorkerToSync } from './offlineFirstSync';
import { isNetworkOnline, type StorageAdapter } from './offlineSyncQueue';
import { serializeStateForPersistence } from './workoutLogic';
import {
  getStateLastUpdatedIso,
  parseTimestampMs,
  stampGymStateLastUpdated
} from './workoutSyncEngine';

export const SYNC_OUTBOX_STORAGE_KEY = 'sync_outbox';
export const CONFLICT_BACKUP_SNAPSHOT_KEY = 'budget_gym_conflict_backup_snapshot_v1';
export const SYNC_CONFLICT_MODAL_QUESTION =
  "We found unsynced workouts on this device. Do you want to keep your phone's data or download your cloud backup?";

export interface SyncOutboxActionItem {
  id: string;
  seq: number;
  createdAtMs: number;
  status: SyncOutboxStatus;
  actionType: string;
  setKey?: string | null;
  exerciseId?: string | null;
  endpoint: string;
  payloadJson: string;
  updatedAt: string;
  queuedAt: string;
  attempts: number;
}

export interface CompletedSetInventory {
  totalCount: number;
  fingerprints: Record<string, string>;
}

export type PreLoginSyncDecision =
  | 'local_wins'
  | 'cloud_wins'
  | 'conflict_prompt'
  | 'equal';

export interface PreLoginMergeEvaluation {
  decision: PreLoginSyncDecision;
  reason: string;
  question: string | null;
  localCompletedCount: number;
  cloudCompletedCount: number;
  uniqueLocalSetKeys: string[];
  uniqueCloudSetKeys: string[];
  localUpdatedAt: string | null;
  cloudUpdatedAt: string | null;
  localUpdatedAtMs: number;
  cloudUpdatedAtMs: number;
}

export interface ConflictBackupSnapshot {
  savedAt: string;
  source: 'cloud_before_local_overwrite' | 'local_before_cloud_download';
  accountEmail: string | null;
  completedSetsCount: number;
  gymState: Record<string, any>;
}

export interface AuthenticatedIdentityInput {
  email?: string | null;
  name?: string | null;
  supabaseUserId?: string | null;
  avatarUrl?: string | null;
  authProvider?: string | null;
  phone?: string | null;
}

export interface FlushSyncOutboxResult {
  online: boolean;
  attempted: number;
  flushedCount: number;
  remainingCount: number;
  syncedAtIso: string | null;
  lastError: string | null;
  stoppedOnError: boolean;
}

let activeOutboxFlushLock: Promise<FlushSyncOutboxResult> | null = null;
let outboxActionSeq = 0;

function allocateActionSeq(): number {
  outboxActionSeq += 1;
  return outboxActionSeq;
}

function getDefaultStorage(): StorageAdapter | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Restricted storage environment
  }
  return null;
}

/**
 * Normalizes legacy Week 1 keys (`0_ex_1`) and week-prefixed keys (`w1_0_ex_1`)
 * so identical sets aren't double-counted during conflict detection.
 */
function normalizeWorkoutLogKey(rawKey: string): string {
  const trimmed = String(rawKey || '').trim();
  if (!trimmed) return '';
  if (/^w\d+_/i.test(trimmed)) return trimmed;
  if (/^\d+_/.test(trimmed)) return `w1_${trimmed}`;
  return trimmed;
}

function normalizePullupLogKey(rawKey: string): string {
  const trimmed = String(rawKey || '').trim();
  if (!trimmed) return '';
  if (/^w\d+_/i.test(trimmed)) return `pullup:${trimmed}`;
  if (/^day_/i.test(trimmed)) return `pullup:w1_${trimmed}`;
  return `pullup:${trimmed}`;
}

/**
 * Extracts a canonical completed-set inventory across workoutLogs, pullupLogs, and cardioLogs.
 */
export function extractCompletedSetFingerprints(
  stateObj: Record<string, any> | null | undefined
): CompletedSetInventory {
  const fingerprints: Record<string, string> = {};
  if (!stateObj || typeof stateObj !== 'object') {
    return { totalCount: 0, fingerprints };
  }

  const workoutLogs = stateObj.workoutLogs;
  if (workoutLogs && typeof workoutLogs === 'object') {
    for (const rawKey of Object.keys(workoutLogs)) {
      const entry = workoutLogs[rawKey];
      if (!entry || typeof entry !== 'object') continue;
      if (entry.done === true || entry.isLogged === true) {
        const canonicalKey = normalizeWorkoutLogKey(rawKey);
        if (!canonicalKey) continue;
        const w = String(entry.weight ?? '').trim();
        const r = String(entry.reps ?? '').trim();
        const u = String(entry.unit ?? 'lbs').trim().toLowerCase();
        fingerprints[`w:${canonicalKey}`] = `${w}|${r}|${u}|done`;
      }
    }
  }

  const pullupLogs = stateObj.pullupLogs;
  if (pullupLogs && typeof pullupLogs === 'object') {
    for (const rawKey of Object.keys(pullupLogs)) {
      const entry = pullupLogs[rawKey];
      if (!entry || typeof entry !== 'object') continue;
      if (entry.done === true || entry.isLogged === true) {
        const canonicalKey = normalizePullupLogKey(rawKey);
        if (!canonicalKey) continue;
        const r = String(entry.reps ?? '').trim();
        fingerprints[`p:${canonicalKey}`] = `${r}|done`;
      }
    }
  }

  const cardioLogs = stateObj.cardioLogs;
  if (cardioLogs && typeof cardioLogs === 'object') {
    for (const rawKey of Object.keys(cardioLogs)) {
      const entry = cardioLogs[rawKey];
      if (!entry || typeof entry !== 'object') continue;
      if (entry.done === true) {
        const dur = String(entry.durationMin ?? entry.elapsedSec ?? '').trim();
        const dist = String(entry.distance ?? '').trim();
        fingerprints[`c:${rawKey}`] = `${dur}|${dist}|done`;
      }
    }
  }

  return {
    totalCount: Object.keys(fingerprints).length,
    fingerprints
  };
}

/**
 * Step 2 & Step 4: Pre-Login Offline-First Conflict & Merge Evaluator.
 * - Blank cloud + populated local => Local Wins (seed cloud with local Guest data)
 * - Blank local + populated cloud => Cloud Wins (safe hydration)
 * - Both sides hold different completed sets => Conflict Prompt (pause & ask user)
 * - Strict superset on one side => Superset wins automatically
 * - Identical completed sets => Newer `updatedAt` wins
 */
export function evaluatePreLoginSyncStrategy(options: {
  localState: Record<string, any> | null | undefined;
  cloudState: Record<string, any> | null | undefined;
  cloudUpdatedAt?: string | null;
  hasPendingOutboxItems?: boolean;
}): PreLoginMergeEvaluation {
  const localInv = extractCompletedSetFingerprints(options.localState);
  const cloudInv = extractCompletedSetFingerprints(options.cloudState);

  const localUpdatedAt = getStateLastUpdatedIso(options.localState);
  const localUpdatedAtMs = parseTimestampMs(localUpdatedAt);

  const cloudStateIso = getStateLastUpdatedIso(options.cloudState);
  const explicitCloudIso =
    typeof options.cloudUpdatedAt === 'string' && options.cloudUpdatedAt.trim()
      ? options.cloudUpdatedAt.trim()
      : null;
  const explicitCloudMs = parseTimestampMs(explicitCloudIso);
  const cloudStateMs = parseTimestampMs(cloudStateIso);
  const cloudUpdatedAtMs = Math.max(explicitCloudMs, cloudStateMs);
  const cloudUpdatedAt =
    explicitCloudMs >= cloudStateMs
      ? explicitCloudIso || cloudStateIso
      : cloudStateIso || explicitCloudIso;

  const uniqueLocalSetKeys: string[] = [];
  const uniqueCloudSetKeys: string[] = [];

  for (const key of Object.keys(localInv.fingerprints)) {
    if (cloudInv.fingerprints[key] !== localInv.fingerprints[key]) {
      uniqueLocalSetKeys.push(key);
    }
  }
  for (const key of Object.keys(cloudInv.fingerprints)) {
    if (localInv.fingerprints[key] !== cloudInv.fingerprints[key]) {
      uniqueCloudSetKeys.push(key);
    }
  }

  const baseMeta = {
    localCompletedCount: localInv.totalCount,
    cloudCompletedCount: cloudInv.totalCount,
    uniqueLocalSetKeys,
    uniqueCloudSetKeys,
    localUpdatedAt,
    cloudUpdatedAt,
    localUpdatedAtMs,
    cloudUpdatedAtMs
  };

  if (!options.cloudState || typeof options.cloudState !== 'object') {
    if (localInv.totalCount > 0 || options.hasPendingOutboxItems || localUpdatedAtMs > 0) {
      return {
        ...baseMeta,
        decision: 'local_wins',
        reason: 'cloud_missing_seed_from_local',
        question: null
      };
    }
    return {
      ...baseMeta,
      decision: 'equal',
      reason: 'both_empty',
      question: null
    };
  }

  if (localInv.totalCount > 0 && cloudInv.totalCount === 0) {
    return {
      ...baseMeta,
      decision: 'local_wins',
      reason: 'cloud_empty_local_has_workouts',
      question: null
    };
  }

  if (localInv.totalCount === 0 && cloudInv.totalCount > 0) {
    return {
      ...baseMeta,
      decision: 'cloud_wins',
      reason: 'local_empty_cloud_has_workouts',
      question: null
    };
  }

  if (uniqueLocalSetKeys.length > 0 && uniqueCloudSetKeys.length > 0) {
    return {
      ...baseMeta,
      decision: 'conflict_prompt',
      reason: 'both_sides_have_different_completed_sets',
      question: SYNC_CONFLICT_MODAL_QUESTION
    };
  }

  if (uniqueLocalSetKeys.length > 0 && uniqueCloudSetKeys.length === 0) {
    return {
      ...baseMeta,
      decision: 'local_wins',
      reason: 'local_has_unsynced_completed_sets',
      question: null
    };
  }

  if (uniqueCloudSetKeys.length > 0 && uniqueLocalSetKeys.length === 0) {
    return {
      ...baseMeta,
      decision: 'cloud_wins',
      reason: 'cloud_has_newer_completed_sets',
      question: null
    };
  }

  if (
    localUpdatedAtMs > cloudUpdatedAtMs ||
    (options.hasPendingOutboxItems && localUpdatedAtMs >= cloudUpdatedAtMs)
  ) {
    return {
      ...baseMeta,
      decision: 'local_wins',
      reason: 'local_timestamp_newer',
      question: null
    };
  }

  if (cloudUpdatedAtMs > localUpdatedAtMs) {
    return {
      ...baseMeta,
      decision: 'cloud_wins',
      reason: 'cloud_timestamp_newer',
      question: null
    };
  }

  return {
    ...baseMeta,
    decision: 'equal',
    reason: 'already_in_sync',
    question: null
  };
}

/**
 * Step 2: Builds the "Local Wins" merged state by preserving 100% of local workouts
 * and attaching the newly authenticated Supabase account profile cleanly.
 */
export function buildLocalWinsMergedState<T extends Record<string, any>>(
  localState: T,
  identity: AuthenticatedIdentityInput,
  nowIso: string = new Date().toISOString()
): T {
  const cloned = JSON.parse(JSON.stringify(localState || {})) as T;
  const cleanEmail = String(identity.email || '').trim().toLowerCase();
  const cleanName = String(identity.name || '').trim();
  const existingProfile =
    cloned.userProfile && typeof cloned.userProfile === 'object' ? cloned.userProfile : {};

  const mergedProfile = {
    ...existingProfile,
    email: cleanEmail || existingProfile.email || '',
    name: cleanName || existingProfile.name || '',
    supabaseUserId: identity.supabaseUserId || existingProfile.supabaseUserId || undefined,
    avatarUrl: identity.avatarUrl || existingProfile.avatarUrl || undefined,
    authProvider: identity.authProvider || existingProfile.authProvider || 'magic_link',
    phone: identity.phone || existingProfile.phone || '',
    oauthVerified: true,
    isGuest: false,
    signedInAt: nowIso
  };

  (cloned as any).userProfile = mergedProfile;
  (cloned as any).isGuestMode = false;
  (cloned as any).onboardingComplete = true;
  (cloned as any).userHasCompletedOnboarding = true;
  (cloned as any).hasCompletedFirstSetup = true;

  if (cleanEmail) {
    const accounts =
      cloned.accountsByEmail && typeof cloned.accountsByEmail === 'object'
        ? { ...cloned.accountsByEmail }
        : {};
    accounts[cleanEmail] = {
      ...(accounts[cleanEmail] || {}),
      email: cleanEmail,
      name: mergedProfile.name,
      authProvider: mergedProfile.authProvider,
      lastSignedInAt: nowIso
    };
    (cloned as any).accountsByEmail = accounts;
  }

  stampGymStateLastUpdated(cloned, nowIso);
  return cloned;
}

/**
 * Step 4 (Confirmed Preference): Saves a timestamped local backup snapshot before
 * overwriting cloud data (or before replacing local phone data with a cloud backup).
 */
export function saveConflictBackupSnapshot(options: {
  source: ConflictBackupSnapshot['source'];
  gymState: Record<string, any> | null | undefined;
  accountEmail?: string | null;
  storage?: StorageAdapter | null;
  nowIso?: string;
}): ConflictBackupSnapshot | null {
  if (!options.gymState || typeof options.gymState !== 'object') return null;
  const store = options.storage ?? getDefaultStorage();
  const cleanClone = JSON.parse(JSON.stringify(options.gymState));
  if (cleanClone && typeof cleanClone === 'object' && 'fullStateUndoBackup' in cleanClone) {
    delete cleanClone.fullStateUndoBackup;
  }
  const inv = extractCompletedSetFingerprints(cleanClone);
  const snapshot: ConflictBackupSnapshot = {
    savedAt: options.nowIso || new Date().toISOString(),
    source: options.source,
    accountEmail: options.accountEmail ? String(options.accountEmail).trim().toLowerCase() : null,
    completedSetsCount: inv.totalCount,
    gymState: cleanClone
  };

  if (store) {
    try {
      store.setItem(CONFLICT_BACKUP_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
      // Best-effort under storage quota limits
    }
  }
  return snapshot;
}

export function loadConflictBackupSnapshot(
  storage?: StorageAdapter | null
): ConflictBackupSnapshot | null {
  const store = storage ?? getDefaultStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(CONFLICT_BACKUP_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.gymState) {
      return parsed as ConflictBackupSnapshot;
    }
  } catch {
    // Corrupted or unavailable storage
  }
  return null;
}

function normalizeActionItem(raw: Partial<SyncOutboxActionItem>): SyncOutboxActionItem {
  const createdAtMs =
    typeof raw.createdAtMs === 'number' && Number.isFinite(raw.createdAtMs)
      ? raw.createdAtMs
      : Date.parse(String(raw.queuedAt || raw.updatedAt || '')) || Date.now();
  const seq = typeof raw.seq === 'number' && Number.isFinite(raw.seq) ? raw.seq : 0;
  const fallbackIso = new Date(createdAtMs).toISOString();
  return {
    id: String(raw.id || `fifo_${createdAtMs}_${allocateActionSeq()}`),
    seq,
    createdAtMs,
    status: 'pending',
    actionType: String(raw.actionType || 'set_logged'),
    setKey: raw.setKey ?? null,
    exerciseId: raw.exerciseId ?? null,
    endpoint: String(raw.endpoint || '').trim(),
    payloadJson: String(raw.payloadJson || '{}'),
    updatedAt: String(raw.updatedAt || fallbackIso),
    queuedAt: String(raw.queuedAt || fallbackIso),
    attempts: typeof raw.attempts === 'number' && Number.isFinite(raw.attempts) ? raw.attempts : 0
  };
}

/**
 * Step 3: `sync_outbox` Queue Helpers (IndexedDB `sync_outbox` + localStorage `sync_outbox` mirror)
 */
export function readSyncOutbox(storage?: StorageAdapter | null): SyncOutboxActionItem[] {
  const store = storage ?? getDefaultStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(SYNC_OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const pending = parsed
      .filter((entry) => entry && (!entry.status || entry.status === 'pending'))
      .map((entry) => normalizeActionItem(entry));
    return sortSyncOutboxRecordsFifo(pending);
  } catch {
    return [];
  }
}

export function writeSyncOutbox(
  items: SyncOutboxActionItem[],
  storage?: StorageAdapter | null
): void {
  const store = storage ?? getDefaultStorage();
  if (!store) return;
  try {
    if (!items || items.length === 0) {
      if (typeof store.removeItem === 'function') {
        store.removeItem(SYNC_OUTBOX_STORAGE_KEY);
      } else {
        store.setItem(SYNC_OUTBOX_STORAGE_KEY, '[]');
      }
      return;
    }
    const ordered = sortSyncOutboxRecordsFifo(items).slice(-200);
    store.setItem(SYNC_OUTBOX_STORAGE_KEY, JSON.stringify(ordered));
  } catch {
    // Ignore storage quota errors
  }
}

export async function clearSyncOutbox(storage?: StorageAdapter | null): Promise<void> {
  writeSyncOutbox([], storage);
  try {
    await clearIndexedDbSyncOutbox();
  } catch {
    // IndexedDB may be unavailable in restricted contexts
  }
}

/**
 * Dual-Write Logging Action:
 * Simultaneously updates the local `gym_state` database (localStorage + IndexedDB)
 * AND inserts a distinct pending FIFO record (`status: 'pending'`) into `sync_outbox`.
 */
export async function enqueueSyncOutboxAction(options: {
  stateObj: Record<string, any>;
  actionType: string;
  endpoint?: string | null;
  setKey?: string | null;
  exerciseId?: string | null;
  localStateStorageKey?: string | null;
  storage?: StorageAdapter | null;
  nowIso?: string;
  createdAtMs?: number;
}): Promise<{
  item: SyncOutboxActionItem;
  queueLength: number;
  savedLocally: boolean;
}> {
  const store = options.storage ?? getDefaultStorage();
  const createdAtMs =
    typeof options.createdAtMs === 'number' && Number.isFinite(options.createdAtMs)
      ? options.createdAtMs
      : options.nowIso
        ? Date.parse(options.nowIso) || Date.now()
        : Date.now();
  const nowIso = options.nowIso || new Date(createdAtMs).toISOString();
  const stamped = stampGymStateLastUpdated({ ...(options.stateObj || {}) }, nowIso);
  const payloadJson = serializeStateForPersistence(stamped);

  // Action 1: Immediately persist local gym_state to localStorage + IndexedDB
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
  const seq = allocateActionSeq();
  const sharedId = `fifo_${createdAtMs}_${seq}_${Math.random().toString(36).slice(2, 7)}`;

  const item: SyncOutboxActionItem = {
    id: sharedId,
    seq,
    createdAtMs,
    status: 'pending',
    actionType: String(options.actionType || 'set_logged'),
    setKey: options.setKey || null,
    exerciseId: options.exerciseId || null,
    endpoint,
    payloadJson,
    updatedAt: nowIso,
    queuedAt: nowIso,
    attempts: 0
  };

  // Action 2: Append FIFO pending record to localStorage sync_outbox mirror & IndexedDB sync_outbox simultaneously
  const currentQueue = readSyncOutbox(store);
  const nextQueue = sortSyncOutboxRecordsFifo([...currentQueue, item]);
  writeSyncOutbox(nextQueue, store);

  let idbRecord: SyncOutboxRecord | null = null;
  const [gymStateRes, idbOutboxRes] = await Promise.allSettled([
    saveGymStateToIndexedDB(stamped),
    enqueueIndexedDbSyncItem({
      id: sharedId,
      seq,
      createdAtMs,
      status: 'pending',
      actionType: item.actionType,
      setKey: item.setKey,
      exerciseId: item.exerciseId,
      endpoint: endpoint || 'pending_endpoint',
      payloadJson,
      reason: item.actionType,
      queuedAt: nowIso,
      lastUpdated: nowIso,
      attempts: 0
    })
  ]);

  if (gymStateRes.status === 'fulfilled') {
    savedLocally = true;
  }
  if (idbOutboxRes.status === 'fulfilled') {
    idbRecord = idbOutboxRes.value;
  }

  // Register Service Worker Background Sync when offline so browser wakes up on reconnect
  if (!isNetworkOnline() && idbRecord) {
    notifyServiceWorkerToSync({ type: 'QUEUE_GYM_STATE_SYNC', item: idbRecord });
  }

  return {
    item,
    queueLength: nextQueue.length,
    savedLocally
  };
}

function buildMergedFifoQueue(
  lsQueue: SyncOutboxActionItem[],
  idbQueue: SyncOutboxRecord[]
): SyncOutboxActionItem[] {
  const byId = new Map<string, SyncOutboxActionItem>();

  for (const idbItem of idbQueue) {
    if (!idbItem || (idbItem.status && idbItem.status !== 'pending')) continue;
    byId.set(
      idbItem.id,
      normalizeActionItem({
        id: idbItem.id,
        seq: idbItem.seq,
        createdAtMs: idbItem.createdAtMs,
        status: 'pending',
        actionType: idbItem.actionType || idbItem.reason,
        setKey: idbItem.setKey ?? null,
        exerciseId: idbItem.exerciseId ?? null,
        endpoint: idbItem.endpoint === 'pending_endpoint' ? '' : idbItem.endpoint,
        payloadJson: idbItem.payloadJson,
        updatedAt: idbItem.lastUpdated,
        queuedAt: idbItem.queuedAt,
        attempts: idbItem.attempts
      })
    );
  }

  for (const lsItem of lsQueue) {
    if (!lsItem || (lsItem.status && lsItem.status !== 'pending')) continue;
    if (!byId.has(lsItem.id)) {
      byId.set(lsItem.id, normalizeActionItem(lsItem));
    }
  }

  return sortSyncOutboxRecordsFifo(Array.from(byId.values()));
}

async function executeFifoFlushToSupabase(options?: {
  resolveEndpoint?: () => string;
  getLatestLocalState?: () => Record<string, any> | null;
  storage?: StorageAdapter | null;
  fetchImpl?: typeof fetch;
  navigatorLike?: { onLine?: boolean } | null;
}): Promise<FlushSyncOutboxResult> {
  const store = options?.storage ?? getDefaultStorage();
  const online = isNetworkOnline(options?.navigatorLike);
  const lsQueue = readSyncOutbox(store);
  let idbQueue: SyncOutboxRecord[] = [];
  try {
    idbQueue = await getPendingIndexedDbSyncItems();
  } catch {
    idbQueue = [];
  }

  const mergedQueue = buildMergedFifoQueue(lsQueue, idbQueue);
  if (!online) {
    return {
      online: false,
      attempted: 0,
      flushedCount: 0,
      remainingCount: mergedQueue.length,
      syncedAtIso: null,
      lastError: 'Device is offline.',
      stoppedOnError: false
    };
  }

  if (mergedQueue.length === 0) {
    return {
      online: true,
      attempted: 0,
      flushedCount: 0,
      remainingCount: 0,
      syncedAtIso: null,
      lastError: null,
      stoppedOnError: false
    };
  }

  const fetchFn =
    options?.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!fetchFn) {
    return {
      online: true,
      attempted: 0,
      flushedCount: 0,
      remainingCount: mergedQueue.length,
      syncedAtIso: null,
      lastError: 'Fetch unavailable.',
      stoppedOnError: false
    };
  }

  const dynamicEndpoint = String(options?.resolveEndpoint?.() || '').trim();
  const remainingQueue = [...mergedQueue];
  let attempted = 0;
  let flushedCount = 0;
  let syncedAtIso: string | null = null;
  let lastError: string | null = null;
  let stoppedOnError = false;

  // Strict FIFO processing: send pending items in First-In, First-Out order.
  // - On Supabase upload success: delete that exact item from IndexedDB & localStorage sync_outbox.
  // - On upload failure: keep the item in sync_outbox with status='pending' and STOP immediately
  //   so subsequent items never overtake an earlier failed write.
  while (remainingQueue.length > 0) {
    const item = remainingQueue[0];
    const itemEndpoint =
      item.endpoint && item.endpoint !== 'pending_endpoint' ? item.endpoint : '';
    const targetEndpoint = dynamicEndpoint || itemEndpoint;

    if (!targetEndpoint) {
      lastError = 'Waiting for cloud endpoint.';
      stoppedOnError = true;
      break;
    }

    const payloadToSend = item.payloadJson;
    if (!payloadToSend) {
      remainingQueue.shift();
      writeSyncOutbox(remainingQueue, store);
      await removeIndexedDbSyncItem(item.id).catch(() => {});
      continue;
    }

    attempted += 1;
    try {
      const isApi = targetEndpoint.includes('/api/state');
      const isFirebase =
        targetEndpoint.includes('firebaseio.com') || targetEndpoint.endsWith('.json');
      const res = await fetchFn(targetEndpoint, {
        method: isFirebase ? 'PUT' : 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': isApi ? 'application/json' : 'text/plain;charset=utf-8'
        },
        body: payloadToSend
      });

      if (!res || !res.ok) {
        const failedItem: SyncOutboxActionItem = {
          ...item,
          status: 'pending',
          attempts: (item.attempts || 0) + 1
        };
        remainingQueue[0] = failedItem;
        writeSyncOutbox(remainingQueue, store);
        await updateIndexedDbSyncItem({
          id: failedItem.id,
          seq: failedItem.seq,
          createdAtMs: failedItem.createdAtMs,
          status: 'pending',
          actionType: failedItem.actionType,
          setKey: failedItem.setKey,
          exerciseId: failedItem.exerciseId,
          endpoint: failedItem.endpoint || 'pending_endpoint',
          payloadJson: failedItem.payloadJson,
          reason: failedItem.actionType,
          queuedAt: failedItem.queuedAt,
          lastUpdated: failedItem.updatedAt,
          attempts: failedItem.attempts
        }).catch(() => {});
        lastError = `HTTP ${res ? res.status : 'error'}`;
        stoppedOnError = true;
        break;
      }

      const json =
        typeof (res as any).json === 'function'
          ? await (res as any).json().catch(() => ({}))
          : {};
      if (json && (json.configured === false || json.saved === false)) {
        const failedItem: SyncOutboxActionItem = {
          ...item,
          status: 'pending',
          attempts: (item.attempts || 0) + 1
        };
        remainingQueue[0] = failedItem;
        writeSyncOutbox(remainingQueue, store);
        await updateIndexedDbSyncItem({
          id: failedItem.id,
          seq: failedItem.seq,
          createdAtMs: failedItem.createdAtMs,
          status: 'pending',
          actionType: failedItem.actionType,
          setKey: failedItem.setKey,
          exerciseId: failedItem.exerciseId,
          endpoint: failedItem.endpoint || 'pending_endpoint',
          payloadJson: failedItem.payloadJson,
          reason: failedItem.actionType,
          queuedAt: failedItem.queuedAt,
          lastUpdated: failedItem.updatedAt,
          attempts: failedItem.attempts
        }).catch(() => {});
        lastError = 'Cloud storage not configured.';
        stoppedOnError = true;
        break;
      }

      // Upload succeeded: delete item from sync_outbox (both IndexedDB & localStorage)
      remainingQueue.shift();
      writeSyncOutbox(remainingQueue, store);
      await removeIndexedDbSyncItem(item.id).catch(() => {});

      flushedCount += 1;
      syncedAtIso =
        (json && typeof json.last_updated === 'string' && json.last_updated) ||
        (json && typeof json.updatedAt === 'string' && json.updatedAt) ||
        new Date().toISOString();
    } catch (err) {
      const failedItem: SyncOutboxActionItem = {
        ...item,
        status: 'pending',
        attempts: (item.attempts || 0) + 1
      };
      remainingQueue[0] = failedItem;
      writeSyncOutbox(remainingQueue, store);
      await updateIndexedDbSyncItem({
        id: failedItem.id,
        seq: failedItem.seq,
        createdAtMs: failedItem.createdAtMs,
        status: 'pending',
        actionType: failedItem.actionType,
        setKey: failedItem.setKey,
        exerciseId: failedItem.exerciseId,
        endpoint: failedItem.endpoint || 'pending_endpoint',
        payloadJson: failedItem.payloadJson,
        reason: failedItem.actionType,
        queuedAt: failedItem.queuedAt,
        lastUpdated: failedItem.updatedAt,
        attempts: failedItem.attempts
      }).catch(() => {});
      lastError = err instanceof Error ? err.message : 'Network error';
      stoppedOnError = true;
      break;
    }
  }

  return {
    online: true,
    attempted,
    flushedCount,
    remainingCount: remainingQueue.length,
    syncedAtIso,
    lastError,
    stoppedOnError
  };
}

/**
 * Flushes all queued changes in `sync_outbox` (IndexedDB + localStorage) to Supabase
 * in strict First-In, First-Out (FIFO) order. Stops immediately on upload failure so
 * remaining items retry in exact order on the next online event.
 */
export async function flushSyncOutboxToSupabase(options?: {
  resolveEndpoint?: () => string;
  getLatestLocalState?: () => Record<string, any> | null;
  storage?: StorageAdapter | null;
  fetchImpl?: typeof fetch;
  navigatorLike?: { onLine?: boolean } | null;
}): Promise<FlushSyncOutboxResult> {
  if (!options?.fetchImpl && activeOutboxFlushLock) {
    return activeOutboxFlushLock;
  }
  const promise = executeFifoFlushToSupabase(options);
  if (!options?.fetchImpl) {
    activeOutboxFlushLock = promise.finally(() => {
      activeOutboxFlushLock = null;
    });
    return activeOutboxFlushLock;
  }
  return promise;
}

export function formatSyncComparisonTimestamp(
  iso: string | null | undefined,
  nowMs: number = Date.now()
): string {
  const ms = parseTimestampMs(iso);
  if (!ms) return 'No timestamp saved';
  try {
    const d = new Date(ms);
    const now = new Date(nowMs);
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (sameDay) return `Today, ${timeStr}`;
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return String(iso || '');
  }
}
