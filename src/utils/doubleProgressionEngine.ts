/**
 * Deterministic Double Progression Engine (No Subjective Math)
 *
 * Calculates the next workout's target load and reps strictly from objective
 * completed workout data (weight and completed reps). Subjective interoceptive
 * metrics (RPE, RIR, pump, soreness) are explicitly ignored by the math engine
 * and kept strictly behind an opt-in Advanced Settings toggle.
 */

export type WeightUnit = 'lbs' | 'kg';

export interface ObjectiveSetEntry {
  weight?: string | number | null;
  reps?: string | number | null;
  done?: boolean;
  isLogged?: boolean;
  unit?: WeightUnit;
  /** Optional opt-in subjective notes — strictly ignored by deterministic progression math */
  rpe?: number | string | null;
  rir?: number | string | null;
  pump?: number | string | null;
  soreness?: number | string | null;
}

export interface DoubleProgressionInput {
  exerciseName: string;
  targetSets: number;
  repRangeLabel: string;
  baselineWeight: number;
  unit?: WeightUnit;
  isBodyweight?: boolean;
  /** Objective completed sets from the most recent logged session for this exercise */
  completedSets: ObjectiveSetEntry[];
  /** Optional custom load step (defaults to +5 lbs or +2.5 kg) */
  loadIncrement?: number;
}

export interface DoubleProgressionResult {
  exerciseName: string;
  model: 'double_progression';
  usesSubjectiveMetrics: false;
  action: 'increase_weight' | 'increase_reps' | 'hold_and_build' | 'start_baseline';
  unit: WeightUnit;
  minReps: number;
  maxReps: number;
  targetSets: number;
  previousWeight: number | null;
  previousCompletedSets: number;
  previousMinRepsHit: number | null;
  nextTargetWeight: number;
  nextTargetReps: number;
  nextTargetLabel: string;
  weightDelta: number;
  plainEnglishSummary: string;
}

export const ADVANCED_SUBJECTIVE_STORAGE_KEY = 'budget_gym_advanced_subjective_v1';
export const DEFAULT_SUBJECTIVE_TRACKING_ENABLED = false;

export function parseObjectiveRepRange(repRangeLabel: string): { minReps: number; maxReps: number } {
  const clean = String(repRangeLabel || '').trim();
  const rangeMatch = clean.match(/(\d+)\s*(?:-|–|—|to)\s*(\d+)/i);
  if (rangeMatch) {
    const a = Math.max(1, parseInt(rangeMatch[1], 10));
    const b = Math.max(a, parseInt(rangeMatch[2], 10));
    return { minReps: a, maxReps: b };
  }
  const singleMatch = clean.match(/(\d+)/);
  if (singleMatch) {
    const val = Math.max(1, parseInt(singleMatch[1], 10));
    return { minReps: val, maxReps: val + 2 };
  }
  return { minReps: 8, maxReps: 12 };
}

