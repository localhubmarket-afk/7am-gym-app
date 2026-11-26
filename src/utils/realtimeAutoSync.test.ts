import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  AUTO_SYNC_DEBOUNCE_MS,
  AUTO_SYNC_STORAGE_KEY,
  AUTO_SYNC_TOGGLE_LABEL,
  AUTO_SYNC_TOGGLE_SUBLABEL,
  FORCE_SYNC_NOW_LABEL,
  createDebounce,
  createSupabaseRealtimeSyncManager,
  evaluateRealtimeIncomingPayload,
  loadAutoSyncPreference,
  saveAutoSyncPreference,
  type SupabaseClientLike,
  type SupabaseRealtimeChannelLike
} from './realtimeAutoSync';
import { resolveGymStateRecordId } from '../lib/supabaseClient';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    dump() {
      return Object.fromEntries(map.entries());
    }
  };
}

function createFakeSupabaseClient(options?: {
  initialRow?: Record<string, any> | null;
}) {
  const subscriptions: Array<{
    channelName: string;
    eventType: string;
    filter: Record<string, unknown>;
    callback: (payload: { new?: Record<string, any> | null }) => void;
    statusCallback?: (status: string) => void;
  }> = [];
  const upserts: Array<{ table: string; rows: any[] }> = [];
  let removedChannels = 0;
  let storedRow: Record<string, any> | null = options?.initialRow ?? null;

  const client: SupabaseClientLike = {
    channel(channelName: string) {
      const record: any = {
        channelName,
        eventType: '',
        filter: {},
        callback: () => {}
      };
      const ch: SupabaseRealtimeChannelLike = {
        on(type, filter, cb) {
          record.eventType = type;
          record.filter = filter;
          record.callback = cb;
          return ch;
        },
        subscribe(statusCb) {
          record.statusCallback = statusCb;
          subscriptions.push(record);
          statusCb?.('SUBSCRIBED');
          return ch;
        }
      };
      return ch;
    },
    removeChannel(_ch: any) {
      removedChannels += 1;
      return Promise.resolve('ok');
    },
    from(table: string) {
      return {
        upsert(rows: any[]) {
          upserts.push({ table, rows });
          if (Array.isArray(rows) && rows.length > 0) {
            storedRow = rows[0];
          }
          return Promise.resolve({ data: rows, error: null });
        },
        select(_cols: string) {
          return {
            eq(_col: string, _val: string) {
              return {
                maybeSingle() {
                  return Promise.resolve({ data: storedRow, error: null });
                }
              };
            }
          };
        }
      };
    }
  };

  return {
    client,
    subscriptions,
    upserts,
    getRemovedChannels: () => removedChannels,
    setStoredRow: (row: Record<string, any> | null) => {
      storedRow = row;
    },
    emitRealtimeUpdate(newRow: Record<string, any>) {
      for (const sub of subscriptions) {
        sub.callback({ new: newRow });
      }
    },
    emitChannelStatus(status: string) {
      for (const sub of subscriptions) {
        sub.statusCallback?.(status);
      }
    }
  };
}

test('Task 1: Always-on automatic background sync migration, removed manual toggle, and WCAG/no-paywall markup', () => {
  assert.equal(AUTO_SYNC_TOGGLE_LABEL, 'Cloud Sync & Backup');
  assert.equal(
    AUTO_SYNC_TOGGLE_SUBLABEL,
    'Saves on this device first and syncs automatically to the cloud whenever you are online.'
  );
  assert.equal(FORCE_SYNC_NOW_LABEL, 'Force Sync Now');
  assert.equal(AUTO_SYNC_DEBOUNCE_MS, 2000);

  const storage = createMemoryStorage();
  assert.equal(loadAutoSyncPreference(storage), true);

  // Legacy 'false' value auto-migrates to 'true' so local workout data is never trapped
  storage.setItem(AUTO_SYNC_STORAGE_KEY, 'false');
  assert.equal(loadAutoSyncPreference(storage), true);
  assert.equal(storage.getItem(AUTO_SYNC_STORAGE_KEY), 'true');

  // saveAutoSyncPreference always keeps background sync active
  assert.equal(saveAutoSyncPreference(false, storage), true);
  assert.equal(storage.getItem(AUTO_SYNC_STORAGE_KEY), 'true');
  assert.equal(loadAutoSyncPreference(storage), true);

  // Verify index.html and AutoSyncSettingsControl.tsx remove manual toggle & keep Force Sync Now + Force Pull from Cloud
  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  assert.equal(indexHtml.includes('id="toggle-auto-sync-devices-btn"'), false);
  assert.equal(indexHtml.includes('Cloud Sync &amp; Backup'), true);
  assert.equal(indexHtml.includes('id="force-sync-now-btn"'), true);
  assert.equal(indexHtml.includes('Force Sync Now'), true);
  assert.equal(indexHtml.includes('id="force-pull-cloud-btn"'), true);
  assert.equal(indexHtml.includes('id="sync-now-cloud-btn"'), false);

  const controlTsx = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/AutoSyncSettingsControl.tsx'),
    'utf8'
  );
  assert.equal(controlTsx.includes('data-testid="toggle-auto-sync-devices-btn"'), false);
  assert.equal(controlTsx.includes('data-testid="force-sync-now-btn"'), true);
  assert.equal(controlTsx.includes('data-testid="force-pull-cloud-btn"'), true);
  assert.equal(/text-\[\d+px\]|font-size\s*:\s*\d+px/i.test(controlTsx), false);
  assert.equal(/paywall|subscribe to unlock|pro tier|upgrade to pro/i.test(controlTsx), false);
});

