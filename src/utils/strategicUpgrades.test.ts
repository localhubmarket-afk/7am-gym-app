import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IKEA_QUIZ_STEPS,
  adaptExerciseForEquipment,
  buildIkeaQuizProgram,
  createGuestSandboxStatePatch
} from './onboardingQuiz';
import {
  enqueueOfflineGymStateSync,
  flushOfflineGymStateQueue,
  readOfflineSyncQueue,
  type StorageAdapter
} from './offlineSyncQueue';
import {
  ACCESSIBLE_THEME_TOKENS,
  normalizeThemeModePreference,
  resolveEffectiveTheme,
  loadStoredThemePreference,
  saveThemePreference
} from './themeProvider';
import {
  detectCsvSourceApp,
  mapExternalExerciseToSchema,
  mergeImportedHistoryIntoGymState,
  parseWorkoutHistoryCsv
} from './csvHistoryImporter';
import { createSmartwatchBridge } from '../smartwatch/watchBridge';
import { computeAdherenceNeutralWeeklyProgress } from './adherenceEngine';
import { calculateEstimated1RM, evaluateSessionMicroWins } from './microWinsEngine';
import { computeExplainableProgressionMath } from './explainableMath';
import {
  parseNutritionLabelText,
  parseWeightStackText,
  scanNutritionLabelOCR,
  scanWeightMachineStackOCR
} from './visionOcrStub';
import {
  applyBiometricVolumeToExercises,
  calculateBiometricVolumeAdjustment,
  fetchAppleHealthKitBiometricsStub,
  fetchGoogleHealthConnectBiometricsStub
} from './biometricSync';

function createMemoryStorage(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    }
  };
}

test('Module 1: IKEA Quiz exposes 5 progressive single-action steps and adapts exercises to equipment & goal', () => {
  assert.equal(IKEA_QUIZ_STEPS.length, 5);
  assert.deepEqual(
    IKEA_QUIZ_STEPS.map((s) => s.id),
    ['goal', 'experience', 'equipment', 'schedule', 'diet']
  );

  const bench = { id: 'bench_press', name: 'Barbell Bench Press', sets: 4, reps: '8-12', equipType: 'barbell', equipLabel: 'Barbell' };
  const dbBench = adaptExerciseForEquipment(bench, 'dumbbells_only');
  assert.equal(dbBench.name, 'Dumbbell Flat Bench Press');
  assert.equal(dbBench.equipType, 'dumbbell');

  const bwBench = adaptExerciseForEquipment(bench, 'home_bodyweight');
  assert.equal(bwBench.name, 'Tempo Push-Ups');
  assert.equal(bwBench.isBodyweightRepsOnly, true);

  const sampleSchedule = [
    {
      dayName: 'Day 1',
      exercises: [
        { id: 'bench_press', name: 'Barbell Bench Press', sets: 4, reps: '8-12', equipType: 'barbell' }
      ]
    }
  ];

  const output = buildIkeaQuizProgram(
    {
      goal: 'get_stronger',
      experience: 'hard',
      equipment: 'machines_cables',
      daysPerWeek: 4,
      baseDiet: 'Vegetarian',
      intolerances: ['Dairy-Free']
    },
    [],
    sampleSchedule
  );

  assert.equal(output.programWizardConfig.goal, 'get_stronger');
  assert.equal(output.programWizardConfig.equipment, 'machines_cables');
  assert.equal(output.programWizardConfig.weeklyWorkoutTarget, 4);
  const adaptedFirstEx = output.workoutSchedule[0].exercises![0];
  assert.equal(adaptedFirstEx.name, 'Seated Chest Press Machine');
  assert.equal(adaptedFirstEx.reps, '5-6');

  const guestPatch = createGuestSandboxStatePatch(output, null);
  assert.equal(guestPatch.isGuestMode, true);
  assert.equal(guestPatch.userProfile.isGuest, true);
  assert.equal(guestPatch.userProfile.authProvider, 'guest_local');
  assert.equal(guestPatch.onboardingComplete, true);

  const realUserPatch = createGuestSandboxStatePatch(output, {
    name: 'François',
    email: 'francois@example.com',
    isGuest: false
  });
  assert.equal(realUserPatch.isGuestMode, false);
  assert.equal(realUserPatch.userProfile.email, 'francois@example.com');
});

