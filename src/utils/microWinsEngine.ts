export type MicroWinCategory =
  | 'heaviest_weight'
  | 'highest_reps'
  | 'highest_volume'
  | 'improved_e1rm';

export interface MicroWinAchievement {
  category: MicroWinCategory;
  title: string;
  exerciseId: string;
  exerciseName: string;
  previousBest: number;
  newBest: number;
  unit: string;
  deltaLabel: string;
  eli12Message: string;
}

export interface SessionSetInput {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  unit?: 'lbs' | 'kg';
}

export interface MicroWinsSummary {
  totalSetsCompleted: number;
  totalSessionVolume: number;
  unit: 'lbs' | 'kg';
  wins: MicroWinAchievement[];
  hasAnyPr: boolean;
  headline: string;
}

export function calculateEstimated1RM(weight: number, reps: number): number {
  const safeW = Number(weight) || 0;
  const safeR = Math.max(0, Math.min(30, Number(reps) || 0));
  if (safeW <= 0 || safeR <= 0) return 0;
  if (safeR === 1) return Math.round(safeW * 10) / 10;
  return Math.round(safeW * (1 + safeR / 30) * 10) / 10;
}

function normalizeToLbs(weight: number, unit?: string): number {
  if (unit === 'kg') return Math.round(weight * 2.20462 * 10) / 10;
  return Number(weight) || 0;
}

function fromLbs(weightLbs: number, targetUnit: 'lbs' | 'kg'): number {
  if (targetUnit === 'kg') return Math.round((weightLbs / 2.20462) * 10) / 10;
  return Math.round(weightLbs * 10) / 10;
}

