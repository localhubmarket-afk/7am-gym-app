import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ACCESSIBLE_THEME_TOKENS,
  applyDyslexiaFontToDocument,
  applySensoryCalmToDocument,
  applyThemeToDocument,
  getSystemPrefersDark,
  loadStoredFontPreference,
  loadStoredSensoryCalmPreference,
  loadStoredThemePreference,
  resolveEffectiveTheme,
  saveFontPreference,
  saveSensoryCalmPreference,
  saveThemePreference,
  type AccessibilityFontMode,
  type AccessibleThemeTokens,
  type ResolvedTheme,
  type ThemeModePreference
} from '../utils/themeProvider';
import {
  loadAdvancedSubjectiveSetting,
  saveAdvancedSubjectiveSetting
} from '../utils/doubleProgressionEngine';
import {
  loadAutoSyncPreference,
  saveAutoSyncPreference
} from '../utils/realtimeAutoSync';

export interface AccessibilityThemeContextValue {
  themePreference: ThemeModePreference;
  resolvedTheme: ResolvedTheme;
  tokens: AccessibleThemeTokens;
  fontMode: AccessibilityFontMode;
  isOpenDyslexicEnabled: boolean;
  isSensoryCalm: boolean;
  isAdvancedSubjectiveEnabled: boolean;
  isAutoSyncEnabled: boolean;
  setThemePreference: (next: ThemeModePreference) => void;
  toggleLightDarkTheme: () => void;
  setFontMode: (next: AccessibilityFontMode) => void;
  toggleOpenDyslexicFont: () => void;
  setSensoryCalm: (enabled: boolean) => void;
  toggleSensoryCalm: () => void;
  setAdvancedSubjectiveEnabled: (enabled: boolean) => void;
  toggleAdvancedSubjective: () => void;
  setAutoSyncEnabled: (enabled: boolean) => void;
  toggleAutoSyncEnabled: () => void;
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
  const [isSensoryCalm, setSensoryCalmState] = useState<boolean>(() =>
    loadStoredSensoryCalmPreference()
  );
  const [isAdvancedSubjectiveEnabled, setAdvancedSubjectiveState] = useState<boolean>(() =>
    loadAdvancedSubjectiveSetting()
  );
  const [isAutoSyncEnabled, setAutoSyncState] = useState<boolean>(() =>
    loadAutoSyncPreference()
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
    applySensoryCalmToDocument(isSensoryCalm, document);
  }, [isSensoryCalm]);

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

  const setSensoryCalm = useCallback((enabled: boolean) => {
    const saved = saveSensoryCalmPreference(enabled);
    setSensoryCalmState(saved);
  }, []);

  const toggleSensoryCalm = useCallback(() => {
    setSensoryCalm(!isSensoryCalm);
  }, [isSensoryCalm, setSensoryCalm]);

  const setAdvancedSubjectiveEnabled = useCallback((enabled: boolean) => {
    const saved = saveAdvancedSubjectiveSetting(enabled);
    setAdvancedSubjectiveState(saved);
  }, []);

  const toggleAdvancedSubjective = useCallback(() => {
    setAdvancedSubjectiveEnabled(!isAdvancedSubjectiveEnabled);
  }, [isAdvancedSubjectiveEnabled, setAdvancedSubjectiveEnabled]);

  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    const saved = saveAutoSyncPreference(enabled);
    setAutoSyncState(saved);
  }, []);

  const toggleAutoSyncEnabled = useCallback(() => {
    setAutoSyncEnabled(!isAutoSyncEnabled);
  }, [isAutoSyncEnabled, setAutoSyncEnabled]);

  const value = useMemo<AccessibilityThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      tokens,
      fontMode,
      isOpenDyslexicEnabled: fontMode === 'opendyslexic',
      isSensoryCalm,
      isAdvancedSubjectiveEnabled,
      isAutoSyncEnabled,
      setThemePreference,
      toggleLightDarkTheme,
      setFontMode,
      toggleOpenDyslexicFont,
      setSensoryCalm,
      toggleSensoryCalm,
      setAdvancedSubjectiveEnabled,
      toggleAdvancedSubjective,
      setAutoSyncEnabled,
      toggleAutoSyncEnabled
    }),
    [
      themePreference,
      resolvedTheme,
      tokens,
      fontMode,
      isSensoryCalm,
      isAdvancedSubjectiveEnabled,
      isAutoSyncEnabled,
      setThemePreference,
      toggleLightDarkTheme,
      setFontMode,
      toggleOpenDyslexicFont,
      setSensoryCalm,
      toggleSensoryCalm,
      setAdvancedSubjectiveEnabled,
      toggleAdvancedSubjective,
      setAutoSyncEnabled,
      toggleAutoSyncEnabled
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

