import React from 'react';

export interface SetRowAccessibleActionsProps {
  exerciseName: string;
  setNumber: number;
  isDone: boolean;
  onToggleLog: () => void;
  onDeleteSet: () => void;
}

/**
 * Explicit Single-Tap Motor-Accessible Set Actions
 * - Provides a visible 48x48px Trash-Can Delete button as a direct tap alternative to swipe-to-delete
 * - Guarantees >= 8px (gap-2 / 0.5rem) physical separation between adjacent targets
 */
export const SetRowAccessibleActions: React.FC<SetRowAccessibleActionsProps> = ({
  exerciseName,
  setNumber,
  isDone,
  onToggleLog,
  onDeleteSet
}) => {
  return (
    <div className="set-row-actions-group flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onToggleLog}
        aria-label={
          isDone
            ? `Undo completed log for ${exerciseName} Set ${setNumber}`
            : `Log ${exerciseName} Set ${setNumber}`
        }
        className={`min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg text-xs font-extrabold transition ${
          isDone
            ? 'bg-emerald-600 text-white border border-emerald-500'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600'
        }`}
      >
        {isDone ? '✓ Done' : '✓ Log'}
      </button>

      <button
        type="button"
        onClick={onDeleteSet}
        aria-label={`Delete logged data for ${exerciseName} Set ${setNumber}`}
        title={`Clear Set ${setNumber}`}
        className="delete-set-btn min-h-[48px] min-w-[48px] px-2.5 py-2 rounded-lg border border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-xs font-extrabold transition inline-flex items-center justify-center"
      >
        <svg
          className="w-5 h-5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </button>
    </div>
  );
};

export default SetRowAccessibleActions;
