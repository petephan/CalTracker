import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { AnalysisError, analyzeFood, defaultServerUrl } from "../lib/api";
import { dayKey, formatTime, keyToDate, mealTypeFor } from "../lib/date";
import { newMealId } from "../lib/meals";
import { pendingPhoto, persistPhoto } from "../lib/photo";
import { computeStreak, goalStatus, sumMacros, useStore } from "../lib/store";
import { colors, font, macroMeta, radius, serif, shadow, tint } from "../lib/theme";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import type { Analysis, Meal, MealType } from "../lib/types";

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; data: Analysis };

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const GOAL_LABELS = { calories: "Calorie goal", protein: "Protein goal", carbs: "Carbs goal", fat: "Fat goal" } as const;

export default function Result() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Keep the photo from pushing the nutrition off-screen on short windows (laptops, landscape).
  const heroHeight = Math.min(380, Math.max(200, windowHeight * 0.35));
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const { serverUrl, meals, goals, addMeal } = useStore();
  const photo = pendingPhoto.get();
  const [state, setState] = useState<State>(photo ? { kind: "loading" } : { kind: "error", message: "No photo to analyze." });
  const [servings, setServings] = useState(1);
  const [mealType, setMealType] = useState<MealType>(mealTypeFor());
  const [celebration, setCelebration] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    analyzeFood(serverUrl ?? defaultServerUrl(), photo.base64).then(
      (data) => {
        if (cancelled) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setState({ kind: "done", data });
      },
      (e) => {
        if (cancelled) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setState({ kind: "error", message: e instanceof AnalysisError ? e.message : "Something went wrong." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [photo, serverUrl, attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  const retake = () => router.replace(dayParam ? { pathname: "/scan", params: { day: dayParam } } : "/scan");
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const log = async (data: Analysis) => {
    if (saving) return;
    setSaving(true);
    const id = newMealId();
    const today = dayKey();
    // Logging for a past day (from the day screen) keeps today's time of day on that date.
    const day = dayParam && dayParam <= today ? dayParam : today;
    const when = new Date();
    if (day !== today) {
      const d = keyToDate(day);
      when.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const meal: Meal = {
      id,
      name: data.name,
      mealType,
      photoUri: photo ? await persistPhoto(photo, id) : null,
      items: data.items,
      servings,
      calories: Math.round(data.calories * servings),
      protein: Math.round(data.protein * servings),
      carbs: Math.round(data.carbs * servings),
      fat: Math.round(data.fat * servings),
      createdAt: when.getTime(),
      loggedAt: Date.now(),
      day,
    };

    // Work out what this meal unlocked, for the reward moment.
    const todays = meals.filter((m) => m.day === day);
    const before = goalStatus(sumMacros(todays), goals);
    const after = goalStatus(sumMacros([...todays, meal]), goals);
    const wins: string[] = (Object.keys(after) as (keyof typeof after)[])
      .filter((k) => after[k] && !before[k])
      .map((k) => `${GOAL_LABELS[k]} hit`);
    if (day === today && todays.length === 0) wins.unshift(`${computeStreak(meals).current + 1}-day streak`);

    addMeal(meal);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (wins.length) {
      setCelebration(wins);
      setTimeout(close, 1900);
    } else {
      close();
    }
  };

  return (
    <View style={styles.root}>
      {state.kind === "loading" && <Analyzing uri={photo?.uri} />}

      {state.kind === "error" && (
        <View style={[styles.center, { padding: 32 }]}>
          {photo && <Image source={{ uri: photo.uri }} style={styles.errorThumb} />}
          <Text style={styles.errorTitle}>Analysis failed</Text>
          <Text style={styles.errorBody}>{state.message}</Text>
          <View style={styles.row}>
            <SecondaryButton label="Retake" onPress={retake} />
            <PrimaryButton label="Try again" onPress={retry} />
          </View>
        </View>
      )}

      {state.kind === "done" && !state.data.is_food && (
        <View style={[styles.center, { padding: 32 }]}>
          {photo && <Image source={{ uri: photo.uri }} style={styles.errorThumb} />}
          <Text style={styles.errorTitle}>No food detected</Text>
          <Text style={styles.errorBody}>Try again with the meal centered in the frame.</Text>
          <PrimaryButton label="Retake photo" onPress={retake} />
        </View>
      )}

      {state.kind === "done" && state.data.is_food && (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
            {photo && <Image source={{ uri: photo.uri }} style={[styles.hero, { height: heroHeight }]} />}
            <View style={styles.sheet}>
              <Details data={state.data} servings={servings} setServings={setServings} mealType={mealType} setMealType={setMealType} />
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.footerInner}>
              <SecondaryButton label="Retake" onPress={retake} />
              <PrimaryButton label={saving ? "Saving…" : "Log meal"} onPress={() => log(state.data)} style={{ flex: 1 }} />
            </View>
          </View>
        </>
      )}

      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={close} style={styles.roundBtn} hitSlop={10} accessibilityLabel="Close">
          <Icon name="close" size={20} color="#fff" />
        </Pressable>
        {state.kind === "done" && state.data.is_food && <Text style={styles.topTitle}>Nutrition</Text>}
        <View style={{ width: 40 }} />
      </View>

      {celebration && <Celebration wins={celebration} />}
    </View>
  );
}

function Details({ data, servings, setServings, mealType, setMealType }: {
  data: Analysis;
  servings: number;
  setServings: (n: number) => void;
  mealType: MealType;
  setMealType: (m: MealType) => void;
}) {
  const s = (n: number) => Math.round(n * servings);
  const [analyzedAt] = useState(() => Date.now());
  return (
    <View style={styles.details}>
      <View style={styles.metaRow}>
        <Icon name="sparkle" size={13} color={colors.muted} />
        <Text style={styles.metaText}>{formatTime(analyzedAt)}</Text>
        <Pill text={`${data.confidence} confidence`} color={data.confidence === "high" ? colors.success : data.confidence === "medium" ? colors.carbs : colors.danger} />
        <Pill text={`Health ${Math.round(data.health_score)}/10`} color={colors.text} />
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.name}>{data.name}</Text>
        <View style={styles.stepper}>
          <Pressable onPress={() => setServings(Math.max(0.5, servings - 0.5))} hitSlop={8} style={styles.stepBtn} accessibilityLabel="Fewer servings">
            <Icon name="minus" size={16} />
          </Pressable>
          <Text style={styles.stepValue}>{servings}</Text>
          <Pressable onPress={() => setServings(Math.min(5, servings + 0.5))} hitSlop={8} style={styles.stepBtn} accessibilityLabel="More servings">
            <Icon name="plus" size={16} />
          </Pressable>
        </View>
      </View>

      <View style={styles.kcalCard}>
        <View style={styles.kcalIcon}>
          <Icon name="flame" size={24} color={colors.text} />
        </View>
        <View>
          <Text style={styles.kcalLabel}>Calories</Text>
          <Text style={styles.kcalValue}>{s(data.calories)}</Text>
        </View>
      </View>

      <View style={styles.row}>
        {(["protein", "carbs", "fat"] as const).map((k) => (
          <View key={k} style={styles.macroTile}>
            <View style={styles.macroHead}>
              <Icon name={macroMeta[k].icon} size={14} color={macroMeta[k].color} strokeWidth={2.4} />
              <Text style={styles.macroLabel}>{macroMeta[k].label}</Text>
            </View>
            <Text style={styles.macroValue}>{s(data[k])}g</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>Meal</Text>
      <View style={styles.chips}>
        {MEAL_TYPES.map((m) => (
          <Pressable key={m} onPress={() => setMealType(m)} style={[styles.chip, mealType === m && styles.chipOn]}>
            <Text style={[styles.chipText, mealType === m && { color: colors.onPrimary }]}>{m[0].toUpperCase() + m.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      {data.items.length > 0 && (
        <>
          <Text style={styles.section}>Ingredients</Text>
          <View style={{ gap: 8 }}>
            {data.items.map((it, i) => (
              <View key={i} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>
                    {it.name} <Text style={styles.itemKcal}>· {s(it.calories)} cal</Text>
                  </Text>
                  <Text style={styles.itemSub}>
                    P {s(it.protein)}g · C {s(it.carbs)}g · F {s(it.fat)}g
                  </Text>
                </View>
                <Text style={styles.itemPortion}>{it.portion}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {!!data.note && (
        <View style={styles.note}>
          <Icon name="sparkle" size={14} color={colors.muted} />
          <Text style={styles.noteText}>{data.note}</Text>
        </View>
      )}
    </View>
  );
}

const STEPS = ["Identifying foods…", "Estimating portions…", "Calculating macros…"];

function Analyzing({ uri }: { uri?: string }) {
  const [scan] = useState(() => new Animated.Value(0));
  const [step, setStep] = useState(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2500);
    return () => {
      loop.stop();
      clearInterval(t);
    };
  }, [scan]);

  return (
    <View style={styles.center}>
      <View style={styles.scanBox}>
        {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.25)" }]} />
        <Animated.View
          style={[styles.scanLine, { transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [0, 296] }) }] }]}
        >
          <LinearGradient colors={["transparent", "rgba(255,107,61,0.55)"]} style={{ height: 40 }} />
          <View style={{ height: 3, backgroundColor: colors.accent }} />
        </Animated.View>
      </View>
      <Text style={styles.analyzingTitle}>{STEPS[step]}</Text>
      <Text style={styles.analyzingSub}>Hang tight — this takes a few seconds</Text>
    </View>
  );
}

function Celebration({ wins }: { wins: string[] }) {
  const [scale] = useState(() => new Animated.Value(0.6));
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [scale]);
  return (
    <View style={[StyleSheet.absoluteFill, styles.celebrateWrap]}>
      <Animated.View style={[styles.celebrate, { transform: [{ scale }] }]}>
        <View style={styles.celebrateIcon}>
          <Icon name="bolt" size={34} color={colors.flame} />
        </View>
        <Text style={styles.celebrateTitle}>Nice work!</Text>
        {wins.map((w) => (
          <View key={w} style={styles.winRow}>
            <Icon name="check" size={16} color={colors.success} strokeWidth={3} />
            <Text style={styles.winText}>{w}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: tint(color, 0.12) }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  row: { flexDirection: "row", gap: 10 },
  topBar: { position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topTitle: { color: "#fff", fontSize: 16, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 6 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", height: 380, backgroundColor: colors.cardHi },
  sheet: { marginTop: -24, backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: 22 },
  details: { paddingHorizontal: 20, gap: 14, width: "100%", maxWidth: 560, alignSelf: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText: { ...font.caption, color: colors.muted, marginRight: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { ...font.h2, fontSize: 24, color: colors.text, flex: 1 },
  stepper: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: 3, gap: 2 },
  stepBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  stepValue: { color: colors.text, fontWeight: "700", fontSize: 15, minWidth: 28, textAlign: "center" },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  pillText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  kcalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    ...shadow,
  },
  kcalIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center" },
  kcalLabel: { ...font.label, color: colors.muted },
  kcalValue: { ...serif, color: colors.text, fontSize: 34 },
  macroTile: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, gap: 6, ...shadow },
  macroHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  macroLabel: { ...font.caption, color: colors.muted },
  macroValue: { ...serif, color: colors.text, fontSize: 19 },
  section: { ...font.h2, fontSize: 17, color: colors.text, marginTop: 6 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.cardHi },
  chipOn: { backgroundColor: colors.text },
  chipText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.cardHi, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  itemName: { ...font.body, color: colors.text, fontWeight: "600" },
  itemKcal: { ...font.label, color: colors.muted, fontWeight: "500" },
  itemSub: { ...font.caption, color: colors.muted, marginTop: 2 },
  itemPortion: { ...font.label, color: colors.muted },
  note: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingHorizontal: 4 },
  noteText: { ...font.caption, color: colors.muted, flex: 1, lineHeight: 17 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerInner: { flexDirection: "row", gap: 10, width: "100%", maxWidth: 520, alignSelf: "center" },
  scanBox: { width: 300, height: 340, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.cardHi },
  scanLine: { position: "absolute", left: 0, right: 0, top: -40 },
  analyzingTitle: { ...font.h2, color: colors.text, marginTop: 12 },
  analyzingSub: { ...font.label, color: colors.muted },
  errorThumb: { width: 140, height: 140, borderRadius: radius.lg, opacity: 0.8 },
  errorTitle: { ...font.h2, color: colors.text },
  errorBody: { ...font.body, color: colors.muted, textAlign: "center", marginBottom: 8 },
  celebrateWrap: { backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center" },
  celebrate: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 28, alignItems: "center", gap: 10, minWidth: 260, ...shadow },
  celebrateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    backgroundColor: tint(colors.flame, 0.14),
  },
  celebrateTitle: { ...font.h1, color: colors.text, marginBottom: 4 },
  winRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  winText: { ...font.body, color: colors.text, fontWeight: "600" },
});
