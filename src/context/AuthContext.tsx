import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import {
  resolveHeaderAuthState,
  subscribeGlobalHeaderAuthState,
  type HeaderAuthChangeEvent,
  type HeaderAuthState,
  type HeaderAuthStatus,
  type LocalUserProfileLike,
  type SupabaseAuthClientLike,
  type SupabaseAuthUserLike,
  type SupabaseSessionLike
} from '../utils/headerAuthSync';

export interface AuthContextValue {
  session: SupabaseSessionLike | null;
  user: SupabaseAuthUserLike | null;
  headerAuth: HeaderAuthState;
  status: HeaderAuthStatus;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  lastAuthEvent: HeaderAuthChangeEvent | null;
  refreshSession: () => Promise<HeaderAuthState>;
  syncLocalProfile: (profile: LocalUserProfileLike | null) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  initialProfile?: LocalUserProfileLike | null;
  supabaseClient?: SupabaseAuthClientLike | null;
}

/**
 * Centralized AuthContext Provider synced directly with Supabase Auth
 * (`getSession()` + `onAuthStateChange`) and hydrated local profile state.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  initialProfile = null,
  supabaseClient
}) => {
  const [localProfile, setLocalProfile] = useState<LocalUserProfileLike | null>(initialProfile);
  const localProfileRef = useRef<LocalUserProfileLike | null>(initialProfile);

  const resolvedClient = useMemo<SupabaseAuthClientLike | null>(() => {
    if (supabaseClient !== undefined) return supabaseClient;
    return getSupabaseClient();
  }, [supabaseClient]);

  const [session, setSession] = useState<SupabaseSessionLike | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(Boolean(resolvedClient?.auth?.getSession));
  const [lastAuthEvent, setLastAuthEvent] = useState<HeaderAuthChangeEvent | null>(null);
  const refreshFnRef = useRef<(() => Promise<HeaderAuthState>) | null>(null);

  useEffect(() => {
    localProfileRef.current = initialProfile;
    setLocalProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    const handle = subscribeGlobalHeaderAuthState({
      supabaseClient: resolvedClient,
      getLocalProfile: () => localProfileRef.current,
      onAuthStateChange: (nextAuthState, event, nextSession) => {
        setSession(nextSession);
        setIsAuthLoading(nextAuthState.isAuthLoading);
        setLastAuthEvent(event);
      }
    });

    refreshFnRef.current = handle.refreshSession;

    return () => {
      refreshFnRef.current = null;
      handle.unsubscribe();
    };
  }, [resolvedClient]);

  const syncLocalProfile = useCallback((profile: LocalUserProfileLike | null) => {
    localProfileRef.current = profile;
    setLocalProfile(profile);
  }, []);

  const refreshSession = useCallback(async (): Promise<HeaderAuthState> => {
    if (refreshFnRef.current) {
      return refreshFnRef.current();
    }
    return resolveHeaderAuthState({
      session,
      localProfile: localProfileRef.current,
      isAuthLoading: false
    });
  }, [session]);

  const headerAuth = useMemo<HeaderAuthState>(
    () =>
      resolveHeaderAuthState({
        session,
        localProfile,
        isAuthLoading
      }),
    [session, localProfile, isAuthLoading]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      headerAuth,
      status: headerAuth.status,
      isAuthenticated: headerAuth.isAuthenticated,
      isAuthLoading: headerAuth.isAuthLoading,
      lastAuthEvent,
      refreshSession,
      syncLocalProfile
    }),
    [session, headerAuth, lastAuthEvent, refreshSession, syncLocalProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>.');
  }
  return ctx;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
