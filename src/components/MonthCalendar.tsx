import { Pressable, StyleSheet, Text, View } from "react-native";
import { dayKey } from "../lib/date";
import { colors, font } from "../lib/theme";
import { Icon } from "./Icon";
import { Ring } from "./Ring";

export type DayStatus = "under" | "hit" | "over";

export const STATUS_COLORS: Record<DayStatus, string> = { under: colors.fat, hit: colors.success, over: colors.danger };

/** Calories count as on target within ±10% of goal, matching goalStatus(). */
export function dayStatus(kcal: number, goal: number): DayStatus {
  if (kcal > goal * 1.1) return "over";
  if (kcal >= goal * 0.9) return "hit";
  return "under";
}

const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 7 + i).toLocaleDateString([], { weekday: "narrow" }),
); // Jan 7 2024 was a Sunday

/** A month grid. Each logged day shows a ring filled to its share of the calorie goal, colored by status. */
export function MonthCalendar({ month, onChangeMonth, selected, onSelect, caloriesByDay, goal }: {
  month: Date; // any date in the month to show
  onChangeMonth: (month: Date) => void;
  selected: string;
  onSelect: (day: string) => void;
  caloriesByDay: Map<string, number>;
  goal: number;
}) {
  const today = dayKey();
  const year = month.getFullYear();
  const m = month.getMonth();
  const leading = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(year, m, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);
  const isCurrentMonth = year === new Date().getFullYear() && m === new Date().getMonth();

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.head}>
        <Pressable onPress={() => onChangeMonth(new Date(year, m - 1, 1))} hitSlop={10} style={styles.navBtn}>
          <Icon name="back" size={18} color={colors.muted} />
        </Pressable>
        <Text style={styles.title}>{month.toLocaleDateString([], { month: "long", year: "numeric" })}</Text>
        <Pressable
          onPress={() => !isCurrentMonth && onChangeMonth(new Date(year, m + 1, 1))}
          hitSlop={10}
          style={[styles.navBtn, isCurrentMonth && { opacity: 0.25 }]}
        >
          <Icon name="chevron" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={styles.cell} />;
          const kcal = caloriesByDay.get(day) ?? 0;
          const future = day > today;
          const isSel = day === selected;
          const color = kcal > 0 ? STATUS_COLORS[dayStatus(kcal, goal)] : colors.border;
          return (
            <Pressable
              key={day}
              disabled={future}
              onPress={() => onSelect(day)}
              style={[styles.cell, future && { opacity: 0.3 }]}
              accessibilityLabel={`Select ${day}`}
            >
              <View style={[styles.cellInner, isSel && styles.selected]}>
                <Ring size={34} stroke={3.5} progress={goal ? kcal / goal : 0} colors={[color]}>
                  <Text style={[styles.date, day === today && { color: colors.accent }]}>{Number(day.slice(8))}</Text>
                </Ring>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        {(["under", "hit", "over"] as const).map((k) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[k] }]} />
            <Text style={styles.legendText}>{k === "under" ? "Under" : k === "hit" ? "On target (±10%)" : "Over"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  title: { ...font.h2, color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", ...font.caption, color: colors.muted, fontWeight: "700", paddingBottom: 6 },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  cellInner: { padding: 4, borderRadius: 8 },
  selected: { backgroundColor: colors.border },
  date: { color: colors.text, fontSize: 12, fontWeight: "700" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...font.caption, color: colors.muted },
});
