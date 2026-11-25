/**
 * Task 3: High-Visibility Warm-Up Tips & Real-Time Clock Schedule Sync
 * - Syncs Gym Time, Meal Times, and Water reminders with the user's real live time of day,
 *   even after backgrounding the app for several hours.
 * - Produces prominent, scannable ELI12 warm-up tips right above Exercise #1.
 */

export interface MealScheduleSlotLike {
  id: string;
  label: string;
  minutesFromMidnight: number;
}

export interface LiveScheduleSyncInput {
  nowDate?: Date;
  gymTimeHHMM: string;
  wakeUpHHMM?: string;
  warmupType?: 'upper' | 'lower';
  isWorkoutComplete?: boolean;
  completedSetsToday?: number;
  mealSlots?: MealScheduleSlotLike[];
}

export interface LiveScheduleSyncResult {
  currentTime12: string;
  currentMinutes: number;
  gymTime12: string;
  gymTimeMinutes: number;
  phaseKey: 'pre_gym' | 'gym_window' | 'post_gym_fuel' | 'meal_time' | 'evening_recovery';
  phaseBadge: string;
  headline: string;
  nextActionText: string;
  isBehindScheduledGymTime: boolean;
  suggestShiftToNow: boolean;
  suggestedNowHHMM: string;
  suggestedNow12: string;
  warmupQuickTips: string[];
}

export function parseHHMMMinutesSafe(hhmm: string | null | undefined, fallbackMins = 420): number {
  const clean = String(hhmm || '').trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallbackMins;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return fallbackMins;
  }
  return hh * 60 + mm;
}

export function formatMinutes12Hour(totalMinutes: number): string {
  const norm = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(norm / 60);
  const mm = norm % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
}

