import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PASSKEY_REGISTRY_STORAGE_KEY,
  authenticateWithBiometricPasskey,
  buildSafeMagicLinkRedirectUrl,
  encodeBytesToBase64Url,
  generateWebAuthnChallenge,
  hasRegisteredPasskeyForEmail,
  loadRegisteredPasskeys,
  registerBiometricPasskey,
  sendSupabaseMagicLink,
  validatePasswordlessEmail,
  verifySupabaseMagicLinkOtp
} from './passwordlessAuth';
import {
  BARBELL_SQUAT_MEDIA_SAMPLES,
  DEFAULT_ACCESSIBLE_VIDEO_SETTINGS,
  getActiveLiteralStepAtTime,
  getActiveVttCaptionAtTime,
  parseVttTimestampToSeconds,
  parseWebVttCaptions,
  sanitizeMediaUrl
} from './accessibleVideoMedia';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    }
  };
}

test('Task 1: validatePasswordlessEmail & buildSafeMagicLinkRedirectUrl reject unsafe inputs', () => {
  assert.equal(validatePasswordlessEmail('').valid, false);
  assert.equal(validatePasswordlessEmail('not-an-email').valid, false);
  const ok = validatePasswordlessEmail('  Alex@7amGym.app ');
  assert.equal(ok.valid, true);
  assert.equal(ok.email, 'alex@7amgym.app');

  // Security: Reject javascript: URI and pin external origins back to same origin
  assert.equal(buildSafeMagicLinkRedirectUrl('javascript:alert(1)', 'https://7amgym.app'), undefined);
  assert.equal(
    buildSafeMagicLinkRedirectUrl('https://evil.example/phish', 'https://7amgym.app'),
    'https://7amgym.app'
  );
  assert.equal(
    buildSafeMagicLinkRedirectUrl('https://7amgym.app/workout', 'https://7amgym.app'),
    'https://7amgym.app/workout'
  );
});

test('Task 1: sendSupabaseMagicLink and verifySupabaseMagicLinkOtp invoke Supabase Auth OTP APIs', async () => {
  let sentPayload: any = null;
  let verifiedPayload: any = null;

  const mockSupabase = {
    auth: {
      signInWithOtp: async (params: any) => {
        sentPayload = params;
        return { data: {}, error: null };
      },
      verifyOtp: async (params: any) => {
        verifiedPayload = params;
        return {
          data: {
            user: {
              id: 'user-uuid-999',
              email: params.email,
              user_metadata: { display_name: 'Francois' }
            }
          },
          error: null
        };
      }
    }
  };

  const sendRes = await sendSupabaseMagicLink({
    email: 'francois@7amgym.app',
    displayName: 'Francois',
    redirectTo: 'https://7amgym.app',
    supabaseClient: mockSupabase
  });
  assert.equal(sendRes.ok, true);
  assert.equal(sendRes.mode, 'supabase_otp');
  assert.equal(sentPayload.email, 'francois@7amgym.app');
  assert.equal(sentPayload.options.shouldCreateUser, true);

  // Reject malformed OTP
  const badOtp = await verifySupabaseMagicLinkOtp({
    email: 'francois@7amgym.app',
    token: 'abc',
    supabaseClient: mockSupabase
  });
  assert.equal(badOtp.ok, false);

  // Accept valid 6-digit OTP
  const verifyRes = await verifySupabaseMagicLinkOtp({
    email: 'francois@7amgym.app',
    token: '482910',
    supabaseClient: mockSupabase
  });
  assert.equal(verifyRes.ok, true);
  assert.equal(verifyRes.userId, 'user-uuid-999');
  assert.equal(verifyRes.displayName, 'Francois');
  assert.equal(verifiedPayload.type, 'email');
});

