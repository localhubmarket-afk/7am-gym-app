import { clearActiveDayWorkoutData } from './wizardValidation';

export const WORKOUT_FUEL_RESET_PROMPT =
  'Would you like to delete your meal prep and fuel logs too?';

export const DELETE_ACCOUNT_WARNING_PROMPT =
  'Are you sure you want to delete the account?';

export const DELETE_ACCOUNT_MAIN_WARNING =
  'Are you sure you want to delete this account forever? All your saved workouts and meals will be gone.';

export const POST_DELETE_SELECT_ACCOUNT_PROMPT =
  'Account deleted. Please select your active account to continue.';

export const AVAILABLE_OAUTH_LOGIN_PROVIDERS = ['Google', 'Apple'] as const;

export const DELETE_ACCOUNT_BUTTON_LABELS = {
  cancel: 'Cancel',
  confirm: 'Yes, Delete Account'
} as const;

export const FUEL_RESET_ONLY_PROMPT =
  'Reset your meal prep and fuel logs for this day?';

export type DeletionScope =
  | 'workout_only'
  | 'workout_and_fuel'
  | 'fuel_only'
  | 'account';

export interface DeletionValidationRequest {
  scope: DeletionScope;
  activeUserId: string | null | undefined;
  targetUserId: string | null | undefined;
  activeWeek?: number;
  targetWeek?: number;
  activeDayIndex?: number;
  targetDayIndex?: number;
}

