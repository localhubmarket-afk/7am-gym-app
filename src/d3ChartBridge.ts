import * as d3 from 'd3';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import './styles/accessibility.css';
import { AccessibleVideoPlayer, type AccessibleVideoPlayerProps } from './components/AccessibleVideoPlayer';
import { Phase2AccessibilityHub, type Phase2AccessibilityHubProps } from './components/Phase2AccessibilityHub';
import { PlainLanguageCoachModal, type PlainLanguageCoachModalProps } from './components/PlainLanguageCoachModal';
import {
  AI_EXERCISE_WHITELIST_RULE,
  ONE_RM_LIFT_CONFIGS,
  SYNC_OVERWRITE_WARNING_TEXT,
  SYNC_SUPABASE_DELAY_MS,
  SYNC_UNDO_TOAST_DURATION_MS,
  clampRepsInputValue,
  clampWeightInputValue,
  computeUnifiedWeeklyVolumeSeries,
  createDelayedCloudPushController,
  createFullStateUndoBackup,
  createSyncUndoSnapshot,
  extractOneRmProgressionSeries,
  formatOneRmTooltipText,
  formatWeeklyVolumeTooltipText,
  hasLoggedSetsInWeek,
  hasWeekWorkoutData,
  restoreFullStateUndoBackup,
  restoreSyncUndoSnapshot,
  serializeStateForPersistence,
  type OneRmChartPoint,
  type OneRmLiftKey,
  type UnifiedWeeklyVolumePoint
} from './utils/workoutLogic';
import {
  STANDARD_CARDIO_SESSIONS,
  buildValidatedWizardProgram,
  classifyExerciseCategory,
  clearActiveDayWorkoutData,
  enforceDifficultyOnExercise,
  enforceDifficultyOnRoutine,
  filterRecipesByDietAndIntolerances,
  getDifficultyMultipliers,
  groupExercisesByCategory,
  isBikingExercise,
  isOverhandPullUpsExercise,
  isRecipeAllowedForDiet,
  normalizeCardioExerciseName,
  orderExercisesWithPullUpsFirst,
  resolveDisplayUsername,
  validateProgramWizardConfig
} from './utils/wizardValidation';
import {
  countTotalLoggedSetsInState,
  createAutoSupabaseSyncEngine,
  fetchLatestCloudStateAsSingleSourceOfTruth,
  getStateLastUpdatedIso,
  parseTimestampMs,
  resolveSingleSourceOfTruthState,
  stampGymStateLastUpdated
} from './utils/workoutSyncEngine';
import {
  AVAILABLE_OAUTH_LOGIN_PROVIDERS,
  DELETE_ACCOUNT_BUTTON_LABELS,
  DELETE_ACCOUNT_MAIN_WARNING,
  DELETE_ACCOUNT_WARNING_BULLETS,
  DELETE_ACCOUNT_WARNING_PROMPT,
  DELETE_ALL_WEEKS_BUTTON_LABEL,
  DELETE_ALL_WEEKS_CONFIRM_WARNING,
  POST_DELETE_SELECT_ACCOUNT_PROMPT,
  WORKOUT_FUEL_RESET_PROMPT,
  buildPostDeleteSwitchPrompt,
  clearActiveDayFuelData,
  clearActiveDayWorkoutAndOptionalFuel,
  clearAllWebSessionCookies,
  deleteAllWeeksCompleteReset,
  deleteFuelForActiveDay,
  deleteUserAccountFromSupabase,
  deleteWorkoutAndFuelForActiveDay,
  deleteWorkoutForActiveDay,
  executeCompleteAccountDeletion,
  findAllRemainingSavedAccounts,
  findSecondarySavedAccount,
  isValidDeletableUserId,
  normalizeAccountUserId,
  onDeleteSuccess,
  purgeDeletedAccountFromLocalState,
  purgeMobileClientStorage,
  validateDeletionTarget
} from './utils/deletionValidation';
import {
  START_FRESH_CONFIRM_COPY,
  START_FRESH_CONFIRM_TITLE,
  buildStartFreshGymState,
  createEmptyBaselineGymState,
  executeStartFreshAndPushToSupabase
} from './utils/startFreshReset';
import {
  HEAVY_WEIGHT_MULTIPLIER_THRESHOLD,
  buildHeavyWeightWarningMessage,
  getHistoricalMaxWeightForExercise,
  validateSetWeightSanity
} from './utils/workoutSanityCheck';
import {
  runDeploymentValidationChecklist,
  scanContentForBrokenLinksAndTypos,
  validateScientificAlignment,
  validateWorkoutPlanExpertApproval
} from './utils/contentValidationProtocol';
import {
  DEFAULT_IKEA_QUIZ_ANSWERS,
  IKEA_QUIZ_ALL_STEPS,
  IKEA_QUIZ_STEPS,
  ONBOARDING_ACCESSIBILITY_QUESTION,
  ONBOARDING_ACCESSIBILITY_STEP,
  adaptExerciseForEquipment,
  buildIkeaQuizProgram,
  createGuestSandboxStatePatch
} from './utils/onboardingQuiz';
import {
  enqueueOfflineGymStateSync,
  flushOfflineGymStateQueue,
  isNetworkOnline,
  readOfflineSyncQueue
} from './utils/offlineSyncQueue';
import {
  ACCESSIBLE_THEME_TOKENS,
  ADHD_VIEW_STORAGE_KEY,
  DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK,
  DYSLEXIA_VIEW_STORAGE_KEY,
  OPENDYSLEXIC_FONT_STACK,
  SENSORY_CALM_STORAGE_KEY,
  WCAG_STRICT_CONTRAST_TARGETS,
  applyAdhdFriendlyViewToDocument,
  applyDyslexiaFontToDocument,
  applyDyslexiaFriendlyViewToDocument,
  applySensoryCalmToDocument,
  applyThemeToDocument,
  calculateWcagContrastRatio,
  getSystemPrefersDark,
  loadStoredAdhdViewPreference,
  loadStoredDyslexiaViewPreference,
  loadStoredFontPreference,
  loadStoredSensoryCalmPreference,
  loadStoredThemePreference,
  normalizeFontModePreference,
  normalizeSensoryCalmPreference,
  normalizeThemeModePreference,
  resolveEffectiveTheme,
  saveAdhdViewPreference,
  saveDyslexiaViewPreference,
  saveFontPreference,
  saveSensoryCalmPreference,
  saveThemePreference,
  verifyThemeContrastCompliance
} from './utils/themeProvider';
import {
  DEFAULT_VALIDATION_LIMITS,
  validateAccountProfileInput,
  validateExerciseSetEntry,
  validateGymTimeInput,
  validateLoggedReps,
  validateLoggedWeight,
  validateQuickAddFuelInput,
  validateTimerDurationSeconds,
  validateWorkoutNoteText
} from './utils/inputValidation';
import {
  captureViewportScrollAnchor,
  computeStableScrollTargetY,
  restoreViewportScrollAnchor,
  scrollContainerHorizontallyWithoutVerticalJump,
  withStableViewportScroll
} from './utils/viewportStability';
import {
  detectCsvSourceApp,
  mapExternalExerciseToSchema,
  mergeImportedHistoryIntoGymState,
  parseWorkoutHistoryCsv
} from './utils/csvHistoryImporter';
import {
  computeAdherenceNeutralWeeklyProgress,
  computeRolling30DayConsistencyScore
} from './utils/adherenceEngine';
import {
  ADVANCED_SUBJECTIVE_STORAGE_KEY,
  DEFAULT_SUBJECTIVE_TRACKING_ENABLED,
  calculateDoubleProgressionTarget,
  evaluateExerciseDoubleProgressionFromGymState,
  loadAdvancedSubjectiveSetting,
  parseObjectiveRepRange,
  saveAdvancedSubjectiveSetting
} from './utils/doubleProgressionEngine';
import {
  DEFAULT_KG_PLATES,
  DEFAULT_LBS_PLATES,
  STANDARD_BAR_WEIGHT_KG,
  STANDARD_BAR_WEIGHT_LBS,
  buildVisualPlateLoaderSvgHtml,
  calculateVisualBarbellPlates
} from './utils/plateLoader';
import {
  dispatchRestTimerCompletionAlert,
  shouldMuteSensoryOutput,
  triggerSafeHapticFeedback
} from './utils/pwaRestTimer';
import {
  calculateEstimated1RM,
  evaluateSessionMicroWins
} from './utils/microWinsEngine';
import { computeExplainableProgressionMath } from './utils/explainableMath';
import {
  parseNutritionLabelText,
  parseWeightStackText,
  scanNutritionLabelOCR,
  scanWeightMachineStackOCR,
  startDeviceCameraStream
} from './utils/visionOcrStub';
import {
  applyBiometricVolumeToExercises,
  attachBiometricsToGymState,
  calculateBiometricVolumeAdjustment,
  fetchAppleHealthKitBiometricsStub,
  fetchGoogleHealthConnectBiometricsStub,
  fetchLatestBiometricsFromSupabase,
  syncDailyBiometricsToSupabase
} from './utils/biometricSync';
import {
  CLINICAL_TRIAL_EXPORT_WEEKS,
  anonymizeParticipantId,
  applyInstitutionalFlagsToUserProfile,
  buildAnonymized12WeekClinicalTrialRows,
  escapeCsvCellSafe,
  exportAnonymized12WeekClinicalTrialCsv,
  normalizeInstitutionalEligibility,
  resolveInstitutionalBillingRoute,
  serializeClinicalTrialCsv,
  triggerClinicalTrialCsvDownload
} from './utils/institutionalClinicalExport';
import { createSmartwatchBridge } from './smartwatch/watchBridge';
import {
  clearAllGymIndexedDbStores,
  clearIndexedDbSyncOutbox,
  enqueueIndexedDbSyncItem,
  getPendingIndexedDbSyncItems,
  loadGymStateFromIndexedDB,
  removeIndexedDbSyncItem,
  saveGymStateToIndexedDB
} from './utils/gymIndexedDb';
import {
  flushIndexedDbSyncOutbox,
  hydrateGymStateLocalFirst,
  notifyServiceWorkerToSync,
  persistGymStateLocalFirst,
  startOfflineFirstBackgroundSync
} from './utils/offlineFirstSync';
import {
  getSupabaseClient,
  isSupabaseRealtimeConfigured,
  resolveGymStateRecordId
} from './lib/supabaseClient';
import {
  AUTO_SYNC_DEBOUNCE_MS,
  AUTO_SYNC_STORAGE_KEY,
  AUTO_SYNC_TOGGLE_LABEL,
  AUTO_SYNC_TOGGLE_SUBLABEL,
  DEFAULT_AUTO_SYNC_ENABLED,
  FORCE_PULL_CLOUD_LABEL,
  FORCE_SYNC_NOW_LABEL,
  createDebounce,
  createSupabaseRealtimeSyncManager,
  evaluateRealtimeIncomingPayload,
  loadAutoSyncPreference,
  normalizeAutoSyncPreference,
  saveAutoSyncPreference,
  type SupabaseRealtimeSyncManager
} from './utils/realtimeAutoSync';
import {
  DATA_BACKUP_MIGRATION_TITLE,
  DEFAULT_BACKUP_FILENAME,
  FORCE_PULL_SUCCESS_TOAST,
  forcePullGymStateFromCloud,
  importGymStateFromJsonText,
  resolveAuthenticatedGymStateIds,
  serializeGymStateForJsonExport,
  triggerGymStateJsonDownload,
  validateGymStateBackupSchema
} from './utils/dataMigrationAndPull';
import {
  PASSKEY_REGISTRY_STORAGE_KEY,
  authenticateWithBiometricPasskey,
  buildSafeMagicLinkRedirectUrl,
  checkPlatformBiometricPasskeyAvailability,
  hasRegisteredPasskeyForEmail,
  isWebAuthnPasskeySupported,
  loadRegisteredPasskeys,
  registerBiometricPasskey,
  resolveDynamicAuthRedirectUrl,
  sendSupabaseMagicLink,
  validatePasswordlessEmail,
  verifySupabaseMagicLinkOtp
} from './utils/passwordlessAuth';
import {
  hardDeleteAccount,
  purgeSupabaseAuthStorageKeys
} from './utils/hardDeleteAccount';
import {
  ALLOWED_PLAYBACK_RATES,
  BARBELL_SQUAT_MEDIA_SAMPLES,
  DEFAULT_ACCESSIBLE_VIDEO_SETTINGS,
  formatSecondsClock,
  getActiveLiteralStepAtTime,
  getActiveVttCaptionAtTime,
  parseVttTimestampToSeconds,
  parseWebVttCaptions,
  sanitizeMediaUrl
} from './utils/accessibleVideoMedia';

