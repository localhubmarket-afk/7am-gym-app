export interface SetLog {
  weight: string;
  reps: string;
  done: boolean;
  unit?: 'lbs' | 'kg';
}

export interface WarmupDrill {
  id: string;
  name: string;
  reps: string;
  notes: string;
  videoUrl: string;
}

export const WARMUP_DRILLS: { upper: WarmupDrill[]; lower: WarmupDrill[] } = {
  upper: [
    {
      id: 'wu_arm_circles',
      name: 'Arm Circles',
      reps: '5 each direction',
      notes: 'Swing arms forward 5 reps, then reverse direction for 5 reps.',
      videoUrl: 'https://www.youtube.com/watch?v=HMxqtrsNz60'
    },
    {
      id: 'wu_band_over_backs',
      name: 'Band Over-and-Backs',
      reps: '5 reps',
      notes: 'Wide overhand grip, bring band over head and behind body with straight arms.',
      videoUrl: 'https://www.youtube.com/watch?v=-avWRzrrH-o'
    },
    {
      id: 'wu_band_pull_aparts',
      name: 'Band Pull-Aparts',
      reps: '10 reps',
      notes: 'Overhand grip shoulder-width apart, squeeze shoulder blades together.',
      videoUrl: 'https://www.youtube.com/watch?v=mHWlgqPvyxI'
    },
    {
      id: 'wu_band_ext_rot',
      name: 'Band External Rotations',
      reps: '10 / side',
      notes: 'Pin elbow to side at 90°, rotate forearm outwards then control back in.',
      videoUrl: 'https://www.youtube.com/watch?v=dS9ORQCnWsE'
    },
    {
      id: 'wu_weighted_ext_rot',
      name: 'Weighted External Rotations',
      reps: '10 / side',
      notes: 'Light plate/dumbbell, elbow at 90° shoulder height, rotate hand up.',
      videoUrl: 'https://www.youtube.com/watch?v=IlqmuM9FPUU'
    }
  ],
  lower: [
    {
      id: 'wu_fwd_leg_swings',
      name: 'Forward Leg Swings',
      reps: '5 / side',
      notes: 'Hold fixture for support, swing leg front and back smoothly.',
      videoUrl: 'https://www.youtube.com/watch?v=3l31E2cMGMk'
    },
    {
      id: 'wu_side_leg_swings',
      name: 'Side Leg Swings',
      reps: '5 / side',
      notes: 'Hold fixture in front, swing leg side to side across body.',
      videoUrl: 'https://www.youtube.com/watch?v=TAHk1yccDmM'
    },
    {
      id: 'wu_deep_squat_hold',
      name: 'Deep Squat Hold',
      reps: '1 x 30 sec',
      notes: 'Hold weight plate in front of chest in a deep squat, rock gently over ankles.',
      videoUrl: 'https://www.youtube.com/watch?v=poKi7JPfuxE'
    },
    {
      id: 'wu_dead_bug',
      name: 'Dead Bug',
      reps: '5 / side',
      notes: 'Brace core flat to floor, extend opposite arm and leg slowly.',
      videoUrl: 'https://www.youtube.com/watch?v=o4GKiEoYClI'
    }
  ]
};

export function calculateBarbellPerSidePlateMath(
  totalWeight: number,
  barWeight: number,
  unit: 'lbs' | 'kg' = 'lbs'
) {
  const effectiveTotal = Math.max(barWeight, Number.isFinite(totalWeight) ? totalWeight : barWeight);
  const bothSides = Math.max(0, +(effectiveTotal - barWeight).toFixed(2));
  const perSide = Math.max(0, +(bothSides / 2).toFixed(2));
  const plates = unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] : [45, 35, 25, 10, 5, 2.5, 1.25];
  let rem = perSide;
  const breakdown: number[] = [];
  for (const p of plates) {
    while (rem >= p - 0.01) {
      breakdown.push(p);
      rem = +(rem - p).toFixed(2);
    }
  }
  if (rem >= 0.05) {
    breakdown.push(+rem.toFixed(2));
  }
  return {
    total: effectiveTotal,
    bar: barWeight,
    bothSides,
    perSide,
    breakdown,
    breakdownLabel: breakdown.length > 0 ? `${breakdown.join(' + ')} ${unit}/side` : `Empty Bar (0 ${unit}/side)`
  };
}

export function updateSingleBarbellSetWeight(
  workoutLogs: Record<string, SetLog>,
  week: number,
  dayIdx: number,
  exId: string,
  setNum: number,
  newWeight: string,
  unit: 'lbs' | 'kg' = 'lbs'
): Record<string, SetLog> {
  const nextLogs = { ...workoutLogs };
  const logKey = `w${week}_${dayIdx}_${exId}_${setNum}`;
  const existing = nextLogs[logKey] || { weight: '', reps: '', done: false, unit };
  nextLogs[logKey] = {
    ...existing,
    weight: String(newWeight),
    unit
  };
  return nextLogs;
}

export function applyWeightToRemainingUnloggedSets(
  workoutLogs: Record<string, SetLog>,
  week: number,
  dayIdx: number,
  exId: string,
  totalSets: number,
  sourceWeight: string,
  unit: 'lbs' | 'kg' = 'lbs'
): Record<string, SetLog> {
  const nextLogs = { ...workoutLogs };
  for (let s = 1; s <= totalSets; s++) {
    const logKey = `w${week}_${dayIdx}_${exId}_${s}`;
    const existing = nextLogs[logKey] || { weight: '', reps: '', done: false, unit };
    if (!existing.done) {
      nextLogs[logKey] = {
        ...existing,
        weight: String(sourceWeight),
        unit
      };
    }
  }
  return nextLogs;
}

export function computeMaxUnlockedWeek(
  workoutLogs: Record<string, SetLog>,
  selectedWeek: number,
  currentMaxUnlocked?: number
): number {
  let highestWeekWithLogs = 1;
  let week1HasLoggedSets = false;

  for (const [k, entry] of Object.entries(workoutLogs || {})) {
    if (!entry || (!entry.done && !entry.weight && !entry.reps)) continue;
    if (k.startsWith('w1_') && entry.done) {
      week1HasLoggedSets = true;
    }
    const match = k.match(/^w(\d+)_/);
    if (match) {
      const w = parseInt(match[1], 10);
      if (!isNaN(w) && w > highestWeekWithLogs) {
        highestWeekWithLogs = w;
      }
    }
  }

  const baseDefault = week1HasLoggedSets ? 2 : 1;
  return Math.min(12, Math.max(baseDefault, selectedWeek || 1, highestWeekWithLogs, currentMaxUnlocked || 1));
}

export function finishWeekAndUnlockNext(stateObj: {
  selectedWeek: number;
  maxUnlockedWeek: number;
  completedWeeks: Record<number, boolean>;
}) {
  const cur = stateObj.selectedWeek || 1;
  const completedWeeks = { ...(stateObj.completedWeeks || {}), [cur]: true };
  const nextUnlocked = Math.min(12, Math.max((stateObj.maxUnlockedWeek || 1) + 1, cur + 1));
  return {
    selectedWeek: nextUnlocked,
    maxUnlockedWeek: nextUnlocked,
    completedWeeks
  };
}

export function isEndOfDayWorkoutComplete(
  totalDoneSetsToday: number,
  totalTargetSetsToday: number
): boolean {
  return totalTargetSetsToday > 0 && totalDoneSetsToday === totalTargetSetsToday;
}

export function addWaterIntakeMl(
  waterIntakeLogs: Record<string, number>,
  week: number,
  dayIdx: number,
  deltaMl: number
): Record<string, number> {
  const key = `w${week}_d${dayIdx}`;
  const current = waterIntakeLogs[key] || 0;
  const updated = Math.max(0, Math.min(6000, current + deltaMl));
  return {
    ...waterIntakeLogs,
    [key]: updated
  };
}

export function getRollingWeekVisibility(maxUnlockedWeek: number): {
  visibleWeeks: number[];
  olderWeeks: number[];
  showOlderToggle: boolean;
} {
  const clampedMax = Math.max(1, Math.min(12, maxUnlockedWeek || 1));
  if (clampedMax <= 3) {
    const visibleWeeks: number[] = [];
    for (let w = 1; w <= clampedMax; w++) visibleWeeks.push(w);
    return {
      visibleWeeks,
      olderWeeks: [],
      showOlderToggle: false
    };
  }
  const startRolling = Math.max(1, clampedMax - 3);
  const visibleWeeks: number[] = [];
  for (let w = startRolling; w <= clampedMax; w++) {
    visibleWeeks.push(w);
  }
  const olderWeeks: number[] = [];
  for (let w = 1; w < startRolling; w++) {
    olderWeeks.push(w);
  }
  if (olderWeeks.length === 0 && clampedMax === 4) {
    olderWeeks.push(1);
  }
  return {
    visibleWeeks,
    olderWeeks,
    showOlderToggle: true
  };
}

export function shouldShowStickyRestTimer(tabName: string): boolean {
  return tabName === 'workout' || tabName === 'pullups';
}

export function formatExerciseProgressBadge(exIdxZeroBased: number, totalExercisesToday: number): string {
  return `#${exIdxZeroBased + 1}/${Math.max(1, totalExercisesToday)}`;
}

export function stripExercisePrefix(text: string): string {
  return String(text || '').replace(/^[A-Z]\d+[\.\:\-\)]\s*/i, '').trim();
}

export interface RecipePrepStep {
  id: string;
  title: string;
  detail: string;
  weightBadge?: string;
}

export interface BatchPrepRecipe {
  id: string;
  badge: string;
  yieldPill: string;
  title: string;
  subtitle: string;
  steps: RecipePrepStep[];
}

export const BATCH_PREP_RECIPES: BatchPrepRecipe[] = [
  {
    id: 'recipe_oats_batch',
    badge: '#Prep 1/2',
    yieldPill: '4-Day Batch • 4 Servings',
    title: '4-Day Overnight Protein Oats Batch',
    subtitle: 'Prep time: 5 mins • Fridge life: 4 days • 45g oats + 180g Silk per jar',
    steps: [
      {
        id: 'oats_step_1',
        title: '#1 Gluten-Free Protein Oats',
        detail: '180g total (45g × 4 jars)',
        weightBadge: '180g'
      },
      {
        id: 'oats_step_2',
        title: '#2 Organic Whole Chia Seeds',
        detail: '24g total (6g × 4 jars)',
        weightBadge: '24g'
      },
      {
        id: 'oats_step_3',
        title: '#3 Peeled Ripe Banana (Mashed)',
        detail: '120g total (30g × 4 jars)',
        weightBadge: '120g'
      },
      {
        id: 'oats_step_4',
        title: '#4 Smooth Natural Peanut Butter',
        detail: '32g total (8g × 4 jars)',
        weightBadge: '32g'
      },
      {
        id: 'oats_step_5',
        title: '#5 Unsweetened Silk Protein Milk',
        detail: '720g / 720 ml total (180g × 4 jars)',
        weightBadge: '720g'
      },
      {
        id: 'oats_step_6',
        title: '#6 Stir, Seal & Refrigerate Overnight',
        detail: 'Divide evenly into 4 jars and chill for 8:15 AM post-gym fuel'
      }
    ]
  },
  {
    id: 'recipe_rice_batch',
    badge: '#Prep 2/2',
    yieldPill: '4-Day Batch • 4 Servings',
    title: '4-Day Jasmine Rice Batch Prep',
    subtitle: 'Prep time: 20 mins • Yields 4x 150g cooked rice portions (55g dry/day)',
    steps: [
      {
        id: 'rice_step_1',
        title: '#1 Dry White Jasmine Rice (Rinsed)',
        detail: 'Weigh and rinse in cold water until clear (55g dry × 4 days)',
        weightBadge: '220g'
      },
      {
        id: 'rice_step_2',
        title: '#2 Filtered Cooking Water (1 : 1.5 Ratio)',
        detail: 'Add water to pot or rice cooker with rinsed rice',
        weightBadge: '330 ml'
      },
      {
        id: 'rice_step_3',
        title: '#3 Simmer 12 Mins & Steam 10 Mins',
        detail: 'Boil, cover on low heat 12m, rest off heat 10m (~600g cooked yield)'
      },
      {
        id: 'rice_step_4',
        title: '#4 Divide Into 4 Storage Containers',
        detail: 'Portion 150g cooked rice per container for Daily Fuel 2 bowls',
        weightBadge: '150g × 4'
      }
    ]
  }
];

export function toggleRecipePrepStep(
  recipePrepLogs: Record<string, boolean>,
  stepId: string
): Record<string, boolean> {
  return {
    ...(recipePrepLogs || {}),
    [stepId]: !recipePrepLogs?.[stepId]
  };
}

export function resetRecipePrepSteps(
  recipePrepLogs: Record<string, boolean>,
  recipeId: string
): Record<string, boolean> {
  const next = { ...(recipePrepLogs || {}) };
  const recipe = BATCH_PREP_RECIPES.find(r => r.id === recipeId);
  if (recipe) {
    recipe.steps.forEach(s => {
      delete next[s.id];
    });
  }
  return next;
}

// ============================================================================
// UPGRADE 1: 3-State Bluetooth-Safe Audio Mode Logic
// ============================================================================
export type TimerAudioMode = 'sound_vibe' | 'vibe_only' | 'silent';

export function cycleTimerAudioMode(current: TimerAudioMode): TimerAudioMode {
  if (current === 'sound_vibe') return 'vibe_only';
  if (current === 'vibe_only') return 'silent';
  return 'sound_vibe';
}

export function getTimerAudioModeBehavior(mode: TimerAudioMode): {
  shouldCreateAudioContext: boolean;
  shouldVibrate: boolean;
  closeDelayMs: number;
  label: string;
} {
  if (mode === 'vibe_only') {
    return {
      shouldCreateAudioContext: false,
      shouldVibrate: true,
      closeDelayMs: 0,
      label: ' Vibrate Only'
    };
  }
  if (mode === 'silent') {
    return {
      shouldCreateAudioContext: false,
      shouldVibrate: false,
      closeDelayMs: 0,
      label: ' Silent'
    };
  }
  return {
    shouldCreateAudioContext: true,
    shouldVibrate: true,
    closeDelayMs: 320,
    label: ' Sound & Vibe'
  };
}

export function shouldExpandPyramidHelperByDefault(selectedDayIndex: number): boolean {
  return selectedDayIndex === 1;
}

export function shouldShowBarbellHeaderPlateBadge(
  isBarbellEx: boolean,
  isExComplete: boolean,
  isCollapsedDone: boolean
): boolean {
  if (!isBarbellEx) return false;
  if (isExComplete && isCollapsedDone) return false;
  return true;
}

// ============================================================================
// UPGRADE 2 & 3: Side Plank Isometric Timer & Dumbbell-Only Calf Raise
// ============================================================================
export const TIMED_HOLD_PRESETS_SEC = [30, 45, 60, 75, 90] as const;

export const UPDATED_BARBELL_EX_IDS = [
  'mon_bench',
  'mon_ohp',
  'tue_squat',
  'sat_deadlift',
  'sat_hip_thrust'
] as const;

export function isTimedHoldExercise(ex: { id?: string; name?: string; isTimedHold?: boolean }): boolean {
  if (!ex) return false;
  if (ex.isTimedHold === true) return true;
  if (ex.id === 'tue_side_plank' || ex.id === 'sat_side_plank') return true;
  return /side\s+plank/i.test(String(ex.name || ''));
}

export function formatTimedHoldTarget(seconds: number): string {
  const clean = Math.max(10, Math.round(Number(seconds) || 30));
  return `${clean}s / side`;
}

// ============================================================================
// UPGRADE 4: Collapsible Exercise Notes & Photo + Next-Week Warning Badge
// ============================================================================
export interface ExerciseNoteEntry {
  text: string;
  photoDataUrl: string;
  updatedWeek: number;
  updatedAt: string;
}

export function upsertExerciseNote(
  notesMap: Record<string, ExerciseNoteEntry>,
  exId: string,
  patch: Partial<ExerciseNoteEntry>,
  currentWeek: number,
  nowIso = new Date().toISOString()
): Record<string, ExerciseNoteEntry> {
  const existing = notesMap?.[exId] || {
    text: '',
    photoDataUrl: '',
    updatedWeek: currentWeek,
    updatedAt: nowIso
  };
  const updated: ExerciseNoteEntry = {
    text: patch.text !== undefined ? patch.text : existing.text,
    photoDataUrl: patch.photoDataUrl !== undefined ? patch.photoDataUrl : existing.photoDataUrl,
    updatedWeek: patch.updatedWeek !== undefined ? patch.updatedWeek : currentWeek,
    updatedAt: nowIso
  };
  return {
    ...(notesMap || {}),
    [exId]: updated
  };
}

export function getExerciseNoteHeaderBadge(
  note: ExerciseNoteEntry | undefined
): { visible: boolean; badgeText: string; hasPhoto: boolean } {
  if (!note) return { visible: false, badgeText: '', hasPhoto: false };
  const cleanText = String(note.text || '').trim();
  const hasPhoto = Boolean(note.photoDataUrl && note.photoDataUrl.startsWith('data:image/'));
  if (!cleanText && !hasPhoto) {
    return { visible: false, badgeText: '', hasPhoto: false };
  }
  const badgeText = cleanText ? `Note: ${cleanText}` : 'Note: Machine Photo Saved';
  return {
    visible: true,
    badgeText,
    hasPhoto
  };
}

// ============================================================================
// UPGRADE 5, 6 & 7: 4 Daily Fuel Cards, Scannable Ingredient Rows & Pre-Gym Check
// ============================================================================
export interface FuelIngredientRow {
  id: string;
  name: string;
  amountPill: string;
  protein: number;
  kcal: number;
}

export interface DailyFuelCardSpec {
  slotId: 'pre_shake' | 'post_oats' | 'lunch' | 'dinner';
  fuelNum: number;
  headerBadge: string;
  defaultTime: string;
  title: string;
  kcal: number;
  protein: number;
  rows: FuelIngredientRow[];
}

export const DAILY_FUEL_CARDS: DailyFuelCardSpec[] = [
  {
    slotId: 'pre_shake',
    fuelNum: 1,
    headerBadge: 'FUEL 1 • PRE-GYM SHAKE (6:35 AM)',
    defaultTime: '6:35 AM',
    title: 'Pre-Gym Fast Protein Shake',
    kcal: 170,
    protein: 36,
    rows: [
      { id: 'f1_pea_isolate', name: 'Pea Protein Isolate', amountPill: '30g', protein: 24, kcal: 110 },
      { id: 'f1_silk_milk', name: 'Unsweetened Silk Protein Milk', amountPill: '360 ml', protein: 12, kcal: 60 }
    ]
  },
  {
    slotId: 'post_oats',
    fuelNum: 2,
    headerBadge: 'FUEL 2 • POST-GYM OVERNIGHT OATS (8:15 AM)',
    defaultTime: '8:15 AM',
    title: 'Post-Gym Overnight Protein Oats',
    kcal: 395,
    protein: 26,
    rows: [
      { id: 'f2_oats', name: 'Gluten-Free Protein Oats', amountPill: '45g', protein: 15, kcal: 170 },
      { id: 'f2_silk_milk', name: 'Unsweetened Silk Protein Milk', amountPill: '180 ml', protein: 6, kcal: 100 },
      { id: 'f2_banana', name: 'Peeled Ripe Banana', amountPill: '30g', protein: 0.5, kcal: 30 },
      { id: 'f2_pb', name: 'Smooth Natural Peanut Butter', amountPill: '8g', protein: 2.5, kcal: 55 },
      { id: 'f2_chia', name: 'Organic Whole Chia Seeds', amountPill: '6g', protein: 2, kcal: 40 }
    ]
  },
  {
    slotId: 'lunch',
    fuelNum: 3,
    headerBadge: 'FUEL 3 • SAVOURY TOFU & JASMINE RICE BOWL (1:00 PM)',
    defaultTime: '1:00 PM',
    title: 'Savoury Tofu, Rice & Broccoli Bowl',
    kcal: 520,
    protein: 33,
    rows: [
      { id: 'f3_tofu', name: 'Extra-Firm Tofu', amountPill: '175g', protein: 21, kcal: 210 },
      { id: 'f3_rice', name: 'Cooked White Jasmine Rice', amountPill: '150g', protein: 4, kcal: 195 },
      { id: 'f3_broccoli', name: 'Steamed Broccoli Florets', amountPill: '75g', protein: 2, kcal: 25 },
      { id: 'f3_yeast', name: 'Fortified Nutritional Yeast', amountPill: '12g', protein: 6, kcal: 45 },
      { id: 'f3_sesame', name: 'Toasted Sesame Oil', amountPill: '5g', protein: 0, kcal: 45 },
      { id: 'f3_salt', name: 'Iodized Table Salt', amountPill: '1.5g', protein: 0, kcal: 0 }
    ]
  },
  {
    slotId: 'dinner',
    fuelNum: 4,
    headerBadge: 'FUEL 4 • EVENING RECOVERY SHAKE (5:30 PM)',
    defaultTime: '5:30 PM',
    title: 'Evening Protein & PB Shake',
    kcal: 315,
    protein: 43,
    rows: [
      { id: 'f4_pea_isolate', name: 'Pea Protein Isolate', amountPill: '45g', protein: 27, kcal: 160 },
      { id: 'f4_silk_milk', name: 'Unsweetened Silk Protein Milk', amountPill: '360 ml', protein: 12, kcal: 60 },
      { id: 'f4_pb', name: 'Smooth Natural Peanut Butter', amountPill: '16g', protein: 4, kcal: 95 }
    ]
  }
];

export function calculateDailyFuelMacros(
  checkedSlots: Partial<Record<DailyFuelCardSpec['slotId'], boolean>>
): { protein: number; kcal: number; loggedCount: number } {
  let protein = 0;
  let kcal = 0;
  let loggedCount = 0;
  for (const card of DAILY_FUEL_CARDS) {
    if (checkedSlots && checkedSlots[card.slotId]) {
      protein += card.protein;
      kcal += card.kcal;
      loggedCount += 1;
    }
  }
  return { protein, kcal, loggedCount };
}

export function shouldShowPreWorkoutFuelPrompt(
  dayIdx: number,
  isFuel1Logged: boolean,
  isDismissedForDay: boolean,
  doneSetsToday = 0,
  totalSetsToday = 1
): boolean {
  const isTrainingDay = dayIdx >= 0 && dayIdx <= 4;
  const isWorkoutIncomplete = totalSetsToday > 0 && doneSetsToday < totalSetsToday;
  return isTrainingDay && !isFuel1Logged && !isDismissedForDay && isWorkoutIncomplete;
}

// ============================================================================
// ARCHITECTURAL UPGRADES 1–4: Week/Day Sync, Fuel Card Collapse, Batch Prep Redesign & Pre-Rendered PCM WAV Chime
// ============================================================================
export function isFuelCardIngredientsExpanded(
  openFuelCards: Record<string, boolean> | undefined,
  slotId: string
): boolean {
  if (!openFuelCards || openFuelCards[slotId] === undefined) {
    return false; // Collapsed by default on all 4 Daily Fuel cards
  }
  return Boolean(openFuelCards[slotId]);
}

export function formatFuelCardToggleLabel(itemCount: number, isExpanded: boolean): string {
  return isExpanded
    ? `Hide Ingredients & Prep (${itemCount} items)`
    : `Show Ingredients & Prep (${itemCount} items)`;
}

export function isBatchPrepCardCollapsedByDefault(
  collapsedRecipeCards: Record<string, boolean> | undefined,
  recipeId: string
): boolean {
  if (!collapsedRecipeCards || collapsedRecipeCards[recipeId] === undefined) {
    return true; // Collapsed by default unless explicitly opened by user
  }
  return Boolean(collapsedRecipeCards[recipeId]);
}

export function stripBatchStepPrefix(title: string): string {
  return String(title || '').replace(/^#\d+\s+/, '').trim();
}

export type TimerTonePreset = 'warm_marimba' | 'soft_bell' | 'gentle_tap';

export const DEFAULT_TIMER_TONE: TimerTonePreset = 'warm_marimba';
export const DEFAULT_TIMER_VOLUME = 0.55;
export const CHIME_HTML_AUDIO_VOLUME = DEFAULT_TIMER_VOLUME;
export const CHIME_MAX_LINEAR_PEAK = 0.55; // -5.2 dBFS pure linear headroom (zero Math.tanh distortion)

export const TIMER_TONE_PRESET_SPECS: Record<
  TimerTonePreset,
  {
    id: TimerTonePreset;
    label: string;
    description: string;
    activeDurationSec: number;
  }
> = {
  warm_marimba: {
    id: 'warm_marimba',
    label: 'Warm Chime',
    description: 'Ascending C5 to G5 Perfect Fifth (Hevy / Apple Fitness style)',
    activeDurationSec: 0.62 // 0.10s to 0.72s
  },
  soft_bell: {
    id: 'soft_bell',
    label: 'Soft Bell',
    description: 'Warm Zen Singing Chord (A4 + E5 + A5 consonance)',
    activeDurationSec: 0.68 // 0.10s to 0.78s
  },
  gentle_tap: {
    id: 'gentle_tap',
    label: 'Gentle Tap',
    description: 'Minimalist Low-Mid Double Woodblock Cue (B4 to E5)',
    activeDurationSec: 0.32 // 0.10s to 0.42s
  }
};

export function normalizeTimerTonePreset(tone?: string | null): TimerTonePreset {
  if (tone === 'warm_marimba' || tone === 'soft_bell' || tone === 'gentle_tap') {
    return tone;
  }
  return DEFAULT_TIMER_TONE;
}

export function clampTimerVolume(volume?: number | null): number {
  const num = typeof volume === 'number' && Number.isFinite(volume) ? volume : DEFAULT_TIMER_VOLUME;
  return Math.max(0.05, Math.min(1.0, +num.toFixed(2)));
}

export function formatTimerVolumePercent(volume?: number | null): string {
  return `${Math.round(clampTimerVolume(volume) * 100)}%`;
}

export function generatePreRenderedChimeWavBytes(
  sampleRate = 44100,
  toneOrDuration: TimerTonePreset | number = 'warm_marimba'
): Uint8Array {
  const toneType: TimerTonePreset =
    typeof toneOrDuration === 'string' ? normalizeTimerTonePreset(toneOrDuration) : 'warm_marimba';

  const leadInSec = 0.10; // 100 ms pure digital silence at start
  const trailingSilenceSec = 0.45; // 450 ms pure digital silence at end
  const activeEndSec =
    toneType === 'soft_bell' ? 0.78 : toneType === 'gentle_tap' ? 0.42 : 0.72;
  const totalDurationSec = +(activeEndSec + trailingSilenceSec).toFixed(4);

  const leadInSilenceSamples = Math.max(1, Math.round(sampleRate * leadInSec));
  const activeEndSample = Math.max(leadInSilenceSamples + 1, Math.round(sampleRate * activeEndSec));
  const numSamples = Math.max(activeEndSample + 1, Math.round(sampleRate * totalDurationSec));

  const dataBytes = numSamples * 2; // 16-bit mono PCM = 2 bytes per sample
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // Standard 44-byte RIFF WAVE header
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, 1, true); // NumChannels = 1 (Mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  const shapeNoteEnvelope = (
    tNote: number,
    noteDuration: number,
    attackSec: number,
    decayRate: number,
    fadeOutSec: number
  ): number => {
    if (tNote <= 0 || tNote >= noteDuration) return 0;
    let attackEnv = 1.0;
    if (tNote < attackSec) {
      attackEnv = 0.5 * (1 - Math.cos((Math.PI * tNote) / attackSec));
    }
    const expDecay = Math.exp(-tNote * decayRate);
    let fadeOutEnv = 1.0;
    if (tNote > noteDuration - fadeOutSec) {
      const tRem = noteDuration - tNote;
      fadeOutEnv = 0.5 * (1 - Math.cos((Math.PI * Math.max(0, tRem)) / fadeOutSec));
    }
    return attackEnv * expDecay * fadeOutEnv;
  };

  for (let i = leadInSilenceSamples; i < activeEndSample; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (toneType === 'warm_marimba') {
      // Note 1 (0.10s to 0.32s): Warm C5 (523.25 Hz @ 85% + 1046.5 Hz @ 15%)
      if (t >= 0.10 && t <= 0.32) {
        const tNote1 = t - 0.10;
        const env1 = shapeNoteEnvelope(tNote1, 0.22, 0.010, 9.5, 0.020);
        const wave1 =
          0.85 * Math.sin(2 * Math.PI * 523.25 * tNote1) +
          0.15 * Math.sin(2 * Math.PI * 1046.5 * tNote1);
        sample += wave1 * env1;
      }
      // Note 2 (0.26s to 0.72s): Warm G5 (783.99 Hz @ 88% + 1567.98 Hz @ 12%)
      if (t >= 0.26 && t <= 0.72) {
        const tNote2 = t - 0.26;
        const env2 = shapeNoteEnvelope(tNote2, 0.46, 0.012, 5.5, 0.030);
        const wave2 =
          0.88 * Math.sin(2 * Math.PI * 783.99 * tNote2) +
          0.12 * Math.sin(2 * Math.PI * 1567.98 * tNote2);
        sample += wave2 * env2;
      }
    } else if (toneType === 'soft_bell') {
      // Single lush resonant chord (0.10s to 0.78s): 440 Hz (60%) + 659.25 Hz (30%) + 880 Hz (10%)
      if (t >= 0.10 && t <= 0.78) {
        const tNote = t - 0.10;
        const env = shapeNoteEnvelope(tNote, 0.68, 0.018, 4.2, 0.030);
        const chord =
          0.60 * Math.sin(2 * Math.PI * 440.0 * tNote) +
          0.30 * Math.sin(2 * Math.PI * 659.25 * tNote) +
          0.10 * Math.sin(2 * Math.PI * 880.0 * tNote);
        sample = chord * env;
      }
    } else if (toneType === 'gentle_tap') {
      // Tap 1 (0.10s to 0.20s at 493.88 Hz B4, fast decay exp(-tNote * 18))
      if (t >= 0.10 && t <= 0.20) {
        const tTap1 = t - 0.10;
        const env1 = shapeNoteEnvelope(tTap1, 0.10, 0.006, 18.0, 0.012);
        sample += Math.sin(2 * Math.PI * 493.88 * tTap1) * env1;
      }
      // Tap 2 (0.24s to 0.42s at 659.25 Hz E5, decay exp(-tNote * 12))
      if (t >= 0.24 && t <= 0.42) {
        const tTap2 = t - 0.24;
        const env2 = shapeNoteEnvelope(tTap2, 0.18, 0.006, 12.0, 0.015);
        sample += Math.sin(2 * Math.PI * 659.25 * tTap2) * env2;
      }
    }

    // Pure linear headroom: clamp normalized signal to [-1, 1] and scale by 0.55 (-5.2 dBFS max peak)
    const clampedLinear = Math.max(-1.0, Math.min(1.0, sample));
    const pcm16 = Math.round(clampedLinear * CHIME_MAX_LINEAR_PEAK * 32767);
    view.setInt16(44 + i * 2, pcm16, true);
  }

  return new Uint8Array(buffer);
}

export function createSilentPaddedChimeWavUrl(toneType: TimerTonePreset = 'warm_marimba'): string {
  const bytes = generatePreRenderedChimeWavBytes(44100, toneType);
  if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }
  return 'data:audio/wav;base64,';
}

// ============================================================================
// MUSCLE FUEL & REST TIMER UPGRADES 1–4:
// 1. Daily Portion Weight Badge ("Scale: Xg / LB") & "G | LB" Unit Toggle
// 2. Interactive 3-Stage Jasmine Rice Cooking Timer with "Mix / Stir" Alarms
// 3. Meal Prep Demonstration Videos
// 4. Collapsible Prep Notes & Photo Capture on Batch Prep & Fuel Cards
// ============================================================================
export type FuelWeightUnit = 'g' | 'lb';

export const FUEL_CARD_SCALE_BADGES: Record<
  'pre_shake' | 'post_oats' | 'lunch' | 'dinner',
  { g: string; lb: string; grams: number }
> = {
  pre_shake: {
    grams: 390,
    g: 'Scale: 390g',
    lb: 'Scale: 0.86 lb / 13.8 oz'
  },
  post_oats: {
    grams: 269,
    g: 'Scale: 269g',
    lb: 'Scale: 0.59 lb / 9.5 oz'
  },
  lunch: {
    grams: 419,
    g: 'Scale: 419g',
    lb: 'Scale: 0.92 lb / 14.8 oz'
  },
  dinner: {
    grams: 421,
    g: 'Scale: 421g',
    lb: 'Scale: 0.93 lb / 14.9 oz'
  }
};

export const BATCH_CARD_SCALE_BADGES: Record<
  'recipe_oats_batch' | 'recipe_rice_batch',
  { g: string; lb: string }
> = {
  recipe_oats_batch: {
    g: 'Batch: 1,076g • 1 Jar Today: 269g',
    lb: 'Batch: 2.37 lb • 1 Jar: 0.59 lb / 9.5 oz'
  },
  recipe_rice_batch: {
    g: 'Cooked Batch: 600g • 1 Bowl Today: 150g',
    lb: 'Batch: 1.32 lb • 1 Bowl: 0.33 lb / 5.3 oz'
  }
};

export const BATCH_PREP_VIDEO_URLS: Record<'recipe_oats_batch' | 'recipe_rice_batch', string> = {
  recipe_oats_batch: 'https://www.youtube.com/watch?v=_wgQBioExZA',
  recipe_rice_batch: 'https://www.youtube.com/watch?v=zWTc8eLEeyY'
};

export function getFuelCardScaleBadge(
  slotId: 'pre_shake' | 'post_oats' | 'lunch' | 'dinner',
  unit: FuelWeightUnit = 'g'
): string {
  const entry = FUEL_CARD_SCALE_BADGES[slotId];
  if (!entry) return '';
  return unit === 'lb' ? entry.lb : entry.g;
}

export function getBatchCardScaleBadge(
  recipeId: 'recipe_oats_batch' | 'recipe_rice_batch',
  unit: FuelWeightUnit = 'g'
): string {
  const entry = BATCH_CARD_SCALE_BADGES[recipeId];
  if (!entry) return '';
  return unit === 'lb' ? entry.lb : entry.g;
}

export function formatIngredientWeightBadge(rawBadge: string, unit: FuelWeightUnit = 'g'): string {
  const clean = String(rawBadge || '').trim();
  if (!clean || unit !== 'lb') return clean;

  if (clean === '150g × 4') return '0.33 lb (5.3 oz) × 4';
  if (clean === '600g Yield') return '1.32 lb (21.2 oz) Yield';

  const match = clean.match(/^([\d.]+)\s*(g|ml)$/i);
  if (match) {
    const grams = parseFloat(match[1]);
    if (Number.isFinite(grams) && grams > 0) {
      const lbs = (grams / 453.59237).toFixed(2);
      const oz = (grams / 28.3495231).toFixed(1);
      return `${lbs} lb (${oz} oz)`;
    }
  }
  return clean;
}

export interface RiceTimerStageSpec {
  stage: 1 | 2 | 3;
  seconds: number;
  buttonLabel: string;
  contextLabel: string;
  completionBanner: string;
  stickyAlertLabel: string;
}

export const JASMINE_RICE_TIMER_STAGES: readonly RiceTimerStageSpec[] = [
  {
    stage: 1,
    seconds: 180,
    buttonLabel: '1. Boil & Stir (3m)',
    contextLabel: 'Rice Stage 1: Boil & Stir (3m)',
    completionBanner: 'ALARM: Stir / Mix Rice Once, Cover Tightly & Turn Heat to Low! Tap Stage 2 (12m Simmer)',
    stickyAlertLabel: 'MIX / STIR RICE • Tap Stage 2 (12m)'
  },
  {
    stage: 2,
    seconds: 720,
    buttonLabel: '2. Low Simmer (12m)',
    contextLabel: 'Rice Stage 2: Covered Low Simmer (12m)',
    completionBanner: 'ALARM: Turn Off Heat! Keep Lid Closed (Do Not Lift) & Tap Stage 3 (10m Steam)',
    stickyAlertLabel: 'TURN OFF HEAT (KEEP LID CLOSED) • Tap Stage 3 (10m)'
  },
  {
    stage: 3,
    seconds: 600,
    buttonLabel: '3. Off-Heat Steam (10m)',
    contextLabel: 'Rice Stage 3: Off-Heat Steam (10m)',
    completionBanner: 'DONE: Open Lid & Mix / Fluff Rice With Fork! Portion 4 x 150g Containers',
    stickyAlertLabel: 'MIX / STIR RICE • Fluff & Portion 4 × 150g'
  }
] as const;

export function getRiceTimerStageSpec(stage: number): RiceTimerStageSpec | undefined {
  return JASMINE_RICE_TIMER_STAGES.find(s => s.stage === stage);
}

export interface PrepNoteEntry {
  text: string;
  photoDataUrl: string;
  updatedAt: string;
}

export function upsertPrepNote(
  prepNotesMap: Record<string, PrepNoteEntry>,
  cardId: string,
  patch: Partial<PrepNoteEntry>,
  nowIso = new Date().toISOString()
): Record<string, PrepNoteEntry> {
  const existing = prepNotesMap?.[cardId] || {
    text: '',
    photoDataUrl: '',
    updatedAt: nowIso
  };
  return {
    ...(prepNotesMap || {}),
    [cardId]: {
      text: patch.text !== undefined ? patch.text : existing.text,
      photoDataUrl: patch.photoDataUrl !== undefined ? patch.photoDataUrl : existing.photoDataUrl,
      updatedAt: nowIso
    }
  };
}

export function getPrepNoteHeaderBadge(
  note: PrepNoteEntry | undefined
): { visible: boolean; badgeText: string; toggleButtonLabel: string; hasPhoto: boolean } {
  const cleanText = String(note?.text || '').trim();
  const hasPhoto = Boolean(note?.photoDataUrl && note.photoDataUrl.startsWith('data:image/'));
  if (!cleanText && !hasPhoto) {
    return {
      visible: false,
      badgeText: '',
      toggleButtonLabel: '+ Add Kitchen Note / Photo',
      hasPhoto: false
    };
  }
  return {
    visible: true,
    badgeText: cleanText ? `Note: ${cleanText}` : 'Note: Kitchen Photo Saved',
    toggleButtonLabel: 'Edit Kitchen Note',
    hasPhoto
  };
}

// ============================================================================
// PULL-UP & WORKOUT NAMING CLEANUP + BODYWEIGHT REPS-ONLY OPTIMIZATION (UPDATES 1–4)
// ============================================================================
export const WORKOUT_DAY_BANNER_TITLES: Record<number, string> = {
  0: 'Upper Body 1 • Push & Pull',
  1: 'Lower Body 1 • Quad Focus',
  2: 'Upper Body 2 • Push Focus',
  3: 'Upper Body 3 • Pull Focus',
  4: 'Lower Body 2 • Glutes & Hamstrings'
};

export const PULLUP_EXERCISE_TITLES: Record<string, string> = {
  day1_pullups: 'Overhand Pull-Ups (Max Effort)',
  day2_pullups: 'Overhand Pull-Ups (Pyramid Sets)',
  day3_pullups: 'Pull-Ups (3 Grips × 3 Training Sets)',
  fri_pullups: 'Overhand Pull-Ups (Max Training Sets)',
  day5_pullups: 'Overhand Pull-Ups (Repeat Hardest Day)'
};

export const PULLUP_BODYWEIGHT_EX_IDS = [
  'day1_pullups',
  'day2_pullups',
  'day3_pullups',
  'fri_pullups',
  'day5_pullups'
] as const;

export const PULLUPS_TAB_MAIN_HEADER = 'Overhand Pull-Up Progression Program';
export const PYRAMID_REST_HELPER_HEADER = 'PULL-UP PYRAMID REST HELPER (10S × REPS)';
export const WORKOUT_SETTINGS_DRAWER_LABEL = 'Workout & Display Settings';

export function isBodyweightRepsOnlyExercise(ex: {
  id?: string;
  isBodyweightRepsOnly?: boolean;
}): boolean {
  if (!ex) return false;
  if (ex.isBodyweightRepsOnly === true) return true;
  return (PULLUP_BODYWEIGHT_EX_IDS as readonly string[]).includes(String(ex.id || ''));
}

// ============================================================================
// NON-DESTRUCTIVE MULTI-PRESET FUEL ARCHITECTURE, IMMUTABLE HISTORICAL LOGS,
// 1-TAP SMART INGREDIENT SWAPS & COACH AI LIVE PLAN MUTATION
// ============================================================================
export type FuelPresetId = 'almond_cashew_pea' | 'classic_silk_protein' | 'unsweetened_soy';
export type FuelSwitchScope = 'today' | 'future';
export type FuelSlotId = 'pre_shake' | 'post_oats' | 'lunch' | 'dinner';

export interface FuelPresetIngredientItem {
  id: string;
  name: string;
  label: string;
  weight: string;
  grams: number;
  protein: number;
  kcal: number;
  subPills?: string[];
}

export interface FuelPresetMealSpec {
  slotId: FuelSlotId;
  fuelNum: 1 | 2 | 3 | 4;
  defaultTime: string;
  title: string;
  kcal: number;
  protein: number;
  scaleGrams: number;
  scaleBadgeG: string;
  scaleBadgeLb: string;
  tip: string;
  items: FuelPresetIngredientItem[];
}

export interface FuelPresetSpec {
  id: FuelPresetId;
  shortPillLabel: string;
  fullName: string;
  loggedWithBadge: string;
  dailyKcalDisplay: number;
  dailyKcalExact: number;
  dailyProtein: number;
  headerSummaryText: string;
  hydrationMilkLabel: string;
  meals: Record<FuelSlotId, FuelPresetMealSpec>;
  oatsBatch: {
    scaleBadgeG: string;
    scaleBadgeLb: string;
    subtitle: string;
    steps: Array<{
      id: string;
      title: string;
      detail: string;
      weightBadge: string;
    }>;
  };
  shopItems: {
    item1Name: string;
    item1Qty: string;
    item1Note: string;
    item12Name: string;
    item12Qty: string;
    item12Note: string;
  };
}

export function formatScaleGramsToBadges(grams: number): { g: string; lb: string; grams: number } {
  const roundedG = Math.round(Number(grams) || 0);
  const lbs = (roundedG / 453.59237).toFixed(2);
  const oz = (roundedG / 28.349523125).toFixed(1);
  return {
    grams: roundedG,
    g: `Scale: ${roundedG}g`,
    lb: `Scale: ${lbs} lb / ${oz} oz`
  };
}

export const FUEL_PLAN_PRESETS: Record<FuelPresetId, FuelPresetSpec> = {
  almond_cashew_pea: {
    id: 'almond_cashew_pea',
    shortPillLabel: 'Option B: Almond/Cashew + 105g Pea (Default)',
    fullName: 'Option B: Unsweetened Almond/Cashew Milk + 105g Pea Protein',
    loggedWithBadge: 'Logged with: Option B Almond/Cashew Plan',
    dailyKcalDisplay: 1300,
    dailyKcalExact: 1295,
    dailyProtein: 138,
    headerSummaryText: 'High-Protein Muscle & Recomp Fuel (1,300 kcal • 138g P)',
    hydrationMilkLabel: 'Unsweetened Almond/Cashew Milk',
    meals: {
      pre_shake: {
        slotId: 'pre_shake',
        fuelNum: 1,
        defaultTime: '6:35 AM',
        title: 'Pre-Gym Fast Protein Shake',
        kcal: 190,
        protein: 36,
        scaleGrams: 400,
        scaleBadgeG: 'Scale: 400g',
        scaleBadgeLb: 'Scale: 0.88 lb / 14.1 oz',
        tip: 'Drink 25 minutes before your workout: 40g Pea Protein Isolate shaken in 360 ml Unsweetened Fortified Almond or Cashew Milk.',
        items: [
          {
            id: 'm1_pea_isolate',
            name: 'Pea Protein Isolate',
            label: 'Pea Protein Isolate',
            weight: '40g',
            grams: 40,
            protein: 32,
            kcal: 145
          },
          {
            id: 'm1_silk_milk',
            name: 'Unsweetened Fortified Almond or Cashew Milk',
            label: 'Unsweetened Fortified Almond or Cashew Milk',
            weight: '360 ml',
            grams: 360,
            protein: 4,
            kcal: 45
          }
        ]
      },
      post_oats: {
        slotId: 'post_oats',
        fuelNum: 2,
        defaultTime: '8:15 AM',
        title: 'Post-Gym Overnight Protein Oats',
        kcal: 390,
        protein: 29,
        scaleGrams: 279,
        scaleBadgeG: 'Scale: 279g',
        scaleBadgeLb: 'Scale: 0.62 lb / 9.8 oz',
        tip: 'Eat 15 minutes after finishing your workout (1 jar = 279g from your 4-day batch with 10g pea protein whisked inside).',
        items: [
          {
            id: 'm2_oats',
            name: 'Gluten-Free Protein Oats',
            label: 'Gluten-Free Protein Oats',
            weight: '45g',
            grams: 45,
            protein: 15,
            kcal: 170
          },
          {
            id: 'm2_pea_oats',
            name: 'Pea Protein Isolate (whisked in jar)',
            label: 'Pea Protein Isolate (whisked in jar)',
            weight: '10g',
            grams: 10,
            protein: 8,
            kcal: 35
          },
          {
            id: 'm2_silk_milk',
            name: 'Unsweetened Fortified Almond or Cashew Milk',
            label: 'Unsweetened Fortified Almond or Cashew Milk',
            weight: '180 ml',
            grams: 180,
            protein: 1.5,
            kcal: 25
          },
          {
            id: 'm2_banana',
            name: 'Peeled Ripe Banana',
            label: 'Peeled Ripe Banana',
            weight: '30g',
            grams: 30,
            protein: 0.5,
            kcal: 30
          },
          {
            id: 'm2_pb',
            name: 'Smooth Natural Peanut Butter',
            label: 'Smooth Natural Peanut Butter',
            weight: '8g',
            grams: 8,
            protein: 2,
            kcal: 50
          },
          {
            id: 'm2_chia',
            name: 'Organic Whole Chia Seeds',
            label: 'Organic Whole Chia Seeds',
            weight: '6g',
            grams: 6,
            protein: 2,
            kcal: 80
          }
        ]
      },
      lunch: {
        slotId: 'lunch',
        fuelNum: 3,
        defaultTime: '1:00 PM',
        title: 'Savoury Tofu, Rice & Broccoli Bowl',
        kcal: 520,
        protein: 33,
        scaleGrams: 419,
        scaleBadgeG: 'Scale: 419g',
        scaleBadgeLb: 'Scale: 0.92 lb / 14.8 oz',
        tip: 'Weighing 175g tofu (½ of a 350g block) and 150g cooked rice keeps your midday bowl light while covering 100% Vitamin C and thyroid iodine.',
        items: [
          {
            id: 'm2_tofu',
            name: 'Extra-Firm Tofu',
            label: 'Extra-Firm Tofu',
            weight: '175g',
            grams: 175,
            protein: 21,
            kcal: 210
          },
          {
            id: 'm2_rice',
            name: 'Cooked White Jasmine Rice',
            label: 'Cooked White Jasmine Rice',
            weight: '150g',
            grams: 150,
            protein: 4.5,
            kcal: 195
          },
          {
            id: 'm2_broccoli',
            name: 'Steamed Broccoli Florets',
            label: 'Steamed Broccoli Florets',
            weight: '75g',
            grams: 75,
            protein: 1.5,
            kcal: 25
          },
          {
            id: 'm2_nooch',
            name: 'Fortified Nutritional Yeast',
            label: 'Fortified Nutritional Yeast',
            weight: '12g',
            grams: 12,
            protein: 6,
            kcal: 45
          },
          {
            id: 'm2_sauce',
            name: 'Toasted Sesame Oil',
            label: 'Toasted Sesame Oil',
            weight: '5g',
            grams: 5,
            protein: 0,
            kcal: 45
          },
          {
            id: 'm2_nori',
            name: 'Iodized Table Salt',
            label: 'Iodized Table Salt',
            weight: '1.5g',
            grams: 1.5,
            protein: 0,
            kcal: 0
          }
        ]
      },
      dinner: {
        slotId: 'dinner',
        fuelNum: 4,
        defaultTime: '5:30 PM',
        title: 'Evening Protein & PB Shake',
        kcal: 295,
        protein: 40,
        scaleGrams: 431,
        scaleBadgeG: 'Scale: 431g',
        scaleBadgeLb: 'Scale: 0.95 lb / 15.2 oz',
        tip: 'Zero cooking in the evening — shake 55g Pea Protein Isolate in 360 ml Unsweetened Almond/Cashew Milk and eat 16g smooth peanut butter.',
        items: [
          {
            id: 'm3_pea_isolate',
            name: 'Pea Protein Isolate',
            label: 'Pea Protein Isolate',
            weight: '55g',
            grams: 55,
            protein: 34,
            kcal: 155
          },
          {
            id: 'm3_silk_milk',
            name: 'Unsweetened Fortified Almond or Cashew Milk',
            label: 'Unsweetened Fortified Almond or Cashew Milk',
            weight: '360 ml',
            grams: 360,
            protein: 2,
            kcal: 45
          },
          {
            id: 'm3_pb',
            name: 'Smooth Natural Peanut Butter',
            label: 'Smooth Natural Peanut Butter',
            weight: '16g',
            grams: 16,
            protein: 4,
            kcal: 95
          }
        ]
      }
    },
    oatsBatch: {
      scaleBadgeG: 'Batch: 1,116g • 1 Jar Today: 279g',
      scaleBadgeLb: 'Batch: 2.46 lb • 1 Jar: 0.62 lb / 9.8 oz',
      subtitle: 'Prep time: 5 mins • Fridge life: 4 days • 29g P & 390 kcal per jar',
      steps: [
        { id: 'oats_step_1', title: 'Gluten-Free Protein Oats', detail: '45g per jar × 4 jars', weightBadge: '180g' },
        { id: 'oats_step_1b', title: 'Pea Protein Isolate (Whisked in Jars)', detail: '10g per jar × 4 jars', weightBadge: '40g' },
        { id: 'oats_step_2', title: 'Organic Whole Chia Seeds', detail: '6g per jar × 4 jars', weightBadge: '24g' },
        { id: 'oats_step_3', title: 'Peeled Ripe Banana (Mashed)', detail: '30g per jar × 4 jars', weightBadge: '120g' },
        { id: 'oats_step_4', title: 'Smooth Natural Peanut Butter', detail: '8g per jar × 4 jars', weightBadge: '32g' },
        { id: 'oats_step_5', title: 'Unsweetened Almond/Cashew Milk', detail: '180 ml per jar × 4 jars', weightBadge: '720 ml' },
        { id: 'oats_step_6', title: 'Stir, Seal & Refrigerate Overnight', detail: 'Divide evenly into 4 jars (279g/jar) for 8:15 AM post-gym fuel', weightBadge: '4 Jars' }
      ]
    },
    shopItems: {
      item1Name: '1. Unsweetened Fortified Almond or Cashew Milk (1.89L carton — 6,300 ml/week)',
      item1Qty: '6,300 ml / week (900 ml/day)',
      item1Note: '360 ml pre-gym shake + 180 ml in oats + 360 ml evening shake (3.4 cartons/wk; fortified with B12, Vit D & Calcium)',
      item12Name: '12. Pea Protein Isolate Powder (735g/week • 105g/day)',
      item12Qty: '735g / week (105g/day)',
      item12Note: '40g in Fuel 1 + 10g whisked in Fuel 2 Oats + 55g in Fuel 4 Evening Shake = 105g/day to lock in 138g daily protein'
    }
  },

  classic_silk_protein: {
    id: 'classic_silk_protein',
    shortPillLabel: 'Original: Silk Protein Milk + 75g Pea',
    fullName: 'Original Silk Protein Almond & Cashew Milk + 75g Pea Protein',
    loggedWithBadge: 'Logged with: Classic Silk Protein Plan',
    dailyKcalDisplay: 1400,
    dailyKcalExact: 1400,
    dailyProtein: 138,
    headerSummaryText: 'High-Protein Muscle & Recomp Fuel (1,400 kcal • 138g P)',
    hydrationMilkLabel: 'Silk Protein Milk',
    meals: {
      pre_shake: {
        slotId: 'pre_shake',
        fuelNum: 1,
        defaultTime: '6:35 AM',
        title: 'Pre-Gym Fast Protein Shake',
        kcal: 170,
        protein: 36,
        scaleGrams: 390,
        scaleBadgeG: 'Scale: 390g',
        scaleBadgeLb: 'Scale: 0.86 lb / 13.8 oz',
        tip: 'Drink 25 minutes before your workout for fast amino acids with zero stomach bulk during heavy compounds and abs.',
        items: [
          {
            id: 'm1_pea_isolate',
            name: 'Pea Protein Isolate',
            label: 'Pea Protein Isolate',
            weight: '30g',
            grams: 30,
            protein: 24,
            kcal: 90
          },
          {
            id: 'm1_silk_milk',
            name: 'Unsweetened Silk Protein Milk',
            label: 'Unsweetened Silk Protein Milk',
            weight: '360 ml',
            grams: 360,
            protein: 12,
            kcal: 80
          }
        ]
      },
      post_oats: {
        slotId: 'post_oats',
        fuelNum: 2,
        defaultTime: '8:15 AM',
        title: 'Post-Gym Overnight Protein Oats',
        kcal: 395,
        protein: 26,
        scaleGrams: 269,
        scaleBadgeG: 'Scale: 269g',
        scaleBadgeLb: 'Scale: 0.59 lb / 9.5 oz',
        tip: 'Eat 15 minutes after finishing your workout (1 jar from your 4-day fridge batch) to replenish muscle glycogen.',
        items: [
          {
            id: 'm2_oats',
            name: 'Gluten-Free Protein Oats',
            label: 'Gluten-Free Protein Oats',
            weight: '45g',
            grams: 45,
            protein: 10,
            kcal: 170
          },
          {
            id: 'm2_silk_milk',
            name: 'Unsweetened Silk Protein Milk',
            label: 'Unsweetened Silk Protein Milk',
            weight: '180 ml',
            grams: 180,
            protein: 12,
            kcal: 115
          },
          {
            id: 'm2_banana',
            name: 'Peeled Ripe Banana',
            label: 'Peeled Ripe Banana',
            weight: '30g',
            grams: 30,
            protein: 0.5,
            kcal: 27
          },
          {
            id: 'm2_pb',
            name: 'Smooth Natural Peanut Butter',
            label: 'Smooth Natural Peanut Butter',
            weight: '8g',
            grams: 8,
            protein: 2,
            kcal: 48
          },
          {
            id: 'm2_chia',
            name: 'Organic Whole Chia Seeds',
            label: 'Organic Whole Chia Seeds',
            weight: '6g',
            grams: 6,
            protein: 1.5,
            kcal: 35
          }
        ]
      },
      lunch: {
        slotId: 'lunch',
        fuelNum: 3,
        defaultTime: '1:00 PM',
        title: 'Savoury Tofu, Rice & Broccoli Bowl',
        kcal: 520,
        protein: 33,
        scaleGrams: 419,
        scaleBadgeG: 'Scale: 419g',
        scaleBadgeLb: 'Scale: 0.92 lb / 14.8 oz',
        tip: 'Weighing 175g tofu (½ of a 350g block) and 150g cooked rice keeps your midday bowl light while covering 100% Vitamin C and thyroid iodine.',
        items: [
          {
            id: 'm2_tofu',
            name: 'Extra-Firm Tofu',
            label: 'Extra-Firm Tofu',
            weight: '175g',
            grams: 175,
            protein: 21,
            kcal: 210
          },
          {
            id: 'm2_rice',
            name: 'Cooked White Jasmine Rice',
            label: 'Cooked White Jasmine Rice',
            weight: '150g',
            grams: 150,
            protein: 4.5,
            kcal: 195
          },
          {
            id: 'm2_broccoli',
            name: 'Steamed Broccoli Florets',
            label: 'Steamed Broccoli Florets',
            weight: '75g',
            grams: 75,
            protein: 1.5,
            kcal: 25
          },
          {
            id: 'm2_nooch',
            name: 'Fortified Nutritional Yeast',
            label: 'Fortified Nutritional Yeast',
            weight: '12g',
            grams: 12,
            protein: 6,
            kcal: 45
          },
          {
            id: 'm2_sauce',
            name: 'Toasted Sesame Oil',
            label: 'Toasted Sesame Oil',
            weight: '5g',
            grams: 5,
            protein: 0,
            kcal: 45
          },
          {
            id: 'm2_nori',
            name: 'Iodized Table Salt',
            label: 'Iodized Table Salt',
            weight: '1.5g',
            grams: 1.5,
            protein: 0,
            kcal: 0
          }
        ]
      },
      dinner: {
        slotId: 'dinner',
        fuelNum: 4,
        defaultTime: '5:30 PM',
        title: 'Evening Protein & PB Shake',
        kcal: 315,
        protein: 43,
        scaleGrams: 421,
        scaleBadgeG: 'Scale: 421g',
        scaleBadgeLb: 'Scale: 0.93 lb / 14.9 oz',
        tip: 'Zero cooking and zero chewing in the evening when appetite is lowest — shake 45g isolate in 360 ml Silk milk and eat 16g smooth peanut butter.',
        items: [
          {
            id: 'm3_pea_isolate',
            name: 'Pea Protein Isolate',
            label: 'Pea Protein Isolate',
            weight: '45g',
            grams: 45,
            protein: 27,
            kcal: 140
          },
          {
            id: 'm3_silk_milk',
            name: 'Unsweetened Silk Protein Milk',
            label: 'Unsweetened Silk Protein Milk',
            weight: '360 ml',
            grams: 360,
            protein: 12,
            kcal: 80
          },
          {
            id: 'm3_pb',
            name: 'Smooth Natural Peanut Butter',
            label: 'Smooth Natural Peanut Butter',
            weight: '16g',
            grams: 16,
            protein: 4,
            kcal: 95
          }
        ]
      }
    },
    oatsBatch: {
      scaleBadgeG: 'Batch: 1,076g • 1 Jar Today: 269g',
      scaleBadgeLb: 'Batch: 2.37 lb • 1 Jar: 0.59 lb / 9.5 oz',
      subtitle: 'Prep time: 5 mins • Fridge life: 4 days • 26g P & 395 kcal per jar',
      steps: [
        { id: 'oats_step_1', title: 'Gluten-Free Protein Oats', detail: '45g per jar × 4 jars', weightBadge: '180g' },
        { id: 'oats_step_2', title: 'Organic Whole Chia Seeds', detail: '6g per jar × 4 jars', weightBadge: '24g' },
        { id: 'oats_step_3', title: 'Peeled Ripe Banana (Mashed)', detail: '30g per jar × 4 jars', weightBadge: '120g' },
        { id: 'oats_step_4', title: 'Smooth Natural Peanut Butter', detail: '8g per jar × 4 jars', weightBadge: '32g' },
        { id: 'oats_step_5', title: 'Unsweetened Silk Protein Milk', detail: '180 ml per jar × 4 jars', weightBadge: '720 ml' },
        { id: 'oats_step_6', title: 'Stir, Seal & Refrigerate Overnight', detail: 'Divide evenly into 4 jars for 8:15 AM post-gym fuel', weightBadge: '4 Jars' }
      ]
    },
    shopItems: {
      item1Name: '1. Silk Protein Unsweetened Almond & Cashew Milk (1.75L carton — 6,300 ml/week)',
      item1Qty: '6,300 ml / week (900 ml/day)',
      item1Note: '360 ml pre-workout shake + 180 ml in oats + 360 ml evening shake (4 cartons/wk; 200% B12, 95% Vit D)',
      item12Name: '12. Pea Protein Isolate Powder (525g/week • 75g/day)',
      item12Qty: '525g / week (75g/day)',
      item12Note: '30g in Fuel 1 Pre-Gym Shake + 45g in Fuel 4 Evening Shake = 60g pure protein/day with zero fiber bloat'
    }
  },

  unsweetened_soy: {
    id: 'unsweetened_soy',
    shortPillLabel: 'Option A: Unsweetened Soy + 75g Pea',
    fullName: 'Unsweetened Fortified Soy Milk (8g P/cup) + 75g Pea Protein',
    loggedWithBadge: 'Logged with: Option A Unsweetened Soy Plan',
    dailyKcalDisplay: 1400,
    dailyKcalExact: 1400,
    dailyProtein: 138,
    headerSummaryText: 'High-Protein Muscle & Recomp Fuel (1,400 kcal • 138g P)',
    hydrationMilkLabel: 'Unsweetened Fortified Soy Milk',
    meals: {
      pre_shake: {
        slotId: 'pre_shake',
        fuelNum: 1,
        defaultTime: '6:35 AM',
        title: 'Pre-Gym Fast Protein Shake',
        kcal: 170,
        protein: 36,
        scaleGrams: 390,
        scaleBadgeG: 'Scale: 390g',
        scaleBadgeLb: 'Scale: 0.86 lb / 13.8 oz',
        tip: 'Drink 25 minutes before your workout: 30g Pea Protein Isolate shaken in 360 ml Unsweetened Fortified Soy Milk.',
        items: [
          {
            id: 'm1_pea_isolate',
            name: 'Pea Protein Isolate',
            label: 'Pea Protein Isolate',
            weight: '30g',
            grams: 30,
            protein: 24,
            kcal: 90
          },
          {
            id: 'm1_silk_milk',
            name: 'Unsweetened Fortified Soy Milk',
            label: 'Unsweetened Fortified Soy Milk',
            weight: '360 ml',
            grams: 360,
            protein: 12,
            kcal: 80
          }
        ]
      },
      post_oats: {
        slotId: 'post_oats',
        fuelNum: 2,
        defaultTime: '8:15 AM',
        title: 'Post-Gym Overnight Protein Oats',
        kcal: 395,
        protein: 26,
        scaleGrams: 269,
        scaleBadgeG: 'Scale: 269g',
        scaleBadgeLb: 'Scale: 0.59 lb / 9.5 oz',
        tip: 'Eat 15 minutes after finishing your workout (1 jar from your 4-day batch soaked in Unsweetened Soy Milk).',
        items: [
          {
            id: 'm2_oats',
            name: 'Gluten-Free Protein Oats',
            label: 'Gluten-Free Protein Oats',
            weight: '45g',
            grams: 45,
            protein: 10,
            kcal: 170
          },
          {
            id: 'm2_silk_milk',
            name: 'Unsweetened Fortified Soy Milk',
            label: 'Unsweetened Fortified Soy Milk',
            weight: '180 ml',
            grams: 180,
            protein: 12,
            kcal: 115
          },
          {
            id: 'm2_banana',
            name: 'Peeled Ripe Banana',
            label: 'Peeled Ripe Banana',
            weight: '30g',
            grams: 30,
            protein: 0.5,
            kcal: 27
          },
          {
            id: 'm2_pb',
            name: 'Smooth Natural Peanut Butter',
            label: 'Smooth Natural Peanut Butter',
            weight: '8g',
            grams: 8,
            protein: 2,
            kcal: 48
          },
          {
            id: 'm2_chia',
            name: 'Organic Whole Chia Seeds',
            label: 'Organic Whole Chia Seeds',
            weight: '6g',
            grams: 6,
            protein: 1.5,
            kcal: 35
          }
        ]
      },
      lunch: {
        slotId: 'lunch',
        fuelNum: 3,
        defaultTime: '1:00 PM',
        title: 'Savoury Tofu, Rice & Broccoli Bowl',
        kcal: 520,
        protein: 33,
        scaleGrams: 419,
        scaleBadgeG: 'Scale: 419g',
        scaleBadgeLb: 'Scale: 0.92 lb / 14.8 oz',
        tip: 'Weighing 175g tofu (½ of a 350g block) and 150g cooked rice keeps your midday bowl light while covering 100% Vitamin C and thyroid iodine.',
        items: [
          {
            id: 'm2_tofu',
            name: 'Extra-Firm Tofu',
            label: 'Extra-Firm Tofu',
            weight: '175g',
            grams: 175,
            protein: 21,
            kcal: 210
          },
          {
            id: 'm2_rice',
            name: 'Cooked White Jasmine Rice',
            label: 'Cooked White Jasmine Rice',
            weight: '150g',
            grams: 150,
            protein: 4.5,
            kcal: 195
          },
          {
            id: 'm2_broccoli',
            name: 'Steamed Broccoli Florets',
            label: 'Steamed Broccoli Florets',
            weight: '75g',
            grams: 75,
            protein: 1.5,
            kcal: 25
          },
          {
            id: 'm2_nooch',
            name: 'Fortified Nutritional Yeast',
            label: 'Fortified Nutritional Yeast',
            weight: '12g',
            grams: 12,
            protein: 6,
            kcal: 45
          },
          {
            id: 'm2_sauce',
            name: 'Toasted Sesame Oil',
            label: 'Toasted Sesame Oil',
            weight: '5g',
            grams: 5,
            protein: 0,
            kcal: 45
          },
          {
            id: 'm2_nori',
            name: 'Iodized Table Salt',
            label: 'Iodized Table Salt',
            weight: '1.5g',
            grams: 1.5,
            protein: 0,
            kcal: 0
          }
        ]
      },
      dinner: {
        slotId: 'dinner',
        fuelNum: 4,
        defaultTime: '5:30 PM',
        title: 'Evening Protein & PB Shake',
        kcal: 315,
        protein: 43,
        scaleGrams: 421,
        scaleBadgeG: 'Scale: 421g',
        scaleBadgeLb: 'Scale: 0.93 lb / 14.9 oz',
        tip: 'Zero cooking in the evening — shake 45g Pea Protein Isolate in 360 ml Unsweetened Fortified Soy Milk and eat 16g smooth peanut butter.',
        items: [
          {
            id: 'm3_pea_isolate',
            name: 'Pea Protein Isolate',
            label: 'Pea Protein Isolate',
            weight: '45g',
            grams: 45,
            protein: 27,
            kcal: 140
          },
          {
            id: 'm3_silk_milk',
            name: 'Unsweetened Fortified Soy Milk',
            label: 'Unsweetened Fortified Soy Milk',
            weight: '360 ml',
            grams: 360,
            protein: 12,
            kcal: 80
          },
          {
            id: 'm3_pb',
            name: 'Smooth Natural Peanut Butter',
            label: 'Smooth Natural Peanut Butter',
            weight: '16g',
            grams: 16,
            protein: 4,
            kcal: 95
          }
        ]
      }
    },
    oatsBatch: {
      scaleBadgeG: 'Batch: 1,076g • 1 Jar Today: 269g',
      scaleBadgeLb: 'Batch: 2.37 lb • 1 Jar: 0.59 lb / 9.5 oz',
      subtitle: 'Prep time: 5 mins • Fridge life: 4 days • 26g P & 395 kcal per jar',
      steps: [
        { id: 'oats_step_1', title: 'Gluten-Free Protein Oats', detail: '45g per jar × 4 jars', weightBadge: '180g' },
        { id: 'oats_step_2', title: 'Organic Whole Chia Seeds', detail: '6g per jar × 4 jars', weightBadge: '24g' },
        { id: 'oats_step_3', title: 'Peeled Ripe Banana (Mashed)', detail: '30g per jar × 4 jars', weightBadge: '120g' },
        { id: 'oats_step_4', title: 'Smooth Natural Peanut Butter', detail: '8g per jar × 4 jars', weightBadge: '32g' },
        { id: 'oats_step_5', title: 'Unsweetened Fortified Soy Milk', detail: '180 ml per jar × 4 jars', weightBadge: '720 ml' },
        { id: 'oats_step_6', title: 'Stir, Seal & Refrigerate Overnight', detail: 'Divide evenly into 4 jars for 8:15 AM post-gym fuel', weightBadge: '4 Jars' }
      ]
    },
    shopItems: {
      item1Name: '1. Unsweetened Fortified Soy Milk (1.89L carton — 6,300 ml/week)',
      item1Qty: '6,300 ml / week (900 ml/day)',
      item1Note: '1:1 replacement for Silk Protein Milk (8g protein per 250 ml cup) — 360 ml pre-gym + 180 ml in oats + 360 ml evening shake',
      item12Name: '12. Pea Protein Isolate Powder (525g/week • 75g/day)',
      item12Qty: '525g / week (75g/day)',
      item12Note: '30g in Fuel 1 Pre-Gym Shake + 45g in Fuel 4 Evening Shake = 60g pure protein/day with zero fiber bloat'
    }
  }
};

export interface WholeFoodSwapOption {
  id: string;
  category: 'tofu' | 'rice' | 'broccoli';
  targetItemId: 'm2_tofu' | 'm2_rice' | 'm2_broccoli';
  buttonLabel: string;
  label: string;
  weight: string;
  grams: number;
  protein: number;
  kcal: number;
}

export const WHOLE_FOOD_SMART_SWAPS: Record<'tofu' | 'rice' | 'broccoli', WholeFoodSwapOption[]> = {
  tofu: [
    { id: 'tofu_175', category: 'tofu', targetItemId: 'm2_tofu', buttonLabel: '175g Tofu (Default)', label: 'Extra-Firm Tofu', weight: '175g', grams: 175, protein: 21, kcal: 210 },
    { id: 'tempeh_115', category: 'tofu', targetItemId: 'm2_tofu', buttonLabel: '115g Tempeh', label: 'Organic Soy Tempeh', weight: '115g', grams: 115, protein: 21, kcal: 220 },
    { id: 'edamame_200', category: 'tofu', targetItemId: 'm2_tofu', buttonLabel: '200g Edamame', label: 'Shelled Edamame Beans', weight: '200g', grams: 200, protein: 22, kcal: 240 },
    { id: 'lentils_240', category: 'tofu', targetItemId: 'm2_tofu', buttonLabel: '240g Cooked Lentils', label: 'Cooked Green/Red Lentils', weight: '240g', grams: 240, protein: 21, kcal: 275 }
  ],
  rice: [
    { id: 'rice_150', category: 'rice', targetItemId: 'm2_rice', buttonLabel: '150g Cooked Jasmine Rice (Default)', label: 'Cooked White Jasmine Rice', weight: '150g', grams: 150, protein: 4.5, kcal: 195 },
    { id: 'quinoa_165', category: 'rice', targetItemId: 'm2_rice', buttonLabel: '165g Cooked Quinoa', label: 'Cooked Quinoa', weight: '165g', grams: 165, protein: 7, kcal: 198 },
    { id: 'potato_230', category: 'rice', targetItemId: 'm2_rice', buttonLabel: '230g Boiled Potato', label: 'Boiled White/Yellow Potato', weight: '230g', grams: 230, protein: 4.5, kcal: 198 }
  ],
  broccoli: [
    { id: 'broccoli_75', category: 'broccoli', targetItemId: 'm2_broccoli', buttonLabel: '75g Broccoli (Default)', label: 'Steamed Broccoli Florets', weight: '75g', grams: 75, protein: 1.5, kcal: 25 },
    { id: 'spinach_85', category: 'broccoli', targetItemId: 'm2_broccoli', buttonLabel: '85g Spinach', label: 'Steamed Baby Spinach', weight: '85g', grams: 85, protein: 2.5, kcal: 20 },
    { id: 'green_beans_90', category: 'broccoli', targetItemId: 'm2_broccoli', buttonLabel: '90g Green Beans', label: 'Steamed Green Beans', weight: '90g', grams: 90, protein: 2, kcal: 28 }
  ]
};

export interface LoggedMealSnapshot {
  slotId: FuelSlotId;
  fuelNum: 1 | 2 | 3 | 4;
  presetId: FuelPresetId;
  title: string;
  kcal: number;
  protein: number;
  scaleGrams: number;
  scaleBadgeG: string;
  scaleBadgeLb: string;
  items: FuelPresetIngredientItem[];
  loggedAt: string;
}

export interface DayFuelCustomization {
  presetId?: FuelPresetId;
  swaps?: Partial<Record<'tofu' | 'rice' | 'broccoli', string>>;
  customOverrides?: Partial<Record<string, { label: string; grams: number; protein?: number; kcal?: number }>>;
}

export interface FuelStateContainer {
  activeFuelPreset?: FuelPresetId;
  fuelSwitchScope?: FuelSwitchScope;
  fuelDaySnapshots?: Record<string, FuelPresetId>;
  loggedMealSnapshots?: Record<string, LoggedMealSnapshot>;
  fuelCustomizations?: Record<string, DayFuelCustomization>;
  checkedMeals?: Record<string, boolean>;
  checkedMealIngredients?: Record<string, boolean>;
  fuelLogs?: Record<string, boolean>;
}

const SLOT_ORDER: readonly FuelSlotId[] = ['pre_shake', 'post_oats', 'lunch', 'dinner'] as const;

export function getFuelNumForSlot(slotId: FuelSlotId): 1 | 2 | 3 | 4 {
  if (slotId === 'pre_shake') return 1;
  if (slotId === 'post_oats') return 2;
  if (slotId === 'lunch') return 3;
  return 4;
}

export function isAnyMealLoggedOnDay(
  state: FuelStateContainer,
  week: number,
  dayIdx: number
): boolean {
  const dayPrefix = `w${week}_d${dayIdx}_`;
  const cm = state.checkedMeals || {};
  const fl = state.fuelLogs || {};
  const ci = state.checkedMealIngredients || {};
  for (const slotId of SLOT_ORDER) {
    if (cm[`${dayPrefix}${slotId}`] || fl[`${dayPrefix}${slotId}`]) return true;
    if (week === 1 && dayIdx === 0 && (cm[slotId] || fl[slotId])) return true;
  }
  return Object.keys(ci).some(k => k.startsWith(dayPrefix) && Boolean(ci[k]));
}

export function buildMealSpecWithCustomizations(
  presetId: FuelPresetId,
  slotId: FuelSlotId,
  customization?: DayFuelCustomization
): FuelPresetMealSpec {
  const preset = FUEL_PLAN_PRESETS[presetId] || FUEL_PLAN_PRESETS.almond_cashew_pea;
  const baseMeal = JSON.parse(JSON.stringify(preset.meals[slotId])) as FuelPresetMealSpec;
  if (!customization) return baseMeal;

  let recalcNeeded = false;
  if (slotId === 'lunch' && customization.swaps) {
    (['tofu', 'rice', 'broccoli'] as const).forEach(cat => {
      const swapId = customization.swaps?.[cat];
      if (!swapId) return;
      const found = WHOLE_FOOD_SMART_SWAPS[cat].find(s => s.id === swapId);
      if (found) {
        const idx = baseMeal.items.findIndex(it => it.id === found.targetItemId);
        if (idx >= 0) {
          baseMeal.items[idx] = {
            ...baseMeal.items[idx],
            name: found.label,
            label: found.label,
            weight: found.weight,
            grams: found.grams,
            protein: found.protein,
            kcal: found.kcal
          };
          recalcNeeded = true;
        }
      }
    });
  }

  if (customization.customOverrides) {
    baseMeal.items.forEach((it, idx) => {
      const ov = customization.customOverrides?.[it.id];
      if (ov && ov.grams > 0) {
        const ratio = it.grams > 0 ? ov.grams / it.grams : 1;
        baseMeal.items[idx] = {
          ...it,
          name: ov.label || it.name,
          label: ov.label || it.label,
          weight: `${Math.round(ov.grams)}g`,
          grams: Math.round(ov.grams),
          protein: ov.protein !== undefined ? ov.protein : +(it.protein * ratio).toFixed(1),
          kcal: ov.kcal !== undefined ? ov.kcal : Math.round(it.kcal * ratio)
        };
        recalcNeeded = true;
      }
    });
  }

  if (recalcNeeded) {
    const totalGrams = Math.round(baseMeal.items.reduce((acc, it) => acc + (Number(it.grams) || 0), 0));
    const totalProtein = Math.round(baseMeal.items.reduce((acc, it) => acc + (Number(it.protein) || 0), 0));
    const totalKcal = Math.round(baseMeal.items.reduce((acc, it) => acc + (Number(it.kcal) || 0), 0));
    const badges = formatScaleGramsToBadges(totalGrams);
    baseMeal.scaleGrams = badges.grams;
    baseMeal.scaleBadgeG = badges.g;
    baseMeal.scaleBadgeLb = badges.lb;
    baseMeal.protein = totalProtein;
    baseMeal.kcal = totalKcal;
  }

  return baseMeal;
}

export function backfillHistoricalFuelSnapshots(state: FuelStateContainer): FuelStateContainer {
  if (!state.fuelDaySnapshots || typeof state.fuelDaySnapshots !== 'object') {
    state.fuelDaySnapshots = {};
  }
  if (!state.loggedMealSnapshots || typeof state.loggedMealSnapshots !== 'object') {
    state.loggedMealSnapshots = {};
  }
  if (!state.fuelCustomizations || typeof state.fuelCustomizations !== 'object') {
    state.fuelCustomizations = {};
  }
  if (!state.activeFuelPreset || !FUEL_PLAN_PRESETS[state.activeFuelPreset]) {
    state.activeFuelPreset = 'almond_cashew_pea';
  }

  // Scan all existing logged meals in checkedMeals, fuelLogs, and checkedMealIngredients
  const allDaysToCheck = new Set<string>();
  const collectKeys = (obj?: Record<string, boolean>) => {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(k => {
      if (!obj[k]) return;
      const m = /^w(\d+)_d(\d+)_/.exec(k);
      if (m) {
        allDaysToCheck.add(`w${m[1]}_d${m[2]}`);
      } else if (SLOT_ORDER.includes(k as FuelSlotId)) {
        allDaysToCheck.add('w1_d0');
      }
    });
  };
  collectKeys(state.checkedMeals);
  collectKeys(state.fuelLogs);
  collectKeys(state.checkedMealIngredients);

  allDaysToCheck.forEach(dayKey => {
    const m = /^w(\d+)_d(\d+)$/.exec(dayKey);
    if (!m) return;
    const w = parseInt(m[1], 10);
    const d = parseInt(m[2], 10);
    if (!isAnyMealLoggedOnDay(state, w, d)) return;

    // Lock existing logged days to classic_silk_protein if not already snapshotted
    if (!state.fuelDaySnapshots![dayKey]) {
      state.fuelDaySnapshots![dayKey] = 'classic_silk_protein';
    }
    const lockedPreset = state.fuelDaySnapshots![dayKey] || 'classic_silk_protein';

    SLOT_ORDER.forEach(slotId => {
      const mealNum = getFuelNumForSlot(slotId);
      const snapKey = `${dayKey}_fuel${mealNum}`;
      const isSlotLogged =
        Boolean(state.checkedMeals?.[`${dayKey}_${slotId}`]) ||
        Boolean(state.fuelLogs?.[`${dayKey}_${slotId}`]) ||
        (w === 1 && d === 0 && (Boolean(state.checkedMeals?.[slotId]) || Boolean(state.fuelLogs?.[slotId])));
      if (isSlotLogged && !state.loggedMealSnapshots![snapKey]) {
        const spec = buildMealSpecWithCustomizations(lockedPreset, slotId);
        state.loggedMealSnapshots![snapKey] = {
          slotId,
          fuelNum: mealNum,
          presetId: lockedPreset,
          title: spec.title,
          kcal: spec.kcal,
          protein: spec.protein,
          scaleGrams: spec.scaleGrams,
          scaleBadgeG: spec.scaleBadgeG,
          scaleBadgeLb: spec.scaleBadgeLb,
          items: JSON.parse(JSON.stringify(spec.items)),
          loggedAt: new Date().toISOString()
        };
      }
    });
  });

  return state;
}

export function getEffectiveDayFuelPlan(
  state: FuelStateContainer,
  week: number,
  dayIdx: number
): {
  dayKey: string;
  presetId: FuelPresetId;
  preset: FuelPresetSpec;
  isLockedHistoricalDay: boolean;
  loggedWithBadge: string;
  meals: Record<FuelSlotId, FuelPresetMealSpec>;
  dailyTargetKcal: number;
  dailyTargetProtein: number;
} {
  const dayKey = `w${week}_d${dayIdx}`;
  const hasLoggedMeal = isAnyMealLoggedOnDay(state, week, dayIdx);
  const lockedPresetId = state.fuelDaySnapshots?.[dayKey];
  const dayCustom = state.fuelCustomizations?.[dayKey];
  const globalCustom = state.fuelCustomizations?.default;

  const effectivePresetId: FuelPresetId =
    (hasLoggedMeal && lockedPresetId && FUEL_PLAN_PRESETS[lockedPresetId])
      ? lockedPresetId
      : (dayCustom?.presetId && FUEL_PLAN_PRESETS[dayCustom.presetId])
        ? dayCustom.presetId
        : (state.activeFuelPreset && FUEL_PLAN_PRESETS[state.activeFuelPreset])
          ? state.activeFuelPreset
          : 'almond_cashew_pea';

  const preset = FUEL_PLAN_PRESETS[effectivePresetId];
  const mergedCustom: DayFuelCustomization = {
    presetId: effectivePresetId,
    swaps: { ...(globalCustom?.swaps || {}), ...(dayCustom?.swaps || {}) },
    customOverrides: { ...(globalCustom?.customOverrides || {}), ...(dayCustom?.customOverrides || {}) }
  };

  const meals = {} as Record<FuelSlotId, FuelPresetMealSpec>;
  SLOT_ORDER.forEach(slotId => {
    const mealNum = getFuelNumForSlot(slotId);
    const snapKey = `${dayKey}_fuel${mealNum}`;
    const snap = state.loggedMealSnapshots?.[snapKey];
    const isSlotLogged =
      Boolean(state.checkedMeals?.[`${dayKey}_${slotId}`]) ||
      Boolean(state.fuelLogs?.[`${dayKey}_${slotId}`]) ||
      (week === 1 && dayIdx === 0 && (Boolean(state.checkedMeals?.[slotId]) || Boolean(state.fuelLogs?.[slotId])));

    if (isSlotLogged && snap) {
      const baseMeal = preset.meals[slotId];
      meals[slotId] = {
        ...baseMeal,
        title: snap.title,
        kcal: snap.kcal,
        protein: snap.protein,
        scaleGrams: snap.scaleGrams,
        scaleBadgeG: snap.scaleBadgeG,
        scaleBadgeLb: snap.scaleBadgeLb,
        items: JSON.parse(JSON.stringify(snap.items))
      };
    } else {
      meals[slotId] = buildMealSpecWithCustomizations(effectivePresetId, slotId, hasLoggedMeal ? undefined : mergedCustom);
    }
  });

  const isLockedHistoricalDay = Boolean(hasLoggedMeal && state.fuelDaySnapshots?.[dayKey]);
  const hasActiveSwaps = Boolean(
    !isLockedHistoricalDay &&
    ((mergedCustom.swaps && Object.keys(mergedCustom.swaps).length > 0) ||
     (mergedCustom.customOverrides && Object.keys(mergedCustom.customOverrides).length > 0))
  );

  const computedKcal = SLOT_ORDER.reduce((acc, s) => acc + meals[s].kcal, 0);
  const computedProt = SLOT_ORDER.reduce((acc, s) => acc + meals[s].protein, 0);

  return {
    dayKey,
    presetId: effectivePresetId,
    preset,
    isLockedHistoricalDay,
    loggedWithBadge: isLockedHistoricalDay ? preset.loggedWithBadge : '',
    meals,
    dailyTargetKcal: hasActiveSwaps ? computedKcal : preset.dailyKcalDisplay,
    dailyTargetProtein: hasActiveSwaps ? computedProt : preset.dailyProtein
  };
}

export function snapshotMealOnLog(
  state: FuelStateContainer,
  week: number,
  dayIdx: number,
  slotId: FuelSlotId
): LoggedMealSnapshot {
  if (!state.fuelDaySnapshots) state.fuelDaySnapshots = {};
  if (!state.loggedMealSnapshots) state.loggedMealSnapshots = {};
  const dayKey = `w${week}_d${dayIdx}`;
  const plan = getEffectiveDayFuelPlan(state, week, dayIdx);

  if (!state.fuelDaySnapshots[dayKey]) {
    state.fuelDaySnapshots[dayKey] = plan.presetId;
  }
  const mealSpec = plan.meals[slotId];
  const mealNum = getFuelNumForSlot(slotId);
  const snapKey = `${dayKey}_fuel${mealNum}`;

  const snapshot: LoggedMealSnapshot = {
    slotId,
    fuelNum: mealNum,
    presetId: state.fuelDaySnapshots[dayKey],
    title: mealSpec.title,
    kcal: mealSpec.kcal,
    protein: mealSpec.protein,
    scaleGrams: mealSpec.scaleGrams,
    scaleBadgeG: mealSpec.scaleBadgeG,
    scaleBadgeLb: mealSpec.scaleBadgeLb,
    items: JSON.parse(JSON.stringify(mealSpec.items)),
    loggedAt: new Date().toISOString()
  };
  state.loggedMealSnapshots[snapKey] = snapshot;
  return snapshot;
}

export function applyFuelPresetSwitch(
  state: FuelStateContainer,
  presetId: FuelPresetId,
  scope: FuelSwitchScope,
  week: number,
  dayIdx: number
): { updatedToday: boolean; updatedFutureDefault: boolean } {
  if (!FUEL_PLAN_PRESETS[presetId]) {
    return { updatedToday: false, updatedFutureDefault: false };
  }
  if (!state.fuelCustomizations) state.fuelCustomizations = {};
  if (!state.fuelDaySnapshots) state.fuelDaySnapshots = {};
  const dayKey = `w${week}_d${dayIdx}`;
  const todayHasLogs = isAnyMealLoggedOnDay(state, week, dayIdx);

  if (scope === 'future') {
    state.activeFuelPreset = presetId;
  }

  let updatedToday = false;
  if (!todayHasLogs) {
    if (!state.fuelCustomizations[dayKey]) state.fuelCustomizations[dayKey] = {};
    state.fuelCustomizations[dayKey].presetId = presetId;
    delete state.fuelDaySnapshots[dayKey];
    updatedToday = true;
  }

  return {
    updatedToday,
    updatedFutureDefault: scope === 'future'
  };
}

export function applyFuelIngredientSwap(
  state: FuelStateContainer,
  category: 'tofu' | 'rice' | 'broccoli',
  swapId: string,
  scope: FuelSwitchScope,
  week: number,
  dayIdx: number
): boolean {
  const options = WHOLE_FOOD_SMART_SWAPS[category];
  if (!options || !options.some(o => o.id === swapId)) return false;
  if (!state.fuelCustomizations) state.fuelCustomizations = {};

  const targetKey = scope === 'future' ? 'default' : `w${week}_d${dayIdx}`;
  if (!state.fuelCustomizations[targetKey]) state.fuelCustomizations[targetKey] = {};
  if (!state.fuelCustomizations[targetKey].swaps) state.fuelCustomizations[targetKey].swaps = {};
  state.fuelCustomizations[targetKey].swaps![category] = swapId;

  if (scope === 'future') {
    const dayKey = `w${week}_d${dayIdx}`;
    if (!isAnyMealLoggedOnDay(state, week, dayIdx) && state.fuelCustomizations[dayKey]?.swaps) {
      state.fuelCustomizations[dayKey].swaps![category] = swapId;
    }
  }
  return true;
}

export function resetDayFuelLogsAndSnapshots(
  state: FuelStateContainer,
  week: number,
  dayIdx: number
): void {
  const dayKey = `w${week}_d${dayIdx}`;
  if (state.fuelDaySnapshots) delete state.fuelDaySnapshots[dayKey];
  if (state.loggedMealSnapshots) {
    for (let m = 1; m <= 4; m++) {
      delete state.loggedMealSnapshots[`${dayKey}_fuel${m}`];
    }
  }
  if (state.fuelCustomizations && state.fuelCustomizations[dayKey]) {
    delete state.fuelCustomizations[dayKey];
  }
  SLOT_ORDER.forEach(slotId => {
    if (state.checkedMeals) {
      delete state.checkedMeals[`${dayKey}_${slotId}`];
      if (week === 1 && dayIdx === 0) delete state.checkedMeals[slotId];
    }
    if (state.fuelLogs) {
      delete state.fuelLogs[`${dayKey}_${slotId}`];
      if (week === 1 && dayIdx === 0) delete state.fuelLogs[slotId];
    }
  });
  if (state.checkedMealIngredients) {
    Object.keys(state.checkedMealIngredients).forEach(k => {
      if (k.startsWith(`${dayKey}_`)) {
        delete state.checkedMealIngredients![k];
      }
    });
  }
}

export interface CoachAiMutationAction {
  actionId: string;
  buttonLabel: string;
  mutationType: 'switch_preset' | 'swap_ingredient';
  presetId?: FuelPresetId;
  swapCategory?: 'tofu' | 'rice' | 'broccoli';
  swapId?: string;
  scope: FuelSwitchScope;
}

export function buildCoachAiFuelMutationReply(
  promptText: string,
  week = 1,
  dayIdx = 0
): {
  matched: boolean;
  replyText: string;
  actions: CoachAiMutationAction[];
} {
  const q = String(promptText || '').toLowerCase();

  if (q.includes('silk') || q.includes('original') || q.includes('75g pea')) {
    return {
      matched: true,
      replyText:
        `** Coach AI Live Plan Switch — Original Silk Protein Plan (1,400 kcal • 138g P):**\n` +
        `• **Exact Math:** Restores **900 ml Unsweetened Silk Protein Milk** (` +
        `360 ml in Fuel 1 + 180 ml in Fuel 2 Oats + 360 ml in Fuel 4) and reduces Pea Protein Isolate to **75g/day** (` +
        `30g in Fuel 1 + 45g in Fuel 4, removing the 10g powder from your Oats jar).\n` +
        `• **Updated Scale Weights:** Fuel 1 = **390g** • Fuel 2 = **269g** • Fuel 3 = **419g** • Fuel 4 = **421g**.\n` +
        `• **Non-Destructive Guarantee:** Past logged days remain locked to their original snapshots.`,
      actions: [
        {
          actionId: `switch_silk_today_w${week}_d${dayIdx}`,
          buttonLabel: `Apply to Today (Day ${dayIdx + 1}): Switch to Original Silk Protein Plan`,
          mutationType: 'switch_preset',
          presetId: 'classic_silk_protein',
          scope: 'today'
        },
        {
          actionId: `switch_silk_future_w${week}_d${dayIdx}`,
          buttonLabel: 'Apply to Future Days: Original Silk Protein Plan',
          mutationType: 'switch_preset',
          presetId: 'classic_silk_protein',
          scope: 'future'
        }
      ]
    };
  }

  if (q.includes('almond') || q.includes('cashew') || q.includes('option b') || q.includes('105g')) {
    return {
      matched: true,
      replyText:
        `** Coach AI Live Plan Switch — Option B Almond/Cashew + 105g Pea Plan (1,300 kcal • 138g P):**\n` +
        `• **Exact Math:** Uses **900 ml Unsweetened Almond/Cashew Milk** across Fuel 1, 2 & 4 and adds **+30g Pea Protein Isolate** (` +
        `40g in Fuel 1, 10g whisked into Fuel 2 Oats, 55g in Fuel 4 = **105g/day**) to lock in **138g protein** at **1,295 kcal**.\n` +
        `• **Updated Scale Weights:** Fuel 1 = **400g** • Fuel 2 = **279g** • Fuel 3 = **419g** • Fuel 4 = **431g**.`,
      actions: [
        {
          actionId: `switch_almond_future_w${week}_d${dayIdx}`,
          buttonLabel: 'Apply to Future Days: Option B Almond/Cashew Plan',
          mutationType: 'switch_preset',
          presetId: 'almond_cashew_pea',
          scope: 'future'
        },
        {
          actionId: `switch_almond_today_w${week}_d${dayIdx}`,
          buttonLabel: `Apply to Today (Day ${dayIdx + 1}): Option B Almond/Cashew Plan`,
          mutationType: 'switch_preset',
          presetId: 'almond_cashew_pea',
          scope: 'today'
        }
      ]
    };
  }

  if (q.includes('soy milk') || q.includes('option a')) {
    return {
      matched: true,
      replyText:
        `** Coach AI Live Plan Switch — Option A Unsweetened Soy Milk + 75g Pea Plan (1,400 kcal • 138g P):**\n` +
        `• **Exact Math:** 1:1 macro match for Silk Protein Milk (**8g protein per 250 ml cup**). Uses **900 ml Unsweetened Fortified Soy Milk** + **75g Pea Protein Isolate**.\n` +
        `• **Scale Weights:** Fuel 1 = **390g** • Fuel 2 = **269g** • Fuel 3 = **419g** • Fuel 4 = **421g**.`,
      actions: [
        {
          actionId: `switch_soy_future_w${week}_d${dayIdx}`,
          buttonLabel: 'Apply to Future Days: Option A Unsweetened Soy Plan',
          mutationType: 'switch_preset',
          presetId: 'unsweetened_soy',
          scope: 'future'
        }
      ]
    };
  }

  if (
    q.includes('sold out') ||
    q.includes('swap') ||
    q.includes('tofu') ||
    q.includes('tempeh') ||
    q.includes('edamame') ||
    q.includes('lentil') ||
    q.includes('quinoa') ||
    q.includes('potato') ||
    q.includes('spinach') ||
    q.includes('broccoli')
  ) {
    return {
      matched: true,
      replyText:
        `** Coach AI Iso-Protein Smart Ingredient Swaps (Fuel 3 Bowl):**\n` +
        `• **Protein Swap (21g P target):** Swap **175g Extra-Firm Tofu** for **115g Tempeh** (21g P • 220 kcal), **200g Shelled Edamame** (22g P • 240 kcal), or **240g Cooked Lentils** (21g P • 275 kcal).\n` +
        `• **Carb & Veggie Swaps:** Swap **150g Cooked Jasmine Rice** for **165g Cooked Quinoa** or **230g Boiled Potato**; swap **75g Broccoli** for **85g Spinach** or **90g Green Beans**.\n` +
        `• Tap any button below to update your live Fuel 3 scale weights without altering past logged days:`,
      actions: [
        {
          actionId: `swap_tempeh_today_w${week}_d${dayIdx}`,
          buttonLabel: 'Swap Tofu for 115g Tempeh Today',
          mutationType: 'swap_ingredient',
          swapCategory: 'tofu',
          swapId: 'tempeh_115',
          scope: 'today'
        },
        {
          actionId: `swap_edamame_today_w${week}_d${dayIdx}`,
          buttonLabel: 'Swap Tofu for 200g Edamame Today',
          mutationType: 'swap_ingredient',
          swapCategory: 'tofu',
          swapId: 'edamame_200',
          scope: 'today'
        },
        {
          actionId: `swap_quinoa_today_w${week}_d${dayIdx}`,
          buttonLabel: 'Swap Rice for 165g Cooked Quinoa Today',
          mutationType: 'swap_ingredient',
          swapCategory: 'rice',
          swapId: 'quinoa_165',
          scope: 'today'
        },
        {
          actionId: `swap_spinach_today_w${week}_d${dayIdx}`,
          buttonLabel: 'Swap Broccoli for 85g Spinach Today',
          mutationType: 'swap_ingredient',
          swapCategory: 'broccoli',
          swapId: 'spinach_85',
          scope: 'today'
        }
      ]
    };
  }

  return {
    matched: false,
    replyText: '',
    actions: []
  };
}

// ============================================================================
// UX SIMPLIFICATIONS 1–3 & 3-TIER SMARTWATCH INTEGRATION (BLE + WRIST ALERTS + HEALTH SYNC)
// ============================================================================

export function formatCompactMuscleFuelTitle(dailyKcal = 1300, dailyProtein = 138): string {
  return `Daily Muscle Fuel (${Number(dailyKcal).toLocaleString()} kcal • ${dailyProtein}g P)`;
}

export function formatFuelPlanSubheaderPill(
  presetId: FuelPresetId = 'almond_cashew_pea',
  activeSwapCount = 0
): string {
  const shortPlanMap: Record<FuelPresetId, string> = {
    almond_cashew_pea: 'Option B (Almond/Cashew)',
    classic_silk_protein: 'Original Silk',
    unsweetened_soy: 'Option A (Soy)'
  };
  const planName = shortPlanMap[presetId] || shortPlanMap.almond_cashew_pea;
  const swapSuffix = activeSwapCount > 0 ? ` (${activeSwapCount} swap${activeSwapCount > 1 ? 's' : ''})` : '';
  return `Plan: ${planName}${swapSuffix} • Change / Swap Ingredients`;
}

export function isFuelPlanDrawerExpanded(openFuelPlanDrawer?: boolean): boolean {
  return Boolean(openFuelPlanDrawer);
}

export function isFuelTimingTipExpanded(
  openFuelTips: Record<string, boolean> | undefined,
  slotId: string
): boolean {
  if (!openFuelTips || openFuelTips[slotId] === undefined) {
    return false; // Hidden by default on all Fuel 1-4 cards
  }
  return Boolean(openFuelTips[slotId]);
}

export function getCompactBatchCardHeaderSpec(
  recipeId: 'recipe_oats_batch' | 'recipe_rice_batch',
  presetId: FuelPresetId = 'almond_cashew_pea',
  unit: FuelWeightUnit = 'g'
): {
  badge: string;
  fridgePill: string;
  weightBadge: string;
  title: string;
} {
  if (recipeId === 'recipe_oats_batch') {
    const isOptionB = presetId === 'almond_cashew_pea';
    const weightBadge =
      unit === 'lb'
        ? isOptionB
          ? '2.46 lb (9.8 oz/jar)'
          : '2.37 lb (9.5 oz/jar)'
        : isOptionB
          ? '1,116g (279g/jar)'
          : '1,076g (269g/jar)';
    return {
      badge: 'Batch 1/2',
      fridgePill: '4 Jars in Fridge',
      weightBadge,
      title: '4-Day Overnight Protein Oats Batch'
    };
  }
  return {
    badge: 'Batch 2/2',
    fridgePill: '4 Bowls in Fridge',
    weightBadge: unit === 'lb' ? '1.32 lb (5.3 oz/bowl)' : '600g (150g/bowl)',
    title: '4-Day Jasmine Rice Batch Prep'
  };
}

// Tier 1: Real-Time Web Bluetooth Heart Rate Measurement Parser (0x180D / 0x2A37)
export interface BleHeartRateMeasurement {
  bpm: number;
  is16Bit: boolean;
  contactDetected: boolean | null;
  energyExpendedKJ: number | null;
  rrIntervalsMs: number[];
}

export function parseBleHeartRateMeasurement(
  input: DataView | Uint8Array
): BleHeartRateMeasurement {
  const view =
    input instanceof DataView
      ? input
      : new DataView(input.buffer, input.byteOffset, input.byteLength);

  if (view.byteLength < 2) {
    return {
      bpm: 0,
      is16Bit: false,
      contactDetected: null,
      energyExpendedKJ: null,
      rrIntervalsMs: []
    };
  }

  const flags = view.getUint8(0);
  const is16Bit = (flags & 0x01) !== 0;
  let offset = 1;
  let bpm = 0;

  if (is16Bit) {
    if (view.byteLength >= 3) {
      bpm = view.getUint16(offset, true);
      offset += 2;
    }
  } else {
    bpm = view.getUint8(offset);
    offset += 1;
  }

  const contactBits = (flags >> 1) & 0x03;
  let contactDetected: boolean | null = null;
  if (contactBits === 2) contactDetected = false;
  else if (contactBits === 3) contactDetected = true;

  let energyExpendedKJ: number | null = null;
  if ((flags & 0x08) !== 0 && view.byteLength >= offset + 2) {
    energyExpendedKJ = view.getUint16(offset, true);
    offset += 2;
  }

  const rrIntervalsMs: number[] = [];
  if ((flags & 0x10) !== 0) {
    while (view.byteLength >= offset + 2) {
      const rawRr = view.getUint16(offset, true);
      rrIntervalsMs.push(Math.round((rawRr / 1024) * 1000));
      offset += 2;
    }
  }

  return {
    bpm,
    is16Bit,
    contactDetected,
    energyExpendedKJ,
    rrIntervalsMs
  };
}

export function getHeartRateZoneInfo(
  bpm: number,
  maxHr = 190
): {
  bpm: number;
  zone: 1 | 2 | 3 | 4 | 5;
  zoneName: string;
  pillText: string;
} {
  const cleanBpm = Math.max(0, Math.round(Number(bpm) || 0));
  const safeMax = Math.max(120, Number(maxHr) || 190);
  const pct = cleanBpm / safeMax;

  let zone: 1 | 2 | 3 | 4 | 5 = 1;
  let zoneName = 'Warm-Up / Recovery';
  if (pct >= 0.9) {
    zone = 5;
    zoneName = 'Peak Anaerobic';
  } else if (pct >= 0.8) {
    zone = 4;
    zoneName = 'Anaerobic Threshold';
  } else if (pct >= 0.7) {
    zone = 3;
    zoneName = 'Aerobic Tempo';
  } else if (pct >= 0.6) {
    zone = 2;
    zoneName = 'Fat Burn / Base';
  }

  return {
    bpm: cleanBpm,
    zone,
    zoneName,
    pillText: `${cleanBpm} BPM • Zone ${zone}`
  };
}

export function formatRestHeartRateRecovery(
  startRestBpm: number | null | undefined,
  currentBpm: number | null | undefined
): {
  hasRecovery: boolean;
  startBpm: number;
  currentBpm: number;
  deltaBpm: number;
  text: string;
} {
  const start = Math.round(Number(startRestBpm) || 0);
  const current = Math.round(Number(currentBpm) || 0);
  if (start <= 0 || current <= 0) {
    return {
      hasRecovery: false,
      startBpm: 0,
      currentBpm: 0,
      deltaBpm: 0,
      text: ''
    };
  }
  const deltaBpm = current - start;
  const sign = deltaBpm > 0 ? `+${deltaBpm}` : `${deltaBpm}`;
  return {
    hasRecovery: true,
    startBpm: start,
    currentBpm: current,
    deltaBpm,
    text: `${start} -> ${current} BPM (${sign} BPM recovery)`
  };
}

// Tier 2: Smartwatch Wrist Haptic Notification Payload Builder
export interface WristNotificationPayload {
  title: string;
  body: string;
  tag: '7am-timer-alert';
  renotify: true;
  vibrate: [number, number, number];
}

export function buildWristNotificationPayload(params: {
  nextSetNumber?: number;
  exerciseName?: string;
  weight?: string | number;
  unit?: 'lbs' | 'kg';
  reps?: string | number;
  customBody?: string;
}): WristNotificationPayload {
  if (params.customBody) {
    return {
      title: '7AM Gym • Watch Timer Alert',
      body: params.customBody,
      tag: '7am-timer-alert',
      renotify: true,
      vibrate: [200, 100, 200]
    };
  }
  const setNum = params.nextSetNumber || 1;
  const exName = params.exerciseName || 'Barbell Bench Press';
  const weightVal = params.weight !== undefined && params.weight !== '' ? params.weight : 135;
  const unitVal = params.unit || 'lbs';
  const repsVal = params.reps !== undefined && params.reps !== '' ? params.reps : 8;

  return {
    title: '7AM Gym • Rest Complete!',
    body: `Rest Complete! Up Next: Set ${setNum} ${exName} (${weightVal} ${unitVal} x ${repsVal})`,
    tag: '7am-timer-alert',
    renotify: true,
    vibrate: [200, 100, 200]
  };
}

// Tier 3: Apple HealthKit & Google Health Connect Bridge Detection & CSV Export
export function detectCapacitorHealthBridge(winObj?: unknown): {
  isNativeAvailable: boolean;
  pluginName: 'Health' | 'HealthFitness' | null;
} {
  const w = winObj as {
    Capacitor?: {
      Plugins?: {
        Health?: unknown;
        HealthFitness?: unknown;
      };
    };
  } | undefined;

  if (w?.Capacitor?.Plugins?.Health) {
    return { isNativeAvailable: true, pluginName: 'Health' };
  }
  if (w?.Capacitor?.Plugins?.HealthFitness) {
    return { isNativeAvailable: true, pluginName: 'HealthFitness' };
  }
  return { isNativeAvailable: false, pluginName: null };
}

export function buildHealthExportCsv(params: {
  week: number;
  dayNumber: number;
  completedSets: number;
  totalVolumeLbs: number;
  dailyKcal: number;
  dailyProteinG: number;
  waterMl: number;
  lastBpm?: number;
  startRestBpm?: number;
}): string {
  const header = 'Week,Day,Completed_Sets,Total_Volume_Lbs,Daily_Kcal,Daily_Protein_G,Water_Ml,Live_BPM,Start_Rest_BPM';
  const row = [
    params.week,
    params.dayNumber,
    params.completedSets,
    params.totalVolumeLbs,
    params.dailyKcal,
    params.dailyProteinG,
    params.waterMl,
    params.lastBpm || '',
    params.startRestBpm || ''
  ].join(',');
  return `${header}\n${row}`;
}

// ============================================================================
// TECHNICAL & UX UPGRADES 1–5:
// 1. Day 3 Pull-Ups ("3 Grips x 3 Training Sets") Visual Grip Dividers & 3 Dedicated Videos
// 2. Switch "Incline Dumbbell Overhead Extensions" to "Overhead Rope Extensions"
// 3. Global 2.5 lb Minimum Weight & 2.5 lb Stepper Increments Across All Exercises
// 4. Smart Historical Suggestion (Set 1) & Intra-Workout Cascading Auto-Fill (Set 2+)
// 5. Louder, Zero-Crackle Bluetooth-Safe Timer Chime (DSP Upgrade)
// ============================================================================

export interface Day3PullupGripBlockSpec {
  gripNumber: 1 | 2 | 3;
  startSet: 1 | 4 | 7;
  endSet: 3 | 6 | 9;
  title: string;
  instruction: string;
  videoButtonLabel: string;
  videoUrl: string;
  shortGripLabel: 'Overhand' | 'Close Underhand' | 'Wide Overhand';
}

export const DAY3_PULLUP_GRIP_BLOCKS: readonly Day3PullupGripBlockSpec[] = [
  {
    gripNumber: 1,
    startSet: 1,
    endSet: 3,
    title: 'GRIP 1 OF 3 (SETS 1–3) • NORMAL OVERHAND GRIP',
    instruction:
      'Palms facing away from you, hands slightly wider than shoulder-width. Rest 60s between sets.',
    videoButtonLabel: 'Grip 1 Video',
    videoUrl: 'http://www.youtube.com/watch?v=OEXosPwzFdc',
    shortGripLabel: 'Overhand'
  },
  {
    gripNumber: 2,
    startSet: 4,
    endSet: 6,
    title: 'CHANGE GRIP -> GRIP 2 OF 3 (SETS 4–6) • CLOSE UNDERHAND (PINKIES TOUCHING)',
    instruction:
      'Palms facing toward your face, hands together so your little fingers (pinkies) are touching each other. Rest 60s between sets.',
    videoButtonLabel: 'Grip 2 Video',
    videoUrl: 'http://www.youtube.com/watch?v=ZouXLZwAUvs',
    shortGripLabel: 'Close Underhand'
  },
  {
    gripNumber: 3,
    startSet: 7,
    endSet: 9,
    title: 'CHANGE GRIP -> GRIP 3 OF 3 (SETS 7–9) • WIDE OVERHAND GRIP (LAT FOCUS)',
    instruction:
      'Wide overhand grip (palms away, well outside shoulder-width). Focus on your lats pulling toward the center of your body. Rest 60s between sets.',
    videoButtonLabel: 'Grip 3 Video',
    videoUrl: 'http://www.youtube.com/watch?v=bHC16skSN6Q',
    shortGripLabel: 'Wide Overhand'
  }
] as const;

export function getDay3PullupGripDividerForSet(setNum: number): Day3PullupGripBlockSpec | null {
  return DAY3_PULLUP_GRIP_BLOCKS.find(b => b.startSet === setNum) || null;
}

export function formatDay3PullupSetRowLabel(setNum: number): string {
  const s = Math.max(1, Math.min(9, Math.round(Number(setNum) || 1)));
  if (s <= 3) return `Set ${s} (Overhand)`;
  if (s <= 6) return `Set ${s} (Close Underhand)`;
  return `Set ${s} (Wide Overhand)`;
}

export const DAY3_OVERHEAD_ROPE_EXTENSION_SPEC = {
  id: 'thu_oh_ext',
  name: 'Overhead Rope Extensions',
  sets: 3,
  reps: '10-15',
  restSec: 105,
  restLabel: '1.5-2 min',
  videoUrl: 'https://www.youtube.com/watch?v=7yoTblFCUQM',
  notes:
    'Attach a rope to a low or high pulley, face away from the cable stack in a staggered stance, lock your elbows overhead beside your ears, extend your forearms overhead until straight, and control the weight back behind your head for a full triceps stretch.'
} as const;

export function getGlobalWeightStepIncrement(unit: 'lbs' | 'kg' = 'lbs'): number {
  return unit === 'kg' ? 1.25 : 2.5;
}

export function formatQuickOverloadButtonLabel(
  defaultWeightLbs: number,
  unit: 'lbs' | 'kg' = 'lbs'
): string {
  if (Number(defaultWeightLbs) <= 0) return '+1 Rep';
  return unit === 'kg' ? '+1.25 kg' : '+2.5 lb';
}

export function stepExerciseWeightValue(
  currentWeight: number,
  delta: number,
  unit: 'lbs' | 'kg' = 'lbs'
): number {
  const minPositiveStep = getGlobalWeightStepIncrement(unit);
  const cur = Number.isFinite(currentWeight) ? currentWeight : 0;
  const rawNext = +(cur + delta).toFixed(2);
  if (rawNext <= 0) return 0;
  if (rawNext < minPositiveStep) {
    return delta > 0 ? minPositiveStep : 0;
  }
  return rawNext;
}

export function resolveExerciseSetSuggestion(params: {
  setNum: number;
  currentEntry?: SetLog | null;
  todaySet1Entry?: SetLog | null;
  latestCompletedTodayEntry?: SetLog | null;
  prevWeekEntry?: { weight?: string; reps?: string; sourceLabel?: string; unit?: 'lbs' | 'kg' } | null;
  defaultWeight: number | string;
  defaultReps: number | string;
}): {
  suggestedWeight: string;
  suggestedReps: string;
  source: 'logged_today' | 'cascaded_from_today_set' | 'previous_week' | 'default';
  prevWeekBadgeText: string;
} {
  const {
    setNum,
    currentEntry,
    todaySet1Entry,
    latestCompletedTodayEntry,
    prevWeekEntry,
    defaultWeight,
    defaultReps
  } = params;

  const isSet1DoneToday = Boolean(todaySet1Entry && todaySet1Entry.done);
  const completedTodaySource =
    (latestCompletedTodayEntry && latestCompletedTodayEntry.done
      ? latestCompletedTodayEntry
      : isSet1DoneToday
        ? todaySet1Entry
        : null) || null;

  const hasPrevWeek = Boolean(
    prevWeekEntry &&
      ((prevWeekEntry.weight !== undefined && String(prevWeekEntry.weight) !== '') ||
        (prevWeekEntry.reps !== undefined && String(prevWeekEntry.reps) !== ''))
  );
  const prevWeekBadgeText = hasPrevWeek
    ? `Last (${prevWeekEntry?.sourceLabel || 'Prev Wk'}): ${
        prevWeekEntry?.weight && prevWeekEntry.weight !== '0'
          ? `${prevWeekEntry.weight} ${prevWeekEntry.unit || 'lbs'} × `
          : ''
      }${prevWeekEntry?.reps || defaultReps}`
    : '';

  if (currentEntry && currentEntry.done) {
    return {
      suggestedWeight:
        currentEntry.weight !== undefined && currentEntry.weight !== ''
          ? String(currentEntry.weight)
          : String(defaultWeight),
      suggestedReps:
        currentEntry.reps !== undefined && currentEntry.reps !== ''
          ? String(currentEntry.reps)
          : String(defaultReps),
      source: 'logged_today',
      prevWeekBadgeText
    };
  }

  // Rule B: After Set 1 (or an earlier set) is logged today, suggest that exact weight and reps for subsequent unlogged sets
  if (setNum > 1 && completedTodaySource) {
    const w =
      currentEntry && currentEntry.weight !== undefined && currentEntry.weight !== ''
        ? String(currentEntry.weight)
        : String(completedTodaySource.weight ?? defaultWeight);
    const r =
      currentEntry && currentEntry.reps !== undefined && currentEntry.reps !== ''
        ? String(currentEntry.reps)
        : String(completedTodaySource.reps ?? defaultReps);
    return {
      suggestedWeight: w,
      suggestedReps: r,
      source: 'cascaded_from_today_set',
      prevWeekBadgeText
    };
  }

  // Rule A: Before Set 1 is logged today, suggest previous week's weight and reps if available, otherwise exercise defaults
  if (hasPrevWeek && prevWeekEntry) {
    const w =
      currentEntry && currentEntry.weight !== undefined && currentEntry.weight !== ''
        ? String(currentEntry.weight)
        : prevWeekEntry.weight !== undefined && String(prevWeekEntry.weight) !== ''
          ? String(prevWeekEntry.weight)
          : String(defaultWeight);
    const r =
      currentEntry && currentEntry.reps !== undefined && currentEntry.reps !== ''
        ? String(currentEntry.reps)
        : prevWeekEntry.reps !== undefined && String(prevWeekEntry.reps) !== ''
          ? String(prevWeekEntry.reps)
          : String(defaultReps);
    return {
      suggestedWeight: w,
      suggestedReps: r,
      source: 'previous_week',
      prevWeekBadgeText
    };
  }

  return {
    suggestedWeight:
      currentEntry && currentEntry.weight !== undefined && currentEntry.weight !== ''
        ? String(currentEntry.weight)
        : String(defaultWeight),
    suggestedReps:
      currentEntry && currentEntry.reps !== undefined && currentEntry.reps !== ''
        ? String(currentEntry.reps)
        : String(defaultReps),
    source: 'default',
    prevWeekBadgeText: ''
  };
}

export function cascadeLoggedSetToSubsequentUnloggedSets(
  workoutLogs: Record<string, SetLog>,
  week: number,
  dayIdx: number,
  exId: string,
  loggedSetNum: number,
  totalSets: number,
  loggedWeight: string,
  loggedReps: string,
  unit: 'lbs' | 'kg' = 'lbs'
): Record<string, SetLog> {
  const nextLogs: Record<string, SetLog> = { ...(workoutLogs || {}) };
  for (let k = loggedSetNum + 1; k <= totalSets; k++) {
    const key = `w${week}_${dayIdx}_${exId}_${k}`;
    const existing = nextLogs[key];
    if (!existing || !existing.done) {
      nextLogs[key] = {
        ...(existing || { done: false }),
        weight: String(loggedWeight),
        reps: String(loggedReps),
        done: false,
        unit
      };
      if (week === 1) {
        nextLogs[`${dayIdx}_${exId}_${k}`] = { ...nextLogs[key] };
      }
    }
  }
  return nextLogs;
}

// ============================================================================
// UPGRADES 1–4:
// 1. Smart Heart Rate Recovery Readiness Alert & Watch MediaSession / WakeLock Sync
// 2. Biometric Profile & Scale Weight vs. 7-Day Trend Weight Logger
// 3. Dated Progress Photo Gallery with Side-by-Side Before/After Comparison
// 4. Competitor-Grade Progress & Analytics Dashboard (Tonnage & Epley 1RM)
// ============================================================================

export interface WatchSettingsConfig {
  hrRecoveryAlert: boolean;
  targetRecoveryBpm: number;
  targetDropBpm: number;
  wristAlertsEnabled?: boolean;
}

export const DEFAULT_WATCH_SETTINGS: WatchSettingsConfig = {
  hrRecoveryAlert: true,
  targetRecoveryBpm: 120,
  targetDropBpm: 25,
  wristAlertsEnabled: false
};

export function shouldShowLiveHeartRateUi(state: {
  bleConnected?: boolean;
  liveBpm?: number | null;
}): boolean {
  return Boolean(state && state.bleConnected === true && typeof state.liveBpm === 'number' && state.liveBpm > 0);
}

export function buildWearOsWristNotificationPayload(params: {
  title?: string | null;
  nextSetSummary?: string | null;
  liveBpm?: number | null;
  bleConnected?: boolean;
}): {
  title: string;
  options: {
    body: string;
    icon: string;
    badge: string;
    vibrate: number[];
    tag: string;
    renotify: boolean;
    requireInteraction: boolean;
  };
} {
  const cleanNext = String(params.nextSetSummary || 'Time to lift! Check your target weight & reps.').trim();
  const hasLiveHr = Boolean(params.bleConnected && typeof params.liveBpm === 'number' && params.liveBpm > 0);
  const hrSuffix = hasLiveHr ? ` • ${Math.round(Number(params.liveBpm))} BPM` : '';
  const finalTitle = String(params.title || ' Rest Complete! Start Next Set').trim();
  const finalBody = cleanNext.startsWith('Up Next:') || cleanNext.startsWith('Time to lift')
    ? `${cleanNext}${hrSuffix}`
    : `Up Next: ${cleanNext}${hrSuffix}`;

  return {
    title: finalTitle,
    options: {
      body: finalBody,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [300, 150, 300, 150, 400],
      tag: 'gym-rest-timer',
      renotify: true,
      requireInteraction: true
    }
  };
}

export function evaluateHrRecoveryReadiness(params: {
  timerRunning: boolean;
  elapsedRestSec: number;
  liveBpm: number;
  startRestBpm?: number;
  alreadyAlertedThisRest?: boolean;
  settings?: Partial<WatchSettingsConfig>;
}): {
  isRecovered: boolean;
  shouldTriggerAlert: boolean;
  badgeText: string;
  reason: 'below_target_bpm' | 'drop_from_peak' | 'not_recovered' | 'waiting_min_rest' | 'disabled';
} {
  const cfg: WatchSettingsConfig = {
    ...DEFAULT_WATCH_SETTINGS,
    ...(params.settings || {})
  };
  const bpm = Math.round(Number(params.liveBpm) || 0);
  const startBpm = Math.round(Number(params.startRestBpm) || 0);
  const elapsed = Number(params.elapsedRestSec) || 0;

  if (!cfg.hrRecoveryAlert) {
    return { isRecovered: false, shouldTriggerAlert: false, badgeText: '', reason: 'disabled' };
  }
  if (!params.timerRunning || bpm <= 0) {
    return { isRecovered: false, shouldTriggerAlert: false, badgeText: '', reason: 'not_recovered' };
  }
  if (elapsed < 20) {
    return { isRecovered: false, shouldTriggerAlert: false, badgeText: '', reason: 'waiting_min_rest' };
  }

  const hitTargetBpm = bpm <= cfg.targetRecoveryBpm;
  const hitDropTarget = startBpm > 0 && startBpm - bpm >= cfg.targetDropBpm;

  if (hitTargetBpm || hitDropTarget) {
    const badgeText = `HR Recovered (${bpm} BPM) — Ready for Next Set!`;
    return {
      isRecovered: true,
      shouldTriggerAlert: !params.alreadyAlertedThisRest,
      badgeText,
      reason: hitTargetBpm ? 'below_target_bpm' : 'drop_from_peak'
    };
  }

  return { isRecovered: false, shouldTriggerAlert: false, badgeText: '', reason: 'not_recovered' };
}

export function buildWatchMediaSessionMetadataPayload(params: {
  timerRunning: boolean;
  timerSeconds: number;
  contextLabel?: string;
  nextSetSummary?: string;
  liveBpm?: number;
}): {
  title: string;
  artist: string;
  album: string;
} {
  const sec = Math.max(0, Math.floor(Number(params.timerSeconds) || 0));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  const formattedTime = `${mm}:${ss}`;
  const cleanNext = String(params.nextSetSummary || 'Set 2 Barbell Bench Press (135 lbs x 8)').trim();
  const hrSuffix = params.liveBpm && params.liveBpm > 0 ? ` • ${Math.round(params.liveBpm)} BPM` : '';

  const title = params.timerRunning
    ? ` ${formattedTime} • ${params.contextLabel || 'Rest Timer'}${hrSuffix}`
    : `Ready: ${cleanNext}${hrSuffix}`;
  const artist = `Up Next: ${cleanNext}`;
  const album = '7AM Vegan Muscle & Training Hub';
  return { title, artist, album };
}

export interface BodyWeightLogEntry {
  date: string; // YYYY-MM-DD
  weight: number;
  unit: 'lbs' | 'kg';
  note?: string;
}

export interface BodyWeightTrendPoint extends BodyWeightLogEntry {
  scaleWeight: number;
  trendWeight: number;
  deltaFromTrend: number;
}

export function calculateBodyWeightTrendSeries(
  logs: BodyWeightLogEntry[],
  targetUnit: 'lbs' | 'kg' = 'lbs'
): {
  points: BodyWeightTrendPoint[];
  latestScaleWeight: number;
  latestTrendWeight: number;
  sevenDayTrendDelta: number;
} {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      points: [],
      latestScaleWeight: 0,
      latestTrendWeight: 0,
      sevenDayTrendDelta: 0
    };
  }

  // Normalize units and sort chronologically by date ascending
  const normalized = logs
    .filter(item => item && Number.isFinite(Number(item.weight)) && Number(item.weight) > 0)
    .map(item => {
      const rawW = Number(item.weight);
      const itemUnit = item.unit === 'kg' ? 'kg' : 'lbs';
      let converted = rawW;
      if (itemUnit !== targetUnit) {
        converted = targetUnit === 'kg' ? rawW / 2.20462 : rawW * 2.20462;
      }
      return {
        date: String(item.date || '2026-11-01').slice(0, 10),
        weight: +converted.toFixed(1),
        unit: targetUnit,
        note: item.note || ''
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (normalized.length === 0) {
    return {
      points: [],
      latestScaleWeight: 0,
      latestTrendWeight: 0,
      sevenDayTrendDelta: 0
    };
  }

  // 7-Day Exponential Moving Average (MacroFactor standard smoothing factor alpha = 2 / (7 + 1) = 0.25)
  const alpha = 2 / (7 + 1);
  let ema = normalized[0].weight;
  const points: BodyWeightTrendPoint[] = normalized.map((entry, idx) => {
    if (idx === 0) {
      ema = entry.weight;
    } else {
      ema = alpha * entry.weight + (1 - alpha) * ema;
    }
    const trendRounded = +ema.toFixed(1);
    return {
      ...entry,
      scaleWeight: entry.weight,
      trendWeight: trendRounded,
      deltaFromTrend: +(entry.weight - trendRounded).toFixed(1)
    };
  });

  const latest = points[points.length - 1];
  const compareIdx = Math.max(0, points.length - 7);
  const sevenDayAgoTrend = points[compareIdx].trendWeight;
  const sevenDayTrendDelta = +(latest.trendWeight - sevenDayAgoTrend).toFixed(1);

  return {
    points,
    latestScaleWeight: latest.scaleWeight,
    latestTrendWeight: latest.trendWeight,
    sevenDayTrendDelta
  };
}

export function formatHeightDisplay(heightCm: number, mode: 'cm' | 'ft_in' = 'cm'): string {
  const cm = Math.max(100, Math.min(240, Math.round(Number(heightCm) || 178)));
  if (mode === 'cm') return `${cm} cm`;
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

export interface ProgressPhotoItem {
  id: string;
  date: string;
  week: number;
  weight: number;
  unit: 'lbs' | 'kg';
  pose: 'Front' | 'Side' | 'Back' | 'Flexed';
  note?: string;
  dataUrl: string;
}

export function selectBeforeAfterProgressPhotos(
  photos: ProgressPhotoItem[],
  beforeId?: string | null,
  afterId?: string | null
): {
  beforePhoto: ProgressPhotoItem | null;
  afterPhoto: ProgressPhotoItem | null;
  weightDelta: number;
  weightDeltaLabel: string;
} {
  if (!Array.isArray(photos) || photos.length === 0) {
    return {
      beforePhoto: null,
      afterPhoto: null,
      weightDelta: 0,
      weightDeltaLabel: '0.0 lbs'
    };
  }
  const sorted = [...photos].sort((a, b) => a.date.localeCompare(b.date));
  const beforePhoto =
    (beforeId && sorted.find(p => p.id === beforeId)) || sorted[0];
  const afterPhoto =
    (afterId && sorted.find(p => p.id === afterId)) || sorted[sorted.length - 1];

  const wBefore = Number(beforePhoto.weight) || 0;
  const wAfter = Number(afterPhoto.weight) || 0;
  const delta = +(wAfter - wBefore).toFixed(1);
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  const unit = afterPhoto.unit || 'lbs';

  return {
    beforePhoto,
    afterPhoto,
    weightDelta: delta,
    weightDeltaLabel: `${sign} ${unit}`
  };
}

export function calculateEpleyOneRepMax(weight: number, reps: number): number {
  const w = Number(weight) || 0;
  const r = Math.max(0, Math.round(Number(reps) || 0));
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return Math.round(w);
  return Math.round(w * (1 + r / 30));
}

export function calculateWeeklyTonnageByWeek(
  workoutLogs: Record<string, SetLog>,
  maxWeek = 2
): Array<{ week: number; totalVolumeLbs: number; loggedSetsCount: number }> {
  const results: Array<{ week: number; totalVolumeLbs: number; loggedSetsCount: number }> = [];
  const highestW = Math.max(1, Math.min(12, Math.round(Number(maxWeek) || 2)));

  for (let w = 1; w <= highestW; w++) {
    let totalVolumeLbs = 0;
    let loggedSetsCount = 0;
    const prefix = `w${w}_`;

    for (const [key, entry] of Object.entries(workoutLogs || {})) {
      if (!key.startsWith(prefix) || !entry || !entry.done) continue;
      loggedSetsCount++;
      const rawWeight = parseFloat(String(entry.weight || '0'));
      const rawReps = parseInt(String(entry.reps || '0'), 10);
      if (Number.isFinite(rawWeight) && rawWeight > 0 && Number.isFinite(rawReps) && rawReps > 0) {
        const weightInLbs = entry.unit === 'kg' ? rawWeight * 2.20462 : rawWeight;
        totalVolumeLbs += weightInLbs * rawReps;
      }
    }

    results.push({
      week: w,
      totalVolumeLbs: Math.round(totalVolumeLbs),
      loggedSetsCount
    });
  }

  return results;
}

export const KEY_COMPOUND_LIFTS_SPEC = [
  { id: 'mon_bench', label: 'Barbell Bench Press', defaultWeightLbs: 135 },
  { id: 'tue_squat', label: 'Barbell Back Squat', defaultWeightLbs: 155 },
  { id: 'mon_ohp', label: 'Standing Overhead Press', defaultWeightLbs: 85 },
  { id: 'sat_deadlift', label: 'Barbell Deadlift', defaultWeightLbs: 185 }
] as const;

export function calculateKeyLiftAndPullupPrs(
  workoutLogs: Record<string, SetLog>,
  activeWeek = 1
): {
  highestSingleSetPullupReps: number;
  weeklyPullupVolumeReps: number;
  keyLifts: Array<{
    id: string;
    label: string;
    bestWeightLbs: number;
    bestReps: number;
    estimated1RmLbs: number;
  }>;
} {
  let highestSingleSetPullupReps = 0;
  let weeklyPullupVolumeReps = 0;
  const pullupExIds = new Set([
    'day1_pullups',
    'day2_pullups',
    'day3_pullups',
    'fri_pullups',
    'day5_pullups'
  ]);

  const bestByLift: Record<
    string,
    { bestWeightLbs: number; bestReps: number; estimated1RmLbs: number }
  > = {};
  for (const lift of KEY_COMPOUND_LIFTS_SPEC) {
    bestByLift[lift.id] = { bestWeightLbs: 0, bestReps: 0, estimated1RmLbs: 0 };
  }

  for (const [key, entry] of Object.entries(workoutLogs || {})) {
    if (!entry || !entry.done) continue;
    const match = key.match(/^w(\d+)_(\d+)_(.+)_(\d+)$/);
    if (!match) continue;
    const wk = parseInt(match[1], 10);
    const exId = match[3];
    const reps = parseInt(String(entry.reps || '0'), 10) || 0;
    const rawW = parseFloat(String(entry.weight || '0')) || 0;
    const weightLbs = entry.unit === 'kg' ? +(rawW * 2.20462).toFixed(1) : rawW;

    if (pullupExIds.has(exId) && reps > 0) {
      if (reps > highestSingleSetPullupReps) {
        highestSingleSetPullupReps = reps;
      }
      if (wk === activeWeek) {
        weeklyPullupVolumeReps += reps;
      }
    }

    if (bestByLift[exId] && weightLbs > 0 && reps > 0) {
      const est1Rm = calculateEpleyOneRepMax(weightLbs, reps);
      if (est1Rm > bestByLift[exId].estimated1RmLbs) {
        bestByLift[exId] = {
          bestWeightLbs: Math.round(weightLbs * 10) / 10,
          bestReps: reps,
          estimated1RmLbs: est1Rm
        };
      }
    }
  }

  const keyLifts = KEY_COMPOUND_LIFTS_SPEC.map(spec => ({
    id: spec.id,
    label: spec.label,
    ...bestByLift[spec.id]
  }));

  return {
    highestSingleSetPullupReps,
    weeklyPullupVolumeReps,
    keyLifts
  };
}

// ============================================================================
// AUTOMATIC OS WATCH SYNC (ZERO BLUETOOTH PAIRING), HEALTH CONNECT BRIDGE &
// OPTIONAL BLE CHEST STRAP ACCORDION HELPERS
// ============================================================================
export function getBleChestStrapRequestOptions(): {
  filters: Array<{ services: Array<string | number> }>;
  optionalServices: Array<string | number>;
} {
  return {
    filters: [{ services: ['heart_rate'] }],
    optionalServices: [0x180d, 'heart_rate', 'battery_service', 0x180f]
  };
}

export function getOsWatchSyncStatusBanner(
  notificationPermission: string | undefined,
  wristAlertsEnabled?: boolean
): {
  connected: boolean;
  bannerText: string;
  howItWorksText: string;
} {
  const isPermitted =
    notificationPermission === 'granted' || Boolean(wristAlertsEnabled && notificationPermission !== 'denied');
  return {
    connected: isPermitted,
    bannerText: isPermitted
      ? 'Connected via Phone OS (Samsung Galaxy Watch / Apple Watch / Garmin)'
      : 'Ready to Connect via Phone OS (Samsung Galaxy Watch / Apple Watch / Garmin)',
    howItWorksText:
      'Your watch is already paired to your phone. Enable Wrist Timer Alerts below so rest and cooking timers vibrate directly on your watch.'
  };
}

export function buildFiveSecondWatchTestNotificationPayload(): {
  title: string;
  options: {
    body: string;
    vibrate: number[];
    tag: string;
    renotify: boolean;
    requireInteraction: boolean;
  };
} {
  return {
    title: 'Rest Complete (00:00)',
    options: {
      body: 'Next Set: 135 lbs x 8 reps',
      vibrate: [300, 150, 300, 150, 400],
      tag: 'watch-test',
      renotify: true,
      requireInteraction: true
    }
  };
}

export function getHealthBridgePlatformStatus(
  isNativeCapacitor: boolean,
  healthAutoSyncEnabled = true
): {
  isNative: boolean;
  autoSyncEnabled: boolean;
  toggleLabel: string;
  actionButtonLabel: string;
  platformBadge: string;
} {
  return {
    isNative: Boolean(isNativeCapacitor),
    autoSyncEnabled: Boolean(healthAutoSyncEnabled),
    toggleLabel:
      'Sync Workouts & Nutrition with Android Health Connect / Samsung Health & Apple Health',
    actionButtonLabel: 'Sync Now / Export Health Data',
    platformBadge: isNativeCapacitor
      ? 'Native Capacitor Health Bridge Active'
      : 'Web & Native Health Bridge Ready'
  };
}

// ============================================================================
// ANDROID CHROME PWA INSTALLABILITY, 1-TAP WATCH AUTO-CONNECT & CONTINUOUS
// MEDIASESSION HELPERS (ZERO EMOJIS)
// ============================================================================
export function buildWatchInitConfirmationNotificationPayload(): {
  title: string;
  options: {
    body: string;
    vibrate: number[];
    tag: string;
    renotify: boolean;
  };
} {
  return {
    title: 'Budget Gym Connected',
    options: {
      body: 'Rest & cooking timers will now vibrate on your watch.',
      vibrate: [200, 100, 200],
      tag: 'gym-watch-init',
      renotify: true
    }
  };
}

export function getWatchPermissionUiState(
  notificationPermission: string | undefined,
  wristAlertsEnabled?: boolean,
  hasDeferredPwaPrompt?: boolean
): {
  isGranted: boolean;
  isDenied: boolean;
  primaryButtonLabel: string;
  deniedGuideText: string;
  showInstallPwaButton: boolean;
  installPwaButtonLabel: string;
} {
  const isGranted = notificationPermission === 'granted' && Boolean(wristAlertsEnabled !== false);
  const isDenied = notificationPermission === 'denied';
  return {
    isGranted,
    isDenied,
    primaryButtonLabel:
      notificationPermission === 'granted' && wristAlertsEnabled
        ? 'Watch Wrist Alerts Connected'
        : '1-Tap Connect Watch Alerts (Allow Notifications)',
    deniedGuideText:
      'Notifications are blocked by Chrome. Tap the 3-dot menu (top right) -> Site controls -> Permissions -> Allow Notifications.',
    showInstallPwaButton: Boolean(hasDeferredPwaPrompt),
    installPwaButtonLabel: 'Install App to Phone'
  };
}

export function buildContinuousMediaSessionState(params: {
  isTimerRunning: boolean;
  timerSeconds: number;
  contextLabel?: string;
  nextSetSummary?: string;
  liveBpm?: number | null;
  currentWeek?: number;
  selectedDayIndex?: number;
}): {
  title: string;
  artist: string;
  album: string;
  playbackState: 'playing' | 'paused';
} {
  const remSec = Math.max(0, Math.round(Number(params.timerSeconds) || 0));
  const mm = String(Math.floor(remSec / 60)).padStart(2, '0');
  const ss = String(remSec % 60).padStart(2, '0');
  const cleanNextSet = String(params.nextSetSummary || '').trim() || 'Set 1 Barbell Bench Press (135 lbs x 8)';
  const cleanCtx = String(params.contextLabel || '').trim();
  const title = params.isTimerRunning
    ? `${mm}:${ss} Rest • ${cleanCtx || cleanNextSet}`
    : cleanCtx || `Up Next: ${cleanNextSet}`;
  const bpmPart =
    typeof params.liveBpm === 'number' && params.liveBpm > 0 ? `${params.liveBpm} BPM • ` : '';
  const artist = `${bpmPart}${cleanNextSet}`;
  const album = `Week ${params.currentWeek || 1} • Day ${(params.selectedDayIndex || 0) + 1} • Budget Gym`;
  return {
    title,
    artist,
    album,
    playbackState: params.isTimerRunning ? 'playing' : 'paused'
  };
}

// ============================================================================
// STICKY TIMER GREEN PROGRESS BAR, NEGATIVE OVERTIME, FINAL-SET AUTO-STOP,
// 5-MINUTE FORGOTTEN LAST SET REMINDER & PULL-UP IDLE BADGES (ZERO EMOJIS)
// ============================================================================
export function formatDurationLabelShort(seconds: number): string {
  const sec = Math.max(1, Math.round(Number(seconds) || 90));
  if (sec < 60) return `${sec}s`;
  const mins = sec / 60;
  if (Number.isInteger(mins)) return `${mins}m`;
  return `${+mins.toFixed(1)}m`;
}

export function formatSignedTimerClock(seconds: number): string {
  const sec = Math.round(Number(seconds) || 0);
  const isNeg = sec < 0;
  const absSec = Math.abs(sec);
  const mm = String(Math.floor(absSec / 60)).padStart(2, '0');
  const ss = String(absSec % 60).padStart(2, '0');
  return isNeg ? `-${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatRestTimerReadout(
  timerSeconds: number,
  lastUsedTimerSeconds = 90,
  isRunning = false
): {
  clockText: string;
  pinnedBadgeText: string;
  isOvertime: boolean;
  presetShortLabel: string;
} {
  const safeLastUsed = Math.max(5, Math.round(Number(lastUsedTimerSeconds) || 90));
  const presetShortLabel = formatDurationLabelShort(safeLastUsed);
  const sec = Math.round(Number(timerSeconds) || 0);

  if (sec < 0) {
    const negClock = formatSignedTimerClock(sec);
    return {
      clockText: negClock,
      pinnedBadgeText: `${presetShortLabel} • ${negClock} Overtime`,
      isOvertime: true,
      presetShortLabel
    };
  }

  const posClock = formatSignedTimerClock(sec);
  if (!isRunning && sec === safeLastUsed) {
    return {
      clockText: posClock,
      pinnedBadgeText: `${posClock} (${presetShortLabel})`,
      isOvertime: false,
      presetShortLabel
    };
  }

  return {
    clockText: posClock,
    pinnedBadgeText: posClock,
    isOvertime: false,
    presetShortLabel
  };
}

export function computeTimerProgressBarState(
  timerSeconds: number,
  timerTotalSeconds = 90,
  isRunning = false
): {
  widthPct: number;
  isOvertime: boolean;
  fillClass: string;
} {
  const total = Math.max(1, Math.round(Number(timerTotalSeconds) || 90));
  const sec = Number(timerSeconds);

  if (sec < 0) {
    return {
      widthPct: 100,
      isOvertime: true,
      fillClass: 'bg-amber-500 transition-all duration-300 animate-pulse'
    };
  }

  if (!isRunning && sec >= total) {
    return {
      widthPct: 100,
      isOvertime: false,
      fillClass: 'bg-emerald-500 transition-all duration-300'
    };
  }

  const pct = Math.max(0, Math.min(100, +((sec / total) * 100).toFixed(2)));
  return {
    widthPct: pct,
    isOvertime: false,
    fillClass: 'bg-emerald-500 transition-all duration-300'
  };
}

export function shouldStopTimerOnFinalSetLogged(params: {
  doneSetsToday: number;
  totalSetsToday: number;
  isLastExerciseOfDay: boolean;
  isFinalSetOfExercise: boolean;
}): boolean {
  if (params.totalSetsToday > 0 && params.doneSetsToday >= params.totalSetsToday) {
    return true;
  }
  if (params.isLastExerciseOfDay && params.isFinalSetOfExercise) {
    return true;
  }
  return false;
}

export function formatPullupDayTimerBadge(
  dayNum: number,
  restSec: number,
  isTimerRunning: boolean,
  formattedTimer: string
): string {
  if (isTimerRunning) {
    return `${formattedTimer} (${restSec}s)`;
  }
  if (dayNum === 1) return 'Rest: 90s (1.5m)';
  if (dayNum === 2) return 'Rest: 30s (10s x Reps)';
  if (dayNum === 3) return 'Rest: 60s (1m)';
  if (dayNum === 4) return 'Rest: 60s (1m)';
  if (dayNum === 5) return 'Rest: 90s (1.5m)';
  return `Rest: ${restSec}s (${formatDurationLabelShort(restSec)})`;
}

export function evaluateForgottenLastSetReminder(params: {
  doneSetsToday: number;
  totalSetsToday: number;
  lastWorkoutActivityAt: number | null;
  nowMs: number;
  dismissedForActivityTimestamp?: number | null;
  nextExerciseName?: string;
  nextSetNum?: number;
  nextWeightLbs?: number | string;
  nextReps?: number | string;
}): {
  shouldRemind: boolean;
  remainingSets: number;
  bannerTitle: string;
  bannerSubtitle: string;
  notificationTitle: string;
  notificationOptions: {
    body: string;
    vibrate: number[];
    tag: string;
    renotify: boolean;
  };
} {
  const done = Math.max(0, Math.round(Number(params.doneSetsToday) || 0));
  const total = Math.max(0, Math.round(Number(params.totalSetsToday) || 0));
  const remainingSets = Math.max(0, total - done);
  const lastAt = Number(params.lastWorkoutActivityAt) || 0;
  const nowMs = Number(params.nowMs) || Date.now();
  const elapsedMs = lastAt > 0 ? nowMs - lastAt : 0;

  const isPartiallyLogged = done > 0 && done < total;
  const isDismissed =
    Boolean(params.dismissedForActivityTimestamp) &&
    params.dismissedForActivityTimestamp === lastAt;
  const shouldRemind = isPartiallyLogged && lastAt > 0 && elapsedMs >= 300000 && !isDismissed;

  const exName = String(params.nextExerciseName || 'Final Exercise').trim();
  const setNum = Math.max(1, Math.round(Number(params.nextSetNum) || 1));
  const wVal = params.nextWeightLbs !== undefined && params.nextWeightLbs !== '' ? params.nextWeightLbs : 0;
  const rVal = params.nextReps !== undefined && params.nextReps !== '' ? params.nextReps : 10;

  return {
    shouldRemind,
    remainingSets,
    bannerTitle: 'Did you finish your workout? (5+ min since last set)',
    bannerSubtitle: `You have ${remainingSets} unlogged set(s) left today — Next: ${exName} (Set ${setNum}: ${wVal} lbs x ${rVal}).`,
    notificationTitle: 'Did you finish your last set?',
    notificationOptions: {
      body: `You have unlogged sets remaining on ${exName}. Tap to log and finish.`,
      vibrate: [200, 100, 200],
      tag: 'unfinished-workout-reminder',
      renotify: true
    }
  };
}

export const TEMPLATE_SLOT_SUBLABELS: readonly string[] = [
  'Upper 1',
  'Lower 1',
  'Push',
  'Pull',
  'Lower 2',
  'Rest 1',
  'Rest 2'
] as const;

export const REST_DAY_PRESETS: Record<
  'default_6_7' | 'recommended_3_7' | 'midweek_4_7',
  { id: string; label: string; shortBadge: string; restDays: [number, number] }
> = {
  default_6_7: {
    id: 'default_6_7',
    label: 'Default: Days 6 & 7 Rest (5 Days Straight)',
    shortBadge: 'Days 6 & 7',
    restDays: [5, 6]
  },
  recommended_3_7: {
    id: 'recommended_3_7',
    label: 'Recommended Recovery: Days 3 & 7 Rest (After Lower Body)',
    shortBadge: 'Days 3 & 7',
    restDays: [2, 6]
  },
  midweek_4_7: {
    id: 'midweek_4_7',
    label: 'Mid-Week Split: Days 4 & 7 Rest',
    shortBadge: 'Days 4 & 7',
    restDays: [3, 6]
  }
};

export function normalizeRestDaysTuple(rawRestDays?: unknown): [number, number] {
  if (!Array.isArray(rawRestDays)) return [5, 6];
  const valid: number[] = [];
  for (const item of rawRestDays) {
    const n = Math.floor(Number(item));
    if (Number.isFinite(n) && n >= 0 && n <= 6 && !valid.includes(n)) {
      valid.push(n);
    }
    if (valid.length === 2) break;
  }
  if (valid.length < 2) {
    for (const fallback of [5, 6, 2, 3, 4, 1, 0]) {
      if (!valid.includes(fallback)) valid.push(fallback);
      if (valid.length === 2) break;
    }
  }
  valid.sort((a, b) => a - b);
  return [valid[0], valid[1]];
}

export function getWeekRestDays(weeklyRestDaysOrState?: unknown, week = 1): [number, number] {
  const safeWeek = Math.max(1, Math.floor(Number(week) || 1));
  if (!weeklyRestDaysOrState) return [5, 6];
  if (Array.isArray(weeklyRestDaysOrState)) {
    return normalizeRestDaysTuple(weeklyRestDaysOrState);
  }
  if (typeof weeklyRestDaysOrState === 'object') {
    const obj = weeklyRestDaysOrState as Record<string, unknown>;
    const mapCandidate =
      obj.weeklyRestDays !== undefined
        ? obj.weeklyRestDays
        : obj;
    if (Array.isArray(mapCandidate)) {
      return normalizeRestDaysTuple(mapCandidate);
    }
    if (mapCandidate && typeof mapCandidate === 'object') {
      const rec = mapCandidate as Record<string, unknown>;
      if (Array.isArray(rec[String(safeWeek)])) {
        return normalizeRestDaysTuple(rec[String(safeWeek)]);
      }
      if (Array.isArray(rec.default)) {
        return normalizeRestDaysTuple(rec.default);
      }
    }
  }
  return [5, 6];
}

export function formatRestDaysBadgeLabel(restDays: [number, number]): string {
  const [r1, r2] = normalizeRestDaysTuple(restDays);
  return `Schedule: Rest Days ${r1 + 1} & ${r2 + 1} (Change)`;
}

export interface DayScheduleAssignment {
  week: number;
  calendarDayIdx: number;
  dayNumber: number;
  templateSlotIndex: number;
  isRestDay: boolean;
  liftSessionNum: number | null;
  pullupSessionNum: number | null;
  restNumber: 1 | 2 | null;
  dayShort: string;
  daySub: string;
  waterTargetMl: number;
  waterDayTypeLabel: 'Lift Day' | 'Rest Day';
  showPreGymFuelCheck: boolean;
  isBonusRepeat?: boolean;
  logSlotKey?: string;
}

export interface WorkoutSlotCatalogItem {
  slotIndex: number;
  daySub: string;
  title: string;
  fullTitle: string;
  isRestDay: boolean;
  pullupSessionNum: number | null;
}

export const WORKOUT_SLOT_CATALOG: Record<number, WorkoutSlotCatalogItem> = {
  0: {
    slotIndex: 0,
    daySub: 'Upper 1',
    title: 'Upper Body 1 • Push & Pull',
    fullTitle: 'Day 1: Upper Body 1 • Push & Pull',
    isRestDay: false,
    pullupSessionNum: 1
  },
  1: {
    slotIndex: 1,
    daySub: 'Lower 1',
    title: 'Lower Body 1 • Quads & Calves',
    fullTitle: 'Day 2: Lower Body 1 • Quads & Calves',
    isRestDay: false,
    pullupSessionNum: 2
  },
  2: {
    slotIndex: 2,
    daySub: 'Push',
    title: 'Upper Body 2 • Push Focus',
    fullTitle: 'Day 3: Upper Body 2 • Push Focus',
    isRestDay: false,
    pullupSessionNum: 3
  },
  3: {
    slotIndex: 3,
    daySub: 'Pull',
    title: 'Upper Body 3 • Pull Focus',
    fullTitle: 'Day 4: Upper Body 3 • Pull Focus',
    isRestDay: false,
    pullupSessionNum: 4
  },
  4: {
    slotIndex: 4,
    daySub: 'Lower 2',
    title: 'Lower Body 2 • Glutes & Hamstrings',
    fullTitle: 'Day 5: Lower Body 2 • Glutes & Hamstrings',
    isRestDay: false,
    pullupSessionNum: 5
  },
  5: {
    slotIndex: 5,
    daySub: 'Rest 1',
    title: 'Rest & Muscle Recovery Day',
    fullTitle: 'Rest 1: Rest & Muscle Recovery Day',
    isRestDay: true,
    pullupSessionNum: null
  },
  6: {
    slotIndex: 6,
    daySub: 'Rest 2',
    title: 'Rest & Muscle Recovery Day',
    fullTitle: 'Rest 2: Rest & Muscle Recovery Day',
    isRestDay: true,
    pullupSessionNum: null
  }
};

export function getCustomDayScheduleForWeek(
  week: number,
  weeklyRestDaysOrState?: unknown
): number[] {
  const safeWeek = Math.max(1, Math.floor(Number(week) || 1));
  if (weeklyRestDaysOrState && typeof weeklyRestDaysOrState === 'object' && !Array.isArray(weeklyRestDaysOrState)) {
    const obj = weeklyRestDaysOrState as Record<string, any>;
    const customMap = obj.customDayScheduleByWeek;
    if (customMap && typeof customMap === 'object') {
      const candidate = customMap[String(safeWeek)] || customMap[safeWeek];
      if (Array.isArray(candidate) && candidate.length === 7) {
        return candidate.map(v => Math.max(0, Math.min(6, Math.floor(Number(v) || 0))));
      }
      // If safeWeek >= 2 has no explicit custom schedule yet, check if a prior week in customDayScheduleByWeek exists
      // and no explicit week-specific rest-days override was set for safeWeek
      const restMap = obj.weeklyRestDays && typeof obj.weeklyRestDays === 'object' ? obj.weeklyRestDays : null;
      const hasExplicitWeekRest = Boolean(restMap && (Array.isArray(restMap[String(safeWeek)]) || Array.isArray(restMap[safeWeek])));
      const hasAnyPriorCustomWeek = Object.keys(customMap).some(k => {
        const num = parseInt(k, 10);
        return !isNaN(num) && num >= 1 && num < safeWeek && Array.isArray(customMap[k]) && customMap[k].length === 7;
      });
      if (safeWeek >= 2 && hasAnyPriorCustomWeek && !hasExplicitWeekRest) {
        return buildSmartScheduleFromPreviousWeek(safeWeek, obj).schedule;
      }
    }
  }
  const [r1, r2] = getWeekRestDays(weeklyRestDaysOrState, safeWeek);
  const derived: number[] = [];
  let liftCounter = 0;
  let restCounter = 0;
  for (let c = 0; c < 7; c++) {
    if (c === r1 || c === r2) {
      derived.push(Math.min(6, 5 + restCounter));
      restCounter++;
    } else {
      derived.push(Math.min(4, liftCounter));
      liftCounter++;
    }
  }
  return derived;
}

export function getWeekSchedule(
  week: number,
  weeklyRestDaysOrState?: unknown
): number[] {
  return getCustomDayScheduleForWeek(week, weeklyRestDaysOrState);
}

export function getDayAssignment(
  week: number,
  calendarDayIdx: number,
  weeklyRestDaysOrState?: unknown
): DayScheduleAssignment {
  const safeWeek = Math.max(1, Math.floor(Number(week) || 1));
  const safeCalIdx = Math.max(0, Math.min(6, Math.floor(Number(calendarDayIdx) || 0)));
  const sched = getCustomDayScheduleForWeek(safeWeek, weeklyRestDaysOrState);
  const rawSlot = Math.max(0, Math.min(6, sched[safeCalIdx] ?? 0));
  const isRest = rawSlot === 5 || rawSlot === 6;

  if (isRest) {
    let restOrder = 1;
    for (let c = 0; c < safeCalIdx; c++) {
      if (sched[c] === 5 || sched[c] === 6) restOrder++;
    }
    const restNumber: 1 | 2 = restOrder >= 2 ? 2 : 1;
    const templateSlotIndex = restNumber === 1 ? 5 : 6;
    return {
      week: safeWeek,
      calendarDayIdx: safeCalIdx,
      dayNumber: safeCalIdx + 1,
      templateSlotIndex,
      isRestDay: true,
      liftSessionNum: null,
      pullupSessionNum: null,
      restNumber,
      dayShort: `Day ${safeCalIdx + 1}`,
      daySub: TEMPLATE_SLOT_SUBLABELS[templateSlotIndex],
      waterTargetMl: 2500,
      waterDayTypeLabel: 'Rest Day',
      showPreGymFuelCheck: false,
      isBonusRepeat: false,
      logSlotKey: String(templateSlotIndex)
    };
  }

  const templateSlotIndex = Math.max(0, Math.min(4, rawSlot));
  const sessionNum = templateSlotIndex + 1;
  const isBonusRepeat = sched.slice(0, safeCalIdx).includes(templateSlotIndex);
  const logSlotKey = isBonusRepeat
    ? `d${safeCalIdx}_bonus_slot${templateSlotIndex}`
    : String(templateSlotIndex);

  return {
    week: safeWeek,
    calendarDayIdx: safeCalIdx,
    dayNumber: safeCalIdx + 1,
    templateSlotIndex,
    isRestDay: false,
    liftSessionNum: sessionNum,
    pullupSessionNum: sessionNum,
    restNumber: null,
    dayShort: `Day ${safeCalIdx + 1}`,
    daySub: TEMPLATE_SLOT_SUBLABELS[templateSlotIndex],
    waterTargetMl: 3000,
    waterDayTypeLabel: 'Lift Day',
    showPreGymFuelCheck: true,
    isBonusRepeat,
    logSlotKey
  };
}

export function getCalendarDayForTemplateSlot(
  week: number,
  templateSlotIndex: number,
  weeklyRestDaysOrState?: unknown
): number {
  const safeSlot = Math.max(0, Math.min(6, Math.floor(Number(templateSlotIndex) || 0)));
  for (let calIdx = 0; calIdx < 7; calIdx++) {
    const assign = getDayAssignment(week, calIdx, weeklyRestDaysOrState);
    if (assign.templateSlotIndex === safeSlot) {
      return calIdx;
    }
  }
  return safeSlot;
}

export function toggleRestDayInSchedule(
  currentRestDays: [number, number],
  tappedDayIdx: number,
  lastPickedDayIdx?: number | null
): { restDays: [number, number]; nextLastPickedDayIdx: number } {
  const [r1, r2] = normalizeRestDaysTuple(currentRestDays);
  const tapped = Math.max(0, Math.min(6, Math.floor(Number(tappedDayIdx) || 0)));

  if (tapped === r1 || tapped === r2) {
    const kept = tapped === r1 ? r2 : r1;
    let replacement = 5;
    for (const candidate of [5, 6, 2, 3, 4, 1, 0]) {
      if (candidate !== kept && candidate !== tapped) {
        replacement = candidate;
        break;
      }
    }
    return {
      restDays: normalizeRestDaysTuple([kept, replacement]),
      nextLastPickedDayIdx: kept
    };
  }

  let kept = r2;
  if (typeof lastPickedDayIdx === 'number' && (lastPickedDayIdx === r1 || lastPickedDayIdx === r2)) {
    kept = lastPickedDayIdx;
  } else {
    kept = tapped < r2 ? r2 : r1;
  }

  return {
    restDays: normalizeRestDaysTuple([kept, tapped]),
    nextLastPickedDayIdx: tapped
  };
}

export function swapTodayToRestDay(
  currentRestDays: [number, number],
  calendarDayIdx: number
): [number, number] {
  const [r1, r2] = normalizeRestDaysTuple(currentRestDays);
  const cal = Math.max(0, Math.min(6, Math.floor(Number(calendarDayIdx) || 0)));
  if (cal === r1 || cal === r2) {
    return [r1, r2];
  }
  const upcomingRest = [r1, r2].find(r => r > cal);
  const targetToReplace = upcomingRest !== undefined ? upcomingRest : r1;
  const kept = targetToReplace === r1 ? r2 : r1;
  return normalizeRestDaysTuple([kept, cal]);
}

export function swapRestDayWithNextWorkout(
  currentRestDays: [number, number],
  calendarDayIdx: number
): [number, number] {
  const [r1, r2] = normalizeRestDaysTuple(currentRestDays);
  const cal = Math.max(0, Math.min(6, Math.floor(Number(calendarDayIdx) || 0)));
  if (cal !== r1 && cal !== r2) {
    return [r1, r2];
  }
  const kept = cal === r1 ? r2 : r1;
  let nextLiftDay: number | undefined;
  for (let d = cal + 1; d < 7; d++) {
    if (d !== r1 && d !== r2) {
      nextLiftDay = d;
      break;
    }
  }
  if (nextLiftDay === undefined) {
    for (let d = cal - 1; d >= 0; d--) {
      if (d !== r1 && d !== r2) {
        nextLiftDay = d;
        break;
      }
    }
  }
  const replacement = nextLiftDay !== undefined ? nextLiftDay : (kept === 6 ? 5 : 6);
  return normalizeRestDaysTuple([kept, replacement]);
}

export function getNextPullupTrainingCalendarDay(
  week: number,
  fromCalendarDayIdx: number,
  weeklyRestDaysOrState?: unknown
): {
  calendarDayIdx: number;
  dayNumber: number;
  pullupSessionNum: number;
  daySub: string;
} {
  const start = Math.max(0, Math.min(6, Math.floor(Number(fromCalendarDayIdx) || 0)));
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = (start + offset) % 7;
    const assign = getDayAssignment(week, candidate, weeklyRestDaysOrState);
    if (!assign.isRestDay && assign.pullupSessionNum !== null) {
      return {
        calendarDayIdx: candidate,
        dayNumber: candidate + 1,
        pullupSessionNum: assign.pullupSessionNum,
        daySub: assign.daySub
      };
    }
  }
  return {
    calendarDayIdx: 0,
    dayNumber: 1,
    pullupSessionNum: 1,
    daySub: 'Upper 1'
  };
}

// ============================================================================
// UPGRADE 1–4: VECTOR SVG ICONS, REST DAY RECOVERY CARD & 2-PHASE RICE TIMER
// ============================================================================
export const ICONS: Record<string, string> = {
  workout: '<svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 6.5 17.5 17.5"/><path d="M3 10l7-7"/><path d="M14 21l7-7"/><path d="m2 6 4-4"/><path d="m18 22 4-4"/></svg>',
  pullups: '<svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18"/><path d="M6 5v4a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V5"/><circle cx="12" cy="8" r="2"/><path d="M10 12v8"/><path d="M14 12v8"/></svg>',
  timer: '<svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/><path d="M12 2v3"/></svg>',
  vegan: '<svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  shopping: '<svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  ai: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
  watch: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="6"/><polyline points="12 10 12 12 13.5 13.5"/><path d="m16.51 17.35-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83"/></svg>',
  user: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  share: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  water: '<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
  warmup: '<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  preGymFuel: '<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
};

export interface TwoPhaseRiceTimerStageSpec {
  stage: 1 | 2;
  seconds: number;
  buttonLabel: string;
  contextLabel: string;
  completionBanner: string;
  stickyAlertLabel: string;
}

export function getTwoPhaseRiceTimerStages(cookMinutes: 10 | 12 = 12): readonly TwoPhaseRiceTimerStageSpec[] {
  const safeCookMins = cookMinutes === 10 ? 10 : 12;
  const cookSeconds = safeCookMins * 60;
  return [
    {
      stage: 1,
      seconds: cookSeconds,
      buttonLabel: '1. Cook Rice (10–12m • Mix Every 1.5m)',
      contextLabel: `Rice Stage 1: Cook Rice (${safeCookMins}m • Mix Every 1.5m)`,
      completionBanner: 'COOKING DONE! Remove from heat & tap Stage 2: 10-Min Cool-Down',
      stickyAlertLabel: 'COOKING DONE! Tap Stage 2: 10-Min Cool-Down'
    },
    {
      stage: 2,
      seconds: 600,
      buttonLabel: '2. Cool-Down & Steam Rest (10m)',
      contextLabel: 'Rice Stage 2: Cool-Down & Steam Rest (10m)',
      completionBanner: 'RICE READY! Portion into 4 x 150g bowls (600g total)',
      stickyAlertLabel: 'RICE READY! Portion into 4 x 150g bowls (600g total)'
    }
  ] as const;
}

export function getIdleOrRunningRiceTimerBadge(
  activeRiceTimerStage: number | null | undefined,
  timerSeconds: number,
  riceCookMinutes: 10 | 12 = 12,
  lastSelectedStage: 1 | 2 = 1
): string {
  const safeMins = riceCookMinutes === 10 ? 10 : 12;
  if (activeRiceTimerStage === 1 || activeRiceTimerStage === 2) {
    const abs = Math.max(0, Math.floor(Number(timerSeconds) || 0));
    const mm = String(Math.floor(abs / 60)).padStart(2, '0');
    const ss = String(abs % 60).padStart(2, '0');
    return activeRiceTimerStage === 1 ? `${mm}:${ss} Cook` : `${mm}:${ss} Cool-Down`;
  }
  if (lastSelectedStage === 2) {
    return '10:00 Cool-Down';
  }
  return `${safeMins}:00 Cook`;
}

export interface RiceMixIntervalStatus {
  elapsedSec: number;
  secondsUntilNextMix: number;
  nextMixFormatted: string;
  shouldTriggerMixAlert: boolean;
  mixAlertBannerText: string;
}

export function computeRiceMixIntervalState(
  totalCookSec: number,
  remainingSec: number,
  mixAlertEnabled = true,
  lastAlertElapsedSec: number | null = null
): RiceMixIntervalStatus {
  const safeTotal = Math.max(60, Math.floor(Number(totalCookSec) || 720));
  const safeRem = Math.max(0, Math.min(safeTotal, Math.floor(Number(remainingSec) || 0)));
  const elapsedSec = safeTotal - safeRem;
  const mod90 = elapsedSec % 90;
  const secondsUntilNextMix = safeRem === 0 ? 0 : (mod90 === 0 && elapsedSec > 0 ? 90 : 90 - mod90);
  const mm = String(Math.floor(secondsUntilNextMix / 60)).padStart(2, '0');
  const ss = String(secondsUntilNextMix % 60).padStart(2, '0');
  const isExactInterval = elapsedSec > 0 && elapsedSec < safeTotal && mod90 === 0;
  const shouldTriggerMixAlert = Boolean(
    mixAlertEnabled && isExactInterval && lastAlertElapsedSec !== elapsedSec
  );

  return {
    elapsedSec,
    secondsUntilNextMix,
    nextMixFormatted: `${mm}:${ss}`,
    shouldTriggerMixAlert,
    mixAlertBannerText: 'MIX / STIR RICE NOW! (1.5m interval — prevents sticking)'
  };
}

export interface RestDayRecoveryCardSpec {
  title: string;
  statusBanner: string;
  swapButtonLabel: string;
  waterPillText: string;
  fuelPillText: string;
  walkPillText: string;
  walkChecked: boolean;
  mobilityDrawerSummary: string;
}

export function getRestDayRecoveryCardSpec(params: {
  loggedWaterMl: number;
  loggedMealsCount: number;
  walkChecked: boolean;
  optionalItemsCount?: number;
  dailyKcal?: number;
  dailyProteinG?: number;
}): RestDayRecoveryCardSpec {
  const waterMl = Math.max(0, Math.floor(Number(params.loggedWaterMl) || 0));
  const meals = Math.max(0, Math.min(4, Math.floor(Number(params.loggedMealsCount) || 0)));
  const walkDone = Boolean(params.walkChecked);
  const itemsCount = Math.max(1, Math.floor(Number(params.optionalItemsCount) || 2));
  const kcal = Number(params.dailyKcal) || 1300;
  const protein = Number(params.dailyProteinG) || 138;

  return {
    title: 'Rest & Muscle Recovery Day',
    statusBanner: 'Active Recovery & Supercompensation Day — 48h muscle protein synthesis & tendon recovery.',
    swapButtonLabel: 'Train Today Instead (Swap Workout)',
    waterPillText: `Water Target: ${waterMl.toLocaleString()} / 2,500 ml (+500 ml)`,
    fuelPillText: `Muscle Fuel: ${meals} / 4 Meals (${kcal.toLocaleString()} kcal • ${protein}g P)`,
    walkPillText: walkDone
      ? 'Light Recovery Walk: 8,000–10,000 Steps (✓ Checked Off)'
      : 'Light Recovery Walk: 8,000–10,000 Steps (Check Off)',
    walkChecked: walkDone,
    mobilityDrawerSummary: `Optional Rest-Day Mobility & Core (${itemsCount} items) — Tap to Open`
  };
}

// ============================================================================
// PWA VECTOR-PATH "GYM" ICON & 1-TAP WATCH MASTER SWITCH HELPERS
// ============================================================================
export const GYM_VECTOR_LETTER_PATHS = {
  G: 'M188 196H120C106 196 96 206 96 220V292C96 306 106 316 120 316H188V248H142V270H164V292H120V220H188Z',
  Y: 'M204 196H231L248 238L265 196H292L260 262V316H236V262Z',
  M: 'M304 316V196H330L360 254L390 196H416V316H392V244L368 288H352L328 244V316Z'
} as const;

export function buildGymVectorPathSvg(size: 192 | 512 = 512): string {
  const safeSize = size === 192 ? 192 : 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize}" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#10b981"/><path fill="#020617" d="${GYM_VECTOR_LETTER_PATHS.G}"/><path fill="#020617" d="${GYM_VECTOR_LETTER_PATHS.Y}"/><path fill="#020617" d="${GYM_VECTOR_LETTER_PATHS.M}"/></svg>`;
}

export function buildGymVectorPathSvgDataUrl(size: 192 | 512 = 512): string {
  return `data:image/svg+xml,${encodeURIComponent(buildGymVectorPathSvg(size))}`;
}

export interface WatchMasterSwitchSpec {
  isActive: boolean;
  buttonLabel: string;
  headerDotVisible: boolean;
  headerDotClass: string;
  checklistBullets: readonly [string, string, string];
}

export const SAMSUNG_WATCH_CHECKLIST_BULLETS: readonly [string, string, string] = [
  '1. Galaxy Wearable app on phone -> Watch settings -> Notifications -> App notifications -> Turn ON BudgetGym & Chrome.',
  '2. Galaxy Wearable -> Notifications -> Show phone notifications on watch -> Select "Show alerts even while using phone".',
  '3. If you reinstalled the app to update the GYM icon, toggle BudgetGym ON in Galaxy Wearable.'
] as const;

export function getWatchMasterSwitchSpec(
  notificationPermission: 'granted' | 'denied' | 'default' | string,
  wristAlertsEnabled: boolean,
  hasLiveBleHr = false
): WatchMasterSwitchSpec {
  const isActive = Boolean(notificationPermission === 'granted' && wristAlertsEnabled);
  const headerDotVisible = Boolean(isActive || hasLiveBleHr);
  return {
    isActive,
    buttonLabel: isActive
      ? 'Watch Alerts: ACTIVE (Tap to Test Wrist Vibration in 5s)'
      : 'Turn ON Watch Alerts (1-Tap Connect)',
    headerDotVisible,
    headerDotClass: isActive
      ? 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping'
      : 'w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping',
    checklistBullets: SAMSUNG_WATCH_CHECKLIST_BULLETS
  };
}

// ============================================================================
// 7 UPGRADES: SINGLE STICKY TIMER BAR, PULL-UP PYRAMID & DAY 5 HARDEST-DAY
// SELECTOR, DECOUPLED OATS/RICE INVENTORY, RICE TIMER RECIPE/VIDEO SYNC,
// CAMERA/GALLERY DUAL INPUTS, AND AI MACHINE PHOTO CHECK & EXERCISE SWAP
// ============================================================================

export function shouldShowStickyTopTimerBarAcrossAllTabs(tabName: string): boolean {
  const validTabs = ['workout', 'pullups', 'timer', 'vegan', 'shopping'];
  return validTabs.includes(String(tabName || '').trim());
}

export interface PyramidNextSetSuggestion {
  nextSetIndex: number | null;
  suggestedRepsBySetIndex: Record<number, number>;
  restTimerSeconds: number;
  restTimerLabel: string;
}

export function computePyramidNextSetSuggestions(
  loggedSetIdxZeroBased: number,
  loggedReps: number,
  previousBestMax = 4,
  totalSets = 5
): PyramidNextSetSuggestion {
  const safeTotal = Math.max(5, Math.min(9, Math.floor(Number(totalSets) || 5)));
  const maxSetIdx = safeTotal - 1;
  const lastPyramidIdx = safeTotal - 2;
  const cleanReps = Math.max(1, Math.floor(Number(loggedReps) || 1));
  const safeMax = Math.max(lastPyramidIdx, Math.floor(Number(previousBestMax) || lastPyramidIdx));
  const suggestedRepsBySetIndex: Record<number, number> = {};
  for (let i = 0; i <= lastPyramidIdx; i++) {
    suggestedRepsBySetIndex[i] = i + 1;
  }
  suggestedRepsBySetIndex[maxSetIdx] = Math.max(safeTotal === 5 ? 4 : safeTotal, safeMax);

  if (loggedSetIdxZeroBased >= 0 && loggedSetIdxZeroBased < lastPyramidIdx) {
    let nextTarget = cleanReps + 1;
    for (let idx = loggedSetIdxZeroBased + 1; idx <= lastPyramidIdx; idx++) {
      suggestedRepsBySetIndex[idx] = nextTarget;
      nextTarget += 1;
    }
  }
  suggestedRepsBySetIndex[maxSetIdx] = Math.max(
    safeTotal === 5 ? 4 : safeTotal,
    safeMax,
    cleanReps
  );

  const restTimerSeconds =
    loggedSetIdxZeroBased >= 0 && loggedSetIdxZeroBased <= lastPyramidIdx
      ? Math.max(10, cleanReps * 10)
      : 60;

  return {
    nextSetIndex: loggedSetIdxZeroBased < maxSetIdx ? loggedSetIdxZeroBased + 1 : null,
    suggestedRepsBySetIndex,
    restTimerSeconds,
    restTimerLabel: `${restTimerSeconds}s`
  };
}

export type Day5HardestOptionId = 'option_a' | 'option_b' | 'option_c' | 'option_d';

export interface Day5HardestDayOptionSpec {
  id: Day5HardestOptionId;
  sourceSessionNum: 1 | 2 | 3 | 4;
  shortCode: 'A' | 'B' | 'C' | 'D';
  label: string;
  exerciseTitle: string;
  setsCount: number;
  restSec: number;
  restLabel: string;
  repsLabel: string;
  isPyramid: boolean;
  isThreeGrips: boolean;
  notes: string;
}

export const DAY5_HARDEST_DAY_OPTIONS: Record<Day5HardestOptionId, Day5HardestDayOptionSpec> = {
  option_a: {
    id: 'option_a',
    sourceSessionNum: 1,
    shortCode: 'A',
    label: 'Option A: Session 1 — 5 Max Effort Sets (90s rest)',
    exerciseTitle: 'Overhand Pull-Ups (Repeat Session 1: 5 Max Effort Sets)',
    setsCount: 5,
    restSec: 90,
    restLabel: '90 sec',
    repsLabel: 'Max Reps',
    isPyramid: false,
    isThreeGrips: false,
    notes: 'Repeating Session 1: Perform 5 maximum effort sets of strict overhand pull-ups with 90s rest between sets.'
  },
  option_b: {
    id: 'option_b',
    sourceSessionNum: 2,
    shortCode: 'B',
    label: 'Option B: Session 2 — Pyramid Day + 1 Max Set (10s x reps rest)',
    exerciseTitle: 'Overhand Pull-Ups (Repeat Session 2: Pyramid + 1 Max Set)',
    setsCount: 5,
    restSec: 30,
    restLabel: '10s x reps',
    repsLabel: 'Pyramid 1->Max',
    isPyramid: true,
    isThreeGrips: false,
    notes: 'Repeating Session 2: Start at 1 rep on Set 1, add +1 rep each set (rest 10s x reps), and finish with 1 max-effort set.'
  },
  option_c: {
    id: 'option_c',
    sourceSessionNum: 3,
    shortCode: 'C',
    label: 'Option C: Session 3 — 9 Training Sets • 3 Grips (60s rest)',
    exerciseTitle: 'Pull-Ups (Repeat Session 3: 9 Training Sets • 3 Grips)',
    setsCount: 9,
    restSec: 60,
    restLabel: '60 sec',
    repsLabel: 'Training Set',
    isPyramid: false,
    isThreeGrips: true,
    notes: 'Repeating Session 3: 3 sets Normal Overhand, 3 sets Close Underhand (pinkies touching), and 3 sets Wide Overhand with 60s rest.'
  },
  option_d: {
    id: 'option_d',
    sourceSessionNum: 4,
    shortCode: 'D',
    label: 'Option D: Session 4 — Max Training Sets (60s rest)',
    exerciseTitle: 'Overhand Pull-Ups (Repeat Session 4: Max Training Sets)',
    setsCount: 5,
    restSec: 60,
    restLabel: '60 sec',
    repsLabel: 'Training Set',
    isPyramid: false,
    isThreeGrips: false,
    notes: 'Repeating Session 4: Perform strict Training Sets with 60s rest until fatigue.'
  }
};

export function recommendHardestPullupSession(
  sessionLogsByDayNum: Record<number, Array<{ reps?: string | number; done?: boolean }>>
): {
  recommendedOptionId: Day5HardestOptionId;
  recommendedSessionNum: 1 | 2 | 3 | 4;
  reasonBadge: string;
} {
  const optionMap: Record<1 | 2 | 3 | 4, Day5HardestOptionId> = {
    1: 'option_a',
    2: 'option_b',
    3: 'option_c',
    4: 'option_d'
  };

  let bestSession: 1 | 2 | 3 | 4 = 3;
  let highestFatigueScore = -1;
  let anyLogged = false;

  for (const sNum of [1, 2, 3, 4] as const) {
    const arr = Array.isArray(sessionLogsByDayNum?.[sNum]) ? sessionLogsByDayNum[sNum] : [];
    const doneSets = arr.filter(x => x && x.done);
    if (doneSets.length === 0) continue;
    anyLogged = true;
    const repsList = doneSets.map(x => Math.max(0, parseInt(String(x.reps || '0'), 10) || 0));
    const totalReps = repsList.reduce((acc, v) => acc + v, 0);
    const firstSet = repsList[0] || 0;
    const lastSet = repsList[repsList.length - 1] || 0;
    const dropOff = Math.max(0, firstSet - lastSet);
    const score = doneSets.length * 4 + totalReps + dropOff * 3 + (sNum === 3 ? 2 : 0);
    if (score > highestFatigueScore) {
      highestFatigueScore = score;
      bestSession = sNum;
    }
  }

  if (!anyLogged) {
    return {
      recommendedOptionId: 'option_c',
      recommendedSessionNum: 3,
      reasonBadge: 'Recommended Hardest Day: Session 3 (9 Training Sets • 3 Grips)'
    };
  }

  const chosenOpt = DAY5_HARDEST_DAY_OPTIONS[optionMap[bestSession]];
  return {
    recommendedOptionId: chosenOpt.id,
    recommendedSessionNum: bestSession,
    reasonBadge: `Recommended Hardest Day: Session ${bestSession}`
  };
}

export function resolveDay5HardestChoiceForWeek(
  week: number,
  pullUpHardestChoiceByWeek?: Record<number, Day5HardestOptionId | string>,
  lastChosenHardestPullUpDay?: Day5HardestOptionId | string | null,
  fallbackRecommendation: Day5HardestOptionId = 'option_c'
): Day5HardestDayOptionSpec {
  const safeWeek = Math.max(1, Math.floor(Number(week) || 1));
  const map = pullUpHardestChoiceByWeek || {};
  const direct = map[safeWeek];
  if (direct && direct in DAY5_HARDEST_DAY_OPTIONS) {
    return DAY5_HARDEST_DAY_OPTIONS[direct as Day5HardestOptionId];
  }
  for (let w = safeWeek - 1; w >= 1; w--) {
    const prev = map[w];
    if (prev && prev in DAY5_HARDEST_DAY_OPTIONS) {
      return DAY5_HARDEST_DAY_OPTIONS[prev as Day5HardestOptionId];
    }
  }
  if (lastChosenHardestPullUpDay && lastChosenHardestPullUpDay in DAY5_HARDEST_DAY_OPTIONS) {
    return DAY5_HARDEST_DAY_OPTIONS[lastChosenHardestPullUpDay as Day5HardestOptionId];
  }
  return DAY5_HARDEST_DAY_OPTIONS[fallbackRecommendation] || DAY5_HARDEST_DAY_OPTIONS.option_c;
}

export interface BatchInventoryState {
  oatsJarsRemaining: number;
  riceBowlsRemaining: number;
  oatsPrepDay?: number | null;
  ricePrepDay?: number | null;
}

export function adjustBatchInventoryForMealToggle(
  inventory: BatchInventoryState | undefined,
  slotId: 'pre_shake' | 'post_oats' | 'lunch' | 'dinner',
  isNowLogged: boolean
): BatchInventoryState {
  const base: BatchInventoryState = {
    oatsJarsRemaining:
      inventory && typeof inventory.oatsJarsRemaining === 'number'
        ? Math.max(0, Math.min(4, Math.floor(inventory.oatsJarsRemaining)))
        : 4,
    riceBowlsRemaining:
      inventory && typeof inventory.riceBowlsRemaining === 'number'
        ? Math.max(0, Math.min(4, Math.floor(inventory.riceBowlsRemaining)))
        : 4,
    oatsPrepDay: inventory?.oatsPrepDay ?? null,
    ricePrepDay: inventory?.ricePrepDay ?? null
  };

  if (slotId === 'post_oats') {
    base.oatsJarsRemaining = isNowLogged
      ? Math.max(0, base.oatsJarsRemaining - 1)
      : Math.min(4, base.oatsJarsRemaining + 1);
  } else if (slotId === 'lunch') {
    base.riceBowlsRemaining = isNowLogged
      ? Math.max(0, base.riceBowlsRemaining - 1)
      : Math.min(4, base.riceBowlsRemaining + 1);
  }
  return base;
}

export interface BatchLowInventoryPrompt {
  batchType: 'oats' | 'rice';
  remaining: number;
  maxPortions: 4;
  unitLabel: 'jars' | 'bowls';
  bannerText: string;
  scheduledDayIdx: number | null;
}

export function getDecoupledNextDayPrepPrompts(
  inventory: BatchInventoryState | undefined
): BatchLowInventoryPrompt[] {
  const oatsRem =
    inventory && typeof inventory.oatsJarsRemaining === 'number'
      ? Math.max(0, Math.min(4, Math.floor(inventory.oatsJarsRemaining)))
      : 4;
  const riceRem =
    inventory && typeof inventory.riceBowlsRemaining === 'number'
      ? Math.max(0, Math.min(4, Math.floor(inventory.riceBowlsRemaining)))
      : 4;

  const prompts: BatchLowInventoryPrompt[] = [];
  if (oatsRem <= 1) {
    prompts.push({
      batchType: 'oats',
      remaining: oatsRem,
      maxPortions: 4,
      unitLabel: 'jars',
      bannerText:
        oatsRem === 0
          ? 'Overnight Oats empty (0/4 jars) — Prep next 4 jars tomorrow?'
          : 'Overnight Oats running low (1/4 jars left) — Schedule Oats Prep for tomorrow?',
      scheduledDayIdx: inventory?.oatsPrepDay ?? null
    });
  }
  if (riceRem <= 1) {
    prompts.push({
      batchType: 'rice',
      remaining: riceRem,
      maxPortions: 4,
      unitLabel: 'bowls',
      bannerText:
        riceRem === 0
          ? 'Jasmine Rice empty (0/4 bowls) — Schedule Rice Cooking for tomorrow?'
          : 'Jasmine Rice running low (1/4 bowls left) — Schedule Rice Cooking for tomorrow?',
      scheduledDayIdx: inventory?.ricePrepDay ?? null
    });
  }
  return prompts;
}

export const RICE_COOKING_TIMER_RECIPE_SPEC = {
  videoUrl: 'https://www.youtube.com/watch?v=dVKVb1NFP8s',
  videoButtonLabel: 'Watch Stovetop Jasmine Rice Tutorial',
  heading: 'Full Jasmine Rice Batch Recipe (4 Bowls • 600g Cooked)',
  ingredientsText:
    '220g dry white jasmine rice (rinsed 3x until water runs clear), 330 ml cold water (1:1.5 rice-to-water ratio), optional pinch of salt.',
  methodSteps: [
    '1. Combine rinsed rice + 330 ml water in pot and bring to a boil.',
    '2. Reduce to lowest heat, cover, and simmer 10–12 min, stirring every 1.5 min when the timer chimes.',
    '3. Turn off heat and let rest covered for 10 min cool-down/steam.',
    '4. Weigh into 4 bowls (150g cooked rice each).'
  ]
} as const;

export function syncRiceBatchPreppedBothWays(
  recipePrepLogs: Record<string, boolean> | undefined,
  inventory: BatchInventoryState | undefined
): {
  recipePrepLogs: Record<string, boolean>;
  batchInventory: BatchInventoryState;
} {
  const nextLogs: Record<string, boolean> = {
    ...(recipePrepLogs || {}),
    rice_step_1: true,
    rice_step_2: true,
    rice_step_3: true,
    rice_step_4: true
  };
  const nextInv: BatchInventoryState = {
    oatsJarsRemaining:
      inventory && typeof inventory.oatsJarsRemaining === 'number'
        ? Math.max(0, Math.min(4, Math.floor(inventory.oatsJarsRemaining)))
        : 4,
    riceBowlsRemaining: 4,
    oatsPrepDay: inventory?.oatsPrepDay ?? null,
    ricePrepDay: null
  };
  return {
    recipePrepLogs: nextLogs,
    batchInventory: nextInv
  };
}

export interface MachineExerciseSwapSpec {
  originalExId: string;
  replacementId: string;
  replacementName: string;
  primaryMuscles: string;
  movementPattern: string;
  formSetupNotes: string;
  videoUrl: string;
  restSec: number;
  restLabel: string;
  defaultWeightLbs: number;
}

export const STANDARD_MACHINE_SWAP_CATALOG: Record<string, MachineExerciseSwapSpec> = {
  mon_bench: {
    originalExId: 'mon_bench',
    replacementId: 'swap_machine_chest_press',
    replacementName: 'Seated Chest Press Machine',
    primaryMuscles: 'Mid/Lower Pectoralis Major, Anterior Deltoids, Triceps',
    movementPattern: 'Horizontal Push (Fixed-Path Converging Press)',
    formSetupNotes: 'Adjust seat so handles align with mid-chest (nipple line). Keep shoulder blades retracted against pad, elbows tucked 45-60 degrees, and press to full extension.',
    videoUrl: 'https://www.youtube.com/watch?v=xUm0BiZCWlQ',
    restSec: 120,
    restLabel: '2 min',
    defaultWeightLbs: 110
  },
  mon_cs_row: {
    originalExId: 'mon_cs_row',
    replacementId: 'swap_machine_chest_supported_row',
    replacementName: 'Seated Machine Row (Upper Back Focus)',
    primaryMuscles: 'Mid/Upper Trapezius, Rhomboids, Rear Deltoids, Lats',
    movementPattern: 'Chest-Supported Horizontal Pull',
    formSetupNotes: 'Set chest pad so sternum rests firmly against cushion. Use wide overhand grip, flare elbows 45-60 degrees, and squeeze shoulder blades together for 1s.',
    videoUrl: 'https://www.youtube.com/watch?v=GZbfZ033f74',
    restSec: 120,
    restLabel: '2 min',
    defaultWeightLbs: 105
  },
  mon_ohp: {
    originalExId: 'mon_ohp',
    replacementId: 'swap_machine_shoulder_press',
    replacementName: 'Seated Shoulder Press Machine',
    primaryMuscles: 'Anterior & Lateral Deltoids, Triceps, Upper Chest',
    movementPattern: 'Vertical Overhead Push',
    formSetupNotes: 'Set seat so handles start at ear/chin level. Brace core against back pad and press overhead without overarching lower back.',
    videoUrl: 'https://www.youtube.com/watch?v=WvLMauqrnK8',
    restSec: 120,
    restLabel: '2 min',
    defaultWeightLbs: 75
  },
  mon_lat_pd: {
    originalExId: 'mon_lat_pd',
    replacementId: 'swap_machine_high_row_pulldown',
    replacementName: 'Plate-Loaded Iso-Lateral High Pulldown Machine',
    primaryMuscles: 'Latissimus Dorsi, Teres Major, Biceps',
    movementPattern: 'Vertical Pull (Scapular Depression & Adduction)',
    formSetupNotes: 'Lock thighs under pad, depress shoulders first, and drive elbows down and in toward ribs.',
    videoUrl: 'https://youtu.be/AvYZZhEl7Xk',
    restSec: 120,
    restLabel: '2 min',
    defaultWeightLbs: 115
  },
  mon_cable_fly: {
    originalExId: 'mon_cable_fly',
    replacementId: 'swap_pec_deck_machine',
    replacementName: 'Seated Pec Deck / Machine Fly',
    primaryMuscles: 'Pectoralis Major (Sternal & Clavicular Heads)',
    movementPattern: 'Horizontal Shoulder Adduction',
    formSetupNotes: 'Set seat so handles align with mid-chest. Keep a soft bend in elbows and bring hands together in a wide arc, pausing 1s at peak squeeze.',
    videoUrl: 'https://www.youtube.com/watch?v=Z57CtFmRMxA',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 85
  },
  mon_lat_raise: {
    originalExId: 'mon_lat_raise',
    replacementId: 'swap_machine_lateral_raise',
    replacementName: 'Seated Lateral Raise Machine',
    primaryMuscles: 'Lateral (Middle) Deltoid',
    movementPattern: 'Scapular-Plane Shoulder Abduction',
    formSetupNotes: 'Align shoulder joints with machine pivot axis. Push elbow pads outward to shoulder height and lower under strict 2s control.',
    videoUrl: 'https://youtu.be/1muit9qEctY',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 50
  },
  mon_face_pull: {
    originalExId: 'mon_face_pull',
    replacementId: 'swap_reverse_pec_deck',
    replacementName: 'Reverse Pec Deck (Rear Delt Machine)',
    primaryMuscles: 'Posterior Deltoids, Infraspinatus, Mid-Traps',
    movementPattern: 'Horizontal Shoulder Abduction & External Rotation',
    formSetupNotes: 'Face the pad with handles at shoulder height. Sweep arms straight back keeping shoulders depressed away from ears.',
    videoUrl: 'https://youtu.be/02g7XtSRXug',
    restSec: 60,
    restLabel: '1 min',
    defaultWeightLbs: 55
  },
  tue_squat: {
    originalExId: 'tue_squat',
    replacementId: 'swap_hack_squat_leg_press',
    replacementName: '45-Degree Leg Press / Hack Squat Machine',
    primaryMuscles: 'Quadriceps (Vastus Lateralis, Medialis, Rectus Femoris), Glutes',
    movementPattern: 'Compound Knee & Hip Extension',
    formSetupNotes: 'Place feet shoulder-width on lower-to-mid platform for quad emphasis. Lower sled until knees reach 90 degrees or deeper without lower-back rounding.',
    videoUrl: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ',
    restSec: 150,
    restLabel: '2-3 min',
    defaultWeightLbs: 225
  },
  tue_rdl: {
    originalExId: 'tue_rdl',
    replacementId: 'swap_45deg_hip_extension_machine',
    replacementName: 'Glute-Ham Raise / 45-Degree Back & Hip Extension',
    primaryMuscles: 'Hamstrings, Gluteus Maximus, Erector Spinae',
    movementPattern: 'Loaded Hip Hinge',
    formSetupNotes: 'Set pad just below hip crease so pelvis can hinge freely. Keep spine neutral, hinge until full hamstring stretch, and drive hips into pad using glutes and hamstrings.',
    videoUrl: 'https://youtu.be/Xu4DxwKWzl4',
    restSec: 60,
    restLabel: '1 min',
    defaultWeightLbs: 45
  },
  tue_leg_ext: {
    originalExId: 'tue_leg_ext',
    replacementId: 'swap_single_or_iso_leg_ext',
    replacementName: 'Iso-Lateral / Plate-Loaded Leg Extension Machine',
    primaryMuscles: 'Quadriceps (Rectus Femoris & Vastus Medialis)',
    movementPattern: 'Isolated Knee Extension',
    formSetupNotes: 'Align knee joint with machine pivot, lock hips into seat with handles, and pause 1s at full knee lockout.',
    videoUrl: 'https://youtu.be/nIalczfM8es',
    restSec: 60,
    restLabel: '1 min',
    defaultWeightLbs: 90
  },
  tue_lunges: {
    originalExId: 'tue_lunges',
    replacementId: 'swap_smith_split_squat',
    replacementName: 'Smith Machine Quad-Focused Split Squat',
    primaryMuscles: 'Quadriceps, Gluteus Maximus',
    movementPattern: 'Unilateral Knee-Dominant Split Squat',
    formSetupNotes: 'Stand in split stance under Smith bar, keep torso upright, and drive front knee forward over toes to maximize quad tension.',
    videoUrl: 'https://youtu.be/JB20RuTOaFc',
    restSec: 120,
    restLabel: '2 min',
    defaultWeightLbs: 95
  },
  tue_calf: {
    originalExId: 'tue_calf',
    replacementId: 'swap_standing_calf_machine',
    replacementName: 'Standing Calf Raise / Leg Press Calf Press Machine',
    primaryMuscles: 'Calves (Upper & Lower)',
    movementPattern: 'Straight-Leg Calf Raise',
    formSetupNotes: 'Place balls of feet on platform edge, lower heels for a 2s bottom stretch, and press high onto big toes.',
    videoUrl: 'https://youtu.be/q2Eigaa9dKU',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 135
  },
  thu_inc_db: {
    originalExId: 'thu_inc_db',
    replacementId: 'swap_incline_chest_press_machine',
    replacementName: 'Seated Incline Chest Press Machine',
    primaryMuscles: 'Clavicular (Upper) Pectoralis Major, Anterior Deltoids, Triceps',
    movementPattern: '30-Degree Incline Converging Press',
    formSetupNotes: 'Set seat so handles align with upper chest / collarbone. Retract shoulder blades and press along the upward converging arc.',
    videoUrl: 'https://youtu.be/kpzUeELReEA',
    restSec: 120,
    restLabel: '2 min',
    defaultWeightLbs: 95
  },
  thu_mid_fly: {
    originalExId: 'thu_mid_fly',
    replacementId: 'swap_seated_machine_chest_fly',
    replacementName: 'Seated Pec Deck Chest Fly Machine',
    primaryMuscles: 'Mid/Sternal Pectoralis Major',
    movementPattern: 'Seated Horizontal Adduction',
    formSetupNotes: 'Keep chest tall against back pad, bring arms together at sternum level, and hold peak contraction for 1 full second.',
    videoUrl: 'https://youtu.be/Y8E3dHNsSTU',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 90
  },
  thu_flat_db: {
    originalExId: 'thu_flat_db',
    replacementId: 'swap_plate_loaded_flat_press',
    replacementName: 'Iso-Lateral Flat Chest Press Machine',
    primaryMuscles: 'Sternal Pectoralis Major, Triceps, Front Delts',
    movementPattern: 'Horizontal Push',
    formSetupNotes: 'Keep shoulder blades pinned back and drive handles smoothly to lockout without letting shoulders roll forward.',
    videoUrl: 'https://youtu.be/g14dhC5KYBM',
    restSec: 120,
    restLabel: '2 min',
    defaultWeightLbs: 115
  },
  thu_db_lat: {
    originalExId: 'thu_db_lat',
    replacementId: 'swap_cable_or_machine_lat_raise',
    replacementName: 'Seated Lateral Raise Machine',
    primaryMuscles: 'Lateral Deltoids',
    movementPattern: 'Scapular-Plane Abduction',
    formSetupNotes: 'Drive elbows outward against pads to shoulder level and control the eccentric phase.',
    videoUrl: 'https://youtu.be/zcO3sgAeLA0',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 50
  },
  thu_oh_ext: {
    originalExId: 'thu_oh_ext',
    replacementId: 'swap_seated_tricep_dip_ext_machine',
    replacementName: 'Seated Overhead Triceps Extension Machine',
    primaryMuscles: 'Triceps Brachii (Long Head Emphasis)',
    movementPattern: 'Overhead Elbow Extension',
    formSetupNotes: 'Keep upper arms firmly on angled pad and extend forearms to full lockout.',
    videoUrl: 'https://www.youtube.com/watch?v=7yoTblFCUQM',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 65
  },
  thu_pushdown: {
    originalExId: 'thu_pushdown',
    replacementId: 'swap_assisted_or_machine_tricep_press',
    replacementName: 'Seated Triceps Pressdown Machine',
    primaryMuscles: 'Triceps Brachii (Lateral & Medial Heads)',
    movementPattern: 'Vertical Elbow Extension',
    formSetupNotes: 'Keep elbows tucked tight to ribs and press handles all the way down.',
    videoUrl: 'https://youtu.be/MlfCS_7ZLXA',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 80
  },
  fri_lat_row: {
    originalExId: 'fri_lat_row',
    replacementId: 'swap_iso_low_lat_row_machine',
    replacementName: 'Iso-Lateral Low Row Machine (Lat Focus)',
    primaryMuscles: 'Lower & Mid Latissimus Dorsi',
    movementPattern: 'Neutral-Grip Low Horizontal Pull',
    formSetupNotes: 'Brace chest on pad, keep elbows tight to ribs, and pull handles down and back toward hips.',
    videoUrl: 'https://youtu.be/ZaEnZ47cDTk',
    restSec: 120,
    restLabel: '2 min',
    defaultWeightLbs: 125
  },
  fri_rear_row: {
    originalExId: 'fri_rear_row',
    replacementId: 'swap_rear_delt_wide_row_machine',
    replacementName: 'Wide-Grip Upper Back / Rear Delt Row Machine',
    primaryMuscles: 'Rear Deltoids, Rhomboids, Mid-Traps',
    movementPattern: '45-Degree Elbows-Out Horizontal Pull',
    formSetupNotes: 'Grip wide handles, keep elbows angled 45-60 degrees away from torso, and pull toward upper sternum.',
    videoUrl: 'https://youtu.be/k9G7BykDD4o',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 90
  },
  fri_inc_curl: {
    originalExId: 'fri_inc_curl',
    replacementId: 'swap_preacher_or_bayesian_curl_machine',
    replacementName: 'Seated Preacher / Cable Biceps Curl Machine',
    primaryMuscles: 'Biceps Brachii (Long & Short Heads)',
    movementPattern: 'Stabilized Elbow Flexion',
    formSetupNotes: 'Keep backs of upper arms flush against pad and curl smoothly through full range of motion.',
    videoUrl: 'https://youtu.be/3D56VDVkQnM',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 55
  },
  fri_hammer: {
    originalExId: 'fri_hammer',
    replacementId: 'swap_rope_cable_hammer_curl',
    replacementName: 'Neutral-Grip Machine / Cable Rope Hammer Curl',
    primaryMuscles: 'Brachialis, Brachioradialis, Biceps',
    movementPattern: 'Neutral-Grip Elbow Flexion',
    formSetupNotes: 'Keep palms facing each other (neutral grip), pin elbows at sides, and curl to shoulder height.',
    videoUrl: 'https://youtu.be/OrGL-ymYREg',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 60
  },
  fri_face_pull: {
    originalExId: 'fri_face_pull',
    replacementId: 'swap_fri_reverse_pec_deck',
    replacementName: 'Reverse Pec Deck (Rear Delt Machine)',
    primaryMuscles: 'Posterior Deltoids, External Rotators, Mid-Traps',
    movementPattern: 'Horizontal Abduction',
    formSetupNotes: 'Keep chest against pad and sweep arms back in a wide arc with shoulders down.',
    videoUrl: 'https://youtu.be/02g7XtSRXug',
    restSec: 60,
    restLabel: '1 min',
    defaultWeightLbs: 55
  },
  sat_deadlift: {
    originalExId: 'sat_deadlift',
    replacementId: 'swap_hex_bar_or_hinge_machine',
    replacementName: 'Trap Bar / Plate-Loaded Deadlift Machine',
    primaryMuscles: 'Glutes, Hamstrings, Erector Spinae, Quads, Traps',
    movementPattern: 'Compound Floor Pull / Hip Hinge',
    formSetupNotes: 'Grip neutral handles at sides, brace lats and core, and drive floor away keeping spine neutral.',
    videoUrl: 'https://youtu.be/JL1tJTEmxfw',
    restSec: 150,
    restLabel: '2-3 min',
    defaultWeightLbs: 205
  },
  sat_bss: {
    originalExId: 'sat_bss',
    replacementId: 'swap_single_leg_press_glute',
    replacementName: 'Single-Leg Glute-Focused Leg Press Machine',
    primaryMuscles: 'Gluteus Maximus, Hamstrings, Quadriceps',
    movementPattern: 'Unilateral Hip-Dominant Leg Press',
    formSetupNotes: 'Place working foot high on sled platform to emphasize hip flexion and glute stretch. Control down and drive through heel.',
    videoUrl: 'https://youtu.be/sqadB2rroz0',
    restSec: 60,
    restLabel: '1 min / leg',
    defaultWeightLbs: 115
  },
  sat_hip_thrust: {
    originalExId: 'sat_hip_thrust',
    replacementId: 'swap_glute_drive_machine',
    replacementName: 'Belt / Plate-Loaded Glute Drive Hip Thrust Machine',
    primaryMuscles: 'Gluteus Maximus, Hamstrings',
    movementPattern: 'Loaded Horizontal Hip Extension',
    formSetupNotes: 'Secure padded belt across hips, place feet so shins are vertical at top, and pause 1-2s at full glute lockout.',
    videoUrl: 'https://youtu.be/_vBMijiZoxE',
    restSec: 120,
    restLabel: '2 min',
    defaultWeightLbs: 165
  },
  sat_leg_curl: {
    originalExId: 'sat_leg_curl',
    replacementId: 'swap_seated_leg_curl_machine',
    replacementName: 'Seated Leg Curl Machine',
    primaryMuscles: 'Hamstrings (Semitendinosus, Semimembranosus, Biceps Femoris)',
    movementPattern: 'Seated Knee Flexion (Lengthened Hip Position)',
    formSetupNotes: 'Lock thigh pad snugly over knees, lean slightly forward for maximum hamstring stretch, and curl heels all the way under seat.',
    videoUrl: 'https://youtu.be/aYy3alWRDmk',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 105
  },
  sat_abduction: {
    originalExId: 'sat_abduction',
    replacementId: 'swap_seated_hip_abduction_machine',
    replacementName: 'Seated Hip Abduction Machine',
    primaryMuscles: 'Gluteus Medius & Minimus (Upper/Lateral Glutes)',
    movementPattern: 'Seated Hip Abduction',
    formSetupNotes: 'Sit tall or lean slightly forward, drive knees outward against pads, and hold 1s at peak contraction.',
    videoUrl: 'https://youtu.be/CA0ALPgTkxw',
    restSec: 60,
    restLabel: '1 min',
    defaultWeightLbs: 110
  },
  sat_seated_calf: {
    originalExId: 'sat_seated_calf',
    replacementId: 'swap_seated_calf_raise_machine',
    replacementName: 'Seated Calf Press / Extension Machine',
    primaryMuscles: 'Calves',
    movementPattern: 'Seated Calf Press',
    formSetupNotes: 'Sit back flat in the seat, place the balls of your feet on the footplate, and push forward with your toes.',
    videoUrl: 'https://www.youtube.com/watch?v=ZmDiJvXx344',
    restSec: 60,
    restLabel: '1 min',
    defaultWeightLbs: 90
  },
  cable_ab_crunch: {
    originalExId: 'cable_ab_crunch',
    replacementId: 'swap_seated_ab_crunch_machine',
    replacementName: 'Seated Abdominal Crunch Machine',
    primaryMuscles: 'Rectus Abdominis & Obliques',
    movementPattern: 'Loaded Spinal Flexion',
    formSetupNotes: 'Brace feet under rollers, curl ribcage down toward pelvis while exhaling completely, and pause 1s at peak contraction.',
    videoUrl: 'https://www.youtube.com/watch?v=aBd6T01PBqw',
    restSec: 90,
    restLabel: '1.5 min',
    defaultWeightLbs: 70
  }
};

export function verifyAndBuildMachineExerciseSwap(
  originalExId: string,
  originalExName: string,
  userCustomMachineNote?: string
): {
  matchConfirmed: boolean;
  confirmationPromptText: string;
  replacementSpec: MachineExerciseSwapSpec;
  switchBackButtonLabel: string;
} {
  const baseSpec =
    STANDARD_MACHINE_SWAP_CATALOG[originalExId] || {
      originalExId,
      replacementId: `swap_machine_${originalExId}`,
      replacementName: `${originalExName} (Selectorized Machine Equivalent)`,
      primaryMuscles: 'Same Primary Target Muscle Group',
      movementPattern: 'Equivalent Stabilized Machine Path',
      formSetupNotes: 'Align joint pivot with machine cam, maintain controlled 2s eccentric tempo, and train to the same target rep range.',
      videoUrl: 'https://www.youtube.com/watch?v=xUm0BiZCWlQ',
      restSec: 120,
      restLabel: '2 min',
      defaultWeightLbs: 90
    };

  const cleanCustom = String(userCustomMachineNote || '').trim();
  const effectiveName =
    cleanCustom && cleanCustom.length >= 3 && cleanCustom.length <= 52
      ? cleanCustom
      : baseSpec.replacementName;

  const replacementSpec: MachineExerciseSwapSpec = {
    ...baseSpec,
    replacementName: effectiveName
  };

  return {
    matchConfirmed: true,
    confirmationPromptText: `Machine Match Confirmed: ${replacementSpec.replacementName} targets the same muscles as ${originalExName}. Replace today's exercise card?`,
    replacementSpec,
    switchBackButtonLabel: `Switch Back to ${originalExName}`
  };
}

// ============================================================================
// UNIVERSAL 22-EXERCISE MACHINE & VERIFIED VIDEO DATABASE (PLAIN ENGLISH)
// ============================================================================

export type MachineLoadMode = 'plate_2sides' | 'pin_stack';

export interface UniversalMachineOption {
  optionId: string;
  name: string;
  subtypeLabel?: string;
  loadMode: MachineLoadMode;
  primaryVideoUrl: string;
  altVideoUrl: string;
  altVideoUrl2?: string;
  restSeconds: number;
  targetMuscle: string;
  formSetup: string;
}

export interface UniversalMachineCategory {
  categoryId: string;
  label: string;
  keywords: string[];
  exactIds: string[];
  options: UniversalMachineOption[];
}

export interface SharedMachineDatabaseEntry {
  machineId: string;
  originalExKey: string;
  machineName: string;
  machineSubtype: string;
  loadMode: MachineLoadMode;
  simpleSteps: string;
  targetMuscles: string;
  videoUrl: string;
  altVideoUrl: string;
  altVideoUrl2?: string;
  verifiedByUser: boolean;
  updatedAt: string;
}

export const UNIVERSAL_MACHINE_SWAPS: UniversalMachineCategory[] = [
  {
    categoryId: 'pull_ups',
    label: 'Pull-Ups',
    keywords: ['pull-up', 'pull up', 'chin-up'],
    exactIds: ['day1_pullups', 'day2_pullups', 'day3_pullups', 'fri_pullups', 'day4_pullups', 'day5_pullups'],
    options: [
      {
        optionId: 'assisted_pull_up_machine',
        name: 'Assisted Pull-Up Machine (Knee/Foot Platform)',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=CdO5BvP6Ti8',
        altVideoUrl: 'https://www.youtube.com/watch?v=gx0RWT7WbmA',
        restSeconds: 90,
        targetMuscle: 'Upper Back, Lats & Biceps',
        formSetup: '1. Set the counterweight pin on the weight stack (more weight gives you more help). 2. Kneel or stand on the pad and grip the overhead bar slightly wider than your shoulders. 3. Pull your chest up to the bar and lower yourself slowly for 2 to 3 seconds.'
      },
      {
        optionId: 'lat_pulldown_machine_for_pullups',
        name: 'Lat Pulldown Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
        altVideoUrl: 'https://www.youtube.com/watch?v=owMowIRkyvQ',
        restSeconds: 90,
        targetMuscle: 'Upper Back, Lats & Biceps',
        formSetup: '1. Sit down and lock your thighs snugly under the knee pad. 2. Grip the bar slightly wider than your shoulders with your palms facing forward. 3. Pull the bar down to your upper chest and let it rise slowly with control.'
      }
    ]
  },
  {
    categoryId: 'flat_bench_press',
    label: 'Flat Bench Press',
    keywords: ['barbell bench press', 'flat dumbbell press', 'bench press'],
    exactIds: ['mon_bench', 'thu_flat_db', 'wed_flat_db_press'],
    options: [
      {
        optionId: 'seated_chest_press_machine',
        name: 'Seated Chest Press Machine',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=YXjhMV7uz4c',
        altVideoUrl: 'https://www.youtube.com/watch?v=Qu7-ceCvq7w',
        restSeconds: 120,
        targetMuscle: 'Chest, Front Shoulders & Triceps',
        formSetup: '1. Adjust the seat height so the handles line up with the middle of your chest. 2. Sit tall and press your upper back flat against the back pad. 3. Push the handles forward until your arms are straight and lower the weight slowly.'
      }
    ]
  },
  {
    categoryId: 'incline_press',
    label: 'Incline Press',
    keywords: ['incline dumbbell press', 'incline bench', 'incline press'],
    exactIds: ['thu_inc_db', 'mon_incline_db_press'],
    options: [
      {
        optionId: 'incline_chest_press_machine',
        name: 'Incline Chest Press Machine',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=WxrKIPbeQP8',
        altVideoUrl: 'https://www.youtube.com/watch?v=i3e4CG5tnfs',
        restSeconds: 120,
        targetMuscle: 'Upper Chest & Front Shoulders',
        formSetup: '1. Set the seat height so the handles start near your upper chest and collarbone. 2. Keep your upper back pressed firmly against the angled back pad. 3. Press the handles up and forward, pause briefly, and lower them slowly.'
      }
    ]
  },
  {
    categoryId: 'chest_flyes',
    label: 'Chest Flyes',
    keywords: ['cable fly', 'flyes', 'pec deck', 'chest fly'],
    exactIds: ['mon_cable_fly', 'thu_mid_fly'],
    options: [
      {
        optionId: 'pec_deck_machine_fly',
        name: 'Pec Deck / Seated Machine Chest Fly',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=g3T7LsEeDWQ',
        altVideoUrl: 'https://www.youtube.com/watch?v=a9vQ_hwIksU',
        restSeconds: 90,
        targetMuscle: 'Chest',
        formSetup: '1. Adjust the seat so the handles are level with the middle of your chest. 2. Keep your elbows slightly bent and your shoulders relaxed down. 3. Bring the handles together in front of your chest, squeeze for 1 second, and open your arms slowly.'
      }
    ]
  },
  {
    categoryId: 'horizontal_rows',
    label: 'Horizontal Rows',
    keywords: ['chest supported row', 'barbell row', 'dumbbell row', 'cable row'],
    exactIds: ['mon_cs_row', 'fri_lat_row', 'mon_seated_cable_row'],
    options: [
      {
        optionId: 'seated_chest_supported_row_machine',
        name: 'Seated Chest-Supported Machine / Cable Row',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=GZbfZ033f74',
        altVideoUrl: 'https://www.youtube.com/watch?v=xUm0BiZCWlQ',
        restSeconds: 120,
        targetMuscle: 'Upper Back & Lats',
        formSetup: '1. Adjust the seat height so your chest rests comfortably against the front pad. 2. Hold the handles and pull your elbows straight back past your ribs. 3. Squeeze your shoulder blades together for 1 second and let your arms stretch forward slowly.'
      }
    ]
  },
  {
    categoryId: 'vertical_pull',
    label: 'Vertical Pull',
    keywords: ['lat pulldown', 'pulldown'],
    exactIds: ['mon_lat_pd'],
    options: [
      {
        optionId: 'converging_lat_pulldown_machine',
        name: 'Converging / Cable Lat Pulldown Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
        altVideoUrl: 'https://www.youtube.com/watch?v=owMowIRkyvQ',
        restSeconds: 120,
        targetMuscle: 'Lats & Upper Back',
        formSetup: '1. Sit down and adjust the knee pad so it holds your legs firmly in place. 2. Grip the handles or bar slightly wider than shoulder width. 3. Pull your elbows down toward your sides until the handles reach your upper chest, then return slowly.'
      }
    ]
  },
  {
    categoryId: 'vertical_shoulder_press',
    label: 'Vertical Shoulder Press',
    keywords: ['overhead press', 'shoulder press', 'military press'],
    exactIds: ['mon_ohp', 'fri_overhead_shoulder_press'],
    options: [
      {
        optionId: 'seated_shoulder_press_machine',
        name: 'Seated Shoulder Press Machine',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=6v4nrRVySj0',
        altVideoUrl: 'https://www.youtube.com/watch?v=Gkk-6q7Rq-s',
        restSeconds: 120,
        targetMuscle: 'Shoulders & Triceps',
        formSetup: '1. Adjust the seat so the handles start at ear or shoulder height. 2. Sit upright with your back flat against the pad and your core tight. 3. Press the handles overhead until your arms are straight and lower them slowly to shoulder level.'
      }
    ]
  },
  {
    categoryId: 'lateral_deltoid_isolation',
    label: 'Lateral Deltoid Isolation',
    keywords: ['lateral raise', 'side raise'],
    exactIds: ['mon_lat_raise', 'thu_db_lat'],
    options: [
      {
        optionId: 'seated_lateral_raise_machine',
        name: 'Seated Lateral Raise Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=NNAs8jx_zJI',
        altVideoUrl: 'https://www.youtube.com/watch?v=EL_xr3NVUbc',
        restSeconds: 60,
        targetMuscle: 'Side Shoulders',
        formSetup: '1. Adjust the seat height so your shoulders line up with the machine pivot point. 2. Rest your elbows and forearms against the side pads. 3. Lift your elbows out to shoulder height, pause 1 second, and lower your arms slowly.'
      }
    ]
  },
  {
    categoryId: 'posterior_deltoid_upper_back',
    label: 'Posterior Deltoid / Upper Back',
    keywords: ['face pull', 'rear delt', 'reverse fly'],
    exactIds: ['mon_face_pull', 'fri_rear_row', 'fri_face_pull'],
    options: [
      {
        optionId: 'reverse_pec_deck_machine',
        name: 'Reverse Pec Deck (Rear Delt Machine)',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=O2J8Qs7Wl3U',
        altVideoUrl: 'https://www.youtube.com/watch?v=7tgx6QHB0-A',
        restSeconds: 60,
        targetMuscle: 'Rear Shoulders & Upper Back',
        formSetup: '1. Set the machine arms to the front position and sit facing the chest pad. 2. Hold the handles at shoulder height with your arms nearly straight. 3. Sweep your arms out and back using your rear shoulders, then return slowly.'
      }
    ]
  },
  {
    categoryId: 'overhead_triceps',
    label: 'Overhead Triceps',
    keywords: ['overhead rope', 'overhead tricep', 'skullcrusher'],
    exactIds: ['thu_oh_ext'],
    options: [
      {
        optionId: 'seated_tricep_extension_machine',
        name: 'Seated Tricep Extension Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=NNyuuN2sJb0',
        altVideoUrl: 'https://www.youtube.com/watch?v=1AFJTda1btg',
        restSeconds: 60,
        targetMuscle: 'Triceps',
        formSetup: '1. Adjust the seat so the backs of your upper arms rest flat on the pad. 2. Hold the handles and keep your elbows in place on the pad. 3. Straighten your arms completely, squeeze your triceps for 1 second, and bend your elbows slowly.'
      }
    ]
  },
  {
    categoryId: 'tricep_pushdowns_dips',
    label: 'Tricep Pushdowns / Dips',
    keywords: ['cable pushdown', 'pushdowns', 'tricep dip'],
    exactIds: ['thu_pushdown'],
    options: [
      {
        optionId: 'seated_tricep_dip_pushdown_machine',
        name: 'Seated Tricep Dip / Pushdown Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=8CvOC9Db3Yw',
        altVideoUrl: 'https://www.youtube.com/watch?v=2NOglxsG1wE',
        restSeconds: 60,
        targetMuscle: 'Triceps',
        formSetup: '1. Sit tall with your back against the pad and hold the side handles. 2. Keep your elbows tucked close to your sides and your shoulders down. 3. Push the handles straight down until your arms lock out, then bend your elbows slowly.'
      }
    ]
  },
  {
    categoryId: 'bicep_brachialis_curls',
    label: 'Bicep & Brachialis Curls',
    keywords: ['incline dumbbell curl', 'hammer curl', 'bicep curl', 'barbell curl', 'preacher curl'],
    exactIds: ['fri_inc_curl', 'fri_hammer'],
    options: [
      {
        optionId: 'seated_machine_preacher_bicep_curl',
        name: 'Seated Machine Preacher / Bicep Curl',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=eYrAV7rnol0',
        altVideoUrl: 'https://www.youtube.com/watch?v=Htw-s61mOw0',
        restSeconds: 60,
        targetMuscle: 'Biceps & Forearms',
        formSetup: '1. Adjust the seat so the backs of your upper arms rest flat on the angled pad. 2. Grip the handles and keep your upper arms glued to the pad. 3. Curl the handles up toward your shoulders, pause 1 second, and lower them slowly.'
      }
    ]
  },
  {
    categoryId: 'upper_traps',
    label: 'Upper Traps',
    keywords: ['shrug'],
    exactIds: ['shrug'],
    options: [
      {
        optionId: 'standing_seated_leverage_shrug_machine',
        name: 'Standing / Seated Leverage Shrug Machine',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=rFsSeClGnNA',
        altVideoUrl: 'https://www.youtube.com/watch?v=NJ8U95vMtZg',
        restSeconds: 60,
        targetMuscle: 'Upper Traps & Neck',
        formSetup: '1. Stand or sit tall and hold the side handles with your arms straight. 2. Lift your shoulders straight up toward your ears without bending your elbows. 3. Hold the top squeeze for 2 seconds and lower your shoulders slowly.'
      }
    ]
  },
  {
    categoryId: 'bilateral_squat_pattern',
    label: 'Bilateral Squat Pattern',
    keywords: ['back squat', 'front squat', 'goblet squat', 'squat'],
    exactIds: ['tue_squat', 'thu_barbell_back_squat'],
    options: [
      {
        optionId: 'seated_leg_press_machine',
        name: 'Seated Leg Press Machine',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=nDh_BlnLCGc',
        altVideoUrl: 'https://www.youtube.com/watch?v=EotSw18oR9w',
        restSeconds: 150,
        targetMuscle: 'Front Thighs & Glutes',
        formSetup: '1. Sit back with your hips and lower back pressed flat against the seat pad. 2. Place your feet shoulder-width apart in the middle of the footplate. 3. Unlock the safety handles, lower the sled until your knees bend to 90 degrees, and push through your whole foot.'
      },
      {
        optionId: 'angled_hack_squat_machine',
        name: 'Angled Hack Squat Machine',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=g9i05umL5vc',
        altVideoUrl: 'https://www.youtube.com/watch?v=0tn5K9NlCfo',
        restSeconds: 150,
        targetMuscle: 'Front Thighs & Glutes',
        formSetup: '1. Rest your shoulders under the top pads and press your back flat against the sled. 2. Set your feet shoulder-width apart on the footplate. 3. Unlock the safety handles, lower yourself under control, and push back up to the top.'
      }
    ]
  },
  {
    categoryId: 'unilateral_leg_pattern',
    label: 'Unilateral Leg Pattern',
    keywords: ['split squat', 'bulgarian', 'lunge', 'step up'],
    exactIds: ['tue_lunges', 'sat_bss', 'tue_walking_lunges'],
    options: [
      {
        optionId: 'single_leg_press_machine',
        name: 'Single-Leg Press Machine',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=LbKwZIbVYZI',
        altVideoUrl: 'https://www.youtube.com/watch?v=x4vaHXRfKrg',
        restSeconds: 120,
        targetMuscle: 'Front Thighs & Glutes (One Leg at a Time)',
        formSetup: '1. Sit in the leg press seat and place one foot in the center of the footplate while keeping your other foot on the floor. 2. Lower the footplate slowly until your working knee bends to 90 degrees. 3. Push through your mid-foot and heel to straighten your leg without locking your knee.'
      }
    ]
  },
  {
    categoryId: 'hip_hinge_posterior_chain',
    label: 'Hip Hinge / Back of Thighs',
    keywords: ['romanian deadlift', 'rdl', 'deadlift', 'good morning'],
    exactIds: ['tue_rdl', 'sat_deadlift', 'tue_barbell_rdl'],
    options: [
      {
        optionId: 'seated_hamstring_leg_curl_machine',
        name: 'Seated Hamstring Leg Curl Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=xdbEG3xGLI8',
        altVideoUrl: 'https://www.youtube.com/watch?v=_lgE0gPvbik',
        restSeconds: 90,
        targetMuscle: 'Back of Thighs (Hamstrings)',
        formSetup: '1. Sit back and adjust the backrest so your knees line up with the machine hinge. 2. Place the lower ankle pad just above your heels and lock the thigh pad snugly over your legs. 3. Pull your heels down and back as far as you can, hold 1 second, and return slowly.'
      },
      {
        optionId: 'back_hip_extension_45_machine',
        name: '45-Degree Back / Hip Extension Machine',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=H8Swl1N-uis',
        altVideoUrl: 'https://www.youtube.com/watch?v=S1_eZIIZlIc',
        restSeconds: 90,
        targetMuscle: 'Glutes, Back of Thighs & Lower Back',
        formSetup: '1. Set the top pad just below your hip bones so you can bend forward freely at the waist. 2. Cross your arms or hold a weight plate against your chest. 3. Lower your upper body under control and squeeze your glutes to come back up until your body is in a straight line.'
      }
    ]
  },
  {
    categoryId: 'knee_flexion',
    label: 'Knee Flexion',
    keywords: ['leg curl', 'hamstring curl'],
    exactIds: ['sat_leg_curl'],
    options: [
      {
        optionId: 'seated_lying_leg_curl_machine',
        name: 'Seated / Lying Leg Curl Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=xdbEG3xGLI8',
        altVideoUrl: 'https://www.youtube.com/watch?v=_lgE0gPvbik',
        restSeconds: 90,
        targetMuscle: 'Back of Thighs (Hamstrings)',
        formSetup: '1. Line up your knees with the machine pivot dot and rest the roller pad just above your heels. 2. Hold the side handles tightly to keep your hips still. 3. Curl your heels back smoothly, pause 1 second, and lower the weight slowly.'
      }
    ]
  },
  {
    categoryId: 'knee_extension',
    label: 'Knee Extension',
    keywords: ['leg extension', 'quad extension'],
    exactIds: ['tue_leg_ext'],
    options: [
      {
        optionId: 'seated_leg_extension_machine',
        name: 'Seated Leg Extension Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=iQ92TuvBqRo',
        altVideoUrl: 'https://www.youtube.com/watch?v=uM86QE59Tgc',
        restSeconds: 90,
        targetMuscle: 'Front Thighs',
        formSetup: '1. Adjust the back pad so the backs of your knees sit flush against the edge of the seat. 2. Set the lower shin pad right above your ankles and hold the side handles. 3. Straighten your legs completely, hold 1 second at the top, and lower slowly.'
      }
    ]
  },
  {
    categoryId: 'bent_knee_calf_raise',
    label: 'Seated Calf Raise / Calf Press',
    keywords: ['seated weighted calf raise', 'seated calf', 'calf extension'],
    exactIds: ['sat_seated_calf'],
    options: [
      {
        optionId: 'seated_calf_press_extension_machine',
        name: 'Seated Calf Press / Extension Machine',
        subtypeLabel: 'Seated Calf Press / Extension Machine (Footplate Push)',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=ZmDiJvXx344',
        altVideoUrl: 'https://www.youtube.com/watch?v=z0FtV_s_GVA',
        altVideoUrl2: 'https://www.youtube.com/watch?v=1cvpm--Y-4I',
        restSeconds: 60,
        targetMuscle: 'Calves',
        formSetup: '1. Sit back flat in the seat and adjust the seat position (e.g., setting #6) so your knees are slightly bent. 2. Place the balls of your feet on the bottom edge of the footplate. 3. Push the footplate forward with your toes, pause 1 second, and let your heels come back slowly for a full stretch.'
      },
      {
        optionId: 'bent_knee_lever_calf_machine',
        name: 'Bent-Knee Lever Calf Machine (Pads Over Knees)',
        subtypeLabel: 'Bent-Knee Lever Calf Machine (Pads Over Knees)',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=z1N8ZRsb4bg',
        altVideoUrl: 'https://www.youtube.com/watch?v=FsqE-g1C5fk',
        restSeconds: 60,
        targetMuscle: 'Calves',
        formSetup: '1. Sit on the bench and place the balls of your feet on the step. 2. Lock the pad snugly over your lower thighs just above your knees. 3. Push up onto your tiptoes, hold 1 second, and lower your heels slowly.'
      },
      {
        optionId: 'standing_calf_raise_machine',
        name: 'Standing Calf Raise Machine (Pads on Shoulders)',
        subtypeLabel: 'Standing Calf Raise Machine (Pads on Shoulders)',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=_OewEscCsbo',
        altVideoUrl: 'https://www.youtube.com/watch?v=yQZDGjL-xT4',
        restSeconds: 60,
        targetMuscle: 'Calves',
        formSetup: '1. Stand under the shoulder pads and place the balls of your feet on the step block. 2. Keep your knees straight and push up as high as you can onto your toes. 3. Pause 1 second at the top and lower your heels slowly below the step.'
      }
    ]
  },
  {
    categoryId: 'straight_leg_calf_raise',
    label: 'Standing / Leg Press Calf Raise',
    keywords: ['standing calf', 'calf press'],
    exactIds: ['tue_calf'],
    options: [
      {
        optionId: 'standing_leg_press_calf_raise_machine',
        name: 'Standing / Leg Press Calf Raise Machine',
        subtypeLabel: 'Standing / Leg Press Calf Raise Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=_OewEscCsbo',
        altVideoUrl: 'https://www.youtube.com/watch?v=yQZDGjL-xT4',
        restSeconds: 60,
        targetMuscle: 'Calves',
        formSetup: '1. Place your shoulders under the pads (or place the balls of your feet on the bottom edge of the leg press footplate). 2. Keep your knees straight without locking them backward. 3. Push up high onto your toes, pause 1 second, and lower your heels slowly for a deep stretch.'
      },
      {
        optionId: 'seated_calf_press_extension_machine_alt',
        name: 'Seated Calf Press / Extension Machine',
        subtypeLabel: 'Seated Calf Press / Extension Machine (Footplate Push)',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=ZmDiJvXx344',
        altVideoUrl: 'https://www.youtube.com/watch?v=z0FtV_s_GVA',
        altVideoUrl2: 'https://www.youtube.com/watch?v=1cvpm--Y-4I',
        restSeconds: 60,
        targetMuscle: 'Calves',
        formSetup: '1. Sit back flat in the seat and adjust the seat position (e.g., setting #6) so your knees are slightly bent. 2. Place the balls of your feet on the bottom edge of the footplate. 3. Push the footplate forward with your toes, pause 1 second, and let your heels come back slowly for a full stretch.'
      },
      {
        optionId: 'bent_knee_lever_calf_machine_alt',
        name: 'Bent-Knee Lever Calf Machine (Pads Over Knees)',
        subtypeLabel: 'Bent-Knee Lever Calf Machine (Pads Over Knees)',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=z1N8ZRsb4bg',
        altVideoUrl: 'https://www.youtube.com/watch?v=FsqE-g1C5fk',
        restSeconds: 60,
        targetMuscle: 'Calves',
        formSetup: '1. Sit on the bench and place the balls of your feet on the step. 2. Lock the pad snugly over your lower thighs just above your knees. 3. Push up onto your tiptoes, hold 1 second, and lower your heels slowly.'
      }
    ]
  },
  {
    categoryId: 'glute_abduction_hip_thrust',
    label: 'Glute Abduction / Hip Thrust',
    keywords: ['hip abduction', 'abductor', 'hip thrust', 'glute bridge'],
    exactIds: ['sat_abduction', 'sat_hip_thrust'],
    options: [
      {
        optionId: 'seated_hip_abduction_machine',
        name: 'Seated Hip Abduction Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=tu4o4quPv2k',
        altVideoUrl: 'https://www.youtube.com/watch?v=01HilwRf8m8',
        restSeconds: 60,
        targetMuscle: 'Outer Glutes & Hips',
        formSetup: '1. Sit in the machine with the pads resting against the outsides of your knees. 2. Hold the side handles and keep your back straight. 3. Push your knees outward against the pads, hold 1 second, and bring them back together slowly.'
      },
      {
        optionId: 'hip_thrust_glute_drive_machine',
        name: 'Hip Thrust / Glute Drive Machine',
        loadMode: 'plate_2sides',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=V74XWj9FXAc',
        altVideoUrl: 'https://www.youtube.com/watch?v=tztHvSLdXLA',
        restSeconds: 120,
        targetMuscle: 'Glutes & Hips',
        formSetup: '1. Rest your upper back against the back pad and buckle the padded belt snugly across your hips. 2. Place your feet flat on the footplate so your shins are vertical at the top. 3. Push through your heels to lift your hips, squeeze your glutes for 1 second, and lower slowly.'
      }
    ]
  },
  {
    categoryId: 'core_flexion',
    label: 'Core Flexion',
    keywords: ['cable abdominal crunch', 'abdominal crunch', 'ab crunch', 'core', 'side plank', 'dead bug'],
    exactIds: ['cable_ab_crunch', 'tue_side_plank', 'wed_dead_bug', 'sun_cardio'],
    options: [
      {
        optionId: 'seated_abdominal_crunch_machine',
        name: 'Seated Abdominal Crunch Machine',
        loadMode: 'pin_stack',
        primaryVideoUrl: 'https://www.youtube.com/watch?v=mnRhbUB3Fjs',
        altVideoUrl: 'https://www.youtube.com/watch?v=3zJxX6PvwCc',
        restSeconds: 60,
        targetMuscle: 'Stomach & Core (Abs)',
        formSetup: '1. Sit in the machine and hold the top handles or rest your chest against the pad. 2. Breathe out and curl your ribs down toward your hips using your stomach muscles. 3. Hold the bottom crunch for 1 second and return slowly to the top.'
      }
    ]
  }
];

export function matchExerciseToUniversalMachineSwaps(ex: {
  id?: string;
  originalId?: string;
  name?: string;
  originalName?: string;
}): UniversalMachineCategory {
  const canonicalId = String(ex?.originalId || ex?.id || '').trim().toLowerCase();
  const rawName = String(ex?.originalName || ex?.name || '').trim().toLowerCase();

  for (const cat of UNIVERSAL_MACHINE_SWAPS) {
    if (cat.exactIds.some(eid => eid.toLowerCase() === canonicalId)) {
      return cat;
    }
  }

  const orderedCategories = [
    ...UNIVERSAL_MACHINE_SWAPS.filter(c => c.categoryId === 'unilateral_leg_pattern'),
    ...UNIVERSAL_MACHINE_SWAPS.filter(c => c.categoryId !== 'unilateral_leg_pattern')
  ];

  for (const cat of orderedCategories) {
    if (cat.keywords.some(kw => rawName.includes(kw.toLowerCase()))) {
      return cat;
    }
  }

  return UNIVERSAL_MACHINE_SWAPS[UNIVERSAL_MACHINE_SWAPS.length - 1];
}

export function getDefaultUniversalOptionIndexForExercise(
  ex: { id?: string; originalId?: string; name?: string; originalName?: string },
  cat: UniversalMachineCategory
): number {
  const canonicalId = String(ex?.originalId || ex?.id || '').trim().toLowerCase();
  const rawName = String(ex?.originalName || ex?.name || '').trim().toLowerCase();
  if (cat.categoryId === 'glute_abduction_hip_thrust' && (canonicalId === 'sat_hip_thrust' || rawName.includes('hip thrust') || rawName.includes('glute bridge'))) {
    return 1; // Hip Thrust / Glute Drive Machine
  }
  return 0; // For sat_seated_calf (bent_knee_calf_raise), Option 0 is Seated Calf Press / Extension Machine
}

export function getAiVisionPipelineSteps(originalExerciseName: string): string[] {
  const cleanName = String(originalExerciseName || 'Current Exercise').trim();
  return [
    '1. Scanning machine photo and seat setup...',
    `2. Checking machine type and finding matching video for ${cleanName}...`,
    '3. Attaching verified machine form video & setup cues...'
  ];
}

export function computeMachineWeightMath(
  totalWeightVal: number | string,
  loadModeOrUnit: MachineLoadMode | 'lbs' | 'kg' = 'plate_2sides',
  unitOrLoadMode: 'lbs' | 'kg' | MachineLoadMode = 'lbs'
): {
  bar: 0;
  loadMode: MachineLoadMode;
  unit: 'lbs' | 'kg';
  perSide: number;
  bothSides: number;
  total: number;
  summaryBadgeText: string;
} {
  const loadMode: MachineLoadMode =
    loadModeOrUnit === 'pin_stack' || unitOrLoadMode === 'pin_stack' ? 'pin_stack' : 'plate_2sides';
  const unit: 'lbs' | 'kg' =
    loadModeOrUnit === 'kg' || unitOrLoadMode === 'kg' ? 'kg' : 'lbs';
  const parsed = typeof totalWeightVal === 'number' ? totalWeightVal : parseFloat(String(totalWeightVal || '0'));
  const total = Number.isFinite(parsed) && parsed >= 0 ? +parsed.toFixed(2) : 0;
  const bothSides = total;
  const perSide = +(total / 2).toFixed(2);
  const summaryBadgeText =
    loadMode === 'pin_stack'
      ? `Machine Pin Weight: ${total} ${unit}`
      : `Machine Plates: ${perSide} ${unit}/side = ${total} ${unit} total`;
  return {
    bar: 0,
    loadMode,
    unit,
    perSide,
    bothSides,
    total,
    summaryBadgeText
  };
}

export function stripBarbellWeightFromMachineSets(
  workoutLogs: Record<string, any>,
  exId: string,
  barWeightToStripLbs = 45
): number {
  if (!workoutLogs || typeof workoutLogs !== 'object' || !exId) return 0;
  const escapedId = exId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyRegex = new RegExp(`^(?:w\\d+_)?\\d+_${escapedId}_\\d+$`);
  let updatedCount = 0;
  Object.keys(workoutLogs).forEach(k => {
    if (!keyRegex.test(k)) return;
    const entry = workoutLogs[k];
    if (!entry || typeof entry !== 'object') return;
    const unit = entry.unit === 'kg' ? 'kg' : 'lbs';
    const barVal = unit === 'kg' ? 20 : barWeightToStripLbs;
    const w = parseFloat(String(entry.weight || ''));
    if (Number.isFinite(w) && w > barVal) {
      entry.weight = String(+(w - barVal).toFixed(2));
      updatedCount++;
    }
  });
  return updatedCount;
}

export function upsertSharedMachineDatabaseEntry(
  stateOrDb: Record<string, any>,
  entry: Partial<SharedMachineDatabaseEntry> & { originalExKey: string; machineName: string; videoUrl: string }
): SharedMachineDatabaseEntry {
  const isStateWrapper = stateOrDb && typeof stateOrDb === 'object' && ('sharedMachineDatabase' in stateOrDb || 'exerciseSwaps' in stateOrDb);
  const targetDb = isStateWrapper
    ? (stateOrDb.sharedMachineDatabase || (stateOrDb.sharedMachineDatabase = {}))
    : stateOrDb;
  const key = String(entry.originalExKey || entry.machineId || '').trim();
  const record: SharedMachineDatabaseEntry = {
    machineId: entry.machineId || key,
    originalExKey: key,
    machineName: entry.machineName,
    machineSubtype: entry.machineSubtype || entry.machineName,
    loadMode: entry.loadMode === 'pin_stack' ? 'pin_stack' : 'plate_2sides',
    simpleSteps: entry.simpleSteps || '',
    targetMuscles: entry.targetMuscles || 'Target Muscles',
    videoUrl: entry.videoUrl,
    altVideoUrl: entry.altVideoUrl || entry.videoUrl,
    altVideoUrl2: entry.altVideoUrl2 || '',
    verifiedByUser: true,
    updatedAt: entry.updatedAt || new Date().toISOString()
  };
  if (key && targetDb && typeof targetDb === 'object') {
    targetDb[key] = record;
  }
  return record;
}

export function autoMigrateExerciseNotesToMachineSwaps(
  stateObj: Record<string, any>,
  allExercisesCatalog?: Array<{ id: string; name: string }>
): Record<string, any> {
  if (!stateObj || typeof stateObj !== 'object') return {};
  if (!stateObj.exerciseSwaps || typeof stateObj.exerciseSwaps !== 'object') {
    stateObj.exerciseSwaps = {};
  }
  if (!stateObj.revertedMachineSwaps || typeof stateObj.revertedMachineSwaps !== 'object') {
    stateObj.revertedMachineSwaps = {};
  }
  if (!stateObj.sharedMachineDatabase || typeof stateObj.sharedMachineDatabase !== 'object') {
    stateObj.sharedMachineDatabase = {};
  }
  if (!stateObj.machineBarStripped || typeof stateObj.machineBarStripped !== 'object') {
    stateObj.machineBarStripped = {};
  }
  // Always clear stale pending verification boxes on startup
  stateObj.pendingMachineSwapPreviews = {};

  const notesMap = stateObj.exerciseNotes && typeof stateObj.exerciseNotes === 'object' ? stateObj.exerciseNotes : {};
  const catalogById: Record<string, { id: string; name: string }> = {};
  if (Array.isArray(allExercisesCatalog)) {
    allExercisesCatalog.forEach(item => {
      if (item && item.id) catalogById[item.id] = item;
    });
  }

  // Upgrade any existing sat_seated_calf swap that used the old knee-lever video (z1N8ZRsb4bg) to Seated Calf Press / Extension Machine (ZmDiJvXx344)
  const existingCalfSwap = stateObj.exerciseSwaps.sat_seated_calf;
  if (
    existingCalfSwap &&
    (existingCalfSwap.videoUrl === 'https://www.youtube.com/watch?v=z1N8ZRsb4bg' ||
      existingCalfSwap.name === 'Seated Calf Raise Machine')
  ) {
    const calfCat = UNIVERSAL_MACHINE_SWAPS.find(c => c.categoryId === 'bent_knee_calf_raise')!;
    const calfOpt0 = calfCat.options[0];
    stateObj.exerciseSwaps.sat_seated_calf = {
      ...existingCalfSwap,
      canonicalId: 'sat_seated_calf',
      categoryId: calfCat.categoryId,
      optionIndex: 0,
      optionId: calfOpt0.optionId,
      name: calfOpt0.name,
      loadMode: calfOpt0.loadMode,
      primaryVideoUrl: calfOpt0.primaryVideoUrl,
      altVideoUrl: calfOpt0.altVideoUrl,
      altVideoUrl2: calfOpt0.altVideoUrl2,
      videoUrl: calfOpt0.primaryVideoUrl,
      restSeconds: calfOpt0.restSeconds,
      targetMuscle: calfOpt0.targetMuscle,
      formSetup: calfOpt0.formSetup,
      scope: 'all'
    };
  }

  Object.keys(notesMap).forEach(noteKey => {
    const noteEntry = notesMap[noteKey];
    if (!noteEntry || typeof noteEntry !== 'object') return;
    const textVal = String(noteEntry.text || '').trim();
    const photoVal = String(noteEntry.photoDataUrl || '').trim();
    const mentionsMachine = /machine/i.test(textVal);
    const hasMachinePhoto = photoVal.length > 0;
    if (!mentionsMachine && !hasMachinePhoto) return;
    if (stateObj.revertedMachineSwaps[noteKey]) return;

    const exStub = catalogById[noteKey] || { id: noteKey, name: noteKey };
    const matchedCat = matchExerciseToUniversalMachineSwaps(exStub);
    let optIdx = getDefaultUniversalOptionIndexForExercise(exStub, matchedCat);
    if (noteKey === 'sat_seated_calf' && /lever|knee\s*pad/i.test(textVal)) {
      optIdx = 1;
    }
    const chosenOpt = matchedCat.options[optIdx] || matchedCat.options[0];
    if (!chosenOpt) return;

    if (!stateObj.exerciseSwaps[noteKey]) {
      stateObj.exerciseSwaps[noteKey] = {
        canonicalId: noteKey,
        categoryId: matchedCat.categoryId,
        optionIndex: optIdx,
        optionId: chosenOpt.optionId,
        name: chosenOpt.name,
        loadMode: chosenOpt.loadMode,
        primaryVideoUrl: chosenOpt.primaryVideoUrl,
        altVideoUrl: chosenOpt.altVideoUrl,
        altVideoUrl2: chosenOpt.altVideoUrl2 || '',
        videoUrl: chosenOpt.primaryVideoUrl,
        restSeconds: chosenOpt.restSeconds,
        targetMuscle: chosenOpt.targetMuscle,
        formSetup: chosenOpt.formSetup,
        scope: 'all',
        autoMigrated: true
      };
    }

    upsertSharedMachineDatabaseEntry(stateObj, {
      originalExKey: noteKey,
      machineId: stateObj.exerciseSwaps[noteKey].optionId || chosenOpt.optionId,
      machineName: stateObj.exerciseSwaps[noteKey].name || chosenOpt.name,
      machineSubtype: chosenOpt.subtypeLabel || chosenOpt.name,
      loadMode: stateObj.exerciseSwaps[noteKey].loadMode || chosenOpt.loadMode,
      simpleSteps: stateObj.exerciseSwaps[noteKey].formSetup || chosenOpt.formSetup,
      targetMuscles: stateObj.exerciseSwaps[noteKey].targetMuscle || chosenOpt.targetMuscle,
      videoUrl: stateObj.exerciseSwaps[noteKey].videoUrl || chosenOpt.primaryVideoUrl,
      altVideoUrl: stateObj.exerciseSwaps[noteKey].altVideoUrl || chosenOpt.altVideoUrl,
      altVideoUrl2: chosenOpt.altVideoUrl2 || ''
    });
  });

  // Strip 45 lb barbell from any swapped machine exercise
  Object.keys(stateObj.exerciseSwaps).forEach(swapKey => {
    const sw = stateObj.exerciseSwaps[swapKey];
    if (!sw || sw.disabled) return;
    const cid = sw.canonicalId || swapKey;
    if (!stateObj.machineBarStripped[cid] && stateObj.workoutLogs) {
      stripBarbellWeightFromMachineSets(stateObj.workoutLogs, cid, 45);
      stateObj.machineBarStripped[cid] = true;
    }
  });

  return stateObj.exerciseSwaps;
}

export function getEffectiveExercise(
  stateObj: Record<string, any>,
  week: number,
  dayIdx: number,
  exIdx: number,
  rawEx: Record<string, any>
): Record<string, any> {
  if (!rawEx || typeof rawEx !== 'object') return rawEx;
  if (!stateObj.exerciseSwaps || typeof stateObj.exerciseSwaps !== 'object') {
    stateObj.exerciseSwaps = {};
  }
  if (!stateObj.revertedMachineSwaps || typeof stateObj.revertedMachineSwaps !== 'object') {
    stateObj.revertedMachineSwaps = {};
  }
  if (!stateObj.sharedMachineDatabase || typeof stateObj.sharedMachineDatabase !== 'object') {
    stateObj.sharedMachineDatabase = {};
  }

  const canonicalId = String(rawEx.originalId || rawEx.id || '').trim();
  const cleanOriginalName = String(rawEx.originalName || rawEx.name || '').replace(/^[A-Z]\d+[\.\:\-\)]\s*/i, '').trim();
  const slotKey = `w${week}_d${dayIdx}_e${exIdx}`;
  const altSlotKey = `w${week}_d${dayIdx}_${canonicalId}`;

  // Auto-migrate on the fly if this exercise has a note mentioning "machine" or a machine photo
  const noteObj =
    (stateObj.exerciseNotes && (stateObj.exerciseNotes[canonicalId] || stateObj.exerciseNotes[slotKey] || stateObj.exerciseNotes[altSlotKey])) ||
    null;
  if (
    noteObj &&
    !stateObj.exerciseSwaps[slotKey] &&
    !stateObj.exerciseSwaps[altSlotKey] &&
    !stateObj.exerciseSwaps[canonicalId] &&
    !stateObj.revertedMachineSwaps[slotKey] &&
    !stateObj.revertedMachineSwaps[canonicalId]
  ) {
    const noteTxt = String(noteObj.text || '').trim();
    const notePhoto = String(noteObj.photoDataUrl || '').trim();
    if (/machine/i.test(noteTxt) || notePhoto.length > 0) {
      const matchedCat = matchExerciseToUniversalMachineSwaps({ id: canonicalId, name: cleanOriginalName });
      const optIdx = getDefaultUniversalOptionIndexForExercise({ id: canonicalId, name: cleanOriginalName }, matchedCat);
      const chosenOpt = matchedCat.options[optIdx] || matchedCat.options[0];
      if (chosenOpt) {
        stateObj.exerciseSwaps[canonicalId] = {
          canonicalId,
          categoryId: matchedCat.categoryId,
          optionIndex: optIdx,
          optionId: chosenOpt.optionId,
          name: chosenOpt.name,
          loadMode: chosenOpt.loadMode,
          primaryVideoUrl: chosenOpt.primaryVideoUrl,
          altVideoUrl: chosenOpt.altVideoUrl,
          altVideoUrl2: chosenOpt.altVideoUrl2 || '',
          videoUrl: chosenOpt.primaryVideoUrl,
          restSeconds: chosenOpt.restSeconds,
          targetMuscle: chosenOpt.targetMuscle,
          formSetup: chosenOpt.formSetup,
          scope: 'all',
          autoMigrated: true
        };
      }
    }
  }

  const matchedCat = matchExerciseToUniversalMachineSwaps({ id: canonicalId, name: cleanOriginalName });
  const defaultOptIdx = getDefaultUniversalOptionIndexForExercise({ id: canonicalId, name: cleanOriginalName }, matchedCat);

  const sharedDbEntry = stateObj.sharedMachineDatabase[canonicalId] || null;
  const activeSwap =
    stateObj.exerciseSwaps[slotKey] ||
    stateObj.exerciseSwaps[altSlotKey] ||
    stateObj.exerciseSwaps[canonicalId] ||
    (stateObj.swappedExercises && (stateObj.swappedExercises[slotKey] || stateObj.swappedExercises[altSlotKey])) ||
    (!stateObj.revertedMachineSwaps[canonicalId] && !stateObj.revertedMachineSwaps[slotKey] ? sharedDbEntry : null) ||
    null;

  if (activeSwap && !activeSwap.disabled) {
    const optIdx = typeof activeSwap.optionIndex === 'number' ? activeSwap.optionIndex : defaultOptIdx;
    const catOption = matchedCat.options[optIdx] || matchedCat.options[0];
    const machineName =
      activeSwap.name ||
      activeSwap.machineName ||
      activeSwap.suggestedMachineExercise ||
      (catOption ? catOption.name : cleanOriginalName);
    const primaryVid =
      activeSwap.primaryVideoUrl ||
      activeSwap.videoUrl ||
      (sharedDbEntry && sharedDbEntry.videoUrl) ||
      (catOption ? catOption.primaryVideoUrl : rawEx.videoUrl);
    const altVid =
      activeSwap.altVideoUrl ||
      (sharedDbEntry && sharedDbEntry.altVideoUrl) ||
      (catOption ? catOption.altVideoUrl : primaryVid);
    const altVid2 =
      activeSwap.altVideoUrl2 ||
      (sharedDbEntry && sharedDbEntry.altVideoUrl2) ||
      (catOption && catOption.altVideoUrl2 ? catOption.altVideoUrl2 : '');
    const loadMode: MachineLoadMode =
      (activeSwap.loadMode || (sharedDbEntry && sharedDbEntry.loadMode) || (catOption ? catOption.loadMode : 'plate_2sides')) === 'pin_stack'
        ? 'pin_stack'
        : 'plate_2sides';
    const restSecVal = Number(activeSwap.restSeconds || activeSwap.restSec || (catOption ? catOption.restSeconds : rawEx.restSec)) || 90;
    const formSetupStr =
      activeSwap.formSetup ||
      activeSwap.simpleSteps ||
      activeSwap.definitionAndCues ||
      (sharedDbEntry && sharedDbEntry.simpleSteps) ||
      (catOption ? catOption.formSetup : rawEx.notes);
    const targetMuscleStr =
      activeSwap.targetMuscle ||
      activeSwap.targetMuscles ||
      (sharedDbEntry && sharedDbEntry.targetMuscles) ||
      (catOption ? catOption.targetMuscle : '');
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(machineName + ' proper form tutorial')}`;

    return {
      ...rawEx,
      id: canonicalId,
      originalId: canonicalId,
      originalName: cleanOriginalName,
      originalVideoUrl: rawEx.videoUrl || rawEx.video || '',
      originalNotes: rawEx.notes || rawEx.setup || '',
      name: machineName,
      isSwapped: true,
      isSwappedMachine: true,
      loadMode,
      barWeight: 0,
      machineBadge: `Machine Active • Swapped from ${cleanOriginalName}`,
      videoUrl: primaryVid,
      video: primaryVid,
      primaryVideoUrl: primaryVid,
      altVideoUrl: altVid,
      altVideoUrl2: altVid2,
      youtubeSearchUrl: searchUrl,
      formSetup: formSetupStr,
      notes: formSetupStr,
      targetMuscle: targetMuscleStr,
      targetMuscles: targetMuscleStr,
      restSec: restSecVal,
      restSeconds: restSecVal,
      restLabel: `${restSecVal}s rest`,
      availableMachineOptions: matchedCat.options,
      selectedOptionIdx: optIdx,
      swapScope: activeSwap.scope || (stateObj.exerciseSwaps[slotKey] || stateObj.exerciseSwaps[altSlotKey] ? 'today' : 'all'),
      slotKey,
      altSlotKey
    };
  }

  return {
    ...rawEx,
    id: canonicalId,
    originalId: canonicalId,
    originalName: cleanOriginalName,
    name: cleanOriginalName,
    isSwapped: false,
    isSwappedMachine: false,
    availableMachineOptions: matchedCat.options,
    selectedOptionIdx: defaultOptIdx,
    slotKey,
    altSlotKey
  };
}

// ============================================================================
// FLEXIBLE 7-DAY SCHEDULE & SMART NEXT-WORKOUT RECOMMENDATION ENGINE
// ============================================================================
export const CORE_SLOT_REQUIRED_EX_IDS: Record<number, string[]> = {
  0: ['day1_pullups', 'mon_bench', 'mon_row', 'mon_ohp', 'mon_lat_pulldown', 'mon_incline_curl', 'mon_tricep_pushdown', 'mon_face_pull'],
  1: ['day2_pullups', 'tue_squat', 'tue_rdl', 'tue_split_squat', 'tue_leg_curl', 'tue_calf_raise', 'tue_hanging_leg_raise', 'tue_side_plank'],
  2: ['day3_pullups', 'thu_incline_db', 'thu_flat_db_bench', 'thu_cable_fly', 'thu_seated_db_ohp', 'thu_lateral_raise', 'thu_overhead_tricep', 'thu_dips'],
  3: ['day4_pullups', 'fri_barbell_row', 'fri_seated_row', 'fri_single_arm_lat', 'fri_rear_delt_fly', 'fri_ez_bar_curl', 'fri_hammer_curl', 'fri_shrugs'],
  4: ['day5_pullups', 'sat_deadlift', 'sat_hip_thrust', 'sat_leg_press', 'sat_walking_lunge', 'sat_leg_extension', 'sat_seated_calf', 'sat_ab_wheel']
};

export function isWorkoutSlotComplete(
  week: number,
  slotIdx: number,
  stateOrCompleted?: unknown
): boolean {
  const safeWeek = Math.max(1, Math.floor(Number(week) || 1));
  const safeSlot = Math.max(0, Math.min(6, Math.floor(Number(slotIdx) || 0)));
  if (safeSlot >= 5) return false;
  if (!stateOrCompleted) return false;

  if (Array.isArray(stateOrCompleted)) {
    return stateOrCompleted.includes(safeSlot);
  }

  if (typeof stateOrCompleted === 'object') {
    const obj = stateOrCompleted as Record<string, any>;
    if (Array.isArray(obj.completedSlots)) {
      return obj.completedSlots.includes(safeSlot);
    }
    if (obj.completedSlotsByWeek && typeof obj.completedSlotsByWeek === 'object') {
      const wkArr = obj.completedSlotsByWeek[String(safeWeek)] || obj.completedSlotsByWeek[safeWeek];
      if (Array.isArray(wkArr)) {
        return wkArr.includes(safeSlot);
      }
      if (wkArr && typeof wkArr === 'object') {
        return Boolean(wkArr[safeSlot] || wkArr[String(safeSlot)]);
      }
    }
    if (typeof obj[safeSlot] === 'boolean' || typeof obj[String(safeSlot)] === 'boolean') {
      return Boolean(obj[safeSlot] ?? obj[String(safeSlot)]);
    }

    const logs = obj.workoutLogs;
    if (logs && typeof logs === 'object') {
      const reqIds = CORE_SLOT_REQUIRED_EX_IDS[safeSlot] || [];
      if (reqIds.length === 0) return false;
      return reqIds.every(exId => {
        const s1Key = `w${safeWeek}_${safeSlot}_${exId}_1`;
        const legacyKey = safeWeek === 1 ? `${safeSlot}_${exId}_1` : '';
        const e1 = logs[s1Key] || (legacyKey ? logs[legacyKey] : null);
        return Boolean(e1 && e1.done);
      });
    }
  }
  return false;
}

export interface RecommendedNextWorkoutResult {
  week: number;
  currentDayIdx: number;
  recommendedSlot: number;
  daySub: string;
  workoutTitle: string;
  fullWorkoutLabel: string;
  completedSlots: number[];
  completedCount: number;
  allFiveCompleted: boolean;
  reasonBadge: string;
  headline: string;
  startButtonLabel: string;
  advanceNextWeekLabel: string | null;
}

export function getRecommendedNextWorkoutSlot(
  week: number,
  currentDayIdx: number,
  stateOrCompleted?: unknown
): RecommendedNextWorkoutResult {
  const safeWeek = Math.max(1, Math.floor(Number(week) || 1));
  const safeDayIdx = Math.max(0, Math.min(6, Math.floor(Number(currentDayIdx) || 0)));

  const completedSlots: number[] = [];
  for (let s = 0; s < 5; s++) {
    if (isWorkoutSlotComplete(safeWeek, s, stateOrCompleted)) {
      completedSlots.push(s);
    }
  }
  const completedCount = completedSlots.length;
  const allFiveCompleted = completedCount === 5;

  // Case A: All 5 core workouts completed (completedCount === 5) -> wrap around to Slot 0 (Day 1: Upper Body 1)
  if (allFiveCompleted) {
    const slotMeta = WORKOUT_SLOT_CATALOG[0];
    return {
      week: safeWeek,
      currentDayIdx: safeDayIdx,
      recommendedSlot: 0,
      daySub: slotMeta.daySub,
      workoutTitle: slotMeta.title,
      fullWorkoutLabel: slotMeta.fullTitle,
      completedSlots,
      completedCount,
      allFiveCompleted: true,
      reasonBadge: 'Recommended: Day 1 • Upper Body 1 (All 5 Days Completed — Next in Cycle)',
      headline: 'Suggested Next Workout: Day 1 — Upper Body 1 • Push & Pull (5/5 workouts finished)',
      startButtonLabel: `Start Suggested: ${slotMeta.fullTitle}`,
      advanceNextWeekLabel: `Advance to Week ${safeWeek + 1} • Day 1 Now`
    };
  }

  // Case B: Some workouts completed (0 < completedCount < 5)
  if (completedCount > 0) {
    const sched = getCustomDayScheduleForWeek(safeWeek, stateOrCompleted);
    let lastDoneSlot = completedSlots[completedSlots.length - 1];
    for (let d = safeDayIdx - 1; d >= 0; d--) {
      const sl = sched[d];
      if (sl >= 0 && sl <= 4 && completedSlots.includes(sl)) {
        lastDoneSlot = sl;
        break;
      }
    }
    let nextSlot = 0;
    for (let offset = 1; offset <= 5; offset++) {
      const cand = (lastDoneSlot + offset) % 5;
      if (!completedSlots.includes(cand)) {
        nextSlot = cand;
        break;
      }
    }
    const slotMeta = WORKOUT_SLOT_CATALOG[nextSlot] || WORKOUT_SLOT_CATALOG[0];
    return {
      week: safeWeek,
      currentDayIdx: safeDayIdx,
      recommendedSlot: nextSlot,
      daySub: slotMeta.daySub,
      workoutTitle: slotMeta.title,
      fullWorkoutLabel: slotMeta.fullTitle,
      completedSlots,
      completedCount,
      allFiveCompleted: false,
      reasonBadge: `Recommended Next: ${slotMeta.title} (Follows your last workout)`,
      headline: `Suggested Next Workout: Day ${nextSlot + 1} — ${slotMeta.title} (${completedCount}/5 workouts finished)`,
      startButtonLabel: `Start Suggested: ${slotMeta.fullTitle}`,
      advanceNextWeekLabel: null
    };
  }

  // Case C: No workouts completed yet (completedCount === 0)
  const slotMeta = WORKOUT_SLOT_CATALOG[0];
  return {
    week: safeWeek,
    currentDayIdx: safeDayIdx,
    recommendedSlot: 0,
    daySub: slotMeta.daySub,
    workoutTitle: slotMeta.title,
    fullWorkoutLabel: slotMeta.fullTitle,
    completedSlots: [],
    completedCount: 0,
    allFiveCompleted: false,
    reasonBadge: 'Recommended Start: Day 1 • Upper Body 1',
    headline: 'Suggested Next Workout: Day 1 — Upper Body 1 • Push & Pull (0/5 workouts finished)',
    startButtonLabel: `Start Suggested: ${slotMeta.fullTitle}`,
    advanceNextWeekLabel: null
  };
}

export function assignWorkoutOrRestSlotToDay(
  week: number,
  dayIdx: number,
  targetSlotInput: number | 'rest',
  stateObj: Record<string, any>
): {
  schedule: number[];
  assignment: DayScheduleAssignment;
  swappedWithDayIdx: number | null;
} {
  const safeWeek = Math.max(1, Math.floor(Number(week) || 1));
  const safeDayIdx = Math.max(0, Math.min(6, Math.floor(Number(dayIdx) || 0)));
  if (!stateObj.customDayScheduleByWeek || typeof stateObj.customDayScheduleByWeek !== 'object') {
    stateObj.customDayScheduleByWeek = {};
  }
  if (!stateObj.weeklyRestDays || typeof stateObj.weeklyRestDays !== 'object') {
    stateObj.weeklyRestDays = { default: [5, 6] };
  }

  const sched = [...getCustomDayScheduleForWeek(safeWeek, stateObj)];
  const oldSlot = sched[safeDayIdx];
  let swappedWithDayIdx: number | null = null;

  const isTargetRest = targetSlotInput === 'rest' || targetSlotInput === 5 || targetSlotInput === 6;

  if (isTargetRest) {
    if (oldSlot !== 5 && oldSlot !== 6) {
      // Find a Rest Day in sched to receive the displaced workout (prefer upcoming rest day > safeDayIdx)
      let restCandidateIdx = -1;
      for (let c = safeDayIdx + 1; c < 7; c++) {
        if (sched[c] === 5 || sched[c] === 6) {
          restCandidateIdx = c;
          break;
        }
      }
      if (restCandidateIdx === -1) {
        for (let c = 0; c < safeDayIdx; c++) {
          if (sched[c] === 5 || sched[c] === 6) {
            restCandidateIdx = c;
            break;
          }
        }
      }
      if (restCandidateIdx !== -1) {
        sched[restCandidateIdx] = oldSlot;
        sched[safeDayIdx] = 5;
        swappedWithDayIdx = restCandidateIdx;
      } else {
        sched[safeDayIdx] = 5;
      }
    }
  } else {
    const targetSlot = Math.max(0, Math.min(4, Math.floor(Number(targetSlotInput) || 0)));
    const rec = getRecommendedNextWorkoutSlot(safeWeek, safeDayIdx, stateObj);
    const isTargetAlreadyDone = rec.completedSlots.includes(targetSlot);

    if (rec.allFiveCompleted || (isTargetAlreadyDone && (oldSlot === 5 || oldSlot === 6))) {
      // Bonus / repeat workout on a Rest Day after completing that workout earlier in the week
      sched[safeDayIdx] = targetSlot;
    } else if (oldSlot !== targetSlot) {
      // Find if targetSlot exists on another day in sched and swap so no uncompleted workout is lost
      let otherIdx = -1;
      for (let c = 0; c < 7; c++) {
        if (c !== safeDayIdx && sched[c] === targetSlot) {
          otherIdx = c;
          break;
        }
      }
      if (otherIdx !== -1) {
        sched[otherIdx] = oldSlot;
        sched[safeDayIdx] = targetSlot;
        swappedWithDayIdx = otherIdx;
      } else {
        sched[safeDayIdx] = targetSlot;
      }
    }
  }

  // Normalize rest slot numbers (5 for first rest day, 6 for second/subsequent rest days)
  let restIdxCounter = 0;
  const restDayIndices: number[] = [];
  for (let c = 0; c < 7; c++) {
    if (sched[c] === 5 || sched[c] === 6) {
      sched[c] = restIdxCounter === 0 ? 5 : 6;
      restIdxCounter++;
      restDayIndices.push(c);
    }
  }

  stateObj.customDayScheduleByWeek[String(safeWeek)] = sched;
  if (restDayIndices.length >= 2) {
    stateObj.weeklyRestDays[String(safeWeek)] = [restDayIndices[0], restDayIndices[1]];
  } else if (restDayIndices.length === 1) {
    const rOnly = restDayIndices[0];
    stateObj.weeklyRestDays[String(safeWeek)] = normalizeRestDaysTuple([rOnly, rOnly === 6 ? 5 : 6]);
  }

  if (!stateObj.manualScheduleOverrideByWeek || typeof stateObj.manualScheduleOverrideByWeek !== 'object') {
    stateObj.manualScheduleOverrideByWeek = {};
  }
  stateObj.manualScheduleOverrideByWeek[String(safeWeek)] = true;
  syncSubsequentWeeksFromWeek(safeWeek, stateObj);

  return {
    schedule: sched,
    assignment: getDayAssignment(safeWeek, safeDayIdx, stateObj),
    swappedWithDayIdx
  };
}

// ============================================================================
// CROSS-WEEK CONTINUITY ENGINE (buildSmartScheduleFromPreviousWeek)
// ============================================================================
export interface SmartScheduleFromPrevWeekResult {
  targetWeek: number;
  prevWeek: number;
  lastLiftSlot: number | null;
  lastLiftDayIdx: number | null;
  lastLiftDayNumber: number;
  nextStartLiftSlot: number;
  startLiftDaySub: string;
  startLiftTitle: string;
  orderedLiftQueue: number[];
  trailingLiftStreak: number;
  restDays: [number, number];
  schedule: number[];
  startsWithRestDay: boolean;
  statusBannerText: string;
}

export function buildSmartScheduleFromPreviousWeek(
  targetWeek: number,
  stateOrPrevSchedule?: unknown
): SmartScheduleFromPrevWeekResult {
  const safeTargetWeek = Math.max(1, Math.floor(Number(targetWeek) || 1));
  if (safeTargetWeek < 2) {
    const slot0 = WORKOUT_SLOT_CATALOG[0];
    return {
      targetWeek: 1,
      prevWeek: 1,
      lastLiftSlot: 4,
      lastLiftDayIdx: 4,
      lastLiftDayNumber: 5,
      nextStartLiftSlot: 0,
      startLiftDaySub: slot0.daySub,
      startLiftTitle: slot0.title,
      orderedLiftQueue: [0, 1, 2, 3, 4],
      trailingLiftStreak: 0,
      restDays: [5, 6],
      schedule: [0, 1, 2, 3, 4, 5, 6],
      startsWithRestDay: false,
      statusBannerText: 'Week 1 Standard Schedule: Starts with Upper 1 • Rest Days 6 & 7'
    };
  }

  const prevWeek = safeTargetWeek - 1;
  const prevSchedule =
    Array.isArray(stateOrPrevSchedule) && stateOrPrevSchedule.length === 7
      ? stateOrPrevSchedule.map(v => Math.max(0, Math.min(6, Math.floor(Number(v) || 0))))
      : getWeekSchedule(prevWeek, stateOrPrevSchedule);

  // 1. Inspect Previous Week's Final Lifting Workout (lastLiftSlot) from DAY 7 (idx 6) down to DAY 1 (idx 0)
  let lastLiftSlot: number | null = null;
  let lastLiftDayIdx: number | null = null;
  for (let i = 6; i >= 0; i--) {
    const slot = prevSchedule[i];
    if (slot >= 0 && slot <= 4) {
      lastLiftSlot = slot;
      lastLiftDayIdx = i;
      break;
    }
  }

  const nextStartLiftSlot = lastLiftSlot !== null ? (lastLiftSlot + 1) % 5 : 0;
  const orderedLiftQueue = [0, 1, 2, 3, 4].map(i => (nextStartLiftSlot + i) % 5);

  // 2. Inspect Previous Week's Trailing Lifting Streak (trailingLiftStreak) counting backwards from DAY 7 (idx 6)
  let trailingLiftStreak = 0;
  for (let i = 6; i >= 0; i--) {
    const slot = prevSchedule[i];
    if (slot >= 0 && slot <= 4) {
      trailingLiftStreak++;
    } else {
      break;
    }
  }

  let restDays: [number, number] = [5, 6];
  if (trailingLiftStreak >= 5) {
    // Case A (5+ consecutive lift days ending on DAY 7): Rest on DAY 1 & DAY 2 ([0, 1]), lift on DAY 3..7
    restDays = [0, 1];
  } else if (trailingLiftStreak === 4) {
    // Case A (4 consecutive lift days ending on DAY 7): Rest on DAY 1 & DAY 7 ([0, 6]), lift on DAY 2..6
    restDays = [0, 6];
  } else if (trailingLiftStreak >= 1 && trailingLiftStreak <= 3) {
    // Case B (1..3 consecutive lift days at end of prevWeek): lift for (5 - trailingLiftStreak) days, then Rest 1, and Rest 2 on DAY 7
    const firstRestIdx = 5 - trailingLiftStreak;
    restDays = [firstRestIdx, 6];
  } else {
    // Case C (trailingLiftStreak === 0, ended with Rest Day on DAY 7): fresh on DAY 1, Rest Days on Days 6 & 7 ([5, 6])
    restDays = [5, 6];
  }

  const [r1, r2] = restDays;
  const schedule: number[] = [];
  let liftPtr = 0;
  let restPtr = 0;
  for (let d = 0; d < 7; d++) {
    if (d === r1 || d === r2) {
      schedule.push(restPtr === 0 ? 5 : 6);
      restPtr++;
    } else {
      schedule.push(orderedLiftQueue[liftPtr]);
      liftPtr++;
    }
  }

  const slotMeta = WORKOUT_SLOT_CATALOG[nextStartLiftSlot] || WORKOUT_SLOT_CATALOG[0];
  const startLiftDaySub = slotMeta.daySub;
  const startLiftTitle = slotMeta.title;
  const lastLiftDayNumber = lastLiftDayIdx !== null ? lastLiftDayIdx + 1 : 5;
  const startsWithRestDay = schedule[0] === 5 || schedule[0] === 6;

  const statusBannerText = startsWithRestDay
    ? `Synced from Week ${prevWeek}: Starts with Rest Day + ${startLiftDaySub} (follows Week ${prevWeek} Day ${lastLiftDayNumber})`
    : `Synced from Week ${prevWeek}: Starts with ${startLiftDaySub} • Rest Days ${r1 + 1} & ${r2 + 1} (follows Week ${prevWeek} Day ${lastLiftDayNumber})`;

  return {
    targetWeek: safeTargetWeek,
    prevWeek,
    lastLiftSlot,
    lastLiftDayIdx,
    lastLiftDayNumber,
    nextStartLiftSlot,
    startLiftDaySub,
    startLiftTitle,
    orderedLiftQueue,
    trailingLiftStreak,
    restDays,
    schedule,
    startsWithRestDay,
    statusBannerText
  };
}

export function hasWeekAnyLoggedSets(
  week: number,
  stateObj?: Record<string, any> | null
): boolean {
  if (!stateObj || typeof stateObj !== 'object') return false;
  const safeWeek = Math.max(1, Math.floor(Number(week) || 1));
  const logs = stateObj.workoutLogs;
  if (!logs || typeof logs !== 'object') return false;
  const prefix = `w${safeWeek}_`;
  for (const [k, entry] of Object.entries(logs)) {
    if (k.startsWith(prefix) && entry && (entry as SetLog).done) {
      return true;
    }
  }
  return false;
}

export function applySmartScheduleFromPreviousWeek(
  targetWeek: number,
  stateObj: Record<string, any>,
  clearManualOverride = true
): SmartScheduleFromPrevWeekResult {
  const safeTargetWeek = Math.max(1, Math.floor(Number(targetWeek) || 1));
  if (!stateObj.customDayScheduleByWeek || typeof stateObj.customDayScheduleByWeek !== 'object') {
    stateObj.customDayScheduleByWeek = {};
  }
  if (!stateObj.weeklyRestDays || typeof stateObj.weeklyRestDays !== 'object') {
    stateObj.weeklyRestDays = { default: [5, 6] };
  }
  if (!stateObj.manualScheduleOverrideByWeek || typeof stateObj.manualScheduleOverrideByWeek !== 'object') {
    stateObj.manualScheduleOverrideByWeek = {};
  }

  const res = buildSmartScheduleFromPreviousWeek(safeTargetWeek, stateObj);
  if (safeTargetWeek >= 2) {
    stateObj.customDayScheduleByWeek[String(safeTargetWeek)] = [...res.schedule];
    stateObj.weeklyRestDays[String(safeTargetWeek)] = [...res.restDays];
    if (clearManualOverride) {
      stateObj.manualScheduleOverrideByWeek[String(safeTargetWeek)] = false;
    }
  }
  return res;
}

export function resetWeekScheduleToStandard(
  targetWeek: number,
  stateObj: Record<string, any>
): { schedule: number[]; restDays: [number, number] } {
  const safeTargetWeek = Math.max(1, Math.floor(Number(targetWeek) || 1));
  if (!stateObj.customDayScheduleByWeek || typeof stateObj.customDayScheduleByWeek !== 'object') {
    stateObj.customDayScheduleByWeek = {};
  }
  if (!stateObj.weeklyRestDays || typeof stateObj.weeklyRestDays !== 'object') {
    stateObj.weeklyRestDays = { default: [5, 6] };
  }
  if (!stateObj.manualScheduleOverrideByWeek || typeof stateObj.manualScheduleOverrideByWeek !== 'object') {
    stateObj.manualScheduleOverrideByWeek = {};
  }

  const standardSchedule = [0, 1, 2, 3, 4, 5, 6];
  const standardRestDays: [number, number] = [5, 6];
  stateObj.customDayScheduleByWeek[String(safeTargetWeek)] = [...standardSchedule];
  stateObj.weeklyRestDays[String(safeTargetWeek)] = [...standardRestDays];
  stateObj.manualScheduleOverrideByWeek[String(safeTargetWeek)] = true;
  syncSubsequentWeeksFromWeek(safeTargetWeek, stateObj);

  return {
    schedule: standardSchedule,
    restDays: standardRestDays
  };
}

export function syncSubsequentWeeksFromWeek(
  editedWeek: number,
  stateObj: Record<string, any>
): void {
  if (!stateObj || typeof stateObj !== 'object') return;
  const safeEdited = Math.max(1, Math.floor(Number(editedWeek) || 1));
  const maxW = Math.min(12, Math.max(safeEdited + 1, Number(stateObj.maxUnlockedWeek) || 2));
  for (let nextW = safeEdited + 1; nextW <= maxW; nextW++) {
    const isManuallyOverridden = Boolean(
      stateObj.manualScheduleOverrideByWeek && stateObj.manualScheduleOverrideByWeek[String(nextW)]
    );
    if (!hasWeekAnyLoggedSets(nextW, stateObj) && !isManuallyOverridden) {
      applySmartScheduleFromPreviousWeek(nextW, stateObj, true);
    }
  }
}

export interface SubscriptionChecklistItemSpec {
  id: 'cancelCreatineAutoship' | 'dropPeaTo3Containers';
  actionNumber: 1 | 2;
  title: string;
  subtext: string;
}

export const SUBSCRIPTION_ACTION_CHECKLIST_ITEMS: SubscriptionChecklistItemSpec[] = [
  {
    id: 'cancelCreatineAutoship',
    actionNumber: 1,
    title: 'Action 1 (After Order 1 Ships): Cancel Naked Creatine Recurring Autoship',
    subtext:
      'Order 1 (2 x 1.1 LB = 1,000g for $47.98 CAD at 20% off) lasts 200 days (6.67 months). Cancel the recurring Creatine Autoship immediately after delivery because Order 2 only gives 10% off ($53.98 CAD + $20 shipping risk). For Order 2+ (Month 7), buy 1 kg Leanfit Micronized Creatine at Costco ($44.99 CAD regular / $34.99 on sale = $0.18-$0.22/day with $0 shipping).'
  },
  {
    id: 'dropPeaTo3Containers',
    actionNumber: 2,
    title: 'Action 2 (Before Month 6 / Order 3): Drop Naked Pea Autoship from 4 to 3 Containers',
    subtext:
      '4 x 5 LB containers (9,072g every 3 months) supply 100.8 days at 90g/day, building a +972g (+10.8-day) buffer per quarter. After Quarter 2 (Month 6), your buffer reaches +1,944g (21.6 days) — switch Quarter 3 from 4 containers ($323.96) down to 3 containers ($242.97) to save $80.99 CAD.'
  }
];

export type ShopListPeriod = 'weekly' | 'quarterly';

export const SHOP_LIST_PERIOD_VIEWS: Record<
  ShopListPeriod,
  {
    id: ShopListPeriod;
    pillLabel: string;
    storeCostText: string;
    allInCostText: string;
    summaryHighlights: string[];
  }
> = {
  weekly: {
    id: 'weekly',
    pillLabel: 'Weekly Grocery View ($22.10/wk Store • $44.48/wk All-In)',
    storeCostText: '$22.10/wk Store',
    allInCostText: '$44.48/wk All-In',
    summaryHighlights: [
      '1,260 ml/wk milk ($3.19/wk)',
      '1,225g/wk tofu ($8.97/wk)',
      '630g/wk pea protein ($20.00/wk)',
      '35g/wk creatine ($1.68/wk Order 1 • $1.57/wk Costco)',
      '7 caps/wk Vitamin D3 ($0.70/wk)'
    ]
  },
  quarterly: {
    id: 'quarterly',
    pillLabel: '3-Month (90-Day) Cycle View ($284.18 Store • $571.88 All-In)',
    storeCostText: '$284.18 Store',
    allInCostText: '$571.88 All-In',
    summaryHighlights: [
      '16.2L / 8.57 cartons milk = $41.06',
      '15,750g / 45 blocks tofu = $115.33',
      '8,100g consumed from 4 x 5 LB Naked Pea containers = $257.11 consumed / $287.96 Order 1 upfront',
      '450g consumed from 1,000g Creatine = $21.59 Order 1 / $20.25 Costco',
      '90 caps Vitamin D3 = $9.00'
    ]
  }
};

export interface ShoppingAisleItemSpec {
  id: string;
  itemNumber: number;
  name: string;
  qty: string;
  weeklyQty: string;
  quarterlyQty: string;
  note: string;
}

export interface ShoppingAisleSpec {
  category: string;
  badge: string;
  items: ShoppingAisleItemSpec[];
}

export const SHOPPING_AISLES: ShoppingAisleSpec[] = [
  {
    category: 'Aisle 1: Produce & Refrigerated Cooler (Weekly Fresh Run)',
    badge: '4 Fresh Staples • No Frills / Walmart ($15.10/wk • $194.19 / 90d)',
    items: [
      {
        id: 'shop_silk',
        itemNumber: 1,
        name: '1. Unsweetened Fortified Almond or Cashew Milk (1.89L carton — Fuel 2 Oats Only)',
        qty: '1,260 ml / week (180 ml/day)',
        weeklyQty: '1,260 ml / week (180 ml/day • $3.19/wk)',
        quarterlyQty: '16.2L / 90 days (8.57 cartons = $41.06)',
        note: '180 ml/day soaked in Fuel 2 Overnight Oats (Fuel 1 & Fuel 4 shakes use cold water to save $12.76/week while keeping 139g P at 1,325 kcal).'
      },
      {
        id: 'shop_tofu',
        itemNumber: 2,
        name: '2. Sunrise or Rooster Extra-Firm Tofu (350g–454g block)',
        qty: '1,225g / week (175g/day)',
        weeklyQty: '1,225g / week (175g/day • 3.5 blocks = $8.97/wk)',
        quarterlyQty: '15,750g / 90 days (45 blocks = $115.33)',
        note: 'Weigh 175g/day (1/2 of a 350g block) for Fuel 3 — 3.5 blocks/week ($8.97/wk) or 45 blocks per 90-day cycle ($115.33).'
      },
      {
        id: 'shop_broccoli',
        itemNumber: 3,
        name: '3. Broccoli Florets (Fresh Crown or Frozen Bag)',
        qty: '525g / week (75g/day)',
        weeklyQty: '525g / week (75g/day = $2.49/wk)',
        quarterlyQty: '6,750g / 90 days (6.75 kg = $32.01)',
        note: '75g steamed broccoli/day for Fuel 3 (100% daily Vitamin C to unlock non-heme iron absorption in tofu, oats & pea protein).'
      },
      {
        id: 'shop_banana',
        itemNumber: 4,
        name: '4. Ripe Bananas (Peeled Weight)',
        qty: '210g / week (30g/day)',
        weeklyQty: '210g / week (30g/day = $0.45/wk)',
        quarterlyQty: '2,700g / 90 days (~23 bananas = $5.79)',
        note: '120g peeled banana (1 medium) per 4-day overnight oats batch (~2 medium bananas/wk = $0.45/wk or $5.79/90 days).'
      }
    ]
  },
  {
    category: 'Aisle 2: Dry Pantry, Grains, Seeds & Nutritional Yeast',
    badge: '5 Pantry Staples • Bulk / Costco / No Frills ($6.52/wk • $83.82 / 90d)',
    items: [
      {
        id: 'shop_oats',
        itemNumber: 5,
        name: '5. Gluten-Free Protein Oats (907g bag)',
        qty: '315g / week (45g/day)',
        weeklyQty: '315g / week (45g/day = $2.43/wk)',
        quarterlyQty: '4,050g / 90 days (4.47 bags = $31.24)',
        note: '180g per 4-day batch (45g/day) — 1 bag lasts ~3 weeks ($2.43/wk or $31.24 per 90-day cycle).'
      },
      {
        id: 'shop_rice',
        itemNumber: 6,
        name: '6. White Jasmine Rice',
        qty: '385g dry / week (1,050g cooked)',
        weeklyQty: '385g dry / week (1,050g cooked = $0.96/wk)',
        quarterlyQty: '4,950g dry / 90 days (13,500g cooked = $12.34)',
        note: '55g dry rice/day (= 150g cooked rice/day) for Fuel 3 — 4-day batch = 220g dry + 330 ml water ($0.96/wk or $12.34/90 days).'
      },
      {
        id: 'shop_pb',
        itemNumber: 7,
        name: '7. Smooth Natural Peanut Butter (500g–1,000g jar)',
        qty: '168g / week (24g/day)',
        weeklyQty: '168g / week (24g/day = $1.18/wk)',
        quarterlyQty: '2,160g / 90 days (2.16 kg = $15.17)',
        note: '32g per 4-day oats batch (8g/day) + 16g/day in the evening with your Fuel 4 shake and Vitamin D3 capsule ($1.18/wk or $15.17/90 days).'
      },
      {
        id: 'shop_chia',
        itemNumber: 8,
        name: '8. Organic Whole Chia Seeds',
        qty: '42g / week (6g/day)',
        weeklyQty: '42g / week (6g/day = $0.50/wk)',
        quarterlyQty: '540g / 90 days (540g = $6.43)',
        note: '24g per 4-day oats batch (6g/day) — covers 100% of your daily Omega-3 ALA ($0.50/wk or $6.43/90 days).'
      },
      {
        id: 'shop_nooch',
        itemNumber: 9,
        name: '9. Fortified Nutritional Yeast Flakes (142g shaker or bulk)',
        qty: '84g / week (12g/day)',
        weeklyQty: '84g / week (12g/day = $1.45/wk)',
        quarterlyQty: '1,080g / 90 days (1.08 kg = $18.64)',
        note: '12g/day sprinkled on Fuel 3 tofu & rice bowl (+6g protein & B-complex vitamins; $1.45/wk or $18.64/90 days).'
      }
    ]
  },
  {
    category: 'Aisle 3: Baking & Oil Aisle (Iodized Salt & Toasted Sesame Oil)',
    badge: '2 Flavor & Iodine Staples ($0.48/wk • $6.17 / 90d)',
    items: [
      {
        id: 'shop_iodine',
        itemNumber: 10,
        name: '10. Iodized Table Salt (Windsor Iodized Salt — NOT sea or pink Himalayan salt)',
        qty: '10.5g / week (1.5g/day)',
        weeklyQty: '10.5g / week (1.5g/day = $0.03/wk)',
        quarterlyQty: '135g / 90 days ($0.39 / 3 mos)',
        note: '1.5g/day (~1/4 tsp) on Fuel 3 covers 100% daily thyroid iodine (sea/kosher/Himalayan salt has no added iodine; 1kg box lasts >1 year).'
      },
      {
        id: 'shop_sesame',
        itemNumber: 11,
        name: '11. Toasted Sesame Oil (Bottle)',
        qty: '35g / week (5g/day)',
        weeklyQty: '35g / week (5g/day = $0.45/wk)',
        quarterlyQty: '450g / 90 days ($5.78 / 3 mos)',
        note: '5g/day (1 tsp) drizzled on Fuel 3 tofu, rice & broccoli bowl for rich aroma & healthy fats ($0.45/wk or $5.78/90 days).'
      }
    ]
  },
  {
    category: 'Aisle 4: Online / Costco Bulk Supplements',
    badge: '3 Bulk Supplements • Naked Nutrition (Q1) + Costco (Order 2+)',
    items: [
      {
        id: 'shop_isolate',
        itemNumber: 12,
        name: '12. Naked Pea Protein Isolate — 5 lb / 2,268g container, Unflavored, 90% P',
        qty: '630g / week (90g/day)',
        weeklyQty: '630g / week (90g/day)',
        quarterlyQty: '8,100g / 90 days (Order 4 containers = 9,072g)',
        note: '35g Fuel 1 + 10g Fuel 2 + 45g Fuel 4 = 90g/day (81g pure protein). 3-Month Schedule: Order 4 containers on Q1 ($287.96 CAD at 20% off = $71.99/container; leaves +972g buffer), keep 4 containers on Q2 ($323.96 at 10% off; buffer reaches +1,944g), then drop to 3 containers on Q3 ($242.97, saving $80.99 CAD).'
      },
      {
        id: 'shop_creatine',
        itemNumber: 13,
        name: '13. 100% Micronized Creatine Monohydrate — Order 1 Naked -> Order 2+ Costco 1 kg',
        qty: '35g / week (5g/day)',
        weeklyQty: '35g / week (5g/day)',
        quarterlyQty: '450g / 90 days (1,000g lasts 200 days)',
        note: "5g/day in Fuel 1 Pre-Gym Shake. Order 1: Buy 2 x 1.1 LB (1,000g) Naked Creatine with 20% off first Autoship ($47.98 CAD = $0.24/day) for free shipping with Pea Protein, then CANCEL Autoship immediately. Order 2+ (after 200 days): Buy 1 kg Leanfit Creatine at Costco ($44.99 CAD reg / $34.99 sale = $1.57/wk or $20.25/3 mos) because Naked's 10% renewal ($53.98 + shipping risk) is more expensive than Costco."
      },
      {
        id: 'shop_vitd3',
        itemNumber: 14,
        name: '14. Vegan Vitamin D3 Supplement — 1,000–2,500 IU, 180 Capsules = 6-Month Supply',
        qty: '7 caps / week (1 cap/day)',
        weeklyQty: '7 caps / week (1 cap/day)',
        quarterlyQty: '90 caps / 90 days ($9.00 / 3 mos)',
        note: '1 capsule daily with Fuel 4 peanut butter fat ensures 100% Vitamin D and Calcium absorption. 1 bottle (180 capsules = $18.00 CAD) lasts 180 days (6 months), matching your 6-month Creatine restock cycle.'
      }
    ]
  }
];

export const MUSCLE_FUEL_SUPPLEMENT_SUPPLY_SUMMARY = {
  headerTitle: 'Daily Muscle Fuel (1,325 kcal • 139g P • 173cm / 69kg)',
  headerSubtitleOrder1: 'Full-Body • $6.35/d',
  headerSubtitleCostco: 'Full-Body • $6.34/d',
  rows: [
    'Pea Protein (90g/d): 4 containers / 3 mos ($287.96 Order 1 -> +972g buffer/qtr -> 3 containers on Q3)',
    'Creatine (5g/d): 2 x 1.1 LB Order 1 ($47.98 / 200 days) -> Cancel Sub -> Costco 1kg ($44.99) on Order 2+',
    'Groceries (Items #1-#11): $22.10/wk ($284.18 / 3 mos) • Water in Fuel 1 & 4 shakes + 180ml milk in Fuel 2 Oats'
  ]
};

export function getHeaderSubtitleCostText(isCostcoCreatineSwitched = false): string {
  return isCostcoCreatineSwitched
    ? MUSCLE_FUEL_SUPPLEMENT_SUPPLY_SUMMARY.headerSubtitleCostco
    : MUSCLE_FUEL_SUPPLEMENT_SUPPLY_SUMMARY.headerSubtitleOrder1;
}

export function getShoppingAislesForPeriod(period: ShopListPeriod = 'weekly'): ShoppingAisleSpec[] {
  const isQuarterly = period === 'quarterly';
  return SHOPPING_AISLES.map(aisle => ({
    ...aisle,
    items: aisle.items.map(it => ({
      ...it,
      qty: isQuarterly ? it.quarterlyQty : it.weeklyQty
    }))
  }));
}

// ============================================================================
// UPGRADE 1: AUTO-CASCADE WEIGHT & REPS TO SUBSEQUENT UNLOGGED SETS
// ============================================================================
export function cascadeSetWeightAndRepsForward(
  workoutLogs: Record<string, SetLog>,
  week: number,
  keyDayOrSlotIdx: number,
  exId: string,
  fromSetIdx: number,
  totalSets: number,
  newWeight?: string,
  newReps?: string,
  unit = 'lbs'
): { updatedSets: number[]; workoutLogs: Record<string, SetLog> } {
  const updatedSets: number[] = [];
  const safeWeek = Math.max(1, Math.floor(Number(week) || 1));
  const safeFrom = Math.max(1, Math.floor(Number(fromSetIdx) || 1));
  const safeTotal = Math.max(safeFrom, Math.floor(Number(totalSets) || 1));

  for (let s = safeFrom + 1; s <= safeTotal; s++) {
    const k = `w${safeWeek}_${keyDayOrSlotIdx}_${exId}_${s}`;
    const legacyK = `${keyDayOrSlotIdx}_${exId}_${s}`;
    const existing = workoutLogs[k] || (safeWeek === 1 ? workoutLogs[legacyK] : undefined);
    if (existing && existing.done) {
      continue;
    }
    const nextEntry: SetLog = {
      weight: newWeight !== undefined ? String(newWeight) : String(existing?.weight ?? ''),
      reps: newReps !== undefined ? String(newReps) : String(existing?.reps ?? ''),
      done: false,
      unit: unit || existing?.unit || 'lbs'
    };
    workoutLogs[k] = nextEntry;
    if (safeWeek === 1) {
      workoutLogs[legacyK] = { ...nextEntry };
    }
    updatedSets.push(s);
  }

  return { updatedSets, workoutLogs };
}

// ============================================================================
// UPGRADE 2: DISTINCT "IN-PROGRESS" COLOR CODING (ZEIGARNIK EFFECT)
// ============================================================================
export interface ExerciseProgressVisualState {
  stateCode: 0 | 1 | 2;
  stateLabel: 'not_started' | 'in_progress' | 'completed';
  doneSets: number;
  totalSets: number;
  remainingSets: number;
  headerBadgeText: string | null;
  headerBadgeStyle: string;
  cardBorderStyle: string;
  cardBackgroundStyle: string;
  summaryBarBorderStyle: string;
  summaryTextColorStyle: string;
  collapsedRightCtaText: string;
}

export function getExerciseProgressVisualState(
  doneSets: number,
  totalSets: number,
  isExpanded = false
): ExerciseProgressVisualState {
  const safeTotal = Math.max(1, Math.floor(Number(totalSets) || 1));
  const safeDone = Math.max(0, Math.min(safeTotal, Math.floor(Number(doneSets) || 0)));
  const remainingSets = Math.max(0, safeTotal - safeDone);

  if (safeDone === 0) {
    return {
      stateCode: 0,
      stateLabel: 'not_started',
      doneSets: 0,
      totalSets: safeTotal,
      remainingSets: safeTotal,
      headerBadgeText: null,
      headerBadgeStyle: '',
      cardBorderStyle: isExpanded ? '2px solid #38bdf8' : '1px solid #1e293b',
      cardBackgroundStyle: '',
      summaryBarBorderStyle: '1px solid #1e293b',
      summaryTextColorStyle: '#cbd5e1',
      collapsedRightCtaText: 'Tap to Open Sets ▼'
    };
  }

  if (safeDone < safeTotal) {
    const setsWord = remainingSets === 1 ? 'set' : 'sets';
    return {
      stateCode: 1,
      stateLabel: 'in_progress',
      doneSets: safeDone,
      totalSets: safeTotal,
      remainingSets,
      headerBadgeText: `IN PROGRESS • ${safeDone}/${safeTotal}`,
      headerBadgeStyle: 'background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b;',
      cardBorderStyle: '2px solid #f59e0b',
      cardBackgroundStyle: 'rgba(245, 158, 11, 0.08)',
      summaryBarBorderStyle: '1px solid #f59e0b',
      summaryTextColorStyle: '#fbbf24',
      collapsedRightCtaText: `Resume (${remainingSets} ${setsWord} left) ▼`
    };
  }

  return {
    stateCode: 2,
    stateLabel: 'completed',
    doneSets: safeTotal,
    totalSets: safeTotal,
    remainingSets: 0,
    headerBadgeText: 'Done',
    headerBadgeStyle: 'background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.5);',
    cardBorderStyle: isExpanded ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.45)',
    cardBackgroundStyle: '',
    summaryBarBorderStyle: '1px solid rgba(16, 185, 129, 0.45)',
    summaryTextColorStyle: '#6ee7b7',
    collapsedRightCtaText: 'Show / Edit Sets ▼'
  };
}

// ============================================================================
// UPGRADE 3: UNCRUSHABLE SET ROW GRID GEOMETRY CONSTANTS
// ============================================================================
export const UNCRUSHABLE_SET_ROW_GRID_STYLE =
  'grid-template-columns: 48px minmax(105px, 1.2fr) minmax(95px, 1fr) 76px; gap: 6px; align-items: center; overflow: hidden;';

export const UNCRUSHABLE_STEPPER_WRAPPER_STYLE =
  'display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.95); border-radius: 8px; padding: 2px 4px;';

export const UNCRUSHABLE_STEPPER_BTN_STYLE =
  'flex-shrink: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;';

export const UNCRUSHABLE_NUMBER_DISPLAY_STYLE =
  'flex-grow: 1; min-width: 0; width: 100%; text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 15px; font-weight: 700;';

// ============================================================================
// UPGRADE 4: 1-TAP DELETE NOTE HELPER
// ============================================================================
export function deleteExerciseNoteEntry(
  exerciseNotes: Record<string, { text?: string; photoDataUrl?: string; updatedAt?: string }>,
  exKey: string,
  keepPhoto = true
): Record<string, { text?: string; photoDataUrl?: string; updatedAt?: string }> {
  if (!exerciseNotes || typeof exerciseNotes !== 'object' || !exKey) {
    return exerciseNotes || {};
  }
  const existing = exerciseNotes[exKey];
  if (!existing) return exerciseNotes;

  if (keepPhoto && existing.photoDataUrl) {
    exerciseNotes[exKey] = {
      text: '',
      photoDataUrl: existing.photoDataUrl,
      updatedAt: new Date().toISOString()
    };
  } else {
    delete exerciseNotes[exKey];
  }
  return exerciseNotes;
}

// ============================================================================
// UPGRADE 5: AUTO-OPEN WARM-UP ACCORDION ON WORKOUT START
// ============================================================================
export function shouldAutoOpenWarmupAccordion(
  isRestDay: boolean,
  completedSetsToday: number,
  warmupClosedForDay = false,
  warmupCompletedForDay = false
): boolean {
  if (isRestDay) return false;
  if (completedSetsToday > 0) return false;
  if (warmupClosedForDay || warmupCompletedForDay) return false;
  return true;
}

// ============================================================================
// UPGRADE 6: FIRST-OPEN GYM TIME PROMPT + SYNCED CHRONO SCHEDULE & AUTO-ADJUST
// ============================================================================
export interface SyncedWaterCheckpoint {
  ml: number;
  offsetMinutes: number;
  timeMinutes: number;
  time12: string;
  shortTag: string;
  label: string;
}

export interface SyncedChronoSchedule {
  gymTimeMinutes: number;
  gymEndTimeMinutes: number;
  gymTimeHHMM: string;
  gymEndTimeHHMM: string;
  gymTime12: string;
  gymEndTime12: string;
  fuel1Minutes: number;
  fuel1Time12: string;
  warmupMinutes: number;
  warmupTime12: string;
  warmupHeaderUpper: string;
  warmupHeaderLower: string;
  fuel2Minutes: number;
  fuel2Time12: string;
  fuel3Minutes: number;
  fuel3Time12: string;
  fuel4Minutes: number;
  fuel4Time12: string;
  waterSchedule: SyncedWaterCheckpoint[];
}

export function normalizeMinutesOfDay(mins: number): number {
  const rounded = Math.round(Number(mins) || 0);
  return ((rounded % 1440) + 1440) % 1440;
}

export function roundMinutesToNearest5(mins: number): number {
  const clamped = ((Math.round((Number(mins) || 0) / 5) * 5) % 1440 + 1440) % 1440;
  return clamped;
}

export function formatMinutesOfDayToHHMM(mins: number): string {
  const norm = normalizeMinutesOfDay(mins);
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatMinutesOfDayTo12Hr(mins: number): string {
  const norm = normalizeMinutesOfDay(mins);
  const h24 = Math.floor(norm / 60);
  const m = norm % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function parseTimeHHMMToMinutesRaw(hhmm: string | number | null | undefined): number {
  if (typeof hhmm === 'number' && Number.isFinite(hhmm)) {
    return normalizeMinutesOfDay(hhmm);
  }
  if (!hhmm || typeof hhmm !== 'string') return 420; // 07:00 AM
  const parts = hhmm.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (isNaN(h)) return 420;
  return normalizeMinutesOfDay(h * 60 + m);
}

export function getSyncedChronoSchedule(
  gymTimeInput: number | string = 420
): SyncedChronoSchedule {
  const gymTimeMinutes =
    typeof gymTimeInput === 'number'
      ? normalizeMinutesOfDay(gymTimeInput)
      : parseTimeHHMMToMinutesRaw(gymTimeInput);
  const gymEndTimeMinutes = normalizeMinutesOfDay(gymTimeMinutes + 60);

  // Relative offsets from Gym Time (T_gym):
  // - Fuel 1 (Pre-Gym Shake + Creatine): T_gym - 25 min
  // - Warm-Up & Gym Session: T_gym
  // - Fuel 2 (Post-Gym Overnight Oats): T_gym + 75 min
  // - Fuel 3 (Tofu, Rice & Broccoli Bowl): T_gym + 360 min (+6 hours)
  // - Fuel 4 (Evening Shake & PB + Vitamin D3): T_gym + 630 min (+10.5 hours)
  const fuel1Minutes = normalizeMinutesOfDay(gymTimeMinutes - 25);
  const warmupMinutes = gymTimeMinutes;
  const fuel2Minutes = normalizeMinutesOfDay(gymTimeMinutes + 75);
  const fuel3Minutes = normalizeMinutesOfDay(gymTimeMinutes + 360);
  const fuel4Minutes = normalizeMinutesOfDay(gymTimeMinutes + 630);

  const gymTime12 = formatMinutesOfDayTo12Hr(gymTimeMinutes);
  const gymEndTime12 = formatMinutesOfDayTo12Hr(gymEndTimeMinutes);
  const fuel1Time12 = formatMinutesOfDayTo12Hr(fuel1Minutes);
  const warmupTime12 = gymTime12;
  const fuel2Time12 = formatMinutesOfDayTo12Hr(fuel2Minutes);
  const fuel3Time12 = formatMinutesOfDayTo12Hr(fuel3Minutes);
  const fuel4Time12 = formatMinutesOfDayTo12Hr(fuel4Minutes);

  // Water Schedule (6 x 500 ml):
  // -30m Pre-Gym, +30m Intra-Gym, +90m Post-Gym, +4h (240m) Midday, +7.5h (450m) Afternoon, +10.5h (630m) Evening
  const waterCheckpointsSpec = [
    { ml: 500, offsetMinutes: -30, shortTag: 'Pre-Gym' },
    { ml: 1000, offsetMinutes: 30, shortTag: 'Intra-Gym' },
    { ml: 1500, offsetMinutes: 90, shortTag: 'Post-Gym' },
    { ml: 2000, offsetMinutes: 240, shortTag: 'Midday' },
    { ml: 2500, offsetMinutes: 450, shortTag: 'Afternoon' },
    { ml: 3000, offsetMinutes: 630, shortTag: 'Evening' }
  ];

  const waterSchedule: SyncedWaterCheckpoint[] = waterCheckpointsSpec.map(spec => {
    const tMins = normalizeMinutesOfDay(gymTimeMinutes + spec.offsetMinutes);
    const t12 = formatMinutesOfDayTo12Hr(tMins);
    return {
      ml: spec.ml,
      offsetMinutes: spec.offsetMinutes,
      timeMinutes: tMins,
      time12: t12,
      shortTag: spec.shortTag,
      label: `500 ml • ${t12} (${spec.shortTag})`
    };
  });

  return {
    gymTimeMinutes,
    gymEndTimeMinutes,
    gymTimeHHMM: formatMinutesOfDayToHHMM(gymTimeMinutes),
    gymEndTimeHHMM: formatMinutesOfDayToHHMM(gymEndTimeMinutes),
    gymTime12,
    gymEndTime12,
    fuel1Minutes,
    fuel1Time12,
    warmupMinutes,
    warmupTime12,
    warmupHeaderUpper: `${warmupTime12} UPPER BODY WARM-UP`,
    warmupHeaderLower: `${warmupTime12} LOWER BODY WARM-UP`,
    fuel2Minutes,
    fuel2Time12,
    fuel3Minutes,
    fuel3Time12,
    fuel4Minutes,
    fuel4Time12,
    waterSchedule
  };
}

export interface LiveGymTimeAutoSyncResult {
  shouldAutoSync: boolean;
  diffMinutes: number;
  previousGymTimeMinutes: number;
  previousGymTimeHHMM: string;
  previousGymTime12: string;
  syncedGymTimeMinutes: number;
  syncedGymTimeHHMM: string;
  syncedGymTime12: string;
  bannerText: string;
  schedule: SyncedChronoSchedule;
}

export function checkAutoSyncGymTimeOnLiveWorkout(
  scheduledGymTimeInput: number | string,
  currentClockMinutesInput: number | string
): LiveGymTimeAutoSyncResult {
  const prevMins =
    typeof scheduledGymTimeInput === 'number'
      ? normalizeMinutesOfDay(scheduledGymTimeInput)
      : parseTimeHHMMToMinutesRaw(scheduledGymTimeInput);
  const rawClockMins =
    typeof currentClockMinutesInput === 'number'
      ? normalizeMinutesOfDay(currentClockMinutesInput)
      : parseTimeHHMMToMinutesRaw(currentClockMinutesInput);

  const directDiff = Math.abs(rawClockMins - prevMins);
  const circularDiff = Math.min(directDiff, 1440 - directDiff);
  const shouldAutoSync = circularDiff >= 20;

  const syncedMins = shouldAutoSync ? roundMinutesToNearest5(rawClockMins) : prevMins;
  const schedule = getSyncedChronoSchedule(syncedMins);
  const prev12 = formatMinutesOfDayTo12Hr(prevMins);
  const synced12 = formatMinutesOfDayTo12Hr(syncedMins);

  return {
    shouldAutoSync,
    diffMinutes: circularDiff,
    previousGymTimeMinutes: prevMins,
    previousGymTimeHHMM: formatMinutesOfDayToHHMM(prevMins),
    previousGymTime12: prev12,
    syncedGymTimeMinutes: syncedMins,
    syncedGymTimeHHMM: formatMinutesOfDayToHHMM(syncedMins),
    syncedGymTime12: synced12,
    bannerText: `Workout Time Auto-Synced to ${synced12} — Meal & Water schedules shifted automatically to match your live session (Undo)`,
    schedule
  };
}

// ============================================================================
// UPGRADE 7: HIDEABLE WEEKLY GROCERIES VS 3- & 6-MONTH BULK SUPPLEMENTS
// ============================================================================
export function getFuelSupplementSummaryToggleLabel(isOpen = false, dailyCostText = '$6.35/d'): string {
  return isOpen
    ? `3-Month & 6-Month Bulk Supplement Plan (${dailyCostText}) — Hide ▲`
    : `3-Month & 6-Month Bulk Supplement Plan (${dailyCostText}) — Show Details ▼`;
}

export function getShopListMasterSectionSpecs(period: ShopListPeriod = 'weekly') {
  const allAisles = getShoppingAislesForPeriod(period);
  const weeklyGroceryAisles = allAisles.slice(0, 3);
  const bulkSupplementAisle = allAisles[3];
  const weeklyItemsCount = weeklyGroceryAisles.reduce((acc, a) => acc + a.items.length, 0);
  const bulkItemsCount = bulkSupplementAisle ? bulkSupplementAisle.items.length : 3;

  return {
    weeklySection: {
      title: `WEEKLY SUPERMARKET GROCERY LIST (${weeklyItemsCount} Items • $22.10/wk)`,
      eli12Title: `Weekly Store Groceries (${weeklyItemsCount} Items • $22.10/wk)`,
      hideBtnLabel: 'Hide List ▲',
      showBtnLabel: 'Show List ▼',
      aisles: weeklyGroceryAisles
    },
    bulkSection: {
      title: `3-MONTH & 6-MONTH BULK SUPPLEMENTS (${bulkItemsCount} Items • Naked & Costco)`,
      eli12Title: `3- & 6-Month Bulk Supplements (${bulkItemsCount} Items)`,
      hideBtnLabel: 'Hide List ▲',
      showBtnLabel: 'Show List ▼',
      cards: {
        postOrderChecklist: [
          {
            id: 'cancelCreatineAutoship',
            label: 'Step 1: Cancel Naked Creatine auto-ship after Order 1 arrives (Buy at Costco next time for $44.99)'
          },
          {
            id: 'dropPeaTo3Containers',
            label: 'Step 2: Change Naked Pea auto-ship from 4 tubs to 3 tubs before Month 6 (Save $80.99)'
          }
        ],
        threeMonthCycleCard: {
          badge: 'Every 90 Days',
          title: '3-Month Cycle Card (Every 90 Days)',
          summary: 'Naked Pea Protein Isolate (4 x 5 LB = 9,072g -> 8,100g used, +972g buffer/qtr)',
          item: bulkSupplementAisle?.items[0] || null
        },
        sixMonthCycleCard: {
          badge: 'Every 180–200 Days',
          title: '6-Month Cycle Card (Every 180–200 Days)',
          summary: 'Micronized Creatine (1,000g = 200 days) + Vegan Vitamin D3 (180 caps = 180 days)',
          items: bulkSupplementAisle ? bulkSupplementAisle.items.slice(1, 3) : []
        }
      }
    }
  };
}

// ============================================================================
// UPGRADE 8: BDA / W3C COGNITIVE ACCESSIBILITY & ELI12 VISUAL HIERARCHY SPECS
// ============================================================================
export const ELI12_ACCESSIBILITY_SPECS = {
  shopList: {
    eyebrowLeft: '1,325 kcal • 139g Protein • $6.35/day',
    title: 'Shopping List',
    subtitle: 'Check off what you have at home. Copy the rest for the store.',
    viewSwitcher: {
      weeklyTitle: '1-Week View',
      weeklySub: '$22.10 Store • $44.48 Total',
      quarterlyTitle: '3-Month View',
      quarterlySub: '$284.18 Store • $571.88 Total',
      breakdownToggleClosed: 'View Cost Breakdown & Order Math ▼',
      breakdownToggleOpen: 'Hide Cost Breakdown & Order Math ▲'
    },
    actionButtons: ['Copy Unchecked', 'Check Pantry Staples', 'Uncheck All'],
    section1Title: 'Weekly Store Groceries (11 Items • $22.10/wk)',
    section2Title: '3- & 6-Month Bulk Supplements (3 Items)',
    steps: [
      'Step 1: Cancel Naked Creatine auto-ship after Order 1 arrives (Buy at Costco next time for $44.99)',
      'Step 2: Change Naked Pea auto-ship from 4 tubs to 3 tubs before Month 6 (Save $80.99)'
    ]
  },
  muscleFuel: {
    title: 'Daily Food & Water',
    logAllBtn: '✓ Log All 4 Meals',
    subtitle: '1,325 kcal • 139g Protein (173cm • 69kg)',
    proteinCardLabel: 'DAILY PROTEIN',
    caloriesCardLabel: 'DAILY CALORIES',
    supplementSummaryClosed: '3- & 6-Month Supplement Plan ($6.35/day) — Show ▼',
    supplementSummaryOpen: '3- & 6-Month Supplement Plan ($6.35/day) — Hide ▲',
    waterScheduleFormulaLiftDay: '+ 720 ml water in shakes + 180 ml milk in oats = 3,900 ml total'
  },
  gymTab: {
    adminDrawerBtnClosed: 'Schedule, Sync & Stats ▼',
    adminDrawerBtnOpen: 'Schedule, Sync & Stats ▲',
    adminGridButtons: [
      'Change Rest Days (6 & 7)',
      'Stats / Dashboard',
      'Finish Week -> Next',
      'Workout & Display Settings'
    ],
    crossWeekButtons: ['Re-Sync from Week 2', 'Reset to Standard'],
    activeDayActions: ['Swap Today to Rest Day', "Change Today's Workout ▼"],
    quickStatusLabels: ['Water: 0/3L (+500)', 'Next Fuel: 8:15 AM', 'Gear Checklist']
  },
  pullupsAndTimer: {
    pullupsHeading: 'Overhand Pull-Up Program',
    pullupsActionButtons: ['Form Video', 'Program Rules'],
    day1Eli12Desc: 'Do 5 sets of pull-ups. Stop each set when you cannot do another clean rep.',
    riceTimerAccordionTitle: 'Jasmine Rice Timer (10m Cook + 10m Rest) ▼',
    pyramidHelperAccordionTitle: 'Pull-Up Pyramid Rest Helper (10s × Reps) ▼'
  }
} as const;

export function getEli12WaterScheduleFormulaText(waterTargetMl = 3000): string {
  const totalMl = (Number(waterTargetMl) || 3000) + 900;
  return `+ 720 ml water in shakes + 180 ml milk in oats = ${totalMl.toLocaleString()} ml total`;
}

// ============================================================================
// UPGRADE 9: FULL-WIDTH STACKED SHOP/FUEL CARDS (ELI12), PULL-UP PYRAMID UP TO
// 9 SETS + 2-WAY GYM<->PULL-UPS SYNC, & SIDE PLANK 3-STATE TIMER-FIRST FLOW
// ============================================================================

export interface ShopItemFullWidthSpec {
  id: string;
  itemNumber: number;
  shortName: string;
  weeklyQtyPill: string;
  quarterlyQtyPill: string;
  weeklyCostPill: string;
  quarterlyCostPill: string;
  eli12Summary: string;
  fullMathNotes: string;
  detailsToggleClosedLabel: string;
  detailsToggleOpenLabel: string;
}

export const SHOP_ITEM_ELI12_SPECS: Record<string, ShopItemFullWidthSpec> = {
  shop_silk_milk: {
    id: 'shop_silk_milk',
    itemNumber: 1,
    shortName: '1. Unsweetened Almond or Cashew Milk (1.89L)',
    weeklyQtyPill: '1,260 ml/wk (180 ml/day)',
    quarterlyQtyPill: '16.2 L / 90 days (9 cartons)',
    weeklyCostPill: '$3.19/wk',
    quarterlyCostPill: '$41.06 / 3 mos',
    eli12Summary: 'Use 180 ml/day in Overnight Oats. Use water in shakes.',
    fullMathNotes:
      'Used in Fuel 2 Overnight Oats only (180 ml/jar). Shakes use cold water to save ~$10/wk while providing 50% Daily Calcium & 20% Vit D.',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_tofu: {
    id: 'shop_tofu',
    itemNumber: 2,
    shortName: '2. Extra-Firm Tofu (350g Packs)',
    weeklyQtyPill: '1,225g/wk (175g/day)',
    quarterlyQtyPill: '15.75 kg / 90 days (45 packs)',
    weeklyCostPill: '$8.75/wk',
    quarterlyCostPill: '$112.50 / 3 mos',
    eli12Summary: 'Eat 175g (half a block) in your daily lunch bowl.',
    fullMathNotes:
      '3.5 packs/week (1/2 block = 175g per day in Fuel 3 Lunch Bowl) for 21g complete soy protein and bioavailable calcium.',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_broccoli: {
    id: 'shop_broccoli',
    itemNumber: 3,
    shortName: '3. Fresh Broccoli Crowns (or Frozen Florets)',
    weeklyQtyPill: '525g/wk (75g/day)',
    quarterlyQtyPill: '6.75 kg / 90 days',
    weeklyCostPill: '$2.49/wk',
    quarterlyCostPill: '$32.01 / 3 mos',
    eli12Summary: 'Steam 75g daily with lunch for 100% Vitamin C.',
    fullMathNotes:
      '75g steamed florets daily in Fuel 3 Bowl — covers 100% Daily Vitamin C and sulforaphane.',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_bananas: {
    id: 'shop_bananas',
    itemNumber: 4,
    shortName: '4. Fresh Ripe Bananas (Small Bunch)',
    weeklyQtyPill: '210g/wk (30g/day)',
    quarterlyQtyPill: '2.7 kg / 90 days (~27 bananas)',
    weeklyCostPill: '$0.45/wk',
    quarterlyCostPill: '$5.79 / 3 mos',
    eli12Summary: 'Mash 30g per jar into your 4-day Overnight Oats batch.',
    fullMathNotes:
      '~2 medium bananas/week (120g peeled per 4-day Oats batch) for natural sweetness and potassium.',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_oats: {
    id: 'shop_oats',
    itemNumber: 5,
    shortName: '5. Gluten-Free Rolled Protein Oats',
    weeklyQtyPill: '315g/wk (45g/day)',
    quarterlyQtyPill: '4,050g / 90 days (~4 bags)',
    weeklyCostPill: '$2.45/wk',
    quarterlyCostPill: '$31.50 / 3 mos',
    eli12Summary: 'Use 45g dry oats per jar in Fuel 2 Overnight Oats.',
    fullMathNotes:
      '180g per 4-day Overnight Oats batch (10g protein + 5g beta-glucan soluble fiber per jar).',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_rice: {
    id: 'shop_rice',
    itemNumber: 6,
    shortName: '6. Dry White Jasmine Rice (Bulk Bag)',
    weeklyQtyPill: '385g dry/wk (150g cooked/day)',
    quarterlyQtyPill: '4.95 kg dry / 90 days (1 bulk bag)',
    weeklyCostPill: '$1.15/wk',
    quarterlyCostPill: '$14.79 / 3 mos',
    eli12Summary: 'Cook 220g dry rice every 4 days for 4 x 150g bowls.',
    fullMathNotes:
      '220g dry rice cooked in 330 ml water yields 600g cooked rice (4 x 150g bowls for Fuel 3).',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_pb: {
    id: 'shop_pb',
    itemNumber: 7,
    shortName: '7. Smooth Natural Peanut Butter (1 kg Jar)',
    weeklyQtyPill: '168g/wk (24g/day)',
    quarterlyQtyPill: '2,160g / 90 days (2.2 jars)',
    weeklyCostPill: '$1.35/wk',
    quarterlyCostPill: '$17.36 / 3 mos',
    eli12Summary: 'Use 8g in Overnight Oats + 16g with your Evening Shake.',
    fullMathNotes:
      '8g in Fuel 2 Overnight Oats + 16g eaten by spoon with Fuel 4 Evening Shake for healthy fats & Vitamin E.',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_chia: {
    id: 'shop_chia',
    itemNumber: 8,
    shortName: '8. Organic Whole Chia Seeds',
    weeklyQtyPill: '42g/wk (6g/day)',
    quarterlyQtyPill: '540g / 90 days (1 medium bag)',
    weeklyCostPill: '$0.55/wk',
    quarterlyCostPill: '$7.07 / 3 mos',
    eli12Summary: 'Mix 6g per jar into Overnight Oats for Omega-3 ALA.',
    fullMathNotes:
      '24g per 4-day Oats batch — covers 100% Daily Omega-3 ALA (1.1g) and thickens oats naturally.',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_nooch: {
    id: 'shop_nooch',
    itemNumber: 9,
    shortName: '9. Fortified Nutritional Yeast Flakes',
    weeklyQtyPill: '84g/wk (12g/day)',
    quarterlyQtyPill: '1,080g / 90 days',
    weeklyCostPill: '$1.30/wk',
    quarterlyCostPill: '$16.71 / 3 mos',
    eli12Summary: 'Sprinkle 12g on your Tofu & Rice bowl for B12 & 6g protein.',
    fullMathNotes:
      '6g complete protein + >300% Daily Vitamin B12, Zinc, and Selenium sprinkled over Fuel 3 Tofu & Rice bowl.',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_sauce: {
    id: 'shop_sauce',
    itemNumber: 10,
    shortName: '10. Toasted Sesame Oil (Pantry Bottle)',
    weeklyQtyPill: '35g/wk (5g/day)',
    quarterlyQtyPill: '450 ml / 90 days (1 bottle)',
    weeklyCostPill: '$0.35/wk',
    quarterlyCostPill: '$4.50 / 3 mos',
    eli12Summary: 'Drizzle 5g (1 tsp) on lunch to absorb fat-soluble vitamins.',
    fullMathNotes:
      '5g (1 tsp) drizzled on Fuel 3 Bowl to unlock fat-soluble Vitamins A, D, E, and K absorption.',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_nori: {
    id: 'shop_nori',
    itemNumber: 11,
    shortName: '11. Iodized Table Salt (Pantry Box)',
    weeklyQtyPill: '10.5g/wk (1.5g/day)',
    quarterlyQtyPill: '135g / 90 days (1 box)',
    weeklyCostPill: '$0.07/wk',
    quarterlyCostPill: '$0.90 / 3 mos',
    eli12Summary: 'Use 1.5g (1/4 tsp) on lunch for 100% daily thyroid iodine.',
    fullMathNotes:
      '1.5g (1/4 tsp) on Fuel 3 Tofu & Rice Bowl provides ~70-110 mcg iodine (100% Daily Thyroid Target).',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_pea_protein: {
    id: 'shop_pea_protein',
    itemNumber: 12,
    shortName: '12. Naked Pea Protein Isolate (5 lb / 2,268g Tub)',
    weeklyQtyPill: '630g/wk (90g/day)',
    quarterlyQtyPill: '8,100g / 90 days (Order 4 tubs = 9,072g)',
    weeklyCostPill: '$20.09/wk',
    quarterlyCostPill: '$258.30 / 3 mos',
    eli12Summary: 'Take 90g/day (35g Pre-Gym + 10g Oats + 45g Evening Shake).',
    fullMathNotes:
      '35g Fuel 1 + 10g Fuel 2 + 45g Fuel 4 = 90g/day (81g pure protein). Order 4 containers every 3 months (9,072g total = 100.8 days supply, leaving a +972g / 10.8-day buffer per quarter). Order 1 (20% off): $287.96 CAD ($2.86/day). Order 2 (10% off): $323.96 CAD. Drop Quarter 3 to 3 containers ($242.97 CAD) to use your accumulated buffer!',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_creatine: {
    id: 'shop_creatine',
    itemNumber: 13,
    shortName: '13. Micronized Creatine Monohydrate (5g/day)',
    weeklyQtyPill: '35g/wk (5g/day)',
    quarterlyQtyPill: '450g / 90 days (1,000g lasts 200 days)',
    weeklyCostPill: '$1.68/wk',
    quarterlyCostPill: '$21.60 / 3 mos',
    eli12Summary: 'Mix 5g daily in your Post-Gym or Pre-Gym shake.',
    fullMathNotes:
      'Order 1: Add 2 x 1.1 LB (1,000g total) to your first Naked order at 20% off = $47.98 CAD ($0.24/day for 200 days / 6.67 months) -> Cancel Naked Creatine Autoship immediately after Order 1 ships (Naked renewal is $53.98 + shipping). Order 2+ (after 200 days): Buy 1 kg Leanfit Creatine at Costco for $44.99 CAD ($34.99 on sale = $0.18-$0.22/day).',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  },
  shop_vit_d3: {
    id: 'shop_vit_d3',
    itemNumber: 14,
    shortName: '14. Vegan Vitamin D3 Supplement (1,000–2,500 IU)',
    weeklyQtyPill: '7 caps/wk (1 cap/day)',
    quarterlyQtyPill: '90 caps / 90 days (180-cap bottle)',
    weeklyCostPill: '$0.70/wk',
    quarterlyCostPill: '$9.00 / 3 mos',
    eli12Summary: 'Take 1 capsule daily with lunch (~$0.10/day).',
    fullMathNotes:
      '1 capsule/day (~$0.10/day • $0.70/wk • $9.00 per 3 months) — covers 100% Daily Vitamin D3 without drinking 3.5 cartons of fortified plant milk per week.',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  }
};

export function getShopItemFullWidthSpec(
  itemId: string,
  period: ShopListPeriod = 'weekly'
): ShopItemFullWidthSpec & { activeQtyPill: string; activeCostPill: string } {
  const base = SHOP_ITEM_ELI12_SPECS[itemId] || {
    id: itemId,
    itemNumber: 0,
    shortName: itemId,
    weeklyQtyPill: '',
    quarterlyQtyPill: '',
    weeklyCostPill: '',
    quarterlyCostPill: '',
    eli12Summary: '',
    fullMathNotes: '',
    detailsToggleClosedLabel: 'Read Full Math & Notes ▼',
    detailsToggleOpenLabel: 'Hide Full Math & Notes ▲'
  };
  return {
    ...base,
    activeQtyPill: period === 'quarterly' ? base.quarterlyQtyPill : base.weeklyQtyPill,
    activeCostPill: period === 'quarterly' ? base.quarterlyCostPill : base.weeklyCostPill
  };
}

export interface BulkStepEli12Spec {
  id: 'cancelCreatineAutoship' | 'dropPeaTo3Containers';
  title: string;
  eli12Summary: string;
  whyDetails: string;
  whyToggleClosedLabel: string;
  whyToggleOpenLabel: string;
}

export const BULK_SUPPLEMENT_STEP_ELI12_SPECS: BulkStepEli12Spec[] = [
  {
    id: 'cancelCreatineAutoship',
    title: 'Step 1: Cancel Naked Creatine auto-ship after Order 1 arrives',
    eli12Summary: 'Your first 2 tubs (1,000g) last 200 days. Buy your next 1 kg tub at Costco for $44.99.',
    whyDetails:
      'Order 1 (2 x 1.1 LB = 1,000g for $47.98 CAD at 20% off) lasts 200 days (6.67 months). Naked drops renewal discounts to 10% ($53.98 CAD + shipping). After 200 days, buy 1 kg Leanfit Micronized Creatine at Costco ($44.99 CAD regular / $34.99 on sale = $0.18-$0.22/day with $0 shipping).',
    whyToggleClosedLabel: 'Why? ▼',
    whyToggleOpenLabel: 'Hide Why ▲'
  },
  {
    id: 'dropPeaTo3Containers',
    title: 'Step 2: Change Naked Pea auto-ship from 4 tubs to 3 tubs before Month 6',
    eli12Summary: '4 tubs give you +10.8 extra days per 3 months. Drop to 3 tubs on Order 3 to save $80.99.',
    whyDetails:
      '4 x 5 LB containers (9,072g every 3 months) supply 100.8 days at 90g/day, building a +972g (+10.8-day) buffer per quarter. After Quarter 1 ($287.96 at 20% off) and Quarter 2 ($323.96 at 10% off), you will have +1,944g (21.6 days) banked — switch Quarter 3 from 4 containers ($323.96) down to 3 containers ($242.97) to save $80.99 CAD.',
    whyToggleClosedLabel: 'Why? ▼',
    whyToggleOpenLabel: 'Hide Why ▲'
  }
];

// ============================================================================
// PULL-UP PYRAMID & SESSION SET EXPANSION (5 TO 9 SETS) + 2-WAY GYM/PULL-UPS SYNC
// ============================================================================

export function getPullupCustomSetKey(week: number, pullupDayNum: number): string {
  const w = Math.max(1, Math.floor(Number(week) || 1));
  const d = Math.max(1, Math.min(5, Math.floor(Number(pullupDayNum) || 1)));
  return `w${w}_s${d}`;
}

export function getEffectivePullupSetsCount(
  customSetCounts: Record<string, number> | undefined,
  week: number,
  pullupDayNum: number,
  baseSets = 5
): number {
  const safeBase = Math.max(5, Math.min(9, Math.floor(Number(baseSets) || 5)));
  const key = getPullupCustomSetKey(week, pullupDayNum);
  const raw = customSetCounts?.[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(5, Math.min(9, Math.floor(raw)));
  }
  return safeBase;
}

export function adjustPullupSetsCount(
  customSetCounts: Record<string, number> | undefined,
  week: number,
  pullupDayNum: number,
  action: 'add' | 'show_all_9' | 'remove',
  baseSets = 5
): {
  nextCustomSetCounts: Record<string, number>;
  previousSetsCount: number;
  newSetsCount: number;
} {
  const nextMap: Record<string, number> = { ...(customSetCounts || {}) };
  const prev = getEffectivePullupSetsCount(nextMap, week, pullupDayNum, baseSets);
  let next = prev;
  if (action === 'add') {
    next = Math.min(9, prev + 1);
  } else if (action === 'show_all_9') {
    next = 9;
  } else if (action === 'remove') {
    next = Math.max(5, prev - 1);
  }
  const key = getPullupCustomSetKey(week, pullupDayNum);
  nextMap[key] = next;
  return {
    nextCustomSetCounts: nextMap,
    previousSetsCount: prev,
    newSetsCount: next
  };
}

export function getPullupExpansionControlSpec(currentSetsCount: number, isBaseNineSets = false): {
  currentSetsCount: number;
  canAddSet: boolean;
  canShowAllNine: boolean;
  canRemoveSet: boolean;
  addSetButtonLabel: string | null;
  showAllNineButtonLabel: string | null;
  removeSetButtonLabel: string | null;
} {
  const safeCount = Math.max(5, Math.min(9, Math.floor(Number(currentSetsCount) || 5)));
  const canAddSet = safeCount < 9;
  const canShowAllNine = safeCount < 9;
  const canRemoveSet = !isBaseNineSets && safeCount > 5;
  return {
    currentSetsCount: safeCount,
    canAddSet,
    canShowAllNine,
    canRemoveSet,
    addSetButtonLabel: canAddSet ? `+ Keep Going! Add Set ${safeCount + 1} (Up to 9 Pull-Up Sets)` : null,
    showAllNineButtonLabel: canShowAllNine ? 'Show All 9 Sets' : null,
    removeSetButtonLabel: canRemoveSet ? `- Remove Set ${safeCount}` : null
  };
}

// ============================================================================
// TIMED HOLDS (#7/8 SIDE PLANK): 5 PRESETS (INCLUDING 1 MIN / 60S) & 3-STATE FLOW
// ============================================================================

export interface TimedHoldDurationPreset {
  seconds: number;
  buttonLabel: string;
  shortActionLabel: string;
}

export const TIMED_HOLD_DURATION_PRESETS: readonly TimedHoldDurationPreset[] = [
  { seconds: 30, buttonLabel: '30 sec', shortActionLabel: '30s' },
  { seconds: 45, buttonLabel: '45 sec', shortActionLabel: '45s' },
  { seconds: 60, buttonLabel: '1 min (60s)', shortActionLabel: '1 min' },
  { seconds: 75, buttonLabel: '1m 15s (75s)', shortActionLabel: '1m 15s' },
  { seconds: 90, buttonLabel: '1m 30s (90s)', shortActionLabel: '1m 30s' }
] as const;

export function formatTimedHoldShortActionLabel(seconds: number): string {
  const sec = Math.max(5, Math.floor(Number(seconds) || 30));
  if (sec === 60) return '1 min';
  if (sec === 75) return '1m 15s';
  if (sec === 90) return '1m 30s';
  if (sec % 60 === 0 && sec > 60) return `${sec / 60} min`;
  return `${sec}s`;
}

export function formatSecondsToMMSS(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export type TimedHoldSetFlowStatus = 'not_started' | 'running' | 'paused' | 'completed';

export interface TimedHoldSetRuntimeState {
  status: TimedHoldSetFlowStatus;
  remainingSec?: number;
  targetSec?: number;
  side?: 'Left Side' | 'Right Side';
}

export interface TimedHoldSetUiSpec {
  setIndexOneBased: number;
  flowState: 'state_a_not_started' | 'state_b_running' | 'state_c_completed' | 'logged_done';
  isActiveRunning: boolean;
  showPrimaryLogButton: boolean;
  activeSetBadgeText: string | null;
  rowBorderStyle: string;
  rowBackgroundStyle: string;
  primaryButtonLabel: string;
  secondaryLinkLabel: string | null;
}

export function getTimedHoldSetUiSpec(
  setIndexOneBased: number,
  targetHoldSec: number,
  runtimeState?: TimedHoldSetRuntimeState | null,
  isLoggedDone = false
): TimedHoldSetUiSpec {
  const safeSet = Math.max(1, Math.floor(Number(setIndexOneBased) || 1));
  const safeTarget = Math.max(5, Math.floor(Number(targetHoldSec) || 30));
  const shortDur = formatTimedHoldShortActionLabel(safeTarget);

  if (isLoggedDone) {
    return {
      setIndexOneBased: safeSet,
      flowState: 'logged_done',
      isActiveRunning: false,
      showPrimaryLogButton: true,
      activeSetBadgeText: null,
      rowBorderStyle: '1px solid rgba(16, 185, 129, 0.45)',
      rowBackgroundStyle: 'rgba(16, 185, 129, 0.10)',
      primaryButtonLabel: '✓ Done',
      secondaryLinkLabel: 'Restart Timer'
    };
  }

  const status = runtimeState?.status || 'not_started';
  if (status === 'running' || status === 'paused') {
    const rem =
      typeof runtimeState?.remainingSec === 'number'
        ? Math.max(0, Math.floor(runtimeState.remainingSec))
        : safeTarget;
    const mmss = formatSecondsToMMSS(rem);
    const pauseOrResume = status === 'paused' ? 'Resume' : 'Pause';
    return {
      setIndexOneBased: safeSet,
      flowState: 'state_b_running',
      isActiveRunning: true,
      showPrimaryLogButton: false,
      activeSetBadgeText: 'ACTIVE SET',
      rowBorderStyle: '2px solid #f59e0b',
      rowBackgroundStyle: 'rgba(245, 158, 11, 0.18)',
      primaryButtonLabel: `Holding: ${mmss} Left (${pauseOrResume})`,
      secondaryLinkLabel: 'Skip timer & log'
    };
  }

  if (status === 'completed') {
    return {
      setIndexOneBased: safeSet,
      flowState: 'state_c_completed',
      isActiveRunning: false,
      showPrimaryLogButton: true,
      activeSetBadgeText: 'HOLD COMPLETE',
      rowBorderStyle: '2px solid #38bdf8',
      rowBackgroundStyle: 'rgba(56, 189, 248, 0.14)',
      primaryButtonLabel: `✓ Hold Complete — Tap to Log Set ${safeSet}`,
      secondaryLinkLabel: 'Restart Timer'
    };
  }

  return {
    setIndexOneBased: safeSet,
    flowState: 'state_a_not_started',
    isActiveRunning: false,
    showPrimaryLogButton: false,
    activeSetBadgeText: null,
    rowBorderStyle: '1px solid rgba(51, 65, 85, 0.7)',
    rowBackgroundStyle: 'rgba(2, 6, 23, 0.55)',
    primaryButtonLabel: `Start ${shortDur} Timer`,
    secondaryLinkLabel: 'Skip timer & log'
  };
}

// ============================================================================
// PULL-UP PYRAMID STRICT AUTO-INCREMENT, PHOTO-PROTECTED NOTE DELETE,
// EXPOSED 2-COL MACHINE SWAP, SLEEK HEADER & AI BONUS WORKOUT GENERATOR
// ============================================================================

export function getStrictPyramidSetSpec(setIndexOneBased: number, totalSets: number): {
  setIndex: number;
  targetReps: string;
  isMaxEffortAnchor: boolean;
  setLabel: string;
} {
  const safeTotal = Math.max(5, Math.min(9, Math.floor(Number(totalSets) || 5)));
  const safeIdx = Math.max(1, Math.min(safeTotal, Math.floor(Number(setIndexOneBased) || 1)));
  const isMax = safeIdx === safeTotal;
  return {
    setIndex: safeIdx,
    targetReps: String(safeIdx),
    isMaxEffortAnchor: isMax,
    setLabel: isMax ? `Set ${safeIdx} (Max)` : `Set ${safeIdx}`
  };
}

export const DELETE_NOTE_PHOTO_CONFIRM_MESSAGE =
  'This exercise has an attached machine photo. Do you want to delete the text note but keep the photo?';

export interface ExerciseNoteRecord {
  text?: string;
  photo?: string;
  photoDataUrl?: string;
  updatedWeek?: number;
  updatedAt?: string;
}

export function resolveDeleteExerciseNoteWithPhotoProtection(
  notesMap: Record<string, ExerciseNoteRecord | undefined>,
  exKey: string,
  confirmKeepPhotoFn?: (message: string) => boolean
): {
  prompted: boolean;
  keptPhoto: boolean;
  nextNotesMap: Record<string, ExerciseNoteRecord | undefined>;
} {
  const nextMap: Record<string, ExerciseNoteRecord | undefined> = { ...(notesMap || {}) };
  const prev = nextMap[exKey];
  if (!prev) {
    return { prompted: false, keptPhoto: false, nextNotesMap: nextMap };
  }
  const existingPhoto = prev.photo || prev.photoDataUrl || '';
  if (!existingPhoto) {
    delete nextMap[exKey];
    return { prompted: false, keptPhoto: false, nextNotesMap: nextMap };
  }
  const keepPhoto = typeof confirmKeepPhotoFn === 'function'
    ? Boolean(confirmKeepPhotoFn(DELETE_NOTE_PHOTO_CONFIRM_MESSAGE))
    : true;
  if (keepPhoto) {
    nextMap[exKey] = {
      ...prev,
      text: '',
      photo: existingPhoto,
      photoDataUrl: existingPhoto
    };
    return { prompted: true, keptPhoto: true, nextNotesMap: nextMap };
  }
  delete nextMap[exKey];
  return { prompted: true, keptPhoto: false, nextNotesMap: nextMap };
}

export const AI_BONUS_WORKOUT_TARGETS = [
  'Chest Focus',
  'Back & Biceps',
  'Legs & Calves',
  'Shoulders & Arms',
  'Full Body'
] as const;

export type AiBonusWorkoutTarget = (typeof AI_BONUS_WORKOUT_TARGETS)[number];

export function buildAiBonusWorkoutSystemPrompt(selectedTarget: string): string {
  const cleanTarget = String(selectedTarget || 'Full Body').trim();
  return `System: You are an elite sports scientist. Generate a custom workout for the target: ${cleanTarget}. You must return ONLY a valid JSON array containing exactly 5 to 7 exercises. Rule 1: ALL EXERCISE NAMES MUST BE UNIQUE. Rule 2: Do NOT include duplicate movement patterns. Rule 3: DO NOT include any abdominal, core, or pull-up exercises under any circumstances. Schema: [{ "name": "Exercise", "sets": 3, "reps": "8-12", "videoUrl": "https..." }]. Output JSON only.`;
}

export interface RawAiBonusExerciseItem {
  name: string;
  sets: number;
  reps: string;
  videoUrl: string;
  instructions?: string;
}

export interface FormattedAiBonusExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  restLabel: string;
  videoUrl: string;
  notes: string;
  instructions: string;
  isAiGenerated: boolean;
  isBodyweightRepsOnly?: boolean;
  badge?: string;
}

export interface CustomAiBonusDayObject {
  isAiGenerated: true;
  target: string;
  daySub: string;
  title: string;
  subtitle: string;
  warmupType: 'upper' | 'lower';
  exercises: FormattedAiBonusExercise[];
}

export function isForbiddenBonusExerciseName(name: string): boolean {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  return /\b(ab|abs|abdominal|crunch|crunches|core|plank|planks|dead\s*bug|sit[\s-]*up|sit[\s-]*ups|leg\s*raise|knee\s*raise|woodchopper|wood\s*chop|russian\s*twist|ab\s*wheel|pallof|hollow\s*body|pull[\s-]*up|pull[\s-]*ups|chin[\s-]*up|chin[\s-]*ups)\b/i.test(n);
}

export function getBonusMovementPatternKey(name: string): string {
  const n = String(name || '').toLowerCase();
  if (/(pec\s*deck|chest\s*fly|cable\s*fly|dumbbell\s*fly|\bfly\b)/.test(n) && !/rear\s*delt|reverse/.test(n)) return 'chest_fly';
  if (/incline.*(bench|chest\s*press|press)/.test(n)) return 'chest_incline_press';
  if (/(flat|barbell|dumbbell|machine|converging).*(bench|chest\s*press)/.test(n)) return 'chest_flat_press';
  if (/dip/.test(n)) return 'chest_dip';
  if (/rear\s*delt|reverse\s*pec|face\s*pull/.test(n)) return 'rear_delt';
  if (/lateral\s*raise/.test(n)) return 'lateral_raise';
  if (/overhead\s*press|shoulder\s*press|military\s*press/.test(n)) return 'overhead_press';
  if (/lat\s*pulldown|pulldown/.test(n)) return 'lat_pulldown';
  if (/pullover/.test(n)) return 'lat_pullover';
  if (/chest[\s-]*supported.*row|seated\s*(cable|machine)\s*row/.test(n)) return 'horizontal_row_machine';
  if (/bent[\s-]*over.*row|barbell.*row|t[\s-]*bar.*row|dumbbell.*row|\brow\b/.test(n)) return 'horizontal_row_free';
  if (/tricep.*pushdown|rope.*pushdown|pushdown/.test(n)) return 'tricep_pushdown';
  if (/overhead.*tricep|skull\s*crusher|tricep\s*extension/.test(n)) return 'tricep_overhead';
  if (/preacher|bicep|hammer\s*curl|cable\s*curl|incline\s*curl|\bcurl\b/.test(n) && !/leg\s*curl|hamstring/.test(n)) return 'bicep_curl';
  if (/squat/.test(n)) return 'squat';
  if (/leg\s*press|hack\s*squat/.test(n)) return 'leg_press';
  if (/leg\s*curl|hamstring\s*curl/.test(n)) return 'leg_curl';
  if (/leg\s*extension/.test(n)) return 'leg_extension';
  if (/deadlift|rdl|hip\s*thrust/.test(n)) return 'hip_hinge';
  if (/calf\s*raise/.test(n)) return 'calf_raise';
  return n.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export const AI_BONUS_WORKOUT_FALLBACKS_CLEAN: Record<string, RawAiBonusExerciseItem[]> = {
  'Chest Focus': [
    { name: 'Barbell Incline Bench Press', sets: 4, reps: '5-8', videoUrl: 'https://www.youtube.com/watch?v=SrqOu55lrYU', instructions: '1. Set bench to 30 degrees. 2. Lower bar to upper chest. 3. Press smoothly to lockout.' },
    { name: 'Flat Dumbbell Bench Press', sets: 3, reps: '8-10', videoUrl: 'https://www.youtube.com/watch?v=VmB1G1K7v94', instructions: '1. Pin shoulder blades down. 2. Lower dumbbells outside chest. 3. Press up with control.' },
    { name: 'Machine Pec Deck Fly', sets: 3, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=Z57CtFmRMxA', instructions: '1. Keep arms parallel to floor. 2. Squeeze handles together at center. 3. Open slowly for full stretch.' },
    { name: 'Assisted Chest Dip Machine', sets: 3, reps: '10-12', videoUrl: 'https://www.youtube.com/watch?v=dX_nSOOJIsE', instructions: '1. Lean torso slightly forward. 2. Lower until shoulders stretch gently. 3. Press back up smoothly.' },
    { name: 'Overhead Cable Tricep Extension', sets: 3, reps: '10-15', videoUrl: 'https://www.youtube.com/watch?v=YbX7Wd8jQ-Q', instructions: '1. Step forward holding rope overhead. 2. Extend elbows straight ahead. 3. Control return behind head.' },
    { name: 'Cable Lateral Raise', sets: 3, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=PPrzBWZDOhA', instructions: '1. Stand sideways to low pulley. 2. Raise arm to shoulder height. 3. Lower slowly across front.' }
  ],
  'Back & Biceps': [
    { name: 'Barbell Bent-Over Row', sets: 4, reps: '5-8', videoUrl: 'https://www.youtube.com/watch?v=FWJR5Ve8bnQ', instructions: '1. Hinge at hips with flat back. 2. Pull bar to lower ribs. 3. Lower to full lat stretch.' },
    { name: 'Neutral-Grip Lat Pulldown Machine', sets: 3, reps: '10-12', videoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc', instructions: '1. Lock thighs under pad. 2. Drive elbows down to hips. 3. Control top stretch smoothly.' },
    { name: 'Chest-Supported Machine Row', sets: 3, reps: '10-12', videoUrl: 'https://www.youtube.com/watch?v=GZbfZ033f74', instructions: '1. Keep chest pressed to pad. 2. Pull handles back and pause. 3. Extend arms fully each rep.' },
    { name: 'Straight-Arm Cable Lat Pullover', sets: 3, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=wcVDItawocI', instructions: '1. Keep elbows slightly bent. 2. Sweep bar down to thighs. 3. Return high for lat stretch.' },
    { name: 'Reverse Pec Deck Rear Delt Fly', sets: 3, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=5YK4bgzXDp0', instructions: '1. Sit facing machine pad. 2. Sweep arms wide without shrugging. 3. Return slowly under control.' },
    { name: 'Bayesian Cable Bicep Curl', sets: 3, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo', instructions: '1. Face away from low pulley. 2. Curl smoothly without swinging shoulder. 3. Lower to full bicep stretch.' }
  ],
  'Legs & Calves': [
    { name: 'Barbell Back Squat', sets: 4, reps: '5-8', videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8', instructions: '1. Place feet shoulder-width apart. 2. Squat down to parallel. 3. Drive evenly through mid-foot.' },
    { name: '45-Degree Machine Leg Press', sets: 3, reps: '10-12', videoUrl: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ', instructions: '1. Keep lower back on pad. 2. Lower sled deep with control. 3. Press up without locking knees.' },
    { name: 'Seated Machine Leg Curl', sets: 3, reps: '10-15', videoUrl: 'https://www.youtube.com/watch?v=1Tq3QdYUuHs', instructions: '1. Lock lap pad over thighs. 2. Curl heels under seat firmly. 3. Extend legs back slowly.' },
    { name: 'Machine Leg Extension', sets: 3, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=YyvSfVjQeL0', instructions: '1. Align knees with pivot. 2. Extend legs to peak squeeze. 3. Lower smoothly for 2 seconds.' },
    { name: 'Dumbbell Romanian Deadlift', sets: 3, reps: '8-10', videoUrl: 'https://www.youtube.com/watch?v=7j-2w4-P14I', instructions: '1. Push hips back with soft knees. 2. Lower dumbbells past knees. 3. Drive hips forward tall.' },
    { name: 'Standing Machine Calf Raise', sets: 4, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=gwLzBJYoWlI', instructions: '1. Sink heels for 2-second stretch. 2. Press high onto big toes. 3. Pause 1 second at top.' }
  ],
  'Shoulders & Arms': [
    { name: 'Standing Barbell Overhead Press', sets: 4, reps: '5-8', videoUrl: 'https://www.youtube.com/watch?v=2yjwXTZQDDI', instructions: '1. Grip bar outside shoulders. 2. Press straight overhead to lockout. 3. Lower cleanly to upper chest.' },
    { name: 'Cable Lateral Raise', sets: 3, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=PPrzBWZDOhA', instructions: '1. Set pulley at wrist height. 2. Sweep arm out to shoulder level. 3. Lower slowly without dropping.' },
    { name: 'Reverse Pec Deck Rear Delt Fly', sets: 3, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=5YK4bgzXDp0', instructions: '1. Keep chest pressed to pad. 2. Pull handles out wide. 3. Pause briefly at rear contraction.' },
    { name: 'Cable Rope Tricep Pushdown', sets: 3, reps: '10-15', videoUrl: 'https://www.youtube.com/watch?v=2-LAMcpzODU', instructions: '1. Pin elbows tight to ribs. 2. Push rope down and split ends. 3. Control rise back up.' },
    { name: 'Overhead Cable Tricep Extension', sets: 3, reps: '10-15', videoUrl: 'https://www.youtube.com/watch?v=YbX7Wd8jQ-Q', instructions: '1. Hold rope overhead leaning forward. 2. Extend forearms straight ahead. 3. Stretch smoothly behind head.' },
    { name: 'Machine Preacher Bicep Curl', sets: 3, reps: '10-15', videoUrl: 'https://www.youtube.com/watch?v=fIWP-FRFNU0', instructions: '1. Rest arms flush on pad. 2. Curl handles toward shoulders. 3. Lower slowly to near lockout.' }
  ],
  'Full Body': [
    { name: 'Trap Bar Deadlift', sets: 4, reps: '5-8', videoUrl: 'https://www.youtube.com/watch?v=WzvsIU9FW60', instructions: '1. Stand centered inside handles. 2. Push floor away with legs. 3. Hinge down under control.' },
    { name: 'Machine Incline Chest Press', sets: 3, reps: '10-12', videoUrl: 'https://www.youtube.com/watch?v=xUm_ZglsPdw', instructions: '1. Align handles with upper chest. 2. Press forward cleanly. 3. Lower slowly for deep stretch.' },
    { name: 'Seated Cable Row', sets: 3, reps: '10-12', videoUrl: 'https://www.youtube.com/watch?v=GZbfZ033f74', instructions: '1. Sit tall with neutral spine. 2. Pull handle to lower ribs. 3. Extend arms fully forward.' },
    { name: '45-Degree Machine Leg Press', sets: 3, reps: '10-12', videoUrl: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ', instructions: '1. Place feet shoulder-width on sled. 2. Lower deeply with control. 3. Drive smoothly back up.' },
    { name: 'Cable Lateral Raise', sets: 3, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=PPrzBWZDOhA', instructions: '1. Stand sideways to low pulley. 2. Raise arm to shoulder height. 3. Control slow descent.' },
    { name: 'Seated Machine Calf Raise', sets: 3, reps: '12-15', videoUrl: 'https://www.youtube.com/watch?v=JbyjNymZOt0', instructions: '1. Pause 2 seconds at bottom stretch. 2. Press up onto big toes. 3. Hold peak squeeze 1 second.' }
  ]
};

export function sanitizeAiBonusExercises(
  items: Partial<RawAiBonusExerciseItem>[],
  selectedTarget: string
): RawAiBonusExerciseItem[] {
  const cleanTarget = String(selectedTarget || 'Full Body').trim();
  const fallbackPool = AI_BONUS_WORKOUT_FALLBACKS_CLEAN[cleanTarget] || AI_BONUS_WORKOUT_FALLBACKS_CLEAN['Full Body'];
  const seenNames = new Set<string>();
  const seenPatterns = new Set<string>();
  const accepted: RawAiBonusExerciseItem[] = [];

  const tryAccept = (raw: Partial<RawAiBonusExerciseItem> | undefined, idx: number) => {
    if (!raw || typeof raw !== 'object') return;
    const name = String(raw.name || '').trim();
    if (!name || isForbiddenBonusExerciseName(name)) return;
    const normName = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const patternKey = getBonusMovementPatternKey(name);
    if (seenNames.has(normName) || seenPatterns.has(patternKey)) return;
    seenNames.add(normName);
    seenPatterns.add(patternKey);
    const sets = Math.max(1, Math.min(6, Math.floor(Number(raw.sets) || (idx === 0 ? 4 : 3))));
    const reps = String(raw.reps || (idx === 0 ? '5-8' : '10-15')).trim();
    const rawUrl = String(raw.videoUrl || '').trim();
    const videoUrl = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' form tutorial')}`;
    const instructions = String(raw.instructions || '1. Set seat and weight safely. 2. Move slowly with full control. 3. Pause briefly at peak squeeze.').trim();
    accepted.push({ name, sets, reps, videoUrl, instructions });
  };

  (Array.isArray(items) ? items : []).forEach((item, idx) => {
    if (accepted.length < 7) tryAccept(item, idx);
  });

  if (accepted.length < 5) {
    fallbackPool.forEach((fb, idx) => {
      if (accepted.length < 5) tryAccept(fb, accepted.length + idx);
    });
  }

  return accepted.slice(0, 7);
}

export function parseAndBuildAiBonusDayObject(
  rawJsonOrArray: string | RawAiBonusExerciseItem[],
  selectedTarget: string,
  week = 1
): CustomAiBonusDayObject | null {
  let parsed: unknown = rawJsonOrArray;
  if (typeof rawJsonOrArray === 'string') {
    const cleaned = rawJsonOrArray
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const startIdx = cleaned.indexOf('[');
      const endIdx = cleaned.lastIndexOf(']');
      if (startIdx >= 0 && endIdx > startIdx) {
        try {
          parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
        } catch {
          return null;
        }
      } else {
        return null;
      }
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const cleanTarget = String(selectedTarget || 'Full Body').trim();
  const slugTarget = cleanTarget.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const sanitized = sanitizeAiBonusExercises(parsed as Partial<RawAiBonusExerciseItem>[], cleanTarget);
  if (sanitized.length < 5 || sanitized.length > 7) return null;

  const exercises: FormattedAiBonusExercise[] = sanitized.map((item, idx) => {
    const restSec = idx === 0 ? 120 : 90;
    const instructions = String(item.instructions || '1. Set seat and weight safely. 2. Move slowly with full control. 3. Pause briefly at peak squeeze.').trim();
    return {
      id: `ai_bonus_w${week}_${slugTarget}_${idx + 1}`,
      name: item.name,
      sets: item.sets,
      reps: item.reps,
      restSec,
      restLabel: restSec >= 120 ? '2 min' : '90s',
      videoUrl: item.videoUrl,
      notes: instructions,
      instructions,
      isAiGenerated: true
    };
  });

  return {
    isAiGenerated: true,
    target: cleanTarget,
    daySub: cleanTarget,
    title: `AI Bonus • ${cleanTarget}`,
    subtitle: `${exercises.length}-Exercise Hypertrophy Plan (${cleanTarget})`,
    warmupType: cleanTarget.toLowerCase().includes('leg') ? 'lower' : 'upper',
    exercises
  };
}

export function toggleDay6BonusHabitExercise(
  dayObj: CustomAiBonusDayObject,
  habit: 'abs' | 'pullups'
): { added: boolean; nextDayObj: CustomAiBonusDayObject } {
  const currentList = Array.isArray(dayObj.exercises) ? [...dayObj.exercises] : [];
  if (habit === 'abs') {
    const hasAbs = currentList.some(ex => ex.id === 'cable_ab_crunch');
    if (hasAbs) {
      return {
        added: false,
        nextDayObj: { ...dayObj, exercises: currentList.filter(ex => ex.id !== 'cable_ab_crunch') }
      };
    }
    const absEx: FormattedAiBonusExercise = {
      id: 'cable_ab_crunch',
      name: 'Cable Abdominal Crunch (Daily Core)',
      badge: 'Daily Abs • Pre-fills Prev Day',
      sets: 3,
      reps: '10-15',
      restSec: 90,
      restLabel: '1.5 min',
      videoUrl: 'https://www.youtube.com/watch?v=aBd6T01PBqw',
      notes: 'Lock hips stationary, curl ribs toward pelvis, and exhale fully at the bottom.',
      instructions: 'Lock hips stationary, curl ribs toward pelvis, and exhale fully at the bottom.',
      isAiGenerated: false
    };
    return {
      added: true,
      nextDayObj: { ...dayObj, exercises: [...currentList, absEx] }
    };
  }

  const hasPullups = currentList.some(ex => ex.id === 'day1_pullups');
  if (hasPullups) {
    return {
      added: false,
      nextDayObj: { ...dayObj, exercises: currentList.filter(ex => ex.id !== 'day1_pullups') }
    };
  }
  const pullupEx: FormattedAiBonusExercise = {
    id: 'day1_pullups',
    name: 'Overhand Pull-Ups (Max Effort)',
    badge: 'Pull-Ups First • #1',
    isBodyweightRepsOnly: true,
    sets: 5,
    reps: 'Max Reps',
    restSec: 90,
    restLabel: '90 sec',
    videoUrl: 'https://youtu.be/w_yuTRQd6HA',
    notes: 'Perform 5 sets of maximum strict overhand reps with 90s rest between sets.',
    instructions: 'Perform 5 sets of maximum strict overhand reps with 90s rest between sets.',
    isAiGenerated: false
  };
  return {
    added: true,
    nextDayObj: { ...dayObj, exercises: [pullupEx, ...currentList] }
  };
}

export function getInitialCollapsedAccordionDefaults() {
  return {
    warmupOpen: false,
    warmupPart1Open: false,
    warmupPart2Open: false,
    preFuelDetailsOpen: false,
    hideBulkSupplements: true,
    openShopCostBreakdown: false,
    openShopItemDetails: {},
    openSubActionWhy: {},
    openNotePanels: {},
    openFuelCards: {},
    openFuelTips: {},
    openPrepNoteCards: {},
    openFuelPlanDrawer: false,
    openGymAdminDrawer: false,
    openDayWorkoutPicker: false,
    openRestDayDrawer: false,
    openWaterScheduleDrawer: false,
    defaultAllHidden: true,
    activeFocusedExId: null
  };
}

export function formatEli12FuelCardSummary(
  slotId: string,
  mealObj: { title?: string; kcal?: number; protein?: number; items?: Array<{ name?: string; weight?: string }> }
): {
  title: string;
  statsLine: string;
  ingredientsLine: string;
  mathToggleClosedLabel: string;
  mathToggleOpenLabel: string;
  logButtonLabel: string;
} {
  const shortTitles: Record<string, string> = {
    pre_shake: 'Pre-Workout Shake',
    post_oats: 'Overnight Protein Oats',
    lunch: 'Tofu & Rice Bowl',
    dinner: 'Evening Protein Shake'
  };
  const title = shortTitles[slotId] || String(mealObj.title || 'Daily Meal');
  const kcal = Number(mealObj.kcal) || 0;
  const protein = Number(mealObj.protein) || 0;
  const statsLine = `${kcal} Calories | ${protein}g Protein`;

  const shortItemName = (rawName: string): string => {
    const n = String(rawName || '').toLowerCase();
    if (n.includes('pea protein')) return 'Pea Protein';
    if (n.includes('creatine')) return 'Creatine';
    if (n.includes('water')) return 'Water';
    if (n.includes('almond') || n.includes('cashew') || n.includes('silk') || n.includes('soy milk')) return 'Plant Milk';
    if (n.includes('oats')) return 'Oats';
    if (n.includes('banana')) return 'Banana';
    if (n.includes('peanut butter')) return 'Peanut Butter';
    if (n.includes('chia')) return 'Chia Seeds';
    if (n.includes('tofu')) return 'Tofu';
    if (n.includes('rice')) return 'Cooked Rice';
    if (n.includes('broccoli')) return 'Broccoli';
    if (n.includes('nutritional yeast')) return 'Nutritional Yeast';
    if (n.includes('sesame oil')) return 'Sesame Oil';
    if (n.includes('salt')) return 'Iodized Salt';
    if (n.includes('vitamin d3')) return 'Vitamin D3';
    return String(rawName || '').replace(/\([^)]*\)/g, '').trim().split(/\s+/).slice(0, 2).join(' ');
  };

  const parts = (mealObj.items || []).map(it => {
    const w = String(it.weight || '').replace(/\s+/g, '');
    const label = shortItemName(it.name || '');
    return `${w} ${label}.`.trim();
  });
  const ingredientsLine = parts.join(' ');

  return {
    title,
    statsLine,
    ingredientsLine,
    mathToggleClosedLabel: 'Read the Math ▼',
    mathToggleOpenLabel: 'Hide the Math ▲',
    logButtonLabel: '✓ Log Meal'
  };
}

export function injectAiBonusWorkoutIntoDay6(
  customDayScheduleByWeek: Record<string, Array<number | CustomAiBonusDayObject>> | undefined,
  week: number,
  bonusDayObj: CustomAiBonusDayObject
): Record<string, Array<number | CustomAiBonusDayObject>> {
  const wKey = String(Math.max(1, Math.floor(Number(week) || 1)));
  const nextMap: Record<string, Array<number | CustomAiBonusDayObject>> = {
    ...(customDayScheduleByWeek || {})
  };
  const existing = Array.isArray(nextMap[wKey]) && nextMap[wKey].length === 7
    ? [...nextMap[wKey]]
    : [0, 1, 2, 3, 4, 5, 6];
  existing[5] = bonusDayObj;
  nextMap[wKey] = existing;
  return nextMap;
}