export interface DeletionValidationResult {
  valid: boolean;
  scope: DeletionScope;
  normalizedUserId: string;
  supabaseRecordId: string;
  week: number | null;
  dayIndex: number | null;
  dayKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SavedAccountCandidate {
  name: string;
  email: string;
  phone: string;
  goal: string;
  diet: string;
  gymTime: string;
  snapshot?: Record<string, any> | null;
}

const DISALLOWED_USER_IDS = new Set([
  '',
  'default',
  'guest',
  'anonymous',
  'google',
  'apple',
  'member@gmail.com',
  'athlete@gmail.com'
]);

const PROVIDER_ONLY_NAMES = new Set(['google', 'apple', 'oauth', 'user', 'guest', 'anonymous']);

const KNOWN_SESSION_COOKIE_NAMES = [
  'gym_session',
  'session',
  'session_id',
  'auth_token',
  'access_token',
  'refresh_token',
  'sb-access-token',
  'sb-refresh-token'
];

const FUEL_MEAL_SLOTS = ['pre_shake', 'post_oats', 'lunch', 'dinner'] as const;

export function normalizeAccountUserId(rawUserId: string | null | undefined): string {
  const cleaned = String(rawUserId || '').trim().toLowerCase();
  if (cleaned.startsWith('user_')) {
    return cleaned.slice(5).trim();
  }
  return cleaned;
}

export function isValidDeletableUserId(rawUserId: string | null | undefined): boolean {
  const normalized = normalizeAccountUserId(rawUserId);
  if (!normalized || DISALLOWED_USER_IDS.has(normalized)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function formatFallbackNameFromEmail(email: string): string {
  const localPart = String(email || '').split('@')[0] || 'Account';
  const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Account';
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function sanitizeAccountDisplayName(rawName: unknown, email: string): string {
  const trimmed = String(rawName || '').trim();
  if (!trimmed || PROVIDER_ONLY_NAMES.has(trimmed.toLowerCase())) {
    return formatFallbackNameFromEmail(email);
  }
  return trimmed;
}

/**
 * Builds the exact post-deletion account switch prompt:
 * "Account deleted. Do you want to continue as [Other Account Name]?"
 */
export function buildPostDeleteSwitchPrompt(accountName: string): string {
  const safeName = String(accountName || '').trim() || 'your other account';
  return `Account deleted. Do you want to continue as ${safeName}?`;
}

/**
 * Checks local device profiles for another valid saved account after deletion.
 * Ignores the deleted email and placeholder emails so users never hit an empty login screen unnecessarily.
 */
export function findSecondarySavedAccount(
  stateObj: Record<string, any> | null | undefined,
  excludedEmail: string | null | undefined
): SavedAccountCandidate | null {
  if (!stateObj || typeof stateObj !== 'object') return null;

  const excludedNorm = normalizeAccountUserId(excludedEmail);
  const candidatesByEmail = new Map<string, { candidate: SavedAccountCandidate; sortMs: number }>();

  const considerCandidate = (
    rawEmail: unknown,
    rawProfile: Record<string, any> | null | undefined,
    snapshot?: Record<string, any> | null
  ) => {
    const emailNorm = normalizeAccountUserId(typeof rawEmail === 'string' ? rawEmail : '');
    if (!isValidDeletableUserId(emailNorm) || emailNorm === excludedNorm) return;

    const prof = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
    const tsRaw = prof.signedInAt || prof.capturedAt || '';
    const sortMs = typeof tsRaw === 'string' && tsRaw.trim() ? Date.parse(tsRaw) || 0 : 0;

    const candidate: SavedAccountCandidate = {
      name: sanitizeAccountDisplayName(prof.name, emailNorm),
      email: emailNorm,
      phone: String(prof.phone || '').trim(),
      goal: String(prof.goal || '6-Pack Recomp').trim() || '6-Pack Recomp',
      diet:
        String(prof.diet || '100% Plant-Based ($5.55/day)').trim() ||
        '100% Plant-Based ($5.55/day)',
      gymTime: String(prof.gymTime || '07:00').trim() || '07:00',
      snapshot: snapshot && typeof snapshot === 'object' ? snapshot : null
    };

    const existing = candidatesByEmail.get(emailNorm);
    if (!existing) {
      candidatesByEmail.set(emailNorm, { candidate, sortMs });
      return;
    }

    // Prefer entry with snapshot or newer timestamp
    const mergedSnapshot = candidate.snapshot || existing.candidate.snapshot || null;
    const mergedName =
      candidate.name !== formatFallbackNameFromEmail(emailNorm)
        ? candidate.name
        : existing.candidate.name;

    candidatesByEmail.set(emailNorm, {
      candidate: {
        ...existing.candidate,
        ...candidate,
        name: mergedName,
        snapshot: mergedSnapshot
      },
      sortMs: Math.max(existing.sortMs, sortMs)
    });
  };

  if (stateObj.accountsByEmail && typeof stateObj.accountsByEmail === 'object') {
    Object.entries(stateObj.accountsByEmail).forEach(([emailKey, entry]: [string, any]) => {
      if (!entry || typeof entry !== 'object') return;
      const profileObj = entry.profile && typeof entry.profile === 'object' ? entry.profile : entry;
      const emailVal = profileObj.email || emailKey;
      considerCandidate(emailVal, profileObj, entry.snapshot || null);
    });
  }

  if (Array.isArray(stateObj.capturedLeads)) {
    stateObj.capturedLeads.forEach((lead: any) => {
      if (!lead || typeof lead !== 'object') return;
      considerCandidate(lead.email, lead, null);
    });
  }

  if (candidatesByEmail.size === 0) return null;

  const sorted = Array.from(candidatesByEmail.values()).sort((a, b) => b.sortMs - a.sortMs);
  return sorted[0].candidate;
}

/**
 * Strict Content Validation for Workout, Fuel, and Account deletions.
 * Verifies the exact authenticated user ID and active week/day before any data is deleted.
 */
export function validateDeletionTarget(
  request: DeletionValidationRequest
): DeletionValidationResult {
  const scope = request.scope;
  const activeNorm = normalizeAccountUserId(request.activeUserId);
  const targetNorm = normalizeAccountUserId(request.targetUserId);

  if (!isValidDeletableUserId(activeNorm)) {
    return {
      valid: false,
      scope,
      normalizedUserId: '',
      supabaseRecordId: '',
      week: null,
      dayIndex: null,
      dayKey: null,
      errorCode: 'INVALID_ACTIVE_USER',
      errorMessage: 'Sign in to an active account before deleting.'
    };
  }

  if (!isValidDeletableUserId(targetNorm)) {
    return {
      valid: false,
      scope,
      normalizedUserId: activeNorm,
      supabaseRecordId: '',
      week: null,
      dayIndex: null,
      dayKey: null,
      errorCode: 'INVALID_TARGET_USER',
      errorMessage: 'Account email is missing or invalid.'
    };
  }

  if (activeNorm !== targetNorm) {
    return {
      valid: false,
      scope,
      normalizedUserId: activeNorm,
      supabaseRecordId: '',
      week: null,
      dayIndex: null,
      dayKey: null,
      errorCode: 'USER_ID_MISMATCH',
      errorMessage: 'Deletion stopped because the selected account does not match your active login.'
    };
  }

  const supabaseRecordId = `user_${activeNorm}`;

  if (scope === 'account') {
    return {
      valid: true,
      scope,
      normalizedUserId: activeNorm,
      supabaseRecordId,
      week: null,
      dayIndex: null,
      dayKey: null,
      errorCode: null,
      errorMessage: null
    };
  }

  // Day-scoped deletions must strictly match both activeWeek and activeDayIndex
  const activeWeek = Number(request.activeWeek);
  const targetWeek = Number(request.targetWeek);
  const activeDay = Number(request.activeDayIndex);
  const targetDay = Number(request.targetDayIndex);

  if (
    !Number.isInteger(activeWeek) ||
    !Number.isInteger(targetWeek) ||
    activeWeek < 1 ||
    activeWeek > 12 ||
    targetWeek < 1 ||
    targetWeek > 12
  ) {
    return {
      valid: false,
      scope,
      normalizedUserId: activeNorm,
      supabaseRecordId,
      week: null,
      dayIndex: null,
      dayKey: null,
      errorCode: 'INVALID_WEEK',
      errorMessage: 'Target week must be a valid integer between 1 and 12.'
    };
  }

  if (activeWeek !== targetWeek) {
    return {
      valid: false,
      scope,
      normalizedUserId: activeNorm,
      supabaseRecordId,
      week: activeWeek,
      dayIndex: null,
      dayKey: null,
      errorCode: 'ACTIVE_WEEK_MISMATCH',
      errorMessage: `Blocked deletion: target Week ${targetWeek} does not match active Week ${activeWeek}.`
    };
  }

  if (
    !Number.isInteger(activeDay) ||
    !Number.isInteger(targetDay) ||
    activeDay < 0 ||
    activeDay > 6 ||
    targetDay < 0 ||
    targetDay > 6
  ) {
    return {
      valid: false,
      scope,
      normalizedUserId: activeNorm,
      supabaseRecordId,
      week: activeWeek,
      dayIndex: null,
      dayKey: null,
      errorCode: 'INVALID_DAY_INDEX',
      errorMessage: 'Target day index must be between 0 (Day 1) and 6 (Day 7).'
    };
  }

  if (activeDay !== targetDay) {
    return {
      valid: false,
      scope,
      normalizedUserId: activeNorm,
      supabaseRecordId,
      week: activeWeek,
      dayIndex: activeDay,
      dayKey: null,
      errorCode: 'ACTIVE_DAY_MISMATCH',
      errorMessage: `Blocked deletion: target Day ${targetDay + 1} does not match active Day ${activeDay + 1}.`
    };
  }

  return {
    valid: true,
    scope,
    normalizedUserId: activeNorm,
    supabaseRecordId,
    week: targetWeek,
    dayIndex: targetDay,
    dayKey: `w${targetWeek}_d${targetDay}`,
    errorCode: null,
    errorMessage: null
  };
}

export interface FuelClearResult {
  cleared: boolean;
  validation: DeletionValidationResult;
  clearedMealKeys: number;
  clearedIngredientKeys: number;
  clearedFlexOverrides: boolean;
  clearedQuickAdds: boolean;
  clearedWater: boolean;
}

/**
 * Clears ONLY the active day's Muscle Fuel & meal prep logs after strict user ID + day validation.
 * Preserves all workout sets and all other days' fuel logs.
 */
export function clearActiveDayFuelData(
  stateObj: Record<string, any> | null | undefined,
  context: {
    activeUserId: string | null | undefined;
    targetUserId: string | null | undefined;
    activeWeek: number;
    targetWeek: number;
    activeDayIndex: number;
    targetDayIndex: number;
  }
): FuelClearResult {
  const validation = validateDeletionTarget({
    scope: 'fuel_only',
    activeUserId: context.activeUserId,
    targetUserId: context.targetUserId,
    activeWeek: context.activeWeek,
    targetWeek: context.targetWeek,
    activeDayIndex: context.activeDayIndex,
    targetDayIndex: context.targetDayIndex
  });

  if (!validation.valid || !stateObj || typeof stateObj !== 'object' || validation.week === null || validation.dayIndex === null) {
    return {
      cleared: false,
      validation,
      clearedMealKeys: 0,
      clearedIngredientKeys: 0,
      clearedFlexOverrides: false,
      clearedQuickAdds: false,
      clearedWater: false
    };
  }

  const w = validation.week;
  const d = validation.dayIndex;
  const dayKey = `w${w}_d${d}`;
  const prefix = `${dayKey}_`;
  const altDayKey = `w${w}_${d}`;
  let clearedMealKeys = 0;
  let clearedIngredientKeys = 0;

  const wipeMealMap = (mealsMap: Record<string, any> | undefined) => {
    if (!mealsMap || typeof mealsMap !== 'object') return;
    Object.keys(mealsMap).forEach((k) => {
      if (k.startsWith(prefix)) {
        delete mealsMap[k];
        clearedMealKeys += 1;
      }
    });
    if (w === 1 && d === 0) {
      FUEL_MEAL_SLOTS.forEach((slotId) => {
        if (slotId in mealsMap) {
          delete mealsMap[slotId];
          clearedMealKeys += 1;
        }
      });
    }
  };

  wipeMealMap(stateObj.checkedMeals);

  if (stateObj.accountsByEmail && typeof stateObj.accountsByEmail === 'object') {
    const activeAcct = stateObj.accountsByEmail[validation.normalizedUserId];
    if (activeAcct && activeAcct.snapshot && typeof activeAcct.snapshot === 'object') {
      wipeMealMap(activeAcct.snapshot.checkedMeals);
    }
  }

  if (stateObj.checkedMealIngredients && typeof stateObj.checkedMealIngredients === 'object') {
    Object.keys(stateObj.checkedMealIngredients).forEach((k) => {
      if (k.startsWith(prefix)) {
        delete stateObj.checkedMealIngredients[k];
        clearedIngredientKeys += 1;
      }
    });
  }

  let clearedFlexOverrides = false;
  if (stateObj.flexMealOverridesByDay && typeof stateObj.flexMealOverridesByDay === 'object' && dayKey in stateObj.flexMealOverridesByDay) {
    delete stateObj.flexMealOverridesByDay[dayKey];
    clearedFlexOverrides = true;
  }

  let clearedQuickAdds = false;
  if (stateObj.quickAddCaloriesByDay && typeof stateObj.quickAddCaloriesByDay === 'object' && dayKey in stateObj.quickAddCaloriesByDay) {
    delete stateObj.quickAddCaloriesByDay[dayKey];
    clearedQuickAdds = true;
  }

  let clearedWater = false;
  if (stateObj.waterIntakeLogs && typeof stateObj.waterIntakeLogs === 'object') {
    if (dayKey in stateObj.waterIntakeLogs) {
      delete stateObj.waterIntakeLogs[dayKey];
      clearedWater = true;
    }
    if (altDayKey in stateObj.waterIntakeLogs) {
      delete stateObj.waterIntakeLogs[altDayKey];
      clearedWater = true;
    }
  }
  if (stateObj.waterLogsMl && typeof stateObj.waterLogsMl === 'object') {
    if (dayKey in stateObj.waterLogsMl) {
      delete stateObj.waterLogsMl[dayKey];
      clearedWater = true;
    }
    if (altDayKey in stateObj.waterLogsMl) {
      delete stateObj.waterLogsMl[altDayKey];
      clearedWater = true;
    }
  }

  return {
    cleared: true,
    validation,
    clearedMealKeys,
    clearedIngredientKeys,
    clearedFlexOverrides,
    clearedQuickAdds,
    clearedWater
  };
}

export interface LinkedWorkoutFuelClearResult {
  cleared: boolean;
  includeFuel: boolean;
  validation: DeletionValidationResult;
  clearedWorkoutKeys: number;
  fuelResult: FuelClearResult | null;
}

/**
 * Linked Workout and optional Fuel deletion with strict user & day validation.
 */
export function clearActiveDayWorkoutAndOptionalFuel(
  stateObj: Record<string, any> | null | undefined,
  options: {
    includeFuel: boolean;
    activeUserId: string | null | undefined;
    targetUserId: string | null | undefined;
    activeWeek: number;
    targetWeek: number;
    activeDayIndex: number;
    targetDayIndex: number;
    templateSlotIndex?: number;
  }
): LinkedWorkoutFuelClearResult {
  const scope: DeletionScope = options.includeFuel ? 'workout_and_fuel' : 'workout_only';
  const validation = validateDeletionTarget({
    scope,
    activeUserId: options.activeUserId,
    targetUserId: options.targetUserId,
    activeWeek: options.activeWeek,
    targetWeek: options.targetWeek,
    activeDayIndex: options.activeDayIndex,
    targetDayIndex: options.targetDayIndex
  });

  if (!validation.valid || !stateObj || typeof stateObj !== 'object' || validation.week === null || validation.dayIndex === null) {
    return {
      cleared: false,
      includeFuel: options.includeFuel,
      validation,
      clearedWorkoutKeys: 0,
      fuelResult: null
    };
  }

  const workoutRes = clearActiveDayWorkoutData(
    stateObj,
    validation.week,
    validation.dayIndex,
    options.templateSlotIndex
  );

  let fuelResult: FuelClearResult | null = null;
  if (options.includeFuel) {
    fuelResult = clearActiveDayFuelData(stateObj, {
      activeUserId: options.activeUserId,
      targetUserId: options.targetUserId,
      activeWeek: options.activeWeek,
      targetWeek: options.targetWeek,
      activeDayIndex: options.activeDayIndex,
      targetDayIndex: options.targetDayIndex
    });
  }

  return {
    cleared: true,
    includeFuel: options.includeFuel,
    validation,
    clearedWorkoutKeys: workoutRes.clearedWorkoutKeys,
    fuelResult
  };
}

export interface DeleteAccountResult {
  deleted: boolean;
  validation: DeletionValidationResult;
  remoteDeleted: boolean;
  clearedDefaultMirror?: boolean;
  accountId: string;
}

/**
 * Validates active user ID, then sends DELETE to the backend account endpoint
 * to permanently erase the user's server record and expire server-set cookies.
 */
export async function deleteUserAccountFromSupabase(options: {
  endpoint: string;
  activeUserId: string | null | undefined;
  targetUserId: string | null | undefined;
  fetchImpl?: typeof fetch;
}): Promise<DeleteAccountResult> {
  const validation = validateDeletionTarget({
    scope: 'account',
    activeUserId: options.activeUserId,
    targetUserId: options.targetUserId
  });

  if (!validation.valid) {
    return {
      deleted: false,
      validation,
      remoteDeleted: false,
      clearedDefaultMirror: false,
      accountId: ''
    };
  }

  const baseEndpoint = String(options.endpoint || '').trim();
  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);

  if (!baseEndpoint || !fetchFn) {
    return {
      deleted: true,
      validation,
      remoteDeleted: false,
      clearedDefaultMirror: false,
      accountId: validation.supabaseRecordId
    };
  }

  const emailQuery = `email=${encodeURIComponent(validation.normalizedUserId)}`;
  let deleteUrl = baseEndpoint;
  if (!baseEndpoint.includes('email=')) {
    const sep = baseEndpoint.includes('?') ? '&' : '?';
    deleteUrl = `${baseEndpoint}${sep}${emailQuery}`;
  }

  try {
    const resp = await fetchFn(deleteUrl, {
      method: 'DELETE',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: validation.normalizedUserId,
        accountId: validation.supabaseRecordId,
        confirmDeleteAccount: true
      })
    });
    const json = await resp.json().catch(() => ({}));
    return {
      deleted: true,
      validation,
      remoteDeleted: Boolean(resp.ok && json && json.deleted !== false),
      clearedDefaultMirror: Boolean(json && json.clearedDefaultMirror),
      accountId: validation.supabaseRecordId
    };
  } catch {
    return {
      deleted: true,
      validation,
      remoteDeleted: false,
      clearedDefaultMirror: false,
      accountId: validation.supabaseRecordId
    };
  }
}

/**
 * Web Client Cleanup: Invalidates and deletes all browser session cookies across root and current paths
 * to prevent ghost-session login errors.
 */
export function clearAllWebSessionCookies(
  doc?: { cookie: string; location?: { pathname?: string; hostname?: string } } | null
): number {
  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  if (!targetDoc || typeof targetDoc.cookie !== 'string') return 0;

  const cookieNames = new Set<string>(KNOWN_SESSION_COOKIE_NAMES);
  const rawCookies = targetDoc.cookie
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  rawCookies.forEach((entry) => {
    const eqIdx = entry.indexOf('=');
    const name = (eqIdx >= 0 ? entry.slice(0, eqIdx) : entry).trim();
    if (name) cookieNames.add(name);
  });

  const paths = new Set<string>(['/']);
  const pathname =
    (targetDoc.location && targetDoc.location.pathname) ||
    (typeof window !== 'undefined' && window.location ? window.location.pathname : '');
  if (pathname && pathname !== '/') {
    const segments = pathname.split('/').filter(Boolean);
    let acc = '';
    segments.forEach((seg) => {
      acc += `/${seg}`;
      paths.add(acc);
    });
  }

  const hostname =
    (targetDoc.location && targetDoc.location.hostname) ||
    (typeof window !== 'undefined' && window.location ? window.location.hostname : '');
  const domainVariants: string[] = [''];
  if (hostname && hostname !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    domainVariants.push(`; domain=${hostname}`);
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      domainVariants.push(`; domain=.${parts.slice(-2).join('.')}`);
    }
  }

