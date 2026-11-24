export type ThemeModePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type AccessibilityFontMode = 'default' | 'opendyslexic';

export const THEME_STORAGE_KEY = 'budget_gym_theme_mode_v1';
export const FONT_MODE_STORAGE_KEY = 'budget_gym_font_mode_v1';

export const DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK =
  "'Lexend', 'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif";
export const OPENDYSLEXIC_FONT_STACK =
  "'OpenDyslexic', 'OpenDyslexic3', 'Lexend', 'Atkinson Hyperlegible', sans-serif";

export interface AccessibleThemeTokens {
  canvasBg: string;
  surfaceBg: string;
  surfaceAltBg: string;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
  borderStrong: string;
  accentPrimary: string;
  accentOnPrimary: string;
  warningBg: string;
  warningText: string;
  warningBorder: string;
  dangerBg: string;
  dangerText: string;
  dangerBorder: string;
  themeColorMeta: string;
}

/**
 * Strict WCAG 2.2 AAA Dyslexia-Friendly Contrast Targets:
 * - Light Mode: Off-white paper (#F7F7F7) + deep navy ink (#0E1A40) => strictly 15.8:1 contrast
 * - Dark Mode: Matte charcoal (#141414) + off-white ink (#F8F6F5) => strictly 17.1:1 contrast
 */
export const WCAG_STRICT_CONTRAST_TARGETS = {
  light: 15.8,
  dark: 17.1
} as const;

export const ACCESSIBLE_THEME_TOKENS: Record<ResolvedTheme, AccessibleThemeTokens> = {
  dark: {
    canvasBg: '#141414',
    surfaceBg: '#1E1E1E',
    surfaceAltBg: '#262626',
    textPrimary: '#F8F6F5',
    textSecondary: '#D8D8DE',
    borderSubtle: '#3D3D3D',
    borderStrong: '#767676',
    accentPrimary: '#10B981',
    accentOnPrimary: '#0E1A40',
    warningBg: 'rgba(217, 119, 6, 0.22)',
    warningText: '#FDE68A',
    warningBorder: '#D97706',
    dangerBg: 'rgba(225, 29, 72, 0.22)',
    dangerText: '#FECDD3',
    dangerBorder: '#FB7185',
    themeColorMeta: '#141414'
  },
  light: {
    canvasBg: '#F7F7F7',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#EAECEF',
    textPrimary: '#0E1A40',
    textSecondary: '#1E293B',
    borderSubtle: '#CBD5E1',
    borderStrong: '#475569',
    accentPrimary: '#047857',
    accentOnPrimary: '#FFFFFF',
    warningBg: '#FEF3C7',
    warningText: '#78350F',
    warningBorder: '#B45309',
    dangerBg: '#FFE4E6',
    dangerText: '#881337',
    dangerBorder: '#BE123C',
    themeColorMeta: '#F7F7F7'
  }
};

function hexToRgbChannels(hex: string): [number, number, number] {
  const clean = String(hex || '').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return [r, g, b];
}

function relativeLuminance(hex: string): number {
  const [r8, g8, b8] = hexToRgbChannels(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r8) + 0.7152 * toLinear(g8) + 0.0722 * toLinear(b8);
}

/**
 * Computes the WCAG 2.x contrast ratio between two hex colors.
 */
export function calculateWcagContrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Verifies that Light Mode strictly achieves 15.8:1 and Dark Mode strictly achieves 17.1:1.
 */
export function verifyThemeContrastCompliance(): {
  lightRatio: number;
  darkRatio: number;
  lightTarget: number;
  darkTarget: number;
  isCompliant: boolean;
} {
  const lightRatio = calculateWcagContrastRatio(
    ACCESSIBLE_THEME_TOKENS.light.canvasBg,
    ACCESSIBLE_THEME_TOKENS.light.textPrimary
  );
  const darkRatio = calculateWcagContrastRatio(
    ACCESSIBLE_THEME_TOKENS.dark.canvasBg,
    ACCESSIBLE_THEME_TOKENS.dark.textPrimary
  );
  return {
    lightRatio,
    darkRatio,
    lightTarget: WCAG_STRICT_CONTRAST_TARGETS.light,
    darkTarget: WCAG_STRICT_CONTRAST_TARGETS.dark,
    isCompliant:
      Math.abs(lightRatio - WCAG_STRICT_CONTRAST_TARGETS.light) < 0.05 &&
      Math.abs(darkRatio - WCAG_STRICT_CONTRAST_TARGETS.dark) < 0.05
  };
}

