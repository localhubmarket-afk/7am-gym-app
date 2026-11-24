import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyVoiceLogToGymState,
  normalizeSpokenNumbers,
  parseSpokenSetPhrase,
  revertVoiceLogFromGymState
} from './voiceToLog';
import { calculateDoubleProgressionTarget } from './doubleProgressionEngine';
import {
  PLAIN_LANGUAGE_COACH_SYSTEM_INSTRUCTION,
  buildBoundedProgressionSnapshot,
  requestPlainLanguageCoachExplanation
} from './plainLanguageCoach';
import {
  LOW_SPOONS_PRESETS,
  applyLowSpoonsPresetToExercises,
  classifyLowSpoonsWithGemini,
  mapClassificationToValidatedPreset
} from './lowSpoonsTriage';
import {
  calculateBiometricVolumeAdjustment,
  syncDailyBiometricsToSupabase
} from './biometricSync';

test('Task 1: parseSpokenSetPhrase parses natural spoken phrases including number words and units', () => {
  assert.equal(normalizeSpokenNumbers('Did ten reps at forty five pounds'), 'did 10 reps at 45 pounds');

  const p1 = parseSpokenSetPhrase('Did 10 reps at 45 pounds');
  assert.equal(p1.ok, true);
  assert.equal(p1.reps, 10);
  assert.equal(p1.weight, 45);
  assert.equal(p1.unit, 'lbs');

  const p2 = parseSpokenSetPhrase('Set 2 bench press 8 reps at 60 kg');
  assert.equal(p2.ok, true);
  assert.equal(p2.reps, 8);
  assert.equal(p2.weight, 60);
  assert.equal(p2.unit, 'kg');
  assert.equal(p2.setNumberHint, 2);
  assert.equal(p2.exerciseHint, 'bench press');

  const p3 = parseSpokenSetPhrase('Bodyweight nine pull ups');
  assert.equal(p3.ok, true);
  assert.equal(p3.reps, 9);
  assert.equal(p3.weight, 0);
  assert.equal(p3.isBodyweight, true);

  const invalid = parseSpokenSetPhrase('just checking in');
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errorMessage && invalid.errorMessage.length > 0);
});

test('Task 1: applyVoiceLogToGymState and 1-tap revertVoiceLogFromGymState restore exact state', () => {
  const initialState = {
    currentWeek: 1,
    selectedDayIndex: 0,
    workoutLogs: {
      w1_0_mon_bench_1: { weight: '135', reps: '8', done: true, unit: 'lbs' }
    },
    pullupLogs: {}
  };

  const parsed = parseSpokenSetPhrase('Did 10 reps at 45 pounds');
  const applied = applyVoiceLogToGymState(initialState, parsed, {
    week: 1,
    daySlotIndex: 0,
    exerciseId: 'mon_bench',
    exerciseName: 'Barbell Bench Press',
    setNumber: 2,
    defaultUnit: 'lbs',
    defaultWeight: 135
  });

  assert.equal(applied.nextState.workoutLogs['w1_0_mon_bench_2'].reps, '10');
  assert.equal(applied.nextState.workoutLogs['w1_0_mon_bench_2'].weight, '45');
  assert.equal(applied.nextState.workoutLogs['w1_0_mon_bench_2'].done, true);
  assert.equal(applied.nextState.workoutLogs['0_mon_bench_2'].reps, '10');

  const reverted = revertVoiceLogFromGymState(applied.nextState, applied.undoRecord);
  assert.equal(reverted.nextState.workoutLogs['w1_0_mon_bench_2'], undefined);
  assert.equal(reverted.nextState.workoutLogs['0_mon_bench_2'], undefined);
  assert.equal(reverted.nextState.workoutLogs['w1_0_mon_bench_1'].weight, '135');
});

