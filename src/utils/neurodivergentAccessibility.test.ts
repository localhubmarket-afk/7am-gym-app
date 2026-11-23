import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  calculateDoubleProgressionTarget,
  evaluateExerciseDoubleProgressionFromGymState,
  parseObjectiveRepRange,
  loadAdvancedSubjectiveSetting,
  saveAdvancedSubjectiveSetting,
  DEFAULT_SUBJECTIVE_TRACKING_ENABLED
} from './doubleProgressionEngine.ts';
import { computeRolling30DayConsistencyScore } from './adherenceEngine.ts';
import {
  dispatchRestTimerCompletionAlert,
  triggerSafeHapticFeedback
} from './pwaRestTimer.ts';
import {
  applySensoryCalmToDocument,
  loadStoredSensoryCalmPreference,
  saveSensoryCalmPreference,
  SENSORY_CALM_STORAGE_KEY
} from './themeProvider.ts';
import {
  calculateVisualBarbellPlates,
  buildVisualPlateLoaderSvgHtml,
  STANDARD_BAR_WEIGHT_LBS,
  STANDARD_BAR_WEIGHT_KG
} from './plateLoader.ts';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    }
  };
}

describe('Task 1: Deterministic Double Progression Engine (No Subjective Math)', () => {
  it('parses rep ranges cleanly across hyphen, en-dash, and single rep labels', () => {
    assert.deepEqual(parseObjectiveRepRange('8-12'), { minReps: 8, maxReps: 12 });
    assert.deepEqual(parseObjectiveRepRange('6–10 reps'), { minReps: 6, maxReps: 10 });
    assert.deepEqual(parseObjectiveRepRange('5'), { minReps: 5, maxReps: 7 });
  });

  it('increases weight and resets reps to minReps when all target sets hit maxReps', () => {
    const result = calculateDoubleProgressionTarget({
      exerciseName: 'Barbell Bench Press',
      targetSets: 3,
      repRangeLabel: '8-12',
      baselineWeight: 135,
      unit: 'lbs',
      completedSets: [
        { weight: 135, reps: 12, done: true },
        { weight: 135, reps: 12, done: true },
        { weight: 135, reps: 12, done: true }
      ]
    });

    assert.equal(result.model, 'double_progression');
    assert.equal(result.usesSubjectiveMetrics, false);
    assert.equal(result.action, 'increase_weight');
    assert.equal(result.nextTargetWeight, 140);
    assert.equal(result.nextTargetReps, 8);
    assert.equal(result.weightDelta, 5);
  });

  it('increases reps within range when all sets meet minReps but not maxReps', () => {
    const result = calculateDoubleProgressionTarget({
      exerciseName: 'Barbell Squat',
      targetSets: 3,
      repRangeLabel: '6-10',
      baselineWeight: 185,
      unit: 'lbs',
      completedSets: [
        { weight: 185, reps: 8, done: true },
        { weight: 185, reps: 7, done: true },
        { weight: 185, reps: 8, done: true }
      ]
    });

    assert.equal(result.action, 'increase_reps');
    assert.equal(result.nextTargetWeight, 185);
    assert.equal(result.nextTargetReps, 8);
    assert.equal(result.weightDelta, 0);
  });

  it('holds weight when fewer than target sets are completed or reps fall below minReps', () => {
    const result = calculateDoubleProgressionTarget({
      exerciseName: 'Overhead Press',
      targetSets: 3,
      repRangeLabel: '8-12',
      baselineWeight: 95,
      unit: 'lbs',
      completedSets: [
        { weight: 95, reps: 8, done: true },
        { weight: 95, reps: 6, done: true }
      ]
    });

    assert.equal(result.action, 'hold_and_build');
    assert.equal(result.nextTargetWeight, 95);
    assert.equal(result.nextTargetReps, 8);
  });

  it('completely ignores subjective interoceptive ratings (RPE, RIR, pump, soreness)', () => {
    const pureObjective = calculateDoubleProgressionTarget({
      exerciseName: 'Barbell Row',
      targetSets: 3,
      repRangeLabel: '8-10',
      baselineWeight: 135,
      unit: 'lbs',
      completedSets: [
        { weight: 135, reps: 10, done: true },
        { weight: 135, reps: 10, done: true },
        { weight: 135, reps: 10, done: true }
      ]
    });

    const withExtremeSubjective = calculateDoubleProgressionTarget({
      exerciseName: 'Barbell Row',
      targetSets: 3,
      repRangeLabel: '8-10',
      baselineWeight: 135,
      unit: 'lbs',
      completedSets: [
        { weight: 135, reps: 10, done: true, rpe: 10, rir: 0, pump: 1, soreness: 10 },
        { weight: 135, reps: 10, done: true, rpe: 9.5, rir: 0, pump: 2, soreness: 9 },
        { weight: 135, reps: 10, done: true, rpe: 10, rir: 0, pump: 1, soreness: 10 }
      ]
    });

    assert.deepEqual(withExtremeSubjective, pureObjective);
    assert.equal(withExtremeSubjective.nextTargetWeight, 140);
    assert.equal(withExtremeSubjective.usesSubjectiveMetrics, false);
  });

  it('reads gym_state.workoutLogs from the latest logged week and keeps advanced subjective toggle OFF by default', () => {
    assert.equal(DEFAULT_SUBJECTIVE_TRACKING_ENABLED, false);
    const storage = createMemoryStorage();
    assert.equal(loadAdvancedSubjectiveSetting(storage), false);
    saveAdvancedSubjectiveSetting(true, storage);
    assert.equal(loadAdvancedSubjectiveSetting(storage), true);

    const evalRes = evaluateExerciseDoubleProgressionFromGymState({
      gymState: {
        workoutLogs: {
          w1_0_mon_bench_1: { weight: '135', reps: '12', done: true },
          w1_0_mon_bench_2: { weight: '135', reps: '12', done: true },
          w1_0_mon_bench_3: { weight: '135', reps: '12', done: true }
        }
      },
      exerciseId: 'mon_bench',
      exerciseName: 'Barbell Bench Press',
      currentWeek: 2,
      daySlotIndex: 0,
      targetSets: 3,
      repRangeLabel: '8-12',
      baselineWeight: 135,
      unit: 'lbs'
    });

    assert.equal(evalRes.action, 'increase_weight');
    assert.equal(evalRes.nextTargetWeight, 140);
  });
});

