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
import {
  buildNonAuthNoteInputProps,
  guardNonAuthNoteFocusEvent,
  shouldPromptForLogin
} from './authSessionGuard';

test('Task 1 & Task 2: active Supabase session overrides stale/empty local profile and formats 👤 Name', () => {
  const result = resolveHeaderAuthState({
    session: {
      access_token: 'jwt-token',
      user: {
        id: 'uuid-123',
        email: 'bergeretforestier.francois@gmail.com',
        user_metadata: {
          name: 'François Forestier',
          avatar_url: 'https://cdn.example.com/avatars/francois.png'
        }
      }
    },
    localProfile: null,
    isAuthLoading: false
  });

  assert.equal(result.status, 'authenticated');
  assert.equal(result.isAuthenticated, true);
  assert.equal(result.isAuthLoading, false);
  assert.equal(result.displayName, 'François');
  assert.equal(result.buttonDisplayLabel, '👤 François');
  assert.equal(result.avatarInitial, 'F');
  assert.equal(result.avatarUrl, 'https://cdn.example.com/avatars/francois.png');
  assert.equal(result.email, 'bergeretforestier.francois@gmail.com');
  assert.equal(result.authSource, 'supabase_session');
  assert.match(result.ariaLabel, /Logged in as François/);
});

test('Task 2: resolves name from gym_state.userProfile.name when user_metadata.name is empty', () => {
  const result = resolveHeaderAuthState({
    session: {
      user: {
        id: 'uuid-456',
        email: 'francois@7amgym.app',
        user_metadata: {}
      }
    },
    localProfile: { name: 'François', email: 'francois@7amgym.app' }
  });

  assert.equal(result.status, 'authenticated');
  assert.equal(result.displayName, 'François');
  assert.equal(result.buttonDisplayLabel, '👤 François');
});

test('Task 2: hydrated local profile stays authenticated when Supabase session is offline/null', () => {
  const result = resolveHeaderAuthState({
    session: null,
    localProfile: {
      name: 'François',
      email: 'francois@7amgym.app',
      isGuest: false
    },
    isAuthLoading: false
  });

  assert.equal(result.status, 'authenticated');
  assert.equal(result.isAuthenticated, true);
  assert.equal(result.displayName, 'François');
  assert.equal(result.buttonDisplayLabel, '👤 François');
  assert.equal(result.authSource, 'local_profile');
});

