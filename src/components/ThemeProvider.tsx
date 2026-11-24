import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  applyThemeToDocument,
  getSystemPrefersDark,
  loadStoredThemePreference,
  saveThemePreference,
  type ResolvedTheme,
  type ThemeModePreference
} from '../utils/themeProvider';

interface ThemeContextValue {
  preference: ThemeModePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (next: ThemeModePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'dark',
  resolvedTheme: 'dark',
  setThemePreference: () => {}
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemeModePreference>(() =>
    loadStoredThemePreference()
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    applyThemeToDocument(loadStoredThemePreference()).resolved
  );

  useEffect(() => {
    const applied = applyThemeToDocument(preference);
    setResolvedTheme(applied.resolved);
  }, [preference]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (preference === 'system') {
        const applied = applyThemeToDocument('system', document, getSystemPrefersDark());
        setResolvedTheme(applied.resolved);
      }
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [preference]);

  function setThemePreference(next: ThemeModePreference) {
    const saved = saveThemePreference(next);
    setPreferenceState(saved);
  }

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export const ThemeModeToggle: React.FC = () => {
  const { preference, resolvedTheme, setThemePreference } = useTheme();
  const options: Array<{ value: ThemeModePreference; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' }
  ];

  return (
    <div
      role="radiogroup"
      aria-label="App Color Theme"
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left text-[var(--text-primary)]"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
        <span>Screen Mode</span>
        <span className="text-emerald-400">
          Active: {resolvedTheme === 'light' ? 'Light (15.8:1)' : 'Dark (17.1:1)'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = preference === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setThemePreference(opt.value)}
              className={`min-h-[48px] min-w-[48px] rounded-lg border px-2.5 py-2 text-xs font-extrabold transition ${
                active
                  ? 'border-emerald-400 bg-emerald-600 text-white'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] hover:border-[var(--border-strong)]'
              }`}
            >
              {active ? '✓ ' : ''}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
