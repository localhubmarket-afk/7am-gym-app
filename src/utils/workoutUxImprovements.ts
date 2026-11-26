/**
 * Workout-First UX Improvements: Pure Logic Module
 * - Inline plain-text fast set parser (e.g., "135x8", "135x8, 140x6", "135x8x3", "bw x 12", "60kg x 10")
 * - Batch set application with exact 1-tap Undo snapshot
 * - 3-tab primary navigation + Header Nutrition menu routing resolver (with legacy "pullups" redirect)
 * - One-tap Skip Onboarding default 5-day full-body plan patch builder
 * - Recent Lift Weights extractor for the dedicated Stats bottom tab
 */

export type WeightUnit = 'lbs' | 'kg';

export interface ParsedInlineSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
  isBodyweight: boolean;
}

export interface ParseInlineSetOptions {
  defaultUnit?: WeightUnit;
  defaultWeight?: number;
  isBodyweightExercise?: boolean;
  maxSets?: number;
}

export type ParseInlineSetResult =
  | {
      ok: true;
      sets: ParsedInlineSet[];
      summaryText: string;
    }
  | {
      ok: false;
      error: string;
    };

export interface WorkoutLogEntry {
  weight?: string | number;
  reps?: string | number;
  done?: boolean;
  isLogged?: boolean;
  unit?: WeightUnit | string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ApplyParsedSetsParams {
  workoutLogs: Record<string, WorkoutLogEntry>;
  week: number;
  dayIdx: number;
  slotIdx: number;
  exerciseId: string;
  targetSetsCount: number;
  defaultUnit?: WeightUnit;
  parsedSets: ParsedInlineSet[];
  isBonusRepeat?: boolean;
  logSlotKey?: string;
  nowIso?: string;
}

export interface FastLogUndoSnapshot {
  exerciseId: string;
  week: number;
  dayIdx: number;
  slotIdx: number;
  entries: Array<{ key: string; previousValue: WorkoutLogEntry | null }>;
}

export interface ApplyParsedSetsResult {
  appliedSetIndices: number[];
  updatedKeys: string[];
  undoSnapshot: FastLogUndoSnapshot;
  summaryText: string;
}

export type PrimaryBottomTab = 'workout' | 'timer' | 'stats';
export type NutritionMenuView = 'vegan' | 'shopping';
export type AppViewName = PrimaryBottomTab | NutritionMenuView;

export interface ResolvedNavigationState {
  activeView: AppViewName;
  bottomTab: PrimaryBottomTab | null;
  nutritionMode: NutritionMenuView | null;
  focusPinnedPullups: boolean;
}

export interface RecentLiftSummary {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  unit: WeightUnit;
  estimated1Rm: number;
  week: number;
  dayNumber: number;
  isBodyweight: boolean;
}

const MAX_WEIGHT = 999;
const MAX_REPS = 100;
const DEFAULT_MAX_SETS = 12;

function clampWeight(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.round(Math.min(MAX_WEIGHT, raw) * 100) / 100;
}

function clampReps(raw: number): number {
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(MAX_REPS, Math.round(raw));
}

function normalizeUnitToken(token: string | undefined, fallback: WeightUnit): WeightUnit {
  if (!token) return fallback;
  const lower = token.toLowerCase().trim();
  if (lower === 'kg' || lower === 'kgs' || lower === 'kilo' || lower === 'kilos') return 'kg';
  if (lower === 'lb' || lower === 'lbs' || lower === 'pound' || lower === 'pounds') return 'lbs';
  return fallback;
}

/**
 * Formats a parsed set array into concise ELI12 confirmation text.
 */
export function formatParsedSetsSummary(sets: ParsedInlineSet[]): string {
  if (!sets.length) return '';
  const preview = sets
    .slice(0, 4)
    .map((s) => (s.isBodyweight && s.weight === 0 ? `BW × ${s.reps}` : `${s.weight} ${s.unit} × ${s.reps}`))
    .join(', ');
  const extra = sets.length > 4 ? ` (+${sets.length - 4} more)` : '';
  const word = sets.length === 1 ? 'set' : 'sets';
  return `Logged ${sets.length} ${word}: ${preview}${extra}`;
}

/**
 * Parses plain-text set shorthand entered inside an exercise card.
 *
 * Supported formats:
 * - "135x8" or "135 x 8" or "135*8" or "135×8"
 * - "135x8, 135x8, 140x6" (comma, semicolon, or newline separated)
 * - "135x8x3" (3 sets of 135 × 8)
 * - "3x8 @ 135" or "3x10 135lb" (3 sets of 8 reps at 135)
 * - "60kg x 10" or "60 kg x 10"
 * - "bw x 12", "bodyweight x 10", "bw+25 x 8", "bw 12"
 * - For bodyweight exercises (or fallback weight): "12, 10, 8" or "12 reps"
 */
export function parseInlineSetText(
  rawText: string,
  options: ParseInlineSetOptions = {}
): ParseInlineSetResult {
  const defaultUnit: WeightUnit = options.defaultUnit === 'kg' ? 'kg' : 'lbs';
  const defaultWeight = clampWeight(Number(options.defaultWeight) || 0);
  const isBodyweightExercise = Boolean(options.isBodyweightExercise);
  const maxSets = Math.max(1, Math.min(20, Math.floor(Number(options.maxSets) || DEFAULT_MAX_SETS)));

  const cleaned = String(rawText || '').trim();
  if (!cleaned) {
    return {
      ok: false,
      error: isBodyweightExercise
        ? 'Type your reps first. Example: bw x 10 or 10, 8, 8'
        : 'Type weight and reps first. Example: 135x8 or 135x8, 140x6'
    };
  }

  const segments = cleaned
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!segments.length) {
    return {
      ok: false,
      error: 'Type weight and reps first. Example: 135x8'
    };
  }

