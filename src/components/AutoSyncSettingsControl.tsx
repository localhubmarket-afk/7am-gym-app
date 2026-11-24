import React from 'react';
import {
  AUTO_SYNC_TOGGLE_LABEL,
  AUTO_SYNC_TOGGLE_SUBLABEL,
  FORCE_PULL_CLOUD_LABEL,
  FORCE_SYNC_NOW_LABEL,
  type RealtimeSyncConnectionStatus
} from '../utils/realtimeAutoSync';

export interface AutoSyncSettingsControlProps {
  isAutoSyncEnabled: boolean;
  onToggleAutoSync: () => void;
  onForceSyncNow?: () => void | Promise<void>;
  onForcePullFromCloud?: () => void | Promise<void>;
  connectionStatus?: RealtimeSyncConnectionStatus;
  isSyncingNow?: boolean;
  isPullingNow?: boolean;
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
  onForcePullFromCloud,
  connectionStatus,
  isSyncingNow = false,
  isPullingNow = false,
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
          className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-extrabold text-gray-900"
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
        className={`btn-auto-sync-devices w-full min-h-[48px] min-w-[48px] px-4 py-3 rounded-xl border text-sm font-extrabold flex flex-wrap items-center justify-between gap-2 transition ${
          isAutoSyncEnabled
            ? 'border-green-500 bg-green-700 hover:bg-green-800 text-white'
            : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
        }`}
      >
        <span>{AUTO_SYNC_TOGGLE_LABEL}</span>
        <span>{isAutoSyncEnabled ? 'ON (Tap to turn off)' : 'OFF (Tap to turn on)'}</span>
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isSyncingNow || isPullingNow}
          data-testid="force-sync-now-btn"
          aria-label={FORCE_SYNC_NOW_LABEL}
          onClick={() => {
            if (onForceSyncNow) void onForceSyncNow();
          }}
          className="w-full min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-xl border border-sky-400/70 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-sky-100 text-sm font-extrabold transition"
        >
          {isSyncingNow ? 'Syncing Now...' : FORCE_SYNC_NOW_LABEL}
        </button>

        <button
          type="button"
          disabled={isPullingNow || isSyncingNow}
          data-testid="force-pull-cloud-btn"
          aria-label={FORCE_PULL_CLOUD_LABEL}
          onClick={() => {
            if (onForcePullFromCloud) void onForcePullFromCloud();
          }}
          className="w-full min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-xl border border-indigo-400/70 bg-indigo-950/70 hover:bg-indigo-900/70 disabled:opacity-60 text-indigo-100 text-sm font-extrabold transition"
        >
          {isPullingNow ? 'Downloading...' : FORCE_PULL_CLOUD_LABEL}
        </button>
      </div>

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
