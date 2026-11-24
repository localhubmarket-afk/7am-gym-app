/**
 * Phase 2 — Task 1: Voice-to-Log Engine (Web Speech API + Deterministic Parser + 1-Tap Undo)
 *
 * Parses natural spoken gym phrases (e.g., "Did 10 reps at 45 pounds") into strict,
 * bounded numeric fields for gym_state.workoutLogs, and produces an immutable undo
 * snapshot so a single tap reverts both local state and Supabase.
 */

export type VoiceWeightUnit = 'lbs' | 'kg';

export interface ParsedVoiceSetLog {
  ok: boolean;
  transcript: string;
  reps: number | null;
  weight: number | null;
  unit: VoiceWeightUnit;
  isBodyweight: boolean;
  exerciseHint: string | null;
  setNumberHint: number | null;
  confidenceNote: string;
  errorMessage?: string;
}

export interface VoiceLogTargetContext {
  week: number;
  daySlotIndex: number;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  defaultUnit?: VoiceWeightUnit;
  defaultWeight?: number;
  pullupDayNumber?: number | null;
}

export interface VoiceLogUndoRecord {
  id: string;
  loggedAtIso: string;
  transcript: string;
  logKey: string;
  legacyWeek1Key: string | null;
  pullupLogKey: string | null;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  loggedWeight: number;
  loggedReps: number;
  unit: VoiceWeightUnit;
  previousLogEntry: Record<string, any> | null;
  previousLegacyEntry: Record<string, any> | null;
  previousPullupEntry: Record<string, any> | null;
}

export interface VoiceLogApplyResult {
  nextState: Record<string, any>;
  undoRecord: VoiceLogUndoRecord;
  summaryText: string;
}

export interface VoiceLogRevertResult {
  nextState: Record<string, any>;
  revertedKey: string;
  summaryText: string;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};

const MAX_VOICE_WEIGHT_LBS = 1500;
const MAX_VOICE_REPS = 200;

/**
 * Converts common spoken English number words (e.g. "forty five", "one thirty five", "ten")
 * into digits so Web Speech transcripts normalize consistently.
 */
export function normalizeSpokenNumbers(rawTranscript: string): string {
  let text = String(rawTranscript || '')
    .toLowerCase()
    .replace(/[,;!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  // Handle "one hundred and thirty five" / "two hundred twenty five"
  text = text.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred(?:\s+and)?(?:\s+(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))?(?:\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen))?\b/g,
    (_m, hundredsWord, tensWord, onesWord) => {
      const h = (NUMBER_WORDS[hundredsWord] || 0) * 100;
      const t = tensWord ? NUMBER_WORDS[tensWord] || 0 : 0;
      const o = onesWord ? NUMBER_WORDS[onesWord] || 0 : 0;
      return String(h + t + o);
    }
  );

  // Handle compound tens like "forty five" -> "45"
  text = text.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/g,
    (_m, tensWord, onesWord) => String((NUMBER_WORDS[tensWord] || 0) + (NUMBER_WORDS[onesWord] || 0))
  );

  // Handle standalone single number words
  text = text.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g,
    (word) => String(NUMBER_WORDS[word])
  );

  return text;
}

function clampFinite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function cloneEntry(entry: unknown): Record<string, any> | null {
  if (!entry || typeof entry !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(entry));
  } catch {
    return { ...(entry as Record<string, any>) };
  }
}

/**
 * Pure deterministic parser mapping natural spoken phrases to structured set log values.
 * Examples supported:
 *  - "Did 10 reps at 45 pounds"
 *  - "8 reps of 135 lbs"
 *  - "135 pounds for 8 reps"
 *  - "Set 2 bench press 12 reps at 60 kg"
 *  - "Bodyweight 9 reps"
 */
