import { computeRolling30DayConsistencyScore } from './adherenceEngine';
import type { DailyBiometricsSnapshot } from './biometricSync';

export const CLINICAL_TRIAL_EXPORT_WEEKS = 12;
export const DEFAULT_CLINICAL_TRIAL_SALT = 'budget-gym-clinical-v1';

export type InstitutionalBillingRouteStub =
  | 'free_beta_direct'
  | 'hsa_fsa_lmn_stub'
  | 'corporate_wellness_sso_stub'
  | 'dual_institutional_stub';

export interface InstitutionalEligibilityFlags {
  /** Boolean profile flag: "HSA/FSA Eligible" */
  isHsaFsaEligible: boolean;
  /** Boolean profile flag: "Corporate Wellness Sponsored" */
  isCorporateWellnessSponsored: boolean;
  /** Optional future sponsor organization code (never required, zero paywalls) */
  sponsorOrganizationCode: string | null;
  /** Deterministic future billing route stub (100% Free Beta remains active) */
  billingRouteStub: InstitutionalBillingRouteStub;
  /** Explicit beta guarantee so no feature is ever paywalled */
  isFreeBetaActive: true;
  updatedAt?: string;
}

export interface ExtendedInstitutionalUserProfile extends Record<string, unknown> {
  isHsaFsaEligible?: boolean;
  isCorporateWellnessSponsored?: boolean;
  sponsorOrganizationCode?: string | null;
  billingRouteStub?: InstitutionalBillingRouteStub;
}

export interface InstitutionalBillingRouteSummary {
  billingRouteStub: InstitutionalBillingRouteStub;
  label: string;
  eli12Description: string;
  isFreeBetaActive: true;
}

export interface ClinicalTrialWeeklyRow {
  participant_anon_id: string;
  trial_week_number: number;
  planned_sessions: number;
  completed_sessions: number;
  weekly_adherence_pct: number;
  rolling_30d_consistency_pct: number;
  completed_sets: number;
  total_volume_load: number;
  low_spoons_sessions_count: number;
  avg_sleep_hours: string;
  avg_daily_steps: string;
  avg_resting_hr_bpm: string;
  hsa_fsa_eligible: 'true' | 'false';
  corporate_wellness_sponsored: 'true' | 'false';
  billing_route_stub: InstitutionalBillingRouteStub;
}

export interface ClinicalTrialExportResult {
  participantAnonId: string;
  generatedAtIso: string;
  rowCount: number;
  rows: ClinicalTrialWeeklyRow[];
  csv: string;
  filename: string;
}

const CLINICAL_CSV_HEADERS: ReadonlyArray<keyof ClinicalTrialWeeklyRow> = [
  'participant_anon_id',
  'trial_week_number',
  'planned_sessions',
  'completed_sessions',
  'weekly_adherence_pct',
  'rolling_30d_consistency_pct',
  'completed_sets',
  'total_volume_load',
  'low_spoons_sessions_count',
  'avg_sleep_hours',
  'avg_daily_steps',
  'avg_resting_hr_bpm',
  'hsa_fsa_eligible',
  'corporate_wellness_sponsored',
  'billing_route_stub'
];

