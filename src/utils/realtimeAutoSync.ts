import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchLatestCloudStateAsSingleSourceOfTruth,
  getStateLastUpdatedIso,
  parseTimestampMs,
  stampGymStateLastUpdated,
  type GymStateTimestamped
} from './workoutSyncEngine';
import { serializeStateForPersistence } from './workoutLogic';
import { getSupabaseClient, resolveGymStateRecordId } from '../lib/supabaseClient';

export const AUTO_SYNC_STORAGE_KEY = 'budget_gym_auto_sync_enabled_v1';
export const AUTO_SYNC_DEBOUNCE_MS = 2000;
export const DEFAULT_AUTO_SYNC_ENABLED = true;

export const AUTO_SYNC_TOGGLE_LABEL = 'Auto-Sync Devices';
export const AUTO_SYNC_TOGGLE_SUBLABEL =
  'Automatically saves your progress to the cloud and updates your other screens instantly.';
export const FORCE_SYNC_NOW_LABEL = 'Force Sync Now';

export type RealtimeSyncConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'offline'
  | 'disabled'
  | 'local_only';

export type RealtimePushReason =
  | 'set_logged'
  | 'fuel_modified'
  | 'setting_changed'
  | 'state_mutation'
  | 'manual_force_sync'
  | 'reconnect_sync';

export interface DebouncedController<TArgs extends any[]> {
  call: (...args: TArgs) => void;
  cancel: () => void;
  flush: () => void;
  isPending: () => boolean;
}

/**
 * Task 2: Debounce utility (default 2000ms) to prevent database rate-limiting
 * during rapid screen taps while logging sets, fuel, or settings.
 */
export function createDebounce<TArgs extends any[]>(
  fn: (...args: TArgs) => void,
  delayMs: number = AUTO_SYNC_DEBOUNCE_MS,
  timers?: {
    setTimer?: (cb: () => void, ms: number) => any;
    clearTimer?: (handle: any) => void;
  }
): DebouncedController<TArgs> {
  const setTimerFn = timers?.setTimer || ((cb: () => void, ms: number) => setTimeout(cb, ms));
  const clearTimerFn = timers?.clearTimer || ((handle: any) => clearTimeout(handle));
  const safeDelay = Math.max(0, Number(delayMs) || 0);

  let handle: any = null;
  let lastArgs: TArgs | null = null;

  function cancel() {
    if (handle !== null) {
      clearTimerFn(handle);
      handle = null;
    }
    lastArgs = null;
  }

  function flush() {
    if (handle !== null && lastArgs !== null) {
      const argsToRun = lastArgs;
      cancel();
      fn(...argsToRun);
    }
  }

  function call(...args: TArgs) {
    lastArgs = args;
    if (handle !== null) {
      clearTimerFn(handle);
      handle = null;
    }
    if (safeDelay === 0) {
      const argsToRun = lastArgs;
      lastArgs = null;
      fn(...argsToRun);
      return;
    }
    handle = setTimerFn(() => {
      const argsToRun = lastArgs;
      handle = null;
      lastArgs = null;
      if (argsToRun) {
        fn(...argsToRun);
      }
    }, safeDelay);
  }

  return {
    call,
    cancel,
    flush,
    isPending: () => handle !== null
  };
}

export function normalizeAutoSyncPreference(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (raw === null || raw === undefined || raw === '') return DEFAULT_AUTO_SYNC_ENABLED;
  const s = String(raw).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'off' || s === 'disabled') return false;
  if (s === 'true' || s === '1' || s === 'on' || s === 'enabled') return true;
  return DEFAULT_AUTO_SYNC_ENABLED;
}

export function loadAutoSyncPreference(storage?: Pick<Storage, 'getItem'> | null): boolean {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return DEFAULT_AUTO_SYNC_ENABLED;
    const raw = store.getItem(AUTO_SYNC_STORAGE_KEY);
    if (raw === null) return DEFAULT_AUTO_SYNC_ENABLED;
    return normalizeAutoSyncPreference(raw);
  } catch {
    return DEFAULT_AUTO_SYNC_ENABLED;
  }
}

export function saveAutoSyncPreference(
  enabled: boolean,
  storage?: Pick<Storage, 'setItem'> | null
): boolean {
  const clean = Boolean(enabled);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      store.setItem(AUTO_SYNC_STORAGE_KEY, clean ? 'true' : 'false');
    }
  } catch {
    // Ignore storage restrictions
  }
  return clean;
}

export interface GymStateRowPayload<T extends GymStateTimestamped = GymStateTimestamped> {
  id?: string;
  data?: T | null;
  updated_at?: string | null;
  last_updated?: string | null;
}

