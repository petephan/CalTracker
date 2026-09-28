import { StyleSheet, Text, View } from "react-native";
import { colors, font, macroMeta, radius, serif, shadow } from "../lib/theme";
import { Icon } from "./Icon";
import { Ring } from "./Ring";

export function MacroCard({ macro, value, goal }: { macro: keyof typeof macroMeta; value: number; goal: number }) {
  const meta = macroMeta[macro];
  return (
    <View style={styles.card}>
      <Text style={styles.value}>
        {Math.round(value)}
        <Text style={styles.goal}>/{goal}g</Text>
      </Text>
      <Text style={styles.label}>{meta.label} eaten</Text>
      <View style={styles.ringWrap}>
        <Ring size={64} stroke={6} progress={goal ? value / goal : 0} colors={[meta.color]}>
          <Icon name={meta.icon} size={20} color={meta.color} strokeWidth={2.2} />
        </Ring>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, ...shadow },
  value: { ...serif, color: colors.text, fontSize: 19 },
  goal: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  label: { ...font.caption, color: colors.muted, marginTop: 2 },
  ringWrap: { alignItems: "center", marginTop: 12 },
});
