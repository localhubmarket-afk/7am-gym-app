import React from 'react';
import { resolveDisplayUsername } from '../utils/wizardValidation';

export interface MobileHeaderProfile {
  name?: string | null;
  email?: string | null;
  authProvider?: string | null;
}

export interface MobileHeaderProps {
  profile: MobileHeaderProfile | null | undefined;
  subtitle?: string;
  onOpenAiCoach?: () => void;
  onOpenWatchModal?: () => void;
  onOpenProfileModal: () => void;
  onOpenShareModal?: () => void;
}

/**
 * Task 1: Mobile Application Header
 * Extracts the user's real first name (e.g. "François") from profile data
 * and displays it beside the profile icon — never generic auth providers ("Google" / "Apple").
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  profile,
  subtitle = 'Full-Body • $6.35/d',
  onOpenAiCoach,
  onOpenWatchModal,
  onOpenProfileModal,
  onOpenShareModal
}) => {
  const displayFirstName = resolveDisplayUsername(profile);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-[11px] font-black text-slate-950">
            GYM
          </div>
          <div className="min-w-0">
            <h1 className="truncate whitespace-nowrap text-xs font-extrabold leading-tight tracking-tight text-white sm:text-sm">
              Budget Gym
            </h1>
            <p className="truncate whitespace-nowrap text-[9px] font-semibold leading-tight text-emerald-400 sm:text-[10px]">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onOpenAiCoach && (
            <button
              type="button"
              onClick={onOpenAiCoach}
              className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-purple-400/40 bg-purple-500/20 px-2 py-1 text-[10px] font-extrabold text-purple-200 transition hover:bg-purple-500/30 sm:text-[11px]"
            >
              <span>AI</span>
            </button>
          )}

          {onOpenWatchModal && (
            <button
              type="button"
              onClick={onOpenWatchModal}
              className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-rose-400/40 bg-rose-500/15 px-2 py-1 text-[10px] font-extrabold text-rose-200 transition hover:bg-rose-500/25 sm:text-[11px]"
            >
              <span>Watch</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenProfileModal}
            title="Account & Profile"
            aria-label={`Open account profile for ${displayFirstName}`}
            className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-extrabold text-emerald-300 transition hover:bg-emerald-500/25 sm:text-[11px]"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span data-testid="mobile-header-username">{displayFirstName}</span>
          </button>

          {onOpenShareModal && (
            <button
              type="button"
              onClick={onOpenShareModal}
              className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-sky-500/40 bg-sky-500/15 px-2 py-1 text-[10px] font-bold text-sky-300 transition hover:bg-sky-500/25 sm:text-[11px]"
            >
              <span>Share</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