export function evaluateSessionMicroWins(options: {
  currentSessionSets: SessionSetInput[];
  priorWorkoutLogs?: Record<string, any> | null;
  priorExerciseHistory?: Record<string, any[]> | null;
  currentWeek?: number;
  currentDayIdx?: number;
  displayUnit?: 'lbs' | 'kg';
}): MicroWinsSummary {
  const unit: 'lbs' | 'kg' = options.displayUnit === 'kg' ? 'kg' : 'lbs';
  const sessionSets = (options.currentSessionSets || []).filter(
    (s) => Number(s.reps) > 0 && Number(s.weight) >= 0
  );

  const sessionByEx = new Map<
    string,
    {
      name: string;
      maxWeightLbs: number;
      maxReps: number;
      totalVolumeLbs: number;
      maxE1RmLbs: number;
    }
  >();

  let totalSessionVolumeLbs = 0;

  sessionSets.forEach((s) => {
    const wLbs = normalizeToLbs(s.weight, s.unit || unit);
    const reps = Math.max(0, Math.floor(Number(s.reps) || 0));
    const vol = wLbs * reps;
    const e1rm = calculateEstimated1RM(wLbs, reps);
    totalSessionVolumeLbs += vol;

    const existing = sessionByEx.get(s.exerciseId) || {
      name: s.exerciseName || s.exerciseId,
      maxWeightLbs: 0,
      maxReps: 0,
      totalVolumeLbs: 0,
      maxE1RmLbs: 0
    };
    existing.maxWeightLbs = Math.max(existing.maxWeightLbs, wLbs);
    existing.maxReps = Math.max(existing.maxReps, reps);
    existing.totalVolumeLbs += vol;
    existing.maxE1RmLbs = Math.max(existing.maxE1RmLbs, e1rm);
    sessionByEx.set(s.exerciseId, existing);
  });

  const priorByEx = new Map<
    string,
    {
      maxWeightLbs: number;
      maxReps: number;
      maxSessionVolumeLbs: number;
      maxE1RmLbs: number;
    }
  >();

  const priorSessionVolumesByExDay = new Map<string, number>();

  const currentPrefix =
    options.currentWeek !== undefined && options.currentDayIdx !== undefined
      ? `w${options.currentWeek}_${options.currentDayIdx}_`
      : null;

  const ensurePrior = (exId: string) => {
    let rec = priorByEx.get(exId);
    if (!rec) {
      rec = { maxWeightLbs: 0, maxReps: 0, maxSessionVolumeLbs: 0, maxE1RmLbs: 0 };
      priorByEx.set(exId, rec);
    }
    return rec;
  };

  Object.entries(options.priorWorkoutLogs || {}).forEach(([key, entry]) => {
    if (!entry || (entry.done !== true && entry.isLogged !== true)) return;
    if (currentPrefix && key.startsWith(currentPrefix)) return;
    const match = key.match(/^w(\d+)_(\d+)_(.+)_(\d+)$/);
    if (!match) return;
    const wNum = match[1];
    const dNum = match[2];
    const exId = match[3];
    const wLbs = normalizeToLbs(parseFloat(entry.weight) || 0, entry.unit || 'lbs');
    const reps = parseInt(entry.reps, 10) || 0;
    if (reps <= 0) return;

    const rec = ensurePrior(exId);
    rec.maxWeightLbs = Math.max(rec.maxWeightLbs, wLbs);
    rec.maxReps = Math.max(rec.maxReps, reps);
    rec.maxE1RmLbs = Math.max(rec.maxE1RmLbs, calculateEstimated1RM(wLbs, reps));

    const dayExKey = `${exId}::w${wNum}_d${dNum}`;
    const nextVol = (priorSessionVolumesByExDay.get(dayExKey) || 0) + wLbs * reps;
    priorSessionVolumesByExDay.set(dayExKey, nextVol);
    rec.maxSessionVolumeLbs = Math.max(rec.maxSessionVolumeLbs, nextVol);
  });

  Object.entries(options.priorExerciseHistory || {}).forEach(([exId, rows]) => {
    if (!Array.isArray(rows)) return;
    const rec = ensurePrior(exId);
    const byDateVol = new Map<string, number>();
    rows.forEach((pt) => {
      if (!pt) return;
      const wLbs = normalizeToLbs(Number(pt.weight) || 0, pt.unit || 'lbs');
      const reps = Math.floor(Number(pt.reps) || 0);
      if (reps <= 0) return;
      rec.maxWeightLbs = Math.max(rec.maxWeightLbs, wLbs);
      rec.maxReps = Math.max(rec.maxReps, reps);
      rec.maxE1RmLbs = Math.max(rec.maxE1RmLbs, calculateEstimated1RM(wLbs, reps));
      const dt = String(pt.date || 'hist');
      const nextVol = (byDateVol.get(dt) || 0) + wLbs * reps;
      byDateVol.set(dt, nextVol);
      rec.maxSessionVolumeLbs = Math.max(rec.maxSessionVolumeLbs, nextVol);
    });
  });

  const wins: MicroWinAchievement[] = [];

  sessionByEx.forEach((cur, exId) => {
    const prev = priorByEx.get(exId) || {
      maxWeightLbs: 0,
      maxReps: 0,
      maxSessionVolumeLbs: 0,
      maxE1RmLbs: 0
    };

    if (cur.maxWeightLbs > 0 && cur.maxWeightLbs > prev.maxWeightLbs) {
      const prevDisp = fromLbs(prev.maxWeightLbs, unit);
      const newDisp = fromLbs(cur.maxWeightLbs, unit);
      const diff = Math.round((newDisp - prevDisp) * 10) / 10;
      wins.push({
        category: 'heaviest_weight',
        title: 'Heaviest Weight Lifted',
        exerciseId: exId,
        exerciseName: cur.name,
        previousBest: prevDisp,
        newBest: newDisp,
        unit,
        deltaLabel: prevDisp > 0 ? `+${diff} ${unit}` : `First PR: ${newDisp} ${unit}`,
        eli12Message:
          prevDisp > 0
            ? `You lifted ${newDisp} ${unit} on ${cur.name}. That beats your old best of ${prevDisp} ${unit}!`
            : `New starting weight record: ${newDisp} ${unit} on ${cur.name}!`
      });
    }

    if (cur.maxReps > 0 && cur.maxReps > prev.maxReps) {
      const diff = cur.maxReps - prev.maxReps;
      wins.push({
        category: 'highest_reps',
        title: 'Highest Rep Count',
        exerciseId: exId,
        exerciseName: cur.name,
        previousBest: prev.maxReps,
        newBest: cur.maxReps,
        unit: 'reps',
        deltaLabel: prev.maxReps > 0 ? `+${diff} reps` : `${cur.maxReps} reps`,
        eli12Message:
          prev.maxReps > 0
            ? `You hit ${cur.maxReps} reps in one set on ${cur.name}. That is ${diff} more than before!`
            : `New rep record: ${cur.maxReps} reps on ${cur.name}!`
      });
    }

    if (cur.totalVolumeLbs > 0 && cur.totalVolumeLbs > prev.maxSessionVolumeLbs) {
      const prevDisp = Math.round(fromLbs(prev.maxSessionVolumeLbs, unit));
      const newDisp = Math.round(fromLbs(cur.totalVolumeLbs, unit));
      const diff = newDisp - prevDisp;
      wins.push({
        category: 'highest_volume',
        title: 'Highest Total Volume',
        exerciseId: exId,
        exerciseName: cur.name,
        previousBest: prevDisp,
        newBest: newDisp,
        unit,
        deltaLabel: prevDisp > 0 ? `+${diff.toLocaleString()} ${unit}` : `${newDisp.toLocaleString()} ${unit}`,
        eli12Message:
          prevDisp > 0
            ? `Total work on ${cur.name} reached ${newDisp.toLocaleString()} ${unit} (+${diff.toLocaleString()} ${unit}).`
            : `New volume record: ${newDisp.toLocaleString()} ${unit} on ${cur.name}!`
      });
    }

    if (cur.maxE1RmLbs > 0 && cur.maxE1RmLbs > prev.maxE1RmLbs) {
      const prevDisp = fromLbs(prev.maxE1RmLbs, unit);
      const newDisp = fromLbs(cur.maxE1RmLbs, unit);
      const diff = Math.round((newDisp - prevDisp) * 10) / 10;
      wins.push({
        category: 'improved_e1rm',
        title: 'Improved Estimated 1-Rep Max',
        exerciseId: exId,
        exerciseName: cur.name,
        previousBest: prevDisp,
        newBest: newDisp,
        unit,
        deltaLabel: prevDisp > 0 ? `+${diff} ${unit} est. 1RM` : `${newDisp} ${unit} est. 1RM`,
        eli12Message:
          prevDisp > 0
            ? `Your estimated 1-rep max on ${cur.name} rose from ${prevDisp} to ${newDisp} ${unit}!`
            : `Your estimated 1-rep max on ${cur.name} is ${newDisp} ${unit}!`
      });
    }
  });

  const totalDisplayVolume = Math.round(fromLbs(totalSessionVolumeLbs, unit));
  const headline =
    wins.length > 0
      ? `You earned ${wins.length} new personal ${wins.length === 1 ? 'record' : 'records'} today!`
      : 'Great workout! Every completed set builds strength.';

  return {
    totalSetsCompleted: sessionSets.length,
    totalSessionVolume: totalDisplayVolume,
    unit,
    wins,
    hasAnyPr: wins.length > 0,
    headline
  };
}
