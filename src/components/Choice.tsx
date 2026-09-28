import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, shadow, tint } from "../lib/theme";
import { Icon } from "./Icon";

/** A large selectable card, used for single-choice questions. */
export function Choice({ title, body, selected, badge, onPress }: {
  title: string;
  body?: string;
  selected: boolean;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, selected && styles.on, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {body && <Text style={styles.body}>{body}</Text>}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.card,
    ...shadow,
  },
  on: { borderColor: colors.teal, backgroundColor: colors.card },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { ...font.body, color: colors.text, fontWeight: "700", fontSize: 16 },
  body: { ...font.label, color: colors.muted, fontWeight: "500" },
  badge: { backgroundColor: tint(colors.teal, 0.1), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { ...font.caption, color: colors.success, fontWeight: "700" },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.faint, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.teal, borderColor: colors.teal },
});
