import React, { useState } from 'react';
import {
  DELETE_ACCOUNT_BUTTON_LABELS,
  DELETE_ACCOUNT_MAIN_WARNING,
  DELETE_ACCOUNT_WARNING_PROMPT,
  FUEL_RESET_ONLY_PROMPT,
  WORKOUT_FUEL_RESET_PROMPT,
  buildPostDeleteSwitchPrompt,
  executeCompleteAccountDeletion,
  type CompleteAccountDeletionResult,
  type SavedAccountCandidate
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
 * Pop-up triggered when user taps "Reset Workout".
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
            Pick if you want to clear only {dayLabel} sets or also clear your food logs for today. Other days stay safe.
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
 * Standalone "Reset Fuel" button placed directly on the Muscle Fuel tab.
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
 * Highly visible "Delete Account" button inside the active account menu.
 */
export const DeleteAccountButton: React.FC<DeleteAccountButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="Permanently delete your account"
    className="w-full py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-400/70 text-rose-100 text-xs font-extrabold transition"
  >
    Delete Account
  </button>
);

export interface DeleteAccountWarningModalProps {
  isOpen: boolean;
  accountEmail?: string;
  isDeleting?: boolean;
  onConfirmDelete: () => void;
  onCancel: () => void;
}

/**
 * Redesigned Account Deletion Warning Modal:
 * - Zero database jargon
 * - Exact ELI12 warning copy: "This will permanently erase your account and all your data. You cannot get it back."
 * - Strict button layout: "Cancel" and "Yes, Delete Account"
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
      aria-describedby="delete-account-warning-copy"
    >
      <div className="bg-slate-900 border border-rose-500/70 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/60 text-[10px] font-extrabold uppercase tracking-wider text-rose-200">
            Delete Account
          </span>
          <h3
            id="delete-account-warning-title"
            className="text-base font-extrabold text-white leading-snug"
          >
            {DELETE_ACCOUNT_WARNING_PROMPT}
          </h3>
          {accountEmail ? (
            <div className="text-xs font-bold text-rose-200 truncate">{accountEmail}</div>
          ) : null}
          <p
            id="delete-account-warning-copy"
            className="text-xs text-slate-200 leading-relaxed"
          >
            {DELETE_ACCOUNT_MAIN_WARNING}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold transition disabled:opacity-50"
          >
            {DELETE_ACCOUNT_BUTTON_LABELS.cancel}
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirmDelete}
            className="py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-extrabold transition disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : DELETE_ACCOUNT_BUTTON_LABELS.confirm}
          </button>
        </div>
      </div>
    </div>
  );
};

export interface PostDeleteSwitchAccountModalProps {
  isOpen: boolean;
  secondaryAccount: SavedAccountCandidate | null;
  onOneClickContinue: (account: SavedAccountCandidate) => void;
  onUseAnotherAccount: () => void;
}

/**
 * Automated Post-Deletion Account Switch Modal:
 * Shown immediately after deletion when another saved profile exists on the device.
 * Exact prompt: "Account deleted. Do you want to continue as [Other Account Name]?"
 */
export const PostDeleteSwitchAccountModal: React.FC<PostDeleteSwitchAccountModalProps> = ({
  isOpen,
  secondaryAccount,
  onOneClickContinue,
  onUseAnotherAccount
}) => {
  if (!isOpen || !secondaryAccount) return null;

  const promptText = buildPostDeleteSwitchPrompt(secondaryAccount.name);
  const initialLetter = (secondaryAccount.name || 'A').trim().charAt(0).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[86] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-delete-switch-title"
    >
      <div className="bg-slate-900 border border-emerald-400/60 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
            Account Deleted
          </span>
          <h3
            id="post-delete-switch-title"
            className="text-base font-extrabold text-white leading-snug"
          >
            {promptText}
          </h3>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-slate-950 border border-slate-700 p-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-sm flex items-center justify-center shrink-0">
            {initialLetter}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-white truncate">{secondaryAccount.name}</div>
            <div className="text-xs text-slate-300 truncate">{secondaryAccount.email}</div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onOneClickContinue(secondaryAccount)}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition"
          >
            Continue as {secondaryAccount.name}
          </button>
          <button
            type="button"
            onClick={onUseAnotherAccount}
            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Log In with Another Account
          </button>
        </div>
      </div>
    </div>
  );
};

export interface AccountDeletionFlowControllerProps {
  endpoint: string;
  activeEmail: string;
  stateObj: Record<string, any>;
  isWarningOpen: boolean;
  onCloseWarning: () => void;
  onAutoSwitchLogin: (account: SavedAccountCandidate) => void;
  onFallbackEmptyLogin: (result: CompleteAccountDeletionResult) => void;
}

/**
 * Full Account Deletion Flow Controller:
 * 1. Displays jargon-free warning modal.
 * 2. Runs Server + Mobile Client + Web Cookie cleanup concurrently via Promise.all.
 * 3. Automatically offers one-click login into another saved profile if found.
 */
export const AccountDeletionFlowController: React.FC<AccountDeletionFlowControllerProps> = ({
  endpoint,
  activeEmail,
  stateObj,
  isWarningOpen,
  onCloseWarning,
  onAutoSwitchLogin,
  onFallbackEmptyLogin
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [switchCandidate, setSwitchCandidate] = useState<SavedAccountCandidate | null>(null);
  const [lastResult, setLastResult] = useState<CompleteAccountDeletionResult | null>(null);

  const handleConfirmDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await executeCompleteAccountDeletion({
        endpoint,
        activeUserId: activeEmail,
        targetUserId: activeEmail,
        stateObj
      });
      setLastResult(result);
      onCloseWarning();

      if (result.deleted && result.secondaryAccount) {
        setSwitchCandidate(result.secondaryAccount);
      } else if (result.deleted) {
        onFallbackEmptyLogin(result);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOneClickContinue = (account: SavedAccountCandidate) => {
    setSwitchCandidate(null);
    onAutoSwitchLogin(account);
  };

  const handleUseAnother = () => {
    setSwitchCandidate(null);
    if (lastResult) {
      onFallbackEmptyLogin(lastResult);
    }
  };

  return (
    <>
      <DeleteAccountWarningModal
        isOpen={isWarningOpen}
        accountEmail={activeEmail}
        isDeleting={isDeleting}
        onConfirmDelete={handleConfirmDelete}
        onCancel={onCloseWarning}
      />
      <PostDeleteSwitchAccountModal
        isOpen={Boolean(switchCandidate)}
        secondaryAccount={switchCandidate}
        onOneClickContinue={handleOneClickContinue}
        onUseAnotherAccount={handleUseAnother}
      />
    </>
  );
};
