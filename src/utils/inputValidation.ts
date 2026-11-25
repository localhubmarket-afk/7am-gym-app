/**
 * Strict Content Validation & ELI12 Form Guardrails (Task 4)
 * - Validates logged weights, reps, account details, quick-add fuel, and workout times
 *   before saving to local state or cloud storage.
 * - Uses short, clear ELI12 sentences with zero technical jargon.
 * - Preserves existing clampWeightInputValue (0–999 lbs) and clampRepsInputValue (1–100 reps) bounds.
 */

export interface ValidationLimits {
  minWeightLbs: number;
  maxWeightLbs: number;
  minWeightKg: number;
  maxWeightKg: number;
  minReps: number;
  maxReps: number;
  minPasswordLength: number;
  maxQuickAddCalories: number;
  maxQuickAddProteinGrams: number;
}

export const DEFAULT_VALIDATION_LIMITS: ValidationLimits = {
  minWeightLbs: 0,
  maxWeightLbs: 999,
  minWeightKg: 0,
  maxWeightKg: 455,
  minReps: 1,
  maxReps: 100,
  minPasswordLength: 6,
  maxQuickAddCalories: 5000,
  maxQuickAddProteinGrams: 300
};

export interface NumericFieldValidationResult {
  valid: boolean;
  numericValue: number | null;
  sanitizedValue: string;
  errorMessage: string | null;
  warningMessage: string | null;
  wasClamped: boolean;
}

export interface AccountProfileValidationInput {
  name?: string | null;
  email?: string | null;
  password?: string | null;
  phone?: string | null;
  requireName?: boolean;
  requirePassword?: boolean;
}

export interface AccountProfileValidationResult {
  valid: boolean;
  sanitized: {
    name: string;
    email: string;
    phone: string;
  };
  fieldErrors: {
    name: string | null;
    email: string | null;
    password: string | null;
    phone: string | null;
  };
  errors: string[];
}

export interface QuickAddFuelValidationInput {
  label?: string | null;
  calories?: string | number | null;
  proteinGrams?: string | number | null;
}

export interface QuickAddFuelValidationResult {
  valid: boolean;
  sanitized: {
    label: string;
    calories: number;
    proteinGrams: number;
  };
  errors: string[];
}

