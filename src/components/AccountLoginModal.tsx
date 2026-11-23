import React, { useState } from 'react';
import { resolveDisplayUsername } from '../utils/wizardValidation';

export type AuthMode = 'login' | 'signup';
export type OAuthProvider = 'google' | 'apple';

export interface EmailPasswordCredentials {
  mode: AuthMode;
  firstName: string;
  email: string;
  password: string;
}

export interface PendingAccountCandidate {
  displayName: string;
  email: string;
  provider: 'email_password' | 'google_oauth' | 'apple_oauth';
  credentials?: EmailPasswordCredentials;
  oauthProvider?: OAuthProvider;
}

export interface AccountLoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onEmailPasswordLogin: (credentials: EmailPasswordCredentials) => Promise<void> | void;
  onOAuthLogin: (provider: OAuthProvider, resolvedEmail?: string) => Promise<void> | void;
  initialEmail?: string;
  initialName?: string;
}

export function getHeaderProfileDisplayName(profile: {
  name?: string | null;
  email?: string | null;
  authProvider?: string | null;
} | null | undefined): string {
  return resolveDisplayUsername(profile);
}

export const AccountLoginModal: React.FC<AccountLoginModalProps> = ({
  isOpen,
  onClose,
  onEmailPasswordLogin,
  onOAuthLogin,
  initialEmail = '',
  initialName = ''
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [firstName, setFirstName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<PendingAccountCandidate | null>(null);

  if (!isOpen) return null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Please enter a password with at least 6 characters.');
      return;
    }

    const displayName = resolveDisplayUsername({
      name: firstName.trim(),
      email: cleanEmail,
      authProvider: 'email_password'
    });

    setPendingVerification({
      displayName,
      email: cleanEmail,
      provider: 'email_password',
      credentials: {
        mode,
        firstName: displayName,
        email: cleanEmail,
        password
      }
    });
  }

  function handleProviderClick(provider: OAuthProvider) {
    setErrorMessage('');
    const cleanEmail = email.trim().toLowerCase();
    const fallbackEmail =
      cleanEmail && cleanEmail.includes('@')
        ? cleanEmail
        : provider === 'apple'
          ? 'francois@icloud.com'
          : 'francois@gmail.com';
    const displayName = resolveDisplayUsername({
      name: firstName.trim(),
      email: fallbackEmail,
      authProvider: `${provider}_oauth`
    });

    setPendingVerification({
      displayName,
      email: fallbackEmail,
      provider: `${provider}_oauth`,
      oauthProvider: provider
    });
  }

  async function handleConfirmVerification() {
    if (!pendingVerification) return;
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      if (pendingVerification.provider === 'email_password' && pendingVerification.credentials) {
        await onEmailPasswordLogin(pendingVerification.credentials);
      } else if (pendingVerification.oauthProvider) {
        await onOAuthLogin(pendingVerification.oauthProvider, pendingVerification.email);
      }
      setPendingVerification(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to complete login. Please try again.');
      setPendingVerification(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSwitchAccount() {
    setPendingVerification(null);
    setEmail('');
    setPassword('');
    setFirstName('');
    setErrorMessage('');
  }

  if (pendingVerification) {
    const providerLabel =
      pendingVerification.provider === 'google_oauth'
        ? 'Google Sign-In'
        : pendingVerification.provider === 'apple_oauth'
          ? 'Apple Sign-In'
          : 'Email & Password';

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-verify-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
      >
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-sky-400/50 bg-slate-900 p-5 text-slate-100 shadow-2xl">
          <div className="border-b border-slate-800 pb-3">
            <span className="inline-block rounded-full border border-sky-400/40 bg-sky-500/15 px-2.5 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-wider text-sky-300">
              Account Verification
            </span>
            <h2 id="account-verify-title" className="mt-1.5 text-base font-extrabold leading-relaxed text-white">
              Is this the correct account?
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Confirm your profile before we load your saved workouts.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3.5">
            <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-base font-extrabold text-slate-950">
              {pendingVerification.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold text-white">{pendingVerification.displayName}</div>
              <div className="truncate text-xs text-slate-300">{pendingVerification.email}</div>
              <div className="mt-0.5 text-[0.6875rem] font-bold text-sky-300">{providerLabel}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmVerification}
              aria-label={`Continue as ${pendingVerification.displayName}`}
              className="min-h-[44px] min-w-[44px] w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {isSubmitting ? 'Signing In...' : `Yes, Continue as ${pendingVerification.displayName}`}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSwitchAccount}
              aria-label="Switch to a different account"
              className="min-h-[44px] min-w-[44px] w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-xs font-extrabold text-slate-100 transition hover:bg-slate-700 disabled:opacity-60"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-login-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 id="account-login-title" className="text-base font-extrabold text-white">
              {mode === 'login' ? 'Log In to Your Account' : 'Create Your Account'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-300">
              Sync your workouts, weights, and progress automatically.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close login modal"
              className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
            >
              Close
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            aria-pressed={mode === 'login'}
            className={`min-h-[44px] min-w-[44px] rounded-lg py-2 text-xs font-extrabold transition ${
              mode === 'login' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            aria-pressed={mode === 'signup'}
            className={`min-h-[44px] min-w-[44px] rounded-lg py-2 text-xs font-extrabold transition ${
              mode === 'signup' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Instant OAuth Login Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleProviderClick('apple')}
            aria-label="Continue with Apple Sign-In"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-extrabold text-slate-950 shadow transition hover:bg-slate-100 disabled:opacity-60"
          >
            <span>Continue with Apple</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleProviderClick('google')}
            aria-label="Continue with Google Sign-In"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <span>Continue with Google</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[0.625rem] font-bold uppercase text-slate-400">
          <div className="h-px flex-1 bg-slate-800" />
          <span>Or Log In with Email &amp; Password</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {mode === 'signup' && (
            <div>
              <label htmlFor="react-login-name" className="mb-1 block text-xs font-bold text-slate-200">
                First Name
              </label>
              <input
                id="react-login-name"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white placeholder-slate-400 focus:border-sky-400 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label htmlFor="react-login-email" className="mb-1 block text-xs font-bold text-slate-200">
              Email Address
            </label>
            <input
              id="react-login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white placeholder-slate-400 focus:border-sky-400 focus:outline-none"
            />
          </div>

          {/* Password Input Directly Below Email Address */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="react-login-password" className="block text-xs font-bold text-slate-200">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password characters' : 'Show password characters'}
                className="min-h-[44px] min-w-[44px] px-2 text-[0.6875rem] font-bold text-sky-400 hover:text-sky-300"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="react-login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white placeholder-slate-400 focus:border-sky-400 focus:outline-none"
            />
          </div>

          {errorMessage && (
            <p role="alert" aria-live="polite" className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-xs font-semibold text-rose-200">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px] w-full rounded-xl bg-sky-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow transition hover:bg-sky-300 disabled:opacity-60"
          >
            {isSubmitting ? 'Checking Account...' : mode === 'signup' ? 'Create Account' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
};

