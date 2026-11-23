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
  assert.equal(mod.getTimerAudioModeBehavior('sound_vibe').label, ' Sound & Vibe');
  assert.equal(mod.getTimerAudioModeBehavior('vibe_only').label, ' Vibrate Only');
  assert.equal(mod.getTimerAudioModeBehavior('silent').label, ' Silent');

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

test('Muscle Fuel & Rest Timer Upgrades 1-4: Scale Badges, G|LB Toggle, 3-Stage Rice Timer, Videos & Prep Notes', async () => {
  const mod = await import('./workoutLogic.ts');

  // 1. Scale weight badges in G and LB modes
  assert.equal(mod.getFuelCardScaleBadge('pre_shake', 'g'), 'Scale: 390g');
  assert.equal(mod.getFuelCardScaleBadge('pre_shake', 'lb'), 'Scale: 0.86 lb / 13.8 oz');
  assert.equal(mod.getFuelCardScaleBadge('post_oats', 'g'), 'Scale: 269g');
  assert.equal(mod.getFuelCardScaleBadge('post_oats', 'lb'), 'Scale: 0.59 lb / 9.5 oz');
  assert.equal(mod.getFuelCardScaleBadge('lunch', 'g'), 'Scale: 419g');
  assert.equal(mod.getFuelCardScaleBadge('lunch', 'lb'), 'Scale: 0.92 lb / 14.8 oz');
  assert.equal(mod.getFuelCardScaleBadge('dinner', 'g'), 'Scale: 421g');
  assert.equal(mod.getFuelCardScaleBadge('dinner', 'lb'), 'Scale: 0.93 lb / 14.9 oz');

  assert.equal(mod.getBatchCardScaleBadge('recipe_oats_batch', 'g'), 'Batch: 1,076g • 1 Jar Today: 269g');
  assert.equal(mod.getBatchCardScaleBadge('recipe_oats_batch', 'lb'), 'Batch: 2.37 lb • 1 Jar: 0.59 lb / 9.5 oz');
  assert.equal(mod.getBatchCardScaleBadge('recipe_rice_batch', 'g'), 'Cooked Batch: 600g • 1 Bowl Today: 150g');
  assert.equal(mod.getBatchCardScaleBadge('recipe_rice_batch', 'lb'), 'Batch: 1.32 lb • 1 Bowl: 0.33 lb / 5.3 oz');

  // Individual ingredient row conversion in LB mode
  assert.equal(mod.formatIngredientWeightBadge('45g', 'g'), '45g');
  assert.equal(mod.formatIngredientWeightBadge('45g', 'lb'), '0.10 lb (1.6 oz)');
  assert.equal(mod.formatIngredientWeightBadge('180g', 'lb'), '0.40 lb (6.3 oz)');
  assert.equal(mod.formatIngredientWeightBadge('720 ml', 'lb'), '1.59 lb (25.4 oz)');

  // 2. 3-Stage Jasmine Rice Cooking Timer specs & alarms
  assert.equal(mod.JASMINE_RICE_TIMER_STAGES.length, 3);
  assert.equal(mod.getRiceTimerStageSpec(1)?.seconds, 180);
  assert.equal(mod.getRiceTimerStageSpec(1)?.buttonLabel, '1. Boil & Stir (3m)');
  assert.equal(
    mod.getRiceTimerStageSpec(1)?.completionBanner,
    'ALARM: Stir / Mix Rice Once, Cover Tightly & Turn Heat to Low! Tap Stage 2 (12m Simmer)'
  );
  assert.equal(mod.getRiceTimerStageSpec(2)?.seconds, 720);
  assert.equal(mod.getRiceTimerStageSpec(2)?.buttonLabel, '2. Low Simmer (12m)');
  assert.equal(
    mod.getRiceTimerStageSpec(2)?.completionBanner,
    'ALARM: Turn Off Heat! Keep Lid Closed (Do Not Lift) & Tap Stage 3 (10m Steam)'
  );
  assert.equal(mod.getRiceTimerStageSpec(3)?.seconds, 600);
  assert.equal(mod.getRiceTimerStageSpec(3)?.buttonLabel, '3. Off-Heat Steam (10m)');
  assert.equal(
    mod.getRiceTimerStageSpec(3)?.completionBanner,
    'DONE: Open Lid & Mix / Fluff Rice With Fork! Portion 4 x 150g Containers'
  );

  // 3. Batch Prep Demonstration Video URLs
  assert.equal(mod.BATCH_PREP_VIDEO_URLS.recipe_oats_batch, 'https://www.youtube.com/watch?v=_wgQBioExZA');
  assert.equal(mod.BATCH_PREP_VIDEO_URLS.recipe_rice_batch, 'https://www.youtube.com/watch?v=zWTc8eLEeyY');

  // 4. Collapsible Kitchen Prep Notes & Photo Capture
  let prepNotes = {};
  const emptyBadge = mod.getPrepNoteHeaderBadge(undefined);
  assert.equal(emptyBadge.visible, false);
  assert.equal(emptyBadge.toggleButtonLabel, '+ Add Kitchen Note / Photo');

  prepNotes = mod.upsertPrepNote(prepNotes, 'recipe_oats_batch', {
    text: 'Empty glass jar tare = 215g, stove dial #2'
  }, '2026-11-10T11:36:00Z');
  const populatedBadge = mod.getPrepNoteHeaderBadge(prepNotes['recipe_oats_batch']);
  assert.equal(populatedBadge.visible, true);
  assert.equal(populatedBadge.badgeText, 'Note: Empty glass jar tare = 215g, stove dial #2');
  assert.equal(populatedBadge.toggleButtonLabel, 'Edit Kitchen Note');
});

test('Pull-Up & Naming Cleanup Updates 1-4: Zero USMC, Clean Titles, Bodyweight Reps-Only & Settings Label', async () => {
  const fs = await import('node:fs');
  const mod = await import('./workoutLogic.ts');

  // 1. Verify Day 1-5 Banner Titles
  assert.equal(mod.WORKOUT_DAY_BANNER_TITLES[0], 'Upper Body 1 • Push & Pull');
  assert.equal(mod.WORKOUT_DAY_BANNER_TITLES[1], 'Lower Body 1 • Quad Focus');
  assert.equal(mod.WORKOUT_DAY_BANNER_TITLES[2], 'Upper Body 2 • Push Focus');
  assert.equal(mod.WORKOUT_DAY_BANNER_TITLES[3], 'Upper Body 3 • Pull Focus');
  assert.equal(mod.WORKOUT_DAY_BANNER_TITLES[4], 'Lower Body 2 • Glutes & Hamstrings');

  // 2. Verify Exercise #1/9 Pull-Up Titles on Days 1-5
  assert.equal(mod.PULLUP_EXERCISE_TITLES.day1_pullups, 'Overhand Pull-Ups (Max Effort)');
  assert.equal(mod.PULLUP_EXERCISE_TITLES.day2_pullups, 'Overhand Pull-Ups (Pyramid Sets)');
  assert.equal(mod.PULLUP_EXERCISE_TITLES.day3_pullups, 'Pull-Ups (3 Grips × 3 Training Sets)');
  assert.equal(mod.PULLUP_EXERCISE_TITLES.fri_pullups, 'Overhand Pull-Ups (Max Training Sets)');
  assert.equal(mod.PULLUP_EXERCISE_TITLES.day5_pullups, 'Overhand Pull-Ups (Repeat Hardest Day)');

  // 3. Verify Bodyweight Reps-Only detection for Exercise #1/9 on Days 1-5
  for (const id of ['day1_pullups', 'day2_pullups', 'day3_pullups', 'fri_pullups', 'day5_pullups']) {
    assert.equal(mod.isBodyweightRepsOnlyExercise({ id }), true);
  }
  assert.equal(mod.isBodyweightRepsOnlyExercise({ id: 'mon_bench' }), false);

  // 4. Verify Header & Drawer Labels and Zero "USMC" occurrences in index.html & api/state.js
  assert.equal(mod.PULLUPS_TAB_MAIN_HEADER, 'Overhand Pull-Up Progression Program');
  assert.equal(mod.PYRAMID_REST_HELPER_HEADER, 'PULL-UP PYRAMID REST HELPER (10S × REPS)');
  assert.equal(mod.WORKOUT_SETTINGS_DRAWER_LABEL, 'Workout & Display Settings');

  const html = fs.readFileSync('index.html', 'utf8');
  const apiState = fs.readFileSync('api/state.js', 'utf8');
  assert.equal(/usmc/i.test(html), false, 'index.html must contain zero case-insensitive matches for USMC');
  assert.equal(/usmc/i.test(apiState), false, 'api/state.js must contain zero case-insensitive matches for USMC');
});

test('Multi-Preset Fuel Architecture, Immutable Historical Logs, Smart Ingredient Swaps & Coach AI Live Plan Mutation', async () => {
  const mod = await import('./workoutLogic.ts');

  // 1. Verify Preset 1 (Default for Unlogged/Future Days): almond_cashew_pea
  const p1 = mod.FUEL_PLAN_PRESETS.almond_cashew_pea;
  assert.equal(p1.dailyKcalDisplay, 1300);
  assert.equal(p1.dailyKcalExact, 1295);
  assert.equal(p1.dailyProtein, 138);
  assert.equal(p1.meals.pre_shake.kcal, 190);
  assert.equal(p1.meals.pre_shake.protein, 36);
  assert.equal(p1.meals.pre_shake.scaleGrams, 400);
  assert.equal(p1.meals.pre_shake.scaleBadgeG, 'Scale: 400g');
  assert.equal(p1.meals.pre_shake.scaleBadgeLb, 'Scale: 0.88 lb / 14.1 oz');
  assert.equal(p1.meals.post_oats.kcal, 390);
  assert.equal(p1.meals.post_oats.protein, 29);
  assert.equal(p1.meals.post_oats.scaleGrams, 279);
  assert.equal(p1.meals.post_oats.scaleBadgeG, 'Scale: 279g');
  assert.equal(p1.meals.post_oats.scaleBadgeLb, 'Scale: 0.62 lb / 9.8 oz');
  assert.equal(p1.meals.lunch.kcal, 520);
  assert.equal(p1.meals.lunch.protein, 33);
  assert.equal(p1.meals.lunch.scaleGrams, 419);
  assert.equal(p1.meals.dinner.kcal, 295);
  assert.equal(p1.meals.dinner.protein, 40);
  assert.equal(p1.meals.dinner.scaleGrams, 431);
  assert.equal(p1.meals.dinner.scaleBadgeG, 'Scale: 431g');
  assert.equal(p1.meals.dinner.scaleBadgeLb, 'Scale: 0.95 lb / 15.2 oz');
  assert.equal(p1.oatsBatch.scaleBadgeG, 'Batch: 1,116g • 1 Jar Today: 279g');
  assert.equal(p1.shopItems.item12Name.includes('735g/week • 105g/day'), true);

  // 2. Verify Preset 2 (Preserved Original): classic_silk_protein
  const p2 = mod.FUEL_PLAN_PRESETS.classic_silk_protein;
  assert.equal(p2.dailyKcalDisplay, 1400);
  assert.equal(p2.dailyProtein, 138);
  assert.equal(p2.meals.pre_shake.scaleGrams, 390);
  assert.equal(p2.meals.post_oats.scaleGrams, 269);
  assert.equal(p2.meals.lunch.scaleGrams, 419);
  assert.equal(p2.meals.dinner.scaleGrams, 421);
  assert.equal(p2.oatsBatch.scaleBadgeG, 'Batch: 1,076g • 1 Jar Today: 269g');
  assert.equal(p2.shopItems.item12Name.includes('525g/week • 75g/day'), true);

  // 3. Verify Preset 3 (1:1 Whole-Food Alternative): unsweetened_soy
  const p3 = mod.FUEL_PLAN_PRESETS.unsweetened_soy;
  assert.equal(p3.dailyKcalDisplay, 1400);
  assert.equal(p3.dailyProtein, 138);
  assert.equal(p3.meals.pre_shake.scaleGrams, 390);
  assert.equal(p3.meals.post_oats.scaleGrams, 269);
  assert.equal(p3.meals.dinner.scaleGrams, 421);
  assert.equal(p3.shopItems.item1Name.includes('Unsweetened Fortified Soy Milk'), true);

  // 4. Verify Backfill of Existing Logged Days locks to classic_silk_protein and preserves yesterday's snapshot
  const mockState: mod.FuelStateContainer = {
    checkedMeals: {
      w1_d0_pre_shake: true,
      w1_d0_post_oats: true,
      w1_d0_lunch: true,
      w1_d0_dinner: true
    }
  };
  mod.backfillHistoricalFuelSnapshots(mockState);
  assert.equal(mockState.fuelDaySnapshots?.['w1_d0'], 'classic_silk_protein');
  assert.equal(mockState.loggedMealSnapshots?.['w1_d0_fuel1']?.scaleGrams, 390);
  assert.equal(mockState.loggedMealSnapshots?.['w1_d0_fuel2']?.scaleGrams, 269);
  assert.equal(mockState.loggedMealSnapshots?.['w1_d0_fuel4']?.scaleGrams, 421);

  // Switching future preset to almond_cashew_pea MUST NOT overwrite logged Day 1 (w1_d0)
  mod.applyFuelPresetSwitch(mockState, 'almond_cashew_pea', 'future', 1, 0);
  const day1PlanAfterSwitch = mod.getEffectiveDayFuelPlan(mockState, 1, 0);
  assert.equal(day1PlanAfterSwitch.presetId, 'classic_silk_protein');
  assert.equal(day1PlanAfterSwitch.isLockedHistoricalDay, true);
  assert.equal(day1PlanAfterSwitch.loggedWithBadge, 'Logged with: Classic Silk Protein Plan');
  assert.equal(day1PlanAfterSwitch.meals.pre_shake.scaleGrams, 390);
  assert.equal(day1PlanAfterSwitch.meals.post_oats.scaleGrams, 269);

  // Unlogged Day 2 (w1_d1) automatically gets the default/new preset (almond_cashew_pea)
  const day2Plan = mod.getEffectiveDayFuelPlan(mockState, 1, 1);
  assert.equal(day2Plan.presetId, 'almond_cashew_pea');
  assert.equal(day2Plan.isLockedHistoricalDay, false);
  assert.equal(day2Plan.meals.pre_shake.scaleGrams, 400);
  assert.equal(day2Plan.meals.post_oats.scaleGrams, 279);
  assert.equal(day2Plan.meals.dinner.scaleGrams, 431);

  // 5. Verify Smart Ingredient Swaps on unlogged Day 2 recalculate scale weights & macros
  mod.applyFuelIngredientSwap(mockState, 'tofu', 'tempeh_115', 'today', 1, 1);
  const day2Swapped = mod.getEffectiveDayFuelPlan(mockState, 1, 1);
  // 115g Tempeh (instead of 175g Tofu) reduces bowl weight by 60g: 419g - 60g = 359g
  assert.equal(day2Swapped.meals.lunch.scaleGrams, 359);
  assert.equal(day2Swapped.meals.lunch.scaleBadgeG, 'Scale: 359g');
  assert.equal(day2Swapped.meals.lunch.items[0].label, 'Organic Soy Tempeh');
  assert.equal(day2Swapped.meals.lunch.items[0].weight, '115g');

  // 6. Verify Coach AI Live Plan Mutation replies & action payloads
  const silkCoach = mod.buildCoachAiFuelMutationReply('Switch Back to Original Silk Protein', 1, 1);
  assert.equal(silkCoach.matched, true);
  assert.equal(silkCoach.actions.length >= 1, true);
  assert.equal(silkCoach.actions[0].presetId, 'classic_silk_protein');

  const swapCoach = mod.buildCoachAiFuelMutationReply('Ingredient Sold Out / Swap Meal', 1, 1);
  assert.equal(swapCoach.matched, true);
  assert.equal(swapCoach.actions.some(a => a.swapId === 'tempeh_115'), true);
});

test('UX Simplifications 1-3 & 3-Tier Smartwatch Integration (BLE 0x180D/0x2A37 + Wrist Alerts + Health Bridge)', async () => {
  const mod = await import('./workoutLogic.ts');

  // 1. Simplify Muscle Fuel Header Card & Collapsible Plan/Swap Drawer
  assert.equal(mod.formatCompactMuscleFuelTitle(1300, 138), 'Daily Muscle Fuel (1,300 kcal • 138g P)');
  assert.equal(
    mod.formatFuelPlanSubheaderPill('almond_cashew_pea', 0),
    'Plan: Option B (Almond/Cashew) • Change / Swap Ingredients'
  );
  assert.equal(
    mod.formatFuelPlanSubheaderPill('classic_silk_protein', 1),
    'Plan: Original Silk (1 swap) • Change / Swap Ingredients'
  );
  assert.equal(mod.isFuelPlanDrawerExpanded(undefined), false);
  assert.equal(mod.isFuelPlanDrawerExpanded(true), true);

  // 2. Hide Timing & Prep Tip by default on Fuel 1-4 cards
  assert.equal(mod.isFuelTimingTipExpanded(undefined, 'pre_shake'), false);
  assert.equal(mod.isFuelTimingTipExpanded({}, 'post_oats'), false);
  assert.equal(mod.isFuelTimingTipExpanded({ post_oats: true }, 'post_oats'), true);

  // 3. Declutter 4-Day Batch Prep Card Headers
  const oatsHeader = mod.getCompactBatchCardHeaderSpec('recipe_oats_batch', 'almond_cashew_pea', 'g');
  assert.equal(oatsHeader.badge, 'Batch 1/2');
  assert.equal(oatsHeader.fridgePill, '4 Jars in Fridge');
  assert.equal(oatsHeader.weightBadge, '1,116g (279g/jar)');
  assert.equal(oatsHeader.title, '4-Day Overnight Protein Oats Batch');

  const riceHeader = mod.getCompactBatchCardHeaderSpec('recipe_rice_batch', 'almond_cashew_pea', 'g');
  assert.equal(riceHeader.badge, 'Batch 2/2');
  assert.equal(riceHeader.weightBadge, '600g (150g/bowl)');
  assert.equal(riceHeader.title, '4-Day Jasmine Rice Batch Prep');

  // 4A. Tier 1: Parse 8-bit and 16-bit BLE Heart Rate Measurement (0x2A37)
  const packet8Bit = new Uint8Array([0x06, 138]); // 8-bit BPM = 138, contact detected
  const parsed8 = mod.parseBleHeartRateMeasurement(packet8Bit);
  assert.equal(parsed8.bpm, 138);
  assert.equal(parsed8.is16Bit, false);
  assert.equal(parsed8.contactDetected, true);

  const packet16Bit = new Uint8Array([0x01, 0x98, 0x00]); // 16-bit little-endian BPM = 152
  const parsed16 = mod.parseBleHeartRateMeasurement(packet16Bit);
  assert.equal(parsed16.bpm, 152);
  assert.equal(parsed16.is16Bit, true);

  const zoneInfo = mod.getHeartRateZoneInfo(138, 190);
  assert.equal(zoneInfo.zone, 3);
  assert.equal(zoneInfo.pillText, '138 BPM • Zone 3');

  const recovery = mod.formatRestHeartRateRecovery(152, 118);
  assert.equal(recovery.hasRecovery, true);
  assert.equal(recovery.deltaBpm, -34);
  assert.equal(recovery.text, '152 -> 118 BPM (-34 BPM recovery)');

  // 4B. Tier 2: Smartwatch Wrist Haptic Notification Payload
  const wristAlert = mod.buildWristNotificationPayload({
    nextSetNumber: 2,
    exerciseName: 'Barbell Bench Press',
    weight: 135,
    unit: 'lbs',
    reps: 8
  });
  assert.equal(wristAlert.tag, '7am-timer-alert');
  assert.equal(wristAlert.renotify, true);
  assert.deepEqual(wristAlert.vibrate, [200, 100, 200]);
  assert.equal(
    wristAlert.body,
    'Rest Complete! Up Next: Set 2 Barbell Bench Press (135 lbs x 8)'
  );

  // 4C. Tier 3: Capacitor HealthKit / Health Connect Bridge & CSV Export
  assert.equal(mod.detectCapacitorHealthBridge({}).isNativeAvailable, false);
  assert.equal(
    mod.detectCapacitorHealthBridge({ Capacitor: { Plugins: { Health: {} } } }).isNativeAvailable,
    true
  );
  assert.equal(
    mod.detectCapacitorHealthBridge({ Capacitor: { Plugins: { HealthFitness: {} } } }).pluginName,
    'HealthFitness'
  );

  const csv = mod.buildHealthExportCsv({
    week: 1,
    dayNumber: 1,
    completedSets: 18,
    totalVolumeLbs: 9450,
    dailyKcal: 1300,
    dailyProteinG: 138,
    waterMl: 2000,
    lastBpm: 118,
    startRestBpm: 152
  });
  assert.equal(csv.includes('1300,138,2000,118,152'), true);
});

test('Technical & UX Upgrades 1-5: Day 3 Grip Dividers, Overhead Rope Extensions, 2.5 lb Micro-Loading, Cascading Set Auto-Fill & 3-Pulse DSP Chime', async () => {
  const mod = await import('./workoutLogic.ts');

  // 1. Day 3 Pull-Ups: 3 Grip Dividers & 3 Dedicated Videos + Set 1-9 Row Labels
  assert.equal(mod.DAY3_PULLUP_GRIP_BLOCKS.length, 3);
  const g1 = mod.getDay3PullupGripDividerForSet(1);
  const g2 = mod.getDay3PullupGripDividerForSet(4);
  const g3 = mod.getDay3PullupGripDividerForSet(7);
  assert.equal(mod.getDay3PullupGripDividerForSet(2), null);
  assert.equal(g1?.title, 'GRIP 1 OF 3 (SETS 1–3) • NORMAL OVERHAND GRIP');
  assert.equal(g1?.videoUrl, 'http://www.youtube.com/watch?v=OEXosPwzFdc');
  assert.equal(g2?.title, 'CHANGE GRIP -> GRIP 2 OF 3 (SETS 4–6) • CLOSE UNDERHAND (PINKIES TOUCHING)');
  assert.equal(g2?.videoUrl, 'http://www.youtube.com/watch?v=ZouXLZwAUvs');
  assert.equal(g3?.title, 'CHANGE GRIP -> GRIP 3 OF 3 (SETS 7–9) • WIDE OVERHAND GRIP (LAT FOCUS)');
  assert.equal(g3?.videoUrl, 'http://www.youtube.com/watch?v=bHC16skSN6Q');

  assert.equal(mod.formatDay3PullupSetRowLabel(1), 'Set 1 (Overhand)');
  assert.equal(mod.formatDay3PullupSetRowLabel(3), 'Set 3 (Overhand)');
  assert.equal(mod.formatDay3PullupSetRowLabel(4), 'Set 4 (Close Underhand)');
  assert.equal(mod.formatDay3PullupSetRowLabel(6), 'Set 6 (Close Underhand)');
  assert.equal(mod.formatDay3PullupSetRowLabel(7), 'Set 7 (Wide Overhand)');
  assert.equal(mod.formatDay3PullupSetRowLabel(9), 'Set 9 (Wide Overhand)');

  // 2. Day 3 Exercise #6/8: Overhead Rope Extensions
  assert.equal(mod.DAY3_OVERHEAD_ROPE_EXTENSION_SPEC.id, 'thu_oh_ext');
  assert.equal(mod.DAY3_OVERHEAD_ROPE_EXTENSION_SPEC.name, 'Overhead Rope Extensions');
  assert.equal(mod.DAY3_OVERHEAD_ROPE_EXTENSION_SPEC.sets, 3);
  assert.equal(mod.DAY3_OVERHEAD_ROPE_EXTENSION_SPEC.reps, '10-15');
  assert.equal(mod.DAY3_OVERHEAD_ROPE_EXTENSION_SPEC.restLabel, '1.5-2 min');
  assert.equal(
    mod.DAY3_OVERHEAD_ROPE_EXTENSION_SPEC.videoUrl,
    'https://www.youtube.com/watch?v=7yoTblFCUQM'
  );

  // 3. Global 2.5 lb Minimum Weight & 2.5 lb Stepper Increments
  assert.equal(mod.getGlobalWeightStepIncrement('lbs'), 2.5);
  assert.equal(mod.getGlobalWeightStepIncrement('kg'), 1.25);
  assert.equal(mod.formatQuickOverloadButtonLabel(45, 'lbs'), '+2.5 lb');
  assert.equal(mod.formatQuickOverloadButtonLabel(45, 'kg'), '+1.25 kg');
  assert.equal(mod.formatQuickOverloadButtonLabel(0, 'lbs'), '+1 Rep');
  assert.equal(mod.stepExerciseWeightValue(5, -2.5, 'lbs'), 2.5);
  assert.equal(mod.stepExerciseWeightValue(2.5, -2.5, 'lbs'), 0);
  assert.equal(mod.stepExerciseWeightValue(0, 2.5, 'lbs'), 2.5);
  assert.equal(mod.stepExerciseWeightValue(17.5, 2.5, 'lbs'), 20);

  // 4. Smart Historical Suggestion (Rule A) & Cascading Auto-Fill (Rule B)
  // Rule A: Before Set 1 is logged today, suggest previous week's performance
  const ruleASug = mod.resolveExerciseSetSuggestion({
    setNum: 1,
    currentEntry: null,
    todaySet1Entry: null,
    prevWeekEntry: { weight: '62.5', reps: '9', sourceLabel: 'Wk 1', unit: 'lbs' },
    defaultWeight: 60,
    defaultReps: 10
  });
  assert.equal(ruleASug.source, 'previous_week');
  assert.equal(ruleASug.suggestedWeight, '62.5');
  assert.equal(ruleASug.suggestedReps, '9');
  assert.equal(ruleASug.prevWeekBadgeText, 'Last (Wk 1): 62.5 lbs × 9');

  // Rule B: After Set 1 is logged today (e.g. 67.5 lbs x 11), cascade to Set 2 and Set 3
  let logs: Record<string, SetLog> = {
    w2_2_thu_inc_db_1: { weight: '67.5', reps: '11', done: true, unit: 'lbs' }
  };
  logs = mod.cascadeLoggedSetToSubsequentUnloggedSets(
    logs,
    2,
    2,
    'thu_inc_db',
    1,
    3,
    '67.5',
    '11',
    'lbs'
  );
  assert.equal(logs.w2_2_thu_inc_db_2.weight, '67.5');
  assert.equal(logs.w2_2_thu_inc_db_2.reps, '11');
  assert.equal(logs.w2_2_thu_inc_db_2.done, false);
  assert.equal(logs.w2_2_thu_inc_db_3.weight, '67.5');
  assert.equal(logs.w2_2_thu_inc_db_3.reps, '11');

  // 5. Warm Harmonious Acoustic Timer Chime (Zero-Crackle 0.55 Linear Headroom + 3 Tone Presets + 55% Default Volume)
  assert.equal(mod.DEFAULT_TIMER_TONE, 'warm_marimba');
  assert.equal(mod.DEFAULT_TIMER_VOLUME, 0.55);
  assert.equal(mod.CHIME_HTML_AUDIO_VOLUME, 0.55);
  assert.equal(mod.CHIME_MAX_LINEAR_PEAK, 0.55);
  assert.equal(mod.clampTimerVolume(undefined), 0.55);
  assert.equal(mod.clampTimerVolume(0.01), 0.05);
  assert.equal(mod.clampTimerVolume(1.5), 1.0);
  assert.equal(mod.formatTimerVolumePercent(0.55), '55%');
  assert.equal(mod.normalizeTimerTonePreset('soft_bell'), 'soft_bell');
  assert.equal(mod.normalizeTimerTonePreset('gentle_tap'), 'gentle_tap');
  assert.equal(mod.normalizeTimerTonePreset('invalid_tone'), 'warm_marimba');

  const maxAllowedPcm = Math.round(32767 * 0.55); // 18022 (-5.2 dBFS pure linear headroom)
  for (const preset of ['warm_marimba', 'soft_bell', 'gentle_tap'] as const) {
    const wavBytes = mod.generatePreRenderedChimeWavBytes(44100, preset);
    const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
    const totalSamples = (wavBytes.byteLength - 44) / 2;
    const leadInSamples = Math.round(44100 * 0.10); // 100ms
    const trailingSamples = Math.round(44100 * 0.45); // 450ms

    // Verify first 100ms (4410 samples) are pure digital silence (0)
    assert.equal(view.getInt16(44, true), 0);
    assert.equal(view.getInt16(44 + (leadInSamples - 1) * 2, true), 0);

    // Verify last 450ms (19845 samples) are pure digital silence (0)
    assert.equal(view.getInt16(44 + (totalSamples - trailingSamples) * 2, true), 0);
    assert.equal(view.getInt16(44 + (totalSamples - 1) * 2, true), 0);

    // Verify active signal is non-zero and strictly bounded by 0.55 linear headroom (<= 18022)
    let maxAbsPcm = 0;
    for (let i = leadInSamples; i < totalSamples - trailingSamples; i++) {
      const val = Math.abs(view.getInt16(44 + i * 2, true));
      if (val > maxAbsPcm) maxAbsPcm = val;
    }
    assert.equal(
      maxAbsPcm > 8000 && maxAbsPcm <= maxAllowedPcm,
      true,
      `Preset ${preset} peak PCM ${maxAbsPcm} must be in (8000, ${maxAllowedPcm}]`
    );
  }
});

