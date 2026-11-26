import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOptionalAuth } from '../context/AuthContext';
import { getSupabaseClient } from '../lib/supabaseClient';
import {
  resolveHeaderAuthState,
  subscribeGlobalHeaderAuthState,
  type SupabaseAuthClientLike,
  type SupabaseSessionLike
} from '../utils/headerAuthSync';
import { PWAInstallButton } from './PWAInstallButton';

export interface MobileHeaderProfile {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  authProvider?: string | null;
  supabaseUserId?: string | null;
  isGuest?: boolean | null;
}

export interface MobileHeaderProps {
  profile: MobileHeaderProfile | null | undefined;
  subtitle?: string;
  showInstallButton?: boolean;
  supabaseClient?: SupabaseAuthClientLike | null;
  onOpenAiCoach?: () => void;
  onOpenWatchModal?: () => void;
  onOpenProfileModal: () => void;
  onOpenShareModal?: () => void;
}

/**
 * Mobile Application Header (WCAG 2.2 Level AA)
 * Listens to centralized AuthContext / Supabase `onAuthStateChange` + `getSession()`
 * so active sessions always display the user's name and avatar rather than "Sign In".
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  profile,
  subtitle = 'Full-Body • $6.35/d',
  showInstallButton = false,
  supabaseClient,
  onOpenAiCoach,
  onOpenWatchModal,
  onOpenProfileModal,
  onOpenShareModal
}) => {
  const authContext = useOptionalAuth();
  const profileRef = useRef<MobileHeaderProfile | null | undefined>(profile);
  profileRef.current = profile;

  const resolvedStandaloneClient = useMemo(
    () => (supabaseClient !== undefined ? supabaseClient : getSupabaseClient()),
    [supabaseClient]
  );

  const [standaloneSession, setStandaloneSession] = useState<SupabaseSessionLike | null>(null);
  const [standaloneLoading, setStandaloneLoading] = useState<boolean>(() =>
    Boolean(!authContext && resolvedStandaloneClient?.auth?.getSession)
  );

  // When rendered outside <AuthProvider>, bind directly to Supabase Auth so header state never desyncs
  useEffect(() => {
    if (authContext) return;
    if (!resolvedStandaloneClient?.auth) {
      setStandaloneLoading(false);
      return;
    }

    const handle = subscribeGlobalHeaderAuthState({
      supabaseClient: resolvedStandaloneClient,
      getLocalProfile: () => profileRef.current,
      onAuthStateChange: (resolved, _event, nextSession) => {
        setStandaloneSession(nextSession);
        setStandaloneLoading(resolved.isAuthLoading);
      }
    });

    return () => {
      handle.unsubscribe();
    };
  }, [authContext, resolvedStandaloneClient]);

  const headerAuth = useMemo(
    () =>
      resolveHeaderAuthState({
        session: authContext ? authContext.session : standaloneSession,
        localProfile: profile ?? null,
        isAuthLoading: authContext ? authContext.isAuthLoading : standaloneLoading
      }),
    [authContext, standaloneSession, standaloneLoading, profile]
  );

  return (
    <header
      role="banner"
      aria-label="Budget Gym application header"
      className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-[124px] flex-1 items-center gap-2 overflow-hidden">
          <div
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-[0.6875rem] font-black text-slate-950"
          >
            GYM
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <h1 className="overflow-hidden text-ellipsis whitespace-nowrap break-normal text-sm font-extrabold leading-relaxed tracking-tight text-white">
              Budget Gym
            </h1>
            <p className="hidden overflow-hidden text-ellipsis whitespace-nowrap break-normal text-[0.6875rem] font-semibold leading-relaxed text-emerald-400 sm:block">
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

          {headerAuth.status === 'loading' ? (
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label={headerAuth.ariaLabel}
              data-testid="mobile-header-auth-loading"
              data-auth-state="loading"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 bg-slate-900/90 px-2.5 py-2 text-[0.6875rem] font-bold text-slate-300"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400"
              />
              <span>Checking...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenProfileModal}
              data-auth-state={headerAuth.status}
              title={
                headerAuth.status === 'authenticated'
                  ? `${headerAuth.buttonDisplayLabel} • Account & Profile`
                  : 'Sign In & User Profile'
              }
              aria-label={headerAuth.ariaLabel}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-2 text-[0.6875rem] font-extrabold text-emerald-300 transition hover:bg-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              {headerAuth.status === 'authenticated' ? (
                headerAuth.avatarUrl ? (
                  <img
                    src={headerAuth.avatarUrl}
                    alt=""
                    aria-hidden="true"
                    data-testid="mobile-header-avatar"
                    className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-emerald-400/60"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    data-testid="mobile-header-avatar"
                    className="inline-flex shrink-0 items-center justify-center text-xs leading-none"
                  >
                    👤
                  </span>
                )
              ) : (
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
              )}
              <span data-testid="mobile-header-username">{headerAuth.displayName}</span>
            </button>
          )}

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
