import React from 'react';

export interface WizardLoginBypassBarProps {
  onBypassToLogin: () => void;
}

export const WizardLoginBypassBar: React.FC<WizardLoginBypassBarProps> = ({
  onBypassToLogin
}) => {
  return (
    <div className="rounded-xl border border-sky-400/45 bg-sky-500/10 p-3 text-center">
      <p className="text-xs font-semibold text-slate-200">
        Returning athlete? Skip setup and load your saved workouts.
      </p>
      <button
        type="button"
        onClick={onBypassToLogin}
        className="mt-2 w-full rounded-xl border border-sky-400/70 bg-sky-400/20 px-4 py-2 text-xs font-extrabold text-sky-100 transition hover:bg-sky-400/30"
      >
        Already have an account? Log In
      </button>
    </div>
  );
};