test('Task 2: createDebounce collapses rapid calls within 2000ms and always-on sync pushes once after debounce', async () => {
  const scheduled: Array<{ id: number; delay: number; cb: () => void; cleared: boolean }> = [];
  let nextId = 1;
  const setTimer = (cb: () => void, ms: number) => {
    const entry = { id: nextId++, delay: ms, cb, cleared: false };
    scheduled.push(entry);
    return entry.id;
  };
  const clearTimer = (id: number) => {
    const found = scheduled.find((item) => item.id === id);
    if (found) found.cleared = true;
  };

  const calls: string[] = [];
  const debounced = createDebounce(
    (label: string) => calls.push(label),
    AUTO_SYNC_DEBOUNCE_MS,
    { setTimer, clearTimer }
  );

  debounced.call('set_1');
  debounced.call('set_2');
  debounced.call('set_3');

  assert.equal(calls.length, 0);
  assert.equal(scheduled.length, 3);
  assert.equal(scheduled[0].cleared, true);
  assert.equal(scheduled[1].cleared, true);
  assert.equal(scheduled[2].cleared, false);
  assert.equal(scheduled[2].delay, 2000);

  scheduled[2].cb();
  assert.deepEqual(calls, ['set_3']);

  // Verify manager stays always-on (even if legacy setEnabled(false) is called) and collapses rapid taps into one 2000ms push
  const storage = createMemoryStorage();
  const fake = createFakeSupabaseClient();
  let localState: any = {
    selectedWeek: 1,
    workoutLogs: { '1-0-0': { reps: 8, weight: 135 } },
    userProfile: { email: 'Alex@Example.com' },
    last_updated: '2026-05-01T10:00:00.000Z'
  };

  const timers: Array<{ id: number; cb: () => void; cleared: boolean; ms: number }> = [];
  let tid = 1;
  const manager = createSupabaseRealtimeSyncManager({
    getLocalState: () => localState,
    getRecordId: () => resolveGymStateRecordId(localState.userProfile.email),
    getApiEndpoint: () => '',
    storage,
    storageKey: 'test_gym_state_key',
    debounceMs: AUTO_SYNC_DEBOUNCE_MS,
    supabaseClient: fake.client,
    isOnlineFn: () => true,
    onRemoteStateApplied: (next) => {
      localState = next;
    },
    setTimer: (cb, ms) => {
      const t = { id: tid++, cb, cleared: false, ms };
      timers.push(t);
      return t.id;
    },
    clearTimer: (id) => {
      const found = timers.find((x) => x.id === id);
      if (found) found.cleared = true;
    }
  });

  // Always-on sync: even calling setEnabled(false) keeps automatic background sync enabled
  manager.setEnabled(false);
  assert.equal(manager.isEnabled(), true);

  // Rapid taps collapse into a single 2000ms debounced upsert with last_updated
  manager.scheduleDebouncedPush({ ...localState, selectedWeek: 3 }, 'set_logged');
  manager.scheduleDebouncedPush({ ...localState, selectedWeek: 4 }, 'fuel_modified');
  assert.equal(timers.length, 2);
  assert.equal(timers[0].cleared, true);
  assert.equal(timers[1].cleared, false);
  assert.equal(timers[1].ms, 2000);

  timers[1].cb();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(fake.upserts.length, 1);
  assert.equal(fake.upserts[0].table, 'gym_state');
  assert.equal(fake.upserts[0].rows[0].id, 'user_alex@example.com');
  assert.equal(fake.upserts[0].rows[0].data.selectedWeek, 4);
  assert.equal(typeof fake.upserts[0].rows[0].data.last_updated, 'string');
});

