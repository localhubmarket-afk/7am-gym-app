import { calculateWcagContrastRatio } from './themeProvider';

export const MIN_FLEXIBLE_SETS = 1;
export const MAX_FLEXIBLE_SETS = 12;

export const FLEXIBLE_SET_STEPPER_PALETTE = {
  weightContainerBg: '#172554',
  weightContainerBorder: '#1E40AF',
  weightInputText: '#FFFFFF',
  weightPlaceholderText: '#BFDBFE',
  weightMinusBg: '#991B1B',
  weightMinusHoverBg: '#B91C1C',
  weightMinusText: '#FFFFFF',
  weightPlusBg: '#166534',
  weightPlusHoverBg: '#15803D',
  weightPlusText: '#FFFFFF',
  repsContainerBg: '#E5E7EB',
  repsContainerBorder: '#9CA3AF',
  repsInputText: '#111827',
  repsPlaceholderText: '#374151',
  repsButtonBg: '#4B5563',
  repsButtonHoverBg: '#374151',
  repsButtonText: '#FFFFFF'
} as const;

export interface StepperContrastCheck {
  name: string;
  fg: string;
  bg: string;
  ratio: number;
  passed: boolean;
}

export interface StepperContrastReport {
  passed: boolean;
  minRatio: number;
  checks: StepperContrastCheck[];
}

export function verifyStepperWcagContrastCompliance(minRequiredRatio = 4.5): StepperContrastReport {
  const p = FLEXIBLE_SET_STEPPER_PALETTE;
  const pairs: Array<{ name: string; fg: string; bg: string }> = [
    { name: 'weightInputOnDeepBlue', fg: p.weightInputText, bg: p.weightContainerBg },
    { name: 'weightPlaceholderOnDeepBlue', fg: p.weightPlaceholderText, bg: p.weightContainerBg },
    { name: 'weightMinusOnCrimson', fg: p.weightMinusText, bg: p.weightMinusBg },
    { name: 'weightMinusOnCrimsonHover', fg: p.weightMinusText, bg: p.weightMinusHoverBg },
    { name: 'weightPlusOnForestGreen', fg: p.weightPlusText, bg: p.weightPlusBg },
    { name: 'weightPlusOnForestGreenHover', fg: p.weightPlusText, bg: p.weightPlusHoverBg },
    { name: 'repsInputOnLightGray', fg: p.repsInputText, bg: p.repsContainerBg },
    { name: 'repsPlaceholderOnLightGray', fg: p.repsPlaceholderText, bg: p.repsContainerBg },
    { name: 'repsButtonOnNeutralGray', fg: p.repsButtonText, bg: p.repsButtonBg },
    { name: 'repsButtonOnNeutralGrayHover', fg: p.repsButtonText, bg: p.repsButtonHoverBg }
  ];

  const checks: StepperContrastCheck[] = pairs.map((item) => {
    const ratio = calculateWcagContrastRatio(item.fg, item.bg);
    return {
      name: item.name,
      fg: item.fg,
      bg: item.bg,
      ratio,
      passed: ratio >= minRequiredRatio
    };
  });

  const minRatio = checks.reduce((acc, item) => Math.min(acc, item.ratio), Infinity);
  return {
    passed: checks.every((item) => item.passed),
    minRatio: Number.isFinite(minRatio) ? minRatio : 0,
    checks
  };
}

export interface MicroStartVisibilityInput {
  isRestDay: boolean;
  todayDoneSets: number;
  microStartActive: boolean;
}

/**
 * Shows the 2-Minute Micro-Start prompt right below the Day header ONLY when needed:
 * - Never on rest days.
 * - Always while the user is actively inside Micro-Start Focus Mode.
 * - Otherwise ONLY when 0 sets have been logged today (initiation friction window).
 *   As soon as Set 1 is logged, it hides automatically to reduce cognitive load.
 */
export function shouldShowMicroStartPanel(input: MicroStartVisibilityInput): boolean {
  if (input.isRestDay) return false;
  if (input.microStartActive) return true;
  const doneSets = Math.max(0, Math.floor(Number(input.todayDoneSets) || 0));
  return doneSets === 0;
}

export interface ResumeBannerVisibilityInput {
  snapshot: {
    week?: number;
    dayIndex?: number;
    completedSets?: number;
    totalSets?: number;
    timerRunning?: boolean;
    lastExerciseName?: string;
    lastExerciseId?: string;
  } | null | undefined;
  dismissedThisLoad?: boolean;
  currentWeek?: number;
  currentDayIdx?: number;
  isRestDay?: boolean;
}

/**
 * Shows the Active Workout Saved banner directly below the Day header ONLY when
 * there is an unfinished session that actually needs recovery (e.g., unfinished
 * sets saved from another day/week or an active session waiting to resume).
 */
export function shouldShowResumeWorkoutBanner(input: ResumeBannerVisibilityInput): boolean {
  if (input.dismissedThisLoad) return false;
  const snap = input.snapshot;
  if (!snap || typeof snap !== 'object') return false;

  const completed = Math.max(0, Math.floor(Number(snap.completedSets) || 0));
  const total = Math.max(0, Math.floor(Number(snap.totalSets) || 0));
  const timerRunning = Boolean(snap.timerRunning);

  if (completed <= 0 && !timerRunning) return false;
  if (total > 0 && completed >= total && !timerRunning) return false;
  if (input.isRestDay && Number(snap.week) === Number(input.currentWeek) && Number(snap.dayIndex) === Number(input.currentDayIdx)) {
    return false;
  }

  return true;
}

