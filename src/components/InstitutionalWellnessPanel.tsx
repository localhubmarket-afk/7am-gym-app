import React, { useState } from 'react';
import {
  normalizeInstitutionalEligibility,
  resolveInstitutionalBillingRoute,
  triggerClinicalTrialCsvDownload,
  type InstitutionalEligibilityFlags
} from '../utils/institutionalClinicalExport';

export interface InstitutionalWellnessPanelProps {
  /** Current institutional flags stored on gym_state.userProfile */
  eligibility?: Partial<InstitutionalEligibilityFlags> | null;
  /** Optional snapshot of current gym_state for 1-tap anonymized 12-week CSV export */
  gymState?: Record<string, unknown> | null;
  /** Callback when user toggles HSA/FSA Eligible or Corporate Wellness Sponsored */
  onUpdateEligibility?: (next: InstitutionalEligibilityFlags) => void | Promise<void>;
  /** Optional custom CSV export handler */
  onExportClinicalCsv?: () => void | Promise<void>;
  className?: string;
}

/**
 * Task 5: Institutional Revenue Data Structures & Clinical Export Panel
 * - User Profile boolean flags: "HSA/FSA Eligible" & "Corporate Wellness Sponsored"
 * - 1-tap Anonymized 12-Week Clinical Trial CSV Export (zero PII, formula-safe)
 * - 100% Free Beta: routes to billing stubs only, zero paywalls.
 * - WCAG 2.2 AA / COGA: >= 48x48px touch targets, high-contrast CSS variables, Grade 6-8 copy.
 */
export const InstitutionalWellnessPanel: React.FC<InstitutionalWellnessPanelProps> = ({
  eligibility,
  gymState,
  onUpdateEligibility,
  onExportClinicalCsv,
  className = ''
}) => {
  const [localEligibility, setLocalEligibility] = useState<InstitutionalEligibilityFlags>(() =>
    normalizeInstitutionalEligibility(eligibility as Record<string, unknown> | null)
  );
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const activeEligibility =
    eligibility !== undefined && eligibility !== null
      ? normalizeInstitutionalEligibility(eligibility as Record<string, unknown>)
      : localEligibility;

  const billingSummary = resolveInstitutionalBillingRoute(activeEligibility);

  const handleToggle = (key: 'isHsaFsaEligible' | 'isCorporateWellnessSponsored') => {
    const next = normalizeInstitutionalEligibility({
      ...activeEligibility,
      [key]: !activeEligibility[key],
      institutionalUpdatedAt: new Date().toISOString()
    });
    setLocalEligibility(next);
    if (onUpdateEligibility) {
      void onUpdateEligibility(next);
    }
  };

  const handleExportCsv = async () => {
    try {
      if (onExportClinicalCsv) {
        await onExportClinicalCsv();
        setExportStatus('Anonymized 12-week clinical trial CSV exported (zero personal info included).');
        return;
      }
      const res = triggerClinicalTrialCsvDownload(gymState || { userProfile: activeEligibility });
      setExportStatus(
        `Exported ${res.rowCount} anonymized weekly rows as ${res.filename} (Participant ID: ${res.participantAnonId}).`
      );
    } catch (err) {
      setExportStatus(
        err instanceof Error ? err.message : 'Could not export the clinical trial CSV right now.'
      );
    }
  };

  return (
    <section
      aria-label="Institutional Wellness Eligibility and Clinical Trial Export"
      data-testid="institutional-wellness-panel"
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-left text-[var(--text-primary)] space-y-3 ${className}`.trim()}
    >
      <div className="flex flex-col items-start gap-2">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold leading-snug text-[var(--text-primary)]">
            Wellness Benefits &amp; Clinical Trial Export
          </h3>
          <span
            data-testid="institutional-billing-route-badge"
            className="inline-flex items-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface-alt)] px-2.5 py-1 text-[0.75rem] font-extrabold text-[var(--text-primary)]"
          >
            {billingSummary.label}
          </span>
        </div>
        <p className="w-full text-xs leading-relaxed text-[var(--text-secondary)]">
          Tag your profile for HSA/FSA or employer wellness billing stubs later, or download an anonymized 12-week workout summary. Everything stays 100% free during beta.
        </p>
      </div>

      {/* Boolean Flag 1: HSA/FSA Eligible */}
      <button
        type="button"
        role="switch"
        aria-checked={activeEligibility.isHsaFsaEligible}
        data-testid="toggle-hsa-fsa-eligible-btn"
        onClick={() => handleToggle('isHsaFsaEligible')}
        className={`w-full min-h-[48px] min-w-[48px] px-4 py-3 rounded-xl border text-sm font-extrabold flex flex-wrap items-center justify-between gap-2 transition ${
          activeEligibility.isHsaFsaEligible
            ? 'border-emerald-400 bg-emerald-600 text-white'
            : 'border-[var(--border-strong)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)]'
        }`}
      >
        <span>HSA/FSA Eligible</span>
        <span>{activeEligibility.isHsaFsaEligible ? 'ON' : 'OFF'}</span>
      </button>

      {/* Boolean Flag 2: Corporate Wellness Sponsored */}
      <button
        type="button"
        role="switch"
        aria-checked={activeEligibility.isCorporateWellnessSponsored}
        data-testid="toggle-corporate-wellness-btn"
        onClick={() => handleToggle('isCorporateWellnessSponsored')}
        className={`w-full min-h-[48px] min-w-[48px] px-4 py-3 rounded-xl border text-sm font-extrabold flex flex-wrap items-center justify-between gap-2 transition ${
          activeEligibility.isCorporateWellnessSponsored
            ? 'border-sky-400 bg-sky-600 text-white'
            : 'border-[var(--border-strong)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)]'
        }`}
      >
        <span>Corporate Wellness Sponsored</span>
        <span>{activeEligibility.isCorporateWellnessSponsored ? 'ON' : 'OFF'}</span>
      </button>

      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        {billingSummary.eli12Description}
      </p>

      {/* 12-Week Anonymized Clinical Trial CSV Export */}
      <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
        <button
          type="button"
          data-testid="export-clinical-trial-csv-btn"
          onClick={() => void handleExportCsv()}
          className="w-full min-h-[48px] min-w-[48px] rounded-xl border border-indigo-400/70 bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          Export Anonymized 12-Week Clinical Trial CSV
        </button>
        {exportStatus && (
          <p
            role="status"
            aria-live="polite"
            data-testid="clinical-export-status"
            className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface-alt)] px-3 py-2 text-xs font-bold leading-relaxed text-[var(--text-primary)]"
          >
            {exportStatus}
          </p>
        )}
      </div>
    </section>
  );
};

export default InstitutionalWellnessPanel;
