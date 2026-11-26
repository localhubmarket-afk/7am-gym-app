import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  AUTH_INPUT_IDS,
  applyNonAuthInputAttributes,
  shouldPromptForLogin,
  syncHiddenAuthModalInputIsolation
} from './authSessionGuard';
import {
  ACTIVE_WORKOUT_SESSION_KEY,
  MAX_RESUME_SESSION_AGE_MS,
  buildActiveWorkoutSessionSnapshot,
  buildResumeWorkoutBannerCopy,
  clearActiveWorkoutSession,
  loadActiveWorkoutSession,
  saveActiveWorkoutSession
} from './workoutResumeSession';
import {
  buildProminentWarmupQuickTips,
  computeLiveScheduleContext,
  formatMinutes12Hour,
  parseHHMMMinutesSafe
} from './realtimeScheduleSync';
import {
  NEXT_WEEK_NOTE_QUICK_CHIPS,
  buildNextWeekProgressionNote,
  extractReadableTextFromPdfBytes,
  parseCustomWorkoutProgram
} from './customProgramImporter';
import {
  validateExerciseSetEntry,
  validateTimerDurationSeconds,
  validateWorkoutNoteText
} from './inputValidation';

function createMockElement(tagName: string, initialAttrs: Record<string, string> = {}) {
  const attrs = new Map<string, string>(Object.entries(initialAttrs));
  const classes = new Set<string>((initialAttrs.class || '').split(/\s+/).filter(Boolean));
  return {
    tagName: tagName.toUpperCase(),
    disabled: false,
    classList: {
      contains: (c: string) => classes.has(c),
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c)
    },
    getAttribute: (k: string) => (attrs.has(k) ? attrs.get(k)! : null),
    setAttribute: (k: string, v: string) => attrs.set(k, String(v)),
    removeAttribute: (k: string) => attrs.delete(k),
    closest: () => null,
    querySelectorAll: () => [] as any[]
  };
}

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    }
  };
}

test('Task 1: shouldPromptForLogin blocks all routine workout actions and only allows explicit auth triggers', () => {
  const blockedActions = [
    'note_focus',
    'note_change',
    'next_week_note_change',
    'timer_start',
    'timer_pause',
    'timer_adjust',
    'set_log',
    'warmup_toggle',
    'background_resume',
    'program_upload'
  ] as const;

  for (const action of blockedActions) {
    const res = shouldPromptForLogin({ action, hasActiveUser: false });
    assert.equal(res.shouldPromptLogin, false, `Expected ${action} to NEVER prompt login`);
  }

  assert.equal(
    shouldPromptForLogin({ action: 'explicit_user_login_click', hasActiveUser: true }).shouldPromptLogin,
    true
  );
  assert.equal(
    shouldPromptForLogin({ action: 'auth_token_expired', tokenExplicitlyExpired: true }).shouldPromptLogin,
    true
  );
  assert.equal(
    shouldPromptForLogin({
      action: 'initial_cold_load',
      hasActiveUser: false,
      requireLoginOnColdLoad: false
    }).shouldPromptLogin,
    false
  );
});

test('Task 1: applyNonAuthInputAttributes hardens workout notes and skips auth fields', () => {
  const noteInput = createMockElement('input', {
    id: 'ex-note-input-bench',
    type: 'text',
    name: 'machine_pin'
  });
  const changed = applyNonAuthInputAttributes(noteInput as unknown as Element);
  assert.equal(changed, true);
  assert.equal(noteInput.getAttribute('autocomplete'), 'off');
  assert.equal(noteInput.getAttribute('data-lpignore'), 'true');
  assert.equal(noteInput.getAttribute('data-1p-ignore'), 'true');
  assert.equal(noteInput.getAttribute('data-bwignore'), 'true');
  assert.equal(noteInput.getAttribute('data-form-type'), 'other');
  assert.match(String(noteInput.getAttribute('name')), /^gym_nonauth_/);

  const authPass = createMockElement('input', {
    id: 'lead-password-input',
    type: 'password',
    autocomplete: 'current-password'
  });
  assert.equal(AUTH_INPUT_IDS.has('lead-password-input'), true);
  assert.equal(applyNonAuthInputAttributes(authPass as unknown as Element), false);
});

test('Task 1: syncHiddenAuthModalInputIsolation disables auth inputs while modal is hidden and re-enables when shown', () => {
  const emailInp = createMockElement('input', { id: 'passwordless-email-input', type: 'email' });
  const passInp = createMockElement('input', { id: 'lead-password-input', type: 'password' });
  const modal = createMockElement('div', { id: 'smart-login-modal', class: 'hidden fixed' });
  modal.querySelectorAll = () => [emailInp, passInp];

  const hiddenRes = syncHiddenAuthModalInputIsolation(modal as unknown as Element);
  assert.equal(hiddenRes.isHidden, true);
  assert.equal(hiddenRes.affectedInputs, 2);
  assert.equal(emailInp.disabled, true);
  assert.equal(passInp.disabled, true);
  assert.equal(emailInp.getAttribute('tabindex'), '-1');

  modal.classList.remove('hidden');
  const openRes = syncHiddenAuthModalInputIsolation(modal as unknown as Element);
  assert.equal(openRes.isHidden, false);
  assert.equal(emailInp.disabled, false);
  assert.equal(passInp.disabled, false);
  assert.equal(emailInp.getAttribute('tabindex'), null);
});

