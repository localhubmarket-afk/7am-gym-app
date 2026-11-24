import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DELETE_ACCOUNT_MAIN_WARNING,
  DELETE_ACCOUNT_WARNING_BULLETS,
  POST_DELETE_SELECT_ACCOUNT_PROMPT,
  AVAILABLE_OAUTH_LOGIN_PROVIDERS,
  findAllRemainingSavedAccounts,
  executeCompleteAccountDeletion,
  onDeleteSuccess
} from './deletionValidation';
import {
  IKEA_QUIZ_STEPS,
  IKEA_QUIZ_ALL_STEPS,
  ONBOARDING_ACCESSIBILITY_QUESTION,
  ONBOARDING_ACCESSIBILITY_STEP,
  buildIkeaQuizProgram,
  createGuestSandboxStatePatch
} from './onboardingQuiz';
import {
  ADHD_VIEW_STORAGE_KEY,
  DYSLEXIA_VIEW_STORAGE_KEY,
  saveAdhdViewPreference,
  loadStoredAdhdViewPreference,
  applyAdhdFriendlyViewToDocument,
  saveDyslexiaViewPreference,
  loadStoredDyslexiaViewPreference,
  applyDyslexiaFriendlyViewToDocument
} from './themeProvider';
import {
  computeStableScrollTargetY,
  withStableViewportScroll,
  scrollContainerHorizontallyWithoutVerticalJump
} from './viewportStability';
import {
  DEFAULT_VALIDATION_LIMITS,
  validateLoggedWeight,
  validateLoggedReps,
  validateAccountProfileInput,
  validateQuickAddFuelInput,
  validateGymTimeInput
} from './inputValidation';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, val: string) => {
      map.set(key, String(val));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    }
  };
}

function createFakeDocument() {
  const classes = new Set<string>();
  const attrs = new Map<string, string>();
  const props = new Map<string, string>();
  return {
    classes,
    attrs,
    props,
    documentElement: {
      classList: {
        toggle: (name: string, force?: boolean) => {
          const shouldAdd = typeof force === 'boolean' ? force : !classes.has(name);
          if (shouldAdd) classes.add(name);
          else classes.delete(name);
          return shouldAdd;
        }
      },
      setAttribute: (name: string, val: string) => {
        attrs.set(name, String(val));
      },
      style: {
        setProperty: (name: string, val: string) => {
          props.set(name, String(val));
        }
      }
    }
  } as unknown as Document & {
    classes: Set<string>;
    attrs: Map<string, string>;
    props: Map<string, string>;
  };
}

// =========================================================================
// TASK 1: Account Deletion UI & Process (ELI12, Zero Jargon, Multi-Account)
// =========================================================================

test('Task 1: Account deletion warning and bullets are ELI12 and contain zero technical jargon', () => {
  const combinedText = [DELETE_ACCOUNT_MAIN_WARNING, ...DELETE_ACCOUNT_WARNING_BULLETS]
    .join(' ')
    .toLowerCase();

  assert.equal(DELETE_ACCOUNT_WARNING_BULLETS.length >= 3, true);
  assert.equal(combinedText.includes('database'), false);
  assert.equal(combinedText.includes('supabase'), false);
  assert.equal(combinedText.includes('cookie'), false);
  assert.equal(combinedText.includes('sql'), false);
  assert.equal(combinedText.includes('token'), false);
  assert.equal(combinedText.includes('schema'), false);
});

test('Task 1: findAllRemainingSavedAccounts returns ALL remaining valid saved accounts sorted by recency', () => {
  const stateObj = {
    accountsByEmail: {
      'alex@example.com': {
        profile: { name: 'Alex', email: 'alex@example.com', signedInAt: '2026-11-23T12:00:00.000Z' }
      },
      'jamie@example.com': {
        profile: { name: 'Jamie', email: 'jamie@example.com', signedInAt: '2026-11-22T10:00:00.000Z' }
      },
      'sam@example.com': {
        profile: { name: 'Sam', email: 'sam@example.com', signedInAt: '2026-11-23T11:00:00.000Z' }
      },
      'member@gmail.com': {
        profile: { name: 'Placeholder', email: 'member@gmail.com', signedInAt: '2026-11-23T13:00:00.000Z' }
      }
    }
  };

  const remaining = findAllRemainingSavedAccounts(stateObj, 'alex@example.com');
  assert.equal(remaining.length, 2);
  assert.equal(remaining[0].email, 'sam@example.com');
  assert.equal(remaining[0].name, 'Sam');
  assert.equal(remaining[1].email, 'jamie@example.com');
  assert.equal(remaining[1].name, 'Jamie');
});