test('Upgrades 1-4: HR Recovery Readiness Alert, Watch MediaSession, 7-Day Trend Weight, Progress Photos & Analytics Dashboard', async () => {
  const mod = await import('./workoutLogic.ts');

  // 1. Heart Rate Recovery Readiness Alert & Watch MediaSession Metadata
  const earlyCheck = mod.evaluateHrRecoveryReadiness({
    timerRunning: true,
    elapsedRestSec: 12, // < 20s minimum rest
    liveBpm: 118,
    startRestBpm: 152
  });
  assert.equal(earlyCheck.isRecovered, false);
  assert.equal(earlyCheck.reason, 'waiting_min_rest');

  const readyCheck = mod.evaluateHrRecoveryReadiness({
    timerRunning: true,
    elapsedRestSec: 25,
    liveBpm: 118,
    startRestBpm: 152,
    alreadyAlertedThisRest: false
  });
  assert.equal(readyCheck.isRecovered, true);
  assert.equal(readyCheck.shouldTriggerAlert, true);
  assert.equal(readyCheck.badgeText, 'HR Recovered (118 BPM) — Ready for Next Set!');

  const dropOnlyCheck = mod.evaluateHrRecoveryReadiness({
    timerRunning: true,
    elapsedRestSec: 28,
    liveBpm: 125, // above 120, but 155 - 125 = 30 >= 25 drop
    startRestBpm: 155,
    alreadyAlertedThisRest: true
  });
  assert.equal(dropOnlyCheck.isRecovered, true);
  assert.equal(dropOnlyCheck.shouldTriggerAlert, false); // already alerted once this rest
  assert.equal(dropOnlyCheck.reason, 'drop_from_peak');

  const mediaMeta = mod.buildWatchMediaSessionMetadataPayload({
    timerRunning: true,
    timerSeconds: 75,
    contextLabel: 'Rest: Barbell Bench Press',
    nextSetSummary: 'Set 2 Barbell Bench Press (135 lbs x 8)',
    liveBpm: 128
  });
  assert.equal(mediaMeta.title, ' 01:15 • Rest: Barbell Bench Press • 128 BPM');
  assert.equal(mediaMeta.artist, 'Up Next: Set 2 Barbell Bench Press (135 lbs x 8)');
  assert.equal(mediaMeta.album, '7AM Vegan Muscle & Training Hub');

  // 2. Biometric Profile & 7-Day Exponential Moving Average Trend Weight
  assert.equal(mod.formatHeightDisplay(178, 'cm'), '178 cm');
  assert.equal(mod.formatHeightDisplay(178, 'ft_in'), '5\'10"');

  const sampleWeighIns: mod.BodyWeightLogEntry[] = [
    { date: '2026-11-05', weight: 172.0, unit: 'lbs' },
    { date: '2026-11-06', weight: 171.4, unit: 'lbs' },
    { date: '2026-11-07', weight: 171.8, unit: 'lbs' },
    { date: '2026-11-08', weight: 170.6, unit: 'lbs' },
    { date: '2026-11-09', weight: 169.8, unit: 'lbs' },
    { date: '2026-11-10', weight: 169.2, unit: 'lbs' },
    { date: '2026-11-11', weight: 168.5, unit: 'lbs' }
  ];
  const trendResult = mod.calculateBodyWeightTrendSeries(sampleWeighIns, 'lbs');
  assert.equal(trendResult.points.length, 7);
  assert.equal(trendResult.latestScaleWeight, 168.5);
  assert.equal(trendResult.latestTrendWeight > 168.5 && trendResult.latestTrendWeight < 171.5, true);
  assert.equal(trendResult.sevenDayTrendDelta < 0, true);

  // 3. Side-by-Side Progress Photo Comparison (Before vs. After)
  const samplePhotos: mod.ProgressPhotoItem[] = [
    {
      id: 'p_wk1',
      date: '2026-11-01',
      week: 1,
      weight: 172.0,
      unit: 'lbs',
      pose: 'Front',
      note: 'Week 1 Baseline',
      dataUrl: 'data:image/svg+xml;utf8,<svg></svg>'
    },
    {
      id: 'p_wk2',
      date: '2026-11-11',
      week: 2,
      weight: 168.5,
      unit: 'lbs',
      pose: 'Front',
      note: 'End of Week 2',
      dataUrl: 'data:image/svg+xml;utf8,<svg></svg>'
    }
  ];
  const comp = mod.selectBeforeAfterProgressPhotos(samplePhotos);
  assert.equal(comp.beforePhoto?.id, 'p_wk1');
  assert.equal(comp.afterPhoto?.id, 'p_wk2');
  assert.equal(comp.weightDelta, -3.5);
  assert.equal(comp.weightDeltaLabel, '-3.5 lbs');

  // 4. Competitor Analytics Dashboard: Epley 1RM, Weekly Tonnage & Pull-Up PRs
  assert.equal(mod.calculateEpleyOneRepMax(135, 10), 180); // 135 * (1 + 10/30) = 180
  assert.equal(mod.calculateEpleyOneRepMax(225, 1), 225);

  const mockLogs: Record<string, SetLog> = {
    w1_0_day1_pullups_1: { weight: '0', reps: '6', done: true, unit: 'lbs' },
    w1_0_day1_pullups_2: { weight: '0', reps: '5', done: true, unit: 'lbs' },
    w1_0_mon_bench_1: { weight: '135', reps: '10', done: true, unit: 'lbs' },
    w1_0_mon_ohp_1: { weight: '85', reps: '8', done: true, unit: 'lbs' },
    w1_1_tue_squat_1: { weight: '185', reps: '8', done: true, unit: 'lbs' },
    w1_4_sat_deadlift_1: { weight: '225', reps: '6', done: true, unit: 'lbs' },
    w2_0_mon_bench_1: { weight: '140', reps: '10', done: true, unit: 'lbs' }
  };

  const weeklyTonnage = mod.calculateWeeklyTonnageByWeek(mockLogs, 2);
  // Week 1: 135*10 (1350) + 85*8 (680) + 185*8 (1480) + 225*6 (1350) = 4860 lbs
  assert.equal(weeklyTonnage[0].week, 1);
  assert.equal(weeklyTonnage[0].totalVolumeLbs, 4860);
  assert.equal(weeklyTonnage[1].week, 2);
  assert.equal(weeklyTonnage[1].totalVolumeLbs, 1400);

  const prStats = mod.calculateKeyLiftAndPullupPrs(mockLogs, 1);
  assert.equal(prStats.highestSingleSetPullupReps, 6);
  assert.equal(prStats.weeklyPullupVolumeReps, 11);
  const benchPr = prStats.keyLifts.find(l => l.id === 'mon_bench');
  assert.equal(benchPr?.bestWeightLbs, 140);
  assert.equal(benchPr?.estimated1RmLbs, mod.calculateEpleyOneRepMax(140, 10));
});

test('Mobile Chrome Layout & Samsung Galaxy Watch (Wear OS) Fixes: No Fake BPM by Default + ServiceWorker Notification Payload', async () => {
  const mod = await import('./workoutLogic');

  // Never show live BPM when disconnected or when liveBpm is null/0
  assert.equal(mod.shouldShowLiveHeartRateUi({ bleConnected: false, liveBpm: null }), false);
  assert.equal(mod.shouldShowLiveHeartRateUi({ bleConnected: false, liveBpm: 138 }), false);
  assert.equal(mod.shouldShowLiveHeartRateUi({ bleConnected: true, liveBpm: null }), false);
  assert.equal(mod.shouldShowLiveHeartRateUi({ bleConnected: true, liveBpm: 124 }), true);

  // Wear OS / Samsung Galaxy Watch notification payload
  const wristPayload = mod.buildWearOsWristNotificationPayload({
    title: 'Rest Complete! Start Next Set',
    nextSetSummary: 'Set 2 Barbell Bench Press (135 lbs x 8)',
    liveBpm: null,
    bleConnected: false
  });
  assert.equal(wristPayload.title, 'Rest Complete! Start Next Set');
  assert.equal(wristPayload.options.body, 'Up Next: Set 2 Barbell Bench Press (135 lbs x 8)');
  assert.deepEqual(wristPayload.options.vibrate, [300, 150, 300, 150, 400]);
  assert.equal(wristPayload.options.tag, 'gym-rest-timer');
  assert.equal(wristPayload.options.renotify, true);
  assert.equal(wristPayload.options.requireInteraction, true);
});

test('Watch Modal Refactor: Zero acceptAllDevices, Automatic OS Watch Sync, 5s Lock-Screen Test & Health Connect Bridge', async () => {
  const mod = await import('./workoutLogic');

  // 1. BLE Chest Strap options never include acceptAllDevices and strictly filter on ['heart_rate']
  const bleOpts = mod.getBleChestStrapRequestOptions() as Record<string, unknown>;
  assert.equal('acceptAllDevices' in bleOpts, false);
  assert.deepEqual(bleOpts.filters, [{ services: ['heart_rate'] }]);

  // 2. Automatic OS Watch Sync status banner
  const osSyncGranted = mod.getOsWatchSyncStatusBanner('granted', true);
  assert.equal(osSyncGranted.connected, true);
  assert.equal(
    osSyncGranted.bannerText,
    'Connected via Phone OS (Samsung Galaxy Watch / Apple Watch / Garmin)'
  );
  assert.equal(
    osSyncGranted.howItWorksText,
    'Your watch is already paired to your phone. Enable Wrist Timer Alerts below so rest and cooking timers vibrate directly on your watch.'
  );

  // 3. 5-Second Lock-Screen Watch Test exact payload
  const fiveSecPayload = mod.buildFiveSecondWatchTestNotificationPayload();
  assert.equal(fiveSecPayload.title, 'Rest Complete (00:00)');
  assert.equal(fiveSecPayload.options.body, 'Next Set: 135 lbs x 8 reps');
  assert.deepEqual(fiveSecPayload.options.vibrate, [300, 150, 300, 150, 400]);
  assert.equal(fiveSecPayload.options.tag, 'watch-test');
  assert.equal(fiveSecPayload.options.renotify, true);
  assert.equal(fiveSecPayload.options.requireInteraction, true);

  // 4. Health Connect / Samsung Health & Apple Health bridge status
  const healthStatus = mod.getHealthBridgePlatformStatus(false, true);
  assert.equal(
    healthStatus.toggleLabel,
    'Sync Workouts & Nutrition with Android Health Connect / Samsung Health & Apple Health'
  );
  assert.equal(healthStatus.actionButtonLabel, 'Sync Now / Export Health Data');
});

test('Android Chrome PWA Installability, 1-Tap Watch Auto-Connect & Continuous MediaSession (Zero Emojis)', async () => {
  const mod = await import('./workoutLogic');

  // 1. Instant Channel Registration Ping payload
  const initPing = mod.buildWatchInitConfirmationNotificationPayload();
  assert.equal(initPing.title, 'Budget Gym Connected');
  assert.equal(initPing.options.body, 'Rest & cooking timers will now vibrate on your watch.');
  assert.deepEqual(initPing.options.vibrate, [200, 100, 200]);
  assert.equal(initPing.options.tag, 'gym-watch-init');
  assert.equal(initPing.options.renotify, true);

  // 2. 1-Tap Watch Button & Blocked Permission UI states
  const defaultPermUi = mod.getWatchPermissionUiState('default', false, true);
  assert.equal(defaultPermUi.primaryButtonLabel, '1-Tap Connect Watch Alerts (Allow Notifications)');
  assert.equal(defaultPermUi.isDenied, false);
  assert.equal(defaultPermUi.showInstallPwaButton, true);
  assert.equal(defaultPermUi.installPwaButtonLabel, 'Install App to Phone');

  const deniedPermUi = mod.getWatchPermissionUiState('denied', false, false);
  assert.equal(deniedPermUi.isDenied, true);
  assert.equal(
    deniedPermUi.deniedGuideText,
    'Notifications are blocked by Chrome. Tap the 3-dot menu (top right) -> Site controls -> Permissions -> Allow Notifications.'
  );

  // 3. Continuous Workout MediaSession state
  const mediaRunning = mod.buildContinuousMediaSessionState({
    isTimerRunning: true,
    timerSeconds: 75,
    contextLabel: 'Rest: Barbell Bench Press',
    nextSetSummary: 'Set 2 Barbell Bench Press (135 lbs x 8)',
    liveBpm: null,
    currentWeek: 1,
    selectedDayIndex: 0
  });
  assert.equal(mediaRunning.playbackState, 'playing');
  assert.equal(mediaRunning.title, '01:15 Rest • Rest: Barbell Bench Press');
  assert.equal(mediaRunning.artist, 'Set 2 Barbell Bench Press (135 lbs x 8)');
});

test('Sticky Timer Green Progress Bar, Negative Overtime, Final-Set Stop, 5-Min Reminder & Pull-Up Badges', async () => {
  const mod = await import('./workoutLogic');

  // 1. Default to last-used timer duration & negative overtime formatting
  const idle90 = mod.formatRestTimerReadout(90, 90, false);
  assert.equal(idle90.clockText, '01:30');
  assert.equal(idle90.pinnedBadgeText, '01:30 (1.5m)');
  assert.equal(idle90.isOvertime, false);

  const overtime10 = mod.formatRestTimerReadout(-10, 90, true);
  assert.equal(overtime10.clockText, '-00:10');
  assert.equal(overtime10.pinnedBadgeText, '1.5m • -00:10 Overtime');
  assert.equal(overtime10.isOvertime, true);

  // 2. Green progress bar states (idle 100%, counting down proportional, overtime 100% pulsing amber)
  const barIdle = mod.computeTimerProgressBarState(90, 90, false);
  assert.equal(barIdle.widthPct, 100);
  assert.equal(barIdle.isOvertime, false);

  const barHalf = mod.computeTimerProgressBarState(45, 90, true);
  assert.equal(barHalf.widthPct, 50);
  assert.equal(barHalf.isOvertime, false);

  const barOvertime = mod.computeTimerProgressBarState(-5, 90, true);
  assert.equal(barOvertime.widthPct, 100);
  assert.equal(barOvertime.isOvertime, true);

  // 3. Final set of workout or final set of last exercise stops timer immediately
  assert.equal(
    mod.shouldStopTimerOnFinalSetLogged({
      doneSetsToday: 24,
      totalSetsToday: 24,
      isLastExerciseOfDay: false,
      isFinalSetOfExercise: true
    }),
    true
  );
  assert.equal(
    mod.shouldStopTimerOnFinalSetLogged({
      doneSetsToday: 18,
      totalSetsToday: 24,
      isLastExerciseOfDay: true,
      isFinalSetOfExercise: true
    }),
    true
  );
  assert.equal(
    mod.shouldStopTimerOnFinalSetLogged({
      doneSetsToday: 10,
      totalSetsToday: 24,
      isLastExerciseOfDay: false,
      isFinalSetOfExercise: false
    }),
    false
  );

  // 4. Pull-Ups tab idle vs running rest timer badges
  assert.equal(mod.formatPullupDayTimerBadge(1, 90, false, '01:30'), 'Rest: 90s (1.5m)');
  assert.equal(mod.formatPullupDayTimerBadge(2, 30, false, '01:30'), 'Rest: 30s (10s x Reps)');
  assert.equal(mod.formatPullupDayTimerBadge(3, 60, false, '01:30'), 'Rest: 60s (1m)');
  assert.equal(mod.formatPullupDayTimerBadge(4, 60, false, '01:30'), 'Rest: 60s (1m)');
  assert.equal(mod.formatPullupDayTimerBadge(5, 90, false, '01:30'), 'Rest: 90s (1.5m)');
  assert.equal(mod.formatPullupDayTimerBadge(2, 30, true, '00:22'), '00:22 (30s)');

  // 5. 5-Minute Forgotten Last Set Reminder evaluation
  const baseTs = 1700000000000;
  const notYet5Min = mod.evaluateForgottenLastSetReminder({
    doneSetsToday: 23,
    totalSetsToday: 24,
    lastWorkoutActivityAt: baseTs,
    nowMs: baseTs + 120000,
    nextExerciseName: 'Daily Cable Abdominal Crunch',
    nextSetNum: 3,
    nextWeightLbs: 57.5,
    nextReps: 12
  });
  assert.equal(notYet5Min.shouldRemind, false);

  const after5Min = mod.evaluateForgottenLastSetReminder({
    doneSetsToday: 23,
    totalSetsToday: 24,
    lastWorkoutActivityAt: baseTs,
    nowMs: baseTs + 305000,
    nextExerciseName: 'Daily Cable Abdominal Crunch',
    nextSetNum: 3,
    nextWeightLbs: 57.5,
    nextReps: 12
  });
  assert.equal(after5Min.shouldRemind, true);
  assert.equal(after5Min.remainingSets, 1);
  assert.equal(after5Min.bannerTitle, 'Did you finish your workout? (5+ min since last set)');
  assert.equal(
    after5Min.bannerSubtitle,
    'You have 1 unlogged set(s) left today — Next: Daily Cable Abdominal Crunch (Set 3: 57.5 lbs x 12).'
  );
  assert.equal(after5Min.notificationTitle, 'Did you finish your last set?');
  assert.equal(after5Min.notificationOptions.tag, 'unfinished-workout-reminder');
});

test('Synchronized 7-Day Pull-Up Selector, Customizable Rest Day Scheduler & Non-Destructive Slot Mapping', async () => {
  const mod = await import('./workoutLogic');

  // 1. Default Rest Days (Days 6 & 7 -> indices [5, 6]): Days 1-5 map to slots 0..4, Days 6-7 map to slots 5..6
  const defRest = mod.getWeekRestDays(undefined, 1);
  assert.deepEqual(defRest, [5, 6]);
  assert.equal(mod.formatRestDaysBadgeLabel(defRest), 'Schedule: Rest Days 6 & 7 (Change)');

  const d1Def = mod.getDayAssignment(1, 0, { weeklyRestDays: { 1: [5, 6] } });
  assert.equal(d1Def.templateSlotIndex, 0);
  assert.equal(d1Def.daySub, 'Upper 1');
  assert.equal(d1Def.pullupSessionNum, 1);
  assert.equal(d1Def.isRestDay, false);
  assert.equal(d1Def.waterTargetMl, 3000);
  assert.equal(d1Def.showPreGymFuelCheck, true);

  const d6Def = mod.getDayAssignment(1, 5, { weeklyRestDays: { 1: [5, 6] } });
  assert.equal(d6Def.templateSlotIndex, 5);
  assert.equal(d6Def.daySub, 'Rest 1');
  assert.equal(d6Def.pullupSessionNum, null);
  assert.equal(d6Def.isRestDay, true);
  assert.equal(d6Def.waterTargetMl, 2500);
  assert.equal(d6Def.showPreGymFuelCheck, false);

  // 2. BWS Recommended Recovery Split (Rest on Days 3 & 7 -> indices [2, 6]):
  // Day 1 -> Upper 1 (0), Day 2 -> Lower 1 (1), Day 3 -> Rest 1 (5), Day 4 -> Push (2), Day 5 -> Pull (3), Day 6 -> Lower 2 (4), Day 7 -> Rest 2 (6)
  const bwsState = { weeklyRestDays: { 1: [2, 6] } };
  const bwsSlots = [0, 1, 2, 3, 4, 5, 6].map(calIdx => mod.getDayAssignment(1, calIdx, bwsState));
  assert.deepEqual(
    bwsSlots.map(s => s.templateSlotIndex),
    [0, 1, 5, 2, 3, 4, 6]
  );
  assert.deepEqual(
    bwsSlots.map(s => s.daySub),
    ['Upper 1', 'Lower 1', 'Rest 1', 'Push', 'Pull', 'Lower 2', 'Rest 2']
  );
  assert.deepEqual(
    bwsSlots.map(s => s.pullupSessionNum),
    [1, 2, null, 3, 4, 5, null]
  );
  // Day 3 (calIdx 2) is now a Rest Day (2500 ml, no pre-gym fuel check), while Day 6 (calIdx 5) is now Lower 2 Lift Day (3000 ml, pre-gym fuel check)
  assert.equal(bwsSlots[2].waterTargetMl, 2500);
  assert.equal(bwsSlots[2].showPreGymFuelCheck, false);
  assert.equal(bwsSlots[5].waterTargetMl, 3000);
  assert.equal(bwsSlots[5].showPreGymFuelCheck, true);

  // Reverse lookup: Push (slot 2) is on calendar Day 4 (calIdx 3)
  assert.equal(mod.getCalendarDayForTemplateSlot(1, 2, bwsState), 3);

  // 3. 1-Tap "Swap Today to Rest Day" on Day 3 (calIdx 2) from default [5, 6] shifts Push/Pull/Lower 2 forward
  const swappedToRest = mod.swapTodayToRestDay([5, 6], 2);
  assert.deepEqual(swappedToRest, [2, 6]);

  // 4. 1-Tap "Train Today Instead (Swap with Next Workout)" on Day 3 (calIdx 2) pulls Push back into Day 3 and moves Rest to Day 4 (calIdx 3)
  const swappedToTrain = mod.swapRestDayWithNextWorkout([2, 6], 2);
  assert.deepEqual(swappedToTrain, [3, 6]);
  const d3AfterSwap = mod.getDayAssignment(1, 2, swappedToTrain);
  assert.equal(d3AfterSwap.isRestDay, false);
  assert.equal(d3AfterSwap.templateSlotIndex, 2);
  assert.equal(d3AfterSwap.daySub, 'Push');

  // 5. Next Pull-Up Training Day helper from Rest Day 3 (calIdx 2) jumps to Day 4 (calIdx 3, Pull-Up Session 3)
  const nextPullup = mod.getNextPullupTrainingCalendarDay(1, 2, bwsState);
  assert.equal(nextPullup.calendarDayIdx, 3);
  assert.equal(nextPullup.dayNumber, 4);
  assert.equal(nextPullup.pullupSessionNum, 3);
  assert.equal(nextPullup.daySub, 'Push');
});

test('Vector SVG Pictograms, Rest Day Recovery Card & 2-Phase Jasmine Rice Timer (1.5m Mix Interval)', async () => {
  const mod = await import('./workoutLogic');

  // 1. Vector SVG ICONS dictionary covers all 5 bottom tabs and header/card badges with zero emojis
  const requiredIcons = [
    'workout',
    'pullups',
    'timer',
    'vegan',
    'shopping',
    'ai',
    'watch',
    'user',
    'share',
    'water',
    'warmup',
    'preGymFuel'
  ];
  for (const key of requiredIcons) {
    assert.ok(mod.ICONS[key], `Missing SVG icon for ${key}`);
    assert.ok(mod.ICONS[key].startsWith('<svg'), `Icon ${key} must be an inline <svg>`);
    assert.ok(mod.ICONS[key].includes('stroke="currentColor"'), `Icon ${key} must use stroke="currentColor"`);
  }

  // 2. Idle Rice Timer badge never displays static 01:30 gym rest timer
  assert.equal(mod.getIdleOrRunningRiceTimerBadge(null, 90, 12, 1), '12:00 Cook');
  assert.equal(mod.getIdleOrRunningRiceTimerBadge(null, 90, 10, 1), '10:00 Cook');
  assert.equal(mod.getIdleOrRunningRiceTimerBadge(null, 90, 12, 2), '10:00 Cool-Down');
  assert.equal(mod.getIdleOrRunningRiceTimerBadge(1, 630, 12, 1), '10:30 Cook');
  assert.equal(mod.getIdleOrRunningRiceTimerBadge(2, 480, 12, 2), '08:00 Cool-Down');

  // 3. 2-Phase Rice Timer specs & 90s (1.5m) mix interval alerts
  const stages12 = mod.getTwoPhaseRiceTimerStages(12);
  assert.equal(stages12.length, 2);
  assert.equal(stages12[0].seconds, 720);
  assert.equal(stages12[0].buttonLabel, '1. Cook Rice (10–12m • Mix Every 1.5m)');
  assert.equal(
    stages12[0].completionBanner,
    'COOKING DONE! Remove from heat & tap Stage 2: 10-Min Cool-Down'
  );
  assert.equal(stages12[1].seconds, 600);
  assert.equal(stages12[1].buttonLabel, '2. Cool-Down & Steam Rest (10m)');
  assert.equal(
    stages12[1].completionBanner,
    'RICE READY! Portion into 4 x 150g bowls (600g total)'
  );

  // At 10:30 remaining out of 12:00 (90s elapsed), mix alert triggers
  const mixAt1030 = mod.computeRiceMixIntervalState(720, 630, true, null);
  assert.equal(mixAt1030.elapsedSec, 90);
  assert.equal(mixAt1030.shouldTriggerMixAlert, true);
  assert.equal(mixAt1030.mixAlertBannerText, 'MIX / STIR RICE NOW! (1.5m interval — prevents sticking)');

  // At 10:00 remaining (120s elapsed), 60s left until next mix at 09:00
  const mixAt1000 = mod.computeRiceMixIntervalState(720, 600, true, 90);
  assert.equal(mixAt1000.shouldTriggerMixAlert, false);
  assert.equal(mixAt1000.secondsUntilNextMix, 60);
  assert.equal(mixAt1000.nextMixFormatted, '01:00');

  // 4. Rest & Muscle Recovery Card Spec
  const restSpec = mod.getRestDayRecoveryCardSpec({
    loggedWaterMl: 1000,
    loggedMealsCount: 2,
    walkChecked: false,
    optionalItemsCount: 2
  });
  assert.equal(restSpec.title, 'Rest & Muscle Recovery Day');
  assert.equal(
    restSpec.statusBanner,
    'Active Recovery & Supercompensation Day — 48h muscle protein synthesis & tendon recovery.'
  );
  assert.equal(restSpec.waterPillText, 'Water Target: 1,000 / 2,500 ml (+500 ml)');
  assert.equal(restSpec.fuelPillText, 'Muscle Fuel: 2 / 4 Meals (1,300 kcal • 138g P)');
  assert.equal(restSpec.walkPillText, 'Light Recovery Walk: 8,000–10,000 Steps (Check Off)');
  assert.equal(restSpec.mobilityDrawerSummary, 'Optional Rest-Day Mobility & Core (2 items) — Tap to Open');
});

test('PWA Vector-Path GYM Icon (Zero <text> Tags) & 1-Tap Watch Master Switch Spec', async () => {
  const mod = await import('./workoutLogic');

  const svg192 = mod.buildGymVectorPathSvg(192);
  const svg512 = mod.buildGymVectorPathSvg(512);
  assert.equal(svg192.includes('<text'), false, 'SVG icon must not use <text> tags that Android WebAPK strips');
  assert.equal(svg512.includes('<text'), false, 'SVG icon must not use <text> tags that Android WebAPK strips');
  assert.equal(svg512.includes('fill="#10b981"'), true, 'SVG icon must have #10b981 emerald badge background');
  assert.equal(svg512.includes('fill="#020617"'), true, 'SVG icon must have #020617 dark slate GYM vector paths');
  assert.equal(svg512.includes(mod.GYM_VECTOR_LETTER_PATHS.G), true);
  assert.equal(svg512.includes(mod.GYM_VECTOR_LETTER_PATHS.Y), true);
  assert.equal(svg512.includes(mod.GYM_VECTOR_LETTER_PATHS.M), true);

  const offSpec = mod.getWatchMasterSwitchSpec('default', false, false);
  assert.equal(offSpec.isActive, false);
  assert.equal(offSpec.buttonLabel, 'Turn ON Watch Alerts (1-Tap Connect)');
  assert.equal(offSpec.headerDotVisible, false);

  const activeSpec = mod.getWatchMasterSwitchSpec('granted', true, false);
  assert.equal(activeSpec.isActive, true);
  assert.equal(activeSpec.buttonLabel, 'Watch Alerts: ACTIVE (Tap to Test Wrist Vibration in 5s)');
  assert.equal(activeSpec.headerDotVisible, true);
  assert.equal(activeSpec.headerDotClass.includes('bg-emerald-400'), true);
  assert.equal(activeSpec.checklistBullets.length, 3);
});

test('7 Upgrades Suite: Single Timer Bar, Pull-Up Pyramid + Day 5 Selector, Decoupled Oats/Rice Inventory, Rice Timer Recipe Sync & AI Machine Swap', async () => {
  const mod = await import('./workoutLogic');

  // 1. Single sticky top timer bar across all 5 tabs
  for (const tab of ['workout', 'pullups', 'timer', 'vegan', 'shopping']) {
    assert.equal(mod.shouldShowStickyTopTimerBarAcrossAllTabs(tab), true);
  }

  // 2A. Pull-Up Pyramid Auto-Increment (1 -> 2 -> 3 -> 4 + Max Set) & 10s * N rest timer
  const set1Logged = mod.computePyramidNextSetSuggestions(0, 1, 5);
  assert.equal(set1Logged.nextSetIndex, 1);
  assert.equal(set1Logged.suggestedRepsBySetIndex[1], 2);
  assert.equal(set1Logged.suggestedRepsBySetIndex[2], 3);
  assert.equal(set1Logged.suggestedRepsBySetIndex[3], 4);
  assert.equal(set1Logged.suggestedRepsBySetIndex[4], 5);
  assert.equal(set1Logged.restTimerSeconds, 10);

  const set2Logged = mod.computePyramidNextSetSuggestions(1, 2, 5);
  assert.equal(set2Logged.nextSetIndex, 2);
  assert.equal(set2Logged.suggestedRepsBySetIndex[2], 3);
  assert.equal(set2Logged.restTimerSeconds, 20);

  const set3Logged = mod.computePyramidNextSetSuggestions(2, 3, 4);
  assert.equal(set3Logged.nextSetIndex, 3);
  assert.equal(set3Logged.suggestedRepsBySetIndex[3], 4);
  assert.equal(set3Logged.restTimerSeconds, 30);

  // 2B. Day 5 Hardest-Day Recommendation & Next-Week Persistence
  const defaultRec = mod.recommendHardestPullupSession({});
  assert.equal(defaultRec.recommendedOptionId, 'option_c');
  assert.equal(defaultRec.recommendedSessionNum, 3);

  const loggedRec = mod.recommendHardestPullupSession({
    1: [{ reps: 6, done: true }, { reps: 5, done: true }, { reps: 3, done: true }, { reps: 2, done: true }, { reps: 2, done: true }],
    2: [{ reps: 1, done: true }, { reps: 2, done: true }]
  });
  assert.equal(loggedRec.recommendedOptionId, 'option_a');

  // Week 2 inherits Week 1's chosen Option B automatically
  const week2Resolved = mod.resolveDay5HardestChoiceForWeek(2, { 1: 'option_b' }, 'option_b');
  assert.equal(week2Resolved.id, 'option_b');
  assert.equal(week2Resolved.isPyramid, true);
  assert.equal(week2Resolved.setsCount, 5);

  const week3OptionC = mod.resolveDay5HardestChoiceForWeek(3, { 3: 'option_c' }, 'option_b');
  assert.equal(week3OptionC.id, 'option_c');
  assert.equal(week3OptionC.setsCount, 9);
  assert.equal(week3OptionC.isThreeGrips, true);

  // 3. Decoupled Oats vs. Rice Inventory & Next-Day Prep Prompts
  let inv: mod.BatchInventoryState = { oatsJarsRemaining: 2, riceBowlsRemaining: 2 };
  inv = mod.adjustBatchInventoryForMealToggle(inv, 'lunch', true); // 1 rice bowl left
  assert.equal(inv.riceBowlsRemaining, 1);
  assert.equal(inv.oatsJarsRemaining, 2);

  const lowPrompts = mod.getDecoupledNextDayPrepPrompts(inv);
  assert.equal(lowPrompts.length, 1);
  assert.equal(lowPrompts[0].batchType, 'rice');
  assert.equal(
    lowPrompts[0].bannerText,
    'Jasmine Rice running low (1/4 bowls left) — Schedule Rice Cooking for tomorrow?'
  );

  // 4. Rice Cooking Timer Video Link & Full Recipe + Two-Way Sync with Meal Prep
  assert.equal(mod.RICE_COOKING_TIMER_RECIPE_SPEC.videoUrl, 'https://www.youtube.com/watch?v=dVKVb1NFP8s');
  assert.equal(mod.RICE_COOKING_TIMER_RECIPE_SPEC.methodSteps.length, 4);
  const syncedRice = mod.syncRiceBatchPreppedBothWays({}, inv);
  assert.equal(syncedRice.batchInventory.riceBowlsRemaining, 4);
  assert.equal(syncedRice.recipePrepLogs.rice_step_1, true);
  assert.equal(syncedRice.recipePrepLogs.rice_step_4, true);

  // 6. AI Machine Photo Check & Smart Exercise Swap
  const benchSwap = mod.verifyAndBuildMachineExerciseSwap('mon_bench', 'Barbell Bench Press');
  assert.equal(benchSwap.matchConfirmed, true);
  assert.equal(benchSwap.replacementSpec.replacementName, 'Seated Chest Press Machine');
  assert.equal(
    benchSwap.confirmationPromptText,
    "Machine Match Confirmed: Seated Chest Press Machine targets the same muscles as Barbell Bench Press. Replace today's exercise card?"
  );
  assert.equal(benchSwap.switchBackButtonLabel, 'Switch Back to Barbell Bench Press');
});

