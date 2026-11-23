import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAutoSupabaseSyncEngine,
  fetchLatestCloudStateAsSingleSourceOfTruth,
  getStateLastUpdatedIso,
  stampGymStateLastUpdated,
  type AutoSupabaseSyncEngine,
  type AutoSyncTriggerReason,
  type GymStateTimestamped,
  type TruthSourceWinner
} from '../utils/workoutSyncEngine';
import { serializeStateForPersistence } from '../utils/workoutLogic';
import {
  AUTO_SYNC_DEBOUNCE_MS,
  createSupabaseRealtimeSyncManager,
  loadAutoSyncPreference,
  saveAutoSyncPreference,
  type ForceSyncResult,
  type RealtimeSyncConnectionStatus,
  type SupabaseClientLike,
  type SupabaseRealtimeSyncManager
} from '../utils/realtimeAutoSync';
import { resolveGymStateRecordId } from '../lib/supabaseClient';

export interface UseAutoGymSyncOptions<T extends GymStateTimestamped> {
  storageKey: string;
  endpointUrl: string;
  initialState: T;
  /** Optional explicit user email / record id for Supabase Realtime row filter */
  userEmail?: string | null;
  /** Optional custom Supabase client (defaults to singleton Vite client) */
  supabaseClient?: SupabaseClientLike | null;
  /** Debounce delay in ms for automatic cloud pushes (defaults to 2000ms) */
  backgroundDebounceMs?: number;
  onHydratedFromCloud?: (cloudState: T) => void;
}

export interface UseAutoGymSyncReturn<T extends GymStateTimestamped> {
  gymState: T;
  lastUpdated: string | null;
  truthSource: TruthSourceWinner | null;
  syncStatus: 'idle' | 'syncing' | 'saved' | 'local_only' | 'paused_undo' | 'error';
  isAutoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  toggleAutoSyncEnabled: () => void;
  realtimeStatus: RealtimeSyncConnectionStatus;
  realtimeMessage: string;
  isForcingSync: boolean;
  updateAndSyncState: (
    updater: (prev: T) => T,
    reason: AutoSyncTriggerReason,
    immediate?: boolean
  ) => void;
  logSetAndSync: (updater: (prev: T) => T) => void;
  toggleCheckboxAndSync: (updater: (prev: T) => T) => void;
  adjustTimerAndSync: (updater: (prev: T) => T) => void;
  reconcileWithSupabase: (forceRemoteOnInit?: boolean) => Promise<void>;
  forceSyncNow: () => Promise<ForceSyncResult<T>>;
}

/**
 * React hook implementing:
 * 1. Task 1: Persisted `isAutoSyncEnabled` toggle preference in localStorage.
 * 2. Task 2: Debounced (2000ms) `useEffect` state mutation listener pushing `gym_state` + `last_updated` to Supabase.
 * 3. Task 3: Supabase Realtime `UPDATE` channel subscription on the user's `gym_state` row, overwriting local React
 *    state and localStorage immediately whenever the incoming cloud `last_updated` timestamp is strictly newer.
 * 4. Task 4: Graceful local-only fallback when offline/disconnected + manual `forceSyncNow()` push & pull.
 */
