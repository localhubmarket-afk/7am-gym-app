import React, { useState } from 'react';
import {
  applyIngredientSwapToGymState,
  resetIngredientSwapInGymState,
  resolveIngredientImageUrl,
  type GymStateWithIngredientSwaps,
  type MealIngredientItem,
  type MealSlotPlanShape,
  type SwapIngredientOption
} from '../utils/ingredientSwapEngine';
import { SwapIngredientModal } from './SwapIngredientModal';

export interface MealIngredientSwapListProps {
  meal: MealSlotPlanShape;
  gymState: GymStateWithIngredientSwaps;
  isAutoSyncEnabled?: boolean;
  onGymStateUpdated: (nextState: GymStateWithIngredientSwaps, toastMessage: string) => void;
  pushToSupabase?: (nextState: GymStateWithIngredientSwaps, reason: string) => Promise<unknown> | void;
}

/**
 * Reusable accessible Meal Display component with clickable Tap-to-Swap
 * ingredient rows (>=48x48px touch targets) and visual product thumbnails.
 */
export const MealIngredientSwapList: React.FC<MealIngredientSwapListProps> = ({
  meal,
  gymState,
  isAutoSyncEnabled = false,
  onGymStateUpdated,
  pushToSupabase
}) => {
  const [activeIngredient, setActiveIngredient] = useState<MealIngredientItem | null>(null);

  const handleSelectReplacement = (option: SwapIngredientOption) => {
    if (!activeIngredient) return;
    const result = applyIngredientSwapToGymState({
      gymState,
      slotId: meal.slotId,
      itemId: activeIngredient.id,
      originalItem: activeIngredient,
      replacement: option,
      isAutoSyncEnabled,
      pushToSupabase
    });
    setActiveIngredient(null);
    onGymStateUpdated(
      result.nextState,
      `Swapped to ${option.shortName}. Calories, protein, and cost updated.`
    );
  };

  const handleReset = () => {
    if (!activeIngredient) return;
    const result = resetIngredientSwapInGymState({
      gymState,
      slotId: meal.slotId,
      itemId: activeIngredient.id,
      isAutoSyncEnabled,
      pushToSupabase
    });
    setActiveIngredient(null);
    onGymStateUpdated(result.nextState, 'Switched back to your original ingredient.');
  };

  return (
    <section
      aria-label={`${meal.title || meal.slotId} ingredients`}
      className="rounded-2xl border border-slate-700 bg-slate-900 p-3.5 space-y-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-white">{meal.title || meal.slotId}</h3>
          <p className="text-xs font-extrabold text-amber-300">
            {meal.kcal} Calories | {meal.protein}g Protein
            {typeof meal.mealCost === 'number' ? ` | $${meal.mealCost.toFixed(2)} / meal` : ''}
          </p>
        </div>
        <span className="text-xs font-bold text-slate-300">Tap any food to swap</span>
      </div>

      <div className="space-y-2">
        {(meal.items || []).map((item) => {
          const thumbUrl = resolveIngredientImageUrl(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIngredient(item)}
              aria-label={`Swap ${item.label || item.name}, ${item.weight}, ${item.kcal} calories, ${item.protein} grams protein`}
              className="w-full min-h-[56px] text-left rounded-xl border border-slate-700 hover:border-emerald-400 bg-slate-950/90 hover:bg-slate-800/90 px-3 py-2 flex items-center justify-between gap-3 transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img
                  src={thumbUrl}
                  alt=""
                  aria-hidden="true"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-lg border border-slate-700 object-cover shrink-0 bg-slate-900"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white leading-snug break-words">
                    {item.label || item.name}
                  </div>
                  <div className="text-xs font-semibold text-slate-300">
                    {item.weight} • {item.kcal} kcal • {item.protein}g P
                  </div>
                </div>
              </div>
              <span className="shrink-0 min-h-[44px] px-3 py-1.5 rounded-lg border border-emerald-400/60 bg-emerald-500/15 text-emerald-200 text-xs font-extrabold inline-flex items-center">
                Swap ⇄
              </span>
            </button>
          );
        })}
      </div>

      <SwapIngredientModal
        isOpen={Boolean(activeIngredient)}
        mealTitle={meal.title || meal.slotId}
        slotId={meal.slotId}
        ingredient={activeIngredient}
        onSelectReplacement={handleSelectReplacement}
        onResetToOriginal={activeIngredient?.isSwapped ? handleReset : undefined}
        onClose={() => setActiveIngredient(null)}
      />
    </section>
  );
};

export default MealIngredientSwapList;