describe('Task 2: Adherence-Neutral Rolling 30-Day Consistency (No Streaks)', () => {
  it('computes rolling 30-day percentage without ever resetting to zero for missed days', () => {
    const ref = new Date('2026-11-23T12:00:00Z');
    const summary = computeRolling30DayConsistencyScore({
      plannedDaysPerWeek: 3, // ~13 planned workouts in 30 days
      completedSessionDates: [
        '2026-10-28',
        '2026-11-02',
        '2026-11-05',
        // Missed a full week here — must NOT reset to 0
        '2026-11-14',
        '2026-11-18',
        '2026-11-21',
        // Older than 30 days — excluded from rolling window
        '2026-09-15'
      ],
      referenceDate: ref
    });

    assert.equal(summary.windowDays, 30);
    assert.equal(summary.streakResetApplied, false);
    assert.equal(summary.completedLast30Days, 6);
    assert.equal(summary.plannedLast30Days, 13);
    assert.equal(summary.consistencyPercent, Math.round((6 / 13) * 100));
    assert.match(summary.encouragementCopy, /Take rest days when you need them/i);
    assert.doesNotMatch(summary.statusLabel, /streak|broken|failed|penalty/i);
  });

  it('removes punitive streak prompts from index.html', () => {
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
    assert.equal(html.includes('Save Your Streak'), false, 'Punitive "Save Your Streak" copy should be removed');
    assert.equal(html.includes('rolling-30day-consistency-text'), true, 'Rolling 30-day consistency element must exist');
  });
});

