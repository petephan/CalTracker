import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import { MealRow } from "../../components/MealRow";
import { LogWeightModal, WeightCard, WeightRow } from "../../components/WeightCard";
import { dayStatus, MonthCalendar, STATUS_COLORS } from "../../components/MonthCalendar";
import { dayKey, keyToDate, relativeDayLabel } from "../../lib/date";
import { confirmDeleteMeal, openDay, openMeal } from "../../lib/meals";
import { computeStreak, goalStatus, mealsByDay, STREAK_MILESTONES, sumMacros, useStore } from "../../lib/store";
import { colors, font, macroMeta, radius, serif, shadow, tint } from "../../lib/theme";
import { screen } from "../../lib/layout";
import type { Goals, Macros, Meal, WeightEntry } from "../../lib/types";

/** "Today" → "today" so relative labels read naturally mid-sentence; dates are left as-is. */
const inSentence = (label: string) => (label === "Today" || label === "Yesterday" ? label.toLowerCase() : label);

/** Sunday → Saturday of the current week. */
function thisWeek(): string[] {
  const now = new Date();
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i)));
}

/** Every day of `month` up to today, oldest first. */
function daysOfMonth(month: Date): string[] {
  const today = dayKey();
  const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1))).filter(
    (d) => d <= today,
  );
}