const DISALLOWED_PROFILE_NAMES = new Set([
  'google',
  'apple',
  'oauth',
  'admin',
  'null',
  'undefined',
  'test'
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_ALLOWED_REGEX = /^[0-9+().\-\s]{7,20}$/;

function roundToQuarter(num: number): number {
  return Math.round(num * 4) / 4;
}

/**
 * Strictly validates a logged workout weight before saving.
 * Rejects negative numbers, non-numeric garbage, and unrealistic weights above the configured limit.
 */
export function validateLoggedWeight(
  rawValue: unknown,
  unit: 'lbs' | 'kg' = 'lbs',
  limits: Partial<ValidationLimits> = {}
): NumericFieldValidationResult {
  const merged = { ...DEFAULT_VALIDATION_LIMITS, ...limits };
  const maxAllowed = unit === 'kg' ? merged.maxWeightKg : merged.maxWeightLbs;
  const minAllowed = unit === 'kg' ? merged.minWeightKg : merged.minWeightLbs;
  const unitLabel = unit === 'kg' ? 'kg' : 'lbs';

  const trimmed = String(rawValue ?? '').trim();
  if (trimmed === '') {
    return {
      valid: false,
      numericValue: null,
      sanitizedValue: '',
      errorMessage: `Please type a weight in ${unitLabel}. Use 0 for bodyweight.`,
      warningMessage: null,
      wasClamped: false
    };
  }

  // Reject strings that contain letters or invalid math characters (e.g., "12abc", "NaN", "1e9")
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return {
      valid: false,
      numericValue: null,
      sanitizedValue: '',
      errorMessage: 'Use numbers only for weight (for example: 45 or 135).',
      warningMessage: null,
      wasClamped: false
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return {
      valid: false,
      numericValue: null,
      sanitizedValue: '',
      errorMessage: 'That weight is not a valid number. Please try again.',
      warningMessage: null,
      wasClamped: false
    };
  }

  if (parsed < minAllowed) {
    return {
      valid: false,
      numericValue: minAllowed,
      sanitizedValue: String(minAllowed),
      errorMessage: `Weight cannot be below ${minAllowed} ${unitLabel}.`,
      warningMessage: null,
      wasClamped: true
    };
  }

  if (parsed > maxAllowed) {
    return {
      valid: false,
      numericValue: maxAllowed,
      sanitizedValue: String(maxAllowed),
      errorMessage: `Weight looks too high. Enter a number up to ${maxAllowed} ${unitLabel}.`,
      warningMessage: null,
      wasClamped: true
    };
  }

  const cleanNumber = roundToQuarter(parsed);
  return {
    valid: true,
    numericValue: cleanNumber,
    sanitizedValue: String(cleanNumber),
    errorMessage: null,
    warningMessage: null,
    wasClamped: false
  };
}

/**
 * Strictly validates logged repetitions before saving.
 * Allows whole numbers within [minReps, maxReps] (default 1 to 100).
 */
export function validateLoggedReps(
  rawValue: unknown,
  limits: Partial<ValidationLimits> = {}
): NumericFieldValidationResult {
  const merged = { ...DEFAULT_VALIDATION_LIMITS, ...limits };
  const trimmed = String(rawValue ?? '').trim();

  if (trimmed === '') {
    return {
      valid: false,
      numericValue: null,
      sanitizedValue: '',
      errorMessage: 'Please type how many reps you finished (1 to 100).',
      warningMessage: null,
      wasClamped: false
    };
  }

  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return {
      valid: false,
      numericValue: null,
      sanitizedValue: '',
      errorMessage: 'Use whole numbers only for reps (for example: 8 or 12).',
      warningMessage: null,
      wasClamped: false
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return {
      valid: false,
      numericValue: null,
      sanitizedValue: '',
      errorMessage: 'That rep count is not a valid number.',
      warningMessage: null,
      wasClamped: false
    };
  }

  if (!Number.isInteger(parsed)) {
    const rounded = Math.max(merged.minReps, Math.min(merged.maxReps, Math.round(parsed)));
    return {
      valid: false,
      numericValue: rounded,
      sanitizedValue: String(rounded),
      errorMessage: 'Please enter a whole number for reps (no decimals).',
      warningMessage: null,
      wasClamped: false
    };
  }

  if (parsed < merged.minReps) {
    return {
      valid: false,
      numericValue: merged.minReps,
      sanitizedValue: String(merged.minReps),
      errorMessage: `Reps must be at least ${merged.minReps}.`,
      warningMessage: null,
      wasClamped: true
    };
  }

  if (parsed > merged.maxReps) {
    return {
      valid: false,
      numericValue: merged.maxReps,
      sanitizedValue: String(merged.maxReps),
      errorMessage: `Reps look too high. Enter a number up to ${merged.maxReps}.`,
      warningMessage: null,
      wasClamped: true
    };
  }

  return {
    valid: true,
    numericValue: parsed,
    sanitizedValue: String(parsed),
    errorMessage: null,
    warningMessage: null,
    wasClamped: false
  };
}

/**
 * Strictly validates account sign-in / sign-up profile fields using ELI12 error messages.
 */
export function validateAccountProfileInput(
  input: AccountProfileValidationInput,
  limits: Partial<ValidationLimits> = {}
): AccountProfileValidationResult {
  const merged = { ...DEFAULT_VALIDATION_LIMITS, ...limits };
  const cleanName = String(input.name ?? '').replace(/\s+/g, ' ').trim();
  const cleanEmail = String(input.email ?? '').trim().toLowerCase();
  const rawPassword = String(input.password ?? '');
  const cleanPhone = String(input.phone ?? '').trim();

  const fieldErrors = {
    name: null as string | null,
    email: null as string | null,
    password: null as string | null,
    phone: null as string | null
  };

  if (input.requireName || cleanName.length > 0) {
    if (cleanName.length < 2) {
      fieldErrors.name = 'Please type your first name (at least 2 letters).';
    } else if (cleanName.length > 60) {
      fieldErrors.name = 'Please keep your name under 60 characters.';
    } else if (DISALLOWED_PROFILE_NAMES.has(cleanName.toLowerCase())) {
      fieldErrors.name = 'Please type your real first name instead of a login brand.';
    }
  }

  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    fieldErrors.email = 'Please type a valid email address (example: name@email.com).';
  }

  if (input.requirePassword) {
    if (rawPassword.length < merged.minPasswordLength) {
      fieldErrors.password = `Password must be at least ${merged.minPasswordLength} characters long.`;
    } else if (rawPassword.trim().length === 0) {
      fieldErrors.password = 'Password cannot be only spaces.';
    }
  }

  if (cleanPhone.length > 0 && !PHONE_ALLOWED_REGEX.test(cleanPhone)) {
    fieldErrors.phone = 'Please enter a valid phone number with at least 7 digits, or leave it blank.';
  }

  const errors = [
    fieldErrors.name,
    fieldErrors.email,
    fieldErrors.password,
    fieldErrors.phone
  ].filter((msg): msg is string => Boolean(msg));

  return {
    valid: errors.length === 0,
    sanitized: {
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone
    },
    fieldErrors,
    errors
  };
}

/**
 * Strictly validates quick-add meal / calorie entries before saving.
 */
export function validateQuickAddFuelInput(
  input: QuickAddFuelValidationInput,
  limits: Partial<ValidationLimits> = {}
): QuickAddFuelValidationResult {
  const merged = { ...DEFAULT_VALIDATION_LIMITS, ...limits };
  const label = String(input.label ?? '').replace(/\s+/g, ' ').trim();
  const calories = Number(input.calories);
  const proteinGrams =
    input.proteinGrams === undefined || input.proteinGrams === null || input.proteinGrams === ''
      ? 0
      : Number(input.proteinGrams);

  const errors: string[] = [];

  if (!label || label.length < 2) {
    errors.push('Please enter a short food or drink name.');
  } else if (label.length > 80) {
    errors.push('Please keep the food name under 80 characters.');
  }

  if (!Number.isFinite(calories) || calories < 0 || calories > merged.maxQuickAddCalories) {
    errors.push(`Calories must be between 0 and ${merged.maxQuickAddCalories}.`);
  }

  if (
    !Number.isFinite(proteinGrams) ||
    proteinGrams < 0 ||
    proteinGrams > merged.maxQuickAddProteinGrams
  ) {
    errors.push(`Protein must be between 0g and ${merged.maxQuickAddProteinGrams}g.`);
  }

  return {
    valid: errors.length === 0,
    sanitized: {
      label: label.slice(0, 80),
      calories: Number.isFinite(calories)
        ? Math.max(0, Math.min(merged.maxQuickAddCalories, Math.round(calories)))
        : 0,
      proteinGrams: Number.isFinite(proteinGrams)
        ? Math.max(0, Math.min(merged.maxQuickAddProteinGrams, Math.round(proteinGrams)))
        : 0
    },
    errors
  };
}

/**
 * Validates a 24-hour gym time string (HH:MM).
 */
export function validateGymTimeInput(rawTime: unknown): {
  valid: boolean;
  sanitizedValue: string;
  errorMessage: string | null;
} {
  const clean = String(rawTime ?? '').trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return {
      valid: false,
      sanitizedValue: '07:00',
      errorMessage: 'Pick a valid workout time (for example: 07:00).'
    };
  }
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return {
      valid: false,
      sanitizedValue: '07:00',
      errorMessage: 'Hour must be 0 to 23 and minutes must be 0 to 59.'
    };
  }
  return {
    valid: true,
    sanitizedValue: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    errorMessage: null
  };
}

