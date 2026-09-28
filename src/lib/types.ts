export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodItem extends Macros {
  name: string;
  portion: string;
}

export interface Meal extends Macros {
  id: string;
  name: string;
  mealType: MealType;
  photoUri: string | null;
  items: FoodItem[];
  servings: number;
  createdAt: number; // when the meal was eaten (for past days, a time on that day)
  loggedAt?: number; // when it was entered in the app; missing on meals saved before this existed
  day: string; // YYYY-MM-DD, local time
}

export type Goals = Macros;

export interface Reminder {
  enabled: boolean;
  hour: number;
  minute: number;
}

/**
 * What a reminder does. Meal kinds are skipped when that meal is already logged; "streak" only fires if nothing
 * is logged that day; "custom" always fires daily.
 */
export type ReminderKind = "breakfast" | "lunch" | "dinner" | "streak" | "custom";

/** Any reminder: every one can be renamed, retimed, turned off or deleted. */
export interface ReminderItem extends Reminder {
  id: string;
  label: string;
  kind: ReminderKind;
}

/** Pre-list storage shape, kept only to migrate saved data. */
export interface LegacyReminders {
  breakfast: Reminder;
  lunch: Reminder;
  dinner: Reminder;
  streakSaver: Reminder;
}

/** Shape returned by the local analysis server. */
export interface Analysis extends Macros {
  is_food: boolean;
  name: string;
  items: FoodItem[];
  confidence: "low" | "medium" | "high";
  health_score: number;
  note: string;
}

/** One weigh-in. At most one per day; logging again the same day replaces it. */
export interface WeightEntry {
  day: string; // YYYY-MM-DD
  kg: number;
  loggedAt?: number; // when it was entered; missing on entries saved before this existed
}

/** The on-device account from before sign-in moved to Supabase. Only read to import that data into the new account. */
export interface Account {
  email: string;
  salt: string;
  hash: string;
}

export type GoalType ="lose" | "maintain" | "gain" | "muscle";
export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "athlete";
export type Units = "metric" | "imperial";

/** Answers from onboarding, used to calculate the daily goals. */
export interface Profile {
  goal: GoalType;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  paceKgPerWeek: number; // how fast to lose/gain; 0 for maintain and muscle
  targetWeightKg: number | null;
  units: Units;
}
