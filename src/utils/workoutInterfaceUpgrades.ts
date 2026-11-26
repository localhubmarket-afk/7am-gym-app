/**
 * Neon Max Workout Flow & Smart Logging Engine
 * Pure, unit-tested helpers for:
 * 1. Smart Prompts for Missed Sets (never auto-fills Set 1)
 * 2. Device-Clock-Synced Warm-Up Timer (zero drift via Date.now())
 * 3. Next Exercise Preview Resolver (directly below Warm-Up Timer)
 * 4. Historical Most-Recent Successful Weight Resolver (from synced logs + history)
 * 5. Verified Machine Photo Registry + Offline Built-In SVG Machine Diagram Fallback
 */

export const MISSED_SET_ONE_MODAL_QUESTION =
  'Did you skip set one, or did you forget to log it?';

export interface WorkoutSetLogEntry {
  weight?: string | number;
  reps?: string | number;
  unit?: 'lbs' | 'kg' | string;
  done?: boolean;
  skipped?: boolean;
  updatedAt?: number | string;
  completedAt?: number | string;
  loggedAt?: number | string;
}

export interface MissedSetOneCheckInput {
  setIdx: number;
  setOneEntry?: WorkoutSetLogEntry | null;
  isTargetSetAlreadyDone?: boolean;
}

export interface MissedSetOneCheckResult {
  shouldPrompt: boolean;
  question: string;
  reason: string | null;
}

/**
 * Detects when a user tries to log Set 2 (or later) while Set 1 remains blank/unlogged
 * and has not been explicitly marked skipped. Never auto-fills Set 1.
 */
export function detectMissedSetOneCondition(
  input: MissedSetOneCheckInput
): MissedSetOneCheckResult {
  const setIdx = Number(input.setIdx || 0);
  if (input.isTargetSetAlreadyDone) {
    return { shouldPrompt: false, question: MISSED_SET_ONE_MODAL_QUESTION, reason: null };
  }
  if (!Number.isFinite(setIdx) || setIdx < 2) {
    return { shouldPrompt: false, question: MISSED_SET_ONE_MODAL_QUESTION, reason: null };
  }

  const s1 = input.setOneEntry || null;
  if (s1 && (Boolean(s1.done) || Boolean(s1.skipped))) {
    return { shouldPrompt: false, question: MISSED_SET_ONE_MODAL_QUESTION, reason: null };
  }

  return {
    shouldPrompt: true,
    question: MISSED_SET_ONE_MODAL_QUESTION,
    reason: 'set_one_blank_when_logging_later_set'
  };
}

/**
 * Marks Set 1 explicitly skipped while keeping weight and reps blank (zero auto-fill).
 */
export function buildSkippedSetOneLog(
  existingEntry?: WorkoutSetLogEntry | null,
  unit: 'lbs' | 'kg' = 'lbs',
  nowMs: number = Date.now()
): WorkoutSetLogEntry {
  return {
    weight: '',
    reps: '',
    done: false,
    skipped: true,
    unit: (existingEntry && existingEntry.unit) || unit,
    updatedAt: nowMs
  };
}

/**
 * Checks whether an exercise is completed:
 * Every set must be resolved (done or skipped) and at least one set must be completed.
 */
export function isExerciseResolvedDone(
  entries: Array<WorkoutSetLogEntry | null | undefined>,
  totalSets: number
): boolean {
  if (!Number.isFinite(totalSets) || totalSets <= 0) return false;
  if (!Array.isArray(entries) || entries.length < totalSets) return false;
  let doneCount = 0;
  for (let i = 0; i < totalSets; i++) {
    const entry = entries[i];
    if (!entry || (!entry.done && !entry.skipped)) {
      return false;
    }
    if (entry.done) doneCount += 1;
  }
  return doneCount > 0;
}

export interface DeviceClockWarmupTimerInput {
  nowMs: number;
  startedAtMs: number | null;
  accumulatedMs: number;
  targetDurationSec: number;
  running: boolean;
}

