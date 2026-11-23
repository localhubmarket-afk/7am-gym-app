import {
  SYNC_SUPABASE_DELAY_MS,
  createDelayedCloudPushController,
  serializeStateForPersistence,
  type DelayedCloudPushController
} from './workoutLogic';

export type AutoSyncTriggerReason =
  | 'set_logged'
  | 'checkbox_toggled'
  | 'fuel_checked'
  | 'timer_adjusted'
  | 'timer_completed'
  | 'pullup_logged'
  | 'cardio_logged'
  | 'workout_finished'
  | 'day_reset'
  | 'fuel_reset'
  | 'delete_all_weeks'
  | 'start_fresh_reset'
  | 'local_newer_sync'
  | 'delayed_sync'
  | 'undo_restore'
  | 'background_input';

export interface GymStateTimestamped extends Record<string, any> {
  last_updated?: string | null;
  updatedAt?: string | null;
}

export interface AutoSyncResult {
  synced: boolean;
  blockedByUndoGuard: boolean;
  blockedByEmptyStateGuard: boolean;
  reason: AutoSyncTriggerReason;
  endpoint: string;
  lastUpdated: string | null;
}

export interface AutoSyncEngineOptions {
  getState: () => GymStateTimestamped;
  getEndpoint: () => string;
  fetchImpl?: typeof fetch;
  onStatusChange?: (status: {
    phase: 'syncing' | 'paused_undo' | 'saved' | 'local_only' | 'error';
    message: string;
    reason: AutoSyncTriggerReason;
  }) => void;
  delayMs?: number;
  backgroundDebounceMs?: number;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (handle: any) => void;
}

export interface AutoSupabaseSyncEngine {
  autoSyncWorkoutToSupabase: (reason: AutoSyncTriggerReason) => Promise<AutoSyncResult>;
  pushGymStateInBackground: (reason: AutoSyncTriggerReason, immediate?: boolean) => Promise<AutoSyncResult> | void;
  flushPendingBackgroundPush: () => Promise<AutoSyncResult | null>;
  cancelPendingBackgroundPush: () => void;
  scheduleDestructiveOverwritePush: (delayOverrideMs?: number) => void;
  flushUndoRestorePush: () => Promise<AutoSyncResult>;
  cancelPendingDestructivePush: () => void;
  isUndoProtectionWindowActive: () => boolean;
  getLastSyncedLoggedSetCount: () => number;
  recordKnownCloudLoggedSetCount: (count: number) => void;
}

export type TruthSourceWinner = 'cloud' | 'local' | 'equal';