  const sets: ParsedInlineSet[] = [];
  let lastWeight: number = defaultWeight;
  let lastUnit: WeightUnit = defaultUnit;

  for (const segment of segments) {
    if (sets.length >= maxSets) break;

    const normalized = segment
      .replace(/[×*]/g, 'x')
      .replace(/\s+/g, ' ')
      .trim();

    // Pattern A: Bodyweight with optional added load ("bw x 12", "bodyweight 10", "bw+25 x 8")
    const bwMatch = normalized.match(
      /^(?:bw|bodyweight|body\s*weight)(?:\s*\+\s*(\d+(?:\.\d+)?)\s*(lbs?|kgs?)?)?\s*(?:x|for|@|\s)\s*(\d+)(?:\s*reps?)?(?:\s*x\s*(\d+))?$/i
    );
    if (bwMatch) {
      const addedWeight = bwMatch[1] ? clampWeight(parseFloat(bwMatch[1])) : 0;
      const unit = normalizeUnitToken(bwMatch[2], lastUnit);
      const reps = clampReps(parseInt(bwMatch[3], 10));
      const repeatCount = bwMatch[4] ? Math.max(1, Math.min(maxSets - sets.length, parseInt(bwMatch[4], 10))) : 1;
      for (let i = 0; i < repeatCount; i++) {
        sets.push({ weight: addedWeight, reps, unit, isBodyweight: addedWeight === 0 });
      }
      lastWeight = addedWeight;
      lastUnit = unit;
      continue;
    }

    // Pattern B: Sets x Reps @ Weight ("3x8 @ 135", "3x10 at 60kg", "3x8 135lbs")
    const setsRepsAtWeightMatch = normalized.match(
      /^(\d+)\s*x\s*(\d+)\s*(?:@|at|with|\s)\s*(\d+(?:\.\d+)?)\s*(lbs?|kgs?)?$/i
    );
    if (setsRepsAtWeightMatch) {
      const setCount = Math.max(1, Math.min(maxSets - sets.length, parseInt(setsRepsAtWeightMatch[1], 10)));
      const reps = clampReps(parseInt(setsRepsAtWeightMatch[2], 10));
      const weight = clampWeight(parseFloat(setsRepsAtWeightMatch[3]));
      const unit = normalizeUnitToken(setsRepsAtWeightMatch[4], lastUnit);
      for (let i = 0; i < setCount; i++) {
        sets.push({ weight, reps, unit, isBodyweight: weight === 0 && isBodyweightExercise });
      }
      lastWeight = weight;
      lastUnit = unit;
      continue;
    }

    // Pattern C: Weight x Reps x Sets ("135x8x3", "60kg x 10 x 4")
    const weightRepsSetsMatch = normalized.match(
      /^(\d+(?:\.\d+)?)\s*(lbs?|kgs?)?\s*x\s*(\d+)\s*(?:reps?)?\s*x\s*(\d+)$/i
    );
    if (weightRepsSetsMatch) {
      const weight = clampWeight(parseFloat(weightRepsSetsMatch[1]));
      const unit = normalizeUnitToken(weightRepsSetsMatch[2], lastUnit);
      const reps = clampReps(parseInt(weightRepsSetsMatch[3], 10));
      const repeatCount = Math.max(1, Math.min(maxSets - sets.length, parseInt(weightRepsSetsMatch[4], 10)));
      for (let i = 0; i < repeatCount; i++) {
        sets.push({ weight, reps, unit, isBodyweight: weight === 0 && isBodyweightExercise });
      }
      lastWeight = weight;
      lastUnit = unit;
      continue;
    }

    // Pattern D: Standard Weight x Reps ("135x8", "135 lbs x 8", "60kg x 10 reps", "22.5 x 12")
    const weightRepsMatch = normalized.match(
      /^(\d+(?:\.\d+)?)\s*(lbs?|kgs?)?\s*(?:x|for|@)\s*(\d+)\s*(?:reps?)?$/i
    );
    if (weightRepsMatch) {
      const weight = clampWeight(parseFloat(weightRepsMatch[1]));
      const unit = normalizeUnitToken(weightRepsMatch[2], lastUnit);
      const reps = clampReps(parseInt(weightRepsMatch[3], 10));
      sets.push({ weight, reps, unit, isBodyweight: weight === 0 && isBodyweightExercise });
      lastWeight = weight;
      lastUnit = unit;
      continue;
    }

    // Pattern E: Space-separated Weight Reps ("135 8", "60kg 10")
    const spacePairMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(lbs?|kgs?)?\s+(\d+)\s*(?:reps?)?$/i);
    if (spacePairMatch) {
      const weight = clampWeight(parseFloat(spacePairMatch[1]));
      const unit = normalizeUnitToken(spacePairMatch[2], lastUnit);
      const reps = clampReps(parseInt(spacePairMatch[3], 10));
      sets.push({ weight, reps, unit, isBodyweight: weight === 0 && isBodyweightExercise });
      lastWeight = weight;
      lastUnit = unit;
      continue;
    }

