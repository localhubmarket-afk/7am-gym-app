export type BiometricProvider = 'apple_healthkit' | 'google_health_connect' | 'manual_override';

export interface DailyBiometricsSnapshot {
  provider: BiometricProvider;
  dateIso: string;
  dailySteps: number;
  sleepHours: number;
  syncedAt: string;
  isStub: boolean;
}

export interface BiometricVolumeAdjustment {
  volumeMultiplier: number;
  reductionPercent: number;
  reasonCode: 'low_sleep_recovery' | 'high_fatigue_combo' | 'normal_readiness';
  eli12Summary: string;
  adjustedTotalSets: number;
  originalTotalSets: number;
}

export async function fetchAppleHealthKitBiometricsStub(overrides?: {
  dailySteps?: number;
  sleepHours?: number;
}): Promise<DailyBiometricsSnapshot> {
  return {
    provider: 'apple_healthkit',
    dateIso: new Date().toISOString().slice(0, 10),
    dailySteps: typeof overrides?.dailySteps === 'number' ? Math.max(0, Math.round(overrides.dailySteps)) : 8420,
    sleepHours: typeof overrides?.sleepHours === 'number' ? Math.max(0, Math.min(16, overrides.sleepHours)) : 6.8,
    syncedAt: new Date().toISOString(),
    isStub: true
  };
}

export async function fetchGoogleHealthConnectBiometricsStub(overrides?: {
  dailySteps?: number;
  sleepHours?: number;
}): Promise<DailyBiometricsSnapshot> {
  return {
    provider: 'google_health_connect',
    dateIso: new Date().toISOString().slice(0, 10),
    dailySteps: typeof overrides?.dailySteps === 'number' ? Math.max(0, Math.round(overrides.dailySteps)) : 9150,
    sleepHours: typeof overrides?.sleepHours === 'number' ? Math.max(0, Math.min(16, overrides.sleepHours)) : 7.2,
    syncedAt: new Date().toISOString(),
    isStub: true
  };
}

export function calculateBiometricVolumeAdjustment(
  originalTotalSets: number,
  biometrics: Pick<DailyBiometricsSnapshot, 'sleepHours' | 'dailySteps'> | null | undefined
): BiometricVolumeAdjustment {
  const safeOriginal = Math.max(0, Math.floor(Number(originalTotalSets) || 0));
  if (!biometrics || !Number.isFinite(Number(biometrics.sleepHours))) {
    return {
      volumeMultiplier: 1.0,
      reductionPercent: 0,
      reasonCode: 'normal_readiness',
      eli12Summary: 'Standard workout volume (100%). Connect Apple Health or Health Connect to adjust for sleep.',
      adjustedTotalSets: safeOriginal,
      originalTotalSets: safeOriginal
    };
  }

  const sleep = Math.max(0, Number(biometrics.sleepHours));
  const steps = Math.max(0, Number(biometrics.dailySteps) || 0);

  if (sleep < 5 && steps >= 15000) {
    const mult = 0.85;
    const adjusted = safeOriginal > 0 ? Math.max(1, Math.round(safeOriginal * mult)) : 0;
    return {
      volumeMultiplier: mult,
      reductionPercent: 15,
      reasonCode: 'high_fatigue_combo',
      eli12Summary: `Sleep was ${sleep.toFixed(1)}h (under 5h) with ${steps.toLocaleString()} steps. We cut total sets by 15% to protect recovery.`,
      adjustedTotalSets: adjusted,
      originalTotalSets: safeOriginal
    };
  }

  if (sleep < 5) {
    const mult = 0.9;
    const adjusted = safeOriginal > 0 ? Math.max(1, Math.round(safeOriginal * mult)) : 0;
    return {
      volumeMultiplier: mult,
      reductionPercent: 10,
      reasonCode: 'low_sleep_recovery',
      eli12Summary: `Sleep was ${sleep.toFixed(1)}h (under 5h). We lowered today's total sets by 10% so you recover well.`,
      adjustedTotalSets: adjusted,
      originalTotalSets: safeOriginal
    };
  }

  return {
    volumeMultiplier: 1.0,
    reductionPercent: 0,
    reasonCode: 'normal_readiness',
    eli12Summary: `Recovery looks good (${sleep.toFixed(1)}h sleep, ${steps.toLocaleString()} steps). Full 100% workout volume active.`,
    adjustedTotalSets: safeOriginal,
    originalTotalSets: safeOriginal
  };
}

export function applyBiometricVolumeToExercises<T extends { sets: number; isCardio?: boolean }>(
  exercises: T[],
  biometrics: Pick<DailyBiometricsSnapshot, 'sleepHours' | 'dailySteps'> | null | undefined
): { exercises: T[]; adjustment: BiometricVolumeAdjustment } {
  const nonCardioTotal = (exercises || []).reduce(
    (sum, ex) => (ex && !ex.isCardio ? sum + Math.max(1, Number(ex.sets) || 1) : sum),
    0
  );
  const adjustment = calculateBiometricVolumeAdjustment(nonCardioTotal, biometrics);
  const setsToTrim = Math.max(0, nonCardioTotal - adjustment.adjustedTotalSets);

  if (setsToTrim <= 0) {
    return {
      exercises: (exercises || []).map((ex) => ({ ...ex })),
      adjustment
    };
  }

  const cloned = (exercises || []).map((ex) => ({ ...ex }));
  let remainingTrim = setsToTrim;

  const indices = cloned
    .map((ex, idx) => ({ idx, sets: Number(ex.sets) || 0, isCardio: Boolean(ex.isCardio) }))
    .filter((item) => !item.isCardio && item.sets > 1)
    .sort((a, b) => b.sets - a.sets);

  for (const item of indices) {
    if (remainingTrim <= 0) break;
    cloned[item.idx].sets = Math.max(1, cloned[item.idx].sets - 1);
    remainingTrim -= 1;
  }

  return {
    exercises: cloned,
    adjustment
  };
}
