/**
 * Content Validation Protocols:
 * 1. Automated QA scanner (broken links, spelling errors, forbidden database jargon in user copy)
 * 2. Expert Review approval gate (certified fitness professional sign-off before releasing plans)
 * 3. Scientific Alignment validator (sports science bounds for rest, volume, RPE, protein, hydration)
 * 4. Deployment Checklist gate (strict pre-production release checks)
 */

export const FORBIDDEN_USER_UI_JARGON = [
  'supabase',
  'postgresql',
  'postgres',
  'sql table',
  'rls policy',
  'rest/v1',
  'database row'
] as const;

export const COMMON_FITNESS_AND_UI_TYPOS: Record<string, string> = {
  exersize: 'exercise',
  exersise: 'exercise',
  exercize: 'exercise',
  protien: 'protein',
  acount: 'account',
  delte: 'delete',
  permanantly: 'permanently',
  recieve: 'receive',
  seperate: 'separate',
  wrokout: 'workout',
  calender: 'calendar',
  suppliment: 'supplement',
  nutriton: 'nutrition',
  strech: 'stretch'
};

export const ACCEPTED_FITNESS_CERTIFICATIONS = [
  'CSCS',
  'NSCA-CPT',
  'NASM-CPT',
  'ACE-CPT',
  'ACSM-CPT',
  'CSEP-CPT',
  'ISSA-CPT'
] as const;

export type FitnessCertification = (typeof ACCEPTED_FITNESS_CERTIFICATIONS)[number];

export interface ContentScanIssue {
  type: 'broken_link' | 'spelling' | 'forbidden_jargon';
  token: string;
  suggestion: string;
}

export interface ContentScanReport {
  passed: boolean;
  issues: ContentScanIssue[];
  checkedLinksCount: number;
}

/**
 * 1. Automated QA: Scans user-facing text or HTML fragments for broken links,
 * spelling errors, and forbidden database terminology.
 */
export function scanContentForBrokenLinksAndTypos(
  content: string,
  options?: { checkForbiddenJargon?: boolean }
): ContentScanReport {
  const issues: ContentScanIssue[] = [];
  const checkJargon = options?.checkForbiddenJargon !== false;
  const text = String(content || '');

  // Scan href="..." and raw http(s) URLs
  let checkedLinksCount = 0;
  const hrefRegex = /href\s*=\s*["']([^"']*)["']/gi;
  let hrefMatch: RegExpExecArray | null;
  while ((hrefMatch = hrefRegex.exec(text)) !== null) {
    checkedLinksCount += 1;
    const rawUrl = hrefMatch[1].trim();
    if (!rawUrl || rawUrl === '#' || rawUrl.toLowerCase().startsWith('javascript:')) {
      issues.push({
        type: 'broken_link',
        token: rawUrl || '(empty href)',
        suggestion: 'Replace empty or placeholder link with a valid target URL.'
      });
      continue;
    }
    if (/^https?:\/\//i.test(rawUrl)) {
      try {
        const parsed = new URL(rawUrl);
        if (
          !parsed.hostname ||
          !parsed.hostname.includes('.') ||
          parsed.hostname === 'example.com' ||
          rawUrl.toLowerCase().includes('todo') ||
          rawUrl.toLowerCase().includes('broken')
        ) {
          issues.push({
            type: 'broken_link',
            token: rawUrl,
            suggestion: 'Use a live, verified production URL.'
          });
        }
      } catch {
        issues.push({
          type: 'broken_link',
          token: rawUrl,
          suggestion: 'Fix malformed URL syntax.'
        });
      }
    }
  }

  // Also inspect plain URLs inside markdown or copy
  const plainUrlRegex = /\bhttps?:\/\/[^\s"'<>)]+/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = plainUrlRegex.exec(text)) !== null) {
    const rawUrl = urlMatch[0].trim();
    checkedLinksCount += 1;
    try {
      const parsed = new URL(rawUrl);
      if (
        !parsed.hostname.includes('.') ||
        parsed.hostname === 'example.com' ||
        rawUrl.toLowerCase().includes('todo')
      ) {
        issues.push({
          type: 'broken_link',
          token: rawUrl,
          suggestion: 'Replace placeholder URL with a verified live link.'
        });
      }
    } catch {
      issues.push({
        type: 'broken_link',
        token: rawUrl,
        suggestion: 'Fix invalid URL format.'
      });
    }
  }

  // Strip HTML tags before checking words for spelling & jargon
  const plainText = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const words = plainText.toLowerCase().match(/\b[a-z]+\b/g) || [];
  const seenTypos = new Set<string>();
  words.forEach((word) => {
    const fix = COMMON_FITNESS_AND_UI_TYPOS[word];
    if (fix && !seenTypos.has(word)) {
      seenTypos.add(word);
      issues.push({
        type: 'spelling',
        token: word,
        suggestion: `Change "${word}" to "${fix}".`
      });
    }
  });

  if (checkJargon) {
    const lowerPlain = plainText.toLowerCase();
    FORBIDDEN_USER_UI_JARGON.forEach((term) => {
      if (lowerPlain.includes(term)) {
        issues.push({
          type: 'forbidden_jargon',
          token: term,
          suggestion: `Remove technical database word "${term}" from user-facing text.`
        });
      }
    });
  }

  return {
    passed: issues.length === 0,
    issues,
    checkedLinksCount
  };
}

export interface ExpertApprovalRecord {
  planId: string;
  planName: string;
  reviewerName: string;
  certification: string;
  certificationId: string;
  certificationExpiresAt: string; // ISO date YYYY-MM-DD
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
  signedOffAt?: string;
}

export interface ExpertApprovalValidationResult {
  approvedForRelease: boolean;
  reasons: string[];
}

