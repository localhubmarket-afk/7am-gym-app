import React from 'react';
import { useAccessibilityTheme } from '../context/AccessibilityThemeProvider';
import type { ThemeModePreference } from '../utils/themeProvider';
import { AutoSyncSettingsControl } from './AutoSyncSettingsControl';
import { DataMigrationPanel } from './DataMigrationPanel';
import { InstitutionalWellnessPanel } from './InstitutionalWellnessPanel';
import type { RealtimeSyncConnectionStatus } from '../utils/realtimeAutoSync';
import type { InstitutionalEligibilityFlags } from '../utils/institutionalClinicalExport';

export interface AccessibilitySettingsPanelProps {
  className?: string;
  onForceSyncNow?: () => void | Promise<void>;
  onForcePullFromCloud?: () => void | Promise<void>;
  realtimeStatus?: RealtimeSyncConnectionStatus;
  isSyncingNow?: boolean;
  isPullingNow?: boolean;
  syncStatusMessage?: string;
  onExportJsonBackup?: () => void | Promise<void>;
  onImportJsonFile?: (jsonText: string, fileName: string) => void | Promise<void>;
  isImportingBackup?: boolean;
  migrationStatusMessage?: string | null;
  migrationStatusKind?: 'idle' | 'success' | 'error';
  institutionalEligibility?: Partial<InstitutionalEligibilityFlags> | null;
  gymState?: Record<string, unknown> | null;
  onUpdateInstitutionalEligibility?: (next: InstitutionalEligibilityFlags) => void | Promise<void>;
  onExportClinicalCsv?: () => void | Promise<void>;
}

const THEME_OPTIONS: Array<{ value: ThemeModePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
];

/**
 * Dyslexia-Friendly Display, Sync & Reading Settings Panel
 * - Real-time Auto-Sync Devices switch + Force Sync Now / Force Pull from Cloud
 * - Strict High-Contrast Light (#F7F7F7 / #0E1A40 => 15.8:1) and Dark (#141414 / #F8F6F5 => 17.1:1)
 * - Prominent one-tap OpenDyslexic font toggle button
 * - Institutional HSA/FSA & Corporate Wellness eligibility + 12-week Clinical Trial CSV Export
 * - Minimum 48x48px touch targets with >= 8px (gap-2 / 0.5rem) separation
 * - 100% relative rem typography with flex-wrap reflow at >= 200% zoom
 */
export const AccessibilitySettingsPanel: React.FC<AccessibilitySettingsPanelProps> = ({
  className = '',
  onForceSyncNow,
  onForcePullFromCloud,
  realtimeStatus,
  isSyncingNow = false,
  isPullingNow = false,
  syncStatusMessage,
  onExportJsonBackup,
  onImportJsonFile,
  isImportingBackup = false,
  migrationStatusMessage = null,
  migrationStatusKind = 'idle',
  institutionalEligibility,
  gymState,
  onUpdateInstitutionalEligibility,
  onExportClinicalCsv
}) => {
  const {
    themePreference,
    resolvedTheme,
    isOpenDyslexicEnabled,
    isSensoryCalm,
    isAdhdFriendlyView,
    isDyslexiaFriendlyView,
    isAdvancedSubjectiveEnabled,
    setThemePreference,
    toggleOpenDyslexicFont,
    toggleSensoryCalm,
    toggleAdhdFriendlyView,
    toggleDyslexiaFriendlyView,
    toggleAdvancedSubjective
  } = useAccessibilityTheme();

  return (
    <section
      aria-label="Visual, Sync, and Reading Accessibility Settings"
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-4 text-[var(--text-primary)] ${className}`.trim()}
    >
      <AutoSyncSettingsControl
        onForceSyncNow={onForceSyncNow}
        onForcePullFromCloud={onForcePullFromCloud}
        connectionStatus={realtimeStatus}
        isSyncingNow={isSyncingNow}
        isPullingNow={isPullingNow}
        statusMessage={syncStatusMessage}
      />
      <DataMigrationPanel
        onExportJsonBackup={onExportJsonBackup}
        onImportJsonFile={onImportJsonFile}
        isImporting={isImportingBackup}
        statusMessage={migrationStatusMessage}
        statusKind={migrationStatusKind}
      />
      <InstitutionalWellnessPanel
        eligibility={institutionalEligibility}
        gymState={gymState}
        onUpdateEligibility={onUpdateInstitutionalEligibility}
        onExportClinicalCsv={onExportClinicalCsv}
      />
      <div className="space-y-2" role="radiogroup" aria-label="Color Theme Mode">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold leading-relaxed">
            Screen Mode (High Contrast)
          </h3>
          <span className="text-xs font-bold text-emerald-500">
            {resolvedTheme === 'light'
              ? 'Light (#F7F7F7 / #0E1A40 · 15.8:1)'
              : 'Dark (#141414 / #F8F6F5 · 17.1:1)'}
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

      {/* Task 2: Special Screen Layout Toggles (ADHD-friendly view & Dyslexia-friendly view) */}
      <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-extrabold leading-relaxed">
            Special Screen Layouts
          </span>
          <span className="text-xs font-bold text-emerald-500">
            {isAdhdFriendlyView || isDyslexiaFriendlyView ? 'Custom Layout Active' : 'Standard Layout'}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isAdhdFriendlyView}
          onClick={toggleAdhdFriendlyView}
          data-testid="toggle-adhd-friendly-view-btn"
          className={`w-full min-h-[48px] min-w-[48px] px-4 py-3 rounded-xl border text-sm font-extrabold transition flex flex-wrap items-center justify-between gap-2 ${
            isAdhdFriendlyView
              ? 'border-emerald-400 bg-emerald-600 text-white'
              : 'border-[var(--border-strong)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)]'
          }`}
        >
          <span>ADHD-friendly view (High focus, single tasks)</span>
          <span>{isAdhdFriendlyView ? 'ON' : 'OFF'}</span>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={isDyslexiaFriendlyView}
          onClick={toggleDyslexiaFriendlyView}
          data-testid="toggle-dyslexia-friendly-view-btn"
          className={`w-full min-h-[48px] min-w-[48px] px-4 py-3 rounded-xl border text-sm font-extrabold transition flex flex-wrap items-center justify-between gap-2 ${
            isDyslexiaFriendlyView
              ? 'border-emerald-400 bg-emerald-600 text-white'
              : 'border-[var(--border-strong)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)]'
          }`}
        >
          <span>Dyslexia-friendly view (Special fonts &amp; spacing)</span>
          <span>{isDyslexiaFriendlyView ? 'ON' : 'OFF'}</span>
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

