export interface ExplainableMathInput {
  exerciseName: string;
  currentWeek: number;
  targetSets: number;
  targetRepsLabel: string;
  targetWeight: number;
  unit: 'lbs' | 'kg';
  previousWeight?: number | null;
  previousReps?: number | null;
  completedAllPreviousReps?: boolean;
  isBodyweight?: boolean;
  biometricSleepHours?: number | null;
  biometricVolumeScale?: number;
}

export interface ExplainableMathBreakdown {
  exerciseName: string;
  headline: string;
  plainEnglishExplanation: string;
  formulaSteps: string[];
  previousSummary: string;
  prescribedSummary: string;
  incrementApplied: number;
  unit: 'lbs' | 'kg';
}

function parseMinTargetReps(repsLabel: string): number {
  const m = String(repsLabel || '').match(/(\d+)/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 8;
}

export function computeExplainableProgressionMath(
  input: ExplainableMathInput
): ExplainableMathBreakdown {
  const unit = input.unit === 'kg' ? 'kg' : 'lbs';
  const targetSets = Math.max(1, Math.floor(Number(input.targetSets) || 3));
  const targetWeight = Math.max(0, Number(input.targetWeight) || 0);
  const minReps = parseMinTargetReps(input.targetRepsLabel);
  const prevW = typeof input.previousWeight === 'number' && input.previousWeight > 0 ? input.previousWeight : null;
  const prevR = typeof input.previousReps === 'number' && input.previousReps > 0 ? input.previousReps : null;
  const standardStep = unit === 'kg' ? 2.5 : 5;
  const steps: string[] = [];

  if (input.isBodyweight || targetWeight === 0) {
    const repsPhrase = /\brep/i.test(String(input.targetRepsLabel || ''))
      ? String(input.targetRepsLabel)
      : `${input.targetRepsLabel} reps`;
    const prevText = prevR ? `Last time you did ${prevR} reps.` : 'No past logs yet. Starting with your baseline reps.';
    const nextReps = prevR && input.completedAllPreviousReps ? prevR + 1 : minReps;
    const plain = prevR
      ? `Last time you did ${prevR} reps. ${input.completedAllPreviousReps ? 'Target increased by +1 rep because you finished every set cleanly.' : 'Keep this target until all sets feel strong.'}`
      : `Starting target is ${targetSets} sets of ${repsPhrase}. Add +1 rep next week once you complete all sets.`;

    steps.push(`Baseline plan: ${targetSets} sets × ${repsPhrase}.`);
    if (prevR) {
      steps.push(`Previous logged set: ${prevR} reps.`);
      steps.push(
        input.completedAllPreviousReps
          ? `Progression rule: +1 rep (${prevR} + 1 = ${nextReps} reps).`
          : `Progression rule: Hold at ${minReps} reps until every set is logged.`
      );
    }
    if (typeof input.biometricSleepHours === 'number' && input.biometricSleepHours < 5) {
      steps.push(`Sleep recovery guard: ${input.biometricSleepHours.toFixed(1)}h sleep (< 5h) -> volume lowered by 10%.`);
    }

    return {
      exerciseName: input.exerciseName,
      headline: `Why ${targetSets} sets × ${input.targetRepsLabel}?`,
      plainEnglishExplanation: plain,
      formulaSteps: steps,
      previousSummary: prevText,
      prescribedSummary: `${targetSets} sets × ${input.targetRepsLabel} (Bodyweight)`,
      incrementApplied: input.completedAllPreviousReps ? 1 : 0,
      unit
    };
  }

  let increment = 0;
  let plainEnglishExplanation = '';
  let previousSummary = 'No previous week logged yet.';

  if (prevW !== null && prevR !== null) {
    previousSummary = `Last week you did ${prevW} ${unit} for ${prevR} reps.`;
    const diff = Math.round((targetWeight - prevW) * 10) / 10;
    if (diff > 0 || input.completedAllPreviousReps) {
      increment = diff > 0 ? diff : standardStep;
      const prescribedW = diff > 0 ? targetWeight : prevW + increment;
      plainEnglishExplanation = `Last week you did ${prevW}${unit} for ${prevR} reps. Target increased by ${increment}${unit} due to completing all reps.`;
      steps.push(`Last week's weight: ${prevW} ${unit} × ${prevR} reps.`);
      steps.push(`Rule: Hit all reps -> add +${increment} ${unit}.`);
      steps.push(`Math: ${prevW} + ${increment} = ${prescribedW} ${unit}.`);
    } else if (diff < 0) {
      increment = diff;
      plainEnglishExplanation = `Last week you did ${prevW}${unit} for ${prevR} reps. Target lowered by ${Math.abs(diff)}${unit} to help you hit clean form on every rep.`;
      steps.push(`Last week's weight: ${prevW} ${unit} × ${prevR} reps.`);
      steps.push(`Rule: Reset weight by ${diff} ${unit} for clean reps.`);
      steps.push(`Math: ${prevW} - ${Math.abs(diff)} = ${targetWeight} ${unit}.`);
    } else {
      plainEnglishExplanation = `Last week you did ${prevW}${unit} for ${prevR} reps. Keep ${targetWeight}${unit} today and aim to finish all ${input.targetRepsLabel} reps.`;
      steps.push(`Last week's weight: ${prevW} ${unit} × ${prevR} reps.`);
      steps.push(`Rule: Hold weight (+0 ${unit}) until every set hits target reps.`);
      steps.push(`Math: ${prevW} + 0 = ${targetWeight} ${unit}.`);
    }
  } else {
    plainEnglishExplanation = `Starting weight is ${targetWeight}${unit} for ${input.targetRepsLabel} reps. Once you complete all ${targetSets} sets cleanly, your next target goes up by +${standardStep}${unit}.`;
    steps.push(`Starting weight from your plan: ${targetWeight} ${unit}.`);
    steps.push(`Next-week trigger: Complete ${targetSets} sets × ${input.targetRepsLabel} reps -> +${standardStep} ${unit}.`);
  }

  if (typeof input.biometricSleepHours === 'number' && input.biometricSleepHours < 5) {
    steps.push(
      `Sleep check: ${input.biometricSleepHours.toFixed(1)}h sleep (< 5h) -> total sets reduced by 10% for safety.`
    );
  }

  return {
    exerciseName: input.exerciseName,
    headline: `Why ${targetWeight} ${unit} × ${input.targetRepsLabel}?`,
    plainEnglishExplanation,
    formulaSteps: steps,
    previousSummary,
    prescribedSummary: `${targetSets} sets × ${input.targetRepsLabel} at ${targetWeight} ${unit}`,
    incrementApplied: increment,
    unit
  };
}
