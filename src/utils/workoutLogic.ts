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

export interface RecipePrepStep {
  id: string;
  title: string;
  detail: string;
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
        title: 'Weigh Dry Base',
        detail: '180g Gluten-Free Protein Oats (45g x 4 jars) + 24g Whole Chia Seeds (6g x 4 jars)'
      },
      {
        id: 'oats_step_2',
        title: 'Add Mashed Banana & PB',
        detail: '120g Peeled Ripe Banana (30g/jar) + 32g Natural Peanut Butter (8g/jar)'
      },
      {
        id: 'oats_step_3',
        title: 'Pour Silk Protein Milk',
        detail: '720g (720 ml) Unsweetened Silk Protein Milk (180g/jar)'
      },
      {
        id: 'oats_step_4',
        title: 'Stir, Seal & Refrigerate',
        detail: 'Mix thoroughly and refrigerate overnight (ready for 8:15 AM post-workout jars)'
      }
    ]
  },
  {
    id: 'recipe_rice_batch',
    badge: '#Prep 2/2',
    yieldPill: '4-Day Batch • 4 Servings',
    title: '4-Day Jasmine Rice & Savoury Tofu Bowl Prep',
    subtitle: 'Prep time: 20 mins • Yields 4x 150g cooked rice portions (55g dry/day)',
    steps: [
      {
        id: 'rice_step_1',
        title: 'Rinse & Weigh Dry Rice',
        detail: '220g Dry White Jasmine Rice (rinse in cold water until clear)'
      },
      {
        id: 'rice_step_2',
        title: 'Measure Water (1 : 1.5 Ratio)',
        detail: 'Add 330g (330 ml) water to pot or rice cooker'
      },
      {
        id: 'rice_step_3',
        title: 'Simmer & Steam',
        detail: 'Bring to boil, cover on low heat for 12 mins, then rest covered off heat for 10 mins (yields ~600g cooked rice = 150g/day)'
      },
      {
        id: 'rice_step_4',
        title: 'Portion Daily Savoury Bowl',
        detail: 'Combine 150g Cooked Rice + 175g Extra-Firm Tofu + 75g Steamed Broccoli + 12g Nutritional Yeast + 5g Sesame Oil + 1.5g Iodized Salt'
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


