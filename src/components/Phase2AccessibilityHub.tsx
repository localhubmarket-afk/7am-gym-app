import React, { useState } from 'react';
import { VoiceToLogPanel } from './VoiceToLogPanel';
import { LowSpoonsTriagePanel } from './LowSpoonsTriagePanel';
import { PlainLanguageCoachModal } from './PlainLanguageCoachModal';
import { BiometricReadinessPanel } from './BiometricReadinessPanel';
import { InstitutionalWellnessPanel } from './InstitutionalWellnessPanel';
import type { ParsedVoiceSetLog, VoiceLogUndoRecord, VoiceWeightUnit } from '../utils/voiceToLog';
import type { BoundedProgressionMathSnapshot } from '../utils/plainLanguageCoach';
import type { LowSpoonsScalingPreset } from '../utils/lowSpoonsTriage';
import type { DailyBiometricsSnapshot } from '../utils/biometricSync';
import type { InstitutionalEligibilityFlags } from '../utils/institutionalClinicalExport';

export interface Phase2AccessibilityHubProps {
  activeExerciseName: string;
  activeSetNumber: number;
  defaultUnit?: VoiceWeightUnit;
  lastUndoRecord: VoiceLogUndoRecord | null;
  coachMathSnapshot: Readonly<BoundedProgressionMathSnapshot>;
  activeLowSpoonsPreset: LowSpoonsScalingPreset | null;
  biometricsSnapshot: DailyBiometricsSnapshot | null;
  plannedTotalSets: number;
  institutionalEligibility?: Partial<InstitutionalEligibilityFlags> | null;
  gymState?: Record<string, unknown> | null;
  onVoiceLogParsed: (parsed: ParsedVoiceSetLog) => void | Promise<void>;
  onVoiceUndo: (record: VoiceLogUndoRecord) => void | Promise<void>;
  onApplyLowSpoonsPreset: (preset: LowSpoonsScalingPreset) => void;
  onResetLowSpoonsPreset: () => void;
  onSyncBiometrics: (snapshot: DailyBiometricsSnapshot) => void | Promise<void>;
  onUpdateInstitutionalEligibility?: (next: InstitutionalEligibilityFlags) => void | Promise<void>;
  onExportClinicalCsv?: () => void | Promise<void>;
}

/**
 * Modular Phase 2 Accessibility Hub combining:
 * 1. Hands-Free Voice-to-Log + 1-Tap Undo
 * 2. Plain-Language Coach (Bounded LLM Explainer Modal)
 * 3. Low-Spoons Triage System (Pre-Validated Deterministic Scaling Presets)
 * 4. Smartwatch Biometric Recovery Sync (Apple HealthKit & Google Health Connect)
 * 5. Institutional Wellness Eligibility (HSA/FSA, Corporate Wellness) & 12-Week Clinical Trial CSV Export
 */
export const Phase2AccessibilityHub: React.FC<Phase2AccessibilityHubProps> = ({
  activeExerciseName,
  activeSetNumber,
  defaultUnit = 'lbs',
  lastUndoRecord,
  coachMathSnapshot,
  activeLowSpoonsPreset,
  biometricsSnapshot,
  plannedTotalSets,
  institutionalEligibility,
  gymState,
  onVoiceLogParsed,
  onVoiceUndo,
  onApplyLowSpoonsPreset,
  onResetLowSpoonsPreset,
  onSyncBiometrics,
  onUpdateInstitutionalEligibility,
  onExportClinicalCsv
}) => {
  const [coachOpen, setCoachOpen] = useState(false);

  return (
    <div data-testid="phase2-accessibility-hub" className="space-y-3">
      <VoiceToLogPanel
        activeExerciseName={activeExerciseName}
        activeSetNumber={activeSetNumber}
        defaultUnit={defaultUnit}
        lastUndoRecord={lastUndoRecord}
        onLogParsedPhrase={onVoiceLogParsed}
        onUndoLastVoiceLog={onVoiceUndo}
      />

      {/* Task 2 Trigger Card: Bounded Plain-Language Coach */}
      <section
        aria-label="Plain-Language Coach workout math explainer"
        className="rounded-xl border border-sky-400/45 bg-slate-900 p-4 text-left text-slate-100"
      >
        <div className="flex flex-col items-start gap-2">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Plain-Language Coach</h3>
            <span className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface-alt)] px-2.5 py-1 text-[0.75rem] font-extrabold text-[var(--text-primary)]">
              Grade 6–8 AI
            </span>
          </div>
          <p className="w-full text-xs leading-relaxed text-[var(--text-secondary)]">
            Explains why <strong className="font-extrabold text-[var(--text-primary)]">{coachMathSnapshot.exerciseName}</strong> has today&apos;s weight and reps in simple words. Never changes your math.
          </p>
        </div>

        <button
          type="button"
          data-testid="open-plain-language-coach-btn"
          onClick={() => setCoachOpen(true)}
          className="mt-3 min-h-[48px] w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Explain Today&apos;s Weight in Plain Words
        </button>
      </section>

      <LowSpoonsTriagePanel
        activePreset={activeLowSpoonsPreset}
        onApplyPreset={onApplyLowSpoonsPreset}
        onResetPreset={onResetLowSpoonsPreset}
      />

      <BiometricReadinessPanel
        snapshot={biometricsSnapshot}
        plannedTotalSets={plannedTotalSets}
        onSyncSnapshot={onSyncBiometrics}
      />

      <InstitutionalWellnessPanel
        eligibility={institutionalEligibility}
        gymState={gymState}
        onUpdateEligibility={onUpdateInstitutionalEligibility}
        onExportClinicalCsv={onExportClinicalCsv}
      />

      <PlainLanguageCoachModal
        isOpen={coachOpen}
        mathSnapshot={coachMathSnapshot}
        onClose={() => setCoachOpen(false)}
      />
    </div>
  );
};
