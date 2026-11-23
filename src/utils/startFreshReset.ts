export interface StartFreshClearedSummary {
  clearedWorkoutsCount: number;
  clearedFuelEntriesCount: number;
  clearedBatchPrepVariables: string[];
  clearedShoppingItemsCount: number;
  resetTimestamp: string;
}

export interface StartFreshResetResult {
  nextState: Record<string, any>;
  clearedSummary: StartFreshClearedSummary;
}

export const START_FRESH_CONFIRM_TITLE = 'Start Fresh and Clear Your Data?';
export const START_FRESH_CONFIRM_COPY =
  'This will clear all logged workouts, meal and fuel logs, fridge batch prep (oats and rice), and your shopping list. You will start back at 0.';

function countKeys(obj: unknown): number {
  if (!obj || typeof obj !== 'object') return 0;
  return Object.keys(obj as Record<string, unknown>).length;
}

/**
 * Task 2: Complete Data Removal ("Start Fresh").
 * Resets active gym_state to clean baseline defaults while explicitly clearing:
 * 1. All logged workouts & exercise history
 * 2. All fuel & meal logs
 * 3. All active batch prep variables (oats and rice in the fridge)
 * 4. Active shopping list & checked grocery items
 *
 * Preserves account login identity, theme preference, and sound settings so the user
 * stays signed in cleanly without losing accessibility preferences.
 */
