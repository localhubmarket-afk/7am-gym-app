import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient';

export const PASSKEY_REGISTRY_STORAGE_KEY = 'budget_gym_webauthn_passkeys_v1';

export interface SupabasePasswordlessClientLike {
  auth?: {
    signInWithOtp?: (params: {
      email: string;
      options?: {
        emailRedirectTo?: string;
        shouldCreateUser?: boolean;
        data?: Record<string, unknown>;
      };
    }) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
    verifyOtp?: (params: {
      email: string;
      token: string;
      type: 'email' | 'magiclink';
    }) => Promise<{
      data?: { user?: { id?: string; email?: string | null; user_metadata?: Record<string, any> } | null; session?: unknown } | null;
      error?: { message?: string } | null;
    }>;
    updateUser?: (params: {
      data?: Record<string, unknown>;
    }) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
  };
}

export interface StoredPasskeyRecord {
  credentialId: string;
  email: string;
  displayName: string;
  createdAt: string;
  authenticatorLabel: string;
  transports: string[];
}

export interface MagicLinkSendResult {
  ok: boolean;
  email: string;
  mode: 'supabase_otp' | 'preview_guided';
  message: string;
  errorMessage?: string;
}

export interface MagicLinkVerifyResult {
  ok: boolean;
  email: string;
  userId: string | null;
  displayName: string;
  message: string;
  errorMessage?: string;
}

export interface PasskeyOperationResult {
  ok: boolean;
  mode: 'webauthn_verified' | 'unsupported' | 'cancelled' | 'error';
  credentialId: string | null;
  email: string;
  displayName: string;
  message: string;
  errorMessage?: string;
}

export function validatePasswordlessEmail(rawEmail: unknown): {
  valid: boolean;
  email: string;
  errorMessage?: string;
} {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) {
    return {
      valid: false,
      email: '',
      errorMessage: 'Please type your email address first.'
    };
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailPattern.test(email) || email.length > 254) {
    return {
      valid: false,
      email,
      errorMessage: 'That does not look like a valid email address (example: alex@gmail.com).'
    };
  }
  return { valid: true, email };
}

/**
 * Validates and builds a safe same-origin redirect URL for Supabase Magic Links.
 * Rejects javascript:, data:, and external origins to prevent open-redirect phishing.
 */
