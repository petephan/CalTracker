import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors, serif } from "../lib/theme";

/** CalSnap mark: a teal flame inside a black tile, with the serif wordmark beside it. */
export function Logo({ size = 28, showName = true }: { size?: number; showName?: boolean }) {
  return (
    <View style={styles.row}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Rect x={0} y={0} width={32} height={32} rx={7} fill={colors.text} />
        <Path
          fill={colors.teal}
          d="M16 6c.7 3.7 3.4 5.8 5.1 8a8.3 8.3 0 0 1-5.1 12 8 8 0 0 1-8.1-8c0-3 1.7-5.1 3.1-6.5.3 2 1.3 3.3 2.7 3.9C12.7 11.5 14.4 8.6 16 6z"
        />
        <Path fill={colors.onPrimary} d="M16 18.5c.3 1.5 1.4 2.3 2 3.2a3.3 3.3 0 0 1-2 4.8 3.2 3.2 0 0 1-3.2-3.2c0-1.2.7-2 1.2-2.6.1.8.5 1.3 1.1 1.6-.2-1.5.4-2.8.9-3.8z" />
      </Svg>
      {showName && <Text style={[styles.name, { fontSize: size * 0.85 }]}>CalSnap</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { ...serif, color: colors.text, letterSpacing: -0.2 },
});