export function normalizeThemeModePreference(raw: unknown): ThemeModePreference {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'light' || s === 'dark' || s === 'system') return s;
  return 'dark';
}

export function normalizeFontModePreference(raw: unknown): AccessibilityFontMode {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'opendyslexic' || s === 'dyslexic' || s === 'true' || s === 'on') {
    return 'opendyslexic';
  }
  return 'default';
}

export function resolveEffectiveTheme(
  preference: ThemeModePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}

export function getSystemPrefersDark(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  } catch {
    // Fallback
  }
  return true;
}

export function loadStoredThemePreference(
  storage?: Pick<Storage, 'getItem'> | null
): ThemeModePreference {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return 'dark';
    const raw = store.getItem(THEME_STORAGE_KEY);
    if (!raw) return 'dark';
    return normalizeThemeModePreference(raw);
  } catch {
    return 'dark';
  }
}

export function saveThemePreference(
  preference: ThemeModePreference,
  storage?: Pick<Storage, 'setItem'> | null
): ThemeModePreference {
  const normalized = normalizeThemeModePreference(preference);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      store.setItem(THEME_STORAGE_KEY, normalized);
    }
  } catch {
    // Ignore storage restriction
  }
  return normalized;
}

export function loadStoredFontPreference(
  storage?: Pick<Storage, 'getItem'> | null
): AccessibilityFontMode {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return 'default';
    const raw = store.getItem(FONT_MODE_STORAGE_KEY);
    if (!raw) return 'default';
    return normalizeFontModePreference(raw);
  } catch {
    return 'default';
  }
}

export function saveFontPreference(
  mode: AccessibilityFontMode,
  storage?: Pick<Storage, 'setItem'> | null
): AccessibilityFontMode {
  const normalized = normalizeFontModePreference(mode);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      store.setItem(FONT_MODE_STORAGE_KEY, normalized);
    }
  } catch {
    // Ignore storage restriction
  }
  return normalized;
}

export function applyThemeToDocument(
  preference: ThemeModePreference,
  doc?: Document | null,
  systemPrefersDark?: boolean
): { preference: ThemeModePreference; resolved: ResolvedTheme; tokens: AccessibleThemeTokens } {
  const normalized = normalizeThemeModePreference(preference);
  const resolved = resolveEffectiveTheme(
    normalized,
    typeof systemPrefersDark === 'boolean' ? systemPrefersDark : getSystemPrefersDark()
  );
  const tokens = ACCESSIBLE_THEME_TOKENS[resolved];

  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  if (targetDoc && targetDoc.documentElement) {
    const html = targetDoc.documentElement;
    html.classList.toggle('dark', resolved === 'dark');
    html.classList.toggle('light-theme', resolved === 'light');
    html.setAttribute('data-theme', resolved);
    html.setAttribute('data-theme-pref', normalized);

    html.style.setProperty('--bg-canvas', tokens.canvasBg);
    html.style.setProperty('--bg-surface', tokens.surfaceBg);
    html.style.setProperty('--bg-surface-alt', tokens.surfaceAltBg);
    html.style.setProperty('--text-primary', tokens.textPrimary);
    html.style.setProperty('--text-secondary', tokens.textSecondary);
    html.style.setProperty('--border-subtle', tokens.borderSubtle);
    html.style.setProperty('--border-strong', tokens.borderStrong);
    html.style.setProperty('--accent-primary', tokens.accentPrimary);
    html.style.setProperty('--accent-on-primary', tokens.accentOnPrimary);
    html.style.setProperty('--danger-bg', tokens.dangerBg);
    html.style.setProperty('--danger-text', tokens.dangerText);
    html.style.setProperty('--danger-border', tokens.dangerBorder);

    const metaTheme = targetDoc.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', tokens.themeColorMeta);
    }
  }

  return { preference: normalized, resolved, tokens };
}

export function applyDyslexiaFontToDocument(
  mode: AccessibilityFontMode,
  doc?: Document | null
): { mode: AccessibilityFontMode; fontFamily: string } {
  const normalized = normalizeFontModePreference(mode);
  const fontFamily =
    normalized === 'opendyslexic' ? OPENDYSLEXIC_FONT_STACK : DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK;

  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  if (targetDoc && targetDoc.documentElement) {
    const html = targetDoc.documentElement;
    html.setAttribute('data-font-mode', normalized);
    html.classList.toggle('font-opendyslexic', normalized === 'opendyslexic');
    html.style.setProperty('--app-font-family', fontFamily);
  }

  return { mode: normalized, fontFamily };
}