export function resolveInstitutionalBillingRoute(flags: {
  isHsaFsaEligible?: unknown;
  isCorporateWellnessSponsored?: unknown;
}): InstitutionalBillingRouteSummary {
  const hsa = Boolean(flags?.isHsaFsaEligible);
  const corp = Boolean(flags?.isCorporateWellnessSponsored);

  if (hsa && corp) {
    return {
      billingRouteStub: 'dual_institutional_stub',
      label: 'HSA/FSA + Corporate Wellness Stub',
      eli12Description:
        'Your profile is marked for both HSA/FSA and Corporate Wellness billing later. Everything stays 100% free during beta.',
      isFreeBetaActive: true
    };
  }
  if (corp) {
    return {
      billingRouteStub: 'corporate_wellness_sso_stub',
      label: 'Corporate Wellness Sponsored Stub',
      eli12Description:
        'Your profile is tagged for employer wellness sponsorship later. Everything stays 100% free during beta.',
      isFreeBetaActive: true
    };
  }
  if (hsa) {
    return {
      billingRouteStub: 'hsa_fsa_lmn_stub',
      label: 'HSA/FSA Eligible (LMN Receipt Stub)',
      eli12Description:
        'Your profile is tagged for HSA/FSA Letter of Medical Necessity receipts later. Everything stays 100% free during beta.',
      isFreeBetaActive: true
    };
  }
  return {
    billingRouteStub: 'free_beta_direct',
    label: 'Free Beta (Direct Access)',
    eli12Description:
      'Standard 100% free beta access. Turn on either switch if you plan to use HSA/FSA or employer wellness benefits later.',
    isFreeBetaActive: true
  };
}

export function normalizeInstitutionalEligibility(
  rawProfile?: Record<string, unknown> | null
): InstitutionalEligibilityFlags {
  const src = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
  const isHsaFsaEligible = Boolean(src.isHsaFsaEligible);
  const isCorporateWellnessSponsored = Boolean(src.isCorporateWellnessSponsored);
  const rawCode =
    typeof src.sponsorOrganizationCode === 'string'
      ? src.sponsorOrganizationCode.trim().slice(0, 64)
      : '';
  const route = resolveInstitutionalBillingRoute({
    isHsaFsaEligible,
    isCorporateWellnessSponsored
  });

  return {
    isHsaFsaEligible,
    isCorporateWellnessSponsored,
    sponsorOrganizationCode: rawCode ? rawCode : null,
    billingRouteStub: route.billingRouteStub,
    isFreeBetaActive: true,
    updatedAt: typeof src.institutionalUpdatedAt === 'string' ? src.institutionalUpdatedAt : undefined
  };
}

/**
 * Pure immutability-safe helper that writes `isHsaFsaEligible` and `isCorporateWellnessSponsored`
 * into `gymState.userProfile` while strictly preserving every pre-existing profile field.
 */
export function applyInstitutionalFlagsToUserProfile<T extends Record<string, unknown>>(
  gymState: T,
  patch: Partial<{
    isHsaFsaEligible: boolean;
    isCorporateWellnessSponsored: boolean;
    sponsorOrganizationCode: string | null;
  }>
): T & { userProfile: ExtendedInstitutionalUserProfile } {
  const safeState = gymState && typeof gymState === 'object' ? gymState : ({} as T);
  const existingProfile =
    safeState.userProfile && typeof safeState.userProfile === 'object'
      ? (safeState.userProfile as Record<string, unknown>)
      : {};

  const nextHsa =
    typeof patch.isHsaFsaEligible === 'boolean'
      ? patch.isHsaFsaEligible
      : Boolean(existingProfile.isHsaFsaEligible);
  const nextCorp =
    typeof patch.isCorporateWellnessSponsored === 'boolean'
      ? patch.isCorporateWellnessSponsored
      : Boolean(existingProfile.isCorporateWellnessSponsored);
  const nextOrgCode =
    patch.sponsorOrganizationCode !== undefined
      ? (patch.sponsorOrganizationCode || '').trim().slice(0, 64) || null
      : typeof existingProfile.sponsorOrganizationCode === 'string'
        ? existingProfile.sponsorOrganizationCode.trim().slice(0, 64) || null
        : null;

  const route = resolveInstitutionalBillingRoute({
    isHsaFsaEligible: nextHsa,
    isCorporateWellnessSponsored: nextCorp
  });

  const nextProfile: ExtendedInstitutionalUserProfile = {
    ...existingProfile,
    isHsaFsaEligible: nextHsa,
    isCorporateWellnessSponsored: nextCorp,
    sponsorOrganizationCode: nextOrgCode,
    billingRouteStub: route.billingRouteStub,
    institutionalUpdatedAt: new Date().toISOString()
  };

  return {
    ...safeState,
    userProfile: nextProfile
  };
}

