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
      label: '📳 Vibrate Only'
    };
  }
  if (mode === 'silent') {
    return {
      shouldCreateAudioContext: false,
      shouldVibrate: false,
      closeDelayMs: 0,
      label: '🔕 Silent'
    };
  }
  return {
    shouldCreateAudioContext: true,
    shouldVibrate: true,
    closeDelayMs: 320,
    label: '🔔 Sound & Vibe'
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
  view.setUint16(20, 1, true);  // AudioFormat = 1 (PCM)
  view.setUint16(22, 1, true);  // NumChannels = 1 (Mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);  // BlockAlign
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
        `**🥛 Coach AI Live Plan Switch — Original Silk Protein Plan (1,400 kcal • 138g P):**\n` +
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
        `**🥛 Coach AI Live Plan Switch — Option B Almond/Cashew + 105g Pea Plan (1,300 kcal • 138g P):**\n` +
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
        `**🥛 Coach AI Live Plan Switch — Option A Unsweetened Soy Milk + 75g Pea Plan (1,400 kcal • 138g P):**\n` +
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
        `**🔄 Coach AI Iso-Protein Smart Ingredient Swaps (Fuel 3 Bowl):**\n` +
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
  const hrSuffix = hasLiveHr ? ` • ❤️ ${Math.round(Number(params.liveBpm))} BPM` : '';
  const finalTitle = String(params.title || '⏱️ Rest Complete! Start Next Set').trim();
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
  const hrSuffix = params.liveBpm && params.liveBpm > 0 ? ` • ❤️ ${Math.round(params.liveBpm)} BPM` : '';

  const title = params.timerRunning
    ? `⏱️ ${formattedTime} • ${params.contextLabel || 'Rest Timer'}${hrSuffix}`
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





