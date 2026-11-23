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
  /** Alias for direct snake_case gym_state binding */
  gym_state?: GymStateForWeeklyGoal | null;
  /** Optional pre-computed summary (preserved for backwards compatibility) */
  summary?: WeeklyAdherenceSummary;
  onViewMicroWins?: () => void;
}

/**
 * Connected Adherence-Neutral Weekly Goal card strictly bound to active gym_state.workoutLogs.
 * Zero hardcoded visual counts — when workoutLogs is empty or cleared via data reset,
 * dynamically and instantaneously renders "0 of N workouts completed this week" (0).
 */
export const WeeklyAdherenceCard: React.FC<WeeklyAdherenceCardProps> = ({
  gymState,
  gym_state,
  summary,
  onViewMicroWins
}) => {
  const boundGymState = gymState ?? gym_state ?? null;
  const boundWorkoutLogs = boundGymState?.workoutLogs ?? null;
  const boundPullupLogs = boundGymState?.pullupLogs ?? null;
  const boundCardioLogs = boundGymState?.cardioLogs ?? null;

  const activeSummary = useMemo<WeeklyAdherenceSummary>(() => {
    if (boundGymState) {
      const weekNumber = Math.max(
        1,
        Number(boundGymState.selectedWeek || boundGymState.currentWeek || 1)
      );
      const weeklyTarget = Math.max(
        1,
        Math.min(
          7,
          Number(
            boundGymState.weeklyWorkoutTarget ||
              boundGymState.programWizardConfig?.daysPerWeek ||
              5
          )
        )
      );
      return computeAdherenceNeutralWeeklyProgress({
        weekNumber,
        weeklyTarget,
        workoutLogs: boundWorkoutLogs || {},
        pullupLogs: boundPullupLogs || {},
        cardioLogs: boundCardioLogs || {}
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
  }, [boundGymState, boundWorkoutLogs, boundPullupLogs, boundCardioLogs, summary]);

  return (
    <section
      aria-label={`Weekly flexible workout goal for week ${activeSummary.weekNumber}`}
      data-completed-workouts={activeSummary.completedWorkoutsCount}
      data-weekly-target={activeSummary.weeklyTarget}
      className="rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-3.5 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[0.6875rem] font-extrabold uppercase tracking-wider leading-relaxed text-emerald-300">
            Flexible Weekly Goal • Week {activeSummary.weekNumber}
          </div>
          <div
            data-testid="weekly-goal-status-text"
            aria-live="polite"
            aria-atomic="true"
            className="mt-0.5 text-sm font-extrabold leading-relaxed text-white"
          >
            {activeSummary.statusLabel}
          </div>
        </div>
        {onViewMicroWins && (
          <button
            type="button"
            onClick={onViewMicroWins}
            aria-label="View your session micro-wins"
            className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl border border-amber-400/60 bg-amber-600/20 px-3 py-2 text-xs font-extrabold leading-relaxed text-amber-100 hover:bg-amber-600/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <span aria-hidden="true">★ </span>
            <span>View Wins</span>
          </button>
        )}
      </div>

      <div
        role="progressbar"
        aria-label="Weekly workout goal completion progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={activeSummary.percentComplete}
        aria-valuetext={activeSummary.statusLabel}
        className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${activeSummary.percentComplete}%` }}
        />
      </div>

      <p
        aria-live="polite"
        className="mt-2 text-xs leading-relaxed text-slate-300"
      >
        {activeSummary.encouragementCopy}
      </p>
    </section>
  );
};
