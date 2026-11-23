import {
  buildValidatedWizardProgram,
  normalizeBaseDietStrict,
  normalizeIntolerancesStrict,
  type DietRecipeLike,
  type ProgramWizardConfig,
  type RoutineDayLike,
  type RoutineExerciseLike,
  type WizardBaseDiet,
  type WizardDifficulty,
  type WizardIntolerance
} from './wizardValidation';

export type OnboardingGoal = 'build_muscle' | 'get_stronger' | 'lose_fat' | 'stay_fit';
export type OnboardingEquipment = 'full_gym' | 'dumbbells_only' | 'machines_cables' | 'home_bodyweight';

export interface IkeaQuizAnswers {
  goal: OnboardingGoal;
  experience: WizardDifficulty;
  equipment: OnboardingEquipment;
  daysPerWeek: number;
  baseDiet: WizardBaseDiet;
  intolerances: WizardIntolerance[];
}

export interface IkeaQuizStepDefinition {
  stepNumber: number;
  id: 'goal' | 'experience' | 'equipment' | 'schedule' | 'diet';
  title: string;
  helperText: string;
}

export const IKEA_QUIZ_STEPS: IkeaQuizStepDefinition[] = [
  {
    stepNumber: 1,
    id: 'goal',
    title: 'What is your main goal?',
    helperText: 'Pick one goal. We match your reps and focus to it.'
  },
  {
    stepNumber: 2,
    id: 'experience',
    title: 'How long have you lifted weights?',
    helperText: 'This sets your number of sets and how hard the moves are.'
  },
  {
    stepNumber: 3,
    id: 'equipment',
    title: 'What gear can you use?',
    helperText: 'We only pick exercises that match your gear.'
  },
  {
    stepNumber: 4,
    id: 'schedule',
    title: 'How many days per week do you want to train?',
    helperText: 'Pick a weekly goal. Missing a day will never punish you.'
  },
  {
    stepNumber: 5,
    id: 'diet',
    title: 'How do you like to eat?',
    helperText: 'Pick your food style and any foods to skip.'
  }
];

export const DEFAULT_IKEA_QUIZ_ANSWERS: IkeaQuizAnswers = {
  goal: 'build_muscle',
  experience: 'medium',
  equipment: 'full_gym',
  daysPerWeek: 4,
  baseDiet: 'Vegan',
  intolerances: []
};

export function mapGoalToPrimaryFocus(goal: OnboardingGoal): string {
  switch (goal) {
    case 'get_stronger':
      return 'strength';
    case 'build_muscle':
      return 'hypertrophy';
    case 'lose_fat':
      return 'full_body';
    case 'stay_fit':
    default:
      return 'balanced';
  }
}

export function mapGoalToRepRange(goal: OnboardingGoal, fallbackReps: string): string {
  if (!fallbackReps || /sec|min|max|hold/i.test(fallbackReps)) {
    return fallbackReps || '8-12';
  }
  switch (goal) {
    case 'get_stronger':
      return '5-6';
    case 'build_muscle':
      return '8-12';
    case 'lose_fat':
      return '10-15';
    case 'stay_fit':
    default:
      return '8-12';
  }
}

const EQUIPMENT_ADAPTATIONS: Record<
  Exclude<OnboardingEquipment, 'full_gym'>,
  Array<{ pattern: RegExp; replacement: string; equipType: string; equipLabel: string }>
