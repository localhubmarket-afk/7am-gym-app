import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WARMUP_DRILLS,
  calculateBarbellPerSidePlateMath,
  updateSingleBarbellSetWeight,
  applyWeightToRemainingUnloggedSets,
  computeMaxUnlockedWeek,
  finishWeekAndUnlockNext,
  isEndOfDayWorkoutComplete,
  addWaterIntakeMl,
  type SetLog
} from './workoutLogic';

test('Task 1: Independent Per-Set Barbell Weight & Plate Math', () => {
  const initialLogs: Record<string, SetLog> = {
    w1_0_mon_bench_1: { weight: '135', reps: '8', done: true, unit: 'lbs' },
    w1_0_mon_bench_2: { weight: '135', reps: '8', done: false, unit: 'lbs' },
    w1_0_mon_bench_3: { weight: '135', reps: '8', done: false, unit: 'lbs' }
  };

  // Modifying Set 2 must ONLY update Set 2, never overwriting Set 1 or Set 3
  const afterSet2Update = updateSingleBarbellSetWeight(initialLogs, 1, 0, 'mon_bench', 2, '145', 'lbs');
  assert.equal(afterSet2Update.w1_0_mon_bench_1.weight, '135');
  assert.equal(afterSet2Update.w1_0_mon_bench_2.weight, '145');
  assert.equal(afterSet2Update.w1_0_mon_bench_3.weight, '135');

  // Optional Apply to remaining unlogged sets updates Set 2 & Set 3 (unlogged) without touching Set 1 (logged)
  const afterApplyUnlogged = applyWeightToRemainingUnloggedSets(afterSet2Update, 1, 0, 'mon_bench', 3, '155', 'lbs');
  assert.equal(afterApplyUnlogged.w1_0_mon_bench_1.weight, '135');
  assert.equal(afterApplyUnlogged.w1_0_mon_bench_2.weight, '155');
  assert.equal(afterApplyUnlogged.w1_0_mon_bench_3.weight, '155');

  // Verify per-side plate breakdown math ((totalWeight - barWeight) / 2)
  const math135 = calculateBarbellPerSidePlateMath(135, 45, 'lbs');
  assert.equal(math135.perSide, 45);
  assert.deepEqual(math135.breakdown, [45]);

  const math145 = calculateBarbellPerSidePlateMath(145, 45, 'lbs');
  assert.equal(math145.perSide, 50);
  assert.deepEqual(math145.breakdown, [45, 5]);
});

test('Task 2: Progressive Week Selector & Unlocking Logic', () => {
  const logsWithWeek1Done: Record<string, SetLog> = {
    w1_0_mon_bench_1: { weight: '135', reps: '8', done: true, unit: 'lbs' }
  };
  const maxUnlocked = computeMaxUnlockedWeek(logsWithWeek1Done, 1);
  assert.equal(maxUnlocked, 2);

  const afterFinishWeek2 = finishWeekAndUnlockNext({
    selectedWeek: 2,
    maxUnlockedWeek: 2,
    completedWeeks: { 1: true }
  });
  assert.equal(afterFinishWeek2.maxUnlockedWeek, 3);
  assert.equal(afterFinishWeek2.selectedWeek, 3);
  assert.equal(afterFinishWeek2.completedWeeks[2], true);
});

test('Task 3: End-of-Day Completion & +500ml Hydration Tracker', () => {
  assert.equal(isEndOfDayWorkoutComplete(25, 26), false);
  assert.equal(isEndOfDayWorkoutComplete(26, 26), true);

  let waterLogs: Record<string, number> = {};
  waterLogs = addWaterIntakeMl(waterLogs, 1, 0, 500);
  assert.equal(waterLogs.w1_d0, 500);
  waterLogs = addWaterIntakeMl(waterLogs, 1, 0, 500);
  assert.equal(waterLogs.w1_d0, 1000);
});

