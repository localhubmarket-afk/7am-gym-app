import React, { useEffect, useState } from 'react';
import { resolveDisplayUsername } from '../utils/wizardValidation';
import {
  authenticateWithBiometricPasskey,
  checkPlatformBiometricPasskeyAvailability,
  hasRegisteredPasskeyForEmail,
  registerBiometricPasskey,
  sendSupabaseMagicLink,
  verifySupabaseMagicLinkOtp,
  type SupabasePasswordlessClientLike
} from '../utils/passwordlessAuth';

export type AuthMode = 'login' | 'signup';
export type OAuthProvider = 'google' | 'apple';

export interface EmailPasswordCredentials {
  mode: AuthMode;
  firstName: string;
  email: string;
  password: string;
}

export interface PasswordlessAuthPayload {
  method: 'magic_link' | 'webauthn_passkey';
  email: string;
  displayName: string;
  userId?: string | null;
  credentialId?: string | null;
}

export interface PendingAccountCandidate {
  displayName: string;
  email: string;
  provider: 'email_password' | 'google_oauth' | 'apple_oauth' | 'magic_link' | 'webauthn_passkey';
  credentials?: EmailPasswordCredentials;
  oauthProvider?: OAuthProvider;
  passwordlessPayload?: PasswordlessAuthPayload;
}