test('Task 1: executeCompleteAccountDeletion + onDeleteSuccess surface all remaining accounts and login options', async () => {
  const storage = createMemoryStorage();
  const stateObj: Record<string, any> = {
    userProfile: { name: 'Alex', email: 'alex@example.com', signedInAt: '2026-11-23T12:00:00.000Z' },
    accountsByEmail: {
      'alex@example.com': {
        profile: { name: 'Alex', email: 'alex@example.com', signedInAt: '2026-11-23T12:00:00.000Z' }
      },
      'jamie@example.com': {
        profile: { name: 'Jamie', email: 'jamie@example.com', signedInAt: '2026-11-22T10:00:00.000Z' }
      },
      'sam@example.com': {
        profile: { name: 'Sam', email: 'sam@example.com', signedInAt: '2026-11-23T11:00:00.000Z' }
      }
    },
    workoutLogs: { w1_d0_s0: { done: true, w: '135', r: '8' } }
  };

  const res = await executeCompleteAccountDeletion({
    endpoint: '',
    activeUserId: 'alex@example.com',
    targetUserId: 'alex@example.com',
    stateObj,
    localStorageImpl: storage,
    sessionStorageImpl: { clear: () => {} },
    cachesImpl: null,
    docImpl: { cookie: '' }
  });

  assert.equal(res.deleted, true);
  assert.equal(res.remainingAccounts.length, 2);
  assert.equal(res.secondaryAccount?.email, 'sam@example.com');
  assert.equal('alex@example.com' in stateObj.accountsByEmail, false);
  assert.equal('sam@example.com' in stateObj.accountsByEmail, true);
  assert.equal('jamie@example.com' in stateObj.accountsByEmail, true);

  let openedPayload: any = null;
  const payload = onDeleteSuccess({
    deletedEmail: 'alex@example.com',
    secondaryAccount: res.secondaryAccount,
    remainingAccounts: res.remainingAccounts,
    onOpenAccountSelectModal: (p) => {
      openedPayload = p;
    }
  });

  assert.equal(payload.shouldOpenAccountSelectModal, true);
  assert.equal(payload.modalPrompt, POST_DELETE_SELECT_ACCOUNT_PROMPT);
  assert.deepEqual(payload.oauthProviders, [...AVAILABLE_OAUTH_LOGIN_PROVIDERS]);
  assert.equal(payload.remainingAccounts.length, 2);
  assert.equal(openedPayload?.remainingAccounts.length, 2);
});

// =========================================================================
// TASK 2: Onboarding Accessibility Customization (Step 6 + Persistence)
// =========================================================================

test('Task 2: Onboarding adds Step 6 asking "Do you need a special screen layout?" while preserving 5 core steps', () => {
  assert.equal(IKEA_QUIZ_STEPS.length, 5);
  assert.equal(ONBOARDING_ACCESSIBILITY_QUESTION, 'Do you need a special screen layout?');
  assert.equal(ONBOARDING_ACCESSIBILITY_STEP.stepNumber, 6);
  assert.equal(ONBOARDING_ACCESSIBILITY_STEP.id, 'accessibility');
  assert.equal(IKEA_QUIZ_ALL_STEPS.length, 6);
  assert.equal(IKEA_QUIZ_ALL_STEPS[5].title, 'Do you need a special screen layout?');
});

test('Task 2: Onboarding saves ADHD-friendly and Dyslexia-friendly preferences to program config and profile patch', () => {
  const program = buildIkeaQuizProgram(
    {
      goal: 'build_muscle',
      experience: 'medium',
      equipment: 'full_gym',
      daysPerWeek: 4,
      baseDiet: 'Vegan',
      intolerances: [],
      adhdFriendlyView: true,
      dyslexiaFriendlyView: true
    },
    [],
    []
  );

  assert.equal(program.programWizardConfig.adhdFriendlyView, true);
  assert.equal(program.programWizardConfig.dyslexiaFriendlyView, true);
  assert.equal(program.guestSandboxProfile.accessibilityPreferences.adhdFriendlyView, true);
  assert.equal(program.guestSandboxProfile.accessibilityPreferences.dyslexiaFriendlyView, true);

  const signedInPatch = createGuestSandboxStatePatch(program, {
    name: 'Sam',
    email: 'sam@example.com',
    isGuest: false
  });
  assert.equal(signedInPatch.isGuestMode, false);
  assert.equal(signedInPatch.adhdFriendlyView, true);
  assert.equal(signedInPatch.dyslexiaFriendlyView, true);
  assert.equal(signedInPatch.fontMode, 'opendyslexic');
  assert.equal(signedInPatch.userProfile.accessibilityPreferences.adhdFriendlyView, true);
  assert.equal(signedInPatch.userProfile.accessibilityPreferences.dyslexiaFriendlyView, true);
});