export function buildStartFreshGymState(
  currentState: Record<string, any> | null | undefined,
  baselineDefaults?: Record<string, any> | null
): StartFreshResetResult {
  const prev = currentState && typeof currentState === 'object' ? currentState : {};
  const base = baselineDefaults && typeof baselineDefaults === 'object'
    ? JSON.parse(JSON.stringify(baselineDefaults))
    : {};

  const nowIso = new Date().toISOString();

  const clearedWorkoutsCount =
    countKeys(prev.workoutLogs) +
    countKeys(prev.pullupLogs) +
    countKeys(prev.cardioLogs);

  const clearedFuelEntriesCount =
    countKeys(prev.fuelLogs) +
    countKeys(prev.checkedMeals) +
    countKeys(prev.checkedMealIngredients) +
    countKeys(prev.waterIntakeLogs) +
    countKeys(prev.quickAddCaloriesByDay) +
    countKeys(prev.flexMealOverridesByDay);

  const clearedShoppingItemsCount =
    countKeys(prev.checkedEssentials) +
    countKeys(prev.checkedGroceries) +
    (Array.isArray(prev.customShoppingItems) ? prev.customShoppingItems.length : 0) +
    countKeys(prev.shopBrandOverrides);

  const preservedProfile = prev.userProfile
    ? JSON.parse(JSON.stringify(prev.userProfile))
    : base.userProfile || { name: 'Guest', email: '', isGuest: true, authProvider: 'guest_local' };

  const preservedWizardConfig = prev.programWizardConfig
    ? JSON.parse(JSON.stringify(prev.programWizardConfig))
    : base.programWizardConfig || {
        daysPerWeek: 5,
        primaryFocus: 'balanced',
        difficulty: 'medium',
        diet: 'vegan',
        baseDiet: 'Vegan',
        intolerances: []
      };

  const weeklyTarget = Number(
    prev.weeklyWorkoutTarget || preservedWizardConfig.daysPerWeek || 5
  );

  const nextState: Record<string, any> = {
    ...base,
    // Preserve account & accessibility settings
    userProfile: preservedProfile,
    isGuestMode: Boolean(prev.isGuestMode),
    themeMode: prev.themeMode || base.themeMode || 'dark',
    weightUnit: prev.weightUnit || base.weightUnit || 'lbs',
    soundEnabled: prev.soundEnabled !== undefined ? prev.soundEnabled : true,
    audioMode: prev.audioMode || 'sound_vibe',
    timerTone: prev.timerTone || 'warm_marimba',
    timerVolume: typeof prev.timerVolume === 'number' ? prev.timerVolume : 0.55,
    baseDiet: prev.baseDiet || base.baseDiet || 'Vegan',
    diet: prev.diet || base.diet || 'Vegan',
    dietPreference: prev.dietPreference || base.dietPreference || 'vegan',
    intolerances: Array.isArray(prev.intolerances) ? [...prev.intolerances] : [],
    programWizardConfig: preservedWizardConfig,
    weeklyWorkoutTarget: Math.max(1, Math.min(7, weeklyTarget)),
    onboardingComplete: Boolean(prev.onboardingComplete || prev.userHasCompletedOnboarding || prev.hasCompletedFirstSetup),
    userHasCompletedOnboarding: Boolean(prev.onboardingComplete || prev.userHasCompletedOnboarding || prev.hasCompletedFirstSetup),
    hasCompletedFirstSetup: Boolean(prev.onboardingComplete || prev.userHasCompletedOnboarding || prev.hasCompletedFirstSetup),
    capturedLeads: Array.isArray(prev.capturedLeads) ? JSON.parse(JSON.stringify(prev.capturedLeads)) : [],
    accountsByEmail: prev.accountsByEmail && typeof prev.accountsByEmail === 'object'
      ? JSON.parse(JSON.stringify(prev.accountsByEmail))
      : {},
    cloudDbUrl: typeof prev.cloudDbUrl === 'string' ? prev.cloudDbUrl : '',
    geminiApiKeyLocal: typeof prev.geminiApiKeyLocal === 'string' ? prev.geminiApiKeyLocal : '',

    // 1. Explicitly clear ALL logged workouts & progression tracking
    selectedDayIndex: 0,
    currentWeek: 1,
    selectedWeek: 1,
    maxUnlockedWeek: 1,
    completedWeeks: {},
    workoutLogs: {},
    pullupLogs: {},
    cardioLogs: {},
    warmupLogs: {},
    exerciseHistory: {},
    exerciseNotes: {},
    timedHoldSeconds: {},
    timedHoldCompletedSets: {},
    customDayExercises: {},
    customDayScheduleByWeek: {},
    manualScheduleOverrideByWeek: {},
    exerciseSwaps: {},
    revertedMachineSwaps: {},
    convertedExercises: {},
    expandedDoneCards: {},
    manualCollapsedCards: {},
    openNotePanels: {},
    warmupClosedByDay: {},
    lastWorkoutActivityAt: null,
    dismissedForgottenSetActivityAt: null,
    dismissedOvertrainingAlertKey: '',
    undoBackup: null,

    // 2. Explicitly clear ALL fuel & meal logs
    fuelLogs: {},
    checkedMeals: {},
    checkedMealIngredients: {},
    hiddenMealChecklists: {},
    openMealFormulas: {},
    waterIntakeLogs: {},
    flexMealOverridesByDay: {},
    quickAddCaloriesByDay: {},
    fuelDaySnapshots: {},
    loggedMealSnapshots: {},
    fuelCustomizations: {},
    dismissedPreFuelPrompt: {},
    dismissedChronoAlertsByDay: {},

    // 3. Explicitly clear ALL active batch prep variables (oats and rice in the fridge)
    batchInventory: {
      oatsJarsRemaining: 0,
      riceBowlsRemaining: 0,
      oatsPrepDay: null,
      ricePrepDay: null
    },
    oatsPrepDay: null,
    ricePrepDay: null,
    oatsBatchDays: 4,
    oatsBatchPortions: 4,
    riceBatchPortions: 4,
    recipePrepLogs: {},
    prepNotes: {},
    openPrepNoteCards: {},
    activeRiceTimerStage: null,
    riceCookPhaseCompleted: false,
    riceCooldownPhaseCompleted: false,
    riceTimerAlertBanner: '',
    riceBannerDismissed: false,

    // 4. Explicitly clear active shopping list
    checkedEssentials: {},
    checkedGroceries: {},
    customShoppingItems: [],
    shopBrandOverrides: {},
    subscriptionChecklist: {
      cancelCreatineAutoship: false,
      dropPeaTo3Containers: false
    },

    // Clear locker & biometrics transient logs
    gymLocker: { pin: '', photoDataUrl: '', updatedAt: null },
    biometricsSnapshot: null,
    last_updated: nowIso
  };

  return {
    nextState,
    clearedSummary: {
      clearedWorkoutsCount,
      clearedFuelEntriesCount,
      clearedBatchPrepVariables: [
        'batchInventory.oatsJarsRemaining',
        'batchInventory.riceBowlsRemaining',
        'batchInventory.oatsPrepDay',
        'batchInventory.ricePrepDay',
        'oatsPrepDay',
        'ricePrepDay',
        'recipePrepLogs',
        'activeRiceTimerStage',
        'riceCookPhaseCompleted',
        'riceCooldownPhaseCompleted'
      ],
      clearedShoppingItemsCount,
      resetTimestamp: nowIso
    }
  };
}
