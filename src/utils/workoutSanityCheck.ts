export const HEAVY_WEIGHT_MULTIPLIER_THRESHOLD = 2.5; // 250% of historical max

export interface HistoricalMaxLookupInput {
  exerciseId: string;
  canonicalExerciseId?: string | null;
  workoutLogs?: Record<string, any> | null;
  exerciseHistory?: Record<string, any[]> | null;
  excludeLogKey?: string | null;
}

export interface SetWeightSanityInput {
  exerciseId: string;
  canonicalExerciseId?: string | null;
  setKey: string;
  enteredWeight: number | string;
  unit?: 'lbs' | 'kg' | string;
  workoutLogs?: Record<string, any> | null;
  exerciseHistory?: Record<string, any[]> | null;
  pendingConfirmationKey?: string | null;
  multiplierThreshold?: number;
}

export interface SetWeightSanityResult {
  allowed: boolean;
  requiresSecondTap: boolean;
  bypassedWarning: boolean;
  enteredWeight: number;
  historicalMaxWeight: number | null;
  thresholdWeight: number | null;
  warningMessage: string | null;
  confirmationKey: string | null;
}

function parsePositiveWeight(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function formatWeightForSanityPrompt(weight: number, unit?: string): string {
  const formattedNum = Number.isInteger(weight) ? String(weight) : String(Math.round(weight * 10) / 10);
  const cleanUnit = unit === 'kg' ? 'kg' : (unit === 'lbs' ? 'lbs' : '');
  return cleanUnit ? `${formattedNum} ${cleanUnit}` : formattedNum;
}

/**
 * Exact ELI12 sanity warning toast:
 * "That looks heavy! Did you mean to log [Weight]?"
 */
export function buildHeavyWeightWarningMessage(weight: number, unit?: string): string {
  return `That looks heavy! Did you mean to log ${formatWeightForSanityPrompt(weight, unit)}?`;
}

/**
 * Scans workoutLogs and exerciseHistory to determine the user's highest historical logged weight
 * for a specific exercise. Ignores unlogged/empty placeholders and optionally excludes the active set key.
 */
export function getHistoricalMaxWeightForExercise(input: HistoricalMaxLookupInput): number | null {
  const idsToMatch = new Set<string>();
  const primaryId = String(input.exerciseId || '').trim().toLowerCase();
  const canonicalId = String(input.canonicalExerciseId || '').trim().toLowerCase();
  if (primaryId) idsToMatch.add(primaryId);
  if (canonicalId) idsToMatch.add(canonicalId);
  if (idsToMatch.size === 0) return null;

  let maxWeight = 0;

  const logs = input.workoutLogs && typeof input.workoutLogs === 'object' ? input.workoutLogs : {};
  const excludeKey = input.excludeLogKey ? String(input.excludeLogKey) : '';

  Object.entries(logs).forEach(([key, entry]) => {
    if (!entry || typeof entry !== 'object') return;
    if (excludeKey && key === excludeKey) return;
    if (entry.done !== true && entry.isLogged !== true) return;

    const lowerKey = key.toLowerCase();
    let matched = false;
    idsToMatch.forEach((id) => {
      if (lowerKey.includes(`_${id}_`)) {
        matched = true;
      }
    });
    if (!matched) return;

    const w = parsePositiveWeight(entry.weight);
    if (w !== null && w > maxWeight) {
      maxWeight = w;
    }
  });

  const historyMap =
    input.exerciseHistory && typeof input.exerciseHistory === 'object' ? input.exerciseHistory : {};
  Object.entries(historyMap).forEach(([histKey, entries]) => {
    const lowerHistKey = histKey.toLowerCase();
    if (!idsToMatch.has(lowerHistKey) || !Array.isArray(entries)) return;
    entries.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const w = parsePositiveWeight(item.weight);
      if (w !== null && w > maxWeight) {
        maxWeight = w;
      }
    });
  });

  return maxWeight > 0 ? maxWeight : null;
}

/**
 * Task 4: Active Workout Logger Content Validation (Sanity Check).
 * - If entered weight strictly exceeds 250% (2.5x) of the historical max for this exercise:
 *   - First tap: blocks save and returns warning toast "That looks heavy! Did you mean to log [Weight]?"
 *     along with a confirmationKey.
 *   - Second tap on "Log Set" with matching pendingConfirmationKey: bypasses warning and forces save.
 */
export function validateSetWeightSanity(input: SetWeightSanityInput): SetWeightSanityResult {
  const enteredWeight = parsePositiveWeight(input.enteredWeight) ?? 0;
  const multiplier =
    typeof input.multiplierThreshold === 'number' && input.multiplierThreshold > 1
      ? input.multiplierThreshold
      : HEAVY_WEIGHT_MULTIPLIER_THRESHOLD;

  if (enteredWeight <= 0) {
    return {
      allowed: true,
      requiresSecondTap: false,
      bypassedWarning: false,
      enteredWeight,
      historicalMaxWeight: null,
      thresholdWeight: null,
      warningMessage: null,
      confirmationKey: null
    };
  }

  const historicalMaxWeight = getHistoricalMaxWeightForExercise({
    exerciseId: input.exerciseId,
    canonicalExerciseId: input.canonicalExerciseId,
    workoutLogs: input.workoutLogs,
    exerciseHistory: input.exerciseHistory,
    excludeLogKey: input.setKey
  });

  if (historicalMaxWeight === null) {
    return {
      allowed: true,
      requiresSecondTap: false,
      bypassedWarning: false,
      enteredWeight,
      historicalMaxWeight: null,
      thresholdWeight: null,
      warningMessage: null,
      confirmationKey: null
    };
  }

  const thresholdWeight = Math.round(historicalMaxWeight * multiplier * 10) / 10;
  const exceedsLimit = enteredWeight > thresholdWeight;

  if (!exceedsLimit) {
    return {
      allowed: true,
      requiresSecondTap: false,
      bypassedWarning: false,
      enteredWeight,
      historicalMaxWeight,
      thresholdWeight,
      warningMessage: null,
      confirmationKey: null
    };
  }

  const expectedConfirmKey = `${String(input.setKey || input.exerciseId)}::${enteredWeight}`;

  if (input.pendingConfirmationKey && input.pendingConfirmationKey === expectedConfirmKey) {
    return {
      allowed: true,
      requiresSecondTap: false,
      bypassedWarning: true,
      enteredWeight,
      historicalMaxWeight,
      thresholdWeight,
      warningMessage: null,
      confirmationKey: null
    };
  }

  return {
    allowed: false,
    requiresSecondTap: true,
    bypassedWarning: false,
    enteredWeight,
    historicalMaxWeight,
    thresholdWeight,
    warningMessage: buildHeavyWeightWarningMessage(enteredWeight, input.unit),
    confirmationKey: expectedConfirmKey
  };
}
