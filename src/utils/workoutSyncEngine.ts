import {
  SYNC_SUPABASE_DELAY_MS,
  createDelayedCloudPushController,
  serializeStateForPersistence,
  type DelayedCloudPushController
} from './workoutLogic';

export type AutoSyncTriggerReason =
  | 'set_logged'
  | 'pullup_logged'
  | 'cardio_logged'
  | 'workout_finished'
  | 'day_reset'
  | 'delayed_sync'
  | 'undo_restore';

export interface AutoSyncResult {
  synced: boolean;
  blockedByUndoGuard: boolean;
  blockedByEmptyStateGuard: boolean;
  reason: AutoSyncTriggerReason;
  endpoint: string;
}

export interface AutoSyncEngineOptions {
  getState: () => Record<string, any>;
  getEndpoint: () => string;
  fetchImpl?: typeof fetch;
  onStatusChange?: (status: {
    phase: 'syncing' | 'paused_undo' | 'saved' | 'local_only' | 'error';
    message: string;
    reason: AutoSyncTriggerReason;
  }) => void;
  delayMs?: number;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (handle: any) => void;
}

export interface AutoSupabaseSyncEngine {
  autoSyncWorkoutToSupabase: (reason: AutoSyncTriggerReason) => Promise<AutoSyncResult>;
  scheduleDestructiveOverwritePush: (delayOverrideMs?: number) => void;
  flushUndoRestorePush: () => Promise<AutoSyncResult>;
  cancelPendingDestructivePush: () => void;
  isUndoProtectionWindowActive: () => boolean;
  getLastSyncedLoggedSetCount: () => number;
  recordKnownCloudLoggedSetCount: (count: number) => void;
}

export function countTotalLoggedSetsInState(stateObj: Record<string, any> | null | undefined): number {
  if (!stateObj || typeof stateObj !== 'object') return 0;
  let total = 0;
  const workoutLogs = stateObj.workoutLogs || {};
  Object.keys(workoutLogs).forEach((k) => {
    const entry = workoutLogs[k];
    if (entry && (entry.done === true || entry.isLogged === true)) {
      total += 1;
    }
  });
  const pullupLogs = stateObj.pullupLogs || {};
  Object.keys(pullupLogs).forEach((k) => {
    const entry = pullupLogs[k];
    if (entry && (entry.done === true || entry.isLogged === true)) {
      total += 1;
    }
  });
  return total;
}

export interface SingleSourceOfTruthResult {
  appliedRemote: boolean;
  remoteUpdatedAt: string | null;
  localUpdatedAt: string | null;
  state: Record<string, any> | null;
}

