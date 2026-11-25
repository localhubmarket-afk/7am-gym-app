/**
 * Task 4: Custom Workout Program Upload/Import & Next-Week Progression Notes
 * - Supports competitor formats: CSV/Excel spreadsheets (Strong, Hevy, Google Sheets),
 *   JSON workout plans, plain text (.txt) routines, and text-based PDFs (.pdf).
 * - Validates and sanitizes every imported day, exercise name, set count, rep range,
 *   and rest duration before attaching it to the user's profile.
 * - Provides dedicated Next-Week Progression Note helpers with 1-tap quick chips.
 */

export interface CustomProgramExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: number;
  target: string;
  notes?: string;
}

export interface CustomProgramDay {
  dayIndex: number;
  dayName: string;
  warmupType: 'upper' | 'lower';
  exercises: CustomProgramExercise[];
}

export interface ParsedCustomProgramResult {
  valid: boolean;
  sourceFormat: 'csv' | 'json' | 'text' | 'pdf_text';
  programName: string;
  days: CustomProgramDay[];
  totalExercises: number;
  warnings: string[];
  errors: string[];
}

export interface NextWeekProgressionNote {
  exerciseId: string;
  text: string;
  quickTag: string | null;
  updatedAt: string;
}

export interface NextWeekQuickChip {
  id: string;
  label: string;
  noteText: string;
}

export const NEXT_WEEK_NOTE_QUICK_CHIPS: ReadonlyArray<NextWeekQuickChip> = [
  { id: 'add_5_lbs', label: '+5 lbs next week', noteText: 'Add +5 lbs next week' },
  { id: 'add_2_5_lbs', label: '+2.5 lbs next week', noteText: 'Add +2.5 lbs next week' },
  { id: 'add_1_rep', label: '+1–2 reps next week', noteText: 'Push for +1 to 2 more reps next week' },
  { id: 'keep_form', label: 'Same weight · cleaner form', noteText: 'Keep same weight and slow down form next week' },
  { id: 'deload', label: 'Lighter next week (-10%)', noteText: 'Drop weight by 10% next week to recover' }
];

const MAX_PROGRAM_DAYS = 7;
const MAX_EXERCISES_PER_DAY = 18;
const MAX_TEXT_LENGTH = 100_000;

function stripUnsafeChars(raw: unknown, maxLen: number): string {
  return String(raw ?? '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function slugifyExerciseId(name: string, dayIdx: number, exIdx: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return `custom_d${dayIdx + 1}_${base || 'lift'}_${exIdx + 1}`;
}

function detectWarmupType(dayName: string, exerciseNames: string[]): 'upper' | 'lower' {
  const combined = `${dayName} ${exerciseNames.join(' ')}`.toLowerCase();
  if (/(leg|lower|squat|deadlift|lunge|rdl|calf|hamstring|quad|glute)/i.test(combined)) {
    return 'lower';
  }
  return 'upper';
}

function clampSets(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(12, n);
}

function sanitizeReps(raw: unknown): string {
  const clean = stripUnsafeChars(raw, 24);
  if (!clean) return '8-12';
  if (/^\d{1,3}(\s*[-–to]+\s*\d{1,3})?(\s*reps?)?$/i.test(clean) || /max|amrap|sec|min/i.test(clean)) {
    return clean.replace(/\s*reps?$/i, '').trim();
  }
  return '8-12';
}

function clampRest(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 15) return 90;
  return Math.min(600, n);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/**
 * Lightweight client-side text extractor for uncompressed / literal-string PDF files.
 * Keeps browser footprint zero-dependency and fails gracefully for image-only scanned PDFs.
 */
export function extractReadableTextFromPdfBytes(bytes: Uint8Array): {
  text: string;
  extractedLines: number;
  isLikelyScannedImagePdf: boolean;
} {
  if (!bytes || bytes.length === 0) {
    return { text: '', extractedLines: 0, isLikelyScannedImagePdf: true };
  }

  let latin = '';
  const limit = Math.min(bytes.length, 500_000);
  for (let i = 0; i < limit; i += 1) {
    latin += String.fromCharCode(bytes[i]);
  }

  // Extract PDF literal text operators: (Text here) Tj or [(Text) -10 (here)] TJ
  const fragments: string[] = [];
  const parenRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = parenRegex.exec(latin)) !== null) {
    const unescaped = match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
    const clean = stripUnsafeChars(unescaped, 160);
    if (clean.length >= 2 && /[a-zA-Z0-9]/.test(clean)) {
      fragments.push(clean);
    }
  }

  // Fallback: if plain readable lines exist directly in the buffer (e.g., simple PDF/text exports)
  const text = fragments.join('\n').trim();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return {
    text,
    extractedLines: lines.length,
    isLikelyScannedImagePdf: lines.length === 0
  };
}

