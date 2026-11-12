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
  assert.equal(mediaMeta.title, '⏱️ 01:15 • Rest: Barbell Bench Press • ❤️ 128 BPM');
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
    title: '⏱️ Rest Complete! Start Next Set',
    nextSetSummary: 'Set 2 Barbell Bench Press (135 lbs x 8)',
    liveBpm: null,
    bleConnected: false
  });
  assert.equal(wristPayload.title, '⏱️ Rest Complete! Start Next Set');
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






