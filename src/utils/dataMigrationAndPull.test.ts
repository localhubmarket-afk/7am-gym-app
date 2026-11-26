import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  DATA_BACKUP_MIGRATION_TITLE,
  DEFAULT_BACKUP_FILENAME,
  FORCE_PULL_CLOUD_LABEL,
  FORCE_PULL_SUCCESS_TOAST,
  forcePullGymStateFromCloud,
  importGymStateFromJsonText,
  resolveAuthenticatedGymStateIds,
  serializeGymStateForJsonExport,
  triggerGymStateJsonDownload,
  validateGymStateBackupSchema
} from './dataMigrationAndPull';
import { createSupabaseRealtimeSyncManager } from './realtimeAutoSync';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map.entries());
    }
  };
}

test('Task 1: resolveAuthenticatedGymStateIds prioritizes Supabase Auth user.id and user_<email>', async () => {
  const fakeSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'auth-uuid-999', email: 'BetaTester@Example.com' } },
        error: null
      })
    }
  };

  const resolved = await resolveAuthenticatedGymStateIds({
    userEmail: 'fallback@example.com',
    supabaseClient: fakeSupabase
  });

  assert.equal(resolved.authUserId, 'auth-uuid-999');
  assert.equal(resolved.primaryId, 'auth-uuid-999');
  assert.deepEqual(resolved.candidateIds, [
    'auth-uuid-999',
    'user_betatester@example.com',
    'user_fallback@example.com'
  ]);
});

test('Task 1: forcePullGymStateFromCloud queries Supabase gym_state by authenticated user ID and completely overwrites local state & localStorage', async () => {
  const storageKey = 'bws_vegan_7am_app_v1';
  const staleLocalState = {
    selectedDayIndex: 0,
    currentWeek: 1,
    workoutLogs: { 'w1_d0_bench_0': { weight: 100, reps: 5, done: true } },
    last_updated: '2026-11-24T12:00:00.000Z'
  };
  const storage = createMemoryStorage({
    [storageKey]: JSON.stringify(staleLocalState)
  });

  const authoritativeCloudPayload = {
    selectedDayIndex: 3,
    currentWeek: 4,
    selectedWeek: 4,
    workoutLogs: {
      'w4_d3_squat_0': { weight: 225, reps: 8, done: true },
      'w4_d3_squat_1': { weight: 225, reps: 8, done: true }
    },
    pullupLogs: { 'w4_d3_0': { reps: 12, done: true } },
    last_updated: '2026-11-23T08:00:00.000Z' // Older than local on purpose — Force Pull MUST still overwrite!
  };

  const queriedIds: string[] = [];
  const fakeSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'auth-user-42', email: 'tester@gym.app' } },
        error: null
      })
    },
    from: (table: string) => {
      assert.equal(table, 'gym_state');
      return {
        select: () => ({
          eq: (_col: string, val: string) => {
            queriedIds.push(val);
            return {
              maybeSingle: async () => {
                if (val === 'auth-user-42') {
                  return {
                    data: {
                      id: 'auth-user-42',
                      data: authoritativeCloudPayload,
                      updated_at: '2026-11-23T08:00:00.000Z'
                    },
                    error: null
                  };
                }
                return { data: null, error: null };
              }
            };
          }
        })
      };
    }
  };

  let overwrittenState: any = null;
  const result = await forcePullGymStateFromCloud({
    userEmail: 'tester@gym.app',
    storageKey,
    storage,
    supabaseClient: fakeSupabase,
    isOnlineFn: () => true,
    onStateOverwritten: (cloudState) => {
      overwrittenState = cloudState;
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, 'supabase_table');
  assert.equal(result.recordId, 'auth-user-42');
  assert.equal(result.toastMessage, FORCE_PULL_SUCCESS_TOAST);
  assert.deepEqual(queriedIds, ['auth-user-42']);
  assert.equal(overwrittenState.currentWeek, 4);
  assert.equal(overwrittenState.workoutLogs['w4_d3_squat_0'].weight, 225);
  assert.equal(overwrittenState.workoutLogs['w1_d0_bench_0'], undefined);

  const persisted = JSON.parse(storage.getItem(storageKey)!);
  assert.equal(persisted.currentWeek, 4);
  assert.equal(persisted.selectedDayIndex, 3);
  assert.equal(persisted.workoutLogs['w4_d3_squat_1'].reps, 8);
});

