import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ARRIVAL_LOCKER_CHECKLIST_ITEMS,
  MIN_WCAG_TOUCH_TARGET_PX,
  WCAG_CHRONOLOGICAL_PALETTE,
  resolveExerciseSpecificGear,
  shouldShowPullupsInActiveDay,
  toggleChecklistKey,
  verifyChronologicalWcagContrast
} from './chronologicalWorkoutUx';

describe('Chronological Workout UX & WCAG 2.2 AA Contrast Compliance', () => {
  it('verifies >= 4.5:1 WCAG 2.2 AA contrast for Rest Day, Reset Workout, Progress Text, Micro-Start, and Gear chips in BOTH Dark and Light Mode', () => {
    const report = verifyChronologicalWcagContrast();
    assert.equal(report.allPass, true, `Expected all contrast checks to pass: ${JSON.stringify(report.results)}`);
    assert.ok(report.results.length >= 14, 'Should audit both dark and light tokens');
    assert.equal(MIN_WCAG_TOUCH_TARGET_PX, 44);
    assert.equal(WCAG_CHRONOLOGICAL_PALETTE.dark.restDayButton.fg, '#FEF08A');
    assert.equal(WCAG_CHRONOLOGICAL_PALETTE.dark.resetWorkoutButton.fg, '#FECDD3');
    assert.equal(WCAG_CHRONOLOGICAL_PALETTE.dark.progressLabel.fg, '#86EFAC');
  });

  it('maps exercise-specific gear contextually instead of a top-level global gear checklist', () => {
    const pullupGear = resolveExerciseSpecificGear({ name: 'Assisted Pull-Ups', isPullup: true });
    assert.ok(pullupGear.some((g) => g.label === 'Chalk'));
    assert.ok(pullupGear.some((g) => g.label === 'Dip Belt'));
    assert.ok(pullupGear.some((g) => g.label === 'Assist Band'));

    const squatGear = resolveExerciseSpecificGear({ name: 'Barbell Back Squat' });
    assert.ok(squatGear.some((g) => g.label === 'Lifting Belt'));
    assert.ok(squatGear.some((g) => g.label === 'Knee Sleeves'));

    const rowGear = resolveExerciseSpecificGear({ name: 'Chest-Supported Row' });
    assert.ok(rowGear.some((g) => g.label === 'Lifting Straps'));

    const benchGear = resolveExerciseSpecificGear({ name: 'Flat Barbell Bench Press' });
    assert.ok(benchGear.some((g) => g.label === 'Wrist Wraps'));

    const hipThrustGear = resolveExerciseSpecificGear({ name: 'Barbell Hip Thrust' });
    assert.ok(hipThrustGear.some((g) => g.label === 'Barbell Pad'));
  });

  it('toggles arrival & exercise gear checklists immutably and routes Pull-Ups visibility by day type', () => {
    assert.ok(ARRIVAL_LOCKER_CHECKLIST_ITEMS.some((i) => i.id === 'locker_locked'));

    const first = toggleChecklistKey({}, 'w2_d3_pullups_chalk');
    assert.equal(first.checked, true);
    assert.equal(first.nextMap['w2_d3_pullups_chalk'], true);

    const second = toggleChecklistKey(first.nextMap, 'w2_d3_pullups_chalk');
    assert.equal(second.checked, false);
    assert.equal(second.nextMap['w2_d3_pullups_chalk'], false);

    assert.equal(shouldShowPullupsInActiveDay({ isRestDay: false, pullupViewMode: 'selected' }), true);
    assert.equal(shouldShowPullupsInActiveDay({ isRestDay: true, pullupViewMode: 'selected' }), false);
    assert.equal(shouldShowPullupsInActiveDay({ isRestDay: true, pullupViewMode: 'all' }), true);
  });
});