export function parseTimestampMs(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function resolveSingleSourceOfTruthState(
  localState: Record<string, any> | null | undefined,
  remoteState: Record<string, any> | null | undefined,
  options?: {
    forceRemoteOnInit?: boolean;
    remoteUpdatedAt?: string | null;
  }
): SingleSourceOfTruthResult {
  const localTs = parseTimestampMs(localState?.updatedAt);
  const remoteIso =
    (typeof options?.remoteUpdatedAt === 'string' && options.remoteUpdatedAt) ||
    (typeof remoteState?.updatedAt === 'string' && remoteState.updatedAt) ||
    null;
  const remoteTs = parseTimestampMs(remoteIso);

  if (!remoteState || typeof remoteState !== 'object') {
    return {
      appliedRemote: false,
      remoteUpdatedAt: null,
      localUpdatedAt: typeof localState?.updatedAt === 'string' ? localState.updatedAt : null,
      state: localState ? { ...localState } : null
    };
  }

  // Strict Single Source of Truth on app init: Supabase always wins and overwrites stale local storage
  const shouldAdoptRemote = Boolean(options?.forceRemoteOnInit) || remoteTs >= localTs || !localState;
  if (!shouldAdoptRemote) {
    return {
      appliedRemote: false,
      remoteUpdatedAt: remoteIso,
      localUpdatedAt: typeof localState?.updatedAt === 'string' ? localState.updatedAt : null,
      state: { ...localState }
    };
  }

  const authoritative = JSON.parse(JSON.stringify(remoteState));
  if (remoteIso) {
    authoritative.updatedAt = remoteIso;
  }
  return {
    appliedRemote: true,
    remoteUpdatedAt: remoteIso,
    localUpdatedAt: typeof localState?.updatedAt === 'string' ? localState.updatedAt : null,
    state: authoritative
  };
}

export async function fetchLatestCloudStateAsSingleSourceOfTruth(options: {
  endpoint: string;
  localState: Record<string, any> | null;
  storageKey?: string;
  storage?: Pick<Storage, 'setItem'> | null;
  fetchImpl?: typeof fetch;
  forceRemoteOnInit?: boolean;
}): Promise<SingleSourceOfTruthResult> {
  const endpoint = String(options.endpoint || '').trim();
  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!endpoint || !fetchFn) {
    return resolveSingleSourceOfTruthState(options.localState, null);
  }

  const sep = endpoint.includes('?') ? '&' : '?';
  const cacheBustedUrl = `${endpoint}${sep}t=${Date.now()}`;

  try {
    const response = await fetchFn(cacheBustedUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache'
      }
    });
    if (!response.ok) {
      return resolveSingleSourceOfTruthState(options.localState, null);
    }
    const payload = await response.json().catch(() => null);
    const remoteState = payload && payload.configured && payload.data ? payload.data : payload?.data || payload;
    const remoteUpdatedAt =
      (payload && typeof payload.updatedAt === 'string' && payload.updatedAt) ||
      (remoteState && typeof remoteState.updatedAt === 'string' && remoteState.updatedAt) ||
      null;

    if (!remoteState || typeof remoteState !== 'object' || (!remoteState.workoutLogs && remoteState.selectedDayIndex === undefined)) {
      return resolveSingleSourceOfTruthState(options.localState, null);
    }

    const resolved = resolveSingleSourceOfTruthState(options.localState, remoteState, {
      forceRemoteOnInit: options.forceRemoteOnInit !== false,
      remoteUpdatedAt
    });

    if (resolved.appliedRemote && resolved.state && options.storageKey && options.storage) {
      try {
        options.storage.setItem(options.storageKey, serializeStateForPersistence(resolved.state));
      } catch {
        // Ignore storage quota issues in restricted environments
      }
    }

    return resolved;
  } catch {
    return resolveSingleSourceOfTruthState(options.localState, null);
  }
}

