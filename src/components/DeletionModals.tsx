import React, { useState } from 'react';
import {
  AVAILABLE_OAUTH_LOGIN_PROVIDERS,
  DELETE_ACCOUNT_BUTTON_LABELS,
  DELETE_ACCOUNT_MAIN_WARNING,
  DELETE_ACCOUNT_WARNING_PROMPT,
  DELETE_ALL_WEEKS_BUTTON_LABEL,
  DELETE_ALL_WEEKS_CONFIRM_WARNING,
  FUEL_RESET_ONLY_PROMPT,
  POST_DELETE_SELECT_ACCOUNT_PROMPT,
  WORKOUT_FUEL_RESET_PROMPT,
  executeCompleteAccountDeletion,
  onDeleteSuccess,
  type CompleteAccountDeletionResult,
  type OnDeleteSuccessPayload,
  type SavedAccountCandidate
} from '../utils/deletionValidation';

export interface DeleteAllWeeksConfirmModalProps {
  isOpen: boolean;
  isResetting?: boolean;
  onConfirmDeleteAllWeeks: () => void;
  onCancel: () => void;
}

/**
 * Task 2: Strict, WCAG 2.2 / COGA accessible confirmation modal for "Delete All Weeks (Complete Reset)".
 * - Exact warning text: "Are you sure? This will permanently delete your entire workout history across all weeks."
 * - Zero technical jargon, high AAA contrast, dyslexia-friendly sans-serif with >= 1.5 line-height.
 * - Single-action buttons with non-color icon & text cues.
 */