test('Universal 22-Exercise Machine Database, Plain English, 0-lb Bar Math, Strip Barbell From Machine Sets & Shared Machine Database', async () => {
  const mod = await import('./workoutLogic');
  assert.equal(mod.UNIVERSAL_MACHINE_SWAPS.length, 22);

  // Verify zero occurrences of forbidden medical or Latin jargon in UNIVERSAL_MACHINE_SWAPS
  const forbiddenJargonRe = new RegExp('bio' + 'mechanical|bio' + 'medical|ma' + 'ker|soleus|gastrocnemius|plantarflexion|dorsiflexion|scapulae|posterior chain', 'i');
  for (const cat of mod.UNIVERSAL_MACHINE_SWAPS) {
    assert.equal(forbiddenJargonRe.test(cat.label), false);
    for (const opt of cat.options) {
      assert.equal(forbiddenJargonRe.test(opt.targetMuscle), false, `Jargon in ${opt.optionId} targetMuscle`);
      assert.equal(forbiddenJargonRe.test(opt.formSetup), false, `Jargon in ${opt.optionId} formSetup`);
    }
  }

  // Check multi-option categories including 3 Calf Raise subtypes
  const squatCat = mod.matchExerciseToUniversalMachineSwaps({ id: 'tue_squat', name: 'Barbell Back Squat' });
  assert.equal(squatCat.options.length, 2);
  assert.equal(squatCat.options[0].name, 'Seated Leg Press Machine');
  assert.equal(squatCat.options[0].primaryVideoUrl, 'https://www.youtube.com/watch?v=nDh_BlnLCGc');
  assert.equal(squatCat.options[1].name, 'Angled Hack Squat Machine');
  assert.equal(squatCat.options[1].primaryVideoUrl, 'https://www.youtube.com/watch?v=g9i05umL5vc');

  const calfCat = mod.matchExerciseToUniversalMachineSwaps({ id: 'sat_seated_calf', name: 'Seated Weighted Calf Raise' });
  assert.equal(calfCat.options.length, 3);
  assert.equal(calfCat.options[0].name, 'Seated Calf Press / Extension Machine');
  assert.equal(calfCat.options[0].primaryVideoUrl, 'https://www.youtube.com/watch?v=ZmDiJvXx344');
  assert.equal(calfCat.options[0].altVideoUrl, 'https://www.youtube.com/watch?v=z0FtV_s_GVA');
  assert.equal(calfCat.options[0].altVideoUrl2, 'https://www.youtube.com/watch?v=1cvpm--Y-4I');
  assert.equal(calfCat.options[1].primaryVideoUrl, 'https://www.youtube.com/watch?v=z1N8ZRsb4bg');
  assert.equal(calfCat.options[2].primaryVideoUrl, 'https://www.youtube.com/watch?v=_OewEscCsbo');

  // Auto-migration from saved exerciseNotes containing "machine" or photo
  const mockState: Record<string, any> = {
    exerciseNotes: {
      sat_seated_calf: { text: 'Machine 90lb / sixe', photoDataUrl: '' },
      mon_bench: { text: 'Pin #8', photoDataUrl: 'data:image/jpeg;base64,abc123' }
    },
    exerciseSwaps: {},
    revertedMachineSwaps: {},
    sharedMachineDatabase: {}
  };
  mod.autoMigrateExerciseNotesToMachineSwaps(mockState);
  assert.equal(mockState.exerciseSwaps.sat_seated_calf.name, 'Seated Calf Press / Extension Machine');
  assert.equal(mockState.exerciseSwaps.sat_seated_calf.videoUrl, 'https://www.youtube.com/watch?v=ZmDiJvXx344');
  assert.equal(mockState.exerciseSwaps.mon_bench.name, 'Seated Chest Press Machine');
  assert.equal(mockState.exerciseSwaps.mon_bench.videoUrl, 'https://www.youtube.com/watch?v=YXjhMV7uz4c');

  // Universal getEffectiveExercise across any week and day
  const effCalf = mod.getEffectiveExercise(mockState, 2, 4, 6, {
    id: 'sat_seated_calf',
    name: 'Seated Weighted Calf Raise',
    videoUrl: 'https://youtu.be/2TkLMol2bCo',
    restSec: 60,
    notes: 'Original calf setup'
  });
  assert.equal(effCalf.isSwapped, true);
  assert.equal(effCalf.isSwappedMachine, true);
  assert.equal(effCalf.name, 'Seated Calf Press / Extension Machine');
  assert.equal(effCalf.videoUrl, 'https://www.youtube.com/watch?v=ZmDiJvXx344');
  assert.equal(effCalf.altVideoUrl, 'https://www.youtube.com/watch?v=z0FtV_s_GVA');
  assert.equal(effCalf.altVideoUrl2, 'https://www.youtube.com/watch?v=1cvpm--Y-4I');
  assert.equal(effCalf.barWeight, 0);
  assert.equal(effCalf.loadMode, 'plate_2sides');

  // 2-Option Machine Loading Math (Plate-Loaded 2 Sides vs Pin Stack, 0 lb bar)
  const plateMath = mod.computeMachineWeightMath(90, 'lbs', 'plate_2sides');
  assert.equal(plateMath.bar, 0);
  assert.equal(plateMath.perSide, 45);
  assert.equal(plateMath.bothSides, 90);
  assert.equal(plateMath.total, 90);
  assert.equal(plateMath.summaryBadgeText, 'Machine Plates: 45 lbs/side = 90 lbs total');

  const pinMath = mod.computeMachineWeightMath(90, 'lbs', 'pin_stack');
  assert.equal(pinMath.bar, 0);
  assert.equal(pinMath.total, 90);
  assert.equal(pinMath.summaryBadgeText, 'Machine Pin Weight: 90 lbs');

  // Strip 45 lb barbell from sets when switching Barbell Hip Thrust (135 lbs) to Glute Drive Machine (90 lbs = 45 lbs/side)
  const workoutLogs: Record<string, any> = {
    w1_4_sat_hip_thrust_1: { weight: '135', reps: '10', done: true, unit: 'lbs' },
    w1_4_sat_hip_thrust_2: { weight: '135', reps: '10', done: true, unit: 'lbs' },
    w1_4_sat_hip_thrust_3: { weight: '135', reps: '10', done: false, unit: 'lbs' }
  };
  const updatedCount = mod.stripBarbellWeightFromMachineSets(workoutLogs, 'sat_hip_thrust', 45);
  assert.equal(updatedCount, 3);
  assert.equal(workoutLogs.w1_4_sat_hip_thrust_1.weight, '90');
  assert.equal(workoutLogs.w1_4_sat_hip_thrust_2.weight, '90');
  assert.equal(workoutLogs.w1_4_sat_hip_thrust_3.weight, '90');

  // Shared Machine Database persistence
  const savedShared = mod.upsertSharedMachineDatabaseEntry(mockState, {
    originalExKey: 'sat_seated_calf',
    machineName: 'Seated Calf Press / Extension Machine',
    machineSubtype: 'Seated Calf Press / Extension Machine (Footplate Push)',
    loadMode: 'plate_2sides',
    simpleSteps: calfCat.options[0].formSetup,
    targetMuscles: 'Calves',
    videoUrl: 'https://www.youtube.com/watch?v=ZmDiJvXx344'
  });
  assert.equal(savedShared.verifiedByUser, true);
  assert.equal(mockState.sharedMachineDatabase.sat_seated_calf.videoUrl, 'https://www.youtube.com/watch?v=ZmDiJvXx344');

  // Plain-English 3-step AI Vision pipeline
  const steps = mod.getAiVisionPipelineSteps('Barbell Back Squat');
  assert.equal(steps.length, 3);
  assert.equal(steps[0], '1. Scanning machine photo and seat setup...');
  assert.equal(steps[1], '2. Checking machine type and finding matching video for Barbell Back Squat...');
  assert.equal(steps[2], '3. Attaching verified machine form video & setup cues...');
});

test('Subtest 27: Flexible 7-Day Schedule & Smart Next-Workout Recommendation Engine (Wrap to Day 1 when 5/5 Done)', async () => {
  const mod = (await import('./workoutLogic.ts')) as Record<string, any>;
  assert.equal(typeof mod.getCustomDayScheduleForWeek, 'function');
  assert.equal(typeof mod.isWorkoutSlotComplete, 'function');
  assert.equal(typeof mod.getRecommendedNextWorkoutSlot, 'function');
  assert.equal(typeof mod.assignWorkoutOrRestSlotToDay, 'function');

  // Case C: 0 workouts completed -> Recommends Slot 0 (Day 1: Upper Body 1)
  const recStart = mod.getRecommendedNextWorkoutSlot(1, 5, { completedSlots: [] });
  assert.equal(recStart.recommendedSlot, 0);
  assert.equal(recStart.allFiveCompleted, false);
  assert.equal(recStart.reasonBadge, 'Recommended Start: Day 1 • Upper Body 1');

  // Case B: Mid-week (Slots 0 and 1 completed) -> Recommends Slot 2 (Day 3: Upper Body 2 • Push Focus)
  const recMid = mod.getRecommendedNextWorkoutSlot(1, 2, { completedSlots: [0, 1] });
  assert.equal(recMid.recommendedSlot, 2);
  assert.equal(recMid.daySub, 'Push');
  assert.equal(recMid.reasonBadge, 'Recommended Next: Upper Body 2 • Push Focus (Follows your last workout)');

  // Case A: All 5 workouts completed (Slots 0, 1, 2, 3, 4 done) on Day 6 (Rest 1) -> Wraps around to Slot 0 (Day 1: Upper Body 1 • Push & Pull)
  const recAll5 = mod.getRecommendedNextWorkoutSlot(1, 5, { completedSlots: [0, 1, 2, 3, 4] });
  assert.equal(recAll5.recommendedSlot, 0);
  assert.equal(recAll5.allFiveCompleted, true);
  assert.equal(recAll5.reasonBadge, 'Recommended: Day 1 • Upper Body 1 (All 5 Days Completed — Next in Cycle)');
  assert.equal(recAll5.headline, 'Suggested Next Workout: Day 1 — Upper Body 1 • Push & Pull (5/5 workouts finished)');
  assert.equal(recAll5.advanceNextWeekLabel, 'Advance to Week 2 • Day 1 Now');

  // Assigning Bonus Repeat Slot 0 on Day 6 (index 5) when all 5 workouts are complete does NOT overwrite Day 1 (index 0)
  const stateAllDone: Record<string, any> = {
    completedSlotsByWeek: { 1: [0, 1, 2, 3, 4] },
    customDayScheduleByWeek: {}
  };
  const bonusRes = mod.assignWorkoutOrRestSlotToDay(1, 5, 0, stateAllDone);
  assert.deepEqual(bonusRes.schedule, [0, 1, 2, 3, 4, 0, 5]);
  assert.equal(bonusRes.assignment.templateSlotIndex, 0);
  assert.equal(bonusRes.assignment.isBonusRepeat, true);
  assert.equal(bonusRes.assignment.logSlotKey, 'd5_bonus_slot0');
  assert.equal(bonusRes.assignment.waterTargetMl, 3000);

  // Day 1 (index 0) still retains non-bonus Slot 0
  const day1Assign = mod.getDayAssignment(1, 0, stateAllDone);
  assert.equal(day1Assign.templateSlotIndex, 0);
  assert.equal(day1Assign.isBonusRepeat, false);
  assert.equal(day1Assign.logSlotKey, '0');

  // Mid-week swap: Swapping Day 3 (index 2, Push) with Pull (Slot 3 on index 3) auto-shifts displaced workout so all 5 remain
  const stateMidWeek: Record<string, any> = {
    completedSlotsByWeek: { 2: [0, 1] },
    customDayScheduleByWeek: {}
  };
  const midSwapRes = mod.assignWorkoutOrRestSlotToDay(2, 2, 3, stateMidWeek);
  assert.deepEqual(midSwapRes.schedule, [0, 1, 3, 2, 4, 5, 6]);
  assert.equal(midSwapRes.swappedWithDayIdx, 3);
});

