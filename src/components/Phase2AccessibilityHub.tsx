import React, { useState } from 'react';
import { VoiceToLogPanel } from './VoiceToLogPanel';
import { LowSpoonsTriagePanel } from './LowSpoonsTriagePanel';
import { PlainLanguageCoachModal } from './PlainLanguageCoachModal';
import { BiometricReadinessPanel } from './BiometricReadinessPanel';
import type { ParsedVoiceSetLog, VoiceLogUndoRecord, VoiceWeightUnit } from '../utils/voiceToLog';
import type { BoundedProgressionMathSnapshot } from '../utils/plainLanguageCoach';
import type { LowSpoonsScalingPreset } from '../utils/lowSpoonsTriage';
import type { DailyBiometricsSnapshot } from '../utils/biometricSync';

export interface Phase2AccessibilityHubProps {
  activeExerciseName: string;
  activeSetNumber: number;
  defaultUnit?: VoiceWeightUnit;
  lastUndoRecord: VoiceLogUndoRecord | null;
  coachMathSnapshot: Readonly<BoundedProgressionMathSnapshot>;
  activeLowSpoonsPreset: LowSpoonsScalingPreset | null;
  biometricsSnapshot: DailyBiometricsSnapshot | null;
  plannedTotalSets: number;
  onVoiceLogParsed: (parsed: ParsedVoiceSetLog) => void | Promise<void>;
  onVoiceUndo: (record: VoiceLogUndoRecord) => void | Promise<void>;
  onApplyLowSpoonsPreset: (preset: LowSpoonsScalingPreset) => void;
  onResetLowSpoonsPreset: () => void;
  onSyncBiometrics: (snapshot: DailyBiometricsSnapshot) => void | Promise<void>;
}

/**
 * Modular Phase 2 Accessibility Hub combining:
 * 1. Hands-Free Voice-to-Log + 1-Tap Undo
 * 2. Plain-Language Coach (Bounded LLM Explainer Modal)
 * 3. Low-Spoons Triage System (Pre-Validated Deterministic Scaling Presets)
 * 4. Smartwatch Biometric Recovery Sync (Apple HealthKit & Google Health Connect)
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
  onVoiceLogParsed,
  onVoiceUndo,
  onApplyLowSpoonsPreset,
  onResetLowSpoonsPreset,
  onSyncBiometrics
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-white">Plain-Language Coach</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
              Explains why <strong className="text-sky-200">{coachMathSnapshot.exerciseName}</strong> has today&apos;s weight and reps in simple words. Never changes your math.
            </p>
          </div>
          <span className="rounded-md border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-[0.6875rem] font-extrabold text-sky-200">
            Grade 6–8 AI
          </span>
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

      <PlainLanguageCoachModal
        isOpen={coachOpen}
        mathSnapshot={coachMathSnapshot}
        onClose={() => setCoachOpen(false)}
      />
    </div>
  );
};