test('Task 2: ADHD-friendly and Dyslexia-friendly storage & document helpers persist and toggle classes', () => {
  const storage = createMemoryStorage();
  const doc = createFakeDocument();

  assert.equal(loadStoredAdhdViewPreference(storage), false);
  assert.equal(loadStoredDyslexiaViewPreference(storage), false);

  saveAdhdViewPreference(true, storage);
  saveDyslexiaViewPreference(true, storage);

  assert.equal(storage.getItem(ADHD_VIEW_STORAGE_KEY), 'true');
  assert.equal(storage.getItem(DYSLEXIA_VIEW_STORAGE_KEY), 'true');
  assert.equal(loadStoredAdhdViewPreference(storage), true);
  assert.equal(loadStoredDyslexiaViewPreference(storage), true);

  applyAdhdFriendlyViewToDocument(true, doc);
  applyDyslexiaFriendlyViewToDocument(true, doc);

  assert.equal(doc.classes.has('adhd-friendly-view'), true);
  assert.equal(doc.attrs.get('data-adhd-view'), 'true');
  assert.equal(doc.classes.has('dyslexia-friendly-view'), true);
  assert.equal(doc.attrs.get('data-dyslexia-view'), 'true');
  assert.equal(doc.classes.has('font-opendyslexic'), true);
});

// =========================================================================
// TASK 3: Exercise Logging UI Stability (Zero Vertical Jump)
// =========================================================================

test('Task 3: computeStableScrollTargetY compensates exact card offset delta without negative scroll', () => {
  assert.equal(
    computeStableScrollTargetY({
      scrollYBefore: 420,
      anchorTopBefore: 180,
      anchorTopAfter: 204
    }),
    444
  );
  assert.equal(
    computeStableScrollTargetY({
      scrollYBefore: 420,
      anchorTopBefore: 180,
      anchorTopAfter: 160
    }),
    400
  );
  assert.equal(
    computeStableScrollTargetY({
      scrollYBefore: 10,
      anchorTopBefore: 100,
      anchorTopAfter: 20
    }),
    0
  );
});

test('Task 3: withStableViewportScroll restores exact scrollY after DOM re-render even with browser clamping', () => {
  let currentY = 450;
  let cardDocY = 550; // card top = 550 - 450 = 100px from viewport top
  const scrollCalls: number[] = [];

  const fakeWin = {
    scrollX: 0,
    get scrollY() {
      return currentY;
    },
    scrollTo: (xOrOpts: number | ScrollToOptions, y?: number) => {
      const nextY = typeof xOrOpts === 'number' ? Number(y ?? 0) : Number(xOrOpts.top ?? 0);
      currentY = nextY;
      scrollCalls.push(nextY);
    },
    requestAnimationFrame: (cb: () => void) => {
      cb();
      return 1;
    }
  };

  const fakeCard = {
    id: 'exercise-card-bench',
    getBoundingClientRect: () => ({ top: cardDocY - currentY })
  };

  withStableViewportScroll(
    fakeCard,
    () => {
      // Simulate browser clamping window.scrollY from 450 -> 168 during listEl.innerHTML = ''
      currentY = 168;
      // Card stays at document Y 550 (so getBoundingClientRect().top becomes 382)
    },
    {
      win: fakeWin,
      findAnchorById: () => fakeCard
    }
  );

  // Must restore to exact 450 (0px delta) both synchronously and on rAF pass
  assert.equal(currentY, 450);
  assert.equal(scrollCalls.length >= 2, true);
  assert.equal(scrollCalls[scrollCalls.length - 1], 450);
});

test('Task 3: scrollContainerHorizontallyWithoutVerticalJump updates scrollLeft only', () => {
  const container = {
    scrollLeft: 0,
    clientWidth: 320
  };
  const offscreenRightChild = {
    offsetLeft: 420,
    offsetWidth: 90
  };
  const nextLeft = scrollContainerHorizontallyWithoutVerticalJump(container, offscreenRightChild);
  assert.equal(nextLeft, 202);
  assert.equal(container.scrollLeft, 202);
});

test('Task 3: index.html removes involuntary scrollIntoView calls in workout logging & week strip', () => {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.equal(html.includes('activeWeekPillEl.scrollIntoView'), false);
  assert.equal(html.includes('nextCard.scrollIntoView'), false);
  assert.equal(html.includes('pairCard.scrollIntoView'), false);
  assert.equal(html.includes('withStableViewportScroll'), true);
});