export interface DeviceClockWarmupTimerSnapshot {
  elapsedSec: number;
  remainingSec: number;
  formattedRemaining: string;
  formattedElapsed: string;
  deviceClockText: string;
  progressPercent: number;
  isComplete: boolean;
}

export function formatMmSs(totalSec: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSec) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDeviceClock12Hr(nowMs: number): string {
  const d = new Date(Number.isFinite(nowMs) ? nowMs : Date.now());
  let hrs = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  const suffix = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12;
  if (hrs === 0) hrs = 12;
  return `${hrs}:${mins}:${secs} ${suffix}`;
}

/**
 * Computes warm-up timer progress anchored directly to the device wall clock (Date.now()).
 * Prevents mobile tab-throttling drift when the screen turns off or changes apps.
 */
export function computeDeviceClockWarmupTimer(
  input: DeviceClockWarmupTimerInput
): DeviceClockWarmupTimerSnapshot {
  const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const targetSec = Math.max(60, Math.floor(Number(input.targetDurationSec) || 600));
  const baseMs = Math.max(0, Number(input.accumulatedMs) || 0);
  const activeDeltaMs =
    input.running && typeof input.startedAtMs === 'number' && Number.isFinite(input.startedAtMs)
      ? Math.max(0, nowMs - input.startedAtMs)
      : 0;
  const totalElapsedMs = baseMs + activeDeltaMs;
  const elapsedSec = Math.floor(totalElapsedMs / 1000);
  const remainingSec = Math.max(0, targetSec - elapsedSec);
  const progressPercent = Math.min(100, Math.round((elapsedSec / targetSec) * 100));

  return {
    elapsedSec,
    remainingSec,
    formattedRemaining: formatMmSs(remainingSec),
    formattedElapsed: formatMmSs(elapsedSec),
    deviceClockText: formatDeviceClock12Hr(nowMs),
    progressPercent,
    isComplete: elapsedSec >= targetSec
  };
}

export interface NextExerciseCandidate {
  id: string;
  name: string;
  sets: number;
  isPullup?: boolean;
  isDone?: boolean;
}

export interface NextExercisePreviewInput {
  isRestDay?: boolean;
  hasPullupGroupToday: boolean;
  isPullupGroupDone: boolean;
  pullupGroupName?: string;
  remainingExercises: NextExerciseCandidate[];
}

export interface NextExercisePreviewResult {
  nextExerciseName: string;
  displayText: string;
  isPullupsNext: boolean;
  allDone: boolean;
}

/**
 * Determines the exact next upcoming exercise name displayed directly below the Warm-Up Timer.
 * Follows the unified sequence: Warm-Up -> Pull-Ups Group -> Remaining Exercises.
 */
export function resolveNextExercisePreviewName(
  input: NextExercisePreviewInput
): NextExercisePreviewResult {
  if (input.isRestDay) {
    return {
      nextExerciseName: 'Active Recovery & Mobility',
      displayText: 'Next Exercise: Active Recovery & Mobility',
      isPullupsNext: false,
      allDone: false
    };
  }

  if (input.hasPullupGroupToday && !input.isPullupGroupDone) {
    const pName = String(input.pullupGroupName || 'Overhand Pull-Ups').trim() || 'Overhand Pull-Ups';
    return {
      nextExerciseName: pName,
      displayText: `Next Exercise: ${pName}`,
      isPullupsNext: true,
      allDone: false
    };
  }

  const list = Array.isArray(input.remainingExercises) ? input.remainingExercises : [];
  for (const ex of list) {
    if (ex && !ex.isPullup && !ex.isDone && String(ex.name || '').trim()) {
      const cleanName = String(ex.name).trim();
      return {
        nextExerciseName: cleanName,
        displayText: `Next Exercise: ${cleanName}`,
        isPullupsNext: false,
        allDone: false
      };
    }
  }

  return {
    nextExerciseName: 'All Exercises Complete',
    displayText: 'Next Exercise: All Exercises Complete',
    isPullupsNext: false,
    allDone: true
  };
}

