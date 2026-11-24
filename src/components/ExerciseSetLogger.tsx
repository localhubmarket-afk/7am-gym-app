import React, { useRef, useState } from 'react';
import {
  validateLoggedReps,
  validateLoggedWeight,
  type ValidationLimits
} from '../utils/inputValidation';
import { withStableViewportScroll } from '../utils/viewportStability';

export interface ExerciseSetLoggerProps {
  cardId: string;
  exerciseName: string;
  setNumber: number;
  unit?: 'lbs' | 'kg';
  initialWeight?: string;
  initialReps?: string;
  isDone?: boolean;
  validationLimits?: Partial<ValidationLimits>;
  onLogSet: (payload: { weight: number; reps: number; done: boolean }) => void;
}

/**
 * Task 3 & Task 4: Viewport-Stable, Validated Exercise Set Logger
 * - Keeps the screen strictly anchored in place when logging a set (zero involuntary scroll jumps).
 * - Strictly validates weight and rep bounds with ELI12 error alerts before saving.
 * - WCAG 2.2 / COGA compliant: >= 48x48px touch targets, rem typography, role="alert" inline feedback.
 */
export const ExerciseSetLogger: React.FC<ExerciseSetLoggerProps> = ({
  cardId,
  exerciseName,
  setNumber,
  unit = 'lbs',
  initialWeight = '',
  initialReps = '',
  isDone = false,
  validationLimits,
  onLogSet
}) => {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [weightText, setWeightText] = useState(initialWeight);
  const [repsText, setRepsText] = useState(initialReps);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleToggleLog = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const nextDone = !isDone;

    if (nextDone) {
      const weightCheck = validateLoggedWeight(weightText, unit, validationLimits);
      if (!weightCheck.valid || weightCheck.numericValue === null) {
        setErrorMessage(weightCheck.errorMessage);
        return;
      }

      const repsCheck = validateLoggedReps(repsText, validationLimits);
      if (!repsCheck.valid || repsCheck.numericValue === null) {
        setErrorMessage(repsCheck.errorMessage);
        return;
      }

      setErrorMessage(null);
      setWeightText(weightCheck.sanitizedValue);
      setRepsText(repsCheck.sanitizedValue);

      const anchorEl =
        typeof document !== 'undefined' ? document.getElementById(cardId) || rowRef.current : rowRef.current;

      withStableViewportScroll(anchorEl, () => {
        onLogSet({
          weight: weightCheck.numericValue as number,
          reps: repsCheck.numericValue as number,
          done: true
        });
      });
      return;
    }

    setErrorMessage(null);
    const anchorEl =
      typeof document !== 'undefined' ? document.getElementById(cardId) || rowRef.current : rowRef.current;

    withStableViewportScroll(anchorEl, () => {
      onLogSet({
        weight: Number(weightText) || 0,
        reps: Number(repsText) || 1,
        done: false
      });
    });
  };

  return (
    <div
      ref={rowRef}
      id={`${cardId}-set-${setNumber}`}
      className="rounded-xl border border-slate-700 bg-slate-900 p-3 space-y-2 text-left"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-slate-200">
          {exerciseName} • Set {setNumber}
        </span>
        <span className="text-xs font-bold text-slate-300">
          {isDone ? 'Saved' : 'Ready to log'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex-1 min-w-[6rem] space-y-1">
          <span className="block text-xs font-bold text-slate-300">Weight ({unit})</span>
          <input
            type="text"
            inputMode="decimal"
            value={weightText}
            onChange={(e) => {
              setWeightText(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            aria-label={`Set ${setNumber} weight in ${unit}`}
            className="w-full min-h-[48px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
          />
        </label>

        <label className="flex-1 min-w-[5rem] space-y-1">
          <span className="block text-xs font-bold text-slate-300">Reps</span>
          <input
            type="text"
            inputMode="numeric"
            value={repsText}
            onChange={(e) => {
              setRepsText(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            aria-label={`Set ${setNumber} reps`}
            className="w-full min-h-[48px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
          />
        </label>

        <button
          type="button"
          onClick={handleToggleLog}
          aria-pressed={isDone}
          className={`min-h-[48px] min-w-[96px] px-4 py-2 rounded-xl text-sm font-extrabold transition ${
            isDone
              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
          }`}
        >
          {isDone ? '✓ Logged' : 'Log Set'}
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-amber-400/70 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 leading-relaxed"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default ExerciseSetLogger;
