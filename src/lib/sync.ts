import { supabase } from "./supabase";
import type { Goals, Meal, Profile, ReminderItem, WeightEntry } from "./types";

/** Everything that belongs to one account. Mirrors the tables in supabase/migrations. */
export interface UserData {
  meals: Meal[]; // newest first
  goals: Goals;
  reminders: ReminderItem[];
  profile: Profile | null; // null until onboarding is finished
  weights: WeightEntry[]; // oldest first
}

// ---------- Row mapping ----------

const toIso = (ms: number) => new Date(ms).toISOString();
const toMs = (iso: string | null) => (iso ? Date.parse(iso) : undefined);

function mealToRow(userId: string, m: Meal) {
  return {
    user_id: userId,
    id: m.id,
    name: m.name.slice(0, 200),
    meal_type: m.mealType,
    // photo_uri stays unset: photos are files (or, on web, data URIs) on the device that took them.
    items: m.items,
    servings: m.servings,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    day: m.day,
    eaten_at: toIso(m.createdAt),
    logged_at: m.loggedAt ? toIso(m.loggedAt) : null,
  };
}

function mealFromRow(r: any): Meal {
  return {
    id: r.id,
    name: r.name,
    mealType: r.meal_type,
    photoUri: null, // filled in from this device's copy, see loadAccount
    items: r.items,
    servings: r.servings,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    day: r.day,
    createdAt: Date.parse(r.eaten_at),
    loggedAt: toMs(r.logged_at),
  };
}

function profileToRow(userId: string, p: Profile, g: Goals) {
  const target = p.targetWeightKg;
  return {
    user_id: userId,
    goal: p.goal,
    sex: p.sex,
    age: p.age,
    height_cm: p.heightCm,
    weight_kg: p.weightKg,
    activity: p.activity,
    pace_kg_per_week: p.paceKgPerWeek,
    // The target field isn't range-checked on screen; drop values the database would reject.
    target_weight_kg: target != null && target >= 20 && target <= 500 ? target : null,
    units: p.units,
    goal_calories: Math.round(g.calories),
    goal_protein: Math.round(g.protein),
    goal_carbs: Math.round(g.carbs),
    goal_fat: Math.round(g.fat),
  };
}

function profileFromRow(r: any): { profile: Profile; goals: Goals } {
  return {
    profile: {
      goal: r.goal,
      sex: r.sex,
      age: r.age,
      heightCm: r.height_cm,
      weightKg: r.weight_kg,
      activity: r.activity,
      paceKgPerWeek: r.pace_kg_per_week,
      targetWeightKg: r.target_weight_kg,
      units: r.units,
    },
    goals: { calories: r.goal_calories, protein: r.goal_protein, carbs: r.goal_carbs, fat: r.goal_fat },
  };
}

const weightToRow = (userId: string, w: WeightEntry) => ({
  user_id: userId,
  day: w.day,
  kg: w.kg,
  logged_at: w.loggedAt ? toIso(w.loggedAt) : null,
});

const weightFromRow = (r: any): WeightEntry => ({ day: r.day, kg: r.kg, loggedAt: toMs(r.logged_at) });

const reminderToRow = (userId: string, r: ReminderItem) => ({ user_id: userId, ...r, label: r.label.slice(0, 100) });

const reminderFromRow = ({ user_id: _, ...r }: any): ReminderItem => r;

/**
 * True when the database refused the data itself (a failed check, a permission error), so sending it again won't
 * help. Network failures and expired sessions are worth retrying.
 */
export function isRejected(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^(22|23|42)[0-9A-Z]{3}$/.test(code);
}

/** Supabase returns errors instead of throwing; turn them into exceptions so callers can catch. */
function check<T extends { error: unknown }>(res: T): T {
  if (res.error) throw res.error;
  return res;
}

// ---------- Reads ----------

/** Loads every row for the signed-in user. RLS limits each query to their own rows. */
export async function fetchUserData(): Promise<{ data: Omit<UserData, "goals" | "profile">; profile: ReturnType<typeof profileFromRow> | null }> {
  const [profile, meals, weights, reminders] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle().then(check),
    supabase.from("meals").select("*").order("eaten_at", { ascending: false }).then(check),
    supabase.from("weight_entries").select("*").order("day").then(check),
    supabase.from("reminders").select("*").then(check),
  ]);
  return {
    profile: profile.data ? profileFromRow(profile.data) : null,
    data: {
      meals: (meals.data ?? []).map(mealFromRow),
      weights: (weights.data ?? []).map(weightFromRow),
      reminders: (reminders.data ?? []).map(reminderFromRow),
    },
  };
}

// ---------- Writes ----------

export const saveMeal = async (userId: string, meal: Meal) =>
  check(await supabase.from("meals").upsert(mealToRow(userId, meal)));

export const removeMeal = async (id: string) => check(await supabase.from("meals").delete().eq("id", id));

export const saveWeight = async (userId: string, entry: WeightEntry) =>
  check(await supabase.from("weight_entries").upsert(weightToRow(userId, entry)));

export const removeWeight = async (day: string) => check(await supabase.from("weight_entries").delete().eq("day", day));

export const saveProfile = async (userId: string, profile: Profile, goals: Goals) =>
  check(await supabase.from("profiles").upsert(profileToRow(userId, profile, goals)));

export const saveReminders = async (userId: string, reminders: ReminderItem[]) =>
  reminders.length ? check(await supabase.from("reminders").upsert(reminders.map((r) => reminderToRow(userId, r)))) : undefined;

export const removeReminder = async (id: string) => check(await supabase.from("reminders").delete().eq("id", id));

/** Uploads a whole data set, e.g. data that was saved on this device before accounts moved to Supabase. */
export async function uploadUserData(userId: string, d: UserData) {
  await Promise.all([
    d.profile && saveProfile(userId, d.profile, d.goals),
    d.meals.length && supabase.from("meals").upsert(d.meals.map((m) => mealToRow(userId, m))).then(check),
    d.weights.length && supabase.from("weight_entries").upsert(d.weights.map((w) => weightToRow(userId, w))).then(check),
    saveReminders(userId, d.reminders),
  ]);
}

/** Deletes all of the signed-in user's rows. The login itself stays. */
export async function eraseUserData(userId: string) {
  await Promise.all(
    (["meals", "weight_entries", "reminders", "profiles"] as const).map((t) =>
      supabase.from(t).delete().eq("user_id", userId).then(check),
    ),
  );
}