export function formatMinutesHHMM(totalMinutes: number): string {
  const norm = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(norm / 60);
  const mm = norm % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function formatMinutesDeltaShort(deltaMins: number): string {
  const abs = Math.max(0, Math.round(Math.abs(deltaMins)));
  if (abs < 60) return `${abs} min`;
  const hrs = Math.floor(abs / 60);
  const rem = abs % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

/**
 * Returns 3 short, easy-to-scan ELI12 warm-up tips so users always see
 * key mobility and ramp-up guidance before lifting.
 */
export function buildProminentWarmupQuickTips(warmupType: 'upper' | 'lower' = 'upper'): string[] {
  if (warmupType === 'lower') {
    return [
      'Move joints first: 10 leg swings + 10 slow bodyweight squats.',
      'Wake up hips & glutes: 10 glute bridges before touching heavy weight.',
      'Ramp your first lift: 50% × 8 reps → 70% × 4 reps → 90% × 2 reps.'
    ];
  }
  return [
    'Loosen shoulders first: 10 arm circles + 12 band pull-aparts.',
    'Open your upper back: 8 slow scapular pull-ups or wall slides.',
    'Ramp your first lift: 50% × 8 reps → 70% × 4 reps → 90% × 2 reps.'
  ];
}

/**
 * Computes real-time schedule guidance ("Gym Time" vs "Meal Time" vs "Shift to Now")
 * directly against the live wall clock (`nowDate`), keeping suggestions accurate even
 * after several hours in the background.
 */
export function computeLiveScheduleContext(input: LiveScheduleSyncInput): LiveScheduleSyncResult {
  const now = input.nowDate instanceof Date && !Number.isNaN(input.nowDate.getTime())
    ? input.nowDate
    : new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTime12 = formatMinutes12Hour(currentMinutes);

  const gymTimeMinutes = parseHHMMMinutesSafe(input.gymTimeHHMM, 420);
  const gymTime12 = formatMinutes12Hour(gymTimeMinutes);
  const roundedNowMins = Math.min(1365, Math.max(300, Math.round(currentMinutes / 5) * 5));
  const suggestedNowHHMM = formatMinutesHHMM(roundedNowMins);
  const suggestedNow12 = formatMinutes12Hour(roundedNowMins);

  const defaultMeals: MealScheduleSlotLike[] = [
    { id: 'pre_shake', label: 'Pre-Gym Shake', minutesFromMidnight: ((gymTimeMinutes - 30) % 1440 + 1440) % 1440 },
    { id: 'post_oats', label: 'Post-Gym Oats', minutesFromMidnight: (gymTimeMinutes + 75) % 1440 },
    { id: 'lunch', label: 'Midday Meal', minutesFromMidnight: (gymTimeMinutes + 300) % 1440 },
    { id: 'dinner', label: 'Evening Meal', minutesFromMidnight: (gymTimeMinutes + 570) % 1440 }
  ];

  const meals = Array.isArray(input.mealSlots) && input.mealSlots.length > 0 ? input.mealSlots : defaultMeals;
  const sortedMeals = [...meals].sort((a, b) => a.minutesFromMidnight - b.minutesFromMidnight);

  const completedSets = Math.max(0, Number(input.completedSetsToday) || 0);
  const isWorkoutDone = Boolean(input.isWorkoutComplete);
  const minsSinceGymStart = currentMinutes - gymTimeMinutes;

  // User hasn't started lifting yet and real clock is > 45 min past planned gym time
  const isBehindScheduledGymTime = !isWorkoutDone && completedSets === 0 && minsSinceGymStart > 45;
  const suggestShiftToNow = isBehindScheduledGymTime && currentMinutes >= 300 && currentMinutes <= 1365;

  // Find next upcoming meal relative to live clock
  const nextMeal = sortedMeals.find((m) => m.minutesFromMidnight >= currentMinutes - 20) || null;
  const activeMealNow = sortedMeals.find(
    (m) => Math.abs(m.minutesFromMidnight - currentMinutes) <= 25
  );

  let phaseKey: LiveScheduleSyncResult['phaseKey'] = 'pre_gym';
  let phaseBadge = 'Live Clock Synced';
  let headline = '';
  let nextActionText = '';

  if (!isWorkoutDone && minsSinceGymStart >= -20 && minsSinceGymStart <= 75) {
    phaseKey = 'gym_window';
    phaseBadge = 'Gym Time Now';
    headline = `It is ${currentTime12} — right in your ${gymTime12} Gym window.`;
    nextActionText = nextMeal
      ? `Next meal: ${nextMeal.label} at ${formatMinutes12Hour(nextMeal.minutesFromMidnight)}.`
      : 'Drink 500 ml water during your sets.';
  } else if (suggestShiftToNow) {
    phaseKey = 'pre_gym';
    phaseBadge = 'Clock Shifted';
    headline = `It is ${currentTime12}. Your planned ${gymTime12} Gym Time has passed.`;
    nextActionText = `Tap "Sync Gym to ${suggestedNow12}" to shift your warm-up & all 4 meals to right now.`;
  } else if (!isWorkoutDone && currentMinutes < gymTimeMinutes) {
    phaseKey = 'pre_gym';
    phaseBadge = 'Pre-Gym';
    const untilGym = gymTimeMinutes - currentMinutes;
    headline = `It is ${currentTime12} — Gym Time (${gymTime12}) starts in ${formatMinutesDeltaShort(untilGym)}.`;
    nextActionText = activeMealNow
      ? `Meal Time Now: ${activeMealNow.label} (${formatMinutes12Hour(activeMealNow.minutesFromMidnight)}).`
      : nextMeal
        ? `Up next: ${nextMeal.label} at ${formatMinutes12Hour(nextMeal.minutesFromMidnight)}.`
        : 'Drink 500 ml water before you warm up.';
  } else if (activeMealNow) {
    phaseKey = 'meal_time';
    phaseBadge = 'Meal Time Now';
    headline = `It is ${currentTime12} — time for ${activeMealNow.label} (${formatMinutes12Hour(activeMealNow.minutesFromMidnight)}).`;
    nextActionText = isWorkoutDone
      ? 'Workout done for today. Fuel up and hit your protein target.'
      : 'Eat your planned fuel and keep drinking water.';
  } else if (isWorkoutDone && nextMeal) {
    phaseKey = 'post_gym_fuel';
    phaseBadge = 'Fuel & Recover';
    const untilMeal = Math.max(0, nextMeal.minutesFromMidnight - currentMinutes);
    headline = `It is ${currentTime12} — workout complete!`;
    nextActionText = `Next meal: ${nextMeal.label} at ${formatMinutes12Hour(nextMeal.minutesFromMidnight)} (in ${formatMinutesDeltaShort(untilMeal)}).`;
  } else {
    phaseKey = 'evening_recovery';
    phaseBadge = 'Recovery Time';
    headline = `It is ${currentTime12} — finish your last water bottle & rest well.`;
    nextActionText = `Tomorrow's Gym Time is set for ${gymTime12}.`;
  }

  return {
    currentTime12,
    currentMinutes,
    gymTime12,
    gymTimeMinutes,
    phaseKey,
    phaseBadge,
    headline,
    nextActionText,
    isBehindScheduledGymTime,
    suggestShiftToNow,
    suggestedNowHHMM,
    suggestedNow12,
    warmupQuickTips: buildProminentWarmupQuickTips(input.warmupType || 'upper')
  };
}
