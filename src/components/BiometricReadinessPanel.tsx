import React from 'react';
import {
  calculateBiometricVolumeAdjustment,
  fetchAppleHealthKitBiometricsStub,
  fetchGoogleHealthConnectBiometricsStub,
  type DailyBiometricsSnapshot
} from '../utils/biometricSync';

export interface BiometricReadinessPanelProps {
  snapshot: DailyBiometricsSnapshot | null;
  plannedTotalSets: number;
  onSyncSnapshot: (snapshot: DailyBiometricsSnapshot) => void;
  onSyncToCloud?: (snapshot: DailyBiometricsSnapshot) => void | Promise<void>;
}

export const BiometricReadinessPanel: React.FC<BiometricReadinessPanelProps> = ({
  snapshot,
  plannedTotalSets,
  onSyncSnapshot,
  onSyncToCloud
}) => {
  const adjustment = calculateBiometricVolumeAdjustment(plannedTotalSets, snapshot);

  const handleSync = async (next: DailyBiometricsSnapshot) => {
    onSyncSnapshot(next);
    if (onSyncToCloud) {
      await onSyncToCloud(next);
    }
  };

  return (
    <section
      aria-label="Sleep, steps, and resting heart rate biometric sync"
      className="rounded-xl border border-slate-700 bg-slate-900/90 p-3.5 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-white">Sleep, Steps &amp; Heart Rate Sync</h3>
        <span className="rounded-md bg-sky-600/25 px-2 py-0.5 text-xs font-extrabold text-sky-200">
          Volume: {Math.round(adjustment.volumeMultiplier * 100)}%
        </span>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{adjustment.eli12Summary}</p>

      {snapshot && (
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-slate-700 bg-slate-950 p-2">
            <div className="text-[0.6875rem] font-bold text-slate-300">Sleep</div>
            <div className="text-sm font-extrabold text-white">{snapshot.sleepHours.toFixed(1)}h</div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-950 p-2">
            <div className="text-[0.6875rem] font-bold text-slate-300">Steps</div>
            <div className="text-sm font-extrabold text-white">{snapshot.dailySteps.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-950 p-2">
            <div className="text-[0.6875rem] font-bold text-slate-300">Rest HR</div>
            <div className="text-sm font-extrabold text-white">
              {snapshot.restingHeartRateBpm != null ? `${snapshot.restingHeartRateBpm} bpm` : '--'}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleSync(awaitSnapshot(fetchAppleHealthKitBiometricsStub()))}
          className="min-h-[48px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-100 hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          Sync Apple HealthKit
        </button>
        <button
          type="button"
          onClick={() => handleSync(awaitSnapshot(fetchGoogleHealthConnectBiometricsStub()))}
          className="min-h-[48px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-100 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          Sync Health Connect
        </button>
      </div>

      <button
        type="button"
        onClick={async () =>
          handleSync(
            await fetchAppleHealthKitBiometricsStub({
              sleepHours: 4.5,
              dailySteps: 9100,
              restingHeartRateBpm: 74,
              baselineRestingHeartRateBpm: 60
            })
          )
        }
        className="mt-2 min-h-[48px] w-full rounded-xl border border-amber-500/60 bg-amber-600/20 px-3 py-2 text-xs font-extrabold text-amber-100 hover:bg-amber-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        Test Low Sleep (4.5h) &amp; High Rest HR → Lower Sets
      </button>
    </section>
  );
};

async function awaitSnapshot(promise: Promise<DailyBiometricsSnapshot>): Promise<DailyBiometricsSnapshot> {
  return promise;
}
