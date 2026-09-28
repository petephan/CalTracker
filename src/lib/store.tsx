import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authErrorMessage, normalizeEmail } from "./auth";
import { addDays, dayKey } from "./date";
import { supabase } from "./supabase";
import {
  eraseUserData,
  fetchUserData,
  isRejected,
  removeMeal,
  removeReminder,
  removeWeight,
  saveMeal,
  saveProfile,
  saveReminders,
  saveWeight,
  uploadUserData,
  type UserData,
} from "./sync";
import type { Account, Goals, LegacyReminders, Macros, Meal, Profile, ReminderItem, WeightEntry } from "./types";

/** Data from before accounts moved to Supabase: one on-device account plus everything it logged. */
const LEGACY_KEY = "calsnap:v1";
/** Settings that belong to the device, not the account. */
const DEVICE_KEY = "calsnap:device";
/** Offline copy of one account's data, so the app opens instantly and works without a connection. */
const cacheKey = (userId: string) => `calsnap:v2:${userId}`;

export const DEFAULT_GOALS: Goals = { calories: 2200, protein: 150, carbs: 220, fat: 75 };

export const DEFAULT_REMINDERS: ReminderItem[] = [
  { id: "breakfast", label: "Breakfast", kind: "breakfast", enabled: true, hour: 8, minute: 30 },
  { id: "lunch", label: "Lunch", kind: "lunch", enabled: true, hour: 12, minute: 30 },
  { id: "dinner", label: "Dinner", kind: "dinner", enabled: true, hour: 19, minute: 0 },
  { id: "streak", label: "Streak saver", kind: "streak", enabled: true, hour: 20, minute: 30 },
];

const EMPTY: UserData = { meals: [], goals: DEFAULT_GOALS, reminders: DEFAULT_REMINDERS, profile: null, weights: [] };

/** Older versions stored four fixed reminders plus a separate custom list; fold both into one list. */
function migrateReminders(saved: { reminders?: unknown; customReminders?: unknown }): ReminderItem[] {
  if (Array.isArray(saved.reminders)) return saved.reminders as ReminderItem[];
  const legacy = saved.reminders as Partial<LegacyReminders> | undefined;
  const fixed = DEFAULT_REMINDERS.map((d) => {
    const old = legacy?.[d.kind === "streak" ? "streakSaver" : (d.kind as "breakfast" | "lunch" | "dinner")];
    return old ? { ...d, enabled: old.enabled, hour: old.hour, minute: old.minute } : d;
  });
  const custom = Array.isArray(saved.customReminders)
    ? (saved.customReminders as Omit<ReminderItem, "kind">[]).map((r) => ({ ...r, kind: "custom" as const }))
    : [];
  return [...fixed, ...custom];
}

type LegacyState = Partial<UserData> & { account?: Account | null; serverUrl?: string | null; customReminders?: unknown };

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.warn(`Failed to read ${key}`, e);
    return null;
  }
}

/** Legacy data, only if it belonged to this email, so a shared phone never hands one person's log to another. */
async function legacyDataFor(email: string): Promise<UserData | null> {
  const saved = await readJson<LegacyState>(LEGACY_KEY);
  if (!saved?.profile || saved.account?.email !== normalizeEmail(email)) return null;
  return {
    meals: saved.meals ?? [],
    goals: saved.goals ?? DEFAULT_GOALS,
    reminders: migrateReminders(saved),
    profile: saved.profile,
    // Profiles from before weight tracking start their history at the onboarding weight.
    weights: saved.weights ?? [{ day: dayKey(), kg: saved.profile.weightKg }],
  };
}

/**
 * Picks the data to show after sign-in. Supabase is the source of truth, except when edits made offline haven't
 * reached it yet (`dirty`), or when this device still holds pre-Supabase data for this email.
 */
