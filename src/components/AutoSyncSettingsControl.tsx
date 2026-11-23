import React from 'react';
import {
  AUTO_SYNC_TOGGLE_LABEL,
  AUTO_SYNC_TOGGLE_SUBLABEL,
  FORCE_SYNC_NOW_LABEL,
  type RealtimeSyncConnectionStatus
} from '../utils/realtimeAutoSync';

export interface AutoSyncSettingsControlProps {
  isAutoSyncEnabled: boolean;
  onToggleAutoSync: () => void;
  onForceSyncNow?: () => void | Promise<void>;
  connectionStatus?: RealtimeSyncConnectionStatus;
  isSyncingNow?: boolean;
  statusMessage?: string;
  className?: string;
}

function getFriendlyStatusCopy(
  enabled: boolean,
  status?: RealtimeSyncConnectionStatus
): string {
  if (!enabled || status === 'disabled') {
    return 'Off · Saving on this device only';
  }
  if (status === 'offline') {
    return 'Offline · Saving on this device';
  }
  if (status === 'disconnected') {
    return 'Paused · Saving on this device';
  }
  if (status === 'connecting') {
    return 'Connecting live sync...';
  }
  if (status === 'connected') {
    return 'Live Sync On';
  }
  return 'Auto-Sync On';
}

/**
 * Task 1 & Task 4: Accessible Real-Time Auto-Sync Settings Control
 * - Exact switch label: "Auto-Sync Devices"
 * - Exact sub-label: "Automatically saves your progress to the cloud and updates your other screens instantly."
 * - Secondary manual fallback button: "Force Sync Now"
 * - WCAG 2.2 / COGA compliant: ELI12 copy, high contrast, rem-only typography, >= 48x48px touch targets.
 */
export const AutoSyncSettingsControl: React.FC<AutoSyncSettingsControlProps> = ({
  isAutoSyncEnabled,
  onToggleAutoSync,
  onForceSyncNow,
  connectionStatus,
  isSyncingNow = false,
  statusMessage,
  className = ''
}) => {
  const friendlyStatus = getFriendlyStatusCopy(isAutoSyncEnabled, connectionStatus);

  return (
    <section
      aria-label="Auto-Sync Devices Settings"
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] p-3.5 space-y-3 text-[var(--text-primary)] ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-extrabold leading-relaxed">
          {AUTO_SYNC_TOGGLE_LABEL}
        </span>
        <span
          data-testid="auto-sync-status-badge"
          className="text-xs font-bold text-emerald-400"
        >
          {friendlyStatus}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        {AUTO_SYNC_TOGGLE_SUBLABEL}
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={isAutoSyncEnabled}
        aria-label={AUTO_SYNC_TOGGLE_LABEL}
        data-testid="toggle-auto-sync-devices-btn"
        onClick={onToggleAutoSync}
        className={`w-full min-h-[48px] min-w-[48px] px-4 py-3 rounded-xl border text-sm font-extrabold flex flex-wrap items-center justify-between gap-2 transition ${
          isAutoSyncEnabled
            ? 'border-emerald-400 bg-emerald-600 text-white'
            : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
        }`}
      >
        <span>{AUTO_SYNC_TOGGLE_LABEL}</span>
        <span>{isAutoSyncEnabled ? 'ON (Tap to turn off)' : 'OFF (Tap to turn on)'}</span>
      </button>

      <button
        type="button"
        disabled={isSyncingNow}
        data-testid="force-sync-now-btn"
        aria-label={FORCE_SYNC_NOW_LABEL}
        onClick={() => {
          if (onForceSyncNow) void onForceSyncNow();
        }}
        className="w-full min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-xl border border-sky-400/70 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-sky-100 text-sm font-extrabold transition"
      >
        {isSyncingNow ? 'Syncing Now...' : FORCE_SYNC_NOW_LABEL}
      </button>

      {statusMessage && (
        <p
          role="status"
          aria-live="polite"
          data-testid="auto-sync-feedback-message"
          className="text-xs font-bold leading-relaxed text-emerald-300"
        >
          {statusMessage}
        </p>
      )}
    </section>
  );
};

export default AutoSyncSettingsControl;
