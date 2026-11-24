import React, { useRef, useState } from 'react';
import {
  DATA_BACKUP_MIGRATION_TITLE,
  DEFAULT_BACKUP_FILENAME
} from '../utils/dataMigrationAndPull';

export interface DataMigrationPanelProps {
  onExportJsonBackup?: () => void | Promise<void>;
  onImportJsonFile?: (jsonText: string, fileName: string) => void | Promise<void>;
  isImporting?: boolean;
  statusMessage?: string | null;
  statusKind?: 'idle' | 'success' | 'error';
  className?: string;
}

/**
 * Task 2: "Data Backup & Migration" Settings Utility
 * - Export Button: Downloads active gym_state as 7am_gym_backup.json.
 * - Import Button: Accepts a .json file, validates against gym_state schema, overwrites local state,
 *   and triggers an immediate Supabase cloud push for the active account.
 * - WCAG 2.2 / COGA compliant: >= 48x48px touch targets, clear ELI12 wording, rem-only sizing.
 */
export const DataMigrationPanel: React.FC<DataMigrationPanelProps> = ({
  onExportJsonBackup,
  onImportJsonFile,
  isImporting = false,
  statusMessage = null,
  statusKind = 'idle',
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset input value so re-selecting the same file still fires onChange
    event.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setLocalError('Please pick a .json backup file (example: 7am_gym_backup.json).');
      return;
    }

    setLocalError(null);
    try {
      const text = await file.text();
      if (onImportJsonFile) {
        await onImportJsonFile(text, file.name);
      }
    } catch {
      setLocalError('Could not read the selected file. Please try again.');
    }
  };

  const displayMessage = localError || statusMessage;
  const isError = Boolean(localError) || statusKind === 'error';

  return (
    <section
      aria-label={DATA_BACKUP_MIGRATION_TITLE}
      data-testid="data-backup-migration-panel"
      className={`rounded-xl border border-amber-400/50 bg-[var(--bg-surface-alt)] p-3.5 space-y-3 text-[var(--text-primary)] ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold leading-relaxed">
          {DATA_BACKUP_MIGRATION_TITLE}
        </h3>
        <span className="text-xs font-bold text-amber-300">JSON File</span>
      </div>

      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        Download a copy of your workouts and meals, or upload a backup file to move your data to this account.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="export-gym-json-btn"
          aria-label={`Export JSON backup as ${DEFAULT_BACKUP_FILENAME}`}
          onClick={() => {
            setLocalError(null);
            if (onExportJsonBackup) void onExportJsonBackup();
          }}
          className="w-full min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-xl border border-emerald-400/70 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-100 text-sm font-extrabold transition"
        >
          Export JSON Backup
        </button>

        <button
          type="button"
          disabled={isImporting}
          data-testid="import-gym-json-btn"
          aria-label="Import JSON backup file"
          onClick={() => {
            setLocalError(null);
            fileInputRef.current?.click();
          }}
          className="w-full min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-xl border border-amber-400/70 bg-amber-600/20 hover:bg-amber-600/30 disabled:opacity-60 text-amber-100 text-sm font-extrabold transition"
        >
          {isImporting ? 'Importing & Pushing...' : 'Import JSON Backup'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          data-testid="import-gym-json-input"
          aria-label="Choose a JSON backup file to import"
          onChange={handleFileChange}
          className="sr-only"
        />
      </div>

      {displayMessage && (
        <p
          role={isError ? 'alert' : 'status'}
          aria-live="polite"
          data-testid="data-migration-status-message"
          className={`text-xs font-bold leading-relaxed ${
            isError ? 'text-rose-300' : 'text-emerald-300'
          }`}
        >
          {displayMessage}
        </p>
      )}
    </section>
  );
};

export default DataMigrationPanel;
