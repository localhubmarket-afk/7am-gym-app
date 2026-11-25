/**
 * Tap-to-Swap Ingredient Engine & Visual Grocery Recognition (WCAG 2.2 & COGA)
 *
 * Pure, decoupled TypeScript module powering:
 * 1. Categorized competitor-grade ingredient swapping (MacroFactor / MyFitnessPal style)
 * 2. Offline-safe high-contrast visual product thumbnails (`imageUrl`) for meals & grocery list
 * 3. Exact automatic recalculation of meal macros/cost AND full-day macros/cost
 * 4. Persistence to local gym_state, localStorage, and Supabase (when `isAutoSyncEnabled` is true)
 */

export type IngredientCategory =
  | 'plant_milk'
  | 'protein_powder'
  | 'tofu_protein'
  | 'oats_grains'
  | 'rice_carbs'
  | 'nut_butter'
  | 'produce'
  | 'seeds_boosters'
  | 'oil_seasoning'
  | 'supplement'
  | 'water_liquid';

export interface MealIngredientItem {
  id: string;
  name: string;
  label?: string;
  weight: string;
  grams: number;
  protein: number;
  kcal: number;
  costPerServing?: number;
  imageUrl?: string;
  category?: IngredientCategory;
  shopItemId?: string;
  brandTag?: string;
  swappedFromName?: string;
  swapOptionId?: string;
  isSwapped?: boolean;
}

export interface SwapIngredientOption {
  id: string;
  name: string;
  shortName: string;
  brandTag: string;
  shortNote: string;
  category: IngredientCategory;
  weight: string;
  grams: number;
  protein: number;
  kcal: number;
  costPerServing: number;
  weeklyGroceryCost?: number;
  shopItemId?: string;
  imageUrl: string;
}

export interface StoredIngredientSwap {
  slotId: string;
  itemId: string;
  swapOptionId: string;
  name: string;
  shortName: string;
  brandTag: string;
  weight: string;
  grams: number;
  protein: number;
  kcal: number;
  costPerServing: number;
  weeklyGroceryCost?: number;
  imageUrl: string;
  shopItemId?: string;
  swappedFromName: string;
  swappedFromKcal: number;
  swappedFromProtein: number;
  swappedFromGrams: number;
  swappedFromCost: number;
  updatedAt: string;
}

export interface MealSlotPlanShape {
  slotId: string;
  title?: string;
  kcal: number;
  protein: number;
  scaleGrams?: number;
  mealCost?: number;
  items: MealIngredientItem[];
  [key: string]: unknown;
}

export interface DayFuelPlanShape {
  id?: string;
  dailyKcal: number;
  dailyProtein: number;
  dailyCost?: number;
  weeklyCost?: number;
  meals: Record<string, MealSlotPlanShape>;
  [key: string]: unknown;
}

export interface SwapMacroDeltas {
  kcalDelta: number;
  proteinDelta: number;
  gramsDelta: number;
  costDelta: number;
}

export interface MealTotalsSummary {
  kcal: number;
  protein: number;
  grams: number;
  cost: number;
}

export interface GymStateWithIngredientSwaps {
  ingredientSwaps?: Record<string, StoredIngredientSwap>;
  shopBrandOverrides?: Record<string, { brandName: string; weeklyPrice: number; imageUrl?: string; updatedAt?: string }>;
  shopIngredientVisuals?: Record<string, { name: string; brandTag?: string; imageUrl: string; updatedAt?: string }>;
  lastUpdated?: string;
  [key: string]: unknown;
}

export interface ApplyIngredientSwapParams {
  gymState: GymStateWithIngredientSwaps;
  slotId: string;
  itemId: string;
  originalItem: MealIngredientItem;
  replacement: SwapIngredientOption;
  isAutoSyncEnabled?: boolean;
  storageKey?: string;
  storage?: Pick<Storage, 'setItem'> | null;
  pushToSupabase?: (nextState: GymStateWithIngredientSwaps, reason: string) => Promise<unknown> | void;
  nowIso?: string;
}

export interface ApplyIngredientSwapResult {
  nextState: GymStateWithIngredientSwaps;
  swapKey: string;
  swapRecord: StoredIngredientSwap;
  deltas: SwapMacroDeltas;
  savedToLocalStorage: boolean;
  pushedToSupabase: boolean;
}

export const SWAP_MODAL_TITLE = 'Swap Ingredient';

export const DEFAULT_MEAL_SLOT_BASE_COSTS: Record<string, number> = {
  pre_shake: 1.35,
  post_oats: 1.37,
  lunch: 2.01,
  dinner: 1.62
};

export interface ProductThumbnailSpec {
  topLabel: string;
  bottomLabel: string;
  bgHex: string;
  accentHex: string;
  textHex?: string;
  shape?: 'carton' | 'tub' | 'pack' | 'bag' | 'jar' | 'bottle' | 'produce';
}