test('Subtest 28: Cross-Week Continuity Engine (buildSmartScheduleFromPreviousWeek & Live Reactive Sync)', async () => {
  const mod = (await import('./workoutLogic.ts')) as Record<string, any>;
  assert.equal(typeof mod.buildSmartScheduleFromPreviousWeek, 'function');
  assert.equal(typeof mod.applySmartScheduleFromPreviousWeek, 'function');
  assert.equal(typeof mod.resetWeekScheduleToStandard, 'function');
  assert.equal(typeof mod.syncSubsequentWeeksFromWeek, 'function');

  // Case A (5-day trailing streak): Week 2 had Rest on Days 1 & 2, lifted Days 3..7 ending with Upper 1 (slot 0) on Day 7
  const stateStreak5: Record<string, any> = {
    maxUnlockedWeek: 3,
    customDayScheduleByWeek: {
      '2': [5, 6, 1, 2, 3, 4, 0]
    },
    weeklyRestDays: { default: [5, 6] }
  };
  const smartW3From5 = mod.buildSmartScheduleFromPreviousWeek(3, stateStreak5);
  assert.equal(smartW3From5.lastLiftSlot, 0);
  assert.equal(smartW3From5.lastLiftDayIdx, 6);
  assert.equal(smartW3From5.lastLiftDayNumber, 7);
  assert.equal(smartW3From5.nextStartLiftSlot, 1); // Lower 1
  assert.deepEqual(smartW3From5.orderedLiftQueue, [1, 2, 3, 4, 0]);
  assert.equal(smartW3From5.trailingLiftStreak, 5);
  assert.deepEqual(smartW3From5.restDays, [0, 1]);
  assert.deepEqual(smartW3From5.schedule, [5, 6, 1, 2, 3, 4, 0]);
  assert.equal(smartW3From5.startsWithRestDay, true);
  assert.equal(
    smartW3From5.statusBannerText,
    'Synced from Week 2: Starts with Rest Day + Lower 1 (follows Week 2 Day 7)'
  );

  // Verify getDayAssignment for Week 3 reads the adapted schedule automatically
  const w3Day1 = mod.getDayAssignment(3, 0, stateStreak5);
  const w3Day2 = mod.getDayAssignment(3, 1, stateStreak5);
  const w3Day3 = mod.getDayAssignment(3, 2, stateStreak5);
  const w3Day7 = mod.getDayAssignment(3, 6, stateStreak5);
  assert.equal(w3Day1.isRestDay, true);
  assert.equal(w3Day1.daySub, 'Rest 1');
  assert.equal(w3Day1.waterTargetMl, 2500);
  assert.equal(w3Day2.isRestDay, true);
  assert.equal(w3Day2.daySub, 'Rest 2');
  assert.equal(w3Day3.isRestDay, false);
  assert.equal(w3Day3.daySub, 'Lower 1');
  assert.equal(w3Day3.waterTargetMl, 3000);
  assert.equal(w3Day7.daySub, 'Upper 1');

  // Case A (4-day trailing streak): Week 2 lifted Days 4..7 ending with Lower 1 (slot 1) on Day 7
  const smartW3From4 = mod.buildSmartScheduleFromPreviousWeek(3, [0, 5, 6, 2, 3, 4, 1]);
  assert.equal(smartW3From4.lastLiftSlot, 1);
  assert.equal(smartW3From4.nextStartLiftSlot, 2); // Push
  assert.deepEqual(smartW3From4.orderedLiftQueue, [2, 3, 4, 0, 1]);
  assert.equal(smartW3From4.trailingLiftStreak, 4);
  assert.deepEqual(smartW3From4.restDays, [0, 6]); // Day 1 = Rest 1, Day 7 = Rest 2
  assert.deepEqual(smartW3From4.schedule, [5, 2, 3, 4, 0, 1, 6]);

  // Case B (2-day trailing streak): Rest on Day 5, lifted Days 6 & 7 ending with Upper 1 (slot 0)
  const smartW3From2 = mod.buildSmartScheduleFromPreviousWeek(3, [1, 2, 3, 5, 6, 4, 0]);
  assert.equal(smartW3From2.trailingLiftStreak, 2);
  assert.equal(smartW3From2.nextStartLiftSlot, 1); // Lower 1
  // Can lift 5 - 2 = 3 days at start of Week 3 (Days 1..3), then Rest 1 on Day 4 (idx 3), Rest 2 on Day 7 (idx 6)
  assert.deepEqual(smartW3From2.restDays, [3, 6]);
  assert.deepEqual(smartW3From2.schedule, [1, 2, 3, 5, 4, 0, 6]);

  // Case C (0-day trailing streak, ended on Rest Day): Week 2 ended on Rest Day 7, last lift was Upper 1 (slot 0) on Day 6
  const smartW3From0 = mod.buildSmartScheduleFromPreviousWeek(3, [1, 2, 3, 4, 5, 0, 6]);
  assert.equal(smartW3From0.trailingLiftStreak, 0);
  assert.equal(smartW3From0.nextStartLiftSlot, 1); // Lower 1
  assert.deepEqual(smartW3From0.restDays, [5, 6]);
  assert.deepEqual(smartW3From0.schedule, [1, 2, 3, 4, 0, 5, 6]);
  assert.equal(
    smartW3From0.statusBannerText,
    'Synced from Week 2: Starts with Lower 1 • Rest Days 6 & 7 (follows Week 2 Day 6)'
  );

  // Live reactive update: Modifying Week 2 automatically updates Week 3 if Week 3 has no logged sets
  const liveState: Record<string, any> = {
    maxUnlockedWeek: 3,
    completedSlotsByWeek: { 2: [0, 1, 2, 3, 4] },
    customDayScheduleByWeek: {
      '2': [5, 6, 0, 1, 2, 3, 4]
    },
    weeklyRestDays: { default: [5, 6] },
    workoutLogs: {}
  };
  // Now user swaps Day 7 (index 6) of Week 2 to repeat Upper 1 (slot 0)
  mod.assignWorkoutOrRestSlotToDay(2, 6, 0, liveState);
  // Week 3 should automatically be synced to [5, 6, 1, 2, 3, 4, 0]
  assert.deepEqual(liveState.customDayScheduleByWeek['3'], [5, 6, 1, 2, 3, 4, 0]);

  // Reset to Standard on Week 3 reverts to [0, 1, 2, 3, 4, 5, 6]
  const resetRes = mod.resetWeekScheduleToStandard(3, liveState);
  assert.deepEqual(resetRes.schedule, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(liveState.customDayScheduleByWeek['3'], [0, 1, 2, 3, 4, 5, 6]);

  // Re-Sync from Week 2 restores the smart adapted schedule
  const resyncRes = mod.applySmartScheduleFromPreviousWeek(3, liveState, true);
  assert.deepEqual(resyncRes.schedule, [5, 6, 1, 2, 3, 4, 0]);
  assert.deepEqual(liveState.customDayScheduleByWeek['3'], [5, 6, 1, 2, 3, 4, 0]);
});

test('Subtest 29: 3-Month Naked Pea Order (4 Containers), 6-Month Creatine Strategy (Order 1 Naked -> Costco 1kg), Subscription Action Tracker & Weekly vs 90-Day Shop List View', async () => {
  const mod = await import('./workoutLogic');

  // 1. Subscription & Costco Switchover Action Tracker
  assert.equal(mod.SUBSCRIPTION_ACTION_CHECKLIST_ITEMS.length, 2);
  assert.equal(
    mod.SUBSCRIPTION_ACTION_CHECKLIST_ITEMS[0].title,
    'Action 1 (After Order 1 Ships): Cancel Naked Creatine Recurring Autoship'
  );
  assert.equal(
    mod.SUBSCRIPTION_ACTION_CHECKLIST_ITEMS[0].subtext.includes(
      'Order 1 (2 x 1.1 LB = 1,000g for $47.98 CAD at 20% off) lasts 200 days (6.67 months).'
    ),
    true
  );
  assert.equal(
    mod.SUBSCRIPTION_ACTION_CHECKLIST_ITEMS[0].subtext.includes(
      'buy 1 kg Leanfit Micronized Creatine at Costco ($44.99 CAD regular / $34.99 on sale = $0.18-$0.22/day with $0 shipping).'
    ),
    true
  );

  assert.equal(
    mod.SUBSCRIPTION_ACTION_CHECKLIST_ITEMS[1].title,
    'Action 2 (Before Month 6 / Order 3): Drop Naked Pea Autoship from 4 to 3 Containers'
  );
  assert.equal(
    mod.SUBSCRIPTION_ACTION_CHECKLIST_ITEMS[1].subtext.includes(
      '4 x 5 LB containers (9,072g every 3 months) supply 100.8 days at 90g/day, building a +972g (+10.8-day) buffer per quarter.'
    ),
    true
  );
  assert.equal(
    mod.SUBSCRIPTION_ACTION_CHECKLIST_ITEMS[1].subtext.includes(
      'switch Quarter 3 from 4 containers ($323.96) down to 3 containers ($242.97) to save $80.99 CAD.'
    ),
    true
  );

  // 2. 1-Tap Weekly View ($44.48/wk) vs 3-Month Cycle View ($571.88 / 90 Days)
  assert.equal(
    mod.SHOP_LIST_PERIOD_VIEWS.weekly.pillLabel,
    'Weekly Grocery View ($22.10/wk Store • $44.48/wk All-In)'
  );
  assert.equal(
    mod.SHOP_LIST_PERIOD_VIEWS.quarterly.pillLabel,
    '3-Month (90-Day) Cycle View ($284.18 Store • $571.88 All-In)'
  );

  // 3. Verify Items #12, #13, and #14 in SHOPPING_AISLES (Aisle 4)
  const weeklyAisles = mod.getShoppingAislesForPeriod('weekly');
  const quarterlyAisles = mod.getShoppingAislesForPeriod('quarterly');
  assert.equal(weeklyAisles.length, 4);
  assert.equal(weeklyAisles[3].category, 'Aisle 4: Online / Costco Bulk Supplements');
  assert.equal(weeklyAisles[3].items.length, 3);

  const item12Weekly = weeklyAisles[3].items[0];
  const item12Quarterly = quarterlyAisles[3].items[0];
  assert.equal(
    item12Weekly.name,
    '12. Naked Pea Protein Isolate — 5 lb / 2,268g container, Unflavored, 90% P'
  );
  assert.equal(item12Weekly.qty, '630g / week (90g/day)');
  assert.equal(item12Quarterly.qty, '8,100g / 90 days (Order 4 containers = 9,072g)');
  assert.equal(
    item12Weekly.note.includes('35g Fuel 1 + 10g Fuel 2 + 45g Fuel 4 = 90g/day (81g pure protein).'),
    true
  );

  const item13Weekly = weeklyAisles[3].items[1];
  const item13Quarterly = quarterlyAisles[3].items[1];
  assert.equal(
    item13Weekly.name,
    '13. 100% Micronized Creatine Monohydrate — Order 1 Naked -> Order 2+ Costco 1 kg'
  );
  assert.equal(item13Weekly.qty, '35g / week (5g/day)');
  assert.equal(item13Quarterly.qty, '450g / 90 days (1,000g lasts 200 days)');
  assert.equal(item13Weekly.note.includes('Order 2+ (after 200 days): Buy 1 kg Leanfit Creatine at Costco'), true);

  const item14Weekly = weeklyAisles[3].items[2];
  const item14Quarterly = quarterlyAisles[3].items[2];
  assert.equal(
    item14Weekly.name,
    '14. Vegan Vitamin D3 Supplement — 1,000–2,500 IU, 180 Capsules = 6-Month Supply'
  );
  assert.equal(item14Weekly.qty, '7 caps / week (1 cap/day)');
  assert.equal(item14Quarterly.qty, '90 caps / 90 days ($9.00 / 3 mos)');

  // 4. Muscle Fuel Header & Cost Summary
  assert.equal(mod.getHeaderSubtitleCostText(false), 'Full-Body • $6.35/d');
  assert.equal(mod.getHeaderSubtitleCostText(true), 'Full-Body • $6.34/d');
  assert.equal(
    mod.MUSCLE_FUEL_SUPPLEMENT_SUPPLY_SUMMARY.headerTitle,
    'Daily Muscle Fuel (1,325 kcal • 139g P • 173cm / 69kg)'
  );
  assert.equal(mod.MUSCLE_FUEL_SUPPLEMENT_SUPPLY_SUMMARY.rows.length, 3);
  assert.equal(
    mod.MUSCLE_FUEL_SUPPLEMENT_SUPPLY_SUMMARY.rows[0],
    'Pea Protein (90g/d): 4 containers / 3 mos ($287.96 Order 1 -> +972g buffer/qtr -> 3 containers on Q3)'
  );
  assert.equal(
    mod.MUSCLE_FUEL_SUPPLEMENT_SUPPLY_SUMMARY.rows[1],
    'Creatine (5g/d): 2 x 1.1 LB Order 1 ($47.98 / 200 days) -> Cancel Sub -> Costco 1kg ($44.99) on Order 2+'
  );
  assert.equal(
    mod.MUSCLE_FUEL_SUPPLEMENT_SUPPLY_SUMMARY.rows[2],
    'Groceries (Items #1-#11): $22.10/wk ($284.18 / 3 mos) • Water in Fuel 1 & 4 shakes + 180ml milk in Fuel 2 Oats'
  );
});

test('Subtest 30: Auto-Cascade Sets, Zeigarnik In-Progress State, Uncrushable Grid, 1-Tap Delete Note, Auto-Open Warm-Up, Synced Chrono Schedule & Hideable Shop Sections', async () => {
  const mod = await import('./workoutLogic');

  // 1. Auto-Cascade Weight & Reps forward to subsequent unlogged sets (including when editing a logged set)
  const logs: Record<string, any> = {
    w2_0_cable_ab_crunch_1: { weight: '57.5', reps: '15', done: true, unit: 'lbs' },
    w2_0_cable_ab_crunch_2: { weight: '50', reps: '12', done: false, unit: 'lbs' },
    w2_0_cable_ab_crunch_3: { weight: '50', reps: '12', done: false, unit: 'lbs' }
  };
  const cascadeRes = mod.cascadeSetWeightAndRepsForward(
    logs,
    2,
    0,
    'cable_ab_crunch',
    1,
    3,
    '62.5',
    '16',
    'lbs'
  );
  assert.deepEqual(cascadeRes.updatedSets, [2, 3]);
  assert.equal(logs.w2_0_cable_ab_crunch_2.weight, '62.5');
  assert.equal(logs.w2_0_cable_ab_crunch_2.reps, '16');
  assert.equal(logs.w2_0_cable_ab_crunch_3.weight, '62.5');
  assert.equal(logs.w2_0_cable_ab_crunch_3.reps, '16');

  // Ensure already-logged subsequent sets are not overwritten if an earlier set is edited
  logs.w2_0_cable_ab_crunch_2.done = true;
  logs.w2_0_cable_ab_crunch_2.weight = '62.5';
  const cascadeRes2 = mod.cascadeSetWeightAndRepsForward(
    logs,
    2,
    0,
    'cable_ab_crunch',
    1,
    3,
    '65',
    '15',
    'lbs'
  );
  assert.deepEqual(cascadeRes2.updatedSets, [3]);
  assert.equal(logs.w2_0_cable_ab_crunch_2.weight, '62.5');
  assert.equal(logs.w2_0_cable_ab_crunch_3.weight, '65');

  // 2. Zeigarnik In-Progress Color Coding (State 0, State 1, State 2)
  const state0 = mod.getExerciseProgressVisualState(0, 3, false);
  assert.equal(state0.stateCode, 0);
  assert.equal(state0.headerBadgeText, null);
  assert.equal(state0.cardBorderStyle, '1px solid #1e293b');

  const state1 = mod.getExerciseProgressVisualState(1, 3, false);
  assert.equal(state1.stateCode, 1);
  assert.equal(state1.headerBadgeText, 'IN PROGRESS • 1/3');
  assert.equal(state1.cardBorderStyle, '2px solid #f59e0b');
  assert.equal(state1.cardBackgroundStyle, 'rgba(245, 158, 11, 0.08)');
  assert.equal(state1.collapsedRightCtaText, 'Resume (2 sets left) ▼');

  const state2 = mod.getExerciseProgressVisualState(3, 3, false);
  assert.equal(state2.stateCode, 2);
  assert.equal(state2.headerBadgeText, 'Done');

  // 3. Uncrushable Set Row Grid Geometry constants (Hotfix: prevent cut-off "+" buttons)
  assert.equal(
    mod.UNCRUSHABLE_SET_ROW_GRID_STYLE.includes('grid-template-columns: 48px minmax(105px, 1.2fr) minmax(95px, 1fr) 76px; gap: 6px; align-items: center; overflow: hidden;'),
    true
  );
  assert.equal(mod.UNCRUSHABLE_STEPPER_WRAPPER_STYLE.includes('display: flex; align-items: center; justify-content: space-between;'), true);
  assert.equal(mod.UNCRUSHABLE_STEPPER_BTN_STYLE.includes('flex-shrink: 0; width: 32px; height: 32px;'), true);
  assert.equal(mod.UNCRUSHABLE_NUMBER_DISPLAY_STYLE.includes('flex-grow: 1; min-width: 0;'), true);
  assert.equal(mod.UNCRUSHABLE_NUMBER_DISPLAY_STYLE.includes('min-width: 52px'), false);

  // 4. 1-Tap Delete Note helper
  const notesMap: Record<string, any> = {
    cable_ab_crunch: { text: 'High pulley pin 12', photoDataUrl: '' }
  };
  mod.deleteExerciseNoteEntry(notesMap, 'cable_ab_crunch');
  assert.equal(notesMap.cable_ab_crunch, undefined);

  // 5. Auto-Open Warm-Up Accordion on Workout Start
  assert.equal(mod.shouldAutoOpenWarmupAccordion(false, 0, false, false), true);
  assert.equal(mod.shouldAutoOpenWarmupAccordion(true, 0, false, false), false);
  assert.equal(mod.shouldAutoOpenWarmupAccordion(false, 1, false, false), false);
  assert.equal(mod.shouldAutoOpenWarmupAccordion(false, 0, true, false), false);

  // 6. Synced Chrono Schedule (e.g., 7:00 AM vs 8:00 AM Gym Time) & Live 20-Min Auto-Sync
  const sched7am = mod.getSyncedChronoSchedule('07:00');
  assert.equal(sched7am.fuel1Time12, '6:35 AM');
  assert.equal(sched7am.warmupHeaderUpper, '7:00 AM UPPER BODY WARM-UP');
  assert.equal(sched7am.fuel2Time12, '8:15 AM');
  assert.equal(sched7am.fuel3Time12, '12:00 PM');
  assert.equal(sched7am.fuel4Time12, '4:30 PM');
  assert.equal(sched7am.waterSchedule.length, 6);
  assert.equal(sched7am.waterSchedule[0].time12, '6:30 AM');
  assert.equal(sched7am.waterSchedule[1].time12, '7:30 AM');
  assert.equal(sched7am.waterSchedule[2].time12, '8:30 AM');

  const sched8am = mod.getSyncedChronoSchedule('08:00');
  assert.equal(sched8am.fuel1Time12, '7:35 AM');
  assert.equal(sched8am.warmupHeaderUpper, '8:00 AM UPPER BODY WARM-UP');
  assert.equal(sched8am.fuel2Time12, '9:15 AM');
  assert.equal(sched8am.fuel3Time12, '1:00 PM');
  assert.equal(sched8am.fuel4Time12, '5:30 PM');

  const liveSyncCheck = mod.checkAutoSyncGymTimeOnLiveWorkout('07:00', '08:02');
  assert.equal(liveSyncCheck.shouldAutoSync, true);
  assert.equal(liveSyncCheck.syncedGymTime12, '8:00 AM');
  assert.equal(
    liveSyncCheck.bannerText,
    'Workout Time Auto-Synced to 8:00 AM — Meal & Water schedules shifted automatically to match your live session (Undo)'
  );

  // 7. Hideable Muscle Fuel Supplement Summary & Shop List Master Sections
  assert.equal(
    mod.getFuelSupplementSummaryToggleLabel(false, '$6.35/d'),
    '3-Month & 6-Month Bulk Supplement Plan ($6.35/d) — Show Details ▼'
  );
  assert.equal(
    mod.getFuelSupplementSummaryToggleLabel(true, '$6.35/d'),
    '3-Month & 6-Month Bulk Supplement Plan ($6.35/d) — Hide ▲'
  );

  const shopMaster = mod.getShopListMasterSectionSpecs('weekly');
  assert.equal(shopMaster.weeklySection.title, 'WEEKLY SUPERMARKET GROCERY LIST (11 Items • $22.10/wk)');
  assert.equal(shopMaster.bulkSection.title, '3-MONTH & 6-MONTH BULK SUPPLEMENTS (3 Items • Naked & Costco)');
  assert.equal(
    shopMaster.bulkSection.cards.threeMonthCycleCard.summary,
    'Naked Pea Protein Isolate (4 x 5 LB = 9,072g -> 8,100g used, +972g buffer/qtr)'
  );
  assert.equal(
    shopMaster.bulkSection.cards.sixMonthCycleCard.summary,
    'Micronized Creatine (1,000g = 200 days) + Vegan Vitamin D3 (180 caps = 180 days)'
  );
});

test('Subtest 31: BDA/W3C Cognitive Accessibility & ELI12 Plain-English Visual Hierarchy across All 5 Tabs', async () => {
  const mod = await import('./workoutLogic');

  // 1. Shop List ELI12 Header, 2-Column View Switcher, 3-Button Row & 2 Hideable Master Sections
  assert.equal(mod.ELI12_ACCESSIBILITY_SPECS.shopList.title, 'Shopping List');
  assert.equal(
    mod.ELI12_ACCESSIBILITY_SPECS.shopList.subtitle,
    'Check off what you have at home. Copy the rest for the store.'
  );
  assert.equal(mod.ELI12_ACCESSIBILITY_SPECS.shopList.viewSwitcher.weeklyTitle, '1-Week View');
  assert.equal(mod.ELI12_ACCESSIBILITY_SPECS.shopList.viewSwitcher.weeklySub, '$22.10 Store • $44.48 Total');
  assert.equal(mod.ELI12_ACCESSIBILITY_SPECS.shopList.viewSwitcher.quarterlyTitle, '3-Month View');
  assert.equal(mod.ELI12_ACCESSIBILITY_SPECS.shopList.viewSwitcher.quarterlySub, '$284.18 Store • $571.88 Total');
  assert.equal(
    mod.ELI12_ACCESSIBILITY_SPECS.shopList.viewSwitcher.breakdownToggleClosed,
    'View Cost Breakdown & Order Math ▼'
  );
  assert.deepEqual(mod.ELI12_ACCESSIBILITY_SPECS.shopList.actionButtons, [
    'Copy Unchecked',
    'Check Pantry Staples',
    'Uncheck All'
  ]);
  assert.equal(
    mod.ELI12_ACCESSIBILITY_SPECS.shopList.section1Title,
    'Weekly Store Groceries (11 Items • $22.10/wk)'
  );
  assert.equal(
    mod.ELI12_ACCESSIBILITY_SPECS.shopList.section2Title,
    '3- & 6-Month Bulk Supplements (3 Items)'
  );
  assert.equal(
    mod.ELI12_ACCESSIBILITY_SPECS.shopList.steps[0],
    'Step 1: Cancel Naked Creatine auto-ship after Order 1 arrives (Buy at Costco next time for $44.99)'
  );
  assert.equal(
    mod.ELI12_ACCESSIBILITY_SPECS.shopList.steps[1],
    'Step 2: Change Naked Pea auto-ship from 4 tubs to 3 tubs before Month 6 (Save $80.99)'
  );

  // 2. Muscle Fuel ELI12 Header, 2-Row Stacked Macro Cards, 1-Line Supplement Drawer & Option B Water Formula
  assert.equal(mod.ELI12_ACCESSIBILITY_SPECS.muscleFuel.title, 'Daily Food & Water');
  assert.equal(mod.ELI12_ACCESSIBILITY_SPECS.muscleFuel.logAllBtn, '✓ Log All 4 Meals');
  assert.equal(mod.ELI12_ACCESSIBILITY_SPECS.muscleFuel.subtitle, '1,325 kcal • 139g Protein (173cm • 69kg)');
  assert.equal(
    mod.getEli12WaterScheduleFormulaText(3000),
    '+ 720 ml water in shakes + 180 ml milk in oats = 3,900 ml total'
  );

  // 3. Gym Tab Consolidated Admin Drawer & Active Day Card Layout
  assert.equal(mod.ELI12_ACCESSIBILITY_SPECS.gymTab.adminDrawerBtnClosed, 'Schedule, Sync & Stats ▼');
  assert.deepEqual(mod.ELI12_ACCESSIBILITY_SPECS.gymTab.crossWeekButtons, [
    'Re-Sync from Week 2',
    'Reset to Standard'
  ]);

  // 4. Pull-Ups & Rest Timer Title Case Headings & ELI12 1-Sentence Session Instructions
  assert.equal(mod.ELI12_ACCESSIBILITY_SPECS.pullupsAndTimer.pullupsHeading, 'Overhand Pull-Up Program');
  assert.equal(
    mod.ELI12_ACCESSIBILITY_SPECS.pullupsAndTimer.day1Eli12Desc,
    'Do 5 sets of pull-ups. Stop each set when you cannot do another clean rep.'
  );
  assert.equal(
    mod.ELI12_ACCESSIBILITY_SPECS.pullupsAndTimer.riceTimerAccordionTitle,
    'Jasmine Rice Timer (12m Cook + 10m Cooldown) ▼'
  );
});

test('Subtest 32: Full-Width Stacked Shop/Fuel Cards (ELI12), Pull-Up Pyramid Up to 9 Sets + 2-Way Sync, and Side Plank 3-State Timer-First Flow', async () => {
  const mod = await import('./workoutLogic');

  // 1. Full-Width Stacked Shopping List Item Specs (14 items) & Bulk Action Steps
  assert.equal(Object.keys(mod.SHOP_ITEM_ELI12_SPECS).length, 14);
  const milkWeekly = mod.getShopItemFullWidthSpec('shop_silk_milk', 'weekly');
  assert.equal(milkWeekly.shortName, '1. Unsweetened Almond or Cashew Milk (1.89L)');
  assert.equal(milkWeekly.activeQtyPill, '1,260 ml/wk (180 ml/day)');
  assert.equal(milkWeekly.activeCostPill, '$3.19/wk');
  assert.equal(milkWeekly.eli12Summary, 'Use 180 ml/day in Overnight Oats. Use water in shakes.');
  assert.equal(milkWeekly.detailsToggleClosedLabel, 'Read Full Math & Notes ▼');
  assert.equal(milkWeekly.detailsToggleOpenLabel, 'Hide Full Math & Notes ▲');

  const milkQuarterly = mod.getShopItemFullWidthSpec('shop_silk_milk', 'quarterly');
  assert.equal(milkQuarterly.activeQtyPill, '16.2 L / 90 days (9 cartons)');
  assert.equal(milkQuarterly.activeCostPill, '$41.06 / 3 mos');

  assert.equal(mod.BULK_SUPPLEMENT_STEP_ELI12_SPECS.length, 2);
  assert.equal(
    mod.BULK_SUPPLEMENT_STEP_ELI12_SPECS[0].title,
    'Step 1: Cancel Naked Creatine auto-ship after Order 1 arrives'
  );
  assert.equal(mod.BULK_SUPPLEMENT_STEP_ELI12_SPECS[0].whyToggleClosedLabel, 'Why? ▼');
  assert.equal(
    mod.BULK_SUPPLEMENT_STEP_ELI12_SPECS[1].title,
    'Step 2: Change Naked Pea auto-ship from 4 tubs to 3 tubs before Month 6'
  );

  // 2. Pull-Up Pyramid Expansion from 5 Sets up to 9 Sets & Control Bar Spec
  let customSets: Record<string, number> = {};
  assert.equal(mod.getEffectivePullupSetsCount(customSets, 1, 2, 5), 5);
  const ctrl5 = mod.getPullupExpansionControlSpec(5, false);
  assert.equal(ctrl5.addSetButtonLabel, '+ Keep Going! Add Set 6 (Up to 9 Pull-Up Sets)');
  assert.equal(ctrl5.showAllNineButtonLabel, 'Show All 9 Sets');
  assert.equal(ctrl5.removeSetButtonLabel, null);

  const add6 = mod.adjustPullupSetsCount(customSets, 1, 2, 'add', 5);
  customSets = add6.nextCustomSetCounts;
  assert.equal(add6.newSetsCount, 6);
  const ctrl6 = mod.getPullupExpansionControlSpec(6, false);
  assert.equal(ctrl6.addSetButtonLabel, '+ Keep Going! Add Set 7 (Up to 9 Pull-Up Sets)');
  assert.equal(ctrl6.removeSetButtonLabel, '- Remove Set 6');

  const show9 = mod.adjustPullupSetsCount(customSets, 1, 2, 'show_all_9', 5);
  customSets = show9.nextCustomSetCounts;
  assert.equal(show9.newSetsCount, 9);
  const ctrl9 = mod.getPullupExpansionControlSpec(9, false);
  assert.equal(ctrl9.addSetButtonLabel, null);
  assert.equal(ctrl9.showAllNineButtonLabel, null);
  assert.equal(ctrl9.removeSetButtonLabel, '- Remove Set 9');

  // Verify Pyramid cascading suggestions across 9 sets (1, 2, 3, 4, 5, 6, 7, 8, 9)
  const pyr9 = mod.computePyramidNextSetSuggestions(0, 1, 5, 9);
  assert.equal(pyr9.suggestedRepsBySetIndex[0], 1);
  assert.equal(pyr9.suggestedRepsBySetIndex[5], 6);
  assert.equal(pyr9.suggestedRepsBySetIndex[7], 8);
  assert.equal(pyr9.suggestedRepsBySetIndex[8], 9);

  // 3. Side Plank & Timed Holds: 5 Presets (including 1 min / 60s) & 3-State Button Flow
  assert.equal(mod.TIMED_HOLD_DURATION_PRESETS.length, 5);
  assert.deepEqual(
    mod.TIMED_HOLD_DURATION_PRESETS.map(p => p.buttonLabel),
    ['30 sec', '45 sec', '1 min (60s)', '1m 15s (75s)', '1m 30s (90s)']
  );

  // State A: Not Started (30s or 1 min) -> No primary Log button yet
  const stateA30 = mod.getTimedHoldSetUiSpec(1, 30, null, false);
  assert.equal(stateA30.flowState, 'state_a_not_started');
  assert.equal(stateA30.showPrimaryLogButton, false);
  assert.equal(stateA30.primaryButtonLabel, 'Start 30s Timer');
  assert.equal(stateA30.secondaryLinkLabel, 'Skip timer & log');

  const stateA60 = mod.getTimedHoldSetUiSpec(2, 60, null, false);
  assert.equal(stateA60.primaryButtonLabel, 'Start 1 min Timer');

  // State B: Timer Running -> Active Amber/Gold Highlight + ACTIVE SET badge + Holding countdown
  const stateB = mod.getTimedHoldSetUiSpec(1, 60, { status: 'running', remainingSec: 45 }, false);
  assert.equal(stateB.flowState, 'state_b_running');
  assert.equal(stateB.isActiveRunning, true);
  assert.equal(stateB.activeSetBadgeText, 'ACTIVE SET');
  assert.equal(stateB.rowBorderStyle, '2px solid #f59e0b');
  assert.equal(stateB.rowBackgroundStyle, 'rgba(245, 158, 11, 0.18)');
  assert.equal(stateB.primaryButtonLabel, 'Holding: 00:45 Left (Pause)');

  // State C: Hold Timer Finished (00:00 Reached) -> Reveal pulsing Log Set button
  const stateC = mod.getTimedHoldSetUiSpec(1, 60, { status: 'completed', remainingSec: 0 }, false);
  assert.equal(stateC.flowState, 'state_c_completed');
  assert.equal(stateC.showPrimaryLogButton, true);
  assert.equal(stateC.primaryButtonLabel, '✓ Hold Complete — Tap to Log Set 1');
  assert.equal(stateC.secondaryLinkLabel, 'Restart Timer');

  // Logged Done state
  const stateDone = mod.getTimedHoldSetUiSpec(1, 60, { status: 'completed', remainingSec: 0 }, true);
  assert.equal(stateDone.flowState, 'logged_done');
  assert.equal(stateDone.primaryButtonLabel, '✓ Done');
});

test('Subtest 33: Strict Pull-Up Pyramid Auto-Increment (1..9), Photo-Protected Delete Note, and Dynamic AI Bonus Workout JSON Generator', async () => {
  const mod = await import('./workoutLogic');

  // 1. Strict Pull-Up Pyramid Auto-Increment & Single Max Effort Anchor
  const set1of5 = mod.getStrictPyramidSetSpec(1, 5);
  assert.equal(set1of5.targetReps, '1');
  assert.equal(set1of5.isMaxEffortAnchor, false);
  assert.equal(set1of5.setLabel, 'Set 1');

  const set5of5 = mod.getStrictPyramidSetSpec(5, 5);
  assert.equal(set5of5.targetReps, '5');
  assert.equal(set5of5.isMaxEffortAnchor, true);
  assert.equal(set5of5.setLabel, 'Set 5 (Max)');

  const set5of7 = mod.getStrictPyramidSetSpec(5, 7);
  assert.equal(set5of7.targetReps, '5');
  assert.equal(set5of7.isMaxEffortAnchor, false);
  assert.equal(set5of7.setLabel, 'Set 5');

  const set6of7 = mod.getStrictPyramidSetSpec(6, 7);
  assert.equal(set6of7.targetReps, '6');
  assert.equal(set6of7.isMaxEffortAnchor, false);
  assert.equal(set6of7.setLabel, 'Set 6');

  const set7of7 = mod.getStrictPyramidSetSpec(7, 7);
  assert.equal(set7of7.targetReps, '7');
  assert.equal(set7of7.isMaxEffortAnchor, true);
  assert.equal(set7of7.setLabel, 'Set 7 (Max)');

  const set8of9 = mod.getStrictPyramidSetSpec(8, 9);
  assert.equal(set8of9.targetReps, '8');
  assert.equal(set8of9.isMaxEffortAnchor, false);

  const set9of9 = mod.getStrictPyramidSetSpec(9, 9);
  assert.equal(set9of9.targetReps, '9');
  assert.equal(set9of9.isMaxEffortAnchor, true);
  assert.equal(set9of9.setLabel, 'Set 9 (Max)');

  // 2. Loss-Aversion Photo Protection on Delete Note
  const noteWithPhoto = {
    tue_calf_raise: {
      text: 'Standing calf machine pin 8',
      photo: 'data:image/jpeg;base64,ABC123',
      photoDataUrl: 'data:image/jpeg;base64,ABC123'
    }
  };
  let seenPrompt = '';
  const keptRes = mod.resolveDeleteExerciseNoteWithPhotoProtection(noteWithPhoto, 'tue_calf_raise', (msg: string) => {
    seenPrompt = msg;
    return true;
  });
  assert.equal(keptRes.prompted, true);
  assert.equal(
    seenPrompt,
    'This exercise has an attached machine photo. Do you want to delete the text note but keep the photo?'
  );
  assert.equal(keptRes.keptPhoto, true);
  assert.equal(keptRes.nextNotesMap.tue_calf_raise?.text, '');
  assert.equal(keptRes.nextNotesMap.tue_calf_raise?.photo, 'data:image/jpeg;base64,ABC123');
  assert.equal(keptRes.nextNotesMap.tue_calf_raise?.photoDataUrl, 'data:image/jpeg;base64,ABC123');

  const wipedRes = mod.resolveDeleteExerciseNoteWithPhotoProtection(noteWithPhoto, 'tue_calf_raise', () => false);
  assert.equal(wipedRes.prompted, true);
  assert.equal(wipedRes.keptPhoto, false);
  assert.equal(wipedRes.nextNotesMap.tue_calf_raise, undefined);

  const textOnlyNote = { mon_bench: { text: 'Bench notch 2' } };
  const plainRes = mod.resolveDeleteExerciseNoteWithPhotoProtection(textOnlyNote, 'mon_bench', () => true);
  assert.equal(plainRes.prompted, false);
  assert.equal(plainRes.nextNotesMap.mon_bench, undefined);

  // 3. Dynamic AI Bonus Workout Generator (Updated Prompt + Deduplication + Zero Abs/Core/Pull-Ups)
  assert.deepEqual([...mod.AI_BONUS_WORKOUT_TARGETS], [
    'Chest Focus',
    'Back & Biceps',
    'Legs & Calves',
    'Shoulders & Arms',
    'Full Body'
  ]);
  const promptStr = mod.buildAiBonusWorkoutSystemPrompt('Chest Focus');
  assert.equal(
    promptStr,
    'System: You are an elite sports scientist. Generate a custom workout for the target: Chest Focus. You must return ONLY a valid JSON array containing exactly 5 to 7 exercises. Rule 1: ALL EXERCISE NAMES MUST BE UNIQUE. Rule 2: Do NOT include duplicate movement patterns. Rule 3: DO NOT include any abdominal, core, or pull-up exercises under any circumstances. Schema: [{ "name": "Exercise", "sets": 3, "reps": "8-12", "videoUrl": "https..." }]. Output JSON only.'
  );

  const rawJson = JSON.stringify([
    { name: 'Barbell Incline Bench Press', sets: 4, reps: '5-8', videoUrl: 'https://youtube.com/watch?v=SrqOu55lrYU' },
    { name: 'Flat Dumbbell Bench Press', sets: 3, reps: '8-10', videoUrl: 'https://youtube.com/watch?v=VmB1G1K7v94' },
    { name: 'Machine Pec Deck Fly', sets: 3, reps: '12-15', videoUrl: 'https://youtube.com/watch?v=Z57CtFmRMxA' },
    { name: 'Low-to-High Cable Fly', sets: 3, reps: '12-15', videoUrl: 'https://youtube.com/watch?v=Iwe6AmxVf7o' },
    { name: 'Cable Rope Crunch', sets: 3, reps: '12-15', videoUrl: 'https://youtube.com/watch?v=2fbujeH3F0E' },
    { name: 'Overhand Pull-Ups', sets: 3, reps: '8-10', videoUrl: 'https://youtube.com/watch?v=w_yuTRQd6HA' },
    { name: 'Assisted Chest Dip Machine', sets: 3, reps: '10-12', videoUrl: 'https://youtube.com/watch?v=dX_nSOOJIsE' },
    { name: 'Overhead Cable Tricep Extension', sets: 3, reps: '10-15', videoUrl: 'https://youtube.com/watch?v=YbX7Wd8jQ-Q' }
  ]);
  const bonusDay = mod.parseAndBuildAiBonusDayObject(rawJson, 'Chest Focus', 1);
  assert.ok(bonusDay);
  assert.equal(bonusDay.isAiGenerated, true);
  assert.equal(bonusDay.target, 'Chest Focus');
  assert.ok(bonusDay.exercises.length >= 5 && bonusDay.exercises.length <= 7);
  assert.equal(bonusDay.exercises[0].reps, '5-8');
  assert.equal(bonusDay.exercises.some(ex => /crunch|pull-up|abs|core/i.test(ex.name)), false);
  // Duplicate chest fly movement pattern must be deduplicated
  assert.equal(bonusDay.exercises.filter(ex => /fly/i.test(ex.name)).length, 1);

  const injected = mod.injectAiBonusWorkoutIntoDay6({}, 1, bonusDay);
  assert.equal(injected['1'].length, 7);
  assert.equal((injected['1'][5] as any).isAiGenerated, true);
  assert.ok((injected['1'][5] as any).exercises.length >= 5 && (injected['1'][5] as any).exercises.length <= 7);
});

test('Subtest 34: Default-Closed Progressive Disclosure, ELI12 Fuel Summary, Strict 5-7 AI Bonus Sanitizer, and Day 6 Daily Abs / Daily Pull-Ups Toggles', async () => {
  const mod = await import('./workoutLogic');

  // 1. Default-Closed Progressive Disclosure spec
  const defaults = mod.getInitialCollapsedAccordionDefaults();
  assert.equal(defaults.warmupOpen, false);
  assert.equal(defaults.warmupPart1Open, false);
  assert.equal(defaults.warmupPart2Open, false);
  assert.equal(defaults.preFuelDetailsOpen, false);
  assert.equal(defaults.hideBulkSupplements, true);
  assert.equal(defaults.openShopCostBreakdown, false);
  assert.equal(defaults.defaultAllHidden, true);
  assert.equal(defaults.activeFocusedExId, null);

  // 2. ELI12 Fuel Card Formatting
  const fuel1 = mod.formatEli12FuelCardSummary('pre_shake', {
    title: 'Pre-Gym Fast Protein & Creatine Shake',
    kcal: 140,
    protein: 32,
    items: [
      { name: 'Naked Pea Protein Isolate (90% P)', weight: '35g' },
      { name: '100% Micronized Creatine Monohydrate', weight: '5g' },
      { name: 'Cold Water (Shaker Bottle)', weight: '350 ml' }
    ]
  });
  assert.equal(fuel1.title, 'Pre-Workout Shake');
  assert.equal(fuel1.statsLine, '140 Calories | 32g Protein');
  assert.equal(fuel1.ingredientsLine, '35g Pea Protein. 5g Creatine. 350ml Water.');
  assert.equal(fuel1.mathToggleClosedLabel, 'Read Full Math ▼');
  assert.equal(fuel1.mathToggleOpenLabel, 'Hide Full Math ▲');
  assert.equal(fuel1.logButtonLabel, '✓ Log Meal');

  // 3. Sanitizer strictly enforces 5-7 exercises even on noisy/short/oversized AI arrays & cleans all fallback templates
  const noisy = [
    { name: 'Kneeling Cable Ab Crunch', sets: 3, reps: '12-15', videoUrl: 'https://youtube.com/1' },
    { name: 'Kneeling Cable Ab Crunch', sets: 3, reps: '12-15', videoUrl: 'https://youtube.com/2' },
    { name: 'Hanging Knee Raise', sets: 3, reps: '12-15', videoUrl: 'https://youtube.com/3' },
    { name: 'Wide-Grip Pull-Ups', sets: 4, reps: '8-10', videoUrl: 'https://youtube.com/4' },
    { name: 'Barbell Back Squat', sets: 4, reps: '5-8', videoUrl: 'https://youtube.com/5' }
  ];
  const cleanedLegs = mod.sanitizeAiBonusExercises(noisy, 'Legs & Calves');
  assert.ok(cleanedLegs.length >= 5 && cleanedLegs.length <= 7);
  assert.equal(cleanedLegs.some(ex => mod.isForbiddenBonusExerciseName(ex.name)), false);

  // Every fallback target has 5-7 unique non-ab/non-pullup exercises
  for (const target of mod.AI_BONUS_WORKOUT_TARGETS) {
    const fbList = mod.AI_BONUS_WORKOUT_FALLBACKS_CLEAN[target];
    assert.ok(fbList.length >= 5 && fbList.length <= 7, `Fallback ${target} must have 5-7 exercises`);
    for (const ex of fbList) {
      assert.equal(mod.isForbiddenBonusExerciseName(ex.name), false, `${target} has forbidden exercise ${ex.name}`);
    }
  }

  // 4. Day 6 [+ Add Daily Abs] (append to bottom) & [+ Add Daily Pull-Ups] (prepend to top) toggles
  const day6 = mod.parseAndBuildAiBonusDayObject(mod.AI_BONUS_WORKOUT_FALLBACKS_CLEAN['Chest Focus'], 'Chest Focus', 1);
  assert.ok(day6);
  const baseCount = day6.exercises.length;

  const afterAddAbs = mod.toggleDay6BonusHabitExercise(day6, 'abs');
  assert.equal(afterAddAbs.added, true);
  assert.equal(afterAddAbs.nextDayObj.exercises.length, baseCount + 1);
  assert.equal(afterAddAbs.nextDayObj.exercises[afterAddAbs.nextDayObj.exercises.length - 1].id, 'cable_ab_crunch');

  const afterAddPullups = mod.toggleDay6BonusHabitExercise(afterAddAbs.nextDayObj, 'pullups');
  assert.equal(afterAddPullups.added, true);
  assert.equal(afterAddPullups.nextDayObj.exercises.length, baseCount + 2);
  assert.equal(afterAddPullups.nextDayObj.exercises[0].id, 'day1_pullups');
  assert.equal(afterAddPullups.nextDayObj.exercises[afterAddPullups.nextDayObj.exercises.length - 1].id, 'cable_ab_crunch');

  // Toggle both back OFF cleanly
  const afterRemoveAbs = mod.toggleDay6BonusHabitExercise(afterAddPullups.nextDayObj, 'abs');
  assert.equal(afterRemoveAbs.added, false);
  assert.equal(afterRemoveAbs.nextDayObj.exercises.some(ex => ex.id === 'cable_ab_crunch'), false);

  const afterRemovePullups = mod.toggleDay6BonusHabitExercise(afterRemoveAbs.nextDayObj, 'pullups');
  assert.equal(afterRemovePullups.added, false);
  assert.equal(afterRemovePullups.nextDayObj.exercises.length, baseCount);
  assert.equal(afterRemovePullups.nextDayObj.exercises.some(ex => ex.id === 'day1_pullups'), false);
});

test('Subtest 35: Redundant Routing Active-Day AI Bonus Injection & Overflow-Visible Stepper Spec', async () => {
  const mod = await import('./workoutLogic');
  assert.equal(mod.UNCRUSHABLE_NUMBER_DISPLAY_STYLE.includes('overflow: visible;'), true);

  const day7Bonus = mod.parseAndBuildAiBonusDayObject(mod.AI_BONUS_WORKOUT_FALLBACKS_CLEAN['Legs & Calves'], 'Legs & Calves', 1);
  assert.ok(day7Bonus);
  const updatedMap = mod.injectAiBonusWorkoutIntoActiveDay({}, 1, 6, day7Bonus);
  assert.equal(updatedMap['1'][6], day7Bonus);
  assert.equal(updatedMap['1'][5], 5);

  const day6Bonus = mod.parseAndBuildAiBonusDayObject(mod.AI_BONUS_WORKOUT_FALLBACKS_CLEAN['Chest Focus'], 'Chest Focus', 1);
  assert.ok(day6Bonus);
  const updatedMap2 = mod.injectAiBonusWorkoutIntoActiveDay(updatedMap, 1, 5, day6Bonus);
  assert.equal(updatedMap2['1'][5], day6Bonus);
  assert.equal(updatedMap2['1'][6], day7Bonus);
});

test('Subtest 36: Gym Header Outline Button, Sequential 2-Phase Rice Timer, and Exposed Total Weight Pills', async () => {
  const mod = await import('./workoutLogic');

  // 1. Schedule, Sync & Stats outline button placement spec
  assert.equal(mod.SCHEDULE_SYNC_OUTLINE_BUTTON_SPEC.placement, 'active-day-header-row-far-right');
  assert.equal(mod.SCHEDULE_SYNC_OUTLINE_BUTTON_SPEC.removedFromWeekRow, true);
  assert.equal(
    mod.SCHEDULE_SYNC_OUTLINE_BUTTON_SPEC.inlineStyle.includes('border: 1px solid rgba(14, 165, 233, 0.4);'),
    true
  );

  // 2. Sequential 2-phase Jasmine Rice Timer state machine
  let rice = {
    cookMinutes: 12 as const,
    activePhase: null as 1 | 2 | null,
    cookPhaseCompleted: false,
    cooldownPhaseCompleted: false
  };
  let ui = mod.getSequentialRiceButtonPresentation(rice);
  assert.equal(ui.cookButtonLabel, 'Start 12m Cook Timer');
  assert.equal(ui.cooldownButtonLabel, 'Start 10m Cooldown Timer');
  assert.equal(ui.highlightCooldownNext, false);

  rice = mod.advanceSequentialRicePhase(rice, 'start_cook');
  ui = mod.getSequentialRiceButtonPresentation(rice);
  assert.equal(ui.cookButtonState, 'running');
  assert.equal(ui.cooldownButtonState, 'idle');

  rice = mod.advanceSequentialRicePhase(rice, 'complete_cook');
  ui = mod.getSequentialRiceButtonPresentation(rice);
  assert.equal(ui.cookButtonLabel, '✓ 12m Cook Done');
  assert.equal(ui.cookButtonState, 'done');
  assert.equal(ui.cooldownButtonState, 'ready-next');
  assert.equal(ui.highlightCooldownNext, true);

  rice = mod.advanceSequentialRicePhase(rice, 'start_cooldown');
  ui = mod.getSequentialRiceButtonPresentation(rice);
  assert.equal(ui.cooldownButtonState, 'running');
  assert.equal(ui.highlightCooldownNext, false);

  rice = mod.advanceSequentialRicePhase(rice, 'complete_cooldown');
  ui = mod.getSequentialRiceButtonPresentation(rice);
  assert.equal(ui.cooldownButtonLabel, '✓ 10m Cooldown Done');
  assert.equal(ui.cooldownButtonState, 'done');

  // 3. Exposed Shop List total weight/volume pills on both weekly and 90-day views (14 items each)
  const weeklyIds = Object.keys(mod.EXPOSED_SHOP_WEIGHT_PILLS.weekly);
  const quarterlyIds = Object.keys(mod.EXPOSED_SHOP_WEIGHT_PILLS.quarterly);
  assert.equal(weeklyIds.length, 14);
  assert.equal(quarterlyIds.length, 14);
  assert.equal(mod.getExposedShopWeightPill('shop_silk', 'weekly'), '1,260 ml/wk (1 Carton • 1.89L)');
  assert.equal(mod.getExposedShopWeightPill('shop_silk', 'quarterly'), '16.2L / 90d (9 Cartons)');
  assert.equal(mod.getExposedShopWeightPill('shop_tofu', 'quarterly'), '15,750g / 90d (45 Blocks)');
  assert.equal(mod.getExposedShopWeightPill('shop_isolate', 'quarterly'), '9,072g / 90d (4 Tubs)');

  // 4. Muscle Fuel Row 2 pills sum cleanly to $6.35/day (or $6.34/day Costco Creatine) and expose total weight
  const f1 = mod.getFuelCardRow2Pills('pre_shake', 'Scale: 390g', false);
  const f2 = mod.getFuelCardRow2Pills('post_oats', 'Scale: 279g', false);
  const f3 = mod.getFuelCardRow2Pills('lunch', 'Scale: 419g', false);
  const f4 = mod.getFuelCardRow2Pills('dinner', 'Scale: 411g', false);
  assert.equal(f1.weightPill, 'Total: 390g');
  assert.equal(f1.costPill, '$1.35 / meal');
  assert.equal(f2.weightPill, 'Total: 279g');
  assert.equal(f3.weightPill, 'Total: 419g');
  assert.equal(f4.weightPill, 'Total: 411g');
  const sumDaily = [f1, f2, f3, f4].reduce(
    (acc, p) => acc + parseFloat(p.costPill.replace(/[^0-9.]/g, '')),
    0
  );
  assert.equal(sumDaily.toFixed(2), '6.35');
});

test('Subtest 37: Interactive Gym Time Sync (11:00 AM -> -25m, +75m, +5h, +9.5h) and 3-Zone Contextual Grouping', async () => {
  const mod = await import('./workoutLogic');

  // 1. Chrononutrition sync for 11:00 AM gym session
  const sched11am = mod.getSyncedChronoSchedule('11:00');
  assert.equal(sched11am.gymTime12, '11:00 AM');
  assert.equal(sched11am.fuel1Time12, '10:35 AM');
  assert.equal(sched11am.fuel2Time12, '12:15 PM');
  assert.equal(sched11am.fuel3Time12, '4:00 PM');
  assert.equal(sched11am.fuel4Time12, '8:30 PM');

  // 2. Interactive Gym Time pill label & 3-Zone structure
  assert.equal(
    mod.GYM_CONTEXTUAL_ZONES_SPEC.interactiveGymTimeButtonFormat('11:00 AM'),
    '🕒 Gym Time: 11:00 AM ▼'
  );
  assert.deepEqual(mod.GYM_CONTEXTUAL_ZONES_SPEC.zoneA.buttons, [
    '📅 Week Schedule',
    '🔄 Sync & Settings',
    '📊 Stats'
  ]);
  assert.deepEqual(mod.GYM_CONTEXTUAL_ZONES_SPEC.zoneB.buttons, [
    'Swap Today to Rest Day',
    "Change Today's Workout ▼"
  ]);
  assert.deepEqual(mod.GYM_CONTEXTUAL_ZONES_SPEC.zoneC.pills, [
    '💧 Water: 0/3L (+500ml)',
    '✓ Abs On',
    '🎒 Gear Checklist'
  ]);
  assert.equal(mod.GYM_CONTEXTUAL_ZONES_SPEC.zoneC.nextFuelMovedToMuscleFuelTab, true);
  assert.equal(mod.GYM_CONTEXTUAL_ZONES_SPEC.warmupDefaultClosedOnLoad, true);
});

test('Subtest 38: Neurodivergent COGA/BDA Palette, AI Difficulty Wizard, Wake-Up vs Gym Time 2.5h Fuel Swap & Swap-From-History Collector', async () => {
  const mod = await import('./workoutLogic');

  // 1. Neurodivergent color & typography tokens (No pure black #000000 or pure white #ffffff)
  assert.equal(mod.NEURODIVERGENT_PALETTE_SPEC.backgroundMain, '#0f172a');
  assert.equal(mod.NEURODIVERGENT_PALETTE_SPEC.backgroundSurface, '#1e293b');
  assert.equal(mod.NEURODIVERGENT_PALETTE_SPEC.textPrimary, '#f8fafc');
  assert.equal(mod.NEURODIVERGENT_PALETTE_SPEC.typography.letterSpacing, '0.02em');
  assert.equal(mod.NEURODIVERGENT_PALETTE_SPEC.typography.lineHeight, '1.5');
  assert.equal(mod.NEURODIVERGENT_PALETTE_SPEC.states.unstartedBorder, '#334155');
  assert.equal(mod.NEURODIVERGENT_PALETTE_SPEC.states.activeAmberBg, 'rgba(217, 119, 6, 0.15)');
  assert.equal(mod.NEURODIVERGENT_PALETTE_SPEC.states.activeAmberBorder, '#d97706');
  assert.equal(mod.NEURODIVERGENT_PALETTE_SPEC.states.completedBg, '#059669');
  assert.deepEqual(mod.NEURODIVERGENT_PALETTE_SPEC.zoneAButtons, [
    '📅 Week Schedule',
    '🔄 Sync & Settings',
    '📊 Stats & Dashboard'
  ]);

  // 2. Strict AI Difficulty Prompt Injection & Deterministic Schedule
  const easyPrompt = mod.buildProgramSetupWizardPrompt(4, 'Legs', 'Easy');
  assert.equal(
    easyPrompt.includes('Difficulty: EASY. You MUST select strictly machine-based or cable-based exercises (e.g., Leg Press instead of Squat). Max 3 sets per exercise to prevent fatigue.'),
    true
  );
  const medPrompt = mod.buildProgramSetupWizardPrompt(5, 'Balanced', 'Medium');
  assert.equal(
    medPrompt.includes('Difficulty: MEDIUM. Use a standard mix of free-weights and machines. 3 to 4 sets per exercise.'),
    true
  );
  const hardPrompt = mod.buildProgramSetupWizardPrompt(6, 'Back', 'Hard');
  assert.equal(
    hardPrompt.includes('Difficulty: HARD. Prioritize complex, heavy free-weight barbell compound lifts (e.g., Barbell Squat, Deadlift). 4 to 5 sets per exercise.'),
    true
  );

  const easyWeek = mod.buildDeterministicWizardWeekSchedule(4, 'Legs', 'Easy', 1);
  assert.equal(easyWeek.length, 7);
  const easyLiftDays = easyWeek.filter((d: any) => typeof d === 'object' && !d.isRestDay);
  assert.equal(easyLiftDays.length, 4);
  easyLiftDays.forEach((d: any) => {
    d.exercises.forEach((ex: any) => {
      assert.ok(ex.sets <= 3, `Easy difficulty must cap at 3 sets, got ${ex.sets}`);
      assert.equal(/machine|cable|pec deck/i.test(ex.name), true, `Easy exercise must be machine/cable: ${ex.name}`);
    });
  });

  const hardWeek = mod.buildDeterministicWizardWeekSchedule(5, 'Legs', 'Hard', 1);
  const hardFirstLift = hardWeek.find((d: any) => typeof d === 'object' && !d.isRestDay) as any;
  assert.equal(hardFirstLift.exercises[0].name, 'Barbell Back Squat');
  assert.ok(hardFirstLift.exercises[0].sets >= 4 && hardFirstLift.exercises[0].sets <= 5);

  // 3. Wake-Up vs. Gym Time Chrononutrition Gap Engine (< 2.5h standard vs >= 2.5h auto-swap)
  const standardSched = mod.evaluateWakeGymChronoSchedule('06:30', '07:00');
  assert.equal(standardSched.gapMinutes, 30);
  assert.equal(standardSched.isFuel1Fuel2Swapped, false);
  assert.deepEqual(standardSched.mealOrder, ['pre_shake', 'post_oats', 'lunch', 'dinner']);
  assert.equal(standardSched.fuel1ShakeTime12, '6:30 AM');
  assert.equal(standardSched.fuel2OatsTime12, '8:15 AM');
  assert.equal(standardSched.alertBannerText, '');

  const swappedSched = mod.evaluateWakeGymChronoSchedule('07:30', '11:00');
  assert.equal(swappedSched.gapMinutes, 210);
  assert.equal(swappedSched.gapHours, 3.5);
  assert.equal(swappedSched.isFuel1Fuel2Swapped, true);
  assert.deepEqual(swappedSched.mealOrder, ['post_oats', 'pre_shake', 'lunch', 'dinner']);
  assert.equal(swappedSched.fuel2OatsTime12, '8:00 AM');
  assert.equal(swappedSched.fuel1ShakeTime12, '10:30 AM');
  assert.equal(swappedSched.fuel3BowlTime12, '12:15 PM');
  assert.equal(swappedSched.fuel4ShakeTime12, '8:30 PM');
  assert.equal(
    swappedSched.alertBannerText,
    'Gap is over 2.5 hours. Eat your solid Oats (Fuel 2) now so they digest. Drink your Pre-Workout Shake (Fuel 1) 30 minutes before lifting.'
  );

  // 4. Unique Historical Exercise Collector from customDayScheduleByWeek
  const historyList = mod.collectUniqueExercisesFromHistory(
    {
      '1': [
        {
          title: 'Bonus Chest',
          exercises: [
            { id: 'ex_a', name: 'Incline Machine Press', sets: 3, reps: '10-12', restSec: 90, videoUrl: 'https://youtube.com/a' },
            { id: 'ex_b', name: 'Incline Machine Press', sets: 4, reps: '8-10', restSec: 90, videoUrl: 'https://youtube.com/a2' }
          ]
        },
        0
      ]
    },
    [
      {
        daySub: 'Upper 1',
        exercises: [
          { id: 'ex_bench', name: 'Barbell Bench Press', sets: 3, reps: '8-10', restSec: 120, videoUrl: 'https://youtube.com/bench' }
        ]
      }
    ]
  );
  assert.equal(historyList.length, 2);
  assert.equal(historyList[0].name, 'Incline Machine Press');
  assert.equal(historyList[1].name, 'Barbell Bench Press');
});

test('Subtest 39: Diet Preference Onboarding Injection, Flex Meal AI Food Vision Parser, and Zero-Friction Quick Add Calorie Engine', async () => {
  const mod = await import('./workoutLogic');

  // 1. 5 ELI12 Dietary Preference Pills + Hidden Prompt Injection
  assert.deepEqual(
    mod.DIET_PREFERENCE_OPTIONS.map(o => o.label),
    ['Any Food (Cheapest)', 'Vegan', 'Vegetarian', 'Keto (Low Carb)', 'Gluten-Free']
  );
  assert.equal(
    mod.buildDietPromptInjection('vegan'),
    'Diet: [VEGAN]. Ensure all recommended meal structures align with this diet.'
  );
  assert.equal(
    mod.buildDietPromptInjection('keto'),
    'Diet: [KETO (LOW CARB)]. Ensure all recommended meal structures align with this diet.'
  );
  assert.equal(
    mod.buildDietPromptInjection('any'),
    'Diet: [ANY FOOD (CHEAPEST)]. Ensure all recommended meal structures align with this diet.'
  );

  // 2. Flex Meal AI Vision Hidden Prompt & JSON Parser
  assert.equal(
    mod.FLEX_FOOD_VISION_PROMPT,
    'System: Estimate the calories and protein in this food image or menu item. Return ONLY a valid JSON object matching this schema: { "foodName": "Burger and Fries", "calories": 850, "protein": 35 }. Do not output markdown, only valid JSON.'
  );
  const parsedClean = mod.parseFlexFoodVisionJson('{"foodName":"Burger and Fries","calories":850,"protein":35}');
  assert.equal(parsedClean.ok, true);
  assert.equal(parsedClean.estimate.foodName, 'Burger and Fries');
  assert.equal(parsedClean.estimate.calories, 850);
  assert.equal(parsedClean.estimate.protein, 35);
  assert.equal(parsedClean.estimate.isFlexMeal, true);

  const parsedFenced = mod.parseFlexFoodVisionJson('```json\n{"foodName":"Teriyaki Salmon Bowl","calories":690,"protein":42}\n```');
  assert.equal(parsedFenced.ok, true);
  assert.equal(parsedFenced.estimate.calories, 690);
  assert.equal(parsedFenced.estimate.protein, 42);

  const parsedBad = mod.parseFlexFoodVisionJson('not valid json');
  assert.equal(parsedBad.ok, false);
  assert.equal(parsedBad.estimate.isFlexMeal, true);
  assert.ok(parsedBad.estimate.calories > 0);

  // 3. 4 Quick Add Drinks & Treats Options (Zero Macro Friction)
  assert.deepEqual(
    mod.QUICK_ADD_TREAT_OPTIONS.map(q => ({ label: q.label, calories: q.calories })),
    [
      { label: '🍺 Light Drink (150 kcal)', calories: 150 },
      { label: '🍻 Heavy Drink / Cocktail (250 kcal)', calories: 250 },
      { label: '🍪 Small Treat (300 kcal)', calories: 300 },
      { label: '🍔 Big Meal Out (1,000 kcal)', calories: 1000 }
    ]
  );

  // 4. Daily Totalizer: Flex Meal replaces Fuel 3 Tofu Bowl + Quick Add adds calories without touching protein
  const totals = mod.computeDailyFuelTotalsWithFlexAndQuickAdd({
    baseMeals: [
      { slotId: 'pre_shake', kcal: 140, protein: 32, checked: true },
      { slotId: 'post_oats', kcal: 395, protein: 26, checked: false },
      { slotId: 'lunch', kcal: 540, protein: 39, checked: false },
      { slotId: 'dinner', kcal: 250, protein: 42, checked: false }
    ],
    flexOverrides: {
      lunch: { foodName: 'Burger and Fries', calories: 850, protein: 35, isFlexMeal: true }
    },
    quickAdds: [
      { id: 'qa1', optionId: 'light_drink', label: 'Light Drink', calories: 150 },
      { id: 'qa2', optionId: 'small_treat', label: 'Small Treat', calories: 300 }
    ]
  });
  assert.equal(totals.flexMealsLoggedCount, 1);
  assert.equal(totals.quickAddKcal, 450);
  assert.equal(totals.eatenProtein, 67); // 32 (shake) + 35 (flex lunch)
  assert.equal(totals.eatenKcal, 1440); // 140 + 850 + 150 + 300
});

test('Subtest 40: Dynamic Diet Ecosystem — Strict Wizard Schema, State-Bound Cooking Timers, Diet-Bound Shopping List & Premium Brand Swap Live Totalizer', async () => {
  const mod = await import('./workoutLogic');

  // 1. Strict Wizard JSON Exercise Schema Normalization
  assert.ok(mod.STRICT_WIZARD_EXERCISE_SCHEMA_LINE.includes('"restTimer": "90s"'));
  assert.ok(mod.STRICT_WIZARD_EXERCISE_SCHEMA_LINE.includes('"videoUrl": "https://youtube.com/..."'));
  assert.equal(mod.parseRestTimerSeconds('90s'), 90);
  assert.equal(mod.parseRestTimerSeconds('2m'), 120);
  assert.equal(mod.parseRestTimerSeconds(75), 75);

  const easyEx = mod.normalizeWizardExerciseStrict(
    {
      name: 'Seated Chest Press Machine',
      sets: 5,
      reps: '10-12',
      restTimer: '75s',
      videoUrl: 'https://youtube.com/watch?v=abc',
      instructions: 'Keep shoulders pinned back.'
    },
    'easy',
    'wiz_easy_1'
  );
  assert.ok(easyEx);
  assert.equal(easyEx.sets, 3); // Easy caps sets at 3
  assert.equal(easyEx.rest, 75);
  assert.equal(easyEx.restTimer, '75s');
  assert.equal(easyEx.videoUrl, 'https://youtube.com/watch?v=abc');
  assert.equal(easyEx.equipType, 'machine');

  const hardEx = mod.normalizeWizardExerciseStrict(
    { name: 'Barbell Squat', sets: 2, reps: '5-6', restTimer: '150s', equipType: 'barbell' },
    'hard',
    'wiz_hard_1'
  );
  assert.ok(hardEx);
  assert.equal(hardEx.sets, 4); // Hard enforces 4-5 sets
  assert.equal(hardEx.rest, 150);
  assert.ok(hardEx.videoUrl.startsWith('https://www.youtube.com/'));

  // 2. State-Bound Dynamic Cooking Timer on Rest Timer Tab
  const veganTimer = mod.getDietCookingTimerConfig('Vegan');
  assert.equal(veganTimer.mode, 'rice');
  assert.equal(veganTimer.dietDisplay, 'Vegan');
  assert.equal(veganTimer.phase1Seconds, 720); // 12m Cook
  assert.equal(veganTimer.phase2Seconds, 600); // 10m Rest
  assert.ok(veganTimer.summaryTitle.includes('Jasmine Rice Timer'));

  const ketoTimer = mod.getDietCookingTimerConfig('Keto');
  assert.equal(ketoTimer.mode, 'keto_veggie');
  assert.equal(ketoTimer.dietDisplay, 'Keto');
  assert.equal(ketoTimer.phase1Seconds, 480); // 8m Steam
  assert.equal(ketoTimer.phase2Seconds, 180); // 3m Drain
  assert.ok(ketoTimer.summaryTitle.includes('Low-Carb Veggie Timer'));

  // 3. State-Bound Shopping List Patches per Diet
  assert.deepEqual(mod.getDietShoppingItemPatches('Vegan'), {});
  const ketoPatches = mod.getDietShoppingItemPatches('Keto');
  assert.ok(ketoPatches.shop_rice.shortName.includes('Riced Cauliflower'));
  assert.ok(ketoPatches.shop_banana.shortName.includes('Avocados'));
  assert.ok(ketoPatches.shop_oats.shortName.includes('Almond Flour'));

  const anyPatches = mod.getDietShoppingItemPatches('Any');
  assert.ok(anyPatches.shop_tofu.shortName.includes('Chicken'));

  // 4. Premium Brand/Quality Swap & Automatic Weekly/3-Month/Daily Total Recalculation
  const sampleCategories = [
    {
      category: 'Aisle 1: Produce',
      items: [
        { id: 'shop_silk', weeklyCost: '$3.19/wk', quarterlyCost: '$41.06 / 3 mos' },
        { id: 'shop_tofu', weeklyCost: '$8.97/wk', quarterlyCost: '$115.33 / 3 mos' }
      ]
    },
    {
      category: 'Aisle 4: Bulk Supplements',
      items: [
        { id: 'shop_isolate', weeklyCost: '$22.40/wk', quarterlyCost: '$287.96 / 3 mos' }
      ]
    }
  ];
  const baseTotals = mod.computeShoppingTotalsWithBrandOverrides(sampleCategories, {});
  assert.equal(baseTotals.storeWeeklyTotal, 12.16);
  assert.equal(baseTotals.bulkWeeklyTotal, 22.4);
  assert.equal(baseTotals.weeklyTotal, 34.56);
  assert.equal(baseTotals.swappedCount, 0);

  const premiumTofu = mod.getPremiumBrandPresetForShopItem({ id: 'shop_tofu', weeklyCost: '$8.97/wk' });
  assert.equal(premiumTofu.weeklyPrice, 12.47); // +$3.50/wk

  const swappedTotals = mod.computeShoppingTotalsWithBrandOverrides(sampleCategories, {
    shop_tofu: { tier: 'premium', brandName: premiumTofu.brandName, weeklyPrice: premiumTofu.weeklyPrice }
  });
  assert.equal(swappedTotals.swappedCount, 1);
  assert.equal(swappedTotals.storeWeeklyTotal, 15.66); // 12.16 + 3.50
  assert.equal(swappedTotals.weeklyTotal, 38.06); // 34.56 + 3.50
  assert.equal(swappedTotals.itemPricing.shop_tofu.deltaWeekly, 3.5);
  assert.equal(swappedTotals.itemPricing.shop_tofu.isSwapped, true);
  assert.equal(swappedTotals.dailyTotal, +(38.06 / 7).toFixed(2));
});

test('Subtest 41: Multi-Select Base Diet & Intolerances, Error Prevention Confirmation Modal, Combined Patches & Dismissible Chrononutrition Alert', async () => {
  const mod = await import('./workoutLogic');

  // 1. Base Diet & Intolerances Normalization + Legacy Migration
  assert.deepEqual(mod.BASE_DIET_OPTIONS, ['Omnivore (Cheapest)', 'Vegan', 'Vegetarian', 'Keto']);
  assert.deepEqual(mod.DIETARY_INTOLERANCE_OPTIONS, ['Gluten-Free', 'Nut-Free', 'Soy-Free']);
  assert.equal(mod.normalizeBaseDiet('any'), 'Omnivore (Cheapest)');
  assert.equal(mod.normalizeBaseDiet('Omnivore (Cheapest)'), 'Omnivore (Cheapest)');
  assert.equal(mod.normalizeBaseDiet('keto'), 'Keto');
  assert.equal(mod.normalizeBaseDiet('vegetarian'), 'Vegetarian');
  assert.equal(mod.normalizeBaseDiet('gluten_free'), 'Vegan');
  assert.deepEqual(mod.normalizeIntolerances([], 'gluten_free'), ['Gluten-Free']);
  assert.deepEqual(mod.normalizeIntolerances(['Soy-Free', 'Gluten-Free', 'Gluten-Free']), ['Gluten-Free', 'Soy-Free']);

  // 2. Compact Shop List Header Link Formatting
  assert.equal(mod.formatCompactShopDietHeaderLink('Vegan', []), '⚙️ Diet: Vegan (Change)');
  assert.equal(mod.formatCompactShopDietHeaderLink('Vegan', ['Gluten-Free']), '⚙️ Diet: Vegan + GF (Change)');
  assert.equal(mod.formatCompactShopDietHeaderLink('Keto', ['Gluten-Free', 'Nut-Free']), '⚙️ Diet: Keto + 2 (Change)');

  // 3. Error Prevention Confirmation Interception Rules
  const sameCheck = mod.shouldPromptDietChangeConfirmation('Vegan', ['Gluten-Free'], 'Vegan', ['Gluten-Free']);
  assert.equal(sameCheck.requiresConfirm, false);

  const addIntolCheck = mod.shouldPromptDietChangeConfirmation('Vegan', [], 'Vegan', ['Gluten-Free']);
  assert.equal(addIntolCheck.requiresConfirm, false);

  const changeBaseCheck = mod.shouldPromptDietChangeConfirmation('Vegan', [], 'Keto', []);
  assert.equal(changeBaseCheck.requiresConfirm, true);
  assert.equal(changeBaseCheck.reason, 'base_diet_changed');
  assert.equal(
    changeBaseCheck.warningText,
    'Change diet to Keto? Your shopping list and meal timers will update to match.'
  );

  const uncheckIntolCheck = mod.shouldPromptDietChangeConfirmation('Vegan', ['Gluten-Free', 'Nut-Free'], 'Vegan', ['Nut-Free']);
  assert.equal(uncheckIntolCheck.requiresConfirm, true);
  assert.equal(uncheckIntolCheck.reason, 'intolerance_removed');
  assert.equal(
    uncheckIntolCheck.warningText,
    'Change diet to Vegan + Nut-Free? Your shopping list and meal timers will update to match.'
  );

  // 4. Gemini System Prompt Injection with Both baseDiet and intolerances
  const promptLine = mod.buildGeminiDietAndIntolerancePromptLine('Vegan', ['Gluten-Free', 'Soy-Free']);
  assert.ok(promptLine.includes('Base Diet: [Vegan]'));
  assert.ok(promptLine.includes('Dietary Intolerances: [Gluten-Free, Soy-Free]'));

  // 5. Combined Base Diet + Multi-Intolerance Shopping Patches
  const veganGfNutSoy = mod.getCombinedDietAndIntoleranceShoppingPatches('Vegan', ['Gluten-Free', 'Nut-Free', 'Soy-Free']);
  assert.ok(veganGfNutSoy.shop_oats.shortName.includes('Gluten-Free'));
  assert.ok(veganGfNutSoy.shop_pb.shortName.includes('Sunflower Seed Butter'));
  assert.ok(veganGfNutSoy.shop_tofu.shortName.includes('Soy-Free'));
  assert.ok(veganGfNutSoy.shop_silk.shortName.includes('Nut-Free & Soy-Free'));

  const ketoNutFree = mod.getCombinedDietAndIntoleranceShoppingPatches('Keto', ['Nut-Free']);
  assert.ok(ketoNutFree.shop_oats.shortName.includes('Hemp Hearts')); // No almond flour when Nut-Free!
  assert.ok(ketoNutFree.shop_pb.shortName.includes('Sunflower Seed Butter'));

  // 6. State-Bound Dismissible Chrononutrition Alert Visibility
  assert.equal(
    mod.shouldShowChronoGapAlert({ isFuel1Fuel2Swapped: false, isFuel2Logged: false, isManuallyDismissed: false }),
    false
  );
  assert.equal(
    mod.shouldShowChronoGapAlert({ isFuel1Fuel2Swapped: true, isFuel2Logged: false, isManuallyDismissed: false }),
    true
  );
  // Instantly disappears when Fuel 2 (Oats) is logged
  assert.equal(
    mod.shouldShowChronoGapAlert({ isFuel1Fuel2Swapped: true, isFuel2Logged: true, isManuallyDismissed: false }),
    false
  );
  // Instantly disappears when user clicks [x] Dismiss
  assert.equal(
    mod.shouldShowChronoGapAlert({ isFuel1Fuel2Swapped: true, isFuel2Logged: false, isManuallyDismissed: true }),
    false
  );
});

test('Subtest 42: Upgrade 19 — Strict exerciseID Sync, Historical Pre-Fill, Dual-Mode Cardio, Gym Locker, Post-Workout +30m, Rest-Day -20% Carbs, Warm-Up Auto-Close & Dynamic Batch Portions', async () => {
  const mod = await import('./workoutLogic.ts');
  // 1. Strict exerciseID Canonicalization & Lateral Cable Bug Fix
  assert.equal(mod.resolveCanonicalExerciseId('thu_cable_lat_raise', 'Cable Lateral Raise'), 'ex_cable_lateral_raise');
  assert.equal(mod.resolveCanonicalExerciseId('mon_lat_raise', 'Dumbbell Lateral Raise'), 'ex_db_lateral_raise');
  assert.notEqual(
    mod.resolveCanonicalExerciseId('thu_cable_lat_raise', 'Cable Lateral Raise'),
    mod.resolveCanonicalExerciseId('mon_lat_raise', 'Dumbbell Lateral Raise')
  );
  assert.equal(mod.resolveCanonicalExerciseId('cable_ab_crunch', 'Cable Abdominal Crunch'), 'ex_cable_crunch');
  assert.equal(mod.resolveCanonicalExerciseId('day3_pullups', 'Overhand Pull-Ups'), 'ex_daily_pullups');

  // Video URLs strictly bound to canonical exerciseID (no cable/dumbbell collision!)
  assert.equal(mod.getVerifiedVideoUrlByExerciseId('ex_cable_lateral_raise'), 'https://www.youtube.com/watch?v=PPrzBWZDOhA');
  assert.equal(mod.getVerifiedVideoUrlByExerciseId('ex_db_lateral_raise'), 'https://www.youtube.com/watch?v=3VcKaXpzqRo');

  // 2. Historical Pre-Fill ("Last Known Set" chronologically across any week/day)
  const history = {
    ex_cable_crunch: [
      {
        exerciseID: 'ex_cable_crunch',
        timestamp: 1000,
        week: 1,
        dayIdx: 0,
        sets: [
          { setIdx: 1, weight: '60', reps: '15', unit: 'lbs' },
          { setIdx: 2, weight: '60', reps: '14', unit: 'lbs' },
          { setIdx: 3, weight: '60', reps: '12', unit: 'lbs' }
        ]
      },
      {
        exerciseID: 'ex_cable_crunch',
        timestamp: 5000,
        week: 1,
        dayIdx: 2,
        sets: [
          { setIdx: 1, weight: '70', reps: '16', unit: 'lbs' },
          { setIdx: 2, weight: '70', reps: '15', unit: 'lbs' },
          { setIdx: 3, weight: '70', reps: '15', unit: 'lbs' }
        ]
      }
    ]
  };
  const lastKnown = mod.getLastKnownExerciseSession(history, 'ex_cable_crunch', 1, 3);
  assert.ok(lastKnown);
  assert.equal(lastKnown.dayIdx, 2);
  const autoFilled = mod.autoFillSetsFromLastKnown(lastKnown, 3);
  assert.equal(autoFilled.length, 3);
  assert.equal(autoFilled[0].weight, '70');
  assert.equal(autoFilled[0].reps, '16');
  assert.equal(autoFilled[2].reps, '15');

  // 3. Dual-Mode Cardio Engine
  assert.equal(mod.isCardioExerciseSpec({ name: 'Outdoor Biking' }), true);
  assert.equal(mod.isCardioExerciseSpec({ name: 'Treadmill Run' }), true);
  assert.equal(mod.isCardioExerciseSpec({ name: 'Barbell Bench Press' }), false);
  assert.equal(mod.formatCardioDurationClock(125), '02:05');
  assert.equal(mod.formatCardioDurationClock(3661), '01:01:01');
  const manualBike = mod.buildCardioLogRecord('manual', { distanceKm: 18.5, durationMins: 60 });
  assert.equal(manualBike.durationMins, 60);
  assert.equal(manualBike.distanceKm, 18.5);
  assert.ok(manualBike.summaryText.includes('18.5 km'));
  assert.ok(manualBike.summaryText.includes('60 mins'));

  // 4. Gym Locker Pin & Auto-Clear
  assert.equal(mod.formatLockerPillLabel({ pin: '', photoDataUrl: '' }), '🔒 Locker');
  assert.equal(mod.formatLockerPillLabel({ pin: '159', photoDataUrl: '' }), '🔒 Locker: #159');
  assert.equal(mod.formatLockerPillLabel({ pin: '159', photoDataUrl: 'data:image/jpeg;base64,abc' }), '🔒 Locker: #159 (Photo)');
  const cleared = mod.createClearedLockerState();
  assert.equal(mod.formatLockerPillLabel(cleared), '🔒 Locker');

  // 5. Dynamic Post-Workout Meal (+30 mins)
  const testDate = new Date(2026, 10, 20, 8, 15, 0);
  assert.equal(mod.computePostWorkoutMealTimePlus30(testDate), '8:45 AM');
  assert.equal(mod.formatOpenPostWorkoutMealButtonLabel(testDate), 'Eat Meal at 8:45 AM');

  // 6. Rest Day -20% Carb Scaling (Rice AND Gluten-Free Protein Oats!)
  const lunchItems = [
    { id: 'm2_tofu', name: 'Extra-Firm Tofu', weight: '175g', grams: 175, protein: 22, kcal: 160 },
    { id: 'm2_rice', name: 'Cooked Jasmine Rice', weight: '150g', grams: 150, protein: 4, kcal: 195 },
    { id: 'm2_broccoli', name: 'Steamed Broccoli', weight: '100g', grams: 100, protein: 3, kcal: 35 }
  ];
  const reducedRest = mod.applyRestDayCarbReduction(lunchItems, true, 'reduce_20');
  assert.equal(reducedRest[0].grams, 175); // Tofu untouched
  assert.equal(reducedRest[1].grams, 120); // Rice scaled -20% (150 * 0.8 = 120)
  assert.equal(reducedRest[1].kcal, 156);  // 195 * 0.8 = 156
  assert.equal(reducedRest[2].grams, 100); // Broccoli untouched

  const oatsItems = [
    { id: 'm2_oats', name: 'Gluten-Free Protein Oats', weight: '45g', grams: 45, protein: 10, kcal: 170 },
    { id: 'm2_pea_oats', name: 'Naked Pea Protein Isolate (whisked in jar)', weight: '10g', grams: 10, protein: 9, kcal: 40 }
  ];
  const reducedOats = mod.applyRestDayCarbReduction(oatsItems, true, 'reduce_20');
  assert.equal(reducedOats[0].grams, 36); // Oats scaled -20% (45 * 0.8 = 36)
  assert.equal(reducedOats[1].grams, 10); // Pea Protein Isolate untouched

  // On Lift Day or Match mode, nothing reduced
  const matchRest = mod.applyRestDayCarbReduction(lunchItems, true, 'match');
  assert.equal(matchRest[1].grams, 150);

  // 7. Dynamic Rice & Oats Batch Portion Calculator (6 portions = 1.5x)
  const riceSteps = [
    { id: 'rice_step_1', title: 'Dry White Jasmine Rice (Rinsed)', detail: '55g dry per day × 4 days', weightBadge: '220g' },
    { id: 'rice_step_2', title: 'Filtered Cooking Water', detail: 'Add water to pot', weightBadge: '330 ml' },
    { id: 'rice_step_3', title: 'Cook & Cool-Down', detail: 'Cook 10-12m', weightBadge: '600g Yield' },
    { id: 'rice_step_4', title: 'Divide Into 4 Fridge Containers', detail: '150g cooked rice per container × 4 days', weightBadge: '150g × 4' }
  ];
  const scaled6 = mod.scaleBatchRecipeSteps(riceSteps, 6, 4);
  assert.equal(scaled6[0].weightBadge, '330g');
  assert.equal(scaled6[1].weightBadge, '495 ml');
  assert.equal(scaled6[2].weightBadge, '900g Yield');
  assert.equal(scaled6[3].weightBadge, '150g × 6');
  assert.ok(scaled6[3].title.includes('Into 6 Fridge Containers'));

  // 8. Warm-Up Auto-Collapse Gate (Part 1 AND Part 2 complete)
  assert.equal(mod.areAllWarmupItemsComplete([true, true], [true, false]), false);
  assert.equal(mod.areAllWarmupItemsComplete([true, true], [true, true, true]), true);
});

test('Subtest 43: Upgrade 20 — First-Open Wizard Gate, Over-Training 6-7 Day Streak Alert, 1000ms Warm-Up Close, ex_cable_lateral Alias & Shop Weight Badge', async () => {
  const mod = await import('./workoutLogic.ts');

  // 1. First-Open Setup Wizard Gate
  assert.equal(mod.shouldAutoOpenFirstSetupWizard(false, ''), true);
  assert.equal(mod.shouldAutoOpenFirstSetupWizard(true, ''), false);
  assert.equal(mod.shouldAutoOpenFirstSetupWizard(false, '?autostart=1'), false);

  // 2. Over-Training Alert (6 or 7 lifting days in a row)
  const fiveLiftTwoRest = [false, false, false, false, false, true, true];
  assert.equal(mod.detectConsecutiveLiftingDaysStreak(fiveLiftTwoRest), 5);
  assert.equal(mod.shouldShowOvertrainingAlert(fiveLiftTwoRest).show, false);

  const sixInARow = [false, false, false, false, false, false, true];
  assert.equal(mod.detectConsecutiveLiftingDaysStreak(sixInARow), 6);
  const alert6 = mod.shouldShowOvertrainingAlert(sixInARow);
  assert.equal(alert6.show, true);
  assert.equal(
    alert6.message,
    'Warning: Muscles need rest to grow. It is best to rest after 3 or 4 days of lifting.'
  );
  // Dismissing the exact pattern suppresses it
  assert.equal(mod.shouldShowOvertrainingAlert(sixInARow, alert6.alertKey).show, false);

  const sevenInARow = [false, false, false, false, false, false, false];
  assert.equal(mod.detectConsecutiveLiftingDaysStreak(sevenInARow), 7);
  assert.equal(mod.shouldShowOvertrainingAlert(sevenInARow).show, true);

  // 3. 1000ms Warm-Up Auto-Close delay & ex_cable_lateral alias
  assert.equal(mod.WARMUP_AUTO_CLOSE_DELAY_MS, 1000);
  assert.equal(mod.resolveCanonicalExerciseId('ex_cable_lateral', 'Any Renamed Lateral'), 'ex_cable_lateral_raise');
  assert.equal(mod.getVerifiedVideoUrlByExerciseId('ex_cable_lateral'), 'https://www.youtube.com/watch?v=PPrzBWZDOhA');

  // 4. Shop List Short Weight Badge next to food name
  assert.equal(mod.extractShortShopWeightBadge('907g bag (315g/wk)'), '907g');
  assert.equal(mod.extractShortShopWeightBadge('1,225g/wk (3.5 Blocks)'), '1,225g');
  assert.equal(mod.extractShortShopWeightBadge('1,260 ml/wk (1 Carton • 1.89L)'), '1,260ml');
});

test('Subtest 44: Upgrade 21 — D3.js 1RM Progression Chart (Bench/Squat/Deadlift Series, Epley 1RM, Neurodivergent Colors & ELI12 Tooltips)', async () => {
  const mod = await import('./workoutLogic.ts');

  // 1. Lift Config & Neurodivergent Color Tokens
  assert.deepEqual(mod.ONE_RM_LIFT_ORDER, ['bench', 'squat', 'deadlift']);
  assert.equal(mod.ONE_RM_LIFT_CONFIGS.bench.pillLabel, 'Bench Press');
  assert.equal(mod.ONE_RM_LIFT_CONFIGS.bench.strokeColor, '#0ea5e9');
  assert.equal(mod.ONE_RM_LIFT_CONFIGS.squat.pillLabel, 'Squat');
  assert.equal(mod.ONE_RM_LIFT_CONFIGS.squat.strokeColor, '#10b981');
  assert.equal(mod.ONE_RM_LIFT_CONFIGS.deadlift.pillLabel, 'Deadlift');
  assert.equal(mod.ONE_RM_LIFT_CONFIGS.deadlift.strokeColor, '#d97706');

  // 2. Epley 1RM & ELI12 Tooltip Formatting
  assert.equal(mod.calculateEpleyOneRm(135, 8), 171); // 135 * (1 + 8/30) = 171
  assert.equal(mod.calculateEpleyOneRm(225, 1), 225);
  assert.equal(mod.calculateEpleyOneRm(0, 8), 0);
  assert.equal(mod.formatShortChartDate('2026-11-21'), 'Nov 21');
  assert.equal(
    mod.formatOneRmTooltipText({ dateLabel: 'Nov 21', oneRmLbs: 171 }, 'lbs'),
    'Nov 21: 171 lbs'
  );
  assert.equal(
    mod.formatOneRmTooltipText({ dateLabel: 'Nov 21', oneRmLbs: 171 }, 'kg'),
    'Nov 21: 78 kg'
  );

  // 3. Multi-Week Real Progression Extraction (Returns Exact Logged Sessions Only)
  const logs = {
    w1_0_mon_bench_1: { weight: '130', reps: '8', done: true, unit: 'lbs', loggedAt: '2026-11-07T15:00:00.000Z' },
    w2_0_mon_bench_1: { weight: '135', reps: '8', done: true, unit: 'lbs', loggedAt: '2026-11-14T15:00:00.000Z' },
    w3_0_mon_bench_1: { weight: '140', reps: '8', done: true, unit: 'lbs', loggedAt: '2026-11-21T15:00:00.000Z' },
    w1_1_tue_squat_1: { weight: '185', reps: '5', done: true, unit: 'lbs', loggedAt: '2026-11-21T15:00:00.000Z' },
    w1_4_sat_deadlift_1: { weight: '225', reps: '5', done: true, unit: 'lbs', loggedAt: '2026-11-14T15:00:00.000Z' },
    w2_4_sat_deadlift_1: { weight: '245', reps: '5', done: true, unit: 'lbs', loggedAt: '2026-11-21T15:00:00.000Z' }
  };
  const refDate = new Date('2026-11-21T12:00:00.000Z');

  const benchSeries = mod.extractOneRmProgressionSeries('bench', logs, undefined, refDate);
  assert.equal(benchSeries.length, 3);
  assert.equal(benchSeries[0].dateLabel, 'Nov 7');
  assert.equal(benchSeries[0].oneRmLbs, 165);
  assert.equal(benchSeries[1].dateLabel, 'Nov 14');
  assert.equal(benchSeries[1].oneRmLbs, 171);
  assert.equal(benchSeries[2].dateLabel, 'Nov 21');
  assert.equal(benchSeries[2].oneRmLbs, 177);
  assert.ok(benchSeries.every((p) => p.isLoggedSession));

  // 4. Single-Session Baseline Lead-In (Anchors Exact Logged 1RM at End)
  const squatSeries = mod.extractOneRmProgressionSeries('squat', logs, undefined, refDate);
  assert.equal(squatSeries.length, 4);
  assert.equal(squatSeries[3].oneRmLbs, 216); // 185 * (1 + 5/30) = 215.83 -> 216
  assert.equal(squatSeries[3].isLoggedSession, true);
  assert.ok(squatSeries[0].oneRmLbs < squatSeries[3].oneRmLbs);

  // 5. Deadlift Multi-Session Series
  const deadliftSeries = mod.extractOneRmProgressionSeries('deadlift', logs, undefined, refDate);
  assert.equal(deadliftSeries.length, 2);
  assert.equal(deadliftSeries[0].oneRmLbs, 263);
  assert.equal(deadliftSeries[1].oneRmLbs, 286);

  // 6. Empty Logs Return Empty Array
  assert.deepEqual(mod.extractOneRmProgressionSeries('bench', {}, undefined, refDate), []);
});

test('Subtest 45: Upgrade 22 — Week Continuity Engine (Exact Plan Deep-Copy vs Build New Plan) & Forced First-Time Onboarding', async () => {
  const mod = await import('./workoutLogic.ts');

  // 1. Exact ELI12 Modal Copy
  assert.equal(
    mod.WEEK_CONTINUITY_MODAL_COPY.title,
    'Week Complete! What do you want to do for next week?'
  );
  assert.equal(mod.WEEK_CONTINUITY_MODAL_COPY.keepSameButtonLabel, '🔁 Keep the Same Plan');
  assert.equal(mod.WEEK_CONTINUITY_MODAL_COPY.buildNewButtonLabel, '✨ Build a New Plan');

  // 2. Deep-Copy Custom Wizard Week Schedule Identically (Zero Shared References)
  const week2CustomSchedule = [
    {
      daySub: 'Push 1',
      title: 'Day 1 • Push / Chest (EASY)',
      isWizardGenerated: true,
      exercises: [
        { id: 'wiz_easy_chest_d1_e1', name: 'Seated Chest Press Machine', sets: 3, reps: '10-12' },
        { id: 'wiz_easy_chest_d1_e2', name: 'Pec Deck Machine Fly', sets: 3, reps: '10-12' }
      ]
    },
    1,
    2,
    3,
    4,
    5,
    6
  ];
  const week3Cloned = mod.cloneWeekScheduleIdentically(week2CustomSchedule);
  assert.deepEqual(week3Cloned, week2CustomSchedule);
  assert.notEqual(week3Cloned[0], week2CustomSchedule[0]);
  // Mutating week3 must never alter week2
  (week3Cloned[0] as any).exercises[0].reps = '6-8';
  assert.equal((week2CustomSchedule[0] as any).exercises[0].reps, '10-12');

  // 3. Copy Per-Day Custom Added Exercises from Week 2 to Week 3
  const customAdded = {
    w2_d0: [{ id: 'custom_1', name: 'Face Pulls', sets: 3, reps: '15' }],
    w2_d2: [{ id: 'custom_2', name: 'Calf Raise', sets: 4, reps: '12' }]
  };
  const copiedCustom = mod.copyWeekCustomExercises(customAdded, 2, 3);
  assert.deepEqual(copiedCustom.w3_d0, customAdded.w2_d0);
  assert.deepEqual(copiedCustom.w3_d2, customAdded.w2_d2);
  assert.notEqual(copiedCustom.w3_d0[0], customAdded.w2_d0[0]);

  // 4. Continuity Action Resolution (Keep Same vs Build New)
  const keepSame = mod.resolveWeekContinuityChoice('keep_same', 2);
  assert.equal(keepSame.fromWeek, 2);
  assert.equal(keepSame.nextWeek, 3);
  assert.equal(keepSame.copyScheduleIdentically, true);
  assert.equal(keepSame.openSetupWizard, false);

  const buildNew = mod.resolveWeekContinuityChoice('build_new', 2);
  assert.equal(buildNew.fromWeek, 2);
  assert.equal(buildNew.nextWeek, 3);
  assert.equal(buildNew.copyScheduleIdentically, false);
  assert.equal(buildNew.openSetupWizard, true);

  // 5. Forced First-Time Onboarding Gate
  assert.equal(mod.shouldForceFirstTimeOnboarding({ userHasCompletedOnboarding: false, hasCompletedFirstSetup: false }, ''), true);
  assert.equal(mod.shouldForceFirstTimeOnboarding({ userHasCompletedOnboarding: true, hasCompletedFirstSetup: false }, ''), false);
  assert.equal(mod.shouldForceFirstTimeOnboarding({ userHasCompletedOnboarding: false, hasCompletedFirstSetup: true }, ''), false);
  assert.equal(mod.shouldForceFirstTimeOnboarding({ userHasCompletedOnboarding: false, hasCompletedFirstSetup: false }, '?autostart=1'), false);
});

test('Subtest 46: Upgrade 23 — Sync Week Checkmark Reset (0%), Last-Set Historical Pre-Fill (62.5 lbs across Sets 1-3) & Single-Day Sync', async () => {
  const mod = await import('./workoutLogic.ts');

  // 1. Deep-Clone Schedule With Forced Checkmark Reset (isLogged = false, done = false)
  const completedWeek2Schedule = [
    {
      daySub: 'Push 1',
      title: 'Day 1 • Push',
      isLogged: true,
      completed: true,
      exercises: [
        {
          id: 'cable_ab_crunch',
          name: 'Cable Abdominal Crunch',
          sets: 3,
          reps: '12',
          isLogged: true,
          done: true,
          setsList: [
            { setIdx: 1, weight: '55', reps: '12', isLogged: true, done: true },
            { setIdx: 2, weight: '57.5', reps: '12', isLogged: true, done: true },
            { setIdx: 3, weight: '62.5', reps: '12', isLogged: true, done: true }
          ]
        }
      ]
    },
    1,
    2,
    3,
    4,
    5,
    6
  ];

  const week3Clean = mod.cloneScheduleWithResetCheckmarks(completedWeek2Schedule);
  assert.equal((week3Clean[0] as any).isLogged, false);
  assert.equal((week3Clean[0] as any).completed, false);
  assert.equal((week3Clean[0] as any).exercises[0].isLogged, false);
  assert.equal((week3Clean[0] as any).exercises[0].done, false);
  assert.ok((week3Clean[0] as any).exercises[0].setsList.every((st: any) => st.isLogged === false && st.done === false));
  // Original Week 2 stays untouched (no shared references)
  assert.equal((completedWeek2Schedule[0] as any).exercises[0].isLogged, true);

  // 2. Wipe Week Checkmarks From Logs (Resets Target Week to 0% Without Touching Week 2)
  const logsBefore = {
    w2_0_cable_ab_crunch_1: { weight: '55', reps: '12', done: true, isLogged: true, unit: 'lbs' },
    w2_0_cable_ab_crunch_3: { weight: '62.5', reps: '12', done: true, isLogged: true, unit: 'lbs' },
    w3_0_cable_ab_crunch_1: { weight: '55', reps: '12', done: true, isLogged: true, unit: 'lbs' }
  };
  const pullupBefore = {
    w2_day_1_set_1: { reps: '8', done: true, isLogged: true },
    w3_day_1_set_1: { reps: '8', done: true, isLogged: true }
  };
  const wiped = mod.wipeWeekCheckmarksFromLogs(logsBefore, pullupBefore, 3);
  assert.equal(wiped.workoutLogs.w2_0_cable_ab_crunch_3.done, true);
  assert.equal(wiped.workoutLogs.w3_0_cable_ab_crunch_1.done, false);
  assert.equal(wiped.workoutLogs.w3_0_cable_ab_crunch_1.isLogged, false);
  assert.equal(wiped.pullupLogs.w2_day_1_set_1.done, true);
  assert.equal(wiped.pullupLogs.w3_day_1_set_1.done, false);

  // 3. Historical Pre-Fill: Use Weight From LAST Set of Most Recent Session for Set 1, Set 2 & Set 3
  const historySessions = [
    {
      week: 1,
      dayIdx: 4,
      timestamp: 1000,
      sets: [
        { setIdx: 1, weight: '45', reps: '12', done: true },
        { setIdx: 2, weight: '50', reps: '12', done: true },
        { setIdx: 3, weight: '52.5', reps: '12', done: true }
      ]
    },
    {
      week: 2,
      dayIdx: 6,
      timestamp: 2000,
      sets: [
        { setIdx: 1, weight: '55', reps: '12', done: true },
        { setIdx: 2, weight: '57.5', reps: '12', done: true },
        { setIdx: 3, weight: '62.5', reps: '12', done: true }
      ]
    },
    {
      // Unlogged placeholder in Week 3 Day 1 must be ignored
      week: 3,
      dayIdx: 1,
      timestamp: 3000,
      sets: [{ setIdx: 1, weight: '999', reps: '12', done: false, isLogged: false }]
    }
  ];

  const lastSet = mod.getLastSetWeightFromMostRecentSession(historySessions, 3, 0);
  assert.ok(lastSet);
  assert.equal(lastSet.weight, '62.5');
  assert.equal(lastSet.reps, '12');
  assert.equal(lastSet.sourceLabel, 'Wk 2 • Day 7');

  const prefilledSets = mod.buildPrefilledUnloggedSetsFromHistory(3, lastSet, '50', '12', 'lbs');
  assert.equal(prefilledSets.length, 3);
  assert.deepEqual(
    prefilledSets.map((s) => ({ setIdx: s.setIdx, weight: s.weight, done: s.done, isLogged: s.isLogged })),
    [
      { setIdx: 1, weight: '62.5', done: false, isLogged: false },
      { setIdx: 2, weight: '62.5', done: false, isLogged: false },
      { setIdx: 3, weight: '62.5', done: false, isLogged: false }
    ]
  );

  // 4. Single-Day Sync: Overwrites ONLY Current Week Day 2 (dayIdx = 1) From Previous Week Day 2
  const prevWeekSched = [
    0,
    { daySub: 'Legs 2', title: 'Prev Week Day 2 Legs', isLogged: true, exercises: [{ id: 'tue_squat', name: 'Back Squat', sets: 3, reps: '8', isLogged: true, done: true }] },
    2,
    3,
    4,
    5,
    6
  ];
  const curWeekSched = [
    { daySub: 'Custom Day 1', title: 'Keep Me Untouched', exercises: [{ id: 'mon_bench', name: 'Bench', sets: 3, reps: '8' }] },
    5, // Day 2 is currently Rest
    2,
    3,
    4,
    5,
    6
  ];
  const syncedCurWeek = mod.copySingleDayScheduleFromPreviousWeek({
    prevWeekSchedule: prevWeekSched as any,
    currentWeekSchedule: curWeekSched as any,
    dayIdx: 1
  });
  assert.equal((syncedCurWeek[0] as any).title, 'Keep Me Untouched');
  assert.equal((syncedCurWeek[1] as any).title, 'Prev Week Day 2 Legs');
  assert.equal((syncedCurWeek[1] as any).isLogged, false);
  assert.equal((syncedCurWeek[1] as any).exercises[0].isLogged, false);
  assert.equal((syncedCurWeek[1] as any).exercises[0].done, false);
  assert.equal(syncedCurWeek[2], 2);
});

test('47. Upgrade 24: Sync Data Protection & Undo, Single-Source Volume Math, Stepper Caps & AI Whitelist', async () => {
  const mod = await import('./workoutLogic');
  // 1. Smart Warning scanner detects 4 logged sets on Week 3 Day 5 (dayIdx = 4)
  const w3Logs: Record<string, any> = {
    w3_4_barbell_bench_1: { weight: '135', reps: '10', done: true, isLogged: true, unit: 'lbs' },
    w3_4_barbell_bench_2: { weight: '135', reps: '10', done: true, isLogged: true, unit: 'lbs' },
    w3_4_barbell_bench_3: { weight: '145', reps: '8', done: true, isLogged: true, unit: 'lbs' },
    w3_4_barbell_bench_4: { weight: '145', reps: '8', done: true, isLogged: true, unit: 'lbs' },
    w4_0_barbell_bench_1: { weight: '145', reps: '8', done: false, isLogged: false, unit: 'lbs' }
  };
  const scanW3 = mod.hasLoggedSetsInWeek(w3Logs, {}, 3);
  assert.equal(scanW3.hasLoggedData, true);
  assert.equal(scanW3.loggedSetCount, 4);

  const scanW4 = mod.hasLoggedSetsInWeek(w3Logs, {}, 4);
  assert.equal(scanW4.hasLoggedData, false);
  assert.equal(scanW4.loggedSetCount, 0);

  // 2. Undo Snapshot captures & restores Week 3 Day 5 logs after overwrite
  const liveState: Record<string, any> = {
    selectedWeek: 3,
    currentWeek: 3,
    selectedDayIndex: 4,
    maxUnlockedWeek: 3,
    completedWeeks: { 1: true, 2: true },
    customDayScheduleByWeek: { '3': [0, 1, 2, 3, 4, 5, 6] },
    weeklyRestDays: { '3': [5, 6] },
    manualScheduleOverrideByWeek: { '3': true },
    customExercisesByWeek: {},
    workoutLogs: JSON.parse(JSON.stringify(w3Logs)),
    pullupLogs: {},
    warmupLogs: {},
    cardioLogs: {}
  };
  const backup = mod.createSyncUndoSnapshot(liveState, {
    targetWeek: 3,
    sourceWeek: 2,
    mode: 'resync_week'
  });
  // Simulate destructive overwrite of Week 3
  liveState.workoutLogs = { w3_4_barbell_bench_1: { weight: '135', reps: '10', done: false, isLogged: false } };
  assert.equal(mod.hasLoggedSetsInWeek(liveState.workoutLogs, {}, 3).loggedSetCount, 0);

  // Tap [ Undo Mistake ] -> restores all 4 sets instantaneously
  const restored = mod.restoreSyncUndoSnapshot(liveState, backup);
  assert.equal(restored, true);
  assert.equal(mod.hasLoggedSetsInWeek(liveState.workoutLogs, {}, 3).loggedSetCount, 4);
  assert.equal(liveState.workoutLogs.w3_4_barbell_bench_4.weight, '145');

  // 3. Single Source of Truth Dashboard Math tallies exact 4 sets & tonnage on Week 3 Day 5
  const series = mod.computeUnifiedWeeklyVolumeSeries({
    workoutLogs: w3Logs,
    completedWeeks: { 1: true, 2: true },
    maxWeek: 4
  });
  assert.equal(series.length, 4);
  const w3Row = series[2];
  assert.equal(w3Row.label, 'W3');
  assert.equal(w3Row.setsCount, 4);
  assert.equal(w3Row.daySetCounts[4], 4);
  // 135*10 + 135*10 + 145*8 + 145*8 = 1350 + 1350 + 1160 + 1160 = 5020 lbs
  assert.equal(w3Row.tonnageLbs, 5020);
  assert.equal(w3Row.isCompleted, true);
  assert.equal(series[3].isCompleted, false);
  assert.equal(series[3].tonnageLbs, 0);

  // Verify ELI12 Tooltip formatting
  assert.equal(
    mod.formatWeeklyVolumeTooltipText(3, 49427),
    'Week 3 Volume: 49,427 lbs. Tapped to view full Week 3 logs.'
  );

  // 4. Stepper Guardrails cap Weight at 999 lbs and Reps at 100
  const wOver = mod.clampWeightInputValue('1450');
  assert.equal(wOver.value, '999');
  assert.equal(wOver.numeric, 999);
  assert.equal(wOver.wasClamped, true);

  const wOk = mod.clampWeightInputValue('225.5');
  assert.equal(wOk.value, '225.5');
  assert.equal(wOk.wasClamped, false);

  const rOver = mod.clampRepsInputValue('250');
  assert.equal(rOver.value, '100');
  assert.equal(rOver.numeric, 100);
  assert.equal(rOver.wasClamped, true);

  const rOk = mod.clampRepsInputValue('12');
  assert.equal(rOk.value, '12');
  assert.equal(rOk.wasClamped, false);

  // 5. AI Whitelist Enforcer exact rule text
  assert.equal(
    mod.AI_EXERCISE_WHITELIST_RULE,
    'You MUST only select exercises from standard, scientifically validated movements (e.g., Barbell Squat, Cable Crunch). Do not invent names.'
  );
});

test('Subtest 48: Data Protection & Undo Engine — Smart Warning Detector, Full-State Deep undoBackup, 10s Undo Window & 5s Delayed Supabase Push', async () => {
  const mod = await import('./workoutLogic');

  // 1. Exact constants & warning copy
  assert.equal(mod.SYNC_UNDO_TOAST_DURATION_MS, 10000);
  assert.equal(mod.SYNC_SUPABASE_DELAY_MS, 5000);
  assert.equal(
    mod.SYNC_OVERWRITE_WARNING_TEXT,
    'Warning: You already have data for this week. Overwriting will delete it. Proceed?'
  );

  // 2. Smart Warning detector: detects logged sets AND user-entered unlogged sets, ignores untouched autoPrefilled entries
  const logs: Record<string, any> = {
    w2_0_mon_bench_1: { weight: '135', reps: '10', done: true, isLogged: true },
    w3_4_fri_squat_1: { weight: '185', reps: '8', done: false, isLogged: false }, // user-entered!
    w4_0_mon_bench_1: { weight: '135', reps: '10', done: false, isLogged: false, autoPrefilled: true }
  };
  const scanW2 = mod.hasWeekWorkoutData(logs, {}, 2);
  assert.equal(scanW2.hasData, true);
  assert.equal(scanW2.hasLoggedData, true);
  assert.equal(scanW2.loggedSetCount, 1);

  const scanW3 = mod.hasWeekWorkoutData(logs, {}, 3);
  assert.equal(scanW3.hasData, true);
  assert.equal(scanW3.enteredEntryCount, 1);

  const scanW4 = mod.hasWeekWorkoutData(logs, {}, 4);
  assert.equal(scanW4.hasData, false);
  assert.equal(scanW4.enteredEntryCount, 0);

  // 3. Full-state deep copy snapshot into state.undoBackup & restore
  const liveState: Record<string, any> = {
    selectedWeek: 3,
    currentWeek: 3,
    workoutLogs: {
      w3_4_fri_bench_1: { weight: '145', reps: '8', done: true, isLogged: true }
    },
    customDayScheduleByWeek: { '3': [0, 1, 2, 3, 4, 5, 6] },
    nestedPrefs: { theme: 'dark', tags: ['a', 'b'] },
    undoBackup: { stale: true }
  };

  const backup = mod.createFullStateUndoBackup(liveState);
  assert.equal('undoBackup' in backup, false, 'undoBackup must never be nested inside itself');

  // Save to state.undoBackup and verify serialization excludes undoBackup
  liveState.undoBackup = backup;
  const serialized = mod.serializeStateForPersistence(liveState);
  assert.equal(serialized.includes('"undoBackup"'), false);

  // Simulate destructive overwrite + extra key added after overwrite
  liveState.workoutLogs = {};
  liveState.nestedPrefs.tags.push('overwritten');
  liveState.tempAfterOverwrite = 'remove_me';
  assert.equal(backup.workoutLogs.w3_4_fri_bench_1.weight, '145', 'backup must be a true deep copy');
  assert.deepEqual(backup.nestedPrefs.tags, ['a', 'b']);

  // Restore from state.undoBackup
  const restored = mod.restoreFullStateUndoBackup(liveState, liveState.undoBackup);
  assert.equal(restored, true);
  assert.equal(liveState.undoBackup, null);
  assert.equal(liveState.workoutLogs.w3_4_fri_bench_1.weight, '145');
  assert.deepEqual(liveState.nestedPrefs.tags, ['a', 'b']);
  assert.equal('tempAfterOverwrite' in liveState, false);

  // 4. 5-Second Delayed Supabase Push Controller
  const pushedReasons: string[] = [];
  let scheduledFn: (() => void) | null = null;
  let scheduledMs = 0;
  let clearedCount = 0;
  let nextHandle = 1;

  const ctrl = mod.createDelayedCloudPushController({
    delayMs: mod.SYNC_SUPABASE_DELAY_MS,
    pushFn: (reason) => pushedReasons.push(reason),
    setTimer: (fn, ms) => {
      scheduledFn = fn;
      scheduledMs = ms;
      return nextHandle++;
    },
    clearTimer: () => {
      scheduledFn = null;
      clearedCount++;
    }
  });

  // Case A: Overwrite happens -> NOT pushed immediately, waits 5000ms
  ctrl.scheduleDelayedPush();
  assert.equal(pushedReasons.length, 0, 'must NOT push destructive overwrite immediately');
  assert.equal(scheduledMs, 5000);
  assert.equal(ctrl.isWithinDelayWindow(), true);

  // User clicks UNDO before 5 seconds -> pending destructive push cancelled, restored state pushed immediately
  ctrl.flushUndoRestorePush();
  assert.equal(clearedCount, 1);
  assert.equal(ctrl.isWithinDelayWindow(), false);
  assert.deepEqual(pushedReasons, ['undo_restore']);
  assert.equal(scheduledFn, null);

  // Case B: Overwrite happens and 5 seconds pass -> delayed_sync pushes to Supabase
  ctrl.scheduleDelayedPush();
  assert.equal(pushedReasons.length, 1);
  assert.ok(scheduledFn);
  (scheduledFn as () => void)();
  assert.equal(ctrl.isWithinDelayWindow(), false);
  assert.deepEqual(pushedReasons, ['undo_restore', 'delayed_sync']);

  // User clicks UNDO at second 7 (still inside 10s Undo window) -> immediately pushes restored state to Supabase
  ctrl.flushUndoRestorePush();
  assert.deepEqual(pushedReasons, ['undo_restore', 'delayed_sync', 'undo_restore']);
});

test('Subtest 49: Exercise Grouping, Auto Supabase Sync with Undo Protection & Strict Setup Wizard Validation (Diet + Difficulty)', async () => {
  const wizMod = await import('./wizardValidation');
  const syncMod = await import('./workoutSyncEngine');

  // 1. Strict programWizardConfig validation
  const validRes = wizMod.validateProgramWizardConfig({
    daysPerWeek: 4,
    primaryFocus: 'strength',
    difficulty: 'easy',
    baseDiet: 'Vegan',
    intolerances: ['Nut-Free', 'Gluten-Free']
  });
  assert.equal(validRes.isValid, true);
  assert.equal(validRes.errors.length, 0);
  assert.equal(validRes.sanitizedConfig.daysPerWeek, 4);
  assert.equal(validRes.sanitizedConfig.difficulty, 'easy');
  assert.equal(validRes.sanitizedConfig.baseDiet, 'Vegan');
  assert.deepEqual(validRes.sanitizedConfig.intolerances, ['Nut-Free', 'Gluten-Free']);

  const invalidRes = wizMod.validateProgramWizardConfig({
    daysPerWeek: 9,
    primaryFocus: 'invalid_focus',
    difficulty: 'extreme',
    baseDiet: 'Carnivore',
    intolerances: ['Unknown']
  });
  assert.equal(invalidRes.isValid, false);
  assert.ok(invalidRes.errors.length >= 4);
  assert.equal(invalidRes.sanitizedConfig.daysPerWeek, 7);
  assert.equal(invalidRes.sanitizedConfig.difficulty, 'medium');
  assert.equal(invalidRes.sanitizedConfig.baseDiet, 'Vegan');

  // 2. Strict Diet & Intolerance Filter (Vegan MUST reject animal products while safely allowing plant milks & peanut butter)
  const sampleRecipes = [
    { id: 'r1', title: 'Crispy Tofu & Jasmine Rice Bowl', ingredients: ['Extra-Firm Tofu', 'Jasmine Rice', 'Soy Milk', 'Broccoli'] },
    { id: 'r2', title: 'Grilled Chicken Breast & Rice', ingredients: ['Chicken Breast', 'White Rice', 'Olive Oil'] },
    { id: 'r3', title: 'Whey Protein Banana Shake', ingredients: ['Whey Protein Powder', 'Whole Milk', 'Banana'] },
    { id: 'r4', title: 'Overnight Pea Protein Oats', ingredients: ['Rolled Oats', 'Pea Protein', 'Oat Milk', 'Peanut Butter'] },
    { id: 'r5', title: 'Scrambled Eggs & Spinach', ingredients: ['3 Whole Eggs', 'Spinach', 'Avocado Oil'] },
    { id: 'r6', title: 'Honey Glazed Salmon', ingredients: ['Salmon Fillet', 'Honey', 'Asparagus'] }
  ];

  const veganOnly = wizMod.filterRecipesByDietAndIntolerances(sampleRecipes, 'Vegan', []);
  assert.deepEqual(veganOnly.accepted.map((r) => r.id), ['r1', 'r4']);
  assert.equal(veganOnly.rejected.length, 4);

  const veganNutFree = wizMod.filterRecipesByDietAndIntolerances(sampleRecipes, 'Vegan', ['Nut-Free']);
  assert.deepEqual(veganNutFree.accepted.map((r) => r.id), ['r1']);

  const vegetarianOnly = wizMod.filterRecipesByDietAndIntolerances(sampleRecipes, 'Vegetarian', []);
  assert.deepEqual(vegetarianOnly.accepted.map((r) => r.id), ['r1', 'r3', 'r4', 'r5']);

  const ketoOnly = wizMod.filterRecipesByDietAndIntolerances(sampleRecipes, 'Keto', []);
  assert.deepEqual(ketoOnly.accepted.map((r) => r.id), ['r5']);

  assert.equal(
    wizMod.isRecipeAllowedForDiet({ title: 'Plant-Based Oat Milk & Vegan Cheese Wrap', ingredients: ['Oat Milk', 'Vegan Cheese'] }, 'Vegan', []).allowed,
    true
  );
  const yogurtVerdict = wizMod.isRecipeAllowedForDiet({ title: 'Greek Yogurt Parfait with Honey', ingredients: ['Greek Yogurt', 'Honey'] }, 'Vegan', []);
  assert.equal(yogurtVerdict.allowed, false);
  assert.ok(yogurtVerdict.reason.includes('Vegan'));

  // 3. Exercise Display Organization (Weightlifting vs Bodyweight vs Cardio)
  const mixedExercises = [
    { id: 'mon_bench', name: 'Barbell Bench Press', sets: 4, reps: '6-8' },
    { id: 'cable_ab_crunch', name: 'Daily Cable Abdominal Crunch', sets: 3, reps: '12-15' },
    { id: 'day1_pullups', name: 'Pull-Ups (Bodyweight)', sets: 5, reps: 'Max', isBodyweightRepsOnly: true },
    { id: 'tue_side_plank', name: 'Side Plank Hold', sets: 3, reps: '30s', isTimedHold: true },
    { id: 'cardio_bike', name: 'Outdoor Biking', sets: 1, reps: 'Cardio', isCardio: true }
  ];
  const grouped = wizMod.groupExercisesByCategory(mixedExercises);
  assert.deepEqual(grouped.weightlifting.map((e) => e.id), ['mon_bench', 'cable_ab_crunch']);
  assert.deepEqual(grouped.bodyweight.map((e) => e.id), ['day1_pullups', 'tue_side_plank']);
  assert.deepEqual(grouped.cardio.map((e) => e.id), ['cardio_bike']);

  // 4. Difficulty Enforcer (Easy = machine/cable & <= 3 sets; Hard = barbell & 4-5 sets)
  const rawWeek: any[] = [
    {
      daySub: 'Lower 1',
      exercises: [
        { id: 'e1', name: 'Barbell Back Squat', sets: 5, reps: '5-8', restSec: 150, equipType: 'barbell' },
        { id: 'e2', name: 'Barbell Bench Press', sets: 5, reps: '6-8', restSec: 120, equipType: 'barbell' }
      ]
    },
    5,
    6
  ];
  const easyWeek = wizMod.enforceDifficultyOnRoutine(rawWeek, 'easy') as any[];
  assert.equal(easyWeek[0].exercises[0].name, 'Leg Press Machine');
  assert.equal(easyWeek[0].exercises[0].sets, 3);
  assert.equal(easyWeek[0].exercises[1].name, 'Seated Chest Press Machine');
  assert.equal(easyWeek[0].exercises[1].sets, 3);

  const hardWeek = wizMod.enforceDifficultyOnRoutine(
    [{ daySub: 'Upper 1', exercises: [{ id: 'e1', name: 'Leg Press Machine', sets: 2, reps: '12', restSec: 60, equipType: 'machine' }] }],
    'hard'
  ) as any[];
  assert.equal(hardWeek[0].exercises[0].name, 'Barbell Back Squat');
  assert.equal(hardWeek[0].exercises[0].sets, 4);

  // 5. Automatic Supabase Sync Engine integrated with Data Protection & Undo Engine
  const postedCalls: Array<{ url: string; reason: string; body: string }> = [];
  let stateRef: Record<string, any> = {
    workoutLogs: { w1_0_mon_bench_1: { weight: '135', reps: '8', done: true } },
    pullupLogs: {},
    cardioLogs: {},
    undoBackup: { shouldBeStripped: true }
  };

  let pendingTimerFn: (() => void) | null = null;
  let timerCount = 0;

  const engine = syncMod.createAutoSupabaseSyncEngine({
    getState: () => stateRef,
    getEndpoint: () => '/api/state?email=athlete%40example.com',
    fetchImpl: async (url, init) => {
      postedCalls.push({ url, reason: 'http_post', body: init.body });
      return {
        ok: true,
        status: 200,
        json: async () => ({ configured: true, saved: true })
      };
    },
    setTimer: (fn) => {
      pendingTimerFn = fn;
      return ++timerCount;
    },
    clearTimer: () => {
      pendingTimerFn = null;
    }
  });

  // Trigger automatic sync when a set is logged (no manual button needed!)
  const setSyncRes = await engine.autoSyncWorkoutToSupabase('set_logged');
  assert.equal(setSyncRes.synced, true);
  assert.equal(postedCalls.length, 1);
  assert.equal(postedCalls[0].body.includes('"undoBackup"'), false);

  // Schedule a destructive overwrite (5-second Undo protection window active)
  engine.scheduleDestructiveOverwritePush(5000);
  assert.equal(engine.isUndoProtectionWindowActive(), true);

  // During the 5s Undo window, passive set/workout auto-sync MUST be paused to prevent premature destructive push
  const blockedRes = await engine.autoSyncWorkoutToSupabase('workout_finished');
  assert.equal(blockedRes.synced, false);
  assert.equal(blockedRes.blockedByUndoGuard, true);
  assert.equal(postedCalls.length, 1);

  // Clicking UNDO flushes restored state immediately and cancels delayed destructive timer
  const restoreRes = await engine.flushUndoRestorePush();
  assert.equal(restoreRes.synced, true);
  assert.equal(engine.isUndoProtectionWindowActive(), false);
  assert.equal(postedCalls.length, 2);

  // Empty local state cannot accidentally wipe a known populated cloud record on passive auto-sync
  stateRef = { workoutLogs: {}, pullupLogs: {}, cardioLogs: {} };
  const wipeGuardRes = await engine.autoSyncWorkoutToSupabase('set_logged');
  assert.equal(wipeGuardRes.synced, false);
  assert.equal(wipeGuardRes.blockedByEmptyStateGuard, true);
  assert.equal(postedCalls.length, 2);
});

test('Subtest 50: Real Username Display, Single-Day Reset Isolation, Biking Rename & Cardio Zone Presets', async () => {
  const {
    STANDARD_CARDIO_SESSIONS,
    clearActiveDayWorkoutData,
    isBikingExercise,
    normalizeCardioExerciseName,
    resolveDisplayUsername
  } = await import('./wizardValidation');

  // 1. Real username in header (never show "Google" or "Apple")
  assert.equal(
    resolveDisplayUsername({ name: 'Google', email: 'francois@gmail.com', authProvider: 'google_oauth' }),
    'François'
  );
  assert.equal(
    resolveDisplayUsername({ name: 'Google Athlete', email: 'alex.martin@gmail.com', authProvider: 'google_oauth' }),
    'Alex'
  );
  assert.equal(
    resolveDisplayUsername({ name: 'Apple', email: 'maya@icloud.com', authProvider: 'apple_oauth' }),
    'Maya'
  );
  assert.equal(
    resolveDisplayUsername({ name: 'François Dupont', email: 'f@example.com', authProvider: 'email_password' }),
    'François'
  );
  assert.equal(resolveDisplayUsername({ name: '', email: '' }), 'Sign In');

  // 2. Reset Day clears ONLY the active day (Day 5 = idx 4) and preserves all other days & weeks
  const mockState: Record<string, any> = {
    workoutLogs: {
      w1_0_bench_1: { weight: '135', reps: '10', done: true, isLogged: true },
      w1_4_squat_1: { weight: '185', reps: '8', done: true, isLogged: true },
      w1_4_squat_2: { weight: '185', reps: '8', done: true, isLogged: true },
      w2_4_squat_1: { weight: '190', reps: '8', done: true, isLogged: true }
    },
    pullupLogs: {
      w1_day_1_set_1: { reps: '8', done: true, isLogged: true },
      w1_day_5_set_1: { reps: '6', done: true, isLogged: true }
    },
    cardioLogs: {
      w1_d0_cardio_bike_0: { mode: 'manual', durationMins: 30, done: true },
      w1_d4_cardio_bike_4: { mode: 'manual', durationMins: 45, done: true }
    },
    warmupLogs: {
      w1_d0_wu_0: true,
      w1_d4_wu_0: true
    }
  };

  const resetRes = clearActiveDayWorkoutData(mockState, 1, 4, {
    exerciseIds: ['squat'],
    pullupDayNumber: 5
  });
  assert.equal(resetRes.week, 1);
  assert.equal(resetRes.dayIdx, 4);
  assert.equal(resetRes.clearedKeysCount, 5);
  // Day 5 (idx 4) in Week 1 is completely cleared
  assert.equal(mockState.workoutLogs.w1_4_squat_1, undefined);
  assert.equal(mockState.workoutLogs.w1_4_squat_2, undefined);
  assert.equal(mockState.pullupLogs.w1_day_5_set_1, undefined);
  assert.equal(mockState.cardioLogs.w1_d4_cardio_bike_4, undefined);
  assert.equal(mockState.warmupLogs.w1_d4_wu_0, undefined);
  // Day 1 (idx 0) in Week 1 and Day 5 in Week 2 remain 100% untouched
  assert.equal(mockState.workoutLogs.w1_0_bench_1.done, true);
  assert.equal(mockState.workoutLogs.w2_4_squat_1.done, true);
  assert.equal(mockState.pullupLogs.w1_day_1_set_1.done, true);
  assert.equal(mockState.cardioLogs.w1_d0_cardio_bike_0.done, true);
  assert.equal(mockState.warmupLogs.w1_d0_wu_0, true);

  // 3. Cardio Zone presets & Outdoor Biking -> Biking normalization
  assert.equal(normalizeCardioExerciseName('Outdoor Biking'), 'Biking');
  assert.equal(normalizeCardioExerciseName('Indoor Biking'), 'Biking');
  assert.equal(normalizeCardioExerciseName('Stairmaster'), 'Stairmaster');
  assert.equal(isBikingExercise({ name: 'Biking' }), true);
  assert.equal(isBikingExercise({ name: 'Treadmill' }), false);
  assert.deepEqual([...STANDARD_CARDIO_SESSIONS], [
    'Biking',
    'Treadmill',
    'Rowing Machine',
    'Elliptical',
    'Stairmaster'
  ]);
});

test('Subtest 51: Overhand Pull-Ups First Ordering, Single Source of Truth Cloud Hydration & Immediate Day-Reset Push', async () => {
  const {
    isOverhandPullUpsExercise,
    orderExercisesWithPullUpsFirst,
    groupExercisesByCategory
  } = await import('./wizardValidation');
  const {
    resolveSingleSourceOfTruthState,
    fetchLatestCloudStateAsSingleSourceOfTruth,
    createAutoSupabaseSyncEngine
  } = await import('./workoutSyncEngine');

  // 1. Task 1: Overhand Pull-Ups must render first immediately after Warm-Up (before Weightlifting)
  const rawDayExercises = [
    { id: 'barbell_bench', name: 'Barbell Bench Press', muscle: 'Chest' },
    { id: 'incline_db', name: 'Incline Dumbbell Press', muscle: 'Upper Chest' },
    { id: 'plank_hold', name: 'Forearm Plank Hold', muscle: 'Core' },
    { id: 'outdoor_bike', name: 'Outdoor Biking', muscle: 'Cardio' },
    { id: 'pullup_overhand', name: 'Overhand Pull-Ups (Max Effort)', muscle: 'Back & Lats' }
  ];

  assert.equal(isOverhandPullUpsExercise(rawDayExercises[4]), true);
  assert.equal(isOverhandPullUpsExercise(rawDayExercises[0]), false);

  const ordered = orderExercisesWithPullUpsFirst(rawDayExercises);
  assert.equal(ordered[0].id, 'pullup_overhand');
  assert.equal(ordered[1].id, 'barbell_bench');

  const grouped = groupExercisesByCategory(rawDayExercises);
  assert.equal(grouped.pullUpsLead.length, 1);
  assert.equal(grouped.pullUpsLead[0].id, 'pullup_overhand');
  assert.equal(grouped.weightlifting.length, 2);
  assert.equal(grouped.otherBodyweight.length, 1);
  assert.equal(grouped.otherBodyweight[0].id, 'plank_hold');
  assert.equal(grouped.cardio.length, 1);
  assert.equal(grouped.cardio[0].id, 'outdoor_bike');

  // 2. Task 2: Single Source of Truth resolves Supabase Week 3 over stale phone Week 1 localStorage
  const stalePhoneState = {
    selectedWeek: 1,
    maxUnlockedWeek: 1,
    updatedAt: '2026-11-20T08:00:00.000Z',
    workoutLogs: {
      w1_0_bench_1: { weight: '135', reps: '10', done: true }
    }
  };
  const remoteWeek3State = {
    selectedWeek: 3,
    maxUnlockedWeek: 3,
    updatedAt: '2026-11-22T14:30:00.000Z',
    workoutLogs: {
      w3_0_pullup_1: { weight: 'BW', reps: '8', done: true }
    }
  };

  const resolved = resolveSingleSourceOfTruthState(stalePhoneState, remoteWeek3State, {
    remoteUpdatedAt: '2026-11-22T14:30:00.000Z'
  });
  assert.equal(resolved.appliedRemote, true);
  assert.equal(resolved.state.selectedWeek, 3);
  assert.equal(resolved.state.maxUnlockedWeek, 3);
  assert.equal(resolved.state.workoutLogs.w1_0_bench_1, undefined); // Stale local logs are NOT resurrected
  assert.equal(resolved.state.workoutLogs.w3_0_pullup_1.reps, '8');

  // Test live fetch helper with mocked fetch + localStorage overwrite & cache: 'no-store'
  let capturedInit: RequestInit | undefined;
  let capturedUrl = '';
  const storageMap = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => { storageMap.set(k, v); }
  };

  const hydrated = await fetchLatestCloudStateAsSingleSourceOfTruth({
    endpoint: 'https://7am-gym-app.vercel.app/api/state?email=francois@example.com',
    localState: stalePhoneState,
    storageKey: 'gym_state_test',
    storage: mockStorage,
    fetchImpl: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        json: async () => ({
          configured: true,
          updatedAt: '2026-11-22T14:30:00.000Z',
          data: remoteWeek3State
        })
      } as Response;
    }
  });

  assert.equal(hydrated.appliedRemote, true);
  assert.equal(hydrated.state.selectedWeek, 3);
  assert.equal(capturedInit?.cache, 'no-store');
  assert.equal(capturedUrl.includes('&t='), true);
  assert.equal(JSON.parse(storageMap.get('gym_state_test') || '{}').selectedWeek, 3);

  // 3. Task 3: Explicit 'day_reset' immediately pushes empty/cleared day state to Supabase (no 5s delay, no empty-guard block)
  let currentAppState: Record<string, any> = {
    selectedWeek: 3,
    workoutLogs: {},
    pullupLogs: {},
    cardioLogs: {},
    warmupLogs: {},
    userProfile: { email: 'francois@example.com', name: 'François' }
  };
  const pushedPayloads: Array<{ url: string; body: any }> = [];

  const syncEngine = createAutoSupabaseSyncEngine({
    getEndpoint: () => 'https://7am-gym-app.vercel.app/api/state?email=francois@example.com',
    getState: () => currentAppState,
    setState: (next) => { currentAppState = next; },
    fetchImpl: async (url, init) => {
      pushedPayloads.push({
        url: String(url),
        body: JSON.parse(String(init?.body || '{}'))
      });
      return {
        ok: true,
        json: async () => ({ configured: true, saved: true })
      } as Response;
    }
  });

  const resetSyncRes = await syncEngine.autoSyncWorkoutToSupabase('day_reset');
  assert.equal(resetSyncRes.synced, true);
  assert.equal(resetSyncRes.reason, 'day_reset');
  assert.equal(resetSyncRes.blockedByEmptyStateGuard, false);
  assert.equal(pushedPayloads.length, 1);
  assert.equal(typeof pushedPayloads[0].body.updatedAt, 'string');
  assert.equal(Object.keys(pushedPayloads[0].body.workoutLogs).length, 0);
});

