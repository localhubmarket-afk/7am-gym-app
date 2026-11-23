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

export interface StartFreshCloudPushResult {
  nextState: Record<string, any>;
  clearedSummary: StartFreshClearedSummary;
  cloudSynced: boolean;
  endpoint: string;
  lastUpdated: string;
}

export const START_FRESH_CONFIRM_TITLE = 'Start Fresh and Clear Your Data?';
export const START_FRESH_CONFIRM_COPY =
  'This will clear all logged workouts, meal and fuel logs, fridge batch prep (oats and rice), and your shopping list. You will start back at 0.';

const ALL_WEEK1_CLEARED_DAYS_MAP: Record<string, boolean> = {
  w1_d0: true,
  w1_d1: true,
  w1_d2: true,
  w1_d3: true,
  w1_d4: true,
  w1_d5: true,
  w1_d6: true
};

function countKeys(obj: unknown): number {
  if (!obj || typeof obj !== 'object') return 0;
  return Object.keys(obj as Record<string, unknown>).length;
}

/**
 * Returns a strictly empty baseline gym_state template with zero seeded workouts,
 * zero fuel logs, zero fridge batch prep inventory, and an empty shopping list.
 */
export function createEmptyBaselineGymState(nowIso: string = new Date().toISOString()): Record<string, any> {
  return {
    // 1. Completely empty workout & progression state
    selectedDayIndex: 0,
    currentWeek: 1,
    selectedWeek: 1,
    maxUnlockedWeek: 1,
    completedWeeks: {},
    workoutLogs: {},
    pullupLogs: {},
    cardioLogs: {},
    cardioUiModeByEx: {},
    warmupLogs: {},
    exerciseHistory: {},
    exerciseNotes: {},
    exerciseUnitPrefs: {},
    timedHoldSeconds: {},
    timedHoldSetSeconds: {},
    timedHoldCompletedSets: {},
    customDayExercises: {},
    customDayScheduleByWeek: {},
    manualScheduleOverrideByWeek: {},
    weeklyRestDays: { default: [5, 6] },
    crunchDays: [0, 1, 2, 3, 4, 5, 6],
    exerciseSwaps: {},
    historyExerciseSwaps: {},
    revertedMachineSwaps: {},
    convertedExercises: {},
    pendingMachineSwapPreviews: {},
    expandedDoneCards: {},
    manualCollapsedCards: {},
    cardCollapsedState: {},
    openImagePanels: {},
    openNotePanels: {},
    warmupClosedByDay: {},
    clearedDaysMap: { ...ALL_WEEK1_CLEARED_DAYS_MAP },
    francoisWeek1RestoredV2: true,
    hasStartedFresh: true,
    startFreshResetAt: nowIso,
    lastWorkoutActivityAt: null,
    dismissedForgottenSetActivityAt: null,
    dismissedOvertrainingAlertKey: '',
    undoBackup: null,

    // 2. Completely empty fuel & meal logs
    fuelLogs: {},
    checkedMeals: {},
    checkedMealIngredients: {},
    hiddenMealChecklists: {},
    openMealFormulas: {},
    openPreFuelDetails: false,
    waterIntakeLogs: {},
    waterLogsMl: {},
    flexMealOverridesByDay: {},
    quickAddCaloriesByDay: {},
    fuelDaySnapshots: {},
    loggedMealSnapshots: {},
    fuelCustomizations: {},
    dismissedPreFuelPrompt: {},
    dismissedChronoAlertsByDay: {},
    wakeUpTimeByDay: {},
    restDayCarbMode: 'match',

    // 3. Completely zeroed batch preparation trackers (oats & rice in fridge)
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
    forceShowRiceTimerInKeto: false,

    // 4. Completely empty shopping list
    checkedEssentials: {},
    checkedGroceries: {},
    customShoppingItems: [],
    shopBrandOverrides: {},
    subscriptionChecklist: {
      cancelCreatineAutoship: false,
      dropPeaTo3Containers: false
    },

    // 5. Cleared transient locker, chat, & biometric state
    gymLocker: { pin: '', photoDataUrl: '', updatedAt: null },
    biometricsSnapshot: null,
    geminiChatHistory: [],
    selectedOneRmChartLift: 'bench',
    showRestDayMobility: false,
    openRestMobilityDrawer: false,
    openDayWorkoutPicker: false,
    migratedDailyAbsV3: true,
    last_updated: nowIso,
    updatedAt: nowIso
  };
}

/**
 * Task 1: Strict "Start Fresh" Complete Data Removal.
 * Strictly overwrites gym_state with an empty default baseline template while preserving
 * only the user's login identity, diet/accessibility preferences, and sync endpoint.
 * Scrubs any cached workoutLogs/pullupLogs inside accountsByEmail for the active user so
 * reloading or switching never revives stale workouts.
 */