test('Task 3: Supabase Realtime UPDATE subscription overwrites local state + localStorage only when incoming last_updated is newer without push loops', () => {
  const storage = createMemoryStorage();
  const fake = createFakeSupabaseClient();
  let localState: any = {
    selectedWeek: 2,
    workoutLogs: { '2-0-0': { reps: 10, weight: 145 } },
    userProfile: { email: 'lifter@example.com' },
    last_updated: '2026-05-01T12:00:00.000Z'
  };
  let remoteApplyCalls = 0;

  const manager = createSupabaseRealtimeSyncManager({
    getLocalState: () => localState,
    getRecordId: () => resolveGymStateRecordId(localState.userProfile.email),
    getApiEndpoint: () => '',
    storage,
    storageKey: 'test_realtime_key',
    supabaseClient: fake.client,
    isOnlineFn: () => true,
    onRemoteStateApplied: (next) => {
      remoteApplyCalls += 1;
      localState = next;
      // Even if a React effect re-invokes scheduleDebouncedPush inside onRemoteStateApplied,
      // isApplyingRemote must block an infinite loop!
      manager.scheduleDebouncedPush(next, 'state_mutation');
    }
  });

  manager.subscribe();
  assert.equal(fake.subscriptions.length, 1);
  assert.equal(fake.subscriptions[0].eventType, 'postgres_changes');
  assert.deepEqual(fake.subscriptions[0].filter, {
    event: 'UPDATE',
    schema: 'public',
    table: 'gym_state',
    filter: 'id=eq.user_lifter@example.com'
  });

  // 1. Stale or equal cloud timestamp MUST be ignored
  const staleEval = evaluateRealtimeIncomingPayload(localState, {
    id: 'user_lifter@example.com',
    updated_at: '2026-05-01T11:59:00.000Z',
    data: { selectedWeek: 1, last_updated: '2026-05-01T11:59:00.000Z' }
  });
  assert.equal(staleEval.shouldApply, false);

  fake.emitRealtimeUpdate({
    id: 'user_lifter@example.com',
    updated_at: '2026-05-01T12:00:00.000Z',
    data: { selectedWeek: 1, last_updated: '2026-05-01T12:00:00.000Z' }
  });
  assert.equal(remoteApplyCalls, 0);
  assert.equal(localState.selectedWeek, 2);

  // 2. Strictly newer cloud timestamp MUST immediately overwrite local state & localStorage
  fake.emitRealtimeUpdate({
    id: 'user_lifter@example.com',
    updated_at: '2026-05-01T12:05:00.000Z',
    data: {
      selectedWeek: 5,
      workoutLogs: { '5-0-0': { reps: 12, weight: 165 } },
      userProfile: { email: 'lifter@example.com' },
      last_updated: '2026-05-01T12:05:00.000Z'
    }
  });
  assert.equal(remoteApplyCalls, 1);
  assert.equal(localState.selectedWeek, 5);
  assert.equal(localState.last_updated, '2026-05-01T12:05:00.000Z');
  const savedLocal = JSON.parse(storage.getItem('test_realtime_key') || '{}');
  assert.equal(savedLocal.selectedWeek, 5);
  // Loop prevention: zero pending push queued by applying the remote payload
  assert.equal(fake.upserts.length, 0);
});

test('Task 4: Offline / socket disconnect falls back to local-only storage and Force Sync Now resolves pull & push', async () => {
  const storage = createMemoryStorage();
  const fake = createFakeSupabaseClient({
    initialRow: {
      id: 'user_sync@example.com',
      updated_at: '2026-05-01T15:00:00.000Z',
      data: {
        selectedWeek: 6,
        userProfile: { email: 'sync@example.com' },
        last_updated: '2026-05-01T15:00:00.000Z'
      }
    }
  });

  let online = false;
  let localState: any = {
    selectedWeek: 2,
    userProfile: { email: 'sync@example.com' },
    last_updated: '2026-05-01T14:00:00.000Z'
  };
  const statusHistory: string[] = [];

  const manager = createSupabaseRealtimeSyncManager({
    getLocalState: () => localState,
    getRecordId: () => resolveGymStateRecordId(localState.userProfile.email),
    getApiEndpoint: () => '',
    storage,
    storageKey: 'test_fallback_key',
    supabaseClient: fake.client,
    isOnlineFn: () => online,
    onRemoteStateApplied: (next) => {
      localState = next;
    },
    onStatusChange: (status) => {
      statusHistory.push(status);
    }
  });

  // Offline -> graceful local-only fallback
  const offlineForce = await manager.forceSyncNow();
  assert.equal(offlineForce.offlineFallback, true);
  assert.equal(offlineForce.ok, false);
  assert.equal(manager.getStatus(), 'offline');
  assert.equal(JSON.parse(storage.getItem('test_fallback_key') || '{}').selectedWeek, 2);

  // Reconnect online -> subscribe & simulate socket disconnect fallback
  online = true;
  manager.subscribe();
  assert.equal(manager.getStatus(), 'connected');
  fake.emitChannelStatus('CHANNEL_ERROR');
  assert.equal(manager.getStatus(), 'disconnected');

  // Force Sync Now when cloud is newer -> pulls & overwrites local state
  const pullRes = await manager.forceSyncNow();
  assert.equal(pullRes.ok, true);
  assert.equal(pullRes.appliedRemote, true);
  assert.equal(localState.selectedWeek, 6);

  // Local device edits state to a newer timestamp -> Force Sync Now pushes up to Supabase
  localState = {
    selectedWeek: 7,
    userProfile: { email: 'sync@example.com' },
    last_updated: '2026-05-01T16:00:00.000Z'
  };
  const pushRes = await manager.forceSyncNow();
  assert.equal(pushRes.ok, true);
  assert.equal(pushRes.appliedRemote, false);
  assert.equal(pushRes.pushed, true);
  assert.equal(fake.upserts.length, 1);
  assert.equal(fake.upserts[0].rows[0].data.selectedWeek, 7);
  assert.equal(statusHistory.includes('disconnected'), true);
});
