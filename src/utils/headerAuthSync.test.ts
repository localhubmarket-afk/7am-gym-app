import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractAvatarInitial,
  resolveHeaderAuthState,
  sanitizeAvatarUrl,
  subscribeGlobalHeaderAuthState,
  syncDomHeaderAuthButton,
  type HeaderAuthChangeEvent,
  type HeaderAuthState,
  type SupabaseAuthClientLike,
  type SupabaseSessionLike
} from './headerAuthSync';

test('resolveHeaderAuthState: active Supabase session overrides stale/empty local profile so header never shows Sign In', () => {
  const result = resolveHeaderAuthState({
    session: {
      access_token: 'jwt-token',
      user: {
        id: 'uuid-123',
        email: 'bergeretforestier.francois@gmail.com',
        user_metadata: {
          full_name: 'François Forestier',
          avatar_url: 'https://cdn.example.com/avatars/francois.png'
        }
      }
    },
    localProfile: null,
    isAuthLoading: false
  });

  assert.equal(result.isAuthenticated, true);
  assert.equal(result.displayName, 'François');
  assert.equal(result.avatarInitial, 'F');
  assert.equal(result.avatarUrl, 'https://cdn.example.com/avatars/francois.png');
  assert.equal(result.email, 'bergeretforestier.francois@gmail.com');
  assert.equal(result.authSource, 'supabase_session');
  assert.match(result.ariaLabel, /François/);
});

test('resolveHeaderAuthState: active Supabase session with missing metadata falls back to email name, never Sign In', () => {
  const result = resolveHeaderAuthState({
    session: {
      user: {
        id: 'uuid-456',
        email: 'maya.patel@example.com',
        user_metadata: {}
      }
    },
    localProfile: { name: '', email: '' }
  });

  assert.equal(result.isAuthenticated, true);
  assert.equal(result.displayName, 'Maya');
  assert.equal(result.avatarInitial, 'M');
  assert.equal(result.authSource, 'supabase_session');
});

test('resolveHeaderAuthState: hydrated local profile stays authenticated when Supabase session is offline/null', () => {
  const result = resolveHeaderAuthState({
    session: null,
    localProfile: {
      name: 'François',
      email: 'francois@7amgym.app',
      isGuest: false
    },
    isAuthLoading: false
  });

  assert.equal(result.isAuthenticated, true);
  assert.equal(result.displayName, 'François');
  assert.equal(result.avatarInitial, 'F');
  assert.equal(result.authSource, 'local_profile');
});

test('resolveHeaderAuthState: guest or empty state with no session resolves to Sign In when not loading', () => {
  const guestResult = resolveHeaderAuthState({
    session: null,
    localProfile: { name: 'Guest', email: 'guest@example.com', isGuest: true },
    isAuthLoading: false
  });
  assert.equal(guestResult.isAuthenticated, false);
  assert.equal(guestResult.displayName, 'Sign In');
  assert.equal(guestResult.authSource, 'signed_out');

  const loadingResult = resolveHeaderAuthState({
    session: null,
    localProfile: null,
    isAuthLoading: true
  });
  assert.equal(loadingResult.isAuthenticated, false);
  assert.equal(loadingResult.displayName, 'Profile');
});

test('sanitizeAvatarUrl rejects unsafe schemes and allows https and base64 images', () => {
  assert.equal(sanitizeAvatarUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeAvatarUrl('https://example.com/pic.jpg'), 'https://example.com/pic.jpg');
  assert.equal(
    sanitizeAvatarUrl('data:image/png;base64,iVBORw0KGgo='),
    'data:image/png;base64,iVBORw0KGgo='
  );
  assert.equal(extractAvatarInitial('François'), 'F');
  assert.equal(extractAvatarInitial('Sign In', 'alex@example.com'), 'A');
});

