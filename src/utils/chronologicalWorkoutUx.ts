import { calculateWcagContrastRatio } from './themeProvider';

export const MIN_WCAG_TOUCH_TARGET_PX = 44;

export interface WcagColorPair {
  fg: string;
  bg: string;
  border: string;
  minRatio: number;
}

export const WCAG_CHRONOLOGICAL_PALETTE: Record<
  'dark' | 'light',
  {
    restDayButton: WcagColorPair;
    resetWorkoutButton: WcagColorPair;
    progressLabel: WcagColorPair;
    progressPercent: WcagColorPair;
    microStartButton: WcagColorPair;
    exerciseGearChipChecked: WcagColorPair;
    exerciseGearChipIdle: WcagColorPair;
  }
> = {
  dark: {
    restDayButton: {
      fg: '#FEF08A',
      bg: '#1E1E1E',
      border: '#FDE047',
      minRatio: 4.5
    },
    resetWorkoutButton: {
      fg: '#FECDD3',
      bg: '#2A1215',
      border: '#FDA4AF',
      minRatio: 4.5
    },
    progressLabel: {
      fg: '#86EFAC',
      bg: '#0F172A',
      border: '#334155',
      minRatio: 4.5
    },
    progressPercent: {
      fg: '#BBF7D0',
      bg: '#0F172A',
      border: '#334155',
      minRatio: 4.5
    },
    microStartButton: {
      fg: '#FFFFFF',
      bg: '#166534',
      border: '#86EFAC',
      minRatio: 4.5
    },
    exerciseGearChipChecked: {
      fg: '#052E16',
      bg: '#86EFAC',
      border: '#4ADE80',
      minRatio: 4.5
    },
    exerciseGearChipIdle: {
      fg: '#F8FAFC',
      bg: '#1E293B',
      border: '#64748B',
      minRatio: 4.5
    }
  },
  light: {
    restDayButton: {
      fg: '#713F12',
      bg: '#FEF9C3',
      border: '#CA8A04',
      minRatio: 4.5
    },
    resetWorkoutButton: {
      fg: '#9F1239',
      bg: '#FFF1F2',
      border: '#E11D48',
      minRatio: 4.5
    },
    progressLabel: {
      fg: '#065F46',
      bg: '#FFFFFF',
      border: '#CBD5E1',
      minRatio: 4.5
    },
    progressPercent: {
      fg: '#047857',
      bg: '#FFFFFF',
      border: '#CBD5E1',
      minRatio: 4.5
    },
    microStartButton: {
      fg: '#FFFFFF',
      bg: '#166534',
      border: '#14532D',
      minRatio: 4.5
    },
    exerciseGearChipChecked: {
      fg: '#052E16',
      bg: '#BBF7D0',
      border: '#15803D',
      minRatio: 4.5
    },
    exerciseGearChipIdle: {
      fg: '#0E1A40',
      bg: '#F8FAFC',
      border: '#64748B',
      minRatio: 4.5
    }
  }
};

export interface ContrastAuditRow {
  theme: 'dark' | 'light';
  token: string;
  fg: string;
  bg: string;
  ratio: number;
  passes: boolean;
}

export function verifyChronologicalWcagContrast(): {
  allPass: boolean;
  results: ContrastAuditRow[];
} {
  const results: ContrastAuditRow[] = [];
  (['dark', 'light'] as const).forEach((theme) => {
    const palette = WCAG_CHRONOLOGICAL_PALETTE[theme];
    (Object.keys(palette) as Array<keyof typeof palette>).forEach((token) => {
      const pair = palette[token];
      const ratio = Number(calculateWcagContrastRatio(pair.fg, pair.bg).toFixed(2));
      results.push({
        theme,
        token,
        fg: pair.fg,
        bg: pair.bg,
        ratio,
        passes: ratio >= pair.minRatio
      });
    });
  });

  return {
    allPass: results.every((row) => row.passes),
    results
  };
}

export interface ArrivalLockerChecklistItem {
  id: string;
  label: string;
  shortLabel: string;
}

export const ARRIVAL_LOCKER_CHECKLIST_ITEMS: ArrivalLockerChecklistItem[] = [
  { id: 'locker_locked', label: 'Locker Locked & Pin Saved', shortLabel: 'Locker Locked' },
  { id: 'bottle_filled', label: 'Water Bottle Filled', shortLabel: 'Bottle Filled' },
  { id: 'headphones_towel', label: 'Headphones & Towel Ready', shortLabel: 'Headphones & Towel' }
];

