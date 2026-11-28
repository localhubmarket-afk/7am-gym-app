import {
  ACCESSIBLE_THEME_TOKENS,
  calculateWcagContrastRatio,
  type ResolvedTheme
} from './themeProvider';

export const WCAG_22_AA_THRESHOLDS = {
  normalTextContrast: 4.5,
  largeTextContrast: 3.0,
  nonTextUiContrast: 3.0,
  focusIndicatorContrast: 3.0,
  minTouchTargetPx: 44,
  preferredTouchTargetPx: 48,
  minAdjacentTargetGapPx: 8,
  minBodyFontRem: 1,
  minLineHeight: 1.5,
  mobileReferenceViewportPx: 390
} as const;

export const WCAG_22_FOCUS_HALO_TOKENS = {
  dark: {
    ringHex: '#FACC15',
    innerHaloHex: '#0A0A0A'
  },
  light: {
    ringHex: '#0E1A40',
    innerHaloHex: '#FFFFFF'
  }
} as const;

export const WCAG_22_PLACEHOLDER_TOKENS = {
  dark: '#CBD5E1',
  light: '#475569'
} as const;

export const WCAG_22_DISABLED_TOKENS = {
  dark: {
    bg: '#262626',
    fg: '#CBD5E1',
    border: '#94A3B8'
  },
  light: {
    bg: '#E2E8F0',
    fg: '#334155',
    border: '#64748B'
  }
} as const;

export interface WcagPairCheckResult {
  label: string;
  ratio: number;
  required: number;
  passes: boolean;
}

export function evaluateWcag22ThemeCompliance(mode: ResolvedTheme): {
  mode: ResolvedTheme;
  allPassing: boolean;
  checks: WcagPairCheckResult[];
} {
  const tokens = ACCESSIBLE_THEME_TOKENS[mode];
  const focus = WCAG_22_FOCUS_HALO_TOKENS[mode];
  const placeholder = WCAG_22_PLACEHOLDER_TOKENS[mode];
  const disabled = WCAG_22_DISABLED_TOKENS[mode];

  const rawPairs: Array<{ label: string; hexA: string; hexB: string; required: number }> = [
    {
      label: `${mode}: primary text on canvas`,
      hexA: tokens.textPrimary,
      hexB: tokens.canvasBg,
      required: WCAG_22_AA_THRESHOLDS.normalTextContrast
    },
    {
      label: `${mode}: primary text on surface`,
      hexA: tokens.textPrimary,
      hexB: tokens.surfaceBg,
      required: WCAG_22_AA_THRESHOLDS.normalTextContrast
    },
    {
      label: `${mode}: secondary text on canvas`,
      hexA: tokens.textSecondary,
      hexB: tokens.canvasBg,
      required: WCAG_22_AA_THRESHOLDS.normalTextContrast
    },
    {
      label: `${mode}: secondary text on surfaceAlt`,
      hexA: tokens.textSecondary,
      hexB: tokens.surfaceAltBg,
      required: WCAG_22_AA_THRESHOLDS.normalTextContrast
    },
    {
      label: `${mode}: subtle UI border on canvas`,
      hexA: tokens.borderSubtle,
      hexB: tokens.canvasBg,
      required: WCAG_22_AA_THRESHOLDS.nonTextUiContrast
    },
    {
      label: `${mode}: subtle UI border on surface`,
      hexA: tokens.borderSubtle,
      hexB: tokens.surfaceBg,
      required: WCAG_22_AA_THRESHOLDS.nonTextUiContrast
    },
    {
      label: `${mode}: subtle UI border on surfaceAlt`,
      hexA: tokens.borderSubtle,
      hexB: tokens.surfaceAltBg,
      required: WCAG_22_AA_THRESHOLDS.nonTextUiContrast
    },
    {
      label: `${mode}: strong UI border on surface`,
      hexA: tokens.borderStrong,
      hexB: tokens.surfaceBg,
      required: WCAG_22_AA_THRESHOLDS.nonTextUiContrast
    },
    {
      label: `${mode}: input placeholder on surface`,
      hexA: placeholder,
      hexB: tokens.surfaceBg,
      required: WCAG_22_AA_THRESHOLDS.normalTextContrast
    },
    {
      label: `${mode}: input placeholder on surfaceAlt`,
      hexA: placeholder,
      hexB: tokens.surfaceAltBg,
      required: WCAG_22_AA_THRESHOLDS.normalTextContrast
    },
    {
      label: `${mode}: disabled control text on disabled surface`,
      hexA: disabled.fg,
      hexB: disabled.bg,
      required: WCAG_22_AA_THRESHOLDS.normalTextContrast
    },
    {
      label: `${mode}: disabled control border on surface`,
      hexA: disabled.border,
      hexB: tokens.surfaceBg,
      required: WCAG_22_AA_THRESHOLDS.nonTextUiContrast
    },
    {
      label: `${mode}: focus ring against canvas`,
      hexA: focus.ringHex,
      hexB: tokens.canvasBg,
      required: WCAG_22_AA_THRESHOLDS.focusIndicatorContrast
    },
    {
      label: `${mode}: focus ring against inner halo`,
      hexA: focus.ringHex,
      hexB: focus.innerHaloHex,
      required: WCAG_22_AA_THRESHOLDS.focusIndicatorContrast
    }
  ];

  const checks = rawPairs.map((pair) => {
    const ratio = calculateWcagContrastRatio(pair.hexA, pair.hexB);
    return {
      label: pair.label,
      ratio,
      required: pair.required,
      passes: ratio >= pair.required
    };
  });

  return {
    mode,
    allPassing: checks.every((c) => c.passes),
    checks
  };
}