/**
 * Task 5: Strictly validates workout note text (machine notes & next-week progression notes).
 * Strips unsafe HTML/control characters and enforces a clear 280-character ELI12 limit.
 */
export function validateWorkoutNoteText(
  rawText: unknown,
  maxLength: number = 280
): {
  valid: boolean;
  sanitizedValue: string;
  errorMessage: string | null;
} {
  const raw = String(rawText ?? '');
  const stripped = raw
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();

  if (stripped.length > maxLength) {
    return {
      valid: false,
      sanitizedValue: stripped.slice(0, maxLength),
      errorMessage: `Please keep your note under ${maxLength} characters.`
    };
  }

  return {
    valid: true,
    sanitizedValue: stripped,
    errorMessage: null
  };
}

/**
 * Task 5: Strictly validates rest timer duration in seconds (10s to 900s / 15 min).
 */
export function validateTimerDurationSeconds(rawSeconds: unknown): {
  valid: boolean;
  numericValue: number;
  errorMessage: string | null;
} {
  const trimmed = String(rawSeconds ?? '').trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return {
      valid: false,
      numericValue: 90,
      errorMessage: 'Use whole seconds for the rest timer (for example: 60 or 90).'
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return {
      valid: false,
      numericValue: 90,
      errorMessage: 'Rest timer seconds must be a whole number.'
    };
  }

  if (parsed < 10 || parsed > 900) {
    return {
      valid: false,
      numericValue: Math.max(10, Math.min(900, parsed)),
      errorMessage: 'Pick a rest time between 10 seconds and 15 minutes (900 seconds).'
    };
  }

  return {
    valid: true,
    numericValue: parsed,
    errorMessage: null
  };
}

/**
 * Task 5: Unified pre-save validation gate for an exercise set (weight + reps + optional rest time).
 * Blocks invalid data before saving and returns clear, short ELI12 error messages.
 */
export function validateExerciseSetEntry(input: {
  weight: unknown;
  reps: unknown;
  unit?: 'lbs' | 'kg';
  restSeconds?: unknown;
  allowBodyweightZero?: boolean;
}): {
  valid: boolean;
  sanitized: {
    weight: number;
    reps: number;
    restSeconds: number | null;
  };
  errors: string[];
} {
  const unit = input.unit === 'kg' ? 'kg' : 'lbs';
  const weightInput =
    input.allowBodyweightZero && (input.weight === '' || input.weight === null || input.weight === undefined)
      ? 0
      : input.weight;

  const weightRes = validateLoggedWeight(weightInput, unit);
  const repsRes = validateLoggedReps(input.reps);
  const restRes =
    input.restSeconds !== undefined && input.restSeconds !== null && input.restSeconds !== ''
      ? validateTimerDurationSeconds(input.restSeconds)
      : null;

  const errors: string[] = [];
  if (!weightRes.valid && weightRes.errorMessage) errors.push(weightRes.errorMessage);
  if (!repsRes.valid && repsRes.errorMessage) errors.push(repsRes.errorMessage);
  if (restRes && !restRes.valid && restRes.errorMessage) errors.push(restRes.errorMessage);

  return {
    valid: errors.length === 0,
    sanitized: {
      weight: weightRes.numericValue ?? 0,
      reps: repsRes.numericValue ?? 1,
      restSeconds: restRes ? restRes.numericValue : null
    },
    errors
  };
}

