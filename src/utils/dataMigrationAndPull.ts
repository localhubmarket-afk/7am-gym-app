import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, resolveGymStateRecordId } from '../lib/supabaseClient';
import { serializeStateForPersistence } from './workoutLogic';
import {
  getStateLastUpdatedIso,
  parseTimestampMs,
  stampGymStateLastUpdated,
  type GymStateTimestamped
} from './workoutSyncEngine';

export const FORCE_PULL_CLOUD_LABEL = 'Force Pull from Cloud';
export const FORCE_PULL_SUCCESS_TOAST =
  'Cloud data downloaded successfully. This device now matches your cloud account.';
export const DATA_BACKUP_MIGRATION_TITLE = 'Data Backup & Migration';
export const DEFAULT_BACKUP_FILENAME = '7am_gym_backup.json';
export const BACKUP_SCHEMA_VERSION = 1;

export interface SupabaseAuthAndTableClientLike {
  auth?: {
    getUser?: () => Promise<{ data?: { user?: { id?: string; email?: string | null } | null } | null; error?: unknown }>;
  };
  from?: (table: string) => any;
}

export interface GymStateSchemaValidationSummary {
  loggedSetsCount: number;
  currentWeek: number;
  hasWorkoutLogs: boolean;
  hasPullupLogs: boolean;
  hasFuelLogs: boolean;
  sourceEmail: string | null;
}

export interface GymStateSchemaValidationResult<T extends GymStateTimestamped = GymStateTimestamped> {
  valid: boolean;
  normalizedState: T | null;
  errors: string[];
  summary: GymStateSchemaValidationSummary | null;
}

export interface ForcePullCloudOptions<T extends GymStateTimestamped = GymStateTimestamped> {
  userId?: string | null;
  userEmail?: string | null;
  recordId?: string | null;
  storageKey?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  apiEndpoint?: string | null;
  supabaseClient?: SupabaseAuthAndTableClientLike | SupabaseClient | null;
  fetchImpl?: typeof fetch;
  isOnlineFn?: () => boolean;
  onStateOverwritten?: (cloudState: T, lastUpdatedIso: string) => void;
}

export interface ForcePullCloudResult<T extends GymStateTimestamped = GymStateTimestamped> {
  ok: boolean;
  source: 'supabase_table' | 'api_state' | 'none';
  recordId: string | null;
  state: T | null;
  lastUpdated: string | null;
  toastMessage: string;
  errorMessage?: string;
}

export interface ImportGymStateOptions<T extends GymStateTimestamped = GymStateTimestamped> {
  jsonText: string;
  currentState?: T | null;
  preserveActiveAccountProfile?: boolean;
  storageKey?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  onApplyLocalState?: (nextState: T) => void | Promise<void>;
  pushToSupabase?: (nextState: T) => Promise<{ pushed: boolean; lastUpdated?: string | null; message?: string }>;
}

export interface ImportGymStateResult<T extends GymStateTimestamped = GymStateTimestamped> {
  ok: boolean;
  state: T | null;
  pushedToCloud: boolean;
  lastUpdated: string | null;
  summary: GymStateSchemaValidationSummary | null;
  toastMessage: string;
  errors: string[];
}

const KNOWN_GYM_STATE_KEYS = [
  'workoutLogs',
  'selectedDayIndex',
  'currentWeek',
  'selectedWeek',
  'pullupLogs',
  'cardioLogs',
  'warmupLogs',
  'exerciseHistory',
  'fuelLogs',
  'checkedMeals',
  'waterIntakeLogs',
  'waterLogsMl',
  'userProfile',
  'customPrograms',
  'weeklyWorkoutsTarget'
] as const;

const OBJECT_MAP_KEYS = [
  'workoutLogs',
  'pullupLogs',
  'cardioLogs',
  'warmupLogs',
  'exerciseHistory',
  'fuelLogs',
  'checkedMeals',
  'checkedMealIngredients',
  'waterIntakeLogs',
  'waterLogsMl',
  'completedWeeks',
  'userProfile'
] as const;

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deeply clones JSON-safe values while stripping prototype-pollution keys.
 */
export function sanitizeJsonObjectDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonObjectDeep(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      clean[key] = sanitizeJsonObjectDeep(val);
    }
    return clean as T;
  }
  return value;
}

