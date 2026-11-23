export type SupportedCsvSourceApp = 'strong' | 'hevy' | 'fitbod' | 'generic';

export interface ImportedSetRecord {
  dateIso: string;
  workoutTitle: string;
  sourceExerciseName: string;
  mappedExerciseId: string;
  mappedExerciseName: string;
  setOrder: number;
  weightLbs: number;
  reps: number;
  unit: 'lbs' | 'kg';
}

export interface CsvImportResult {
  detectedApp: SupportedCsvSourceApp;
  totalRowsParsed: number;
  importedSetsCount: number;
  skippedRowsCount: number;
  uniqueExercises: string[];
  sets: ImportedSetRecord[];
  workoutLogsPatch: Record<string, { weight: string; reps: string; done: boolean; isLogged: boolean; unit: 'lbs' | 'kg'; importedFrom: SupportedCsvSourceApp; date: string }>;
  exerciseHistoryPatch: Record<string, Array<{ date: string; weight: number; reps: number; unit: 'lbs' | 'kg'; source: SupportedCsvSourceApp }>>;
  errors: string[];
}

const EXERCISE_NAME_MAP: Array<{ pattern: RegExp; id: string; canonicalName: string }> = [
  { pattern: /\b(bench\s+press|flat\s+bench|barbell\s+bench)\b/i, id: 'bench_press', canonicalName: 'Barbell Bench Press' },
  { pattern: /\b(incline\s+dumbbell|incline\s+bench|incline\s+press)\b/i, id: 'incline_db_press', canonicalName: 'Incline Dumbbell Press' },
  { pattern: /\b(back\s+squat|barbell\s+squat|squat\s*\(barbell\)|^squat$)\b/i, id: 'barbell_squat', canonicalName: 'Barbell Back Squat' },
  { pattern: /\b(leg\s+press)\b/i, id: 'leg_press', canonicalName: 'Leg Press Machine' },
  { pattern: /\b(romanian\s+deadlift|rdl)\b/i, id: 'romanian_deadlift', canonicalName: 'Romanian Deadlift' },
  { pattern: /\b(deadlift)\b/i, id: 'barbell_deadlift', canonicalName: 'Barbell Deadlift' },
  { pattern: /\b(pull[- ]?up|chin[- ]?up)\b/i, id: 'day1_pullups', canonicalName: 'Overhand Pull-Ups' },
  { pattern: /\b(lat\s+pulldown)\b/i, id: 'lat_pulldown', canonicalName: 'Lat Pulldown' },
  { pattern: /\b(seated\s+cable\s+row|cable\s+row|barbell\s+row|bent\s+over\s+row)\b/i, id: 'seated_cable_row', canonicalName: 'Seated Cable Row' },
  { pattern: /\b(overhead\s+press|shoulder\s+press|military\s+press|ohp)\b/i, id: 'overhead_press', canonicalName: 'Barbell Overhead Press' },
  { pattern: /\b(lateral\s+raise)\b/i, id: 'lateral_raise', canonicalName: 'Dumbbell Lateral Raise' },
  { pattern: /\b(face\s+pull)\b/i, id: 'face_pull', canonicalName: 'Cable Face Pull' },
  { pattern: /\b(bicep\s+curl|barbell\s+curl|dumbbell\s+curl|hammer\s+curl)\b/i, id: 'bicep_curl', canonicalName: 'Dumbbell Bicep Curl' },
  { pattern: /\b(tricep\s+pushdown|triceps\s+pushdown|cable\s+pushdown)\b/i, id: 'tricep_pushdown', canonicalName: 'Cable Tricep Pushdown' },
  { pattern: /\b(cable\s+crunch|ab\s+crunch)\b/i, id: 'cable_ab_crunch', canonicalName: 'Cable Abdominal Crunch' },
  { pattern: /\b(leg\s+curl|hamstring\s+curl)\b/i, id: 'seated_leg_curl', canonicalName: 'Seated Leg Curl' },
  { pattern: /\b(calf\s+raise)\b/i, id: 'calf_raise', canonicalName: 'Standing Calf Raise' }
];

export function mapExternalExerciseToSchema(rawName: string): { id: string; canonicalName: string } {
  const clean = String(rawName || '').trim();
  for (const entry of EXERCISE_NAME_MAP) {
    if (entry.pattern.test(clean)) {
      return { id: entry.id, canonicalName: entry.canonicalName };
    }
  }
  const slug = clean
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return {
    id: slug ? `imported_${slug}` : 'imported_exercise',
    canonicalName: clean || 'Imported Exercise'
  };
}

