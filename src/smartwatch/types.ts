export type WatchPlatform = 'watchos' | 'wearos';

export type WatchHapticPattern = 'rest_complete' | 'set_logged' | 'pr_achieved' | 'warning';

export interface WatchActiveSetPayload {
  week: number;
  dayIdx: number;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  targetWeight: number;
  targetReps: string;
  unit: 'lbs' | 'kg';
}

export interface WatchRestTimerPayload {
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  nextExerciseName: string;
}

export interface WatchInboundSetCompletion {
  exerciseId: string;
  setNumber: number;
  completedWeight: number;
  completedReps: number;
  unit: 'lbs' | 'kg';
  completedAtIso: string;
  sourcePlatform: WatchPlatform;
}

export interface WatchBridgeResponse {
  ok: boolean;
  platform: WatchPlatform;
  channel: string;
  deliveredAtIso: string;
  isStub: boolean;
  note: string;
}

export interface CompanionWatchClient {
  platform: WatchPlatform;
  isReachable: () => Promise<boolean>;
  pushActiveSet: (payload: WatchActiveSetPayload) => Promise<WatchBridgeResponse>;
  pushRestTimerState: (payload: WatchRestTimerPayload) => Promise<WatchBridgeResponse>;
  triggerHaptic: (pattern: WatchHapticPattern) => Promise<WatchBridgeResponse>;
  subscribeToSetCompletions: (
    listener: (event: WatchInboundSetCompletion) => void
  ) => () => void;
}