function countCompletedSetsInLogs(workoutLogs: Record<string, any> | undefined): number {
  if (!isPlainObject(workoutLogs)) return 0;
  let count = 0;
  for (const entry of Object.values(workoutLogs)) {
    if (isPlainObject(entry) && entry.done === true) {
      count += 1;
    }
  }
  return count;
}

/**
 * Task 2: Validates that an imported JSON object matches the `gym_state` schema.
 * Accepts either a direct `gym_state` object or a wrapped export envelope (`{ gym_state: { ... } }`).
 */
export function validateGymStateBackupSchema<T extends GymStateTimestamped = GymStateTimestamped>(
  parsed: unknown
): GymStateSchemaValidationResult<T> {
  if (!isPlainObject(parsed)) {
    return {
      valid: false,
      normalizedState: null,
      errors: ['This file is not a valid backup object. Please choose a 7am_gym_backup.json file.'],
      summary: null
    };
  }

  // Unwrap envelope if exported with wrapper `{ schemaVersion, gym_state }` or `{ data }`
  let candidate: Record<string, any> = parsed;
  if (isPlainObject(parsed.gym_state)) {
    candidate = parsed.gym_state;
  } else if (isPlainObject(parsed.data) && !isPlainObject(parsed.workoutLogs)) {
    candidate = parsed.data;
  }

  const sanitized = sanitizeJsonObjectDeep(candidate);
  const errors: string[] = [];

  const matchedKeys = KNOWN_GYM_STATE_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(sanitized, key)
  );
  if (matchedKeys.length === 0) {
    errors.push(
      'This JSON file does not match the Budget Gym backup format (missing workout or profile fields).'
    );
  }

  for (const mapKey of OBJECT_MAP_KEYS) {
    const val = sanitized[mapKey];
    if (val !== undefined && val !== null && !isPlainObject(val)) {
      errors.push(`Invalid backup field "${mapKey}": expected an object.`);
    }
  }

  if (sanitized.selectedDayIndex !== undefined && sanitized.selectedDayIndex !== null) {
    const dayIdx = Number(sanitized.selectedDayIndex);
    if (!Number.isInteger(dayIdx) || dayIdx < 0 || dayIdx > 6) {
      errors.push('Invalid "selectedDayIndex": must be a whole number from 0 to 6.');
    }
  }

  for (const weekKey of ['currentWeek', 'selectedWeek', 'maxUnlockedWeek'] as const) {
    if (sanitized[weekKey] !== undefined && sanitized[weekKey] !== null) {
      const wk = Number(sanitized[weekKey]);
      if (!Number.isInteger(wk) || wk < 1 || wk > 52) {
        errors.push(`Invalid "${weekKey}": must be a whole number between 1 and 52.`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      normalizedState: null,
      errors,
      summary: null
    };
  }

  // Ensure baseline required structures exist cleanly
  if (!isPlainObject(sanitized.workoutLogs)) {
    sanitized.workoutLogs = {};
  }
  if (!isPlainObject(sanitized.pullupLogs)) {
    sanitized.pullupLogs = {};
  }
  if (sanitized.selectedDayIndex === undefined || sanitized.selectedDayIndex === null) {
    sanitized.selectedDayIndex = 0;
  }
  if (sanitized.currentWeek === undefined || sanitized.currentWeek === null) {
    sanitized.currentWeek = Number(sanitized.selectedWeek) || 1;
  }
  if (sanitized.selectedWeek === undefined || sanitized.selectedWeek === null) {
    sanitized.selectedWeek = Number(sanitized.currentWeek) || 1;
  }

  // Strip wrapper-only metadata keys if present on root
  delete sanitized.backupFormat;
  delete sanitized.schemaVersion;
  delete sanitized.exportedAt;

  const sourceEmail =
    isPlainObject(sanitized.userProfile) &&
    typeof sanitized.userProfile.email === 'string' &&
    sanitized.userProfile.email.trim()
      ? sanitized.userProfile.email.trim().toLowerCase()
      : null;

  const summary: GymStateSchemaValidationSummary = {
    loggedSetsCount: countCompletedSetsInLogs(sanitized.workoutLogs),
    currentWeek: Number(sanitized.selectedWeek || sanitized.currentWeek || 1),
    hasWorkoutLogs: Object.keys(sanitized.workoutLogs || {}).length > 0,
    hasPullupLogs: Object.keys(sanitized.pullupLogs || {}).length > 0,
    hasFuelLogs:
      Object.keys(sanitized.fuelLogs || {}).length > 0 ||
      Object.keys(sanitized.checkedMeals || {}).length > 0,
    sourceEmail
  };

  return {
    valid: true,
    normalizedState: sanitized as T,
    errors: [],
    summary
  };
}

/**
 * Resolves all candidate row IDs in Supabase `gym_state` for the authenticated user.
 * Checks Supabase Auth `auth.getUser()` first, then explicit userId / userEmail / recordId.
 */
export async function resolveAuthenticatedGymStateIds(options: {
  userId?: string | null;
  userEmail?: string | null;
  recordId?: string | null;
  supabaseClient?: SupabaseAuthAndTableClientLike | SupabaseClient | null;
}): Promise<{ candidateIds: string[]; primaryId: string; authUserId: string | null }> {
  const orderedIds: string[] = [];
  const pushUnique = (raw: string | null | undefined) => {
    const clean = String(raw || '').trim();
    if (clean && !orderedIds.includes(clean)) {
      orderedIds.push(clean);
    }
  };

  let authUserId: string | null = null;
  const client = options.supabaseClient ?? getSupabaseClient();

  if (client && client.auth && typeof client.auth.getUser === 'function') {
    try {
      const authRes = await client.auth.getUser();
      const authUser = authRes?.data?.user;
      if (authUser?.id) {
        authUserId = String(authUser.id).trim();
        pushUnique(authUserId);
      }
      if (authUser?.email) {
        pushUnique(resolveGymStateRecordId(authUser.email));
      }
    } catch {
      // Ignore auth lookup failures when operating with email-based row IDs
    }
  }

  if (options.userId) {
    pushUnique(options.userId);
  }
  if (options.recordId) {
    pushUnique(options.recordId);
  }
  if (options.userEmail) {
    pushUnique(resolveGymStateRecordId(options.userEmail));
  }
  if (orderedIds.length === 0) {
    pushUnique('default');
  }

  return {
    candidateIds: orderedIds,
    primaryId: orderedIds[0],
    authUserId
  };
}

/**
 * Task 1: Manual "Force Pull from Cloud" execution logic.
 * Queries the Supabase `gym_state` table for the authenticated user's ID, fetches the latest payload,
 * and completely overwrites local state and `localStorage` (regardless of local timestamp).
 */
export async function forcePullGymStateFromCloud<T extends GymStateTimestamped = GymStateTimestamped>(
  options: ForcePullCloudOptions<T> = {}
): Promise<ForcePullCloudResult<T>> {
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const storageKey = options.storageKey || 'bws_vegan_7am_app_v1';
  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const checkOnline =
    options.isOnlineFn ||
    (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));

  if (!checkOnline()) {
    return {
      ok: false,
      source: 'none',
      recordId: null,
      state: null,
      lastUpdated: null,
      toastMessage: 'You are offline. Reconnect to download data from the cloud.',
      errorMessage: 'Offline'
    };
  }

  const client =
    options.supabaseClient !== undefined
      ? (options.supabaseClient as SupabaseAuthAndTableClientLike | null)
      : (getSupabaseClient() as SupabaseAuthAndTableClientLike | null);

  const { candidateIds, primaryId } = await resolveAuthenticatedGymStateIds({
    userId: options.userId,
    userEmail: options.userEmail,
    recordId: options.recordId,
    supabaseClient: client
  });

  let fetchedPayload: Record<string, any> | null = null;
  let fetchedTimestampIso: string | null = null;
  let matchedRecordId: string | null = null;
  let source: 'supabase_table' | 'api_state' | 'none' = 'none';

  // 1. Primary path: direct Supabase client query against `gym_state` table
  if (client && typeof client.from === 'function') {
    for (const candidateId of candidateIds) {
      try {
        const queryResult = await client
          .from('gym_state')
          .select('id, data, updated_at')
          .eq('id', candidateId)
          .maybeSingle();

        if (!queryResult?.error && queryResult?.data && isPlainObject(queryResult.data.data)) {
          fetchedPayload = queryResult.data.data;
          matchedRecordId = String(queryResult.data.id || candidateId);
          fetchedTimestampIso =
            (typeof fetchedPayload.last_updated === 'string' && fetchedPayload.last_updated) ||
            (typeof queryResult.data.updated_at === 'string' && queryResult.data.updated_at) ||
            (typeof fetchedPayload.updatedAt === 'string' && fetchedPayload.updatedAt) ||
            new Date().toISOString();
          source = 'supabase_table';
          break;
        }
      } catch {
        // Try next candidate ID or fallback endpoint
      }
    }
  }

  // 2. Fallback path: server-side `/api/state` endpoint (for Vercel server-side Supabase keys)
  const endpoint = String(options.apiEndpoint || '').trim();
  if (!fetchedPayload && endpoint && fetchFn) {
    try {
      const sep = endpoint.includes('?') ? '&' : '?';
      const cacheBusted = `${endpoint}${sep}t=${Date.now()}&forcePull=1`;
      const response = await fetchFn(cacheBusted, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache'
        }
      });
      if (response && response.ok) {
        const json = await response.json().catch(() => null);
        const remote =
          json && isPlainObject(json.data)
            ? json.data
            : isPlainObject(json) && json.configured !== false
              ? json
              : null;
        if (remote) {
          fetchedPayload = remote;
          matchedRecordId = String((json && (json.sourceRowId || json.accountId)) || primaryId);
          fetchedTimestampIso =
            (json && typeof json.last_updated === 'string' && json.last_updated) ||
            (json && typeof json.updatedAt === 'string' && json.updatedAt) ||
            (typeof remote.last_updated === 'string' && remote.last_updated) ||
            (typeof remote.updatedAt === 'string' && remote.updatedAt) ||
            new Date().toISOString();
          source = 'api_state';
        }
      }
    } catch {
      // Handled cleanly below
    }
  }

  if (!fetchedPayload) {
    return {
      ok: false,
      source: 'none',
      recordId: primaryId,
      state: null,
      lastUpdated: null,
      toastMessage: 'No saved cloud backup was found for this account yet.',
      errorMessage: 'No remote gym_state row found'
    };
  }

  const validation = validateGymStateBackupSchema<T>(fetchedPayload);
  if (!validation.valid || !validation.normalizedState) {
    return {
      ok: false,
      source,
      recordId: matchedRecordId,
      state: null,
      lastUpdated: null,
      toastMessage: 'Cloud data could not be read safely. Local data was kept unchanged.',
      errorMessage: validation.errors.join(' ')
    };
  }

  const effectiveTs =
    fetchedTimestampIso || getStateLastUpdatedIso(validation.normalizedState) || new Date().toISOString();
  const stampedCloudState = stampGymStateLastUpdated(validation.normalizedState, effectiveTs);

  // Completely overwrite localStorage with the downloaded cloud payload
  if (storage) {
    try {
      storage.setItem(storageKey, serializeStateForPersistence(stampedCloudState));
    } catch {
      // Ignore storage quota restrictions
    }
  }

  // Overwrite live React / app state
  options.onStateOverwritten?.(stampedCloudState, effectiveTs);

  return {
    ok: true,
    source,
    recordId: matchedRecordId || primaryId,
    state: stampedCloudState,
    lastUpdated: effectiveTs,
    toastMessage: FORCE_PULL_SUCCESS_TOAST
  };
}