export function getExerciseSetOverrideKey(week: number, dayIdx: number, exId: string): string {
  const safeWeek = Math.max(1, Math.floor(Number(week) || 1));
  const safeDay = Math.max(0, Math.floor(Number(dayIdx) || 0));
  const safeEx = String(exId || 'exercise').trim() || 'exercise';
  return `w${safeWeek}_d${safeDay}_${safeEx}`;
}

export function clampFlexibleSetCount(count: number, fallback = 3): number {
  const parsed = Number(count);
  const base = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  return Math.max(MIN_FLEXIBLE_SETS, Math.min(MAX_FLEXIBLE_SETS, base));
}

export function resolveEffectiveExerciseSetCount(params: {
  overridesMap?: Record<string, number> | null;
  week: number;
  dayIdx: number;
  exId: string;
  baseSets: number;
}): number {
  const safeBase = clampFlexibleSetCount(params.baseSets, 3);
  const map = params.overridesMap;
  if (!map || typeof map !== 'object') return safeBase;
  const key = getExerciseSetOverrideKey(params.week, params.dayIdx, params.exId);
  const custom = Number(map[key]);
  if (Number.isFinite(custom) && custom >= MIN_FLEXIBLE_SETS && custom <= MAX_FLEXIBLE_SETS) {
    return Math.floor(custom);
  }
  return safeBase;
}

export function adjustExerciseSetCount(params: {
  overridesMap?: Record<string, number> | null;
  week: number;
  dayIdx: number;
  exId: string;
  baseSets: number;
  delta: number;
}): { nextCount: number; overridesMap: Record<string, number>; changed: boolean } {
  const current = resolveEffectiveExerciseSetCount(params);
  const deltaInt = Math.trunc(Number(params.delta) || 0);
  const nextCount = clampFlexibleSetCount(current + deltaInt, current);
  const nextMap: Record<string, number> = Object.assign({}, params.overridesMap || {});
  const key = getExerciseSetOverrideKey(params.week, params.dayIdx, params.exId);
  nextMap[key] = nextCount;
  return {
    nextCount,
    overridesMap: nextMap,
    changed: nextCount !== current
  };
}

export function resolveWeightStepIncrement(params: {
  unit: 'lbs' | 'kg' | string;
  isBodyweightOrPullup?: boolean;
  defaultWeightLbs?: number;
}): number {
  const isKg = String(params.unit || 'lbs').toLowerCase() === 'kg';
  const defaultLbs = Number(params.defaultWeightLbs) || 0;
  if (params.isBodyweightOrPullup || defaultLbs <= 25) {
    return isKg ? 1.25 : 2.5;
  }
  return isKg ? 2.5 : 5;
}

export function stepWeightValue(params: {
  currentValue?: string | number | null;
  placeholderValue?: string | number | null;
  delta: number;
  unit?: 'lbs' | 'kg' | string;
}): string {
  const isKg = String(params.unit || 'lbs').toLowerCase() === 'kg';
  const maxVal = isKg ? 455 : 999;
  const rawCur = params.currentValue !== undefined && params.currentValue !== null ? String(params.currentValue).trim() : '';
  const rawPh = params.placeholderValue !== undefined && params.placeholderValue !== null ? String(params.placeholderValue).trim() : '';

  const curNum = rawCur !== '' && Number.isFinite(Number(rawCur)) ? Number(rawCur) : null;
  const phNum = rawPh !== '' && Number.isFinite(Number(rawPh)) ? Number(rawPh) : 0;
  const base = curNum !== null ? curNum : phNum;

  const nextRaw = +(base + (Number(params.delta) || 0)).toFixed(2);
  const clamped = Math.max(0, Math.min(maxVal, nextRaw));
  return String(clamped);
}

export function stepRepsValue(params: {
  currentValue?: string | number | null;
  placeholderValue?: string | number | null;
  delta: number;
}): string {
  const rawCur = params.currentValue !== undefined && params.currentValue !== null ? String(params.currentValue).trim() : '';
  const rawPh = params.placeholderValue !== undefined && params.placeholderValue !== null ? String(params.placeholderValue).trim() : '';

  const curInt = rawCur !== '' && Number.isFinite(parseInt(rawCur, 10)) ? parseInt(rawCur, 10) : null;
  const phInt = rawPh !== '' && Number.isFinite(parseInt(rawPh, 10)) ? parseInt(rawPh, 10) : 8;
  const base = curInt !== null ? curInt : phInt;
  const clamped = Math.max(0, Math.min(100, base + Math.round(Number(params.delta) || 0)));
  return String(clamped);
}

/**
 * Marking a single set Done must NEVER lock or collapse the exercise.
 * Users keep full per-set editing (weight, reps, Add/Remove Set) at all times.
 */
export function shouldLockExerciseOnSetDone(params: {
  setDoneCount: number;
  totalSetsCount: number;
  autoCollapseEnabled?: boolean;
}): { shouldLockInputs: boolean; shouldAutoCollapse: boolean } {
  void params;
  return {
    shouldLockInputs: false,
    shouldAutoCollapse: false
  };
}