export interface SingleSourceOfTruthResult<T extends GymStateTimestamped = GymStateTimestamped> {
  winner: TruthSourceWinner;
  appliedRemote: boolean;
  shouldPushLocalToCloud: boolean;
  remoteLastUpdated: string | null;
  localLastUpdated: string | null;
  // Backwards-compatible aliases
  remoteUpdatedAt: string | null;
  localUpdatedAt: string | null;
  state: T | null;
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

export function parseTimestampMs(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function getStateLastUpdatedIso(stateObj: GymStateTimestamped | null | undefined): string | null {
  if (!stateObj || typeof stateObj !== 'object') return null;
  const candidates = [stateObj.last_updated, stateObj.updatedAt, stateObj.updated_at];
  let bestIso: string | null = null;
  let bestMs = 0;
  candidates.forEach((raw) => {
    if (typeof raw === 'string' && raw.trim()) {
      const ms = parseTimestampMs(raw);
      if (ms >= bestMs) {
        bestMs = ms;
        bestIso = raw;
      }
    }
  });
  return bestIso;
}

export function stampGymStateLastUpdated<T extends GymStateTimestamped>(
  stateObj: T,
  nowIso: string = new Date().toISOString()
): T {
  if (stateObj && typeof stateObj === 'object') {
    stateObj.last_updated = nowIso;
    stateObj.updatedAt = nowIso;
  }
  return stateObj;
}

/**
 * Task 1: The "Most Advanced" Truth Engine
 * Compares cloud `last_updated` vs local `last_updated` and designates the newest timestamp
 * as the strict Single Source of Truth.
 */
export function resolveSingleSourceOfTruthState<T extends GymStateTimestamped = GymStateTimestamped>(
  localState: T | null | undefined,
  remoteState: T | null | undefined,
  options?: {
    forceRemoteOnInit?: boolean;
    remoteLastUpdated?: string | null;
    remoteUpdatedAt?: string | null;
  }
): SingleSourceOfTruthResult<T> {
  const localIso = getStateLastUpdatedIso(localState);
  const localTs = parseTimestampMs(localIso);

  const remoteStateIso = getStateLastUpdatedIso(remoteState);
  const explicitRemoteIso =
    (typeof options?.remoteLastUpdated === 'string' && options.remoteLastUpdated.trim() && options.remoteLastUpdated) ||
    (typeof options?.remoteUpdatedAt === 'string' && options.remoteUpdatedAt.trim() && options.remoteUpdatedAt) ||
    null;

  const explicitRemoteMs = parseTimestampMs(explicitRemoteIso);
  const remoteStateMs = parseTimestampMs(remoteStateIso);
  const remoteTs = Math.max(explicitRemoteMs, remoteStateMs);
  const remoteIso = explicitRemoteMs >= remoteStateMs ? (explicitRemoteIso || remoteStateIso) : (remoteStateIso || explicitRemoteIso);

  if (!remoteState || typeof remoteState !== 'object') {
    return {
      winner: localState ? 'local' : 'equal',
      appliedRemote: false,
      shouldPushLocalToCloud: Boolean(localState && localTs > 0),
      remoteLastUpdated: null,
      localLastUpdated: localIso,
      remoteUpdatedAt: null,
      localUpdatedAt: localIso,
      state: localState ? ({ ...localState } as T) : null
    };
  }

  // Cloud wins when:
  // 1. Explicit returning-user login override (`forceRemoteOnInit: true`), OR
  // 2. Local device has no state / no `last_updated` timestamp (`localTs === 0`), OR
  // 3. Cloud `last_updated` is strictly newer than Local `last_updated` (`remoteTs > localTs`).
  const cloudIsNewer = remoteTs > localTs;
  const localHasNoTimestamp = !localState || localTs === 0;
  const shouldAdoptRemote = Boolean(options?.forceRemoteOnInit) || cloudIsNewer || (localHasNoTimestamp && remoteTs >= 0);

  if (shouldAdoptRemote) {
    const authoritative = JSON.parse(JSON.stringify(remoteState)) as T;
    const effectiveIso = remoteIso || new Date().toISOString();
    authoritative.last_updated = effectiveIso;
    authoritative.updatedAt = effectiveIso;
    return {
      winner: 'cloud',
      appliedRemote: true,
      shouldPushLocalToCloud: false,
      remoteLastUpdated: effectiveIso,
      localLastUpdated: localIso,
      remoteUpdatedAt: effectiveIso,
      localUpdatedAt: localIso,
      state: authoritative
    };
  }

  if (localTs > remoteTs) {
    const localCopy = JSON.parse(JSON.stringify(localState)) as T;
    if (localIso) {
      localCopy.last_updated = localIso;
      localCopy.updatedAt = localIso;
    }
    return {
      winner: 'local',
      appliedRemote: false,
      shouldPushLocalToCloud: true,
      remoteLastUpdated: remoteIso,
      localLastUpdated: localIso,
      remoteUpdatedAt: remoteIso,
      localUpdatedAt: localIso,
      state: localCopy
    };
  }

  return {
    winner: 'equal',
    appliedRemote: false,
    shouldPushLocalToCloud: false,
    remoteLastUpdated: remoteIso,
    localLastUpdated: localIso,
    remoteUpdatedAt: remoteIso,
    localUpdatedAt: localIso,
    state: localState ? ({ ...localState } as T) : null
  };
}

export async function fetchLatestCloudStateAsSingleSourceOfTruth<T extends GymStateTimestamped = GymStateTimestamped>(options: {
  endpoint: string;
  localState: T | null;
  storageKey?: string;
  storage?: Pick<Storage, 'setItem'> | null;
  fetchImpl?: typeof fetch;
  forceRemoteOnInit?: boolean;
  pushLocalIfNewer?: boolean;
}): Promise<SingleSourceOfTruthResult<T>> {
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
    const remoteState = (payload && payload.configured && payload.data ? payload.data : payload?.data || payload) as T | null;
    const remoteLastUpdated =
      (payload && typeof payload.last_updated === 'string' && payload.last_updated) ||
      (payload && typeof payload.updatedAt === 'string' && payload.updatedAt) ||
      getStateLastUpdatedIso(remoteState);

    if (!remoteState || typeof remoteState !== 'object' || (!remoteState.workoutLogs && remoteState.selectedDayIndex === undefined)) {
      return resolveSingleSourceOfTruthState(options.localState, null);
    }

    // Strict timestamp comparison by default (unless caller explicitly passes forceRemoteOnInit: true)
    const resolved = resolveSingleSourceOfTruthState(options.localState, remoteState, {
      forceRemoteOnInit: Boolean(options.forceRemoteOnInit),
      remoteLastUpdated
    });

    if (resolved.appliedRemote && resolved.state && options.storageKey && options.storage) {
      try {
        options.storage.setItem(options.storageKey, serializeStateForPersistence(resolved.state));
      } catch {
        // Ignore storage quota issues in restricted environments
      }
    }

    // If local storage holds a strictly newer `last_updated` timestamp (e.g., offline edits), sync local up to Supabase
    if (options.pushLocalIfNewer && resolved.shouldPushLocalToCloud && resolved.state) {
      try {
        const isSupabaseApi = endpoint.includes('/api/state');
        const localPayload = serializeStateForPersistence(resolved.state);
        await fetchFn(endpoint, {
          method: 'POST',
          cache: 'no-store',
          keepalive: localPayload.length < 60000,
          headers: {
            'Content-Type': isSupabaseApi ? 'application/json' : 'text/plain;charset=utf-8'
          },
          body: localPayload
        });
      } catch {
        // Best-effort silent background push
      }
    }

    return resolved;
  } catch {
    return resolveSingleSourceOfTruthState(options.localState, null);
  }
}

export function createAutoSupabaseSyncEngine(options: AutoSyncEngineOptions): AutoSupabaseSyncEngine {
  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const setTimerFn = options.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimerFn = options.clearTimer || ((handle: any) => clearTimeout(handle));
  const backgroundDebounceMs = Math.max(0, options.backgroundDebounceMs ?? 300);
  let lastKnownCloudLoggedSets = 0;
  let pendingBgHandle: any = null;
  let pendingBgReason: AutoSyncTriggerReason | null = null;

  async function executePushNow(reason: AutoSyncTriggerReason): Promise<AutoSyncResult> {
    const endpoint = String(options.getEndpoint() || '').trim();
    if (!endpoint || !fetchFn) {
      return {
        synced: false,
        blockedByUndoGuard: false,
        blockedByEmptyStateGuard: false,
        reason,
        endpoint,
        lastUpdated: null
      };
    }

    const currentState = options.getState() || {};
    const localLoggedCount = countTotalLoggedSetsInState(currentState);

    // Prevent an unexpected blank local state from wiping populated cloud data during passive auto-sync.
    // Deliberate user-confirmed day_reset / delayed_sync / undo_restore / local_newer_sync pushes are always allowed through.
    const isPassiveAutoSync =
      reason === 'set_logged' ||
      reason === 'checkbox_toggled' ||
      reason === 'fuel_checked' ||
      reason === 'timer_adjusted' ||
      reason === 'timer_completed' ||
      reason === 'pullup_logged' ||
      reason === 'cardio_logged' ||
      reason === 'workout_finished' ||
      reason === 'background_input';

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
        endpoint,
        lastUpdated: getStateLastUpdatedIso(currentState)
      };
    }