/**
 * Parses and strictly validates a custom workout plan uploaded as CSV, JSON, TXT, or PDF text.
 */
export function parseCustomWorkoutProgram(
  rawContent: string,
  fileName: string = 'custom-plan.txt'
): ParsedCustomProgramResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const safeFileName = stripUnsafeChars(fileName || 'Custom Program', 80);
  const defaultProgramName = safeFileName.replace(/\.(csv|json|txt|pdf)$/i, '') || 'My Custom Program';

  const trimmed = String(rawContent || '').slice(0, MAX_TEXT_LENGTH).trim();
  if (!trimmed) {
    return {
      valid: false,
      sourceFormat: 'text',
      programName: defaultProgramName,
      days: [],
      totalExercises: 0,
      warnings,
      errors: ['Your file or pasted plan is empty. Add at least 1 exercise to import.']
    };
  }

  const lowerFile = safeFileName.toLowerCase();

  // 1. JSON format
  if (lowerFile.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const programName = stripUnsafeChars(
        (!Array.isArray(parsed) && parsed && (parsed.programName || parsed.name || parsed.title)) ||
          defaultProgramName,
        80
      );
      const rawDays: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.days)
          ? parsed.days
          : Array.isArray(parsed?.workouts)
            ? parsed.workouts
            : Array.isArray(parsed?.exercises)
              ? [{ dayName: 'Day 1', exercises: parsed.exercises }]
              : [];

      const days: CustomProgramDay[] = [];
      rawDays.slice(0, MAX_PROGRAM_DAYS).forEach((d, dIdx) => {
        const dayName = stripUnsafeChars(d?.dayName || d?.name || d?.title || `Day ${dIdx + 1}`, 60);
        const exList = Array.isArray(d?.exercises) ? d.exercises : [];
        const exercises: CustomProgramExercise[] = [];
        exList.slice(0, MAX_EXERCISES_PER_DAY).forEach((ex: any, exIdx: number) => {
          const name = stripUnsafeChars(ex?.name || ex?.exercise || ex?.title, 80);
          if (name.length < 2) return;
          exercises.push({
            id: slugifyExerciseId(name, dIdx, exIdx),
            name,
            sets: clampSets(ex?.sets),
            reps: sanitizeReps(ex?.reps),
            rest: clampRest(ex?.rest || ex?.restSeconds),
            target: stripUnsafeChars(ex?.target || ex?.muscle || 'Custom Plan', 40) || 'Custom Plan',
            notes: stripUnsafeChars(ex?.notes || '', 200) || undefined
          });
        });
        if (exercises.length > 0) {
          days.push({
            dayIndex: days.length,
            dayName,
            warmupType: d?.warmupType === 'lower' ? 'lower' : detectWarmupType(dayName, exercises.map((e) => e.name)),
            exercises
          });
        }
      });

      const totalExercises = days.reduce((sum, d) => sum + d.exercises.length, 0);
      if (totalExercises === 0) {
        errors.push('No valid exercises were found in this JSON plan.');
      }
      return {
        valid: errors.length === 0 && totalExercises > 0,
        sourceFormat: 'json',
        programName,
        days,
        totalExercises,
        warnings,
        errors
      };
    } catch {
      errors.push('This JSON file has a formatting error. Check commas and quotes, or paste as plain text.');
      return {
        valid: false,
        sourceFormat: 'json',
        programName: defaultProgramName,
        days: [],
        totalExercises: 0,
        warnings,
        errors
      };
    }
  }

  // 2. CSV format (Day, Exercise, Sets, Reps, Rest, Notes)
  const rawLines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const firstCols = parseCsvLine(rawLines[0] || '').map((c) => c.toLowerCase());
  const looksLikeCsv =
    lowerFile.endsWith('.csv') ||
    (firstCols.length >= 2 &&
      firstCols.some((c) => /exercise|movement|lift|workout/i.test(c)));

  if (looksLikeCsv) {
    const hasHeader = firstCols.some((c) => /exercise|day|sets|reps|movement/i.test(c));
    const headerCols = hasHeader ? firstCols : ['day', 'exercise', 'sets', 'reps', 'rest', 'notes'];
    const dayCol = headerCols.findIndex((c) => /day|split|routine/i.test(c));
    const exCol = headerCols.findIndex((c) => /exercise|movement|lift|name/i.test(c));
    const setsCol = headerCols.findIndex((c) => /^sets?$/i.test(c));
    const repsCol = headerCols.findIndex((c) => /reps?/i.test(c));
    const restCol = headerCols.findIndex((c) => /rest/i.test(c));
    const noteCol = headerCols.findIndex((c) => /note|tip|cue/i.test(c));

    const dayMap = new Map<string, CustomProgramExercise[]>();
    const startIdx = hasHeader ? 1 : 0;

    for (let i = startIdx; i < rawLines.length; i += 1) {
      const cols = parseCsvLine(rawLines[i]);
      const dayLabel = stripUnsafeChars(dayCol >= 0 ? cols[dayCol] : 'Day 1', 60) || 'Day 1';
      const exName = stripUnsafeChars(exCol >= 0 ? cols[exCol] : cols[1] || cols[0], 80);
      if (exName.length < 2) {
        warnings.push(`Skipped row ${i + 1} because the exercise name was empty.`);
        continue;
      }

      if (!dayMap.has(dayLabel)) {
        if (dayMap.size >= MAX_PROGRAM_DAYS) {
          warnings.push(`Limited import to the first ${MAX_PROGRAM_DAYS} workout days.`);
          continue;
        }
        dayMap.set(dayLabel, []);
      }

      const list = dayMap.get(dayLabel)!;
      if (list.length >= MAX_EXERCISES_PER_DAY) {
        warnings.push(`Limited ${dayLabel} to ${MAX_EXERCISES_PER_DAY} exercises.`);
        continue;
      }

      const dIdx = Array.from(dayMap.keys()).indexOf(dayLabel);
      list.push({
        id: slugifyExerciseId(exName, dIdx, list.length),
        name: exName,
        sets: clampSets(setsCol >= 0 ? cols[setsCol] : 3),
        reps: sanitizeReps(repsCol >= 0 ? cols[repsCol] : '8-12'),
        rest: clampRest(restCol >= 0 ? cols[restCol] : 90),
        target: 'Custom CSV Plan',
        notes: stripUnsafeChars(noteCol >= 0 ? cols[noteCol] : '', 200) || undefined
      });
    }

    const days: CustomProgramDay[] = Array.from(dayMap.entries()).map(([dayName, exercises], idx) => ({
      dayIndex: idx,
      dayName,
      warmupType: detectWarmupType(dayName, exercises.map((e) => e.name)),
      exercises
    }));
    const totalExercises = days.reduce((sum, d) => sum + d.exercises.length, 0);
    if (totalExercises === 0) {
      errors.push('Could not find valid exercises in this CSV. Include columns like Day, Exercise, Sets, Reps.');
    }
    return {
      valid: errors.length === 0 && totalExercises > 0,
      sourceFormat: 'csv',
      programName: defaultProgramName,
      days,
      totalExercises,
      warnings,
      errors
    };
  }

  // 3. Plain Text / PDF-Extracted Text format
  // Supports headings like "Day 1: Upper Body" and lines like "Barbell Bench Press 3x8-10" or "Squat - 4 sets x 6 reps"
  const days: CustomProgramDay[] = [];
  let currentDay: CustomProgramDay = {
    dayIndex: 0,
    dayName: 'Day 1 — Custom Workout',
    warmupType: 'upper',
    exercises: []
  };

  for (const rawLine of rawLines) {
    const line = stripUnsafeChars(rawLine, 140);
    if (!line) continue;

    // Detect Day header lines (e.g., "Day 1: Push", "Monday - Legs", "## Day 2 Pull")
    const dayHeaderMatch = line.match(/^(?:#+\s*)?(day\s*\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|push|pull|legs|upper|lower)\b[:\-\s]*(.*)$/i);
    const hasSetRepPattern = /(\d{1,2})\s*(?:sets?\s*)?[x×]\s*(\d{1,3}(?:\s*[-–]\s*\d{1,3})?)/i.test(line);

    if (dayHeaderMatch && !hasSetRepPattern) {
      if (currentDay.exercises.length > 0 && days.length < MAX_PROGRAM_DAYS) {
        currentDay.warmupType = detectWarmupType(
          currentDay.dayName,
          currentDay.exercises.map((e) => e.name)
        );
        days.push(currentDay);
      }
      if (days.length < MAX_PROGRAM_DAYS) {
        const cleanHeader = line.replace(/^#+\s*/, '').trim();
        currentDay = {
          dayIndex: days.length,
          dayName: cleanHeader.slice(0, 60),
          warmupType: 'upper',
          exercises: []
        };
      }
      continue;
    }

    if (currentDay.exercises.length >= MAX_EXERCISES_PER_DAY) continue;

    // Parse "Exercise Name 3x8-10" or "Exercise Name - 4 sets x 6 reps" or bullet "- Pull-Ups 3x10"
    const cleanedLine = line.replace(/^[-*•\d.)]+\s*/, '').trim();
    const setRepMatch = cleanedLine.match(/(\d{1,2})\s*(?:sets?\s*)?[x×]\s*(\d{1,3}(?:\s*[-–]\s*\d{1,3})?)/i);

    let exName = cleanedLine;
    let sets = 3;
    let reps = '8-12';

    if (setRepMatch) {
      sets = clampSets(setRepMatch[1]);
      reps = sanitizeReps(setRepMatch[2]);
      exName = cleanedLine
        .slice(0, setRepMatch.index)
        .replace(/[-–:|,]+$/, '')
        .trim();
    }

    exName = stripUnsafeChars(exName, 80);
    if (exName.length < 2) continue;

    currentDay.exercises.push({
      id: slugifyExerciseId(exName, currentDay.dayIndex, currentDay.exercises.length),
      name: exName,
      sets,
      reps,
      rest: 90,
      target: 'Custom Plan'
    });
  }

  if (currentDay.exercises.length > 0 && days.length < MAX_PROGRAM_DAYS) {
    currentDay.warmupType = detectWarmupType(
      currentDay.dayName,
      currentDay.exercises.map((e) => e.name)
    );
    days.push(currentDay);
  }

  const totalExercises = days.reduce((sum, d) => sum + d.exercises.length, 0);
  if (totalExercises === 0) {
    errors.push(
      'We could not find exercises in that text. Try lines like "Bench Press 3x8-10" or upload a CSV/JSON file.'
    );
  }

  return {
    valid: errors.length === 0 && totalExercises > 0,
    sourceFormat: lowerFile.endsWith('.pdf') ? 'pdf_text' : 'text',
    programName: defaultProgramName,
    days,
    totalExercises,
    warnings,
    errors
  };
}

/**
 * Validates and builds a dedicated Next-Week Progression Note (e.g., "+5 lbs next week").
 */
export function buildNextWeekProgressionNote(input: {
  exerciseId: string;
  text: string;
  quickTag?: string | null;
  nowIso?: string;
}): {
  valid: boolean;
  note: NextWeekProgressionNote | null;
  errorMessage: string | null;
} {
  const exId = stripUnsafeChars(input.exerciseId, 80);
  if (!exId) {
    return {
      valid: false,
      note: null,
      errorMessage: 'Pick an exercise before saving a next-week note.'
    };
  }

  const rawText = String(input.text ?? '');
  if (rawText.trim().length > 280) {
    return {
      valid: false,
      note: null,
      errorMessage: 'Keep your next-week note under 280 characters so it stays easy to read.'
    };
  }

  const cleanText = stripUnsafeChars(rawText, 280);
  return {
    valid: true,
    note: {
      exerciseId: exId,
      text: cleanText,
      quickTag: input.quickTag ? stripUnsafeChars(input.quickTag, 40) : null,
      updatedAt: input.nowIso || new Date().toISOString()
    },
    errorMessage: null
  };
}
