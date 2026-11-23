import React from 'react';

export interface FirstWarmupSetSpec {
  id: string;
  exerciseName: string;
  setTitle: string;
  repsLabel: string;
  weightLabel?: string;
  cue: string;
}

export interface MicroStartFocusCardProps {
  isActive: boolean;
  firstWarmupSet: FirstWarmupSetSpec;
  onEnterMicroStart: () => void;
  onCompleteWarmupSet: () => void;
  onExitMicroStart: () => void;
  className?: string;
}

/**
 * 2-Minute Micro-Start Component (Executive Dysfunction / Task-Initiation Support)
 *
 * When inactive: renders a clear, low-friction "2-Minute Micro-Start" trigger button.
 * When active: renders ONLY the first warm-up set on screen so the user can begin
 * without staring at a long list of exercises. Completing that single set seamlessly
 * reveals the full workout.
 */
export const MicroStartFocusCard: React.FC<MicroStartFocusCardProps> = ({
  isActive,
  firstWarmupSet,
  onEnterMicroStart,
  onCompleteWarmupSet,
  onExitMicroStart,
  className = ''
}) => {
  if (!isActive) {
    return (
      <div
        className={`rounded-2xl border border-emerald-500/45 bg-[var(--bg-surface)] p-3.5 flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-extrabold leading-relaxed text-[var(--text-primary)]">
            Hard to get started today?
          </p>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            Hide the full plan and do just 1 short warm-up set. You can stop after 2 minutes or keep going.
          </p>
        </div>
        <button
          type="button"
          onClick={onEnterMicroStart}
          data-testid="micro-start-trigger-btn"
          className="min-h-[48px] min-w-[48px] shrink-0 rounded-xl border border-emerald-400 bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500"
        >
          2-Minute Micro-Start
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="2-Minute Micro-Start Focused Warm-Up Set"
      data-testid="micro-start-focus-panel"
      className={`rounded-2xl border-2 border-emerald-400 bg-[var(--bg-surface)] p-5 space-y-4 text-[var(--text-primary)] ${className}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs font-extrabold text-emerald-400">
            2-Minute Micro-Start · Step 1 of 1
          </p>
          <h2 className="text-lg font-extrabold leading-snug text-[var(--text-primary)]">
            {firstWarmupSet.setTitle}
          </h2>
        </div>
        <button
          type="button"
          onClick={onExitMicroStart}
          className="min-h-[48px] min-w-[48px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] px-3 py-2 text-xs font-extrabold text-[var(--text-primary)]"
        >
          Show Full Workout
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] p-4 space-y-2">
        <div className="text-sm font-extrabold text-[var(--text-primary)]">
          {firstWarmupSet.exerciseName}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-emerald-400 tabular-nums">
          <span>{firstWarmupSet.repsLabel}</span>
          {firstWarmupSet.weightLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span>{firstWarmupSet.weightLabel}</span>
            </>
          )}
        </div>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {firstWarmupSet.cue}
        </p>
      </div>

      <button
        type="button"
        onClick={onCompleteWarmupSet}
        data-testid="micro-start-complete-btn"
        className="w-full min-h-[48px] min-w-[48px] rounded-xl border border-emerald-300 bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-500"
      >
        Done With Warm-Up Set 1 — Reveal Full Workout
      </button>
    </section>
  );
};

export default MicroStartFocusCard;
