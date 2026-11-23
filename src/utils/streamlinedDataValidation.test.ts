import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVAILABLE_OAUTH_LOGIN_PROVIDERS,
  DELETE_ACCOUNT_MAIN_WARNING,
  POST_DELETE_SELECT_ACCOUNT_PROMPT,
  onDeleteSuccess
} from './deletionValidation';
import {
  buildStartFreshGymState,
  executeStartFreshAndPushToSupabase
} from './startFreshReset';
import { computeAdherenceNeutralWeeklyProgress } from './adherenceEngine';
import { createAutoSupabaseSyncEngine } from './workoutSyncEngine';
import {
  HEAVY_WEIGHT_MULTIPLIER_THRESHOLD,
  buildHeavyWeightWarningMessage,
  getHistoricalMaxWeightForExercise,
  validateSetWeightSanity
} from './workoutSanityCheck';

test('Task 1: Streamlined Account Deletion copy and onDeleteSuccess OAuth picker trigger', () => {
  assert.equal(
    DELETE_ACCOUNT_MAIN_WARNING,
    'Are you sure you want to delete this account forever? All your saved workouts and meals will be gone.'
  );
  assert.equal(DELETE_ACCOUNT_MAIN_WARNING.toLowerCase().includes('supabase'), false);
  assert.equal(DELETE_ACCOUNT_MAIN_WARNING.toLowerCase().includes('database'), false);

  assert.equal(
    POST_DELETE_SELECT_ACCOUNT_PROMPT,
    'Account deleted. Please select your active account to continue.'
  );
  assert.deepEqual([...AVAILABLE_OAUTH_LOGIN_PROVIDERS], ['Google', 'Apple']);

  let openedModalPayload: any = null;
  const result = onDeleteSuccess({
    deletedEmail: 'olduser@7amgym.app',
    secondaryAccount: null,
    onOpenAccountSelectModal: (payload) => {
      openedModalPayload = payload;
    }
  });

  assert.equal(result.shouldOpenAccountSelectModal, true);
  assert.equal(result.modalPrompt, 'Account deleted. Please select your active account to continue.');
  assert.deepEqual(result.oauthProviders, ['Google', 'Apple']);
  assert.ok(openedModalPayload);
  assert.equal(openedModalPayload.modalPrompt, POST_DELETE_SELECT_ACCOUNT_PROMPT);
});

