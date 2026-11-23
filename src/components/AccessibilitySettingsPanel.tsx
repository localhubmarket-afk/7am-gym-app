import React from 'react';
import { useAccessibilityTheme } from '../context/AccessibilityThemeProvider';
import type { ThemeModePreference } from '../utils/themeProvider';

export interface AccessibilitySettingsPanelProps {
  className?: string;
}

const THEME_OPTIONS: Array<{ value: ThemeModePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
];

/**
 * Dyslexia-Friendly Display & Reading Settings Panel
 * - High-contrast Light (#F7F7F7 / #0A1128) and Dark (#1A1A1A / #F2F2F2) toggles
 * - Prominent one-tap OpenDyslexic font toggle button
 * - Minimum 48x48px touch targets with >= 8px (gap-2 / 0.5rem) separation
 * - 100% relative rem typography with flex-wrap reflow at 200% zoom
 */
export const AccessibilitySettingsPanel: React.FC<AccessibilitySettingsPanelProps> = ({
  className = ''
}) => {
  const {
    themePreference,
    resolvedTheme,
    isOpenDyslexicEnabled,
    isSensoryCalm,
    isAdvancedSubjectiveEnabled,
    setThemePreference,
    toggleOpenDyslexicFont,
    toggleSensoryCalm,
    toggleAdvancedSubjective
  } = useAccessibilityTheme();

  return (
    <section
      aria-label="Visual and Reading Accessibility Settings"
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-4 text-[var(--text-primary)] ${className}`.trim()}
    >
      <div className="space-y-2" role="radiogroup" aria-label="Color Theme Mode">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold leading-relaxed">
            Screen Mode (High Contrast)
          </h3>
          <span className="text-xs font-bold text-emerald-500">
            {resolvedTheme === 'light' ? 'Light (#F7F7F7)' : 'Dark (#1A1A1A)'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((opt) => {
            const active = themePreference === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setThemePreference(opt.value)}
                className={`flex-1 min-w-[48px] min-h-[48px] px-3 py-2 rounded-xl border text-sm font-extrabold transition ${
                  active
                    ? 'border-emerald-400 bg-emerald-600 text-white'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)]'
                }`}
              >
                {active ? `✓ ${opt.label}` : opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-extrabold leading-relaxed">
            Dyslexia-Friendly Reading Font
          </span>
          <span className="text-xs font-bold text-emerald-500">
            {isOpenDyslexicEnabled ? 'OpenDyslexic Active' : 'Lexend / Atkinson'}
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isOpenDyslexicEnabled}
          onClick={toggleOpenDyslexicFont}
          className={`w-full min-h-[48px] min-w-[48px] px-4 py-3 rounded-xl border text-sm font-extrabold transition flex flex-wrap items-center justify-between gap-2 ${
            isOpenDyslexicEnabled
              ? 'border-emerald-400 bg-emerald-600 text-white'
              : 'border-[var(--border-strong)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)]'
          }`}
        >
          <span>OpenDyslexic Font</span>
          <span>{isOpenDyslexicEnabled ? 'ON (Tap to turn off)' : 'OFF (Tap to turn on)'}</span>
        </button>
      </div>

      {/* Task 4: Global Sensory-Calm Mode */}
      <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-extrabold leading-relaxed">
            Sensory-Calm Mode
          </span>
          <span className="text-xs font-bold text-emerald-500">
            {isSensoryCalm ? 'Active (Low Saturation · Muted)' : 'Standard Display'}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          Reduces color saturation under 5%, locks layout stability, removes animations, and mutes all chimes and vibrations.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={isSensoryCalm}
          onClick={toggleSensoryCalm}
          data-testid="toggle-sensory-calm-btn"
          className={`w-full min-h-[48px] min-w-[48px] px-4 py-3 rounded-xl border text-sm font-extrabold flex flex-wrap items-center justify-between gap-2 ${
            isSensoryCalm
              ? 'border-emerald-400 bg-emerald-600 text-white'
              : 'border-[var(--border-strong)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)]'
          }`}
        >
          <span>Sensory-Calm Mode</span>
          <span>{isSensoryCalm ? 'ON (Tap to turn off)' : 'OFF (Tap to turn on)'}</span>
        </button>
      </div>

      {/* Task 1: Opt-In Advanced Settings for Subjective Ratings (Never Required for Progression) */}
      <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-extrabold leading-relaxed">
            Advanced Settings: Optional Effort Notes (RPE / RIR)
          </span>
          <span className="text-xs font-bold text-emerald-500">
            {isAdvancedSubjectiveEnabled ? 'Shown (Opt-In)' : 'Hidden (Recommended)'}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          Standard Double Progression uses only your logged weight and reps. Turn this on only if you want optional RPE, RIR, pump, or soreness notes.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={isAdvancedSubjectiveEnabled}
          onClick={toggleAdvancedSubjective}
          data-testid="toggle-advanced-subjective-btn"
          className={`w-full min-h-[48px] min-w-[48px] px-4 py-3 rounded-xl border text-sm font-extrabold flex flex-wrap items-center justify-between gap-2 ${
            isAdvancedSubjectiveEnabled
              ? 'border-emerald-400 bg-emerald-600 text-white'
              : 'border-[var(--border-strong)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)]'
          }`}
        >
          <span>Show Optional RPE / RIR Fields</span>
          <span>{isAdvancedSubjectiveEnabled ? 'ON (Optional Only)' : 'OFF (Default)'}</span>
        </button>
      </div>
    </section>
  );
};

export default AccessibilitySettingsPanel;

