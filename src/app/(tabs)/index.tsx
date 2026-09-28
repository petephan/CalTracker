import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "../../components/Icon";
import { Logo } from "../../components/Logo";
import { MacroCard } from "../../components/MacroCard";
import { MealRow } from "../../components/MealRow";
import { MonthCalendar } from "../../components/MonthCalendar";
import { LogWeightModal, WeightRow } from "../../components/WeightCard";
import { Ring } from "../../components/Ring";
import { addDays, dayKey, greeting, keyToDate, relativeDayLabel } from "../../lib/date";
import { ensurePermission } from "../../lib/notifications";
import { confirmDeleteMeal, openDay, openMeal } from "../../lib/meals";
import { formatPace, GOAL_TITLE } from "../../lib/plan";
import { computeStreak, goalStatus, mealsByDay, nextMilestone, sumMacros, useStore } from "../../lib/store";
import { colors, font, radius, shadow, tint } from "../../lib/theme";
import { screen } from "../../lib/layout";

export default function Home() {
  const insets = useSafeAreaInsets();
  const { meals, goals, loaded, deleteMeal, profile, weights } = useStore();
  const today = dayKey();
  const [day, setDay] = useState(today);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [weighing, setWeighing] = useState(false);
  const isToday = day === today;

  /** Step one day back or forward. Never goes past today. */
  const shiftDay = (n: number) => {
    const next = addDays(day, n);
    if (next <= today) setDay(next);
  };
  const jumpTo = (d: string) => {
    setDay(d);
    setPickerOpen(false);
  };
  const addMeal = (how: "scan" | "manual") =>
    how === "scan"
      ? router.push(isToday ? "/scan" : { pathname: "/scan", params: { day } })
      : router.push({ pathname: "/meal/[id]", params: { id: "new", day } });

  useEffect(() => {
    if (loaded) ensurePermission().catch(() => {});
  }, [loaded]);

  const byDay = useMemo(() => mealsByDay(meals), [meals]);
  const dayMeals = byDay.get(day) ?? [];
  const dayWeight = weights.find((w) => w.day === day);
  // Meals and the day's weigh-in, newest entry first.
  const entries = [
    ...dayMeals.map((m) => ({ key: m.id, at: m.loggedAt ?? m.createdAt, meal: m })),
    ...(dayWeight ? [{ key: `w${dayWeight.day}`, at: dayWeight.loggedAt ?? 0, meal: null }] : []),
  ].sort((a, b) => b.at - a.at);
  const totals = sumMacros(dayMeals);
  const caloriesByDay = useMemo(
    () => new Map([...byDay].map(([d, list]) => [d, sumMacros(list).calories])),
    [byDay],
  );
  const streak = useMemo(() => computeStreak(meals), [meals]);
  const hit = goalStatus(totals, goals);

  const left = Math.round(goals.calories - totals.calories);
  const over = left < 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[screen.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 136 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Logo size={28} />
        <View style={styles.streakChip}>
          <Icon name="flame" size={16} color={streak.current > 0 ? colors.flame : colors.faint} />
          <Text style={styles.streakNum}>{streak.current}</Text>
        </View>
      </View>
      {profile && (
        <Text style={styles.greeting}>
          {greeting()} · {GOAL_TITLE[profile.goal]}
          {profile.paceKgPerWeek ? ` ${formatPace(profile.paceKgPerWeek, profile.units)}` : ""}
        </Text>
      )}

      <View style={styles.dayNav}>
        <Pressable onPress={() => shiftDay(-1)} hitSlop={8} style={styles.navBtn} accessibilityLabel="Previous day">
          <Icon name="back" size={18} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setPickerOpen(true)} style={styles.dayLabel} accessibilityLabel="Pick a date">
          <Text style={styles.dayTitle}>{isToday ? "Today" : relativeDayLabel(day).split(",")[0]}</Text>
          <View style={styles.daySubRow}>
            <Icon name="calendar" size={13} color={colors.muted} />
            <Text style={styles.daySub}>
              {keyToDate(day).toLocaleDateString([], { weekday: isToday ? "long" : undefined, month: "long", day: "numeric" })}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => shiftDay(1)}
          hitSlop={8}
          style={[styles.navBtn, isToday && { opacity: 0.3 }]}
          disabled={isToday}
          accessibilityLabel="Next day"
        >
          <Icon name="chevron" size={18} color={colors.text} />
        </Pressable>
      </View>
      {!isToday && (
        <Pressable onPress={() => jumpTo(today)} style={styles.todayBtn}>
          <Text style={styles.todayText}>Back to today</Text>
        </Pressable>
      )}

      <View style={styles.hero}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.heroValue}>
            {Math.round(totals.calories).toLocaleString()}
            <Text style={styles.heroGoal}>/{goals.calories.toLocaleString()}</Text>
          </Text>
          <Text style={styles.heroLabel}>Calories eaten</Text>
          <View style={[styles.leftPill, over && { backgroundColor: tint(colors.danger, 0.1) }, hit.calories && { backgroundColor: tint(colors.success, 0.1) }]}>
            {hit.calories && <Icon name="check" size={13} color={colors.success} strokeWidth={3} />}
            <Text style={[styles.leftText, over && { color: colors.danger }, hit.calories && { color: colors.success }]}>
              {hit.calories ? "On target" : over ? `${Math.abs(left).toLocaleString()} over` : `${left.toLocaleString()} left`}
            </Text>
          </View>
        </View>
        <Ring size={112} stroke={9} progress={totals.calories / goals.calories} colors={[over ? colors.text : colors.teal]}>
          <Icon name="flame" size={28} color={colors.teal} />
        </Ring>
      </View>

      <View style={styles.macroRow}>
        <MacroCard macro="protein" value={totals.protein} goal={goals.protein} />
        <MacroCard macro="carbs" value={totals.carbs} goal={goals.carbs} />
        <MacroCard macro="fat" value={totals.fat} goal={goals.fat} />
      </View>

      {streak.current > 0 && isToday && <StreakCard streak={streak.current} loggedToday={streak.loggedToday} />}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{isToday ? "Recently logged" : relativeDayLabel(day)}</Text>
        <Pressable onPress={() => openDay(day)} hitSlop={8}>
          <Text style={styles.link}>Day details</Text>
        </Pressable>
      </View>
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="camera" size={28} color={colors.muted} />
          <Text style={styles.emptyTitle}>{isToday ? "Nothing logged yet" : "Nothing logged this day"}</Text>
          <Text style={styles.emptyBody}>
            {isToday
              ? "Snap your next meal or log your weight to get started."
              : "Missed logging? Add a meal or weigh-in below and it'll count toward this day."}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {entries.map((e) =>
            e.meal ? (
              <MealRow key={e.key} meal={e.meal} onPress={() => openMeal(e.meal)} onDelete={() => confirmDeleteMeal(e.meal, deleteMeal)} />
            ) : (
              dayWeight && <WeightRow key={e.key} entry={dayWeight} onPress={() => setWeighing(true)} />
            ),
          )}
        </View>
      )}
      <View style={styles.addRow}>
        <AddButton icon="camera" label="Scan meal" onPress={() => addMeal("scan")} />
        <AddButton icon="edit" label="Add manually" onPress={() => addMeal("manual")} />
        <AddButton icon="scale" label={dayWeight ? "Edit weight" : "Log weight"} onPress={() => setWeighing(true)} />
      </View>
      {entries.length > 0 && <Text style={styles.hint}>Tap an entry to view or edit it</Text>}
      {weighing && <LogWeightModal visible initialDay={day} onClose={() => setWeighing(false)} />}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.picker} onPress={() => {}}>
            <PickerCalendar selected={day} onSelect={jumpTo} caloriesByDay={caloriesByDay} goal={goals.calories} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function AddButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={20} color={colors.teal} />
      <Text style={styles.addText}>{label}</Text>
    </Pressable>
  );
}