function escapeSvgText(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates a crisp, offline-safe, high-contrast product package thumbnail
 * as an inline SVG data URI for cognitive grocery recognition (COGA / WCAG 2.2).
 */
export function buildProductThumbnailDataUri(spec: ProductThumbnailSpec): string {
  const top = escapeSvgText(spec.topLabel.slice(0, 10).toUpperCase());
  const bottom = escapeSvgText(spec.bottomLabel.slice(0, 11).toUpperCase());
  const bg = spec.bgHex || '#0f172a';
  const accent = spec.accentHex || '#10b981';
  const textHex = spec.textHex || '#ffffff';
  const shape = spec.shape || 'pack';

  let silhouette = '';
  if (shape === 'carton') {
    silhouette = `
      <polygon points="18,16 46,16 42,8 22,8" fill="${accent}" opacity="0.92"/>
      <rect x="16" y="16" width="32" height="40" rx="4" fill="#0f172a" stroke="${accent}" stroke-width="2.5"/>
      <rect x="20" y="21" width="24" height="12" rx="2" fill="${accent}"/>
    `;
  } else if (shape === 'tub') {
    silhouette = `
      <rect x="14" y="10" width="36" height="8" rx="3" fill="${accent}"/>
      <rect x="16" y="18" width="32" height="38" rx="5" fill="#0f172a" stroke="${accent}" stroke-width="2.5"/>
      <rect x="20" y="24" width="24" height="11" rx="2" fill="${accent}"/>
    `;
  } else if (shape === 'jar') {
    silhouette = `
      <rect x="19" y="9" width="26" height="7" rx="2.5" fill="${accent}"/>
      <rect x="15" y="16" width="34" height="40" rx="8" fill="#0f172a" stroke="${accent}" stroke-width="2.5"/>
      <rect x="19" y="23" width="26" height="12" rx="2.5" fill="${accent}"/>
    `;
  } else if (shape === 'bottle') {
    silhouette = `
      <rect x="26" y="7" width="12" height="8" rx="2" fill="${accent}"/>
      <path d="M22 15 L42 15 L45 23 L45 53 C45 55 43 57 40 57 L24 57 C21 57 19 55 19 53 L19 23 Z" fill="#0f172a" stroke="${accent}" stroke-width="2.5"/>
      <rect x="22" y="25" width="20" height="11" rx="2" fill="${accent}"/>
    `;
  } else if (shape === 'bag') {
    silhouette = `
      <path d="M16 11 L48 11 L50 54 C50 56 48 58 45 58 L19 58 C16 58 14 56 14 54 Z" fill="#0f172a" stroke="${accent}" stroke-width="2.5"/>
      <line x1="16" y1="17" x2="48" y2="17" stroke="${accent}" stroke-width="2"/>
      <rect x="19" y="23" width="26" height="12" rx="2.5" fill="${accent}"/>
    `;
  } else if (shape === 'produce') {
    silhouette = `
      <circle cx="32" cy="34" r="21" fill="#0f172a" stroke="${accent}" stroke-width="3"/>
      <circle cx="32" cy="34" r="14" fill="${accent}" opacity="0.22"/>
      <rect x="14" y="22" width="36" height="12" rx="3" fill="${accent}"/>
    `;
  } else {
    silhouette = `
      <rect x="12" y="12" width="40" height="42" rx="6" fill="#0f172a" stroke="${accent}" stroke-width="2.5"/>
      <rect x="16" y="19" width="32" height="13" rx="2.5" fill="${accent}"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="12" fill="${bg}"/>${silhouette}<text x="32" y="29" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="6.3" font-weight="900" fill="#0f172a">${top}</text><text x="32" y="47" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="5.8" font-weight="800" fill="${textHex}">${bottom}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRODUCT_THUMBNAILS = {
  silkProteinMilk: buildProductThumbnailDataUri({
    topLabel: 'SILK',
    bottomLabel: 'PROTEIN',
    bgHex: '#0c4a6e',
    accentHex: '#38bdf8',
    shape: 'carton'
  }),
  almondCashewMilk: buildProductThumbnailDataUri({
    topLabel: 'ALMOND',
    bottomLabel: 'MILK',
    bgHex: '#1e293b',
    accentHex: '#93c5fd',
    shape: 'carton'
  }),
  soyMilk: buildProductThumbnailDataUri({
    topLabel: 'SOY',
    bottomLabel: 'MILK',
    bgHex: '#14532d',
    accentHex: '#4ade80',
    shape: 'carton'
  }),
  oatMilk: buildProductThumbnailDataUri({
    topLabel: 'OAT',
    bottomLabel: 'MILK',
    bgHex: '#451a03',
    accentHex: '#fbbf24',
    shape: 'carton'
  }),
  coldWater: buildProductThumbnailDataUri({
    topLabel: 'COLD',
    bottomLabel: 'WATER',
    bgHex: '#082f49',
    accentHex: '#7dd3fc',
    shape: 'bottle'
  }),
  nakedPea: buildProductThumbnailDataUri({
    topLabel: 'NAKED',
    bottomLabel: 'PEA 90%',
    bgHex: '#1e1b4b',
    accentHex: '#a5b4fc',
    shape: 'tub'
  }),
  vegaSport: buildProductThumbnailDataUri({
    topLabel: 'VEGA',
    bottomLabel: 'SPORT',
    bgHex: '#064e3b',
    accentHex: '#34d399',
    shape: 'tub'
  }),
  hempProtein: buildProductThumbnailDataUri({
    topLabel: 'HEMP',
    bottomLabel: 'PROTEIN',
    bgHex: '#1a2e05',
    accentHex: '#a3e635',
    shape: 'bag'
  }),
  soyIsolate: buildProductThumbnailDataUri({
    topLabel: 'SOY',
    bottomLabel: 'ISOLATE',
    bgHex: '#312e81',
    accentHex: '#c4b5fd',
    shape: 'tub'
  }),
  creatine: buildProductThumbnailDataUri({
    topLabel: '5G',
    bottomLabel: 'CREATINE',
    bgHex: '#172554',
    accentHex: '#60a5fa',
    shape: 'tub'
  }),
  vitaminD3: buildProductThumbnailDataUri({
    topLabel: 'VIT D3',
    bottomLabel: '1000 IU',
    bgHex: '#422006',
    accentHex: '#facc15',
    shape: 'bottle'
  }),
  oats: buildProductThumbnailDataUri({
    topLabel: 'GF',
    bottomLabel: 'OATS',
    bgHex: '#451a03',
    accentHex: '#f59e0b',
    shape: 'bag'
  }),
  rolledOats: buildProductThumbnailDataUri({
    topLabel: 'ROLLED',
    bottomLabel: 'OATS',
    bgHex: '#3f2c17',
    accentHex: '#fcd34d',
    shape: 'bag'
  }),
  buckwheat: buildProductThumbnailDataUri({
    topLabel: 'BUCK',
    bottomLabel: 'WHEAT',
    bgHex: '#3b1d0c',
    accentHex: '#fdba74',
    shape: 'bag'
  }),
  creamOfRice: buildProductThumbnailDataUri({
    topLabel: 'CREAM',
    bottomLabel: 'OF RICE',
    bgHex: '#1e293b',
    accentHex: '#e2e8f0',
    shape: 'bag'
  }),
  tofu: buildProductThumbnailDataUri({
    topLabel: 'TOFU',
    bottomLabel: 'X-FIRM',
    bgHex: '#064e3b',
    accentHex: '#6ee7b7',
    shape: 'pack'
  }),
  tempeh: buildProductThumbnailDataUri({
    topLabel: 'TEMPEH',
    bottomLabel: 'ORGANIC',
    bgHex: '#431407',
    accentHex: '#fb923c',
    shape: 'pack'
  }),
  seitan: buildProductThumbnailDataUri({
    topLabel: 'SEITAN',
    bottomLabel: 'HIGH PRO',
    bgHex: '#4c1d95',
    accentHex: '#d8b4fe',
    shape: 'pack'
  }),
  edamame: buildProductThumbnailDataUri({
    topLabel: 'EDAMAME',
    bottomLabel: 'SHELLED',
    bgHex: '#14532d',
    accentHex: '#86efac',
    shape: 'bag'
  }),
  lentilPasta: buildProductThumbnailDataUri({
    topLabel: 'LENTIL',
    bottomLabel: 'PASTA',
    bgHex: '#7c2d12',
    accentHex: '#fdba74',
    shape: 'pack'
  }),
  jasmineRice: buildProductThumbnailDataUri({
    topLabel: 'JASMINE',
    bottomLabel: 'RICE',
    bgHex: '#1e293b',
    accentHex: '#cbd5e1',
    shape: 'bag'
  }),
  brownRice: buildProductThumbnailDataUri({
    topLabel: 'BROWN',
    bottomLabel: 'RICE',
    bgHex: '#422006',
    accentHex: '#fde047',
    shape: 'bag'
  }),
  quinoa: buildProductThumbnailDataUri({
    topLabel: 'QUINOA',
    bottomLabel: 'COOKED',
    bgHex: '#365314',
    accentHex: '#bef264',
    shape: 'bag'
  }),
  sweetPotato: buildProductThumbnailDataUri({
    topLabel: 'SWEET',
    bottomLabel: 'POTATO',
    bgHex: '#7c2d12',
    accentHex: '#fb923c',
    shape: 'produce'
  }),
  peanutButter: buildProductThumbnailDataUri({
    topLabel: 'PEANUT',
    bottomLabel: 'BUTTER',
    bgHex: '#451a03',
    accentHex: '#f59e0b',
    shape: 'jar'
  }),
  almondButter: buildProductThumbnailDataUri({
    topLabel: 'ALMOND',
    bottomLabel: 'BUTTER',
    bgHex: '#3b1d0c',
    accentHex: '#fbbf24',
    shape: 'jar'
  }),
  sunButter: buildProductThumbnailDataUri({
    topLabel: 'SUN',
    bottomLabel: 'BUTTER',
    bgHex: '#713f12',
    accentHex: '#fde047',
    shape: 'jar'
  }),
  tahini: buildProductThumbnailDataUri({
    topLabel: 'TAHINI',
    bottomLabel: 'SESAME',
    bgHex: '#3f2e17',
    accentHex: '#fed7aa',
    shape: 'jar'
  }),
  banana: buildProductThumbnailDataUri({
    topLabel: 'BANANA',
    bottomLabel: 'FRESH',
    bgHex: '#422006',
    accentHex: '#fde047',
    shape: 'produce'
  }),
  blueberries: buildProductThumbnailDataUri({
    topLabel: 'BLUE',
    bottomLabel: 'BERRIES',
    bgHex: '#1e1b4b',
    accentHex: '#818cf8',
    shape: 'produce'
  }),
  broccoli: buildProductThumbnailDataUri({
    topLabel: 'BROC',
    bottomLabel: 'FLORETS',
    bgHex: '#052e16',
    accentHex: '#4ade80',
    shape: 'produce'
  }),
  spinach: buildProductThumbnailDataUri({
    topLabel: 'BABY',
    bottomLabel: 'SPINACH',
    bgHex: '#064e3b',
    accentHex: '#34d399',
    shape: 'produce'
  }),
  greenBeans: buildProductThumbnailDataUri({
    topLabel: 'GREEN',
    bottomLabel: 'BEANS',
    bgHex: '#14532d',
    accentHex: '#86efac',
    shape: 'produce'
  }),
  chiaSeeds: buildProductThumbnailDataUri({
    topLabel: 'CHIA',
    bottomLabel: 'SEEDS',
    bgHex: '#0f172a',
    accentHex: '#38bdf8',
    shape: 'bag'
  }),
  flaxSeed: buildProductThumbnailDataUri({
    topLabel: 'FLAX',
    bottomLabel: 'GROUND',
    bgHex: '#451a03',
    accentHex: '#fbbf24',
    shape: 'bag'
  }),
  hempHearts: buildProductThumbnailDataUri({
    topLabel: 'HEMP',
    bottomLabel: 'HEARTS',
    bgHex: '#1a2e05',
    accentHex: '#a3e635',
    shape: 'bag'
  }),
  nooch: buildProductThumbnailDataUri({
    topLabel: 'NOOCH',
    bottomLabel: 'B12 + PRO',
    bgHex: '#422006',
    accentHex: '#facc15',
    shape: 'tub'
  }),
  sesameOil: buildProductThumbnailDataUri({
    topLabel: 'SESAME',
    bottomLabel: 'OIL',
    bgHex: '#431407',
    accentHex: '#fb923c',
    shape: 'bottle'
  }),
  oliveOil: buildProductThumbnailDataUri({
    topLabel: 'OLIVE',
    bottomLabel: 'OIL',
    bgHex: '#365314',
    accentHex: '#a3e635',
    shape: 'bottle'
  }),
  salt: buildProductThumbnailDataUri({
    topLabel: 'IODIZED',
    bottomLabel: 'SALT',
    bgHex: '#1e293b',
    accentHex: '#7dd3fc',
    shape: 'tub'
  }),
  genericFood: buildProductThumbnailDataUri({
    topLabel: 'FOOD',
    bottomLabel: 'ITEM',
    bgHex: '#1e293b',
    accentHex: '#34d399',
    shape: 'pack'
  })
} as const;

/**
 * Competitor-grade categorized catalog of swap options.
 * Silk Protein Milk is highlighted as a top swap for any plant milk or shake liquid.
 */
export const INGREDIENT_SWAP_CATALOG: SwapIngredientOption[] = [
  // Plant Milks & Shake Liquids
  {
    id: 'swap_silk_protein_milk',
    name: 'Silk Protein Milk (Original / Unsweetened)',
    shortName: 'Silk Protein Milk',
    brandTag: 'Silk Protein',
    shortNote: 'Adds +14g extra protein per cup. Creamy almond & cashew blend with pea protein.',
    category: 'plant_milk',
    weight: '180 ml',
    grams: 180,
    protein: 15,
    kcal: 95,
    costPerServing: 0.82,
    weeklyGroceryCost: 5.74,
    shopItemId: 'shop_silk',
    imageUrl: PRODUCT_THUMBNAILS.silkProteinMilk
  },
  {
    id: 'swap_almond_cashew_milk',
    name: 'Unsweetened Fortified Almond or Cashew Milk',
    shortName: 'Almond / Cashew Milk',
    brandTag: 'Budget Pick',
    shortNote: 'Lowest calorie and lowest cost milk option for overnight oats.',
    category: 'plant_milk',
    weight: '180 ml',
    grams: 180,
    protein: 1,
    kcal: 24,
    costPerServing: 0.46,
    weeklyGroceryCost: 3.19,
    shopItemId: 'shop_silk',
    imageUrl: PRODUCT_THUMBNAILS.almondCashewMilk
  },
  {
    id: 'swap_unsweetened_soy_milk',
    name: 'Unsweetened Organic Soy Milk',
    shortName: 'Organic Soy Milk',
    brandTag: 'Whole Soy',
    shortNote: 'Balanced plant protein (+6g) with smooth texture and medium cost.',
    category: 'plant_milk',
    weight: '180 ml',
    grams: 180,
    protein: 6,
    kcal: 60,
    costPerServing: 0.52,
    weeklyGroceryCost: 3.64,
    shopItemId: 'shop_silk',
    imageUrl: PRODUCT_THUMBNAILS.soyMilk
  },
  {
    id: 'swap_fortified_oat_milk',
    name: 'Fortified Oat Milk (Unsweetened)',
    shortName: 'Fortified Oat Milk',
    brandTag: 'Nut-Free',
    shortNote: 'Nut-free and soy-free. Slightly sweeter taste with extra carbs for energy.',
    category: 'plant_milk',
    weight: '180 ml',
    grams: 180,
    protein: 2,
    kcal: 90,
    costPerServing: 0.68,
    weeklyGroceryCost: 4.76,
    shopItemId: 'shop_silk',
    imageUrl: PRODUCT_THUMBNAILS.oatMilk
  },
  {
    id: 'swap_cold_water_liquid',
    name: 'Cold Water (Shaker Bottle)',
    shortName: 'Cold Water',
    brandTag: 'Zero Cost',
    shortNote: 'Zero calories and free. Best for fast digestion before lifting.',
    category: 'water_liquid',
    weight: '350 ml',
    grams: 350,
    protein: 0,
    kcal: 0,
    costPerServing: 0.0,
    imageUrl: PRODUCT_THUMBNAILS.coldWater
  },
  {
    id: 'swap_silk_protein_shake_350',
    name: 'Silk Protein Milk (350 ml Shaker)',
    shortName: 'Silk Protein Milk',
    brandTag: 'Silk Protein',
    shortNote: 'Turn your water shake into a creamy high-protein shake (+29g protein).',
    category: 'water_liquid',
    weight: '350 ml',
    grams: 350,
    protein: 29,
    kcal: 185,
    costPerServing: 1.59,
    weeklyGroceryCost: 11.13,
    shopItemId: 'shop_silk',
    imageUrl: PRODUCT_THUMBNAILS.silkProteinMilk
  },
  {
    id: 'swap_soy_milk_shake_350',
    name: 'Unsweetened Organic Soy Milk (350 ml)',
    shortName: 'Organic Soy Milk',
    brandTag: 'Whole Soy',
    shortNote: 'Adds +12g protein and creamy texture to your shaker bottle.',
    category: 'water_liquid',
    weight: '350 ml',
    grams: 350,
    protein: 12,
    kcal: 115,
    costPerServing: 0.99,
    weeklyGroceryCost: 6.93,
    shopItemId: 'shop_silk',
    imageUrl: PRODUCT_THUMBNAILS.soyMilk
  },

  // Protein Powders
  {
    id: 'swap_naked_pea_35',
    name: 'Naked Pea Protein Isolate (90% P)',
    shortName: 'Naked Pea Protein',
    brandTag: 'Default 1-Ingredient',
    shortNote: 'Pure yellow pea isolate with top protein per dollar.',
    category: 'protein_powder',
    weight: '35g',
    grams: 35,
    protein: 32,
    kcal: 140,
    costPerServing: 1.11,
    weeklyGroceryCost: 20.0,
    shopItemId: 'shop_isolate',
    imageUrl: PRODUCT_THUMBNAILS.nakedPea
  },
  {
    id: 'swap_vega_sport_41',
    name: 'Vega Sport Premium Plant Protein',
    shortName: 'Vega Sport Protein',
    brandTag: 'Flavored Blend',
    shortNote: 'Chocolate or vanilla flavor with tart cherry for muscle recovery.',
    category: 'protein_powder',
    weight: '41g',
    grams: 41,
    protein: 30,
    kcal: 170,
    costPerServing: 1.85,
    weeklyGroceryCost: 28.5,
    shopItemId: 'shop_isolate',
    imageUrl: PRODUCT_THUMBNAILS.vegaSport
  },
  {
    id: 'swap_soy_isolate_35',
    name: 'Unflavored Soy Protein Isolate',
    shortName: 'Soy Protein Isolate',
    brandTag: 'Smooth Mix',
    shortNote: 'Very smooth mix in water. Complete amino acid profile.',
    category: 'protein_powder',
    weight: '35g',
    grams: 35,
    protein: 31,
    kcal: 135,
    costPerServing: 1.05,
    weeklyGroceryCost: 18.9,
    shopItemId: 'shop_isolate',
    imageUrl: PRODUCT_THUMBNAILS.soyIsolate
  },
  {
    id: 'swap_hemp_protein_45',
    name: 'Organic Hemp Protein Powder',
    shortName: 'Hemp Protein',
    brandTag: 'High Fiber',
    shortNote: 'Earthy whole-food powder with extra omega-3 fats and fiber.',
    category: 'protein_powder',
    weight: '45g',
    grams: 45,
    protein: 22,
    kcal: 165,
    costPerServing: 1.45,
    weeklyGroceryCost: 23.4,
    shopItemId: 'shop_isolate',
    imageUrl: PRODUCT_THUMBNAILS.hempProtein
  },

  // Lunch Main Protein (Tofu & Swaps)
  {
    id: 'swap_tofu_extra_firm',
    name: 'Extra-Firm Tofu (Pressed & Baked)',
    shortName: 'Extra-Firm Tofu',
    brandTag: 'Default Pick',
    shortNote: 'High protein, low cost, easy to batch bake for 4 days.',
    category: 'tofu_protein',
    weight: '175g',
    grams: 175,
    protein: 24,
    kcal: 180,
    costPerServing: 1.28,
    weeklyGroceryCost: 8.97,
    shopItemId: 'shop_tofu',
    imageUrl: PRODUCT_THUMBNAILS.tofu
  },
  {
    id: 'swap_organic_tempeh',
    name: 'Organic Fermented Tempeh',
    shortName: 'Organic Tempeh',
    brandTag: 'Gut Friendly',
    shortNote: 'Nutty whole-soy block with extra protein (+7g) and fiber.',
    category: 'tofu_protein',
    weight: '160g',
    grams: 160,
    protein: 31,
    kcal: 305,
    costPerServing: 1.95,
    weeklyGroceryCost: 13.65,
    shopItemId: 'shop_tofu',
    imageUrl: PRODUCT_THUMBNAILS.tempeh
  },
  {
    id: 'swap_seitan_strips',
    name: 'High-Protein Seitan Strips',
    shortName: 'Seitan Strips',
    brandTag: 'Max Protein',
    shortNote: 'Very dense protein (+14g) with chewy texture. Contains wheat gluten.',
    category: 'tofu_protein',
    weight: '150g',
    grams: 150,
    protein: 38,
    kcal: 195,
    costPerServing: 2.15,
    weeklyGroceryCost: 15.05,
    shopItemId: 'shop_tofu',
    imageUrl: PRODUCT_THUMBNAILS.seitan
  },
  {
    id: 'swap_shelled_edamame',
    name: 'Shelled Steamed Edamame Beans',
    shortName: 'Shelled Edamame',
    brandTag: 'Zero Prep',
    shortNote: 'Ready from frozen in 3 minutes. Clean whole green soybeans.',
    category: 'tofu_protein',
    weight: '190g',
    grams: 190,
    protein: 22,
    kcal: 230,
    costPerServing: 1.55,
    weeklyGroceryCost: 10.85,
    shopItemId: 'shop_tofu',
    imageUrl: PRODUCT_THUMBNAILS.edamame
  },

  // Oats & Breakfast Grains
  {
    id: 'swap_gf_protein_oats',
    name: 'Gluten-Free Protein Oats',
    shortName: 'GF Protein Oats',
    brandTag: 'Default Pick',
    shortNote: '10g protein per 45g serving. Softens overnight in the fridge.',
    category: 'oats_grains',
    weight: '45g',
    grams: 45,
    protein: 10,
    kcal: 170,
    costPerServing: 0.34,
    weeklyGroceryCost: 2.38,
    shopItemId: 'shop_oats',
    imageUrl: PRODUCT_THUMBNAILS.oats
  },
  {
    id: 'swap_rolled_oats',
    name: 'Old-Fashioned Rolled Oats',
    shortName: 'Rolled Oats',
    brandTag: 'Super Budget',
    shortNote: 'Classic cheap oats found in every grocery aisle.',
    category: 'oats_grains',
    weight: '45g',
    grams: 45,
    protein: 6,
    kcal: 165,
    costPerServing: 0.19,
    weeklyGroceryCost: 1.33,
    shopItemId: 'shop_oats',
    imageUrl: PRODUCT_THUMBNAILS.rolledOats
  },
  {
    id: 'swap_buckwheat_groats',
    name: 'Organic Buckwheat Groats',
    shortName: 'Buckwheat Groats',
    brandTag: 'Gluten-Free',
    shortNote: 'Naturally gluten-free seed grain with steady post-gym carbs.',
    category: 'oats_grains',
    weight: '45g',
    grams: 45,
    protein: 6,
    kcal: 155,
    costPerServing: 0.48,
    weeklyGroceryCost: 3.36,
    shopItemId: 'shop_oats',
    imageUrl: PRODUCT_THUMBNAILS.buckwheat
  },
  {
    id: 'swap_cream_of_rice',
    name: 'Warm Cream of Rice',
    shortName: 'Cream of Rice',
    brandTag: 'Easy Stomach',
    shortNote: 'Fast-digesting smooth carbs. Very gentle on the stomach.',
    category: 'oats_grains',
    weight: '45g',
    grams: 45,
    protein: 3,
    kcal: 160,
    costPerServing: 0.42,
    weeklyGroceryCost: 2.94,
    shopItemId: 'shop_oats',
    imageUrl: PRODUCT_THUMBNAILS.creamOfRice
  },

  // Rice & Lunch Carbs
  {
    id: 'swap_jasmine_rice',
    name: 'Cooked White Jasmine Rice',
    shortName: 'White Jasmine Rice',
    brandTag: 'Default Pick',
    shortNote: 'Quick energy for workouts and super cheap in bulk.',
    category: 'rice_carbs',
    weight: '120g',
    grams: 120,
    protein: 3,
    kcal: 155,
    costPerServing: 0.22,
    weeklyGroceryCost: 1.54,
    shopItemId: 'shop_rice',
    imageUrl: PRODUCT_THUMBNAILS.jasmineRice
  },
  {
    id: 'swap_cooked_quinoa',
    name: 'Cooked Tri-Color Quinoa',
    shortName: 'Cooked Quinoa',
    brandTag: 'Extra Protein',
    shortNote: 'Adds +3g protein and extra fiber compared to white rice.',
    category: 'rice_carbs',
    weight: '130g',
    grams: 130,
    protein: 6,
    kcal: 160,
    costPerServing: 0.56,
    weeklyGroceryCost: 3.92,
    shopItemId: 'shop_rice',
    imageUrl: PRODUCT_THUMBNAILS.quinoa
  },
  {
    id: 'swap_brown_basmati',
    name: 'Cooked Brown Basmati Rice',
    shortName: 'Brown Basmati Rice',
    brandTag: 'Whole Grain',
    shortNote: 'Slow-release carbs to keep you full longer after lunch.',
    category: 'rice_carbs',
    weight: '120g',
    grams: 120,
    protein: 3,
    kcal: 145,
    costPerServing: 0.29,
    weeklyGroceryCost: 2.03,
    shopItemId: 'shop_rice',
    imageUrl: PRODUCT_THUMBNAILS.brownRice
  },
  {
    id: 'swap_sweet_potato',
    name: 'Roasted Sweet Potato Cubes',
    shortName: 'Sweet Potato',
    brandTag: 'Vitamin A',
    shortNote: 'Naturally sweet whole-food carb packed with potassium.',
    category: 'rice_carbs',
    weight: '175g',
    grams: 175,
    protein: 3,
    kcal: 150,
    costPerServing: 0.52,
    weeklyGroceryCost: 3.64,
    shopItemId: 'shop_rice',
    imageUrl: PRODUCT_THUMBNAILS.sweetPotato
  },

  // Nut Butters
  {
    id: 'swap_peanut_butter',
    name: 'Smooth Natural Peanut Butter',
    shortName: 'Peanut Butter',
    brandTag: 'Default Pick',
    shortNote: '100% roasted peanuts. Cheap healthy fats and 2g protein.',
    category: 'nut_butter',
    weight: '8g',
    grams: 8,
    protein: 2,
    kcal: 48,
    costPerServing: 0.14,
    weeklyGroceryCost: 1.96,
    shopItemId: 'shop_pb',
    imageUrl: PRODUCT_THUMBNAILS.peanutButter
  },
  {
    id: 'swap_almond_butter',
    name: 'Smooth Roasted Almond Butter',
    shortName: 'Almond Butter',
    brandTag: 'Vitamin E',
    shortNote: 'Rich roasted taste with extra vitamin E and magnesium.',
    category: 'nut_butter',
    weight: '8g',
    grams: 8,
    protein: 2,
    kcal: 50,
    costPerServing: 0.34,
    weeklyGroceryCost: 4.76,
    shopItemId: 'shop_pb',
    imageUrl: PRODUCT_THUMBNAILS.almondButter
  },
  {
    id: 'swap_sunbutter',
    name: 'SunButter (Sunflower Seed Butter)',
    shortName: 'SunButter (Nut-Free)',
    brandTag: 'Nut-Free',
    shortNote: 'Safe for peanut & tree-nut allergies with the same creamy texture.',
    category: 'nut_butter',
    weight: '8g',
    grams: 8,
    protein: 2,
    kcal: 50,
    costPerServing: 0.28,
    weeklyGroceryCost: 3.92,
    shopItemId: 'shop_pb',
    imageUrl: PRODUCT_THUMBNAILS.sunButter
  },
  {
    id: 'swap_tahini',
    name: 'Organic Sesame Tahini',
    shortName: 'Sesame Tahini',
    brandTag: 'Nut-Free',
    shortNote: 'Creamy sesame paste loaded with calcium and healthy fats.',
    category: 'nut_butter',
    weight: '8g',
    grams: 8,
    protein: 2,
    kcal: 48,
    costPerServing: 0.26,
    weeklyGroceryCost: 3.64,
    shopItemId: 'shop_pb',
    imageUrl: PRODUCT_THUMBNAILS.tahini
  },

  // Produce (Fruits & Veggies)
  {
    id: 'swap_broccoli_florets',
    name: 'Steamed Broccoli Florets',
    shortName: 'Broccoli Florets',
    brandTag: 'Default Pick',
    shortNote: 'High vitamin C and fiber with almost no calories.',
    category: 'produce',
    weight: '100g',
    grams: 100,
    protein: 3,
    kcal: 34,
    costPerServing: 0.36,
    weeklyGroceryCost: 2.52,
    shopItemId: 'shop_broccoli',
    imageUrl: PRODUCT_THUMBNAILS.broccoli
  },
  {
    id: 'swap_baby_spinach',
    name: 'Fresh Baby Spinach (Steamed)',
    shortName: 'Baby Spinach',
    brandTag: 'Iron Rich',
    shortNote: 'Wilts fast in a warm bowl. Great plant iron and folate.',
    category: 'produce',
    weight: '100g',
    grams: 100,
    protein: 3,
    kcal: 23,
    costPerServing: 0.54,
    weeklyGroceryCost: 3.78,
    shopItemId: 'shop_broccoli',
    imageUrl: PRODUCT_THUMBNAILS.spinach
  },
  {
    id: 'swap_green_beans',
    name: 'Crisp Steamed Green Beans',
    shortName: 'Green Beans',
    brandTag: 'Easy Crunch',
    shortNote: 'Mild flavor and stays crisp for 4 days in meal prep bowls.',
    category: 'produce',
    weight: '100g',
    grams: 100,
    protein: 2,
    kcal: 31,
    costPerServing: 0.42,
    weeklyGroceryCost: 2.94,
    shopItemId: 'shop_broccoli',
    imageUrl: PRODUCT_THUMBNAILS.greenBeans
  },
  {
    id: 'swap_ripe_banana',
    name: 'Peeled Ripe Banana (Mashed)',
    shortName: 'Ripe Banana',
    brandTag: 'Default Fruit',
    shortNote: 'Sweetens overnight oats naturally with potassium.',
    category: 'produce',
    weight: '30g',
    grams: 30,
    protein: 0,
    kcal: 27,
    costPerServing: 0.08,
    weeklyGroceryCost: 0.56,
    shopItemId: 'shop_banana',
    imageUrl: PRODUCT_THUMBNAILS.banana
  },
  {
    id: 'swap_frozen_blueberries',
    name: 'Wild Frozen Blueberries',
    shortName: 'Frozen Blueberries',
    brandTag: 'Antioxidants',
    shortNote: 'Thaws overnight in your oats jar. Great brain & recovery boost.',
    category: 'produce',
    weight: '45g',
    grams: 45,
    protein: 0,
    kcal: 26,
    costPerServing: 0.34,
    weeklyGroceryCost: 2.38,
    shopItemId: 'shop_banana',
    imageUrl: PRODUCT_THUMBNAILS.blueberries
  },

  // Seeds & Boosters
  {
    id: 'swap_chia_seeds',
    name: 'Organic Whole Chia Seeds',
    shortName: 'Chia Seeds',
    brandTag: 'Omega-3',
    shortNote: 'Thickens overnight oats into pudding with omega-3 fats.',
    category: 'seeds_boosters',
    weight: '6g',
    grams: 6,
    protein: 1,
    kcal: 30,
    costPerServing: 0.12,
    weeklyGroceryCost: 0.84,
    shopItemId: 'shop_chia',
    imageUrl: PRODUCT_THUMBNAILS.chiaSeeds
  },
  {
    id: 'swap_ground_flax',
    name: 'Ground Golden Flaxseed',
    shortName: 'Ground Flaxseed',
    brandTag: 'Budget Omega-3',
    shortNote: 'Lower cost omega-3 swap with warm nutty flavor.',
    category: 'seeds_boosters',
    weight: '6g',
    grams: 6,
    protein: 1,
    kcal: 32,
    costPerServing: 0.08,
    weeklyGroceryCost: 0.56,
    shopItemId: 'shop_chia',
    imageUrl: PRODUCT_THUMBNAILS.flaxSeed
  },
  {
    id: 'swap_hemp_hearts',
    name: 'Shelled Hemp Hearts',
    shortName: 'Hemp Hearts',
    brandTag: 'Extra Protein',
    shortNote: 'Soft buttery seeds with +3g protein per spoonful.',
    category: 'seeds_boosters',
    weight: '10g',
    grams: 10,
    protein: 3,
    kcal: 55,
    costPerServing: 0.24,
    weeklyGroceryCost: 1.68,
    shopItemId: 'shop_chia',
    imageUrl: PRODUCT_THUMBNAILS.hempHearts
  },
  {
    id: 'swap_nutritional_yeast',
    name: 'Fortified Nutritional Yeast (B12)',
    shortName: 'Nutritional Yeast',
    brandTag: 'Cheesy + B12',
    shortNote: 'Savory cheesy flavor with complete daily Vitamin B12.',
    category: 'seeds_boosters',
    weight: '10g',
    grams: 10,
    protein: 5,
    kcal: 40,
    costPerServing: 0.22,
    weeklyGroceryCost: 1.54,
    shopItemId: 'shop_nooch',
    imageUrl: PRODUCT_THUMBNAILS.nooch
  },

  // Oils & Seasoning
  {
    id: 'swap_sesame_oil',
    name: 'Toasted Sesame Oil',
    shortName: 'Sesame Oil',
    brandTag: 'Flavor Boost',
    shortNote: 'Rich roasted aroma that makes tofu & rice taste like takeout.',
    category: 'oil_seasoning',
    weight: '5g',
    grams: 5,
    protein: 0,
    kcal: 44,
    costPerServing: 0.11,
    weeklyGroceryCost: 0.77,
    shopItemId: 'shop_sesame',
    imageUrl: PRODUCT_THUMBNAILS.sesameOil
  },
  {
    id: 'swap_olive_oil',
    name: 'Extra Virgin Olive Oil',
    shortName: 'Olive Oil',
    brandTag: 'Heart Healthy',
    shortNote: 'Clean Mediterranean healthy fat for everyday cooking.',
    category: 'oil_seasoning',
    weight: '5g',
    grams: 5,
    protein: 0,
    kcal: 44,
    costPerServing: 0.12,
    weeklyGroceryCost: 0.84,
    shopItemId: 'shop_sesame',
    imageUrl: PRODUCT_THUMBNAILS.oliveOil
  },
  {
    id: 'swap_iodized_salt',
    name: 'Iodized Table Salt (Thyroid Support)',
    shortName: 'Iodized Salt',
    brandTag: 'Essential',
    shortNote: 'Provides daily iodine for energy and thyroid health.',
    category: 'oil_seasoning',
    weight: '1.5g',
    grams: 1.5,
    protein: 0,
    kcal: 0,
    costPerServing: 0.01,
    weeklyGroceryCost: 0.07,
    shopItemId: 'shop_iodine',
    imageUrl: PRODUCT_THUMBNAILS.salt
  },

  // Supplements
  {
    id: 'swap_creatine_mono',
    name: '100% Micronized Creatine Monohydrate',
    shortName: 'Creatine Monohydrate',
    brandTag: 'Strength Proven',
    shortNote: '5g daily helps muscles lift heavier and recover faster.',
    category: 'supplement',
    weight: '5g',
    grams: 5,
    protein: 0,
    kcal: 0,
    costPerServing: 0.24,
    weeklyGroceryCost: 1.68,
    shopItemId: 'shop_creatine',
    imageUrl: PRODUCT_THUMBNAILS.creatine
  },
  {
    id: 'swap_vit_d3',
    name: 'Vegan Vitamin D3 (1,000 IU Capsule)',
    shortName: 'Vegan Vitamin D3',
    brandTag: 'Daily Immunity',
    shortNote: 'Supports bone health and mood with your evening meal.',
    category: 'supplement',
    weight: '1 cap',
    grams: 1,
    protein: 0,
    kcal: 0,
    costPerServing: 0.10,
    weeklyGroceryCost: 0.70,
    shopItemId: 'shop_vitd3',
    imageUrl: PRODUCT_THUMBNAILS.vitaminD3
  }
];

/**
 * Resolves a visual grocery recognition thumbnail URL (`imageUrl`) for any
 * meal ingredient or shopping list item. Preserves valid custom `imageUrl`s.
 */
export function resolveIngredientImageUrl(
  item: { id?: string; name?: string; label?: string; shortName?: string; imageUrl?: string; swappedBrandName?: string } | null | undefined
): string {
  if (!item) return PRODUCT_THUMBNAILS.genericFood;
  if (typeof item.imageUrl === 'string' && /^(data:image\/|https?:\/\/|\/)/i.test(item.imageUrl.trim())) {
    return item.imageUrl.trim();
  }
  const haystack = `${item.id || ''} ${item.swappedBrandName || ''} ${item.shortName || ''} ${item.label || ''} ${item.name || ''}`.toLowerCase();

  if (haystack.includes('silk protein') || haystack.includes('silk_protein')) return PRODUCT_THUMBNAILS.silkProteinMilk;
  if (haystack.includes('oat milk')) return PRODUCT_THUMBNAILS.oatMilk;
  if (haystack.includes('soy milk')) return PRODUCT_THUMBNAILS.soyMilk;
  if (haystack.includes('almond milk') || haystack.includes('cashew milk') || haystack.includes('almond or cashew') || haystack.includes('shop_silk')) {
    return PRODUCT_THUMBNAILS.almondCashewMilk;
  }
  if (haystack.includes('cold water') || haystack.includes('water (shaker')) return PRODUCT_THUMBNAILS.coldWater;
  if (haystack.includes('vega sport')) return PRODUCT_THUMBNAILS.vegaSport;
  if (haystack.includes('hemp protein')) return PRODUCT_THUMBNAILS.hempProtein;
  if (haystack.includes('soy protein isolate') || haystack.includes('soy isolate')) return PRODUCT_THUMBNAILS.soyIsolate;
  if (haystack.includes('pea protein') || haystack.includes('naked pea') || haystack.includes('shop_isolate') || haystack.includes('pea_oats')) {
    return PRODUCT_THUMBNAILS.nakedPea;
  }
  if (haystack.includes('creatine')) return PRODUCT_THUMBNAILS.creatine;
  if (haystack.includes('vitamin d3') || haystack.includes('vitd3')) return PRODUCT_THUMBNAILS.vitaminD3;
  if (haystack.includes('tempeh')) return PRODUCT_THUMBNAILS.tempeh;
  if (haystack.includes('seitan')) return PRODUCT_THUMBNAILS.seitan;
  if (haystack.includes('edamame')) return PRODUCT_THUMBNAILS.edamame;
  if (haystack.includes('lentil pasta')) return PRODUCT_THUMBNAILS.lentilPasta;
  if (haystack.includes('tofu')) return PRODUCT_THUMBNAILS.tofu;
  if (haystack.includes('buckwheat')) return PRODUCT_THUMBNAILS.buckwheat;
  if (haystack.includes('cream of rice')) return PRODUCT_THUMBNAILS.creamOfRice;
  if (haystack.includes('rolled oats')) return PRODUCT_THUMBNAILS.rolledOats;
  if (haystack.includes('oats')) return PRODUCT_THUMBNAILS.oats;
  if (haystack.includes('quinoa')) return PRODUCT_THUMBNAILS.quinoa;
  if (haystack.includes('brown basmati') || haystack.includes('brown rice')) return PRODUCT_THUMBNAILS.brownRice;
  if (haystack.includes('sweet potato')) return PRODUCT_THUMBNAILS.sweetPotato;
  if (haystack.includes('rice')) return PRODUCT_THUMBNAILS.jasmineRice;
  if (haystack.includes('almond butter')) return PRODUCT_THUMBNAILS.almondButter;
  if (haystack.includes('sunbutter') || haystack.includes('sunflower')) return PRODUCT_THUMBNAILS.sunButter;
  if (haystack.includes('tahini')) return PRODUCT_THUMBNAILS.tahini;
  if (haystack.includes('peanut butter') || haystack.includes('shop_pb') || haystack.includes('_pb')) {
    return PRODUCT_THUMBNAILS.peanutButter;
  }
  if (haystack.includes('blueberr')) return PRODUCT_THUMBNAILS.blueberries;
  if (haystack.includes('banana')) return PRODUCT_THUMBNAILS.banana;
  if (haystack.includes('spinach')) return PRODUCT_THUMBNAILS.spinach;
  if (haystack.includes('green beans')) return PRODUCT_THUMBNAILS.greenBeans;
  if (haystack.includes('broccoli')) return PRODUCT_THUMBNAILS.broccoli;
  if (haystack.includes('flax')) return PRODUCT_THUMBNAILS.flaxSeed;
  if (haystack.includes('hemp hearts')) return PRODUCT_THUMBNAILS.hempHearts;
  if (haystack.includes('chia')) return PRODUCT_THUMBNAILS.chiaSeeds;
  if (haystack.includes('nutritional yeast') || haystack.includes('nooch')) return PRODUCT_THUMBNAILS.nooch;
  if (haystack.includes('olive oil')) return PRODUCT_THUMBNAILS.oliveOil;
  if (haystack.includes('sesame oil') || haystack.includes('shop_sesame')) return PRODUCT_THUMBNAILS.sesameOil;
  if (haystack.includes('salt') || haystack.includes('iodine')) return PRODUCT_THUMBNAILS.salt;
  if (haystack.includes('silk') || haystack.includes('milk')) return PRODUCT_THUMBNAILS.silkProteinMilk;

  return PRODUCT_THUMBNAILS.genericFood;
}

export function inferIngredientCategory(item: Partial<MealIngredientItem> | null | undefined): IngredientCategory {
  if (!item) return 'plant_milk';
  if (item.category) return item.category;
  const hay = `${item.id || ''} ${item.label || ''} ${item.name || ''}`.toLowerCase();

  if (hay.includes('water (shaker') || hay.includes('cold water')) return 'water_liquid';
  if (hay.includes('milk') || hay.includes('silk')) return 'plant_milk';
  if (hay.includes('pea protein') || hay.includes('protein isolate') || hay.includes('protein powder') || hay.includes('vega sport') || hay.includes('hemp protein')) {
    return 'protein_powder';
  }
  if (hay.includes('creatine') || hay.includes('vitamin d3') || hay.includes('vitd3')) return 'supplement';
  if (hay.includes('tofu') || hay.includes('tempeh') || hay.includes('seitan') || hay.includes('edamame')) return 'tofu_protein';
  if (hay.includes('oats') || hay.includes('buckwheat') || hay.includes('cream of rice')) return 'oats_grains';
  if (hay.includes('rice') || hay.includes('quinoa') || hay.includes('sweet potato')) return 'rice_carbs';
  if (hay.includes('peanut butter') || hay.includes('almond butter') || hay.includes('sunbutter') || hay.includes('tahini') || hay.includes('_pb')) {
    return 'nut_butter';
  }
  if (hay.includes('broccoli') || hay.includes('spinach') || hay.includes('green beans') || hay.includes('banana') || hay.includes('blueberr')) {
    return 'produce';
  }
  if (hay.includes('chia') || hay.includes('flax') || hay.includes('hemp hearts') || hay.includes('nutritional yeast') || hay.includes('nooch')) {
    return 'seeds_boosters';
  }
  if (hay.includes('oil') || hay.includes('salt') || hay.includes('iodine') || hay.includes('sauce')) return 'oil_seasoning';
  return 'plant_milk';
}

export function estimateIngredientServingCost(item: Partial<MealIngredientItem> | null | undefined): number {
  if (!item) return 0;
  if (typeof item.costPerServing === 'number' && Number.isFinite(item.costPerServing) && item.costPerServing >= 0) {
    return +item.costPerServing.toFixed(2);
  }
  const hay = `${item.id || ''} ${item.label || ''} ${item.name || ''}`.toLowerCase();
  const grams = Number(item.grams) || 0;

  if (hay.includes('cold water') || hay.includes('water (shaker')) return 0.0;
  if (hay.includes('silk protein')) return grams >= 280 ? 1.59 : 0.82;
  if (hay.includes('oat milk')) return 0.68;
  if (hay.includes('soy milk')) return grams >= 280 ? 0.99 : 0.52;
  if (hay.includes('almond') || hay.includes('cashew')) return 0.46;
  if (hay.includes('pea protein') || hay.includes('naked pea')) {
    const g = grams > 0 ? grams : 35;
    return +(g * 0.0317).toFixed(2);
  }
  if (hay.includes('creatine')) return 0.24;
  if (hay.includes('vitamin d3') || hay.includes('vitd3')) return 0.10;
  if (hay.includes('oats')) return 0.34;
  if (hay.includes('banana')) return 0.08;
  if (hay.includes('peanut butter') || hay.includes('_pb')) return 0.14;
  if (hay.includes('chia')) return 0.12;
  if (hay.includes('tofu')) return 1.28;
  if (hay.includes('rice')) return 0.22;
  if (hay.includes('broccoli')) return 0.36;
  if (hay.includes('nutritional yeast') || hay.includes('nooch')) return 0.22;
  if (hay.includes('sesame oil')) return 0.11;
  if (hay.includes('salt') || hay.includes('iodine')) return 0.01;
  return 0.35;
}

export function getSwapOptionsForIngredient(
  item: Partial<MealIngredientItem> | null | undefined,
  includeAllCategories = false
): SwapIngredientOption[] {
  if (includeAllCategories) {
    return INGREDIENT_SWAP_CATALOG.slice();
  }
  const category = inferIngredientCategory(item);
  // If user taps a plant milk OR shake liquid, show plant_milk & water_liquid choices with Silk Protein Milk first!
  if (category === 'plant_milk' || category === 'water_liquid') {
    const primary = INGREDIENT_SWAP_CATALOG.filter((opt) => opt.category === category);
    const cross = INGREDIENT_SWAP_CATALOG.filter(
      (opt) => opt.category !== category && (opt.category === 'plant_milk' || opt.category === 'water_liquid')
    );
    return [...primary, ...cross];
  }
  const exact = INGREDIENT_SWAP_CATALOG.filter((opt) => opt.category === category);
  return exact.length > 0 ? exact : INGREDIENT_SWAP_CATALOG.slice(0, 8);
}

export function computeSwapMacroDeltas(
  currentItem: Partial<MealIngredientItem>,
  replacement: SwapIngredientOption
): SwapMacroDeltas {
  const curKcal = Number(currentItem.kcal) || 0;
  const curProtein = Number(currentItem.protein) || 0;
  const curGrams = Number(currentItem.grams) || 0;
  const curCost = estimateIngredientServingCost(currentItem);
  return {
    kcalDelta: Math.round((Number(replacement.kcal) || 0) - curKcal),
    proteinDelta: Math.round((Number(replacement.protein) || 0) - curProtein),
    gramsDelta: Math.round((Number(replacement.grams) || 0) - curGrams),
    costDelta: +((Number(replacement.costPerServing) || 0) - curCost).toFixed(2)
  };
}

export function recalculateMealTotals(
  items: MealIngredientItem[],
  baselineCostOverride?: number
): MealTotalsSummary {
  const list = Array.isArray(items) ? items : [];
  const kcal = Math.round(list.reduce((sum, it) => sum + (Number(it.kcal) || 0), 0));
  const protein = Math.round(list.reduce((sum, it) => sum + (Number(it.protein) || 0), 0));
  const grams = Math.round(list.reduce((sum, it) => sum + (Number(it.grams) || 0), 0));
  const computedCost = +list.reduce((sum, it) => sum + estimateIngredientServingCost(it), 0).toFixed(2);
  const cost =
    typeof baselineCostOverride === 'number' && Number.isFinite(baselineCostOverride)
      ? +baselineCostOverride.toFixed(2)
      : computedCost;
  return { kcal, protein, grams, cost };
}

/**
 * Applies `ingredientSwaps` across a full day meal plan and automatically recalculates
 * each meal's calories, protein, weight, and cost PLUS the entire day's totals.
 */
export function applyIngredientSwapsToDayPlan(
  dayPlan: DayFuelPlanShape,
  ingredientSwaps?: Record<string, StoredIngredientSwap> | null,
  slotBaseCosts: Record<string, number> = DEFAULT_MEAL_SLOT_BASE_COSTS
): DayFuelPlanShape {
  const swaps = ingredientSwaps && typeof ingredientSwaps === 'object' ? ingredientSwaps : {};
  const cloned: DayFuelPlanShape = JSON.parse(JSON.stringify(dayPlan));
  const slotIds = Object.keys(cloned.meals || {});

  let totalDayKcal = 0;
  let totalDayProtein = 0;
  let totalDayCost = 0;
  let anySwapApplied = false;

  slotIds.forEach((slotId) => {
    const meal = cloned.meals[slotId];
    if (!meal || !Array.isArray(meal.items)) return;

    let slotCostDelta = 0;
    let slotHasSwap = false;

    meal.items = meal.items.map((rawItem) => {
      const baseCost = estimateIngredientServingCost(rawItem);
      const swapKey = `${slotId}::${rawItem.id}`;
      const swapRec = swaps[swapKey];

      if (swapRec) {
        slotHasSwap = true;
        anySwapApplied = true;
        const nextCost =
          typeof swapRec.costPerServing === 'number' && Number.isFinite(swapRec.costPerServing)
            ? swapRec.costPerServing
            : estimateIngredientServingCost(swapRec);
        slotCostDelta += nextCost - baseCost;
        return {
          ...rawItem,
          name: swapRec.name,
          label: swapRec.name,
          weight: swapRec.weight,
          grams: Number(swapRec.grams) || 0,
          protein: Number(swapRec.protein) || 0,
          kcal: Number(swapRec.kcal) || 0,
          costPerServing: +nextCost.toFixed(2),
          imageUrl: resolveIngredientImageUrl({ name: swapRec.name, imageUrl: swapRec.imageUrl }),
          brandTag: swapRec.brandTag,
          shopItemId: swapRec.shopItemId || rawItem.shopItemId,
          swappedFromName: swapRec.swappedFromName || rawItem.name,
          swapOptionId: swapRec.swapOptionId,
          isSwapped: true
        };
      }

      return {
        ...rawItem,
        costPerServing: baseCost,
        imageUrl: resolveIngredientImageUrl(rawItem),
        isSwapped: false
      };
    });

    const sums = recalculateMealTotals(meal.items);
    const baseSlotCost = typeof slotBaseCosts[slotId] === 'number' ? slotBaseCosts[slotId] : sums.cost;
    const effectiveMealCost = Math.max(0, +(baseSlotCost + slotCostDelta).toFixed(2));

    meal.scaleGrams = sums.grams;
    meal.mealCost = effectiveMealCost;
    if (slotHasSwap) {
      meal.kcal = sums.kcal;
      meal.protein = sums.protein;
    }

    totalDayKcal += Number(meal.kcal) || 0;
    totalDayProtein += Number(meal.protein) || 0;
    totalDayCost += effectiveMealCost;
  });

  cloned.dailyKcal = anySwapApplied ? Math.round(totalDayKcal) : Number(dayPlan.dailyKcal) || Math.round(totalDayKcal);
  cloned.dailyProtein = anySwapApplied ? Math.round(totalDayProtein) : Number(dayPlan.dailyProtein) || Math.round(totalDayProtein);
  cloned.dailyCost = +totalDayCost.toFixed(2);
  cloned.weeklyCost = +(totalDayCost * 7).toFixed(2);

  return cloned;
}

/**
 * Applies a single ingredient swap to `gym_state`, saves to localStorage,
 * and pushes to Supabase when `isAutoSyncEnabled` is `true`.
 */
export function applyIngredientSwapToGymState(params: ApplyIngredientSwapParams): ApplyIngredientSwapResult {
  const {
    gymState,
    slotId,
    itemId,
    originalItem,
    replacement,
    isAutoSyncEnabled = false,
    storageKey = 'bws_7am_vegan_tracker_v1',
    storage = typeof localStorage !== 'undefined' ? localStorage : null,
    pushToSupabase,
    nowIso = new Date().toISOString()
  } = params;

  const swapKey = `${slotId}::${itemId}`;
  const existingSwaps =
    gymState && gymState.ingredientSwaps && typeof gymState.ingredientSwaps === 'object'
      ? { ...gymState.ingredientSwaps }
      : {};
  const priorSwap = existingSwaps[swapKey];

  const baseName = priorSwap?.swappedFromName || originalItem.swappedFromName || originalItem.label || originalItem.name;
  const baseKcal = priorSwap?.swappedFromKcal ?? (Number(originalItem.kcal) || 0);
  const baseProtein = priorSwap?.swappedFromProtein ?? (Number(originalItem.protein) || 0);
  const baseGrams = priorSwap?.swappedFromGrams ?? (Number(originalItem.grams) || 0);
  const baseCost = priorSwap?.swappedFromCost ?? estimateIngredientServingCost(originalItem);

  const deltas = computeSwapMacroDeltas(originalItem, replacement);
  const resolvedImageUrl = resolveIngredientImageUrl({
    name: replacement.name,
    imageUrl: replacement.imageUrl
  });

  const swapRecord: StoredIngredientSwap = {
    slotId,
    itemId,
    swapOptionId: replacement.id,
    name: replacement.name,
    shortName: replacement.shortName || replacement.name,
    brandTag: replacement.brandTag || '',
    weight: replacement.weight,
    grams: Number(replacement.grams) || 0,
    protein: Number(replacement.protein) || 0,
    kcal: Number(replacement.kcal) || 0,
    costPerServing: +Number(replacement.costPerServing || 0).toFixed(2),
    weeklyGroceryCost: replacement.weeklyGroceryCost,
    imageUrl: resolvedImageUrl,
    shopItemId: replacement.shopItemId || originalItem.shopItemId,
    swappedFromName: baseName,
    swappedFromKcal: baseKcal,
    swappedFromProtein: baseProtein,
    swappedFromGrams: baseGrams,
    swappedFromCost: baseCost,
    updatedAt: nowIso
  };

  existingSwaps[swapKey] = swapRecord;

  const nextShopVisuals =
    gymState && gymState.shopIngredientVisuals && typeof gymState.shopIngredientVisuals === 'object'
      ? { ...gymState.shopIngredientVisuals }
      : {};

  const nextShopBrandOverrides =
    gymState && gymState.shopBrandOverrides && typeof gymState.shopBrandOverrides === 'object'
      ? { ...gymState.shopBrandOverrides }
      : {};

  if (swapRecord.shopItemId) {
    nextShopVisuals[swapRecord.shopItemId] = {
      name: swapRecord.shortName,
      brandTag: swapRecord.brandTag,
      imageUrl: resolvedImageUrl,
      updatedAt: nowIso
    };
    if (typeof swapRecord.weeklyGroceryCost === 'number' && Number.isFinite(swapRecord.weeklyGroceryCost)) {
      nextShopBrandOverrides[swapRecord.shopItemId] = {
        brandName: swapRecord.shortName,
        weeklyPrice: +swapRecord.weeklyGroceryCost.toFixed(2),
        imageUrl: resolvedImageUrl,
        updatedAt: nowIso
      };
    }
  }

  const nextState: GymStateWithIngredientSwaps = {
    ...gymState,
    ingredientSwaps: existingSwaps,
    shopIngredientVisuals: nextShopVisuals,
    shopBrandOverrides: nextShopBrandOverrides,
    lastUpdated: nowIso
  };

  let savedToLocalStorage = false;
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(storageKey, JSON.stringify(nextState));
      savedToLocalStorage = true;
    } catch {
      savedToLocalStorage = false;
    }
  }

  let pushedToSupabase = false;
  if (isAutoSyncEnabled && typeof pushToSupabase === 'function') {
    pushToSupabase(nextState, 'ingredient_swap');
    pushedToSupabase = true;
  }

  return {
    nextState,
    swapKey,
    swapRecord,
    deltas,
    savedToLocalStorage,
    pushedToSupabase
  };
}

export interface ResetIngredientSwapParams {
  gymState: GymStateWithIngredientSwaps;
  slotId: string;
  itemId: string;
  isAutoSyncEnabled?: boolean;
  storageKey?: string;
  storage?: Pick<Storage, 'setItem'> | null;
  pushToSupabase?: (nextState: GymStateWithIngredientSwaps, reason: string) => Promise<unknown> | void;
  nowIso?: string;
}

export function resetIngredientSwapInGymState(params: ResetIngredientSwapParams): {
  nextState: GymStateWithIngredientSwaps;
  removed: boolean;
  savedToLocalStorage: boolean;
  pushedToSupabase: boolean;
} {
  const {
    gymState,
    slotId,
    itemId,
    isAutoSyncEnabled = false,
    storageKey = 'bws_7am_vegan_tracker_v1',
    storage = typeof localStorage !== 'undefined' ? localStorage : null,
    pushToSupabase,
    nowIso = new Date().toISOString()
  } = params;

  const swapKey = `${slotId}::${itemId}`;
  const existingSwaps =
    gymState && gymState.ingredientSwaps && typeof gymState.ingredientSwaps === 'object'
      ? { ...gymState.ingredientSwaps }
      : {};
  const removedRec = existingSwaps[swapKey];
  const removed = Boolean(removedRec);
  delete existingSwaps[swapKey];

  const nextShopVisuals =
    gymState && gymState.shopIngredientVisuals && typeof gymState.shopIngredientVisuals === 'object'
      ? { ...gymState.shopIngredientVisuals }
      : {};
  const nextShopBrandOverrides =
    gymState && gymState.shopBrandOverrides && typeof gymState.shopBrandOverrides === 'object'
      ? { ...gymState.shopBrandOverrides }
      : {};

  if (removedRec?.shopItemId) {
    const stillUsedByAnotherSlot = Object.values(existingSwaps).some(
      (rec) => rec && rec.shopItemId === removedRec.shopItemId
    );
    if (!stillUsedByAnotherSlot) {
      delete nextShopVisuals[removedRec.shopItemId];
      if (nextShopBrandOverrides[removedRec.shopItemId]?.brandName === removedRec.shortName) {
        delete nextShopBrandOverrides[removedRec.shopItemId];
      }
    }
  }

  const nextState: GymStateWithIngredientSwaps = {
    ...gymState,
    ingredientSwaps: existingSwaps,
    shopIngredientVisuals: nextShopVisuals,
    shopBrandOverrides: nextShopBrandOverrides,
    lastUpdated: nowIso
  };

  let savedToLocalStorage = false;
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(storageKey, JSON.stringify(nextState));
      savedToLocalStorage = true;
    } catch {
      savedToLocalStorage = false;
    }
  }

  let pushedToSupabase = false;
  if (removed && isAutoSyncEnabled && typeof pushToSupabase === 'function') {
    pushToSupabase(nextState, 'ingredient_swap_reset');
    pushedToSupabase = true;
  }

  return {
    nextState,
    removed,
    savedToLocalStorage,
    pushedToSupabase
  };
}
