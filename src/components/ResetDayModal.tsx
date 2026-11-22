import React, { useState } from 'react';

export interface ResetDayControlProps {
  weekNumber: number;
  dayNumber: number;
  dayTitle?: string;
  onConfirmClearDay: () => void;
}

export const ResetDayControl: React.FC<ResetDayControlProps> = ({
  weekNumber,
  dayNumber,
  dayTitle,
  onConfirmClearDay
}) => {
  const [isWarningOpen, setIsWarningOpen] = useState(false);

  function handleConfirm() {
    onConfirmClearDay();
    setIsWarningOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsWarningOpen(true)}
        className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-rose-400/60 bg-rose-500/10 px-3 py-2 text-xs font-extrabold text-rose-200 transition hover:bg-rose-500/20"
      >
        Reset Workout
      </button>

      {isWarningOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-day-warning-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-rose-400/50 bg-slate-900 p-5 text-slate-100 shadow-2xl">
            <div className="space-y-1">
              <span className="inline-block rounded-full border border-rose-400/40 bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-200">
                Week {weekNumber} • Day {dayNumber}
              </span>
              <h2 id="reset-day-warning-title" className="text-base font-extrabold text-white">
                Are you sure you want to clear all data for this day?
              </h2>
              <p className="text-xs leading-relaxed text-slate-300">
                This will erase all logged sets for {dayTitle ? `${dayTitle} (Day ${dayNumber})` : `Day ${dayNumber}`} only. Your other workout days will stay safe.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsWarningOpen(false)}
                className="rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-extrabold text-slate-100 transition hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-xl bg-rose-500 px-3 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-rose-400"
              >
                Clear Day
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