/** Month calendar in the date picker; opens on the selected day's month. */
function PickerCalendar(props: { selected: string; onSelect: (d: string) => void; caloriesByDay: Map<string, number>; goal: number }) {
  const [month, setMonth] = useState(() => keyToDate(props.selected));
  return <MonthCalendar month={month} onChangeMonth={setMonth} {...props} />;
}

function StreakCard({ streak, loggedToday }: { streak: number; loggedToday: boolean }) {
  const target = nextMilestone(streak);
  return (
    <View style={styles.streakCard}>
      <View style={styles.streakIcon}>
        <Icon name="flame" size={26} color={colors.flame} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.streakTitle}>
          {streak}-day streak{loggedToday ? "" : " · log today to keep it"}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(streak / target) * 100}%` }]} />
        </View>
        <Text style={styles.streakSub}>{target - streak} more {target - streak === 1 ? "day" : "days"} to your {target}-day badge</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { ...font.label, color: colors.muted, marginTop: -10 },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    ...shadow,
  },
  streakNum: { color: colors.text, fontSize: 15, fontWeight: "800" },
  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadow,
  },
  heroValue: { ...font.hero, color: colors.text },
  heroGoal: { color: colors.muted, fontSize: 18, letterSpacing: 0 },
  heroLabel: { ...font.body, color: colors.muted },
  leftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: colors.cardHi,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  leftText: { ...font.caption, color: colors.text, fontWeight: "700" },
  macroRow: { flexDirection: "row", gap: 10 },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow,
  },
  streakIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tint(colors.flame, 0.12),
    alignItems: "center",
    justifyContent: "center",
  },
  streakTitle: { ...font.body, color: colors.text, fontWeight: "700" },
  streakSub: { ...font.caption, color: colors.muted },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.cardHi, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.flame },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  sectionTitle: { ...font.h2, color: colors.text },
  link: { ...font.label, color: colors.teal },
  empty: {
    alignItems: "center",
    gap: 8,
    padding: 28,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    ...shadow,
  },
  emptyTitle: { ...font.body, color: colors.text, fontWeight: "700" },
  emptyBody: { ...font.label, color: colors.muted, textAlign: "center", lineHeight: 19 },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, ...shadow },
  dayNav: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayLabel: { flex: 1, alignItems: "center", gap: 2 },
  dayTitle: { ...font.h2, color: colors.text },
  daySubRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  daySub: { ...font.label, color: colors.muted },
  todayBtn: { alignSelf: "center", paddingHorizontal: 14, height: 30, borderRadius: radius.sm, justifyContent: "center", backgroundColor: colors.teal, marginTop: -8 },
  todayText: { ...font.label, color: colors.onPrimary },
  addRow: { flexDirection: "row", gap: 10 },
  addBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    ...shadow,
  },
  addText: { ...font.label, color: colors.text },
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: 20 },
  picker: { width: "100%", maxWidth: 420, backgroundColor: colors.card, borderRadius: radius.xl, padding: 18 },
  hint: { ...font.caption, color: colors.faint, textAlign: "center", marginTop: 4 },
});