export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const text = String(csvText || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === ';') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

export function detectCsvSourceApp(headers: string[]): SupportedCsvSourceApp {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const joined = lower.join('|');
  if (lower.includes('start_time') && lower.includes('exercise_title') && (lower.includes('weight_lbs') || lower.includes('weight_kg'))) {
    return 'hevy';
  }
  if (lower.includes('workout name') && lower.includes('exercise name') && lower.includes('set order')) {
    return 'strong';
  }
  if (joined.includes('iswarmup') || (lower.includes('exercise') && lower.includes('weight(kg)') && lower.includes('reps'))) {
    return 'fitbod';
  }
  return 'generic';
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const cand of candidates) {
    const idx = normalized.indexOf(cand.toLowerCase());
    if (idx !== -1) return idx;
  }
  for (const cand of candidates) {
    const idx = normalized.findIndex((h) => h.includes(cand.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseWorkoutHistoryCsv(
  csvText: string,
  options?: { targetWeek?: number; defaultUnit?: 'lbs' | 'kg' }
): CsvImportResult {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return {
      detectedApp: 'generic',
      totalRowsParsed: 0,
      importedSetsCount: 0,
      skippedRowsCount: 0,
      uniqueExercises: [],
      sets: [],
      workoutLogsPatch: {},
      exerciseHistoryPatch: {},
      errors: ['CSV file is empty or missing data rows.']
    };
  }

  const headers = rows[0];
  const detectedApp = detectCsvSourceApp(headers);

  const dateIdx = findHeaderIndex(headers, ['date', 'start_time', 'workout date']);
  const workoutIdx = findHeaderIndex(headers, ['workout name', 'title', 'workout']);
  const exIdx = findHeaderIndex(headers, ['exercise name', 'exercise_title', 'exercise']);
  const setOrderIdx = findHeaderIndex(headers, ['set order', 'set_index', 'set']);
  const weightLbsIdx = findHeaderIndex(headers, ['weight_lbs', 'weight (lbs)', 'weight(lbs)']);
  const weightKgIdx = findHeaderIndex(headers, ['weight_kg', 'weight(kg)', 'weight (kg)']);
  const weightGenericIdx = findHeaderIndex(headers, ['weight']);
  const repsIdx = findHeaderIndex(headers, ['reps', 'rep']);
  const warmupIdx = findHeaderIndex(headers, ['iswarmup', 'set_type']);

  if (exIdx === -1 || repsIdx === -1) {
    return {
      detectedApp,
      totalRowsParsed: rows.length - 1,
      importedSetsCount: 0,
      skippedRowsCount: rows.length - 1,
      uniqueExercises: [],
      sets: [],
      workoutLogsPatch: {},
      exerciseHistoryPatch: {},
      errors: ['Could not find Exercise or Reps columns. Upload a CSV export from Strong, Hevy, or Fitbod.']
    };
  }

  const sets: ImportedSetRecord[] = [];
  const errors: string[] = [];
  let skippedRowsCount = 0;

  const uniqueExSet = new Set<string>();
  const workoutLogsPatch: CsvImportResult['workoutLogsPatch'] = {};
  const exerciseHistoryPatch: CsvImportResult['exerciseHistoryPatch'] = {};
  const dateDayMap = new Map<string, number>();
  const setCounterPerDayEx = new Map<string, number>();

  const targetWeek = Math.max(1, Math.min(12, Math.floor(Number(options?.targetWeek) || 1)));

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const rawEx = cols[exIdx] || '';
    if (!rawEx) {
      skippedRowsCount += 1;
      continue;
    }

    if (warmupIdx !== -1) {
      const wFlag = String(cols[warmupIdx] || '').trim().toLowerCase();
      if (wFlag === 'true' || wFlag === 'warmup') {
        skippedRowsCount += 1;
        continue;
      }
    }

    const reps = parseInt(String(cols[repsIdx] || '0').replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(reps) || reps <= 0) {
      skippedRowsCount += 1;
      continue;
    }

    let unit: 'lbs' | 'kg' = options?.defaultUnit || 'lbs';
    let rawWeight = 0;
    if (weightLbsIdx !== -1 && cols[weightLbsIdx] !== '') {
      rawWeight = parseFloat(cols[weightLbsIdx]);
      unit = 'lbs';
    } else if (weightKgIdx !== -1 && cols[weightKgIdx] !== '') {
      rawWeight = parseFloat(cols[weightKgIdx]);
      unit = 'kg';
    } else if (weightGenericIdx !== -1 && cols[weightGenericIdx] !== '') {
      rawWeight = parseFloat(cols[weightGenericIdx]);
    }
    if (!Number.isFinite(rawWeight) || rawWeight < 0) rawWeight = 0;

    const weightLbs = unit === 'kg' ? Math.round(rawWeight * 2.20462 * 2) / 2 : Math.round(rawWeight * 2) / 2;
    const rawDate = dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx] : new Date().toISOString().slice(0, 10);
    const parsedTime = Date.parse(rawDate);
    const dateIso = Number.isFinite(parsedTime)
      ? new Date(parsedTime).toISOString().slice(0, 10)
      : rawDate.slice(0, 10);

    const mapped = mapExternalExerciseToSchema(rawEx);
    uniqueExSet.add(mapped.canonicalName);

    if (!dateDayMap.has(dateIso)) {
      dateDayMap.set(dateIso, Math.min(6, dateDayMap.size));
    }
    const dayIdx = dateDayMap.get(dateIso) ?? 0;

    const countKey = `${dayIdx}_${mapped.id}`;
    const parsedSetOrder = setOrderIdx !== -1 ? parseInt(cols[setOrderIdx] || '', 10) : NaN;
    const nextOrder =
      Number.isFinite(parsedSetOrder) && parsedSetOrder >= 1
        ? parsedSetOrder
        : (setCounterPerDayEx.get(countKey) || 0) + 1;
    const finalSetOrder =
      detectedApp === 'hevy' && setOrderIdx !== -1 && cols[setOrderIdx] === '0'
        ? 1
        : detectedApp === 'hevy' && Number.isFinite(parsedSetOrder) && parsedSetOrder >= 0
          ? parsedSetOrder + 1
          : nextOrder;

    setCounterPerDayEx.set(countKey, Math.max(setCounterPerDayEx.get(countKey) || 0, finalSetOrder));

    const record: ImportedSetRecord = {
      dateIso,
      workoutTitle: workoutIdx !== -1 && cols[workoutIdx] ? cols[workoutIdx] : `${detectedApp.toUpperCase()} Import`,
      sourceExerciseName: rawEx,
      mappedExerciseId: mapped.id,
      mappedExerciseName: mapped.canonicalName,
      setOrder: finalSetOrder,
      weightLbs,
      reps,
      unit
    };
    sets.push(record);

    const logKey = `w${targetWeek}_${dayIdx}_${mapped.id}_${finalSetOrder}`;
    workoutLogsPatch[logKey] = {
      weight: String(weightLbs),
      reps: String(reps),
      done: true,
      isLogged: true,
      unit: 'lbs',
      importedFrom: detectedApp,
      date: dateIso
    };

    if (!exerciseHistoryPatch[mapped.id]) {
      exerciseHistoryPatch[mapped.id] = [];
    }
    exerciseHistoryPatch[mapped.id].push({
      date: dateIso,
      weight: weightLbs,
      reps,
      unit: 'lbs',
      source: detectedApp
    });
  }

  return {
    detectedApp,
    totalRowsParsed: rows.length - 1,
    importedSetsCount: sets.length,
    skippedRowsCount,
    uniqueExercises: Array.from(uniqueExSet),
    sets,
    workoutLogsPatch,
    exerciseHistoryPatch,
    errors
  };
}