export function buildStartFreshGymState(
  currentState: Record<string, any> | null | undefined,
  baselineDefaults?: Record<string, any> | null
): StartFreshResetResult {
  const prev = currentState && typeof currentState === 'object' ? currentState : {};
  const base = baselineDefaults && typeof baselineDefaults === 'object' ? baselineDefaults : {};
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
    countKeys(prev.waterLogsMl) +
    countKeys(prev.quickAddCaloriesByDay) +
    countKeys(prev.flexMealOverridesByDay);

  const clearedShoppingItemsCount =
    countKeys(prev.checkedEssentials) +
    countKeys(prev.checkedGroceries) +
    (Array.isArray(prev.customShoppingItems) ? prev.customShoppingItems.length : 0) +
    countKeys(prev.shopBrandOverrides);

  const preservedProfile = prev.userProfile
    ? JSON.parse(JSON.stringify(prev.userProfile))
    : base.userProfile
      ? JSON.parse(JSON.stringify(base.userProfile))
      : { name: 'Guest', email: '', isGuest: true, authProvider: 'guest_local' };

  const preservedWizardConfig = prev.programWizardConfig
    ? JSON.parse(JSON.stringify(prev.programWizardConfig))
    : base.programWizardConfig
      ? JSON.parse(JSON.stringify(base.programWizardConfig))
      : {
          daysPerWeek: 5,
          primaryFocus: 'balanced',
          difficulty: 'medium',
          diet: 'vegan',
          baseDiet: 'Vegan',
          intolerances: []
        };

  const weeklyTarget = Math.max(
    1,
    Math.min(7, Number(prev.weeklyWorkoutTarget || preservedWizardConfig.daysPerWeek || 5))
  );

  // Preserve saved accounts list, but scrub the active account's cached workoutLogs so reload never restores old workouts
  const sanitizedAccountsByEmail: Record<string, any> =
    prev.accountsByEmail && typeof prev.accountsByEmail === 'object'
      ? JSON.parse(JSON.stringify(prev.accountsByEmail))
      : {};
  const activeEmailKey =
    preservedProfile && typeof preservedProfile.email === 'string'
      ? preservedProfile.email.trim().toLowerCase()
      : '';
  if (activeEmailKey && sanitizedAccountsByEmail[activeEmailKey]) {
    sanitizedAccountsByEmail[activeEmailKey] = {
      ...sanitizedAccountsByEmail[activeEmailKey],
      workoutLogs: {},
      pullupLogs: {},
      cardioLogs: {},
      fuelLogs: {},
      checkedMeals: {},
      checkedGroceries: {},
      completedWeeks: {},
      currentWeek: 1,
      hasStartedFresh: true,
      startFreshResetAt: nowIso,
      snapshot: {
        ...(sanitizedAccountsByEmail[activeEmailKey].snapshot || {}),
        workoutLogs: {},
        pullupLogs: {},
        cardioLogs: {},
        fuelLogs: {},
        checkedMeals: {},
        checkedGroceries: {},
        completedWeeks: {},
        currentWeek: 1,
        hasStartedFresh: true,
        startFreshResetAt: nowIso
      }
    };
  }

  const onboardingDone = Boolean(
    prev.onboardingComplete || prev.userHasCompletedOnboarding || prev.hasCompletedFirstSetup
  );

  // Strictly start from the guaranteed empty baseline template (never copy seeded workoutLogs from DEFAULT_STATE)
  const nextState: Record<string, any> = {
    ...createEmptyBaselineGymState(nowIso),
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
    weeklyWorkoutTarget: weeklyTarget,
    onboardingComplete: onboardingDone,
    userHasCompletedOnboarding: onboardingDone,
    hasCompletedFirstSetup: onboardingDone,
    capturedLeads: Array.isArray(prev.capturedLeads)
      ? JSON.parse(JSON.stringify(prev.capturedLeads))
      : [],
    accountsByEmail: sanitizedAccountsByEmail,
    cloudDbUrl: typeof prev.cloudDbUrl === 'string' ? prev.cloudDbUrl : '',
    geminiApiKeyLocal: typeof prev.geminiApiKeyLocal === 'string' ? prev.geminiApiKeyLocal : ''
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

/**
 * Strictly overwrites local gym_state with the empty baseline template AND immediately
 * pushes the cleared state to Supabase (/api/state) to overwrite the cloud database.
 */
export async function executeStartFreshAndPushToSupabase(options: {
  currentState: Record<string, any> | null | undefined;
  endpoint?: string;
  storageKey?: string;
  storage?: Pick<Storage, 'setItem'> | null;
  fetchImpl?: typeof fetch;
}): Promise<StartFreshCloudPushResult> {
  const { nextState, clearedSummary } = buildStartFreshGymState(options.currentState);
  const endpoint = String(options.endpoint || '').trim();
  const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);

  if (options.storageKey && options.storage) {
    try {
      options.storage.setItem(options.storageKey, JSON.stringify(nextState));
    } catch {
      // Ignore storage quota restrictions
    }
  }

  let cloudSynced = false;
  let authoritativeTs = nextState.last_updated;

  if (endpoint && fetchFn) {
    try {
      const isFirebase = endpoint.includes('firebaseio.com') || endpoint.endsWith('.json');
      const isSupabaseApi = endpoint.includes('/api/state');
      const pushPayload = JSON.stringify({
        ...nextState,
        forceOverwrite: true,
        resetReason: 'start_fresh_reset'
      });

      const resp = await fetchFn(endpoint, {
        method: isFirebase ? 'PUT' : 'POST',
        cache: 'no-store',
        keepalive: pushPayload.length < 60000,
        headers: {
          'Content-Type': isSupabaseApi ? 'application/json' : 'text/plain;charset=utf-8'
        },
        body: pushPayload
      });

      const json = await resp.json().catch(() => ({}));
      if (resp.ok && json && json.configured !== false) {
        cloudSynced = true;
        const serverTs =
          (typeof json.last_updated === 'string' && json.last_updated) ||
          (typeof json.updatedAt === 'string' && json.updatedAt) ||
          authoritativeTs;
        authoritativeTs = serverTs;
        nextState.last_updated = serverTs;
        nextState.updatedAt = serverTs;
        if (options.storageKey && options.storage) {
          try {
            options.storage.setItem(options.storageKey, JSON.stringify(nextState));
          } catch {
            // Ignore storage quota restrictions
          }
        }
      }
    } catch {
      cloudSynced = false;
    }
  }

  return {
    nextState,
    clearedSummary,
    cloudSynced,
    endpoint,
    lastUpdated: authoritativeTs
  };
}
