import React from 'react';
import {
  buildResumeWorkoutBannerCopy,
  type ActiveWorkoutSessionSnapshot
} from '../utils/workoutResumeSession';

export interface WorkoutResumeBannerProps {
  snapshot: ActiveWorkoutSessionSnapshot | null;
  onResume: (exerciseId: string, exerciseIndex: number) => void;
  onDismiss?: () => void;
}

/**
 * Task 2: Accessible Workout Resume Banner (Strong/Hevy Background Flow)
 * - Appears automatically when returning from screen lock, app switch, or page refresh.
 * - Jumps straight to the active or next exercise with zero login interruption.
 */
export const WorkoutResumeBanner: React.FC<WorkoutResumeBannerProps> = ({
  snapshot,
  onResume,
  onDismiss
}) => {
  const copy = buildResumeWorkoutBannerCopy(snapshot);
  if (!copy.visible || !copy.targetExerciseId) return null;

  return (
    <section
      aria-label="Resume Active Workout"
      data-testid="workout-resume-banner"
      className="rounded-2xl border border-green-500/60 bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-md"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs sm:text-sm font-extrabold text-white leading-snug">
          {copy.headline}
        </p>
        <p className="text-xs text-slate-300 leading-snug">{copy.detail}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onResume(copy.targetExerciseId!, copy.targetExerciseIndex)}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-green-500 bg-green-700 hover:bg-green-800 px-3.5 py-2 text-xs font-extrabold text-white transition"
        >
          {copy.ctaLabel}
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss resume workout notice"
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-2 text-xs font-bold text-slate-200 transition"
          >
            ✕
          </button>
        )}
      </div>
    </section>
  );
};

export default WorkoutResumeBanner;