test('Task 2: Start Fresh completely clears workouts, fuel logs, fridge batch prep (oats/rice), and shopping list', () => {
  const populatedState = {
    userProfile: { name: 'François', email: 'francois@7amgym.app', isGuest: false, authProvider: 'google' },
    themeMode: 'light',
    weeklyWorkoutTarget: 5,
    currentWeek: 3,
    selectedWeek: 3,
    maxUnlockedWeek: 3,
    completedWeeks: { 1: true, 2: true },
    workoutLogs: {
      w1_0_mon_bench_1: { weight: '135', reps: '8', done: true },
      w3_0_mon_bench_1: { weight: '145', reps: '8', done: true }
    },
    pullupLogs: { w1_day_1_set_1: { reps: '6', done: true } },
    cardioLogs: { w1_d2_cardio_bike: { done: true } },
    exerciseHistory: { mon_bench: [{ weight: 145, reps: 8 }] },
    fuelLogs: { w1_d0: { calories: 2100 } },
    checkedMeals: { w1_d0_pre_shake: true, w1_d0_lunch: true },
    checkedMealIngredients: { w1_d0_post_m1_oats_jar: true },
    waterIntakeLogs: { w1_d0: 2500 },
    quickAddCaloriesByDay: { w1_d0: [{ kcal: 300, protein: 25 }] },
    flexMealOverridesByDay: { w1_d0_lunch: { name: 'Tofu Bowl' } },
    batchInventory: {
      oatsJarsRemaining: 4,
      riceBowlsRemaining: 3,
      oatsPrepDay: 'Sun',
      ricePrepDay: 'Wed'
    },
    oatsPrepDay: 'Sun',
    ricePrepDay: 'Wed',
    recipePrepLogs: { rice_step_1: true, rice_step_2: true },
    activeRiceTimerStage: 2,
    riceCookPhaseCompleted: true,
    riceCooldownPhaseCompleted: true,
    riceTimerAlertBanner: 'Rice ready!',
    checkedEssentials: { tofu: true, oats: true },
    checkedGroceries: { bananas: true },
    customShoppingItems: [{ id: 'c1', name: 'Tempeh' }],
    shopBrandOverrides: { protein_powder: 'vega' }
  };

  const { nextState, clearedSummary } = buildStartFreshGymState(populatedState);

  // 1. Logged workouts cleared
  assert.deepEqual(nextState.workoutLogs, {});
  assert.deepEqual(nextState.pullupLogs, {});
  assert.deepEqual(nextState.cardioLogs, {});
  assert.deepEqual(nextState.exerciseHistory, {});
  assert.deepEqual(nextState.completedWeeks, {});
  assert.equal(nextState.currentWeek, 1);
  assert.equal(nextState.selectedWeek, 1);

  // 2. Fuel logs cleared
  assert.deepEqual(nextState.fuelLogs, {});
  assert.deepEqual(nextState.checkedMeals, {});
  assert.deepEqual(nextState.checkedMealIngredients, {});
  assert.deepEqual(nextState.waterIntakeLogs, {});
  assert.deepEqual(nextState.quickAddCaloriesByDay, {});
  assert.deepEqual(nextState.flexMealOverridesByDay, {});

  // 3. Batch prep variables (oats & rice in fridge) cleared
  assert.equal(nextState.batchInventory.oatsJarsRemaining, 0);
  assert.equal(nextState.batchInventory.riceBowlsRemaining, 0);
  assert.equal(nextState.batchInventory.oatsPrepDay, null);
  assert.equal(nextState.batchInventory.ricePrepDay, null);
  assert.equal(nextState.oatsPrepDay, null);
  assert.equal(nextState.ricePrepDay, null);
  assert.deepEqual(nextState.recipePrepLogs, {});
  assert.equal(nextState.activeRiceTimerStage, null);
  assert.equal(nextState.riceCookPhaseCompleted, false);
  assert.equal(nextState.riceCooldownPhaseCompleted, false);

  // 4. Shopping list cleared
  assert.deepEqual(nextState.checkedEssentials, {});
  assert.deepEqual(nextState.checkedGroceries, {});
  assert.deepEqual(nextState.customShoppingItems, []);
  assert.deepEqual(nextState.shopBrandOverrides, {});

  // Account & theme preserved cleanly
  assert.equal(nextState.userProfile.email, 'francois@7amgym.app');
  assert.equal(nextState.themeMode, 'light');
  assert.ok(clearedSummary.clearedWorkoutsCount >= 4);
  assert.ok(clearedSummary.clearedFuelEntriesCount >= 6);
  assert.ok(clearedSummary.clearedShoppingItemsCount >= 4);
});

test('Task 3: Connected Adherence-Neutral Weekly Goal reads workoutLogs and drops immediately to 0 after Start Fresh', () => {
  const beforeResetState = {
    weeklyWorkoutTarget: 5,
    workoutLogs: {
      w1_0_mon_bench_1: { weight: '100', reps: '8', done: true },
      w1_1_tue_squat_1: { weight: '135', reps: '8', done: true },
      w1_2_thu_inc_db_1: { weight: '45', reps: '10', done: true }
    },
    pullupLogs: {},
    cardioLogs: {}
  };

  const beforeSummary = computeAdherenceNeutralWeeklyProgress({
    weekNumber: 1,
    weeklyTarget: beforeResetState.weeklyWorkoutTarget,
    workoutLogs: beforeResetState.workoutLogs,
    pullupLogs: beforeResetState.pullupLogs,
    cardioLogs: beforeResetState.cardioLogs
  });
  assert.equal(beforeSummary.completedWorkoutsCount, 3);
  assert.equal(beforeSummary.statusLabel, '3 of 5 workouts completed this week');

  const { nextState } = buildStartFreshGymState(beforeResetState);
  const afterSummary = computeAdherenceNeutralWeeklyProgress({
    weekNumber: nextState.selectedWeek,
    weeklyTarget: nextState.weeklyWorkoutTarget,
    workoutLogs: nextState.workoutLogs,
    pullupLogs: nextState.pullupLogs,
    cardioLogs: nextState.cardioLogs
  });
  assert.equal(afterSummary.completedWorkoutsCount, 0);
  assert.equal(afterSummary.percentComplete, 0);
  assert.equal(afterSummary.statusLabel, '0 of 5 workouts completed this week');
});

