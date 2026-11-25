import React, { useRef, useState } from 'react';
import {
  extractReadableTextFromPdfBytes,
  parseCustomWorkoutProgram,
  type ParsedCustomProgramResult
} from '../utils/customProgramImporter';

export interface CustomProgramUploadPanelProps {
  onApplyProgram: (parsed: ParsedCustomProgramResult) => void;
  className?: string;
}

const SAMPLE_PASTE_PLACEHOLDER = `Day 1: Upper Body
Barbell Bench Press 3x8-10
Dumbbell Row 3x10-12
Overhead Press 3x8

Day 2: Lower Body
Barbell Squat 3x6-8
Romanian Deadlift 3x8-10`;

/**
 * Task 4: Accessible Custom Workout Program Upload & Importer
 * - Supports CSV/Excel spreadsheets, JSON plans, TXT routines, and text-based PDFs.
 * - Includes a direct Paste Plan option for copying plans from Strong, Hevy, Google Sheets, or coaches.
 * - Strict ELI12 reading level, >= 44x44px touch targets, non-auth autocomplete="off" on all fields.
 */
export const CustomProgramUploadPanel: React.FC<CustomProgramUploadPanelProps> = ({
  onApplyProgram,
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [sourceName, setSourceName] = useState('My Custom Plan');
  const [parsedPreview, setParsedPreview] = useState<ParsedCustomProgramResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorList, setErrorList] = useState<string[]>([]);

  const handleParseText = (rawText: string, fileLabel: string) => {
    const result = parseCustomWorkoutProgram(rawText, fileLabel);
    setParsedPreview(result);
    if (!result.valid) {
      setErrorList(result.errors);
      setStatusMessage('');
      return;
    }
    setErrorList([]);
    setStatusMessage(
      `Ready to import "${result.programName}": ${result.days.length} day(s), ${result.totalExercises} exercise(s).`
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSourceName(file.name);
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.pdf')) {
      try {
        const buffer = await file.arrayBuffer();
        const extracted = extractReadableTextFromPdfBytes(new Uint8Array(buffer));
        if (extracted.isLikelyScannedImagePdf || !extracted.text) {
          setParsedPreview(null);
          setStatusMessage('');
          setErrorList([
            'This PDF looks like a scanned picture. Copy the workout text and paste it in the box below, or upload a CSV/TXT file.'
          ]);
          return;
        }
        setPastedText(extracted.text);
        handleParseText(extracted.text, file.name);
      } catch {
        setParsedPreview(null);
        setStatusMessage('');
        setErrorList(['Could not read that PDF file. Please paste the workout text below instead.']);
      }
      return;
    }

    try {
      const text = await file.text();
      setPastedText(text);
      handleParseText(text, file.name);
    } catch {
      setParsedPreview(null);
      setStatusMessage('');
      setErrorList(['Could not read that file. Please try a CSV, JSON, or TXT file.']);
    }
  };

  const handleApply = () => {
    if (!parsedPreview || !parsedPreview.valid) return;
    onApplyProgram(parsedPreview);
    setStatusMessage(`Saved "${parsedPreview.programName}" to your profile!`);
  };

  return (
    <section
      aria-label="Upload Custom Workout Program"
      data-testid="custom-program-upload-panel"
      className={`rounded-xl border border-emerald-400/50 bg-slate-950/95 p-3.5 space-y-3 text-white ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs sm:text-sm font-extrabold text-white">
          Upload Custom Workout Program
        </h4>
        <span className="rounded-md bg-green-100 px-2 py-0.5 text-[0.75rem] font-extrabold text-gray-900">
          CSV • JSON • TXT • PDF
        </span>
      </div>

      <ul className="list-disc pl-4 space-y-1 text-xs leading-relaxed text-slate-300">
        <li>Upload a spreadsheet (.csv), text plan (.txt), JSON file, or text PDF.</li>
        <li>Or paste your coach&apos;s plan below (example: Bench Press 3x8-10).</li>
        <li>We check every set and rep count before saving to your profile.</li>
      </ul>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,.txt,.pdf,text/csv,application/json,text/plain,application/pdf"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Choose custom workout program file"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          data-testid="upload-custom-program-file-btn"
          className="min-h-[48px] min-w-[48px] flex-1 rounded-xl border border-green-500 bg-green-700 hover:bg-green-800 px-3 py-2.5 text-xs font-extrabold text-white transition"
        >
          Upload Program File
        </button>
        <button
          type="button"
          onClick={() => handleParseText(pastedText, sourceName)}
          data-testid="preview-custom-program-btn"
          className="min-h-[48px] min-w-[48px] rounded-xl border border-sky-400/70 bg-slate-900 hover:bg-slate-800 px-3 py-2.5 text-xs font-extrabold text-sky-100 transition"
        >
          Check &amp; Preview Plan
        </button>
      </div>

      <div>
        <label
          htmlFor="custom-program-paste-textarea"
          className="block text-xs font-bold text-slate-200 mb-1"
        >
          Or Paste Your Workout Plan Here
        </label>
        <textarea
          id="custom-program-paste-textarea"
          name="gym_nonauth_custom_program_paste"
          rows={4}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder={SAMPLE_PASTE_PLACEHOLDER}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400"
        />
      </div>

      {errorList.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/50 bg-rose-950/60 p-2.5 text-xs font-semibold text-rose-200 space-y-1"
        >
          {errorList.map((err, idx) => (
            <p key={idx}>• {err}</p>
          ))}
        </div>
      )}

      {statusMessage && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-green-300 bg-green-100 px-2.5 py-1.5 text-xs font-extrabold text-gray-900"
        >
          {statusMessage}
        </p>
      )}

      {parsedPreview && parsedPreview.valid && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 space-y-2">
          <div className="text-xs font-extrabold text-emerald-300">
            Preview: {parsedPreview.programName} ({parsedPreview.days.length} days)
          </div>
          <ul className="space-y-1 text-xs text-slate-200">
            {parsedPreview.days.map((d) => (
              <li key={d.dayIndex}>
                • <strong>{d.dayName}</strong>: {d.exercises.length} exercises (
                {d.exercises
                  .slice(0, 3)
                  .map((ex) => `${ex.name} ${ex.sets}x${ex.reps}`)
                  .join(', ')}
                {d.exercises.length > 3 ? '...' : ''})
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleApply}
            data-testid="apply-custom-program-btn"
            className="min-h-[48px] w-full rounded-xl border border-green-500 bg-green-700 hover:bg-green-800 px-4 py-2.5 text-xs font-extrabold text-white transition"
          >
            Save Program to My Profile
          </button>
        </div>
      )}
    </section>
  );
};

export default CustomProgramUploadPanel;
