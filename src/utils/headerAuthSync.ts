import { resolveDisplayUsername } from './wizardValidation';

export interface SupabaseAuthUserLike {
  id?: string | null;
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
    given_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    picture?: string | null;
    [key: string]: unknown;
  } | null;
  app_metadata?: {
    provider?: string | null;
    [key: string]: unknown;
  } | null;
}

export interface SupabaseSessionLike {
  access_token?: string | null;
  user?: SupabaseAuthUserLike | null;
}

export interface LocalUserProfileLike {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  authProvider?: string | null;
  supabaseUserId?: string | null;
  isGuest?: boolean | null;
  signedInAt?: string | null;
}

export type HeaderAuthChangeEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'SIGNED_OUT'
  | 'SESSION_HYDRATED'
  | 'LOCAL_PROFILE_SYNC'
  | string;

export interface HeaderAuthState {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  displayName: string;
  avatarInitial: string;
  avatarUrl: string | null;
  email: string | null;
  userId: string | null;
  authSource: 'supabase_session' | 'local_profile' | 'signed_out';
  ariaLabel: string;
}

export interface SupabaseAuthClientLike {
  auth?: {
    getSession?: () => Promise<{
      data?: { session?: SupabaseSessionLike | null } | null;
      error?: unknown;
    }>;
    onAuthStateChange?: (
      callback: (event: HeaderAuthChangeEvent, session: SupabaseSessionLike | null) => void
    ) => {
      data?: {
        subscription?: {
          unsubscribe?: () => void;
        } | null;
      } | null;
    };
  } | null;
}

export interface HeaderAuthSubscriptionHandle {
  unsubscribe: () => void;
  refreshSession: () => Promise<HeaderAuthState>;
}

const GENERIC_PLACEHOLDER_NAMES = new Set([
  '',
  'sign in',
  'profile',
  'google',
  'apple',
  'google athlete',
  'apple athlete',
  'google user',
  'apple user',
  'guest',
  'anonymous'
]);

export function sanitizeAvatarUrl(rawUrl: unknown): string | null {
  const value = String(rawUrl || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(value)) {
    return value;
  }
  return null;
}

export function extractAvatarInitial(displayName: string, email?: string | null): string {
  const cleanedName = String(displayName || '').trim();
  if (cleanedName && !GENERIC_PLACEHOLDER_NAMES.has(cleanedName.toLowerCase())) {
    const firstChar = Array.from(cleanedName).find((ch) => /[a-zA-Z0-9\u00C0-\u024F]/.test(ch));
    if (firstChar) return firstChar.toUpperCase();
  }
  const cleanedEmail = String(email || '').trim();
  if (cleanedEmail) {
    const firstChar = Array.from(cleanedEmail).find((ch) => /[a-zA-Z0-9]/.test(ch));
    if (firstChar) return firstChar.toUpperCase();
  }
  return 'U';
}

export interface ResolveHeaderAuthOptions {
  session?: SupabaseSessionLike | null;
  localProfile?: LocalUserProfileLike | null;
  isAuthLoading?: boolean;
}

/**
 * Single source of truth for top header authentication display state.
 * Prevents the header from falling back to "Sign In" whenever a valid Supabase
 * session OR hydrated non-guest user profile is already active.
 */