export interface AccountLoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onEmailPasswordLogin: (credentials: EmailPasswordCredentials) => Promise<void> | void;
  onOAuthLogin: (provider: OAuthProvider, resolvedEmail?: string) => Promise<void> | void;
  onPasswordlessLogin?: (payload: PasswordlessAuthPayload) => Promise<void> | void;
  supabaseClient?: SupabasePasswordlessClientLike | null;
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
  onPasswordlessLogin,
  supabaseClient,
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

  // Task 1: Passwordless Login (Supabase Magic Link OTP + WebAuthn Biometric Passkeys)
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [passwordlessStatus, setPasswordlessStatus] = useState<string>('');
  const [passwordlessError, setPasswordlessError] = useState<string>('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [isRunningPasskey, setIsRunningPasskey] = useState<boolean>(false);
  const [passkeySupported, setPasskeySupported] = useState<boolean>(true);
  const [hasSavedPasskey, setHasSavedPasskey] = useState<boolean>(() =>
    hasRegisteredPasskeyForEmail(initialEmail)
  );

  useEffect(() => {
    let active = true;
    void checkPlatformBiometricPasskeyAvailability().then((supported) => {
      if (active) setPasskeySupported(supported);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setHasSavedPasskey(hasRegisteredPasskeyForEmail(email));
  }, [email]);

  if (!isOpen) return null;

  async function handleSendMagicLink() {
    setPasswordlessError('');
    setPasswordlessStatus('');
    setErrorMessage('');
    setIsSendingMagicLink(true);
    try {
      const res = await sendSupabaseMagicLink({
        email,
        displayName: firstName,
        shouldCreateUser: true,
        supabaseClient
      });
      if (!res.ok) {
        setPasswordlessError(res.message);
        return;
      }
      setMagicLinkSentTo(res.email);
      setPasswordlessStatus(res.message);
    } finally {
      setIsSendingMagicLink(false);
    }
  }

  async function handleVerifyMagicLinkOtp() {
    setPasswordlessError('');
    setPasswordlessStatus('');
    setIsVerifyingOtp(true);
    try {
      const res = await verifySupabaseMagicLinkOtp({
        email: magicLinkSentTo || email,
        token: otpCode,
        displayName: firstName,
        supabaseClient
      });
      if (!res.ok) {
        setPasswordlessError(res.message);
        return;
      }
      const displayName = resolveDisplayUsername({
        name: res.displayName || firstName.trim(),
        email: res.email,
        authProvider: 'magic_link'
      });
      setPendingVerification({
        displayName,
        email: res.email,
        provider: 'magic_link',
        passwordlessPayload: {
          method: 'magic_link',
          email: res.email,
          displayName,
          userId: res.userId
        }
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function handlePasskeySetup() {
    setPasswordlessError('');
    setPasswordlessStatus('');
    setErrorMessage('');
    setIsRunningPasskey(true);
    try {
      const res = await registerBiometricPasskey({
        email,
        displayName: firstName,
        supabaseClient
      });
      if (!res.ok) {
        setPasswordlessError(res.message);
        return;
      }
      setHasSavedPasskey(true);
      setPasswordlessStatus(res.message);
      setPendingVerification({
        displayName: res.displayName,
        email: res.email,
        provider: 'webauthn_passkey',
        passwordlessPayload: {
          method: 'webauthn_passkey',
          email: res.email,
          displayName: res.displayName,
          credentialId: res.credentialId
        }
      });
    } finally {
      setIsRunningPasskey(false);
    }
  }

  async function handlePasskeySignIn() {
    setPasswordlessError('');
    setPasswordlessStatus('');
    setErrorMessage('');
    setIsRunningPasskey(true);
    try {
      const res = await authenticateWithBiometricPasskey({ email });
      if (!res.ok) {
        setPasswordlessError(res.message);
        return;
      }
      setPasswordlessStatus(res.message);
      const resolvedEmail = res.email || email.trim().toLowerCase();
      setPendingVerification({
        displayName: res.displayName,
        email: resolvedEmail,
        provider: 'webauthn_passkey',
        passwordlessPayload: {
          method: 'webauthn_passkey',
          email: resolvedEmail,
          displayName: res.displayName,
          credentialId: res.credentialId
        }
      });
    } finally {
      setIsRunningPasskey(false);
    }
  }

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
      } else if (pendingVerification.passwordlessPayload) {
        if (onPasswordlessLogin) {
          await onPasswordlessLogin(pendingVerification.passwordlessPayload);
        } else {
          await onOAuthLogin('google', pendingVerification.email);
        }
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
    setOtpCode('');
    setMagicLinkSentTo('');
    setPasswordlessStatus('');
    setPasswordlessError('');
    setErrorMessage('');
  }

  if (pendingVerification) {
    const providerLabel =
      pendingVerification.provider === 'google_oauth'
        ? 'Google Sign-In'
        : pendingVerification.provider === 'apple_oauth'
          ? 'Apple Sign-In'
          : pendingVerification.provider === 'magic_link'
            ? 'Email Magic Link (No Password)'
            : pendingVerification.provider === 'webauthn_passkey'
              ? 'FaceID / Fingerprint Passkey'
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
              className="min-h-[48px] min-w-[48px] w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {isSubmitting ? 'Signing In...' : `Yes, Continue as ${pendingVerification.displayName}`}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSwitchAccount}
              aria-label="Switch to a different account"
              className="min-h-[48px] min-w-[48px] w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-xs font-extrabold text-slate-100 transition hover:bg-slate-700 disabled:opacity-60"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm"
    >
      <div className="auth-modal-shell flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Fixed Header & Close Button — Always Visible */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5">
          <div className="min-w-0">
            <h2 id="account-login-title" className="text-sm font-extrabold leading-tight text-white">
              {mode === 'login' ? 'Log In to Your Account' : 'Create Your Account'}
            </h2>
            <p className="mt-0.5 text-[0.75rem] leading-snug text-slate-300">
              Sync your workouts, weights, and progress automatically.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close login modal"
              className="min-h-[48px] min-w-[48px] shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-100 hover:bg-slate-700"
            >
              Close
            </button>
          )}
        </div>

        {/* Scrollable Inner Form Container Only (max-h-[80vh] overflow-y-auto) */}
        <div
          data-testid="auth-modal-scroll-body"
          className="flex max-h-[80vh] flex-col gap-2.5 overflow-y-auto px-4 py-3"
        >
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              aria-pressed={mode === 'login'}
              className={`min-h-[48px] min-w-[48px] rounded-lg py-1.5 text-xs font-extrabold transition ${
                mode === 'login' ? 'bg-green-700 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              aria-pressed={mode === 'signup'}
              className={`min-h-[48px] min-w-[48px] rounded-lg py-1.5 text-xs font-extrabold transition ${
                mode === 'signup' ? 'bg-green-700 text-white' : 'text-slate-300 hover:text-white'
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
              className="flex min-h-[48px] min-w-[48px] items-center justify-center gap-1.5 rounded-xl bg-white px-2.5 py-2 text-xs font-extrabold text-gray-900 shadow transition hover:bg-slate-100"
            >
              <span>Continue with Apple</span>
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleProviderClick('google')}
              aria-label="Continue with Google Sign-In"
              className="flex min-h-[48px] min-w-[48px] items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-950 px-2.5 py-2 text-xs font-extrabold text-white transition hover:bg-slate-800"
            >
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Task 1: Fast Passwordless Sign-In (Supabase Magic Link + WebAuthn Biometric Passkeys) */}
          <section
            aria-label="Passwordless Sign-In Options"
            data-testid="passwordless-auth-section"
            className="flex flex-col gap-2 rounded-xl border border-green-500/45 bg-slate-950/95 p-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <h3 className="text-xs font-extrabold text-white">
                Fast Sign-In: Magic Link or Passkey
              </h3>
              <span className="inline-block rounded-md bg-green-100 px-2 py-0.5 text-[0.6875rem] font-extrabold text-gray-900">
                No Password Needed
              </span>
            </div>

            <div>
              <label
                htmlFor="react-passwordless-email"
                className="mb-1 block text-xs font-bold text-slate-200"
              >
                Your Email Address (for Magic Link or Passkey)
              </label>
              <input
                id="react-passwordless-email"
                data-testid="passwordless-email-input"
                type="email"
                inputMode="email"
                autoComplete="email webauthn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-1.5 text-base font-semibold text-white placeholder-slate-300 focus-visible:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={isSendingMagicLink || isSubmitting}
                data-testid="send-magic-link-btn"
                onClick={() => void handleSendMagicLink()}
                className="min-h-[48px] min-w-[48px] w-full rounded-xl bg-green-700 px-3 py-2 text-xs font-extrabold text-white shadow transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                {isSendingMagicLink ? 'Sending Magic Link...' : 'Email Me a One-Tap Magic Link'}
              </button>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={isRunningPasskey || isSubmitting}
                  data-testid="signin-passkey-btn"
                  onClick={() => void handlePasskeySignIn()}
                  className="min-h-[48px] min-w-[48px] w-full rounded-xl border border-sky-400/70 bg-sky-950/60 px-2.5 py-2 text-xs font-extrabold text-sky-100 transition hover:bg-sky-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  {isRunningPasskey ? 'Checking...' : 'Sign In with FaceID / Fingerprint'}
                </button>

                <button
                  type="button"
                  disabled={isRunningPasskey || isSubmitting}
                  data-testid="setup-passkey-btn"
                  onClick={() => void handlePasskeySetup()}
                  className="min-h-[48px] min-w-[48px] w-full rounded-xl border border-indigo-400/70 bg-indigo-950/60 px-2.5 py-2 text-xs font-extrabold text-indigo-100 transition hover:bg-indigo-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  {hasSavedPasskey ? 'Add Another Passkey' : 'Set Up FaceID / Fingerprint'}
                </button>
              </div>
            </div>

            {!passkeySupported && (
              <p className="text-[0.6875rem] leading-snug text-amber-200">
                This browser window does not support biometric Passkeys. Use the Magic Link button above instead.
              </p>
            )}

            {magicLinkSentTo && (
              <div className="space-y-1.5 rounded-xl border border-green-500/35 bg-slate-900 p-2.5">
                <label
                  htmlFor="react-magic-link-otp"
                  className="block text-xs font-extrabold text-emerald-200"
                >
                  Optional: Enter 6-Digit Email Code for {magicLinkSentTo}
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="react-magic-link-otp"
                    data-testid="magic-link-otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="min-h-[48px] flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-1.5 text-base font-extrabold tracking-widest text-white placeholder-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  />
                  <button
                    type="button"
                    disabled={isVerifyingOtp}
                    data-testid="verify-magic-link-otp-btn"
                    onClick={() => void handleVerifyMagicLinkOtp()}
                    className="min-h-[48px] min-w-[48px] rounded-xl bg-sky-400 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                  >
                    {isVerifyingOtp ? 'Checking...' : 'Verify Code'}
                  </button>
                </div>
              </div>
            )}

            {passwordlessStatus && (
              <p
                role="status"
                aria-live="polite"
                data-testid="passwordless-status-msg"
                className="rounded-lg border border-green-500/40 bg-green-100 px-2.5 py-1.5 text-xs font-bold leading-snug text-gray-900"
              >
                {passwordlessStatus}
              </p>
            )}

            {passwordlessError && (
              <p
                role="alert"
                aria-live="polite"
                data-testid="passwordless-error-msg"
                className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-1.5 text-xs font-semibold leading-snug text-rose-200"
              >
                {passwordlessError}
              </p>
            )}
          </section>

          <div className="flex items-center gap-2 text-[0.625rem] font-bold uppercase text-slate-400">
            <div className="h-px flex-1 bg-slate-800" />
            <span>Or Log In with Email &amp; Password</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
            {mode === 'signup' && (
              <div>
                <label htmlFor="react-login-name" className="mb-0.5 block text-xs font-bold text-slate-200">
                  First Name
                </label>
                <input
                  id="react-login-name"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  className="min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-1.5 text-base font-semibold text-white placeholder-slate-300 focus:border-sky-400 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="react-login-email" className="mb-0.5 block text-xs font-bold text-slate-200">
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
                className="min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-1.5 text-base font-semibold text-white placeholder-slate-300 focus:border-sky-400 focus:outline-none"
              />
            </div>

            {/* Password Input Directly Below Email Address */}
            <div>
              <div className="mb-0.5 flex items-center justify-between">
                <label htmlFor="react-login-password" className="block text-xs font-bold text-slate-200">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password characters' : 'Show password characters'}
                  className="min-h-[48px] min-w-[48px] px-2 text-xs font-bold text-sky-300 hover:text-sky-200"
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
                className="min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-1.5 text-base font-semibold text-white placeholder-slate-300 focus:border-sky-400 focus:outline-none"
              />
            </div>

            {errorMessage && (
              <p role="alert" aria-live="polite" className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-1.5 text-sm font-semibold text-rose-200">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[48px] min-w-[48px] w-full rounded-xl bg-sky-400 px-4 py-2 text-sm font-extrabold text-slate-950 shadow transition hover:bg-sky-300"
            >
              {isSubmitting ? 'Checking Account...' : mode === 'signup' ? 'Create Account' : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

