import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { formatTime } from "../lib/date";
import { colors, font, macroMeta, radius, serifSemi, shadow } from "../lib/theme";
import type { Meal } from "../lib/types";
import { Icon } from "./Icon";

/** Tap to open the meal; the trash button deletes it. `note` adds a small line, e.g. which day a back-filled meal is for. */
export function MealRow({ meal, onPress, onDelete, note }: {
  meal: Meal;
  onPress?: () => void;
  onDelete?: () => void;
  note?: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      {meal.photoUri ? (
        <Image source={{ uri: meal.photoUri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.placeholder]}>
          <Icon name="sparkle" size={22} color={colors.faint} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {meal.name}
          </Text>
          <View style={styles.timePill}>
            <Text style={styles.time}>{formatTime(meal.createdAt)}</Text>
          </View>
        </View>
        {note && (
          <View style={styles.noteRow}>
            <Icon name="calendar" size={12} color={colors.teal} />
            <Text style={styles.note}>{note}</Text>
          </View>
        )}
        <View style={styles.kcalRow}>
          <Icon name="flame" size={16} color={colors.text} />
          <Text style={styles.kcal}>{Math.round(meal.calories)} Calories</Text>
        </View>
        <View style={styles.macros}>
          {(["protein", "carbs", "fat"] as const).map((k) => (
            <View key={k} style={styles.macro}>
              <Icon name={macroMeta[k].icon} size={13} color={macroMeta[k].color} strokeWidth={2.4} />
              <Text style={styles.macroText}>{Math.round(meal[k])}g</Text>
            </View>
          ))}
        </View>
      </View>
      {onDelete && (
        <Pressable onPress={onDelete} hitSlop={8} style={styles.trash} accessibilityLabel={`Delete ${meal.name}`}>
          <Icon name="trash" size={16} color={colors.muted} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.lg, padding: 10, gap: 14, ...shadow },
  thumb: { width: 92, height: 92, borderRadius: radius.md, backgroundColor: colors.cardHi },
  placeholder: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, justifyContent: "center", gap: 7 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { ...font.body, color: colors.text, fontWeight: "700", flex: 1 },
  timePill: { backgroundColor: colors.cardHi, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  time: { ...font.caption, color: colors.muted, fontSize: 11 },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  note: { ...font.caption, color: colors.teal, fontWeight: "700" },
  kcalRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  kcal: { ...serifSemi, color: colors.text, fontSize: 17 },
  macros: { flexDirection: "row", gap: 14 },
  macro: { flexDirection: "row", alignItems: "center", gap: 4 },
  macroText: { ...font.caption, color: colors.muted, fontWeight: "600" },
  trash: { alignSelf: "center", width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardHi },
});
