export type ThemeModePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'budget_gym_theme_mode_v1';

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
  themeColorMeta: string;
}

export const ACCESSIBLE_THEME_TOKENS: Record<ResolvedTheme, AccessibleThemeTokens> = {
  dark: {
    canvasBg: '#0f172a',
    surfaceBg: '#1e293b',
    surfaceAltBg: '#0b1220',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    borderSubtle: '#334155',
    borderStrong: '#64748b',
    accentPrimary: '#10b981',
    accentOnPrimary: '#022c22',
    warningBg: 'rgba(217, 119, 6, 0.16)',
    warningText: '#fde68a',
    warningBorder: '#d97706',
    themeColorMeta: '#0f172a'
  },
  light: {
    canvasBg: '#f4f6f9',
    surfaceBg: '#fcfcfd',
    surfaceAltBg: '#e8eef5',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    borderSubtle: '#cbd5e1',
    borderStrong: '#64748b',
    accentPrimary: '#047857',
    accentOnPrimary: '#f8fafc',
    warningBg: '#fef3c7',
    warningText: '#78350f',
    warningBorder: '#b45309',
    themeColorMeta: '#f4f6f9'
  }
};

export function normalizeThemeModePreference(raw: unknown): ThemeModePreference {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'light' || s === 'dark' || s === 'system') return s;
  return 'dark';
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

    const metaTheme = targetDoc.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', tokens.themeColorMeta);
    }
  }

  return { preference: normalized, resolved, tokens };
}
