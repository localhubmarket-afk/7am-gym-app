import React, { useMemo, useState } from 'react';
import {
  STANDARD_CARDIO_SESSIONS,
  groupExercisesByCategory,
  isBikingExercise,
  normalizeCardioExerciseName,
  type BikingEnvironment,
  type ExerciseDisplayCategory,
  type RoutineExerciseLike
} from '../utils/wizardValidation';

export type ExerciseFilterTab = 'all' | ExerciseDisplayCategory;

export interface ExerciseGroupViewProps<T extends RoutineExerciseLike> {
  exercises: T[];
  renderExerciseCard: (exercise: T, index: number) => React.ReactNode;
  onQuickAddCardio?: (cardioName: string) => void;
  bikingModeById?: Record<string, BikingEnvironment>;
  onToggleBikingMode?: (exerciseId: string, mode: BikingEnvironment) => void;
  defaultTab?: ExerciseFilterTab;
}

export function ExerciseGroupView<T extends RoutineExerciseLike>({
  exercises,
  renderExerciseCard,
  onQuickAddCardio,
  bikingModeById = {},
  onToggleBikingMode,
  defaultTab = 'all'
}: ExerciseGroupViewProps<T>) {
  const [activeTab, setActiveTab] = useState<ExerciseFilterTab>(defaultTab);
  const [localBikingModes, setLocalBikingModes] = useState<Record<string, BikingEnvironment>>({});

  const grouped = useMemo(() => groupExercisesByCategory(exercises), [exercises]);

  const showWeightlifting = activeTab === 'all' || activeTab === 'weightlifting';
  const showBodyweight = activeTab === 'all' || activeTab === 'bodyweight';
  const showCardio = activeTab === 'all' || activeTab === 'cardio';

  function getBikingMode(exerciseId: string): BikingEnvironment {
    return bikingModeById[exerciseId] || localBikingModes[exerciseId] || 'outdoor';
  }

  function handleBikingToggle(exerciseId: string, mode: BikingEnvironment) {
    setLocalBikingModes((prev) => ({ ...prev, [exerciseId]: mode }));
    onToggleBikingMode?.(exerciseId, mode);
  }

  return (
    <div className="space-y-4 text-slate-100">
      {/* Category Interface Tabs */}
      <div
        role="tablist"
        aria-label="Exercise Type Filter"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl border border-slate-700 bg-slate-950 p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          aria-label={`Show all exercises, ${exercises.length} total`}
          onClick={() => setActiveTab('all')}
          className={`min-h-[48px] min-w-[44px] rounded-xl px-2.5 py-2 text-xs font-extrabold transition ${
            activeTab === 'all'
              ? 'bg-sky-400 text-slate-950'
              : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
          }`}
        >
          All ({exercises.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'weightlifting'}
          aria-label={`Show weightlifting exercises, ${grouped.weightlifting.length} total`}
          onClick={() => setActiveTab('weightlifting')}
          className={`min-h-[48px] min-w-[44px] rounded-xl px-2.5 py-2 text-xs font-extrabold transition ${
            activeTab === 'weightlifting'
              ? 'bg-sky-400 text-slate-950'
              : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
          }`}
        >
          Weights ({grouped.weightlifting.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bodyweight'}
          aria-label={`Show bodyweight exercises, ${grouped.bodyweight.length} total`}
          onClick={() => setActiveTab('bodyweight')}
          className={`min-h-[48px] min-w-[44px] rounded-xl px-2.5 py-2 text-xs font-extrabold transition ${
            activeTab === 'bodyweight'
              ? 'bg-emerald-400 text-slate-950'
              : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
          }`}
        >
          Bodyweight ({grouped.bodyweight.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cardio'}
          aria-label={`Show cardio sessions, ${grouped.cardio.length} total`}
          onClick={() => setActiveTab('cardio')}
          className={`min-h-[48px] min-w-[44px] rounded-xl px-2.5 py-2 text-xs font-extrabold transition ${
            activeTab === 'cardio'
              ? 'bg-cyan-400 text-slate-950'
              : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
          }`}
        >
          Cardio ({grouped.cardio.length})
        </button>
      </div>

      {/* Section 1 (Lead): Overhand Pull-Ups immediately after Warm-Up */}
      {showBodyweight && grouped.pullUpsLead.length > 0 && (
        <section aria-labelledby="section-pullups-lead-heading" className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-amber-500/35 pb-1.5">
            <h3 id="section-pullups-lead-heading" className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              First Exercise • Overhand Pull-Ups
            </h3>
            <span className="text-[0.6875rem] font-bold text-slate-300">
              Right after Warm-Up
            </span>
          </div>
          <div className="space-y-3">
            {grouped.pullUpsLead.map((ex, idx) => (
              <React.Fragment key={ex.id || `pullup-${idx}`}>
                {renderExerciseCard(ex, idx)}
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Weightlifting Movements */}
      {showWeightlifting && grouped.weightlifting.length > 0 && (
        <section aria-labelledby="section-weightlifting-heading" className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <h3 id="section-weightlifting-heading" className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
              Weightlifting Movements
            </h3>
            <span className="text-[0.6875rem] font-bold text-slate-400">
              {grouped.weightlifting.length} loaded {grouped.weightlifting.length === 1 ? 'exercise' : 'exercises'}
            </span>
          </div>
          <div className="space-y-3">
            {grouped.weightlifting.map((ex, idx) => (
              <React.Fragment key={ex.id || `wt-${idx}`}>
                {renderExerciseCard(ex, grouped.pullUpsLead.length + idx)}
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Other Bodyweight Movements (Separated from Weightlifting) */}
      {showBodyweight && grouped.otherBodyweight.length > 0 && (
        <section aria-labelledby="section-bodyweight-heading" className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <h3 id="section-bodyweight-heading" className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              Bodyweight Movements
            </h3>
            <span className="text-[0.6875rem] font-bold text-slate-400">
              No weights needed ({grouped.otherBodyweight.length})
            </span>
          </div>
          <div className="space-y-3">
            {grouped.otherBodyweight.map((ex, idx) => (
              <React.Fragment key={ex.id || `bw-${idx}`}>
                {renderExerciseCard(ex, grouped.pullUpsLead.length + grouped.weightlifting.length + idx)}
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Dedicated Cardio Zone */}
      {showCardio && (
        <section aria-labelledby="section-cardio-heading" className="space-y-2.5 rounded-2xl border border-cyan-500/35 bg-slate-900/90 p-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <h3 id="section-cardio-heading" className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
              Cardio Zone
            </h3>
            <span className="text-[0.6875rem] font-bold text-slate-300">
              {grouped.cardio.length} {grouped.cardio.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>

          {grouped.cardio.length > 0 ? (
            <div className="space-y-3">
              {grouped.cardio.map((ex, idx) => {
                const exId = ex.id || `cardio-${idx}`;
                const normalizedEx = { ...ex, name: normalizeCardioExerciseName(ex.name) } as T;
                const showBikingToggle = isBikingExercise(normalizedEx);
                const activeEnv = getBikingMode(exId);

                return (
                  <div key={exId} className="space-y-2">
                    {showBikingToggle && (
                      <div
                        role="group"
                        aria-label="Biking Environment Toggle"
                        className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-slate-950 px-3 py-2"
                      >
                        <span className="text-xs font-extrabold text-cyan-200">Biking Type</span>
                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-700 bg-slate-900 p-1">
                          <button
                            type="button"
                            aria-pressed={activeEnv === 'indoor'}
                            aria-label="Set biking environment to Indoor"
                            onClick={() => handleBikingToggle(exId, 'indoor')}
                            className={`min-h-[48px] min-w-[44px] rounded-md px-3 py-2 text-xs font-extrabold transition ${
                              activeEnv === 'indoor'
                                ? 'bg-cyan-400 text-slate-950'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            Indoor
                          </button>
                          <button
                            type="button"
                            aria-pressed={activeEnv === 'outdoor'}
                            aria-label="Set biking environment to Outdoor"
                            onClick={() => handleBikingToggle(exId, 'outdoor')}
                            className={`min-h-[48px] min-w-[44px] rounded-md px-3 py-2 text-xs font-extrabold transition ${
                              activeEnv === 'outdoor'
                                ? 'bg-cyan-400 text-slate-950'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            Outdoor
                          </button>
                        </div>
                      </div>
                    )}
                    {renderExerciseCard(normalizedEx, idx)}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-slate-200">
              No cardio added today. Pick a cardio session below to track live time or log past cardio.
            </p>
          )}

          {onQuickAddCardio && (
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-bold text-cyan-200">Add Cardio Session</div>
              <div className="flex flex-wrap gap-2">
                {STANDARD_CARDIO_SESSIONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`Add ${preset} cardio session`}
                    onClick={() => onQuickAddCardio(preset)}
                    className="min-h-[48px] min-w-[48px] rounded-xl border border-cyan-500/50 bg-slate-950 px-3.5 py-2 text-xs font-extrabold text-cyan-200 transition hover:bg-slate-800"
                  >
                    + {preset === 'Rowing Machine' ? 'Rowing' : preset}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

