import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  WCAG_STRICT_CONTRAST_TARGETS,
  verifyThemeContrastCompliance
} from './themeProvider';
import {
  attachBiometricsToGymState,
  fetchAppleHealthKitBiometricsStub,
  fetchGoogleHealthConnectBiometricsStub
} from './biometricSync';
import {
  CLINICAL_TRIAL_EXPORT_WEEKS,
  anonymizeParticipantId,
  applyInstitutionalFlagsToUserProfile,
  buildAnonymized12WeekClinicalTrialRows,
  escapeCsvCellSafe,
  exportAnonymized12WeekClinicalTrialCsv,
  normalizeInstitutionalEligibility,
  resolveInstitutionalBillingRoute
} from './institutionalClinicalExport';
import { calculateDoubleProgressionTarget } from './doubleProgressionEngine';
import { computeRolling30DayConsistencyScore } from './adherenceEngine';
import { calculateVisualBarbellPlates } from './plateLoader';
import { DEFAULT_ACCESSIBLE_VIDEO_SETTINGS, parseWebVttCaptions } from './accessibleVideoMedia';

test('Task 1 QA: Strict WCAG contrast enforcement hits 15.8:1 Light and 17.1:1 Dark with scoped CSS rules', () => {
  const compliance = verifyThemeContrastCompliance();
  assert.equal(compliance.lightTarget, WCAG_STRICT_CONTRAST_TARGETS.light);
  assert.equal(compliance.darkTarget, WCAG_STRICT_CONTRAST_TARGETS.dark);
  assert.equal(compliance.lightRatio, 15.8);
  assert.equal(compliance.darkRatio, 17.1);
  assert.equal(compliance.isCompliant, true);

  const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/accessibility.css'), 'utf8');
  assert.match(css, /max-width:\s*min\(94vw,\s*42rem\)/);
  assert.match(css, /max-height:\s*90dvh/);
  assert.match(css, /html\[data-theme="light"\]\s+\.bg-slate-900/);
  assert.match(css, /html\[data-theme="dark"\]\s+\.bg-slate-950/);
});

test('Task 2 & 3 QA: Double Progression, Rolling 30-Day Consistency, VisualPlateLoader, and AccessibleVideoPlayer defaults hold', () => {
  const progression = calculateDoubleProgressionTarget({
    exerciseName: 'Barbell Squat',
    targetSets: 3,
    repRangeLabel: '8-10',
    baselineWeight: 135,
    unit: 'lbs',
    completedSets: [
      { weight: 135, reps: 10, done: true, rpe: 10, rir: 0, pump: 1, soreness: 10 },
      { weight: 135, reps: 10, done: true, rpe: 9.5, rir: 0 },
      { weight: 135, reps: 10, done: true, rpe: 10, rir: 0 }
    ]
  });
  assert.equal(progression.usesSubjectiveMetrics, false);
  assert.equal(progression.action, 'increase_weight');
  assert.equal(progression.nextTargetWeight, 140);
  assert.equal(progression.nextTargetReps, 8);

  const consistency = computeRolling30DayConsistencyScore({
    plannedDaysPerWeek: 3,
    completedSessionDates: ['2026-11-01', '2026-11-04', '2026-11-07', '2026-11-10', '2026-11-14', '2026-11-18'],
    referenceDate: new Date('2026-11-24T12:00:00Z')
  });
  assert.equal(consistency.completedLast30Days, 6);
  assert.equal(consistency.streakResetApplied, false);
  assert.ok(consistency.consistencyPercent > 0 && consistency.consistencyPercent <= 100);

  const platePlan = calculateVisualBarbellPlates(225, 'lbs');
  assert.equal(platePlan.barWeight + platePlan.totalPlatesWeight, 225);
  assert.equal(platePlan.perSideWeight, 90);
  assert.equal(platePlan.platesPerSide.length, 2);

  assert.equal(DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.loop, true);
  assert.equal(DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.muted, true);
  assert.equal(DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.playbackRate, 0.5);
  const cues = parseWebVttCaptions('WEBVTT\n\n00:00.000 --> 00:04.000\nStand with feet shoulder width apart.');
  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, 'Stand with feet shoulder width apart.');
});

test('Task 4 QA: Apple HealthKit and Google Health Connect stubs attach cleanly to gym_state history', async () => {
  const hk = await fetchAppleHealthKitBiometricsStub({ sleepHours: 4.5, dailySteps: 16200, restingHeartRateBpm: 72 });
  const hc = await fetchGoogleHealthConnectBiometricsStub({ sleepHours: 7.4, dailySteps: 9200, restingHeartRateBpm: 61 });

  const state1 = attachBiometricsToGymState({ workoutLogs: {} }, hk);
  assert.equal(state1.biometricsSnapshot.provider, 'apple_healthkit');
  assert.equal(state1.biometricsHistory.length, 1);

  const state2 = attachBiometricsToGymState(state1, { ...hc, dateIso: '2026-11-25' });
  assert.equal(state2.biometricsSnapshot.provider, 'google_health_connect');
  assert.equal(state2.biometricsHistory.length, 2);
});