  let clearedCount = 0;
  cookieNames.forEach((name) => {
    const hadCookie = rawCookies.some((c) => c.startsWith(`${name}=`));
    paths.forEach((p) => {
      domainVariants.forEach((domainSuffix) => {
        targetDoc.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${p}${domainSuffix}; SameSite=Lax`;
      });
    });
    if (hadCookie) {
      clearedCount += 1;
    }
  });

  return Math.max(clearedCount, rawCookies.length);
}

/**
 * Purges only the deleted user's local profile, active logs, and saved account records.
 * Keeps remaining saved profiles intact when present so one-click switching works cleanly.
 */
export function purgeDeletedAccountFromLocalState(
  stateObj: Record<string, any>,
  targetUserId: string
): boolean {
  const validation = validateDeletionTarget({
    scope: 'account',
    activeUserId: stateObj?.userProfile?.email,
    targetUserId
  });
  if (!validation.valid) return false;

  const email = validation.normalizedUserId;
  if (stateObj.accountsByEmail && typeof stateObj.accountsByEmail === 'object') {
    delete stateObj.accountsByEmail[email];
  }
  if (Array.isArray(stateObj.capturedLeads)) {
    stateObj.capturedLeads = stateObj.capturedLeads.filter(
      (lead: any) => !lead || !lead.email || normalizeAccountUserId(lead.email) !== email
    );
  }
  stateObj.undoBackup = null;
  stateObj.workoutLogs = {};
  stateObj.pullupLogs = {};
  stateObj.checkedMeals = {};
  stateObj.checkedMealIngredients = {};
  stateObj.flexMealOverridesByDay = {};
  stateObj.quickAddCaloriesByDay = {};
  stateObj.waterIntakeLogs = {};
  stateObj.waterLogsMl = {};
  stateObj.userProfile = {
    name: '',
    email: '',
    phone: '',
    goal: '6-Pack Recomp',
    diet: '100% Plant-Based ($5.55/day)',
    gymTime: '07:00',
    signedInAt: null
  };
  return true;
}

export interface MobilePurgeOptions {
  storageKey?: string;
  deletedEmail: string;
  stateObj?: Record<string, any> | null;
  preserveRemainingProfiles?: boolean;
  localStorageImpl?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> | null;
  sessionStorageImpl?: Pick<Storage, 'clear'> | null;
  cachesImpl?: { keys: () => Promise<string[]>; delete: (key: string) => Promise<boolean> } | null;
  windowImpl?: {
    name?: string;
    location?: { hash?: string; pathname?: string; search?: string };
    history?: { replaceState?: (...args: any[]) => void };
  } | null;
}

export interface MobilePurgeResult {
  purged: boolean;
  wipedEntireLocalStorage: boolean;
  clearedSessionStorage: boolean;
  clearedCacheCount: number;
}

/**
 * Mobile Client Cleanup: Purges local storage, session storage, window name/hash,
 * and Cache Storage entries for the deleted account.
 */
export async function purgeMobileClientStorage(
  options: MobilePurgeOptions
): Promise<MobilePurgeResult> {
  const storageKey = options.storageKey || 'bws_vegan_7am_app_v1';
  const localStore =
    options.localStorageImpl !== undefined
      ? options.localStorageImpl
      : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
  const sessionStore =
    options.sessionStorageImpl !== undefined
      ? options.sessionStorageImpl
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null;
  const cacheApi =
    options.cachesImpl !== undefined
      ? options.cachesImpl
      : typeof caches !== 'undefined'
        ? caches
        : null;
  const win =
    options.windowImpl !== undefined
      ? options.windowImpl
      : typeof window !== 'undefined'
        ? window
        : null;

  let wipedEntireLocalStorage = false;
  let clearedSessionStorage = false;
  let clearedCacheCount = 0;

  if (options.stateObj && typeof options.stateObj === 'object') {
    purgeDeletedAccountFromLocalState(options.stateObj, options.deletedEmail);
  }

  try {
    if (localStore) {
      if (options.preserveRemainingProfiles && options.stateObj) {
        const sanitizedPayload = JSON.stringify({
          ...options.stateObj,
          undoBackup: null
        });
        localStore.setItem(storageKey, sanitizedPayload);
      } else {
        localStore.removeItem(storageKey);
        if (typeof localStore.clear === 'function') {
          localStore.clear();
        }
        wipedEntireLocalStorage = true;
      }
    }
  } catch {
    // Ignore restricted storage exceptions in private browsing modes
  }

  try {
    if (sessionStore && typeof sessionStore.clear === 'function') {
      sessionStore.clear();
      clearedSessionStorage = true;
    }
  } catch {
    // Ignore restricted sessionStorage exceptions
  }

  try {
    if (win) {
      if (typeof win.name === 'string' && win.name.length > 0) {
        win.name = '';
      }
      if (
        win.location &&
        typeof win.location.hash === 'string' &&
        win.location.hash.includes('state=') &&
        win.history &&
        typeof win.history.replaceState === 'function'
      ) {
        win.history.replaceState(
          null,
          '',
          `${win.location.pathname || '/'}${win.location.search || ''}`
        );
      }
    }
  } catch {
    // Ignore history state restrictions
  }

  try {
    if (cacheApi && typeof cacheApi.keys === 'function' && typeof cacheApi.delete === 'function') {
      const keys = await cacheApi.keys();
      if (Array.isArray(keys) && keys.length > 0) {
        const deletedFlags = await Promise.all(keys.map((key) => cacheApi.delete(key).catch(() => false)));
        clearedCacheCount = deletedFlags.filter(Boolean).length;
      }
    }
  } catch {
    // Ignore Cache Storage restrictions
  }

  return {
    purged: true,
    wipedEntireLocalStorage,
    clearedSessionStorage,
    clearedCacheCount
  };
}

export interface CompleteAccountDeletionOptions {
  endpoint: string;
  activeUserId: string | null | undefined;
  targetUserId: string | null | undefined;
  stateObj: Record<string, any>;
  storageKey?: string;
  fetchImpl?: typeof fetch;
  docImpl?: { cookie: string; location?: { pathname?: string; hostname?: string } } | null;
  localStorageImpl?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> | null;
  sessionStorageImpl?: Pick<Storage, 'clear'> | null;
  cachesImpl?: { keys: () => Promise<string[]>; delete: (key: string) => Promise<boolean> } | null;
  windowImpl?: MobilePurgeOptions['windowImpl'];
}

export interface CompleteAccountDeletionResult {
  deleted: boolean;
  validation: DeletionValidationResult;
  serverDeleted: boolean;
  clearedDefaultMirror: boolean;
  mobilePurged: boolean;
  wipedEntireLocalStorage: boolean;
  clearedCacheCount: number;
  cookiesClearedCount: number;
  secondaryAccount: SavedAccountCandidate | null;
  switchPromptText: string | null;
}

/**
 * Executes synchronized, concurrent account removal across all 3 layers:
 * 1. Server record + default mirror + Set-Cookie invalidation
 * 2. Mobile client localStorage, sessionStorage, caches, undo snapshots, and preferences
 * 3. Web client session cookie invalidation
 *
 * After completion, checks for another saved authenticated profile on the device
 * and returns the automated switch prompt if one exists.
 */
export async function executeCompleteAccountDeletion(
  options: CompleteAccountDeletionOptions
): Promise<CompleteAccountDeletionResult> {
  const validation = validateDeletionTarget({
    scope: 'account',
    activeUserId: options.activeUserId,
    targetUserId: options.targetUserId
  });

  if (!validation.valid) {
    return {
      deleted: false,
      validation,
      serverDeleted: false,
      clearedDefaultMirror: false,
      mobilePurged: false,
      wipedEntireLocalStorage: false,
      clearedCacheCount: 0,
      cookiesClearedCount: 0,
      secondaryAccount: null,
      switchPromptText: null
    };
  }

  // Inspect remaining saved authenticated accounts BEFORE wiping active user state
  const secondaryAccount = findSecondarySavedAccount(options.stateObj, validation.normalizedUserId);

  // Run Server deletion, Mobile storage/cache purge, and Web cookie invalidation CONCURRENTLY
  const [serverRes, mobileRes, cookiesClearedCount] = await Promise.all([
    deleteUserAccountFromSupabase({
      endpoint: options.endpoint,
      activeUserId: options.activeUserId,
      targetUserId: options.targetUserId,
      fetchImpl: options.fetchImpl
    }),
    purgeMobileClientStorage({
      storageKey: options.storageKey,
      deletedEmail: validation.normalizedUserId,
      stateObj: options.stateObj,
      preserveRemainingProfiles: Boolean(secondaryAccount),
      localStorageImpl: options.localStorageImpl,
      sessionStorageImpl: options.sessionStorageImpl,
      cachesImpl: options.cachesImpl,
      windowImpl: options.windowImpl
    }),
    Promise.resolve().then(() => clearAllWebSessionCookies(options.docImpl))
  ]);

  return {
    deleted: true,
    validation,
    serverDeleted: serverRes.remoteDeleted,
    clearedDefaultMirror: Boolean(serverRes.clearedDefaultMirror),
    mobilePurged: mobileRes.purged,
    wipedEntireLocalStorage: mobileRes.wipedEntireLocalStorage,
    clearedCacheCount: mobileRes.clearedCacheCount,
    cookiesClearedCount,
    secondaryAccount,
    switchPromptText: secondaryAccount ? buildPostDeleteSwitchPrompt(secondaryAccount.name) : null
  };
}

export interface OnDeleteSuccessOptions {
  deletedEmail?: string | null;
  secondaryAccount?: SavedAccountCandidate | null;
  oauthProviders?: readonly string[];
  onOpenAccountSelectModal?: (payload: OnDeleteSuccessPayload) => void;
}

export interface OnDeleteSuccessPayload {
  modalPrompt: string;
  deletedEmail: string;
  oauthProviders: string[];
  secondaryAccount: SavedAccountCandidate | null;
  shouldOpenAccountSelectModal: true;
}

/**
 * Task 1: Streamlined Account Deletion `onDeleteSuccess` handler.
 * Triggered immediately once the account is deleted from Supabase.
 * Opens the post-delete modal with exact text:
 * "Account deleted. Please select your active account to continue."
 * and surfaces available OAuth login options (Google, Apple) inside the modal.
 */
export function onDeleteSuccess(options: OnDeleteSuccessOptions = {}): OnDeleteSuccessPayload {
  const oauthProviders =
    Array.isArray(options.oauthProviders) && options.oauthProviders.length > 0
      ? [...options.oauthProviders]
      : [...AVAILABLE_OAUTH_LOGIN_PROVIDERS];

  const payload: OnDeleteSuccessPayload = {
    modalPrompt: POST_DELETE_SELECT_ACCOUNT_PROMPT,
    deletedEmail: normalizeAccountUserId(options.deletedEmail),
    oauthProviders,
    secondaryAccount: options.secondaryAccount || null,
    shouldOpenAccountSelectModal: true
  };

  if (typeof options.onOpenAccountSelectModal === 'function') {
    options.onOpenAccountSelectModal(payload);
  }

  return payload;
}