export const SENSORY_CALM_STORAGE_KEY = 'budget_gym_sensory_calm_v1';

export function normalizeSensoryCalmPreference(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'on' || s === 'enabled';
}

export function loadStoredSensoryCalmPreference(
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return false;
    return normalizeSensoryCalmPreference(store.getItem(SENSORY_CALM_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function saveSensoryCalmPreference(
  enabled: boolean,
  storage?: Pick<Storage, 'setItem'> | null
): boolean {
  const normalized = Boolean(enabled);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      store.setItem(SENSORY_CALM_STORAGE_KEY, normalized ? 'true' : 'false');
    }
  } catch {
    // Ignore storage restrictions
  }
  return normalized;
}

export function applySensoryCalmToDocument(
  enabled: boolean,
  doc?: Document | null
): { isSensoryCalm: boolean; audioAndHapticsMuted: boolean; layoutStabilityLocked: boolean } {
  const isSensoryCalm = Boolean(enabled);
  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  if (targetDoc && targetDoc.documentElement) {
    const html = targetDoc.documentElement;
    html.classList.toggle('sensory-calm', isSensoryCalm);
    html.setAttribute('data-sensory-calm', isSensoryCalm ? 'true' : 'false');
  }
  return {
    isSensoryCalm,
    audioAndHapticsMuted: isSensoryCalm,
    layoutStabilityLocked: isSensoryCalm
  };
}

export const ADHD_VIEW_STORAGE_KEY = 'budget_gym_adhd_view_v1';
export const DYSLEXIA_VIEW_STORAGE_KEY = 'budget_gym_dyslexia_view_v1';

export interface AccessibilityLayoutPreferences {
  adhdFriendlyView: boolean;
  dyslexiaFriendlyView: boolean;
}

export function normalizeBooleanAccessibilityPref(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'on' || s === 'enabled';
}

export function loadStoredAdhdViewPreference(
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return false;
    return normalizeBooleanAccessibilityPref(store.getItem(ADHD_VIEW_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function saveAdhdViewPreference(
  enabled: boolean,
  storage?: Pick<Storage, 'setItem'> | null
): boolean {
  const normalized = Boolean(enabled);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      store.setItem(ADHD_VIEW_STORAGE_KEY, normalized ? 'true' : 'false');
    }
  } catch {
    // Ignore storage restrictions
  }
  return normalized;
}

export function applyAdhdFriendlyViewToDocument(
  enabled: boolean,
  doc?: Document | null
): { adhdFriendlyView: boolean; singleTaskFocusEnabled: boolean } {
  const adhdFriendlyView = Boolean(enabled);
  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  if (targetDoc && targetDoc.documentElement) {
    const html = targetDoc.documentElement;
    html.classList.toggle('adhd-friendly-view', adhdFriendlyView);
    html.setAttribute('data-adhd-view', adhdFriendlyView ? 'true' : 'false');
  }
  return {
    adhdFriendlyView,
    singleTaskFocusEnabled: adhdFriendlyView
  };
}

export function loadStoredDyslexiaViewPreference(
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return false;
    return normalizeBooleanAccessibilityPref(store.getItem(DYSLEXIA_VIEW_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function saveDyslexiaViewPreference(
  enabled: boolean,
  storage?: Pick<Storage, 'setItem'> | null
): boolean {
  const normalized = Boolean(enabled);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      store.setItem(DYSLEXIA_VIEW_STORAGE_KEY, normalized ? 'true' : 'false');
    }
  } catch {
    // Ignore storage restrictions
  }
  return normalized;
}

export function applyDyslexiaFriendlyViewToDocument(
  enabled: boolean,
  doc?: Document | null
): { dyslexiaFriendlyView: boolean; fontMode: AccessibilityFontMode } {
  const dyslexiaFriendlyView = Boolean(enabled);
  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  const fontMode: AccessibilityFontMode = dyslexiaFriendlyView ? 'opendyslexic' : 'default';
  if (targetDoc && targetDoc.documentElement) {
    const html = targetDoc.documentElement;
    html.classList.toggle('dyslexia-friendly-view', dyslexiaFriendlyView);
    html.setAttribute('data-dyslexia-view', dyslexiaFriendlyView ? 'true' : 'false');
    if (dyslexiaFriendlyView) {
      applyDyslexiaFontToDocument('opendyslexic', targetDoc);
    }
  }
  return {
    dyslexiaFriendlyView,
    fontMode
  };
}


