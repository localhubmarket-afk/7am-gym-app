/**
 * Phase 2 — Task 3: "Low-Spoons" Triage System
 *
 * Uses server-side Gemini strictly as a classifier to categorize daily fatigue or
 * sensory overload into a fixed enum. Every classification maps strictly to a
 * pre-validated, deterministic scaling preset — the LLM never writes arbitrary
 * set counts, weights, or unverified exercises.
 */

export type LowSpoonsSeverityTier =
  | 'normal_energy'
  | 'mild_fatigue'
  | 'high_fatigue_or_overload'
  | 'severe_sensory_overload';

export type LowSpoonsPresetId =
  | 'full_capacity'
  | 'volume_trim_20'
  | 'calm_machines_20'
  | 'micro_recovery_40';

export interface LowSpoonsScalingPreset {
  presetId: LowSpoonsPresetId;
  severityTier: LowSpoonsSeverityTier;
  title: string;
  badgeLabel: string;
  volumeReductionPercent: number;
  volumeMultiplier: number;
  swapBarbellToMachines: boolean;
  recommendSensoryCalmMode: boolean;
  grade6Summary: string;
  actionBullets: string[];
}

export interface LowSpoonsExerciseLike {
  id: string;
  name: string;
  sets: number;
  reps?: string;
  isCardio?: boolean;
  [key: string]: any;
}

export interface LowSpoonsAppliedExerciseChange {
  exerciseId: string;
  originalName: string;
  updatedName: string;
  originalSets: number;
  updatedSets: number;
  swappedToMachine: boolean;
}

export interface LowSpoonsTriageResult {
  ok: boolean;
  severityTier: LowSpoonsSeverityTier;
  preset: LowSpoonsScalingPreset;
  coachReassurance: string | null;
  model: string | null;
  error?: string;
}

/**
 * Pre-validated, deterministic scaling presets.
 * The LLM output is strictly mapped to one of these four keys.
 */
export const LOW_SPOONS_PRESETS: Readonly<Record<LowSpoonsSeverityTier, LowSpoonsScalingPreset>> =
  Object.freeze({
    normal_energy: {
      presetId: 'full_capacity',
      severityTier: 'normal_energy',
      title: 'Steady Plan (100% Volume)',
      badgeLabel: '100% Plan',
      volumeReductionPercent: 0,
      volumeMultiplier: 1.0,
      swapBarbellToMachines: false,
      recommendSensoryCalmMode: false,
      grade6Summary: 'Your energy sounds steady today. You can follow your normal plan at your own pace.',
      actionBullets: [
        'Keep 100% of your planned sets.',
        'Keep your normal exercises.',
        'Take extra rest anytime you need it.'
      ]
    },
    mild_fatigue: {
      presetId: 'volume_trim_20',
      severityTier: 'mild_fatigue',
      title: 'Lighter Volume (-20% Sets)',
      badgeLabel: '-20% Sets',
      volumeReductionPercent: 20,
      volumeMultiplier: 0.8,
      swapBarbellToMachines: false,
      recommendSensoryCalmMode: false,
      grade6Summary: 'You are a bit tired today. We will trim 20% of your sets so you still move well without burning out.',
      actionBullets: [
        'Cut total sets by 20% (minimum 1 set per move).',
        'Keep your normal weight targets so strength stays steady.',
        'Zero guilt if you stop early.'
      ]
    },
    high_fatigue_or_overload: {
      presetId: 'calm_machines_20',
      severityTier: 'high_fatigue_or_overload',
      title: 'Low-Spoons Stable Machines (-20% Sets)',
      badgeLabel: '-20% + Machines',
      volumeReductionPercent: 20,
      volumeMultiplier: 0.8,
      swapBarbellToMachines: true,
      recommendSensoryCalmMode: true,
      grade6Summary: 'Heavy fatigue or loud gym feelings take extra brain power. We trimmed 20% of sets and swapped complex barbells for simple seated machines.',
      actionBullets: [
        'Cut total workout volume by 20%.',
        'Swap complex barbell lifts to stable pin-loaded machines.',
        'Turn on Sensory-Calm mode for softer colors and less motion.'
      ]
    },
    severe_sensory_overload: {
      presetId: 'micro_recovery_40',
      severityTier: 'severe_sensory_overload',
      title: 'Ultra-Gentle Micro-Session (-40% + Machines)',
      badgeLabel: '-40% Gentle Mode',
      volumeReductionPercent: 40,
      volumeMultiplier: 0.6,
      swapBarbellToMachines: true,
      recommendSensoryCalmMode: true,
      grade6Summary: 'Today is a very low-spoons day. We trimmed 40% of sets and switched to calm, supported machines so you can finish fast and rest.',
      actionBullets: [
        'Cut total sets by 40% to keep the workout short.',
        'Use stable machines with zero plate loading needed.',
        'Resting completely is also a valid win today.'
      ]
    }
  });

