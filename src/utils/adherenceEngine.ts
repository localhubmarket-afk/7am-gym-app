export interface WeeklyAdherenceSummary {
  weekNumber: number;
  completedWorkoutsCount: number;
  weeklyTarget: number;
  percentComplete: number;
  completedDayIndices: number[];
  remainingWorkouts: number;
  statusLabel: string;
  encouragementCopy: string;
  streakResetApplied: false;
}

export function computeAdherenceNeutralWeeklyProgress(options: {
  weekNumber: number;
  weeklyTarget?: number;
  workoutLogs?: Record<string, any> | null;
  pullupLogs?: Record<string, any> | null;
  cardioLogs?: Record<string, any> | null;
}): WeeklyAdherenceSummary {
  const safeWeek = Math.max(1, Math.min(12, Math.floor(Number(options.weekNumber) || 1)));
  const weeklyTarget = Math.max(1, Math.min(7, Math.floor(Number(options.weeklyTarget) || 3)));

  const completedDays = new Set<number>();

  const workoutLogs = options.workoutLogs || {};
  const wPrefix = `w${safeWeek}_`;
  Object.entries(workoutLogs).forEach(([key, val]) => {
    if (!val || (val.done !== true && val.isLogged !== true)) return;
    if (key.startsWith(wPrefix)) {
      const match = key.match(/^w\d+_(\d+)_/);
      if (match) {
        const dayIdx = parseInt(match[1], 10);
        if (dayIdx >= 0 && dayIdx <= 6) {
          completedDays.add(dayIdx);
        }
      }
      return;
    }
    // Support legacy Week 1 unprefixed workoutLogs keys (e.g. "0_mon_bench_1")
    if (safeWeek === 1) {
      const legacyMatch = key.match(/^(\d+)_[a-z]/i);
      if (legacyMatch) {
        const dayIdx = parseInt(legacyMatch[1], 10);
        if (dayIdx >= 0 && dayIdx <= 6) {
          completedDays.add(dayIdx);
        }
      }
    }
  });

  const cardioLogs = options.cardioLogs || {};
  Object.entries(cardioLogs).forEach(([key, val]) => {
    if (!key.startsWith(`w${safeWeek}_d`)) return;
    if (!val || val.done !== true) return;
    const match = key.match(/^w\d+_d(\d+)_/);
    if (match) {
      const dayIdx = parseInt(match[1], 10);
      if (dayIdx >= 0 && dayIdx <= 6) {
        completedDays.add(dayIdx);
      }
    }
  });

  const pullupLogs = options.pullupLogs || {};
  Object.entries(pullupLogs).forEach(([key, val]) => {
    if (!key.startsWith(`w${safeWeek}_day_`)) return;
    if (!val || (val.done !== true && val.isLogged !== true)) return;
    const match = key.match(/^w\d+_day_(\d+)_/);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      if (dayNum >= 1 && dayNum <= 7) {
        completedDays.add(dayNum - 1);
      }
    }
  });

  const completedDayIndices = Array.from(completedDays).sort((a, b) => a - b);
  const completedWorkoutsCount = completedDayIndices.length;
  const remainingWorkouts = Math.max(0, weeklyTarget - completedWorkoutsCount);
  const percentComplete = Math.min(100, Math.round((completedWorkoutsCount / weeklyTarget) * 100));

  let statusLabel = `${completedWorkoutsCount} of ${weeklyTarget} workouts completed this week`;
  let encouragementCopy = 'Move your gym days any way you need. Missing a day never resets your progress.';

  if (completedWorkoutsCount === 0) {
    statusLabel = `0 of ${weeklyTarget} workouts completed this week`;
    encouragementCopy = 'Start whenever you are ready. Any day counts toward your weekly goal.';
  } else if (completedWorkoutsCount >= weeklyTarget) {
    statusLabel = `${completedWorkoutsCount} of ${weeklyTarget} workouts completed this week (Goal hit!)`;
    encouragementCopy = 'You hit your flexible weekly target. Great consistency.';
  } else if (remainingWorkouts === 1) {
    statusLabel = `${completedWorkoutsCount} of ${weeklyTarget} workouts completed this week`;
    encouragementCopy = 'Just 1 more workout any day this week to hit your goal.';
  } else {
    statusLabel = `${completedWorkoutsCount} of ${weeklyTarget} workouts completed this week`;
    encouragementCopy = `${remainingWorkouts} more workouts any day this week. Take rest days when you need them.`;
  }

  return {
    weekNumber: safeWeek,
    completedWorkoutsCount,
    weeklyTarget,
    percentComplete,
    completedDayIndices,
    remainingWorkouts,
    statusLabel,
    encouragementCopy,
    streakResetApplied: false
  };
}

export interface Rolling30DayConsistencySummary {
  completedLast30Days: number;
  plannedLast30Days: number;
  consistencyPercent: number;
  windowDays: 30;
  statusLabel: string;
  encouragementCopy: string;
  streakResetApplied: false;
}

/**
 * Adherence-Neutral Rolling 30-Day Consistency Score
 *
 * Computes a simple percentage of completed vs. planned workouts over the last 30 days.
 * Never resets progress to zero when a user misses a day or takes a rest day.
 * Supports both ISO-dated session logs and week/day keyed gym_state logs across the
 * most recent 4+ training weeks (~30 days).
 */
