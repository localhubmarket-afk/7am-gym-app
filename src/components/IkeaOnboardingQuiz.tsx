import React, { useState } from 'react';
import {
  DEFAULT_IKEA_QUIZ_ANSWERS,
  IKEA_QUIZ_ALL_STEPS,
  buildIkeaQuizProgram,
  createGuestSandboxStatePatch,
  type IkeaQuizAnswers,
  type OnboardingEquipment,
  type OnboardingGoal
} from '../utils/onboardingQuiz';
import {
  applyAdhdFriendlyViewToDocument,
  applyDyslexiaFriendlyViewToDocument,
  saveAdhdViewPreference,
  saveDyslexiaViewPreference,
  saveFontPreference
} from '../utils/themeProvider';
import type { WizardBaseDiet, WizardDifficulty, WizardIntolerance } from '../utils/wizardValidation';

export interface IkeaOnboardingQuizProps {
  initialAnswers?: Partial<IkeaQuizAnswers>;
  onComplete: (guestStatePatch: Record<string, any>, answers: IkeaQuizAnswers) => void;
  onReturningUserLogin?: () => void;
}

const GOAL_OPTIONS: Array<{ value: OnboardingGoal; label: string; desc: string }> = [
  { value: 'build_muscle', label: 'Build Muscle', desc: '8-12 reps for steady size and tone.' },
  { value: 'get_stronger', label: 'Get Stronger', desc: '5-6 reps for heavier main lifts.' },
  { value: 'lose_fat', label: 'Burn Fat & Keep Muscle', desc: '10-15 reps with crisp cardio pacing.' },
  { value: 'stay_fit', label: 'Stay Healthy & Active', desc: 'Balanced sets that protect your joints.' }
];

const EXPERIENCE_OPTIONS: Array<{ value: WizardDifficulty; label: string; desc: string }> = [
  { value: 'easy', label: 'Beginner (0-6 months)', desc: 'Fewer sets. Easy to learn.' },
  { value: 'medium', label: 'Intermediate (6+ months)', desc: 'Standard balanced sets.' },
  { value: 'hard', label: 'Advanced (2+ years)', desc: 'Higher volume for experienced lifters.' }
];

const EQUIPMENT_OPTIONS: Array<{ value: OnboardingEquipment; label: string; desc: string }> = [
  { value: 'full_gym', label: 'Full Gym', desc: 'Barbells, dumbbells, cables, and machines.' },
  { value: 'dumbbells_only', label: 'Dumbbells Only', desc: 'We swap barbell moves to dumbbell versions.' },
  { value: 'machines_cables', label: 'Machines & Cables', desc: 'Pin-loaded machines and cable stations.' },
  { value: 'home_bodyweight', label: 'Home Bodyweight', desc: 'Zero weights needed. Pull-ups and push-ups.' }
];

const DIET_OPTIONS: WizardBaseDiet[] = ['Vegan', 'Vegetarian', 'Pescatarian', 'Keto', 'Omnivore'];
const INTOLERANCE_OPTIONS: WizardIntolerance[] = ['Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Soy-Free'];