test('Task 4: Dedicated Warm-Up Drill Videos Mapping', () => {
  assert.equal(WARMUP_DRILLS.upper.length, 5);
  assert.equal(WARMUP_DRILLS.lower.length, 4);

  assert.equal(WARMUP_DRILLS.upper[0].videoUrl, 'https://www.youtube.com/watch?v=HMxqtrsNz60');
  assert.equal(WARMUP_DRILLS.upper[1].videoUrl, 'https://www.youtube.com/watch?v=-avWRzrrH-o');
  assert.equal(WARMUP_DRILLS.upper[2].videoUrl, 'https://www.youtube.com/watch?v=mHWlgqPvyxI');
  assert.equal(WARMUP_DRILLS.upper[3].videoUrl, 'https://www.youtube.com/watch?v=dS9ORQCnWsE');
  assert.equal(WARMUP_DRILLS.upper[4].videoUrl, 'https://www.youtube.com/watch?v=IlqmuM9FPUU');

  assert.equal(WARMUP_DRILLS.lower[0].videoUrl, 'https://www.youtube.com/watch?v=3l31E2cMGMk');
  assert.equal(WARMUP_DRILLS.lower[1].videoUrl, 'https://www.youtube.com/watch?v=TAHk1yccDmM');
  assert.equal(WARMUP_DRILLS.lower[2].videoUrl, 'https://www.youtube.com/watch?v=poKi7JPfuxE');
  assert.equal(WARMUP_DRILLS.lower[3].videoUrl, 'https://www.youtube.com/watch?v=o4GKiEoYClI');
});

import { getRollingWeekVisibility, shouldShowStickyRestTimer } from './workoutLogic';

test('Task 5: 3-Week Rolling Visibility & Contextual Sticky Timer Visibility', () => {
  const w1 = getRollingWeekVisibility(1);
  assert.deepEqual(w1.visibleWeeks, [1]);
  assert.equal(w1.showOlderToggle, false);

  const w2 = getRollingWeekVisibility(2);
  assert.deepEqual(w2.visibleWeeks, [1, 2]);
  assert.equal(w2.showOlderToggle, false);

  const w3 = getRollingWeekVisibility(3);
  assert.deepEqual(w3.visibleWeeks, [1, 2, 3]);
  assert.equal(w3.showOlderToggle, false);

  const w5 = getRollingWeekVisibility(5);
  assert.deepEqual(w5.visibleWeeks, [2, 3, 4, 5]);
  assert.deepEqual(w5.olderWeeks, [1]);
  assert.equal(w5.showOlderToggle, true);

  assert.equal(shouldShowStickyRestTimer('workout'), true);
  assert.equal(shouldShowStickyRestTimer('pullups'), true);
  assert.equal(shouldShowStickyRestTimer('timer'), false);
  assert.equal(shouldShowStickyRestTimer('vegan'), false);
  assert.equal(shouldShowStickyRestTimer('shopping'), false);
});

import {
  formatExerciseProgressBadge,
  stripExercisePrefix,
  BATCH_PREP_RECIPES,
  toggleRecipePrepStep,
  resetRecipePrepSteps
} from './workoutLogic';

test('Task 6: Exercise Progress Denominator Badge, Prefix Stripping & Atomic Batch Prep Recipe Cards', () => {
  assert.equal(formatExerciseProgressBadge(0, 9), '#1/9');
  assert.equal(formatExerciseProgressBadge(1, 9), '#2/9');
  assert.equal(formatExerciseProgressBadge(8, 9), '#9/9');
  assert.equal(formatExerciseProgressBadge(0, 8), '#1/8');

  assert.equal(stripExercisePrefix('A1. Dumbbell Romanian Deadlift'), 'Dumbbell Romanian Deadlift');
  assert.equal(stripExercisePrefix('A2. Seated Leg Extensions'), 'Seated Leg Extensions');
  assert.equal(stripExercisePrefix('A1. Banded Hip Abductions'), 'Banded Hip Abductions');
  assert.equal(stripExercisePrefix('A2. Seated Weighted Calf Raise'), 'Seated Weighted Calf Raise');
  assert.equal(stripExercisePrefix('Barbell Bench Press'), 'Barbell Bench Press');

  assert.equal(BATCH_PREP_RECIPES.length, 2);
  assert.equal(BATCH_PREP_RECIPES[0].badge, '#Prep 1/2');
  assert.equal(BATCH_PREP_RECIPES[0].steps.length, 6);
  assert.equal(BATCH_PREP_RECIPES[0].steps[0].weightBadge, '180g');
  assert.equal(BATCH_PREP_RECIPES[0].steps[1].weightBadge, '24g');
  assert.equal(BATCH_PREP_RECIPES[0].steps[2].weightBadge, '120g');
  assert.equal(BATCH_PREP_RECIPES[0].steps[3].weightBadge, '32g');
  assert.equal(BATCH_PREP_RECIPES[0].steps[4].weightBadge, '720g');
  assert.equal(BATCH_PREP_RECIPES[1].badge, '#Prep 2/2');
  assert.equal(BATCH_PREP_RECIPES[1].title, '4-Day Jasmine Rice Batch Prep');
  assert.equal(BATCH_PREP_RECIPES[1].steps.length, 4);

  let logs: Record<string, boolean> = {};
  logs = toggleRecipePrepStep(logs, 'oats_step_1');
  logs = toggleRecipePrepStep(logs, 'oats_step_6');
  assert.equal(logs.oats_step_1, true);
  assert.equal(logs.oats_step_6, true);

  logs = resetRecipePrepSteps(logs, 'recipe_oats_batch');
  assert.equal(Boolean(logs.oats_step_1), false);
  assert.equal(Boolean(logs.oats_step_6), false);
});