    // Pattern F: Reps-only shorthand ("12", "10 reps") -> uses bodyweight or last/default weight
    const repsOnlyMatch = normalized.match(/^(\d+)\s*(?:reps?)?$/i);
    if (repsOnlyMatch && (isBodyweightExercise || lastWeight > 0)) {
      const reps = clampReps(parseInt(repsOnlyMatch[1], 10));
      const weight = isBodyweightExercise ? 0 : lastWeight;
      sets.push({ weight, reps, unit: lastUnit, isBodyweight: isBodyweightExercise });
      continue;
    }

    return {
      ok: false,
      error: isBodyweightExercise
        ? `Could not read "${segment}". Try: bw x 10 or 10, 8, 8`
        : `Could not read "${segment}". Try: 135x8 or 135x8, 140x6`
    };
  }

  if (!sets.length) {
    return {
      ok: false,
      error: 'No sets found. Try: 135x8 or 135x8, 140x6'
    };
  }

  return {
    ok: true,
    sets,
    summaryText: formatParsedSetsSummary(sets)
  };
}

function buildCanonicalLogKey(params: {
  week: number;
  dayIdx: number;
  slotIdx: number;
  exerciseId: string;
  setIdx: number;
  isBonusRepeat?: boolean;
  logSlotKey?: string;
}): string {
  const { week, dayIdx, slotIdx, exerciseId, setIdx, isBonusRepeat, logSlotKey } = params;
  if (isBonusRepeat && exerciseId !== 'cable_ab_crunch' && logSlotKey) {
    return `w${week}_${logSlotKey}_${exerciseId}_${setIdx}`;
  }
  const kIdx = exerciseId === 'cable_ab_crunch' ? dayIdx : slotIdx;
  return `w${week}_${kIdx}_${exerciseId}_${setIdx}`;
}

