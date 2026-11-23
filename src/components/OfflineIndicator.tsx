import React, { useEffect, useState } from 'react';
import { getPendingIndexedDbSyncItems } from '../utils/gymIndexedDb';

export interface OfflineIndicatorProps {
  pendingCountOverride?: number;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ pendingCountOverride }) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [pendingCount, setPendingCount] = useState<number>(pendingCountOverride ?? 0);

  useEffect(() => {
    if (typeof pendingCountOverride === 'number') {
      setPendingCount(pendingCountOverride);
    }
  }, [pendingCountOverride]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshPending = () => {
      if (typeof pendingCountOverride === 'number') return;
      getPendingIndexedDbSyncItems()
        .then((items) => setPendingCount(items.length))
        .catch(() => {});
    };

    const handleOnline = () => {
      setIsOnline(true);
      refreshPending();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshPending();
    };

    refreshPending();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingCountOverride]);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="rounded-xl border border-amber-400/50 bg-amber-950/60 px-3.5 py-2.5 text-xs font-bold leading-relaxed text-amber-100 flex items-center gap-2.5"
    >
      <span
        aria-hidden="true"
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          isOnline ? 'bg-emerald-400' : 'bg-amber-400'
        }`}
      />
      <span>
        {!isOnline
          ? pendingCount > 0
            ? `Offline mode: ${pendingCount} workout update(s) saved safely on this device. Will sync when online.`
            : 'Offline mode: Workouts save immediately on this device and sync automatically when online.'
          : `Back online: Syncing ${pendingCount} saved workout update(s) in the background.`}
      </span>
    </div>
  );
};

export default OfflineIndicator;