/**
 * Generates a deterministic, non-reversible pseudonymous clinical participant ID (zero PII).
 * Uses dual 32-bit FNV-1a lanes so no email, username, or raw account ID can ever leak into exports.
 */
export function anonymizeParticipantId(
  rawIdentifier: string | null | undefined,
  studySalt: string = DEFAULT_CLINICAL_TRIAL_SALT
): string {
  const normalized = String(rawIdentifier || 'anonymous-beta-participant').trim().toLowerCase();
  const payload = `${studySalt}::${normalized}`;

  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < payload.length; i += 1) {
    const c = payload.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c ^ ((i + 17) & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }

  const hex1 = h1.toString(16).padStart(8, '0').toUpperCase();
  const hex2 = h2.toString(16).padStart(8, '0').toUpperCase().slice(0, 4);
  return `PT-${hex1}${hex2}`;
}

/**
 * RFC-4180 CSV escaping with strict formula-injection neutralization (=, +, -, @, tab, CR).
 */
export function escapeCsvCellSafe(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const isPureNumeric = /^-?\d+(\.\d+)?$/.test(raw.trim());
  const neutralized =
    !isPureNumeric && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;

  if (/[",\r\n]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

function parseWeekNumberFromLogKey(logKey: string): number {
  const match = String(logKey || '').match(/(?:^|[_-])w(?:eek)?(\d{1,2})(?:[_-]|$)/i);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 52) {
      return parsed;
    }
  }
  return 1;
}

function parseDayIdentifierFromLogKey(logKey: string): string {
  const match = String(logKey || '').match(/(?:^|[_-])d(?:ay)?(\d+)(?:[_-]|$)/i);
  if (match) return `d${match[1]}`;
  return String(logKey || '').split('_')[0] || 'd1';
}

function isCompletedSetEntry(entry: unknown): {
  completed: boolean;
  weight: number;
  reps: number;
  dateIso: string | null;
} {
  if (!entry || typeof entry !== 'object') {
    return { completed: false, weight: 0, reps: 0, dateIso: null };
  }
  const rec = entry as Record<string, unknown>;
  const weight = Number(rec.weight ?? rec.w ?? 0) || 0;
  const reps = Number(rec.reps ?? rec.r ?? 0) || 0;
  const completed = Boolean(rec.done || rec.completed || reps > 0);
  const rawDate = rec.completedAt ?? rec.loggedAt ?? rec.updatedAt ?? rec.date ?? null;
  const dateIso =
    typeof rawDate === 'string' && rawDate.trim().length >= 10
      ? rawDate.trim().slice(0, 10)
      : null;

  return {
    completed,
    weight: Math.max(0, weight),
    reps: Math.max(0, Math.round(reps)),
    dateIso
  };
}

/**
 * Builds 12 anonymized weekly clinical-trial rows (Weeks 1–12) strictly stripped of PII.
 * Captures adherence, rolling 30-day consistency, volume load, low-spoons scaling frequency,
 * wearable biometric averages (sleep, steps, resting HR), and institutional eligibility flags.
 */
export function buildAnonymized12WeekClinicalTrialRows(
  gymState: Record<string, unknown> | null | undefined,
  options?: {
    plannedSessionsPerWeek?: number;
    studySalt?: string;
    referenceDateIso?: string;
  }
): { participantAnonId: string; rows: ClinicalTrialWeeklyRow[] } {
  const safeState = gymState && typeof gymState === 'object' ? gymState : {};
  const userProfile =
    safeState.userProfile && typeof safeState.userProfile === 'object'
      ? (safeState.userProfile as Record<string, unknown>)
      : {};

  const rawIdCandidate =
    (typeof userProfile.email === 'string' && userProfile.email.trim()) ||
    (typeof safeState.activeUserId === 'string' && safeState.activeUserId.trim()) ||
    (typeof userProfile.name === 'string' && userProfile.name.trim()) ||
    'guest-participant';

  const participantAnonId = anonymizeParticipantId(
    rawIdCandidate,
    options?.studySalt || DEFAULT_CLINICAL_TRIAL_SALT
  );

  const eligibility = normalizeInstitutionalEligibility(userProfile);
  const plannedPerWeek = Math.max(
    1,
    Math.min(
      7,
      Math.round(
        Number(
          options?.plannedSessionsPerWeek ??
            userProfile.daysPerWeek ??
            (safeState.programConfig as Record<string, unknown> | undefined)?.daysPerWeek ??
            4
        ) || 4
      )
    )
  );

  const workoutLogs =
    safeState.workoutLogs && typeof safeState.workoutLogs === 'object'
      ? (safeState.workoutLogs as Record<string, unknown>)
      : {};

  const weeklyBuckets = new Map<
    number,
    {
      dayTokens: Set<string>;
      completedSets: number;
      totalVolume: number;
      completedDates: string[];
    }
  >();

  for (let week = 1; week <= CLINICAL_TRIAL_EXPORT_WEEKS; week += 1) {
    weeklyBuckets.set(week, {
      dayTokens: new Set<string>(),
      completedSets: 0,
      totalVolume: 0,
      completedDates: []
    });
  }

  const allCompletedDates: string[] = [];

  for (const [key, value] of Object.entries(workoutLogs)) {
    const weekNum = Math.min(CLINICAL_TRIAL_EXPORT_WEEKS, Math.max(1, parseWeekNumberFromLogKey(key)));
    const bucket = weeklyBuckets.get(weekNum);
    if (!bucket) continue;

    const entries = Array.isArray(value) ? value : [value];
    for (const item of entries) {
      const parsed = isCompletedSetEntry(item);
      if (!parsed.completed) continue;
      bucket.completedSets += 1;
      bucket.totalVolume += parsed.weight * parsed.reps;
      bucket.dayTokens.add(parsed.dateIso || parseDayIdentifierFromLogKey(key));
      if (parsed.dateIso) {
        bucket.completedDates.push(parsed.dateIso);
        allCompletedDates.push(parsed.dateIso);
      }
    }
  }

  // Biometrics context (from biometricsHistory array or latest biometricsSnapshot)
  const biometricsList: DailyBiometricsSnapshot[] = [];
  if (Array.isArray(safeState.biometricsHistory)) {
    for (const item of safeState.biometricsHistory) {
      if (item && typeof item === 'object' && typeof (item as DailyBiometricsSnapshot).sleepHours === 'number') {
        biometricsList.push(item as DailyBiometricsSnapshot);
      }
    }
  }
  if (
    biometricsList.length === 0 &&
    safeState.biometricsSnapshot &&
    typeof safeState.biometricsSnapshot === 'object' &&
    typeof (safeState.biometricsSnapshot as DailyBiometricsSnapshot).sleepHours === 'number'
  ) {
    biometricsList.push(safeState.biometricsSnapshot as DailyBiometricsSnapshot);
  }

  const avgSleep =
    biometricsList.length > 0
      ? (
          biometricsList.reduce((acc, b) => acc + (Number(b.sleepHours) || 0), 0) /
          biometricsList.length
        ).toFixed(1)
      : '';
  const avgSteps =
    biometricsList.length > 0
      ? String(
          Math.round(
            biometricsList.reduce((acc, b) => acc + (Number(b.dailySteps) || 0), 0) /
              biometricsList.length
          )
        )
      : '';
  const validHr = biometricsList.filter(
    (b) => typeof b.restingHeartRateBpm === 'number' && Number.isFinite(b.restingHeartRateBpm)
  );
  const avgHr =
    validHr.length > 0
      ? String(
          Math.round(
            validHr.reduce((acc, b) => acc + (Number(b.restingHeartRateBpm) || 0), 0) /
              validHr.length
          )
        )
      : '';

  const lowSpoonsCountGlobal =
    safeState.activeLowSpoonsPreset && typeof safeState.activeLowSpoonsPreset === 'object' ? 1 : 0;

  const refDate = options?.referenceDateIso ? new Date(`${options.referenceDateIso}T12:00:00Z`) : new Date();
  const rollingScore = computeRolling30DayConsistencyScore({
    plannedDaysPerWeek: plannedPerWeek,
    workoutLogs,
    completedSessionDates: allCompletedDates,
    referenceDate: refDate
  });

  const rows: ClinicalTrialWeeklyRow[] = [];

  for (let week = 1; week <= CLINICAL_TRIAL_EXPORT_WEEKS; week += 1) {
    const bucket = weeklyBuckets.get(week)!;
    const completedSessions = Math.min(7, bucket.dayTokens.size);
    const weeklyAdherencePct = Math.min(
      100,
      Math.round((completedSessions / plannedPerWeek) * 100)
    );

    const hasActivityInWeek = bucket.completedSets > 0 || week === 1;
    rows.push({
      participant_anon_id: participantAnonId,
      trial_week_number: week,
      planned_sessions: plannedPerWeek,
      completed_sessions: completedSessions,
      weekly_adherence_pct: weeklyAdherencePct,
      rolling_30d_consistency_pct: rollingScore.consistencyPercent,
      completed_sets: bucket.completedSets,
      total_volume_load: Math.round(bucket.totalVolume),
      low_spoons_sessions_count: week === 1 ? lowSpoonsCountGlobal : 0,
      avg_sleep_hours: hasActivityInWeek ? avgSleep : '',
      avg_daily_steps: hasActivityInWeek ? avgSteps : '',
      avg_resting_hr_bpm: hasActivityInWeek ? avgHr : '',
      hsa_fsa_eligible: eligibility.isHsaFsaEligible ? 'true' : 'false',
      corporate_wellness_sponsored: eligibility.isCorporateWellnessSponsored ? 'true' : 'false',
      billing_route_stub: eligibility.billingRouteStub
    });
  }

  return { participantAnonId, rows };
}

export function serializeClinicalTrialCsv(rows: ClinicalTrialWeeklyRow[]): string {
  const headerLine = CLINICAL_CSV_HEADERS.join(',');
  const bodyLines = (rows || []).map((row) =>
    CLINICAL_CSV_HEADERS.map((col) => escapeCsvCellSafe(row[col])).join(',')
  );
  return [headerLine, ...bodyLines].join('\n');
}

export function exportAnonymized12WeekClinicalTrialCsv(
  gymState: Record<string, unknown> | null | undefined,
  options?: {
    plannedSessionsPerWeek?: number;
    studySalt?: string;
    referenceDateIso?: string;
  }
): ClinicalTrialExportResult {
  const { participantAnonId, rows } = buildAnonymized12WeekClinicalTrialRows(gymState, options);
  const csv = serializeClinicalTrialCsv(rows);
  const dateStamp = (options?.referenceDateIso || new Date().toISOString()).slice(0, 10);
  return {
    participantAnonId,
    generatedAtIso: new Date().toISOString(),
    rowCount: rows.length,
    rows,
    csv,
    filename: `clinical-trial-12wk-${participantAnonId.toLowerCase()}-${dateStamp}.csv`
  };
}

export function triggerClinicalTrialCsvDownload(
  gymState: Record<string, unknown> | null | undefined,
  options?: {
    plannedSessionsPerWeek?: number;
    studySalt?: string;
    referenceDateIso?: string;
  }
): ClinicalTrialExportResult {
  const result = exportAnonymized12WeekClinicalTrialCsv(gymState, options);
  if (typeof document !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.setAttribute('download', result.filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  return result;
}
