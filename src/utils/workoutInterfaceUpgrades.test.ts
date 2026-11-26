import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MISSED_SET_ONE_MODAL_QUESTION,
  MACHINE_PHOTO_PATHS,
  buildOfflineMachineDiagramDataUri,
  buildSkippedSetOneLog,
  computeDeviceClockWarmupTimer,
  detectMissedSetOneCondition,
  isExerciseResolvedDone,
  resolveMachinePhotoAsset,
  resolveMostRecentSuccessfulWeight,
  resolveNextExercisePreviewName,
  validateMachinePhotoRegistry
} from './workoutInterfaceUpgrades.ts';

describe('Smart Prompts for Missed Sets (Logic Rule)', () => {
  it('detects logging Set 2 while Set 1 is blank and returns the exact required question', () => {
    const check = detectMissedSetOneCondition({
      setIdx: 2,
      setOneEntry: undefined,
      isTargetSetAlreadyDone: false
    });
    assert.equal(check.shouldPrompt, true);
    assert.equal(check.question, 'Did you skip set one, or did you forget to log it?');
    assert.equal(check.question, MISSED_SET_ONE_MODAL_QUESTION);
  });

  it('does not trigger when Set 1 is already completed or explicitly marked skipped', () => {
    const whenDone = detectMissedSetOneCondition({
      setIdx: 2,
      setOneEntry: { weight: '135', reps: '8', done: true, skipped: false },
      isTargetSetAlreadyDone: false
    });
    assert.equal(whenDone.shouldPrompt, false);

    const whenSkipped = detectMissedSetOneCondition({
      setIdx: 2,
      setOneEntry: { weight: '', reps: '', done: false, skipped: true },
      isTargetSetAlreadyDone: false
    });
    assert.equal(whenSkipped.shouldPrompt, false);

    const whenSet1 = detectMissedSetOneCondition({
      setIdx: 1,
      setOneEntry: undefined,
      isTargetSetAlreadyDone: false
    });
    assert.equal(whenSet1.shouldPrompt, false);
  });

  it('marks Set 1 as skipped without ever auto-filling weight or reps', () => {
    const skipped = buildSkippedSetOneLog({ weight: '135', reps: '8', unit: 'lbs' }, 'lbs', 1700000000000);
    assert.equal(skipped.skipped, true);
    assert.equal(skipped.done, false);
    assert.equal(skipped.weight, '');
    assert.equal(skipped.reps, '');
  });

  it('treats an exercise as completed when Set 1 is skipped and remaining sets are done', () => {
    const resolved = isExerciseResolvedDone(
      [
        { weight: '', reps: '', done: false, skipped: true },
        { weight: '135', reps: '8', done: true, skipped: false },
        { weight: '135', reps: '8', done: true, skipped: false }
      ],
      3
    );
    assert.equal(resolved, true);

    const allSkippedOnly = isExerciseResolvedDone(
      [
        { weight: '', reps: '', done: false, skipped: true },
        { weight: '', reps: '', done: false, skipped: true }
      ],
      2
    );
    assert.equal(allSkippedOnly, false);
  });
});

describe('Device-Clock-Synced Warm-Up Timer & Next Exercise Preview', () => {
  it('computes accurate remaining and elapsed time directly from wall-clock timestamps without drift', () => {
    const startMs = Date.UTC(2026, 10, 26, 15, 0, 0);
    const nowMs = startMs + 185_000; // 3m 05s later even if tab slept
    const snap = computeDeviceClockWarmupTimer({
      nowMs,
      startedAtMs: startMs,
      accumulatedMs: 0,
      targetDurationSec: 600,
      running: true
    });
    assert.equal(snap.elapsedSec, 185);
    assert.equal(snap.remainingSec, 415);
    assert.equal(snap.formattedElapsed, '03:05');
    assert.equal(snap.formattedRemaining, '06:55');
    assert.equal(snap.isComplete, false);
    assert.match(snap.deviceClockText, /\d{1,2}:\d{2}:\d{2}\s(AM|PM)/);
  });

  it('resolves the next exercise preview in strict Warm-Up -> Pull-Ups -> Main Lifts sequence', () => {
    const pullupsFirst = resolveNextExercisePreviewName({
      isRestDay: false,
      hasPullupGroupToday: true,
      isPullupGroupDone: false,
      pullupGroupName: 'Overhand Pull-Up Program',
      remainingExercises: [
        { id: 'mon_bench', name: 'Flat Barbell Bench Press', sets: 3, isDone: false }
      ]
    });
    assert.equal(pullupsFirst.isPullupsNext, true);
    assert.equal(pullupsFirst.displayText, 'Next Exercise: Overhand Pull-Up Program');

    const afterPullups = resolveNextExercisePreviewName({
      isRestDay: false,
      hasPullupGroupToday: true,
      isPullupGroupDone: true,
      pullupGroupName: 'Overhand Pull-Up Program',
      remainingExercises: [
        { id: 'mon_bench', name: 'Flat Barbell Bench Press', sets: 3, isDone: true },
        { id: 'mon_cs_row', name: 'Chest-Supported Dumbbell Row', sets: 3, isDone: false }
      ]
    });
    assert.equal(afterPullups.isPullupsNext, false);
    assert.equal(afterPullups.displayText, 'Next Exercise: Chest-Supported Dumbbell Row');
  });
});

