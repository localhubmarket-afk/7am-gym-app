import React, { useMemo } from 'react';
import {
  computeAdherenceNeutralWeeklyProgress,
  type WeeklyAdherenceSummary
} from '../utils/adherenceEngine';

export interface GymStateForWeeklyGoal {
  currentWeek?: number;
  selectedWeek?: number;
  weeklyWorkoutTarget?: number;
  programWizardConfig?: {
    daysPerWeek?: number;
  };
  workoutLogs?: Record<string, any> | null;
  pullupLogs?: Record<string, any> | null;
  cardioLogs?: Record<string, any> | null;
}

export interface WeeklyAdherenceCardProps {
  /** Preferred live binding: pass active gym_state directly so UI always reflects workoutLogs */
  gymState?: GymStateForWeeklyGoal | null;
  /** Optional pre-computed summary (preserved for backwards compatibility) */
  summary?: WeeklyAdherenceSummary;
  onViewMicroWins?: () => void;
}

/**
 * Task 2: Flexible Weekly Goal card strictly bound to active gym_state.workoutLogs.
 * Zero hardcoded visual counts — when workoutLogs is empty, instantly renders
 * "0 of 5 workouts completed this week" (or the user's configured weekly target).
 */
export const WeeklyAdherenceCard: React.FC<WeeklyAdherenceCardProps> = ({
  gymState,
  summary,
  onViewMicroWins
}) => {
  const activeSummary = useMemo<WeeklyAdherenceSummary>(() => {
    if (gymState) {
      const weekNumber = Math.max(
        1,
        Number(gymState.selectedWeek || gymState.currentWeek || 1)
      );
      const weeklyTarget = Math.max(
        1,
        Math.min(
          7,
          Number(
            gymState.weeklyWorkoutTarget ||
              gymState.programWizardConfig?.daysPerWeek ||
              5
          )
        )
      );
      return computeAdherenceNeutralWeeklyProgress({
        weekNumber,
        weeklyTarget,
        workoutLogs: gymState.workoutLogs || {},
        pullupLogs: gymState.pullupLogs || {},
        cardioLogs: gymState.cardioLogs || {}
      });
    }
    if (summary) {
      return summary;
    }
    return computeAdherenceNeutralWeeklyProgress({
      weekNumber: 1,
      weeklyTarget: 5,
      workoutLogs: {},
      pullupLogs: {},
      cardioLogs: {}
    });
  }, [gymState, summary]);

  return (
    <section
      aria-label="Weekly flexible workout goal"
      data-completed-workouts={activeSummary.completedWorkoutsCount}
      data-weekly-target={activeSummary.weeklyTarget}
      className="rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-3.5 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
            Flexible Weekly Goal • Week {activeSummary.weekNumber}
          </div>
          <div
            data-testid="weekly-goal-status-text"
            className="mt-0.5 text-sm font-extrabold text-white"
          >
            {activeSummary.statusLabel}
          </div>
        </div>
        {onViewMicroWins && (
          <button
            type="button"
            onClick={onViewMicroWins}
            className="min-h-[38px] shrink-0 rounded-lg border border-amber-400/60 bg-amber-600/20 px-3 py-1.5 text-xs font-extrabold text-amber-100 hover:bg-amber-600/30"
          >
            ★ View Wins
          </button>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={activeSummary.percentComplete}
        className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${activeSummary.percentComplete}%` }}
        />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        {activeSummary.encouragementCopy}
      </p>
    </section>
  );
};