test('Task 1: forcePullGymStateFromCloud falls back to /api/state and fails safely when offline', async () => {
  const storageKey = 'bws_vegan_7am_app_v1';
  const storage = createMemoryStorage();

  const offlineRes = await forcePullGymStateFromCloud({
    storageKey,
    storage,
    supabaseClient: null,
    isOnlineFn: () => false
  });
  assert.equal(offlineRes.ok, false);
  assert.match(offlineRes.toastMessage, /offline/i);

  let appliedFromApi: any = null;
  const apiRes = await forcePullGymStateFromCloud({
    userEmail: 'beta@gym.app',
    storageKey,
    storage,
    supabaseClient: null,
    apiEndpoint: '/api/state?email=beta%40gym.app',
    isOnlineFn: () => true,
    fetchImpl: (async () => ({
      ok: true,
      json: async () => ({
        configured: true,
        accountId: 'user_beta@gym.app',
        last_updated: '2026-11-24T01:00:00.000Z',
        data: {
          selectedDayIndex: 2,
          currentWeek: 3,
          workoutLogs: { 'w3_d2_row_0': { weight: 95, reps: 10, done: true } }
        }
      })
    })) as unknown as typeof fetch,
    onStateOverwritten: (st) => {
      appliedFromApi = st;
    }
  });

  assert.equal(apiRes.ok, true);
  assert.equal(apiRes.source, 'api_state');
  assert.equal(appliedFromApi.currentWeek, 3);
  assert.equal(appliedFromApi.workoutLogs['w3_d2_row_0'].weight, 95);
});

test('Task 1: SupabaseRealtimeSyncManager.forcePullFromCloud cancels queued debounced push and overwrites local state', async () => {
  const storage = createMemoryStorage();
  let localState: any = {
    selectedDayIndex: 0,
    currentWeek: 1,
    workoutLogs: {},
    userProfile: { email: 'user@gym.app', name: 'Beta' },
    last_updated: '2026-11-24T10:00:00.000Z'
  };

  let pushTimerCancelled = false;
  let remoteAppliedCount = 0;

  const fakeSupabase = {
    channel: () => ({
      on: function () {
        return this;
      },
      subscribe: function () {
        return this;
      }
    }),
    removeChannel: async () => {},
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'user_user@gym.app',
              updated_at: '2026-11-22T09:00:00.000Z',
              data: {
                selectedDayIndex: 4,
                currentWeek: 2,
                workoutLogs: { 'w2_d4_rdl_0': { weight: 185, reps: 8, done: true } }
              }
            },
            error: null
          })
        })
      })
    })
  };

  const manager = createSupabaseRealtimeSyncManager({
    getLocalState: () => localState,
    getRecordId: () => 'user_user@gym.app',
    getApiEndpoint: () => '',
    storage,
    supabaseClient: fakeSupabase,
    isOnlineFn: () => true,
    setTimer: () => 123 as any,
    clearTimer: () => {
      pushTimerCancelled = true;
    },
    onRemoteStateApplied: (nextState) => {
      localState = nextState;
      remoteAppliedCount += 1;
    }
  });

  manager.scheduleDebouncedPush(localState, 'set_logged');
  const pullRes = await manager.forcePullFromCloud();

  assert.equal(pushTimerCancelled, true);
  assert.equal(pullRes.ok, true);
  assert.equal(remoteAppliedCount, 1);
  assert.equal(localState.currentWeek, 2);
  assert.equal(localState.workoutLogs['w2_d4_rdl_0'].weight, 185);
});

