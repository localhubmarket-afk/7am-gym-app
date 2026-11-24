export type BiometricProvider = 'apple_healthkit' | 'google_health_connect' | 'manual_override';

export interface DailyBiometricsSnapshot {
  provider: BiometricProvider;
  dateIso: string;
  dailySteps: number;
  sleepHours: number;
  /** Optional objective resting heart rate in BPM from Apple HealthKit or Google Health Connect */
  restingHeartRateBpm?: number | null;
  /** Optional user 14-day resting heart rate baseline in BPM for objective recovery delta */
  baselineRestingHeartRateBpm?: number | null;
  syncedAt: string;
  isStub: boolean;
}

export interface BiometricVolumeAdjustment {
  volumeMultiplier: number;
  reductionPercent: number;
  reasonCode:
    | 'low_sleep_recovery'
    | 'high_fatigue_combo'
    | 'elevated_rhr_recovery'
    | 'normal_readiness';
  eli12Summary: string;
  adjustedTotalSets: number;
  originalTotalSets: number;
}

export interface BiometricsSupabaseSyncResult {
  ok: boolean;
  configured: boolean;
  saved: boolean;
  biometrics: DailyBiometricsSnapshot | null;
  error?: string;
}

export async function fetchAppleHealthKitBiometricsStub(overrides?: {
  dailySteps?: number;
  sleepHours?: number;
  restingHeartRateBpm?: number;
  baselineRestingHeartRateBpm?: number;
}): Promise<DailyBiometricsSnapshot> {
  return {
    provider: 'apple_healthkit',
    dateIso: new Date().toISOString().slice(0, 10),
    dailySteps: typeof overrides?.dailySteps === 'number' ? Math.max(0, Math.round(overrides.dailySteps)) : 8420,
    sleepHours: typeof overrides?.sleepHours === 'number' ? Math.max(0, Math.min(16, overrides.sleepHours)) : 6.8,
    restingHeartRateBpm:
      typeof overrides?.restingHeartRateBpm === 'number'
        ? Math.max(25, Math.min(220, Math.round(overrides.restingHeartRateBpm)))
        : 62,
    baselineRestingHeartRateBpm:
      typeof overrides?.baselineRestingHeartRateBpm === 'number'
        ? Math.max(25, Math.min(220, Math.round(overrides.baselineRestingHeartRateBpm)))
        : 60,
    syncedAt: new Date().toISOString(),
    isStub: true
  };
}

export async function fetchGoogleHealthConnectBiometricsStub(overrides?: {
  dailySteps?: number;
  sleepHours?: number;
  restingHeartRateBpm?: number;
  baselineRestingHeartRateBpm?: number;
}): Promise<DailyBiometricsSnapshot> {
  return {
    provider: 'google_health_connect',
    dateIso: new Date().toISOString().slice(0, 10),
    dailySteps: typeof overrides?.dailySteps === 'number' ? Math.max(0, Math.round(overrides.dailySteps)) : 9150,
    sleepHours: typeof overrides?.sleepHours === 'number' ? Math.max(0, Math.min(16, overrides.sleepHours)) : 7.2,
    restingHeartRateBpm:
      typeof overrides?.restingHeartRateBpm === 'number'
        ? Math.max(25, Math.min(220, Math.round(overrides.restingHeartRateBpm)))
        : 64,
    baselineRestingHeartRateBpm:
      typeof overrides?.baselineRestingHeartRateBpm === 'number'
        ? Math.max(25, Math.min(220, Math.round(overrides.baselineRestingHeartRateBpm)))
        : 62,
    syncedAt: new Date().toISOString(),
    isStub: true
  };
}

