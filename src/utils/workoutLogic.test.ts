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

  // Verify zero occurrences of "biomechanical" or Latin jargon in UNIVERSAL_MACHINE_SWAPS
  for (const cat of mod.UNIVERSAL_MACHINE_SWAPS) {
    assert.equal(/biomechanical|biomedical|soleus|gastrocnemius|plantarflexion|dorsiflexion|scapulae|posterior chain/i.test(cat.label), false);
    for (const opt of cat.options) {
      assert.equal(/biomechanical|biomedical|soleus|gastrocnemius|plantarflexion|dorsiflexion|scapulae|posterior chain/i.test(opt.targetMuscle), false, `Jargon in ${opt.optionId} targetMuscle`);
      assert.equal(/biomechanical|biomedical|soleus|gastrocnemius|plantarflexion|dorsiflexion|scapulae|posterior chain/i.test(opt.formSetup), false, `Jargon in ${opt.optionId} formSetup`);
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



