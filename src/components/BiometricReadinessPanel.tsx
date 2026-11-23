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
}

export const BiometricReadinessPanel: React.FC<BiometricReadinessPanelProps> = ({
  snapshot,
  plannedTotalSets,
  onSyncSnapshot
}) => {
  const adjustment = calculateBiometricVolumeAdjustment(plannedTotalSets, snapshot);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/90 p-3.5 text-left">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-white">Sleep &amp; Steps Biometric Sync</h3>
        <span className="rounded-md bg-sky-600/25 px-2 py-0.5 text-xs font-extrabold text-sky-200">
          Volume: {Math.round(adjustment.volumeMultiplier * 100)}%
        </span>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{adjustment.eli12Summary}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={async () => onSyncSnapshot(await fetchAppleHealthKitBiometricsStub())}
          className="min-h-[42px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-100 hover:border-sky-400"
        >
          Sync Apple HealthKit
        </button>
        <button
          type="button"
          onClick={async () => onSyncSnapshot(await fetchGoogleHealthConnectBiometricsStub())}
          className="min-h-[42px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-100 hover:border-emerald-400"
        >
          Sync Health Connect
        </button>
      </div>

      <button
        type="button"
        onClick={async () =>
          onSyncSnapshot(await fetchAppleHealthKitBiometricsStub({ sleepHours: 4.5, dailySteps: 9100 }))
        }
        className="mt-2 min-h-[42px] w-full rounded-xl border border-amber-500/60 bg-amber-600/20 px-3 py-2 text-xs font-extrabold text-amber-100 hover:bg-amber-600/30"
      >
        Test Low Sleep (4.5h) → Lower Sets by 10%
      </button>
    </section>
  );
};
