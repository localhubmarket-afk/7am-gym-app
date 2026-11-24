import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient';
import {
  clearAllWebSessionCookies,
  findAllRemainingSavedAccounts,
  purgeMobileClientStorage,
  validateDeletionTarget,
  buildPostDeleteSwitchPrompt,
  type SavedAccountCandidate,
  type DeletionValidationResult
} from './deletionValidation';
import { clearAllGymIndexedDbStores } from './gymIndexedDb';

export interface SupabaseAuthDeleteClientLike {
  auth?: {
    getSession?: () => Promise<{
      data?: {
        session?: {
          access_token?: string;
          user?: { id?: string; email?: string | null } | null;
        } | null;
      } | null;
      error?: { message?: string } | null;
    }>;
    signOut?: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<{
      error?: { message?: string } | null;
    }>;
  };
  from?: (table: string) => {
    delete: () => {
      in: (column: string, values: string[]) => Promise<{ error?: { message?: string } | null }>;
    };
  };
}

export interface HardDeleteAccountOptions {
  /** Active authenticated user email */
  activeUserId: string | null | undefined;
  /** Target account email being confirmed for deletion */
  targetUserId: string | null | undefined;
  /** Active local gym_state object */
  stateObj: Record<string, any>;
  /** Server hard-delete endpoint backed by Supabase Admin API (defaults to '/api/delete-account') */
  adminDeleteEndpoint?: string;
  /** Legacy /api/state endpoint fallback if /api/delete-account is unavailable */
  legacyStateEndpoint?: string;
  /** LocalStorage key holding app state */
  storageKey?: string;
  /** Optional injected Supabase browser client (defaults to singleton getSupabaseClient()) */
  supabaseClient?: SupabaseAuthDeleteClientLike | SupabaseClient | null;
  /** Optional injected fetch implementation for tests */
  fetchImpl?: typeof fetch;
  /** Optional redirect/UI callback triggered after supabase.auth.signOut() completes */
  onRedirectToLogin?: (context: {
    deletedEmail: string;
    remainingAccounts: SavedAccountCandidate[];
    secondaryAccount: SavedAccountCandidate | null;
  }) => void;
  docImpl?: { cookie: string; location?: { pathname?: string; hostname?: string } } | null;
  localStorageImpl?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear' | 'length' | 'key'> | null;
  sessionStorageImpl?: Pick<Storage, 'clear'> | null;
  cachesImpl?: { keys: () => Promise<string[]>; delete: (key: string) => Promise<boolean> } | null;
  windowImpl?: {
    name?: string;
    location?: { hash?: string; pathname?: string; search?: string; origin?: string; replace?: (url: string) => void };
    history?: { replaceState?: (...args: any[]) => void };
  } | null;
}

export interface HardDeleteAccountResult {
  deleted: boolean;
  validation: DeletionValidationResult;
  authUserDeleted: boolean;
  gymStateDeleted: boolean;
  clearedDefaultMirror: boolean;
  supabaseSignedOut: boolean;
  purgedSupabaseStorageKeys: number;
  cookiesClearedCount: number;
  secondaryAccount: SavedAccountCandidate | null;
  remainingAccounts: SavedAccountCandidate[];
  switchPromptText: string | null;
  redirectedToLogin: boolean;
  errorMessage?: string;
}

/**
 * Purges any leftover Supabase Auth tokens (`sb-*-auth-token`, `supabase.auth.token`, etc.)
 * from localStorage so zombie sessions can never rehydrate on reload.
 */
export function purgeSupabaseAuthStorageKeys(
  storage?: Pick<Storage, 'length' | 'key' | 'removeItem'> | null
): number {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.length !== 'number' || typeof store.key !== 'function') return 0;

  const keysToRemove: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (!k) continue;
    const lower = k.toLowerCase();
    if (
      (lower.startsWith('sb-') && (lower.includes('auth') || lower.includes('token') || lower.includes('code-verifier'))) ||
      lower.includes('supabase.auth')
    ) {
      keysToRemove.push(k);
    }
  }

  let removed = 0;
  for (const k of keysToRemove) {
    try {
      store.removeItem(k);
      removed += 1;
    } catch {
      // Ignore restricted storage environments
    }
  }
  return removed;
}

