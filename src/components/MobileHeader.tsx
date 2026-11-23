import React from 'react';
import { resolveDisplayUsername } from '../utils/wizardValidation';
import { PWAInstallButton } from './PWAInstallButton';

export interface MobileHeaderProfile {
  name?: string | null;
  email?: string | null;
  authProvider?: string | null;
}

export interface MobileHeaderProps {
  profile: MobileHeaderProfile | null | undefined;
  subtitle?: string;
  showInstallButton?: boolean;
  onOpenAiCoach?: () => void;
  onOpenWatchModal?: () => void;
  onOpenProfileModal: () => void;
  onOpenShareModal?: () => void;
}

/**
 * Mobile Application Header (WCAG 2.2 Level AA)
 * Extracts the user's real first name (e.g. "François") from profile data,
 * uses relative rem typography, 44x44px touch targets, and explicit ARIA labels.
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  profile,
  subtitle = 'Full-Body • $6.35/d',
  showInstallButton = false,
  onOpenAiCoach,
  onOpenWatchModal,
  onOpenProfileModal,
  onOpenShareModal
}) => {
  const displayFirstName = resolveDisplayUsername(profile);

  return (
    <header
      role="banner"
      aria-label="Budget Gym application header"
      className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-[0.6875rem] font-black text-slate-950"
          >
            GYM
          </div>
          <div className="min-w-0">
            <h1 className="truncate whitespace-nowrap text-xs font-extrabold leading-relaxed tracking-tight text-white sm:text-sm">
              Budget Gym
            </h1>
            <p className="truncate whitespace-nowrap text-[0.625rem] font-semibold leading-relaxed text-emerald-400 sm:text-[0.6875rem]">
              {subtitle}
            </p>
          </div>
        </div>

        <nav aria-label="Header quick actions" className="flex shrink-0 items-center gap-1.5">
          {showInstallButton && <PWAInstallButton />}

          {onOpenAiCoach && (
            <button
              type="button"
              onClick={onOpenAiCoach}
              aria-label="Open AI Workout Coach"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-purple-400/40 bg-purple-500/20 px-2.5 py-2 text-[0.6875rem] font-extrabold text-purple-200 transition hover:bg-purple-500/30 focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <span>AI</span>
            </button>
          )}

          {onOpenWatchModal && (
            <button
              type="button"
              onClick={onOpenWatchModal}
              aria-label="Open Watch and Heart Rate settings"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-rose-400/40 bg-rose-500/15 px-2.5 py-2 text-[0.6875rem] font-extrabold text-rose-200 transition hover:bg-rose-500/25 focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              <span>Watch</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenProfileModal}
            title="Account & Profile"
            aria-label={`Open account profile for ${displayFirstName}`}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-2 text-[0.6875rem] font-extrabold text-emerald-300 transition hover:bg-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
              aria-label="Share your workout plan"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-sky-500/40 bg-sky-500/15 px-2.5 py-2 text-[0.6875rem] font-bold text-sky-300 transition hover:bg-sky-500/25 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              <span>Share</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
