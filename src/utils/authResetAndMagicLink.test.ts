import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  hardDeleteAccount,
  purgeSupabaseAuthStorageKeys
} from './hardDeleteAccount.ts';
import {
  buildSafeMagicLinkRedirectUrl,
  resolveDynamicAuthRedirectUrl,
  sendSupabaseMagicLink
} from './passwordlessAuth.ts';

function computeContrastRatio(hexA: string, hexB: string): number {
  const toLuminance = (hex: string) => {
    const clean = hex.replace('#', '');
    const rgb = [0, 2, 4].map((offset) => {
      const channel = parseInt(clean.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const l1 = toLuminance(hexA);
  const l2 = toLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

class MemoryStorage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.map.delete(String(key));
  }

  clear(): void {
    this.map.clear();
  }
}

test('Task 1: hardDeleteAccount deletes auth.users + gym_state via admin API, signs out, clears sb-* tokens, and redirects to login', async () => {
  const mockLocal = new MemoryStorage();
  mockLocal.setItem('sb-demo-auth-token', '{"access_token":"jwt-secret"}');
  mockLocal.setItem('supabase.auth.token', '{"access_token":"jwt-secret"}');
  mockLocal.setItem('budget_gym_v5_state', '{"userProfile":{"email":"beta@example.com"}}');
  const mockSession = new MemoryStorage();
  mockSession.setItem('temp_session', '1');

  const fetchCalls: Array<{ url: string; method?: string; authHeader?: string; body?: any }> = [];
  const signOutCalls: Array<{ scope?: string }> = [];
  let redirectedPayload: any = null;

  const mockSupabaseClient = {
    auth: {
      async getSession() {
        return {
          data: {
            session: {
              access_token: 'live-bearer-jwt-token',
              user: { id: 'uuid-user-123', email: 'beta@example.com' }
            }
          }
        };
      },
      async signOut(opts?: { scope?: string }) {
        signOutCalls.push(opts || {});
        return { error: null };
      }
    }
  };

  const stateObj: Record<string, any> = {
    userProfile: { name: 'Beta Tester', email: 'beta@example.com' },
    capturedLeads: [{ name: 'Beta Tester', email: 'beta@example.com' }],
    accountsByEmail: {
      'beta@example.com': { name: 'Beta Tester', snapshot: { currentWeek: 2 } }
    }
  };

  const result = await hardDeleteAccount({
    activeUserId: 'beta@example.com',
    targetUserId: 'beta@example.com',
    stateObj,
    supabaseClient: mockSupabaseClient,
    localStorageImpl: mockLocal as unknown as Storage,
    sessionStorageImpl: mockSession as unknown as Storage,
    fetchImpl: (async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      fetchCalls.push({
        url: String(url),
        method: init?.method,
        authHeader: headers.Authorization,
        body: init?.body ? JSON.parse(String(init.body)) : undefined
      });
      return new Response(
        JSON.stringify({
          deleted: true,
          authUserDeleted: true,
          gymStateDeleted: true,
          clearedDefaultMirror: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch,
    onRedirectToLogin: (payload) => {
      redirectedPayload = payload;
    }
  });

  assert.equal(result.deleted, true);
  assert.equal(result.authUserDeleted, true);
  assert.equal(result.gymStateDeleted, true);
  assert.equal(result.supabaseSignedOut, true);
  assert.equal(result.redirectedToLogin, true);
  assert.equal(result.validation.normalizedUserId, 'beta@example.com');
  assert.equal(result.remainingAccounts.length, 0);

  // Verify admin endpoint called with Bearer JWT and target email
  const adminCall = fetchCalls.find((c) => c.url.startsWith('/api/delete-account'));
  assert.ok(adminCall, 'Expected DELETE /api/delete-account request');
  assert.equal(adminCall.method, 'DELETE');
  assert.equal(adminCall.authHeader, 'Bearer live-bearer-jwt-token');
  assert.equal(adminCall.body.email, 'beta@example.com');
  assert.equal(adminCall.body.confirmHardDelete, true);

  // Verify supabase.auth.signOut was executed
  assert.equal(signOutCalls.length, 1);
  assert.equal(signOutCalls[0].scope, 'global');

  // Verify zombie tokens and state are purged
  assert.equal(mockLocal.getItem('sb-demo-auth-token'), null);
  assert.equal(mockLocal.getItem('supabase.auth.token'), null);
  assert.equal(mockLocal.getItem('budget_gym_v5_state'), null);
  assert.equal(mockSession.length, 0);
  assert.equal(stateObj.userProfile.email, '');

  // Verify login redirect callback ran
  assert.ok(redirectedPayload);
  assert.equal(redirectedPayload.deletedEmail, 'beta@example.com');
});

test('Task 1: hardDeleteAccount rejects cross-account deletion mismatch', async () => {
  const result = await hardDeleteAccount({
    activeUserId: 'alice@example.com',
    targetUserId: 'bob@example.com',
    stateObj: { userProfile: { email: 'alice@example.com' } }
  });

  assert.equal(result.deleted, false);
  assert.equal(result.authUserDeleted, false);
  assert.equal(result.supabaseSignedOut, false);
});

test('Task 1: purgeSupabaseAuthStorageKeys removes all sb-* and supabase auth keys without touching unrelated data', () => {
  const store = new MemoryStorage();
  store.setItem('sb-abc123-auth-token', 'token');
  store.setItem('supabase.auth.refresh', 'refresh');
  store.setItem('keep_theme_pref', 'light');

  const removedCount = purgeSupabaseAuthStorageKeys(store as unknown as Storage);
  assert.equal(removedCount, 2);
  assert.equal(store.getItem('sb-abc123-auth-token'), null);
  assert.equal(store.getItem('supabase.auth.refresh'), null);
  assert.equal(store.getItem('keep_theme_pref'), 'light');
});

test('Task 1: /api/delete-account.js enforces method check, cookie expiration, email validation, and server-only SUPABASE_SERVICE_ROLE_KEY', async () => {
  const mod = await import('../../api/delete-account.js');
  const handler = mod.default;
  assert.equal(typeof handler, 'function');

  const createRes = () => {
    const out: { statusCode: number; headers: Record<string, any>; body: any } = {
      statusCode: 200,
      headers: {},
      body: null
    };
    return {
      out,
      setHeader(k: string, v: any) {
        out.headers[k] = v;
      },
      status(code: number) {
        out.statusCode = code;
        return this;
      },
      json(payload: any) {
        out.body = payload;
        return this;
      },
      end() {
        return this;
      }
    };
  };

  // Method not allowed
  const getRes = createRes();
  await handler({ method: 'GET', headers: {} }, getRes);
  assert.equal(getRes.out.statusCode, 405);

  // Local-preview fallback when Supabase env vars are unset expires session cookies cleanly
  const prevUrl = process.env.SUPABASE_URL;
  const prevSrv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevAnon = process.env.SUPABASE_ANON_KEY;
  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    const localRes = createRes();
    await handler(
      { method: 'DELETE', headers: { cookie: 'gym_session=abc' }, body: { email: 'user@example.com' } },
      localRes
    );
    assert.equal(localRes.out.statusCode, 200);
    assert.equal(localRes.out.body.configured, false);
    assert.equal(localRes.out.body.clearedCookies, true);
    assert.ok(Array.isArray(localRes.out.headers['Set-Cookie']));

    // Configured mode rejects missing/invalid email + no Bearer token with 400
    process.env.SUPABASE_URL = 'https://example-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key-for-test';
    const badEmailRes = createRes();
    await handler(
      { method: 'DELETE', headers: {}, body: { email: 'not-an-email' } },
      badEmailRes
    );
    assert.equal(badEmailRes.out.statusCode, 400);
  } finally {
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevSrv === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevSrv;
    if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = prevAnon;
  }

  // Security audit: ensure SUPABASE_SERVICE_ROLE_KEY is NEVER referenced inside src/
  const hardDeleteSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/utils/hardDeleteAccount.ts'),
    'utf8'
  );
  assert.equal(hardDeleteSource.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
  const envExample = fs.readFileSync(path.resolve(process.cwd(), 'env.example'), 'utf8');
  assert.equal(envExample.includes('SUPABASE_SERVICE_ROLE_KEY='), true);
  assert.equal(envExample.includes('VITE_SUPABASE_SERVICE_ROLE_KEY'), false);
});

test('Task 2: Magic Link routing dynamically uses active window.location.origin and overrides hardcoded localhost/stale URLs', async () => {
  const prevWindow = (globalThis as any).window;
  (globalThis as any).window = {
    location: {
      origin: 'https://ais-dev-dgav4cvzscdotirayw2vix-285031222954.us-east1.run.app',
      href: 'https://ais-dev-dgav4cvzscdotirayw2vix-285031222954.us-east1.run.app/'
    }
  };

  try {
    // Dynamic origin resolution
    assert.equal(
      resolveDynamicAuthRedirectUrl(),
      'https://ais-dev-dgav4cvzscdotirayw2vix-285031222954.us-east1.run.app'
    );

    // Stale hardcoded localhost or Vercel URLs are overridden with active origin
    assert.equal(
      buildSafeMagicLinkRedirectUrl('http://localhost:3000/callback'),
      'https://ais-dev-dgav4cvzscdotirayw2vix-285031222954.us-east1.run.app'
    );
    assert.equal(
      buildSafeMagicLinkRedirectUrl('https://stale-app.vercel.app/'),
      'https://ais-dev-dgav4cvzscdotirayw2vix-285031222954.us-east1.run.app'
    );

    // Unsafe protocols rejected
    assert.equal(buildSafeMagicLinkRedirectUrl('javascript:alert(1)'), undefined);

    // sendSupabaseMagicLink passes dynamic active window.location.origin as emailRedirectTo
    let capturedOtpArgs: any = null;
    const mockClient = {
      auth: {
        async signInWithOtp(args: any) {
          capturedOtpArgs = args;
          return { data: {}, error: null };
        }
      }
    };

    const res = await sendSupabaseMagicLink({
      email: 'Runner@Example.com',
      displayName: 'Alex',
      redirectTo: 'http://localhost:3000',
      supabaseClient: mockClient
    });

    assert.equal(res.ok, true);
    assert.equal(res.mode, 'supabase_otp');
    assert.equal(capturedOtpArgs.email, 'runner@example.com');
    assert.equal(
      capturedOtpArgs.options.emailRedirectTo,
      'https://ais-dev-dgav4cvzscdotirayw2vix-285031222954.us-east1.run.app'
    );
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = prevWindow;
    }
  }
});

test('Task 3 & Task 4: Auth modal fixed-header inner scroll + WCAG 2.2 AA green contrast checks', () => {
  // Math check: bg-green-700 (#15803D) with pure white (#FFFFFF) >= 4.5:1 AA
  const darkGreenRatio = computeContrastRatio('#15803D', '#FFFFFF');
  assert.ok(darkGreenRatio >= 4.5, `Expected #15803D on #FFFFFF >= 4.5, got ${darkGreenRatio.toFixed(2)}`);

  // Math check: bg-green-100 (#DCFCE7) with charcoal (#111827) >= 7.0:1 AAA
  const pastelGreenRatio = computeContrastRatio('#DCFCE7', '#111827');
  assert.ok(pastelGreenRatio >= 7.0, `Expected #DCFCE7 on #111827 >= 7.0, got ${pastelGreenRatio.toFixed(2)}`);

  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const loginModalTsx = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/AccountLoginModal.tsx'),
    'utf8'
  );
  const autoSyncTsx = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/AutoSyncSettingsControl.tsx'),
    'utf8'
  );

  // Task 3: Inner scroll container uses max-h-[80vh] and overflow-y-auto in both live DOM and React component
  assert.equal(indexHtml.includes('id="smart-login-scroll-body"'), true);
  assert.equal(indexHtml.includes('max-h-[80vh] overflow-y-auto'), true);
  assert.equal(loginModalTsx.includes('max-h-[80vh]'), true);
  assert.equal(loginModalTsx.includes('overflow-y-auto'), true);

  // Task 4: Save Account and Auto-Sync Devices use dark green (#15803D / bg-green-700) + pure white text
  assert.equal(indexHtml.includes('id="settings-save-account-btn" class="btn-save-account-solid'), true);
  assert.equal(indexHtml.includes('bg-green-700 hover:bg-green-800 text-white'), true);
  assert.equal(indexHtml.includes('id="active-auto-sync-readout"'), true);
  assert.equal(indexHtml.includes('bg-green-100 px-2 py-0.5 text-[0.75rem] font-extrabold text-gray-900'), true);
  assert.equal(autoSyncTsx.includes('bg-green-700 hover:bg-green-800 text-white'), true);
  assert.equal(autoSyncTsx.includes('bg-green-100 px-2 py-0.5 text-xs font-extrabold text-gray-900'), true);

  // Zero-deletion check: all existing login methods & buttons preserved
  for (const id of [
    'apple-oauth-btn',
    'google-oauth-btn',
    'send-magic-link-btn',
    'signin-passkey-btn',
    'setup-passkey-btn',
    'submit-smart-login-btn',
    'delete-account-data-btn',
    'settings-save-account-btn',
    'toggle-auto-sync-devices-btn',
    'force-sync-now-btn',
    'force-pull-cloud-btn'
  ]) {
    assert.equal(indexHtml.includes(`id="${id}"`), true, `Missing preserved button/control: ${id}`);
  }
});