import {
  cycleTimerAudioMode,
  getTimerAudioModeBehavior,
  TIMED_HOLD_PRESETS_SEC,
  UPDATED_BARBELL_EX_IDS,
  isTimedHoldExercise,
  formatTimedHoldTarget,
  upsertExerciseNote,
  getExerciseNoteHeaderBadge,
  DAILY_FUEL_CARDS,
  calculateDailyFuelMacros,
  shouldShowPreWorkoutFuelPrompt,
  type ExerciseNoteEntry
} from './workoutLogic';

test('Upgrade 1: 3-State Bluetooth-Safe Audio Mode & Web Audio API Cleanup', () => {
  assert.equal(cycleTimerAudioMode('sound_vibe'), 'vibe_only');
  assert.equal(cycleTimerAudioMode('vibe_only'), 'silent');
  assert.equal(cycleTimerAudioMode('silent'), 'sound_vibe');

  const soundVibe = getTimerAudioModeBehavior('sound_vibe');
  assert.equal(soundVibe.shouldCreateAudioContext, true);
  assert.equal(soundVibe.shouldVibrate, true);
  assert.equal(soundVibe.closeDelayMs <= 350 && soundVibe.closeDelayMs > 0, true);

  const vibeOnly = getTimerAudioModeBehavior('vibe_only');
  assert.equal(vibeOnly.shouldCreateAudioContext, false);
  assert.equal(vibeOnly.shouldVibrate, true);

  const silent = getTimerAudioModeBehavior('silent');
  assert.equal(silent.shouldCreateAudioContext, false);
  assert.equal(silent.shouldVibrate, false);
});

test('Upgrade 2 & 3: Side Plank Isometric Timer & Dumbbell-Only Standing Calf Raise', () => {
  assert.deepEqual(TIMED_HOLD_PRESETS_SEC, [30, 45, 60, 75, 90]);
  assert.equal(isTimedHoldExercise({ id: 'tue_side_plank', name: 'Side Plank', isTimedHold: true }), true);
  assert.equal(isTimedHoldExercise({ id: 'mon_bench', name: 'Barbell Bench Press' }), false);
  assert.equal(formatTimedHoldTarget(30), '30s / side');
  assert.equal(formatTimedHoldTarget(60), '60s / side');

  // Verify tue_calf is removed from BARBELL_EX_IDS
  assert.equal((UPDATED_BARBELL_EX_IDS as readonly string[]).includes('tue_calf'), false);
  assert.equal((UPDATED_BARBELL_EX_IDS as readonly string[]).includes('mon_bench'), true);
});