> = {
  dumbbells_only: [
    { pattern: /\bbarbell\s+bench\s+press\b/i, replacement: 'Dumbbell Flat Bench Press', equipType: 'dumbbell', equipLabel: 'Dumbbells' },
    { pattern: /\bbarbell\s+(?:back\s+)?squat\b/i, replacement: 'Dumbbell Goblet Squat', equipType: 'dumbbell', equipLabel: 'Dumbbells' },
    { pattern: /\bbarbell\s+(?:romanian\s+)?deadlift\b/i, replacement: 'Dumbbell Romanian Deadlift', equipType: 'dumbbell', equipLabel: 'Dumbbells' },
    { pattern: /\bleg\s+press\b/i, replacement: 'Dumbbell Bulgarian Split Squat', equipType: 'dumbbell', equipLabel: 'Dumbbells' },
    { pattern: /\bcable\s+row\b|\blat\s+pulldown\b/i, replacement: 'One-Arm Dumbbell Row', equipType: 'dumbbell', equipLabel: 'Dumbbells' },
    { pattern: /\bbarbell\s+overhead\s+press\b/i, replacement: 'Seated Dumbbell Shoulder Press', equipType: 'dumbbell', equipLabel: 'Dumbbells' }
  ],
  machines_cables: [
    { pattern: /\bbarbell\s+bench\s+press\b|\bdumbbell\s+bench\s+press\b/i, replacement: 'Seated Chest Press Machine', equipType: 'machine', equipLabel: 'Machine' },
    { pattern: /\bbarbell\s+(?:back\s+)?squat\b|\bgoblet\s+squat\b/i, replacement: 'Leg Press Machine', equipType: 'machine', equipLabel: 'Machine' },
    { pattern: /\b(?:barbell|dumbbell)\s+(?:romanian\s+)?deadlift\b/i, replacement: 'Seated Leg Curl Machine', equipType: 'machine', equipLabel: 'Machine' },
    { pattern: /\bbarbell\s+overhead\s+press\b/i, replacement: 'Shoulder Press Machine', equipType: 'machine', equipLabel: 'Machine' },
    { pattern: /\bbarbell\s+row\b/i, replacement: 'Seated Cable Row', equipType: 'cable', equipLabel: 'Cable' }
  ],
  home_bodyweight: [
    { pattern: /\b(?:barbell|dumbbell|seated)?\s*(?:chest|bench)\s+press\b/i, replacement: 'Tempo Push-Ups', equipType: 'bodyweight', equipLabel: 'Bodyweight' },
    { pattern: /\b(?:barbell|leg)\s*(?:squat|press)\b/i, replacement: 'Bodyweight Split Squat', equipType: 'bodyweight', equipLabel: 'Bodyweight' },
    { pattern: /\bdeadlift\b|\bleg\s+curl\b/i, replacement: 'Single-Leg Glute Bridge', equipType: 'bodyweight', equipLabel: 'Bodyweight' },
    { pattern: /\b(?:seated\s+cable\s+|barbell\s+)row\b|\blat\s+pulldown\b/i, replacement: 'Overhand Pull-Ups', equipType: 'bodyweight', equipLabel: 'Bodyweight' },
    { pattern: /\boverhead\s+press\b|\bshoulder\s+press\b/i, replacement: 'Pike Push-Ups', equipType: 'bodyweight', equipLabel: 'Bodyweight' }
  ]
};

export function adaptExerciseForEquipment<T extends RoutineExerciseLike>(
  ex: T,
  equipment: OnboardingEquipment
): T {
  const cloned = { ...ex };
  if (equipment === 'full_gym' || cloned.isCardio) {
    return cloned;
  }
  const rules = EQUIPMENT_ADAPTATIONS[equipment] || [];
  for (const rule of rules) {
    if (rule.pattern.test(cloned.name)) {
      cloned.name = rule.replacement;
      cloned.equipType = rule.equipType;
      cloned.equipLabel = rule.equipLabel;
      if (equipment === 'home_bodyweight') {
        cloned.isBodyweightRepsOnly = true;
      }
      break;
    }
  }
  return cloned;
}

export interface IkeaQuizProgramOutput<
  TMeal extends DietRecipeLike = DietRecipeLike,
  TDay extends RoutineDayLike | number = RoutineDayLike
> {
  answers: IkeaQuizAnswers;
  programWizardConfig: ProgramWizardConfig & {
    goal: OnboardingGoal;
    equipment: OnboardingEquipment;
    weeklyWorkoutTarget: number;
  };
  mealPlan: TMeal[];
  blockedMeals: Array<{ recipe: TMeal; reason: string }>;
  workoutSchedule: TDay[];
  guestSandboxProfile: {
    name: string;
    email: string;
    isGuest: boolean;
    authProvider: 'guest_local';
    signedInAt: string;
  };
}