import {
  applyVoiceLogToGymState,
  createBrowserSpeechRecognizer,
  isWebSpeechRecognitionSupported,
  normalizeSpokenNumbers,
  parseSpokenSetPhrase,
  revertVoiceLogFromGymState
} from './utils/voiceToLog';
import {
  PLAIN_LANGUAGE_COACH_SYSTEM_INSTRUCTION,
  buildBoundedProgressionSnapshot,
  requestPlainLanguageCoachExplanation
} from './utils/plainLanguageCoach';
import {
  BARBELL_TO_MACHINE_SWAPS,
  LOW_SPOONS_PRESETS,
  applyLowSpoonsPresetToExercises,
  classifyLowSpoonsWithGemini,
  findStableMachineVariation,
  mapClassificationToValidatedPreset
} from './utils/lowSpoonsTriage';
import {
  AUTH_INPUT_IDS,
  NON_AUTH_INPUT_ATTRIBUTES,
  applyNonAuthInputAttributes,
  buildNonAuthNoteInputProps,
  enforceNonAuthInputsAcrossRoot,
  guardNonAuthNoteFocusEvent,
  isAuthFieldElement,
  shouldPromptForLogin,
  syncHiddenAuthModalInputIsolation
} from './utils/authSessionGuard';
import {
  ACTIVE_WORKOUT_SESSION_KEY,
  MAX_RESUME_SESSION_AGE_MS,
  buildActiveWorkoutSessionSnapshot,
  buildResumeWorkoutBannerCopy,
  clearActiveWorkoutSession,
  loadActiveWorkoutSession,
  saveActiveWorkoutSession
} from './utils/workoutResumeSession';
import {
  buildProminentWarmupQuickTips,
  computeLiveScheduleContext,
  formatMinutes12Hour,
  formatMinutesHHMM,
  parseHHMMMinutesSafe
} from './utils/realtimeScheduleSync';
import {
  NEXT_WEEK_NOTE_QUICK_CHIPS,
  buildNextWeekProgressionNote,
  extractReadableTextFromPdfBytes,
  parseCustomWorkoutProgram
} from './utils/customProgramImporter';
import {
  CustomProgramUploadPanel,
  type CustomProgramUploadPanelProps
} from './components/CustomProgramUploadPanel';
import {
  extractAvatarInitial,
  resolveHeaderAuthState,
  sanitizeAvatarUrl,
  subscribeGlobalHeaderAuthState,
  syncDomHeaderAuthButton
} from './utils/headerAuthSync';
import {
  DEFAULT_MEAL_SLOT_BASE_COSTS,
  INGREDIENT_SWAP_CATALOG,
  PRODUCT_THUMBNAILS,
  SWAP_MODAL_TITLE,
  applyIngredientSwapToGymState,
  applyIngredientSwapsToDayPlan,
  buildProductThumbnailDataUri,
  computeSwapMacroDeltas,
  estimateIngredientServingCost,
  getSwapOptionsForIngredient,
  inferIngredientCategory,
  recalculateMealTotals,
  resetIngredientSwapInGymState,
  resolveIngredientImageUrl
} from './utils/ingredientSwapEngine';
import {
  SwapIngredientModal,
  type SwapIngredientModalProps
} from './components/SwapIngredientModal';
import {
  applyParsedSetsToExerciseLogs,
  buildSkipOnboardingDefaultPatch,
  extractRecentLiftWeights,
  formatParsedSetsSummary,
  parseInlineSetText,
  resolveNavigationTarget,
  revertFastLogUndoSnapshot
} from './utils/workoutUxImprovements';
import {
  MISSED_SET_ONE_MODAL_QUESTION,
  MACHINE_PHOTO_PATHS,
  buildOfflineMachineDiagramDataUri,
  buildSkippedSetOneLog,
  computeDeviceClockWarmupTimer,
  detectMissedSetOneCondition,
  formatDeviceClock12Hr,
  formatMmSs,
  inferMachineEquipmentFamily,
  isExerciseResolvedDone,
  resolveMachinePhotoAsset,
  resolveMostRecentSuccessfulWeight,
  resolveNextExercisePreviewName,
  validateMachinePhotoRegistry
} from './utils/workoutInterfaceUpgrades';
import {
  CONFLICT_BACKUP_SNAPSHOT_KEY,
  SYNC_CONFLICT_MODAL_QUESTION,
  SYNC_OUTBOX_STORAGE_KEY,
  buildLocalWinsMergedState,
  clearSyncOutbox,
  enqueueSyncOutboxAction,
  evaluatePreLoginSyncStrategy,
  extractCompletedSetFingerprints,
  flushSyncOutboxToSupabase,
  formatSyncComparisonTimestamp,
  loadConflictBackupSnapshot,
  readSyncOutbox,
  saveConflictBackupSnapshot,
  writeSyncOutbox
} from './utils/offlineLoginMergeEngine';
import {
  FLEXIBLE_SET_STEPPER_PALETTE,
  MAX_FLEXIBLE_SETS,
  MIN_FLEXIBLE_SETS,
  adjustExerciseSetCount,
  clampFlexibleSetCount,
  getExerciseSetOverrideKey,
  resolveEffectiveExerciseSetCount,
  resolveWeightStepIncrement,
  shouldLockExerciseOnSetDone,
  shouldShowMicroStartPanel,
  shouldShowResumeWorkoutBanner,
  stepRepsValue,
  stepWeightValue,
  verifyStepperWcagContrastCompliance
} from './utils/flexibleWorkoutUx';

const mountedVideoPlayerRoots = new WeakMap<HTMLElement, Root>();
const mountedPhase2HubRoots = new WeakMap<HTMLElement, Root>();
const mountedCoachModalRoots = new WeakMap<HTMLElement, Root>();
const mountedCustomProgramRoots = new WeakMap<HTMLElement, Root>();
const mountedSwapModalRoots = new WeakMap<HTMLElement, Root>();

interface WidgetErrorBoundaryProps {
  widgetName: string;
  children: React.ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
}

class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    if (typeof console !== 'undefined' && console.error) {
      console.error(`[${this.props.widgetName}] Render error:`, error);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return React.createElement(
        'div',
        {
          role: 'alert',
          className:
            'rounded-xl border border-amber-400/50 bg-slate-900 p-3 text-xs text-slate-100 space-y-2'
        },
        React.createElement(
          'p',
          { className: 'font-bold text-amber-300' },
          `${this.props.widgetName} had a quick hiccup loading.`
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => this.setState({ hasError: false }),
            className:
              'min-h-[44px] rounded-lg border border-emerald-400/60 bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-white transition'
          },
          'Retry Panel'
        )
      );
    }
    return this.props.children;
  }
}

export function mountSwapIngredientModal(
  container: HTMLElement,
  props: SwapIngredientModalProps
): { unmount: () => void } {
  let root = mountedSwapModalRoots.get(container);
  if (!root) {
    root = createRoot(container);
    mountedSwapModalRoots.set(container, root);
  }
  root.render(
    React.createElement(
      WidgetErrorBoundary,
      { widgetName: 'Swap Ingredient' },
      React.createElement(SwapIngredientModal, props)
    )
  );
  return {
    unmount: () => {
      const existing = mountedSwapModalRoots.get(container);
      if (existing) {
        existing.unmount();
        mountedSwapModalRoots.delete(container);
      }
    }
  };
}

export function mountCustomProgramUploadPanel(
  container: HTMLElement,
  props: CustomProgramUploadPanelProps
): { unmount: () => void } {
  let root = mountedCustomProgramRoots.get(container);
  if (!root) {
    root = createRoot(container);
    mountedCustomProgramRoots.set(container, root);
  }
  root.render(
    React.createElement(
      WidgetErrorBoundary,
      { widgetName: 'Custom Program Upload' },
      React.createElement(CustomProgramUploadPanel, props)
    )
  );
  return {
    unmount: () => {
      const existing = mountedCustomProgramRoots.get(container);
      if (existing) {
        existing.unmount();
        mountedCustomProgramRoots.delete(container);
      }
    }
  };
}

export function mountAccessibleVideoPlayer(
  container: HTMLElement,
  props: AccessibleVideoPlayerProps = {}
): { unmount: () => void } {
  let root = mountedVideoPlayerRoots.get(container);
  if (!root) {
    root = createRoot(container);
    mountedVideoPlayerRoots.set(container, root);
  }
  root.render(
    React.createElement(
      WidgetErrorBoundary,
      { widgetName: 'Accessible Form Guide' },
      React.createElement(AccessibleVideoPlayer, props)
    )
  );
  return {
    unmount: () => {
      const existing = mountedVideoPlayerRoots.get(container);
      if (existing) {
        existing.unmount();
        mountedVideoPlayerRoots.delete(container);
      }
    }
  };
}

export function mountPhase2AccessibilityHub(
  container: HTMLElement,
  props: Phase2AccessibilityHubProps
): { unmount: () => void } {
  let root = mountedPhase2HubRoots.get(container);
  if (!root) {
    root = createRoot(container);
    mountedPhase2HubRoots.set(container, root);
  }
  root.render(
    React.createElement(
      WidgetErrorBoundary,
      { widgetName: 'Accessibility Hub' },
      React.createElement(Phase2AccessibilityHub, props)
    )
  );
  return {
    unmount: () => {
      const existing = mountedPhase2HubRoots.get(container);
      if (existing) {
        existing.unmount();
        mountedPhase2HubRoots.delete(container);
      }
    }
  };
}

export function mountPlainLanguageCoachModal(
  container: HTMLElement,
  props: PlainLanguageCoachModalProps
): { unmount: () => void } {
  let root = mountedCoachModalRoots.get(container);
  if (!root) {
    root = createRoot(container);
    mountedCoachModalRoots.set(container, root);
  }
  root.render(
    React.createElement(
      WidgetErrorBoundary,
      { widgetName: 'Plain-Language Coach' },
      React.createElement(PlainLanguageCoachModal, props)
    )
  );
  return {
    unmount: () => {
      const existing = mountedCoachModalRoots.get(container);
      if (existing) {
        existing.unmount();
        mountedCoachModalRoots.delete(container);
      }
    }
  };
}

export interface RenderOneRmD3ChartOptions {
  container: HTMLElement;
  tooltipReadoutEl?: HTMLElement | null;
  liftKey: OneRmLiftKey;
  workoutLogs: Record<string, any>;
  exerciseHistory?: Record<string, any[]>;
  unit?: 'lbs' | 'kg';
}

