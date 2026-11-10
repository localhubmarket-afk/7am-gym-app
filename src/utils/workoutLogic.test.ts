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