export function resolveHeaderAuthState(options: ResolveHeaderAuthOptions = {}): HeaderAuthState {
  const sessionUser = options.session?.user ?? null;
  const localProfile = options.localProfile ?? null;
  const isAuthLoading = Boolean(options.isAuthLoading);

  const meta = sessionUser?.user_metadata ?? null;
  const sessionEmail = String(sessionUser?.email || '').trim().toLowerCase();
  const sessionId = String(sessionUser?.id || '').trim();
  const sessionMetaName = String(
    meta?.full_name || meta?.name || meta?.given_name || meta?.display_name || ''
  ).trim();
  const sessionAvatarUrl = sanitizeAvatarUrl(meta?.avatar_url || meta?.picture);
  const sessionProvider = String(sessionUser?.app_metadata?.provider || '').trim() || null;

  const isLocalGuest = Boolean(localProfile?.isGuest);
  const localEmail = isLocalGuest ? '' : String(localProfile?.email || '').trim().toLowerCase();
  const localName = isLocalGuest ? '' : String(localProfile?.name || '').trim();
  const localUserId = isLocalGuest ? '' : String(localProfile?.supabaseUserId || '').trim();
  const localAvatarUrl = isLocalGuest ? null : sanitizeAvatarUrl(localProfile?.avatarUrl);
  const localProvider = isLocalGuest ? null : String(localProfile?.authProvider || '').trim() || null;

  const hasLiveSupabaseSession = Boolean(sessionUser && (sessionId || sessionEmail));
  const hasRealLocalName = Boolean(
    localName && !GENERIC_PLACEHOLDER_NAMES.has(localName.toLowerCase())
  );
  const hasHydratedLocalProfile = Boolean(
    !isLocalGuest && (localEmail || localUserId || hasRealLocalName)
  );

  const isAuthenticated = hasLiveSupabaseSession || hasHydratedLocalProfile;
  const mergedEmail = sessionEmail || localEmail || null;
  const mergedUserId = sessionId || localUserId || null;
  const mergedName =
    (sessionMetaName && !GENERIC_PLACEHOLDER_NAMES.has(sessionMetaName.toLowerCase())
      ? sessionMetaName
      : '') ||
    (hasRealLocalName ? localName : '') ||
    sessionMetaName ||
    localName;
  const mergedAvatarUrl = sessionAvatarUrl || localAvatarUrl || null;
  const mergedProvider = sessionProvider || localProvider;

  if (!isAuthenticated) {
    return {
      isAuthenticated: false,
      isAuthLoading,
      displayName: isAuthLoading ? 'Profile' : 'Sign In',
      avatarInitial: 'U',
      avatarUrl: null,
      email: null,
      userId: null,
      authSource: 'signed_out',
      ariaLabel: isAuthLoading ? 'Checking account status' : 'Sign in to your account'
    };
  }

  let resolvedName = resolveDisplayUsername({
    name: mergedName,
    email: mergedEmail,
    authProvider: mergedProvider
  });

  if (!resolvedName || resolvedName === 'Sign In') {
    resolvedName = mergedEmail ? 'Member' : 'Account';
  }

  const avatarInitial = extractAvatarInitial(resolvedName, mergedEmail);
  const authSource: HeaderAuthState['authSource'] = hasLiveSupabaseSession
    ? 'supabase_session'
    : 'local_profile';

  return {
    isAuthenticated: true,
    isAuthLoading: false,
    displayName: resolvedName,
    avatarInitial,
    avatarUrl: mergedAvatarUrl,
    email: mergedEmail,
    userId: mergedUserId,
    authSource,
    ariaLabel: mergedEmail
      ? `Open account profile for ${resolvedName} (${mergedEmail})`
      : `Open account profile for ${resolvedName}`
  };
}

export interface SubscribeGlobalHeaderAuthOptions {
  supabaseClient: SupabaseAuthClientLike | null | undefined;
  getLocalProfile?: () => LocalUserProfileLike | null | undefined;
  onAuthStateChange: (
    authState: HeaderAuthState,
    event: HeaderAuthChangeEvent,
    session: SupabaseSessionLike | null
  ) => void;
}

/**
 * Hydrates the active Supabase session immediately via `getSession()` AND
 * listens to all `onAuthStateChange` lifecycle events (INITIAL_SESSION, SIGNED_IN,
 * TOKEN_REFRESHED, USER_UPDATED, SIGNED_OUT) so the header never gets stuck on "Sign In".
 */
