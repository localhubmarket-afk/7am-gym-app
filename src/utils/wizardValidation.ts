export type WizardDifficulty = 'easy' | 'medium' | 'hard';

export type WizardBaseDiet =
  | 'Omnivore (Cheapest)'
  | 'Vegan'
  | 'Vegetarian'
  | 'Keto';

export type WizardIntolerance =
  | 'Gluten-Free'
  | 'Nut-Free'
  | 'Soy-Free'
  | 'Dairy-Free'
  | 'Egg-Free'
  | 'Shellfish-Free';

export type ExerciseDisplayCategory = 'weightlifting' | 'bodyweight' | 'cardio';

export interface ProgramWizardConfig {
  daysPerWeek: number;
  primaryFocus: string;
  difficulty: WizardDifficulty;
  baseDiet: WizardBaseDiet;
  intolerances: WizardIntolerance[];
  diet?: string;
  updatedAt?: string;
}

export interface WizardValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedConfig: ProgramWizardConfig;
}

export interface DietRecipeLike {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  notes?: string;
  ingredients?: Array<string | { name?: string; label?: string }>;
  items?: Array<{ name?: string; label?: string }>;
  tags?: string[];
}

export interface RoutineExerciseLike {
  id?: string;
  name: string;
  sets: number;
  reps: string;
  rest?: number;
  restTimer?: string;
  videoUrl?: string;
  equipType?: string;
  equipLabel?: string;
  instructions?: string;
  isCardio?: boolean;
  isTimedHold?: boolean;
  isBodyweightRepsOnly?: boolean;
}

export interface RoutineDayLike {
  isRest?: boolean;
  isRestDay?: boolean;
  daySub?: string;
  title?: string;
  subtitle?: string;
  target?: string;
  warmupType?: 'upper' | 'lower';
  isWizardGenerated?: boolean;
  exercises?: RoutineExerciseLike[];
}

const VALID_FOCUS_VALUES = new Set([
  'balanced',
  'legs',
  'chest',
  'back',
  'arms',
  'upper',
  'lower',
  'push',
  'pull',
  'full_body',
  'strength',
  'hypertrophy',
  'core',
  'shoulders',
  'glutes'
]);

const VALID_INTOLERANCES: WizardIntolerance[] = [
  'Gluten-Free',
  'Nut-Free',
  'Soy-Free',
  'Dairy-Free',
  'Egg-Free',
  'Shellfish-Free'
];

// Plant-based phrases that contain words like "milk", "butter", or "cheese" but are 100% vegan
const PLANT_SAFE_PHRASES = [
  'soy milk',
  'oat milk',
  'almond milk',
  'coconut milk',
  'plant milk',
  'cashew milk',
  'hemp milk',
  'rice milk',
  'pea milk',
  'peanut butter',
  'almond butter',
  'sunflower seed butter',
  'sunbutter',
  'tahini butter',
  'coconut butter',
  'cocoa butter',
  'vegan butter',
  'plant butter',
  'vegan cheese',
  'dairy-free cheese',
  'nutritional yeast',
  'coconut yogurt',
  'soy yogurt',
  'almond yogurt',
  'plant yogurt',
  'vegan yogurt',
  'vegan protein',
  'pea protein',
  'soy protein',
  'hemp protein',
  'brown rice protein',
  'plant-based',
  'plant based',
  'eggplant',
  'butternut'
];

const MEAT_AND_SEAFOOD_KEYWORDS = [
  'chicken',
  'beef',
  'steak',
  'pork',
  'bacon',
  'ham',
  'turkey',
  'sausage',
  'salami',
  'pepperoni',
  'lamb',
  'veal',
  'duck',
  'venison',
  'bison',
  'meatball',
  'ground meat',
  'salmon',
  'tuna',
  'cod',
  'tilapia',
  'trout',
  'mackerel',
  'sardine',
  'anchovy',
  'halibut',
  'fish',
  'shrimp',
  'prawn',
  'crab',
  'lobster',
  'shellfish',
  'oyster',
  'clam',
  'mussel',
  'scallop',
  'squid',
  'calamari',
  'bone broth',
  'gelatin',
  'lard',
  'tallow'
];

