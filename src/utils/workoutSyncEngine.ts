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

    // Prevent an unexpected blank local state from wiping populated cloud data during passive auto-sync
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
      message: reason === 'undo_restore' ? 'Restoring to Supabase...' : 'Auto-syncing to Supabase...',
      reason
    });

    const isFirebase = endpoint.includes('firebaseio.com') || endpoint.endsWith('.json');
    const isSupabaseApi = endpoint.includes('/api/state');
    const payload = serializeStateForPersistence(currentState);

    try {
      const resp = await fetchFn(endpoint, {
        method: isFirebase ? 'PUT' : 'POST',
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
      lastKnownCloudLoggedSets = localLoggedCount;
      options.onStatusChange?.({
        phase: 'saved',
        message: reason === 'undo_restore' ? 'Undo Restored in Supabase' : 'Auto-Synced to Supabase',
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
    // Respect the Data Protection & Undo Engine 5-second delay window so automatic syncs never push an unconfirmed overwrite early
    if (delayController.isWithinDelayWindow() && reason !== 'undo_restore') {
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