export function renderOneRmD3Chart(options: RenderOneRmD3ChartOptions): {
  rendered: boolean;
  pointCount: number;
  activeTooltipText: string;
} {
  const { container, tooltipReadoutEl, liftKey, workoutLogs, exerciseHistory, unit = 'lbs' } = options;
  if (!container) {
    return { rendered: false, pointCount: 0, activeTooltipText: '' };
  }

  const liftCfg = ONE_RM_LIFT_CONFIGS[liftKey] || ONE_RM_LIFT_CONFIGS.bench;
  const points: OneRmChartPoint[] = extractOneRmProgressionSeries(
    liftCfg.key,
    workoutLogs,
    exerciseHistory,
    new Date()
  );

  // Strict mobile scroll protection: never trap vertical scroll over the chart
  container.style.touchAction = 'pan-y';
  container.style.background = 'transparent';
  container.style.position = 'relative';

  d3.select(container).selectAll('*').remove();

  if (points.length === 0) {
    d3.select(container)
      .append('div')
      .attr('class', 'rounded-xl border border-slate-800 px-3 py-5 text-center text-xs text-slate-300')
      .style('background', 'transparent')
      .style('letter-spacing', '0.02em')
      .style('line-height', '1.5')
      .text(`Log a set of ${liftCfg.fullName} to see your strength line here.`);
    if (tooltipReadoutEl) {
      tooltipReadoutEl.textContent = `No ${liftCfg.pillLabel} sets logged yet.`;
    }
    return { rendered: false, pointCount: 0, activeTooltipText: '' };
  }

  const width = 336;
  const height = 186;
  const margin = { top: 34, right: 18, bottom: 30, left: 42 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const displayVal = (pt: OneRmChartPoint): number =>
    unit === 'kg' ? Math.round(pt.oneRmLbs / 2.20462) : Math.round(pt.oneRmLbs);

  const values = points.map(displayVal);
  const rawMin = d3.min(values) ?? 0;
  const rawMax = d3.max(values) ?? 100;
  const pad = Math.max(8, Math.round((rawMax - rawMin) * 0.25));
  const yMin = Math.max(0, Math.floor((rawMin - pad) / 5) * 5);
  const yMax = Math.ceil((rawMax + pad) / 5) * 5;

  const xScale = d3
    .scalePoint<number>()
    .domain(points.map((_p, i) => i))
    .range([0, innerW])
    .padding(0.18);

  const yScale = d3.scaleLinear().domain([yMin, Math.max(yMin + 10, yMax)]).range([innerH, 0]).nice(4);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', `${liftCfg.fullName} 1-Rep Max progression chart`)
    .attr('data-onerm-chart-svg', liftCfg.key)
    .style('width', '100%')
    .style('height', 'auto')
    .style('display', 'block')
    .style('background', 'transparent')
    .style('touch-action', 'pan-y')
    .style('overflow', 'visible')
    .style('font-family', 'var(--app-font-family)')
    .style('letter-spacing', '0.02em');

  // Subtle soft gradient under the curve
  const gradId = `onerm-area-grad-${liftCfg.key}`;
  const defs = svg.append('defs');
  const grad = defs
    .append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', liftCfg.strokeColor).attr('stop-opacity', 0.2);
  grad.append('stop').attr('offset', '100%').attr('stop-color', liftCfg.strokeColor).attr('stop-opacity', 0.0);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // 3 or 4 very faint horizontal gridlines ONLY (zero vertical gridlines)
  const yTicks = yScale.ticks(4).slice(0, 4);
  g.append('g')
    .attr('class', 'd3-onerm-h-grid')
    .selectAll('line')
    .data(yTicks)
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'rgba(255,255,255,0.1)')
    .attr('stroke-width', 1);

  // Clean Y-axis labels
  g.append('g')
    .attr('class', 'd3-onerm-y-labels')
    .selectAll('text')
    .data(yTicks)
    .enter()
    .append('text')
    .attr('x', -8)
    .attr('y', (d) => yScale(d))
    .attr('dy', '0.32em')
    .attr('text-anchor', 'end')
    .attr('fill', '#94a3b8')
    .style('font-size', '0.625rem')
    .style('font-weight', '600')
    .style('letter-spacing', '0.02em')
    .text((d) => `${d}`);

  // Clean X-axis labels (show up to 4 evenly spaced dates to avoid crowding)
  const labelIndices = new Set<number>([0, points.length - 1]);
  if (points.length >= 4) {
    labelIndices.add(Math.floor((points.length - 1) / 3));
    labelIndices.add(Math.floor(((points.length - 1) * 2) / 3));
  } else if (points.length === 3) {
    labelIndices.add(1);
  }

  g.append('g')
    .attr('class', 'd3-onerm-x-labels')
    .selectAll('text')
    .data(points.map((pt, i) => ({ pt, i })).filter((d) => labelIndices.has(d.i)))
    .enter()
    .append('text')
    .attr('x', (d) => xScale(d.i) ?? 0)
    .attr('y', innerH + 20)
    .attr('text-anchor', 'middle')
    .attr('fill', '#cbd5e1')
    .style('font-size', '0.625rem')
    .style('font-weight', '700')
    .style('letter-spacing', '0.02em')
    .text((d) => d.pt.dateLabel);

  // Area under the smooth curve
  const areaGen = d3
    .area<OneRmChartPoint>()
    .x((_d, i) => xScale(i) ?? 0)
    .y0(innerH)
    .y1((d) => yScale(displayVal(d)))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('fill', `url(#${gradId})`)
    .attr('d', areaGen);

  // Main thick smooth line (stroke-width: 3px)
  const lineGen = d3
    .line<OneRmChartPoint>()
    .x((_d, i) => xScale(i) ?? 0)
    .y((d) => yScale(displayVal(d)))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('class', 'd3-onerm-line-path')
    .attr('fill', 'none')
    .attr('stroke', liftCfg.strokeColor)
    .attr('stroke-width', 3)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .attr('d', lineGen);

  // Active point highlight ring
  const activeRing = g
    .append('circle')
    .attr('class', 'd3-onerm-active-ring')
    .attr('r', 8)
    .attr('fill', liftCfg.strokeColor)
    .attr('fill-opacity', 0.25)
    .attr('stroke', liftCfg.strokeColor)
    .attr('stroke-width', 1.5);

  // Visible data dots
  const dots = g
    .selectAll('circle.d3-onerm-dot')
    .data(points)
    .enter()
    .append('circle')
    .attr('class', 'd3-onerm-dot')
    .attr('data-onerm-point-idx', (_d, i) => String(i))
    .attr('cx', (_d, i) => xScale(i) ?? 0)
    .attr('cy', (d) => yScale(displayVal(d)))
    .attr('r', 4.5)
    .attr('fill', liftCfg.strokeColor)
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 2);

  // Floating ELI12 SVG Tooltip pill (clamped inside chart width so it never clips)
  const tooltipGroup = g.append('g').attr('class', 'd3-onerm-tooltip-group').style('pointer-events', 'none');
  const tooltipRect = tooltipGroup
    .append('rect')
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('height', 24)
    .attr('fill', '#1e293b')
    .attr('stroke', liftCfg.strokeColor)
    .attr('stroke-width', 1.25);

  const tooltipTextEl = tooltipGroup
    .append('text')
    .attr('class', 'd3-onerm-tooltip-text')
    .attr('fill', '#f8fafc')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .style('font-size', '0.6875rem')
    .style('font-weight', '800')
    .style('font-family', 'system-ui, -apple-system, sans-serif')
    .style('letter-spacing', '0.02em');

  let activeIdx = points.length - 1;
  let lastTooltipLabel = '';

  function selectPoint(idx: number): void {
    const safeIdx = Math.max(0, Math.min(points.length - 1, idx));
    activeIdx = safeIdx;
    const pt = points[safeIdx];
    const cx = xScale(safeIdx) ?? 0;
    const cy = yScale(displayVal(pt));
    lastTooltipLabel = formatOneRmTooltipText(pt, unit);

    activeRing.attr('cx', cx).attr('cy', cy);
    dots.attr('r', (_d, i) => (i === safeIdx ? 5.5 : 4));

    tooltipTextEl.text(lastTooltipLabel);
    const estW = Math.max(96, lastTooltipLabel.length * 7.2 + 18);
    const clampedX = Math.max(estW / 2, Math.min(innerW - estW / 2, cx));
    const tipY = Math.max(-28, cy - 34);

    tooltipRect.attr('x', clampedX - estW / 2).attr('y', tipY).attr('width', estW);
    tooltipTextEl.attr('x', clampedX).attr('y', tipY + 12);

    if (tooltipReadoutEl) {
      tooltipReadoutEl.textContent = lastTooltipLabel;
    }
  }

  // Large invisible mobile tap targets for each point
  g.selectAll('circle.d3-onerm-hit')
    .data(points)
    .enter()
    .append('circle')
    .attr('class', 'd3-onerm-hit')
    .attr('data-onerm-hit-idx', (_d, i) => String(i))
    .attr('cx', (_d, i) => xScale(i) ?? 0)
    .attr('cy', (d) => yScale(displayVal(d)))
    .attr('r', 16)
    .attr('fill', 'transparent')
    .style('cursor', 'pointer')
    .style('touch-action', 'pan-y')
    .on('click', (_event, d) => {
      const idx = points.indexOf(d);
      if (idx >= 0) selectPoint(idx);
    });

  // Horizontal-only drag scrubbing (vertical swipes pass through natively via touch-action: pan-y)
  let pointerStartX: number | null = null;
  let pointerStartY: number | null = null;

  function findNearestIndexByClientX(clientX: number): number {
    const svgNode = svg.node();
    if (!svgNode) return activeIdx;
    const rect = svgNode.getBoundingClientRect();
    if (!rect || rect.width <= 0) return activeIdx;
    const svgX = ((clientX - rect.left) / rect.width) * width - margin.left;
    let bestIdx = 0;
    let bestDist = Infinity;
    points.forEach((_p, i) => {
      const px = xScale(i) ?? 0;
      const dist = Math.abs(px - svgX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });
    return bestIdx;
  }

  svg
    .on('pointerdown', (event: PointerEvent) => {
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      selectPoint(findNearestIndexByClientX(event.clientX));
    })
    .on('pointermove', (event: PointerEvent) => {
      if (pointerStartX === null || pointerStartY === null) return;
      if (event.buttons === 0 && event.pointerType === 'mouse') return;
      const dx = Math.abs(event.clientX - pointerStartX);
      const dy = Math.abs(event.clientY - pointerStartY);
      // Only scrub tooltip when horizontal movement exceeds vertical movement
      if (dx > dy && dx > 4) {
        selectPoint(findNearestIndexByClientX(event.clientX));
      }
    })
    .on('pointerup', () => {
      pointerStartX = null;
      pointerStartY = null;
    })
    .on('pointercancel', () => {
      pointerStartX = null;
      pointerStartY = null;
    });

  // Default active point is the latest data point
  selectPoint(points.length - 1);

  // Motor Ergonomics: Explicit visible single-tap Previous/Next buttons as non-drag alternative
  if (points.length > 1) {
    const controlsBar = document.createElement('div');
    controlsBar.className = 'd3-chart-tap-controls flex flex-wrap items-center justify-between gap-2 mt-2';
    controlsBar.setAttribute('role', 'group');
    controlsBar.setAttribute('aria-label', `${liftCfg.fullName} chart point navigation`);

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className =
      'min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold transition';
    prevBtn.setAttribute('aria-label', `Previous ${liftCfg.fullName} data point`);
    prevBtn.textContent = '← Prev Point';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className =
      'min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-extrabold transition';
    nextBtn.setAttribute('aria-label', `Next ${liftCfg.fullName} data point`);
    nextBtn.textContent = 'Next Point →';

    const syncButtonsDisabled = () => {
      prevBtn.disabled = activeIdx <= 0;
      nextBtn.disabled = activeIdx >= points.length - 1;
      prevBtn.style.opacity = prevBtn.disabled ? '0.45' : '1';
      nextBtn.style.opacity = nextBtn.disabled ? '0.45' : '1';
    };

    prevBtn.addEventListener('click', () => {
      if (activeIdx > 0) {
        selectPoint(activeIdx - 1);
        syncButtonsDisabled();
      }
    });
    nextBtn.addEventListener('click', () => {
      if (activeIdx < points.length - 1) {
        selectPoint(activeIdx + 1);
        syncButtonsDisabled();
      }
    });

    syncButtonsDisabled();
    controlsBar.appendChild(prevBtn);
    controlsBar.appendChild(nextBtn);
    container.appendChild(controlsBar);
  }

  return {
    rendered: true,
    pointCount: points.length,
    activeTooltipText: lastTooltipLabel
  };
}

export interface RenderWeeklyVolumeBarChartOptions {
  container: HTMLElement;
  tooltipWrapEl?: HTMLElement | null;
  tooltipTextEl?: HTMLElement | null;
  tooltipSetsEl?: HTMLElement | null;
  jumpBtnEl?: HTMLButtonElement | null;
  series: UnifiedWeeklyVolumePoint[];
  activeWeek: number;
  onJumpToWeek?: (week: number) => void;
}