test('Task 2: Plain-Language Coach uses frozen deterministic math snapshot and never alters targets', async () => {
  const prog = calculateDoubleProgressionTarget({
    exerciseName: 'Barbell Squat',
    targetSets: 3,
    repRangeLabel: '8-10',
    baselineWeight: 135,
    unit: 'lbs',
    completedSets: [
      { weight: 135, reps: 10, done: true },
      { weight: 135, reps: 10, done: true },
      { weight: 135, reps: 10, done: true }
    ]
  });

  assert.equal(prog.action, 'increase_weight');
  assert.equal(prog.nextTargetWeight, 140);
  assert.equal(prog.weightDelta, 5);

  const snapshot = buildBoundedProgressionSnapshot(prog);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.match(PLAIN_LANGUAGE_COACH_SYSTEM_INSTRUCTION, /NEVER calculate new numbers/i);
  assert.match(PLAIN_LANGUAGE_COACH_SYSTEM_INSTRUCTION, /Grade 6 to 8/i);

  const mockFetch = (async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      model: 'gemini-4-hydrogen',
      explanation: 'You hit 10 reps on every set last week, so your weight went up by 5 pounds to 140 pounds.',
      keyTakeaway: 'Aim for 8 smooth reps per set today.'
    })
  })) as unknown as typeof fetch;

  const coachRes = await requestPlainLanguageCoachExplanation(snapshot, { fetchImpl: mockFetch });
  assert.equal(coachRes.ok, true);
  assert.equal(coachRes.mathWasAltered, false);
  assert.equal(coachRes.lockedMathSnapshot.nextTargetWeight, 140);
  assert.match(coachRes.plainLanguageExplanation || '', /5 pounds/i);

  // Ensure missing-key or upstream errors are surfaced cleanly, never silently masked
  const errorFetch = (async () => ({
    ok: false,
    json: async () => ({ ok: false, error: 'Gemini API key is not configured on the server.' })
  })) as unknown as typeof fetch;

  const failedRes = await requestPlainLanguageCoachExplanation(snapshot, { fetchImpl: errorFetch });
  assert.equal(failedRes.ok, false);
  assert.equal(failedRes.plainLanguageExplanation, null);
  assert.match(failedRes.error || '', /API key/i);
});

test('Task 3: Low-Spoons Triage maps strictly to pre-validated presets and swaps barbells to machines', async () => {
  // Invalid or unexpected LLM string cannot inject arbitrary scaling; safely maps to mild_fatigue
  const safeFallback = mapClassificationToValidatedPreset('delete_all_sets_999');
  assert.equal(safeFallback.presetId, 'volume_trim_20');
  assert.equal(safeFallback.volumeReductionPercent, 20);

  const sampleDay = [
    { id: 'sq', name: 'Barbell Back Squat', sets: 4, reps: '8-10' },
    { id: 'bp', name: 'Barbell Bench Press', sets: 3, reps: '8-10' },
    { id: 'rw', name: 'Barbell Row', sets: 3, reps: '10-12' }
  ];

  // -20% volume only (10 sets -> 8 sets, no swaps)
  const mildResult = applyLowSpoonsPresetToExercises(sampleDay, LOW_SPOONS_PRESETS.mild_fatigue);
  assert.equal(mildResult.originalTotalSets, 10);
  assert.equal(mildResult.adjustedTotalSets, 8);
  assert.equal(mildResult.exercises[0].name, 'Barbell Back Squat');

  // High fatigue / sensory overload (-20% volume + stable machine swaps)
  const overloadResult = applyLowSpoonsPresetToExercises(
    sampleDay,
    LOW_SPOONS_PRESETS.high_fatigue_or_overload
  );
  assert.equal(overloadResult.adjustedTotalSets, 8);
  assert.equal(overloadResult.exercises[0].name, 'Seated Leg Press Machine');
  assert.equal(overloadResult.exercises[1].name, 'Seated Chest Press Machine');
  assert.equal(overloadResult.exercises[2].name, 'Chest-Supported Seated Row Machine');

  // Empty check-in validation
  const emptyRes = await classifyLowSpoonsWithGemini('   ');
  assert.equal(emptyRes.ok, false);

  // Mocked Gemini JSON classification
  const triageFetch = (async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      model: 'gemini-4-hydrogen',
      severityTier: 'high_fatigue_or_overload',
      reassurance: 'Bright lights drain energy fast. Switching to seated machines is a smart move today.'
    })
  })) as unknown as typeof fetch;

  const classified = await classifyLowSpoonsWithGemini('Bright lights and brain fog today', {
    fetchImpl: triageFetch
  });
  assert.equal(classified.ok, true);
  assert.equal(classified.severityTier, 'high_fatigue_or_overload');
  assert.equal(classified.preset.swapBarbellToMachines, true);
  assert.equal(classified.preset.volumeReductionPercent, 20);
});