export default function Progress() {
  const insets = useSafeAreaInsets();
  const { meals, goals, deleteMeal, weights } = useStore();
  const [editingWeight, setEditingWeight] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(dayKey());

  const byDay = useMemo(() => mealsByDay(meals), [meals]);
  const caloriesByDay = useMemo(
    () => new Map([...byDay].map(([d, list]) => [d, sumMacros(list).calories])),
    [byDay],
  );
  const streak = useMemo(() => computeStreak(meals), [meals]);
  const days = daysOfMonth(month);
  const monthName = month.toLocaleDateString([], { month: "long" });

  const changeMonth = (next: Date) => {
    setMonth(next);
    const inMonth = daysOfMonth(next);
    setSelected(inMonth[inMonth.length - 1] ?? dayKey(next));
  };
  const totals = days.map((d) => sumMacros(byDay.get(d) ?? []));
  const logged = totals.filter((t) => t.calories > 0);
  const avg = (k: keyof (typeof totals)[number]) =>
    logged.length ? Math.round(logged.reduce((s, t) => s + t[k], 0) / logged.length) : 0;
  const daysHit = totals.filter((t) => goalStatus(t, goals).calories).length;
  // History is ordered by when things were entered, so back-filled meals and weigh-ins show up at the top when added.
  const history = useMemo(() => {
    type Item = { at: number; meal?: Meal; weight?: WeightEntry };
    const items: Item[] = [
      ...meals.map((m) => ({ at: m.loggedAt ?? m.createdAt, meal: m })),
      // Weigh-ins from before entry times were recorded fall back to noon on their day.
      ...weights.map((w) => ({ at: w.loggedAt ?? keyToDate(w.day).getTime() + 12 * 3600_000, weight: w })),
    ];
    const recent = items.sort((a, b) => b.at - a.at).slice(0, 40);
    const groups = new Map<string, Item[]>();
    for (const it of recent) {
      const k = dayKey(new Date(it.at));
      groups.set(k, [...(groups.get(k) ?? []), it]);
    }
    return [...groups];
  }, [meals, weights]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[screen.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 136 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Progress</Text>

      <View style={styles.streakCard}>
        <View style={styles.streakTop}>
          <View style={styles.flameWrap}>
            <Icon name="flame" size={64} color={streak.current > 0 ? colors.flame : colors.faint} />
            <Text style={styles.flameNum}>{streak.current}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.streakLabel}>Day streak</Text>
            <Text style={styles.best}>Best: {streak.best} days</Text>
          </View>
        </View>
        <View style={styles.weekDots}>
          {thisWeek().map((d) => {
            const logged = byDay.has(d);
            return (
              <View key={d} style={styles.weekDot}>
                <Text style={styles.weekDotLabel}>{keyToDate(d).toLocaleDateString([], { weekday: "narrow" })}</Text>
                <View style={[styles.dot, logged && styles.dotOn]}>
                  {logged && <Icon name="check" size={10} color={colors.onPrimary} strokeWidth={3.5} />}
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.badges}>
          {STREAK_MILESTONES.slice(0, 6).map((m) => {
            const earned = streak.best >= m;
            return (
              <View key={m} style={[styles.badge, earned && styles.badgeOn]}>
                <Icon name="flame" size={13} color={earned ? colors.flame : colors.faint} />
                <Text style={[styles.badgeText, earned && { color: colors.text }]}>{m}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <MonthCalendar
          month={month}
          onChangeMonth={changeMonth}
          selected={selected}
          onSelect={setSelected}
          caloriesByDay={caloriesByDay}
          goal={goals.calories}
        />
        <View style={styles.divider} />
        <DayPreview day={selected} meals={byDay.get(selected) ?? []} goals={goals} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{monthName} at a glance</Text>
        <View style={styles.statRow}>
          <Stat value={avg("calories").toLocaleString()} label="Avg kcal / day" />
          <Stat value={`${daysHit}/${days.length}`} label="Days on target" />
          <Stat value={String(logged.length)} label="Days logged" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Average macros · {monthName}</Text>
        {(["protein", "carbs", "fat"] as const).map((k) => {
          const v = avg(k);
          const pct = goals[k] ? Math.min(v / goals[k], 1) : 0;
          return (
            <View key={k} style={{ gap: 6 }}>
              <View style={styles.macroHead}>
                <Text style={styles.macroName}>{macroMeta[k].label}</Text>
                <Text style={styles.macroNums}>
                  {v}g <Text style={{ color: colors.muted }}>/ {goals[k]}g</Text>
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: macroMeta[k].color }]} />
              </View>
            </View>
          );
        })}
      </View>

      <WeightCard />

      <View style={{ gap: 2 }}>
        <Text style={styles.cardTitle}>History</Text>
        <Text style={styles.emptyText}>Meals and weigh-ins, most recently logged first, including ones added for earlier days.</Text>
      </View>
      {history.length === 0 && <Text style={styles.emptyText}>Your logged meals will show up here.</Text>}
      {history.map(([loggedDay, list]) => (
        <View key={loggedDay} style={{ gap: 10 }}>
          <Text style={styles.dayLabel}>Logged {inSentence(relativeDayLabel(loggedDay))}</Text>
          {list.map(({ meal: m, weight: w }) =>
            m ? (
              <MealRow
                key={m.id}
                meal={m}
                note={m.day !== loggedDay ? `For ${inSentence(relativeDayLabel(m.day))}` : undefined}
                onPress={() => openMeal(m)}
                onDelete={() => confirmDeleteMeal(m, deleteMeal)}
              />
            ) : (
              w && (
                <WeightRow
                  key={`w${w.day}`}
                  entry={w}
                  note={w.day !== loggedDay ? `For ${inSentence(relativeDayLabel(w.day))}` : undefined}
                  onPress={() => setEditingWeight(w.day)}
                />
              )
            ),
          )}
        </View>
      ))}
      {editingWeight && <LogWeightModal visible initialDay={editingWeight} onClose={() => setEditingWeight(null)} />}
    </ScrollView>
  );
}

/** Summary of one day under the calendar: calories vs. goal, macros, and the meals logged. */
function DayPreview({ day, meals, goals }: { day: string; meals: Meal[]; goals: Goals }) {
  const t = sumMacros(meals);
  const status = dayStatus(t.calories, goals.calories);
  const label = day === dayKey() ? "Today" : keyToDate(day).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const diff = Math.round(t.calories - goals.calories);
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.cardHead}>
        <Text style={styles.previewTitle}>{label}</Text>
        <Pressable onPress={() => openDay(day)} hitSlop={8} style={styles.openBtn}>
          <Text style={styles.openText}>{meals.length ? "Open day" : "Add meals"}</Text>
          <Icon name="chevron" size={14} color={colors.accent} />
        </Pressable>
      </View>

      {meals.length === 0 ? (
        <Text style={styles.emptyText}>Nothing logged this day.</Text>
      ) : (
        <>
          <View style={styles.cardHead}>
            <Text style={styles.previewKcal}>
              {Math.round(t.calories).toLocaleString()}
              <Text style={styles.previewGoal}> / {goals.calories.toLocaleString()} kcal</Text>
            </Text>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[status] + "22" }]}>
              <Text style={[styles.statusText, { color: status === "under" ? colors.teal : STATUS_COLORS[status] }]}>
                {status === "hit" ? "On target" : status === "over" ? `${diff} over` : `${-diff} under`}
              </Text>
            </View>
          </View>
          <Bar pct={t.calories / goals.calories} color={STATUS_COLORS[status]} height={8} />
          <View style={styles.previewMacros}>
            {(["protein", "carbs", "fat"] as const).map((k) => (
              <MacroBar key={k} k={k} totals={t} goals={goals} />
            ))}
          </View>
          <View style={styles.thumbs}>
            {meals.slice(0, 6).map((m) =>
              m.photoUri ? (
                <Image key={m.id} source={{ uri: m.photoUri }} style={styles.thumb} />
              ) : (
                <View key={m.id} style={[styles.thumb, styles.thumbEmpty]}>
                  <Icon name="sparkle" size={14} color={colors.faint} />
                </View>
              ),
            )}
            <Text style={styles.previewGoal}>
              {meals.length} {meals.length === 1 ? "meal" : "meals"}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

function MacroBar({ k, totals, goals }: { k: keyof typeof macroMeta; totals: Macros; goals: Goals }) {
  return (
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={styles.previewGoal}>{macroMeta[k].label}</Text>
      <Text style={styles.macroNums}>
        {Math.round(totals[k])}
        <Text style={styles.previewGoal}> / {goals[k]}g</Text>
      </Text>
      <Bar pct={goals[k] ? totals[k] / goals[k] : 0} color={macroMeta[k].color} height={5} />
    </View>
  );
}

function Bar({ pct, color, height }: { pct: number; color: string; height: number }) {
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={{ height, borderRadius: height / 2, width: `${Math.min(Math.max(pct, 0), 1) * 100}%`, backgroundColor: color }} />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.text },
  streakCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 20, gap: 16, ...shadow },
  streakTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  flameWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  flameNum: { ...serif, position: "absolute", bottom: 8, color: colors.onPrimary, fontSize: 20 },
  weekDots: { flexDirection: "row", justifyContent: "space-between" },
  weekDot: { alignItems: "center", gap: 6 },
  weekDotLabel: { ...font.caption, color: colors.muted, fontWeight: "700" },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center" },
  dotOn: { backgroundColor: colors.flame },
  streakLabel: { ...font.h2, fontSize: 24, color: colors.teal },
  best: { ...font.label, color: colors.muted },
  badges: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.cardHi },
  badgeOn: { backgroundColor: tint(colors.flame, 0.14) },
  badgeText: { ...font.caption, color: colors.faint, fontWeight: "700" },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 18, gap: 16, ...shadow },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { ...font.h2, color: colors.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  previewTitle: { ...font.body, color: colors.text, fontWeight: "700" },
  openBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  openText: { ...font.label, color: colors.accent },
  previewKcal: { color: colors.text, fontSize: 24, fontWeight: "800" },
  previewGoal: { ...font.caption, color: colors.muted },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { ...font.caption, fontWeight: "700" },
  previewMacros: { flexDirection: "row", gap: 14 },
  thumbs: { flexDirection: "row", alignItems: "center", gap: 6 },
  thumb: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.cardHi },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", gap: 8 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "800" },
  statLabel: { ...font.caption, color: colors.muted },
  macroHead: { flexDirection: "row", justifyContent: "space-between" },
  macroName: { ...font.body, color: colors.text, fontWeight: "600" },
  macroNums: { ...font.body, color: colors.text, fontWeight: "700" },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  dayLabel: { ...font.label, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  dayTotal: { flexDirection: "row", alignItems: "center", gap: 4 },
  dayKcal: { ...font.label, color: colors.text, fontWeight: "700" },
  emptyText: { ...font.body, color: colors.muted },
});
