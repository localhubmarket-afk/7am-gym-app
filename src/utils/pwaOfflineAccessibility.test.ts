import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  clearAllGymIndexedDbStores,
  getPendingIndexedDbSyncItems,
  loadGymStateFromIndexedDB,
  saveGymStateToIndexedDB
} from './gymIndexedDb';
import {
  flushIndexedDbSyncOutbox,
  hydrateGymStateLocalFirst,
  persistGymStateLocalFirst
} from './offlineFirstSync';
import { computeAdherenceNeutralWeeklyProgress } from './adherenceEngine';
import { buildStartFreshGymState } from './startFreshReset';
import { deleteAllWeeksCompleteReset } from './deletionValidation';

test('IndexedDB local-first storage writes and reads gym_state immediately while stripping undo backup', async () => {
  await clearAllGymIndexedDbStores();

  const saved = await saveGymStateToIndexedDB({
    currentWeek: 3,
    selectedDayIndex: 1,
    workoutLogs: {
      w3_d0_pullups: [{ weight: 0, reps: 8, done: true }]
    },
    fullStateUndoBackup: { huge: true },
    last_updated: '2026-11-23T10:00:00.000Z'
  });

  assert.equal(saved.lastUpdated, '2026-11-23T10:00:00.000Z');
  assert.equal('fullStateUndoBackup' in saved.gymState, false);

  const loaded = await loadGymStateFromIndexedDB();
  assert.ok(loaded);
  assert.equal(loaded.gymState.currentWeek, 3);
  assert.equal(loaded.gymState.workoutLogs.w3_d0_pullups[0].reps, 8);
});

test('Offline-first sync saves locally when offline and pushes to Supabase backend automatically once online', async () => {
  await clearAllGymIndexedDbStores();

  let fetchCalls: Array<{ url: string; body: string }> = [];
  const mockFetch = (async (input: any, init?: any) => {
    fetchCalls.push({
      url: String(input),
      body: String(init?.body || '')
    });
    return { ok: true, status: 200 } as Response;
  }) as typeof fetch;

  // 1. Offline save: writes to IndexedDB and queues without calling network
  const offlineRes = await persistGymStateLocalFirst({
    stateObj: {
      currentWeek: 2,
      workoutLogs: {
        w2_d0_bench: [{ weight: 155, reps: 8, done: true }]
      },
      last_updated: '2026-11-23T11:00:00.000Z'
    },
    endpoint: '/api/state?user=francois',
    reason: 'log_set_offline',
    fetchImpl: mockFetch,
    onlineOverride: false
  });

  assert.equal(offlineRes.savedToIndexedDb, true);
  assert.equal(offlineRes.queuedForSync, true);
  assert.equal(offlineRes.pushedToSupabase, false);
  assert.equal(offlineRes.pendingCount, 1);
  assert.equal(fetchCalls.length, 0);

  // 2. Network returns: background flush pushes queued gym_state to Supabase & clears outbox
  const flushRes = await flushIndexedDbSyncOutbox({
    fetchImpl: mockFetch,
    onlineOverride: true
  });

  assert.equal(flushRes.attempted, 1);
  assert.equal(flushRes.flushed, 1);
  assert.equal(flushRes.remaining, 0);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, '/api/state?user=francois');
  const pushedPayload = JSON.parse(fetchCalls[0].body);
  assert.equal(pushedPayload.workoutLogs.w2_d0_bench[0].weight, 155);

  const remaining = await getPendingIndexedDbSyncItems();
  assert.equal(remaining.length, 0);
});

test('Local-first hydration picks newest timestamp between IndexedDB and localStorage', async () => {
  await clearAllGymIndexedDbStores();

  await saveGymStateToIndexedDB({
    currentWeek: 4,
    last_updated: '2026-11-23T12:00:00.000Z'
  });

  const hydratedFromIdb = await hydrateGymStateLocalFirst({
    localStorageState: {
      currentWeek: 2,
      last_updated: '2026-11-23T09:00:00.000Z'
    }
  });
  assert.equal(hydratedFromIdb.source, 'indexeddb');
  assert.equal(hydratedFromIdb.state?.currentWeek, 4);

  const hydratedFromLs = await hydrateGymStateLocalFirst({
    localStorageState: {
      currentWeek: 5,
      last_updated: '2026-11-23T15:00:00.000Z'
    }
  });
  assert.equal(hydratedFromLs.source, 'localstorage');
  assert.equal(hydratedFromLs.state?.currentWeek, 5);
});