describe('Task 3: 2-Minute Micro-Start & PWA Rest Timers', () => {
  it('dispatches Service Worker notification + haptic vibration when timer finishes outside Sensory-Calm Mode', async () => {
    const vibrateCalls: unknown[] = [];
    const swNotifications: Array<{ title: string; options: Record<string, unknown> }> = [];

    const mockNav = {
      vibrate: (pattern: number | number[]) => {
        vibrateCalls.push(pattern);
        return true;
      },
      serviceWorker: {
        getRegistration: async () => ({
          showNotification: async (title: string, options: Record<string, unknown>) => {
            swNotifications.push({ title, options });
          }
        })
      }
    } as unknown as Partial<Navigator>;

    class MockNotification {
      static permission = 'granted';
      constructor() {}
    }

    const res = await dispatchRestTimerCompletionAlert({
      title: 'Rest Complete',
      body: 'Start Set 2 when ready',
      isSensoryCalm: false,
      navigatorRef: mockNav,
      notificationCtor: MockNotification as unknown as typeof Notification
    });

    assert.equal(res.notifiedViaServiceWorker, true);
    assert.equal(res.vibrated, true);
    assert.equal(res.mutedBySensoryCalm, false);
    assert.equal(vibrateCalls.length, 1);
    assert.equal(swNotifications.length, 1);
    assert.equal(swNotifications[0].options.silent, false);
  });

  it('mutes vibrations and marks notification silent when Sensory-Calm Mode is active', async () => {
    const vibrateCalls: unknown[] = [];
    const swNotifications: Array<{ title: string; options: Record<string, unknown> }> = [];

    const mockNav = {
      vibrate: (pattern: number | number[]) => {
        vibrateCalls.push(pattern);
        return true;
      },
      serviceWorker: {
        getRegistration: async () => ({
          showNotification: async (title: string, options: Record<string, unknown>) => {
            swNotifications.push({ title, options });
          }
        })
      }
    } as unknown as Partial<Navigator>;

    class MockNotification {
      static permission = 'granted';
      constructor() {}
    }

    const hapticRes = triggerSafeHapticFeedback([200, 100], {
      isSensoryCalm: true,
      navigatorRef: mockNav
    });
    assert.equal(hapticRes, false);

    const res = await dispatchRestTimerCompletionAlert({
      title: 'Rest Complete',
      body: 'Start Set 2 when ready',
      isSensoryCalm: true,
      navigatorRef: mockNav,
      notificationCtor: MockNotification as unknown as typeof Notification
    });

    assert.equal(res.vibrated, false);
    assert.equal(res.mutedBySensoryCalm, true);
    assert.equal(vibrateCalls.length, 0);
    assert.equal(swNotifications[0].options.silent, true);
    assert.equal('vibrate' in swNotifications[0].options, false);
  });

  it('exposes Micro-Start trigger and focus completion wiring in index.html and MicroStartFocusCard.tsx', () => {
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
    const component = fs.readFileSync(path.resolve('src/components/MicroStartFocusCard.tsx'), 'utf8');
    assert.equal(html.includes('2-Minute Micro-Start'), true);
    assert.equal(html.includes('micro-start-trigger-btn'), true);
    assert.equal(html.includes('micro-start-complete-btn'), true);
    assert.equal(component.includes('2-Minute Micro-Start'), true);
  });
});

describe('Task 4: Sensory-Calm Mode (Saturation <5%, Layout Stability, Zero Motion, Audio/Haptic Mute)', () => {
  it('persists and applies sensory-calm class and data attribute to documentElement', () => {
    const storage = createMemoryStorage();
    assert.equal(loadStoredSensoryCalmPreference(storage), false);
    saveSensoryCalmPreference(true, storage);
    assert.equal(storage.getItem(SENSORY_CALM_STORAGE_KEY), 'true');
    assert.equal(loadStoredSensoryCalmPreference(storage), true);

    const classSet = new Set<string>();
    const attrs = new Map<string, string>();
    const mockDoc = {
      documentElement: {
        classList: {
          toggle(cls: string, force?: boolean) {
            if (force) classSet.add(cls);
            else classSet.delete(cls);
          }
        },
        setAttribute(k: string, v: string) {
          attrs.set(k, v);
        }
      }
    } as unknown as Document;

    const onState = applySensoryCalmToDocument(true, mockDoc);
    assert.equal(onState.isSensoryCalm, true);
    assert.equal(onState.audioAndHapticsMuted, true);
    assert.equal(onState.layoutStabilityLocked, true);
    assert.equal(classSet.has('sensory-calm'), true);
    assert.equal(attrs.get('data-sensory-calm'), 'true');

    const offState = applySensoryCalmToDocument(false, mockDoc);
    assert.equal(offState.isSensoryCalm, false);
    assert.equal(classSet.has('sensory-calm'), false);
    assert.equal(attrs.get('data-sensory-calm'), 'false');
  });

  it('enforces <5% saturation, disabled animations, and prefers-reduced-motion in accessibility.css and index.html', () => {
    const css = fs.readFileSync(path.resolve('src/styles/accessibility.css'), 'utf8');
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');

    assert.match(css, /saturate\(([0-4](?:\.\d+)?)%\)/, 'accessibility.css must reduce saturation to <5%');
    assert.match(css, /prefers-reduced-motion:\s*reduce/, 'accessibility.css must respect prefers-reduced-motion');
    assert.match(css, /animation-duration:\s*0\.001ms\s*!important/, 'accessibility.css must disable CSS animations');
    assert.match(css, /transition-duration:\s*0\.001ms\s*!important/, 'accessibility.css must disable CSS transitions');
    assert.match(html, /html\.sensory-calm/, 'index.html must include sensory-calm global CSS');
    assert.match(html, /saturate\(([0-4](?:\.\d+)?)%\)/, 'index.html sensory-calm must reduce saturation to <5%');
  });
});