describe('Strict 3-Phase Chronological DOM Architecture in index.html', () => {
  it('enforces exact vertical order: Phase 1 (Rest Day + adjacent Micro-Start + Change/Reset) -> Phase 2 (Warm-Up with embedded Locker) -> Phase 3 (Active Day Container with Day Header, Water Tracker, Exercise #1 Pull-Ups, Exercises #2+)', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

    const phase1Pos = html.indexOf('id="day-management-interception-panel"');
    const restSlotPos = html.indexOf('id="gym-zone-b-rest-slot"');
    const microStartPos = html.indexOf('id="micro-start-slot"');
    const zoneBSetupPos = html.indexOf('id="gym-zone-b-setup-slot"');
    const warmupPos = html.indexOf('id="warmup-card-container"');
    const lockerInsideWarmupPos = html.indexOf('id="warmup-locker-checklist-slot"');
    const warmupTimerPos = html.indexOf('id="warmup-clock-timer-panel"');
    const activeDayPos = html.indexOf('id="active-day-workout-container"');
    const dayBannerPos = html.indexOf('id="day-banner"');
    const zoneCWaterPos = html.indexOf('id="gym-zone-c-tracker-slot"');
    const pullupsPos = html.indexOf('id="pinned-pullups-gym-hub"');
    const pullupGearSlotPos = html.indexOf('id="pullup-exercise-gear-slot"');
    const exerciseListPos = html.indexOf('id="exercise-list"');

    // Phase 1 at the top before Warm-Up
    assert.ok(phase1Pos > 0);
    assert.ok(restSlotPos > phase1Pos);
    assert.ok(microStartPos > restSlotPos);
    assert.ok(zoneBSetupPos > microStartPos);
    assert.ok(zoneBSetupPos < warmupPos, 'Phase 1 Day Management must precede Warm-Up');

    // Phase 2 Middle: Warm-Up with Locker Checklist embedded directly inside it
    assert.ok(lockerInsideWarmupPos > warmupPos && lockerInsideWarmupPos < warmupTimerPos, 'Locker checklist must be embedded directly inside Warm-Up card');
    assert.ok(warmupPos < activeDayPos, 'Warm-Up must precede Active Day Container');

    // Phase 3 Active Day Container: Day Header -> Water Tracker -> Exercise #1 Pull-Ups -> Exercises #2+
    assert.ok(dayBannerPos > activeDayPos, 'Day Header must be inside Active Day Container');
    assert.ok(zoneCWaterPos > dayBannerPos, 'Water tracker must be at the top of Active Day Container after Day Header');
    assert.ok(pullupsPos > zoneCWaterPos, 'Pull-Ups must sit inside Active Day Container right after Water tracker as Exercise #1');
    assert.ok(pullupGearSlotPos > pullupsPos && pullupGearSlotPos < exerciseListPos, 'Pull-Up specific gear must live inside the Pull-Ups container');
    assert.ok(exerciseListPos > pullupsPos, 'Exercises #2+ must follow Exercise #1 Pull-Ups inside Active Day Container');

    // Verify top-level global Gear Checklist button was removed while exercise-specific Gear & Shoes modal access stays intact
    assert.equal(html.includes('id="banner-open-shoe-gear-btn"'), false, 'Global Gear Checklist button must be removed from the top bar');
    assert.equal(html.includes('open-full-gear-modal-btn'), true, 'Exercise-specific gear cards must still preserve Gear & Shoes modal access');

    // Verify WCAG classes and zero sub-44px inline heights on active workout buttons
    assert.equal(html.includes('wcag-rest-day-btn'), true);
    assert.equal(html.includes('wcag-reset-workout-btn'), true);
    assert.equal(html.includes('wcag-day-progress-text'), true);
    assert.equal(html.includes('style="min-height: 40px;"'), false, 'No 40px inline button heights should remain');
    assert.equal(html.includes('style="min-height: 38px;"'), false, 'No 38px inline button heights should remain');
    assert.equal(html.includes('style="min-height: 36px;"'), false, 'No 36px inline button heights should remain');
  });
});