test('PWA manifest and service-worker.ts meet offline-first and installability standards', () => {
  const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.short_name.length <= 12);

  const has192Any = manifest.icons.some(
    (i: any) => i.sizes === '192x192' && i.purpose === 'any' && i.type === 'image/png'
  );
  const has512Any = manifest.icons.some(
    (i: any) => i.sizes === '512x512' && i.purpose === 'any' && i.type === 'image/png'
  );
  const has512Maskable = manifest.icons.some(
    (i: any) => i.sizes === '512x512' && i.purpose === 'maskable' && i.type === 'image/png'
  );
  assert.equal(has192Any, true);
  assert.equal(has512Any, true);
  assert.equal(has512Maskable, true);

  assert.ok(fs.existsSync(path.resolve(process.cwd(), 'public/apple-touch-icon.png')));
  assert.ok(fs.existsSync(path.resolve(process.cwd(), 'public/pwa-maskable-512x512.png')));

  const swSource = fs.readFileSync(path.resolve(process.cwd(), 'src/service-worker.ts'), 'utf8');
  assert.match(swSource, /budget_gym_offline_db/);
  assert.match(swSource, /sync_outbox/);
  assert.match(swSource, /sync-gym-state/);
  assert.match(swSource, /FLUSH_GYM_STATE_SYNC/);
});

test('WCAG 2.2 AA audit: relative rem typography, pinch-zoom enabled, 44x44px touch targets, ARIA live/timer roles', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

  // Viewport must allow user scaling (SC 1.4.4)
  assert.doesNotMatch(html, /user-scalable=no/i);
  assert.doesNotMatch(html, /maximum-scale=1(\.0)?/i);

  // Zero absolute px typography classes in index.html & src/components/
  assert.doesNotMatch(html, /text-\[[0-9.]+px\]/);
  assert.doesNotMatch(html, /font-size:\s*[0-9.]+px/);

  const componentsDir = path.resolve(process.cwd(), 'src/components');
  for (const file of fs.readdirSync(componentsDir)) {
    if (!file.endsWith('.tsx')) continue;
    const content = fs.readFileSync(path.join(componentsDir, file), 'utf8');
    assert.doesNotMatch(content, /text-\[[0-9.]+px\]/, `${file} must not use px font sizes`);
  }

  // Minimum 44x44px (upgraded to 48x48px) touch targets & ARIA semantics
  assert.match(html, /min-height:\s*(44|48)px/);
  assert.match(html, /min-width:\s*(44|48)px/);
  assert.match(html, /id="header-timer-display"[^>]*role="timer"/);
  assert.match(html, /id="main-timer-display"[^>]*role="timer"/);
  assert.match(html, /id="adherence-neutral-status-text"[^>]*aria-live="polite"/);
});

test('Connected Adherence-Neutral Weekly Goal dynamically drops to 0 on Start Fresh and Delete All Weeks', () => {
  const activeState = {
    currentWeek: 2,
    weeklyWorkoutTarget: 5,
    workoutLogs: {
      w2_0_mon_pullups_1: { weight: 0, reps: 8, done: true },
      w2_1_tue_bench_1: { weight: 135, reps: 8, done: true },
      w2_2_wed_squat_1: { weight: 185, reps: 6, done: true },
      w2_3_thu_row_1: { weight: 115, reps: 10, done: true }
    },
    pullupLogs: {},
    cardioLogs: {}
  };

  const beforeReset = computeAdherenceNeutralWeeklyProgress({
    weekNumber: activeState.currentWeek,
    weeklyTarget: activeState.weeklyWorkoutTarget,
    workoutLogs: activeState.workoutLogs,
    pullupLogs: activeState.pullupLogs,
    cardioLogs: activeState.cardioLogs
  });
  assert.equal(beforeReset.completedWorkoutsCount, 4);
  assert.equal(beforeReset.statusLabel, '4 of 5 workouts completed this week');

  // 1. Start Fresh resets workoutLogs -> Weekly Goal drops dynamically to 0
  const freshState = buildStartFreshGymState(activeState);
  const afterStartFresh = computeAdherenceNeutralWeeklyProgress({
    weekNumber: freshState.currentWeek,
    weeklyTarget: 5,
    workoutLogs: freshState.workoutLogs,
    pullupLogs: freshState.pullupLogs,
    cardioLogs: freshState.cardioLogs
  });
  assert.equal(afterStartFresh.completedWorkoutsCount, 0);
  assert.equal(afterStartFresh.statusLabel, '0 of 5 workouts completed this week');

  // 2. Delete All Weeks resets workoutLogs -> Weekly Goal drops dynamically to 0
  const clearedAll = deleteAllWeeksCompleteReset(activeState);
  const afterDeleteAll = computeAdherenceNeutralWeeklyProgress({
    weekNumber: clearedAll.currentWeek,
    weeklyTarget: 5,
    workoutLogs: clearedAll.workoutLogs,
    pullupLogs: clearedAll.pullupLogs,
    cardioLogs: clearedAll.cardioLogs
  });
  assert.equal(afterDeleteAll.completedWorkoutsCount, 0);
  assert.equal(afterDeleteAll.statusLabel, '0 of 5 workouts completed this week');
});
