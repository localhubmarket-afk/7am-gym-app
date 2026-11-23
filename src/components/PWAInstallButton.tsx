import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export interface PWAInstallButtonProps {
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ className = '' }) => {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isInstalled || (!canInstall && !isIOS)) {
    return null;
  }

  return (
    <div className={`inline-flex flex-col items-end ${className}`}>
      <button
        type="button"
        onClick={isIOS ? () => setShowIosGuide((prev) => !prev) : () => void promptInstall()}
        aria-label="Install Budget Gym app on your device"
        aria-expanded={isIOS ? showIosGuide : undefined}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold leading-relaxed tracking-wide transition focus:outline-none focus:ring-2 focus:ring-emerald-300"
      >
        <span aria-hidden="true">+</span>
        <span>Install App</span>
      </button>

      {showIosGuide && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Install Budget Gym on iPhone or iPad"
          className="mt-2 max-w-xs rounded-2xl border border-emerald-400/50 bg-slate-900 p-3.5 text-left text-xs leading-relaxed text-slate-100 shadow-xl"
        >
          <p className="font-extrabold text-emerald-300">Add to Home Screen</p>
          <p className="mt-1">
            Tap the Share button in Safari, then choose Add to Home Screen to use Budget Gym offline.
          </p>
          <button
            type="button"
            onClick={() => setShowIosGuide(false)}
            aria-label="Close install instructions"
            className="mt-2.5 min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
};

export default PWAInstallButton;
