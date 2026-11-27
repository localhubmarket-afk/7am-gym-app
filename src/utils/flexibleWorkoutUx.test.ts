import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FLEXIBLE_SET_STEPPER_PALETTE,
  MAX_FLEXIBLE_SETS,
  MIN_FLEXIBLE_SETS,
  adjustExerciseSetCount,
  resolveEffectiveExerciseSetCount,
  resolveWeightStepIncrement,
  shouldLockExerciseOnSetDone,
  shouldShowMicroStartPanel,
  shouldShowResumeWorkoutBanner,
  stepRepsValue,
  stepWeightValue,
  verifyStepperWcagContrastCompliance
} from './flexibleWorkoutUx.ts';

describe('WCAG 2.0/2.2 AA High-Contrast Color-Grouped Steppers (>= 4.5:1)', () => {
  it('verifies every text, placeholder, and icon pairing in the deep blue weight group and light gray reps group meets >= 4.5:1 contrast', () => {
    const report = verifyStepperWcagContrastCompliance(4.5);
    assert.equal(report.passed, true, `Failed contrast checks: ${JSON.stringify(report.checks.filter((c) => !c.passed))}`);
    assert.ok(report.minRatio >= 4.5, `Expected minimum contrast >= 4.5, got ${report.minRatio}`);

    // Explicitly verify user-requested color roles
    assert.equal(FLEXIBLE_SET_STEPPER_PALETTE.weightContainerBg, '#172554');
    assert.equal(FLEXIBLE_SET_STEPPER_PALETTE.weightMinusBg, '#991B1B');
    assert.equal(FLEXIBLE_SET_STEPPER_PALETTE.weightPlusBg, '#166534');
    assert.equal(FLEXIBLE_SET_STEPPER_PALETTE.repsContainerBg, '#E5E7EB');
    assert.equal(FLEXIBLE_SET_STEPPER_PALETTE.repsButtonBg, '#4B5563');
  });
});

describe('Contextual Behavioral Banner Visibility (Right Below Day Header)', () => {
  it('shows 2-Minute Micro-Start ONLY when 0 sets are logged on a training day (or when focus mode is active)', () => {
    assert.equal(shouldShowMicroStartPanel({ isRestDay: false, todayDoneSets: 0, microStartActive: false }), true);
    assert.equal(shouldShowMicroStartPanel({ isRestDay: false, todayDoneSets: 1, microStartActive: false }), false);
    assert.equal(shouldShowMicroStartPanel({ isRestDay: false, todayDoneSets: 4, microStartActive: false }), false);
    assert.equal(shouldShowMicroStartPanel({ isRestDay: false, todayDoneSets: 1, microStartActive: true }), true);
    assert.equal(shouldShowMicroStartPanel({ isRestDay: true, todayDoneSets: 0, microStartActive: false }), false);
  });

  it('shows Active Workout Saved banner ONLY when an unfinished session exists and is not dismissed', () => {
    assert.equal(
      shouldShowResumeWorkoutBanner({
        snapshot: { week: 1, dayIndex: 0, completedSets: 3, totalSets: 18, timerRunning: false },
        dismissedThisLoad: false,
        currentWeek: 1,
        currentDayIdx: 0,
        isRestDay: false
      }),
      true
    );

    // Hidden when 0 sets done
    assert.equal(
      shouldShowResumeWorkoutBanner({
        snapshot: { week: 1, dayIndex: 0, completedSets: 0, totalSets: 18, timerRunning: false },
        dismissedThisLoad: false
      }),
      false
    );

    // Hidden when all sets already completed
    assert.equal(
      shouldShowResumeWorkoutBanner({
        snapshot: { week: 1, dayIndex: 0, completedSets: 18, totalSets: 18, timerRunning: false },
        dismissedThisLoad: false
      }),
      false
    );

    // Hidden when dismissed
    assert.equal(
      shouldShowResumeWorkoutBanner({
        snapshot: { week: 1, dayIndex: 0, completedSets: 3, totalSets: 18, timerRunning: false },
        dismissedThisLoad: true
      }),
      false
    );
  });
});