test('Subtest 52: Most Advanced Truth Engine (last_updated comparison) & Automatic Silent Background Sync for Sets, Checkboxes, and Timers', async () => {
  const {
    resolveSingleSourceOfTruthState,
    fetchLatestCloudStateAsSingleSourceOfTruth,
    createAutoSupabaseSyncEngine,
    getStateLastUpdatedIso,
    stampGymStateLastUpdated
  } = await import('./workoutSyncEngine');

  // 1. Task 1A: Cloud `last_updated` is newer than Local `last_updated` -> Cloud wins & overwrites localStorage
  const olderPhoneState = {
    selectedWeek: 1,
    maxUnlockedWeek: 1,
    last_updated: '2026-11-22T10:00:00.000Z',
    workoutLogs: { w1_0_bench_1: { weight: '135', reps: '10', done: true } }
  };
  const newerComputerCloudState = {
    selectedWeek: 3,
    maxUnlockedWeek: 3,
    last_updated: '2026-11-22T23:30:00.000Z',
    workoutLogs: { w3_0_pullup_1: { weight: 'BW', reps: '9', done: true } }
  };

  const cloudWins = resolveSingleSourceOfTruthState(olderPhoneState, newerComputerCloudState);
  assert.equal(cloudWins.winner, 'cloud');
  assert.equal(cloudWins.appliedRemote, true);
  assert.equal(cloudWins.shouldPushLocalToCloud, false);
  assert.equal(cloudWins.state?.selectedWeek, 3);
  assert.equal(cloudWins.state?.last_updated, '2026-11-22T23:30:00.000Z');

  // 2. Task 1B: Local `last_updated` is newer than Cloud `last_updated` -> Local wins & pushes up to Supabase
  const newerOfflinePhoneState = {
    selectedWeek: 4,
    maxUnlockedWeek: 4,
    last_updated: '2026-11-23T02:15:00.000Z',
    workoutLogs: { w4_0_pullup_1: { weight: 'BW', reps: '10', done: true } }
  };
  const localWins = resolveSingleSourceOfTruthState(newerOfflinePhoneState, newerComputerCloudState);
  assert.equal(localWins.winner, 'local');
  assert.equal(localWins.appliedRemote, false);
  assert.equal(localWins.shouldPushLocalToCloud, true);
  assert.equal(localWins.state?.selectedWeek, 4);

  const pushedUp: Array<{ method: string; body: any }> = [];
  const storageMap = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => { storageMap.set(k, v); }
  };

  const localNewerFetch = await fetchLatestCloudStateAsSingleSourceOfTruth({
    endpoint: 'https://7am-gym-app.vercel.app/api/state?email=francois@example.com',
    localState: newerOfflinePhoneState,
    storageKey: 'gym_state_truth_test',
    storage: mockStorage,
    pushLocalIfNewer: true,
    fetchImpl: async (_url, init) => {
      if (init?.method === 'POST') {
        pushedUp.push({ method: 'POST', body: JSON.parse(String(init.body || '{}')) });
        return { ok: true, json: async () => ({ configured: true, saved: true }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          configured: true,
          last_updated: '2026-11-22T23:30:00.000Z',
          data: newerComputerCloudState
        })
      } as Response;
    }
  });
  assert.equal(localNewerFetch.winner, 'local');
  assert.equal(localNewerFetch.shouldPushLocalToCloud, true);
  assert.equal(pushedUp.length, 1);
  assert.equal(pushedUp[0].body.selectedWeek, 4);
  assert.equal(pushedUp[0].body.last_updated, '2026-11-23T02:15:00.000Z');

  // 3. Task 1C: Fresh device with no `last_updated` -> Cloud wins unconditionally
  const freshDeviceState = { selectedWeek: 1, last_updated: null, workoutLogs: {} };
  const freshResolved = resolveSingleSourceOfTruthState(freshDeviceState, newerComputerCloudState);
  assert.equal(freshResolved.winner, 'cloud');
  assert.equal(freshResolved.appliedRemote, true);
  assert.equal(freshResolved.state?.selectedWeek, 3);

  // 4. Task 2: Silent background push attaches to Log Set, Checkbox Toggle, and Timer Adjustment
  let liveState: Record<string, any> = {
    selectedWeek: 3,
    timerSeconds: 90,
    warmupLogs: {},
    workoutLogs: { w3_0_pullup_1: { weight: 'BW', reps: '9', done: true } },
    last_updated: '2026-11-22T20:00:00.000Z'
  };
  const bgPushes: Array<{ body: any; keepalive: boolean | undefined }> = [];
  const bgEngine = createAutoSupabaseSyncEngine({
    getEndpoint: () => 'https://7am-gym-app.vercel.app/api/state?email=francois@example.com',
    getState: () => liveState,
    backgroundDebounceMs: 0,
    fetchImpl: async (_url, init) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      bgPushes.push({ body: parsed, keepalive: init?.keepalive });
      return {
        ok: true,
        json: async () => ({ configured: true, saved: true, last_updated: parsed.last_updated })
      } as Response;
    }
  });

  // 4a. Log Set
  liveState.workoutLogs.w3_0_pullup_2 = { weight: 'BW', reps: '10', done: true };
  const setRes = await bgEngine.pushGymStateInBackground('set_logged', true);
  assert.equal(setRes?.synced, true);
  assert.equal(setRes?.reason, 'set_logged');
  assert.equal(typeof setRes?.lastUpdated, 'string');

  // 4b. Checkbox Toggle
  liveState.warmupLogs.w3_d0_wu_0 = true;
  const cbRes = await bgEngine.pushGymStateInBackground('checkbox_toggled', true);
  assert.equal(cbRes?.synced, true);
  assert.equal(cbRes?.reason, 'checkbox_toggled');

  // 4c. Timer Adjustment
  liveState.timerSeconds = 105;
  const timerRes = await bgEngine.pushGymStateInBackground('timer_adjusted', true);
  assert.equal(timerRes?.synced, true);
  assert.equal(timerRes?.reason, 'timer_adjusted');

  assert.equal(bgPushes.length, 3);
  assert.equal(bgPushes[0].keepalive, true);
  assert.equal(bgPushes[1].body.warmupLogs.w3_d0_wu_0, true);
  assert.equal(bgPushes[2].body.timerSeconds, 105);
  assert.ok(getStateLastUpdatedIso(bgPushes[2].body));

  // 4d. Stamp helper keeps `last_updated` and `updatedAt` synchronized
  const stamped = stampGymStateLastUpdated({ selectedWeek: 3 }, '2026-11-23T05:00:00.000Z');
  assert.equal(stamped.last_updated, '2026-11-23T05:00:00.000Z');
  assert.equal(stamped.updatedAt, '2026-11-23T05:00:00.000Z');

  // 4e. Undo 5-second delay window still blocks passive background syncs until window clears
  bgEngine.scheduleDestructiveOverwritePush(5000);
  assert.equal(bgEngine.isUndoProtectionWindowActive(), true);
  const blockedRes = await bgEngine.pushGymStateInBackground('checkbox_toggled', true);
  assert.equal(blockedRes?.synced, false);
  assert.equal(blockedRes?.blockedByUndoGuard, true);
  bgEngine.cancelPendingDestructivePush();
});

