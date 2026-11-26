import {
  clearIndexedDbSyncOutbox,
  enqueueIndexedDbSyncItem,
  getPendingIndexedDbSyncItems,
  removeIndexedDbSyncItem,
  saveGymStateToIndexedDB
} from './gymIndexedDb';
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

  // No cloud profile exists at all
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

  // Local has completed workouts while cloud profile is blank -> Local ALWAYS wins (never wipe local!)
  if (localInv.totalCount > 0 && cloudInv.totalCount === 0) {
    return {
      ...baseMeta,
      decision: 'local_wins',
      reason: 'cloud_empty_local_has_workouts',
      question: null
    };
  }

  // Local has zero completed workouts while cloud has saved workouts -> Safe cloud download
  if (localInv.totalCount === 0 && cloudInv.totalCount > 0) {
    return {
      ...baseMeta,
      decision: 'cloud_wins',
      reason: 'local_empty_cloud_has_workouts',
      question: null
    };
  }

  // Major conflict: BOTH phone and cloud contain different completed sets
  if (uniqueLocalSetKeys.length > 0 && uniqueCloudSetKeys.length > 0) {
    return {
      ...baseMeta,
      decision: 'conflict_prompt',
      reason: 'both_sides_have_different_completed_sets',
      question: SYNC_CONFLICT_MODAL_QUESTION
    };
  }

  // Local contains strictly additional completed sets beyond cloud -> Local Wins
  if (uniqueLocalSetKeys.length > 0 && uniqueCloudSetKeys.length === 0) {
    return {
      ...baseMeta,
      decision: 'local_wins',
      reason: 'local_has_unsynced_completed_sets',
      question: null
    };
  }

  // Cloud contains strictly additional completed sets beyond local -> Cloud Wins
  if (uniqueCloudSetKeys.length > 0 && uniqueLocalSetKeys.length === 0) {
    return {
      ...baseMeta,
      decision: 'cloud_wins',
      reason: 'cloud_has_newer_completed_sets',
      question: null
    };
  }

  // Identical completed sets: break tie with updatedAt timestamp (local wins ties when outbox pending)
  if (localUpdatedAtMs > cloudUpdatedAtMs || (options.hasPendingOutboxItems && localUpdatedAtMs >= cloudUpdatedAtMs)) {
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

/**
 * Step 3: `sync_outbox` Queue Helpers (localStorage `sync_outbox` + IndexedDB `sync_outbox`)
 */
export function readSyncOutbox(storage?: StorageAdapter | null): SyncOutboxActionItem[] {
  const store = storage ?? getDefaultStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(SYNC_OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
    store.setItem(SYNC_OUTBOX_STORAGE_KEY, JSON.stringify(items.slice(-50)));
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

export async function enqueueSyncOutboxAction(options: {
  stateObj: Record<string, any>;
  actionType: string;
  endpoint?: string | null;
  setKey?: string | null;
  exerciseId?: string | null;
  localStateStorageKey?: string | null;
  storage?: StorageAdapter | null;
  nowIso?: string;
}): Promise<{
  item: SyncOutboxActionItem;
  queueLength: number;
  savedLocally: boolean;
}> {
  const store = options.storage ?? getDefaultStorage();
  const nowIso = options.nowIso || new Date().toISOString();
  const stamped = stampGymStateLastUpdated({ ...(options.stateObj || {}) }, nowIso);
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

  try {
    await saveGymStateToIndexedDB(stamped);
    savedLocally = true;
  } catch {
    // localStorage mirror remains authoritative
  }

  const endpoint = String(options.endpoint || '').trim();
  const item: SyncOutboxActionItem = {
    id: `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actionType: String(options.actionType || 'set_done'),
    setKey: options.setKey || null,
    exerciseId: options.exerciseId || null,
    endpoint,
    payloadJson,
    updatedAt: nowIso,
    queuedAt: nowIso,
    attempts: 0
  };

  const currentQueue = readSyncOutbox(store);
  // Keep full action audit trail (capped at 50) while replacing older duplicate entries for the same setKey
  const nextQueue = currentQueue.filter(
    (entry) => !(item.setKey && entry.setKey === item.setKey && entry.actionType === item.actionType)
  );
  nextQueue.push(item);
  writeSyncOutbox(nextQueue, store);

  try {
    await enqueueIndexedDbSyncItem({
      endpoint: endpoint || 'pending_endpoint',
      payloadJson,
      reason: item.actionType,
      lastUpdated: nowIso
    });
  } catch {
    // localStorage sync_outbox holds the authoritative queue
  }

  return {
    item,
    queueLength: nextQueue.length,
    savedLocally
  };
}

/**
 * Flushes all queued changes in `sync_outbox` (and IndexedDB outbox) to Supabase
 * when the device reconnects. Consolidates to the freshest state snapshot so no
 * out-of-order stale write can regress a newer offline set.
 */
export async function flushSyncOutboxToSupabase(options?: {
  resolveEndpoint?: () => string;
  getLatestLocalState?: () => Record<string, any> | null;
  storage?: StorageAdapter | null;
  fetchImpl?: typeof fetch;
  navigatorLike?: { onLine?: boolean } | null;
}): Promise<FlushSyncOutboxResult> {
  const store = options?.storage ?? getDefaultStorage();
  const online = isNetworkOnline(options?.navigatorLike);
  const lsQueue = readSyncOutbox(store);
  let idbQueue: Array<{ id: string; endpoint: string; payloadJson: string; lastUpdated: string }> = [];
  try {
    idbQueue = await getPendingIndexedDbSyncItems();
  } catch {
    idbQueue = [];
  }

  const totalPending = Math.max(lsQueue.length, idbQueue.length);
  if (!online) {
    return {
      online: false,
      attempted: 0,
      flushedCount: 0,
      remainingCount: totalPending,
      syncedAtIso: null,
      lastError: 'Device is offline.'
    };
  }

  if (lsQueue.length === 0 && idbQueue.length === 0) {
    return {
      online: true,
      attempted: 0,
      flushedCount: 0,
      remainingCount: 0,
      syncedAtIso: null,
      lastError: null
    };
  }

  const fetchFn =
    options?.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!fetchFn) {
    return {
      online: true,
      attempted: 0,
      flushedCount: 0,
      remainingCount: totalPending,
      syncedAtIso: null,
      lastError: 'Fetch unavailable.'
    };
  }

  const dynamicEndpoint = String(options?.resolveEndpoint?.() || '').trim();
  const latestItem = lsQueue[lsQueue.length - 1] || null;
  const fallbackEndpoint =
    (latestItem && latestItem.endpoint && latestItem.endpoint !== 'pending_endpoint'
      ? latestItem.endpoint
      : '') ||
    (idbQueue[idbQueue.length - 1]?.endpoint &&
    idbQueue[idbQueue.length - 1]?.endpoint !== 'pending_endpoint'
      ? idbQueue[idbQueue.length - 1].endpoint
      : '');
  const targetEndpoint = dynamicEndpoint || fallbackEndpoint;

  if (!targetEndpoint) {
    return {
      online: true,
      attempted: 0,
      flushedCount: 0,
      remainingCount: totalPending,
      syncedAtIso: null,
      lastError: 'Waiting for cloud endpoint.'
    };
  }

  // Prefer the live local state snapshot if available (ensures all queued sets are included),
  // otherwise use the latest queued payloadJson from sync_outbox.
  const latestStateObj = options?.getLatestLocalState?.() || null;
  let payloadToSend = '';
  if (latestStateObj && typeof latestStateObj === 'object') {
    const stamped = stampGymStateLastUpdated(
      { ...latestStateObj },
      getStateLastUpdatedIso(latestStateObj) || new Date().toISOString()
    );
    payloadToSend = serializeStateForPersistence(stamped);
  } else if (latestItem && latestItem.payloadJson) {
    payloadToSend = latestItem.payloadJson;
  } else if (idbQueue[idbQueue.length - 1]?.payloadJson) {
    payloadToSend = idbQueue[idbQueue.length - 1].payloadJson;
  }

  if (!payloadToSend) {
    await clearSyncOutbox(store);
    return {
      online: true,
      attempted: totalPending,
      flushedCount: totalPending,
      remainingCount: 0,
      syncedAtIso: new Date().toISOString(),
      lastError: null
    };
  }

  try {
    const isApi = targetEndpoint.includes('/api/state');
    const isFirebase = targetEndpoint.includes('firebaseio.com') || targetEndpoint.endsWith('.json');
    const res = await fetchFn(targetEndpoint, {
      method: isFirebase ? 'PUT' : 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': isApi ? 'application/json' : 'text/plain;charset=utf-8'
      },
      body: payloadToSend
    });

    if (!res || !res.ok) {
      const bumped = lsQueue.map((item) => ({ ...item, attempts: item.attempts + 1 }));
      writeSyncOutbox(bumped, store);
      return {
        online: true,
        attempted: totalPending,
        flushedCount: 0,
        remainingCount: totalPending,
        syncedAtIso: null,
        lastError: `HTTP ${res ? res.status : 'error'}`
      };
    }

    const json = await res.json().catch(() => ({}));
    if (json && json.configured === false) {
      return {
        online: true,
        attempted: totalPending,
        flushedCount: 0,
        remainingCount: totalPending,
        syncedAtIso: null,
        lastError: 'Cloud storage not configured.'
      };
    }

    // Confirmed by Supabase: drain both localStorage sync_outbox and IndexedDB sync_outbox
    writeSyncOutbox([], store);
    for (const idbItem of idbQueue) {
      await removeIndexedDbSyncItem(idbItem.id).catch(() => {});
    }

    const syncedAtIso =
      (json && typeof json.last_updated === 'string' && json.last_updated) ||
      (json && typeof json.updatedAt === 'string' && json.updatedAt) ||
      new Date().toISOString();

    return {
      online: true,
      attempted: totalPending,
      flushedCount: totalPending,
      remainingCount: 0,
      syncedAtIso,
      lastError: null
    };
  } catch (err) {
    const bumped = lsQueue.map((item) => ({ ...item, attempts: item.attempts + 1 }));
    writeSyncOutbox(bumped, store);
    return {
      online: true,
      attempted: totalPending,
      flushedCount: 0,
      remainingCount: totalPending,
      syncedAtIso: null,
      lastError: err instanceof Error ? err.message : 'Network error'
    };
  }
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
