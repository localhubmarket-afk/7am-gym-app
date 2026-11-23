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

export interface UseAutoGymSyncOptions<T extends GymStateTimestamped> {
  storageKey: string;
  endpointUrl: string;
  initialState: T;
  backgroundDebounceMs?: number;
  onHydratedFromCloud?: (cloudState: T) => void;
}

export interface UseAutoGymSyncReturn<T extends GymStateTimestamped> {
  gymState: T;
  lastUpdated: string | null;
  truthSource: TruthSourceWinner | null;
  syncStatus: 'idle' | 'syncing' | 'saved' | 'local_only' | 'paused_undo' | 'error';
  updateAndSyncState: (
    updater: (prev: T) => T,
    reason: AutoSyncTriggerReason,
    immediate?: boolean
  ) => void;
  logSetAndSync: (updater: (prev: T) => T) => void;
  toggleCheckboxAndSync: (updater: (prev: T) => T) => void;
  adjustTimerAndSync: (updater: (prev: T) => T) => void;
  reconcileWithSupabase: (forceRemoteOnInit?: boolean) => Promise<void>;
}

/**
 * React hook implementing:
 * 1. The "Most Advanced" Truth Engine (`last_updated` timestamp comparison on load, focus, and online resume).
 * 2. Automatic silent background synchronization to Supabase on every active input (Log Set, checkboxes, timers).
 */
export function useAutoGymSync<T extends GymStateTimestamped>({
  storageKey,
  endpointUrl,
  initialState,
  backgroundDebounceMs = 300,
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

  const [truthSource, setTruthSource] = useState<TruthSourceWinner | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'local_only' | 'paused_undo' | 'error'>('idle');

  const stateRef = useRef<T>(gymState);
  stateRef.current = gymState;

  const endpointRef = useRef<string>(endpointUrl);
  endpointRef.current = endpointUrl;

  const onHydratedRef = useRef(onHydratedFromCloud);
  onHydratedRef.current = onHydratedFromCloud;

  const isReconcilingRef = useRef(false);

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

  // Task 1: Fetch Supabase gym_state, compare `last_updated`, and enforce newest timestamp as Single Source of Truth
  const reconcileWithSupabase = useCallback(
    async (forceRemoteOnInit = false) => {
      const endpoint = endpointRef.current;
      if (!endpoint || isReconcilingRef.current) return;
      isReconcilingRef.current = true;
      engineRef.current?.cancelPendingBackgroundPush();

      try {
        const result = await fetchLatestCloudStateAsSingleSourceOfTruth<T>({
          endpoint,
          localState: stateRef.current,
          storageKey,
          storage: typeof window !== 'undefined' ? window.localStorage : null,
          forceRemoteOnInit,
          pushLocalIfNewer: true
        });

        setTruthSource(result.winner);

        if (result.appliedRemote && result.state) {
          const mergedRemote = { ...initialState, ...result.state } as T;
          stateRef.current = mergedRemote;
          setGymState(mergedRemote);
          persistLocalOnly(mergedRemote);
          setSyncStatus('saved');
          onHydratedRef.current?.(mergedRemote);
        } else if (result.shouldPushLocalToCloud) {
          setSyncStatus('saved');
        }
      } finally {
        isReconcilingRef.current = false;
      }
    },
    [initialState, persistLocalOnly, storageKey]
  );

  // Run Truth Engine instantly on app load and when switching back to the app (phone wake / tab focus / reconnect)
  useEffect(() => {
    void reconcileWithSupabase(false);

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        void reconcileWithSupabase(false);
      } else {
        void engineRef.current?.flushPendingBackgroundPush();
      }
    };

    const handleOnline = () => {
      void reconcileWithSupabase(false);
    };

    const handlePageHide = () => {
      void engineRef.current?.flushPendingBackgroundPush();
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleOnline);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [reconcileWithSupabase]);

  // Task 2: Silent background push attached to all active user inputs
  const updateAndSyncState = useCallback(
    (updater: (prev: T) => T, reason: AutoSyncTriggerReason, immediate = false) => {
      setGymState((prev) => {
        const draft = updater(prev);
        const stamped = stampGymStateLastUpdated({ ...draft }, new Date().toISOString());
        stateRef.current = stamped;
        persistLocalOnly(stamped);
        void engineRef.current?.pushGymStateInBackground(reason, immediate);
        return stamped;
      });
    },
    [persistLocalOnly]
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
    updateAndSyncState,
    logSetAndSync,
    toggleCheckboxAndSync,
    adjustTimerAndSync,
    reconcileWithSupabase
  };
}