export function computeRolling30DayConsistencyScore(options: {
  plannedDaysPerWeek?: number;
  currentWeek?: number;
  workoutLogs?: Record<string, any> | null;
  pullupLogs?: Record<string, any> | null;
  cardioLogs?: Record<string, any> | null;
  completedSessionDates?: string[] | null;
  referenceDate?: Date;
}): Rolling30DayConsistencySummary {
  const daysPerWeek = Math.max(1, Math.min(7, Math.floor(Number(options.plannedDaysPerWeek) || 5)));
  const plannedLast30Days = Math.max(1, Math.round((daysPerWeek * 30) / 7));
  const refDate = options.referenceDate instanceof Date ? options.referenceDate : new Date();
  const windowStartMs = refDate.getTime() - 30 * 24 * 60 * 60 * 1000;
  const safeCurrentWeek = Math.max(1, Math.min(12, Math.floor(Number(options.currentWeek) || 1)));
  const minWindowWeek = Math.max(1, safeCurrentWeek - 3);

  const uniqueSessions = new Set<string>();

  // 1. Explicit ISO date session list (e.g. ["2026-11-01", "2026-11-03"])
  if (Array.isArray(options.completedSessionDates)) {
    for (const rawDate of options.completedSessionDates) {
      const parsed = Date.parse(String(rawDate || ''));
      if (!Number.isNaN(parsed) && parsed >= windowStartMs && parsed <= refDate.getTime() + 86400000) {
        const dayIso = new Date(parsed).toISOString().slice(0, 10);
        uniqueSessions.add(`date:${dayIso}`);
      }
    }
  }

  const recordLogSession = (weekNum: number, dayIdx: number, entry: any) => {
    const tsRaw = entry?.loggedAt || entry?.updatedAt || entry?.completedAt || entry?.date;
    if (tsRaw) {
      const parsed = Date.parse(String(tsRaw));
      if (!Number.isNaN(parsed)) {
        if (parsed >= windowStartMs && parsed <= refDate.getTime() + 86400000) {
          uniqueSessions.add(`date:${new Date(parsed).toISOString().slice(0, 10)}`);
        }
        return;
      }
    }
    if (weekNum >= minWindowWeek && weekNum <= safeCurrentWeek && dayIdx >= 0 && dayIdx <= 6) {
      uniqueSessions.add(`w${weekNum}_d${dayIdx}`);
    }
  };

  // 2. Scan gym_state.workoutLogs
  Object.entries(options.workoutLogs || {}).forEach(([key, val]) => {
    if (!val || (val.done !== true && val.isLogged !== true)) return;
    const match = key.match(/^w(\d+)_(\d+)_/);
    if (match) {
      recordLogSession(parseInt(match[1], 10), parseInt(match[2], 10), val);
      return;
    }
    const legacyMatch = key.match(/^(\d+)_[a-z]/i);
    if (legacyMatch) {
      recordLogSession(1, parseInt(legacyMatch[1], 10), val);
    }
  });

  // 3. Scan gym_state.cardioLogs
  Object.entries(options.cardioLogs || {}).forEach(([key, val]) => {
    if (!val || val.done !== true) return;
    const match = key.match(/^w(\d+)_d(\d+)_/);
    if (match) {
      recordLogSession(parseInt(match[1], 10), parseInt(match[2], 10), val);
    }
  });

  // 4. Scan gym_state.pullupLogs
  Object.entries(options.pullupLogs || {}).forEach(([key, val]) => {
    if (!val || (val.done !== true && val.isLogged !== true)) return;
    const match = key.match(/^w(\d+)_day_(\d+)_/);
    if (match) {
      const dayNum = parseInt(match[2], 10);
      if (dayNum >= 1 && dayNum <= 7) {
        recordLogSession(parseInt(match[1], 10), dayNum - 1, val);
      }
    }
  });

  const completedLast30Days = uniqueSessions.size;
  const consistencyPercent = Math.min(
    100,
    Math.round((completedLast30Days / plannedLast30Days) * 100)
  );

  let statusLabel = `${consistencyPercent}% Rolling 30-Day Consistency (${completedLast30Days} of ${plannedLast30Days} planned workouts)`;
  let encouragementCopy =
    'Take rest days when you need them. Missing a day never resets your progress to zero.';

  if (completedLast30Days === 0) {
    statusLabel = `0% Rolling 30-Day Consistency (0 of ${plannedLast30Days} planned workouts)`;
    encouragementCopy =
      'Start with just one short warm-up set when you feel ready. Take rest days when you need them.';
  } else if (consistencyPercent >= 80) {
    encouragementCopy =
      'Steady effort over the last 30 days. Take rest days when you need them so your body stays strong.';
  } else {
    encouragementCopy =
      'Every single session counts toward your 30-day score. Take rest days when you need them.';
  }

  return {
    completedLast30Days,
    plannedLast30Days,
    consistencyPercent,
    windowDays: 30,
    statusLabel,
    encouragementCopy,
    streakResetApplied: false
  };
}

