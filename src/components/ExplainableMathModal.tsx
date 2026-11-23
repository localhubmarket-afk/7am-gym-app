import React from 'react';
import type { ExplainableMathBreakdown } from '../utils/explainableMath';

export interface ExplainableMathModalProps {
  isOpen: boolean;
  breakdown: ExplainableMathBreakdown | null;
  onClose: () => void;
}

export const ExplainableMathModal: React.FC<ExplainableMathModalProps> = ({
  isOpen,
  breakdown,
  onClose
}) => {
  if (!isOpen || !breakdown) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explainable-math-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-sky-500/60 bg-slate-900 p-5 text-left text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-300">
              ⓘ Explainable Math • {breakdown.exerciseName}
            </span>
            <h2 id="explainable-math-heading" className="mt-0.5 text-base font-extrabold text-white">
              {breakdown.headline}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            ✕ Close
          </button>
        </div>

        <p className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm font-semibold leading-relaxed text-slate-100">
          {breakdown.plainEnglishExplanation}
        </p>

        <div className="mt-3">
          <div className="text-xs font-extrabold text-slate-300">Step-by-step math:</div>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-300">
            {breakdown.formulaSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>

        <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-200">
          Today&apos;s Target: {breakdown.prescribedSummary}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[46px] w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-sky-500"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