describe('Task 5: Visual Plate Loader (Dyscalculia Support, 100% Free Beta)', () => {
  it('calculates standard 45 lb barbell loads with color-coded plates per side', () => {
    assert.equal(STANDARD_BAR_WEIGHT_LBS, 45);
    assert.equal(STANDARD_BAR_WEIGHT_KG, 20);

    // 225 lbs = 45 bar + (45 + 45) per side -> two Blue 45s
    const load225 = calculateVisualBarbellPlates(225);
    assert.deepEqual(
      load225.platesPerSide.map((p) => ({ weight: p.weight, color: p.colorName })),
      [
        { weight: 45, color: 'Blue' },
        { weight: 45, color: 'Blue' }
      ]
    );
    assert.equal(load225.perSideWeight, 90);

    // 185 lbs = 45 bar + (45 + 25) per side -> Blue 45 + Green 25
    const load185 = calculateVisualBarbellPlates(185);
    assert.deepEqual(
      load185.platesPerSide.map((p) => ({ weight: p.weight, color: p.colorName })),
      [
        { weight: 45, color: 'Blue' },
        { weight: 25, color: 'Green' }
      ]
    );

    // 165 lbs = 45 bar + (45 + 10 + 5) per side -> Blue 45 + White 10 + Red 5
    const load165 = calculateVisualBarbellPlates(165);
    assert.deepEqual(
      load165.platesPerSide.map((p) => ({ weight: p.weight, color: p.colorName })),
      [
        { weight: 45, color: 'Blue' },
        { weight: 10, color: 'White' },
        { weight: 5, color: 'Red' }
      ]
    );

    // 100 lbs = 45 bar + (25 + 2.5) per side -> Green 25 + Purple 2.5
    const load100 = calculateVisualBarbellPlates(100);
    assert.deepEqual(
      load100.platesPerSide.map((p) => ({ weight: p.weight, color: p.colorName })),
      [
        { weight: 25, color: 'Green' },
        { weight: 2.5, color: 'Purple' }
      ]
    );

    // 45 lbs = empty bar
    const load45 = calculateVisualBarbellPlates(45);
    assert.equal(load45.isEmptyBar, true);
    assert.equal(load45.platesPerSide.length, 0);
  });

  it('renders accessible inline SVG markup with zero paywall gating and zero px font sizes', () => {
    const svgHtml = buildVisualPlateLoaderSvgHtml(185);
    assert.equal(svgHtml.includes('<svg'), true);
    assert.equal(svgHtml.includes('#2563EB'), true, 'Blue 45 lb plate fill must appear');
    assert.equal(svgHtml.includes('#16A34A'), true, 'Green 25 lb plate fill must appear');
    assert.equal(/font-size:\s*[0-9.]+px/i.test(svgHtml), false, 'SVG must use relative rem font sizes, never px');
    assert.equal(/paywall|upgrade to pro|premium locked|subscribe to unlock/i.test(svgHtml), false);

    const reactComp = fs.readFileSync(path.resolve('src/components/VisualPlateLoader.tsx'), 'utf8');
    assert.equal(/paywall|upgrade to pro|premium locked|subscribe to unlock/i.test(reactComp), false);
    assert.equal(/font-size:\s*[0-9.]+px|text-\[[0-9.]+px\]/i.test(reactComp), false);
  });
});