describe('Global Per-Set Overrides & Non-Locking Behavior (Standard Lifts & Pull-Ups)', () => {
  it('allows adding and removing sets globally including pull-ups and clamps cleanly between 1 and 12', () => {
    let overrides: Record<string, number> = {};

    // Standard lift: 3 base sets -> add to 4 -> remove to 2
    const addBench = adjustExerciseSetCount({
      overridesMap: overrides,
      week: 1,
      dayIdx: 0,
      exId: 'mon_bench',
      baseSets: 3,
      delta: 1
    });
    assert.equal(addBench.nextCount, 4);
    assert.equal(addBench.changed, true);
    overrides = addBench.overridesMap;

    const removeBench1 = adjustExerciseSetCount({
      overridesMap: overrides,
      week: 1,
      dayIdx: 0,
      exId: 'mon_bench',
      baseSets: 3,
      delta: -2
    });
    assert.equal(removeBench1.nextCount, 2);

    // Pull-up session: can remove below template 5 down to 1 OR add up to 12
    const pullupLess = adjustExerciseSetCount({
      overridesMap: overrides,
      week: 1,
      dayIdx: 0,
      exId: 'day1_pullups',
      baseSets: 5,
      delta: -2
    });
    assert.equal(pullupLess.nextCount, 3);
    assert.equal(
      resolveEffectiveExerciseSetCount({
        overridesMap: pullupLess.overridesMap,
        week: 1,
        dayIdx: 0,
        exId: 'day1_pullups',
        baseSets: 5
      }),
      3
    );

    // Clamping bounds
    const clampLow = adjustExerciseSetCount({
      overridesMap: {},
      week: 1,
      dayIdx: 0,
      exId: 'day1_pullups',
      baseSets: 1,
      delta: -5
    });
    assert.equal(clampLow.nextCount, MIN_FLEXIBLE_SETS);

    const clampHigh = adjustExerciseSetCount({
      overridesMap: {},
      week: 1,
      dayIdx: 0,
      exId: 'mon_bench',
      baseSets: 12,
      delta: 3
    });
    assert.equal(clampHigh.nextCount, MAX_FLEXIBLE_SETS);
  });

  it('steps weight and reps cleanly on individual sets including bodyweight 0 and fatigue rep drops', () => {
    assert.equal(resolveWeightStepIncrement({ unit: 'lbs', isBodyweightOrPullup: false, defaultWeightLbs: 135 }), 5);
    assert.equal(resolveWeightStepIncrement({ unit: 'kg', isBodyweightOrPullup: false, defaultWeightLbs: 135 }), 2.5);
    assert.equal(resolveWeightStepIncrement({ unit: 'lbs', isBodyweightOrPullup: true, defaultWeightLbs: 0 }), 2.5);
    assert.equal(resolveWeightStepIncrement({ unit: 'kg', isBodyweightOrPullup: true, defaultWeightLbs: 0 }), 1.25);

    // Weight stepping +5 / -5 and pull-up weighted 0 -> +2.5 -> 0
    assert.equal(stepWeightValue({ currentValue: '135', placeholderValue: '135', delta: 5, unit: 'lbs' }), '140');
    assert.equal(stepWeightValue({ currentValue: '135', placeholderValue: '135', delta: -5, unit: 'lbs' }), '130');
    assert.equal(stepWeightValue({ currentValue: '0', placeholderValue: '0', delta: 2.5, unit: 'lbs' }), '2.5');
    assert.equal(stepWeightValue({ currentValue: '2.5', placeholderValue: '0', delta: -5, unit: 'lbs' }), '0');

    // Fatigue rep drop: planned 4 reps -> user taps minus twice -> 2 reps
    const afterOne = stepRepsValue({ currentValue: '', placeholderValue: '4', delta: -1 });
    assert.equal(afterOne, '3');
    const afterTwo = stepRepsValue({ currentValue: afterOne, placeholderValue: '4', delta: -1 });
    assert.equal(afterTwo, '2');
  });

  it('never locks inputs or auto-collapses an exercise when clicking Done on a single set', () => {
    const resSingle = shouldLockExerciseOnSetDone({ setDoneCount: 1, totalSetsCount: 3, autoCollapseEnabled: true });
    assert.equal(resSingle.shouldLockInputs, false);
    assert.equal(resSingle.shouldAutoCollapse, false);

    const resFull = shouldLockExerciseOnSetDone({ setDoneCount: 3, totalSetsCount: 3, autoCollapseEnabled: true });
    assert.equal(resFull.shouldLockInputs, false);
    assert.equal(resFull.shouldAutoCollapse, false);
  });
});

describe('DOM Placement & Inline Control Structure Verification in index.html', () => {
  it('places workout-resume-banner and micro-start-slot directly below day-banner and embeds inline Add/Remove Set controls', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const dayBannerPos = html.indexOf('id="day-banner"');
    const resumeBannerPos = html.indexOf('id="workout-resume-banner"');
    const microStartPos = html.indexOf('id="micro-start-slot"');
    const zoneBPos = html.indexOf('id="gym-zone-b-setup-slot"');

    assert.ok(dayBannerPos > 0, 'day-banner must exist');
    assert.ok(resumeBannerPos > dayBannerPos, 'workout-resume-banner must be placed below day-banner');
    assert.ok(microStartPos > dayBannerPos, 'micro-start-slot must be placed below day-banner');
    assert.ok(resumeBannerPos < zoneBPos, 'workout-resume-banner must be directly below day-banner before setup cards');
    assert.ok(microStartPos < zoneBPos, 'micro-start-slot must be directly below day-banner before setup cards');

    // Verify high-contrast color-grouped stepper classes and inline set override controls exist
    assert.equal(html.includes('weight-stepper-deep-blue'), true);
    assert.equal(html.includes('weight-btn-minus-crimson'), true);
    assert.equal(html.includes('weight-btn-plus-forest'), true);
    assert.equal(html.includes('reps-stepper-light-gray'), true);
    assert.equal(html.includes('reps-btn-neutral-gray'), true);
    assert.equal(html.includes('exercise-set-count-btn'), true);
  });
});