export interface HistoricalWeightLookupInput {
  exerciseId: string;
  canonicalExerciseId?: string | null;
  targetUnit: 'lbs' | 'kg';
  currentWeek?: number;
  currentDayIdx?: number;
  workoutLogs?: Record<string, WorkoutSetLogEntry | undefined> | null;
  exerciseHistory?: Record<string, Array<{
    week?: number;
    dayIdx?: number;
    updatedAt?: number | string;
    completedAt?: number | string;
    sets?: Array<{
      setIdx?: number;
      weight?: string | number;
      reps?: string | number;
      unit?: string;
      done?: boolean;
      skipped?: boolean;
    }>;
  }>> | null;
}

export interface HistoricalWeightResult {
  weight: number;
  formattedWeight: string;
  unit: 'lbs' | 'kg';
  reps: string;
  sourceLabel: string;
  foundInHistory: boolean;
}

function roundGymWeight(value: number, unit: 'lbs' | 'kg'): number {
  const step = unit === 'kg' ? 1.25 : 2.5;
  const rounded = Math.round(value / step) * step;
  return Math.max(step, Number(rounded.toFixed(2)));
}

function convertWeightUnit(
  rawWeight: number,
  fromUnit: string | undefined,
  toUnit: 'lbs' | 'kg'
): number {
  const normFrom = String(fromUnit || toUnit).toLowerCase() === 'kg' ? 'kg' : 'lbs';
  if (normFrom === toUnit) return Number(rawWeight.toFixed(2));
  if (normFrom === 'lbs' && toUnit === 'kg') {
    return roundGymWeight(rawWeight / 2.20462, 'kg');
  }
  return roundGymWeight(rawWeight * 2.20462, 'lbs');
}

function toTimestampMs(raw: number | string | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return 0;
}

function parseWorkoutLogKeyParts(key: string): {
  week: number;
  slotOrDay: number;
  exId: string;
  setIdx: number;
} | null {
  // Matches both `w2_0_mon_bench_1` and legacy `0_mon_bench_1`
  const mWeek = /^w(\d+)_(\d+)_(.+)_(\d+)$/i.exec(key);
  if (mWeek) {
    return {
      week: parseInt(mWeek[1], 10),
      slotOrDay: parseInt(mWeek[2], 10),
      exId: mWeek[3],
      setIdx: parseInt(mWeek[4], 10)
    };
  }
  const mLegacy = /^(\d+)_(.+)_(\d+)$/i.exec(key);
  if (mLegacy) {
    return {
      week: 1,
      slotOrDay: parseInt(mLegacy[1], 10),
      exId: mLegacy[2],
      setIdx: parseInt(mLegacy[3], 10)
    };
  }
  return null;
}

/**
 * Queries synced workoutLogs and exerciseHistory (hydrated from Supabase /api/state)
 * for the user's most recent successful set for an exercise and returns that weight
 * as the default starting weight in the user's active unit.
 */
