import React, { useState } from 'react';
import {
  START_FRESH_CONFIRM_COPY,
  START_FRESH_CONFIRM_TITLE,
  executeStartFreshAndPushToSupabase,
  type StartFreshCloudPushResult
} from '../utils/startFreshReset';

export interface StartFreshControlProps {
  /** Optional direct gym_state + endpoint wiring for immediate Supabase overwrite */
  currentState?: Record<string, any> | null;
  supabaseEndpoint?: string;
  storageKey?: string;
  onStateReset?: (result: StartFreshCloudPushResult) => void;
  /** Backwards-compatible callback */
  onConfirmStartFresh?: () => void | Promise<void>;
}

/**
 * Task 1: Accessible "Start Fresh" button & ELI12 confirmation modal for Settings.
 * Strictly overwrites gym_state with an empty default baseline and immediately pushes
 * the cleared state to Supabase.
 */
export const StartFreshControl: React.FC<StartFreshControlProps> = ({
  currentState,
  supabaseEndpoint = '/api/state',
  storageKey = 'bws_vegan_7am_app_v1',
  onStateReset,
  onConfirmStartFresh
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleConfirm = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      if (onStateReset) {
        const result = await executeStartFreshAndPushToSupabase({
          currentState,
          endpoint: supabaseEndpoint,
          storageKey,
          storage: typeof window !== 'undefined' ? window.localStorage : null
        });
        onStateReset(result);
      }
      if (onConfirmStartFresh) {
        await onConfirmStartFresh();
      }
    } finally {
      setIsResetting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-2 text-left">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-rose-400/70 bg-rose-600/20 hover:bg-rose-600/30 text-rose-100 text-xs font-extrabold transition flex items-center justify-center gap-2"
      >
        <span>Start Fresh (Clear Workouts, Fuel &amp; Shop List)</span>
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[88] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-fresh-modal-title"
          aria-describedby="start-fresh-modal-desc"
        >
          <div className="bg-slate-900 border border-rose-400/70 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-left">
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/60 text-[10px] font-extrabold uppercase tracking-wider text-rose-200">
                Start Fresh
              </span>
              <h3
                id="start-fresh-modal-title"
                className="text-base font-extrabold text-white leading-snug"
              >
                {START_FRESH_CONFIRM_TITLE}
              </h3>
              <p
                id="start-fresh-modal-desc"
                className="text-xs text-slate-200 leading-relaxed"
              >
                {START_FRESH_CONFIRM_COPY}
              </p>
              <ul className="list-disc pl-5 text-xs text-slate-300 space-y-1 leading-relaxed">
                <li>All logged workouts and weekly goal progress (resets to 0)</li>
                <li>All saved meals, fuel logs, and water logs</li>
                <li>Oats jars and rice bowls left in the fridge</li>
                <li>Your active shopping list</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setConfirmOpen(false)}
                className="min-h-[42px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleConfirm}
                className="min-h-[42px] py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-extrabold transition disabled:opacity-60"
              >
                {isResetting ? 'Clearing...' : 'Yes, Start Fresh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