test('Task 4: Biometric recovery context supports resting heart rate & Supabase sync', async () => {
  const elevatedRhr = calculateBiometricVolumeAdjustment(10, {
    sleepHours: 6.5,
    dailySteps: 7200,
    restingHeartRateBpm: 72,
    baselineRestingHeartRateBpm: 60
  });
  assert.equal(elevatedRhr.reasonCode, 'elevated_rhr_recovery');
  assert.equal(elevatedRhr.reductionPercent, 10);
  assert.equal(elevatedRhr.adjustedTotalSets, 9);

  const comboFatigue = calculateBiometricVolumeAdjustment(10, {
    sleepHours: 4.2,
    dailySteps: 8000,
    restingHeartRateBpm: 75,
    baselineRestingHeartRateBpm: 60
  });
  assert.equal(comboFatigue.reasonCode, 'high_fatigue_combo');
  assert.equal(comboFatigue.reductionPercent, 15);

  let sentBody: Record<string, any> | null = null;
  const bioFetch = (async (_url: string, init?: RequestInit) => {
    sentBody = JSON.parse(String(init?.body || '{}'));
    return {
      ok: true,
      json: async () => ({ ok: true, configured: true, saved: true, biometrics: sentBody })
    };
  }) as unknown as typeof fetch;

  const syncRes = await syncDailyBiometricsToSupabase({
    accountKey: 'athlete@7amgym.app',
    snapshot: {
      provider: 'apple_healthkit',
      dateIso: '2026-11-24',
      sleepHours: 7.4,
      dailySteps: 9800,
      restingHeartRateBpm: 58,
      syncedAt: '2026-11-24T07:00:00.000Z',
      isStub: false
    },
    fetchImpl: bioFetch
  });
  assert.equal(syncRes.ok, true);
  assert.equal(syncRes.saved, true);
  assert.equal(sentBody?.restingHeartRateBpm, 58);
});

test('Task 4 & Security & Zero Deletion: Native watchOS/WearOS files, SQL migration, @google/genai, and existing HTML anchors exist', () => {
  const root = process.cwd();
  const requiredFiles = [
    'api/gemini.js',
    'api/biometrics.js',
    'server.ts',
    'supabase/migrations/20261124_daily_biometrics.sql',
    'native/watchos/BudgetGymWatchApp.swift',
    'native/watchos/SupabaseWatchClient.swift',
    'native/watchos/HealthKitBiometricManager.swift',
    'native/wearos/BudgetGymWearApp.kt',
    'native/wearos/SupabaseWearClient.kt',
    'native/wearos/HealthConnectBiometricManager.kt'
  ];

  for (const rel of requiredFiles) {
    const full = path.join(root, rel);
    assert.equal(fs.existsSync(full), true, `Missing required file: ${rel}`);
  }

  const geminiServerSrc = fs.readFileSync(path.join(root, 'api/gemini.js'), 'utf8');
  assert.match(geminiServerSrc, /@google\/genai/);
  assert.match(geminiServerSrc, /gemini-4-hydrogen/);
  assert.match(geminiServerSrc, /aistudio-build/);

  const swiftClient = fs.readFileSync(path.join(root, 'native/watchos/SupabaseWatchClient.swift'), 'utf8');
  assert.match(swiftClient, /kSecClassGenericPassword/);
  assert.match(swiftClient, /daily_biometrics/);

  const swiftHealth = fs.readFileSync(path.join(root, 'native/watchos/HealthKitBiometricManager.swift'), 'utf8');
  assert.match(swiftHealth, /sleepAnalysis/);
  assert.match(swiftHealth, /stepCount/);
  assert.match(swiftHealth, /restingHeartRate/);

  const kotlinClient = fs.readFileSync(path.join(root, 'native/wearos/SupabaseWearClient.kt'), 'utf8');
  assert.match(kotlinClient, /EncryptedSharedPreferences/);
  assert.match(kotlinClient, /daily_biometrics/);

  const kotlinHealth = fs.readFileSync(path.join(root, 'native/wearos/HealthConnectBiometricManager.kt'), 'utf8');
  assert.match(kotlinHealth, /SleepSessionRecord/);
  assert.match(kotlinHealth, /StepsRecord/);
  assert.match(kotlinHealth, /RestingHeartRateRecord/);

  // Zero Deletion Policy check on index.html
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="accessible-video-guide-card"/);
  assert.match(html, /id="phase2-accessibility-hub-card"/);
  assert.match(html, /id="weekly-adherence-neutral-card"/);
  assert.match(html, /id="biometric-readiness-banner"/);
  assert.match(html, /id="explainable-math-modal"/);
  assert.match(html, /id="open-ai-coach-from-math-btn"/);
});