export function renderWeeklyVolumeD3BarChart(options: RenderWeeklyVolumeBarChartOptions): {
  rendered: boolean;
  barCount: number;
  selectedWeek: number;
} {
  const {
    container,
    tooltipWrapEl,
    tooltipTextEl,
    tooltipSetsEl,
    jumpBtnEl,
    series,
    activeWeek,
    onJumpToWeek
  } = options;

  if (!container || !Array.isArray(series) || series.length === 0) {
    return { rendered: false, barCount: 0, selectedWeek: activeWeek || 1 };
  }

  container.style.touchAction = 'pan-y';
  container.style.background = 'transparent';
  container.style.position = 'relative';

  d3.select(container).selectAll('*').remove();

  const width = 336;
  const height = 178;
  const margin = { top: 20, right: 12, bottom: 28, left: 46 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const maxVol = d3.max(series, (d) => d.tonnageLbs) ?? 0;
  const yTop = maxVol > 0 ? Math.ceil((maxVol * 1.18) / 500) * 500 : 5000;

  const xScale = d3
    .scaleBand<string>()
    .domain(series.map((d) => d.label))
    .range([0, innerW])
    .padding(0.32);

  const yScale = d3.scaleLinear().domain([0, yTop]).range([innerH, 0]).nice(4);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Total Weekly Volume bar chart in pounds across training weeks')
    .attr('data-volume-bar-chart-svg', 'true')
    .style('width', '100%')
    .style('height', 'auto')
    .style('display', 'block')
    .style('background', 'transparent')
    .style('touch-action', 'pan-y')
    .style('overflow', 'visible')
    .style('font-family', 'system-ui, -apple-system, sans-serif')
    .style('letter-spacing', '0.02em');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const yTicks = yScale.ticks(4).slice(0, 5);
  const formatCompactLbs = (v: number): string => {
    if (v >= 1000) {
      const k = v / 1000;
      return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
    }
    return `${v}`;
  };

  // Faint horizontal gridlines
  g.append('g')
    .attr('class', 'd3-vol-h-grid')
    .selectAll('line')
    .data(yTicks)
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'rgba(248, 250, 252, 0.1)')
    .attr('stroke-width', 1);

  // Y-axis labels (lbs)
  g.append('g')
    .attr('class', 'd3-vol-y-labels')
    .selectAll('text')
    .data(yTicks)
    .enter()
    .append('text')
    .attr('x', -8)
    .attr('y', (d) => yScale(d))
    .attr('dy', '0.32em')
    .attr('text-anchor', 'end')
    .attr('fill', '#94a3b8')
    .style('font-size', '0.625rem')
    .style('font-weight', '600')
    .text((d) => formatCompactLbs(d));

  // X-axis week labels (W1, W2, W3, W4...)
  g.append('g')
    .attr('class', 'd3-vol-x-labels')
    .selectAll('text')
    .data(series)
    .enter()
    .append('text')
    .attr('x', (d) => (xScale(d.label) ?? 0) + xScale.bandwidth() / 2)
    .attr('y', innerH + 18)
    .attr('text-anchor', 'middle')
    .attr('fill', '#f8fafc')
    .style('font-size', '0.6875rem')
    .style('font-weight', '800')
    .text((d) => d.label);

  // Visible rounded vertical bars: Soft Cyan (#0ea5e9) for completed weeks, Muted Slate (#334155) for uncompleted
  const bars = g
    .selectAll('rect.d3-vol-bar')
    .data(series)
    .enter()
    .append('rect')
    .attr('class', 'd3-vol-bar')
    .attr('data-vol-week', (d) => String(d.week))
    .attr('x', (d) => xScale(d.label) ?? 0)
    .attr('width', xScale.bandwidth())
    .attr('y', (d) => {
      if (d.tonnageLbs <= 0) return innerH - 8;
      return Math.min(innerH - 8, yScale(d.tonnageLbs));
    })
    .attr('height', (d) => {
      if (d.tonnageLbs <= 0) return 8;
      return Math.max(8, innerH - yScale(d.tonnageLbs));
    })
    .attr('rx', 6)
    .attr('ry', 6)
    .attr('fill', (d) => (d.isCompleted ? '#0ea5e9' : '#334155'))
    .attr('stroke', 'transparent')
    .attr('stroke-width', 2);

  // Small compact value label above non-zero bars
  g.selectAll('text.d3-vol-bar-val')
    .data(series.filter((d) => d.tonnageLbs > 0))
    .enter()
    .append('text')
    .attr('class', 'd3-vol-bar-val')
    .attr('x', (d) => (xScale(d.label) ?? 0) + xScale.bandwidth() / 2)
    .attr('y', (d) => Math.max(4, Math.min(innerH - 12, yScale(d.tonnageLbs) - 5)))
    .attr('text-anchor', 'middle')
    .attr('fill', '#e0f2fe')
    .style('font-size', '0.6rem')
    .style('font-weight', '700')
    .text((d) => formatCompactLbs(d.tonnageLbs));

  let selectedWeek =
    series.some((d) => d.week === activeWeek) ? activeWeek : series[series.length - 1].week;

  function selectWeekBar(weekNum: number, showTooltip: boolean): void {
    const row = series.find((d) => d.week === weekNum) || series[0];
    selectedWeek = row.week;

    bars
      .attr('stroke', (d) => (d.week === row.week ? '#f8fafc' : 'transparent'))
      .attr('fill-opacity', (d) => (d.week === row.week ? 1 : 0.85));

    if (tooltipWrapEl) {
      if (showTooltip) {
        tooltipWrapEl.classList.remove('hidden');
      }
      tooltipWrapEl.setAttribute('data-selected-week', String(row.week));
    }
    if (tooltipTextEl) {
      tooltipTextEl.textContent = formatWeeklyVolumeTooltipText(row.week, row.tonnageLbs);
    }
    if (tooltipSetsEl) {
      const setWord = row.setsCount === 1 ? 'set' : 'sets';
      tooltipSetsEl.textContent = `${row.setsCount} ${setWord} logged in Week ${row.week}`;
    }
    if (jumpBtnEl) {
      jumpBtnEl.textContent = `Jump to Week ${row.week}`;
      jumpBtnEl.setAttribute('data-jump-week', String(row.week));
      jumpBtnEl.onclick = () => {
        if (typeof onJumpToWeek === 'function') {
          onJumpToWeek(row.week);
        }
      };
    }
  }

  // Full-height transparent mobile tap columns for easy tapping (even on 0-volume weeks)
  g.selectAll('rect.d3-vol-hit')
    .data(series)
    .enter()
    .append('rect')
    .attr('class', 'd3-vol-hit')
    .attr('data-vol-hit-week', (d) => String(d.week))
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', (d) => `Week ${d.week}: ${d.tonnageLbs.toLocaleString('en-US')} pounds, ${d.setsCount} sets`)
    .attr('x', (d) => Math.max(0, (xScale(d.label) ?? 0) - 4))
    .attr('width', xScale.bandwidth() + 8)
    .attr('y', 0)
    .attr('height', innerH + 22)
    .attr('fill', 'transparent')
    .style('cursor', 'pointer')
    .style('touch-action', 'pan-y')
    .on('click', (_event, d) => {
      selectWeekBar(d.week, true);
    })
    .on('keydown', (event: KeyboardEvent, d) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectWeekBar(d.week, true);
      }
    });

  // Pre-highlight active week and keep tooltip populated
  selectWeekBar(selectedWeek, true);

  return {
    rendered: true,
    barCount: series.length,
    selectedWeek
  };
}

