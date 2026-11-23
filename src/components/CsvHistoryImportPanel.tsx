import React, { useState } from 'react';
import {
  parseWorkoutHistoryCsv,
  type CsvImportResult
} from '../utils/csvHistoryImporter';

export interface CsvHistoryImportPanelProps {
  targetWeek: number;
  onImportParsed: (result: CsvImportResult) => void;
}

export const CsvHistoryImportPanel: React.FC<CsvHistoryImportPanelProps> = ({
  targetWeek,
  onImportParsed
}) => {
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage('');
    try {
      const text = await file.text();
      const parsed = parseWorkoutHistoryCsv(text, { targetWeek });
      if (parsed.errors.length > 0 && parsed.importedSetsCount === 0) {
        setErrorMessage(parsed.errors[0]);
        setStatusMessage('');
        return;
      }
      onImportParsed(parsed);
      setStatusMessage(
        `Imported ${parsed.importedSetsCount} sets from ${parsed.detectedApp.toUpperCase()} (${parsed.uniqueExercises.length} exercises).`
      );
    } catch {
      setErrorMessage('Could not read that CSV file. Please export a standard CSV from Strong, Hevy, or Fitbod.');
    }
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3.5 text-left">
      <h3 className="text-sm font-extrabold text-white">Import Past Workouts (CSV)</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">
        Bring your lift history from Strong, Hevy, or Fitbod. Your existing logged sets will never be overwritten.
      </p>
      <label className="mt-3 block">
        <span className="sr-only">Upload Strong, Hevy, or Fitbod CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="block w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
        />
      </label>
      {statusMessage && (
        <p role="status" className="mt-2 rounded-lg border border-emerald-500/50 bg-emerald-950/50 px-3 py-2 text-xs font-bold text-emerald-200">
          ✓ {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p role="alert" className="mt-2 rounded-lg border border-rose-500/50 bg-rose-950/50 px-3 py-2 text-xs font-bold text-rose-200">
          ! {errorMessage}
        </p>
      )}
    </div>
  );
};