const DAIRY_AND_EGG_ANIMAL_KEYWORDS = [
  'egg',
  'eggs',
  'egg white',
  'egg whites',
  'omelette',
  'omelet',
  'mayonnaise',
  'whey',
  'casein',
  'milk',
  'dairy',
  'cheese',
  'cheddar',
  'mozzarella',
  'parmesan',
  'feta',
  'ricotta',
  'cottage cheese',
  'cream cheese',
  'yogurt',
  'greek yogurt',
  'skyr',
  'kefir',
  'butter',
  'ghee',
  'heavy cream',
  'sour cream',
  'whipping cream',
  'half-and-half',
  'honey',
  'beeswax'
];

const KETO_FORBIDDEN_CARB_KEYWORDS = [
  'jasmine rice',
  'white rice',
  'brown rice',
  'basmati rice',
  'rice bowl',
  'oats',
  'oatmeal',
  'overnight oats',
  'pasta',
  'spaghetti',
  'noodles',
  'bread',
  'bagel',
  'toast',
  'tortilla',
  'pita',
  'banana',
  'potato',
  'sweet potato',
  'fries',
  'maple syrup',
  'honey',
  'cane sugar',
  'brown sugar',
  'white sugar',
  'quinoa',
  'couscous'
];

const INTOLERANCE_FORBIDDEN_KEYWORDS: Record<WizardIntolerance, string[]> = {
  'Gluten-Free': [
    'wheat',
    'whole wheat',
    'bread',
    'bagel',
    'pasta',
    'spaghetti',
    'flour',
    'barley',
    'rye',
    'seitan',
    'couscous',
    'cracker',
    'tortilla',
    'soy sauce'
  ],
  'Nut-Free': [
    'peanut',
    'peanuts',
    'peanut butter',
    'almond',
    'almonds',
    'almond milk',
    'almond butter',
    'walnut',
    'cashew',
    'pecan',
    'pistachio',
    'hazelnut',
    'macadamia',
    'brazil nut',
    'pine nut',
    'mixed nuts',
    'trail mix'
  ],
  'Soy-Free': [
    'soy',
    'soya',
    'soy milk',
    'soy protein',
    'soy sauce',
    'tofu',
    'tempeh',
    'edamame',
    'miso',
    'tamari',
    'tvp'
  ],
  'Dairy-Free': [
    'whey',
    'casein',
    'milk',
    'dairy',
    'cheese',
    'cheddar',
    'mozzarella',
    'parmesan',
    'cottage cheese',
    'yogurt',
    'greek yogurt',
    'butter',
    'ghee',
    'heavy cream',
    'sour cream',
    'kefir'
  ],
  'Egg-Free': ['egg', 'eggs', 'egg white', 'egg whites', 'omelette', 'omelet', 'mayonnaise'],
  'Shellfish-Free': ['shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'oyster', 'clam', 'mussel', 'scallop']
};

const EASY_BARBELL_TO_MACHINE_SWAPS: Array<{ pattern: RegExp; replacement: string; equipType: 'machine' | 'cable' }> = [
  { pattern: /\b(?:barbell\s+)?(?:back\s+|front\s+)?squat\b/i, replacement: 'Leg Press Machine', equipType: 'machine' },
  { pattern: /\b(?:barbell\s+)?(?:incline\s+)?bench\s+press\b/i, replacement: 'Seated Chest Press Machine', equipType: 'machine' },
  { pattern: /\b(?:barbell\s+|romanian\s+|sumo\s+)?deadlift\b/i, replacement: 'Seated Leg Curl Machine', equipType: 'machine' },
  { pattern: /\b(?:barbell\s+)?overhead\s+press\b|\bmilitary\s+press\b/i, replacement: 'Shoulder Press Machine', equipType: 'machine' },
  { pattern: /\b(?:barbell\s+)?(?:bent[- ]over\s+)?row\b/i, replacement: 'Seated Cable Row', equipType: 'cable' },
  { pattern: /\bbarbell\s+curl\b/i, replacement: 'Cable Bicep Curl', equipType: 'cable' },
  { pattern: /\bskull\s*crusher\b/i, replacement: 'Cable Tricep Pushdown', equipType: 'cable' }
];

const HARD_MACHINE_TO_BARBELL_UPGRADES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bleg\s+press\s+machine\b/i, replacement: 'Barbell Back Squat' },
  { pattern: /\bseated\s+chest\s+press\s+machine\b/i, replacement: 'Barbell Bench Press' },
  { pattern: /\bshoulder\s+press\s+machine\b/i, replacement: 'Barbell Overhead Press' }
];