/**
 * Applies parsed fast-log sets into the exercise's workoutLogs object, filling
 * the next unlogged sets first and returning a lossless Undo snapshot.
 */
export function applyParsedSetsToExerciseLogs(params: ApplyParsedSetsParams): ApplyParsedSetsResult {
  const {
    workoutLogs,
    week,
    dayIdx,
    slotIdx,
    exerciseId,
    targetSetsCount,
    defaultUnit = 'lbs',
    parsedSets,
    isBonusRepeat = false,
    logSlotKey,
    nowIso = new Date().toISOString()
  } = params;

  const safeTargetSets = Math.max(1, Math.min(20, Math.floor(Number(targetSetsCount) || 3)));
  const undoEntries: Array<{ key: string; previousValue: WorkoutLogEntry | null }> = [];
  const recordedUndoKeys = new Set<string>();
  const appliedSetIndices: number[] = [];
  const updatedKeys: string[] = [];

  const captureUndoKey = (k: string) => {
    if (recordedUndoKeys.has(k)) return;
    recordedUndoKeys.add(k);
    const prev = workoutLogs[k];
    undoEntries.push({
      key: k,
      previousValue: prev ? { ...prev } : null
    });
  };

  // Find incomplete set indices inside 1..safeTargetSets
  const incompleteIndices: number[] = [];
  for (let s = 1; s <= safeTargetSets; s++) {
    const k = buildCanonicalLogKey({ week, dayIdx, slotIdx, exerciseId, setIdx: s, isBonusRepeat, logSlotKey });
    const entry = workoutLogs[k];
    if (!entry || entry.done !== true) {
      incompleteIndices.push(s);
    }
  }

  // Decide target set indices: fill incomplete sets first; if user types more than remaining
  // or all sets are already done, wrap cleanly starting from set 1 up to safeTargetSets.
  const targetIndices: number[] = [];
  let cursor = 0;
  for (let i = 0; i < parsedSets.length; i++) {
    if (cursor < incompleteIndices.length) {
      targetIndices.push(incompleteIndices[cursor]);
      cursor++;
    } else if (i < safeTargetSets) {
      const candidate = (i % safeTargetSets) + 1;
      if (!targetIndices.includes(candidate)) {
        targetIndices.push(candidate);
      } else {
        targetIndices.push(Math.min(20, safeTargetSets + (i - incompleteIndices.length) + 1));
      }
    } else {
      break;
    }
  }

  targetIndices.forEach((setIdx, idx) => {
    const parsed = parsedSets[idx];
    if (!parsed) return;
    const key = buildCanonicalLogKey({ week, dayIdx, slotIdx, exerciseId, setIdx, isBonusRepeat, logSlotKey });
    captureUndoKey(key);

    const existing = workoutLogs[key] || {};
    const nextEntry: WorkoutLogEntry = {
      ...existing,
      weight: String(parsed.weight),
      reps: String(parsed.reps),
      done: true,
      isLogged: true,
      unit: parsed.unit || defaultUnit,
      updatedAt: nowIso
    };
    workoutLogs[key] = nextEntry;
    updatedKeys.push(key);
    appliedSetIndices.push(setIdx);

    if (week === 1 && !isBonusRepeat) {
      const kIdx = exerciseId === 'cable_ab_crunch' ? dayIdx : slotIdx;
      const legacyKey = `${kIdx}_${exerciseId}_${setIdx}`;
      captureUndoKey(legacyKey);
      workoutLogs[legacyKey] = { ...nextEntry };
    }
  });

  return {
    appliedSetIndices,
    updatedKeys,
    undoSnapshot: {
      exerciseId,
      week,
      dayIdx,
      slotIdx,
      entries: undoEntries
    },
    summaryText: formatParsedSetsSummary(parsedSets.slice(0, appliedSetIndices.length))
  };
}