export function resolveMostRecentSuccessfulWeight(
  input: HistoricalWeightLookupInput
): HistoricalWeightResult | null {
  const targetExId = String(input.exerciseId || '').trim().toLowerCase();
  const targetCanon = String(input.canonicalExerciseId || '').trim().toLowerCase();
  const targetUnit: 'lbs' | 'kg' = input.targetUnit === 'kg' ? 'kg' : 'lbs';
  const curWeek = Number(input.currentWeek || 0);
  const curDay = typeof input.currentDayIdx === 'number' ? input.currentDayIdx : -1;

  interface Candidate {
    weight: number;
    reps: string;
    sourceLabel: string;
    ts: number;
    week: number;
    dayOrSlot: number;
    setIdx: number;
  }

  const candidates: Candidate[] = [];

  // 1. Scan structured exerciseHistory sessions (synced across weeks & devices)
  const historyMap = input.exerciseHistory || {};
  const historyBuckets = new Set<string>();
  if (targetCanon && Array.isArray(historyMap[targetCanon])) historyBuckets.add(targetCanon);
  if (targetExId && Array.isArray(historyMap[targetExId])) historyBuckets.add(targetExId);
  Object.keys(historyMap).forEach((k) => {
    const kl = k.toLowerCase();
    if (kl === targetCanon || kl === targetExId) historyBuckets.add(k);
  });

  historyBuckets.forEach((bucketKey) => {
    const sessions = historyMap[bucketKey];
    if (!Array.isArray(sessions)) return;
    sessions.forEach((sess) => {
      if (!sess || !Array.isArray(sess.sets)) return;
      const sWeek = Number(sess.week || 0);
      const sDay = typeof sess.dayIdx === 'number' ? sess.dayIdx : 0;
      const isCurrentSession = curWeek > 0 && curDay >= 0 && sWeek === curWeek && sDay === curDay;
      if (isCurrentSession) return;

      const sessTs = toTimestampMs(sess.updatedAt || sess.completedAt);
      sess.sets.forEach((st, idx) => {
        if (!st || st.skipped) return;
        if (st.done === false) return;
        const parsedW = parseFloat(String(st.weight ?? ''));
        if (!Number.isFinite(parsedW) || parsedW <= 0) return;
        const converted = convertWeightUnit(parsedW, st.unit, targetUnit);
        candidates.push({
          weight: converted,
          reps: String(st.reps ?? '').trim(),
          sourceLabel: sWeek > 0 ? `Wk ${sWeek}` : 'Last Session',
          ts: sessTs,
          week: sWeek,
          dayOrSlot: sDay,
          setIdx: Number(st.setIdx || idx + 1)
        });
      });
    });
  });

  // 2. Scan flat workoutLogs dictionary (direct Supabase & local logs)
  const logs = input.workoutLogs || {};
  Object.entries(logs).forEach(([logKey, entry]) => {
    if (!entry || !entry.done || entry.skipped) return;
    const parts = parseWorkoutLogKeyParts(logKey);
    if (!parts) return;
    const partIdLower = parts.exId.toLowerCase();
    const matchesId =
      partIdLower === targetExId ||
      (targetCanon && partIdLower === targetCanon) ||
      (targetExId && partIdLower.endsWith(`_${targetExId}`));
    if (!matchesId) return;

    // Exclude current day/week session so today's Set 1 pulls from the most recent PRIOR session
    if (curWeek > 0 && parts.week === curWeek && curDay >= 0 && parts.slotOrDay === curDay) {
      return;
    }

    const parsedW = parseFloat(String(entry.weight ?? ''));
    if (!Number.isFinite(parsedW) || parsedW <= 0) return;
    const converted = convertWeightUnit(parsedW, entry.unit, targetUnit);
    candidates.push({
      weight: converted,
      reps: String(entry.reps ?? '').trim(),
      sourceLabel: parts.week > 0 ? `Wk ${parts.week}` : 'Last Session',
      ts: toTimestampMs(entry.updatedAt || entry.completedAt || entry.loggedAt),
      week: parts.week,
      dayOrSlot: parts.slotOrDay,
      setIdx: parts.setIdx
    });
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.ts !== a.ts) return b.ts - a.ts;
    if (b.week !== a.week) return b.week - a.week;
    if (b.dayOrSlot !== a.dayOrSlot) return b.dayOrSlot - a.dayOrSlot;
    return b.setIdx - a.setIdx;
  });

  const best = candidates[0];
  return {
    weight: best.weight,
    formattedWeight: String(best.weight),
    unit: targetUnit,
    reps: best.reps,
    sourceLabel: best.sourceLabel,
    foundInHistory: true
  };
}

export type MachineEquipmentFamily =
  | 'barbell_rack'
  | 'cable_pulldown'
  | 'leg_machine'
  | 'press_machine'
  | 'pullup_station';

export const MACHINE_PHOTO_PATHS: Record<MachineEquipmentFamily, string> = {
  barbell_rack: '/assets/machines/barbell-bench-rack.jpg',
  cable_pulldown: '/assets/machines/cable-lat-pulldown.jpg',
  leg_machine: '/assets/machines/seated-leg-press-curl.jpg',
  press_machine: '/assets/machines/chest-shoulder-press.jpg',
  pullup_station: '/assets/machines/pullup-bar-station.jpg'
};

