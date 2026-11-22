import React, { useMemo, useState } from 'react';
import {
  groupExercisesByCategory,
  type ExerciseDisplayCategory,
  type RoutineExerciseLike
} from '../utils/wizardValidation';

export type ExerciseFilterTab = 'all' | ExerciseDisplayCategory;

export interface ExerciseGroupViewProps<T extends RoutineExerciseLike> {
  exercises: T[];
  renderExerciseCard: (exercise: T, index: number) => React.ReactNode;
  onQuickAddCardio?: (cardioName: string) => void;
  defaultTab?: ExerciseFilterTab;
}

const QUICK_CARDIO_PRESETS = ['Outdoor Biking', 'Treadmill', 'Rowing Machine'];

export function ExerciseGroupView<T extends RoutineExerciseLike>({
  exercises,
  renderExerciseCard,
  onQuickAddCardio,
  defaultTab = 'all'
}: ExerciseGroupViewProps<T>) {
  const [activeTab, setActiveTab] = useState<ExerciseFilterTab>(defaultTab);

  const grouped = useMemo(() => groupExercisesByCategory(exercises), [exercises]);

  const showWeightlifting = activeTab === 'all' || activeTab === 'weightlifting';
  const showBodyweight = activeTab === 'all' || activeTab === 'bodyweight';
  const showCardio = activeTab === 'all' || activeTab === 'cardio';

  return (
    <div className="space-y-4 text-slate-100">
      {/* Category Interface Tabs */}
      <div
        role="tablist"
        aria-label="Exercise Type Filter"
        className="grid grid-cols-4 gap-1.5 rounded-2xl border border-slate-800 bg-slate-950 p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          className={`rounded-xl px-2 py-2 text-xs font-extrabold transition ${
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
          onClick={() => setActiveTab('weightlifting')}
          className={`rounded-xl px-2 py-2 text-xs font-extrabold transition ${
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
          onClick={() => setActiveTab('bodyweight')}
          className={`rounded-xl px-2 py-2 text-xs font-extrabold transition ${
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
          onClick={() => setActiveTab('cardio')}
          className={`rounded-xl px-2 py-2 text-xs font-extrabold transition ${
            activeTab === 'cardio'
              ? 'bg-cyan-400 text-slate-950'
              : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
          }`}
        >
          Cardio ({grouped.cardio.length})
        </button>
      </div>

      {/* Section 1: Weightlifting Movements */}
      {showWeightlifting && grouped.weightlifting.length > 0 && (
        <section aria-labelledby="section-weightlifting-heading" className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <h3 id="section-weightlifting-heading" className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
              Weightlifting Movements
            </h3>
            <span className="text-[11px] font-bold text-slate-400">
              {grouped.weightlifting.length} loaded {grouped.weightlifting.length === 1 ? 'exercise' : 'exercises'}
            </span>
          </div>
          <div className="space-y-3">
            {grouped.weightlifting.map((ex, idx) => (
              <React.Fragment key={ex.id || `wt-${idx}`}>
                {renderExerciseCard(ex, idx)}
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Bodyweight Movements (Separated from Weightlifting) */}
      {showBodyweight && grouped.bodyweight.length > 0 && (
        <section aria-labelledby="section-bodyweight-heading" className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <h3 id="section-bodyweight-heading" className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              Bodyweight Movements
            </h3>
            <span className="text-[11px] font-bold text-slate-400">
              No weights needed ({grouped.bodyweight.length})
            </span>
          </div>
          <div className="space-y-3">
            {grouped.bodyweight.map((ex, idx) => (
              <React.Fragment key={ex.id || `bw-${idx}`}>
                {renderExerciseCard(ex, idx)}
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Dedicated Cardio Section */}
      {showCardio && (
        <section aria-labelledby="section-cardio-heading" className="space-y-2.5 rounded-2xl border border-cyan-500/35 bg-slate-900/90 p-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <h3 id="section-cardio-heading" className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
              Cardio Zone
            </h3>
            <span className="text-[11px] font-bold text-slate-300">
              {grouped.cardio.length} {grouped.cardio.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>

          {grouped.cardio.length > 0 ? (
            <div className="space-y-3">
              {grouped.cardio.map((ex, idx) => (
                <React.Fragment key={ex.id || `cardio-${idx}`}>
                  {renderExerciseCard(ex, idx)}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-300">
              No cardio added today. Tap a cardio workout below to track live time or log distance manually.
            </p>
          )}

          {onQuickAddCardio && (
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {QUICK_CARDIO_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onQuickAddCardio(preset)}
                  className="rounded-xl border border-cyan-500/40 bg-slate-950 px-2 py-2 text-[11px] font-extrabold text-cyan-200 transition hover:bg-slate-800"
                >
                  + {preset}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
