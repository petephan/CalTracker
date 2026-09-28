import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/Button";
import { Choice } from "../components/Choice";
import { Icon } from "../components/Icon";
import { noFocusRing, screen } from "../lib/layout";
import {
  ACTIVITY_OPTIONS,
  bmi,
  bmiCategory,
  bmr,
  calculatePlan,
  cmToFtIn,
  formatPace,
  formatWeight,
  ftInToCm,
  GOAL_OPTIONS,
  GOAL_TITLE,
  healthyWeightRange,
  kgToLb,
  lbToKg,
  paceOptions,
  recommendedGoal,
  recommendedPace,
  recommendedTarget,
  weeksFromNow,
  weeksToTarget,
} from "../lib/plan";
import { useStore } from "../lib/store";
import { colors, font, macroMeta, radius } from "../lib/theme";
import type { ActivityLevel, GoalType, Profile, Sex, Units } from "../lib/types";

type Step = "about" | "body" | "activity" | "goal" | "pace" | "plan";

const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const clean = (t: string) => t.replace(/[^0-9.,]/g, "");

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { profile: saved, completeOnboarding } = useStore();
  const editing = !!saved;

  const [units, setUnits] = useState<Units>(saved?.units ?? "imperial");
  const [sex, setSex] = useState<Sex | null>(saved?.sex ?? null);
  const [age, setAge] = useState(saved ? String(saved.age) : "");
  const [cm, setCm] = useState(saved ? String(Math.round(saved.heightCm)) : "");
  const [ft, setFt] = useState(saved ? String(cmToFtIn(saved.heightCm).ft) : "");
  const [inch, setInch] = useState(saved ? String(cmToFtIn(saved.heightCm).inches) : "");
  const [weight, setWeight] = useState(
    saved ? String(Math.round(saved.units === "imperial" ? kgToLb(saved.weightKg) : saved.weightKg)) : "",
  );
  const [activity, setActivity] = useState<ActivityLevel | null>(saved?.activity ?? null);
  // null = use our recommendation
  const [goal, setGoal] = useState<GoalType | null>(saved?.goal ?? null);
  const [pace, setPace] = useState<number | null>(saved?.paceKgPerWeek || null);
  const [target, setTarget] = useState<string | null>(
    saved?.targetWeightKg ? String(Math.round(saved.units === "imperial" ? kgToLb(saved.targetWeightKg) : saved.targetWeightKg)) : null,
  );
  const [step, setStep] = useState<Step>("about");

  const heightCm = units === "metric" ? num(cm) : ftInToCm(num(ft) || 0, num(inch) || 0);
  const weightKg = units === "metric" ? num(weight) : lbToKg(num(weight));
  const ageN = num(age);
  const bodyValid = heightCm >= 120 && heightCm <= 230 && weightKg >= 35 && weightKg <= 300;

  const suggestedGoal = bodyValid ? recommendedGoal(weightKg, heightCm) : "maintain";
  const g = goal ?? suggestedGoal;
  const hasPace = g === "lose" || g === "gain";
  const p = pace ?? recommendedPace(g, weightKg);
  const suggestedTarget = bodyValid ? recommendedTarget(g, weightKg, heightCm) : null;
  const toDisplay = (kg: number) => String(Math.round(units === "imperial" ? kgToLb(kg) : kg));
  const targetStr = target ?? (suggestedTarget ? toDisplay(suggestedTarget) : "");
  const targetKg = hasPace && targetStr ? (units === "imperial" ? lbToKg(num(targetStr)) : num(targetStr)) : NaN;

  const steps: Step[] = ["about", "body", "activity", "goal", ...(hasPace ? (["pace"] as const) : []), "plan"];
  const index = steps.indexOf(step);

  const canContinue =
    step === "about" ? !!sex && ageN >= 18 && ageN <= 100
    : step === "body" ? bodyValid
    : step === "activity" ? !!activity
    : true;

  const profile: Profile | null =
    sex && activity && bodyValid
      ? {
          goal: g,
          sex,
          age: Math.round(ageN),
          heightCm,
          weightKg,
          activity,
          paceKgPerWeek: hasPace ? p : 0,
          targetWeightKg: Number.isFinite(targetKg) ? targetKg : null,
          units,
        }
      : null;

  const switchUnits = (next: Units) => {
    if (next === units) return;
    if (Number.isFinite(heightCm) && heightCm > 0) {
      const { ft: f, inches } = cmToFtIn(heightCm);
      setCm(String(Math.round(heightCm)));
      setFt(String(f));
      setInch(String(inches));
    }
    const convert = (s: string) => {
      const n = num(s);
      return Number.isFinite(n) ? String(Math.round(next === "imperial" ? kgToLb(n) : lbToKg(n))) : s;
    };
    setWeight(convert(weight));
    if (target) setTarget(convert(target));
    setUnits(next);
  };

  const chooseGoal = (next: GoalType) => {
    setGoal(next);
    setPace(null);
    setTarget(null);
  };

  const next = () => {
    if (step === "plan") {
      if (!profile) return;
      completeOnboarding(profile, calculatePlan(profile).goals);
      if (editing && router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }
    setStep(steps[index + 1]);
  };
  const back = () => (index > 0 ? setStep(steps[index - 1]) : editing && router.canGoBack() && router.back());

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          {index > 0 || editing ? (
            <Pressable onPress={back} hitSlop={10} style={styles.backBtn}>
              <Icon name={index === 0 ? "close" : "back"} size={22} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%` }]} />
          </View>
          <View style={styles.backBtn} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[screen.content, { paddingBottom: 140, paddingTop: 8 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === "about" && (
          <>
            <Header
              title={editing ? "Update your plan" : "Let's build your plan"}
              body="A few quick questions and we'll recommend daily calorie and macro targets for you."
            />
            <Label text="Units" />
            <Segment
              options={[
                { value: "imperial", label: "lb · ft" },
                { value: "metric", label: "kg · cm" },
              ]}
              value={units}
              onChange={switchUnits}
            />
            <Label text="Sex" hint="Used in the metabolism formula" />
            <Segment
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
              ]}
              value={sex}
              onChange={setSex}
            />
            <Label text="Age" />
            <Field value={age} onChange={(t) => setAge(t.replace(/[^0-9]/g, ""))} unit="years" placeholder="30" />
            {ageN > 0 && ageN < 18 && (
              <Note tone="warn" text="CalSnap's recommendations are designed for adults 18 and over. Teens have different energy needs, so please talk to a doctor or dietitian." />
            )}
          </>
        )}

        {step === "body" && (
          <>
            <Header title="Your height and weight" body="This lets us estimate how many calories your body uses each day." />
            <Label text="Height" />
            {units === "metric" ? (
              <Field value={cm} onChange={(t) => setCm(clean(t))} unit="cm" placeholder="170" />
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Field value={ft} onChange={(t) => setFt(t.replace(/[^0-9]/g, ""))} unit="ft" placeholder="5" style={{ flex: 1 }} />
                <Field value={inch} onChange={(t) => setInch(t.replace(/[^0-9]/g, ""))} unit="in" placeholder="8" style={{ flex: 1 }} />
              </View>
            )}
            <Label text="Current weight" />
            <Field value={weight} onChange={(t) => setWeight(clean(t))} unit={units === "imperial" ? "lb" : "kg"} placeholder={units === "imperial" ? "165" : "75"} />
            {bodyValid && <BmiCard weightKg={weightKg} heightCm={heightCm} units={units} />}
          </>
        )}

        {step === "activity" && (
          <>
            <Header title="How active are you?" body="Include your job and any exercise. If you're unsure, pick the lower one; you can change it later." />
            {ACTIVITY_OPTIONS.map((a) => (
              <Choice key={a.value} title={a.title} body={a.body} selected={activity === a.value} onPress={() => setActivity(a.value)} />
            ))}
          </>
        )}

        {step === "goal" && (
          <>
            <Header title="What's your goal?" body={goalReason(suggestedGoal, weightKg, heightCm)} />
            {GOAL_OPTIONS.map((o) => (
              <Choice
                key={o.value}
                title={o.title}
                body={o.body}
                selected={g === o.value}
                badge={o.value === suggestedGoal ? "Recommended" : undefined}
                onPress={() => chooseGoal(o.value)}
              />
            ))}
          </>
        )}

        {step === "pace" && profile && (
          <>
            <Header
              title={g === "lose" ? "How fast do you want to lose?" : "How fast do you want to gain?"}
              body={
                g === "lose"
                  ? "Losing 0.5–1% of your body weight a week protects muscle and is easier to keep off. Slower is more sustainable."
                  : "Gaining 0.25–0.5% of your body weight a week keeps most of the gain as lean mass rather than fat."
              }
            />
            {paceOptions(g, weightKg).map((o) => {
              const kcal = Math.round((o.kgPerWeek * 7700) / 7 / 10) * 10;
              return (
                <Choice
                  key={o.kgPerWeek}
                  title={`${o.title} · ${formatPace(o.kgPerWeek, units)}`}
                  body={`About ${kcal} kcal a day ${g === "lose" ? "below" : "above"} maintenance`}
                  selected={p === o.kgPerWeek}
                  badge={o.recommended ? "Recommended" : undefined}
                  onPress={() => setPace(o.kgPerWeek)}
                />
              );
            })}
            <Label text="Target weight" hint={suggestedTarget ? `Suggested: ${formatWeight(suggestedTarget, units)}` : undefined} />
            <Field value={targetStr} onChange={(t) => setTarget(clean(t))} unit={units === "imperial" ? "lb" : "kg"} />
            <TargetNote profile={profile} />
          </>
        )}

        {step === "plan" && profile && <PlanSummary profile={profile} />}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton
          label={step === "plan" ? (editing ? "Save plan" : "Start tracking") : "Continue"}
          onPress={next}
          disabled={!canContinue}
          style={styles.footerBtn}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function goalReason(suggested: GoalType, weightKg: number, heightCm: number): string {
  const b = bmi(weightKg, heightCm).toFixed(1);
  if (suggested === "lose") return `Your BMI is ${b}, above the healthy range, so we recommend losing weight. Pick whatever fits you.`;
  if (suggested === "gain") return `Your BMI is ${b}, below the healthy range, so we recommend gaining weight. Pick whatever fits you.`;
  return `Your BMI is ${b}, in the healthy range. Maintaining is a great default, or build muscle if you strength train.`;
}

function BmiCard({ weightKg, heightCm, units }: { weightKg: number; heightCm: number; units: Units }) {
  const value = bmi(weightKg, heightCm);
  const cat = bmiCategory(value);
  const range = healthyWeightRange(heightCm);
  // Scale: BMI 15 → 40
  const pos = Math.max(0, Math.min(1, (value - 15) / 25));
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={styles.cardLabel}>BMI</Text>
        <Text style={[styles.cardLabel, { color: cat.tone === "ok" ? colors.success : colors.carbs }]}>{cat.label}</Text>
      </View>
      <Text style={styles.bmiValue}>{value.toFixed(1)}</Text>
      <View style={styles.scale}>
        <View style={[styles.scaleSeg, { flex: 3.5, backgroundColor: colors.fat }]} />
        <View style={[styles.scaleSeg, { flex: 6.5, backgroundColor: colors.success }]} />
        <View style={[styles.scaleSeg, { flex: 5, backgroundColor: colors.muted }]} />
        <View style={[styles.scaleSeg, { flex: 10, backgroundColor: colors.text }]} />
        <View style={[styles.marker, { left: `${pos * 100}%` }]} />
      </View>
      <Text style={styles.cardBody}>
        A healthy weight for your height is {formatWeight(range.min, units)}–{formatWeight(range.max, units)} (BMI 18.5–24.9).
        BMI doesn&apos;t account for muscle, so treat it as a rough guide.
      </Text>
    </View>
  );
}

function TargetNote({ profile }: { profile: Profile }) {
  const weeks = weeksToTarget(profile);
  const t = profile.targetWeightKg;
  if (!t || !weeks) return null;
  const wrongWay = profile.goal === "lose" ? t >= profile.weightKg : t <= profile.weightKg;
  if (wrongWay) return <Note tone="warn" text={`Your target should be ${profile.goal === "lose" ? "below" : "above"} your current weight.`} />;
  const date = weeksFromNow(weeks);
  const range = healthyWeightRange(profile.heightCm);
  return (
    <>
      <Note tone="ok" text={`At this pace you'd reach ${formatWeight(t, profile.units)} in about ${weeks} weeks (${date}).`} />
      {t < range.min && <Note tone="warn" text="That target is below a healthy weight for your height. Consider a higher target." />}
    </>
  );
}

function PlanSummary({ profile }: { profile: Profile }) {
  const { goals, maintenance, flooredAt } = calculatePlan(profile);
  const rest = Math.round(bmr(profile) / 10) * 10;
  const activity = ACTIVITY_OPTIONS.find((a) => a.value === profile.activity)!;
  const diff = goals.calories - maintenance;
  const perKg = (goals.protein / profile.weightKg).toFixed(1);
  const pct = (profile.paceKgPerWeek / profile.weightKg) * 100;

  const reasons: string[] = [
    `Your body uses about ${maintenance.toLocaleString()} kcal a day: ${rest.toLocaleString()} at rest, scaled up for being ${activity.title.toLowerCase()}.`,
  ];
  if (profile.goal === "lose")
    reasons.push(`Eating ${Math.abs(diff)} kcal less loses about ${formatPace(profile.paceKgPerWeek, profile.units)} (${pct.toFixed(1)}% of your weight), inside the 0.5–1% a week range that best protects muscle.`);
  if (profile.goal === "gain")
    reasons.push(`Eating ${diff} kcal more adds about ${formatPace(profile.paceKgPerWeek, profile.units)}, a pace that keeps most of the gain lean.`);
  if (profile.goal === "muscle")
    reasons.push(`A small 10% surplus (+${diff} kcal) fuels muscle growth while limiting fat gain. Pair it with strength training 3+ days a week.`);
  if (profile.goal === "maintain") reasons.push("Eating around maintenance keeps your weight steady.");
  if (flooredAt)
    reasons.push(`We kept you at ${flooredAt.toLocaleString()} kcal, the lowest recommended without medical supervision, so progress may be a little slower.`);
  reasons.push(
    `${goals.protein} g of protein (${perKg} g per kg) helps you ${profile.goal === "muscle" || profile.goal === "gain" ? "build" : "keep"} muscle and stay full.`,
    `Fat is set to ${Math.round(((goals.fat * 9) / goals.calories) * 100)}% of calories and carbs fill the rest, both within dietary guidelines.`,
  );

  return (
    <>
      <Header title="Your daily plan" body={`${GOAL_TITLE[profile.goal]}${profile.paceKgPerWeek ? ` · ${formatPace(profile.paceKgPerWeek, profile.units)}` : ""}`} />
      <View style={[styles.card, { alignItems: "center", gap: 2 }]}>
        <Icon name="flame" size={28} color={colors.accent} />
        <Text style={font.hero}>
          <Text style={{ color: colors.text }}>{goals.calories.toLocaleString()}</Text>
        </Text>
        <Text style={styles.cardLabel}>calories a day</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {(["protein", "carbs", "fat"] as const).map((k) => (
          <View key={k} style={styles.macroTile}>
            <View style={[styles.macroBar, { backgroundColor: macroMeta[k].color }]} />
            <Text style={styles.cardLabel}>{macroMeta[k].label}</Text>
            <Text style={styles.macroValue}>{goals[k]}g</Text>
          </View>
        ))}
      </View>
      <Text style={styles.label}>Why these numbers</Text>
      <View style={[styles.card, { gap: 12 }]}>
        {reasons.map((r) => (
          <View key={r} style={{ flexDirection: "row", gap: 10 }}>
            <Icon name="check" size={16} color={colors.success} strokeWidth={3} />
            <Text style={[styles.cardBody, { flex: 1 }]}>{r}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.fine}>
        Based on the Mifflin-St Jeor equation and CDC, ISSN, Institute of Medicine and WHO guidelines. It&apos;s an estimate, not
        medical advice: check with a doctor if you&apos;re pregnant, breastfeeding or have a health condition. You can change your
        targets any time in Settings.
      </Text>
    </>
  );
}

// ---------- Small pieces ----------

function Header({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 8, marginBottom: 4 }}>
      <Text style={font.h1}>
        <Text style={{ color: colors.text }}>{title}</Text>
      </Text>
      <Text style={styles.headerBody}>{body}</Text>
    </View>
  );
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
      <Text style={styles.label}>{text}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

function Segment<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segBtn, value === o.value && styles.segOn]}>
          <Text style={[styles.segText, value === o.value && { color: colors.bg }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Field({ value, onChange, unit, placeholder, style }: {
  value: string;
  onChange: (t: string) => void;
  unit: string;
  placeholder?: string;
  style?: object;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused, style]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType="decimal-pad"
        style={[styles.fieldInput, noFocusRing]}
        maxLength={5}
      />
      <Text style={styles.fieldUnit}>{unit}</Text>
    </View>
  );
}

function Note({ text, tone }: { text: string; tone: "ok" | "warn" }) {
  const c = tone === "ok" ? colors.success : colors.carbs;
  return (
    <View style={[styles.note, { backgroundColor: c + "18", borderColor: c + "44" }]}>
      <Text style={[styles.cardBody, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: 20 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%", maxWidth: 560, alignSelf: "center", paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  progress: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  headerBody: { ...font.body, color: colors.muted, lineHeight: 21 },
  label: { ...font.label, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  hint: { ...font.caption, color: colors.faint },
  segment: { flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.lg, padding: 4, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: "center" },
  segOn: { backgroundColor: colors.text },
  segText: { color: colors.text, fontWeight: "700", fontSize: 15 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    gap: 12,
  },
  // The whole field lights up on focus; the browser's own outline would otherwise run into the unit label.
  fieldFocused: { borderColor: colors.accent },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    paddingVertical: 14,
    minWidth: 0,
  },
  fieldUnit: { ...font.body, color: colors.muted, minWidth: 24, textAlign: "right" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardLabel: { ...font.label, color: colors.muted },
  cardBody: { ...font.label, color: colors.muted, fontWeight: "500", lineHeight: 19 },
  bmiValue: { color: colors.text, fontSize: 34, fontWeight: "800" },
  scale: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "visible", gap: 2, marginVertical: 6 },
  scaleSeg: { height: 8, borderRadius: 4 },
  marker: { position: "absolute", top: -4, width: 4, height: 16, marginLeft: -2, borderRadius: 2, backgroundColor: colors.text },
  macroTile: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 6 },
  macroBar: { width: 22, height: 4, borderRadius: 2 },
  macroValue: { color: colors.text, fontSize: 22, fontWeight: "800" },
  note: { borderRadius: radius.md, padding: 14, borderWidth: 1 },
  fine: { ...font.caption, color: colors.faint, lineHeight: 17 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.scrim, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  footerBtn: { width: "100%", maxWidth: 520, alignSelf: "center" },
});