/**
 * Pre-validated scientific barbell-to-stable-machine substitution map.
 */
export const BARBELL_TO_MACHINE_SWAPS: ReadonlyArray<{
  matchPattern: RegExp;
  machineName: string;
}> = Object.freeze([
  { matchPattern: /\bbarbell\s+back\s+squat\b|\bbarbell\s+squat\b|\bback\s+squat\b|\bfront\s+squat\b/i, machineName: 'Seated Leg Press Machine' },
  { matchPattern: /\bbarbell\s+bench\s+press\b|\bflat\s+barbell\s+bench\b|\bbench\s+press\b/i, machineName: 'Seated Chest Press Machine' },
  { matchPattern: /\bincline\s+barbell\b|\bincline\s+dumbbell\s+press\b/i, machineName: 'Incline Chest Press Machine' },
  { matchPattern: /\bbarbell\s+overhead\s+press\b|\boverhead\s+press\b|\bmilitary\s+press\b|\bohp\b/i, machineName: 'Seated Shoulder Press Machine' },
  { matchPattern: /\bbarbell\s+row\b|\bbent[\s-]over\s+row\b|\bpendlay\s+row\b/i, machineName: 'Chest-Supported Seated Row Machine' },
  { matchPattern: /\bbarbell\s+deadlift\b|\bconventional\s+deadlift\b|\bsumo\s+deadlift\b/i, machineName: 'Seated Leg Curl & Back Extension Machine' },
  { matchPattern: /\bbarbell\s+romanian\s+deadlift\b|\bromanian\s+deadlift\b|\brdl\b/i, machineName: 'Seated Hamstring Curl Machine' },
  { matchPattern: /\bbarbell\s+hip\s+thrust\b|\bhip\s+thrust\b/i, machineName: 'Glute Drive Machine' },
  { matchPattern: /\bbarbell\s+curl\b/i, machineName: 'Preacher Curl Machine' },
  { matchPattern: /\bwalking\s+lunge\b|\bbulgarian\s+split\s+squat\b/i, machineName: 'Seated Leg Extension Machine' }
]);

const VALID_TIERS = new Set<LowSpoonsSeverityTier>([
  'normal_energy',
  'mild_fatigue',
  'high_fatigue_or_overload',
  'severe_sensory_overload'
]);

/**
 * Strictly maps any LLM tier output to a pre-validated deterministic preset.
 * Unknown or invalid values default safely to `mild_fatigue` (-20% volume) rather
 * than allowing unvalidated changes.
 */
export function mapClassificationToValidatedPreset(rawTier: unknown): LowSpoonsScalingPreset {
  const clean = typeof rawTier === 'string' ? rawTier.trim().toLowerCase() : '';
  if (VALID_TIERS.has(clean as LowSpoonsSeverityTier)) {
    return LOW_SPOONS_PRESETS[clean as LowSpoonsSeverityTier];
  }
  return LOW_SPOONS_PRESETS.mild_fatigue;
}

export function findStableMachineVariation(exerciseName: string): string | null {
  const clean = String(exerciseName || '').trim();
  if (!clean) return null;
  for (const rule of BARBELL_TO_MACHINE_SWAPS) {
    if (rule.matchPattern.test(clean)) {
      return rule.machineName;
    }
  }
  return null;
}

/**
 * Deterministically applies a pre-validated Low-Spoons scaling preset to today's exercises:
 * 1. Reduces total non-cardio sets by the preset's exact reduction percentage (never below 1 set).
 * 2. If `swapBarbellToMachines` is true, substitutes complex barbell movements for stable machines.
 */
