import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { addDays, dayKey, relativeDayLabel } from "../lib/date";
import { confirmAsync } from "../lib/dialogs";
import { noFocusRing } from "../lib/layout";
import { formatWeight, kgToLb, lbToKg } from "../lib/plan";
import { useStore } from "../lib/store";
import { colors, font, radius, serif, shadow } from "../lib/theme";
import type { WeightEntry } from "../lib/types";
import { PrimaryButton, SecondaryButton } from "./Button";
import { Icon } from "./Icon";
import { WeightChart } from "./WeightChart";

/** Days back from today for each range; 0 = all time. */
const RANGES = { Week: 7, Month: 30, "3 Months": 90, "1 Year": 365, "All time": 0 } as const;
const MIN_SPAN_DAYS = 7;
type Range = keyof typeof RANGES;

/** Current weight vs. goal, progress toward it, a weight-over-time chart, and a "Log weight" action. */
export function WeightCard() {
  const { weights, profile } = useStore();
  const [range, setRange] = useState<Range>("Month");
  const [logging, setLogging] = useState(false);
  if (!profile) return null;

  const units = profile.units;
  const today = dayKey();
  const current = weights[weights.length - 1]?.kg ?? profile.weightKg;
  const start = weights[0]?.kg ?? current;
  const target = profile.targetWeightKg;
  const change = current - start;
  const progress = target != null && start !== target ? Math.min(Math.max((start - current) / (start - target), 0), 1) : null;
  // "All time" starts at the first weigh-in, but always spans at least a week so a couple of close entries aren't
  // stretched edge to edge.
  const earliest = addDays(today, -MIN_SPAN_DAYS);
  const firstDay = weights[0]?.day ?? today;
  const from = RANGES[range] ? addDays(today, -RANGES[range]) : firstDay < earliest ? firstDay : earliest;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Weight</Text>
        <Pressable onPress={() => setLogging(true)} style={styles.logBtn}>
          <Icon name="plus" size={14} color={colors.onPrimary} strokeWidth={2.6} />
          <Text style={styles.logText}>Log weight</Text>
        </Pressable>
      </View>

      <View style={styles.stats}>
        <Stat label="Current" value={formatWeight(current, units, 1)} big />
        {target != null && <Stat label="Goal" value={formatWeight(target, units)} />}
        <Stat
          label="Change"
          value={`${change > 0 ? "+" : change < 0 ? "−" : ""}${formatWeight(Math.abs(change), units, 1)}`}
        />
      </View>

      {progress != null && (
        <View style={{ gap: 6 }}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.muted}>{Math.round(progress * 100)}% of the way to your goal</Text>
        </View>
      )}

      <View style={styles.segment}>
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <Pressable key={r} onPress={() => setRange(r)} style={[styles.segBtn, range === r && styles.segOn]}>
            <Text style={[styles.segText, range === r && { color: colors.text }]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <WeightChart entries={weights} units={units} targetKg={target} from={from} to={today} />
      {weights.length < 2 && <Text style={styles.muted}>Log your weight regularly to see your trend here.</Text>}

      {/* Mounted only while open, so it starts fresh with the latest weight each time. */}
      {logging && <LogWeightModal visible onClose={() => setLogging(false)} />}
    </View>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={{ flex: big ? 1.3 : 1, gap: 2 }}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.statValue, big && { fontSize: 26 }]}>{value}</Text>
    </View>
  );
}

