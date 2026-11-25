/**
 * Task 2: Workout Resume & Background State Manager (Strong / Hevy Best Practices)
 * - Persists the active workout session (week, day, active exercise, next incomplete
 *   exercise, rest timer wall-clock deadline) to localStorage so it survives browser
 *   refreshes, screen locks, and mobile OS background suspension.
 * - Automatically resumes to the active or next exercise on reopen without requiring
 *   a new login.
 */

export const ACTIVE_WORKOUT_SESSION_KEY = 'budget_gym_active_session_v1';
export const MAX_RESUME_SESSION_AGE_MS = 18 * 60 * 60 * 1000; // 18 hours

export interface ExerciseSummaryLike {
  id: string;
  name: string;
  sets: number;
}

export interface ActiveWorkoutSessionSnapshot {
  week: number;
  dayIndex: number;
  dayLabel: string;
  activeExerciseId: string | null;
  activeExerciseName: string | null;
  activeExerciseIndex: number;
  nextExerciseId: string | null;
  nextExerciseName: string | null;
  nextExerciseIndex: number;
  completedSets: number;
  totalSets: number;
  timerRunning: boolean;
  timerRemainingSec: number;
  timerEndTimestampMs: number | null;
  savedAtMs: number;
  savedAtIso: string;
  lastAction: string;
}

export interface ComputeActiveExerciseInput {
  week: number;
  dayIndex: number;
  dayLabel?: string;
  exercises: ExerciseSummaryLike[];
  workoutLogs?: Record<string, any> | null;
  lastTouchedExerciseId?: string | null;
  timerRunning?: boolean;
  timerRemainingSec?: number;
  timerEndTimestampMs?: number | null;
  lastAction?: string;
  nowMs?: number;
}

export interface ResumeWorkoutBannerCopy {
  visible: boolean;
  headline: string;
  detail: string;
  ctaLabel: string;
  targetExerciseId: string | null;
  targetExerciseIndex: number;
}

/**
 * Counts logged sets for a single exercise on a given week & day.
 */
function countDoneSetsForExercise(
  workoutLogs: Record<string, any>,
  week: number,
  dayIndex: number,
  exerciseId: string,
  totalSets: number
): number {
  let done = 0;
  for (let s = 1; s <= totalSets; s += 1) {
    const key = `w${week}_d${dayIndex}_${exerciseId}_s${s}`;
    const entry = workoutLogs[key];
    if (entry && (entry.done === true || entry.isLogged === true)) {
      done += 1;
    }
  }
  return done;
}

/**
 * Computes the active in-progress exercise and the next incomplete exercise
 * so reopening the app after screen lock or refresh lands right where the user left off.
 */
export function buildActiveWorkoutSessionSnapshot(
  input: ComputeActiveExerciseInput
): ActiveWorkoutSessionSnapshot {
  const week = Math.max(1, Math.round(Number(input.week) || 1));
  const dayIndex = Math.max(0, Math.min(6, Math.round(Number(input.dayIndex) || 0)));
  const logs = input.workoutLogs && typeof input.workoutLogs === 'object' ? input.workoutLogs : {};
  const exercises = Array.isArray(input.exercises) ? input.exercises : [];
  const nowMs = typeof input.nowMs === 'number' && Number.isFinite(input.nowMs) ? input.nowMs : Date.now();

  let totalSets = 0;
  let completedSets = 0;
  let firstIncompleteIdx = -1;
  let touchedIdx = -1;
  let touchedIncomplete = false;

  exercises.forEach((ex, idx) => {
    const setCount = Math.max(1, Math.round(Number(ex.sets) || 1));
    totalSets += setCount;
    const exDone = countDoneSetsForExercise(logs, week, dayIndex, ex.id, setCount);
    completedSets += exDone;

    if (exDone < setCount && firstIncompleteIdx === -1) {
      firstIncompleteIdx = idx;
    }
    if (input.lastTouchedExerciseId && ex.id === input.lastTouchedExerciseId) {
      touchedIdx = idx;
      touchedIncomplete = exDone < setCount;
    }
  });

  // Strong/Hevy pattern:
  // - If the user was actively working on an incomplete exercise, resume that exact exercise.
  // - If they just finished that exercise's final set, auto-advance to the next incomplete exercise!
  let targetIdx = firstIncompleteIdx;
  if (touchedIdx >= 0 && touchedIncomplete) {
    targetIdx = touchedIdx;
  } else if (touchedIdx >= 0 && !touchedIncomplete) {
    // Look for next incomplete exercise after touchedIdx, else wrap to firstIncompleteIdx
    let afterIdx = -1;
    for (let i = touchedIdx + 1; i < exercises.length; i += 1) {
      const ex = exercises[i];
      const setCount = Math.max(1, Math.round(Number(ex.sets) || 1));
      if (countDoneSetsForExercise(logs, week, dayIndex, ex.id, setCount) < setCount) {
        afterIdx = i;
        break;
      }
    }
    targetIdx = afterIdx >= 0 ? afterIdx : firstIncompleteIdx;
  }

  const activeEx = targetIdx >= 0 ? exercises[targetIdx] : null;
  const nextEx = firstIncompleteIdx >= 0 ? exercises[firstIncompleteIdx] : activeEx;

  return {
    week,
    dayIndex,
    dayLabel: String(input.dayLabel || `Week ${week} • Day ${dayIndex + 1}`).trim(),
    activeExerciseId: activeEx ? activeEx.id : null,
    activeExerciseName: activeEx ? activeEx.name : null,
    activeExerciseIndex: targetIdx >= 0 ? targetIdx : 0,
    nextExerciseId: nextEx ? nextEx.id : null,
    nextExerciseName: nextEx ? nextEx.name : null,
    nextExerciseIndex: firstIncompleteIdx >= 0 ? firstIncompleteIdx : 0,
    completedSets,
    totalSets,
    timerRunning: Boolean(input.timerRunning),
    timerRemainingSec: Math.max(0, Math.round(Number(input.timerRemainingSec) || 0)),
    timerEndTimestampMs:
      typeof input.timerEndTimestampMs === 'number' && Number.isFinite(input.timerEndTimestampMs)
        ? input.timerEndTimestampMs
        : null,
    savedAtMs: nowMs,
    savedAtIso: new Date(nowMs).toISOString(),
    lastAction: String(input.lastAction || 'workout_activity')
  };
}

