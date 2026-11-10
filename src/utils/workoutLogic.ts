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

export function generatePreRenderedChimeWavBytes(
  sampleRate = 44100,
  durationSec = 0.28
): Uint8Array {
  const padSamples = Math.max(1, Math.floor(sampleRate * 0.015)); // Silent lead-in & lead-out padding
  const toneSamples = Math.max(1, Math.floor(sampleRate * durationSec));
  const numSamples = padSamples * 2 + toneSamples;
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

  // Synthesize smooth two-tone chime (D5 587.33 Hz -> A5 880 Hz) surrounded by silent padding
  let phase = 0;
  const attackSamples = Math.max(1, Math.floor(sampleRate * 0.01));
  for (let i = 0; i < toneSamples; i++) {
    const t = i / sampleRate;
    const freq = t < 0.12 ? 587.33 : 880.0;
    phase += (2 * Math.PI * freq) / sampleRate;

    let env = 0;
    if (i === 0 || i === toneSamples - 1) {
      env = 0;
    } else if (i < attackSamples) {
      env = 0.5 * (1 - Math.cos((Math.PI * i) / attackSamples));
    } else {
      const progress = (i - attackSamples) / Math.max(1, toneSamples - 1 - attackSamples);
      env = Math.exp(-4.5 * progress) * (1 - progress);
    }

    const sampleFloat = Math.sin(phase) * env * 0.25;
    const pcm16 = Math.max(-32767, Math.min(32767, Math.round(sampleFloat * 32767)));
    view.setInt16(44 + (padSamples + i) * 2, pcm16, true);
  }

  return new Uint8Array(buffer);
}

export function createSilentPaddedChimeWavUrl(): string {
  const bytes = generatePreRenderedChimeWavBytes(44100, 0.28);
  if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }
  return 'data:audio/wav;base64,';
}

