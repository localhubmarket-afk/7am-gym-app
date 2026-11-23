import React, { useMemo } from 'react';
import {
  computeAdherenceNeutralWeeklyProgress,
  computeRolling30DayConsistencyScore,
  type Rolling30DayConsistencySummary,
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
  completedSessionDates?: string[] | null;
}

export interface WeeklyAdherenceCardProps {
  /** Preferred live binding: pass active gym_state directly so UI always reflects workoutLogs */
  gymState?: GymStateForWeeklyGoal | null;
  /** Alias for direct snake_case gym_state binding */
  gym_state?: GymStateForWeeklyGoal | null;
  /** Optional pre-computed summary (preserved for backwards compatibility) */
  summary?: WeeklyAdherenceSummary;
  /** Optional pre-computed rolling 30-day summary */
  rolling30DaySummary?: Rolling30DayConsistencySummary;
  onViewMicroWins?: () => void;
}

/**
 * Connected Adherence-Neutral Rolling 30-Day Consistency & Flexible Weekly Goal card.
 * Never resets progress to zero for missed days and uses guilt-free ELI12 language.
 */
export const WeeklyAdherenceCard: React.FC<WeeklyAdherenceCardProps> = ({
  gymState,
  gym_state,
  summary,
  rolling30DaySummary,
  onViewMicroWins
}) => {
  const boundGymState = gymState ?? gym_state ?? null;
  const boundWorkoutLogs = boundGymState?.workoutLogs ?? null;
  const boundPullupLogs = boundGymState?.pullupLogs ?? null;
  const boundCardioLogs = boundGymState?.cardioLogs ?? null;
  const boundSessionDates = boundGymState?.completedSessionDates ?? null;

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

  const activeRolling30Day = useMemo<Rolling30DayConsistencySummary>(() => {
    if (rolling30DaySummary) return rolling30DaySummary;
    const plannedDaysPerWeek = boundGymState
      ? Math.max(
          1,
          Math.min(
            7,
            Number(
              boundGymState.weeklyWorkoutTarget ||
                boundGymState.programWizardConfig?.daysPerWeek ||
                5
            )
          )
        )
      : activeSummary.weeklyTarget;
    return computeRolling30DayConsistencyScore({
      plannedDaysPerWeek,
      currentWeek: activeSummary.weekNumber,
      workoutLogs: boundWorkoutLogs || {},
      pullupLogs: boundPullupLogs || {},
      cardioLogs: boundCardioLogs || {},
      completedSessionDates: boundSessionDates
    });
  }, [
    rolling30DaySummary,
    boundGymState,
    boundWorkoutLogs,
    boundPullupLogs,
    boundCardioLogs,
    boundSessionDates,
    activeSummary.weeklyTarget,
    activeSummary.weekNumber
  ]);

  return (
    <section
      aria-label={`Rolling 30-day consistency and flexible weekly workout goal for week ${activeSummary.weekNumber}`}
      data-completed-workouts={activeSummary.completedWorkoutsCount}
      data-weekly-target={activeSummary.weeklyTarget}
      data-rolling-30day-percent={activeRolling30Day.consistencyPercent}
      className="rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-3.5 text-left space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[0.6875rem] font-extrabold tracking-wide leading-relaxed text-emerald-300">
            Rolling 30-Day Consistency · Week {activeSummary.weekNumber}
          </div>
          <div
            data-testid="rolling-30day-status-text"
            aria-live="polite"
            aria-atomic="true"
            className="mt-0.5 text-sm font-extrabold leading-relaxed text-white tabular-nums"
          >
            {activeRolling30Day.statusLabel}
          </div>
        </div>
        {onViewMicroWins && (
          <button
            type="button"
            onClick={onViewMicroWins}
            aria-label="View your session micro-wins"
            className="min-h-[48px] min-w-[48px] shrink-0 rounded-xl border border-amber-400/60 bg-amber-600/20 px-3 py-2 text-xs font-extrabold leading-relaxed text-amber-100 hover:bg-amber-600/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <span aria-hidden="true">★ </span>
            <span>View Wins</span>
          </button>
        )}
      </div>

      <div
        role="progressbar"
        aria-label="Rolling 30-day workout consistency percentage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={activeRolling30Day.consistencyPercent}
        aria-valuetext={activeRolling30Day.statusLabel}
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${activeRolling30Day.consistencyPercent}%` }}
        />
      </div>

      <div className="pt-1 border-t border-slate-800/80 space-y-1">
        <div
          data-testid="weekly-goal-status-text"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs font-bold leading-relaxed text-slate-200 tabular-nums"
        >
          {activeSummary.statusLabel}
        </div>
        <p
          aria-live="polite"
          className="text-xs leading-relaxed text-slate-300"
        >
          {activeRolling30Day.encouragementCopy}
        </p>
      </div>
    </section>
  );
};