/** Log (or replace) a weigh-in for any day up to today. Mount it only while open so it starts fresh. */
export function LogWeightModal({ visible, onClose, initialDay }: { visible: boolean; onClose: () => void; initialDay?: string }) {
  const { weights, profile, logWeight, deleteWeight } = useStore();
  const units = profile?.units ?? "metric";
  const today = dayKey();
  const toDisplay = (kg: number) => String(Math.round((units === "imperial" ? kgToLb(kg) : kg) * 10) / 10);
  const [day, setDay] = useState(initialDay && initialDay <= today ? initialDay : today);
  // Pre-fill with that day's weigh-in if there is one, else the closest earlier one, else the profile weight.
  const [value, setValue] = useState(() => {
    const onOrBefore = weights.filter((w) => w.day <= day);
    return toDisplay(onOrBefore[onOrBefore.length - 1]?.kg ?? weights[0]?.kg ?? profile?.weightKg ?? 0);
  });

  const n = parseFloat(value.replace(",", "."));
  const kg = units === "imperial" ? lbToKg(n) : n;
  const valid = Number.isFinite(kg) && kg >= 30 && kg <= 350;

  const save = () => {
    if (!valid) return;
    logWeight(Math.round(kg * 100) / 100, day);
    onClose();
  };

  const remove = async (w: WeightEntry) => {
    if (await confirmAsync("Delete this weigh-in?", `${formatWeight(w.kg, units)} · ${relativeDayLabel(w.day)}`)) deleteWeight(w.day);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Log weight</Text>

          <View style={styles.dayRow}>
            <Pressable onPress={() => setDay(addDays(day, -1))} hitSlop={8} style={styles.navBtn} accessibilityLabel="Previous day">
              <Icon name="back" size={16} />
            </Pressable>
            <Text style={styles.dayText}>{relativeDayLabel(day)}</Text>
            <Pressable
              onPress={() => day < today && setDay(addDays(day, 1))}
              hitSlop={8}
              style={[styles.navBtn, day >= today && { opacity: 0.3 }]}
              accessibilityLabel="Next day"
            >
              <Icon name="chevron" size={16} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <TextInput
              value={value}
              onChangeText={(t) => setValue(t.replace(/[^0-9.,]/g, ""))}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={save}
              style={[styles.input, noFocusRing]}
              accessibilityLabel="Weight"
            />
            <Text style={styles.unit}>{units === "imperial" ? "lb" : "kg"}</Text>
          </View>

          <View style={styles.actions}>
            <SecondaryButton label="Cancel" onPress={onClose} />
            <PrimaryButton label="Save" onPress={save} disabled={!valid} style={{ flex: 1 }} />
          </View>

          {weights.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={styles.muted}>Recent weigh-ins</Text>
              {[...weights]
                .reverse()
                .slice(0, 5)
                .map((w) => (
                  <View key={w.day} style={styles.entry}>
                    <Text style={styles.entryDay}>{relativeDayLabel(w.day)}</Text>
                    <Text style={styles.entryValue}>{formatWeight(w.kg, units, 1)}</Text>
                    <Pressable onPress={() => remove(w)} hitSlop={8} accessibilityLabel={`Delete weigh-in ${w.day}`}>
                      <Icon name="trash" size={15} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A weigh-in in a list (Home's "Recently logged", Progress history). Tap to edit, trash to delete. */
export function WeightRow({ entry, note, onPress }: { entry: WeightEntry; note?: string; onPress: () => void }) {
  const { profile, weights, deleteWeight } = useStore();
  const units = profile?.units ?? "metric";
  const i = weights.findIndex((w) => w.day === entry.day);
  const prev = i > 0 ? weights[i - 1] : null;
  const diff = prev ? entry.kg - prev.kg : 0;
  const remove = async () => {
    if (await confirmAsync("Delete this weigh-in?", `${formatWeight(entry.kg, units)} · ${relativeDayLabel(entry.day)}`))
      deleteWeight(entry.day);
  };
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      <View style={styles.rowIcon}>
        <Icon name="scale" size={30} color={colors.teal} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.rowTitle}>Weigh-in</Text>
        {note && (
          <View style={styles.noteRow}>
            <Icon name="calendar" size={12} color={colors.teal} />
            <Text style={styles.note}>{note}</Text>
          </View>
        )}
        <Text style={styles.rowValue}>
          {formatWeight(entry.kg, units, 1)}
          {prev && Math.abs(diff) >= 0.05 && (
            <Text style={styles.rowDiff}>
              {"  "}
              {diff > 0 ? "+" : "−"}
              {formatWeight(Math.abs(diff), units, 1)} since last
            </Text>
          )}
        </Text>
      </View>
      <Pressable onPress={remove} hitSlop={8} style={styles.trash} accessibilityLabel={`Delete weigh-in ${entry.day}`}>
        <Icon name="trash" size={16} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radius.lg, padding: 10, gap: 14, ...shadow },
  rowIcon: { width: 92, height: 64, borderRadius: radius.md, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center" },
  rowTitle: { ...font.body, color: colors.text, fontWeight: "700" },
  rowValue: { ...serif, color: colors.text, fontSize: 19 },
  rowDiff: { ...font.caption, color: colors.muted, fontWeight: "600" },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  note: { ...font.caption, color: colors.teal, fontWeight: "700" },
  trash: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardHi },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 18, gap: 16, ...shadow },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { ...font.h2, color: colors.text },
  logBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.text, paddingHorizontal: 12, height: 34, borderRadius: radius.sm },
  logText: { ...font.label, color: colors.onPrimary },
  stats: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
  statValue: { ...serif, color: colors.text, fontSize: 18 },
  muted: { ...font.caption, color: colors.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cardHi, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.teal },
  segment: { flexDirection: "row", backgroundColor: colors.cardHi, borderRadius: radius.sm, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 6, borderRadius: radius.sm - 2, alignItems: "center" },
  segOn: { backgroundColor: colors.card, ...shadow },
  segText: { ...font.caption, color: colors.muted, fontWeight: "700", fontSize: 11 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: 20 },
  sheet: { width: "100%", maxWidth: 400, backgroundColor: colors.card, borderRadius: radius.xl, padding: 20, gap: 16 },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardHi },
  dayText: { ...font.body, color: colors.text, fontWeight: "700" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.teal,
    paddingHorizontal: 18,
  },
  input: { ...serif, flex: 1, minWidth: 0, fontSize: 30, color: colors.text, paddingVertical: 12 },
  unit: { ...font.body, color: colors.muted },
  actions: { flexDirection: "row", gap: 10 },
  entry: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  entryDay: { ...font.label, color: colors.text, flex: 1 },
  entryValue: { ...font.label, color: colors.text },
});