describe('Historical Most-Recent Successful Weight Resolver', () => {
  it('loads the most recent successful historical weight across synced logs and converts units cleanly', () => {
    const logs = {
      w1_0_mon_bench_1: { weight: '135', reps: '8', unit: 'lbs', done: true, updatedAt: 1700000100000 },
      w2_0_mon_bench_3: { weight: '145', reps: '8', unit: 'lbs', done: true, updatedAt: 1700500100000 },
      w3_0_mon_bench_1: { weight: '155', reps: '5', unit: 'lbs', done: false, updatedAt: 1700900100000 }
    };
    const resLbs = resolveMostRecentSuccessfulWeight({
      exerciseId: 'mon_bench',
      targetUnit: 'lbs',
      currentWeek: 3,
      currentDayIdx: 0,
      workoutLogs: logs
    });
    assert.ok(resLbs);
    assert.equal(resLbs.weight, 145);
    assert.equal(resLbs.unit, 'lbs');
    assert.equal(resLbs.foundInHistory, true);

    const resKg = resolveMostRecentSuccessfulWeight({
      exerciseId: 'mon_bench',
      targetUnit: 'kg',
      currentWeek: 3,
      currentDayIdx: 0,
      workoutLogs: logs
    });
    assert.ok(resKg);
    assert.equal(resKg.unit, 'kg');
    assert.equal(resKg.weight, 66.25); // 145 / 2.20462 = 65.77 -> nearest 1.25 kg = 66.25
  });
});

describe('Verified Machine Photos & Offline Diagram Fallback', () => {
  it('maps every equipment family to an existing local verified photo file and valid offline SVG fallback', () => {
    Object.values(MACHINE_PHOTO_PATHS).forEach((relPath) => {
      const diskPath = path.resolve(process.cwd(), 'public', relPath.replace(/^\//, ''));
      assert.equal(fs.existsSync(diskPath), true, `Expected machine photo asset on disk: ${diskPath}`);
    });

    const report = validateMachinePhotoRegistry([
      { id: 'mon_bench', name: 'Flat Barbell Bench Press', equipType: 'barbell_bench' },
      { id: 'mon_lat_pd', name: 'Lat Pulldown Machine', equipType: 'lat_pulldown' },
      { id: 'tue_leg_ext', name: 'Seated Leg Extension', equipType: 'leg_extension' },
      { id: 'day1_pullups', name: 'Overhand Pull-Ups', equipType: 'pullup_bar' },
      { id: 'mon_cs_row', name: 'Seated Chest Press Machine', equipType: 'machine' }
    ]);
    assert.equal(report.passed, true);
    assert.equal(report.brokenItems.length, 0);

    const asset = resolveMachinePhotoAsset({
      exerciseId: 'mon_lat_pd',
      exerciseName: 'Lat Pulldown Machine'
    });
    assert.equal(asset.photoUrl, '/assets/machines/cable-lat-pulldown.jpg');
    assert.ok(asset.offlineSvgFallback.startsWith('data:image/svg+xml;charset=utf-8,'));
    assert.ok(buildOfflineMachineDiagramDataUri('leg_machine', 'Leg Extension').includes('OFFLINE'));
  });
});