export const IkeaOnboardingQuiz: React.FC<IkeaOnboardingQuizProps> = ({
  initialAnswers,
  onComplete,
  onReturningUserLogin
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<IkeaQuizAnswers>({
    ...DEFAULT_IKEA_QUIZ_ANSWERS,
    ...initialAnswers
  });

  const currentStep = IKEA_QUIZ_ALL_STEPS[stepIndex];
  const progressPct = Math.round(((stepIndex + 1) / IKEA_QUIZ_ALL_STEPS.length) * 100);

  function toggleIntolerance(item: WizardIntolerance) {
    setAnswers((prev) => {
      const exists = prev.intolerances.includes(item);
      return {
        ...prev,
        intolerances: exists ? prev.intolerances.filter((x) => x !== item) : [...prev.intolerances, item]
      };
    });
  }

  function handleFinish() {
    const adhdOn = Boolean(answers.adhdFriendlyView);
    const dyslexiaOn = Boolean(answers.dyslexiaFriendlyView);
    saveAdhdViewPreference(adhdOn);
    saveDyslexiaViewPreference(dyslexiaOn);
    if (dyslexiaOn) {
      saveFontPreference('opendyslexic');
    }
    if (typeof document !== 'undefined') {
      applyAdhdFriendlyViewToDocument(adhdOn, document);
      applyDyslexiaFriendlyViewToDocument(dyslexiaOn, document);
    }
    const program = buildIkeaQuizProgram(answers);
    const patch = createGuestSandboxStatePatch(program, null);
    onComplete(patch, answers);
  }

  return (
    <section
      aria-label="Build your custom workout plan"
      className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left text-slate-100 shadow-2xl"
    >
      <div className="mb-3 flex items-center justify-between text-xs font-bold text-emerald-300">
        <span>
          Step {currentStep.stepNumber} of {IKEA_QUIZ_ALL_STEPS.length} • Free Beta
        </span>
        <span>{progressPct}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPct}
        className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <h2 className="text-lg font-extrabold leading-relaxed text-white">{currentStep.title}</h2>
      <p className="mt-1 mb-4 text-sm leading-relaxed text-slate-300">{currentStep.helperText}</p>

      {currentStep.id === 'goal' && (
        <div className="space-y-2.5">
          {GOAL_OPTIONS.map((opt) => {
            const selected = answers.goal === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setAnswers((p) => ({ ...p, goal: opt.value }))}
                className={`w-full rounded-xl border-2 px-4 py-3 text-left transition ${
                  selected
                    ? 'border-emerald-400 bg-emerald-600/20 text-white'
                    : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'
                }`}
              >
                <div className="text-sm font-extrabold">
                  {selected ? '✓ ' : ''}
                  {opt.label}
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-slate-300">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      )}

      {currentStep.id === 'experience' && (
        <div className="space-y-2.5">
          {EXPERIENCE_OPTIONS.map((opt) => {
            const selected = answers.experience === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setAnswers((p) => ({ ...p, experience: opt.value }))}
                className={`w-full rounded-xl border-2 px-4 py-3 text-left transition ${
                  selected
                    ? 'border-emerald-400 bg-emerald-600/20 text-white'
                    : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'
                }`}
              >
                <div className="text-sm font-extrabold">
                  {selected ? '✓ ' : ''}
                  {opt.label}
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-slate-300">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      )}

      {currentStep.id === 'equipment' && (
        <div className="space-y-2.5">
          {EQUIPMENT_OPTIONS.map((opt) => {
            const selected = answers.equipment === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setAnswers((p) => ({ ...p, equipment: opt.value }))}
                className={`w-full rounded-xl border-2 px-4 py-3 text-left transition ${
                  selected
                    ? 'border-emerald-400 bg-emerald-600/20 text-white'
                    : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'
                }`}
              >
                <div className="text-sm font-extrabold">
                  {selected ? '✓ ' : ''}
                  {opt.label}
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-slate-300">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      )}

      {currentStep.id === 'schedule' && (
        <div className="grid grid-cols-2 gap-2.5">
          {[3, 4, 5, 6].map((days) => {
            const selected = answers.daysPerWeek === days;
            return (
              <button
                key={days}
                type="button"
                aria-pressed={selected}
                onClick={() => setAnswers((p) => ({ ...p, daysPerWeek: days }))}
                className={`min-h-[56px] rounded-xl border-2 px-3 py-3 text-left transition ${
                  selected
                    ? 'border-emerald-400 bg-emerald-600/20 text-white'
                    : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'
                }`}
              >
                <div className="text-sm font-extrabold">
                  {selected ? '✓ ' : ''}
                  {days} Days / Week
                </div>
              </button>
            );
          })}
        </div>
      )}

      {currentStep.id === 'diet' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {DIET_OPTIONS.map((diet) => {
              const selected = answers.baseDiet === diet;
              return (
                <button
                  key={diet}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAnswers((p) => ({ ...p, baseDiet: diet }))}
                  className={`min-h-[44px] rounded-xl border-2 px-3 py-2 text-left text-xs font-extrabold transition ${
                    selected
                      ? 'border-emerald-400 bg-emerald-600/20 text-white'
                      : 'border-slate-700 bg-slate-950 text-slate-200'
                  }`}
                >
                  {selected ? '✓ ' : ''}
                  {diet}
                </button>
              );
            })}
          </div>
          <div>
            <div className="mb-2 text-xs font-bold text-slate-300">Optional allergies to block:</div>
            <div className="flex flex-wrap gap-2">
              {INTOLERANCE_OPTIONS.map((item) => {
                const selected = answers.intolerances.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleIntolerance(item)}
                    className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? 'border-amber-400 bg-amber-600/25 text-amber-100'
                        : 'border-slate-700 bg-slate-950 text-slate-300'
                    }`}
                  >
                    {selected ? '✓ ' : ''}
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {currentStep.id === 'accessibility' && (
        <div className="space-y-3" data-testid="onboarding-accessibility-step">
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(answers.adhdFriendlyView)}
            data-testid="onboarding-adhd-view-toggle"
            onClick={() =>
              setAnswers((p) => ({ ...p, adhdFriendlyView: !p.adhdFriendlyView }))
            }
            className={`w-full min-h-[60px] rounded-xl border-2 px-4 py-3 text-left transition ${
              answers.adhdFriendlyView
                ? 'border-emerald-400 bg-emerald-600/20 text-white'
                : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold">ADHD-friendly view</span>
              <span className="text-xs font-extrabold text-emerald-300">
                {answers.adhdFriendlyView ? 'ON' : 'OFF'}
              </span>
            </div>
            <ul className="mt-1.5 list-disc pl-4 space-y-0.5 text-xs leading-relaxed text-slate-300">
              <li>High focus on one exercise at a time.</li>
              <li>Clear border around your active move.</li>
            </ul>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={Boolean(answers.dyslexiaFriendlyView)}
            data-testid="onboarding-dyslexia-view-toggle"
            onClick={() =>
              setAnswers((p) => ({ ...p, dyslexiaFriendlyView: !p.dyslexiaFriendlyView }))
            }
            className={`w-full min-h-[60px] rounded-xl border-2 px-4 py-3 text-left transition ${
              answers.dyslexiaFriendlyView
                ? 'border-emerald-400 bg-emerald-600/20 text-white'
                : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold">Dyslexia-friendly view</span>
              <span className="text-xs font-extrabold text-emerald-300">
                {answers.dyslexiaFriendlyView ? 'ON' : 'OFF'}
              </span>
            </div>
            <ul className="mt-1.5 list-disc pl-4 space-y-0.5 text-xs leading-relaxed text-slate-300">
              <li>Turns on the OpenDyslexic reading font.</li>
              <li>Adds extra space between letters and lines.</li>
            </ul>
          </button>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2.5">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-700"
          >
            Back
          </button>
        )}
        {stepIndex < IKEA_QUIZ_ALL_STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.min(IKEA_QUIZ_ALL_STEPS.length - 1, i + 1))}
            className="min-h-[48px] flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500"
          >
            Next Step
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            className="min-h-[48px] flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500"
          >
            Start My Free Plan
          </button>
        )}
      </div>

      {onReturningUserLogin && (
        <button
          type="button"
          onClick={onReturningUserLogin}
          className="mt-3 w-full py-2 text-center text-xs font-bold text-sky-300 underline hover:text-sky-200"
        >
          Already have an account? Sign in instead
        </button>
      )}
    </section>
  );
};