test('Task 1: WebAuthn Biometric Passkey registration & sign-in use 32-byte random challenge and store only public metadata', async () => {
  const storage = createMemoryStorage();
  let capturedCreateOpts: any = null;
  let capturedGetOpts: any = null;
  let supabaseMetadataUpdate: any = null;

  const rawIdBytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
  const expectedId = encodeBytesToBase64Url(rawIdBytes);

  const mockCreds = {
    create: async (opts: any) => {
      capturedCreateOpts = opts;
      return {
        id: expectedId,
        rawId: rawIdBytes.buffer,
        type: 'public-key'
      } as unknown as Credential;
    },
    get: async (opts: any) => {
      capturedGetOpts = opts;
      return {
        id: expectedId,
        rawId: rawIdBytes.buffer,
        type: 'public-key'
      } as unknown as Credential;
    }
  };

  const mockSupabase = {
    auth: {
      updateUser: async (payload: any) => {
        supabaseMetadataUpdate = payload;
        return { data: {}, error: null };
      }
    }
  };

  const regRes = await registerBiometricPasskey({
    email: 'beta@7amgym.app',
    displayName: 'Beta Lifter',
    rpId: '7amgym.app',
    credentialsApi: mockCreds,
    supabaseClient: mockSupabase,
    storage
  });

  assert.equal(regRes.ok, true);
  assert.equal(regRes.credentialId, expectedId);
  assert.equal(capturedCreateOpts.publicKey.challenge.byteLength, 32);
  assert.equal(capturedCreateOpts.publicKey.authenticatorSelection.authenticatorAttachment, 'platform');
  assert.equal(supabaseMetadataUpdate.data.passkey_enrolled, true);
  assert.equal(hasRegisteredPasskeyForEmail('beta@7amgym.app', storage), true);

  // Confirm stored record contains only public metadata (no secret/private keys)
  const storedRaw = storage.getItem(PASSKEY_REGISTRY_STORAGE_KEY) || '';
  assert.equal(storedRaw.includes('privateKey'), false);
  assert.equal(loadRegisteredPasskeys(storage).length, 1);

  const authRes = await authenticateWithBiometricPasskey({
    email: 'beta@7amgym.app',
    rpId: '7amgym.app',
    credentialsApi: mockCreds,
    storage
  });
  assert.equal(authRes.ok, true);
  assert.equal(authRes.email, 'beta@7amgym.app');
  assert.equal(authRes.displayName, 'Beta Lifter');
  assert.equal(capturedGetOpts.publicKey.allowCredentials.length, 1);

  const randomChallenge = generateWebAuthnChallenge(32);
  assert.equal(randomChallenge.byteLength, 32);
});

test('Task 2: Barbell Squat JSON sample defaults to looping muted 0.5x speed and syncs WebVTT + Grade 6-8 steps', () => {
  assert.equal(DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.loop, true);
  assert.equal(DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.muted, true);
  assert.equal(DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.playbackRate, 0.5);
  assert.equal(DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.captionsEnabled, true);

  assert.ok(BARBELL_SQUAT_MEDIA_SAMPLES.length >= 1);
  const squat = BARBELL_SQUAT_MEDIA_SAMPLES[0];
  assert.equal(squat.exerciseName, 'Barbell Squat');
  assert.equal(squat.defaultSettings.loop, true);
  assert.equal(squat.defaultSettings.muted, true);
  assert.equal(squat.defaultSettings.playbackRate, 0.5);
  assert.equal(squat.literalSteps.length, 5);
  assert.equal(squat.script.length, 5);

  const parsedCues = parseWebVttCaptions(squat.vttCaptions);
  assert.equal(parsedCues.length, 5);
  assert.equal(parseVttTimestampToSeconds('00:12.500'), 12.5);
  assert.equal(parseVttTimestampToSeconds('01:02:03.250'), 3723.25);

  // At t=13s -> Step 4 (Lower Down Under Control) & Cue 4
  const cueAt13 = getActiveVttCaptionAtTime(parsedCues, 13);
  const stepAt13 = getActiveLiteralStepAtTime(squat.literalSteps, 13);
  assert.ok(cueAt13 && cueAt13.text.includes('Step 4'));
  assert.ok(stepAt13 && stepAt13.stepNumber === 4);

  // Security: VTT parser strips HTML/script tags and media URL sanitizer blocks javascript:
  const xssCues = parseWebVttCaptions('WEBVTT\n\n00:00.000 --> 00:03.000\n<b>Brace</b> <script>alert(1)</script> tight');
  assert.equal(xssCues[0].text, 'Brace alert(1) tight');
  assert.equal(sanitizeMediaUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeMediaUrl('/media/barbell-squat-demo.mp4'), '/media/barbell-squat-demo.mp4');
});