test('subscribeGlobalHeaderAuthState hydrates via getSession and listens to all onAuthStateChange events', async () => {
  let listener: ((event: HeaderAuthChangeEvent, session: SupabaseSessionLike | null) => void) | null = null;
  let unsubscribed = false;

  const initialSession: SupabaseSessionLike = {
    access_token: 'tok-1',
    user: {
      id: 'user-1',
      email: 'francois@7amgym.app',
      user_metadata: { full_name: 'François B.' }
    }
  };

  const mockSupabase: SupabaseAuthClientLike = {
    auth: {
      getSession: async () => ({ data: { session: initialSession }, error: null }),
      onAuthStateChange: (cb) => {
        listener = cb;
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                unsubscribed = true;
              }
            }
          }
        };
      }
    }
  };

  let localProfile: { name?: string; email?: string } | null = null;
  const emitted: Array<{ event: HeaderAuthChangeEvent; state: HeaderAuthState }> = [];

  const handle = subscribeGlobalHeaderAuthState({
    supabaseClient: mockSupabase,
    getLocalProfile: () => localProfile,
    onAuthStateChange: (authState, event) => {
      emitted.push({ event, state: authState });
    }
  });

  // Wait for getSession() microtask
  await new Promise((resolve) => setTimeout(resolve, 10));

  const hydrated = emitted.find((e) => e.event === 'SESSION_HYDRATED');
  assert.ok(hydrated, 'Expected SESSION_HYDRATED event from getSession()');
  assert.equal(hydrated.state.isAuthenticated, true);
  assert.equal(hydrated.state.displayName, 'François');

  assert.ok(listener, 'Expected onAuthStateChange callback to be registered');

  // TOKEN_REFRESHED / USER_UPDATED event updates display name & avatar immediately
  listener!('USER_UPDATED', {
    access_token: 'tok-2',
    user: {
      id: 'user-1',
      email: 'francois@7amgym.app',
      user_metadata: {
        full_name: 'Clara Vance',
        avatar_url: 'https://cdn.example.com/clara.jpg'
      }
    }
  });

  const latestAfterUpdate = emitted[emitted.length - 1];
  assert.equal(latestAfterUpdate.event, 'USER_UPDATED');
  assert.equal(latestAfterUpdate.state.isAuthenticated, true);
  assert.equal(latestAfterUpdate.state.displayName, 'Clara');
  assert.equal(latestAfterUpdate.state.avatarInitial, 'C');
  assert.equal(latestAfterUpdate.state.avatarUrl, 'https://cdn.example.com/clara.jpg');

  // SIGNED_OUT with cleared local profile transitions cleanly back to Sign In
  localProfile = null;
  listener!('SIGNED_OUT', null);

  const latestAfterSignOut = emitted[emitted.length - 1];
  assert.equal(latestAfterSignOut.event, 'SIGNED_OUT');
  assert.equal(latestAfterSignOut.state.isAuthenticated, false);
  assert.equal(latestAfterSignOut.state.displayName, 'Sign In');

  handle.unsubscribe();
  assert.equal(unsubscribed, true);
});

test('syncDomHeaderAuthButton updates label, avatar initial, aria-label, and reverts cleanly on sign-out', () => {
  const makeClassList = (initial: string[] = []) => {
    const set = new Set<string>(initial);
    return {
      add: (...cls: string[]) => cls.forEach((c) => set.add(c)),
      remove: (...cls: string[]) => cls.forEach((c) => set.delete(c)),
      contains: (c: string) => set.has(c)
    };
  };

  const attrs: Record<string, string> = {};
  const elements: Record<string, any> = {
    'open-smart-login-btn': {
      setAttribute: (k: string, v: string) => {
        attrs[k] = v;
      },
      getAttribute: (k: string) => attrs[k]
    },
    'header-login-label': { textContent: 'Sign In' },
    'header-user-avatar': {
      classList: makeClassList(['hidden']),
      textContent: '',
      innerHTML: '',
      querySelector: () => null,
      appendChild: () => {}
    },
    'header-user-icon-svg': { classList: makeClassList([]) },
    'close-smart-login-btn': { classList: makeClassList(['hidden']) }
  };

  const fakeDoc = {
    getElementById: (id: string) => elements[id] || null,
    createElement: () => ({ className: '', alt: '', src: '' })
  } as unknown as Document;

  const authed = resolveHeaderAuthState({
    session: {
      user: {
        id: 'u-1',
        email: 'francois@7amgym.app',
        user_metadata: { full_name: 'François' }
      }
    }
  });

  const ok = syncDomHeaderAuthButton(authed, fakeDoc);
  assert.equal(ok, true);
  assert.equal(elements['header-login-label'].textContent, 'François');
  assert.equal(elements['header-user-avatar'].textContent, 'F');
  assert.equal(elements['header-user-avatar'].classList.contains('hidden'), false);
  assert.equal(elements['header-user-icon-svg'].classList.contains('hidden'), true);
  assert.equal(elements['close-smart-login-btn'].classList.contains('hidden'), false);
  assert.equal(attrs['data-auth-status'], 'authenticated');

  const signedOut = resolveHeaderAuthState({ session: null, localProfile: null, isAuthLoading: false });
  syncDomHeaderAuthButton(signedOut, fakeDoc);
  assert.equal(elements['header-login-label'].textContent, 'Sign In');
  assert.equal(elements['header-user-avatar'].classList.contains('hidden'), true);
  assert.equal(elements['header-user-icon-svg'].classList.contains('hidden'), false);
  assert.equal(attrs['data-auth-status'], 'signed-out');
});

test('Zero Deletion Policy: index.html preserves all header buttons and binds race-free Supabase auth sync', () => {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Existing header buttons remain 100% present
  assert.match(html, /id="header-pwa-install-btn"/);
  assert.match(html, /id="open-gemini-ai-btn"/);
  assert.match(html, /id="open-watch-modal-btn"/);
  assert.match(html, /id="open-smart-login-btn"/);
  assert.match(html, /id="open-share-store-btn"/);
  assert.match(html, /id="header-timer-open"/);

  // New avatar badge + race-free Supabase listener hooks are wired
  assert.match(html, /id="header-user-avatar"/);
  assert.match(html, /function syncHeaderAuthButtonUI/);
  assert.match(html, /function bindGlobalSupabaseAuthHeaderListener/);
  assert.match(html, /addEventListener\('d3-onerm-bridge-ready',\s*bindGlobalSupabaseAuthHeaderListener\)/);
  assert.match(html, /subscribeGlobalHeaderAuthState/);
});
