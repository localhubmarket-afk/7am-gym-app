import type {
  WatchActiveSetPayload,
  WatchBridgeResponse,
  WatchHapticPattern,
  WatchPlatform,
  WatchRestTimerPayload
} from './types';
import { WatchConnectivityStub } from './watchos/WatchConnectivityStub';
import { WearDataLayerStub } from './wearos/WearDataLayerStub';

export function createSmartwatchBridge() {
  const watchOS = new WatchConnectivityStub();
  const wearOS = new WearDataLayerStub();

  function getClient(platform: WatchPlatform) {
    return platform === 'watchos' ? watchOS : wearOS;
  }

  return {
    watchOS,
    wearOS,
    getClient,
    async broadcastActiveSet(payload: WatchActiveSetPayload): Promise<WatchBridgeResponse[]> {
      return Promise.all([watchOS.pushActiveSet(payload), wearOS.pushActiveSet(payload)]);
    },
    async broadcastRestTimer(payload: WatchRestTimerPayload): Promise<WatchBridgeResponse[]> {
      return Promise.all([watchOS.pushRestTimerState(payload), wearOS.pushRestTimerState(payload)]);
    },
    async broadcastHaptic(pattern: WatchHapticPattern): Promise<WatchBridgeResponse[]> {
      return Promise.all([watchOS.triggerHaptic(pattern), wearOS.triggerHaptic(pattern)]);
    }
  };
}