export function useAutoGymSync<T extends GymStateTimestamped>({
  storageKey,
  endpointUrl,
  initialState,
  userEmail,
  supabaseClient,
  backgroundDebounceMs = AUTO_SYNC_DEBOUNCE_MS,
  onHydratedFromCloud
}: UseAutoGymSyncOptions<T>): UseAutoGymSyncReturn<T> {
  const [gymState, setGymState] = useState<T>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as T;
          if (parsed && typeof parsed === 'object') {
            return { ...initialState, ...parsed };
          }
        }
      } catch {
        // Fallback to initialState if localStorage is unavailable or invalid
      }
    }
    return initialState;
  });

  const [isAutoSyncEnabled, setIsAutoSyncEnabledState] = useState<boolean>(() =>
    loadAutoSyncPreference()
  );
  const [truthSource, setTruthSource] = useState<TruthSourceWinner | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    'idle' | 'syncing' | 'saved' | 'local_only' | 'paused_undo' | 'error'
  >('idle');
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeSyncConnectionStatus>(() =>
    loadAutoSyncPreference() ? 'connecting' : 'disabled'
  );
  const [realtimeMessage, setRealtimeMessage] = useState<string>('');
  const [isForcingSync, setIsForcingSync] = useState<boolean>(false);

  const stateRef = useRef<T>(gymState);
  stateRef.current = gymState;

  const endpointRef = useRef<string>(endpointUrl);
  endpointRef.current = endpointUrl;

  const userEmailRef = useRef<string | null | undefined>(userEmail);
  userEmailRef.current = userEmail;

  const onHydratedRef = useRef(onHydratedFromCloud);
  onHydratedRef.current = onHydratedFromCloud;

  const isReconcilingRef = useRef(false);
  const isApplyingRemoteUpdateRef = useRef(false);
  const hasMountedMutationEffectRef = useRef(false);
  const lastPushedSignatureRef = useRef<string>('');

  const persistLocalOnly = useCallback(
    (nextState: T) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(storageKey, serializeStateForPersistence(nextState));
      } catch {
        // Ignore storage quota issues
      }
    },
    [storageKey]
  );

  const engineRef = useRef<AutoSupabaseSyncEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = createAutoSupabaseSyncEngine({
      getState: () => stateRef.current,
      getEndpoint: () => endpointRef.current,
      backgroundDebounceMs,
      onStatusChange: (status) => {
        setSyncStatus(status.phase);
      }
    });
  }

  const realtimeManagerRef = useRef<SupabaseRealtimeSyncManager<T> | null>(null);
  if (!realtimeManagerRef.current) {
    realtimeManagerRef.current = createSupabaseRealtimeSyncManager<T>({
      getLocalState: () => stateRef.current,
      getRecordId: () =>
        resolveGymStateRecordId(userEmailRef.current || stateRef.current?.userProfile?.email),
      getApiEndpoint: () => endpointRef.current,
      storageKey,
      debounceMs: backgroundDebounceMs,
      supabaseClient,
      onRemoteStateApplied: (incomingState) => {
        const mergedRemote = { ...initialState, ...incomingState } as T;
        isApplyingRemoteUpdateRef.current = true;
        stateRef.current = mergedRemote;
        lastPushedSignatureRef.current = serializeStateForPersistence(mergedRemote);
        setGymState(mergedRemote);
        persistLocalOnly(mergedRemote);
        setTruthSource('cloud');
        setSyncStatus('saved');
        onHydratedRef.current?.(mergedRemote);
        queueMicrotask(() => {
          isApplyingRemoteUpdateRef.current = false;
        });
      },
      onStatusChange: (nextStatus, msg) => {
        setRealtimeStatus(nextStatus);
        setRealtimeMessage(msg);
        if (nextStatus === 'offline' || nextStatus === 'disconnected' || nextStatus === 'disabled') {
          setSyncStatus('local_only');
        }
      }
    });
  }

  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    const clean = saveAutoSyncPreference(enabled);
    setIsAutoSyncEnabledState(clean);
    realtimeManagerRef.current?.setEnabled(clean);
  }, []);

  const toggleAutoSyncEnabled = useCallback(() => {
    setAutoSyncEnabled(!isAutoSyncEnabled);
  }, [isAutoSyncEnabled, setAutoSyncEnabled]);

  // Task 1 / Truth Engine: Fetch latest cloud gym_state and reconcile by `last_updated`
  const reconcileWithSupabase = useCallback(
    async (forceRemoteOnInit = false) => {
      const endpoint = endpointRef.current;
      if (!endpoint || isReconcilingRef.current) return;
      if (!isAutoSyncEnabled && !forceRemoteOnInit) return;
      isReconcilingRef.current = true;
      engineRef.current?.cancelPendingBackgroundPush();
      realtimeManagerRef.current?.cancelPendingPush();

      try {
        const result = await fetchLatestCloudStateAsSingleSourceOfTruth<T>({
          endpoint,
          localState: stateRef.current,
          storageKey,
          storage: typeof window !== 'undefined' ? window.localStorage : null,
          forceRemoteOnInit,
          pushLocalIfNewer: isAutoSyncEnabled
        });

        setTruthSource(result.winner);

        if (result.appliedRemote && result.state) {
          const mergedRemote = { ...initialState, ...result.state } as T;
          isApplyingRemoteUpdateRef.current = true;
          stateRef.current = mergedRemote;
          lastPushedSignatureRef.current = serializeStateForPersistence(mergedRemote);
          setGymState(mergedRemote);
          persistLocalOnly(mergedRemote);
          setSyncStatus('saved');
          onHydratedRef.current?.(mergedRemote);
          queueMicrotask(() => {
            isApplyingRemoteUpdateRef.current = false;
          });
        } else if (result.shouldPushLocalToCloud && isAutoSyncEnabled) {
          setSyncStatus('saved');
        }
      } finally {
        isReconcilingRef.current = false;
      }
    },
    [initialState, isAutoSyncEnabled, persistLocalOnly, storageKey]
  );

  // Task 2: Automatic Push (Debounced 2000ms State Mutation Listener)
  useEffect(() => {
    const serialized = serializeStateForPersistence(gymState);
    if (!hasMountedMutationEffectRef.current) {
      hasMountedMutationEffectRef.current = true;
      lastPushedSignatureRef.current = serialized;
      return;
    }
    if (isApplyingRemoteUpdateRef.current) {
      lastPushedSignatureRef.current = serialized;
      return;
    }
    if (serialized === lastPushedSignatureRef.current) {
      return;
    }
    lastPushedSignatureRef.current = serialized;
    persistLocalOnly(gymState);

    if (!isAutoSyncEnabled) {
      setSyncStatus('local_only');
      return;
    }
    setSyncStatus('syncing');
    realtimeManagerRef.current?.scheduleDebouncedPush(gymState, 'state_mutation');
  }, [gymState, isAutoSyncEnabled, persistLocalOnly]);

  // Task 3 & Task 4: Supabase Realtime UPDATE Subscription + Online/Offline Graceful Fallback
  const activeRecordId = resolveGymStateRecordId(userEmail || gymState?.userProfile?.email);
  useEffect(() => {
    const manager = realtimeManagerRef.current;
    if (!manager) return;

    manager.setEnabled(isAutoSyncEnabled);
    if (isAutoSyncEnabled) {
      manager.subscribe();
      void reconcileWithSupabase(false);
    } else {
      manager.unsubscribe();
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return () => {
        manager.unsubscribe();
      };
    }

    const handleResume = () => {
      if (!isAutoSyncEnabled) return;
      if (document.visibilityState === 'visible') {
        manager.subscribe();
        void reconcileWithSupabase(false);
      } else {
        manager.flushPendingPush();
        void engineRef.current?.flushPendingBackgroundPush();
      }
    };

    const handleOnline = () => {
      if (!isAutoSyncEnabled) return;
      manager.subscribe();
      void reconcileWithSupabase(false);
    };

    const handleOffline = () => {
      manager.unsubscribe();
      setRealtimeStatus('offline');
      setRealtimeMessage('Offline — saving safely on this device.');
      setSyncStatus('local_only');
    };

    const handlePageHide = () => {
      if (!isAutoSyncEnabled) return;
      manager.flushPendingPush();
      void engineRef.current?.flushPendingBackgroundPush();
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pagehide', handlePageHide);
      manager.unsubscribe();
    };
  }, [activeRecordId, isAutoSyncEnabled, reconcileWithSupabase]);

  // Task 4: Secondary manual fallback ("Force Sync Now") triggering both pull and push
  const forceSyncNow = useCallback(async (): Promise<ForceSyncResult<T>> => {
    const manager = realtimeManagerRef.current;
    if (!manager) {
      return {
        ok: false,
        pushed: false,
        pulled: false,
        appliedRemote: false,
        offlineFallback: true,
        lastUpdated: getStateLastUpdatedIso(stateRef.current),
        state: stateRef.current,
        message: 'Saved on this device.'
      };
    }
    setIsForcingSync(true);
    setSyncStatus('syncing');
    try {
      const result = await manager.forceSyncNow();
      setSyncStatus(result.ok ? 'saved' : 'local_only');
      setRealtimeMessage(result.message);
      return result;
    } finally {
      setIsForcingSync(false);
    }
  }, []);

  // Preserved active-input helpers (stamp `last_updated`, save locally, and trigger debounced sync when enabled)
  const updateAndSyncState = useCallback(
    (updater: (prev: T) => T, reason: AutoSyncTriggerReason, immediate = false) => {
      setGymState((prev) => {
        const draft = updater(prev);
        const stamped = stampGymStateLastUpdated({ ...draft }, new Date().toISOString());
        stateRef.current = stamped;
        persistLocalOnly(stamped);
        if (isAutoSyncEnabled && immediate) {
          void engineRef.current?.pushGymStateInBackground(reason, true);
        }
        return stamped;
      });
    },
    [isAutoSyncEnabled, persistLocalOnly]
  );

  const logSetAndSync = useCallback(
    (updater: (prev: T) => T) => updateAndSyncState(updater, 'set_logged'),
    [updateAndSyncState]
  );

  const toggleCheckboxAndSync = useCallback(
    (updater: (prev: T) => T) => updateAndSyncState(updater, 'checkbox_toggled'),
    [updateAndSyncState]
  );

  const adjustTimerAndSync = useCallback(
    (updater: (prev: T) => T) => updateAndSyncState(updater, 'timer_adjusted'),
    [updateAndSyncState]
  );

  return {
    gymState,
    lastUpdated: getStateLastUpdatedIso(gymState),
    truthSource,
    syncStatus,
    isAutoSyncEnabled,
    setAutoSyncEnabled,
    toggleAutoSyncEnabled,
    realtimeStatus,
    realtimeMessage,
    isForcingSync,
    updateAndSyncState,
    logSetAndSync,
    toggleCheckboxAndSync,
    adjustTimerAndSync,
    reconcileWithSupabase,
    forceSyncNow
  };
}