/**
 * Task 2 (Export): Stringifies the active `gym_state` cleanly for `.json` download.
 * Uses `serializeStateForPersistence` to strip heavy transient data and adds clean metadata.
 */
export function serializeGymStateForJsonExport<T extends GymStateTimestamped>(
  gymState: T,
  exportedAtIso: string = new Date().toISOString()
): string {
  const cleanPayload = JSON.parse(serializeStateForPersistence(gymState)) as Record<string, any>;
  const exportObject = {
    backupFormat: '7am-gym-app-backup',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: exportedAtIso,
    gym_state: cleanPayload
  };
  return JSON.stringify(exportObject, null, 2);
}

/**
 * Task 2 (Export): Triggers a browser download of `7am_gym_backup.json` containing the active `gym_state`.
 */
export function triggerGymStateJsonDownload<T extends GymStateTimestamped>(
  gymState: T,
  filename: string = DEFAULT_BACKUP_FILENAME
): { ok: boolean; filename: string; bytes: number; jsonText: string } {
  const safeFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
  const jsonText = serializeGymStateForJsonExport(gymState);
  const bytes = jsonText.length;

  if (typeof document !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = safeFilename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Ignore revoke errors
      }
    }, 1000);
  }

  return { ok: true, filename: safeFilename, bytes, jsonText };
}