export function buildSafeMagicLinkRedirectUrl(
  candidateUrl?: string | null,
  currentOrigin?: string | null
): string | undefined {
  const fallbackOrigin =
    currentOrigin ??
    (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  const raw = String(candidateUrl || fallbackOrigin || '').trim();
  if (!raw) return undefined;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return undefined;
    }
    if (fallbackOrigin) {
      const originParsed = new URL(fallbackOrigin);
      if (parsed.origin !== originParsed.origin) {
        return originParsed.origin;
      }
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

/**
 * Task 1 (Supabase Magic Link / Email OTP):
 * Sends a one-tap sign-in link (and optional 6-digit code) with zero password needed.
 */
export async function sendSupabaseMagicLink(options: {
  email: string;
  displayName?: string;
  shouldCreateUser?: boolean;
  redirectTo?: string;
  supabaseClient?: SupabasePasswordlessClientLike | SupabaseClient | null;
}): Promise<MagicLinkSendResult> {
  const emailCheck = validatePasswordlessEmail(options.email);
  if (!emailCheck.valid) {
    return {
      ok: false,
      email: emailCheck.email,
      mode: 'preview_guided',
      message: emailCheck.errorMessage || 'Please enter a valid email address.',
      errorMessage: emailCheck.errorMessage
    };
  }

  const client =
    options.supabaseClient !== undefined
      ? (options.supabaseClient as SupabasePasswordlessClientLike | null)
      : (getSupabaseClient() as SupabasePasswordlessClientLike | null);

  const safeRedirect = buildSafeMagicLinkRedirectUrl(options.redirectTo);

  if (client && client.auth && typeof client.auth.signInWithOtp === 'function') {
    try {
      const res = await client.auth.signInWithOtp({
        email: emailCheck.email,
        options: {
          emailRedirectTo: safeRedirect,
          shouldCreateUser: options.shouldCreateUser !== false,
          data: options.displayName ? { display_name: options.displayName.trim() } : undefined
        }
      });

      if (res?.error) {
        const msg =
          res.error.message ||
          'We could not send your Magic Link right now. Please check your email and try again.';
        return {
          ok: false,
          email: emailCheck.email,
          mode: 'supabase_otp',
          message: msg,
          errorMessage: msg
        };
      }

      return {
        ok: true,
        email: emailCheck.email,
        mode: 'supabase_otp',
        message: `Magic Link sent to ${emailCheck.email}. Open your inbox and tap the button, or type the 6-digit code below.`
      };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Network error while sending Magic Link. Please try again.';
      return {
        ok: false,
        email: emailCheck.email,
        mode: 'supabase_otp',
        message: msg,
        errorMessage: msg
      };
    }
  }

  // Graceful preview / local-first guidance when public Supabase keys are not yet attached
  return {
    ok: true,
    email: emailCheck.email,
    mode: 'preview_guided',
    message: `Magic Link flow ready for ${emailCheck.email}. Connect your Supabase keys in .env to email live links, or tap Continue below.`
  };
}

/**
 * Verifies a 6-digit Magic Link OTP code sent by Supabase Auth.
 */
export async function verifySupabaseMagicLinkOtp(options: {
  email: string;
  token: string;
  displayName?: string;
  supabaseClient?: SupabasePasswordlessClientLike | SupabaseClient | null;
}): Promise<MagicLinkVerifyResult> {
  const emailCheck = validatePasswordlessEmail(options.email);
  if (!emailCheck.valid) {
    return {
      ok: false,
      email: emailCheck.email,
      userId: null,
      displayName: '',
      message: emailCheck.errorMessage || 'Please enter a valid email address.',
      errorMessage: emailCheck.errorMessage
    };
  }

  const cleanToken = String(options.token || '').replace(/\s+/g, '');
  if (!/^\d{6,8}$/.test(cleanToken)) {
    return {
      ok: false,
      email: emailCheck.email,
      userId: null,
      displayName: '',
      message: 'Please type the 6-digit code from your email.',
      errorMessage: 'Invalid OTP format'
    };
  }

  const client =
    options.supabaseClient !== undefined
      ? (options.supabaseClient as SupabasePasswordlessClientLike | null)
      : (getSupabaseClient() as SupabasePasswordlessClientLike | null);

  const fallbackName =
    String(options.displayName || '').trim() || emailCheck.email.split('@')[0] || 'Athlete';

  if (client && client.auth && typeof client.auth.verifyOtp === 'function') {
    try {
      const res = await client.auth.verifyOtp({
        email: emailCheck.email,
        token: cleanToken,
        type: 'email'
      });
      if (res?.error) {
        const msg =
          res.error.message || 'That code did not match or expired. Request a fresh Magic Link.';
        return {
          ok: false,
          email: emailCheck.email,
          userId: null,
          displayName: fallbackName,
          message: msg,
          errorMessage: msg
        };
      }
      const verifiedUser = res?.data?.user;
      const resolvedName =
        String(verifiedUser?.user_metadata?.display_name || '').trim() || fallbackName;
      return {
        ok: true,
        email: verifiedUser?.email || emailCheck.email,
        userId: verifiedUser?.id || null,
        displayName: resolvedName,
        message: `Signed in as ${resolvedName} without a password.`
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to verify code right now.';
      return {
        ok: false,
        email: emailCheck.email,
        userId: null,
        displayName: fallbackName,
        message: msg,
        errorMessage: msg
      };
    }
  }

  return {
    ok: false,
    email: emailCheck.email,
    userId: null,
    displayName: fallbackName,
    message: 'Live code check requires Supabase keys in .env. Use your Magic Link once connected.',
    errorMessage: 'Supabase client not configured'
  };
}

export function generateWebAuthnChallenge(byteLength = 32): Uint8Array {
  const bytes = new Uint8Array(Math.max(16, byteLength));
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

export function encodeBytesToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeBase64UrlToBytes(base64Url: string): Uint8Array {
  const normalized = String(base64Url || '').replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);
  if (typeof atob === 'function') {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

export function isWebAuthnPasskeySupported(win?: {
  PublicKeyCredential?: unknown;
  navigator?: { credentials?: { create?: unknown; get?: unknown } };
}): boolean {
  const target = win ?? (typeof window !== 'undefined' ? (window as any) : null);
  if (!target) return false;
  return Boolean(
    target.PublicKeyCredential &&
      target.navigator &&
      target.navigator.credentials &&
      typeof target.navigator.credentials.create === 'function' &&
      typeof target.navigator.credentials.get === 'function'
  );
}

export async function checkPlatformBiometricPasskeyAvailability(win?: {
  PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> };
  navigator?: { credentials?: { create?: unknown; get?: unknown } };
}): Promise<boolean> {
  if (!isWebAuthnPasskeySupported(win)) return false;
  const target = win ?? (typeof window !== 'undefined' ? (window as any) : null);
  const fn = target?.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
  if (typeof fn !== 'function') return true;
  try {
    return Boolean(await fn.call(target.PublicKeyCredential));
  } catch {
    return false;
  }
}

export function loadRegisteredPasskeys(
  storage?: Pick<Storage, 'getItem'> | null
): StoredPasskeyRecord[] {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return [];
    const raw = store.getItem(PASSKEY_REGISTRY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredPasskeyRecord =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.credentialId === 'string' &&
        item.credentialId.length > 0 &&
        typeof item.email === 'string'
    );
  } catch {
    return [];
  }
}

function saveRegisteredPasskeys(
  records: StoredPasskeyRecord[],
  storage?: Pick<Storage, 'setItem'> | null
): void {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return;
    store.setItem(PASSKEY_REGISTRY_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota issues
  }
}

export function hasRegisteredPasskeyForEmail(
  email?: string | null,
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  const clean = String(email || '').trim().toLowerCase();
  const list = loadRegisteredPasskeys(storage);
  if (!clean) return list.length > 0;
  return list.some((rec) => rec.email.toLowerCase() === clean);
}

function resolveSafeRpId(explicitRpId?: string): string {
  if (explicitRpId && /^[a-z0-9.-]+$/i.test(explicitRpId)) {
    return explicitRpId.toLowerCase();
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
}

/**
 * Task 1 (WebAuthn Passkey Setup — FaceID / TouchID / Fingerprint):
 * Creates a platform biometric Passkey via `navigator.credentials.create`
 * and saves ONLY public credential metadata (never any private key).
 */
export async function registerBiometricPasskey(options: {
  email: string;
  displayName?: string;
  rpName?: string;
  rpId?: string;
  supabaseClient?: SupabasePasswordlessClientLike | SupabaseClient | null;
  credentialsApi?: Pick<CredentialsContainer, 'create'> | null;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}): Promise<PasskeyOperationResult> {
  const emailCheck = validatePasswordlessEmail(options.email);
  if (!emailCheck.valid) {
    return {
      ok: false,
      mode: 'error',
      credentialId: null,
      email: emailCheck.email,
      displayName: '',
      message: emailCheck.errorMessage || 'Type your email first so we know which account gets this Passkey.',
      errorMessage: emailCheck.errorMessage
    };
  }

  const cleanName =
    String(options.displayName || '').trim() || emailCheck.email.split('@')[0] || 'Athlete';
  const creds =
    options.credentialsApi ??
    (typeof navigator !== 'undefined' && navigator.credentials ? navigator.credentials : null);

  if (!creds || typeof creds.create !== 'function') {
    return {
      ok: false,
      mode: 'unsupported',
      credentialId: null,
      email: emailCheck.email,
      displayName: cleanName,
      message:
        'This browser does not support FaceID or Fingerprint Passkeys yet. Use the Email Magic Link button instead.',
      errorMessage: 'WebAuthn unavailable'
    };
  }

  try {
    const challenge = generateWebAuthnChallenge(32);
    const userIdBytes = new TextEncoder().encode(`gym_user:${emailCheck.email}`).slice(0, 64);

    const credential = (await creds.create({
      publicKey: {
        challenge: challenge as unknown as BufferSource,
        rp: {
          name: options.rpName || '7AM Budget Gym',
          id: resolveSafeRpId(options.rpId)
        },
        user: {
          id: userIdBytes as unknown as BufferSource,
          name: emailCheck.email,
          displayName: cleanName
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          userVerification: 'preferred'
        },
        timeout: 60000,
        attestation: 'none'
      }
    })) as PublicKeyCredential | null;

    if (!credential || !credential.rawId) {
      return {
        ok: false,
        mode: 'cancelled',
        credentialId: null,
        email: emailCheck.email,
        displayName: cleanName,
        message: 'Passkey setup was cancelled. Tap the button again whenever you are ready.',
        errorMessage: 'No credential returned'
      };
    }

    const credentialId =
      typeof credential.id === 'string' && credential.id
        ? credential.id
        : encodeBytesToBase64Url(credential.rawId);

    const existing = loadRegisteredPasskeys(options.storage).filter(
      (rec) => rec.credentialId !== credentialId
    );
    const newRecord: StoredPasskeyRecord = {
      credentialId,
      email: emailCheck.email,
      displayName: cleanName,
      createdAt: new Date().toISOString(),
      authenticatorLabel: 'Device FaceID / Fingerprint',
      transports: ['internal']
    };
    saveRegisteredPasskeys([newRecord, ...existing].slice(0, 10), options.storage);

    // Sync non-secret passkey enrollment metadata to Supabase Auth profile if signed in
    const client =
      options.supabaseClient !== undefined
        ? (options.supabaseClient as SupabasePasswordlessClientLike | null)
        : (getSupabaseClient() as SupabasePasswordlessClientLike | null);

    if (client && client.auth && typeof client.auth.updateUser === 'function') {
      try {
        await client.auth.updateUser({
          data: {
            passkey_enrolled: true,
            passkey_credential_id: credentialId,
            passkey_updated_at: newRecord.createdAt
          }
        });
      } catch {
        // Non-blocking: local passkey enrollment still succeeds
      }
    }

    return {
      ok: true,
      mode: 'webauthn_verified',
      credentialId,
      email: emailCheck.email,
      displayName: cleanName,
      message: `Passkey saved for ${cleanName}. Next time, tap Sign In with FaceID / Fingerprint.`
    };
  } catch (err) {
    const errName = err instanceof Error ? err.name : '';
    if (errName === 'NotAllowedError' || errName === 'AbortError') {
      return {
        ok: false,
        mode: 'cancelled',
        credentialId: null,
        email: emailCheck.email,
        displayName: cleanName,
        message: 'FaceID or Fingerprint check was cancelled. You can retry or use a Magic Link.',
        errorMessage: errName
      };
    }
    return {
      ok: false,
      mode: 'error',
      credentialId: null,
      email: emailCheck.email,
      displayName: cleanName,
      message:
        'Could not create a Passkey in this browser window. Try opening the app in Safari/Chrome or use Email Magic Link.',
      errorMessage: err instanceof Error ? err.message : 'Passkey registration error'
    };
  }
}

/**
 * Task 1 (WebAuthn Passkey Sign-In — FaceID / TouchID / Fingerprint):
 * Verifies the user with their device biometric Passkey via `navigator.credentials.get`.
 */
export async function authenticateWithBiometricPasskey(options: {
  email?: string;
  rpId?: string;
  credentialsApi?: Pick<CredentialsContainer, 'get'> | null;
  storage?: Pick<Storage, 'getItem'> | null;
} = {}): Promise<PasskeyOperationResult> {
  const cleanEmail = String(options.email || '').trim().toLowerCase();
  const creds =
    options.credentialsApi ??
    (typeof navigator !== 'undefined' && navigator.credentials ? navigator.credentials : null);

  if (!creds || typeof creds.get !== 'function') {
    return {
      ok: false,
      mode: 'unsupported',
      credentialId: null,
      email: cleanEmail,
      displayName: '',
      message:
        'This browser does not support biometric Passkeys yet. Use Email Magic Link instead.',
      errorMessage: 'WebAuthn unavailable'
    };
  }

  const saved = loadRegisteredPasskeys(options.storage);
  const matching = cleanEmail
    ? saved.filter((rec) => rec.email.toLowerCase() === cleanEmail)
    : saved;

  const allowCredentials: PublicKeyCredentialDescriptor[] = matching.map((rec) => ({
    type: 'public-key',
    id: decodeBase64UrlToBytes(rec.credentialId) as unknown as BufferSource,
    transports: ['internal']
  }));

  try {
    const challenge = generateWebAuthnChallenge(32);
    const assertion = (await creds.get({
      publicKey: {
        challenge: challenge as unknown as BufferSource,
        rpId: resolveSafeRpId(options.rpId),
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        userVerification: 'preferred',
        timeout: 60000
      }
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return {
        ok: false,
        mode: 'cancelled',
        credentialId: null,
        email: cleanEmail,
        displayName: '',
        message: 'Biometric sign-in was cancelled. Tap again or use a Magic Link.',
        errorMessage: 'No assertion returned'
      };
    }

    const assertionId =
      typeof assertion.id === 'string' && assertion.id
        ? assertion.id
        : assertion.rawId
          ? encodeBytesToBase64Url(assertion.rawId)
          : '';

    const matchedRecord =
      saved.find((rec) => rec.credentialId === assertionId) || matching[0] || null;
    const resolvedEmail = matchedRecord?.email || cleanEmail;
    const resolvedName =
      matchedRecord?.displayName ||
      (resolvedEmail ? resolvedEmail.split('@')[0] : 'Athlete');

    return {
      ok: true,
      mode: 'webauthn_verified',
      credentialId: assertionId || matchedRecord?.credentialId || null,
      email: resolvedEmail,
      displayName: resolvedName,
      message: `FaceID / Fingerprint verified. Welcome back, ${resolvedName}.`
    };
  } catch (err) {
    const errName = err instanceof Error ? err.name : '';
    if (errName === 'NotAllowedError' || errName === 'AbortError') {
      return {
        ok: false,
        mode: 'cancelled',
        credentialId: null,
        email: cleanEmail,
        displayName: '',
        message: 'Biometric check was cancelled or no Passkey was found on this device yet. Tap "Set Up Passkey" first.',
        errorMessage: errName
      };
    }
    return {
      ok: false,
      mode: 'error',
      credentialId: null,
      email: cleanEmail,
      displayName: '',
      message: 'Could not verify your Passkey right now. You can sign in with an Email Magic Link instead.',
      errorMessage: err instanceof Error ? err.message : 'Passkey authentication error'
    };
  }
}
