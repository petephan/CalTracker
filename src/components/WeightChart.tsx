import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { dayKey, keyToDate } from "../lib/date";
import { kgToLb } from "../lib/plan";
import { colors, font, radius, serif, tint } from "../lib/theme";
import type { Units, WeightEntry } from "../lib/types";

const PAD = { top: 12, right: 12, bottom: 22, left: 34 };
const SVG_FONT = "system-ui, -apple-system, sans-serif";
const DAY_MS = 86_400_000;

/**
 * Weight over time: one teal line, a dashed goal line, recessive grid. Tap (or hover on web) to read a point.
 * `from` / `to` are day keys bounding the x-axis.
 */
export function WeightChart({ entries, units, targetKg, from, to, height = 200 }: {
  entries: WeightEntry[];
  units: Units;
  targetKg: number | null;
  from: string;
  to: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  // Page x of the chart's left edge. Event offsets are relative to whichever SVG shape is under the pointer,
  // so positions are measured from the page instead.
  const [left, setLeft] = useState(0);
  const box = useRef<View>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    box.current?.measureInWindow((x) => setLeft(x));
  };

  const unit = units === "imperial" ? "lb" : "kg";
  const conv = (kg: number) => (units === "imperial" ? kgToLb(kg) : kg);
  const pts = entries.filter((e) => e.day >= from && e.day <= to).map((e) => ({ day: e.day, v: conv(e.kg) }));
  const target = targetKg != null ? conv(targetKg) : null;

  if (pts.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No weigh-ins in this range yet.</Text>
      </View>
    );
  }

  // y-domain: data + goal, padded, snapped to a "nice" step so gridlines land on round numbers.
  const values = pts.map((p) => p.v).concat(target != null ? [target] : []);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const step = niceStep((hi - lo || 4) / 3);
  const yMin = Math.floor((lo - step * 0.3) / step) * step;
  const yMax = Math.ceil((hi + step * 0.3) / step) * step;
  const ticks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => yMin + i * step);

  const t0 = keyToDate(from).getTime();
  const t1 = Math.max(keyToDate(to).getTime(), t0 + DAY_MS);
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (day: string) => PAD.left + ((keyToDate(day).getTime() - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts[pts.length - 1].day).toFixed(1)},${PAD.top + plotH} L${x(pts[0].day).toFixed(1)},${PAD.top + plotH} Z`;
  // Roughly one label per 72px, never more labels than days in the range.
  const xLabels = axisDates(from, to, Math.max(2, Math.min(4, Math.floor(plotW / 72))));

  const pick = (px: number) => {
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(x(p.day) - px) < Math.abs(x(pts[best].day) - px)) best = i;
    });
    setActive(best);
  };
  const sel = active != null ? pts[Math.min(active, pts.length - 1)] : null;
  const fmt = (v: number) => `${Math.round(v * 10) / 10} ${unit}`;

  return (
    <View ref={box} onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Pressable
          onPressIn={(e) => {
            box.current?.measureInWindow((x) => setLeft(x));
            pick(e.nativeEvent.pageX - left);
          }}
          // Web: hover to read values without clicking.
          onPointerMove={(e) => pick(e.nativeEvent.pageX - left)}
          onPointerLeave={() => setActive(null)}
          accessibilityLabel={`Weight chart, ${pts.length} weigh-ins, latest ${fmt(pts[pts.length - 1].v)}`}
        >
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={PAD.left - 6} y={y(t) + 3} fontSize={10} fontFamily={SVG_FONT} fill={colors.muted} textAnchor="end">
                {Math.round(t)}
              </SvgText>
            ))}
            {xLabels.map((d, i) => (
              <SvgText
                key={d}
                x={x(d)}
                y={height - 5}
                fontSize={10}
                fontFamily={SVG_FONT}
                fill={colors.muted}
                // Edge labels hug the plot so they aren't clipped.
                textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
              >
                {axisLabel(d, t1 - t0)}
              </SvgText>
            ))}
            {target != null && (
              <>
                <Line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(target)}
                  y2={y(target)}
                  stroke={colors.text}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <SvgText x={width - PAD.right} y={y(target) - 5} fontSize={10} fontFamily={SVG_FONT} fill={colors.text} textAnchor="end">
                  Goal {Math.round(target)} {unit}
                </SvgText>
              </>
            )}
            {pts.length > 1 && <Path d={area} fill={tint(colors.teal, 0.08)} />}
            {pts.length > 1 && <Path d={line} stroke={colors.teal} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
            {sel && <Line x1={x(sel.day)} x2={x(sel.day)} y1={PAD.top} y2={PAD.top + plotH} stroke={colors.faint} strokeWidth={1} />}
            {pts.map((p) => (
              <Circle
                key={p.day}
                cx={x(p.day)}
                cy={y(p.v)}
                r={sel?.day === p.day ? 6 : 4}
                fill={colors.teal}
                stroke={colors.card}
                strokeWidth={2}
              />
            ))}
          </Svg>
        </Pressable>
      )}
      {sel && width > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            { top: Math.max(0, y(sel.v) - 54), left: Math.min(Math.max(0, x(sel.day) - 55), width - 110) },
          ]}
        >
          <Text style={styles.tipValue}>{fmt(sel.v)}</Text>
          <Text style={styles.tipDate}>{keyToDate(sel.day).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</Text>
        </View>
      )}
    </View>
  );
}

/** "Sep 27" for short ranges; "Sep '25" once the range spans more than ~6 months, so years can't be confused. */
function axisLabel(day: string, spanMs: number): string {
  const d = keyToDate(day);
  const month = d.toLocaleDateString([], { month: "short" });
  return spanMs > 183 * DAY_MS ? `${month} '${String(d.getFullYear()).slice(2)}` : `${month} ${d.getDate()}`;
}

/** 1, 2, 2.5 or 5 × 10^n, whichever is closest above `raw`. */
function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/** Up to `max` evenly spaced, distinct date labels across the range (fewer when the range is only a few days). */
function axisDates(from: string, to: string, max: number): string[] {
  const a = keyToDate(from).getTime();
  const b = keyToDate(to).getTime();
  const spanDays = Math.round((b - a) / DAY_MS);
  const count = Math.min(max, spanDays + 1);
  if (count <= 1) return [from];
  const days = Array.from({ length: count }, (_, i) => dayKey(new Date(a + ((b - a) * i) / (count - 1))));
  return [...new Set(days)];
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.cardHi },
  emptyText: { ...font.label, color: colors.muted },
  tooltip: {
    position: "absolute",
    width: 110,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.text,
    alignItems: "center",
  },
  tipValue: { ...serif, color: colors.onPrimary, fontSize: 15 },
  tipDate: { ...font.caption, color: colors.faint, fontSize: 11 },
});