test('Task 2: validateGymStateBackupSchema validates schema, unwraps export envelope, rejects bad payloads, and strips prototype keys', () => {
  const validRaw = {
    selectedDayIndex: 1,
    currentWeek: 2,
    workoutLogs: { 'w2_d1_press_0': { weight: 135, reps: 8, done: true } },
    pullupLogs: {}
  };
  const exportedJson = serializeGymStateForJsonExport(validRaw, '2026-11-24T00:00:00.000Z');
  const parsedExport = JSON.parse(exportedJson);
  assert.equal(parsedExport.schemaVersion, 1);
  assert.equal(parsedExport.backupFormat, '7am-gym-app-backup');

  const validCheck = validateGymStateBackupSchema(parsedExport);
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.summary?.loggedSetsCount, 1);
  assert.equal(validCheck.summary?.currentWeek, 2);

  // Reject unrelated JSON object
  const wrongSchema = validateGymStateBackupSchema({ foo: 'bar', count: 42 });
  assert.equal(wrongSchema.valid, false);
  assert.ok(wrongSchema.errors.length > 0);

  // Reject bad field types & out-of-range day index
  const badTypes = validateGymStateBackupSchema({
    workoutLogs: 'not-an-object',
    selectedDayIndex: 99,
    currentWeek: 0
  });
  assert.equal(badTypes.valid, false);
  assert.equal(badTypes.errors.length, 3);

  // Strip prototype pollution keys cleanly
  const polluted = JSON.parse(
    '{"selectedDayIndex":0,"currentWeek":1,"workoutLogs":{},"__proto__":{"polluted":true}}'
  );
  const cleanRes = validateGymStateBackupSchema(polluted);
  assert.equal(cleanRes.valid, true);
  assert.equal(Object.prototype.hasOwnProperty.call(cleanRes.normalizedState, '__proto__'), false);
});

test('Task 2: triggerGymStateJsonDownload defaults to 7am_gym_backup.json and produces valid JSON', () => {
  const res = triggerGymStateJsonDownload({
    selectedDayIndex: 0,
    currentWeek: 3,
    workoutLogs: { 'w3_d0_bench_0': { weight: 155, reps: 8, done: true } }
  });
  assert.equal(res.ok, true);
  assert.equal(res.filename, DEFAULT_BACKUP_FILENAME);
  assert.equal(res.filename, '7am_gym_backup.json');
  assert.ok(res.bytes > 50);
  const parsed = JSON.parse(res.jsonText);
  assert.equal(parsed.gym_state.currentWeek, 3);
});