export function applyLowSpoonsPresetToExercises<T extends LowSpoonsExerciseLike>(
  exercises: T[],
  preset: LowSpoonsScalingPreset | null | undefined
): {
  exercises: T[];
  changes: LowSpoonsAppliedExerciseChange[];
  originalTotalSets: number;
  adjustedTotalSets: number;
} {
  const safeList = Array.isArray(exercises) ? exercises : [];
  const originalTotalSets = safeList.reduce(
    (sum, ex) => (ex && !ex.isCardio ? sum + Math.max(1, Number(ex.sets) || 1) : sum),
    0
  );

  if (!preset || preset.presetId === 'full_capacity') {
    return {
      exercises: safeList.map((ex) => ({ ...ex })),
      changes: [],
      originalTotalSets,
      adjustedTotalSets: originalTotalSets
    };
  }

  const cloned = safeList.map((ex) => ({ ...ex }));
  const targetTotalSets =
    originalTotalSets > 0
      ? Math.max(
          cloned.filter((ex) => !ex.isCardio).length,
          Math.round(originalTotalSets * preset.volumeMultiplier)
        )
      : 0;

  let setsToTrim = Math.max(0, originalTotalSets - targetTotalSets);

  // Trim 1 set at a time from exercises with the highest set counts first (fair distribution)
  let guard = 0;
  while (setsToTrim > 0 && guard < 100) {
    guard += 1;
    const candidates = cloned
      .map((ex, idx) => ({ idx, sets: Number(ex.sets) || 0, isCardio: Boolean(ex.isCardio) }))
      .filter((item) => !item.isCardio && item.sets > 1)
      .sort((a, b) => b.sets - a.sets);
    if (candidates.length === 0) break;
    cloned[candidates[0].idx].sets = Math.max(1, cloned[candidates[0].idx].sets - 1);
    setsToTrim -= 1;
  }

  const changes: LowSpoonsAppliedExerciseChange[] = [];
  for (let i = 0; i < cloned.length; i++) {
    const orig = safeList[i];
    const next = cloned[i];
    let swapped = false;

    if (preset.swapBarbellToMachines && !next.isCardio) {
      const machineName = findStableMachineVariation(next.name);
      if (machineName && machineName.toLowerCase() !== String(next.name).toLowerCase()) {
        next.originalExerciseName = orig.name;
        next.name = machineName;
        next.lowSpoonsMachineSwap = true;
        swapped = true;
      }
    }

    if (swapped || next.sets !== orig.sets) {
      changes.push({
        exerciseId: orig.id,
        originalName: orig.name,
        updatedName: next.name,
        originalSets: Math.max(1, Number(orig.sets) || 1),
        updatedSets: Math.max(1, Number(next.sets) || 1),
        swappedToMachine: swapped
      });
    }
  }

  const adjustedTotalSets = cloned.reduce(
    (sum, ex) => (ex && !ex.isCardio ? sum + Math.max(1, Number(ex.sets) || 1) : sum),
    0
  );

  return {
    exercises: cloned,
    changes,
    originalTotalSets,
    adjustedTotalSets
  };
}

/**
 * Calls server-side Gemini structured JSON classifier (/api/gemini/low-spoons-triage)
 * and strictly maps its enum classification to a pre-validated preset.
 */
export async function classifyLowSpoonsWithGemini(
  userCheckInText: string,
  options?: {
    endpoint?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<LowSpoonsTriageResult> {
  const cleanInput = String(userCheckInText || '').trim().slice(0, 600);
  if (!cleanInput) {
    return {
      ok: false,
      severityTier: 'normal_energy',
      preset: LOW_SPOONS_PRESETS.normal_energy,
      coachReassurance: null,
      model: null,
      error: 'Please type how your body or brain feels today before checking.'
    };
  }

  const fetchFn = options?.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const endpoint = options?.endpoint || '/api/gemini/low-spoons-triage';

  if (!fetchFn) {
    return {
      ok: false,
      severityTier: 'normal_energy',
      preset: LOW_SPOONS_PRESETS.normal_energy,
      coachReassurance: null,
      model: null,
      error: 'Network request tool is not available.'
    };
  }

  try {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'low_spoons_triage',
        checkInText: cleanInput
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data || data.ok === false) {
      return {
        ok: false,
        severityTier: 'normal_energy',
        preset: LOW_SPOONS_PRESETS.normal_energy,
        coachReassurance: null,
        model: data?.model || null,
        error:
          (typeof data?.error === 'string' && data.error) ||
          'Could not classify your check-in right now. You can pick a preset manually below.'
      };
    }

    const preset = mapClassificationToValidatedPreset(data.severityTier);
    return {
      ok: true,
      severityTier: preset.severityTier,
      preset,
      coachReassurance:
        typeof data.reassurance === 'string' && data.reassurance.trim()
          ? data.reassurance.trim()
          : preset.grade6Summary,
      model: typeof data.model === 'string' ? data.model : 'gemini-4-hydrogen'
    };
  } catch (err) {
    return {
      ok: false,
      severityTier: 'normal_energy',
      preset: LOW_SPOONS_PRESETS.normal_energy,
      coachReassurance: null,
      model: null,
      error: err instanceof Error ? err.message : 'Network error reaching triage helper.'
    };
  }
}
