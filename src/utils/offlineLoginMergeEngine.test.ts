import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  CONFLICT_BACKUP_SNAPSHOT_KEY,
  SYNC_CONFLICT_MODAL_QUESTION,
  SYNC_OUTBOX_STORAGE_KEY,
  buildLocalWinsMergedState,
  enqueueSyncOutboxAction,
  evaluatePreLoginSyncStrategy,
  extractCompletedSetFingerprints,
  flushSyncOutboxToSupabase,
  loadConflictBackupSnapshot,
  readSyncOutbox,
  saveConflictBackupSnapshot
} from './offlineLoginMergeEngine';
import type { StorageAdapter } from './offlineSyncQueue';

function createMemoryStorage(): StorageAdapter & { dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    dump: () => Object.fromEntries(map.entries())
  };
}

describe('Offline-First Pre-Login Merge & Conflict Engine', () => {
  it('Step 2: executes Local Wins when local Guest Mode has completed workouts and cloud profile is blank (even if cloud updatedAt is newer)', () => {
    const localGuestState = {
      isGuestMode: true,
      userProfile: { name: 'Guest', email: '', isGuest: true },
      workoutLogs: {
        w1_0_bench_press_1: { weight: '135', reps: '10', unit: 'lbs', done: true },
        w1_0_bench_press_2: { weight: '135', reps: '9', unit: 'lbs', done: true },
        '0_bench_press_1': { weight: '135', reps: '10', unit: 'lbs', done: true } // legacy Week 1 mirror should not double-count
      },
      pullupLogs: {
        w1_day_1_set_1: { reps: '8', done: true }
      },
      updatedAt: '2026-11-26T10:00:00.000Z'
    };

    const blankCloudState = {
      userProfile: { name: 'François', email: 'francois@example.com', isGuest: false },
      workoutLogs: {},
      pullupLogs: {},
      updatedAt: '2026-11-26T12:00:00.000Z' // newer blank timestamp!
    };

    const evalRes = evaluatePreLoginSyncStrategy({
      localState: localGuestState,
      cloudState: blankCloudState,
      cloudUpdatedAt: blankCloudState.updatedAt
    });

    assert.equal(evalRes.decision, 'local_wins');
    assert.equal(evalRes.reason, 'cloud_empty_local_has_workouts');
    assert.equal(evalRes.localCompletedCount, 3);
    assert.equal(evalRes.cloudCompletedCount, 0);

    const merged = buildLocalWinsMergedState(
      localGuestState,
      {
        email: 'francois@example.com',
        name: 'François',
        supabaseUserId: 'uid-123',
        authProvider: 'magic_link'
      },
      '2026-11-26T12:05:00.000Z'
    );

    assert.equal(merged.isGuestMode, false);
    assert.equal(merged.userProfile.isGuest, false);
    assert.equal(merged.userProfile.email, 'francois@example.com');
    assert.equal(merged.userProfile.name, 'François');
    assert.equal(merged.workoutLogs.w1_0_bench_press_1.done, true);
    assert.equal(merged.pullupLogs.w1_day_1_set_1.reps, '8');
    assert.equal(merged.updatedAt, '2026-11-26T12:05:00.000Z');
    assert.equal(merged.last_updated, '2026-11-26T12:05:00.000Z');
  });

  it('Step 2: chooses Cloud Wins safely when local device is completely blank and cloud holds saved workouts', () => {
    const emptyLocal = {
      workoutLogs: {},
      pullupLogs: {},
      updatedAt: '2026-11-26T12:00:00.000Z'
    };
    const populatedCloud = {
      workoutLogs: {
        w3_0_incline_db_1: { weight: '55', reps: '10', unit: 'lbs', done: true },
        w3_0_incline_db_2: { weight: '55', reps: '10', unit: 'lbs', done: true }
      },
      updatedAt: '2026-11-25T15:00:00.000Z'
    };

    const evalRes = evaluatePreLoginSyncStrategy({
      localState: emptyLocal,
      cloudState: populatedCloud,
      cloudUpdatedAt: populatedCloud.updatedAt
    });

    assert.equal(evalRes.decision, 'cloud_wins');
    assert.equal(evalRes.localCompletedCount, 0);
    assert.equal(evalRes.cloudCompletedCount, 2);
  });

  it('Step 4: triggers User Safety Conflict Prompt with the exact required question when both sides hold different completed sets', () => {
    const cloudLogs: Record<string, any> = {};
    for (let i = 1; i <= 20; i++) {
      cloudLogs[`w2_0_cloud_ex_${i}`] = { weight: '100', reps: '10', unit: 'lbs', done: true };
    }
    const localLogs: Record<string, any> = {};
    for (let i = 1; i <= 5; i++) {
      localLogs[`w1_0_phone_ex_${i}`] = { weight: '80', reps: '12', unit: 'lbs', done: true };
    }

    const evalRes = evaluatePreLoginSyncStrategy({
      localState: { workoutLogs: localLogs, updatedAt: '2026-11-26T14:00:00.000Z' },
      cloudState: { workoutLogs: cloudLogs, updatedAt: '2026-11-25T14:00:00.000Z' },
      cloudUpdatedAt: '2026-11-25T14:00:00.000Z'
    });

    assert.equal(evalRes.decision, 'conflict_prompt');
    assert.equal(
      evalRes.question,
      "We found unsynced workouts on this device. Do you want to keep your phone's data or download your cloud backup?"
    );
    assert.equal(evalRes.question, SYNC_CONFLICT_MODAL_QUESTION);
    assert.equal(evalRes.localCompletedCount, 5);
    assert.equal(evalRes.cloudCompletedCount, 20);
    assert.equal(evalRes.uniqueLocalSetKeys.length, 5);
    assert.equal(evalRes.uniqueCloudSetKeys.length, 20);
  });

  it('Step 4 (Confirmed Safety Rule): archives a local backup snapshot of cloud data before overwriting cloud on Keep Phone Data', () => {
    const storage = createMemoryStorage();
    const cloudBackup = {
      workoutLogs: {
        w2_0_squat_1: { weight: '185', reps: '8', unit: 'lbs', done: true }
      },
      updatedAt: '2026-11-25T09:00:00.000Z'
    };

    const saved = saveConflictBackupSnapshot({
      source: 'cloud_before_local_overwrite',
      gymState: cloudBackup,
      accountEmail: 'Francois@Example.com',
      storage,
      nowIso: '2026-11-26T15:00:00.000Z'
    });

    assert.ok(saved);
    assert.equal(saved.source, 'cloud_before_local_overwrite');
    assert.equal(saved.accountEmail, 'francois@example.com');
    assert.equal(saved.completedSetsCount, 1);
    assert.ok(storage.getItem(CONFLICT_BACKUP_SNAPSHOT_KEY));

    const loaded = loadConflictBackupSnapshot(storage);
    assert.ok(loaded);
    assert.equal(loaded.gymState.workoutLogs.w2_0_squat_1.weight, '185');
  });

  it('Step 3: saves offline completed sets into both gym_state and sync_outbox, then flushes automatically on reconnect', async () => {
    const storage = createMemoryStorage();
    const localState = {
      workoutLogs: {
        w1_0_bench_1: { weight: '135', reps: '10', unit: 'lbs', done: true }
      },
      userProfile: { email: '', isGuest: true }
    };

    // Offline set done while in Guest Mode (no endpoint yet)
    const q1 = await enqueueSyncOutboxAction({
      stateObj: localState,
      actionType: 'set_logged',
      setKey: 'w1_0_bench_1',
      exerciseId: 'bench',
      endpoint: '',
      localStateStorageKey: 'bws_vegan_7am_app_v1',
      storage,
      nowIso: '2026-11-26T14:30:00.000Z'
    });

    assert.equal(q1.savedLocally, true);
    assert.equal(q1.queueLength, 1);
    assert.ok(storage.getItem('bws_vegan_7am_app_v1'));
    assert.ok(storage.getItem(SYNC_OUTBOX_STORAGE_KEY));
    assert.equal(readSyncOutbox(storage).length, 1);

    // Attempt flush while still offline -> stays queued
    const offlineFlush = await flushSyncOutboxToSupabase({
      storage,
      navigatorLike: { onLine: false },
      resolveEndpoint: () => 'https://example.test/api/state?email=francois@example.com'
    });
    assert.equal(offlineFlush.online, false);
    assert.equal(offlineFlush.flushedCount, 0);
    assert.equal(readSyncOutbox(storage).length, 1);

    // Come back online -> pushes to resolved Supabase endpoint and clears sync_outbox
    const pushedCalls: Array<{ url: string; method: string; body: string }> = [];
    const onlineFlush = await flushSyncOutboxToSupabase({
      storage,
      navigatorLike: { onLine: true },
      resolveEndpoint: () => 'https://example.test/api/state?email=francois@example.com',
      getLatestLocalState: () => ({
        ...localState,
        userProfile: { email: 'francois@example.com', isGuest: false }
      }),
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        pushedCalls.push({
          url: String(url),
          method: String(init?.method || 'GET'),
          body: String(init?.body || '')
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({ configured: true, saved: true, last_updated: '2026-11-26T14:35:00.000Z' })
        } as unknown as Response;
      }) as typeof fetch
    });

    assert.equal(onlineFlush.online, true);
    assert.equal(onlineFlush.flushedCount, 1);
    assert.equal(onlineFlush.remainingCount, 0);
    assert.equal(pushedCalls.length, 1);
    assert.equal(pushedCalls[0].url, 'https://example.test/api/state?email=francois@example.com');
    assert.equal(pushedCalls[0].method, 'POST');
    assert.ok(pushedCalls[0].body.includes('w1_0_bench_1'));
    assert.equal(readSyncOutbox(storage).length, 0);
  });

  it('extractCompletedSetFingerprints counts unique completed lifts, pullups, and cardio cleanly', () => {
    const inv = extractCompletedSetFingerprints({
      workoutLogs: {
        w1_0_ex1_1: { weight: '100', reps: '10', unit: 'lbs', done: true },
        w1_0_ex1_2: { weight: '100', reps: '10', unit: 'lbs', done: false }
      },
      pullupLogs: {
        w1_day_1_set_1: { reps: '7', done: true }
      },
      cardioLogs: {
        w1_d0_bike: { durationMin: 20, done: true }
      }
    });
    assert.equal(inv.totalCount, 3);
  });

  it('Zero Deletion Policy & index.html Offline-First wiring check', () => {
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
    // Required Step 1-4 elements and exact safety modal prompt
    assert.ok(html.includes('runPreLoginMergeGuard'), 'runPreLoginMergeGuard must be wired');
    assert.ok(html.includes('sync-conflict-safety-modal'), 'User safety conflict modal must exist');
    assert.ok(
      html.includes("We found unsynced workouts on this device. Do you want to keep your phone's data or download your cloud backup?"),
      'Exact conflict safety question must be present'
    );
    assert.ok(html.includes('sync-conflict-keep-phone-btn'), 'Keep Phone Data button must exist');
    assert.ok(html.includes('sync-conflict-download-cloud-btn'), 'Download Cloud Backup button must exist');
    assert.ok(html.includes('flushSyncOutboxAndNotifyLocal'), 'Online outbox flusher must exist');
    assert.ok(html.includes('saveConflictBackupSnapshot'), 'Cloud backup snapshot safeguard must be wired');
    // Zero Deletion Policy: existing UI controls remain intact
    assert.ok(html.includes('open-smart-login-btn'), 'Header sign-in button preserved');
    assert.ok(html.includes('force-pull-cloud-btn'), 'Manual Force Pull from Cloud button preserved');
    assert.ok(html.includes('missed-set-one-modal'), 'Missed Set 1 modal preserved');
  });
});