// Expose cleanly to the single-file app script in index.html
declare global {
  interface Window {
    d3?: typeof d3;
    renderOneRmD3Chart?: typeof renderOneRmD3Chart;
    renderWeeklyVolumeD3BarChart?: typeof renderWeeklyVolumeD3BarChart;
    extractOneRmProgressionSeries?: typeof extractOneRmProgressionSeries;
    ONE_RM_LIFT_CONFIGS?: typeof ONE_RM_LIFT_CONFIGS;
    computeUnifiedWeeklyVolumeSeries?: typeof computeUnifiedWeeklyVolumeSeries;
    formatWeeklyVolumeTooltipText?: typeof formatWeeklyVolumeTooltipText;
    hasLoggedSetsInWeek?: typeof hasLoggedSetsInWeek;
    hasWeekWorkoutData?: typeof hasWeekWorkoutData;
    createSyncUndoSnapshot?: typeof createSyncUndoSnapshot;
    restoreSyncUndoSnapshot?: typeof restoreSyncUndoSnapshot;
    createFullStateUndoBackup?: typeof createFullStateUndoBackup;
    restoreFullStateUndoBackup?: typeof restoreFullStateUndoBackup;
    serializeStateForPersistence?: typeof serializeStateForPersistence;
    createDelayedCloudPushController?: typeof createDelayedCloudPushController;
    SYNC_UNDO_TOAST_DURATION_MS?: number;
    SYNC_SUPABASE_DELAY_MS?: number;
    SYNC_OVERWRITE_WARNING_TEXT?: string;
    clampWeightInputValue?: typeof clampWeightInputValue;
    clampRepsInputValue?: typeof clampRepsInputValue;
    AI_EXERCISE_WHITELIST_RULE?: string;
    validateProgramWizardConfig?: typeof validateProgramWizardConfig;
    getDifficultyMultipliers?: typeof getDifficultyMultipliers;
    buildValidatedWizardProgram?: typeof buildValidatedWizardProgram;
    isRecipeAllowedForDiet?: typeof isRecipeAllowedForDiet;
    filterRecipesByDietAndIntolerances?: typeof filterRecipesByDietAndIntolerances;
    classifyExerciseCategory?: typeof classifyExerciseCategory;
    groupExercisesByCategory?: typeof groupExercisesByCategory;
    enforceDifficultyOnExercise?: typeof enforceDifficultyOnExercise;
    enforceDifficultyOnRoutine?: typeof enforceDifficultyOnRoutine;
    createAutoSupabaseSyncEngine?: typeof createAutoSupabaseSyncEngine;
    countTotalLoggedSetsInState?: typeof countTotalLoggedSetsInState;
    resolveSingleSourceOfTruthState?: typeof resolveSingleSourceOfTruthState;
    fetchLatestCloudStateAsSingleSourceOfTruth?: typeof fetchLatestCloudStateAsSingleSourceOfTruth;
    getStateLastUpdatedIso?: typeof getStateLastUpdatedIso;
    parseTimestampMs?: typeof parseTimestampMs;
    stampGymStateLastUpdated?: typeof stampGymStateLastUpdated;
    resolveDisplayUsername?: typeof resolveDisplayUsername;
    clearActiveDayWorkoutData?: typeof clearActiveDayWorkoutData;
    isBikingExercise?: typeof isBikingExercise;
    isOverhandPullUpsExercise?: typeof isOverhandPullUpsExercise;
    orderExercisesWithPullUpsFirst?: typeof orderExercisesWithPullUpsFirst;
    normalizeCardioExerciseName?: typeof normalizeCardioExerciseName;
    STANDARD_CARDIO_SESSIONS?: typeof STANDARD_CARDIO_SESSIONS;
    WORKOUT_FUEL_RESET_PROMPT?: string;
    DELETE_ALL_WEEKS_BUTTON_LABEL?: string;
    DELETE_ALL_WEEKS_CONFIRM_WARNING?: string;
    DELETE_ACCOUNT_WARNING_PROMPT?: string;
    DELETE_ACCOUNT_MAIN_WARNING?: string;
    DELETE_ACCOUNT_BUTTON_LABELS?: typeof DELETE_ACCOUNT_BUTTON_LABELS;
    buildPostDeleteSwitchPrompt?: typeof buildPostDeleteSwitchPrompt;
    findSecondarySavedAccount?: typeof findSecondarySavedAccount;
    clearAllWebSessionCookies?: typeof clearAllWebSessionCookies;
    purgeMobileClientStorage?: typeof purgeMobileClientStorage;
    executeCompleteAccountDeletion?: typeof executeCompleteAccountDeletion;
    validateDeletionTarget?: typeof validateDeletionTarget;
    clearActiveDayFuelData?: typeof clearActiveDayFuelData;
    clearActiveDayWorkoutAndOptionalFuel?: typeof clearActiveDayWorkoutAndOptionalFuel;
    deleteWorkoutForActiveDay?: typeof deleteWorkoutForActiveDay;
    deleteFuelForActiveDay?: typeof deleteFuelForActiveDay;
    deleteWorkoutAndFuelForActiveDay?: typeof deleteWorkoutAndFuelForActiveDay;
    deleteAllWeeksCompleteReset?: typeof deleteAllWeeksCompleteReset;
    deleteUserAccountFromSupabase?: typeof deleteUserAccountFromSupabase;
    hardDeleteAccount?: typeof hardDeleteAccount;
    purgeSupabaseAuthStorageKeys?: typeof purgeSupabaseAuthStorageKeys;
    resolveDynamicAuthRedirectUrl?: typeof resolveDynamicAuthRedirectUrl;
    purgeDeletedAccountFromLocalState?: typeof purgeDeletedAccountFromLocalState;
    normalizeAccountUserId?: typeof normalizeAccountUserId;
    isValidDeletableUserId?: typeof isValidDeletableUserId;
    scanContentForBrokenLinksAndTypos?: typeof scanContentForBrokenLinksAndTypos;
    validateWorkoutPlanExpertApproval?: typeof validateWorkoutPlanExpertApproval;
    validateScientificAlignment?: typeof validateScientificAlignment;
    runDeploymentValidationChecklist?: typeof runDeploymentValidationChecklist;
    DEFAULT_IKEA_QUIZ_ANSWERS?: typeof DEFAULT_IKEA_QUIZ_ANSWERS;
    IKEA_QUIZ_STEPS?: typeof IKEA_QUIZ_STEPS;
    adaptExerciseForEquipment?: typeof adaptExerciseForEquipment;
    buildIkeaQuizProgram?: typeof buildIkeaQuizProgram;
    createGuestSandboxStatePatch?: typeof createGuestSandboxStatePatch;
    enqueueOfflineGymStateSync?: typeof enqueueOfflineGymStateSync;
    flushOfflineGymStateQueue?: typeof flushOfflineGymStateQueue;
    isNetworkOnline?: typeof isNetworkOnline;
    readOfflineSyncQueue?: typeof readOfflineSyncQueue;
    ACCESSIBLE_THEME_TOKENS?: typeof ACCESSIBLE_THEME_TOKENS;
    DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK?: string;
    OPENDYSLEXIC_FONT_STACK?: string;
    applyDyslexiaFontToDocument?: typeof applyDyslexiaFontToDocument;
    applyThemeToDocument?: typeof applyThemeToDocument;
    calculateWcagContrastRatio?: typeof calculateWcagContrastRatio;
    getSystemPrefersDark?: typeof getSystemPrefersDark;
    loadStoredFontPreference?: typeof loadStoredFontPreference;
    loadStoredThemePreference?: typeof loadStoredThemePreference;
    normalizeFontModePreference?: typeof normalizeFontModePreference;
    normalizeThemeModePreference?: typeof normalizeThemeModePreference;
    resolveEffectiveTheme?: typeof resolveEffectiveTheme;
    saveFontPreference?: typeof saveFontPreference;
    saveThemePreference?: typeof saveThemePreference;
    detectCsvSourceApp?: typeof detectCsvSourceApp;
    mapExternalExerciseToSchema?: typeof mapExternalExerciseToSchema;
    mergeImportedHistoryIntoGymState?: typeof mergeImportedHistoryIntoGymState;
    parseWorkoutHistoryCsv?: typeof parseWorkoutHistoryCsv;
    computeAdherenceNeutralWeeklyProgress?: typeof computeAdherenceNeutralWeeklyProgress;
    calculateEstimated1RM?: typeof calculateEstimated1RM;
    evaluateSessionMicroWins?: typeof evaluateSessionMicroWins;
    computeExplainableProgressionMath?: typeof computeExplainableProgressionMath;
    parseNutritionLabelText?: typeof parseNutritionLabelText;
    parseWeightStackText?: typeof parseWeightStackText;
    scanNutritionLabelOCR?: typeof scanNutritionLabelOCR;
    scanWeightMachineStackOCR?: typeof scanWeightMachineStackOCR;
    startDeviceCameraStream?: typeof startDeviceCameraStream;
    applyBiometricVolumeToExercises?: typeof applyBiometricVolumeToExercises;
    calculateBiometricVolumeAdjustment?: typeof calculateBiometricVolumeAdjustment;
    fetchAppleHealthKitBiometricsStub?: typeof fetchAppleHealthKitBiometricsStub;
    fetchGoogleHealthConnectBiometricsStub?: typeof fetchGoogleHealthConnectBiometricsStub;
    createSmartwatchBridge?: typeof createSmartwatchBridge;
    POST_DELETE_SELECT_ACCOUNT_PROMPT?: string;
    AVAILABLE_OAUTH_LOGIN_PROVIDERS?: typeof AVAILABLE_OAUTH_LOGIN_PROVIDERS;
    onDeleteSuccess?: typeof onDeleteSuccess;
    START_FRESH_CONFIRM_TITLE?: string;
    START_FRESH_CONFIRM_COPY?: string;
    buildStartFreshGymState?: typeof buildStartFreshGymState;
    createEmptyBaselineGymState?: typeof createEmptyBaselineGymState;
    executeStartFreshAndPushToSupabase?: typeof executeStartFreshAndPushToSupabase;
    HEAVY_WEIGHT_MULTIPLIER_THRESHOLD?: number;
    getHistoricalMaxWeightForExercise?: typeof getHistoricalMaxWeightForExercise;
    buildHeavyWeightWarningMessage?: typeof buildHeavyWeightWarningMessage;
    validateSetWeightSanity?: typeof validateSetWeightSanity;
    saveGymStateToIndexedDB?: typeof saveGymStateToIndexedDB;
    loadGymStateFromIndexedDB?: typeof loadGymStateFromIndexedDB;
    enqueueIndexedDbSyncItem?: typeof enqueueIndexedDbSyncItem;
    getPendingIndexedDbSyncItems?: typeof getPendingIndexedDbSyncItems;
    removeIndexedDbSyncItem?: typeof removeIndexedDbSyncItem;
    clearIndexedDbSyncOutbox?: typeof clearIndexedDbSyncOutbox;
    clearAllGymIndexedDbStores?: typeof clearAllGymIndexedDbStores;
    hydrateGymStateLocalFirst?: typeof hydrateGymStateLocalFirst;
    persistGymStateLocalFirst?: typeof persistGymStateLocalFirst;
    flushIndexedDbSyncOutbox?: typeof flushIndexedDbSyncOutbox;
    notifyServiceWorkerToSync?: typeof notifyServiceWorkerToSync;
    startOfflineFirstBackgroundSync?: typeof startOfflineFirstBackgroundSync;
    SENSORY_CALM_STORAGE_KEY?: string;
    applySensoryCalmToDocument?: typeof applySensoryCalmToDocument;
    loadStoredSensoryCalmPreference?: typeof loadStoredSensoryCalmPreference;
    normalizeSensoryCalmPreference?: typeof normalizeSensoryCalmPreference;
    saveSensoryCalmPreference?: typeof saveSensoryCalmPreference;
    computeRolling30DayConsistencyScore?: typeof computeRolling30DayConsistencyScore;
    ADVANCED_SUBJECTIVE_STORAGE_KEY?: string;
    DEFAULT_SUBJECTIVE_TRACKING_ENABLED?: boolean;
    calculateDoubleProgressionTarget?: typeof calculateDoubleProgressionTarget;
    evaluateExerciseDoubleProgressionFromGymState?: typeof evaluateExerciseDoubleProgressionFromGymState;
    loadAdvancedSubjectiveSetting?: typeof loadAdvancedSubjectiveSetting;
    parseObjectiveRepRange?: typeof parseObjectiveRepRange;
    saveAdvancedSubjectiveSetting?: typeof saveAdvancedSubjectiveSetting;
    DEFAULT_KG_PLATES?: typeof DEFAULT_KG_PLATES;
    DEFAULT_LBS_PLATES?: typeof DEFAULT_LBS_PLATES;
    STANDARD_BAR_WEIGHT_KG?: number;
    STANDARD_BAR_WEIGHT_LBS?: number;
    buildVisualPlateLoaderSvgHtml?: typeof buildVisualPlateLoaderSvgHtml;
    calculateVisualBarbellPlates?: typeof calculateVisualBarbellPlates;
    dispatchRestTimerCompletionAlert?: typeof dispatchRestTimerCompletionAlert;
    shouldMuteSensoryOutput?: typeof shouldMuteSensoryOutput;
    triggerSafeHapticFeedback?: typeof triggerSafeHapticFeedback;
    getSupabaseClient?: typeof getSupabaseClient;
    isSupabaseRealtimeConfigured?: typeof isSupabaseRealtimeConfigured;
    resolveGymStateRecordId?: typeof resolveGymStateRecordId;
    AUTO_SYNC_DEBOUNCE_MS?: number;
    AUTO_SYNC_STORAGE_KEY?: string;
    AUTO_SYNC_TOGGLE_LABEL?: string;
    AUTO_SYNC_TOGGLE_SUBLABEL?: string;
    DEFAULT_AUTO_SYNC_ENABLED?: boolean;
    FORCE_SYNC_NOW_LABEL?: string;
    createDebounce?: typeof createDebounce;
    createSupabaseRealtimeSyncManager?: typeof createSupabaseRealtimeSyncManager;
    evaluateRealtimeIncomingPayload?: typeof evaluateRealtimeIncomingPayload;
    loadAutoSyncPreference?: typeof loadAutoSyncPreference;
    normalizeAutoSyncPreference?: typeof normalizeAutoSyncPreference;
    saveAutoSyncPreference?: typeof saveAutoSyncPreference;
    __gymRealtimeSyncManager?: SupabaseRealtimeSyncManager<any> | null;
    DELETE_ACCOUNT_WARNING_BULLETS?: typeof DELETE_ACCOUNT_WARNING_BULLETS;
    findAllRemainingSavedAccounts?: typeof findAllRemainingSavedAccounts;
    IKEA_QUIZ_ALL_STEPS?: typeof IKEA_QUIZ_ALL_STEPS;
    ONBOARDING_ACCESSIBILITY_QUESTION?: string;
    ONBOARDING_ACCESSIBILITY_STEP?: typeof ONBOARDING_ACCESSIBILITY_STEP;
    ADHD_VIEW_STORAGE_KEY?: string;
    DYSLEXIA_VIEW_STORAGE_KEY?: string;
    applyAdhdFriendlyViewToDocument?: typeof applyAdhdFriendlyViewToDocument;
    applyDyslexiaFriendlyViewToDocument?: typeof applyDyslexiaFriendlyViewToDocument;
    loadStoredAdhdViewPreference?: typeof loadStoredAdhdViewPreference;
    loadStoredDyslexiaViewPreference?: typeof loadStoredDyslexiaViewPreference;
    saveAdhdViewPreference?: typeof saveAdhdViewPreference;
    saveDyslexiaViewPreference?: typeof saveDyslexiaViewPreference;
    DEFAULT_VALIDATION_LIMITS?: typeof DEFAULT_VALIDATION_LIMITS;
    validateAccountProfileInput?: typeof validateAccountProfileInput;
    validateGymTimeInput?: typeof validateGymTimeInput;
    validateLoggedReps?: typeof validateLoggedReps;
    validateLoggedWeight?: typeof validateLoggedWeight;
    validateQuickAddFuelInput?: typeof validateQuickAddFuelInput;
    captureViewportScrollAnchor?: typeof captureViewportScrollAnchor;
    computeStableScrollTargetY?: typeof computeStableScrollTargetY;
    restoreViewportScrollAnchor?: typeof restoreViewportScrollAnchor;
    scrollContainerHorizontallyWithoutVerticalJump?: typeof scrollContainerHorizontallyWithoutVerticalJump;
    withStableViewportScroll?: typeof withStableViewportScroll;
    FORCE_PULL_CLOUD_LABEL?: string;
    FORCE_PULL_SUCCESS_TOAST?: string;
    DATA_BACKUP_MIGRATION_TITLE?: string;
    DEFAULT_BACKUP_FILENAME?: string;
    resolveAuthenticatedGymStateIds?: typeof resolveAuthenticatedGymStateIds;
    forcePullGymStateFromCloud?: typeof forcePullGymStateFromCloud;
    validateGymStateBackupSchema?: typeof validateGymStateBackupSchema;
    serializeGymStateForJsonExport?: typeof serializeGymStateForJsonExport;
    triggerGymStateJsonDownload?: typeof triggerGymStateJsonDownload;
    importGymStateFromJsonText?: typeof importGymStateFromJsonText;
    PASSKEY_REGISTRY_STORAGE_KEY?: string;
    validatePasswordlessEmail?: typeof validatePasswordlessEmail;
    buildSafeMagicLinkRedirectUrl?: typeof buildSafeMagicLinkRedirectUrl;
    sendSupabaseMagicLink?: typeof sendSupabaseMagicLink;
    verifySupabaseMagicLinkOtp?: typeof verifySupabaseMagicLinkOtp;
    isWebAuthnPasskeySupported?: typeof isWebAuthnPasskeySupported;
    checkPlatformBiometricPasskeyAvailability?: typeof checkPlatformBiometricPasskeyAvailability;
    loadRegisteredPasskeys?: typeof loadRegisteredPasskeys;
    hasRegisteredPasskeyForEmail?: typeof hasRegisteredPasskeyForEmail;
    registerBiometricPasskey?: typeof registerBiometricPasskey;
    authenticateWithBiometricPasskey?: typeof authenticateWithBiometricPasskey;
    ALLOWED_PLAYBACK_RATES?: typeof ALLOWED_PLAYBACK_RATES;
    BARBELL_SQUAT_MEDIA_SAMPLES?: typeof BARBELL_SQUAT_MEDIA_SAMPLES;
    DEFAULT_ACCESSIBLE_VIDEO_SETTINGS?: typeof DEFAULT_ACCESSIBLE_VIDEO_SETTINGS;
    parseVttTimestampToSeconds?: typeof parseVttTimestampToSeconds;
    parseWebVttCaptions?: typeof parseWebVttCaptions;
    getActiveVttCaptionAtTime?: typeof getActiveVttCaptionAtTime;
    getActiveLiteralStepAtTime?: typeof getActiveLiteralStepAtTime;
    formatSecondsClock?: typeof formatSecondsClock;
    sanitizeMediaUrl?: typeof sanitizeMediaUrl;
    mountAccessibleVideoPlayer?: typeof mountAccessibleVideoPlayer;
    mountPhase2AccessibilityHub?: typeof mountPhase2AccessibilityHub;
    mountPlainLanguageCoachModal?: typeof mountPlainLanguageCoachModal;
    normalizeSpokenNumbers?: typeof normalizeSpokenNumbers;
    parseSpokenSetPhrase?: typeof parseSpokenSetPhrase;
    applyVoiceLogToGymState?: typeof applyVoiceLogToGymState;
    revertVoiceLogFromGymState?: typeof revertVoiceLogFromGymState;
    isWebSpeechRecognitionSupported?: typeof isWebSpeechRecognitionSupported;
    createBrowserSpeechRecognizer?: typeof createBrowserSpeechRecognizer;
    PLAIN_LANGUAGE_COACH_SYSTEM_INSTRUCTION?: string;
    buildBoundedProgressionSnapshot?: typeof buildBoundedProgressionSnapshot;
    requestPlainLanguageCoachExplanation?: typeof requestPlainLanguageCoachExplanation;
    LOW_SPOONS_PRESETS?: typeof LOW_SPOONS_PRESETS;
    BARBELL_TO_MACHINE_SWAPS?: typeof BARBELL_TO_MACHINE_SWAPS;
    mapClassificationToValidatedPreset?: typeof mapClassificationToValidatedPreset;
    findStableMachineVariation?: typeof findStableMachineVariation;
    applyLowSpoonsPresetToExercises?: typeof applyLowSpoonsPresetToExercises;
    classifyLowSpoonsWithGemini?: typeof classifyLowSpoonsWithGemini;
    syncDailyBiometricsToSupabase?: typeof syncDailyBiometricsToSupabase;
    fetchLatestBiometricsFromSupabase?: typeof fetchLatestBiometricsFromSupabase;
    attachBiometricsToGymState?: typeof attachBiometricsToGymState;
    WCAG_STRICT_CONTRAST_TARGETS?: typeof WCAG_STRICT_CONTRAST_TARGETS;
    verifyThemeContrastCompliance?: typeof verifyThemeContrastCompliance;
    CLINICAL_TRIAL_EXPORT_WEEKS?: number;
    anonymizeParticipantId?: typeof anonymizeParticipantId;
    applyInstitutionalFlagsToUserProfile?: typeof applyInstitutionalFlagsToUserProfile;
    buildAnonymized12WeekClinicalTrialRows?: typeof buildAnonymized12WeekClinicalTrialRows;
    escapeCsvCellSafe?: typeof escapeCsvCellSafe;
    exportAnonymized12WeekClinicalTrialCsv?: typeof exportAnonymized12WeekClinicalTrialCsv;
    normalizeInstitutionalEligibility?: typeof normalizeInstitutionalEligibility;
    resolveInstitutionalBillingRoute?: typeof resolveInstitutionalBillingRoute;
    serializeClinicalTrialCsv?: typeof serializeClinicalTrialCsv;
    triggerClinicalTrialCsvDownload?: typeof triggerClinicalTrialCsvDownload;
    AUTH_INPUT_IDS?: typeof AUTH_INPUT_IDS;
    NON_AUTH_INPUT_ATTRIBUTES?: typeof NON_AUTH_INPUT_ATTRIBUTES;
    shouldPromptForLogin?: typeof shouldPromptForLogin;
    isAuthFieldElement?: typeof isAuthFieldElement;
    applyNonAuthInputAttributes?: typeof applyNonAuthInputAttributes;
    buildNonAuthNoteInputProps?: typeof buildNonAuthNoteInputProps;
    enforceNonAuthInputsAcrossRoot?: typeof enforceNonAuthInputsAcrossRoot;
    guardNonAuthNoteFocusEvent?: typeof guardNonAuthNoteFocusEvent;
    syncHiddenAuthModalInputIsolation?: typeof syncHiddenAuthModalInputIsolation;
    ACTIVE_WORKOUT_SESSION_KEY?: string;
    MAX_RESUME_SESSION_AGE_MS?: number;
    buildActiveWorkoutSessionSnapshot?: typeof buildActiveWorkoutSessionSnapshot;
    saveActiveWorkoutSession?: typeof saveActiveWorkoutSession;
    loadActiveWorkoutSession?: typeof loadActiveWorkoutSession;
    clearActiveWorkoutSession?: typeof clearActiveWorkoutSession;
    buildResumeWorkoutBannerCopy?: typeof buildResumeWorkoutBannerCopy;
    parseHHMMMinutesSafe?: typeof parseHHMMMinutesSafe;
    formatMinutes12Hour?: typeof formatMinutes12Hour;
    formatMinutesHHMM?: typeof formatMinutesHHMM;
    buildProminentWarmupQuickTips?: typeof buildProminentWarmupQuickTips;
    computeLiveScheduleContext?: typeof computeLiveScheduleContext;
    NEXT_WEEK_NOTE_QUICK_CHIPS?: typeof NEXT_WEEK_NOTE_QUICK_CHIPS;
    extractReadableTextFromPdfBytes?: typeof extractReadableTextFromPdfBytes;
    parseCustomWorkoutProgram?: typeof parseCustomWorkoutProgram;
    buildNextWeekProgressionNote?: typeof buildNextWeekProgressionNote;
    validateWorkoutNoteText?: typeof validateWorkoutNoteText;
    validateTimerDurationSeconds?: typeof validateTimerDurationSeconds;
    validateExerciseSetEntry?: typeof validateExerciseSetEntry;
    mountCustomProgramUploadPanel?: typeof mountCustomProgramUploadPanel;
    extractAvatarInitial?: typeof extractAvatarInitial;
    sanitizeAvatarUrl?: typeof sanitizeAvatarUrl;
    resolveHeaderAuthState?: typeof resolveHeaderAuthState;
    subscribeGlobalHeaderAuthState?: typeof subscribeGlobalHeaderAuthState;
    syncDomHeaderAuthButton?: typeof syncDomHeaderAuthButton;
    SWAP_MODAL_TITLE?: string;
    DEFAULT_MEAL_SLOT_BASE_COSTS?: typeof DEFAULT_MEAL_SLOT_BASE_COSTS;
    PRODUCT_THUMBNAILS?: typeof PRODUCT_THUMBNAILS;
    INGREDIENT_SWAP_CATALOG?: typeof INGREDIENT_SWAP_CATALOG;
    buildProductThumbnailDataUri?: typeof buildProductThumbnailDataUri;
    resolveIngredientImageUrl?: typeof resolveIngredientImageUrl;
    inferIngredientCategory?: typeof inferIngredientCategory;
    estimateIngredientServingCost?: typeof estimateIngredientServingCost;
    getSwapOptionsForIngredient?: typeof getSwapOptionsForIngredient;
    computeSwapMacroDeltas?: typeof computeSwapMacroDeltas;
    recalculateMealTotals?: typeof recalculateMealTotals;
    applyIngredientSwapsToDayPlan?: typeof applyIngredientSwapsToDayPlan;
    applyIngredientSwapToGymState?: typeof applyIngredientSwapToGymState;
    resetIngredientSwapInGymState?: typeof resetIngredientSwapInGymState;
    mountSwapIngredientModal?: typeof mountSwapIngredientModal;
    parseInlineSetText?: typeof parseInlineSetText;
    formatParsedSetsSummary?: typeof formatParsedSetsSummary;
    applyParsedSetsToExerciseLogs?: typeof applyParsedSetsToExerciseLogs;
    revertFastLogUndoSnapshot?: typeof revertFastLogUndoSnapshot;
    resolveNavigationTarget?: typeof resolveNavigationTarget;
    buildSkipOnboardingDefaultPatch?: typeof buildSkipOnboardingDefaultPatch;
    extractRecentLiftWeights?: typeof extractRecentLiftWeights;
    MISSED_SET_ONE_MODAL_QUESTION?: typeof MISSED_SET_ONE_MODAL_QUESTION;
    MACHINE_PHOTO_PATHS?: typeof MACHINE_PHOTO_PATHS;
    buildOfflineMachineDiagramDataUri?: typeof buildOfflineMachineDiagramDataUri;
    buildSkippedSetOneLog?: typeof buildSkippedSetOneLog;
    computeDeviceClockWarmupTimer?: typeof computeDeviceClockWarmupTimer;
    detectMissedSetOneCondition?: typeof detectMissedSetOneCondition;
    formatDeviceClock12Hr?: typeof formatDeviceClock12Hr;
    formatMmSs?: typeof formatMmSs;
    inferMachineEquipmentFamily?: typeof inferMachineEquipmentFamily;
    isExerciseResolvedDone?: typeof isExerciseResolvedDone;
    resolveMachinePhotoAsset?: typeof resolveMachinePhotoAsset;
    resolveMostRecentSuccessfulWeight?: typeof resolveMostRecentSuccessfulWeight;
    resolveNextExercisePreviewName?: typeof resolveNextExercisePreviewName;
    validateMachinePhotoRegistry?: typeof validateMachinePhotoRegistry;
    CONFLICT_BACKUP_SNAPSHOT_KEY?: string;
    SYNC_CONFLICT_MODAL_QUESTION?: string;
    SYNC_OUTBOX_STORAGE_KEY?: string;
    buildLocalWinsMergedState?: typeof buildLocalWinsMergedState;
    clearSyncOutbox?: typeof clearSyncOutbox;
    enqueueSyncOutboxAction?: typeof enqueueSyncOutboxAction;
    evaluatePreLoginSyncStrategy?: typeof evaluatePreLoginSyncStrategy;
    extractCompletedSetFingerprints?: typeof extractCompletedSetFingerprints;
    flushSyncOutboxToSupabase?: typeof flushSyncOutboxToSupabase;
    formatSyncComparisonTimestamp?: typeof formatSyncComparisonTimestamp;
    loadConflictBackupSnapshot?: typeof loadConflictBackupSnapshot;
    readSyncOutbox?: typeof readSyncOutbox;
    saveConflictBackupSnapshot?: typeof saveConflictBackupSnapshot;
    writeSyncOutbox?: typeof writeSyncOutbox;
    FLEXIBLE_SET_STEPPER_PALETTE?: typeof FLEXIBLE_SET_STEPPER_PALETTE;
    MIN_FLEXIBLE_SETS?: number;
    MAX_FLEXIBLE_SETS?: number;
    verifyStepperWcagContrastCompliance?: typeof verifyStepperWcagContrastCompliance;
    shouldShowMicroStartPanel?: typeof shouldShowMicroStartPanel;
    shouldShowResumeWorkoutBanner?: typeof shouldShowResumeWorkoutBanner;
    getExerciseSetOverrideKey?: typeof getExerciseSetOverrideKey;
    clampFlexibleSetCount?: typeof clampFlexibleSetCount;
    resolveEffectiveExerciseSetCount?: typeof resolveEffectiveExerciseSetCount;
    adjustExerciseSetCount?: typeof adjustExerciseSetCount;
    resolveWeightStepIncrement?: typeof resolveWeightStepIncrement;
    stepWeightValue?: typeof stepWeightValue;
    stepRepsValue?: typeof stepRepsValue;
    shouldLockExerciseOnSetDone?: typeof shouldLockExerciseOnSetDone;
  }
}