test('Task 2: importGymStateFromJsonText overwrites local state, preserves active account identity, and immediately pushes to Supabase', async () => {
  const storageKey = 'bws_vegan_7am_app_v1';
  const storage = createMemoryStorage();

  const sourceBackupJson = serializeGymStateForJsonExport({
    selectedDayIndex: 2,
    currentWeek: 5,
    selectedWeek: 5,
    workoutLogs: {
      'w5_d2_bench_0': { weight: 175, reps: 8, done: true },
      'w5_d2_bench_1': { weight: 175, reps: 8, done: true }
    },
    fuelLogs: { '2026-11-23': { calories: 2350, protein: 145 } },
    userProfile: {
      name: 'Old Beta Account',
      email: 'old-beta@example.com',
      authProvider: 'email_password'
    },
    last_updated: '2026-11-20T12:00:00.000Z'
  });

  const activeAccountState: any = {
    selectedDayIndex: 0,
    currentWeek: 1,
    workoutLogs: {},
    userProfile: {
      name: 'Francois',
      email: 'new-active@example.com',
      authProvider: 'google'
    },
    last_updated: '2026-11-23T12:00:00.000Z'
  };

  let localAppliedState: any = null;
  let pushedToSupabaseState: any = null;

  const importRes = await importGymStateFromJsonText({
    jsonText: sourceBackupJson,
    currentState: activeAccountState,
    preserveActiveAccountProfile: true,
    storageKey,
    storage,
    onApplyLocalState: (next) => {
      localAppliedState = next;
    },
    pushToSupabase: async (next) => {
      pushedToSupabaseState = next;
      return { pushed: true, lastUpdated: next.last_updated || null };
    }
  });

  assert.equal(importRes.ok, true);
  assert.equal(importRes.pushedToCloud, true);
  assert.equal(importRes.summary?.loggedSetsCount, 2);
  assert.equal(localAppliedState.currentWeek, 5);
  assert.equal(localAppliedState.workoutLogs['w5_d2_bench_0'].weight, 175);
  // Active account identity is preserved so migrated data saves under the active account in Supabase!
  assert.equal(localAppliedState.userProfile.email, 'new-active@example.com');
  assert.equal(localAppliedState.userProfile.name, 'Francois');
  // Immediate Supabase cloud push was invoked with the newly stamped migrated state
  assert.ok(pushedToSupabaseState);
  assert.equal(pushedToSupabaseState.currentWeek, 5);
  assert.equal(pushedToSupabaseState.userProfile.email, 'new-active@example.com');

  const persisted = JSON.parse(storage.getItem(storageKey)!);
  assert.equal(persisted.currentWeek, 5);
  assert.equal(persisted.userProfile.email, 'new-active@example.com');

  // Invalid JSON should fail cleanly without triggering cloud push
  let invalidPushCalled = false;
  const badRes = await importGymStateFromJsonText({
    jsonText: '{ not valid json',
    storageKey,
    storage,
    pushToSupabase: async () => {
      invalidPushCalled = true;
      return { pushed: true };
    }
  });
  assert.equal(badRes.ok, false);
  assert.equal(invalidPushCalled, false);
});

test('Zero-Deletion Audit: Force Pull from Cloud and Data Backup & Migration coexist with Force Sync Now and existing Settings controls', () => {
  const root = process.cwd();
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const autoSyncComp = fs.readFileSync(
    path.join(root, 'src/components/AutoSyncSettingsControl.tsx'),
    'utf8'
  );
  const migrationComp = fs.readFileSync(
    path.join(root, 'src/components/DataMigrationPanel.tsx'),
    'utf8'
  );
  const settingsComp = fs.readFileSync(
    path.join(root, 'src/components/AccessibilitySettingsPanel.tsx'),
    'utf8'
  );

  // Task 1: Both Force Sync Now and Force Pull from Cloud exist side-by-side
  assert.ok(indexHtml.includes('id="force-sync-now-btn"'));
  assert.ok(indexHtml.includes('id="force-pull-cloud-btn"'));
  assert.ok(indexHtml.includes(FORCE_PULL_CLOUD_LABEL));
  assert.ok(autoSyncComp.includes('data-testid="force-sync-now-btn"'));
  assert.ok(autoSyncComp.includes('data-testid="force-pull-cloud-btn"'));

  // Task 2: Data Backup & Migration section with Export & Import buttons
  assert.ok(indexHtml.includes('id="data-backup-migration-card"'));
  assert.ok(indexHtml.includes('Data Backup &amp; Migration'));
  assert.ok(indexHtml.includes('id="export-gym-json-btn"'));
  assert.ok(indexHtml.includes('id="import-gym-json-btn"'));
  assert.ok(indexHtml.includes('id="import-gym-json-input"'));
  assert.ok(migrationComp.includes('DATA_BACKUP_MIGRATION_TITLE'));
  assert.ok(settingsComp.includes('DataMigrationPanel'));
  assert.equal(DATA_BACKUP_MIGRATION_TITLE, 'Data Backup & Migration');

  // Manual Auto-Sync toggle removed (always-on sync); existing Settings controls remain intact
  assert.equal(indexHtml.includes('id="toggle-auto-sync-devices-btn"'), false);
  assert.ok(indexHtml.includes('id="toggle-adhd-view-btn"'));
  assert.ok(indexHtml.includes('id="toggle-dyslexia-view-btn"'));
  assert.ok(indexHtml.includes('id="toggle-sensory-calm-btn"'));
  assert.ok(indexHtml.includes('id="copy-backup-code-btn"'));
});