test('Upgrade 4: Collapsible Exercise Notes & Photo + Next-Week Warning Badge', () => {
  let notes: Record<string, ExerciseNoteEntry> = {};
  notes = upsertExerciseNote(notes, 'mon_lat_pd', { text: 'Machine pin #6, seat height 4' }, 1, '2026-11-10T08:00:00Z');
  assert.equal(notes.mon_lat_pd.text, 'Machine pin #6, seat height 4');
  assert.equal(notes.mon_lat_pd.updatedWeek, 1);

  const badge = getExerciseNoteHeaderBadge(notes.mon_lat_pd);
  assert.equal(badge.visible, true);
  assert.equal(badge.badgeText, 'Note: Machine pin #6, seat height 4');
  assert.equal(badge.hasPhoto, false);

  notes = upsertExerciseNote(notes, 'mon_lat_pd', { photoDataUrl: 'data:image/jpeg;base64,abc123' }, 2);
  const badgeWithPhoto = getExerciseNoteHeaderBadge(notes.mon_lat_pd);
  assert.equal(badgeWithPhoto.visible, true);
  assert.equal(badgeWithPhoto.hasPhoto, true);
});

test('Upgrade 5, 6 & 7: 4 Daily Fuel Cards, Scannable Ingredient Rows & Pre-Workout Fuel Check-In', () => {
  assert.equal(DAILY_FUEL_CARDS.length, 4);

  // Verify exact macros and titles per card
  assert.equal(DAILY_FUEL_CARDS[0].title, 'Pre-Gym Fast Protein Shake');
  assert.equal(DAILY_FUEL_CARDS[0].kcal, 170);
  assert.equal(DAILY_FUEL_CARDS[0].protein, 36);
  assert.deepEqual(
    DAILY_FUEL_CARDS[0].rows.map(r => [r.name, r.amountPill]),
    [
      ['Pea Protein Isolate', '30g'],
      ['Unsweetened Silk Protein Milk', '360 ml']
    ]
  );

  assert.equal(DAILY_FUEL_CARDS[1].title, 'Post-Gym Overnight Protein Oats');
  assert.equal(DAILY_FUEL_CARDS[1].kcal, 395);
  assert.equal(DAILY_FUEL_CARDS[1].protein, 26);
  assert.deepEqual(
    DAILY_FUEL_CARDS[1].rows.map(r => [r.name, r.amountPill]),
    [
      ['Gluten-Free Protein Oats', '45g'],
      ['Unsweetened Silk Protein Milk', '180 ml'],
      ['Peeled Ripe Banana', '30g'],
      ['Smooth Natural Peanut Butter', '8g'],
      ['Organic Whole Chia Seeds', '6g']
    ]
  );

  assert.equal(DAILY_FUEL_CARDS[2].title, 'Savoury Tofu, Rice & Broccoli Bowl');
  assert.equal(DAILY_FUEL_CARDS[2].kcal, 520);
  assert.equal(DAILY_FUEL_CARDS[2].protein, 33);
  assert.deepEqual(
    DAILY_FUEL_CARDS[2].rows.map(r => [r.name, r.amountPill]),
    [
      ['Extra-Firm Tofu', '175g'],
      ['Cooked White Jasmine Rice', '150g'],
      ['Steamed Broccoli Florets', '75g'],
      ['Fortified Nutritional Yeast', '12g'],
      ['Toasted Sesame Oil', '5g'],
      ['Iodized Table Salt', '1.5g']
    ]
  );

  assert.equal(DAILY_FUEL_CARDS[3].title, 'Evening Protein & PB Shake');
  assert.equal(DAILY_FUEL_CARDS[3].kcal, 315);
  assert.equal(DAILY_FUEL_CARDS[3].protein, 43);
  assert.deepEqual(
    DAILY_FUEL_CARDS[3].rows.map(r => [r.name, r.amountPill]),
    [
      ['Pea Protein Isolate', '45g'],
      ['Unsweetened Silk Protein Milk', '360 ml'],
      ['Smooth Natural Peanut Butter', '16g']
    ]
  );

  // Verify checking off all 4 cards totals 138g Protein and 1,400 kcal
  const allLogged = calculateDailyFuelMacros({
    pre_shake: true,
    post_oats: true,
    lunch: true,
    dinner: true
  });
  assert.equal(allLogged.protein, 138);
  assert.equal(allLogged.kcal, 1400);
  assert.equal(allLogged.loggedCount, 4);

  // Pre-workout fuel check-in prompt on workout days (Days 1-5 -> dayIdx 0-4)
  assert.equal(shouldShowPreWorkoutFuelPrompt(0, false, false, 0, 26), true);
  assert.equal(shouldShowPreWorkoutFuelPrompt(4, false, false, 10, 26), true);
  assert.equal(shouldShowPreWorkoutFuelPrompt(0, true, false, 0, 26), false);
  assert.equal(shouldShowPreWorkoutFuelPrompt(0, false, true, 0, 26), false);
  assert.equal(shouldShowPreWorkoutFuelPrompt(5, false, false, 0, 26), false); // Rest Day 6
  // When all sets for the selected day are complete (doneSetsToday === totalSetsToday), automatically hide banner
  assert.equal(shouldShowPreWorkoutFuelPrompt(0, false, false, 26, 26), false);
});