export function createAutoSupabaseSyncEngine(options: AutoSyncEngineOptions): AutoSupabaseSyncEngine {
  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  let lastKnownCloudLoggedSets = 0;

  async function executePushNow(reason: AutoSyncTriggerReason): Promise<AutoSyncResult> {
    const endpoint = String(options.getEndpoint() || '').trim();
    if (!endpoint || !fetchFn) {
      return {
        synced: false,
        blockedByUndoGuard: false,
        blockedByEmptyStateGuard: false,
        reason,
        endpoint
      };
    }

    const currentState = options.getState() || {};
    const localLoggedCount = countTotalLoggedSetsInState(currentState);

    // Prevent an unexpected blank local state from wiping populated cloud data during passive auto-sync.
    // Deliberate user-confirmed day_reset / delayed_sync / undo_restore pushes are always allowed through.
    const isPassiveAutoSync =
      reason === 'set_logged' || reason === 'pullup_logged' || reason === 'cardio_logged' || reason === 'workout_finished';
    if (isPassiveAutoSync && lastKnownCloudLoggedSets > 0 && localLoggedCount === 0) {
      options.onStatusChange?.({
        phase: 'error',
        message: 'Auto-sync paused to protect saved Supabase sets.',
        reason
      });
      return {
        synced: false,
        blockedByUndoGuard: false,
        blockedByEmptyStateGuard: true,
        reason,
        endpoint
      };
    }

    options.onStatusChange?.({
      phase: 'syncing',
      message:
        reason === 'undo_restore'
          ? 'Restoring to Supabase...'
          : reason === 'day_reset'
            ? 'Syncing cleared day to Supabase...'
            : 'Auto-syncing to Supabase...',
      reason
    });

    // Stamp monotonic ISO timestamp so cross-device Single Source of Truth always identifies the newest state
    currentState.updatedAt = new Date().toISOString();

    const isFirebase = endpoint.includes('firebaseio.com') || endpoint.endsWith('.json');
    const isSupabaseApi = endpoint.includes('/api/state');
    const payload = serializeStateForPersistence(currentState);

    try {
      const resp = await fetchFn(endpoint, {
        method: isFirebase ? 'PUT' : 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': isSupabaseApi ? 'application/json' : 'text/plain;charset=utf-8'
        },
        body: payload
      });
      const json = await resp.json().catch(() => ({}));
      if (json && json.configured === false) {
        options.onStatusChange?.({
          phase: 'local_only',
          message: 'Local Saved (Add Supabase in Vercel)',
          reason
        });
        return {
          synced: false,
          blockedByUndoGuard: false,
          blockedByEmptyStateGuard: false,
          reason,
          endpoint
        };
      }
      if (json && typeof json.updatedAt === 'string') {
        currentState.updatedAt = json.updatedAt;
      }
      lastKnownCloudLoggedSets = localLoggedCount;
      options.onStatusChange?.({
        phase: 'saved',
        message:
          reason === 'undo_restore'
            ? 'Undo Restored in Supabase'
            : reason === 'day_reset'
              ? 'Day Reset Synced to Supabase'
              : 'Auto-Synced to Supabase',
        reason
      });
      return {
        synced: true,
        blockedByUndoGuard: false,
        blockedByEmptyStateGuard: false,
        reason,
        endpoint
      };
    } catch {
      options.onStatusChange?.({
        phase: 'error',
        message: 'Local Saved (Offline)',
        reason
      });
      return {
        synced: false,
        blockedByUndoGuard: false,
        blockedByEmptyStateGuard: false,
        reason,
        endpoint
      };
    }
  }

  const delayController: DelayedCloudPushController = createDelayedCloudPushController({
    delayMs: options.delayMs ?? SYNC_SUPABASE_DELAY_MS,
    pushFn: (reason) => {
      void executePushNow(reason);
    },
    setTimer: options.setTimer,
    clearTimer: options.clearTimer
  });

  async function autoSyncWorkoutToSupabase(reason: AutoSyncTriggerReason): Promise<AutoSyncResult> {
    // Respect the Data Protection & Undo Engine 5-second delay window so automatic syncs never push an unconfirmed week overwrite early.
    // Explicit undo_restore and confirmed day_reset pushes execute immediately.
    if (delayController.isWithinDelayWindow() && reason !== 'undo_restore' && reason !== 'day_reset') {
      options.onStatusChange?.({
        phase: 'paused_undo',
        message: 'Cloud push paused (5s undo window)...',
        reason
      });
      return {
        synced: false,
        blockedByUndoGuard: true,
        blockedByEmptyStateGuard: false,
        reason,
        endpoint: options.getEndpoint()
      };
    }
    return executePushNow(reason);
  }

  function scheduleDestructiveOverwritePush(delayOverrideMs?: number) {
    options.onStatusChange?.({
      phase: 'paused_undo',
      message: 'Cloud push paused (5s undo window)...',
      reason: 'delayed_sync'
    });
    delayController.scheduleDelayedPush(delayOverrideMs);
  }

  async function flushUndoRestorePush(): Promise<AutoSyncResult> {
    delayController.cancelDelayedPush();
    return executePushNow('undo_restore');
  }

  return {
    autoSyncWorkoutToSupabase,
    scheduleDestructiveOverwritePush,
    flushUndoRestorePush,
    cancelPendingDestructivePush: () => delayController.cancelDelayedPush(),
    isUndoProtectionWindowActive: () => delayController.isWithinDelayWindow(),
    getLastSyncedLoggedSetCount: () => lastKnownCloudLoggedSets,
    recordKnownCloudLoggedSetCount: (count: number) => {
      lastKnownCloudLoggedSets = Math.max(0, Math.floor(Number(count) || 0));
    }
  };
}