/**
 * Task 2 (Import): Parses a `.json` backup string, validates the `gym_state` schema,
 * overwrites local state + `localStorage`, and immediately pushes to Supabase so the
 * imported data is permanently saved to the active account.
 */
export async function importGymStateFromJsonText<T extends GymStateTimestamped = GymStateTimestamped>(
  options: ImportGymStateOptions<T>
): Promise<ImportGymStateResult<T>> {
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const storageKey = options.storageKey || 'bws_vegan_7am_app_v1';
  const preserveActiveAccountProfile = options.preserveActiveAccountProfile !== false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(options.jsonText || ''));
  } catch {
    return {
      ok: false,
      state: null,
      pushedToCloud: false,
      lastUpdated: null,
      summary: null,
      toastMessage: 'Could not read that file. Please select a valid .json backup file.',
      errors: ['Invalid JSON file syntax.']
    };
  }

  const validation = validateGymStateBackupSchema<T>(parsed);
  if (!validation.valid || !validation.normalizedState) {
    return {
      ok: false,
      state: null,
      pushedToCloud: false,
      lastUpdated: null,
      summary: null,
      toastMessage: validation.errors[0] || 'Backup file does not match the workout data format.',
      errors: validation.errors
    };
  }

  const migratedState = JSON.parse(JSON.stringify(validation.normalizedState)) as T;

  // When migrating data between accounts, keep the currently signed-in account's identity
  // so the immediate Supabase push writes to the active account's row!
  const activeProfile =
    preserveActiveAccountProfile &&
    options.currentState &&
    isPlainObject(options.currentState.userProfile) &&
    typeof options.currentState.userProfile.email === 'string' &&
    options.currentState.userProfile.email.trim()
      ? JSON.parse(JSON.stringify(options.currentState.userProfile))
      : null;

  if (activeProfile) {
    migratedState.userProfile = activeProfile;
  }

  // Stamp a strictly newer `last_updated` timestamp so Supabase accepts the imported migration as latest
  const existingMs = Math.max(
    parseTimestampMs(getStateLastUpdatedIso(options.currentState)),
    parseTimestampMs(getStateLastUpdatedIso(migratedState)),
    Date.now()
  );
  const migrationIso = new Date(existingMs + 1000).toISOString();
  stampGymStateLastUpdated(migratedState, migrationIso);

  // Overwrite localStorage immediately
  if (storage) {
    try {
      storage.setItem(storageKey, serializeStateForPersistence(migratedState));
    } catch {
      // Ignore storage quota issues
    }
  }

  // Overwrite local React / app state
  if (options.onApplyLocalState) {
    await options.onApplyLocalState(migratedState);
  }

  // Automatically trigger an immediate Supabase cloud push
  let pushedToCloud = false;
  if (options.pushToSupabase) {
    try {
      const pushRes = await options.pushToSupabase(migratedState);
      pushedToCloud = Boolean(pushRes && pushRes.pushed);
    } catch {
      pushedToCloud = false;
    }
  }

  const setsCount = validation.summary?.loggedSetsCount ?? 0;
  const setsLabel = setsCount === 1 ? '1 logged set' : `${setsCount} logged sets`;
  const toastMessage = pushedToCloud
    ? `Backup imported (${setsLabel}) and saved to your cloud account.`
    : `Backup imported (${setsLabel}) on this device. Cloud sync will upload when connected.`;

  return {
    ok: true,
    state: migratedState,
    pushedToCloud,
    lastUpdated: migrationIso,
    summary: validation.summary,
    toastMessage,
    errors: []
  };
}
