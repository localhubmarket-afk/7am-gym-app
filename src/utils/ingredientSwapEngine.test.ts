import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  INGREDIENT_SWAP_CATALOG,
  PRODUCT_THUMBNAILS,
  SWAP_MODAL_TITLE,
  applyIngredientSwapToGymState,
  applyIngredientSwapsToDayPlan,
  computeSwapMacroDeltas,
  getSwapOptionsForIngredient,
  recalculateMealTotals,
  resetIngredientSwapInGymState,
  resolveIngredientImageUrl,
  type DayFuelPlanShape,
  type GymStateWithIngredientSwaps
} from './ingredientSwapEngine';

function buildSampleDayPlan(): DayFuelPlanShape {
  return {
    id: 'almond_cashew_pea',
    dailyKcal: 1325,
    dailyProtein: 139,
    meals: {
      pre_shake: {
        slotId: 'pre_shake',
        title: 'Pre-Workout Shake',
        kcal: 140,
        protein: 32,
        scaleGrams: 390,
        items: [
          { id: 'm1_pea_isolate', name: 'Naked Pea Protein Isolate (90% P)', weight: '35g', grams: 35, protein: 32, kcal: 140 },
          { id: 'm1_creatine', name: '100% Micronized Creatine Monohydrate', weight: '5g', grams: 5, protein: 0, kcal: 0 },
          { id: 'm1_silk_milk', name: 'Cold Water (Shaker Bottle)', weight: '350 ml', grams: 350, protein: 0, kcal: 0 }
        ]
      },
      post_oats: {
        slotId: 'post_oats',
        title: 'Overnight Protein Oats',
        kcal: 390,
        protein: 29,
        scaleGrams: 279,
        items: [
          { id: 'm2_oats', name: 'Gluten-Free Protein Oats', weight: '45g', grams: 45, protein: 10, kcal: 170 },
          { id: 'm2_pea_oats', name: 'Naked Pea Protein Isolate (whisked in jar)', weight: '10g', grams: 10, protein: 9, kcal: 40 },
          { id: 'm2_silk_milk', name: 'Unsweetened Fortified Almond or Cashew Milk', weight: '180 ml', grams: 180, protein: 1, kcal: 24 },
          { id: 'm2_banana', name: 'Peeled Ripe Banana (Mashed)', weight: '30g', grams: 30, protein: 0, kcal: 27 },
          { id: 'm2_pb', name: 'Smooth Natural Peanut Butter', weight: '8g', grams: 8, protein: 2, kcal: 48 },
          { id: 'm2_chia', name: 'Organic Whole Chia Seeds', weight: '6g', grams: 6, protein: 1, kcal: 30 }
        ]
      },
      lunch: {
        slotId: 'lunch',
        title: 'Tofu & Rice Bowl',
        kcal: 453,
        protein: 38,
        scaleGrams: 412,
        items: [
          { id: 'm2_tofu', name: 'Extra-Firm Tofu', weight: '175g', grams: 175, protein: 24, kcal: 180 },
          { id: 'm2_rice', name: 'Cooked White Jasmine Rice', weight: '120g', grams: 120, protein: 3, kcal: 155 },
          { id: 'm2_broccoli', name: 'Steamed Broccoli Florets', weight: '100g', grams: 100, protein: 3, kcal: 34 },
          { id: 'm2_nooch', name: 'Fortified Nutritional Yeast', weight: '10g', grams: 10, protein: 5, kcal: 40 },
          { id: 'm2_sauce', name: 'Toasted Sesame Oil', weight: '5g', grams: 5, protein: 0, kcal: 44 },
          { id: 'm2_nori', name: 'Iodized Table Salt', weight: '1.5g', grams: 1.5, protein: 0, kcal: 0 }
        ]
      },
      dinner: {
        slotId: 'dinner',
        title: 'Evening Protein Shake',
        kcal: 228,
        protein: 42,
        scaleGrams: 404,
        items: [
          { id: 'm3_pea_isolate', name: 'Naked Pea Protein Isolate (90% P)', weight: '45g', grams: 45, protein: 40, kcal: 180 },
          { id: 'm3_silk_milk', name: 'Cold Water (Shaker Bottle)', weight: '350 ml', grams: 350, protein: 0, kcal: 0 },
          { id: 'm3_pb', name: 'Smooth Natural Peanut Butter', weight: '8g', grams: 8, protein: 2, kcal: 48 },
          { id: 'm3_vitd3', name: 'Vegan Vitamin D3', weight: '1 cap', grams: 1, protein: 0, kcal: 0 }
        ]
      }
    }
  };
}