test('Task 2: workoutResumeSession persists active exercise, auto-advances when finished, and restores live rest timer', () => {
  const storage = createMemoryStorage();
  const exercises = [
    { id: 'pullups', name: 'Overhand Pull-Ups', sets: 2 },
    { id: 'bench', name: 'Barbell Bench Press', sets: 3 }
  ];
  const baseNow = 1_750_000_000_000;

  // Finished pullups (2/2), so snapshot should auto-advance to bench (#2)
  const snap = buildActiveWorkoutSessionSnapshot({
    week: 2,
    dayIndex: 1,
    dayLabel: 'Week 2 • Day 2',
    exercises,
    workoutLogs: {
      w2_d1_pullups_s1: { done: true },
      w2_d1_pullups_s2: { done: true }
    },
    lastTouchedExerciseId: 'pullups',
    timerRunning: true,
    timerRemainingSec: 90,
    timerEndTimestampMs: baseNow + 90_000,
    nowMs: baseNow
  });

  assert.equal(snap.activeExerciseId, 'bench');
  assert.equal(snap.activeExerciseIndex, 1);
  assert.equal(snap.completedSets, 2);
  assert.equal(snap.totalSets, 5);

  assert.equal(saveActiveWorkoutSession(snap, storage), true);
  assert.ok(storage.getItem(ACTIVE_WORKOUT_SESSION_KEY));

  // Resume 30 seconds later -> rest timer should reflect 60 seconds left
  const restored = loadActiveWorkoutSession(storage, baseNow + 30_000);
  assert.ok(restored);
  assert.equal(restored!.activeExerciseId, 'bench');
  assert.equal(restored!.timerRunning, true);
  assert.equal(restored!.timerRemainingSec, 60);

  const banner = buildResumeWorkoutBannerCopy(restored);
  assert.equal(banner.visible, true);
  assert.match(banner.headline, /#2: Barbell Bench Press/);
  assert.match(banner.detail, /No login needed/);
  assert.equal(banner.ctaLabel, 'Resume #2');

  // Expired after > 18 hours
  const expired = loadActiveWorkoutSession(storage, baseNow + MAX_RESUME_SESSION_AGE_MS + 1000);
  assert.equal(expired, null);

  clearActiveWorkoutSession(storage);
  assert.equal(loadActiveWorkoutSession(storage, baseNow + 1000), null);
});

test('Task 3: realtimeScheduleSync syncs with live clock, offers 1-tap shift when behind, and builds prominent warm-up tips', () => {
  assert.equal(parseHHMMMinutesSafe('07:30'), 450);
  assert.equal(formatMinutes12Hour(450), '7:30 AM');

  // User planned 07:00 gym, opened app at 10:15 AM with 0 sets done -> suggests Sync Gym to 10:15 AM
  const lateDate = new Date(2026, 4, 10, 10, 15, 0);
  const lateCtx = computeLiveScheduleContext({
    nowDate: lateDate,
    gymTimeHHMM: '07:00',
    warmupType: 'lower',
    completedSetsToday: 0,
    isWorkoutComplete: false
  });
  assert.equal(lateCtx.isBehindScheduledGymTime, true);
  assert.equal(lateCtx.suggestShiftToNow, true);
  assert.equal(lateCtx.suggestedNowHHMM, '10:15');
  assert.equal(lateCtx.warmupQuickTips.length, 3);
  assert.match(lateCtx.warmupQuickTips[0], /leg swings/i);

  // User opens app right on time at 7:05 AM
  const onTimeCtx = computeLiveScheduleContext({
    nowDate: new Date(2026, 4, 10, 7, 5, 0),
    gymTimeHHMM: '07:00',
    warmupType: 'upper',
    completedSetsToday: 1,
    isWorkoutComplete: false
  });
  assert.equal(onTimeCtx.phaseKey, 'gym_window');
  assert.equal(onTimeCtx.suggestShiftToNow, false);

  const upperTips = buildProminentWarmupQuickTips('upper');
  assert.equal(upperTips.length, 3);
  assert.match(upperTips[2], /50%.*70%.*90%/);
});

test('Task 4: customProgramImporter parses CSV, JSON, plain text, PDF text, and next-week progression notes', () => {
  const csvPlan = [
    'Day,Exercise,Sets,Reps,Rest,Notes',
    'Day 1 Push,Barbell Bench Press,4,6-8,120,Keep shoulder blades tight',
    'Day 1 Push,Incline Dumbbell Press,3,8-10,90,',
    'Day 2 Legs,Barbell Squat,4,5-8,150,Brace core'
  ].join('\n');

  const csvRes = parseCustomWorkoutProgram(csvPlan, 'my-split.csv');
  assert.equal(csvRes.valid, true);
  assert.equal(csvRes.sourceFormat, 'csv');
  assert.equal(csvRes.days.length, 2);
  assert.equal(csvRes.totalExercises, 3);
  assert.equal(csvRes.days[1].warmupType, 'lower');

  const jsonPlan = JSON.stringify({
    programName: 'Coach 2-Day',
    days: [
      {
        dayName: 'Upper A',
        exercises: [{ name: 'Pull-Ups', sets: 3, reps: '8-12', rest: 90 }]
      }
    ]
  });
  const jsonRes = parseCustomWorkoutProgram(jsonPlan, 'coach.json');
  assert.equal(jsonRes.valid, true);
  assert.equal(jsonRes.programName, 'Coach 2-Day');
  assert.equal(jsonRes.days[0].exercises[0].name, 'Pull-Ups');

  const txtPlan = 'Day 1: Upper\nOverhead Press 3x8-10\nCable Row 3x10-12';
  const txtRes = parseCustomWorkoutProgram(txtPlan, 'routine.txt');
  assert.equal(txtRes.valid, true);
  assert.equal(txtRes.days[0].exercises.length, 2);
  assert.equal(txtRes.days[0].exercises[0].sets, 3);
  assert.equal(txtRes.days[0].exercises[0].reps, '8-10');

  const fakePdfText = '%PDF-1.4\nBT (Day 1: Lower) Tj (Goblet Squat 3x10) Tj ET';
  const pdfBytes = new Uint8Array(Array.from(fakePdfText).map((c) => c.charCodeAt(0)));
  const extracted = extractReadableTextFromPdfBytes(pdfBytes);
  assert.equal(extracted.isLikelyScannedImagePdf, false);
  const pdfParsed = parseCustomWorkoutProgram(extracted.text, 'coach-plan.pdf');
  assert.equal(pdfParsed.valid, true);
  assert.equal(pdfParsed.sourceFormat, 'pdf_text');
  assert.equal(pdfParsed.days[0].exercises[0].name, 'Goblet Squat');

  const emptyRes = parseCustomWorkoutProgram('   ', 'empty.txt');
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.errors.length > 0);

  assert.ok(NEXT_WEEK_NOTE_QUICK_CHIPS.length >= 4);
  const noteOk = buildNextWeekProgressionNote({
    exerciseId: 'bench',
    text: 'Add +5 lbs next week',
    quickTag: 'add_5_lbs'
  });
  assert.equal(noteOk.valid, true);
  assert.equal(noteOk.note?.text, 'Add +5 lbs next week');

  const noteTooLong = buildNextWeekProgressionNote({
    exerciseId: 'bench',
    text: 'x'.repeat(320)
  });
  assert.equal(noteTooLong.valid, false);
  assert.match(String(noteTooLong.errorMessage), /280/);
});

