import { clearActiveDayWorkoutData } from './wizardValidation';

export const WORKOUT_FUEL_RESET_PROMPT =
  'Would you like to delete your meal prep and fuel logs too?';

export const DELETE_ACCOUNT_WARNING_PROMPT =
  'Are you sure you want to delete the account?';

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

/**
 * Task 3: Strict Content Validation for Workout, Fuel, and Account deletions.
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
      errorMessage: 'Cannot delete data without a valid signed-in user account.'
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
      errorMessage: 'Target user ID is missing or invalid.'
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
      errorMessage: 'Blocked deletion because target user ID does not match the active signed-in account.'
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

  // Also clear matching day meals inside the active user's local account snapshot only
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
 * Task 1: Linked Workout and optional Fuel deletion with strict Task 3 validation.
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
  accountId: string;
}

/**
 * Task 2 & Task 3: Validates active user ID, then sends DELETE to Supabase API route
 * to permanently delete only that authenticated user's row.
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
      accountId: validation.supabaseRecordId
    };
  } catch {
    return {
      deleted: true,
      validation,
      remoteDeleted: false,
      accountId: validation.supabaseRecordId
    };
  }
}

/**
 * Purges only the deleted user's local profile & saved account records and resets session
 * so the app cleanly returns to the login screen.
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