/**
 * 2. Expert Review: Enforces mandatory sign-off by a certified fitness professional
 * before any new workout plan can be published.
 */
export function validateWorkoutPlanExpertApproval(
  record: ExpertApprovalRecord | null | undefined,
  nowDate: Date = new Date()
): ExpertApprovalValidationResult {
  const reasons: string[] = [];

  if (!record || typeof record !== 'object') {
    return {
      approvedForRelease: false,
      reasons: ['Missing certified fitness professional sign-off record.']
    };
  }

  if (!String(record.reviewerName || '').trim()) {
    reasons.push('Reviewer full name is required.');
  }

  const certUpper = String(record.certification || '').trim().toUpperCase();
  if (!(ACCEPTED_FITNESS_CERTIFICATIONS as readonly string[]).includes(certUpper)) {
    reasons.push(
      `Certification "${record.certification || 'none'}" is not an accepted fitness credential.`
    );
  }

  if (!String(record.certificationId || '').trim() || String(record.certificationId).trim().length < 4) {
    reasons.push('Valid certification license ID is required.');
  }

  const expMs = Date.parse(String(record.certificationExpiresAt || ''));
  if (!Number.isFinite(expMs) || expMs < nowDate.getTime()) {
    reasons.push('Reviewer fitness certification is missing or expired.');
  }

  if (record.status !== 'approved') {
    reasons.push(`Workout plan status must be "approved" (currently "${record.status}").`);
  }

  if (!String(record.signedOffAt || '').trim() || !Number.isFinite(Date.parse(String(record.signedOffAt)))) {
    reasons.push('Valid approval timestamp (signedOffAt) is required.');
  }

  return {
    approvedForRelease: reasons.length === 0,
    reasons
  };
}

export interface WorkoutScientificSpec {
  restSeconds: number;
  weeklyHardSetsPerMuscle: number;
  targetRpe: number;
  proteinGramsPerKg: number;
  dailyWaterMl: number;
  includesWarmup: boolean;
  instructionsText?: string;
}

export interface ScientificAlignmentResult {
  aligned: boolean;
  violations: string[];
}

const UNSAFE_FITNESS_CLAIMS = [
  'spot reduce fat',
  'lose 20 lbs in a week',
  'starve yourself',
  'skip all water',
  'zero rest days forever'
];

/**
 * 3. Scientific Alignment: Cross-references workout and nutrition specs against
 * verified sports science guidelines (NSCA / ACSM / ISSN).
 */
export function validateScientificAlignment(
  spec: WorkoutScientificSpec
): ScientificAlignmentResult {
  const violations: string[] = [];

  if (!Number.isFinite(spec.restSeconds) || spec.restSeconds < 30 || spec.restSeconds > 300) {
    violations.push('Rest timer must stay within sports science bounds (30 to 300 seconds).');
  }

  if (
    !Number.isFinite(spec.weeklyHardSetsPerMuscle) ||
    spec.weeklyHardSetsPerMuscle < 4 ||
    spec.weeklyHardSetsPerMuscle > 24
  ) {
    violations.push('Weekly hard sets per muscle must be between 4 and 24 sets.');
  }

  if (!Number.isFinite(spec.targetRpe) || spec.targetRpe < 5 || spec.targetRpe > 10) {
    violations.push('Target effort (RPE) must be between 5 and 10.');
  }

  if (
    !Number.isFinite(spec.proteinGramsPerKg) ||
    spec.proteinGramsPerKg < 1.2 ||
    spec.proteinGramsPerKg > 2.6
  ) {
    violations.push('Daily protein guidance must stay between 1.2 and 2.6 g/kg body weight.');
  }

  if (!Number.isFinite(spec.dailyWaterMl) || spec.dailyWaterMl < 1500 || spec.dailyWaterMl > 5000) {
    violations.push('Daily hydration target must be between 1,500 ml and 5,000 ml.');
  }

  if (!spec.includesWarmup) {
    violations.push('Every training session must include a warm-up block.');
  }

  const lowerNotes = String(spec.instructionsText || '').toLowerCase();
  UNSAFE_FITNESS_CLAIMS.forEach((claim) => {
    if (lowerNotes.includes(claim)) {
      violations.push(`Remove unverified or unsafe fitness claim: "${claim}".`);
    }
  });

  return {
    aligned: violations.length === 0,
    violations
  };
}

export interface DeploymentChecklistInput {
  automatedQaPassed: boolean;
  expertReviewApproved: boolean;
  scientificAlignmentPassed: boolean;
  accessibilityWcagAndEli12Passed: boolean;
  concurrentDataSanitizationPassed: boolean;
  zeroFeatureDeprecationVerified: boolean;
}

export interface DeploymentChecklistResult {
  readyToDeploy: boolean;
  failedGates: string[];
}

/**
 * 4. Deployment Checklist Gate: Blocks release unless every mandatory check passes.
 */
export function runDeploymentValidationChecklist(
  input: DeploymentChecklistInput
): DeploymentChecklistResult {
  const failedGates: string[] = [];

  if (!input.automatedQaPassed) failedGates.push('Automated QA (links, spelling, zero database jargon)');
  if (!input.expertReviewApproved) failedGates.push('Certified Fitness Professional Review sign-off');
  if (!input.scientificAlignmentPassed) failedGates.push('Sports Science Guideline Alignment');
  if (!input.accessibilityWcagAndEli12Passed) failedGates.push('Accessibility (WCAG 2.1 AA + ELI12 plain language)');
  if (!input.concurrentDataSanitizationPassed) failedGates.push('Concurrent Server, Mobile, and Web Cookie Sanitization');
  if (!input.zeroFeatureDeprecationVerified) failedGates.push('Zero Feature Deprecation Verification');

  return {
    readyToDeploy: failedGates.length === 0,
    failedGates
  };
}