async function loadAccount(userId: string, email: string): Promise<{ data: UserData; dirty: boolean }> {
  const cached = await readJson<{ data: UserData; dirty: boolean }>(cacheKey(userId));
  try {
    if (cached?.dirty) {
      try {
        await uploadUserData(userId, cached.data);
        return { data: cached.data, dirty: false };
      } catch (e) {
        // Data the database refuses would be retried forever; drop it and take what's saved in Supabase.
        if (!isRejected(e)) throw e;
        console.warn("Supabase refused this device's unsaved changes", e);
      }
    }
    const remote = await fetchUserData();
    // Photos never leave the device, so put back the ones this device has.
    const photos = new Map(cached?.data.meals.map((m) => [m.id, m.photoUri]));
    remote.data.meals = remote.data.meals.map((m) => ({ ...m, photoUri: photos.get(m.id) ?? null }));
    if (!remote.profile) {
      const legacy = await legacyDataFor(email);
      if (legacy) {
        await uploadUserData(userId, legacy);
        await AsyncStorage.removeItem(LEGACY_KEY);
        return { data: legacy, dirty: false };
      }
    }
    return {
      data: {
        ...remote.data,
        profile: remote.profile?.profile ?? null,
        goals: remote.profile?.goals ?? DEFAULT_GOALS,
        // A new account gets the default reminders; they're saved along with the profile at onboarding.
        reminders: remote.profile ? remote.data.reminders : DEFAULT_REMINDERS,
      },
      dirty: false,
    };
  } catch (e) {
    console.warn("Couldn't load from Supabase; using this device's copy", e);
    return cached ?? { data: EMPTY, dirty: false };
  }
}