test('Module 2: Local-first offline queue coalesces snapshots, pauses offline, and flushes when online', async () => {
  const storage = createMemoryStorage();
  const stateKey = 'budget_gym_local_test';

  const r1 = enqueueOfflineGymStateSync({
    stateObj: { selectedWeek: 2, workoutLogs: { w2_0_bench_1: { weight: '135', reps: '8', done: true } } },
    endpoint: '/api/state?user=guest',
    reason: 'offline_set_1',
    localStateStorageKey: stateKey,
    storage
  });
  assert.equal(r1.savedLocally, true);
  assert.equal(r1.queuedForCloud, true);
  assert.equal(r1.queueLength, 1);

  const r2 = enqueueOfflineGymStateSync({
    stateObj: { selectedWeek: 2, workoutLogs: { w2_0_bench_1: { weight: '140', reps: '8', done: true } } },
    endpoint: '/api/state?user=guest',
    reason: 'offline_set_2',
    localStateStorageKey: stateKey,
    storage
  });
  assert.equal(r2.queueLength, 1);
  assert.ok(storage.getItem(stateKey)?.includes('140'));

  let fetchCalls = 0;
  const offlineFlush = await flushOfflineGymStateQueue({
    storage,
    navigatorLike: { onLine: false },
    fetchImpl: (async () => {
      fetchCalls += 1;
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch
  });
  assert.equal(offlineFlush.online, false);
  assert.equal(offlineFlush.flushedCount, 0);
  assert.equal(offlineFlush.remainingCount, 1);
  assert.equal(fetchCalls, 0);

  const onlineFlush = await flushOfflineGymStateQueue({
    storage,
    navigatorLike: { onLine: true },
    fetchImpl: (async (_url, init) => {
      fetchCalls += 1;
      assert.equal(init?.method, 'POST');
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch
  });
  assert.equal(onlineFlush.online, true);
  assert.equal(onlineFlush.flushedCount, 1);
  assert.equal(onlineFlush.remainingCount, 0);
  assert.equal(readOfflineSyncQueue(storage).length, 0);
});

test('Module 2: Accessible Theme Provider resolves light/dark/system and persists preference', () => {
  assert.equal(normalizeThemeModePreference('LIGHT'), 'light');
  assert.equal(normalizeThemeModePreference('system'), 'system');
  assert.equal(normalizeThemeModePreference('invalid'), 'dark');

  assert.equal(resolveEffectiveTheme('light', true), 'light');
  assert.equal(resolveEffectiveTheme('dark', false), 'dark');
  assert.equal(resolveEffectiveTheme('system', true), 'dark');
  assert.equal(resolveEffectiveTheme('system', false), 'light');

  assert.notEqual(ACCESSIBLE_THEME_TOKENS.dark.canvasBg, '#000000');
  assert.notEqual(ACCESSIBLE_THEME_TOKENS.light.canvasBg, '#ffffff');

  const storage = createMemoryStorage();
  saveThemePreference('light', storage);
  assert.equal(loadStoredThemePreference(storage), 'light');
});

test('Module 2: CSV History Importer supports Strong, Hevy, and Fitbod without overwriting logged user sets', () => {
  const strongCsv = [
    'Date,Workout Name,Exercise Name,Set Order,Weight,Reps',
    '2026-11-10,Push Day,Bench Press (Barbell),1,135,8',
    '2026-11-10,Push Day,Pull Up,1,0,9'
  ].join('\n');
  const strongParsed = parseWorkoutHistoryCsv(strongCsv, { targetWeek: 1 });
  assert.equal(strongParsed.detectedApp, 'strong');
  assert.equal(strongParsed.importedSetsCount, 2);
  assert.equal(strongParsed.sets[0].mappedExerciseId, 'bench_press');
  assert.equal(strongParsed.sets[1].mappedExerciseId, 'day1_pullups');

  const hevyCsv = [
    'title,start_time,exercise_title,set_index,set_type,weight_lbs,reps',
    'Upper A,2026-11-12 07:00:00,Barbell Squat,0,warmup,95,5',
    'Upper A,2026-11-12 07:05:00,Barbell Squat,1,normal,185,6'
  ].join('\n');
  const hevyParsed = parseWorkoutHistoryCsv(hevyCsv, { targetWeek: 2 });
  assert.equal(hevyParsed.detectedApp, 'hevy');
  assert.equal(hevyParsed.importedSetsCount, 1);
  assert.equal(hevyParsed.skippedRowsCount, 1);
  assert.equal(hevyParsed.sets[0].weightLbs, 185);
  assert.equal(hevyParsed.sets[0].setOrder, 2);

  const fitbodCsv = [
    'Date,Exercise,Reps,Weight(kg),isWarmup',
    '2026-11-14,Romanian Deadlift,10,60,false'
  ].join('\n');
  const fitbodParsed = parseWorkoutHistoryCsv(fitbodCsv, { targetWeek: 3 });
  assert.equal(fitbodParsed.detectedApp, 'fitbod');
  assert.equal(fitbodParsed.importedSetsCount, 1);
  assert.equal(fitbodParsed.sets[0].mappedExerciseId, 'romanian_deadlift');
  assert.ok(fitbodParsed.sets[0].weightLbs >= 132 && fitbodParsed.sets[0].weightLbs <= 133);

  assert.equal(detectCsvSourceApp(['Date', 'Workout Name', 'Exercise Name', 'Set Order', 'Weight', 'Reps']), 'strong');
  assert.equal(mapExternalExerciseToSchema('Cable Face Pull').id, 'face_pull');

  const existingState = {
    workoutLogs: {
      w1_0_bench_press_1: { weight: '150', reps: '5', done: true, isLogged: true }
    },
    exerciseHistory: {}
  };
  const merged = mergeImportedHistoryIntoGymState(existingState, strongParsed);
  assert.equal(merged.nextState.workoutLogs.w1_0_bench_press_1.weight, '150');
  assert.ok(merged.nextState.workoutLogs.w1_0_day1_pullups_1);
  assert.equal(merged.addedLogsCount, 1);
  assert.equal(merged.addedHistoryPoints, 2);
});

test('Module 2: Smartwatch Bridge dispatches active set, rest timer, and haptics to watchOS and Wear OS stubs', async () => {
  const bridge = createSmartwatchBridge();
  const setResults = await bridge.broadcastActiveSet({
    week: 1,
    dayIdx: 0,
    exerciseId: 'bench_press',
    exerciseName: 'Barbell Bench Press',
    setNumber: 1,
    totalSets: 4,
    targetReps: '8-12',
    targetWeight: 135,
    unit: 'lbs'
  });
  assert.equal(setResults.length, 2);
  assert.equal(setResults[0].platform, 'watchos');
  assert.equal(setResults[0].ok, true);
  assert.equal(setResults[0].isStub, true);
  assert.equal(setResults[1].platform, 'wearos');
  assert.equal(setResults[1].ok, true);
  assert.equal(setResults[1].isStub, true);

  const hapticResults = await bridge.broadcastHaptic('rest_complete');
  assert.equal(hapticResults.every((r) => r.ok && r.isStub), true);
});

test('Module 3: Adherence-Neutral Engine counts flexible weekly days and NEVER resets streaks to zero', () => {
  const summary = computeAdherenceNeutralWeeklyProgress({
    weekNumber: 2,
    weeklyTarget: 5,
    workoutLogs: {
      w2_2_bench_press_1: { weight: '135', reps: '8', done: true },
      w2_4_barbell_squat_1: { weight: '185', reps: '6', done: true }
    },
    cardioLogs: {
      w2_d6_cardio_incline_walk: { done: true }
    }
  });

  assert.equal(summary.completedWorkoutsCount, 3);
  assert.equal(summary.weeklyTarget, 5);
  assert.equal(summary.percentComplete, 60);
  assert.equal(summary.remainingWorkouts, 2);
  assert.equal(summary.streakResetApplied, false);
  assert.match(summary.statusLabel, /3 of 5 workouts completed this week/i);
});

test('Module 3: Micro-Wins Engine celebrates all 4 PR categories (Weight, Reps, Volume, Estimated 1RM)', () => {
  assert.equal(calculateEstimated1RM(100, 1), 100);
  assert.equal(calculateEstimated1RM(100, 10), 133.3);

  const priorLogs = {
    w1_0_bench_press_1: { weight: '100', reps: '8', done: true, unit: 'lbs' },
    w1_0_bench_press_2: { weight: '100', reps: '8', done: true, unit: 'lbs' }
  };

  const result = evaluateSessionMicroWins({
    currentSessionSets: [
      { exerciseId: 'bench_press', exerciseName: 'Barbell Bench Press', weight: 110, reps: 8, unit: 'lbs' },
      { exerciseId: 'bench_press', exerciseName: 'Barbell Bench Press', weight: 100, reps: 10, unit: 'lbs' }
    ],
    priorWorkoutLogs: priorLogs,
    currentWeek: 2,
    currentDayIdx: 0,
    displayUnit: 'lbs'
  });

  assert.equal(result.hasAnyPr, true);
  const categories = result.wins.map((w) => w.category);
  assert.ok(categories.includes('heaviest_weight'));
  assert.ok(categories.includes('highest_reps'));
  assert.ok(categories.includes('highest_volume'));
  assert.ok(categories.includes('improved_e1rm'));
  assert.equal(result.wins.length, 4);
});

test('Module 4: Explainable Math generates exact formula and plain-English explanation', () => {
  const res = computeExplainableProgressionMath({
    exerciseName: 'Barbell Bench Press',
    currentWeek: 2,
    targetSets: 4,
    targetRepsLabel: '8-12',
    targetWeight: 105,
    unit: 'lbs',
    previousWeight: 100,
    previousReps: 8,
    completedAllPreviousReps: true,
    biometricSleepHours: 4.5
  });

  assert.equal(
    res.plainEnglishExplanation,
    'Last week you did 100lbs for 8 reps. Target increased by 5lbs due to completing all reps.'
  );
  assert.equal(res.incrementApplied, 5);
  assert.ok(res.formulaSteps.some((step) => step.includes('100 + 5 = 105 lbs')));
  assert.ok(res.formulaSteps.some((step) => step.includes('4.5h sleep')));
});

test('Module 4: Computer Vision OCR Stubs parse pin-loaded weight machines and nutrition labels', async () => {
  const pinParsed = parseWeightStackText('STACK PIN 125 LBS', 'lbs');
  assert.equal(pinParsed.weight, 125);
  assert.equal(pinParsed.unit, 'lbs');

  const kgPin = await scanWeightMachineStackOCR({ simulatedLabelText: 'PIN 55 KG', preferredUnit: 'kg' });
  assert.equal(kgPin.mode, 'weight_machine');
  assert.equal(kgPin.detectedWeight, 55);
  assert.equal(kgPin.unit, 'kg');

  const labelParsed = parseNutritionLabelText(
    'Serving Size: 1 scoop (32g)\nCalories: 130\nTotal Fat: 2g\nTotal Carbohydrates: 3g\nProtein: 25g'
  );
  assert.equal(labelParsed.calories, 130);
  assert.equal(labelParsed.proteinGrams, 25);
  assert.equal(labelParsed.carbsGrams, 3);
  assert.equal(labelParsed.fatGrams, 2);

  const labelOcr = await scanNutritionLabelOCR();
  assert.equal(labelOcr.mode, 'nutrition_label');
  assert.ok(labelOcr.calories > 0 && labelOcr.proteinGrams > 0);
});

test('Module 4: Biometric Sync reduces prescribed workout sets by 10% when sleep is under 5 hours', async () => {
  const normalApple = await fetchAppleHealthKitBiometricsStub({ sleepHours: 7.5, dailySteps: 8200 });
  const normalAdj = calculateBiometricVolumeAdjustment(20, normalApple);
  assert.equal(normalAdj.volumeMultiplier, 1.0);
  assert.equal(normalAdj.adjustedTotalSets, 20);

  const lowSleepGoogle = await fetchGoogleHealthConnectBiometricsStub({ sleepHours: 4.5, dailySteps: 9000 });
  const lowSleepAdj = calculateBiometricVolumeAdjustment(20, lowSleepGoogle);
  assert.equal(lowSleepAdj.volumeMultiplier, 0.9);
  assert.equal(lowSleepAdj.reductionPercent, 10);
  assert.equal(lowSleepAdj.adjustedTotalSets, 18);

  const exercises = [
    { id: 'ex1', sets: 4 },
    { id: 'ex2', sets: 4 },
    { id: 'ex3', sets: 4 },
    { id: 'ex4', sets: 4 },
    { id: 'ex5', sets: 4 }
  ];
  const applied = applyBiometricVolumeToExercises(exercises, lowSleepGoogle);
  const newTotalSets = applied.exercises.reduce((sum, ex) => sum + ex.sets, 0);
  assert.equal(newTotalSets, 18);
  assert.ok(applied.exercises.every((ex) => ex.sets >= 1));
});