/**
 * Reverts a fast-log batch using its exact Undo snapshot.
 */
export function revertFastLogUndoSnapshot(
  workoutLogs: Record<string, WorkoutLogEntry>,
  snapshot: FastLogUndoSnapshot | null | undefined
): boolean {
  if (!snapshot || !Array.isArray(snapshot.entries) || snapshot.entries.length === 0) {
    return false;
  }
  snapshot.entries.forEach(({ key, previousValue }) => {
    if (previousValue === null) {
      delete workoutLogs[key];
    } else {
      workoutLogs[key] = { ...previousValue };
    }
  });
  return true;
}

/**
 * Resolves navigation destination for the 3-tab bottom bar (Gym / Timer / Stats)
 * + Top Header Nutrition menu (Fuel / Shop) + backward-compatible Pull-Ups route.
 */
export function resolveNavigationTarget(tabName: string): ResolvedNavigationState {
  const normalized = String(tabName || 'workout').trim().toLowerCase();

  if (normalized === 'pullups') {
    return {
      activeView: 'workout',
      bottomTab: 'workout',
      nutritionMode: null,
      focusPinnedPullups: true
    };
  }
  if (normalized === 'timer') {
    return {
      activeView: 'timer',
      bottomTab: 'timer',
      nutritionMode: null,
      focusPinnedPullups: false
    };
  }
  if (normalized === 'stats') {
    return {
      activeView: 'stats',
      bottomTab: 'stats',
      nutritionMode: null,
      focusPinnedPullups: false
    };
  }
  if (normalized === 'vegan' || normalized === 'fuel') {
    return {
      activeView: 'vegan',
      bottomTab: null,
      nutritionMode: 'vegan',
      focusPinnedPullups: false
    };
  }
  if (normalized === 'shopping' || normalized === 'shop') {
    return {
      activeView: 'shopping',
      bottomTab: null,
      nutritionMode: 'shopping',
      focusPinnedPullups: false
    };
  }

  return {
    activeView: 'workout',
    bottomTab: 'workout',
    nutritionMode: null,
    focusPinnedPullups: false
  };
}

/**
 * Builds the default state patch applied when the user taps "Skip to Workout"
 * on the 6-step onboarding wizard. Never overwrites a signed-in user's profile.
 */
export function buildSkipOnboardingDefaultPatch(
  currentState: Record<string, any> = {},
  nowIso: string = new Date().toISOString()
): Record<string, any> {
  const existingProfile = currentState.userProfile || {};
  const hasRealSignedInUser = Boolean(
    existingProfile &&
      existingProfile.email &&
      !existingProfile.isGuest &&
      existingProfile.authProvider !== 'guest_local'
  );

  const patch: Record<string, any> = {
    onboardingComplete: true,
    userHasCompletedOnboarding: true,
    hasCompletedFirstSetup: true,
    onboardingDismissedMode: 'skipped',
    weeklyWorkoutTarget: Number(currentState.weeklyWorkoutTarget) || 5,
    baseDiet: currentState.baseDiet || 'Vegan',
    dietPreference: currentState.dietPreference || 'vegan',
    diet: currentState.diet || 'Vegan',
    intolerances: Array.isArray(currentState.intolerances) ? currentState.intolerances : [],
    selectedDayIndex: Number.isFinite(currentState.selectedDayIndex) ? currentState.selectedDayIndex : 0,
    programWizardConfig: {
      daysPerWeek: 5,
      primaryFocus: 'balanced',
      difficulty: 'medium',
      goal: 'build_muscle',
      equipment: 'full_gym',
      weeklyWorkoutTarget: 5,
      diet: currentState.dietPreference || 'vegan',
      baseDiet: currentState.baseDiet || 'Vegan',
      intolerances: Array.isArray(currentState.intolerances) ? currentState.intolerances : [],
      skippedWizard: true,
      updatedAt: nowIso
    }
  };

  if (!hasRealSignedInUser) {
    patch.isGuestMode = true;
    patch.userProfile = {
      name: existingProfile.name || 'Guest',
      email: '',
      isGuest: true,
      authProvider: 'guest_local',
      signedInAt: existingProfile.signedInAt || nowIso
    };
  }

  return patch;
}

