import React from 'react';
import type { WeeklyAdherenceSummary } from '../utils/adherenceEngine';

export interface WeeklyAdherenceCardProps {
  summary: WeeklyAdherenceSummary;
  onViewMicroWins?: () => void;
}

export const WeeklyAdherenceCard: React.FC<WeeklyAdherenceCardProps> = ({
  summary,
  onViewMicroWins
}) => {
  return (
    <section
      aria-label="Weekly flexible workout goal"
      className="rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-3.5 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
            Flexible Weekly Goal • Week {summary.weekNumber}
          </div>
          <div className="mt-0.5 text-sm font-extrabold text-white">{summary.statusLabel}</div>
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
        aria-valuenow={summary.percentComplete}
        className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${summary.percentComplete}%` }}
        />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-300">{summary.encouragementCopy}</p>
    </section>
  );
};
