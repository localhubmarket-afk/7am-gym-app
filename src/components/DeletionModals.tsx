import React from 'react';
import {
  DELETE_ACCOUNT_WARNING_PROMPT,
  FUEL_RESET_ONLY_PROMPT,
  WORKOUT_FUEL_RESET_PROMPT
} from '../utils/deletionValidation';

export interface ResetWorkoutFuelModalProps {
  isOpen: boolean;
  weekNumber: number;
  dayIndex: number;
  dayTitle?: string;
  onDeleteWorkoutOnly: () => void;
  onDeleteWorkoutAndFuel: () => void;
  onCancel: () => void;
}

/**
 * Task 1: Pop-up triggered when user taps "Reset Workout".
 * Asks: "Would you like to delete your meal prep and fuel logs too?"
 * Provides two clear choices: "Delete Workout Only" and "Delete Workout and Fuel".
 */
export const ResetWorkoutFuelModal: React.FC<ResetWorkoutFuelModalProps> = ({
  isOpen,
  weekNumber,
  dayIndex,
  dayTitle,
  onDeleteWorkoutOnly,
  onDeleteWorkoutAndFuel,
  onCancel
}) => {
  if (!isOpen) return null;

  const dayLabel = dayTitle || `Day ${dayIndex + 1}`;

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-workout-fuel-modal-title"
    >
      <div className="bg-slate-900 border border-rose-400/55 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="space-y-1.5">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/45 text-[10px] font-extrabold uppercase tracking-wider text-rose-200">
            Week {weekNumber} • Day {dayIndex + 1}
          </span>
          <h3
            id="reset-workout-fuel-modal-title"
            className="text-base font-extrabold text-white leading-snug"
          >
            {WORKOUT_FUEL_RESET_PROMPT}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Choose whether to clear only {dayLabel} sets or also clear today&apos;s meal prep and fuel logs. Other days stay safe.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={onDeleteWorkoutOnly}
            className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition"
          >
            Delete Workout Only
          </button>
          <button
            type="button"
            onClick={onDeleteWorkoutAndFuel}
            className="w-full py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-extrabold transition"
          >
            Delete Workout and Fuel
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-extrabold transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export interface ResetFuelButtonProps {
  onClick: () => void;
}

/**
 * Task 1: Standalone "Reset Fuel" button placed directly on the Muscle Fuel tab.
 */
export const ResetFuelButton: React.FC<ResetFuelButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/60 text-rose-200 transition whitespace-nowrap"
  >
    ↺ Reset Fuel
  </button>
);

export interface ResetFuelConfirmModalProps {
  isOpen: boolean;
  weekNumber: number;
  dayIndex: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ResetFuelConfirmModal: React.FC<ResetFuelConfirmModalProps> = ({
  isOpen,
  weekNumber,
  dayIndex,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[76] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-fuel-only-title"
    >
      <div className="bg-slate-900 border border-rose-400/55 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="space-y-1.5">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/45 text-[10px] font-extrabold uppercase tracking-wider text-rose-200">
            Muscle Fuel • Week {weekNumber} • Day {dayIndex + 1}
          </span>
          <h3 id="reset-fuel-only-title" className="text-base font-extrabold text-white leading-snug">
            {FUEL_RESET_ONLY_PROMPT}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            This clears logged meals, flex meals, quick adds, and water for Day {dayIndex + 1} only. Your gym workout sets stay safe.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-extrabold transition"
          >
            Reset Fuel
          </button>
        </div>
      </div>
    </div>
  );
};

export interface DeleteAccountButtonProps {
  onClick: () => void;
}

/**
 * Task 2: Highly visible "Delete Account" button inside the active account menu.
 */
export const DeleteAccountButton: React.FC<DeleteAccountButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-400/70 text-rose-100 text-xs font-extrabold transition"
  >
    Delete Account
  </button>
);

export interface DeleteAccountWarningModalProps {
  isOpen: boolean;
  accountEmail: string;
  isDeleting?: boolean;
  onConfirmDelete: () => void;
  onCancel: () => void;
}

/**
 * Task 2: Strict account deletion warning pop-up.
 * Asks verbatim: "Are you sure you want to delete the account?"
 */
export const DeleteAccountWarningModal: React.FC<DeleteAccountWarningModalProps> = ({
  isOpen,
  accountEmail,
  isDeleting = false,
  onConfirmDelete,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[85] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-warning-title"
    >
      <div className="bg-slate-900 border border-rose-500/70 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="space-y-1.5">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/60 text-[10px] font-extrabold uppercase tracking-wider text-rose-200">
            Permanent Account Deletion
          </span>
          <h3
            id="delete-account-warning-title"
            className="text-base font-extrabold text-white leading-snug"
          >
            {DELETE_ACCOUNT_WARNING_PROMPT}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            This permanently deletes <strong className="text-rose-200">{accountEmail}</strong> from Supabase and returns you to the login screen.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirmDelete}
            className="py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-extrabold transition disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Yes, Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
};
