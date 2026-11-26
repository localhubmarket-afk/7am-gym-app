import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyParsedSetsToExerciseLogs,
  buildSkipOnboardingDefaultPatch,
  extractRecentLiftWeights,
  parseInlineSetText,
  resolveNavigationTarget,
  revertFastLogUndoSnapshot
} from './workoutUxImprovements';

describe('parseInlineSetText', () => {
  it('parses a single weight x reps set', () => {
    const res = parseInlineSetText('135x8');
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.sets.length, 1);
      assert.deepEqual(res.sets[0], { weight: 135, reps: 8, unit: 'lbs', isBodyweight: false });
    }
  });

  it('parses comma-separated multi-set batches with decimals and spaces', () => {
    const res = parseInlineSetText('135 x 8, 135x8, 142.5 * 6');
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.sets.length, 3);
      assert.equal(res.sets[0].weight, 135);
      assert.equal(res.sets[0].reps, 8);
      assert.equal(res.sets[2].weight, 142.5);
      assert.equal(res.sets[2].reps, 6);
    }
  });

  it('parses multiplier shorthand (135x8x3 and 3x10 @ 60kg)', () => {
    const res1 = parseInlineSetText('135x8x3');
    assert.equal(res1.ok, true);
    if (res1.ok) {
      assert.equal(res1.sets.length, 3);
      assert.equal(res1.sets.every((s) => s.weight === 135 && s.reps === 8), true);
    }

    const res2 = parseInlineSetText('3x10 @ 60kg');
    assert.equal(res2.ok, true);
    if (res2.ok) {
      assert.equal(res2.sets.length, 3);
      assert.deepEqual(res2.sets[0], { weight: 60, reps: 10, unit: 'kg', isBodyweight: false });
    }
  });

  it('parses bodyweight shorthand and reps-only batches for bodyweight exercises', () => {
    const res1 = parseInlineSetText('bw x 12, bw+25 x 6', { isBodyweightExercise: true });
    assert.equal(res1.ok, true);
    if (res1.ok) {
      assert.equal(res1.sets.length, 2);
      assert.deepEqual(res1.sets[0], { weight: 0, reps: 12, unit: 'lbs', isBodyweight: true });
      assert.deepEqual(res1.sets[1], { weight: 25, reps: 6, unit: 'lbs', isBodyweight: false });
    }

    const res2 = parseInlineSetText('10, 9, 8', { isBodyweightExercise: true });
    assert.equal(res2.ok, true);
    if (res2.ok) {
      assert.deepEqual(
        res2.sets.map((s) => s.reps),
        [10, 9, 8]
      );
    }
  });

  it('returns plain-language ELI12 error on empty or invalid input', () => {
    const emptyRes = parseInlineSetText('   ');
    assert.equal(emptyRes.ok, false);

    const badRes = parseInlineSetText('banana');
    assert.equal(badRes.ok, false);
    if (!badRes.ok) {
      assert.match(badRes.error, /Could not read/i);
    }
  });
});

describe('applyParsedSetsToExerciseLogs & Undo', () => {
  it('fills next incomplete sets first and restores exact state on Undo', () => {
    const logs: Record<string, any> = {
      w1_0_mon_bench_1: { weight: '135', reps: '8', done: true, unit: 'lbs' },
      '0_mon_bench_1': { weight: '135', reps: '8', done: true, unit: 'lbs' }
    };

    const parsed = parseInlineSetText('135x8, 140x6');
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const applied = applyParsedSetsToExerciseLogs({
      workoutLogs: logs,
      week: 1,
      dayIdx: 0,
      slotIdx: 0,
      exerciseId: 'mon_bench',
      targetSetsCount: 3,
      defaultUnit: 'lbs',
      parsedSets: parsed.sets
    });

    assert.deepEqual(applied.appliedSetIndices, [2, 3]);
    assert.equal(logs.w1_0_mon_bench_2.weight, '135');
    assert.equal(logs.w1_0_mon_bench_2.done, true);
    assert.equal(logs.w1_0_mon_bench_3.weight, '140');
    assert.equal(logs.w1_0_mon_bench_3.reps, '6');

    const undone = revertFastLogUndoSnapshot(logs, applied.undoSnapshot);
    assert.equal(undone, true);
    assert.equal(logs.w1_0_mon_bench_2, undefined);
    assert.equal(logs.w1_0_mon_bench_3, undefined);
    assert.equal(logs.w1_0_mon_bench_1.done, true);
  });
});

describe('resolveNavigationTarget', () => {
  it('routes 3 bottom tabs, header nutrition views, and legacy pullups tab cleanly', () => {
    assert.deepEqual(resolveNavigationTarget('workout'), {
      activeView: 'workout',
      bottomTab: 'workout',
      nutritionMode: null,
      focusPinnedPullups: false
    });
    assert.deepEqual(resolveNavigationTarget('timer'), {
      activeView: 'timer',
      bottomTab: 'timer',
      nutritionMode: null,
      focusPinnedPullups: false
    });
    assert.deepEqual(resolveNavigationTarget('stats'), {
      activeView: 'stats',
      bottomTab: 'stats',
      nutritionMode: null,
      focusPinnedPullups: false
    });
    assert.deepEqual(resolveNavigationTarget('pullups'), {
      activeView: 'workout',
      bottomTab: 'workout',
      nutritionMode: null,
      focusPinnedPullups: true
    });
    assert.deepEqual(resolveNavigationTarget('vegan'), {
      activeView: 'vegan',
      bottomTab: null,
      nutritionMode: 'vegan',
      focusPinnedPullups: false
    });
    assert.deepEqual(resolveNavigationTarget('shopping'), {
      activeView: 'shopping',
      bottomTab: null,
      nutritionMode: 'shopping',
      focusPinnedPullups: false
    });
  });
});

describe('buildSkipOnboardingDefaultPatch', () => {
  it('loads default 5-day full-body plan and marks skipped without overwriting signed-in user', () => {
    const guestPatch = buildSkipOnboardingDefaultPatch({});
    assert.equal(guestPatch.onboardingComplete, true);
    assert.equal(guestPatch.onboardingDismissedMode, 'skipped');
    assert.equal(guestPatch.isGuestMode, true);
    assert.equal(guestPatch.programWizardConfig.daysPerWeek, 5);

    const signedInPatch = buildSkipOnboardingDefaultPatch({
      userProfile: { name: 'Francois', email: 'test@example.com', isGuest: false, authProvider: 'email' }
    });
    assert.equal(signedInPatch.onboardingComplete, true);
    assert.equal(signedInPatch.userProfile, undefined);
  });
});

describe('extractRecentLiftWeights', () => {
  it('returns latest logged weight and estimated 1RM per exercise', () => {
    const summary = extractRecentLiftWeights(
      {
        w1_0_mon_bench_1: { weight: '135', reps: '8', done: true, unit: 'lbs' },
        w2_0_mon_bench_3: { weight: '145', reps: '8', done: true, unit: 'lbs' },
        w1_1_tue_squat_2: { weight: '185', reps: '5', done: true, unit: 'lbs' }
      },
      { mon_bench: 'Barbell Bench Press', tue_squat: 'Barbell Back Squat' },
      5
    );

    assert.equal(summary.length, 2);
    assert.equal(summary[0].exerciseName, 'Barbell Bench Press');
    assert.equal(summary[0].weight, 145);
    assert.equal(summary[0].week, 2);
    assert.equal(summary[1].exerciseName, 'Barbell Back Squat');
    assert.equal(summary[1].weight, 185);
  });
});
