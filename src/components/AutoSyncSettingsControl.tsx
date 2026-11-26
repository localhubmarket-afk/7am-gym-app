import React from 'react';
import {
  AUTO_SYNC_TOGGLE_SUBLABEL,
  CLOUD_SYNC_SECTION_LABEL,
  FORCE_PULL_CLOUD_LABEL,
  FORCE_SYNC_NOW_LABEL,
  type RealtimeSyncConnectionStatus
} from '../utils/realtimeAutoSync';

export interface AutoSyncSettingsControlProps {
  /** Retained as optional for backwards compatibility; automatic background sync is always on. */
  isAutoSyncEnabled?: boolean;
  onToggleAutoSync?: () => void;
  onForceSyncNow?: () => void | Promise<void>;
  onForcePullFromCloud?: () => void | Promise<void>;
  connectionStatus?: RealtimeSyncConnectionStatus;
  isSyncingNow?: boolean;
  isPullingNow?: boolean;
  statusMessage?: string;
  className?: string;
}

function getFriendlyStatusCopy(status?: RealtimeSyncConnectionStatus): string {
  if (status === 'offline') {
    return 'Offline — workouts save on this device and sync automatically when online.';
  }
  if (status === 'disconnected') {
    return 'Saving on this device — cloud sync will resume automatically.';
  }
  if (status === 'connecting') {
    return 'Connecting background cloud sync...';
  }
  return AUTO_SYNC_TOGGLE_SUBLABEL;
}

/**
 * Offline-First Automatic Cloud Sync Settings Control
 * - Background sync is invisible and always-on (manual toggle removed).
 * - Preserves both "Force Sync Now" and "Force Pull from Cloud" manual backup controls.
 * - WCAG 2.1 AA / COGA compliant: plain language, >= 4.5:1 contrast, rem typography, >= 48x48px touch targets.
 */
export const AutoSyncSettingsControl: React.FC<AutoSyncSettingsControlProps> = ({
  onForceSyncNow,
  onForcePullFromCloud,
  connectionStatus,
  isSyncingNow = false,
  isPullingNow = false,
  statusMessage,
  className = ''
}) => {
  const friendlyDescription = getFriendlyStatusCopy(connectionStatus);

  return (
    <section
      aria-label={CLOUD_SYNC_SECTION_LABEL}
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] p-3.5 space-y-3 text-[var(--text-primary)] ${className}`.trim()}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-extrabold leading-relaxed">
          {CLOUD_SYNC_SECTION_LABEL}
        </h3>
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          {friendlyDescription}
        </p>
      </div>

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