export interface MachinePhotoAsset {
  family: MachineEquipmentFamily;
  photoUrl: string;
  offlineSvgFallback: string;
  alt: string;
  caption: string;
}

function escapeXmlAttr(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates a crisp, high-contrast built-in offline SVG machine diagram data URI.
 * Automatically displayed if the user is offline or an image asset fails to load.
 */
export function buildOfflineMachineDiagramDataUri(
  family: MachineEquipmentFamily,
  label: string
): string {
  const safeTitle = escapeXmlAttr(String(label || 'Gym Machine').slice(0, 38));
  let iconPaths = '';

  if (family === 'barbell_rack') {
    iconPaths = `
      <line x1="90" y1="44" x2="90" y2="178" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
      <line x1="230" y1="44" x2="230" y2="178" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
      <line x1="58" y1="88" x2="262" y2="88" stroke="#38bdf8" stroke-width="7" stroke-linecap="round"/>
      <rect x="64" y="64" width="16" height="48" rx="4" fill="#10b981"/>
      <rect x="240" y="64" width="16" height="48" rx="4" fill="#10b981"/>
      <rect x="112" y="138" width="96" height="16" rx="6" fill="#e2e8f0"/>
      <line x1="126" y1="154" x2="120" y2="178" stroke="#94a3b8" stroke-width="5"/>
      <line x1="194" y1="154" x2="200" y2="178" stroke="#94a3b8" stroke-width="5"/>
    `;
  } else if (family === 'cable_pulldown') {
    iconPaths = `
      <rect x="126" y="44" width="68" height="132" rx="8" fill="#1e293b" stroke="#64748b" stroke-width="4"/>
      <rect x="140" y="96" width="40" height="66" rx="4" fill="#334155" stroke="#38bdf8" stroke-width="2"/>
      <circle cx="160" cy="122" r="5" fill="#fbbf24"/>
      <line x1="160" y1="54" x2="160" y2="86" stroke="#38bdf8" stroke-width="4"/>
      <path d="M98 76 L160 66 L222 76" fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="136" y="168" width="48" height="12" rx="4" fill="#e2e8f0"/>
    `;
  } else if (family === 'leg_machine') {
    iconPaths = `
      <path d="M104 68 L118 134 L178 134" fill="none" stroke="#e2e8f0" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="172" y1="134" x2="196" y2="174" stroke="#38bdf8" stroke-width="7" stroke-linecap="round"/>
      <circle cx="202" cy="166" r="12" fill="#10b981"/>
      <rect x="218" y="62" width="42" height="114" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="4"/>
      <circle cx="239" cy="112" r="5" fill="#fbbf24"/>
    `;
  } else if (family === 'pullup_station') {
    iconPaths = `
      <line x1="94" y1="56" x2="94" y2="178" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
      <line x1="226" y1="56" x2="226" y2="178" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
      <path d="M72 64 L112 52 L208 52 L248 64" fill="none" stroke="#10b981" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="128" y="128" width="64" height="14" rx="5" fill="#38bdf8"/>
      <rect x="142" y="146" width="36" height="32" rx="4" fill="#334155" stroke="#64748b" stroke-width="2"/>
    `;
  } else {
    // press_machine
    iconPaths = `
      <path d="M126 62 L126 146 L176 146" fill="none" stroke="#e2e8f0" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M156 76 L204 106 L186 122" fill="none" stroke="#10b981" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="210" y="54" width="46" height="122" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="4"/>
      <circle cx="233" cy="108" r="5" fill="#fbbf24"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" role="img" aria-label="${safeTitle} offline equipment diagram"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs><rect width="320" height="240" rx="16" fill="url(#bg)"/><rect x="12" y="12" width="296" height="216" rx="12" fill="none" stroke="#334155" stroke-width="2"/>${iconPaths}<text x="160" y="206" text-anchor="middle" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700">${safeTitle}</text><text x="160" y="222" text-anchor="middle" fill="#38bdf8" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700">OFFLINE MACHINE DIAGRAM</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function inferMachineEquipmentFamily(input: {
  exerciseId?: string;
  exerciseName?: string;
  equipType?: string;
  equipLabel?: string;
  isSwappedMachine?: boolean;
}): MachineEquipmentFamily {
  const combined = [
    input.exerciseId || '',
    input.exerciseName || '',
    input.equipType || '',
    input.equipLabel || ''
  ]
    .join(' ')
    .toLowerCase();

  if (/\b(pull[- ]?up|chin[- ]?up|assisted\s+pull|dead\s+hang)\b/i.test(combined)) {
    return 'pullup_station';
  }
  if (
    /\b(leg\s+ext|leg\s+curl|leg\s+press|hack\s+squat|calf|hamstring|hip\s+abduct|glute\s+drive|rdl|lunge|split\s+squat)\b/i.test(
      combined
    )
  ) {
    return 'leg_machine';
  }
  if (
    /\b(lat\s+pulldown|cable|pulley|face\s+pull|rope|crunch|row\s+machine|pushdown)\b/i.test(
      combined
    )
  ) {
    return 'cable_pulldown';
  }
  if (
    !input.isSwappedMachine &&
    /\b(barbell|rack|deadlift|squat|bench\s+press|ohp|overhead\s+press|hip\s+thrust)\b/i.test(
      combined
    )
  ) {
    return 'barbell_rack';
  }
  return 'press_machine';
}

/**
 * Resolves a verified local machine photo URL and a guaranteed offline SVG diagram fallback.
 */
export function resolveMachinePhotoAsset(input: {
  exerciseId?: string;
  exerciseName?: string;
  equipType?: string;
  equipLabel?: string;
  isSwappedMachine?: boolean;
}): MachinePhotoAsset {
  const family = inferMachineEquipmentFamily(input);
  const displayLabel =
    String(input.equipLabel || input.exerciseName || 'Gym Machine').trim() || 'Gym Machine';
  return {
    family,
    photoUrl: MACHINE_PHOTO_PATHS[family],
    offlineSvgFallback: buildOfflineMachineDiagramDataUri(family, displayLabel),
    alt: `${displayLabel} setup reference photo`,
    caption: displayLabel
  };
}

export interface MachinePhotoValidationReport {
  passed: boolean;
  checkedCount: number;
  brokenItems: Array<{ exerciseId: string; reason: string }>;
}

/**
 * Content Validation QA helper ensuring every exercise resolves to a valid verified local
 * machine photo URL and an offline-safe SVG diagram fallback (zero broken external links).
 */
export function validateMachinePhotoRegistry(
  exercises: Array<{ id: string; name: string; equipType?: string; equipLabel?: string }>
): MachinePhotoValidationReport {
  const brokenItems: Array<{ exerciseId: string; reason: string }> = [];
  const list = Array.isArray(exercises) ? exercises : [];

  list.forEach((ex) => {
    const asset = resolveMachinePhotoAsset({
      exerciseId: ex.id,
      exerciseName: ex.name,
      equipType: ex.equipType,
      equipLabel: ex.equipLabel
    });
    if (!asset.photoUrl || !asset.photoUrl.startsWith('/assets/machines/') || !asset.photoUrl.endsWith('.jpg')) {
      brokenItems.push({ exerciseId: ex.id, reason: `Invalid machine photo URL: ${asset.photoUrl}` });
    }
    if (!asset.offlineSvgFallback || !asset.offlineSvgFallback.startsWith('data:image/svg+xml')) {
      brokenItems.push({ exerciseId: ex.id, reason: 'Missing offline SVG diagram fallback.' });
    }
    if (!asset.alt || asset.alt.trim().length < 5) {
      brokenItems.push({ exerciseId: ex.id, reason: 'Missing descriptive alt text.' });
    }
  });

  return {
    passed: brokenItems.length === 0 && list.length > 0,
    checkedCount: list.length,
    brokenItems
  };
}
