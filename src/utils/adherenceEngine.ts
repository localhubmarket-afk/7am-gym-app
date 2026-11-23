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
    if (!key.startsWith(wPrefix)) return;
    if (!val || (val.done !== true && val.isLogged !== true)) return;
    const match = key.match(/^w\d+_(\d+)_/);
    if (match) {
      const dayIdx = parseInt(match[1], 10);
      if (dayIdx >= 0 && dayIdx <= 6) {
        completedDays.add(dayIdx);
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
    statusLabel = `${completedWorkoutsCount} workouts completed this week (Goal hit!)`;
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