export function mergeImportedHistoryIntoGymState<T extends Record<string, any>>(
  stateObj: T,
  importResult: CsvImportResult
): { nextState: T; addedLogsCount: number; addedHistoryPoints: number } {
  const nextState = { ...stateObj } as Record<string, any>;
  nextState.workoutLogs = { ...(nextState.workoutLogs || {}) };
  nextState.exerciseHistory = { ...(nextState.exerciseHistory || {}) };

  let addedLogsCount = 0;
  for (const [key, entry] of Object.entries(importResult.workoutLogsPatch || {})) {
    const existing = nextState.workoutLogs[key];
    if (!existing || (!existing.done && !existing.isLogged)) {
      nextState.workoutLogs[key] = entry;
      addedLogsCount += 1;
    }
  }

  let addedHistoryPoints = 0;
  for (const [exId, rows] of Object.entries(importResult.exerciseHistoryPatch || {})) {
    const existingArr = Array.isArray(nextState.exerciseHistory[exId]) ? [...nextState.exerciseHistory[exId]] : [];
    rows.forEach((pt) => {
      existingArr.push(pt);
      addedHistoryPoints += 1;
    });
    nextState.exerciseHistory[exId] = existingArr;
  }

  return {
    nextState: nextState as T,
    addedLogsCount,
    addedHistoryPoints
  };
}
