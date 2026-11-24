import React, { useState } from 'react';
import {
  LOW_SPOONS_PRESETS,
  classifyLowSpoonsWithGemini,
  type LowSpoonsScalingPreset,
  type LowSpoonsTriageResult
} from '../utils/lowSpoonsTriage';

export interface LowSpoonsTriagePanelProps {
  activePreset: LowSpoonsScalingPreset | null;
  onApplyPreset: (preset: LowSpoonsScalingPreset) => void;
  onResetPreset: () => void;
  endpoint?: string;
}

const QUICK_FEELING_PROMPTS = [
  'I feel a bit tired from poor sleep today',
  'Loud gym, bright lights, and my brain feels overloaded',
  'Completely drained and dizzy, need the shortest gentle session'
];

/**
 * Phase 2 — Task 3: "Low-Spoons" Triage System UI
 * - Text input for daily fatigue or sensory overload.
 * - Server-side Gemini classifies severity into a strict enum.
 * - Maps strictly to pre-validated deterministic scaling presets (-20% volume, machine swaps, etc.).
 */
export const LowSpoonsTriagePanel: React.FC<LowSpoonsTriagePanelProps> = ({
  activePreset,
  onApplyPreset,
  onResetPreset,
  endpoint
}) => {
  const [checkInText, setCheckInText] = useState('');
  const [loading, setLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<LowSpoonsTriageResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!checkInText.trim()) {
      setErrorMsg('Please type how your energy or senses feel today.');
      return;
    }
    setLoading(true);
    const res = await classifyLowSpoonsWithGemini(checkInText, { endpoint });
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'Could not check your energy right now. Pick a safe preset below.');
      setTriageResult(null);
      return;
    }
    setTriageResult(res);
  };

  return (
    <section
      aria-label="Low-Spoons energy and sensory check-in"
      data-testid="low-spoons-triage-panel"
      className="rounded-xl border border-amber-400/45 bg-slate-900 p-4 text-left text-slate-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-white">Low-Spoons Check-In</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
            Tell us if you feel tired, sore, or overwhelmed by noise or lights.
          </p>
        </div>
        {activePreset && activePreset.presetId !== 'full_capacity' && (
          <span
            data-testid="low-spoons-active-badge"
            className="rounded-md border border-amber-400/60 bg-amber-500/20 px-2.5 py-1 text-[0.6875rem] font-extrabold text-amber-100"
          >
            Active: {activePreset.badgeLabel}
          </span>
        )}
      </div>

      {/* Quick accessible starter phrases */}
      <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Quick energy phrases">
        {QUICK_FEELING_PROMPTS.map((phrase, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setCheckInText(phrase);
              setErrorMsg(null);
            }}
            className="min-h-[44px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-left text-xs font-bold text-slate-200 hover:border-amber-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {phrase}
          </button>
        ))}
      </div>

      <form onSubmit={handleAnalyze} className="mt-3 space-y-2.5">
        <label htmlFor="low-spoons-input" className="block text-xs font-extrabold text-slate-200">
          How are your energy and senses today?
        </label>
        <textarea
          id="low-spoons-input"
          data-testid="low-spoons-input"
          rows={2}
          maxLength={600}
          value={checkInText}
          onChange={(e) => setCheckInText(e.target.value)}
          placeholder="Example: Slept 4 hours, gym lights feel too bright, hard to focus."
          className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm font-semibold leading-relaxed text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        />

        <button
          type="submit"
          data-testid="low-spoons-submit-btn"
          disabled={loading}
          className="min-h-[48px] w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-400 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {loading ? 'Checking Your Energy...' : 'Match Safe Workout Preset'}
        </button>
      </form>

      {errorMsg && (
        <p
          role="alert"
          data-testid="low-spoons-error"
          className="mt-2.5 rounded-lg border border-rose-500/50 bg-rose-950/60 px-3 py-2 text-xs font-bold text-rose-100"
        >
          {errorMsg}
        </p>
      )}

      {/* Pre-validated Deterministic Preset Recommendation */}
      {triageResult && (
        <div
          role="status"
          aria-live="polite"
          data-testid="low-spoons-recommendation-card"
          className="mt-3 rounded-xl border-2 border-emerald-400/70 bg-slate-950 p-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-emerald-300">
              Matched Safe Preset
            </span>
            <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-extrabold text-emerald-100">
              {triageResult.preset.badgeLabel}
            </span>
          </div>
          <h4 className="mt-1 text-sm font-extrabold text-white">{triageResult.preset.title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-200">
            {triageResult.coachReassurance || triageResult.preset.grade6Summary}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
            {triageResult.preset.actionBullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <button
            type="button"
            data-testid="low-spoons-apply-btn"
            onClick={() => onApplyPreset(triageResult.preset)}
            className="mt-3 min-h-[48px] w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Apply Preset to Today&apos;s Workout
          </button>
        </div>
      )}

      {/* Direct 1-Tap Manual Pre-Validated Presets (works offline too) */}
      <div className="mt-3 border-t border-slate-800 pt-3">
        <div className="text-xs font-extrabold text-slate-300">Or pick a safe preset directly:</div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            data-testid="low-spoons-direct-trim20-btn"
            onClick={() => onApplyPreset(LOW_SPOONS_PRESETS.mild_fatigue)}
            className="min-h-[48px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-extrabold text-slate-100 hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            -20% Volume Only
          </button>
          <button
            type="button"
            data-testid="low-spoons-direct-machines-btn"
            onClick={() => onApplyPreset(LOW_SPOONS_PRESETS.high_fatigue_or_overload)}
            className="min-h-[48px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-extrabold text-slate-100 hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            -20% + Stable Machines
          </button>
        </div>

        {activePreset && activePreset.presetId !== 'full_capacity' && (
          <button
            type="button"
            data-testid="low-spoons-reset-btn"
            onClick={onResetPreset}
            className="mt-2 min-h-[48px] w-full rounded-xl border border-sky-400/60 bg-sky-950/60 px-4 py-2 text-xs font-extrabold text-sky-100 hover:bg-sky-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Reset Back to Full Plan (100%)
          </button>
        )}
      </div>
    </section>
  );
};