export const DeleteAllWeeksConfirmModal: React.FC<DeleteAllWeeksConfirmModalProps> = ({
  isOpen,
  isResetting = false,
  onConfirmDeleteAllWeeks,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[82] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-all-weeks-modal-title"
      aria-describedby="delete-all-weeks-modal-warning"
    >
      <div className="bg-slate-900 border-2 border-rose-400 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-left">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950 border border-rose-300 text-xs font-extrabold uppercase tracking-wider text-rose-100 leading-relaxed">
            <span aria-hidden="true">⚠</span>
            <span>Complete Reset</span>
          </span>
          <h3
            id="delete-all-weeks-modal-title"
            className="text-lg font-extrabold text-white leading-relaxed"
          >
            {DELETE_ALL_WEEKS_BUTTON_LABEL}
          </h3>
          <p
            id="delete-all-weeks-modal-warning"
            className="text-sm text-slate-100 leading-relaxed font-medium"
          >
            {DELETE_ALL_WEEKS_CONFIRM_WARNING}
          </p>
          <p className="text-xs text-slate-200 leading-relaxed">
            You will stay signed in to your account and return to Week 1, Day 1.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 pt-1">
          <button
            type="button"
            disabled={isResetting}
            onClick={onConfirmDeleteAllWeeks}
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-rose-400 hover:bg-rose-300 disabled:opacity-60 text-slate-950 text-sm font-extrabold leading-relaxed transition inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <span aria-hidden="true">🗑</span>
            <span>{isResetting ? 'Clearing All Weeks...' : 'Yes, Delete All Weeks'}</span>
          </button>
          <button
            type="button"
            disabled={isResetting}
            onClick={onCancel}
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-400 text-white text-sm font-extrabold leading-relaxed transition inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <span aria-hidden="true">✕</span>
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export interface ResetWorkoutFuelModalProps {
  isOpen: boolean;
  weekNumber: number;
  dayIndex: number;
  dayTitle?: string;
  onDeleteWorkoutOnly: () => void;
  onDeleteWorkoutAndFuel: () => void;
  onDeleteAllWeeks?: () => void;
  onCancel: () => void;
}

/**
 * Pop-up triggered when user taps "Reset Workout".
 * - Asks: "Would you like to delete your meal prep and fuel logs too?"
 * - Keeps "Delete Workout Only" and "Delete Workout and Fuel".
 * - Adds "Delete All Weeks (Complete Reset)" with a strict accessible confirmation step.
 * - Strictly preserves user login session (never logs the user out).
 */
export const ResetWorkoutFuelModal: React.FC<ResetWorkoutFuelModalProps> = ({
  isOpen,
  weekNumber,
  dayIndex,
  dayTitle,
  onDeleteWorkoutOnly,
  onDeleteWorkoutAndFuel,
  onDeleteAllWeeks,
  onCancel
}) => {
  const [confirmingAllWeeks, setConfirmingAllWeeks] = useState(false);

  if (!isOpen) return null;

  const dayLabel = dayTitle || `Day ${dayIndex + 1}`;

  if (confirmingAllWeeks) {
    return (
      <DeleteAllWeeksConfirmModal
        isOpen={true}
        onCancel={() => setConfirmingAllWeeks(false)}
        onConfirmDeleteAllWeeks={() => {
          setConfirmingAllWeeks(false);
          onDeleteAllWeeks?.();
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-workout-fuel-modal-title"
      aria-describedby="reset-workout-fuel-modal-desc"
    >
      <div className="bg-slate-900 border-2 border-slate-500 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-left">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-400 text-xs font-extrabold uppercase tracking-wider text-white leading-relaxed">
            <span aria-hidden="true">📅</span>
            <span>Week {weekNumber} • Day {dayIndex + 1}</span>
          </span>
          <h3
            id="reset-workout-fuel-modal-title"
            className="text-base font-extrabold text-white leading-relaxed"
          >
            {WORKOUT_FUEL_RESET_PROMPT}
          </h3>
          <p
            id="reset-workout-fuel-modal-desc"
            className="text-sm text-slate-100 leading-relaxed"
          >
            Choose one clear action below. Your other days stay safe unless you pick a full reset. You will stay signed in.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <button
            type="button"
            onClick={onDeleteWorkoutOnly}
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-amber-300 hover:bg-amber-200 text-slate-950 text-sm font-extrabold leading-relaxed transition inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <span aria-hidden="true">↺</span>
            <span>Delete Workout Only ({dayLabel})</span>
          </button>
          <button
            type="button"
            onClick={onDeleteWorkoutAndFuel}
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-rose-300 hover:bg-rose-200 text-slate-950 text-sm font-extrabold leading-relaxed transition inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <span aria-hidden="true">🍽</span>
            <span>Delete Workout and Fuel</span>
          </button>
          <div className="pt-2 mt-1 border-t border-slate-700">
            <button
              type="button"
              onClick={() => {
                if (onDeleteAllWeeks) {
                  setConfirmingAllWeeks(true);
                }
              }}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-rose-950 hover:bg-rose-900 border-2 border-rose-300 text-white text-sm font-extrabold leading-relaxed transition inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <span aria-hidden="true">⚠</span>
              <span>{DELETE_ALL_WEEKS_BUTTON_LABEL}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-400 text-white text-sm font-extrabold leading-relaxed transition inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <span aria-hidden="true">✕</span>
            <span>Cancel</span>
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
    aria-label="Reset fuel logs for today"
    className="min-h-[44px] min-w-[44px] text-xs font-extrabold px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/60 text-rose-200 transition whitespace-nowrap"
  >
    <span aria-hidden="true">↺ </span>
    <span>Reset Fuel</span>
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
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/45 text-[0.625rem] font-extrabold uppercase tracking-wider text-rose-200">
            Muscle Fuel • Week {weekNumber} • Day {dayIndex + 1}
          </span>
          <h3 id="reset-fuel-only-title" className="text-base font-extrabold text-white leading-relaxed">
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
            className="min-h-[44px] min-w-[44px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] min-w-[44px] py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-extrabold transition"
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
    aria-label="Permanently delete your account"
    className="min-h-[44px] min-w-[44px] w-full py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-400/70 text-rose-100 text-xs font-extrabold transition"
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
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/60 text-[0.625rem] font-extrabold uppercase tracking-wider text-rose-200">
            Delete Account
          </span>
          <h3
            id="delete-account-warning-title"
            className="text-base font-extrabold text-white leading-relaxed"
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
            className="min-h-[44px] min-w-[44px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold transition disabled:opacity-50"
          >
            {DELETE_ACCOUNT_BUTTON_LABELS.cancel}
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirmDelete}
            className="min-h-[44px] min-w-[44px] py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-extrabold transition disabled:opacity-50"
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
  oauthProviders?: readonly string[];
  onSelectOAuthProvider?: (provider: string) => void;
  onOneClickContinue: (account: SavedAccountCandidate) => void;
  onUseAnotherAccount: () => void;
}

/**
 * Task 1: Post-Deletion Account Selection Modal triggered by `onDeleteSuccess`.
 * Exact prompt: "Account deleted. Please select your active account to continue."
 * Displays available OAuth login options (Google, Apple) plus any saved account shortcut.
 */
export const PostDeleteSwitchAccountModal: React.FC<PostDeleteSwitchAccountModalProps> = ({
  isOpen,
  secondaryAccount,
  oauthProviders = AVAILABLE_OAUTH_LOGIN_PROVIDERS,
  onSelectOAuthProvider,
  onOneClickContinue,
  onUseAnotherAccount
}) => {
  if (!isOpen) return null;

  const initialLetter = secondaryAccount
    ? (secondaryAccount.name || 'A').trim().charAt(0).toUpperCase()
    : 'A';

  return (
    <div
      className="fixed inset-0 z-[86] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-delete-switch-title"
    >
      <div className="bg-slate-900 border border-emerald-400/60 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-left">
        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[0.625rem] font-extrabold uppercase tracking-wider text-emerald-200">
            Account Deleted
          </span>
          <h3
            id="post-delete-switch-title"
            className="text-base font-extrabold text-white leading-relaxed"
          >
            {POST_DELETE_SELECT_ACCOUNT_PROMPT}
          </h3>
        </div>

        {secondaryAccount && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl bg-slate-950 border border-slate-700 p-3">
              <div aria-hidden="true" className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-sm flex items-center justify-center shrink-0">
                {initialLetter}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white truncate">{secondaryAccount.name}</div>
                <div className="text-xs text-slate-300 truncate">{secondaryAccount.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOneClickContinue(secondaryAccount)}
              className="w-full min-h-[44px] min-w-[44px] py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition"
            >
              Continue as {secondaryAccount.name}
            </button>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-[0.6875rem] font-bold text-slate-300">Sign in with one tap:</div>
          <div className="grid grid-cols-1 gap-2">
            {oauthProviders.map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => onSelectOAuthProvider?.(provider)}
                className="w-full min-h-[44px] min-w-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-extrabold transition"
              >
                Continue with {provider}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onUseAnotherAccount}
            className="w-full min-h-[44px] min-w-[44px] py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Log In with Email &amp; Password
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
  onSelectOAuthProvider?: (provider: string) => void;
  onDeleteCompleted?: (payload: OnDeleteSuccessPayload) => void;
  onFallbackEmptyLogin: (result: CompleteAccountDeletionResult) => void;
}

/**
 * Full Account Deletion Flow Controller:
 * 1. Displays jargon-free ELI12 warning modal.
 * 2. Runs Server + Mobile Client + Web Cookie cleanup concurrently via Promise.all.
 * 3. Calls `onDeleteSuccess` immediately after deletion to open the active account picker with OAuth options.
 */
export const AccountDeletionFlowController: React.FC<AccountDeletionFlowControllerProps> = ({
  endpoint,
  activeEmail,
  stateObj,
  isWarningOpen,
  onCloseWarning,
  onAutoSwitchLogin,
  onSelectOAuthProvider,
  onDeleteCompleted,
  onFallbackEmptyLogin
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [postDeletePayload, setPostDeletePayload] = useState<OnDeleteSuccessPayload | null>(null);
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

      if (result.deleted) {
        onDeleteSuccess({
          deletedEmail: activeEmail,
          secondaryAccount: result.secondaryAccount,
          onOpenAccountSelectModal: (payload) => {
            setPostDeletePayload(payload);
            onDeleteCompleted?.(payload);
          }
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOneClickContinue = (account: SavedAccountCandidate) => {
    setPostDeletePayload(null);
    onAutoSwitchLogin(account);
  };

  const handleSelectOAuth = (provider: string) => {
    setPostDeletePayload(null);
    onSelectOAuthProvider?.(provider);
  };

  const handleUseAnother = () => {
    setPostDeletePayload(null);
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
        isOpen={Boolean(postDeletePayload)}
        secondaryAccount={postDeletePayload?.secondaryAccount || null}
        oauthProviders={postDeletePayload?.oauthProviders || AVAILABLE_OAUTH_LOGIN_PROVIDERS}
        onSelectOAuthProvider={handleSelectOAuth}
        onOneClickContinue={handleOneClickContinue}
        onUseAnotherAccount={handleUseAnother}
      />
    </>
  );
};