if (typeof window !== 'undefined') {
  window.d3 = d3;
  window.renderOneRmD3Chart = renderOneRmD3Chart;
  window.renderWeeklyVolumeD3BarChart = renderWeeklyVolumeD3BarChart;
  window.extractOneRmProgressionSeries = extractOneRmProgressionSeries;
  window.ONE_RM_LIFT_CONFIGS = ONE_RM_LIFT_CONFIGS;
  window.computeUnifiedWeeklyVolumeSeries = computeUnifiedWeeklyVolumeSeries;
  window.formatWeeklyVolumeTooltipText = formatWeeklyVolumeTooltipText;
  window.hasLoggedSetsInWeek = hasLoggedSetsInWeek;
  window.hasWeekWorkoutData = hasWeekWorkoutData;
  window.createSyncUndoSnapshot = createSyncUndoSnapshot;
  window.restoreSyncUndoSnapshot = restoreSyncUndoSnapshot;
  window.createFullStateUndoBackup = createFullStateUndoBackup;
  window.restoreFullStateUndoBackup = restoreFullStateUndoBackup;
  window.serializeStateForPersistence = serializeStateForPersistence;
  window.createDelayedCloudPushController = createDelayedCloudPushController;
  window.SYNC_UNDO_TOAST_DURATION_MS = SYNC_UNDO_TOAST_DURATION_MS;
  window.SYNC_SUPABASE_DELAY_MS = SYNC_SUPABASE_DELAY_MS;
  window.SYNC_OVERWRITE_WARNING_TEXT = SYNC_OVERWRITE_WARNING_TEXT;
  window.clampWeightInputValue = clampWeightInputValue;
  window.clampRepsInputValue = clampRepsInputValue;
  window.AI_EXERCISE_WHITELIST_RULE = AI_EXERCISE_WHITELIST_RULE;
  window.validateProgramWizardConfig = validateProgramWizardConfig;
  window.getDifficultyMultipliers = getDifficultyMultipliers;
  window.buildValidatedWizardProgram = buildValidatedWizardProgram;
  window.isRecipeAllowedForDiet = isRecipeAllowedForDiet;
  window.filterRecipesByDietAndIntolerances = filterRecipesByDietAndIntolerances;
  window.classifyExerciseCategory = classifyExerciseCategory;
  window.groupExercisesByCategory = groupExercisesByCategory;
  window.enforceDifficultyOnExercise = enforceDifficultyOnExercise;
  window.enforceDifficultyOnRoutine = enforceDifficultyOnRoutine;
  window.createAutoSupabaseSyncEngine = createAutoSupabaseSyncEngine;
  window.countTotalLoggedSetsInState = countTotalLoggedSetsInState;
  window.resolveSingleSourceOfTruthState = resolveSingleSourceOfTruthState;
  window.fetchLatestCloudStateAsSingleSourceOfTruth = fetchLatestCloudStateAsSingleSourceOfTruth;
  window.getStateLastUpdatedIso = getStateLastUpdatedIso;
  window.parseTimestampMs = parseTimestampMs;
  window.stampGymStateLastUpdated = stampGymStateLastUpdated;
  window.resolveDisplayUsername = resolveDisplayUsername;
  window.clearActiveDayWorkoutData = clearActiveDayWorkoutData;
  window.isBikingExercise = isBikingExercise;
  window.isOverhandPullUpsExercise = isOverhandPullUpsExercise;
  window.orderExercisesWithPullUpsFirst = orderExercisesWithPullUpsFirst;
  window.normalizeCardioExerciseName = normalizeCardioExerciseName;
  window.STANDARD_CARDIO_SESSIONS = STANDARD_CARDIO_SESSIONS;
  window.WORKOUT_FUEL_RESET_PROMPT = WORKOUT_FUEL_RESET_PROMPT;
  window.DELETE_ALL_WEEKS_BUTTON_LABEL = DELETE_ALL_WEEKS_BUTTON_LABEL;
  window.DELETE_ALL_WEEKS_CONFIRM_WARNING = DELETE_ALL_WEEKS_CONFIRM_WARNING;
  window.DELETE_ACCOUNT_WARNING_PROMPT = DELETE_ACCOUNT_WARNING_PROMPT;
  window.DELETE_ACCOUNT_MAIN_WARNING = DELETE_ACCOUNT_MAIN_WARNING;
  window.DELETE_ACCOUNT_BUTTON_LABELS = DELETE_ACCOUNT_BUTTON_LABELS;
  window.buildPostDeleteSwitchPrompt = buildPostDeleteSwitchPrompt;
  window.findSecondarySavedAccount = findSecondarySavedAccount;
  window.clearAllWebSessionCookies = clearAllWebSessionCookies;
  window.purgeMobileClientStorage = purgeMobileClientStorage;
  window.executeCompleteAccountDeletion = executeCompleteAccountDeletion;
  window.validateDeletionTarget = validateDeletionTarget;
  window.clearActiveDayFuelData = clearActiveDayFuelData;
  window.clearActiveDayWorkoutAndOptionalFuel = clearActiveDayWorkoutAndOptionalFuel;
  window.deleteWorkoutForActiveDay = deleteWorkoutForActiveDay;
  window.deleteFuelForActiveDay = deleteFuelForActiveDay;
  window.deleteWorkoutAndFuelForActiveDay = deleteWorkoutAndFuelForActiveDay;
  window.deleteAllWeeksCompleteReset = deleteAllWeeksCompleteReset;
  window.deleteUserAccountFromSupabase = deleteUserAccountFromSupabase;
  window.purgeDeletedAccountFromLocalState = purgeDeletedAccountFromLocalState;
  window.normalizeAccountUserId = normalizeAccountUserId;
  window.isValidDeletableUserId = isValidDeletableUserId;
  window.scanContentForBrokenLinksAndTypos = scanContentForBrokenLinksAndTypos;
  window.validateWorkoutPlanExpertApproval = validateWorkoutPlanExpertApproval;
  window.validateScientificAlignment = validateScientificAlignment;
  window.runDeploymentValidationChecklist = runDeploymentValidationChecklist;
  window.DEFAULT_IKEA_QUIZ_ANSWERS = DEFAULT_IKEA_QUIZ_ANSWERS;
  window.IKEA_QUIZ_STEPS = IKEA_QUIZ_STEPS;
  window.adaptExerciseForEquipment = adaptExerciseForEquipment;
  window.buildIkeaQuizProgram = buildIkeaQuizProgram;
  window.createGuestSandboxStatePatch = createGuestSandboxStatePatch;
  window.enqueueOfflineGymStateSync = enqueueOfflineGymStateSync;
  window.flushOfflineGymStateQueue = flushOfflineGymStateQueue;
  window.isNetworkOnline = isNetworkOnline;
  window.readOfflineSyncQueue = readOfflineSyncQueue;
  window.ACCESSIBLE_THEME_TOKENS = ACCESSIBLE_THEME_TOKENS;
  window.DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK = DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK;
  window.OPENDYSLEXIC_FONT_STACK = OPENDYSLEXIC_FONT_STACK;
  window.applyDyslexiaFontToDocument = applyDyslexiaFontToDocument;
  window.applyThemeToDocument = applyThemeToDocument;
  window.calculateWcagContrastRatio = calculateWcagContrastRatio;
  window.getSystemPrefersDark = getSystemPrefersDark;
  window.loadStoredFontPreference = loadStoredFontPreference;
  window.loadStoredThemePreference = loadStoredThemePreference;
  window.normalizeFontModePreference = normalizeFontModePreference;
  window.normalizeThemeModePreference = normalizeThemeModePreference;
  window.resolveEffectiveTheme = resolveEffectiveTheme;
  window.saveFontPreference = saveFontPreference;
  window.saveThemePreference = saveThemePreference;
  window.detectCsvSourceApp = detectCsvSourceApp;
  window.mapExternalExerciseToSchema = mapExternalExerciseToSchema;
  window.mergeImportedHistoryIntoGymState = mergeImportedHistoryIntoGymState;
  window.parseWorkoutHistoryCsv = parseWorkoutHistoryCsv;
  window.computeAdherenceNeutralWeeklyProgress = computeAdherenceNeutralWeeklyProgress;
  window.calculateEstimated1RM = calculateEstimated1RM;
  window.evaluateSessionMicroWins = evaluateSessionMicroWins;
  window.computeExplainableProgressionMath = computeExplainableProgressionMath;
  window.parseNutritionLabelText = parseNutritionLabelText;
  window.parseWeightStackText = parseWeightStackText;
  window.scanNutritionLabelOCR = scanNutritionLabelOCR;
  window.scanWeightMachineStackOCR = scanWeightMachineStackOCR;
  window.startDeviceCameraStream = startDeviceCameraStream;
  window.applyBiometricVolumeToExercises = applyBiometricVolumeToExercises;
  window.calculateBiometricVolumeAdjustment = calculateBiometricVolumeAdjustment;
  window.fetchAppleHealthKitBiometricsStub = fetchAppleHealthKitBiometricsStub;
  window.fetchGoogleHealthConnectBiometricsStub = fetchGoogleHealthConnectBiometricsStub;
  window.createSmartwatchBridge = createSmartwatchBridge;
  window.POST_DELETE_SELECT_ACCOUNT_PROMPT = POST_DELETE_SELECT_ACCOUNT_PROMPT;
  window.AVAILABLE_OAUTH_LOGIN_PROVIDERS = AVAILABLE_OAUTH_LOGIN_PROVIDERS;
  window.onDeleteSuccess = onDeleteSuccess;
  window.START_FRESH_CONFIRM_TITLE = START_FRESH_CONFIRM_TITLE;
  window.START_FRESH_CONFIRM_COPY = START_FRESH_CONFIRM_COPY;
  window.buildStartFreshGymState = buildStartFreshGymState;
  window.createEmptyBaselineGymState = createEmptyBaselineGymState;
  window.executeStartFreshAndPushToSupabase = executeStartFreshAndPushToSupabase;
  window.HEAVY_WEIGHT_MULTIPLIER_THRESHOLD = HEAVY_WEIGHT_MULTIPLIER_THRESHOLD;
  window.getHistoricalMaxWeightForExercise = getHistoricalMaxWeightForExercise;
  window.buildHeavyWeightWarningMessage = buildHeavyWeightWarningMessage;
  window.validateSetWeightSanity = validateSetWeightSanity;
  window.saveGymStateToIndexedDB = saveGymStateToIndexedDB;
  window.loadGymStateFromIndexedDB = loadGymStateFromIndexedDB;
  window.enqueueIndexedDbSyncItem = enqueueIndexedDbSyncItem;
  window.getPendingIndexedDbSyncItems = getPendingIndexedDbSyncItems;
  window.removeIndexedDbSyncItem = removeIndexedDbSyncItem;
  window.clearIndexedDbSyncOutbox = clearIndexedDbSyncOutbox;
  window.clearAllGymIndexedDbStores = clearAllGymIndexedDbStores;
  window.hydrateGymStateLocalFirst = hydrateGymStateLocalFirst;
  window.persistGymStateLocalFirst = persistGymStateLocalFirst;
  window.flushIndexedDbSyncOutbox = flushIndexedDbSyncOutbox;
  window.notifyServiceWorkerToSync = notifyServiceWorkerToSync;
  window.startOfflineFirstBackgroundSync = startOfflineFirstBackgroundSync;
  window.SENSORY_CALM_STORAGE_KEY = SENSORY_CALM_STORAGE_KEY;
  window.applySensoryCalmToDocument = applySensoryCalmToDocument;
  window.loadStoredSensoryCalmPreference = loadStoredSensoryCalmPreference;
  window.normalizeSensoryCalmPreference = normalizeSensoryCalmPreference;
  window.saveSensoryCalmPreference = saveSensoryCalmPreference;
  window.computeRolling30DayConsistencyScore = computeRolling30DayConsistencyScore;
  window.ADVANCED_SUBJECTIVE_STORAGE_KEY = ADVANCED_SUBJECTIVE_STORAGE_KEY;
  window.DEFAULT_SUBJECTIVE_TRACKING_ENABLED = DEFAULT_SUBJECTIVE_TRACKING_ENABLED;
  window.calculateDoubleProgressionTarget = calculateDoubleProgressionTarget;
  window.evaluateExerciseDoubleProgressionFromGymState = evaluateExerciseDoubleProgressionFromGymState;
  window.loadAdvancedSubjectiveSetting = loadAdvancedSubjectiveSetting;
  window.parseObjectiveRepRange = parseObjectiveRepRange;
  window.saveAdvancedSubjectiveSetting = saveAdvancedSubjectiveSetting;
  window.DEFAULT_KG_PLATES = DEFAULT_KG_PLATES;
  window.DEFAULT_LBS_PLATES = DEFAULT_LBS_PLATES;
  window.STANDARD_BAR_WEIGHT_KG = STANDARD_BAR_WEIGHT_KG;
  window.STANDARD_BAR_WEIGHT_LBS = STANDARD_BAR_WEIGHT_LBS;
  window.buildVisualPlateLoaderSvgHtml = buildVisualPlateLoaderSvgHtml;
  window.calculateVisualBarbellPlates = calculateVisualBarbellPlates;
  window.dispatchRestTimerCompletionAlert = dispatchRestTimerCompletionAlert;
  window.shouldMuteSensoryOutput = shouldMuteSensoryOutput;
  window.triggerSafeHapticFeedback = triggerSafeHapticFeedback;
  window.getSupabaseClient = getSupabaseClient;
  window.isSupabaseRealtimeConfigured = isSupabaseRealtimeConfigured;
  window.resolveGymStateRecordId = resolveGymStateRecordId;
  window.AUTO_SYNC_DEBOUNCE_MS = AUTO_SYNC_DEBOUNCE_MS;
  window.AUTO_SYNC_STORAGE_KEY = AUTO_SYNC_STORAGE_KEY;
  window.AUTO_SYNC_TOGGLE_LABEL = AUTO_SYNC_TOGGLE_LABEL;
  window.AUTO_SYNC_TOGGLE_SUBLABEL = AUTO_SYNC_TOGGLE_SUBLABEL;
  window.DEFAULT_AUTO_SYNC_ENABLED = DEFAULT_AUTO_SYNC_ENABLED;
  window.FORCE_SYNC_NOW_LABEL = FORCE_SYNC_NOW_LABEL;
  window.createDebounce = createDebounce;
  window.createSupabaseRealtimeSyncManager = createSupabaseRealtimeSyncManager;
  window.evaluateRealtimeIncomingPayload = evaluateRealtimeIncomingPayload;
  window.loadAutoSyncPreference = loadAutoSyncPreference;
  window.normalizeAutoSyncPreference = normalizeAutoSyncPreference;
  window.saveAutoSyncPreference = saveAutoSyncPreference;
  window.DELETE_ACCOUNT_WARNING_BULLETS = DELETE_ACCOUNT_WARNING_BULLETS;
  window.findAllRemainingSavedAccounts = findAllRemainingSavedAccounts;
  window.IKEA_QUIZ_ALL_STEPS = IKEA_QUIZ_ALL_STEPS;
  window.ONBOARDING_ACCESSIBILITY_QUESTION = ONBOARDING_ACCESSIBILITY_QUESTION;
  window.ONBOARDING_ACCESSIBILITY_STEP = ONBOARDING_ACCESSIBILITY_STEP;
  window.ADHD_VIEW_STORAGE_KEY = ADHD_VIEW_STORAGE_KEY;
  window.DYSLEXIA_VIEW_STORAGE_KEY = DYSLEXIA_VIEW_STORAGE_KEY;
  window.applyAdhdFriendlyViewToDocument = applyAdhdFriendlyViewToDocument;
  window.applyDyslexiaFriendlyViewToDocument = applyDyslexiaFriendlyViewToDocument;
  window.loadStoredAdhdViewPreference = loadStoredAdhdViewPreference;
  window.loadStoredDyslexiaViewPreference = loadStoredDyslexiaViewPreference;
  window.saveAdhdViewPreference = saveAdhdViewPreference;
  window.saveDyslexiaViewPreference = saveDyslexiaViewPreference;
  window.DEFAULT_VALIDATION_LIMITS = DEFAULT_VALIDATION_LIMITS;
  window.validateAccountProfileInput = validateAccountProfileInput;
  window.validateGymTimeInput = validateGymTimeInput;
  window.validateLoggedReps = validateLoggedReps;
  window.validateLoggedWeight = validateLoggedWeight;
  window.validateQuickAddFuelInput = validateQuickAddFuelInput;
  window.captureViewportScrollAnchor = captureViewportScrollAnchor;
  window.computeStableScrollTargetY = computeStableScrollTargetY;
  window.restoreViewportScrollAnchor = restoreViewportScrollAnchor;
  window.scrollContainerHorizontallyWithoutVerticalJump = scrollContainerHorizontallyWithoutVerticalJump;
  window.withStableViewportScroll = withStableViewportScroll;
  window.FORCE_PULL_CLOUD_LABEL = FORCE_PULL_CLOUD_LABEL;
  window.FORCE_PULL_SUCCESS_TOAST = FORCE_PULL_SUCCESS_TOAST;
  window.DATA_BACKUP_MIGRATION_TITLE = DATA_BACKUP_MIGRATION_TITLE;
  window.DEFAULT_BACKUP_FILENAME = DEFAULT_BACKUP_FILENAME;
  window.resolveAuthenticatedGymStateIds = resolveAuthenticatedGymStateIds;
  window.forcePullGymStateFromCloud = forcePullGymStateFromCloud;
  window.validateGymStateBackupSchema = validateGymStateBackupSchema;
  window.serializeGymStateForJsonExport = serializeGymStateForJsonExport;
  window.triggerGymStateJsonDownload = triggerGymStateJsonDownload;
  window.importGymStateFromJsonText = importGymStateFromJsonText;
  window.PASSKEY_REGISTRY_STORAGE_KEY = PASSKEY_REGISTRY_STORAGE_KEY;
  window.validatePasswordlessEmail = validatePasswordlessEmail;
  window.resolveDynamicAuthRedirectUrl = resolveDynamicAuthRedirectUrl;
  window.buildSafeMagicLinkRedirectUrl = buildSafeMagicLinkRedirectUrl;
  window.sendSupabaseMagicLink = sendSupabaseMagicLink;
  window.verifySupabaseMagicLinkOtp = verifySupabaseMagicLinkOtp;
  window.hardDeleteAccount = hardDeleteAccount;
  window.purgeSupabaseAuthStorageKeys = purgeSupabaseAuthStorageKeys;
  window.isWebAuthnPasskeySupported = isWebAuthnPasskeySupported;
  window.checkPlatformBiometricPasskeyAvailability = checkPlatformBiometricPasskeyAvailability;
  window.loadRegisteredPasskeys = loadRegisteredPasskeys;
  window.hasRegisteredPasskeyForEmail = hasRegisteredPasskeyForEmail;
  window.registerBiometricPasskey = registerBiometricPasskey;
  window.authenticateWithBiometricPasskey = authenticateWithBiometricPasskey;
  window.ALLOWED_PLAYBACK_RATES = ALLOWED_PLAYBACK_RATES;
  window.BARBELL_SQUAT_MEDIA_SAMPLES = BARBELL_SQUAT_MEDIA_SAMPLES;
  window.DEFAULT_ACCESSIBLE_VIDEO_SETTINGS = DEFAULT_ACCESSIBLE_VIDEO_SETTINGS;
  window.parseVttTimestampToSeconds = parseVttTimestampToSeconds;
  window.parseWebVttCaptions = parseWebVttCaptions;
  window.getActiveVttCaptionAtTime = getActiveVttCaptionAtTime;
  window.getActiveLiteralStepAtTime = getActiveLiteralStepAtTime;
  window.formatSecondsClock = formatSecondsClock;
  window.sanitizeMediaUrl = sanitizeMediaUrl;
  window.mountAccessibleVideoPlayer = mountAccessibleVideoPlayer;
  window.mountPhase2AccessibilityHub = mountPhase2AccessibilityHub;
  window.mountPlainLanguageCoachModal = mountPlainLanguageCoachModal;
  window.normalizeSpokenNumbers = normalizeSpokenNumbers;
  window.parseSpokenSetPhrase = parseSpokenSetPhrase;
  window.applyVoiceLogToGymState = applyVoiceLogToGymState;
  window.revertVoiceLogFromGymState = revertVoiceLogFromGymState;
  window.isWebSpeechRecognitionSupported = isWebSpeechRecognitionSupported;
  window.createBrowserSpeechRecognizer = createBrowserSpeechRecognizer;
  window.PLAIN_LANGUAGE_COACH_SYSTEM_INSTRUCTION = PLAIN_LANGUAGE_COACH_SYSTEM_INSTRUCTION;
  window.buildBoundedProgressionSnapshot = buildBoundedProgressionSnapshot;
  window.requestPlainLanguageCoachExplanation = requestPlainLanguageCoachExplanation;
  window.LOW_SPOONS_PRESETS = LOW_SPOONS_PRESETS;
  window.BARBELL_TO_MACHINE_SWAPS = BARBELL_TO_MACHINE_SWAPS;
  window.mapClassificationToValidatedPreset = mapClassificationToValidatedPreset;
  window.findStableMachineVariation = findStableMachineVariation;
  window.applyLowSpoonsPresetToExercises = applyLowSpoonsPresetToExercises;
  window.classifyLowSpoonsWithGemini = classifyLowSpoonsWithGemini;
  window.syncDailyBiometricsToSupabase = syncDailyBiometricsToSupabase;
  window.fetchLatestBiometricsFromSupabase = fetchLatestBiometricsFromSupabase;
  window.attachBiometricsToGymState = attachBiometricsToGymState;
  window.WCAG_STRICT_CONTRAST_TARGETS = WCAG_STRICT_CONTRAST_TARGETS;
  window.verifyThemeContrastCompliance = verifyThemeContrastCompliance;
  window.CLINICAL_TRIAL_EXPORT_WEEKS = CLINICAL_TRIAL_EXPORT_WEEKS;
  window.anonymizeParticipantId = anonymizeParticipantId;
  window.applyInstitutionalFlagsToUserProfile = applyInstitutionalFlagsToUserProfile;
  window.buildAnonymized12WeekClinicalTrialRows = buildAnonymized12WeekClinicalTrialRows;
  window.escapeCsvCellSafe = escapeCsvCellSafe;
  window.exportAnonymized12WeekClinicalTrialCsv = exportAnonymized12WeekClinicalTrialCsv;
  window.normalizeInstitutionalEligibility = normalizeInstitutionalEligibility;
  window.resolveInstitutionalBillingRoute = resolveInstitutionalBillingRoute;
  window.serializeClinicalTrialCsv = serializeClinicalTrialCsv;
  window.triggerClinicalTrialCsvDownload = triggerClinicalTrialCsvDownload;
  window.AUTH_INPUT_IDS = AUTH_INPUT_IDS;
  window.NON_AUTH_INPUT_ATTRIBUTES = NON_AUTH_INPUT_ATTRIBUTES;
  window.shouldPromptForLogin = shouldPromptForLogin;
  window.isAuthFieldElement = isAuthFieldElement;
  window.applyNonAuthInputAttributes = applyNonAuthInputAttributes;
  window.buildNonAuthNoteInputProps = buildNonAuthNoteInputProps;
  window.enforceNonAuthInputsAcrossRoot = enforceNonAuthInputsAcrossRoot;
  window.guardNonAuthNoteFocusEvent = guardNonAuthNoteFocusEvent;
  window.syncHiddenAuthModalInputIsolation = syncHiddenAuthModalInputIsolation;
  window.ACTIVE_WORKOUT_SESSION_KEY = ACTIVE_WORKOUT_SESSION_KEY;
  window.MAX_RESUME_SESSION_AGE_MS = MAX_RESUME_SESSION_AGE_MS;
  window.buildActiveWorkoutSessionSnapshot = buildActiveWorkoutSessionSnapshot;
  window.saveActiveWorkoutSession = saveActiveWorkoutSession;
  window.loadActiveWorkoutSession = loadActiveWorkoutSession;
  window.clearActiveWorkoutSession = clearActiveWorkoutSession;
  window.buildResumeWorkoutBannerCopy = buildResumeWorkoutBannerCopy;
  window.parseHHMMMinutesSafe = parseHHMMMinutesSafe;
  window.formatMinutes12Hour = formatMinutes12Hour;
  window.formatMinutesHHMM = formatMinutesHHMM;
  window.buildProminentWarmupQuickTips = buildProminentWarmupQuickTips;
  window.computeLiveScheduleContext = computeLiveScheduleContext;
  window.NEXT_WEEK_NOTE_QUICK_CHIPS = NEXT_WEEK_NOTE_QUICK_CHIPS;
  window.extractReadableTextFromPdfBytes = extractReadableTextFromPdfBytes;
  window.parseCustomWorkoutProgram = parseCustomWorkoutProgram;
  window.buildNextWeekProgressionNote = buildNextWeekProgressionNote;
  window.validateWorkoutNoteText = validateWorkoutNoteText;
  window.validateTimerDurationSeconds = validateTimerDurationSeconds;
  window.validateExerciseSetEntry = validateExerciseSetEntry;
  window.mountCustomProgramUploadPanel = mountCustomProgramUploadPanel;
  window.extractAvatarInitial = extractAvatarInitial;
  window.sanitizeAvatarUrl = sanitizeAvatarUrl;
  window.resolveHeaderAuthState = resolveHeaderAuthState;
  window.subscribeGlobalHeaderAuthState = subscribeGlobalHeaderAuthState;
  window.syncDomHeaderAuthButton = syncDomHeaderAuthButton;
  window.SWAP_MODAL_TITLE = SWAP_MODAL_TITLE;
  window.DEFAULT_MEAL_SLOT_BASE_COSTS = DEFAULT_MEAL_SLOT_BASE_COSTS;
  window.PRODUCT_THUMBNAILS = PRODUCT_THUMBNAILS;
  window.INGREDIENT_SWAP_CATALOG = INGREDIENT_SWAP_CATALOG;
  window.buildProductThumbnailDataUri = buildProductThumbnailDataUri;
  window.resolveIngredientImageUrl = resolveIngredientImageUrl;
  window.inferIngredientCategory = inferIngredientCategory;
  window.estimateIngredientServingCost = estimateIngredientServingCost;
  window.getSwapOptionsForIngredient = getSwapOptionsForIngredient;
  window.computeSwapMacroDeltas = computeSwapMacroDeltas;
  window.recalculateMealTotals = recalculateMealTotals;
  window.applyIngredientSwapsToDayPlan = applyIngredientSwapsToDayPlan;
  window.applyIngredientSwapToGymState = applyIngredientSwapToGymState;
  window.resetIngredientSwapInGymState = resetIngredientSwapInGymState;
  window.mountSwapIngredientModal = mountSwapIngredientModal;
  window.parseInlineSetText = parseInlineSetText;
  window.formatParsedSetsSummary = formatParsedSetsSummary;
  window.applyParsedSetsToExerciseLogs = applyParsedSetsToExerciseLogs;
  window.revertFastLogUndoSnapshot = revertFastLogUndoSnapshot;
  window.resolveNavigationTarget = resolveNavigationTarget;
  window.buildSkipOnboardingDefaultPatch = buildSkipOnboardingDefaultPatch;
  window.extractRecentLiftWeights = extractRecentLiftWeights;
  window.MISSED_SET_ONE_MODAL_QUESTION = MISSED_SET_ONE_MODAL_QUESTION;
  window.MACHINE_PHOTO_PATHS = MACHINE_PHOTO_PATHS;
  window.buildOfflineMachineDiagramDataUri = buildOfflineMachineDiagramDataUri;
  window.buildSkippedSetOneLog = buildSkippedSetOneLog;
  window.computeDeviceClockWarmupTimer = computeDeviceClockWarmupTimer;
  window.detectMissedSetOneCondition = detectMissedSetOneCondition;
  window.formatDeviceClock12Hr = formatDeviceClock12Hr;
  window.formatMmSs = formatMmSs;
  window.inferMachineEquipmentFamily = inferMachineEquipmentFamily;
  window.isExerciseResolvedDone = isExerciseResolvedDone;
  window.resolveMachinePhotoAsset = resolveMachinePhotoAsset;
  window.resolveMostRecentSuccessfulWeight = resolveMostRecentSuccessfulWeight;
  window.resolveNextExercisePreviewName = resolveNextExercisePreviewName;
  window.validateMachinePhotoRegistry = validateMachinePhotoRegistry;
  window.CONFLICT_BACKUP_SNAPSHOT_KEY = CONFLICT_BACKUP_SNAPSHOT_KEY;
  window.SYNC_CONFLICT_MODAL_QUESTION = SYNC_CONFLICT_MODAL_QUESTION;
  window.SYNC_OUTBOX_STORAGE_KEY = SYNC_OUTBOX_STORAGE_KEY;
  window.buildLocalWinsMergedState = buildLocalWinsMergedState;
  window.clearSyncOutbox = clearSyncOutbox;
  window.enqueueSyncOutboxAction = enqueueSyncOutboxAction;
  window.evaluatePreLoginSyncStrategy = evaluatePreLoginSyncStrategy;
  window.extractCompletedSetFingerprints = extractCompletedSetFingerprints;
  window.flushSyncOutboxToSupabase = flushSyncOutboxToSupabase;
  window.formatSyncComparisonTimestamp = formatSyncComparisonTimestamp;
  window.loadConflictBackupSnapshot = loadConflictBackupSnapshot;
  window.readSyncOutbox = readSyncOutbox;
  window.saveConflictBackupSnapshot = saveConflictBackupSnapshot;
  window.writeSyncOutbox = writeSyncOutbox;
  window.FLEXIBLE_SET_STEPPER_PALETTE = FLEXIBLE_SET_STEPPER_PALETTE;
  window.MIN_FLEXIBLE_SETS = MIN_FLEXIBLE_SETS;
  window.MAX_FLEXIBLE_SETS = MAX_FLEXIBLE_SETS;
  window.verifyStepperWcagContrastCompliance = verifyStepperWcagContrastCompliance;
  window.shouldShowMicroStartPanel = shouldShowMicroStartPanel;
  window.shouldShowResumeWorkoutBanner = shouldShowResumeWorkoutBanner;
  window.getExerciseSetOverrideKey = getExerciseSetOverrideKey;
  window.clampFlexibleSetCount = clampFlexibleSetCount;
  window.resolveEffectiveExerciseSetCount = resolveEffectiveExerciseSetCount;
  window.adjustExerciseSetCount = adjustExerciseSetCount;
  window.resolveWeightStepIncrement = resolveWeightStepIncrement;
  window.stepWeightValue = stepWeightValue;
  window.stepRepsValue = stepRepsValue;
  window.shouldLockExerciseOnSetDone = shouldLockExerciseOnSetDone;
  window.dispatchEvent(new CustomEvent('d3-onerm-bridge-ready'));
}
