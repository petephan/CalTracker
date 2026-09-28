import { useId, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { colors } from "../lib/theme";

interface Props {
  size: number;
  stroke: number;
  progress: number; // 0..1+ (values over 1 render as a full ring)
  colors: readonly [string, string] | readonly [string];
  track?: string;
  children?: ReactNode;
}

export function Ring({ size, stroke, progress, colors: c, track = colors.cardHi, children }: Props) {
  const id = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(progress, 1));
  const [from, to] = [c[0], c[1] ?? c[0]];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: "center", justifyContent: "center" } });
