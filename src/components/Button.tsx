import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, tint } from "../lib/theme";

export function PrimaryButton({ label, onPress, disabled, style }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primary, style, disabled && { opacity: 0.35 }, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

/** Outlined button, e.g. "Retake" or "Cancel". */
export function SecondaryButton({ label, onPress, danger, style }: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, danger && styles.danger, style, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.secondaryText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: { height: 54, borderRadius: radius.button, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, backgroundColor: colors.text },
  primaryText: { color: colors.onPrimary, fontSize: 17, fontWeight: "700" },
  secondary: {
    height: 54,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  danger: { backgroundColor: tint(colors.danger, 0.08), borderColor: tint(colors.danger, 0.2) },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: "700" },
});
