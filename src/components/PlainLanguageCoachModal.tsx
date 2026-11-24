import React, { useEffect, useState } from 'react';
import {
  requestPlainLanguageCoachExplanation,
  type BoundedProgressionMathSnapshot,
  type PlainLanguageCoachResponse
} from '../utils/plainLanguageCoach';

export interface PlainLanguageCoachModalProps {
  isOpen: boolean;
  mathSnapshot: Readonly<BoundedProgressionMathSnapshot> | null;
  onClose: () => void;
  endpoint?: string;
}

/**
 * Phase 2 — Task 2: Plain-Language Coach Modal (Bounded LLM)
 * - Displays the locked deterministic numbers upfront (LLM can never alter math).
 * - Fetches a Grade 6-8 plain-language translation from server-side Gemini.
 * - WCAG 2.2 AA: role="dialog", aria-modal="true", >= 48x48px touch targets, Escape-to-close.
 */
export const PlainLanguageCoachModal: React.FC<PlainLanguageCoachModalProps> = ({
  isOpen,
  mathSnapshot,
  onClose,
  endpoint
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlainLanguageCoachResponse | null>(null);

  const runExplanation = async (snapshot: Readonly<BoundedProgressionMathSnapshot>) => {
    setLoading(true);
    const res = await requestPlainLanguageCoachExplanation(snapshot, { endpoint });
    setResult(res);
    setLoading(false);
  };

  useEffect(() => {
    if (!isOpen || !mathSnapshot) return;
    void runExplanation(mathSnapshot);
  }, [isOpen, mathSnapshot]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mathSnapshot) return null;

  const targetText =
    mathSnapshot.nextTargetWeight > 0
      ? `${mathSnapshot.targetSets} sets × ${mathSnapshot.nextTargetReps} reps at ${mathSnapshot.nextTargetWeight} ${mathSnapshot.unit}`
      : `${mathSnapshot.targetSets} sets × ${mathSnapshot.nextTargetReps} reps (Bodyweight)`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plain-language-coach-heading"
      data-testid="plain-language-coach-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-sky-400/70 bg-slate-900 p-5 text-left text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-block rounded-md border border-sky-400/50 bg-sky-500/20 px-2 py-0.5 text-[0.6875rem] font-extrabold uppercase tracking-wide text-sky-200">
              Plain-Language Coach · Math Locked
            </span>
            <h2
              id="plain-language-coach-heading"
              className="mt-1 text-base font-extrabold leading-snug text-white"
            >
              Why is {mathSnapshot.exerciseName} set here?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Plain-Language Coach"
            data-testid="plain-language-coach-close-btn"
            className="min-h-[48px] min-w-[48px] shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Close
          </button>
        </div>

        {/* Locked Deterministic Target Box (proves math is read-only) */}
        <div
          data-testid="coach-locked-target-box"
          className="mt-3 rounded-xl border border-emerald-400/50 bg-emerald-950/40 p-3"
        >
          <div className="text-[0.6875rem] font-extrabold uppercase tracking-wide text-emerald-200">
            Exact Plan Target (Calculated by Math Engine)
          </div>
          <div className="mt-1 text-sm font-extrabold text-white">{targetText}</div>
          {mathSnapshot.weightDelta !== 0 && (
            <div className="mt-0.5 text-xs font-bold text-emerald-200">
              Change from last week: {mathSnapshot.weightDelta > 0 ? `+${mathSnapshot.weightDelta}` : mathSnapshot.weightDelta}{' '}
              {mathSnapshot.unit}
            </div>
          )}
        </div>

        {/* Bounded Gemini Plain-Language Explanation */}
        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3.5">
          <div className="text-xs font-extrabold text-sky-300">Simple Coach Explanation (Grade 6–8)</div>

          {loading && (
            <p
              role="status"
              aria-live="polite"
              data-testid="coach-loading-state"
              className="mt-2 text-sm font-semibold text-slate-300"
            >
              Writing your plain-language summary...
            </p>
          )}

          {!loading && result?.ok && result.plainLanguageExplanation && (
            <div data-testid="coach-ai-explanation" className="mt-2 space-y-2">
              <p className="text-sm font-semibold leading-relaxed text-white">
                {result.plainLanguageExplanation}
              </p>
              {result.keyTakeaway && (
                <p className="rounded-lg border border-sky-500/40 bg-sky-950/50 px-3 py-2 text-xs font-bold text-sky-100">
                  Next step: {result.keyTakeaway}
                </p>
              )}
            </div>
          )}

          {!loading && result && !result.ok && (
            <div data-testid="coach-error-state" className="mt-2 space-y-2">
              <p role="alert" className="rounded-lg border border-amber-500/50 bg-amber-950/60 px-3 py-2 text-xs font-bold text-amber-100">
                {result.error || 'Could not load AI coach text right now.'}
              </p>
              <p className="text-xs font-semibold leading-relaxed text-slate-200">
                Exact math summary: {mathSnapshot.deterministicSummary}
              </p>
              <button
                type="button"
                onClick={() => void runExplanation(mathSnapshot)}
                className="min-h-[48px] rounded-xl border border-sky-400/60 bg-sky-600/30 px-3.5 py-2 text-xs font-extrabold text-sky-100 hover:bg-sky-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-slate-300">
          Note: The AI coach only explains your plan in plain words. It never changes your weights, reps, or sets.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-[48px] w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