/**
 * Extracts the most recent logged lift weights for the Stats tab lookup table
 * so lifters can check past weights quickly before choosing today's load.
 */
export function extractRecentLiftWeights(
  workoutLogs: Record<string, WorkoutLogEntry> | null | undefined,
  exerciseNameMap: Record<string, string> = {},
  maxItems: number = 8
): RecentLiftSummary[] {
  if (!workoutLogs || typeof workoutLogs !== 'object') return [];

  const bestByExercise = new Map<string, RecentLiftSummary & { sortScore: number }>();

  Object.entries(workoutLogs).forEach(([key, entry]) => {
    if (!entry || (entry.done !== true && entry.isLogged !== true)) return;

    let week = 1;
    let dayIdx = 0;
    let exerciseId = '';
    let setIdx = 1;

    const mPref = key.match(/^w(\d+)_(?:d)?(\d+)_([a-z0-9_]+)_(?:s)?(\d+)$/i);
    if (mPref) {
      week = parseInt(mPref[1], 10) || 1;
      dayIdx = Math.max(0, Math.min(6, parseInt(mPref[2], 10) || 0));
      exerciseId = mPref[3];
      setIdx = parseInt(mPref[4], 10) || 1;
    } else {
      const mLeg = key.match(/^(\d+)_([a-z0-9_]+)_(\d+)$/i);
      if (!mLeg) return;
      week = 1;
      dayIdx = Math.max(0, Math.min(6, parseInt(mLeg[1], 10) || 0));
      exerciseId = mLeg[2];
      setIdx = parseInt(mLeg[3], 10) || 1;
    }

    const rawW = parseFloat(String(entry.weight ?? '0').replace(/[^\d.-]/g, ''));
    const weight = Number.isFinite(rawW) && rawW > 0 ? Math.min(MAX_WEIGHT, rawW) : 0;
    const rawR = parseInt(String(entry.reps ?? '0').replace(/[^\d-]/g, ''), 10);
    const reps = Number.isFinite(rawR) && rawR > 0 ? Math.min(MAX_REPS, rawR) : 0;
    if (reps <= 0) return;

    const unit: WeightUnit = entry.unit === 'kg' ? 'kg' : 'lbs';
    const estimated1Rm = weight > 0 ? (reps === 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10) : 0;
    const sortScore = week * 10000 + dayIdx * 100 + setIdx;

    const existing = bestByExercise.get(exerciseId);
    const shouldReplace =
      !existing ||
      sortScore > existing.sortScore ||
      (sortScore === existing.sortScore && weight > existing.weight);

    if (shouldReplace) {
      const fallbackName = exerciseId
        .replace(/^(mon|tue|wed|thu|fri|sat|sun|day\d+|d\d+)_/i, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      bestByExercise.set(exerciseId, {
        exerciseId,
        exerciseName: exerciseNameMap[exerciseId] || fallbackName,
        weight,
        reps,
        unit,
        estimated1Rm,
        week,
        dayNumber: dayIdx + 1,
        isBodyweight: weight === 0,
        sortScore
      });
    }
  });

  return Array.from(bestByExercise.values())
    .sort((a, b) => b.sortScore - a.sortScore)
    .slice(0, Math.max(1, maxItems))
    .map(({ sortScore: _ignored, ...summary }) => summary);
}
