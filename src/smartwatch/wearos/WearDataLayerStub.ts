import type {
  CompanionWatchClient,
  WatchActiveSetPayload,
  WatchBridgeResponse,
  WatchHapticPattern,
  WatchInboundSetCompletion,
  WatchRestTimerPayload
} from '../types';

/**
 * Android Wear OS Companion Stub (mirrors Wear Data Layer MessageClient & DataClient API).
 * Ready to bridge into Capacitor / React Native Wearable Data Layer plugin.
 */
export class WearDataLayerStub implements CompanionWatchClient {
  public readonly platform = 'wearos' as const;
  private listeners = new Set<(event: WatchInboundSetCompletion) => void>();
  public lastMessagePath: string | null = null;

  async isReachable(): Promise<boolean> {
    return true;
  }

  async pushActiveSet(payload: WatchActiveSetPayload): Promise<WatchBridgeResponse> {
    this.lastMessagePath = '/budgetgym/active_set';
    return {
      ok: true,
      platform: this.platform,
      channel: 'Wearable.DataClient:/budgetgym/active_set',
      deliveredAtIso: new Date().toISOString(),
      isStub: true,
      note: `Synced set ${payload.setNumber}/${payload.totalSets} of ${payload.exerciseName} to Wear OS Data Layer.`
    };
  }

  async pushRestTimerState(payload: WatchRestTimerPayload): Promise<WatchBridgeResponse> {
    this.lastMessagePath = '/budgetgym/rest_timer';
    return {
      ok: true,
      platform: this.platform,
      channel: 'Wearable.MessageClient:/budgetgym/rest_timer',
      deliveredAtIso: new Date().toISOString(),
      isStub: true,
      note: `Synced ${payload.remainingSeconds}s rest timer to Wear OS.`
    };
  }

  async triggerHaptic(pattern: WatchHapticPattern): Promise<WatchBridgeResponse> {
    this.lastMessagePath = `/budgetgym/haptic/${pattern}`;
    return {
      ok: true,
      platform: this.platform,
      channel: `Wearable.MessageClient:/budgetgym/haptic/${pattern}`,
      deliveredAtIso: new Date().toISOString(),
      isStub: true,
      note: `Triggered Wear OS wrist vibration: ${pattern}.`
    };
  }

  subscribeToSetCompletions(listener: (event: WatchInboundSetCompletion) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  simulateInboundWatchCompletion(event: Omit<WatchInboundSetCompletion, 'sourcePlatform'>): void {
    const full: WatchInboundSetCompletion = { ...event, sourcePlatform: this.platform };
    this.listeners.forEach((fn) => fn(full));
  }
}
