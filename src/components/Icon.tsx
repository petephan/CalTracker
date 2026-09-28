import Svg, { Circle, Path, Rect } from "react-native-svg";

export type IconName =
  | "home" | "chart" | "settings" | "camera" | "image" | "close" | "flame" | "check"
  | "bolt" | "minus" | "plus" | "trash" | "chevron" | "back" | "sparkle" | "calendar" | "edit"
  | "protein" | "carbs" | "fat" | "scale";

export function Icon({ name, size = 24, color = "#111114", strokeWidth = 2 }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number;
}) {
  const p = { stroke: color, strokeWidth, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" && <Path {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />}
      {name === "chart" && <><Path {...p} d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></>}
      {name === "settings" && (
        <>
          <Circle {...p} cx={12} cy={12} r={3} />
          <Path {...p} d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </>
      )}
      {name === "camera" && (
        <>
          <Path {...p} d="M3 8a2 2 0 0 1 2-2h2l2-2.5h6L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Circle {...p} cx={12} cy={13} r={4} />
        </>
      )}
      {name === "image" && (
        <>
          <Rect {...p} x={3} y={3} width={18} height={18} rx={3} />
          <Circle {...p} cx={9} cy={9} r={2} />
          <Path {...p} d="m21 15-5-5L5 21" />
        </>
      )}
      {name === "close" && <Path {...p} d="M18 6 6 18M6 6l12 12" />}
      {name === "flame" && (
        <Path
          fill={color}
          d="M12 2c.6 3.3 3 5.2 4.6 7.2A7.5 7.5 0 0 1 12 22a7.2 7.2 0 0 1-7.3-7.2c0-2.7 1.5-4.6 2.8-5.9.3 1.8 1.2 3 2.4 3.5C9.4 8.6 10.6 4.6 12 2z"
        />
      )}
      {name === "check" && <Path {...p} d="M20 6 9 17l-5-5" />}
      {name === "bolt" && <Path fill={color} d="M13 2 4 14h7l-1 8 9-12h-7z" />}
      {name === "minus" && <Path {...p} d="M5 12h14" />}
      {name === "plus" && <Path {...p} d="M12 5v14M5 12h14" />}
      {name === "trash" && <Path {...p} d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />}
      {name === "chevron" && <Path {...p} d="m9 18 6-6-6-6" />}
      {name === "back" && <Path {...p} d="m15 18-6-6 6-6" />}
      {name === "calendar" && (
        <>
          <Rect {...p} x={3} y={5} width={18} height={16} rx={3} />
          <Path {...p} d="M3 10h18M8 3v4M16 3v4" />
        </>
      )}
      {/* protein + carbs paths adapted from Lucide (ISC license): drumstick, wheat */}
      {name === "protein" && (
        <>
          <Path {...p} d="M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23" />
          <Path {...p} d="m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59" />
        </>
      )}
      {name === "carbs" && (
        <>
          <Path {...p} d="M2 22 16 8" />
          <Path {...p} d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
          <Path {...p} d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
          <Path {...p} d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
          <Path {...p} d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" />
          <Path {...p} d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
          <Path {...p} d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
          <Path {...p} d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
        </>
      )}
      {name === "scale" && (
        <>
          <Rect {...p} x={3} y={3} width={18} height={18} rx={4} />
          <Path {...p} d="M8 9.5a5 5 0 0 1 8 0M12 9.5l1.5-2" />
        </>
      )}
      {name === "fat" && <Path {...p} d="M12 3s6.5 6.8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 9.8 12 3 12 3z" />}
      {name === "edit" && <Path {...p} d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" />}
      {name === "sparkle" && (
        <Path fill={color} d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z" />
      )}
    </Svg>
  );
}
