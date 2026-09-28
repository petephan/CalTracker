import type { ActivityLevel, GoalType, Goals, Profile, Sex, Units } from "./types";

/*
 * How the daily plan is worked out. Every number here comes from a published guideline:
 *
 * - Resting energy: Mifflin-St Jeor. The Academy of Nutrition and Dietetics' evidence review found it the most
 *   accurate predictive equation, within 10% of measured RMR for most adults (Frankenfield et al., JADA 2005).
 * - Activity: the standard multipliers applied to resting energy (1.2 sedentary … 1.9 very hard daily exercise).
 * - Losing: 0.5–1% of body weight per week preserves muscle best (Helms et al., JISSN 2014), and the CDC advises
 *   1–2 lb (0.45–0.9 kg) per week. We never go below 1,200 kcal (women) / 1,500 kcal (men) without medical supervision.
 * - Gaining / building muscle: a 10–20% surplus, aiming for ~0.25–0.5% of body weight per week
 *   (Iraki et al., Sports 2019). Muscle gain uses the lower end to limit fat gain.
 * - Protein: RDA is 0.8 g/kg; active people need 1.2–2.0 g/kg (ACSM/AND/DC 2016), and 1.4–2.0 g/kg supports building
 *   and keeping muscle (ISSN 2017). For BMI ≥ 30 we dose protein off the weight at BMI 25, since g/kg of total
 *   weight overshoots when much of it is fat.
 * - Fat and carbs: kept inside the Institute of Medicine AMDRs (fat 20–35%, carbs 45–65%, protein 10–35% of energy).
 * - Healthy weight: WHO BMI 18.5–24.9.
 */

export const GOAL_OPTIONS: { value: GoalType; title: string; body: string }[] = [
  { value: "lose", title: "Lose weight", body: "Lose fat with a steady calorie deficit" },
  { value: "maintain", title: "Maintain weight", body: "Stay where you are and eat balanced" },
  { value: "gain", title: "Gain weight", body: "Put on healthy weight with a surplus" },
  { value: "muscle", title: "Build muscle", body: "A small surplus with high protein, alongside strength training" },
];

export const ACTIVITY_OPTIONS: { value: ActivityLevel; title: string; body: string; factor: number }[] = [
  { value: "sedentary", title: "Mostly sitting", body: "Desk job, little or no exercise", factor: 1.2 },
  { value: "light", title: "Lightly active", body: "Exercise 1–3 days a week", factor: 1.375 },
  { value: "moderate", title: "Moderately active", body: "Exercise 3–5 days a week", factor: 1.55 },
  { value: "active", title: "Very active", body: "Hard exercise 6–7 days a week", factor: 1.725 },
  { value: "athlete", title: "Extremely active", body: "Physical job or training twice a day", factor: 1.9 },
];

const KCAL_PER_KG = 7700; // energy in ~1 kg of body weight change
const MIN_CALORIES: Record<Sex, number> = { female: 1200, male: 1500 };
const CDC_MAX_LOSS_KG = 0.9; // 2 lb / week
export const HEALTHY_BMI = { min: 18.5, max: 24.9 } as const;

// ---------- Body ----------

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(value: number): { label: string; tone: "ok" | "warn" } {
  if (value < HEALTHY_BMI.min) return { label: "Underweight", tone: "warn" };
  if (value < 25) return { label: "Healthy weight", tone: "ok" };
  if (value < 30) return { label: "Overweight", tone: "warn" };
  return { label: "Obesity", tone: "warn" };
}

/** Weight range for a healthy BMI at this height. */
export function healthyWeightRange(heightCm: number): { min: number; max: number } {
  const m2 = (heightCm / 100) ** 2;
  return { min: HEALTHY_BMI.min * m2, max: HEALTHY_BMI.max * m2 };
}

/** The goal we'd suggest from BMI alone. The user can always pick another. */
export function recommendedGoal(weightKg: number, heightCm: number): GoalType {
  const b = bmi(weightKg, heightCm);
  if (b >= 25) return "lose";
  if (b < HEALTHY_BMI.min) return "gain";
  return "maintain";
}

// ---------- Pace ----------

export interface PaceOption {
  kgPerWeek: number;
  title: string;
  recommended: boolean;
}

/**
 * Three pace choices scaled to the person's body weight. For losing: 0.5% / 0.75% / 1% of body weight per week
 * (capped at the CDC's 2 lb). For gaining: 0.25% / 0.5% (Iraki 2019). The gentlest in-range option is recommended.
 */
export function paceOptions(goal: GoalType, weightKg: number): PaceOption[] {
  const round = (kg: number) => Math.round(kg * 20) / 20; // nearest 0.05 kg
  if (goal === "lose") {
    return [
      { kgPerWeek: round(Math.min(weightKg * 0.005, CDC_MAX_LOSS_KG)), title: "Steady", recommended: true },
      { kgPerWeek: round(Math.min(weightKg * 0.0075, CDC_MAX_LOSS_KG)), title: "Moderate", recommended: false },
      { kgPerWeek: round(Math.min(weightKg * 0.01, CDC_MAX_LOSS_KG)), title: "Fast", recommended: false },
    ].filter((o, i, all) => all.findIndex((x) => x.kgPerWeek === o.kgPerWeek) === i);
  }
  if (goal === "gain") {
    return [
      { kgPerWeek: round(weightKg * 0.0025), title: "Lean", recommended: true },
      { kgPerWeek: round(weightKg * 0.005), title: "Faster", recommended: false },
    ];
  }
  return [];
}