test('Subtest 53: Linked Workout & Fuel Deletion, Muscle Fuel Reset, Account Deletion with Supabase DELETE & Strict Content Validation', async () => {
  const {
    WORKOUT_FUEL_RESET_PROMPT,
    DELETE_ACCOUNT_WARNING_PROMPT,
    validateDeletionTarget,
    clearActiveDayFuelData,
    clearActiveDayWorkoutAndOptionalFuel,
    deleteUserAccountFromSupabase,
    purgeDeletedAccountFromLocalState
  } = await import('./deletionValidation');

  // 1. Exact prompt copy checks
  assert.equal(
    WORKOUT_FUEL_RESET_PROMPT,
    'Would you like to delete your meal prep and fuel logs too?'
  );
  assert.equal(
    DELETE_ACCOUNT_WARNING_PROMPT,
    'Are you sure you want to delete the account?'
  );

  // 2. Task 3: Strict Content Validation rejects user ID mismatch, invalid IDs, and active day/week mismatch
  const mismatchedUser = validateDeletionTarget({
    scope: 'workout_and_fuel',
    activeUserId: 'francois@7amgym.app',
    targetUserId: 'other@example.com',
    activeWeek: 3,
    targetWeek: 3,
    activeDayIndex: 0,
    targetDayIndex: 0
  });
  assert.equal(mismatchedUser.valid, false);
  assert.equal(mismatchedUser.errorCode, 'USER_ID_MISMATCH');

  const placeholderUser = validateDeletionTarget({
    scope: 'account',
    activeUserId: 'google',
    targetUserId: 'google'
  });
  assert.equal(placeholderUser.valid, false);
  assert.equal(placeholderUser.errorCode, 'INVALID_ACTIVE_USER');

  const mismatchedDay = validateDeletionTarget({
    scope: 'fuel_only',
    activeUserId: 'francois@7amgym.app',
    targetUserId: 'francois@7amgym.app',
    activeWeek: 3,
    targetWeek: 3,
    activeDayIndex: 0,
    targetDayIndex: 2
  });
  assert.equal(mismatchedDay.valid, false);
  assert.equal(mismatchedDay.errorCode, 'ACTIVE_DAY_MISMATCH');

  const mismatchedWeek = validateDeletionTarget({
    scope: 'workout_only',
    activeUserId: 'francois@7amgym.app',
    targetUserId: 'francois@7amgym.app',
    activeWeek: 3,
    targetWeek: 2,
    activeDayIndex: 0,
    targetDayIndex: 0
  });
  assert.equal(mismatchedWeek.valid, false);
  assert.equal(mismatchedWeek.errorCode, 'ACTIVE_WEEK_MISMATCH');

  // 3. Task 1A: "Delete Workout Only" clears Day 1 workout logs while keeping Day 1 fuel & Day 2 data intact
  const makeTestState = () => ({
    userProfile: { email: 'francois@7amgym.app', name: 'François' },
    selectedWeek: 3,
    selectedDayIndex: 0,
    workoutLogs: {
      w3_0_pullup_1: { weight: 'BW', reps: '9', done: true },
      w3_1_squat_1: { weight: '185', reps: '8', done: true }
    },
    pullupLogs: {},
    cardioLogs: { w3_d0_bike_0: { done: true } },
    warmupLogs: { w3_d0_warmup_0: true },
    checkedMeals: {
      w3_d0_pre_shake: true,
      w3_d0_lunch: true,
      w3_d1_pre_shake: true
    },
    checkedMealIngredients: {
      w3_d0_pre_shake_pea: true,
      w3_d1_pre_shake_pea: true
    },
    flexMealOverridesByDay: {
      w3_d0: { lunch: { foodName: 'Tofu Wrap', calories: 600, protein: 35 } },
      w3_d1: { lunch: { foodName: 'Poke Bowl', calories: 650, protein: 40 } }
    },
    quickAddCaloriesByDay: {
      w3_d0: [{ id: 'qa1', label: 'Treat', calories: 200 }],
      w3_d1: [{ id: 'qa2', label: 'Drink', calories: 150 }]
    },
    waterIntakeLogs: { w3_d0: 1500, w3_d1: 2000 },
    waterLogsMl: { w3_d0: 1500, w3_d1: 2000 },
    accountsByEmail: {
      'francois@7amgym.app': {
        profile: { email: 'francois@7amgym.app', name: 'François' },
        snapshot: { checkedMeals: { w3_d0_pre_shake: true, w3_d1_pre_shake: true } }
      },
      'partner@7amgym.app': {
        profile: { email: 'partner@7amgym.app', name: 'Alex' }
      }
    },
    capturedLeads: [
      { email: 'francois@7amgym.app', name: 'François' },
      { email: 'partner@7amgym.app', name: 'Alex' }
    ]
  });

  const stateWorkoutOnly = makeTestState();
  const workoutOnlyRes = clearActiveDayWorkoutAndOptionalFuel(stateWorkoutOnly, {
    includeFuel: false,
    activeUserId: 'francois@7amgym.app',
    targetUserId: 'francois@7amgym.app',
    activeWeek: 3,
    targetWeek: 3,
    activeDayIndex: 0,
    targetDayIndex: 0
  });
  assert.equal(workoutOnlyRes.cleared, true);
  assert.equal(workoutOnlyRes.includeFuel, false);
  assert.equal(stateWorkoutOnly.workoutLogs.w3_0_pullup_1, undefined);
  assert.equal(stateWorkoutOnly.workoutLogs.w3_1_squat_1.done, true); // Day 2 preserved
  assert.equal(stateWorkoutOnly.checkedMeals.w3_d0_pre_shake, true); // Day 1 fuel preserved!
  assert.equal(stateWorkoutOnly.waterIntakeLogs.w3_d0, 1500);

  // 4. Task 1B: "Delete Workout and Fuel" clears BOTH Day 1 workout AND Day 1 fuel, preserving Day 2
  const stateWorkoutAndFuel = makeTestState();
  const bothRes = clearActiveDayWorkoutAndOptionalFuel(stateWorkoutAndFuel, {
    includeFuel: true,
    activeUserId: 'francois@7amgym.app',
    targetUserId: 'francois@7amgym.app',
    activeWeek: 3,
    targetWeek: 3,
    activeDayIndex: 0,
    targetDayIndex: 0
  });
  assert.equal(bothRes.cleared, true);
  assert.equal(bothRes.fuelResult?.cleared, true);
  assert.equal(stateWorkoutAndFuel.workoutLogs.w3_0_pullup_1, undefined);
  assert.equal(stateWorkoutAndFuel.checkedMeals.w3_d0_pre_shake, undefined);
  assert.equal(stateWorkoutAndFuel.checkedMealIngredients.w3_d0_pre_shake_pea, undefined);
  assert.equal(stateWorkoutAndFuel.flexMealOverridesByDay.w3_d0, undefined);
  assert.equal(stateWorkoutAndFuel.quickAddCaloriesByDay.w3_d0, undefined);
  assert.equal(stateWorkoutAndFuel.waterIntakeLogs.w3_d0, undefined);
  // Day 2 workout + Day 2 fuel stay completely safe
  assert.equal(stateWorkoutAndFuel.workoutLogs.w3_1_squat_1.done, true);
  assert.equal(stateWorkoutAndFuel.checkedMeals.w3_d1_pre_shake, true);
  assert.equal(stateWorkoutAndFuel.waterIntakeLogs.w3_d1, 2000);

  // 5. Task 1C: Standalone "Reset Fuel" clears Day 1 fuel ONLY and preserves Day 1 workout sets
  const stateFuelOnly = makeTestState();
  const fuelOnlyRes = clearActiveDayFuelData(stateFuelOnly, {
    activeUserId: 'francois@7amgym.app',
    targetUserId: 'francois@7amgym.app',
    activeWeek: 3,
    targetWeek: 3,
    activeDayIndex: 0,
    targetDayIndex: 0
  });
  assert.equal(fuelOnlyRes.cleared, true);
  assert.equal(stateFuelOnly.checkedMeals.w3_d0_pre_shake, undefined);
  assert.equal(stateFuelOnly.waterIntakeLogs.w3_d0, undefined);
  assert.equal(stateFuelOnly.workoutLogs.w3_0_pullup_1.done, true); // Day 1 workout preserved!
  assert.equal(stateFuelOnly.checkedMeals.w3_d1_pre_shake, true); // Day 2 fuel preserved!

  // 6. Task 2: Account Deletion validates user ID, sends DELETE to Supabase API, and purges only that user locally
  const deleteCalls: Array<{ url: string; method: string; body: any }> = [];
  const blockedDelete = await deleteUserAccountFromSupabase({
    endpoint: 'https://7am-gym-app.vercel.app/api/state',
    activeUserId: 'francois@7amgym.app',
    targetUserId: 'partner@7amgym.app',
    fetchImpl: async (url, init) => {
      deleteCalls.push({ url: String(url), method: String(init?.method), body: JSON.parse(String(init?.body || '{}')) });
      return { ok: true, json: async () => ({ configured: true, deleted: true }) } as Response;
    }
  });
  assert.equal(blockedDelete.deleted, false);
  assert.equal(deleteCalls.length, 0); // Strict validation stopped cross-account deletion before any network call!

  const validDelete = await deleteUserAccountFromSupabase({
    endpoint: 'https://7am-gym-app.vercel.app/api/state',
    activeUserId: 'francois@7amgym.app',
    targetUserId: 'francois@7amgym.app',
    fetchImpl: async (url, init) => {
      deleteCalls.push({ url: String(url), method: String(init?.method), body: JSON.parse(String(init?.body || '{}')) });
      return { ok: true, json: async () => ({ configured: true, deleted: true, accountId: 'user_francois@7amgym.app' }) } as Response;
    }
  });
  assert.equal(validDelete.deleted, true);
  assert.equal(validDelete.remoteDeleted, true);
  assert.equal(validDelete.accountId, 'user_francois@7amgym.app');
  assert.equal(deleteCalls.length, 1);
  assert.equal(deleteCalls[0].method, 'DELETE');
  assert.equal(deleteCalls[0].url.includes('email=francois%407amgym.app'), true);

  const stateToPurge = makeTestState();
  const purged = purgeDeletedAccountFromLocalState(stateToPurge, 'francois@7amgym.app');
  assert.equal(purged, true);
  assert.equal(stateToPurge.userProfile.email, '');
  assert.equal(stateToPurge.accountsByEmail['francois@7amgym.app'], undefined);
  assert.equal(stateToPurge.accountsByEmail['partner@7amgym.app'].profile.name, 'Alex'); // Other device account untouched
  assert.equal(stateToPurge.capturedLeads.length, 1);
  assert.equal(stateToPurge.capturedLeads[0].email, 'partner@7amgym.app');
});