    options.onStatusChange?.({
      phase: 'syncing',
      message:
        reason === 'undo_restore'
          ? 'Restoring...'
          : reason === 'start_fresh_reset' || reason === 'delete_all_weeks'
            ? 'Saving fresh start...'
            : reason === 'day_reset' || reason === 'fuel_reset'
              ? 'Saving cleared day...'
              : 'Saving changes...',
      reason
    });

    // Stamp monotonic ISO `last_updated` + `updatedAt` timestamp so the Truth Engine always knows which device is newest
    const nowIso = new Date().toISOString();
    if (reason !== 'local_newer_sync' || !getStateLastUpdatedIso(currentState)) {
      stampGymStateLastUpdated(currentState, nowIso);
    } else {
      const existingIso = getStateLastUpdatedIso(currentState) || nowIso;
      stampGymStateLastUpdated(currentState, existingIso);
    }

    const isFirebase = endpoint.includes('firebaseio.com') || endpoint.endsWith('.json');
    const isSupabaseApi = endpoint.includes('/api/state');
    const isFullResetOverwrite = reason === 'start_fresh_reset' || reason === 'delete_all_weeks';
    const stateToPersist = isFullResetOverwrite
      ? { ...currentState, forceOverwrite: true, resetReason: reason }
      : currentState;
    const payload = serializeStateForPersistence(stateToPersist);