export function buildIkeaQuizProgram<
  TMeal extends DietRecipeLike = DietRecipeLike,
  TDay extends RoutineDayLike | number = RoutineDayLike
>(
  rawAnswers: Partial<IkeaQuizAnswers>,
  candidateMeals: TMeal[] = [],
  baseSchedule: TDay[] = []
): IkeaQuizProgramOutput<TMeal, TDay> {
  const goal: OnboardingGoal =
    rawAnswers.goal === 'get_stronger' ||
    rawAnswers.goal === 'lose_fat' ||
    rawAnswers.goal === 'stay_fit' ||
    rawAnswers.goal === 'build_muscle'
      ? rawAnswers.goal
      : 'build_muscle';

  const experience: WizardDifficulty =
    rawAnswers.experience === 'easy' ||
    rawAnswers.experience === 'medium' ||
    rawAnswers.experience === 'hard'
      ? rawAnswers.experience
      : 'medium';

  const equipment: OnboardingEquipment =
    rawAnswers.equipment === 'full_gym' ||
    rawAnswers.equipment === 'dumbbells_only' ||
    rawAnswers.equipment === 'machines_cables' ||
    rawAnswers.equipment === 'home_bodyweight'
      ? rawAnswers.equipment
      : 'full_gym';

  const rawDays = Number(rawAnswers.daysPerWeek);
  const daysPerWeek = Number.isFinite(rawDays) ? Math.max(2, Math.min(6, Math.round(rawDays))) : 4;
  const baseDiet = normalizeBaseDietStrict(rawAnswers.baseDiet || 'Vegan');
  const intolerances = normalizeIntolerancesStrict(rawAnswers.intolerances || []);

  const answers: IkeaQuizAnswers = {
    goal,
    experience,
    equipment,
    daysPerWeek,
    baseDiet,
    intolerances
  };

  const validated = buildValidatedWizardProgram(
    {
      daysPerWeek,
      primaryFocus: mapGoalToPrimaryFocus(goal),
      difficulty: experience,
      baseDiet,
      intolerances
    },
    candidateMeals,
    baseSchedule
  );

  const adaptedSchedule = validated.workoutSchedule.map((slot) => {
    if (typeof slot === 'number' || !slot || typeof slot !== 'object') {
      return slot;
    }
    if (slot.isRest || slot.isRestDay || !Array.isArray(slot.exercises)) {
      return { ...slot };
    }
    return {
      ...slot,
      exercises: slot.exercises.map((ex) => {
        const eqAdapted = adaptExerciseForEquipment(ex, equipment);
        return {
          ...eqAdapted,
          reps: mapGoalToRepRange(goal, eqAdapted.reps)
        };
      })
    };
  }) as TDay[];

  return {
    answers,
    programWizardConfig: {
      ...validated.config,
      goal,
      equipment,
      weeklyWorkoutTarget: daysPerWeek
    },
    mealPlan: validated.mealPlan,
    blockedMeals: validated.blockedMeals,
    workoutSchedule: adaptedSchedule,
    guestSandboxProfile: {
      name: 'Guest',
      email: '',
      isGuest: true,
      authProvider: 'guest_local',
      signedInAt: new Date().toISOString()
    }
  };
}

export function createGuestSandboxStatePatch(
  quizOutput: IkeaQuizProgramOutput<any, any>,
  existingUserProfile?: { email?: string; name?: string; isGuest?: boolean } | null
): Record<string, any> {
  const hasRealAccount = Boolean(
    existingUserProfile &&
      typeof existingUserProfile.email === 'string' &&
      existingUserProfile.email.trim().includes('@') &&
      !existingUserProfile.isGuest
  );

  return {
    isGuestMode: !hasRealAccount,
    userProfile: hasRealAccount ? existingUserProfile : quizOutput.guestSandboxProfile,
    programWizardConfig: quizOutput.programWizardConfig,
    weeklyWorkoutTarget: quizOutput.answers.daysPerWeek,
    baseDiet: quizOutput.answers.baseDiet,
    intolerances: quizOutput.answers.intolerances,
    onboardingComplete: true,
    userHasCompletedOnboarding: true,
    hasCompletedFirstSetup: true
  };
}
