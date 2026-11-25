import React, { useEffect, useState } from 'react';
import {
  SWAP_MODAL_TITLE,
  computeSwapMacroDeltas,
  estimateIngredientServingCost,
  getSwapOptionsForIngredient,
  resolveIngredientImageUrl,
  type MealIngredientItem,
  type SwapIngredientOption
} from '../utils/ingredientSwapEngine';

export interface SwapIngredientModalProps {
  isOpen: boolean;
  mealTitle: string;
  slotId: string;
  ingredient: MealIngredientItem | null;
  onSelectReplacement: (option: SwapIngredientOption) => void;
  onResetToOriginal?: () => void;
  onClose: () => void;
}

function formatSignedDelta(value: number, unit: string, zeroLabel?: string): string {
  if (value === 0) return zeroLabel || `Same ${unit.trim()}`;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${unit}`;
}

function formatSignedCost(delta: number): string {
  if (Math.abs(delta) < 0.005) return 'Same cost';
  const sign = delta > 0 ? '+' : '-';
  return `${sign}$${Math.abs(delta).toFixed(2)}/day`;
}

export const SwapIngredientModal: React.FC<SwapIngredientModalProps> = ({
  isOpen,
  mealTitle,
  ingredient,
  onSelectReplacement,
  onResetToOriginal,
  onClose
}) => {
  const [showAllFoods, setShowAllFoods] = useState(false);

  useEffect(() => {
    setShowAllFoods(false);
  }, [ingredient?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !ingredient) {
    return null;
  }

  const options = getSwapOptionsForIngredient(ingredient, showAllFoods);
  const currentImageUrl = resolveIngredientImageUrl(ingredient);
  const currentCost = estimateIngredientServingCost(ingredient);

  return (
    <div
      id="swap-ingredient-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="swap-ingredient-modal-title"
      aria-describedby="swap-ingredient-modal-desc"
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm p-2 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md max-h-[88vh] flex flex-col rounded-2xl border-2 border-emerald-500/60 bg-slate-900 text-slate-50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950/90">
          <div className="min-w-0">
            <h2
              id="swap-ingredient-modal-title"
              className="text-base font-extrabold text-white tracking-tight"
            >
              {SWAP_MODAL_TITLE}
            </h2>
            <p className="text-xs font-semibold text-emerald-300 truncate">{mealTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Swap Ingredient modal"
            className="min-h-[48px] min-w-[48px] shrink-0 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-extrabold flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
          >
            ✕
          </button>
        </div>

        {/* ELI12 Guidance + Current Item Card */}
        <div className="px-4 pt-3 pb-2 space-y-2.5 border-b border-slate-800 bg-slate-900/95">
          <ul
            id="swap-ingredient-modal-desc"
            className="list-disc pl-5 space-y-0.5 text-xs text-slate-200 leading-relaxed"
          >
            <li>Tap a new food below to swap it right away.</li>
            <li>Your calories, protein, and cost update for you.</li>
          </ul>

          <div className="rounded-xl border border-slate-700 bg-slate-950/90 p-2.5 flex items-center gap-3">
            <img
              src={currentImageUrl}
              alt={ingredient.label || ingredient.name}
              width={48}
              height={48}
              className="w-12 h-12 rounded-xl border border-slate-700 object-cover shrink-0 bg-slate-900"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[0.6875rem] font-extrabold uppercase tracking-wider text-slate-400">
                Right Now
              </div>
              <div className="text-sm font-bold text-white leading-snug break-words">
                {ingredient.label || ingredient.name}
              </div>
              <div className="text-xs font-semibold text-amber-300 mt-0.5">
                {ingredient.weight} • {ingredient.kcal} kcal • {ingredient.protein}g protein • ${currentCost.toFixed(2)}
              </div>
            </div>
          </div>

          {ingredient.isSwapped && typeof onResetToOriginal === 'function' && (
            <button
              type="button"
              onClick={onResetToOriginal}
              data-swap-reset-btn="true"
              className="w-full min-h-[48px] px-3 py-2 rounded-xl border border-amber-400/60 bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 text-xs font-extrabold text-center focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
            >
              ↺ Switch Back to Original ({ingredient.swappedFromName || 'Plan Default'})
            </button>
          )}
        </div>

        {/* Scrollable Predefined Swaps */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              {showAllFoods ? 'All Foods' : 'Best Swaps'}
            </span>
            <button
              type="button"
              onClick={() => setShowAllFoods((prev) => !prev)}
              className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sky-200 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
            >
              {showAllFoods ? 'Show Best Matches' : 'See All Foods'}
            </button>
          </div>

          <div className="space-y-2" role="list" aria-label="Replacement ingredient choices">
            {options.map((opt) => {
              const deltas = computeSwapMacroDeltas(ingredient, opt);
              const isCurrentChoice =
                ingredient.swapOptionId === opt.id ||
                (ingredient.name || '').trim().toLowerCase() === opt.name.trim().toLowerCase();

              return (
                <button
                  key={opt.id}
                  type="button"
                  data-swap-option-id={opt.id}
                  onClick={() => onSelectReplacement(opt)}
                  className={`w-full min-h-[72px] text-left rounded-xl border p-3 flex items-start gap-3 transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                    isCurrentChoice
                      ? 'bg-emerald-950/60 border-emerald-400 text-white'
                      : 'bg-slate-950/90 hover:bg-slate-800/95 border-slate-700 hover:border-emerald-400/70 text-slate-100'
                  }`}
                >
                  <img
                    src={opt.imageUrl}
                    alt={opt.shortName}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-xl border border-slate-700 object-cover shrink-0 bg-slate-900 mt-0.5"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-extrabold text-white leading-snug break-words">
                        {opt.shortName}
                      </span>
                      <span className="shrink-0 text-[0.6875rem] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 whitespace-nowrap">
                        {isCurrentChoice ? '✓ Active' : opt.weight}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-snug">{opt.shortNote}</p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[0.6875rem] font-extrabold px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-100 whitespace-nowrap">
                        {opt.kcal} kcal • {opt.protein}g P
                      </span>
                      <span
                        className={`text-[0.6875rem] font-extrabold px-2 py-0.5 rounded-md border whitespace-nowrap ${
                          deltas.proteinDelta > 0
                            ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                            : deltas.proteinDelta < 0
                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {formatSignedDelta(deltas.proteinDelta, 'g protein', 'Same protein')}
                      </span>
                      <span className="text-[0.6875rem] font-extrabold px-2 py-0.5 rounded-md bg-sky-950/80 border border-sky-400/50 text-sky-200 whitespace-nowrap">
                        {formatSignedDelta(deltas.kcalDelta, ' kcal')}
                      </span>
                      <span className="text-[0.6875rem] font-extrabold px-2 py-0.5 rounded-md bg-amber-950/70 border border-amber-400/50 text-amber-200 whitespace-nowrap">
                        {formatSignedCost(deltas.costDelta)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/90">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapIngredientModal;