describe('Tap-to-Swap Ingredient Engine & Visual Grocery Recognition', () => {
  it('uses exact modal label "Swap Ingredient" and exposes Silk Protein Milk for plant milk swaps', () => {
    assert.equal(SWAP_MODAL_TITLE, 'Swap Ingredient');
    const options = getSwapOptionsForIngredient({
      id: 'm2_silk_milk',
      name: 'Unsweetened Fortified Almond or Cashew Milk'
    });
    assert.ok(options.length >= 4);
    assert.equal(options[0].id, 'swap_silk_protein_milk');
    assert.equal(options[0].shortName, 'Silk Protein Milk');
    assert.ok(options[0].imageUrl.startsWith('data:image/svg+xml'));
  });

  it('resolves distinct high-contrast offline-safe product thumbnails and preserves valid custom imageUrl', () => {
    const almondImg = resolveIngredientImageUrl({ name: 'Unsweetened Fortified Almond or Cashew Milk' });
    const silkImg = resolveIngredientImageUrl({ name: 'Silk Protein Milk' });
    const tofuImg = resolveIngredientImageUrl({ name: 'Extra-Firm Tofu' });
    const customImg = resolveIngredientImageUrl({
      name: 'Silk Protein Milk',
      imageUrl: 'https://cdn.example.com/silk-protein.png'
    });

    assert.equal(almondImg, PRODUCT_THUMBNAILS.almondCashewMilk);
    assert.equal(silkImg, PRODUCT_THUMBNAILS.silkProteinMilk);
    assert.equal(tofuImg, PRODUCT_THUMBNAILS.tofu);
    assert.notEqual(almondImg, silkImg);
    assert.equal(customImg, 'https://cdn.example.com/silk-protein.png');
  });

  it('swapping Almond Milk -> Silk Protein Milk recalculates meal AND full-day calories, protein, and cost', () => {
    const basePlan = buildSampleDayPlan();
    const originalMilk = basePlan.meals.post_oats.items.find((i) => i.id === 'm2_silk_milk')!;
    const silkOption = INGREDIENT_SWAP_CATALOG.find((o) => o.id === 'swap_silk_protein_milk')!;
    assert.ok(silkOption);

    const deltas = computeSwapMacroDeltas(originalMilk, silkOption);
    assert.equal(deltas.proteinDelta, 14);
    assert.equal(deltas.kcalDelta, 71);
    assert.equal(deltas.costDelta, 0.36);

    const storageMap = new Map<string, string>();
    const fakeStorage = {
      setItem: (k: string, v: string) => {
        storageMap.set(k, v);
      }
    };
    const pushedCalls: Array<{ state: GymStateWithIngredientSwaps; reason: string }> = [];

    const initialGymState: GymStateWithIngredientSwaps = {
      ingredientSwaps: {},
      shopBrandOverrides: {},
      shopIngredientVisuals: {}
    };

    const swapRes = applyIngredientSwapToGymState({
      gymState: initialGymState,
      slotId: 'post_oats',
      itemId: 'm2_silk_milk',
      originalItem: originalMilk,
      replacement: silkOption,
      isAutoSyncEnabled: true,
      storage: fakeStorage,
      pushToSupabase: (nextState, reason) => {
        pushedCalls.push({ state: nextState, reason });
      },
      nowIso: '2026-11-25T12:00:00.000Z'
    });

    assert.equal(swapRes.savedToLocalStorage, true);
    assert.equal(swapRes.pushedToSupabase, true);
    assert.equal(pushedCalls.length, 1);
    assert.equal(pushedCalls[0].reason, 'ingredient_swap');
    assert.ok(storageMap.size === 1);
    assert.equal(swapRes.nextState.shopIngredientVisuals?.shop_silk?.name, 'Silk Protein Milk');
    assert.equal(swapRes.nextState.shopIngredientVisuals?.shop_silk?.imageUrl, PRODUCT_THUMBNAILS.silkProteinMilk);
    assert.equal(swapRes.nextState.shopBrandOverrides?.shop_silk?.weeklyPrice, 5.74);

    // Recalculate full day plan
    const beforeTotals = applyIngredientSwapsToDayPlan(basePlan, {});
    const afterTotals = applyIngredientSwapsToDayPlan(basePlan, swapRes.nextState.ingredientSwaps);

    const swappedMilkItem = afterTotals.meals.post_oats.items.find((i) => i.id === 'm2_silk_milk')!;
    assert.equal(swappedMilkItem.name, 'Silk Protein Milk (Original / Unsweetened)');
    assert.equal(swappedMilkItem.imageUrl, PRODUCT_THUMBNAILS.silkProteinMilk);
    assert.equal(swappedMilkItem.isSwapped, true);

    // Meal totals updated
    assert.equal(afterTotals.meals.post_oats.protein, recalculateMealTotals(afterTotals.meals.post_oats.items).protein);
    assert.equal(afterTotals.meals.post_oats.kcal, recalculateMealTotals(afterTotals.meals.post_oats.items).kcal);
    assert.equal(afterTotals.meals.post_oats.mealCost, +(1.37 + 0.36).toFixed(2));

    // Full-day totals updated
    assert.equal(afterTotals.dailyCost, +((beforeTotals.dailyCost || 6.35) + 0.36).toFixed(2));
    assert.equal(
      afterTotals.dailyProtein,
      afterTotals.meals.pre_shake.protein +
        afterTotals.meals.post_oats.protein +
        afterTotals.meals.lunch.protein +
        afterTotals.meals.dinner.protein
    );
    assert.equal(
      afterTotals.dailyKcal,
      afterTotals.meals.pre_shake.kcal +
        afterTotals.meals.post_oats.kcal +
        afterTotals.meals.lunch.kcal +
        afterTotals.meals.dinner.kcal
    );
  });

  it('skips Supabase push when isAutoSyncEnabled is false, and cleanly resets swaps back to original', () => {
    const basePlan = buildSampleDayPlan();
    const originalMilk = basePlan.meals.post_oats.items.find((i) => i.id === 'm2_silk_milk')!;
    const silkOption = INGREDIENT_SWAP_CATALOG.find((o) => o.id === 'swap_silk_protein_milk')!;

    let pushCount = 0;
    const swapRes = applyIngredientSwapToGymState({
      gymState: {},
      slotId: 'post_oats',
      itemId: 'm2_silk_milk',
      originalItem: originalMilk,
      replacement: silkOption,
      isAutoSyncEnabled: false,
      storage: null,
      pushToSupabase: () => {
        pushCount++;
      }
    });

    assert.equal(swapRes.pushedToSupabase, false);
    assert.equal(pushCount, 0);

    const resetRes = resetIngredientSwapInGymState({
      gymState: swapRes.nextState,
      slotId: 'post_oats',
      itemId: 'm2_silk_milk',
      isAutoSyncEnabled: true,
      storage: null,
      pushToSupabase: () => {
        pushCount++;
      }
    });

    assert.equal(resetRes.removed, true);
    assert.equal(resetRes.pushedToSupabase, true);
    assert.equal(pushCount, 1);
    assert.equal(resetRes.nextState.ingredientSwaps?.['post_oats::m2_silk_milk'], undefined);
    assert.equal(resetRes.nextState.shopIngredientVisuals?.shop_silk, undefined);
  });

  it('Zero Deletion Policy: index.html preserves existing Fuel & Shop controls alongside Tap-to-Swap & thumbnails', () => {
    const htmlPath = path.resolve(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // New Tap-to-Swap + visual recognition markers
    assert.ok(html.includes('tap-to-swap-ingredient-btn'), 'Fuel tab must render clickable tap-to-swap ingredient buttons');
    assert.ok(html.includes('id="swap-ingredient-modal-root"'), 'SwapIngredientModal mount root must exist in index.html');
    assert.ok(html.includes('data-shop-item-thumb='), 'Shop tab must render visual product thumbnails next to grocery items');
    assert.ok(html.includes('applyIngredientSwapsToDayPlan'), 'getEffectiveDayFuelPlan must apply Tap-to-Swap recalculations');

    // Existing controls strictly preserved
    assert.ok(html.includes('meal-check-btn'), 'Existing meal log button must remain intact');
    assert.ok(html.includes('meal-ing-check-btn'), 'Existing ingredient checklist buttons must remain intact');
    assert.ok(html.includes('fuel-card-toggle-btn'), 'Existing Read Full Math drawer must remain intact');
    assert.ok(html.includes('flex-food-snap-btn'), 'Existing Snap Food or Menu button must remain intact');
    assert.ok(html.includes('shop-brand-swap-btn'), 'Existing Shop Swap Brand/Quality button must remain intact');
    assert.ok(html.includes('shop-item-details-toggle-btn'), 'Existing Shop Read Full Math button must remain intact');
  });
});