/**
 * Saves the active workout session snapshot to localStorage cleanly.
 */
export function saveActiveWorkoutSession(
  snapshot: ActiveWorkoutSessionSnapshot,
  storage?: Pick<Storage, 'setItem'> | null
): boolean {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.setItem(ACTIVE_WORKOUT_SESSION_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads a valid, non-expired active workout session snapshot from localStorage.
 * Recalculates live remaining rest timer seconds using wall-clock timestamps.
 */
export function loadActiveWorkoutSession(
  storage?: Pick<Storage, 'getItem' | 'removeItem'> | null,
  nowMs: number = Date.now()
): ActiveWorkoutSessionSnapshot | null {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return null;

  try {
    const raw = store.getItem(ACTIVE_WORKOUT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveWorkoutSessionSnapshot>;
    if (!parsed || typeof parsed !== 'object') return null;

    const savedAtMs = typeof parsed.savedAtMs === 'number' ? parsed.savedAtMs : 0;
    if (!savedAtMs || nowMs - savedAtMs > MAX_RESUME_SESSION_AGE_MS) {
      return null;
    }

    let timerRemainingSec = Math.max(0, Math.round(Number(parsed.timerRemainingSec) || 0));
    let timerRunning = Boolean(parsed.timerRunning);
    if (timerRunning && typeof parsed.timerEndTimestampMs === 'number') {
      const liveLeft = Math.ceil((parsed.timerEndTimestampMs - nowMs) / 1000);
      if (liveLeft <= 0) {
        timerRemainingSec = 0;
        timerRunning = false;
      } else {
        timerRemainingSec = liveLeft;
      }
    }

    return {
      week: Math.max(1, Math.round(Number(parsed.week) || 1)),
      dayIndex: Math.max(0, Math.min(6, Math.round(Number(parsed.dayIndex) || 0))),
      dayLabel: String(parsed.dayLabel || `Week ${parsed.week || 1} • Day ${(parsed.dayIndex || 0) + 1}`),
      activeExerciseId: parsed.activeExerciseId || null,
      activeExerciseName: parsed.activeExerciseName || null,
      activeExerciseIndex: Math.max(0, Math.round(Number(parsed.activeExerciseIndex) || 0)),
      nextExerciseId: parsed.nextExerciseId || null,
      nextExerciseName: parsed.nextExerciseName || null,
      nextExerciseIndex: Math.max(0, Math.round(Number(parsed.nextExerciseIndex) || 0)),
      completedSets: Math.max(0, Math.round(Number(parsed.completedSets) || 0)),
      totalSets: Math.max(0, Math.round(Number(parsed.totalSets) || 0)),
      timerRunning,
      timerRemainingSec,
      timerEndTimestampMs: parsed.timerEndTimestampMs ?? null,
      savedAtMs,
      savedAtIso: String(parsed.savedAtIso || new Date(savedAtMs).toISOString()),
      lastAction: String(parsed.lastAction || 'resume')
    };
  } catch {
    return null;
  }
}

export function clearActiveWorkoutSession(
  storage?: Pick<Storage, 'removeItem'> | null
): void {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  try {
    store.removeItem(ACTIVE_WORKOUT_SESSION_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Generates short ELI12 copy for the Resume Workout banner.
 */
export function buildResumeWorkoutBannerCopy(
  snapshot: ActiveWorkoutSessionSnapshot | null
): ResumeWorkoutBannerCopy {
  if (!snapshot || !snapshot.activeExerciseId) {
    return {
      visible: false,
      headline: '',
      detail: '',
      ctaLabel: 'Jump to Exercise',
      targetExerciseId: null,
      targetExerciseIndex: 0
    };
  }

  const isWorkoutDone = snapshot.totalSets > 0 && snapshot.completedSets >= snapshot.totalSets;
  if (isWorkoutDone) {
    return {
      visible: false,
      headline: '',
      detail: '',
      ctaLabel: 'View Workout',
      targetExerciseId: null,
      targetExerciseIndex: 0
    };
  }

  const exerciseNum = snapshot.activeExerciseIndex + 1;
  const setsProgress =
    snapshot.totalSets > 0 ? `${snapshot.completedSets}/${snapshot.totalSets} sets done` : 'Session ready';
  const timerNote =
    snapshot.timerRunning && snapshot.timerRemainingSec > 0
      ? ` • Rest timer: ${snapshot.timerRemainingSec}s left`
      : '';

  return {
    visible: true,
    headline: `Welcome back! Pick up at #${exerciseNum}: ${snapshot.activeExerciseName || 'Next Exercise'}`,
    detail: `${snapshot.dayLabel} (${setsProgress}${timerNote}). No login needed.`,
    ctaLabel: `Resume #${exerciseNum}`,
    targetExerciseId: snapshot.activeExerciseId,
    targetExerciseIndex: snapshot.activeExerciseIndex
  };
}