test('Account Deletion Redesign, Concurrent 3-Layer Data Sanitization, Auto Account Switch & Content Validation Protocols', async () => {
  const {
    DELETE_ACCOUNT_BUTTON_LABELS,
    DELETE_ACCOUNT_MAIN_WARNING,
    buildPostDeleteSwitchPrompt,
    clearAllWebSessionCookies,
    executeCompleteAccountDeletion,
    findSecondarySavedAccount
  } = await import('./deletionValidation');
  const {
    runDeploymentValidationChecklist,
    scanContentForBrokenLinksAndTypos,
    validateScientificAlignment,
    validateWorkoutPlanExpertApproval
  } = await import('./contentValidationProtocol');

  // 1. Account Deletion Redesign: exact jargon-free ELI12 copy & button structure
  assert.equal(
    DELETE_ACCOUNT_MAIN_WARNING,
    'Are you sure you want to delete this account forever? All your saved workouts and meals will be gone.'
  );
  assert.equal(DELETE_ACCOUNT_MAIN_WARNING.toLowerCase().includes('supabase'), false);
  assert.equal(DELETE_ACCOUNT_BUTTON_LABELS.cancel, 'Cancel');
  assert.equal(DELETE_ACCOUNT_BUTTON_LABELS.confirm, 'Yes, Delete Account');
  assert.equal(
    buildPostDeleteSwitchPrompt('Alex'),
    'Account deleted. Do you want to continue as Alex?'
  );

  // 2. Automated Account Switching: detects another valid profile on the device (skips deleted & placeholders)
  const dualAccountState: Record<string, any> = {
    userProfile: { email: 'francois@7amgym.app', name: 'François' },
    workoutLogs: { w3_0_pullup_1: { reps: 8, done: true } },
    undoBackup: { snapshot: true },
    accountsByEmail: {
      'francois@7amgym.app': {
        profile: { email: 'francois@7amgym.app', name: 'François', signedInAt: '2026-11-23T07:00:00Z' },
        snapshot: { workoutLogs: { w3_0_pullup_1: { reps: 8, done: true } } }
      },
      'partner@7amgym.app': {
        profile: { email: 'partner@7amgym.app', name: 'Alex', signedInAt: '2026-11-22T07:00:00Z' },
        snapshot: { workoutLogs: { w1_0_bench_1: { reps: 10, done: true } } }
      },
      'athlete@gmail.com': {
        profile: { email: 'athlete@gmail.com', name: 'Placeholder' }
      }
    },
    capturedLeads: [
      { email: 'francois@7amgym.app', name: 'François' },
      { email: 'partner@7amgym.app', name: 'Alex' }
    ]
  };

  const secondaryFound = findSecondarySavedAccount(dualAccountState, 'francois@7amgym.app');
  assert.ok(secondaryFound);
  assert.equal(secondaryFound.name, 'Alex');
  assert.equal(secondaryFound.email, 'partner@7amgym.app');

  // 3. Concurrent 3-Layer Complete Data Removal (Server + Mobile Storage/Cache + Web Cookies)
  const executionEvents: string[] = [];
  const writtenCookieHeaders: string[] = [];
  const fakeDoc = {
    location: { pathname: '/app', hostname: 'localhost' },
    get cookie() {
      return 'gym_session=tok123; sb-access-token=abc; custom_pref=1';
    },
    set cookie(val: string) {
      writtenCookieHeaders.push(val);
    }
  };
  const fakeLocalStoreMap = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (k: string) => fakeLocalStoreMap.get(k) ?? null,
    setItem: (k: string, v: string) => {
      fakeLocalStoreMap.set(k, v);
    },
    removeItem: (k: string) => {
      fakeLocalStoreMap.delete(k);
    },
    clear: () => {
      fakeLocalStoreMap.clear();
    }
  };
  let sessionCleared = false;
  const fakeSessionStorage = {
    clear: () => {
      sessionCleared = true;
    }
  };
  const deletedCacheKeys: string[] = [];
  const fakeCaches = {
    keys: async () => ['7am-gym-v1', '7am-gym-assets'],
    delete: async (key: string) => {
      deletedCacheKeys.push(key);
      return true;
    }
  };
  const fakeWindow = { name: 'cached_window_state', location: { hash: '#state=secret', pathname: '/', search: '' }, history: { replaceState: () => {} } };

  const deletionRes = await executeCompleteAccountDeletion({
    endpoint: 'https://7am-gym-app.vercel.app/api/state',
    activeUserId: 'francois@7amgym.app',
    targetUserId: 'francois@7amgym.app',
    stateObj: dualAccountState,
    storageKey: 'bws_vegan_7am_app_v1',
    fetchImpl: async (url, init) => {
      executionEvents.push(`server:${init?.method}:${String(url)}`);
      return {
        ok: true,
        json: async () => ({
          configured: true,
          deleted: true,
          clearedDefaultMirror: true,
          clearedCookies: true
        })
      } as Response;
    },
    docImpl: fakeDoc,
    localStorageImpl: fakeLocalStorage,
    sessionStorageImpl: fakeSessionStorage,
    cachesImpl: fakeCaches,
    windowImpl: fakeWindow
  });

  assert.equal(deletionRes.deleted, true);
  assert.equal(deletionRes.serverDeleted, true);
  assert.equal(deletionRes.clearedDefaultMirror, true);
  assert.equal(deletionRes.mobilePurged, true);
  assert.equal(deletionRes.clearedCacheCount, 2);
  assert.deepEqual(deletedCacheKeys, ['7am-gym-v1', '7am-gym-assets']);
  assert.equal(sessionCleared, true);
  assert.equal(fakeWindow.name, '');
  assert.equal(deletionRes.cookiesClearedCount >= 3, true);
  assert.equal(writtenCookieHeaders.some((h) => h.startsWith('gym_session=;') && h.includes('Max-Age=0')), true);
  assert.equal(writtenCookieHeaders.some((h) => h.startsWith('sb-access-token=;') && h.includes('Max-Age=0')), true);
  assert.equal(deletionRes.secondaryAccount?.name, 'Alex');
  assert.equal(deletionRes.switchPromptText, 'Account deleted. Do you want to continue as Alex?');
  assert.equal(dualAccountState.accountsByEmail['francois@7amgym.app'], undefined);
  assert.equal(dualAccountState.undoBackup, null);
  assert.equal(executionEvents.length, 1);

  // 4. Single-account deletion wipes localStorage completely and returns secondaryAccount = null
  const soloState: Record<string, any> = {
    userProfile: { email: 'solo@7amgym.app', name: 'Solo' },
    accountsByEmail: {
      'solo@7amgym.app': { profile: { email: 'solo@7amgym.app', name: 'Solo' } }
    },
    capturedLeads: [{ email: 'solo@7amgym.app', name: 'Solo' }]
  };
  fakeLocalStorage.setItem('bws_vegan_7am_app_v1', '{"dirty":true}');
  const soloRes = await executeCompleteAccountDeletion({
    endpoint: 'https://7am-gym-app.vercel.app/api/state',
    activeUserId: 'solo@7amgym.app',
    targetUserId: 'solo@7amgym.app',
    stateObj: soloState,
    storageKey: 'bws_vegan_7am_app_v1',
    fetchImpl: async () => ({ ok: true, json: async () => ({ deleted: true }) } as Response),
    docImpl: fakeDoc,
    localStorageImpl: fakeLocalStorage,
    sessionStorageImpl: fakeSessionStorage,
    cachesImpl: fakeCaches,
    windowImpl: fakeWindow
  });
  assert.equal(soloRes.deleted, true);
  assert.equal(soloRes.secondaryAccount, null);
  assert.equal(soloRes.switchPromptText, null);
  assert.equal(soloRes.wipedEntireLocalStorage, true);
  assert.equal(fakeLocalStorage.getItem('bws_vegan_7am_app_v1'), null);

  // Also test standalone clearAllWebSessionCookies helper directly
  const clearedDirect = clearAllWebSessionCookies(fakeDoc);
  assert.equal(clearedDirect >= 3, true);

  // 5. Content Validation Protocol: Automated QA (links, typos, forbidden database jargon)
  const cleanQa = scanContentForBrokenLinksAndTypos(
    '<p>This will permanently erase your account and all your data. You cannot get it back.</p><a href="https://7am-gym-app.vercel.app">Home</a>'
  );
  assert.equal(cleanQa.passed, true);
  assert.equal(cleanQa.issues.length, 0);

  const dirtyQa = scanContentForBrokenLinksAndTypos(
    '<p>This will permanantly delte your protien log from Supabase.</p><a href="https://example.com/todo">Broken</a>'
  );
  assert.equal(dirtyQa.passed, false);
  assert.equal(dirtyQa.issues.some((i) => i.type === 'forbidden_jargon' && i.token === 'supabase'), true);
  assert.equal(dirtyQa.issues.some((i) => i.type === 'spelling' && i.token === 'protien'), true);
  assert.equal(dirtyQa.issues.some((i) => i.type === 'broken_link'), true);

  // 6. Content Validation Protocol: Mandatory Expert Review gate
  const rejectedExpert = validateWorkoutPlanExpertApproval(
    {
      planId: 'w7-hypertrophy',
      planName: 'Week 7 Hypertrophy',
      reviewerName: 'Coach Sam',
      certification: 'UNVERIFIED',
      certificationId: '12',
      certificationExpiresAt: '2020-01-01',
      status: 'draft'
    },
    new Date('2026-11-23T00:00:00Z')
  );
  assert.equal(rejectedExpert.approvedForRelease, false);
  assert.equal(rejectedExpert.reasons.length >= 3, true);

  const approvedExpert = validateWorkoutPlanExpertApproval(
    {
      planId: 'w7-hypertrophy',
      planName: 'Week 7 Hypertrophy',
      reviewerName: 'Dr. Jordan Lee',
      certification: 'CSCS',
      certificationId: 'NSCA-882419',
      certificationExpiresAt: '2028-12-31',
      status: 'approved',
      signedOffAt: '2026-11-20T15:00:00Z'
    },
    new Date('2026-11-23T00:00:00Z')
  );
  assert.equal(approvedExpert.approvedForRelease, true);
  assert.equal(approvedExpert.reasons.length, 0);

  // 7. Content Validation Protocol: Sports Science Alignment
  const alignedScience = validateScientificAlignment({
    restSeconds: 90,
    weeklyHardSetsPerMuscle: 14,
    targetRpe: 8,
    proteinGramsPerKg: 1.8,
    dailyWaterMl: 2500,
    includesWarmup: true,
    instructionsText: 'Focus on controlled reps and full range of motion.'
  });
  assert.equal(alignedScience.aligned, true);

  const unsafeScience = validateScientificAlignment({
    restSeconds: 10,
    weeklyHardSetsPerMuscle: 40,
    targetRpe: 11,
    proteinGramsPerKg: 0.4,
    dailyWaterMl: 500,
    includesWarmup: false,
    instructionsText: 'Spot reduce fat fast and starve yourself.'
  });
  assert.equal(unsafeScience.aligned, false);
  assert.equal(unsafeScience.violations.length >= 6, true);

  // 8. Content Validation Protocol: Deployment Checklist Gate
  const blockedDeploy = runDeploymentValidationChecklist({
    automatedQaPassed: true,
    expertReviewApproved: false,
    scientificAlignmentPassed: true,
    accessibilityWcagAndEli12Passed: true,
    concurrentDataSanitizationPassed: true,
    zeroFeatureDeprecationVerified: true
  });
  assert.equal(blockedDeploy.readyToDeploy, false);
  assert.equal(blockedDeploy.failedGates.length, 1);

  const readyDeploy = runDeploymentValidationChecklist({
    automatedQaPassed: true,
    expertReviewApproved: true,
    scientificAlignmentPassed: true,
    accessibilityWcagAndEli12Passed: true,
    concurrentDataSanitizationPassed: true,
    zeroFeatureDeprecationVerified: true
  });
  assert.equal(readyDeploy.readyToDeploy, true);
  assert.equal(readyDeploy.failedGates.length, 0);
});