interface Store extends UserData {
  loaded: boolean;
  signedIn: boolean;
  email: string | null;
  serverUrl: string | null; // null = auto-detect from the dev server host
  addMeal: (meal: Meal) => void;
  updateMeal: (meal: Meal) => void;
  deleteMeal: (id: string) => void;
  completeOnboarding: (profile: Profile, goals: Goals) => void;
  logWeight: (kg: number, day?: string) => void;
  deleteWeight: (day: string) => void;
  setGoals: (goals: Goals) => void;
  addReminder: () => void;
  updateReminder: (id: string, patch: Partial<Omit<ReminderItem, "id" | "kind">>) => void;
  deleteReminder: (id: string) => void;
  restoreDefaultReminders: () => void;
  setServerUrl: (url: string | null) => void;
  /** Deletes every meal, weigh-in, reminder and the plan. The login itself stays. Throws if Supabase can't be reached. */
  resetAll: () => Promise<void>;
  /** Throws an Error with a user-facing message. Resolves "confirm-email" when Supabase wants the address confirmed first. */
  signUp: (email: string, password: string) => Promise<"signed-in" | "confirm-email">;
  /** Throws an Error with a user-facing message. */
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const StoreContext = createContext<Store | null>(null);

type User = { id: string; email: string };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined until the saved session is read
  const [data, setData] = useState<UserData>(EMPTY);
  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null); // user id whose data is in `data`
  const dataRef = useRef(data);
  const dirtyRef = useRef(false);

  useEffect(() => {
    const apply = (u: { id: string; email?: string } | null | undefined) =>
      setUser((prev) => (prev?.id === u?.id && prev !== undefined ? prev : u ? { id: u.id, email: u.email ?? "" } : null));
    supabase.auth.getSession().then(({ data: { session } }) => apply(session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    Promise.all([readJson<{ serverUrl: string | null }>(DEVICE_KEY), readJson<LegacyState>(LEGACY_KEY)]).then(([device, legacy]) =>
      setServerUrlState(device?.serverUrl ?? legacy?.serverUrl ?? null),
    );
  }, []);

  const replaceData = (next: UserData) => {
    dataRef.current = next;
    setData(next);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadAccount(user.id, user.email).then(({ data: loaded, dirty }) => {
      if (cancelled) return;
      dirtyRef.current = dirty;
      replaceData(loaded);
      setLoadedFor(user.id);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const userId = user?.id ?? null;
  // Signed out there's nothing to load; signed in, wait until this account's data (not the previous one's) is in.
  const loaded = user === null || (!!user && loadedFor === user.id);

  useEffect(() => {
    if (!loaded || !userId) return;
    AsyncStorage.setItem(cacheKey(userId), JSON.stringify({ data, dirty: dirtyRef.current })).catch((e) =>
      console.warn("Failed to save", e),
    );
  }, [data, loaded, userId]);

  /** Applies a change on screen right away, then saves it to Supabase. A failed save is retried at the next launch. */
  const change = useCallback(
    (fn: (d: UserData) => UserData, sync?: (userId: string, next: UserData) => Promise<unknown> | undefined | null) => {
      const next = fn(dataRef.current);
      replaceData(next);
      if (!userId || !sync) return;
      Promise.resolve(sync(userId, next)).catch((e) => {
        if (isRejected(e)) return console.warn("Supabase refused this change", e);
        console.warn("Couldn't save to Supabase; will retry next launch", e);
        dirtyRef.current = true;
        AsyncStorage.setItem(cacheKey(userId), JSON.stringify({ data: dataRef.current, dirty: true })).catch(() => {});
      });
    },
    [userId],
  );

  const addMeal = useCallback((meal: Meal) => change((d) => ({ ...d, meals: [meal, ...d.meals] }), (id) => saveMeal(id, meal)), [change]);
  const updateMeal = useCallback(
    (meal: Meal) => change((d) => ({ ...d, meals: d.meals.map((m) => (m.id === meal.id ? meal : m)) }), (id) => saveMeal(id, meal)),
    [change],
  );
  const deleteMeal = useCallback(
    (mealId: string) => change((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== mealId) }), () => removeMeal(mealId)),
    [change],
  );
  const completeOnboarding = useCallback(
    (profile: Profile, goals: Goals) => {
      const entry = { day: dayKey(), kg: profile.weightKg, loggedAt: Date.now() };
      change(
        (d) => ({ ...d, profile, goals, weights: upsertWeight(d.weights, entry) }),
        (id, next) => Promise.all([saveProfile(id, profile, goals), saveWeight(id, entry), saveReminders(id, next.reminders)]),
      );
    },
    [change],
  );
  /** Logging the most recent weigh-in also updates the profile, so recommendations follow your current weight. */
  const logWeight = useCallback(
    (kg: number, day: string = dayKey()) => {
      const entry = { day, kg, loggedAt: Date.now() };
      change(
        (d) => {
          const weights = upsertWeight(d.weights, entry);
          const latest = weights[weights.length - 1];
          return { ...d, weights, profile: d.profile && latest ? { ...d.profile, weightKg: latest.kg } : d.profile };
        },
        (id, next) => Promise.all([saveWeight(id, entry), next.profile && saveProfile(id, next.profile, next.goals)]),
      );
    },
    [change],
  );
  const deleteWeight = useCallback(
    (day: string) => change((d) => ({ ...d, weights: d.weights.filter((w) => w.day !== day) }), () => removeWeight(day)),
    [change],
  );
  const setGoals = useCallback(
    (goals: Goals) => change((d) => ({ ...d, goals }), (id, next) => next.profile && saveProfile(id, next.profile, goals)),
    [change],
  );
  const addReminder = useCallback(() => {
    const reminder: ReminderItem = { id: Date.now().toString(36), label: "New reminder", kind: "custom", enabled: true, hour: 15, minute: 0 };
    change((d) => ({ ...d, reminders: [...d.reminders, reminder] }), (id) => saveReminders(id, [reminder]));
  }, [change]);
  const updateReminder = useCallback(
    (reminderId: string, patch: Partial<Omit<ReminderItem, "id" | "kind">>) =>
      change(
        (d) => ({ ...d, reminders: d.reminders.map((r) => (r.id === reminderId ? { ...r, ...patch } : r)) }),
        (id, next) => saveReminders(id, next.reminders.filter((r) => r.id === reminderId)),
      ),
    [change],
  );
  const deleteReminder = useCallback(
    (reminderId: string) =>
      change((d) => ({ ...d, reminders: d.reminders.filter((r) => r.id !== reminderId) }), () => removeReminder(reminderId)),
    [change],
  );
  /** Puts back any of the built-in reminders that were deleted, leaving the rest alone. */
  const restoreDefaultReminders = useCallback(() => {
    const missing = DEFAULT_REMINDERS.filter((d) => !dataRef.current.reminders.some((r) => r.id === d.id));
    change((d) => ({ ...d, reminders: [...missing, ...d.reminders] }), (id) => saveReminders(id, missing));
  }, [change]);

  const setServerUrl = useCallback((url: string | null) => {
    setServerUrlState(url);
    AsyncStorage.setItem(DEVICE_KEY, JSON.stringify({ serverUrl: url })).catch((e) => console.warn("Failed to save", e));
  }, []);

  const resetAll = useCallback(async () => {
    if (!userId) return;
    await eraseUserData(userId);
    dirtyRef.current = false;
    replaceData(EMPTY);
  }, [userId]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data: res, error } = await supabase.auth.signUp({ email: normalizeEmail(email), password });
    if (error) throw new Error(authErrorMessage(error));
    return res.session ? "signed-in" : "confirm-email";
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (error) throw new Error(authErrorMessage(error));
  }, []);
  const signOut = useCallback(() => {
    supabase.auth.signOut().catch((e) => console.warn("Sign out failed", e));
  }, []);

  const value = useMemo(
    () => ({
      ...(user ? data : EMPTY), // never show the previous account's data after signing out
      loaded,
      signedIn: !!user,
      email: user?.email ?? null,
      serverUrl,
      addMeal,
      updateMeal,
      deleteMeal,
      completeOnboarding,
      logWeight,
      deleteWeight,
      setGoals,
      addReminder,
      updateReminder,
      deleteReminder,
      restoreDefaultReminders,
      setServerUrl,
      resetAll,
      signUp,
      signIn,
      signOut,
    }),
    [
      data,
      loaded,
      user,
      serverUrl,
      addMeal,
      updateMeal,
      deleteMeal,
      completeOnboarding,
      logWeight,
      deleteWeight,
      setGoals,
      addReminder,
      updateReminder,
      deleteReminder,
      restoreDefaultReminders,
      setServerUrl,
      resetAll,
      signUp,
      signIn,
      signOut,
    ],
  );

  // Hold rendering until the account's data is loaded so screens never flash default goals or onboarding.
  return <StoreContext.Provider value={value}>{loaded ? children : null}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

function upsertWeight(list: WeightEntry[], entry: WeightEntry): WeightEntry[] {
  return [...list.filter((w) => w.day !== entry.day), entry].sort((a, b) => a.day.localeCompare(b.day));
}

// ---------- Derived data ----------

const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function sumMacros(meals: Meal[]): Macros {
  return meals.reduce(
    (t, m) => ({
      calories: t.calories + m.calories,
      protein: t.protein + m.protein,
      carbs: t.carbs + m.carbs,
      fat: t.fat + m.fat,
    }),
    ZERO,
  );
}

export function mealsByDay(meals: Meal[]): Map<string, Meal[]> {
  const map = new Map<string, Meal[]>();
  for (const m of meals) {
    const list = map.get(m.day);
    if (list) list.push(m);
    else map.set(m.day, [m]);
  }
  return map;
}

/** Calories count as "hit" inside ±10% of goal; macros once you reach 90% of goal. */
export function goalStatus(t: Macros, g: Goals) {
  return {
    calories: t.calories >= g.calories * 0.9 && t.calories <= g.calories * 1.1,
    protein: t.protein >= g.protein * 0.9,
    carbs: t.carbs >= g.carbs * 0.9,
    fat: t.fat >= g.fat * 0.9,
  };
}

/**
 * A streak is consecutive days with at least one logged meal. Today not being logged yet
 * doesn't break it — the streak is only lost once a full day passes with nothing logged.
 */
export function computeStreak(meals: Meal[]): { current: number; best: number; loggedToday: boolean } {
  const days = new Set(meals.map((m) => m.day));
  const today = dayKey();
  const loggedToday = days.has(today);

  let current = 0;
  let cursor = loggedToday ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...days].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), loggedToday };
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

export function nextMilestone(streak: number): number {
  return STREAK_MILESTONES.find((m) => m > streak) ?? streak + 100;
}
