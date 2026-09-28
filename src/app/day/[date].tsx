import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton, SecondaryButton } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { MealRow } from "../../components/MealRow";
import { addDays, dayKey, keyToDate } from "../../lib/date";
import { screen } from "../../lib/layout";
import { confirmDeleteMeal, openMeal } from "../../lib/meals";
import { goalStatus, sumMacros, useStore } from "../../lib/store";
import { colors, font, macroMeta, radius, tint } from "../../lib/theme";
import type { MealType } from "../../lib/types";

const ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

/** One day's log: totals vs. goals and every meal, with add / edit / delete. */
export default function DayScreen() {
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { meals, goals, deleteMeal } = useStore();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date : dayKey();
  const today = dayKey();

  const list = meals
    .filter((m) => m.day === day)
    .sort((a, b) => ORDER.indexOf(a.mealType) - ORDER.indexOf(b.mealType) || a.createdAt - b.createdAt);
  const totals = sumMacros(list);
  const hit = goalStatus(totals, goals);
  const pct = goals.calories ? totals.calories / goals.calories : 0;
  const over = totals.calories > goals.calories * 1.1;

  const go = (d: string) => router.setParams({ date: d });
  const back = () => (router.canGoBack() ? router.back() : router.replace("/progress"));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[screen.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }]}>
        <View style={styles.nav}>
          <Pressable onPress={back} hitSlop={10} style={styles.navBtn}>
            <Icon name="back" size={22} />
          </Pressable>
          <View style={styles.dayPicker}>
            <Pressable onPress={() => go(addDays(day, -1))} hitSlop={10} style={styles.navBtn}>
              <Icon name="back" size={18} color={colors.muted} />
            </Pressable>
            <Text style={styles.navTitle}>
              {day === today ? "Today" : keyToDate(day).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            </Text>
            <Pressable
              onPress={() => day < today && go(addDays(day, 1))}
              hitSlop={10}
              style={[styles.navBtn, day >= today && { opacity: 0.25 }]}
            >
              <Icon name="chevron" size={18} color={colors.muted} />
            </Pressable>
          </View>
          <View style={styles.navBtn} />
        </View>

        <View style={styles.card}>
          <View style={styles.kcalRow}>
            <View>
              <Text style={styles.kcal}>{Math.round(totals.calories).toLocaleString()}</Text>
              <Text style={styles.muted}>of {goals.calories.toLocaleString()} kcal</Text>
            </View>
            {hit.calories ? (
              <View style={styles.badge}>
                <Icon name="check" size={14} color={colors.success} strokeWidth={3} />
                <Text style={styles.badgeText}>On target</Text>
              </View>
            ) : (
              <Text style={[styles.muted, over && { color: colors.danger }]}>
                {over
                  ? `${Math.round(totals.calories - goals.calories)} over`
                  : `${Math.round(goals.calories - totals.calories)} left`}
              </Text>
            )}
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(pct, 1) * 100}%`, backgroundColor: over ? colors.danger : colors.accent }]} />
          </View>
          <View style={styles.macros}>
            {(["protein", "carbs", "fat"] as const).map((k) => (
              <View key={k} style={{ flex: 1, gap: 6 }}>
                <Text style={styles.muted}>{macroMeta[k].label}</Text>
                <Text style={styles.macroVal}>
                  {Math.round(totals[k])}
                  <Text style={styles.muted}> / {goals[k]}g</Text>
                </Text>
                <View style={styles.trackSm}>
                  <View style={[styles.fillSm, { width: `${Math.min(goals[k] ? totals[k] / goals[k] : 0, 1) * 100}%`, backgroundColor: macroMeta[k].color }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.section}>Meals</Text>
        {list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing logged this day</Text>
            <Text style={styles.muted}>Add a meal below, by photo or by hand.</Text>
          </View>
        ) : (
          list.map((m) => <MealRow key={m.id} meal={m} onPress={() => openMeal(m)} onDelete={() => confirmDeleteMeal(m, deleteMeal)} />)
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.footerInner}>
          <SecondaryButton label="Add manually" onPress={() => router.push({ pathname: "/meal/[id]", params: { id: "new", day } })} />
          <PrimaryButton label="Scan a meal" onPress={() => router.push({ pathname: "/scan", params: { day } })} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dayPicker: { flexDirection: "row", alignItems: "center", gap: 8 },
  navTitle: { ...font.h2, color: colors.text, minWidth: 130, textAlign: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 18, gap: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  kcalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kcal: { color: colors.text, fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  muted: { ...font.label, color: colors.muted, fontWeight: "500" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: tint(colors.teal, 0.1), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { ...font.caption, color: colors.success, fontWeight: "700" },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5 },
  macros: { flexDirection: "row", gap: 14 },
  macroVal: { color: colors.text, fontSize: 17, fontWeight: "700" },
  trackSm: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" },
  fillSm: { height: 5, borderRadius: 3 },
  section: { ...font.h2, color: colors.text },
  empty: { alignItems: "center", gap: 6, padding: 28, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border },
  emptyTitle: { ...font.body, color: colors.text, fontWeight: "700" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.scrim, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  footerInner: { flexDirection: "row", gap: 10, width: "100%", maxWidth: 520, alignSelf: "center" },
});