test('Task 3: VPAT WCAG 2.2 AA document & Apple 9-Label Accessibility Nutrition Labels exist and are complete', () => {
  const rootDir = process.cwd();
  const vpatPath = path.join(rootDir, 'docs', 'VPAT_WCAG_2.2_AA.md');
  const labelsJsonPath = path.join(rootDir, 'docs', 'APPLE_ACCESSIBILITY_NUTRITION_LABELS.json');
  const labelsMdPath = path.join(rootDir, 'docs', 'APPLE_ACCESSIBILITY_NUTRITION_LABELS.md');

  const vpatText = fs.readFileSync(vpatPath, 'utf8');
  assert.ok(vpatText.includes('WCAG 2.2'));
  assert.ok(vpatText.includes('3.3.8 Accessible Authentication'));
  assert.ok(vpatText.includes('2.5.8 Target Size'));
  assert.ok(vpatText.includes('OpenDyslexic'));
  assert.ok(vpatText.includes('Adherence-Neutral'));

  const labelsJson = JSON.parse(fs.readFileSync(labelsJsonPath, 'utf8'));
  assert.equal(labelsJson.labels.length, 9);
  const expectedAppleLabels = [
    'VoiceOver',
    'Voice Control',
    'Larger Text',
    'Dark Interface',
    'Differentiate Without Color Alone',
    'Sufficient Contrast',
    'Reduced Motion',
    'Captions',
    'Audio Descriptions'
  ];
  assert.deepEqual(
    labelsJson.labels.map((l: any) => l.appleLabel),
    expectedAppleLabels
  );
  const supportedCount = labelsJson.labels.filter((l: any) => l.supported === true).length;
  assert.equal(labelsJson.summary.supportedCount, supportedCount);

  const labelsMd = fs.readFileSync(labelsMdPath, 'utf8');
  for (const name of expectedAppleLabels) {
    assert.ok(labelsMd.includes(name), `Expected ${name} in Apple Nutrition Labels markdown`);
  }
});

test('Zero Deletion Policy: Existing auth buttons and settings controls remain intact', () => {
  const rootDir = process.cwd();
  const loginModalSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'AccountLoginModal.tsx'), 'utf8');
  const indexSrc = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  // AccountLoginModal preserves Apple, Google, Email & Password, Show/Hide + adds Magic Link & Passkey
  for (const token of [
    'Continue with Apple',
    'Continue with Google',
    'react-login-password',
    'send-magic-link-btn',
    'signin-passkey-btn',
    'setup-passkey-btn'
  ]) {
    assert.ok(loginModalSrc.includes(token), `Missing preserved/new token in AccountLoginModal.tsx: ${token}`);
  }

  // index.html preserves all existing controls + adds Passwordless & Accessible Video Guide
  for (const token of [
    'apple-oauth-btn',
    'google-oauth-btn',
    'lead-password-input',
    'submit-smart-login-btn',
    'force-sync-now-btn',
    'force-pull-cloud-btn',
    'export-gym-json-btn',
    'import-gym-json-btn',
    'micro-start-slot',
    'send-magic-link-btn',
    'signin-passkey-btn',
    'setup-passkey-btn',
    'toggle-accessible-video-guide-btn'
  ]) {
    assert.ok(indexSrc.includes(token), `Missing preserved/new token in index.html: ${token}`);
  }
});
