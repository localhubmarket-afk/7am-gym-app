import React from 'react';
import type { MicroWinsSummary } from '../utils/microWinsEngine';

export interface PostWorkoutMicroWinsModalProps {
  isOpen: boolean;
  summary: MicroWinsSummary;
  onClose: () => void;
}

export const PostWorkoutMicroWinsModal: React.FC<PostWorkoutMicroWinsModalProps> = ({
  isOpen,
  summary,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="micro-wins-modal-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-500/60 bg-slate-900 p-5 text-left text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[0.6875rem] font-extrabold uppercase tracking-wider text-amber-300">
              <span aria-hidden="true">★ </span>
              <span>Micro-Wins Celebration</span>
            </span>
            <h2 id="micro-wins-modal-heading" className="mt-0.5 text-lg font-extrabold leading-relaxed text-white">
              {summary.headline}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close micro-wins window"
            className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            <span aria-hidden="true">✕ </span>
            <span>Close</span>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
            <div className="text-[0.6875rem] font-bold text-slate-400">Completed Sets</div>
            <div className="text-lg font-extrabold text-emerald-300">{summary.totalSetsCompleted}</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
            <div className="text-[0.6875rem] font-bold text-slate-400">Total Volume</div>
            <div className="text-lg font-extrabold text-sky-300">
              {summary.totalSessionVolume.toLocaleString()} {summary.unit}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {summary.wins.length > 0 ? (
            summary.wins.map((win, idx) => (
              <div
                key={`${win.category}-${win.exerciseId}-${idx}`}
                className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-amber-300">
                    <span aria-hidden="true">★ </span>
                    {win.title}
                  </span>
                  <span className="rounded-md bg-emerald-600/30 px-2 py-0.5 text-[0.6875rem] font-extrabold text-emerald-200">
                    {win.deltaLabel}
                  </span>
                </div>
                <div className="mt-1 text-xs leading-relaxed text-slate-200">{win.eli12Message}</div>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
              Log your first weight and rep set today to start tracking Heaviest Weight, Highest Reps, Highest Volume, and Estimated 1-Rep Max wins!
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[46px] w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500"
        >
          Keep Going
        </button>
      </div>
    </div>
  );
};