    try {
      const resp = await fetchFn(endpoint, {
        method: isFirebase ? 'PUT' : 'POST',
        cache: 'no-store',
        keepalive: payload.length < 60000,
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
          endpoint,
          lastUpdated: getStateLastUpdatedIso(currentState)
        };
      }
      const serverTs =
        (json && typeof json.last_updated === 'string' && json.last_updated) ||
        (json && typeof json.updatedAt === 'string' && json.updatedAt) ||
        getStateLastUpdatedIso(currentState);
      if (serverTs) {
        stampGymStateLastUpdated(currentState, serverTs);
      }
      lastKnownCloudLoggedSets = localLoggedCount;
      options.onStatusChange?.({
        phase: 'saved',
        message:
          reason === 'undo_restore'
            ? 'Undo Restored'
            : reason === 'start_fresh_reset' || reason === 'delete_all_weeks'
              ? 'Complete Reset Saved'
              : reason === 'day_reset' || reason === 'fuel_reset'
                ? 'Day Reset Saved'
                : 'Changes Saved',
        reason
      });
      return {
        synced: true,
        blockedByUndoGuard: false,
        blockedByEmptyStateGuard: false,
        reason,
        endpoint,
        lastUpdated: serverTs
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
        endpoint,
        lastUpdated: getStateLastUpdatedIso(currentState)
      };
    }
  }

  const delayController: DelayedCloudPushController = createDelayedCloudPushController({
    delayMs: options.delayMs ?? SYNC_SUPABASE_DELAY_MS,
    pushFn: (reason) => {
      void executePushNow(reason);
    },
    setTimer: setTimerFn,
    clearTimer: clearTimerFn
  });

  function cancelPendingBackgroundPush() {
    if (pendingBgHandle !== null) {
      clearTimerFn(pendingBgHandle);
      pendingBgHandle = null;
    }
    pendingBgReason = null;
  }

  async function autoSyncWorkoutToSupabase(reason: AutoSyncTriggerReason): Promise<AutoSyncResult> {
    // Respect the Data Protection & Undo Engine 5-second delay window so automatic syncs never push an unconfirmed week overwrite early.
    // Explicit undo_restore, confirmed day_reset, fuel_reset, delete_all_weeks, and start_fresh_reset pushes execute immediately.
    if (
      delayController.isWithinDelayWindow() &&
      reason !== 'undo_restore' &&
      reason !== 'day_reset' &&
      reason !== 'fuel_reset' &&
      reason !== 'delete_all_weeks' &&
      reason !== 'start_fresh_reset'
    ) {
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
        endpoint: options.getEndpoint(),
        lastUpdated: getStateLastUpdatedIso(options.getState())
      };
    }
    if (reason === 'start_fresh_reset' || reason === 'delete_all_weeks' || reason === 'day_reset' || reason === 'fuel_reset') {
      delayController.cancelDelayedPush();
    }
    cancelPendingBackgroundPush();
    return executePushNow(reason);
  }

  function pushGymStateInBackground(reason: AutoSyncTriggerReason, immediate = false): Promise<AutoSyncResult> | void {
    // Stamp `last_updated` immediately on the active state at the exact instant of user input
    const currentState = options.getState();
    if (currentState && typeof currentState === 'object') {
      stampGymStateLastUpdated(currentState, new Date().toISOString());
    }
    if (
      immediate ||
      backgroundDebounceMs === 0 ||
      reason === 'day_reset' ||
      reason === 'fuel_reset' ||
      reason === 'delete_all_weeks' ||
      reason === 'start_fresh_reset' ||
      reason === 'undo_restore'
    ) {
      return autoSyncWorkoutToSupabase(reason);
    }
    cancelPendingBackgroundPush();
    pendingBgReason = reason;
    pendingBgHandle = setTimerFn(() => {
      const nextReason = pendingBgReason || reason;
      pendingBgHandle = null;
      pendingBgReason = null;
      void autoSyncWorkoutToSupabase(nextReason);
    }, backgroundDebounceMs);
  }

  async function flushPendingBackgroundPush(): Promise<AutoSyncResult | null> {
    if (pendingBgHandle === null && !pendingBgReason) return null;
    const reason = pendingBgReason || 'background_input';
    cancelPendingBackgroundPush();
    return autoSyncWorkoutToSupabase(reason);
  }

  function scheduleDestructiveOverwritePush(delayOverrideMs?: number) {
    cancelPendingBackgroundPush();
    options.onStatusChange?.({
      phase: 'paused_undo',
      message: 'Cloud push paused (5s undo window)...',
      reason: 'delayed_sync'
    });
    delayController.scheduleDelayedPush(delayOverrideMs);
  }

  async function flushUndoRestorePush(): Promise<AutoSyncResult> {
    cancelPendingBackgroundPush();
    delayController.cancelDelayedPush();
    return executePushNow('undo_restore');
  }

  return {
    autoSyncWorkoutToSupabase,
    pushGymStateInBackground,
    flushPendingBackgroundPush,
    cancelPendingBackgroundPush,
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