export interface ExerciseGearItem {
  id: string;
  label: string;
}

export interface ResolveExerciseGearInput {
  id?: string;
  name?: string;
  equipType?: string;
  isPullup?: boolean;
  isCardio?: boolean;
}

export function resolveExerciseSpecificGear(input: ResolveExerciseGearInput): ExerciseGearItem[] {
  const idLower = String(input?.id || '').toLowerCase();
  const nameLower = String(input?.name || '').toLowerCase();
  const equipLower = String(input?.equipType || '').toLowerCase();
  const combined = `${idLower} ${nameLower} ${equipLower}`;

  if (input?.isPullup || combined.includes('pull-up') || combined.includes('pullup') || combined.includes('chin-up')) {
    return [
      { id: 'chalk', label: 'Chalk' },
      { id: 'dip_belt', label: 'Dip Belt' },
      { id: 'resistance_band', label: 'Assist Band' },
      { id: 'lifting_straps', label: 'Lifting Straps' }
    ];
  }

  if (input?.isCardio || combined.includes('treadmill') || combined.includes('bike') || combined.includes('run') || combined.includes('cardio') || combined.includes('walk')) {
    return [
      { id: 'gym_shoes', label: 'Gym Shoes' },
      { id: 'sweat_towel', label: 'Towel' }
    ];
  }

  if (combined.includes('hip thrust') || combined.includes('glute bridge')) {
    return [
      { id: 'barbell_pad', label: 'Barbell Pad' },
      { id: 'flat_shoes', label: 'Flat Shoes' }
    ];
  }

  if (combined.includes('squat') || combined.includes('leg press') || combined.includes('hack squat') || combined.includes('lunge') || combined.includes('split squat')) {
    return [
      { id: 'lifting_belt', label: 'Lifting Belt' },
      { id: 'knee_sleeves', label: 'Knee Sleeves' },
      { id: 'flat_shoes', label: 'Flat Shoes' }
    ];
  }

  if (combined.includes('deadlift') || combined.includes('rdl') || combined.includes('romanian')) {
    return [
      { id: 'lifting_belt', label: 'Lifting Belt' },
      { id: 'lifting_straps', label: 'Lifting Straps' },
      { id: 'chalk', label: 'Chalk' }
    ];
  }

  if (combined.includes('row') || combined.includes('pulldown') || combined.includes('pull-down') || combined.includes('shrug') || /\blat\b/.test(combined)) {
    return [
      { id: 'lifting_straps', label: 'Lifting Straps' },
      { id: 'chalk', label: 'Chalk' }
    ];
  }

  if (combined.includes('bench') || combined.includes('press') || combined.includes('dip') || combined.includes('push-up')) {
    return [
      { id: 'wrist_wraps', label: 'Wrist Wraps' },
      { id: 'chalk', label: 'Chalk' }
    ];
  }

  if (combined.includes('cable') || combined.includes('tricep') || combined.includes('bicep') || combined.includes('curl') || combined.includes('face pull') || combined.includes('crunch') || combined.includes('lateral')) {
    return [
      { id: 'cable_attachment', label: 'Rope / Grip Handle' },
      { id: 'wrist_wraps', label: 'Wrist Wraps' }
    ];
  }

  return [
    { id: 'chalk', label: 'Chalk' },
    { id: 'sweat_towel', label: 'Towel' }
  ];
}

export function toggleChecklistKey(
  map: Record<string, boolean> | null | undefined,
  key: string
): { nextMap: Record<string, boolean>; checked: boolean } {
  const safeKey = String(key || '').trim();
  const base: Record<string, boolean> = map && typeof map === 'object' ? { ...map } : {};
  if (!safeKey) {
    return { nextMap: base, checked: false };
  }
  const checked = !Boolean(base[safeKey]);
  base[safeKey] = checked;
  return { nextMap: base, checked };
}

export function shouldShowPullupsInActiveDay(input: {
  isRestDay: boolean;
  pullupViewMode?: 'selected' | 'all' | string;
}): boolean {
  if (input.pullupViewMode === 'all') return true;
  return !Boolean(input.isRestDay);
}