test('Task 5 Institutional Schema: HSA/FSA Eligible and Corporate Wellness Sponsored profile flags route to free beta stubs without deleting profile fields', () => {
  const baseState = {
    userProfile: {
      name: 'François',
      email: 'francois@7amgym.app',
      goal: '6-Pack Recomp',
      unitPreference: 'lbs'
    },
    workoutLogs: {}
  };

  const hsaOnly = applyInstitutionalFlagsToUserProfile(baseState, {
    isHsaFsaEligible: true,
    isCorporateWellnessSponsored: false
  });
  assert.equal(hsaOnly.userProfile.name, 'François');
  assert.equal(hsaOnly.userProfile.email, 'francois@7amgym.app');
  assert.equal(hsaOnly.userProfile.isHsaFsaEligible, true);
  assert.equal(hsaOnly.userProfile.isCorporateWellnessSponsored, false);
  assert.equal(hsaOnly.userProfile.billingRouteStub, 'hsa_fsa_lmn_stub');

  const corpOnly = applyInstitutionalFlagsToUserProfile(baseState, {
    isHsaFsaEligible: false,
    isCorporateWellnessSponsored: true,
    sponsorOrganizationCode: 'ACME-WELLNESS-2026'
  });
  assert.equal(corpOnly.userProfile.billingRouteStub, 'corporate_wellness_sso_stub');
  assert.equal(corpOnly.userProfile.sponsorOrganizationCode, 'ACME-WELLNESS-2026');

  const dual = resolveInstitutionalBillingRoute({
    isHsaFsaEligible: true,
    isCorporateWellnessSponsored: true
  });
  assert.equal(dual.billingRouteStub, 'dual_institutional_stub');
  assert.equal(dual.isFreeBetaActive, true);

  const normalizedDefault = normalizeInstitutionalEligibility(null);
  assert.equal(normalizedDefault.isHsaFsaEligible, false);
  assert.equal(normalizedDefault.isCorporateWellnessSponsored, false);
  assert.equal(normalizedDefault.billingRouteStub, 'free_beta_direct');
  assert.equal(normalizedDefault.isFreeBetaActive, true);
});

test('Task 5 Clinical Trial Export: Generates 12 anonymized weekly rows with zero PII and neutralizes CSV formula injection', () => {
  const anonA = anonymizeParticipantId('francois@7amgym.app');
  const anonB = anonymizeParticipantId('FRANCOIS@7AMGYM.APP ');
  const anonOther = anonymizeParticipantId('other@example.com');
  assert.match(anonA, /^PT-[A-F0-9]{12}$/);
  assert.equal(anonA, anonB);
  assert.notEqual(anonA, anonOther);
  assert.equal(anonA.includes('francois'), false);

  // CSV formula injection defense
  assert.equal(escapeCsvCellSafe('=CMD("calc")'), `"'=CMD(""calc"")"` );
  assert.equal(escapeCsvCellSafe('+1234'), `'+1234`);
  assert.equal(escapeCsvCellSafe('@SUM(A1:A2)'), `'@SUM(A1:A2)`);
  assert.equal(escapeCsvCellSafe('-42'), '-42');

  const mockGymState = {
    userProfile: {
      name: 'Jane Secret Name',
      email: 'jane.secret@private.org',
      phone: '555-0199',
      daysPerWeek: 4,
      isHsaFsaEligible: true,
      isCorporateWellnessSponsored: false
    },
    workoutLogs: {
      w1_d1_bench_1: { weight: 100, reps: 10, done: true, completedAt: '2026-11-10T07:15:00.000Z' },
      w1_d1_bench_2: { weight: 100, reps: 10, done: true, completedAt: '2026-11-10T07:18:00.000Z' },
      w2_d2_squat_1: { weight: 150, reps: 8, done: true, completedAt: '2026-11-17T07:20:00.000Z' }
    },
    biometricsHistory: [
      {
        provider: 'apple_healthkit',
        dateIso: '2026-11-17',
        dailySteps: 9100,
        sleepHours: 7.2,
        restingHeartRateBpm: 60,
        syncedAt: '2026-11-17T06:50:00.000Z',
        isStub: true
      }
    ]
  };

  const { rows } = buildAnonymized12WeekClinicalTrialRows(mockGymState, {
    referenceDateIso: '2026-11-24'
  });
  assert.equal(rows.length, CLINICAL_TRIAL_EXPORT_WEEKS);
  assert.equal(rows[0].trial_week_number, 1);
  assert.equal(rows[0].completed_sets, 2);
  assert.equal(rows[0].total_volume_load, 2000);
  assert.equal(rows[0].hsa_fsa_eligible, 'true');
  assert.equal(rows[0].corporate_wellness_sponsored, 'false');
  assert.equal(rows[0].avg_sleep_hours, '7.2');
  assert.equal(rows[1].completed_sets, 1);
  assert.equal(rows[1].total_volume_load, 1200);
  assert.equal(rows[11].trial_week_number, 12);

  const exported = exportAnonymized12WeekClinicalTrialCsv(mockGymState, {
    referenceDateIso: '2026-11-24'
  });
  assert.equal(exported.rowCount, 12);
  assert.equal(exported.csv.includes('Jane Secret Name'), false);
  assert.equal(exported.csv.includes('jane.secret@private.org'), false);
  assert.equal(exported.csv.includes('555-0199'), false);
  assert.match(exported.csv, /participant_anon_id,trial_week_number,planned_sessions/);
  assert.match(exported.filename, /^clinical-trial-12wk-pt-[a-f0-9]{12}-2026-11-24\.csv$/);
});