test('Task 5: strict pre-save validation rejects bad notes, timers, weights, and reps with ELI12 messages', () => {
  const cleanNote = validateWorkoutNoteText('Seat #4 <script>alert(1)</script>');
  assert.equal(cleanNote.valid, true);
  assert.equal(cleanNote.sanitizedValue.includes('<'), false);

  const tooLongNote = validateWorkoutNoteText('a'.repeat(300), 280);
  assert.equal(tooLongNote.valid, false);
  assert.match(String(tooLongNote.errorMessage), /280/);

  assert.equal(validateTimerDurationSeconds(90).valid, true);
  assert.equal(validateTimerDurationSeconds(2).valid, false);
  assert.equal(validateTimerDurationSeconds(9999).valid, false);

  const goodSet = validateExerciseSetEntry({ weight: '135', reps: '8', unit: 'lbs' });
  assert.equal(goodSet.valid, true);
  assert.equal(goodSet.sanitized.weight, 135);
  assert.equal(goodSet.sanitized.reps, 8);

  const badSet = validateExerciseSetEntry({ weight: '-15', reps: '0', unit: 'lbs' });
  assert.equal(badSet.valid, false);
  assert.ok(badSet.errors.length >= 2);
});

test('Zero Deletion Policy: index.html preserves all core buttons, modals, and new Task 1-5 hooks', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const requiredIds = [
    'smart-login-modal',
    'sync-settings-modal',
    'data-backup-migration-card',
    'force-sync-now-btn',
    'force-pull-cloud-btn',
    'toggle-warmup-btn',
    'warmup-card-container',
    'warmup-quick-tips-strip',
    'workout-resume-banner',
    'live-clock-schedule-banner',
    'custom-program-upload-react-mount'
  ];
  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `Expected index.html to preserve id="${id}"`);
  }
});