// =========================================================================
// TASK 4: Strict Content Validation (Weights, Reps, Account, Fuel, Time)
// =========================================================================

test('Task 4: validateLoggedWeight enforces logical lbs/kg bounds and rejects invalid input', () => {
  assert.equal(DEFAULT_VALIDATION_LIMITS.maxWeightLbs, 999);
  assert.equal(DEFAULT_VALIDATION_LIMITS.maxWeightKg, 455);

  const ok = validateLoggedWeight('135.5', 'lbs');
  assert.equal(ok.valid, true);
  assert.equal(ok.numericValue, 135.5);

  const bodyweight = validateLoggedWeight('0', 'lbs');
  assert.equal(bodyweight.valid, true);
  assert.equal(bodyweight.numericValue, 0);

  const neg = validateLoggedWeight('-20', 'lbs');
  assert.equal(neg.valid, false);
  assert.match(neg.errorMessage || '', /below 0/i);

  const tooHighLbs = validateLoggedWeight('1450', 'lbs');
  assert.equal(tooHighLbs.valid, false);
  assert.equal(tooHighLbs.numericValue, 999);

  const tooHighKg = validateLoggedWeight('500', 'kg');
  assert.equal(tooHighKg.valid, false);
  assert.equal(tooHighKg.numericValue, 455);

  const garbage = validateLoggedWeight('12abc', 'lbs');
  assert.equal(garbage.valid, false);

  const customCap = validateLoggedWeight('600', 'lbs', { maxWeightLbs: 500 });
  assert.equal(customCap.valid, false);
  assert.equal(customCap.numericValue, 500);
});

test('Task 4: validateLoggedReps enforces whole numbers 1..100 and rejects decimals or out-of-range', () => {
  const ok = validateLoggedReps('12');
  assert.equal(ok.valid, true);
  assert.equal(ok.numericValue, 12);

  assert.equal(validateLoggedReps('0').valid, false);
  assert.equal(validateLoggedReps('-4').valid, false);
  assert.equal(validateLoggedReps('8.5').valid, false);
  assert.equal(validateLoggedReps('150').valid, false);
  assert.equal(validateLoggedReps('ten').valid, false);
});

test('Task 4: validateAccountProfileInput catches malformed emails, placeholder names, weak passwords, and bad phones', () => {
  const good = validateAccountProfileInput({
    name: 'Jordan Lee',
    email: 'Jordan@Example.com',
    password: 'strongpassword',
    phone: '555-234-5678',
    requireName: true,
    requirePassword: true
  });
  assert.equal(good.valid, true);
  assert.equal(good.sanitized.email, 'jordan@example.com');

  const badBrandName = validateAccountProfileInput({
    name: 'Google',
    email: 'bad-email',
    password: '123',
    phone: '12',
    requireName: true,
    requirePassword: true
  });
  assert.equal(badBrandName.valid, false);
  assert.ok(badBrandName.fieldErrors.name);
  assert.ok(badBrandName.fieldErrors.email);
  assert.ok(badBrandName.fieldErrors.password);
  assert.ok(badBrandName.fieldErrors.phone);
});

test('Task 4: validateQuickAddFuelInput and validateGymTimeInput enforce safe bounds', () => {
  const okFuel = validateQuickAddFuelInput({ label: 'Tofu Scramble', calories: 420, proteinGrams: 34 });
  assert.equal(okFuel.valid, true);

  const badFuel = validateQuickAddFuelInput({ label: 'X', calories: 99999, proteinGrams: -5 });
  assert.equal(badFuel.valid, false);
  assert.equal(badFuel.errors.length, 3);

  assert.equal(validateGymTimeInput('7:30').valid, true);
  assert.equal(validateGymTimeInput('7:30').sanitizedValue, '07:30');
  assert.equal(validateGymTimeInput('25:99').valid, false);
});

test('WCAG 2.2 / COGA: New & updated CSS/TSX files contain zero px font-size declarations', () => {
  const filesToCheck = [
    'src/styles/accessibility.css',
    'src/components/ExerciseSetLogger.tsx',
    'src/components/DeletionModals.tsx',
    'src/components/IkeaOnboardingQuiz.tsx',
    'src/components/AccessibilitySettingsPanel.tsx'
  ];

  for (const relPath of filesToCheck) {
    const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
    assert.equal(
      /font-size\s*:\s*\d+(?:\.\d+)?px/i.test(content),
      false,
      `${relPath} must not contain px font-size declarations`
    );
    assert.equal(
      /text-\[\d+(?:\.\d+)?px\]/i.test(content),
      false,
      `${relPath} must not contain Tailwind px text-[Npx] classes`
    );
  }
});