test('Task 1: renders neutral loading state while isAuthLoading is true and only shows Sign In when confirmed logged out', () => {
  const loadingResult = resolveHeaderAuthState({
    session: null,
    localProfile: null,
    isAuthLoading: true
  });
  assert.equal(loadingResult.status, 'loading');
  assert.equal(loadingResult.isAuthLoading, true);
  assert.equal(loadingResult.isAuthenticated, false);
  assert.equal(loadingResult.displayName, 'Checking...');
  assert.notEqual(loadingResult.displayName, 'Sign In');

  const guestResult = resolveHeaderAuthState({
    session: null,
    localProfile: { name: 'Guest', email: 'guest@example.com', isGuest: true },
    isAuthLoading: false
  });
  assert.equal(guestResult.status, 'signed-out');
  assert.equal(guestResult.isAuthLoading, false);
  assert.equal(guestResult.isAuthenticated, false);
  assert.equal(guestResult.displayName, 'Sign In');
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

test('Task 1: subscribeGlobalHeaderAuthState emits loading first before getSession resolves, then authenticates without Sign In flash', async () => {
  let listener: ((event: HeaderAuthChangeEvent, session: SupabaseSessionLike | null) => void) | null = null;
  let unsubscribed = false;
  let resolveGetSession!: (v: { data: { session: SupabaseSessionLike | null }; error: null }) => void;

  const mockSupabase: SupabaseAuthClientLike = {
    auth: {
      getSession: () =>
        new Promise((resolve) => {
          resolveGetSession = resolve;
        }),
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

  // Before async getSession resolves, state MUST be neutral loading — NEVER "Sign In"
  assert.equal(emitted[0].state.status, 'loading');
  assert.equal(emitted[0].state.isAuthLoading, true);
  assert.equal(emitted[0].state.displayName, 'Checking...');

  // Resolve getSession with active user
  resolveGetSession({
    data: {
      session: {
        access_token: 'tok-1',
        user: {
          id: 'user-1',
          email: 'francois@7amgym.app',
          user_metadata: { name: 'François B.' }
        }
      }
    },
    error: null
  });
  await new Promise((resolve) => setTimeout(resolve, 10));

  const hydrated = emitted.find((e) => e.event === 'SESSION_HYDRATED');
  assert.ok(hydrated, 'Expected SESSION_HYDRATED event from getSession()');
  assert.equal(hydrated.state.status, 'authenticated');
  assert.equal(hydrated.state.buttonDisplayLabel, '👤 François');

  assert.ok(listener, 'Expected onAuthStateChange callback to be registered');

  // SIGNED_OUT with cleared local profile transitions cleanly to Sign In
  localProfile = null;
  listener!('SIGNED_OUT', null);

  const latestAfterSignOut = emitted[emitted.length - 1];
  assert.equal(latestAfterSignOut.event, 'SIGNED_OUT');
  assert.equal(latestAfterSignOut.state.status, 'signed-out');
  assert.equal(latestAfterSignOut.state.isAuthLoading, false);
  assert.equal(latestAfterSignOut.state.displayName, 'Sign In');

  handle.unsubscribe();
  assert.equal(unsubscribed, true);
});

test('Task 1 & Task 2: syncDomHeaderAuthButton drives loading spinner, 👤 Name authenticated state, and Sign In state', () => {
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
    'header-login-label': { textContent: 'Checking...' },
    'header-auth-loading-spinner': { classList: makeClassList(['hidden']) },
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

  // 1. Loading state
  const loading = resolveHeaderAuthState({ session: null, localProfile: null, isAuthLoading: true });
  syncDomHeaderAuthButton(loading, fakeDoc);
  assert.equal(elements['header-login-label'].textContent, 'Checking...');
  assert.equal(elements['header-auth-loading-spinner'].classList.contains('hidden'), false);
  assert.equal(elements['header-user-icon-svg'].classList.contains('hidden'), true);
  assert.equal(attrs['data-auth-status'], 'loading');
  assert.equal(attrs['aria-busy'], 'true');

  // 2. Authenticated state -> 👤 François
  const authed = resolveHeaderAuthState({
    session: {
      user: {
        id: 'u-1',
        email: 'francois@7amgym.app',
        user_metadata: { name: 'François' }
      }
    }
  });
  syncDomHeaderAuthButton(authed, fakeDoc);
  assert.equal(elements['header-login-label'].textContent, 'François');
  assert.equal(elements['header-user-avatar'].textContent, '👤');
  assert.equal(elements['header-user-avatar'].classList.contains('hidden'), false);
  assert.equal(elements['header-auth-loading-spinner'].classList.contains('hidden'), true);
  assert.equal(elements['header-user-icon-svg'].classList.contains('hidden'), true);
  assert.equal(attrs['data-auth-status'], 'authenticated');
  assert.equal(attrs['aria-busy'], 'false');

  // 3. Confirmed signed-out state -> Sign In
  const signedOut = resolveHeaderAuthState({ session: null, localProfile: null, isAuthLoading: false });
  syncDomHeaderAuthButton(signedOut, fakeDoc);
  assert.equal(elements['header-login-label'].textContent, 'Sign In');
  assert.equal(elements['header-user-avatar'].classList.contains('hidden'), true);
  assert.equal(elements['header-auth-loading-spinner'].classList.contains('hidden'), true);
  assert.equal(elements['header-user-icon-svg'].classList.contains('hidden'), false);
  assert.equal(attrs['data-auth-status'], 'signed-out');
});

test('Task 3: buildNonAuthNoteInputProps and guardNonAuthNoteFocusEvent prevent password manager popups and login prompts', () => {
  const props = buildNonAuthNoteInputProps('machine_pin_note_bench');
  assert.equal(props.autoComplete, 'off');
  assert.equal(props['data-lpignore'], 'true');
  assert.equal(props['data-1p-ignore'], 'true');
  assert.equal(props['data-bwignore'], 'true');
  assert.equal(props['data-form-type'], 'other');
  assert.equal(props['data-non-auth-input'], 'true');
  assert.ok(!/pin|pass|user|email|login/i.test(props.name), `Expected safe non-auth name, got: ${props.name}`);

  const decision = guardNonAuthNoteFocusEvent(null, null);
  assert.equal(decision.shouldPromptLogin, false);
  assert.equal(shouldPromptForLogin({ action: 'note_change' }).shouldPromptLogin, false);
  assert.equal(shouldPromptForLogin({ action: 'set_log' }).shouldPromptLogin, false);
});

test('Zero Deletion Policy & Task 1-3 wiring in index.html', () => {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Existing header buttons remain 100% present
  assert.match(html, /id="header-pwa-install-btn"/);
  assert.match(html, /id="open-gemini-ai-btn"/);
  assert.match(html, /id="open-watch-modal-btn"/);
  assert.match(html, /id="open-smart-login-btn"/);
  assert.match(html, /id="open-share-store-btn"/);
  assert.match(html, /id="header-timer-open"/);

  // Loading spinner + 👤 avatar + race-free Supabase listener + focusin note guard present
  assert.match(html, /id="header-auth-loading-spinner"/);
  assert.match(html, /id="header-user-avatar"/);
  assert.match(html, /function syncHeaderAuthButtonUI/);
  assert.match(html, /function bindGlobalSupabaseAuthHeaderListener/);
  assert.match(html, /addEventListener\('d3-onerm-bridge-ready',\s*bindGlobalSupabaseAuthHeaderListener\)/);
  assert.match(html, /guardNonAuthNoteFocusEvent/);
  assert.match(html, /allowFirstSetLoginPrompt/);

  // Prep note textareas hardened with autocomplete="off"
  const prepNoteTags = html.match(/<textarea[^>]*data-prep-note-input="[^"]*"[^>]*>/g) || [];
  assert.ok(prepNoteTags.length >= 2, 'Expected both prep note textareas in index.html');
  prepNoteTags.forEach((tag) => {
    assert.match(tag, /autocomplete="off"/);
    assert.match(tag, /data-lpignore="true"/);
  });
});