test('Task 4: 250% Historical Max Sanity Check triggers warning toast on 1st tap and saves on 2nd tap', () => {
  assert.equal(HEAVY_WEIGHT_MULTIPLIER_THRESHOLD, 2.5);
  assert.equal(
    buildHeavyWeightWarningMessage(300, 'lbs'),
    'That looks heavy! Did you mean to log 300 lbs?'
  );

  const workoutLogs = {
    w1_0_mon_bench_1: { weight: '100', reps: '8', done: true },
    w1_0_mon_bench_2: { weight: '100', reps: '8', done: true }
  };

  const histMax = getHistoricalMaxWeightForExercise({
    exerciseId: 'mon_bench',
    workoutLogs
  });
  assert.equal(histMax, 100);

  // Exactly 250% (250 lbs) does NOT exceed 250% -> allowed on 1st tap
  const atLimit = validateSetWeightSanity({
    exerciseId: 'mon_bench',
    setKey: 'w2_0_mon_bench_1',
    enteredWeight: 250,
    unit: 'lbs',
    workoutLogs
  });
  assert.equal(atLimit.allowed, true);
  assert.equal(atLimit.requiresSecondTap, false);

  // 300 lbs exceeds 250% of 100 lbs -> 1st tap blocked with exact toast warning
  const firstTap = validateSetWeightSanity({
    exerciseId: 'mon_bench',
    setKey: 'w2_0_mon_bench_1',
    enteredWeight: 300,
    unit: 'lbs',
    workoutLogs,
    pendingConfirmationKey: null
  });
  assert.equal(firstTap.allowed, false);
  assert.equal(firstTap.requiresSecondTap, true);
  assert.equal(firstTap.warningMessage, 'That looks heavy! Did you mean to log 300 lbs?');
  assert.ok(firstTap.confirmationKey);

  // 2nd tap on Log Set with same weight -> bypasses warning & forces save
  const secondTap = validateSetWeightSanity({
    exerciseId: 'mon_bench',
    setKey: 'w2_0_mon_bench_1',
    enteredWeight: 300,
    unit: 'lbs',
    workoutLogs,
    pendingConfirmationKey: firstTap.confirmationKey
  });
  assert.equal(secondTap.allowed, true);
  assert.equal(secondTap.bypassedWarning, true);
  assert.equal(secondTap.warningMessage, null);

  // Changing weight to a different heavy weight (400 lbs) re-triggers the check
  const differentHeavyTap = validateSetWeightSanity({
    exerciseId: 'mon_bench',
    setKey: 'w2_0_mon_bench_1',
    enteredWeight: 400,
    unit: 'lbs',
    workoutLogs,
    pendingConfirmationKey: firstTap.confirmationKey
  });
  assert.equal(differentHeavyTap.allowed, false);
  assert.equal(differentHeavyTap.warningMessage, 'That looks heavy! Did you mean to log 400 lbs?');
});