export interface RealtimeIncomingEvaluation<T extends GymStateTimestamped = GymStateTimestamped> {
  shouldApply: boolean;
  incomingState: T | null;
  incomingTimestampIso: string | null;
  localTimestampIso: string | null;
  incomingMs: number;
  localMs: number;
}

/**
 * Task 3: Compares an incoming Supabase Realtime UPDATE row's `last_updated`
 * timestamp against the local device's `last_updated` timestamp.
 * Only returns `shouldApply: true` when the incoming cloud payload is strictly newer.
 */
export function evaluateRealtimeIncomingPayload<T extends GymStateTimestamped = GymStateTimestamped>(
  localState: T | null | undefined,
  incomingRow: GymStateRowPayload<T> | null | undefined
): RealtimeIncomingEvaluation<T> {
  const localTimestampIso = getStateLastUpdatedIso(localState);
  const localMs = parseTimestampMs(localTimestampIso);

  const remoteData = (incomingRow && incomingRow.data && typeof incomingRow.data === 'object'
    ? incomingRow.data
    : null) as T | null;

  if (!remoteData) {
    return {
      shouldApply: false,
      incomingState: null,
      incomingTimestampIso: null,
      localTimestampIso,
      incomingMs: 0,
      localMs
    };
  }

  const candidates = [
    remoteData.last_updated,
    incomingRow?.last_updated,
    incomingRow?.updated_at,
    remoteData.updatedAt
  ];
  let incomingTimestampIso: string | null = null;
  let incomingMs = 0;
  for (const raw of candidates) {
    if (typeof raw === 'string' && raw.trim()) {
      const ms = parseTimestampMs(raw);
      if (ms >= incomingMs) {
        incomingMs = ms;
        incomingTimestampIso = raw;
      }
    }
  }

  const shouldApply = incomingMs > 0 && incomingMs > localMs;
  if (!shouldApply) {
    return {
      shouldApply: false,
      incomingState: null,
      incomingTimestampIso,
      localTimestampIso,
      incomingMs,
      localMs
    };
  }

  const normalizedIncoming = JSON.parse(JSON.stringify(remoteData)) as T;
  if (incomingTimestampIso) {
    normalizedIncoming.last_updated = incomingTimestampIso;
    normalizedIncoming.updatedAt = incomingTimestampIso;
  }

  return {
    shouldApply: true,
    incomingState: normalizedIncoming,
    incomingTimestampIso,
    localTimestampIso,
    incomingMs,
    localMs
  };
}

export interface SupabaseRealtimeChannelLike {
  on: (
    type: string,
    filter: Record<string, unknown>,
    callback: (payload: { new?: Record<string, any> | null }) => void
  ) => SupabaseRealtimeChannelLike;
  subscribe: (callback?: (status: string, err?: unknown) => void) => SupabaseRealtimeChannelLike;
}

export interface SupabaseClientLike {
  channel: (name: string) => SupabaseRealtimeChannelLike;
  removeChannel: (channel: any) => Promise<any> | any;
  from?: (table: string) => any;
}

export interface RealtimeSyncManagerOptions<T extends GymStateTimestamped = GymStateTimestamped> {
  getLocalState: () => T;
  getRecordId: () => string;
  getApiEndpoint: () => string;
  storageKey?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  debounceMs?: number;
  supabaseClient?: SupabaseClientLike | SupabaseClient | null;
  fetchImpl?: typeof fetch;
  isOnlineFn?: () => boolean;
  onRemoteStateApplied: (nextState: T, incomingTimestampIso: string) => void;
  onStatusChange?: (status: RealtimeSyncConnectionStatus, message: string) => void;
  setTimer?: (cb: () => void, ms: number) => any;
  clearTimer?: (handle: any) => void;
}

export interface ForceSyncResult<T extends GymStateTimestamped = GymStateTimestamped> {
  ok: boolean;
  pushed: boolean;
  pulled: boolean;
  appliedRemote: boolean;
  offlineFallback: boolean;
  lastUpdated: string | null;
  state: T | null;
  message: string;
}

export interface SupabaseRealtimeSyncManager<T extends GymStateTimestamped = GymStateTimestamped> {
  isEnabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  getStatus: () => RealtimeSyncConnectionStatus;
  getRecordId: () => string;
  subscribe: () => void;
  unsubscribe: () => void;
  scheduleDebouncedPush: (nextState: T, reason?: RealtimePushReason) => void;
  flushPendingPush: () => void;
  cancelPendingPush: () => void;
  pushNow: (nextState: T, reason?: RealtimePushReason) => Promise<{ pushed: boolean; lastUpdated: string | null; offlineFallback: boolean }>;
  forceSyncNow: () => Promise<ForceSyncResult<T>>;
  handleRealtimeRowUpdate: (row: GymStateRowPayload<T>) => boolean;
  destroy: () => void;
}