test('Task 4 & Task 5: Zero Manual Sync Buttons, Debounced Auto-Sync on Fuel/Timer & Strict Vegan + Difficulty Multipliers', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const {
    buildValidatedWizardProgram,
    getDifficultyMultipliers
  } = await import('./wizardValidation');
  const { createAutoSupabaseSyncEngine } = await import('./workoutSyncEngine');

  // 1. Verify no manual "sync-now-cloud-btn" exists in index.html
  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  assert.equal(html.includes('id="sync-now-cloud-btn"'), false);
  assert.equal(html.includes('id="lead-password-input"'), true);
  assert.equal(html.includes('id="reset-fuel-day-btn"'), true);
  assert.equal(html.includes('Already have an account? Log In'), true);

  // 2. Verify Difficulty Multipliers (volume & movement complexity)
  const easyMult = getDifficultyMultipliers('easy');
  assert.equal(easyMult.volumeMultiplier, 0.75);
  assert.equal(easyMult.complexityTier, 'beginner_machines');

  const hardMult = getDifficultyMultipliers('hard');
  assert.equal(hardMult.volumeMultiplier, 1.25);
  assert.equal(hardMult.complexityTier, 'advanced_compounds');

  // 3. Verify buildValidatedWizardProgram strictly blocks animal products when diet === 'vegan'
  //    and applies difficulty multipliers directly to workout sets & movement complexity
  const candidateMeals = [
    { id: 'm1', title: 'Crispy Tofu & Jasmine Rice', ingredients: ['tofu', 'jasmine rice', 'broccoli'] },
    { id: 'm2', title: 'Pea Protein Oat Milk Shake', ingredients: ['pea protein', 'oat milk', 'peanut butter'] },
    { id: 'm3', title: 'Grilled Chicken Breast Bowl', ingredients: ['chicken', 'rice'] },
    { id: 'm4', title: 'Greek Yogurt & Whey Parfait', ingredients: ['greek yogurt', 'whey', 'honey'] },
    { id: 'm5', title: 'Scrambled Eggs & Cheddar', ingredients: ['eggs', 'cheddar'] }
  ];
  const baseSchedule = [
    {
      title: 'Upper Body',
      exercises: [
        { id: 'ex1', name: 'Barbell Bench Press', sets: 4, reps: '8-10', equipType: 'barbell' },
        { id: 'ex2', name: 'Barbell Back Squat', sets: 4, reps: '6-8', equipType: 'barbell' }
      ]
    }
  ];

  const veganEasyProgram = buildValidatedWizardProgram(
    { daysPerWeek: 4, primaryFocus: 'balanced', difficulty: 'easy', baseDiet: 'Vegan', intolerances: [] },
    candidateMeals,
    baseSchedule
  );
  assert.equal(veganEasyProgram.config.diet, 'vegan');
  assert.deepEqual(
    veganEasyProgram.mealPlan.map((m) => m.id),
    ['m1', 'm2']
  );
  assert.equal(veganEasyProgram.blockedMeals.length, 3);
  const easyDay = veganEasyProgram.workoutSchedule[0] as any;
  assert.equal(easyDay.exercises[0].name, 'Seated Chest Press Machine');
  assert.equal(easyDay.exercises[0].sets, 3); // 4 * 0.75 = 3
  assert.equal(easyDay.exercises[1].name, 'Leg Press Machine');
  assert.equal(easyDay.exercises[1].sets, 3);

  const veganHardProgram = buildValidatedWizardProgram(
    { daysPerWeek: 5, primaryFocus: 'balanced', difficulty: 'hard', baseDiet: 'Vegan', intolerances: [] },
    candidateMeals,
    [
      {
        title: 'Lower Body',
        exercises: [
          { id: 'ex3', name: 'Leg Press Machine', sets: 4, reps: '8-10', equipType: 'machine' }
        ]
      }
    ]
  );
  const hardDay = veganHardProgram.workoutSchedule[0] as any;
  assert.equal(hardDay.exercises[0].name, 'Barbell Back Squat');
  assert.equal(hardDay.exercises[0].sets, 5); // 4 * 1.25 = 5

  // 4. Verify debounced background push handles fuel_checked and timer_completed silently
  const stateObj: Record<string, any> = {
    workoutLogs: { w3_0_pullup_1: { reps: 8, done: true } },
    checkedMeals: { w3_d0_pre_shake: true },
    last_updated: null
  };
  const pushedBodies: any[] = [];
  let scheduledFn: (() => void) | null = null;
  const engine = createAutoSupabaseSyncEngine({
    getState: () => stateObj,
    getEndpoint: () => 'https://7am-gym-app.vercel.app/api/state?email=francois%407amgym.app',
    backgroundDebounceMs: 250,
    setTimer: (fn) => {
      scheduledFn = fn;
      return 1;
    },
    clearTimer: () => {
      scheduledFn = null;
    },
    fetchImpl: async (_url, init) => {
      pushedBodies.push(JSON.parse(String(init?.body || '{}')));
      return { ok: true, json: async () => ({ configured: true, saved: true }) } as Response;
    }
  });

  engine.pushGymStateInBackground('fuel_checked');
  assert.ok(stateObj.last_updated, 'last_updated must be stamped immediately on fuel check');
  engine.pushGymStateInBackground('timer_completed');
  assert.equal(pushedBodies.length, 0, 'Debounced rapid inputs collapse into one background push');
  assert.ok(scheduledFn);
  scheduledFn();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(pushedBodies.length, 1);
  assert.ok(pushedBodies[0].last_updated);
});