export function subscribeGlobalHeaderAuthState(
  options: SubscribeGlobalHeaderAuthOptions
): HeaderAuthSubscriptionHandle {
  const { supabaseClient, getLocalProfile, onAuthStateChange } = options;
  let disposed = false;
  let latestSession: SupabaseSessionLike | null = null;
  let hasResolvedInitialSession = !supabaseClient?.auth?.getSession;

  const readLocalProfile = (): LocalUserProfileLike | null => {
    try {
      return getLocalProfile ? getLocalProfile() ?? null : null;
    } catch {
      return null;
    }
  };

  const emitState = (event: HeaderAuthChangeEvent, session: SupabaseSessionLike | null): HeaderAuthState => {
    latestSession = session;
    const resolved = resolveHeaderAuthState({
      session,
      localProfile: readLocalProfile(),
      isAuthLoading: !hasResolvedInitialSession
    });
    if (!disposed) {
      onAuthStateChange(resolved, event, session);
    }
    return resolved;
  };

  // Emit immediately using any hydrated local profile without flashing "Sign In" while loading
  emitState('LOCAL_PROFILE_SYNC', latestSession);

  let subscriptionUnsubscribe: (() => void) | null = null;

  if (supabaseClient?.auth && typeof supabaseClient.auth.onAuthStateChange === 'function') {
    const subResult = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (disposed) return;
      hasResolvedInitialSession = true;
      const nextSession = event === 'SIGNED_OUT' ? null : (session ?? null);
      emitState(event, nextSession);
    });
    const unsub = subResult?.data?.subscription?.unsubscribe;
    if (typeof unsub === 'function') {
      subscriptionUnsubscribe = () => unsub.call(subResult?.data?.subscription);
    }
  }

  const refreshSession = async (): Promise<HeaderAuthState> => {
    if (!supabaseClient?.auth || typeof supabaseClient.auth.getSession !== 'function') {
      hasResolvedInitialSession = true;
      return emitState('LOCAL_PROFILE_SYNC', null);
    }
    try {
      const result = await supabaseClient.auth.getSession();
      hasResolvedInitialSession = true;
      const activeSession = result?.data?.session ?? null;
      return emitState('SESSION_HYDRATED', activeSession);
    } catch {
      hasResolvedInitialSession = true;
      return emitState('LOCAL_PROFILE_SYNC', latestSession);
    }
  };

  // Immediately hydrate any already-active session from Supabase Auth storage
  if (supabaseClient?.auth && typeof supabaseClient.auth.getSession === 'function') {
    void refreshSession();
  }

  return {
    unsubscribe: () => {
      disposed = true;
      if (subscriptionUnsubscribe) {
        subscriptionUnsubscribe();
        subscriptionUnsubscribe = null;
      }
    },
    refreshSession
  };
}

/**
 * Updates the live DOM header button (`#open-smart-login-btn`) in place without
 * deleting or hiding any existing header controls.
 */
export function syncDomHeaderAuthButton(
  authState: HeaderAuthState,
  doc: Document | null = typeof document !== 'undefined' ? document : null
): boolean {
  if (!doc) return false;

  const btnEl = doc.getElementById('open-smart-login-btn');
  const labelEl = doc.getElementById('header-login-label');
  const avatarEl = doc.getElementById('header-user-avatar');
  const iconEl = doc.getElementById('header-user-icon-svg');
  const closeLoginBtnEl = doc.getElementById('close-smart-login-btn');

  if (labelEl) {
    labelEl.textContent = authState.displayName;
  }

  if (btnEl) {
    btnEl.setAttribute('data-auth-status', authState.isAuthenticated ? 'authenticated' : 'signed-out');
    btnEl.setAttribute('aria-label', authState.ariaLabel);
    btnEl.setAttribute(
      'title',
      authState.isAuthenticated
        ? `${authState.displayName} • Account & Profile`
        : 'Sign In & User Profile'
    );
  }

  if (avatarEl) {
    if (authState.isAuthenticated) {
      avatarEl.classList.remove('hidden');
      avatarEl.classList.add('inline-flex');
      if (authState.avatarUrl) {
        avatarEl.textContent = '';
        let img = avatarEl.querySelector('img');
        if (!img) {
          img = doc.createElement('img');
          img.className = 'w-full h-full rounded-full object-cover';
          img.alt = '';
          avatarEl.appendChild(img);
        }
        img.src = authState.avatarUrl;
      } else {
        avatarEl.innerHTML = '';
        avatarEl.textContent = authState.avatarInitial;
      }
    } else {
      avatarEl.classList.add('hidden');
      avatarEl.classList.remove('inline-flex');
      avatarEl.textContent = '';
    }
  }

  if (iconEl) {
    if (authState.isAuthenticated && avatarEl) {
      iconEl.classList.add('hidden');
    } else {
      iconEl.classList.remove('hidden');
    }
  }

  if (closeLoginBtnEl) {
    if (authState.isAuthenticated) {
      closeLoginBtnEl.classList.remove('hidden');
    } else {
      closeLoginBtnEl.classList.add('hidden');
    }
  }

  return Boolean(btnEl || labelEl);
}