function toFiniteNonNegative(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

/**
 * Pure Double Progression algorithm:
 * 1. Filters strictly to objective completed sets (weight + reps). Subjective fields
 *    (RPE, RIR, pump, soreness) are never read.
 * 2. If no objective sets exist yet -> prescribe baselineWeight at minReps.
 * 3. If all prescribed sets were completed AND every set reached >= maxReps:
 *    - Weighted: increase weight by loadIncrement (+5 lbs or +2.5 kg) and reset reps to minReps.
 *    - Bodyweight: increase target reps by +1 above the lowest completed set rep count.
 * 4. If all prescribed sets were completed at >= minReps (but below maxReps):
 *    - Keep weight the same and target +1 rep (up to maxReps).
 * 5. Otherwise:
 *    - Hold the same weight and aim to complete all sets cleanly at minReps.
 */
export function calculateDoubleProgressionTarget(
  input: DoubleProgressionInput
): DoubleProgressionResult {
  const unit: WeightUnit = input.unit === 'kg' ? 'kg' : 'lbs';
  const targetSets = Math.max(1, Math.floor(Number(input.targetSets) || 3));
  const { minReps, maxReps } = parseObjectiveRepRange(input.repRangeLabel);
  const defaultIncrement = unit === 'kg' ? 2.5 : 5;
  const loadIncrement =
    typeof input.loadIncrement === 'number' && Number.isFinite(input.loadIncrement) && input.loadIncrement > 0
      ? input.loadIncrement
      : defaultIncrement;
  const baselineWeight = Math.max(0, Number(input.baselineWeight) || 0);
  const isBodyweight = Boolean(input.isBodyweight) || baselineWeight === 0;

  // Strictly extract ONLY objective weight and reps from completed sets
  const validSets = (Array.isArray(input.completedSets) ? input.completedSets : [])
    .filter((s) => Boolean(s && (s.done === true || s.isLogged === true)))
    .map((s) => ({
      weight: toFiniteNonNegative(s.weight) ?? baselineWeight,
      reps: toFiniteNonNegative(s.reps) ?? 0
    }))
    .filter((s) => s.reps > 0);

  if (validSets.length === 0) {
    return {
      exerciseName: input.exerciseName,
      model: 'double_progression',
      usesSubjectiveMetrics: false,
      action: 'start_baseline',
      unit,
      minReps,
      maxReps,
      targetSets,
      previousWeight: null,
      previousCompletedSets: 0,
      previousMinRepsHit: null,
      nextTargetWeight: isBodyweight ? 0 : baselineWeight,
      nextTargetReps: minReps,
      nextTargetLabel: isBodyweight
        ? `${targetSets} sets × ${minReps} reps`
        : `${baselineWeight} ${unit} × ${minReps} reps`,
      weightDelta: 0,
      plainEnglishSummary: isBodyweight
        ? `Start with ${targetSets} sets of ${minReps} reps. Once you hit ${maxReps} reps on every set, add +1 rep.`
        : `Start at ${baselineWeight} ${unit} for ${minReps}–${maxReps} reps. Hit ${maxReps} reps on all ${targetSets} sets to add +${loadIncrement} ${unit}.`
    };
  }

  // Objective working weight = maximum weight used across completed sets
  const workingWeight = isBodyweight
    ? 0
    : Math.max(...validSets.map((s) => s.weight));
  const lowestRepsCompleted = Math.min(...validSets.map((s) => s.reps));
  const completedRequiredSets = validSets.length >= targetSets;

  // Case 1: Completed all sets at or above the top of the rep range -> Progress Load!
  if (completedRequiredSets && lowestRepsCompleted >= maxReps) {
    if (isBodyweight) {
      const nextReps = lowestRepsCompleted + 1;
      return {
        exerciseName: input.exerciseName,
        model: 'double_progression',
        usesSubjectiveMetrics: false,
        action: 'increase_reps',
        unit,
        minReps,
        maxReps,
        targetSets,
        previousWeight: 0,
        previousCompletedSets: validSets.length,
        previousMinRepsHit: lowestRepsCompleted,
        nextTargetWeight: 0,
        nextTargetReps: nextReps,
        nextTargetLabel: `${targetSets} sets × ${nextReps} reps`,
        weightDelta: 0,
        plainEnglishSummary: `You completed all ${targetSets} sets at ${lowestRepsCompleted}+ reps. Next target: ${nextReps} reps per set.`
      };
    }

    const nextWeight = +(workingWeight + loadIncrement).toFixed(2);
    return {
      exerciseName: input.exerciseName,
      model: 'double_progression',
      usesSubjectiveMetrics: false,
      action: 'increase_weight',
      unit,
      minReps,
      maxReps,
      targetSets,
      previousWeight: workingWeight,
      previousCompletedSets: validSets.length,
      previousMinRepsHit: lowestRepsCompleted,
      nextTargetWeight: nextWeight,
      nextTargetReps: minReps,
      nextTargetLabel: `${nextWeight} ${unit} × ${minReps} reps`,
      weightDelta: loadIncrement,
      plainEnglishSummary: `You hit ${maxReps}+ reps on all ${targetSets} sets at ${workingWeight} ${unit}. Next workout: add +${loadIncrement} ${unit} to ${nextWeight} ${unit} for ${minReps} reps.`
    };
  }

  // Case 2: Completed all sets at or above minReps (building toward maxReps) -> Progress Reps!
  if (completedRequiredSets && lowestRepsCompleted >= minReps) {
    const nextReps = Math.min(maxReps, lowestRepsCompleted + 1);
    return {
      exerciseName: input.exerciseName,
      model: 'double_progression',
      usesSubjectiveMetrics: false,
      action: 'increase_reps',
      unit,
      minReps,
      maxReps,
      targetSets,
      previousWeight: workingWeight,
      previousCompletedSets: validSets.length,
      previousMinRepsHit: lowestRepsCompleted,
      nextTargetWeight: workingWeight,
      nextTargetReps: nextReps,
      nextTargetLabel: isBodyweight
        ? `${targetSets} sets × ${nextReps} reps`
        : `${workingWeight} ${unit} × ${nextReps} reps`,
      weightDelta: 0,
      plainEnglishSummary: isBodyweight
        ? `Solid work hitting ${lowestRepsCompleted} reps across ${targetSets} sets. Next workout: aim for ${nextReps} reps.`
        : `Keep ${workingWeight} ${unit} and aim for ${nextReps} reps per set. Once all ${targetSets} sets hit ${maxReps} reps, weight increases by +${loadIncrement} ${unit}.`
    };
  }

  // Case 3: Fewer sets completed or below minReps -> Hold Weight and Build Consistency
  return {
    exerciseName: input.exerciseName,
    model: 'double_progression',
    usesSubjectiveMetrics: false,
    action: 'hold_and_build',
    unit,
    minReps,
    maxReps,
    targetSets,
    previousWeight: workingWeight,
    previousCompletedSets: validSets.length,
    previousMinRepsHit: lowestRepsCompleted,
    nextTargetWeight: workingWeight,
    nextTargetReps: minReps,
    nextTargetLabel: isBodyweight
      ? `${targetSets} sets × ${minReps} reps`
      : `${workingWeight} ${unit} × ${minReps} reps`,
    weightDelta: 0,
    plainEnglishSummary: isBodyweight
      ? `Hold at ${minReps} reps until all ${targetSets} sets feel smooth and complete.`
      : `Stay at ${workingWeight} ${unit} until all ${targetSets} sets hit ${minReps} reps cleanly.`
  };
}

/**
 * Reads gym_state.workoutLogs for a specific exercise (checking active week or most
 * recent previous logged week) and computes its deterministic Double Progression target.
 */
export function evaluateExerciseDoubleProgressionFromGymState(options: {
  gymState: { workoutLogs?: Record<string, ObjectiveSetEntry> | null } | null | undefined;
  exerciseId: string;
  exerciseName: string;
  currentWeek: number;
  daySlotIndex: number;
  targetSets: number;
  repRangeLabel: string;
  baselineWeight: number;
  unit?: WeightUnit;
  isBodyweight?: boolean;
}): DoubleProgressionResult {
  const logs = options.gymState?.workoutLogs || {};
  const safeWeek = Math.max(1, Math.min(12, Math.floor(Number(options.currentWeek) || 1)));
  const safeSlot = Math.max(0, Math.min(6, Math.floor(Number(options.daySlotIndex) || 0)));

  const collectSetsForWeek = (weekNum: number): ObjectiveSetEntry[] => {
    const sets: ObjectiveSetEntry[] = [];
    for (let s = 1; s <= Math.max(options.targetSets, 6); s++) {
      const key = `w${weekNum}_${safeSlot}_${options.exerciseId}_${s}`;
      const legacyKey = weekNum === 1 ? `${safeSlot}_${options.exerciseId}_${s}` : '';
      const entry = logs[key] || (legacyKey ? logs[legacyKey] : undefined);
      if (entry && (entry.done === true || entry.isLogged === true)) {
        sets.push(entry);
      }
    }
    return sets;
  };

  // Prefer the active week if completed sets exist; otherwise look back to the latest prior week
  let sourceSets = collectSetsForWeek(safeWeek);
  if (sourceSets.length === 0) {
    for (let w = safeWeek - 1; w >= 1; w--) {
      const prevSets = collectSetsForWeek(w);
      if (prevSets.length > 0) {
        sourceSets = prevSets;
        break;
      }
    }
  }

  return calculateDoubleProgressionTarget({
    exerciseName: options.exerciseName,
    targetSets: options.targetSets,
    repRangeLabel: options.repRangeLabel,
    baselineWeight: options.baselineWeight,
    unit: options.unit,
    isBodyweight: options.isBodyweight,
    completedSets: sourceSets
  });
}

export function loadAdvancedSubjectiveSetting(
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return DEFAULT_SUBJECTIVE_TRACKING_ENABLED;
    return store.getItem(ADVANCED_SUBJECTIVE_STORAGE_KEY) === 'true';
  } catch {
    return DEFAULT_SUBJECTIVE_TRACKING_ENABLED;
  }
}

export function saveAdvancedSubjectiveSetting(
  enabled: boolean,
  storage?: Pick<Storage, 'setItem'> | null
): boolean {
  const clean = Boolean(enabled);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      store.setItem(ADVANCED_SUBJECTIVE_STORAGE_KEY, clean ? 'true' : 'false');
    }
  } catch {
    // Ignore restricted storage
  }
  return clean;
}