test('Architectural Upgrades & UI Cleanups: Fuel Collapse, Batch Prep, Silent-Padded WAV & UI Streamlining', async () => {
  const mod = await import('./workoutLogic.ts');

  // 1. All 4 Fuel cards collapsed by default
  assert.equal(mod.isFuelCardIngredientsExpanded({}, 'pre_shake'), false);
  assert.equal(mod.isFuelCardIngredientsExpanded({}, 'post_oats'), false);
  assert.equal(mod.isFuelCardIngredientsExpanded({ post_oats: true }, 'post_oats'), true);
  assert.equal(mod.formatFuelCardToggleLabel(5, false), 'Show Ingredients & Prep (5 items)');
  assert.equal(mod.formatFuelCardToggleLabel(5, true), 'Hide Ingredients & Prep (5 items)');

  // 2. Batch Prep cards collapsed by default and strip #1/#2 prefixes
  assert.equal(mod.isBatchPrepCardCollapsedByDefault({}, 'recipe_oats_batch'), true);
  assert.equal(mod.isBatchPrepCardCollapsedByDefault({}, 'recipe_rice_batch'), true);
  assert.equal(mod.isBatchPrepCardCollapsedByDefault({ recipe_oats_batch: false }, 'recipe_oats_batch'), false);
  assert.equal(mod.stripBatchStepPrefix('#1 Gluten-Free Protein Oats'), 'Gluten-Free Protein Oats');
  assert.equal(mod.stripBatchStepPrefix('#5 Unsweetened Silk Protein Milk'), 'Unsweetened Silk Protein Milk');

  // 3. Pre-rendered PCM WAV buffer has valid RIFF/WAVE header, silent padding, and blob/data URL generator
  const wav = mod.generatePreRenderedChimeWavBytes(44100, 0.28);
  assert.equal(String.fromCharCode(wav[0], wav[1], wav[2], wav[3]), 'RIFF');
  assert.equal(String.fromCharCode(wav[8], wav[9], wav[10], wav[11]), 'WAVE');
  const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  assert.equal(dv.getInt16(44, true), 0);
  assert.equal(dv.getInt16(wav.byteLength - 2, true), 0);
  const chimeUrl = mod.createSilentPaddedChimeWavUrl();
  assert.equal(typeof chimeUrl === 'string' && chimeUrl.length > 0, true);

  // 4. Clean 3-mode labels (Sound & Vibe | Vibrate Only | Silent, no "(BT Safe)" text)
  assert.equal(mod.getTimerAudioModeBehavior('sound_vibe').label, '🔔 Sound & Vibe');
  assert.equal(mod.getTimerAudioModeBehavior('vibe_only').label, '📳 Vibrate Only');
  assert.equal(mod.getTimerAudioModeBehavior('silent').label, '🔕 Silent');

  // 5. Pyramid Rest Helper collapsed unless selectedDayIndex === 1 (Day 2)
  assert.equal(mod.shouldExpandPyramidHelperByDefault(0), false);
  assert.equal(mod.shouldExpandPyramidHelperByDefault(1), true);
  assert.equal(mod.shouldExpandPyramidHelperByDefault(2), false);

  // 6. Hide Set 1 plate badge subtitle on collapsed completed barbell exercise cards
  assert.equal(mod.shouldShowBarbellHeaderPlateBadge(true, false, false), true);
  assert.equal(mod.shouldShowBarbellHeaderPlateBadge(true, true, false), true); // Expanded completed card
  assert.equal(mod.shouldShowBarbellHeaderPlateBadge(true, true, true), false); // Collapsed completed card
  assert.equal(mod.shouldShowBarbellHeaderPlateBadge(false, false, false), false);
});

