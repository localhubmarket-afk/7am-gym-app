import React, { useState } from 'react';
import {
  NEXT_WEEK_NOTE_QUICK_CHIPS,
  buildNextWeekProgressionNote
} from '../utils/customProgramImporter';

export interface NextWeekNoteControlProps {
  exerciseId: string;
  exerciseName: string;
  initialNote?: string;
  onSaveNote: (exerciseId: string, noteText: string, quickTag: string | null) => void;
}

/**
 * Task 4 & Task 1: Dedicated Next-Week Progression Note Control
 * - Lets users leave a quick cue for next week (+5 lbs, +1 rep, cleaner form, or custom text).
 * - Uses strict non-auth attributes (autoComplete="off", data-lpignore="true") so mobile OS
 *   keyboards never mistake a workout note for a login or password field.
 */
export const NextWeekNoteControl: React.FC<NextWeekNoteControlProps> = ({
  exerciseId,
  exerciseName,
  initialNote = '',
  onSaveNote
}) => {
  const [noteText, setNoteText] = useState(initialNote);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const commitNote = (nextText: string, quickTag: string | null) => {
    const validated = buildNextWeekProgressionNote({
      exerciseId,
      text: nextText,
      quickTag
    });
    if (!validated.valid || !validated.note) {
      setErrorMessage(validated.errorMessage);
      return;
    }
    setErrorMessage(null);
    setNoteText(validated.note.text);
    onSaveNote(exerciseId, validated.note.text, quickTag);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1800);
  };

  return (
    <div
      data-testid={`next-week-note-control-${exerciseId}`}
      className="rounded-xl border border-indigo-400/40 bg-slate-950/90 p-2.5 space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label
          htmlFor={`next-week-note-input-${exerciseId}`}
          className="text-xs font-extrabold text-indigo-200"
        >
          Next Week Plan Note ({exerciseName})
        </label>
        {savedFeedback && (
          <span
            role="status"
            aria-live="polite"
            className="rounded-md bg-green-100 px-2 py-0.5 text-[0.75rem] font-extrabold text-gray-900"
          >
            Saved!
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {NEXT_WEEK_NOTE_QUICK_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => commitNote(chip.noteText, chip.id)}
            className="min-h-[44px] rounded-lg border border-indigo-400/45 bg-slate-900 hover:bg-indigo-950/70 px-2.5 py-1.5 text-xs font-bold text-indigo-100 transition"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <input
        id={`next-week-note-input-${exerciseId}`}
        name={`gym_nonauth_next_week_${exerciseId}`}
        type="text"
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        data-bwignore="true"
        data-form-type="other"
        data-non-auth-input="true"
        value={noteText}
        onChange={(e) => {
          const val = e.target.value;
          setNoteText(val);
          commitNote(val, null);
        }}
        placeholder="Example: Add +5 lbs next week or pause 1 sec at bottom"
        className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
      />

      {errorMessage && (
        <p role="alert" className="text-xs font-bold text-rose-300">
          {errorMessage}
        </p>
      )}
    </div>
  );
};

export default NextWeekNoteControl;