export function recommendedPace(goal: GoalType, weightKg: number): number {
  return paceOptions(goal, weightKg).find((o) => o.recommended)?.kgPerWeek ?? 0;
}

/** A target weight inside the healthy range, in the direction of the goal. Null when the goal isn't about weight. */
export function recommendedTarget(goal: GoalType, weightKg: number, heightCm: number): number | null {
  const range = healthyWeightRange(heightCm);
  if (goal === "lose") {
    // Head for the top of the healthy range, or 10% off if that's a smaller first step (clinically meaningful).
    return Math.round(Math.max(range.max, weightKg * 0.9));
  }
  if (goal === "gain") return Math.round(Math.min(Math.max(range.min + 2, weightKg + 3), weightKg * 1.1));
  return null;
}

// ---------- Energy + macros ----------

export function bmr(p: Pick<Profile, "sex" | "age" | "heightCm" | "weightKg">): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161);
}

export function maintenanceCalories(p: Profile): number {
  const factor = ACTIVITY_OPTIONS.find((a) => a.value === p.activity)?.factor ?? 1.2;
  return bmr(p) * factor;
}

function proteinPerKg(p: Profile): number {
  if (p.goal === "muscle") return 1.8;
  if (p.goal === "lose" || p.goal === "gain") return 1.6;
  return p.activity === "sedentary" ? 1.0 : 1.4;
}

export interface Plan {
  goals: Goals;
  maintenance: number;
  /** Set when the calorie floor kicked in and the chosen pace can't be fully met. */
  flooredAt: number | null;
}

export function calculatePlan(p: Profile): Plan {
  const tdee = maintenanceCalories(p);
  let target = tdee;
  if (p.goal === "lose") target = tdee - (p.paceKgPerWeek * KCAL_PER_KG) / 7;
  if (p.goal === "gain") target = tdee + (p.paceKgPerWeek * KCAL_PER_KG) / 7;
  if (p.goal === "muscle") target = tdee * 1.1;

  const floor = MIN_CALORIES[p.sex];
  const flooredAt = target < floor ? floor : null;
  const calories = Math.round(Math.max(target, floor) / 10) * 10;

  const b = bmi(p.weightKg, p.heightCm);
  const proteinWeight = b >= 30 ? 25 * (p.heightCm / 100) ** 2 : p.weightKg;
  const protein = Math.round(Math.min(proteinWeight * proteinPerKg(p), (calories * 0.35) / 4));
  const fatShare = p.goal === "lose" || p.goal === "muscle" ? 0.25 : 0.3;
  const fat = Math.round((calories * fatShare) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { goals: { calories, protein, carbs, fat }, maintenance: Math.round(tdee / 10) * 10, flooredAt };
}

/** Rough weeks to reach the target at the chosen pace. */
export function weeksToTarget(p: Profile): number | null {
  if (!p.targetWeightKg || !p.paceKgPerWeek) return null;
  const diff = Math.abs(p.weightKg - p.targetWeightKg);
  return diff > 0 ? Math.ceil(diff / p.paceKgPerWeek) : null;
}

/** "March 2027" for a date `weeks` from today. */
export function weeksFromNow(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toLocaleDateString([], { month: "long", year: "numeric" });
}

// ---------- Units ----------

export const kgToLb = (kg: number) => kg * 2.20462;
export const lbToKg = (lb: number) => lb / 2.20462;
export const cmToFtIn = (cm: number) => {
  const totalIn = Math.round(cm / 2.54);
  return { ft: Math.floor(totalIn / 12), inches: totalIn % 12 };
};
export const ftInToCm = (ft: number, inches: number) => (ft * 12 + inches) * 2.54;

/** Weight in the user's units. Pass `decimals: 1` for individual weigh-ins, where 199.6 vs 200 matters. */
export function formatWeight(kg: number, units: Units, decimals = 0): string {
  const f = 10 ** decimals;
  const round = (n: number) => Math.round(n * f) / f;
  return units === "imperial" ? `${round(kgToLb(kg))} lb` : `${round(kg)} kg`;
}

export function formatHeight(cm: number, units: Units): string {
  if (units === "metric") return `${Math.round(cm)} cm`;
  const { ft, inches } = cmToFtIn(cm);
  return `${ft}′${inches}″`;
}

export function formatPace(kgPerWeek: number, units: Units): string {
  return units === "imperial"
    ? `${(Math.round(kgToLb(kgPerWeek) * 4) / 4).toString()} lb / week`
    : `${kgPerWeek} kg / week`;
}

export const GOAL_TITLE: Record<GoalType, string> = Object.fromEntries(GOAL_OPTIONS.map((g) => [g.value, g.title])) as Record<
  GoalType,
  string
>;