/**
 * Unified Supabase Realtime Auto-Sync Manager:
 * - Task 1: Persists `isAutoSyncEnabled` in localStorage.
 * - Task 2: Debounced (2000ms) automatic push with stamped `last_updated` timestamp.
 * - Task 3: Subscribes to Supabase Realtime `UPDATE` events for `gym_state` filtered by `id=eq.<recordId>`,
 *           comparing `last_updated` and immediately overwriting local state + localStorage when cloud is newer.
 * - Task 4: Graceful local-only fallback when offline/disconnected + manual `forceSyncNow()` push & pull.
 */
export function createSupabaseRealtimeSyncManager<T extends GymStateTimestamped = GymStateTimestamped>(
  options: RealtimeSyncManagerOptions<T>
): SupabaseRealtimeSyncManager<T> {
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const storageKey = options.storageKey || 'bws_vegan_7am_app_v1';
  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const checkOnline =
    options.isOnlineFn ||
    (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const debounceMs = options.debounceMs ?? AUTO_SYNC_DEBOUNCE_MS;

  let enabled = loadAutoSyncPreference(storage);
  let status: RealtimeSyncConnectionStatus = enabled ? 'connecting' : 'disabled';
  let activeChannel: any = null;
  let activeSubscribedRecordId = '';
  let isApplyingRemote = false;

  function resolveClient(): SupabaseClientLike | null {
    if (options.supabaseClient !== undefined) {
      return options.supabaseClient as SupabaseClientLike | null;
    }
    return getSupabaseClient();
  }

  function updateStatus(next: RealtimeSyncConnectionStatus, message: string) {
    status = next;
    options.onStatusChange?.(next, message);
  }

  function persistLocalSnapshot(nextState: T) {
    if (!storage) return;
    try {
      storage.setItem(storageKey, serializeStateForPersistence(nextState));
    } catch {
      // Ignore storage quota issues
    }
  }

  async function pushNow(
    nextState: T,
    reason: RealtimePushReason = 'state_mutation'
  ): Promise<{ pushed: boolean; lastUpdated: string | null; offlineFallback: boolean }> {
    const stamped = stampGymStateLastUpdated(
      nextState,
      getStateLastUpdatedIso(nextState) || new Date().toISOString()
    );
    persistLocalSnapshot(stamped);

    if (!checkOnline()) {
      updateStatus('offline', 'Offline — saved safely on this device.');
      return { pushed: false, lastUpdated: stamped.last_updated || null, offlineFallback: true };
    }

    const recordId = options.getRecordId() || resolveGymStateRecordId(stamped?.userProfile?.email);
    const effectiveIso = stamped.last_updated || new Date().toISOString();
    const client = resolveClient();

    // 1. Prefer direct Supabase upsert when the public Supabase client is configured
    if (client && typeof client.from === 'function') {
      try {
        const cleanPayload = JSON.parse(serializeStateForPersistence(stamped));
        const upsertRows: Array<{ id: string; data: Record<string, any>; updated_at: string }> = [
          { id: recordId, data: cleanPayload, updated_at: effectiveIso }
        ];
        if (recordId !== 'default') {
          upsertRows.push({ id: 'default', data: cleanPayload, updated_at: effectiveIso });
        }
        const query = client.from('gym_state').upsert(upsertRows, { onConflict: 'id' });
        const result = await query;
        if (!result || !result.error) {
          updateStatus(
            activeChannel ? 'connected' : 'local_only',
            reason === 'manual_force_sync'
              ? 'Synced to cloud just now.'
              : 'Progress saved to the cloud.'
          );
          return { pushed: true, lastUpdated: effectiveIso, offlineFallback: false };
        }
      } catch {
        // Fall through to /api/state REST endpoint
      }
    }

    // 2. Fallback to existing /api/state endpoint (handles server-side Supabase credentials on Vercel)
    const endpoint = String(options.getApiEndpoint() || '').trim();
    if (endpoint && fetchFn) {
      try {
        const payloadStr = serializeStateForPersistence(stamped);
        const resp = await fetchFn(endpoint, {
          method: 'POST',
          cache: 'no-store',
          keepalive: payloadStr.length < 60000,
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr
        });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && json && json.configured !== false && json.saved !== false) {
          const serverTs =
            (typeof json.last_updated === 'string' && json.last_updated) ||
            (typeof json.updatedAt === 'string' && json.updatedAt) ||
            effectiveIso;
          stampGymStateLastUpdated(stamped, serverTs);
          persistLocalSnapshot(stamped);
          updateStatus(
            activeChannel ? 'connected' : 'local_only',
            'Progress saved to the cloud.'
          );
          return { pushed: true, lastUpdated: serverTs, offlineFallback: false };
        }
      } catch {
        updateStatus('offline', 'Offline — saved safely on this device.');
        return { pushed: false, lastUpdated: effectiveIso, offlineFallback: true };
      }
    }

    updateStatus('local_only', 'Saved on this device.');
    return { pushed: false, lastUpdated: effectiveIso, offlineFallback: true };
  }

  const debouncedPush = createDebounce<[T, RealtimePushReason]>(
    (stateToPush, reason) => {
      if (!enabled) return;
      void pushNow(stateToPush, reason);
    },
    debounceMs,
    { setTimer: options.setTimer, clearTimer: options.clearTimer }
  );

  function handleRealtimeRowUpdate(row: GymStateRowPayload<T>): boolean {
    if (!enabled) return false;
    const localState = options.getLocalState();
    const evalResult = evaluateRealtimeIncomingPayload(localState, row);
    if (!evalResult.shouldApply || !evalResult.incomingState) {
      return false;
    }

    // Loop protection: cancel any pending debounced push and apply remote payload atomically
    debouncedPush.cancel();
    isApplyingRemote = true;
    try {
      persistLocalSnapshot(evalResult.incomingState);
      options.onRemoteStateApplied(
        evalResult.incomingState,
        evalResult.incomingTimestampIso || new Date().toISOString()
      );
      updateStatus('connected', 'Updated automatically from your other screen.');
      return true;
    } finally {
      isApplyingRemote = false;
    }
  }

  function unsubscribe() {
    const client = resolveClient();
    if (activeChannel && client && typeof client.removeChannel === 'function') {
      try {
        void client.removeChannel(activeChannel);
      } catch {
        // Ignore teardown errors
      }
    }
    activeChannel = null;
    activeSubscribedRecordId = '';
  }

  function subscribe() {
    if (!enabled) {
      unsubscribe();
      updateStatus('disabled', 'Auto-Sync is off. Saving on this device only.');
      return;
    }

    if (!checkOnline()) {
      unsubscribe();
      updateStatus('offline', 'Offline — saving on this device until back online.');
      return;
    }

    const client = resolveClient();
    const recordId = options.getRecordId() || 'default';

    if (!client || typeof client.channel !== 'function') {
      updateStatus('local_only', 'Auto-Sync ready. Your progress saves on this device and syncs automatically.');
      return;
    }

    if (activeChannel && activeSubscribedRecordId === recordId) {
      return;
    }

    unsubscribe();
    activeSubscribedRecordId = recordId;
    updateStatus('connecting', 'Connecting live device sync...');

    try {
      const channelName = `gym_state_realtime_${recordId.replace(/[^a-z0-9_@.-]/gi, '_')}`;
      const channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'gym_state',
            filter: `id=eq.${recordId}`
          },
          (payload) => {
            const incomingRow = (payload && payload.new ? payload.new : null) as GymStateRowPayload<T> | null;
            if (incomingRow) {
              handleRealtimeRowUpdate(incomingRow);
            }
          }
        )
        .subscribe((subStatus) => {
          if (subStatus === 'SUBSCRIBED') {
            updateStatus('connected', 'Live sync connected across your devices.');
          } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
            updateStatus('disconnected', 'Connection paused — saving safely on this device.');
          } else if (subStatus === 'CLOSED') {
            if (enabled) {
              updateStatus('disconnected', 'Live link closed — saving safely on this device.');
            }
          }
        });
      activeChannel = channel;
    } catch {
      updateStatus('disconnected', 'Could not open live link — saving safely on this device.');
    }
  }

  function scheduleDebouncedPush(nextState: T, reason: RealtimePushReason = 'state_mutation') {
    if (isApplyingRemote) return;
    // Always stamp and save locally first so no progress is ever lost
    const stamped = stampGymStateLastUpdated(nextState, new Date().toISOString());
    persistLocalSnapshot(stamped);

    if (!enabled) {
      updateStatus('disabled', 'Saved on this device only.');
      return;
    }
    if (!checkOnline()) {
      updateStatus('offline', 'Offline — saved on this device.');
      return;
    }
    debouncedPush.call(stamped, reason);
  }

  async function forceSyncNow(): Promise<ForceSyncResult<T>> {
    debouncedPush.cancel();
    const localState = options.getLocalState();

    if (!checkOnline()) {
      persistLocalSnapshot(localState);
      updateStatus('offline', 'You are offline. Progress stays saved on this device.');
      return {
        ok: false,
        pushed: false,
        pulled: false,
        appliedRemote: false,
        offlineFallback: true,
        lastUpdated: getStateLastUpdatedIso(localState),
        state: localState,
        message: 'You are offline. Your progress is safely saved on this device.'
      };
    }

    const recordId = options.getRecordId() || resolveGymStateRecordId(localState?.userProfile?.email);
    const client = resolveClient();
    let pulled = false;
    let appliedRemote = false;
    let pushed = false;
    let finalState: T = localState;

    // Step 1: Pull latest cloud row (prefer direct Supabase table read, fall back to /api/state)
    let cloudPulledRow: GymStateRowPayload<T> | null = null;
    if (client && typeof client.from === 'function') {
      try {
        const res = await client
          .from('gym_state')
          .select('id, data, updated_at')
          .eq('id', recordId)
          .maybeSingle();
        if (res && !res.error && res.data) {
          cloudPulledRow = res.data as GymStateRowPayload<T>;
          pulled = true;
        }
      } catch {
        // Fall through to /api/state
      }
    }

    if (cloudPulledRow) {
      const evalRes = evaluateRealtimeIncomingPayload(localState, cloudPulledRow);
      if (evalRes.shouldApply && evalRes.incomingState) {
        isApplyingRemote = true;
        try {
          persistLocalSnapshot(evalRes.incomingState);
          options.onRemoteStateApplied(
            evalRes.incomingState,
            evalRes.incomingTimestampIso || new Date().toISOString()
          );
          finalState = evalRes.incomingState;
          appliedRemote = true;
        } finally {
          isApplyingRemote = false;
        }
      }
    } else {
      const endpoint = String(options.getApiEndpoint() || '').trim();
      if (endpoint && fetchFn) {
        const truth = await fetchLatestCloudStateAsSingleSourceOfTruth<T>({
          endpoint,
          localState,
          storageKey,
          storage,
          fetchImpl: fetchFn,
          forceRemoteOnInit: false,
          pushLocalIfNewer: false
        });
        if (truth.remoteLastUpdated) pulled = true;
        if (truth.appliedRemote && truth.state) {
          isApplyingRemote = true;
          try {
            persistLocalSnapshot(truth.state);
            options.onRemoteStateApplied(
              truth.state,
              truth.remoteLastUpdated || new Date().toISOString()
            );
            finalState = truth.state;
            appliedRemote = true;
          } finally {
            isApplyingRemote = false;
          }
        }
      }
    }

    // Step 2: If cloud was NOT newer, push local state up so all devices receive the newest snapshot
    if (!appliedRemote) {
      const pushRes = await pushNow(finalState, 'manual_force_sync');
      pushed = pushRes.pushed;
    }

    // Re-subscribe channel if enabled and disconnected
    if (enabled && !activeChannel) {
      subscribe();
    }

    const ok = appliedRemote || pushed || pulled;
    const message = appliedRemote
      ? 'Updated this screen with newer progress from the cloud.'
      : pushed
        ? 'All devices are now synced with your latest progress.'
        : 'Saved on this device. Connect cloud keys to sync other screens.';

    return {
      ok,
      pushed,
      pulled,
      appliedRemote,
      offlineFallback: !ok,
      lastUpdated: getStateLastUpdatedIso(finalState),
      state: finalState,
      message
    };
  }

  function setEnabled(nextEnabled: boolean) {
    enabled = saveAutoSyncPreference(nextEnabled, storage);
    if (enabled) {
      subscribe();
    } else {
      debouncedPush.cancel();
      unsubscribe();
      updateStatus('disabled', 'Auto-Sync is off. Saving on this device only.');
    }
  }

  function destroy() {
    debouncedPush.cancel();
    unsubscribe();
  }

  return {
    isEnabled: () => enabled,
    setEnabled,
    getStatus: () => status,
    getRecordId: () => options.getRecordId() || 'default',
    subscribe,
    unsubscribe,
    scheduleDebouncedPush,
    flushPendingPush: () => debouncedPush.flush(),
    cancelPendingPush: () => debouncedPush.cancel(),
    pushNow,
    forceSyncNow,
    handleRealtimeRowUpdate,
    destroy
  };
}