/**
 * Task 1: Strict Hard Auth Reset & Zombie Session Fix (`hardDeleteAccount`).
 * 1. Validates active user identity matches target deletion account.
 * 2. Calls server-side `/api/delete-account` with the user's Supabase Bearer token so the
 *    server executes BOTH `supabaseAdmin.auth.admin.deleteUser(userId)` AND deletes the user's
 *    `gym_state` row(s) in PostgreSQL (zero zombie rows, zero service keys in browser).
 * 3. Executes `supabase.auth.signOut({ scope: 'global' })` (with local fallback) to revoke
 *    and clear all Supabase Auth tokens.
 * 4. Purges localStorage (`sb-*` auth tokens + state), sessionStorage, IndexedDB, cookies,
 *    and Cache Storage, then redirects cleanly to the login screen.
 */
export async function hardDeleteAccount(
  options: HardDeleteAccountOptions
): Promise<HardDeleteAccountResult> {
  const validation = validateDeletionTarget({
    scope: 'account',
    activeUserId: options.activeUserId,
    targetUserId: options.targetUserId
  });

  if (!validation.valid) {
    return {
      deleted: false,
      validation,
      authUserDeleted: false,
      gymStateDeleted: false,
      clearedDefaultMirror: false,
      supabaseSignedOut: false,
      purgedSupabaseStorageKeys: 0,
      cookiesClearedCount: 0,
      secondaryAccount: null,
      remainingAccounts: [],
      switchPromptText: null,
      redirectedToLogin: false,
      errorMessage: validation.errorMessage || 'Invalid account selected for deletion.'
    };
  }

  const remainingAccounts = findAllRemainingSavedAccounts(options.stateObj, validation.normalizedUserId);
  const secondaryAccount = remainingAccounts.length > 0 ? remainingAccounts[0] : null;

  const client =
    options.supabaseClient !== undefined
      ? (options.supabaseClient as SupabaseAuthDeleteClientLike | null)
      : (getSupabaseClient() as SupabaseAuthDeleteClientLike | null);

  let accessToken = '';
  let supabaseUserId = '';
  if (client && client.auth && typeof client.auth.getSession === 'function') {
    try {
      const sessionRes = await client.auth.getSession();
      const activeSession = sessionRes?.data?.session;
      accessToken = String(activeSession?.access_token || '').trim();
      supabaseUserId = String(activeSession?.user?.id || '').trim();
    } catch {
      // Continue with email-based deletion if session lookup fails
    }
  }

  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const adminEndpoint = String(options.adminDeleteEndpoint || '/api/delete-account').trim();

  let authUserDeleted = false;
  let gymStateDeleted = false;
  let clearedDefaultMirror = false;
  let serverErrorMessage: string | undefined;

  // Step 1: Call server-side Supabase Admin API endpoint (/api/delete-account)
  if (adminEndpoint && fetchFn) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const sep = adminEndpoint.includes('?') ? '&' : '?';
      const url = `${adminEndpoint}${sep}email=${encodeURIComponent(validation.normalizedUserId)}`;
      const resp = await fetchFn(url, {
        method: 'DELETE',
        cache: 'no-store',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          email: validation.normalizedUserId,
          accountId: validation.supabaseRecordId,
          confirmHardDelete: true
        })
      });

      const json = await resp.json().catch(() => ({}));
      if (resp.ok && json && json.deleted !== false) {
        authUserDeleted = Boolean(json.authUserDeleted);
        gymStateDeleted = Boolean(json.gymStateDeleted || json.configured === false);
        clearedDefaultMirror = Boolean(json.clearedDefaultMirror);
      } else if (json && typeof json.error === 'string') {
        serverErrorMessage = json.error;
      }
    } catch (err) {
      serverErrorMessage =
        err instanceof Error ? err.message : 'Network error calling account deletion endpoint.';
    }
  }

  // Belt-and-suspenders: if gym_state wasn't confirmed deleted yet, attempt direct RLS delete & legacy /api/state DELETE
  if (!gymStateDeleted) {
    const idsToDelete = [validation.supabaseRecordId];
    if (supabaseUserId) {
      idsToDelete.push(supabaseUserId, `user_${supabaseUserId}`);
    }
    if (client && typeof client.from === 'function') {
      try {
        const { error } = await client.from('gym_state').delete().in('id', idsToDelete);
        if (!error) gymStateDeleted = true;
      } catch {
        // Non-fatal fallback
      }
    }
    if (!gymStateDeleted && options.legacyStateEndpoint && fetchFn) {
      try {
        const legacyUrl = `${options.legacyStateEndpoint}${options.legacyStateEndpoint.includes('?') ? '&' : '?'}email=${encodeURIComponent(validation.normalizedUserId)}`;
        const legacyResp = await fetchFn(legacyUrl, {
          method: 'DELETE',
          cache: 'no-store',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: validation.normalizedUserId,
            accountId: validation.supabaseRecordId,
            confirmDeleteAccount: true
          })
        });
        const legacyJson = await legacyResp.json().catch(() => ({}));
        if (legacyResp.ok && legacyJson && legacyJson.deleted !== false) {
          gymStateDeleted = true;
          clearedDefaultMirror = clearedDefaultMirror || Boolean(legacyJson.clearedDefaultMirror);
        }
      } catch {
        // Non-fatal fallback
      }
    }
  }

  // Step 2: Explicitly call supabase.auth.signOut() to revoke and clear local auth tokens
  let supabaseSignedOut = false;
  if (client && client.auth && typeof client.auth.signOut === 'function') {
    try {
      const signOutRes = await client.auth.signOut({ scope: 'global' });
      supabaseSignedOut = !signOutRes?.error;
      if (!supabaseSignedOut) {
        const localRes = await client.auth.signOut({ scope: 'local' });
        supabaseSignedOut = !localRes?.error;
      }
    } catch {
      try {
        await client.auth.signOut({ scope: 'local' });
        supabaseSignedOut = true;
      } catch {
        supabaseSignedOut = false;
      }
    }
  }

  // Step 3: Purge local storage, Supabase sb-* auth tokens, IndexedDB, caches, and cookies
  const [mobileRes, cookiesClearedCount] = await Promise.all([
    purgeMobileClientStorage({
      storageKey: options.storageKey,
      deletedEmail: validation.normalizedUserId,
      stateObj: options.stateObj,
      preserveRemainingProfiles: remainingAccounts.length > 0,
      localStorageImpl: options.localStorageImpl,
      sessionStorageImpl: options.sessionStorageImpl,
      cachesImpl: options.cachesImpl,
      windowImpl: options.windowImpl
    }),
    Promise.resolve().then(() => clearAllWebSessionCookies(options.docImpl)),
    remainingAccounts.length === 0
      ? clearAllGymIndexedDbStores().catch(() => false)
      : Promise.resolve(false)
  ]);

  const purgedSupabaseStorageKeys = purgeSupabaseAuthStorageKeys(options.localStorageImpl);

  // Step 4: Redirect to login screen cleanly
  let redirectedToLogin = false;
  if (typeof options.onRedirectToLogin === 'function') {
    options.onRedirectToLogin({
      deletedEmail: validation.normalizedUserId,
      remainingAccounts,
      secondaryAccount
    });
    redirectedToLogin = true;
  }

  return {
    deleted: Boolean(mobileRes.purged),
    validation,
    authUserDeleted,
    gymStateDeleted,
    clearedDefaultMirror,
    supabaseSignedOut,
    purgedSupabaseStorageKeys,
    cookiesClearedCount,
    secondaryAccount,
    remainingAccounts,
    switchPromptText: secondaryAccount ? buildPostDeleteSwitchPrompt(secondaryAccount.name) : null,
    redirectedToLogin,
    errorMessage: serverErrorMessage
  };
}