export function parseSpokenSetPhrase(
  rawTranscript: string,
  defaultUnit: VoiceWeightUnit = 'lbs'
): ParsedVoiceSetLog {
  const original = String(rawTranscript || '').trim().slice(0, 300);
  if (!original) {
    return {
      ok: false,
      transcript: '',
      reps: null,
      weight: null,
      unit: defaultUnit,
      isBodyweight: false,
      exerciseHint: null,
      setNumberHint: null,
      confidenceNote: 'No speech detected.',
      errorMessage: 'Say something like "Did 10 reps at 45 pounds".'
    };
  }

  const normalized = normalizeSpokenNumbers(original);

  // Detect unit
  let unit: VoiceWeightUnit = defaultUnit;
  if (/\b(kg|kgs|kilo|kilos|kilogram|kilograms)\b/i.test(normalized)) {
    unit = 'kg';
  } else if (/\b(lb|lbs|pound|pounds)\b/i.test(normalized)) {
    unit = 'lbs';
  }

  const isBodyweight = /\b(bodyweight|body weight|no weight|unweighted)\b/i.test(normalized);

  // Optional set number hint ("set 2", "set #3")
  let setNumberHint: number | null = null;
  const setMatch = normalized.match(/\bset\s*#?\s*(\d{1,2})\b/i);
  if (setMatch) {
    const parsedSet = parseInt(setMatch[1], 10);
    if (parsedSet >= 1 && parsedSet <= 12) {
      setNumberHint = parsedSet;
    }
  }

  // Extract reps (multiple natural phrasings)
  let reps: number | null = null;
  const repsPatterns: RegExp[] = [
    /\b(\d{1,3})\s*(?:reps?|repetitions?|pull[\s-]*ups?|push[\s-]*ups?|squats?)\b/i,
    /\b(?:for|did|hit|got|completed)\s+(\d{1,3})\s*(?:reps?|times?)\b/i,
    /\b(?:at|with)\s+\d+(?:\.\d+)?\s*(?:lbs?|pounds?|kgs?|kilos?|kilograms?)?\s*(?:for|x|by)\s*(\d{1,3})\b/i,
    /\b\d+(?:\.\d+)?\s*(?:x|by)\s*(\d{1,3})\b/i
  ];
  for (const pat of repsPatterns) {
    const m = normalized.match(pat);
    if (m && m[1]) {
      const candidate = parseInt(m[1], 10);
      if (Number.isFinite(candidate) && candidate >= 1) {
        reps = clampFinite(candidate, 1, MAX_VOICE_REPS);
        break;
      }
    }
  }

  // Extract weight (multiple natural phrasings)
  let weight: number | null = isBodyweight ? 0 : null;
  if (!isBodyweight) {
    const weightPatterns: RegExp[] = [
      /\b(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kgs?|kilos?|kilograms?)\b/i,
      /\b(?:at|with|of|using|weight)\s+(\d+(?:\.\d+)?)\b/i,
      /\b(\d+(?:\.\d+)?)\s*(?:x|for)\s*\d{1,3}\s*(?:reps?)?\b/i
    ];
    for (const pat of weightPatterns) {
      const m = normalized.match(pat);
      if (m && m[1]) {
        const candidate = parseFloat(m[1]);
        if (Number.isFinite(candidate) && candidate >= 0) {
          weight = Math.round(clampFinite(candidate, 0, MAX_VOICE_WEIGHT_LBS) * 10) / 10;
          break;
        }
      }
    }
  }

  // Fallback for terse "10 at 45" where no explicit "reps"/"pounds" word was spoken
  if (reps === null && weight === null) {
    const terse = normalized.match(/\b(\d{1,3})\s+(?:at|@)\s+(\d+(?:\.\d+)?)\b/i);
    if (terse) {
      reps = clampFinite(parseInt(terse[1], 10), 1, MAX_VOICE_REPS);
      weight = Math.round(clampFinite(parseFloat(terse[2]), 0, MAX_VOICE_WEIGHT_LBS) * 10) / 10;
    }
  }

  // Optional exercise name hint (e.g. "bench press", "barbell squat", "pull ups", "lat pulldown")
  const knownExerciseHints = [
    'barbell squat',
    'squat',
    'bench press',
    'incline press',
    'overhead press',
    'deadlift',
    'romanian deadlift',
    'pull up',
    'pull-up',
    'lat pulldown',
    'seated row',
    'cable row',
    'leg press',
    'bicep curl',
    'tricep pushdown',
    'calf raise',
    'lateral raise',
    'lunge'
  ];
  const exerciseHint =
    knownExerciseHints.find((name) => normalized.includes(name)) || null;

  if (reps === null) {
    return {
      ok: false,
      transcript: original,
      reps: null,
      weight,
      unit,
      isBodyweight,
      exerciseHint,
      setNumberHint,
      confidenceNote: 'Could not find a rep count.',
      errorMessage: 'Please say how many reps you did, like "Did 10 reps at 45 pounds".'
    };
  }

  return {
    ok: true,
    transcript: original,
    reps,
    weight,
    unit,
    isBodyweight,
    exerciseHint,
    setNumberHint,
    confidenceNote:
      weight !== null
        ? `Ready to log ${reps} reps at ${weight} ${unit}.`
        : `Ready to log ${reps} reps using your current target weight.`
  };
}

/**
 * Pure state transition: applies a parsed voice log into gym_state.workoutLogs
 * and returns a 1-tap Undo record containing exact pre-log values.
 */
export function applyVoiceLogToGymState(
  currentState: Record<string, any>,
  parsed: ParsedVoiceSetLog,
  target: VoiceLogTargetContext
): VoiceLogApplyResult {
  if (!parsed.ok || parsed.reps === null) {
    throw new Error(parsed.errorMessage || 'Cannot apply an incomplete voice log.');
  }

  const safeWeek = Math.max(1, Math.min(12, Math.floor(Number(target.week) || 1)));
  const safeSlot = Math.max(0, Math.min(6, Math.floor(Number(target.daySlotIndex) || 0)));
  const safeSet = Math.max(1, Math.min(12, Math.floor(Number(target.setNumber) || 1)));
  const unit: VoiceWeightUnit = parsed.unit || target.defaultUnit || 'lbs';
  const resolvedWeight =
    parsed.isBodyweight
      ? 0
      : parsed.weight !== null
        ? parsed.weight
        : Math.max(0, Number(target.defaultWeight) || 0);

  const logKey = `w${safeWeek}_${safeSlot}_${target.exerciseId}_${safeSet}`;
  const legacyWeek1Key = safeWeek === 1 ? `${safeSlot}_${target.exerciseId}_${safeSet}` : null;
  const pullupLogKey =
    typeof target.pullupDayNumber === 'number' && target.pullupDayNumber > 0
      ? `w${safeWeek}_d${target.pullupDayNumber}_s${safeSet}`
      : null;

  const existingLogs =
    currentState && currentState.workoutLogs && typeof currentState.workoutLogs === 'object'
      ? currentState.workoutLogs
      : {};
  const existingPullups =
    currentState && currentState.pullupLogs && typeof currentState.pullupLogs === 'object'
      ? currentState.pullupLogs
      : {};

  const nowIso = new Date().toISOString();
  const undoRecord: VoiceLogUndoRecord = {
    id: `voice_undo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    loggedAtIso: nowIso,
    transcript: parsed.transcript,
    logKey,
    legacyWeek1Key,
    pullupLogKey,
    exerciseId: target.exerciseId,
    exerciseName: target.exerciseName,
    setNumber: safeSet,
    loggedWeight: resolvedWeight,
    loggedReps: parsed.reps,
    unit,
    previousLogEntry: cloneEntry(existingLogs[logKey]),
    previousLegacyEntry: legacyWeek1Key ? cloneEntry(existingLogs[legacyWeek1Key]) : null,
    previousPullupEntry: pullupLogKey ? cloneEntry(existingPullups[pullupLogKey]) : null
  };

  const newEntry = {
    weight: String(resolvedWeight),
    reps: String(parsed.reps),
    done: true,
    isLogged: true,
    unit,
    loggedVia: 'voice',
    loggedAt: nowIso
  };

  const nextWorkoutLogs: Record<string, any> = {
    ...existingLogs,
    [logKey]: newEntry
  };
  if (legacyWeek1Key) {
    nextWorkoutLogs[legacyWeek1Key] = { ...newEntry };
  }

  const nextPullupLogs: Record<string, any> = { ...existingPullups };
  if (pullupLogKey) {
    nextPullupLogs[pullupLogKey] = {
      ...(existingPullups[pullupLogKey] || {}),
      reps: String(parsed.reps),
      done: true,
      loggedVia: 'voice',
      loggedAt: nowIso
    };
  }

  const nextState: Record<string, any> = {
    ...currentState,
    workoutLogs: nextWorkoutLogs,
    pullupLogs: nextPullupLogs,
    lastWorkoutActivityAt: Date.now(),
    last_updated: nowIso,
    updatedAt: nowIso
  };

  const weightText = resolvedWeight > 0 ? `${resolvedWeight} ${unit}` : 'Bodyweight';
  const summaryText = `Logged Set ${safeSet} of ${target.exerciseName}: ${parsed.reps} reps at ${weightText}.`;

  return {
    nextState,
    undoRecord,
    summaryText
  };
}

/**
 * Pure 1-tap Undo transition: restores the exact pre-log set entry (or removes it
 * if it did not exist) and updates timestamps so Supabase sync overwrites the cloud record.
 */
export function revertVoiceLogFromGymState(
  currentState: Record<string, any>,
  undoRecord: VoiceLogUndoRecord
): VoiceLogRevertResult {
  const existingLogs =
    currentState && currentState.workoutLogs && typeof currentState.workoutLogs === 'object'
      ? currentState.workoutLogs
      : {};
  const existingPullups =
    currentState && currentState.pullupLogs && typeof currentState.pullupLogs === 'object'
      ? currentState.pullupLogs
      : {};

  const nextWorkoutLogs: Record<string, any> = { ...existingLogs };
  if (undoRecord.previousLogEntry) {
    nextWorkoutLogs[undoRecord.logKey] = cloneEntry(undoRecord.previousLogEntry);
  } else {
    delete nextWorkoutLogs[undoRecord.logKey];
  }

  if (undoRecord.legacyWeek1Key) {
    if (undoRecord.previousLegacyEntry) {
      nextWorkoutLogs[undoRecord.legacyWeek1Key] = cloneEntry(undoRecord.previousLegacyEntry);
    } else {
      delete nextWorkoutLogs[undoRecord.legacyWeek1Key];
    }
  }

  const nextPullupLogs: Record<string, any> = { ...existingPullups };
  if (undoRecord.pullupLogKey) {
    if (undoRecord.previousPullupEntry) {
      nextPullupLogs[undoRecord.pullupLogKey] = cloneEntry(undoRecord.previousPullupEntry);
    } else {
      delete nextPullupLogs[undoRecord.pullupLogKey];
    }
  }

  const nowIso = new Date().toISOString();
  const nextState: Record<string, any> = {
    ...currentState,
    workoutLogs: nextWorkoutLogs,
    pullupLogs: nextPullupLogs,
    last_updated: nowIso,
    updatedAt: nowIso
  };

  return {
    nextState,
    revertedKey: undoRecord.logKey,
    summaryText: `Undid Set ${undoRecord.setNumber} of ${undoRecord.exerciseName}. Synced to cloud.`
  };
}

export interface BrowserSpeechRecognitionHandle {
  isSupported: boolean;
  start: () => void;
  stop: () => void;
}

export function isWebSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Thin browser Web Speech API wrapper with clean lifecycle callbacks.
 */
export function createBrowserSpeechRecognizer(callbacks: {
  lang?: string;
  onStart?: () => void;
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onError?: (friendlyMessage: string) => void;
  onEnd?: () => void;
}): BrowserSpeechRecognitionHandle {
  if (typeof window === 'undefined') {
    return { isSupported: false, start: () => {}, stop: () => {} };
  }
  const w = window as unknown as Record<string, any>;
  const SpeechCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SpeechCtor) {
    return {
      isSupported: false,
      start: () => {
        callbacks.onError?.('Voice typing is not supported in this browser. You can type your set phrase below instead.');
      },
      stop: () => {}
    };
  }

  const recognition = new SpeechCtor();
  recognition.lang = callbacks.lang || 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    callbacks.onStart?.();
  };

  recognition.onresult = (event: any) => {
    let interim = '';
    let finalText = '';
    for (let i = event.resultIndex || 0; i < (event.results?.length || 0); i++) {
      const result = event.results[i];
      const transcript = result?.[0]?.transcript || '';
      if (result.isFinal) {
        finalText += transcript;
      } else {
        interim += transcript;
      }
    }
    if (interim.trim()) {
      callbacks.onInterimTranscript?.(interim.trim());
    }
    if (finalText.trim()) {
      callbacks.onFinalTranscript(finalText.trim());
    }
  };

  recognition.onerror = (event: any) => {
    const code = String(event?.error || 'unknown');
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      callbacks.onError?.('Microphone permission was blocked. Allow microphone access or type your set below.');
    } else if (code === 'no-speech') {
      callbacks.onError?.('No speech heard. Tap Start Voice Log and speak clearly.');
    } else {
      callbacks.onError?.('Voice listening stopped. Try again or type your set below.');
    }
  };

  recognition.onend = () => {
    callbacks.onEnd?.();
  };

  return {
    isSupported: true,
    start: () => {
      try {
        recognition.start();
      } catch {
        callbacks.onError?.('Microphone is already listening or unavailable.');
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // Ignore stop errors when already idle
      }
    }
  };
}
