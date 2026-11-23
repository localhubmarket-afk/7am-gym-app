import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ACCESSIBLE_THEME_TOKENS,
  applyDyslexiaFontToDocument,
  applyThemeToDocument,
  getSystemPrefersDark,
  loadStoredFontPreference,
  loadStoredThemePreference,
  resolveEffectiveTheme,
  saveFontPreference,
  saveThemePreference,
  type AccessibilityFontMode,
  type AccessibleThemeTokens,
  type ResolvedTheme,
  type ThemeModePreference
} from '../utils/themeProvider';

export interface AccessibilityThemeContextValue {
  themePreference: ThemeModePreference;
  resolvedTheme: ResolvedTheme;
  tokens: AccessibleThemeTokens;
  fontMode: AccessibilityFontMode;
  isOpenDyslexicEnabled: boolean;
  setThemePreference: (next: ThemeModePreference) => void;
  toggleLightDarkTheme: () => void;
  setFontMode: (next: AccessibilityFontMode) => void;
  toggleOpenDyslexicFont: () => void;
}

const AccessibilityThemeContext = createContext<AccessibilityThemeContextValue | null>(null);

export const AccessibilityThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [themePreference, setThemePreferenceState] = useState<ThemeModePreference>(() =>
    loadStoredThemePreference()
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => getSystemPrefersDark());
  const [fontMode, setFontModeState] = useState<AccessibilityFontMode>(() =>
    loadStoredFontPreference()
  );

  const resolvedTheme = resolveEffectiveTheme(themePreference, systemPrefersDark);
  const tokens = ACCESSIBLE_THEME_TOKENS[resolvedTheme];

  useEffect(() => {
    applyThemeToDocument(themePreference, document, systemPrefersDark);
  }, [themePreference, systemPrefersDark]);

  useEffect(() => {
    applyDyslexiaFontToDocument(fontMode, document);
  }, [fontMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handleChange);
      return () => mq.removeEventListener('change', handleChange);
    }
    return undefined;
  }, []);

  const setThemePreference = useCallback((next: ThemeModePreference) => {
    const saved = saveThemePreference(next);
    setThemePreferenceState(saved);
  }, []);

  const toggleLightDarkTheme = useCallback(() => {
    setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setThemePreference]);

  const setFontMode = useCallback((next: AccessibilityFontMode) => {
    const saved = saveFontPreference(next);
    setFontModeState(saved);
  }, []);

  const toggleOpenDyslexicFont = useCallback(() => {
    setFontMode(fontMode === 'opendyslexic' ? 'default' : 'opendyslexic');
  }, [fontMode, setFontMode]);

  const value = useMemo<AccessibilityThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      tokens,
      fontMode,
      isOpenDyslexicEnabled: fontMode === 'opendyslexic',
      setThemePreference,
      toggleLightDarkTheme,
      setFontMode,
      toggleOpenDyslexicFont
    }),
    [
      themePreference,
      resolvedTheme,
      tokens,
      fontMode,
      setThemePreference,
      toggleLightDarkTheme,
      setFontMode,
      toggleOpenDyslexicFont
    ]
  );

  return (
    <AccessibilityThemeContext.Provider value={value}>
      {children}
    </AccessibilityThemeContext.Provider>
  );
};

export function useAccessibilityTheme(): AccessibilityThemeContextValue {
  const ctx = useContext(AccessibilityThemeContext);
  if (!ctx) {
    throw new Error('useAccessibilityTheme must be used inside AccessibilityThemeProvider.');
  }
  return ctx;
}