export function normalizeBaseDietStrict(raw: unknown): WizardBaseDiet {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s.includes('vegan') || s.includes('plant')) return 'Vegan';
  if (s.includes('vegetarian')) return 'Vegetarian';
  if (s.includes('keto') || s.includes('low carb')) return 'Keto';
  if (s.includes('omnivore') || s.includes('any')) return 'Omnivore (Cheapest)';
  return 'Vegan';
}

export function normalizeIntolerancesStrict(raw: unknown): WizardIntolerance[] {
  if (!Array.isArray(raw)) return [];
  const out: WizardIntolerance[] = [];
  raw.forEach((item) => {
    const lower = String(item ?? '').trim().toLowerCase();
    const match = VALID_INTOLERANCES.find((v) => v.toLowerCase() === lower);
    if (match && !out.includes(match)) {
      out.push(match);
    }
  });
  return out;
}

export function validateProgramWizardConfig(rawConfig: unknown): WizardValidationResult {
  const errors: string[] = [];
  const cfg = rawConfig && typeof rawConfig === 'object' ? (rawConfig as Record<string, any>) : {};

  // 1. Validate daysPerWeek (1-7; standard wizard uses 3-6)
  const parsedDays = Number(cfg.daysPerWeek);
  let daysPerWeek = 5;
  if (!Number.isFinite(parsedDays) || !Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 7) {
    errors.push('daysPerWeek must be an integer between 1 and 7.');
    daysPerWeek = Number.isFinite(parsedDays) ? Math.max(1, Math.min(7, Math.round(parsedDays))) : 5;
  } else {
    daysPerWeek = parsedDays;
  }

  // 2. Validate primaryFocus
  const rawFocus = String(cfg.primaryFocus ?? cfg.focus ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  let primaryFocus = 'balanced';
  if (!rawFocus || !VALID_FOCUS_VALUES.has(rawFocus)) {
    errors.push(`primaryFocus "${String(cfg.primaryFocus ?? '')}" is invalid. Defaulted to balanced.`);
  } else {
    primaryFocus = rawFocus;
  }

  // 3. Validate difficulty
  const rawDiff = String(cfg.difficulty ?? '').trim().toLowerCase();
  let difficulty: WizardDifficulty = 'medium';
  if (rawDiff === 'easy' || rawDiff === 'medium' || rawDiff === 'hard') {
    difficulty = rawDiff;
  } else {
    errors.push(`difficulty "${String(cfg.difficulty ?? '')}" must be easy, medium, or hard.`);
  }

  // 4. Validate baseDiet
  const rawDietInput = cfg.baseDiet ?? cfg.diet;
  const rawDietStr = String(rawDietInput ?? '').trim();
  const rawDietLower = rawDietStr.toLowerCase();
  const isKnownDiet =
    rawDietLower.includes('vegan') ||
    rawDietLower.includes('plant') ||
    rawDietLower.includes('vegetarian') ||
    rawDietLower.includes('keto') ||
    rawDietLower.includes('low carb') ||
    rawDietLower.includes('omnivore') ||
    rawDietLower === 'any';
  const baseDiet = normalizeBaseDietStrict(rawDietInput);
  if (!rawDietStr || !isKnownDiet) {
    errors.push(`baseDiet "${rawDietStr}" is not a supported diet option. Defaulted to ${baseDiet}.`);
  }

  // 5. Validate intolerances
  const intolerances = normalizeIntolerancesStrict(cfg.intolerances);
  if (cfg.intolerances !== undefined && !Array.isArray(cfg.intolerances)) {
    errors.push('intolerances must be an array.');
  } else if (Array.isArray(cfg.intolerances)) {
    cfg.intolerances.forEach((rawItem) => {
      const lower = String(rawItem ?? '').trim().toLowerCase();
      if (lower && !VALID_INTOLERANCES.some((v) => v.toLowerCase() === lower)) {
        errors.push(`Unknown intolerance "${String(rawItem)}" was ignored.`);
      }
    });
  }

  const dietId =
    baseDiet === 'Vegan'
      ? 'vegan'
      : baseDiet === 'Vegetarian'
        ? 'vegetarian'
        : baseDiet === 'Keto'
          ? 'keto'
          : 'any';

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedConfig: {
      daysPerWeek,
      primaryFocus,
      difficulty,
      baseDiet,
      intolerances,
      diet: dietId,
      updatedAt: typeof cfg.updatedAt === 'string' ? cfg.updatedAt : new Date().toISOString()
    }
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRecipeSearchableText(recipe: DietRecipeLike): string {
  const parts: string[] = [];
  if (recipe.title) parts.push(recipe.title);
  if (recipe.name) parts.push(recipe.name);
  if (recipe.description) parts.push(recipe.description);
  if (recipe.notes) parts.push(recipe.notes);
  if (Array.isArray(recipe.tags)) parts.push(recipe.tags.join(' '));
  if (Array.isArray(recipe.ingredients)) {
    recipe.ingredients.forEach((ing) => {
      if (typeof ing === 'string') parts.push(ing);
      else if (ing && typeof ing === 'object') {
        if (ing.name) parts.push(ing.name);
        if (ing.label) parts.push(ing.label);
      }
    });
  }
  if (Array.isArray(recipe.items)) {
    recipe.items.forEach((it) => {
      if (it && typeof it === 'object') {
        if (it.name) parts.push(it.name);
        if (it.label) parts.push(it.label);
      }
    });
  }
  return parts.join(' | ').toLowerCase();
}

function stripPlantSafeTerms(text: string): string {
  let cleaned = text.toLowerCase();
  PLANT_SAFE_PHRASES.forEach((phrase) => {
    cleaned = cleaned.replace(new RegExp(escapeRegExp(phrase), 'gi'), ' ');
  });
  return cleaned;
}

function findMatchingKeyword(text: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i');
    if (regex.test(text)) return kw;
  }
  return null;
}

export function isRecipeAllowedForDiet(
  recipe: DietRecipeLike,
  baseDietInput: string,
  intolerancesInput: string[] = []
): { allowed: boolean; reason: string } {
  const baseDiet = normalizeBaseDietStrict(baseDietInput);
  const intolerances = normalizeIntolerancesStrict(intolerancesInput);
  const rawText = buildRecipeSearchableText(recipe);
  const plantMaskedText = stripPlantSafeTerms(rawText);

  if (baseDiet === 'Vegan') {
    const meatHit = findMatchingKeyword(plantMaskedText, MEAT_AND_SEAFOOD_KEYWORDS);
    if (meatHit) {
      return { allowed: false, reason: `Rejected for Vegan diet: contains animal product "${meatHit}".` };
    }
    const dairyEggHit = findMatchingKeyword(plantMaskedText, DAIRY_AND_EGG_ANIMAL_KEYWORDS);
    if (dairyEggHit) {
      return { allowed: false, reason: `Rejected for Vegan diet: contains animal product "${dairyEggHit}".` };
    }
  } else if (baseDiet === 'Vegetarian') {
    const meatHit = findMatchingKeyword(plantMaskedText, MEAT_AND_SEAFOOD_KEYWORDS);
    if (meatHit) {
      return { allowed: false, reason: `Rejected for Vegetarian diet: contains "${meatHit}".` };
    }
  } else if (baseDiet === 'Keto') {
    const ketoMasked = rawText.replace(/\b(?:cauliflower\s+rice|keto\s+bread|keto\s+tortilla|low[- ]carb\s+tortilla)\b/gi, ' ');
    const carbHit = findMatchingKeyword(ketoMasked, KETO_FORBIDDEN_CARB_KEYWORDS);
    if (carbHit) {
      return { allowed: false, reason: `Rejected for Keto diet: contains high-carb ingredient "${carbHit}".` };
    }
  }

  for (const intol of intolerances) {
    const forbidden = INTOLERANCE_FORBIDDEN_KEYWORDS[intol] || [];
    let checkText = intol === 'Dairy-Free' ? plantMaskedText : rawText;
    if (intol === 'Gluten-Free') {
      // Allow explicitly gluten-free oats / tamari / gluten-free bread
      checkText = checkText.replace(/\bgluten[- ]free\s+[a-z]+\b/gi, ' ');
    }
    const hit = findMatchingKeyword(checkText, forbidden);
    if (hit) {
      return { allowed: false, reason: `Rejected for ${intol}: contains "${hit}".` };
    }
  }

  return { allowed: true, reason: 'Compliant' };
}

export function filterRecipesByDietAndIntolerances<T extends DietRecipeLike>(
  recipes: T[],
  baseDietInput: string,
  intolerancesInput: string[] = []
): { accepted: T[]; rejected: Array<{ recipe: T; reason: string }> } {
  const accepted: T[] = [];
  const rejected: Array<{ recipe: T; reason: string }> = [];
  (recipes || []).forEach((recipe) => {
    const verdict = isRecipeAllowedForDiet(recipe, baseDietInput, intolerancesInput);
    if (verdict.allowed) {
      accepted.push(recipe);
    } else {
      rejected.push({ recipe, reason: verdict.reason });
    }
  });
  return { accepted, rejected };
}

export function classifyExerciseCategory(ex: RoutineExerciseLike | null | undefined): ExerciseDisplayCategory {
  if (!ex || typeof ex !== 'object') return 'weightlifting';
  const name = String(ex.name || '').toLowerCase();
  const id = String(ex.id || '').toLowerCase();
  const equip = String(ex.equipType || '').toLowerCase();

  // 1. Cardio movements
  if (
    ex.isCardio === true ||
    equip === 'cardio' ||
    id.includes('cardio') ||
    /\b(biking|bike|cycling|treadmill|running|run|jogging|rowing|rower|elliptical|stairmaster|stair\s+climber|jump\s+rope|hiit|sprint|swimming|swim|brisk\s+walk|incline\s+walk|assault\s+bike|air\s+bike)\b/i.test(
      name
    )
  ) {
    return 'cardio';
  }

  // 2. Bodyweight movements (strictly separated from weightlifting)
  if (
    ex.isBodyweightRepsOnly === true ||
    ex.isTimedHold === true ||
    equip === 'bodyweight' ||
    id.includes('pullup') ||
    id.includes('plank') ||
    id.includes('mobility') ||
    /\b(pull[- ]?ups?|chin[- ]?ups?|planks?|side\s+plank|push[- ]?ups?|bodyweight|dips?|hanging\s+leg\s+raise|hanging\s+knee\s+raise|dead\s+bug|bird\s+dog|glute\s+bridge|burpees?|mountain\s+climbers?|wall\s+sit|mobility|stretch|foam\s+roll)\b/i.test(
      name
    )
  ) {
    // Weighted cable crunches remain in weightlifting because they use a cable stack weight
    if (!/\b(cable|barbell|dumbbell|machine|kettlebell|weighted)\b/i.test(name)) {
      return 'bodyweight';
    }
  }

  return 'weightlifting';
}

export function isOverhandPullUpsExercise(ex: RoutineExerciseLike | null | undefined): boolean {
  if (!ex || typeof ex !== 'object') return false;
  const name = String(ex.name || '').toLowerCase();
  const id = String(ex.id || '').toLowerCase();
  return (
    id === 'day1_pullups' ||
    id === 'ex_pullups' ||
    id.includes('pullup') ||
    /\b(overhand\s+pull[- ]?ups?|pull[- ]?ups?|chin[- ]?ups?)\b/i.test(name)
  );
}

export function orderExercisesWithPullUpsFirst<T extends RoutineExerciseLike>(exercises: T[]): T[] {
  const pullUps: T[] = [];
  const rest: T[] = [];
  (exercises || []).forEach((ex) => {
    if (isOverhandPullUpsExercise(ex)) {
      pullUps.push(ex);
    } else {
      rest.push(ex);
    }
  });
  return [...pullUps, ...rest];
}

export function groupExercisesByCategory<T extends RoutineExerciseLike>(
  exercises: T[]
): {
  pullUpsLead: T[];
  weightlifting: T[];
  bodyweight: T[];
  otherBodyweight: T[];
  cardio: T[];
} {
  const ordered = orderExercisesWithPullUpsFirst(exercises || []);
  const groups: {
    pullUpsLead: T[];
    weightlifting: T[];
    bodyweight: T[];
    otherBodyweight: T[];
    cardio: T[];
  } = {
    pullUpsLead: [],
    weightlifting: [],
    bodyweight: [],
    otherBodyweight: [],
    cardio: []
  };
  ordered.forEach((ex) => {
    const cat = classifyExerciseCategory(ex);
    if (cat === 'bodyweight' && isOverhandPullUpsExercise(ex)) {
      groups.pullUpsLead.push(ex);
      groups.bodyweight.push(ex);
    } else if (cat === 'bodyweight') {
      groups.otherBodyweight.push(ex);
      groups.bodyweight.push(ex);
    } else {
      groups[cat].push(ex);
    }
  });
  return groups;
}

export interface DifficultyMultiplierSpec {
  difficulty: WizardDifficulty;
  volumeMultiplier: number;
  minSets: number;
  maxSets: number;
  complexityTier: 'beginner_machines' | 'standard_hybrid' | 'advanced_compounds';
  defaultRestSeconds: number;
}

export function getDifficultyMultipliers(difficultyInput: string): DifficultyMultiplierSpec {
  const normalized = String(difficultyInput || '').trim().toLowerCase();
  if (normalized === 'easy') {
    return {
      difficulty: 'easy',
      volumeMultiplier: 0.75,
      minSets: 2,
      maxSets: 3,
      complexityTier: 'beginner_machines',
      defaultRestSeconds: 90
    };
  }
  if (normalized === 'hard') {
    return {
      difficulty: 'hard',
      volumeMultiplier: 1.25,
      minSets: 4,
      maxSets: 5,
      complexityTier: 'advanced_compounds',
      defaultRestSeconds: 120
    };
  }
  return {
    difficulty: 'medium',
    volumeMultiplier: 1.0,
    minSets: 3,
    maxSets: 4,
    complexityTier: 'standard_hybrid',
    defaultRestSeconds: 90
  };
}

export function enforceDifficultyOnExercise<T extends RoutineExerciseLike>(
  ex: T,
  difficultyInput: string
): T {
  const mult = getDifficultyMultipliers(difficultyInput);
  const diff = mult.difficulty;

  const cloned: T = { ...ex };
  const category = classifyExerciseCategory(cloned);
  if (category === 'cardio') {
    return cloned;
  }

  const baseSets = Number(cloned.sets) || 3;
  const scaledSets = Math.round(baseSets * mult.volumeMultiplier);

  if (diff === 'easy') {
    // Strictly beginner-safe machine/cable/bodyweight movements + volume multiplier (0.75x, capped 2-3 sets)
    if (category === 'weightlifting') {
      for (const swap of EASY_BARBELL_TO_MACHINE_SWAPS) {
        if (swap.pattern.test(cloned.name)) {
          cloned.name = swap.replacement;
          cloned.equipType = swap.equipType;
          cloned.equipLabel = swap.equipType === 'cable' ? 'Cable' : 'Machine';
          break;
        }
      }
      if (String(cloned.equipType || '').toLowerCase() === 'barbell') {
        cloned.equipType = 'machine';
        cloned.equipLabel = 'Machine';
      }
    }
    cloned.sets = Math.max(mult.minSets, Math.min(mult.maxSets, scaledSets));
    if (!cloned.reps || /^\s*[1-5](?:\s*-\s*[3-6])?\s*$/.test(cloned.reps)) {
      cloned.reps = '10-12';
    }
    const restSec = Math.max(60, Math.min(120, Number(cloned.rest) || mult.defaultRestSeconds));
    cloned.rest = restSec;
    cloned.restTimer = `${restSec}s`;
  } else if (diff === 'hard') {
    // Heavy barbell compound upgrades + volume multiplier (1.25x, 4-5 sets)
    if (category === 'weightlifting') {
      for (const upg of HARD_MACHINE_TO_BARBELL_UPGRADES) {
        if (upg.pattern.test(cloned.name)) {
          cloned.name = upg.replacement;
          cloned.equipType = 'barbell';
          cloned.equipLabel = 'Barbell Compound';
          break;
        }
      }
    }
    cloned.sets = Math.max(mult.minSets, Math.min(mult.maxSets, scaledSets));
    if (!cloned.reps) {
      cloned.reps = '5-8';
    }
    const restSec = Math.max(90, Math.min(180, Number(cloned.rest) || mult.defaultRestSeconds));
    cloned.rest = restSec;
    cloned.restTimer = `${restSec}s`;
  } else {
    // Medium: 1.0x volume multiplier (3-4 sets) balanced free-weight & machine mix
    cloned.sets = Math.max(mult.minSets, Math.min(mult.maxSets, scaledSets));
    if (!cloned.reps) {
      cloned.reps = '8-12';
    }
    const restSec = Math.max(60, Math.min(150, Number(cloned.rest) || mult.defaultRestSeconds));
    cloned.rest = restSec;
    cloned.restTimer = `${restSec}s`;
  }

  return cloned;
}

export function enforceDifficultyOnRoutine<T extends RoutineDayLike | number>(
  weekSchedule: T[],
  difficultyInput: string
): T[] {
  return (weekSchedule || []).map((slot) => {
    if (typeof slot === 'number' || !slot || typeof slot !== 'object') {
      return slot;
    }
    if (slot.isRest || slot.isRestDay || !Array.isArray(slot.exercises)) {
      return { ...slot };
    }
    return {
      ...slot,
      exercises: slot.exercises.map((ex) => enforceDifficultyOnExercise(ex, difficultyInput))
    };
  });
}

export interface ValidatedWizardProgramOutput<
  TMeal extends DietRecipeLike,
  TDay extends RoutineDayLike | number
> {
  validation: WizardValidationResult;
  config: ProgramWizardConfig;
  difficultyMultipliers: DifficultyMultiplierSpec;
  mealPlan: TMeal[];
  blockedMeals: Array<{ recipe: TMeal; reason: string }>;
  workoutSchedule: TDay[];
}

/**
 * Task 5: Binds programWizardConfig strictly to both meal plan arrays and workout routines.
 * - If diet === 'vegan', blocks 100% of animal product meals (meat, seafood, dairy, eggs, whey, honey).
 * - Applies difficulty volume multiplier & movement complexity directly to every workout day.
 */
export function buildValidatedWizardProgram<
  TMeal extends DietRecipeLike,
  TDay extends RoutineDayLike | number
>(
  rawConfig: unknown,
  candidateMeals: TMeal[],
  baseSchedule: TDay[]
): ValidatedWizardProgramOutput<TMeal, TDay> {
  const validation = validateProgramWizardConfig(rawConfig);
  const config = validation.sanitizedConfig;
  const difficultyMultipliers = getDifficultyMultipliers(config.difficulty);

  // Explicit conditional binding for diet === 'vegan' (and all base diets + intolerances)
  const effectiveDiet = config.diet === 'vegan' ? 'Vegan' : config.baseDiet;
  const filteredMeals = filterRecipesByDietAndIntolerances(
    candidateMeals || [],
    effectiveDiet,
    config.intolerances
  );

  // Explicit conditional binding for difficulty multiplier on volume and complexity
  const workoutSchedule = enforceDifficultyOnRoutine(baseSchedule || [], config.difficulty);

  return {
    validation,
    config,
    difficultyMultipliers,
    mealPlan: filteredMeals.accepted,
    blockedMeals: filteredMeals.rejected,
    workoutSchedule
  };
}

export type BikingEnvironment = 'indoor' | 'outdoor';

export const STANDARD_CARDIO_SESSIONS = [
  'Biking',
  'Treadmill',
  'Rowing Machine',
  'Elliptical',
  'Stairmaster'
] as const;

const PROVIDER_ONLY_LABELS = new Set([
  'google',
  'apple',
  'google athlete',
  'apple athlete',
  'google user',
  'apple user',
  'google_oauth',
  'apple_oauth',
  'oauth',
  'user',
  'member',
  'athlete'
]);

export function resolveDisplayUsername(profile: {
  name?: string | null;
  email?: string | null;
  authProvider?: string | null;
} | null | undefined): string {
  if (!profile || typeof profile !== 'object') return 'Sign In';
  const rawName = String(profile.name || '').trim();
  const rawEmail = String(profile.email || '').trim().toLowerCase();

  if (rawName && !PROVIDER_ONLY_LABELS.has(rawName.toLowerCase())) {
    return rawName.split(/\s+/)[0];
  }

  if (rawEmail.includes('francois')) {
    return 'François';
  }

  if (rawEmail && rawEmail.includes('@')) {
    const localPart = rawEmail.split('@')[0] || '';
    const tokens = localPart
      .replace(/[._+-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((t) => t && !PROVIDER_ONLY_LABELS.has(t.toLowerCase()));
    if (tokens.length > 0) {
      const candidate = tokens[0];
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  return rawEmail ? 'Member' : 'Sign In';
}

export function isBikingExercise(ex: { name?: string; id?: string } | null | undefined): boolean {
  if (!ex || typeof ex !== 'object') return false;
  const text = `${String(ex.name || '')} ${String(ex.id || '')}`.toLowerCase();
  return /\b(biking|bike|cycling|spin)\b/i.test(text);
}

export function normalizeCardioExerciseName(rawName: string): string {
  const trimmed = String(rawName || '').trim();
  if (/^(outdoor|indoor)\s+biking$/i.test(trimmed)) {
    return 'Biking';
  }
  return trimmed || 'Biking';
}

export function clearActiveDayWorkoutData(
  stateObj: Record<string, any>,
  targetWeek: number,
  targetDayIdx: number,
  options?: {
    exerciseIds?: string[];
    pullupDayNumber?: number | null;
    logSlotKey?: string | null;
  }
): { clearedKeysCount: number; week: number; dayIdx: number } {
  const safeW = Math.max(1, Math.min(12, Math.floor(Number(targetWeek) || 1)));
  const safeD = Math.max(0, Math.min(6, Math.floor(Number(targetDayIdx) || 0)));
  const targetExIds = new Set<string>(Array.isArray(options?.exerciseIds) ? options!.exerciseIds : []);
  let clearedKeysCount = 0;

  if (stateObj && stateObj.workoutLogs && typeof stateObj.workoutLogs === 'object') {
    const dayPrefix = `w${safeW}_${safeD}_`;
    const bonusPrefix = options?.logSlotKey ? `w${safeW}_${options.logSlotKey}_` : '';
    Object.keys(stateObj.workoutLogs).forEach((k) => {
      if (k.startsWith(dayPrefix) || (bonusPrefix && k.startsWith(bonusPrefix))) {
        delete stateObj.workoutLogs[k];
        clearedKeysCount += 1;
        return;
      }
      const m = new RegExp(`^w${safeW}_(\\d+)_(.+)_(\\d+)$`).exec(k);
      if (m && targetExIds.has(m[2])) {
        const keyDayOrSlot = parseInt(m[1], 10);
        if (m[2] !== 'cable_ab_crunch' || keyDayOrSlot === safeD) {
          delete stateObj.workoutLogs[k];
          clearedKeysCount += 1;
        }
      }
    });
  }

  if (stateObj && stateObj.pullupLogs && typeof stateObj.pullupLogs === 'object' && options?.pullupDayNumber) {
    const pPrefix = `w${safeW}_day_${options.pullupDayNumber}_set_`;
    Object.keys(stateObj.pullupLogs).forEach((pk) => {
      if (pk.startsWith(pPrefix)) {
        delete stateObj.pullupLogs[pk];
        clearedKeysCount += 1;
      }
    });
  }

  if (stateObj && stateObj.cardioLogs && typeof stateObj.cardioLogs === 'object') {
    const cPrefix = `w${safeW}_d${safeD}_`;
    Object.keys(stateObj.cardioLogs).forEach((ck) => {
      if (ck.startsWith(cPrefix)) {
        delete stateObj.cardioLogs[ck];
        clearedKeysCount += 1;
      }
    });
  }

  if (stateObj && stateObj.warmupLogs && typeof stateObj.warmupLogs === 'object') {
    Object.keys(stateObj.warmupLogs).forEach((wk) => {
      if (wk.startsWith(`w${safeW}_${safeD}_`) || wk.startsWith(`w${safeW}_d${safeD}_`)) {
        delete stateObj.warmupLogs[wk];
        clearedKeysCount += 1;
      }
    });
  }

  return { clearedKeysCount, week: safeW, dayIdx: safeD };
}