export function calculateBiometricVolumeAdjustment(
  originalTotalSets: number,
  biometrics:
    | Pick<
        DailyBiometricsSnapshot,
        'sleepHours' | 'dailySteps' | 'restingHeartRateBpm' | 'baselineRestingHeartRateBpm'
      >
    | null
    | undefined
): BiometricVolumeAdjustment {
  const safeOriginal = Math.max(0, Math.floor(Number(originalTotalSets) || 0));
  if (!biometrics || !Number.isFinite(Number(biometrics.sleepHours))) {
    return {
      volumeMultiplier: 1.0,
      reductionPercent: 0,
      reasonCode: 'normal_readiness',
      eli12Summary:
        'Standard workout volume (100%). Connect Apple Health or Health Connect to adjust for sleep and resting heart rate.',
      adjustedTotalSets: safeOriginal,
      originalTotalSets: safeOriginal
    };
  }

  const sleep = Math.max(0, Number(biometrics.sleepHours));
  const steps = Math.max(0, Number(biometrics.dailySteps) || 0);
  const rhr =
    typeof biometrics.restingHeartRateBpm === 'number' && Number.isFinite(biometrics.restingHeartRateBpm)
      ? Math.round(biometrics.restingHeartRateBpm)
      : null;
  const baselineRhr =
    typeof biometrics.baselineRestingHeartRateBpm === 'number' &&
    Number.isFinite(biometrics.baselineRestingHeartRateBpm)
      ? Math.round(biometrics.baselineRestingHeartRateBpm)
      : 62;

  const rhrDelta = rhr !== null ? rhr - baselineRhr : 0;
  const hasElevatedRhr = rhr !== null && (rhrDelta >= 8 || rhr >= 85);

  if (sleep < 5 && (steps >= 15000 || hasElevatedRhr)) {
    const mult = 0.85;
    const adjusted = safeOriginal > 0 ? Math.max(1, Math.round(safeOriginal * mult)) : 0;
    const rhrNote = rhr !== null ? `, resting heart rate ${rhr} BPM` : '';
    return {
      volumeMultiplier: mult,
      reductionPercent: 15,
      reasonCode: 'high_fatigue_combo',
      eli12Summary: `Sleep was ${sleep.toFixed(1)}h (under 5h) with ${steps.toLocaleString()} steps${rhrNote}. We cut total sets by 15% to protect recovery.`,
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

  if (hasElevatedRhr && rhr !== null) {
    const mult = 0.9;
    const adjusted = safeOriginal > 0 ? Math.max(1, Math.round(safeOriginal * mult)) : 0;
    return {
      volumeMultiplier: mult,
      reductionPercent: 10,
      reasonCode: 'elevated_rhr_recovery',
      eli12Summary: `Resting heart rate is ${rhr} BPM (higher than usual). We lowered today's total sets by 10% so your body can recover.`,
      adjustedTotalSets: adjusted,
      originalTotalSets: safeOriginal
    };
  }

  const rhrSummary = rhr !== null ? `, ${rhr} BPM resting HR` : '';
  return {
    volumeMultiplier: 1.0,
    reductionPercent: 0,
    reasonCode: 'normal_readiness',
    eli12Summary: `Recovery looks good (${sleep.toFixed(1)}h sleep, ${steps.toLocaleString()} steps${rhrSummary}). Full 100% workout volume active.`,
    adjustedTotalSets: safeOriginal,
    originalTotalSets: safeOriginal
  };
}

export function applyBiometricVolumeToExercises<T extends { sets: number; isCardio?: boolean }>(
  exercises: T[],
  biometrics:
    | Pick<
        DailyBiometricsSnapshot,
        'sleepHours' | 'dailySteps' | 'restingHeartRateBpm' | 'baselineRestingHeartRateBpm'
      >
    | null
    | undefined
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

/**
 * Persists a DailyBiometricsSnapshot (sleep, steps, resting HR) to Supabase via /api/biometrics
 * so the deterministic progression engine has objective recovery context across devices.
 */
export async function syncDailyBiometricsToSupabase(options: {
  accountKey: string;
  authUserId?: string | null;
  accessToken?: string | null;
  snapshot: DailyBiometricsSnapshot;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}): Promise<BiometricsSupabaseSyncResult> {
  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const endpoint = options.endpoint || '/api/biometrics';
  const accountKey = String(options.accountKey || '').trim().toLowerCase();

  if (!accountKey) {
    return {
      ok: false,
      configured: false,
      saved: false,
      biometrics: null,
      error: 'Sign in first to sync biometrics to your cloud account.'
    };
  }

  if (!fetchFn) {
    return {
      ok: false,
      configured: false,
      saved: false,
      biometrics: null,
      error: 'Network fetch is unavailable.'
    };
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }

    const resp = await fetchFn(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accountKey,
        authUserId: options.authUserId || null,
        provider: options.snapshot.provider,
        dateIso: options.snapshot.dateIso,
        sleepHours: options.snapshot.sleepHours,
        dailySteps: options.snapshot.dailySteps,
        restingHeartRateBpm: options.snapshot.restingHeartRateBpm ?? null
      })
    });

    const data = await resp.json().catch(() => ({}));
    return {
      ok: Boolean(resp.ok && data?.ok),
      configured: Boolean(data?.configured),
      saved: Boolean(data?.saved),
      biometrics: data?.biometrics || options.snapshot,
      error: data?.error
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      saved: false,
      biometrics: null,
      error: err instanceof Error ? err.message : 'Failed to sync biometrics to Supabase.'
    };
  }
}

export async function fetchLatestBiometricsFromSupabase(options: {
  accountKey: string;
  accessToken?: string | null;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}): Promise<DailyBiometricsSnapshot | null> {
  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const endpoint = options.endpoint || '/api/biometrics';
  const accountKey = String(options.accountKey || '').trim().toLowerCase();
  if (!fetchFn || !accountKey) return null;

  try {
    const headers: Record<string, string> = {};
    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }
    const resp = await fetchFn(
      `${endpoint}?userId=${encodeURIComponent(accountKey)}`,
      { method: 'GET', headers }
    );
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    return data && data.biometrics ? (data.biometrics as DailyBiometricsSnapshot) : null;
  } catch {
    return null;
  }
}
