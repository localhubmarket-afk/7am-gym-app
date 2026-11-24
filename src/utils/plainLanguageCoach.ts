/**
 * Phase 2 — Task 2: Plain-Language Coach (Bounded LLM Explainer)
 *
 * CRITICAL GUARDRAIL:
 * The LLM NEVER calculates, rounds, or alters progression math. It receives ONLY
 * the already-computed, immutable output of the deterministic Double Progression
 * engine and translates it into Grade 6-8 plain language via server-side Gemini.
 */

import type { DoubleProgressionResult } from './doubleProgressionEngine';
import type { ExplainableMathBreakdown } from './explainableMath';

export interface BoundedProgressionMathSnapshot {
  exerciseName: string;
  action: 'increase_weight' | 'increase_reps' | 'hold_and_build' | 'start_baseline';
  previousWeight: number | null;
  previousReps: number | null;
  previousCompletedSets: number;
  targetSets: number;
  minReps: number;
  maxReps: number;
  nextTargetWeight: number;
  nextTargetReps: number;
  weightDelta: number;
  unit: 'lbs' | 'kg';
  biometricSleepHours?: number | null;
  biometricRestingHrBpm?: number | null;
  deterministicSummary: string;
  formulaSteps: string[];
}

export interface PlainLanguageCoachResponse {
  ok: boolean;
  model: string | null;
  plainLanguageExplanation: string | null;
  keyTakeaway: string | null;
  lockedMathSnapshot: BoundedProgressionMathSnapshot;
  mathWasAltered: false;
  error?: string;
}

export const PLAIN_LANGUAGE_COACH_SYSTEM_INSTRUCTION = [
  'You are a friendly, calm fitness coach explaining workout math to a neurodivergent user.',
  'STRICT RULES:',
  '1. Write at a Grade 6 to 8 reading level. Use short, clear sentences and everyday words.',
  '2. NEVER calculate new numbers, NEVER suggest a different weight, NEVER suggest different reps or sets.',
  '3. Only explain the exact deterministic math values provided in the JSON input.',
  '4. Keep the explanation to 2 or 3 short sentences, plus 1 short takeaway line.',
  '5. Never use guilt, shame, streaks, or fitness jargon like "periodization", "RPE", "hypertrophy", or "progressive overload".'
].join('\n');

/**
 * Freezes a deterministic DoubleProgressionResult (and optional ExplainableMathBreakdown)
 * into a read-only snapshot safe to send to the bounded Gemini endpoint.
 */
export function buildBoundedProgressionSnapshot(
  progression: DoubleProgressionResult,
  breakdown?: ExplainableMathBreakdown | null,
  biometrics?: { sleepHours?: number | null; restingHeartRateBpm?: number | null } | null
): Readonly<BoundedProgressionMathSnapshot> {
  const snapshot: BoundedProgressionMathSnapshot = {
    exerciseName: String(progression.exerciseName || 'Exercise').slice(0, 80),
    action: progression.action,
    previousWeight: progression.previousWeight,
    previousReps: progression.previousMinRepsHit,
    previousCompletedSets: progression.previousCompletedSets,
    targetSets: progression.targetSets,
    minReps: progression.minReps,
    maxReps: progression.maxReps,
    nextTargetWeight: progression.nextTargetWeight,
    nextTargetReps: progression.nextTargetReps,
    weightDelta: progression.weightDelta,
    unit: progression.unit,
    biometricSleepHours:
      typeof biometrics?.sleepHours === 'number' && Number.isFinite(biometrics.sleepHours)
        ? biometrics.sleepHours
        : null,
    biometricRestingHrBpm:
      typeof biometrics?.restingHeartRateBpm === 'number' && Number.isFinite(biometrics.restingHeartRateBpm)
        ? biometrics.restingHeartRateBpm
        : null,
    deterministicSummary:
      (breakdown && breakdown.plainEnglishExplanation) || progression.plainEnglishSummary,
    formulaSteps: Array.isArray(breakdown?.formulaSteps)
      ? breakdown.formulaSteps.slice(0, 6)
      : [progression.plainEnglishSummary]
  };
  return Object.freeze(snapshot);
}

/**
 * Calls the server-side Gemini endpoint (/api/gemini/coach-explain) so the API key
 * never touches the browser. Never modifies the deterministic math snapshot.
 */
export async function requestPlainLanguageCoachExplanation(
  snapshot: Readonly<BoundedProgressionMathSnapshot>,
  options?: {
    endpoint?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<PlainLanguageCoachResponse> {
  const fetchFn = options?.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const endpoint = options?.endpoint || '/api/gemini/coach-explain';

  if (!fetchFn) {
    return {
      ok: false,
      model: null,
      plainLanguageExplanation: null,
      keyTakeaway: null,
      lockedMathSnapshot: snapshot,
      mathWasAltered: false,
      error: 'Network request tool is not available.'
    };
  }

  try {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'coach_explain',
        mathSnapshot: snapshot
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data || data.ok === false) {
      return {
        ok: false,
        model: data?.model || null,
        plainLanguageExplanation: null,
        keyTakeaway: null,
        lockedMathSnapshot: snapshot,
        mathWasAltered: false,
        error:
          (typeof data?.error === 'string' && data.error) ||
          'Could not reach the Plain-Language Coach right now.'
      };
    }

    const explanation =
      typeof data.explanation === 'string' && data.explanation.trim()
        ? data.explanation.trim()
        : typeof data.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : null;

    if (!explanation) {
      return {
        ok: false,
        model: data?.model || null,
        plainLanguageExplanation: null,
        keyTakeaway: null,
        lockedMathSnapshot: snapshot,
        mathWasAltered: false,
        error: data?.error || 'The coach did not return text. Your exact math numbers are still shown below.'
      };
    }

    return {
      ok: true,
      model: typeof data.model === 'string' ? data.model : 'gemini-4-hydrogen',
      plainLanguageExplanation: explanation,
      keyTakeaway:
        typeof data.keyTakeaway === 'string' && data.keyTakeaway.trim()
          ? data.keyTakeaway.trim()
          : null,
      lockedMathSnapshot: snapshot,
      mathWasAltered: false
    };
  } catch (err) {
    return {
      ok: false,
      model: null,
      plainLanguageExplanation: null,
      keyTakeaway: null,
      lockedMathSnapshot: snapshot,
      mathWasAltered: false,
      error: err instanceof Error ? err.message : 'Network error contacting Plain-Language Coach.'
    };
  }
}