test('Task 5 (Strict Start Fresh Patch): Bypasses empty-state cloud guard, overwrites Supabase immediately, scrubs cached account logs, and drops 4 of 5 to 0 of 5', async () => {
  // Simulate user stuck at "4 of 5 workouts completed this week" with 12 sets already saved in Supabase
  let liveState: Record<string, any> = {
    userProfile: { name: 'François', email: 'francois@7amgym.app', isGuest: false, authProvider: 'google' },
    weeklyWorkoutTarget: 5,
    currentWeek: 1,
    selectedWeek: 1,
    workoutLogs: {
      w1_0_mon_bench_1: { weight: '135', reps: '8', done: true },
      w1_1_tue_squat_1: { weight: '185', reps: '8', done: true },
      w1_2_thu_inc_db_1: { weight: '55', reps: '10', done: true },
      w1_3_fri_rdl_1: { weight: '205', reps: '8', done: true }
    },
    pullupLogs: { w1_day_1_set_1: { reps: '5', done: true } },
    fuelLogs: { w1_d0: { kcal: 2200 } },
    checkedGroceries: { oats: true, tofu: true },
    batchInventory: { oatsJarsRemaining: 4, riceBowlsRemaining: 4, oatsPrepDay: 'Sun', ricePrepDay: 'Sun' },
    accountsByEmail: {
      'francois@7amgym.app': {
        workoutLogs: { w1_0_mon_bench_1: { weight: '135', reps: '8', done: true } },
        pullupLogs: { w1_day_1_set_1: { reps: '5', done: true } },
        snapshot: {
          workoutLogs: { w1_0_mon_bench_1: { weight: '135', reps: '8', done: true } }
        }
      }
    }
  };

  // Before reset: "4 of 5 workouts completed this week"
  const before = computeAdherenceNeutralWeeklyProgress({
    weekNumber: 1,
    weeklyTarget: 5,
    workoutLogs: liveState.workoutLogs,
    pullupLogs: liveState.pullupLogs
  });
  assert.equal(before.completedWorkoutsCount, 4);
  assert.equal(before.statusLabel, '4 of 5 workouts completed this week');

  // 1. Verify Start Fresh engine pushes through AutoSupabaseSyncEngine even when cloud had 12 logged sets & undo window is active
  const postedPayloads: any[] = [];
  const fakeFetch: typeof fetch = (async (_url: any, init?: any) => {
    postedPayloads.push(JSON.parse(String(init?.body || '{}')));
    return {
      ok: true,
      json: async () => ({ configured: true, saved: true, overwrittenBaseline: true, last_updated: '2026-11-23T17:15:00.000Z' })
    } as any;
  }) as typeof fetch;

  const syncEngine = createAutoSupabaseSyncEngine({
    getState: () => liveState,
    getEndpoint: () => '/api/state?email=francois%407amgym.app',
    fetchImpl: fakeFetch
  });
  syncEngine.recordKnownCloudLoggedSetCount(12);
  syncEngine.scheduleDestructiveOverwritePush(5000); // simulate active 5s delay window

  // Pass a populated DEFAULT_STATE as baselineDefaults to prove seeded logs are NEVER inherited
  const { nextState } = buildStartFreshGymState(liveState, {
    workoutLogs: { w1_0_mon_bench_1: { weight: '45', reps: '8', done: true } }
  });
  liveState = nextState;

  assert.deepEqual(liveState.workoutLogs, {});
  assert.deepEqual(liveState.pullupLogs, {});
  assert.deepEqual(liveState.fuelLogs, {});
  assert.deepEqual(liveState.checkedGroceries, {});
  assert.equal(liveState.batchInventory.oatsJarsRemaining, 0);
  assert.equal(liveState.batchInventory.riceBowlsRemaining, 0);
  assert.equal(liveState.hasStartedFresh, true);
  assert.equal(liveState.francoisWeek1RestoredV2, true);
  assert.deepEqual(liveState.accountsByEmail['francois@7amgym.app'].workoutLogs, {});
  assert.deepEqual(liveState.accountsByEmail['francois@7amgym.app'].snapshot.workoutLogs, {});

  // Passive background_input WOULD be blocked, but deliberate start_fresh_reset MUST push immediately!
  const syncRes = await syncEngine.autoSyncWorkoutToSupabase('start_fresh_reset');
  assert.equal(syncRes.synced, true);
  assert.equal(syncRes.blockedByEmptyStateGuard, false);
  assert.equal(syncRes.blockedByUndoGuard, false);
  assert.equal(syncEngine.getLastSyncedLoggedSetCount(), 0);
  assert.equal(postedPayloads.length, 1);
  assert.deepEqual(postedPayloads[0].workoutLogs, {});
  assert.equal(postedPayloads[0].forceOverwrite, true);
  assert.equal(postedPayloads[0].resetReason, 'start_fresh_reset');

  // 2. Verify standalone executeStartFreshAndPushToSupabase helper also overwrites storage + Supabase
  const stored: Record<string, string> = {};
  const cloudRes = await executeStartFreshAndPushToSupabase({
    currentState: { workoutLogs: { w1_0_mon_bench_1: { weight: '135', reps: '8', done: true } }, weeklyWorkoutTarget: 5 },
    endpoint: '/api/state?email=francois%407amgym.app',
    storageKey: 'bws_vegan_7am_app_v1',
    storage: { setItem: (k, v) => { stored[k] = v; } },
    fetchImpl: fakeFetch
  });
  assert.equal(cloudRes.cloudSynced, true);
  assert.deepEqual(cloudRes.nextState.workoutLogs, {});
  assert.deepEqual(JSON.parse(stored['bws_vegan_7am_app_v1']).workoutLogs, {});

  // 3. After reset: Flexible Weekly Goal immediately renders "0 of 5 workouts completed this week"
  const after = computeAdherenceNeutralWeeklyProgress({
    weekNumber: liveState.selectedWeek,
    weeklyTarget: liveState.weeklyWorkoutTarget,
    workoutLogs: liveState.workoutLogs,
    pullupLogs: liveState.pullupLogs,
    cardioLogs: liveState.cardioLogs
  });
  assert.equal(after.completedWorkoutsCount, 0);
  assert.equal(after.statusLabel, '0 of 5 workouts completed this week');
});

