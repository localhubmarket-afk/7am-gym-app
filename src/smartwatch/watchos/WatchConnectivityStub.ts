import type {
  CompanionWatchClient,
  WatchActiveSetPayload,
  WatchBridgeResponse,
  WatchHapticPattern,
  WatchInboundSetCompletion,
  WatchRestTimerPayload
} from '../types';

/**
 * Apple watchOS Companion Stub (mirrors WatchConnectivity WCSession API).
 * Ready to bridge into Capacitor / React Native native WCSession plugin.
 */
export class WatchConnectivityStub implements CompanionWatchClient {
  public readonly platform = 'watchos' as const;
  private listeners = new Set<(event: WatchInboundSetCompletion) => void>();
  public lastDispatchedContext: Record<string, unknown> | null = null;

  async isReachable(): Promise<boolean> {
    return true;
  }

  async pushActiveSet(payload: WatchActiveSetPayload): Promise<WatchBridgeResponse> {
    this.lastDispatchedContext = { channel: 'WCSession.updateApplicationContext', payload };
    return {
      ok: true,
      platform: this.platform,
      channel: 'WCSession.updateApplicationContext',
      deliveredAtIso: new Date().toISOString(),
      isStub: true,
      note: `Queued set ${payload.setNumber}/${payload.totalSets} of ${payload.exerciseName} for Apple Watch.`
    };
  }

  async pushRestTimerState(payload: WatchRestTimerPayload): Promise<WatchBridgeResponse> {
    this.lastDispatchedContext = { channel: 'WCSession.sendMessage.restTimer', payload };
    return {
      ok: true,
      platform: this.platform,
      channel: 'WCSession.sendMessage.restTimer',
      deliveredAtIso: new Date().toISOString(),
      isStub: true,
      note: `Synced ${payload.remainingSeconds}s rest timer to Apple Watch.`
    };
  }

  async triggerHaptic(pattern: WatchHapticPattern): Promise<WatchBridgeResponse> {
    return {
      ok: true,
      platform: this.platform,
      channel: `WKInterfaceDevice.play.${pattern}`,
      deliveredAtIso: new Date().toISOString(),
      isStub: true,
      note: `Triggered watchOS haptic pattern: ${pattern}.`
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
