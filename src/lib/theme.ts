import type { TextStyle, ViewStyle } from "react-native";

/*
 * Brand palette: old San Jose Sharks — Pacific Teal, black and white, nothing else.
 * Every other color below is a tint of one of those three (teal mixed with white, greys from black).
 * Icons are monochrome in these colors, and no colored emoji are used in UI copy.
 */
const TEAL = "#006D75";
const BLACK = "#000000";
const WHITE = "#FFFFFF";

export const colors = {
  bg: "#F2F7F7", // white with a whisper of teal
  card: WHITE,
  cardHi: "#E7F0F1", // teal ~9% on white
  border: "#D6E5E6",
  text: BLACK,
  muted: "#6B6B6B",
  faint: "#B5B5B5",
  onPrimary: WHITE,
  teal: TEAL,
  tealLight: "#7FB6BA", // teal 50% on white
  accent: TEAL, // buttons, rings, links, active states
  brand: TEAL,
  // Data colors stay in-palette: protein = teal, carbs = black, fat = light teal.
  protein: TEAL,
  carbs: BLACK,
  fat: "#7FB6BA",
  success: TEAL,
  danger: BLACK,
  flame: TEAL,
  overlay: "rgba(0,0,0,0.5)",
  scrim: "rgba(255,255,255,0.97)", // behind sticky footers
} as const;

/** `color` at `alpha` (0–1), for tinted backgrounds. Expects a #RRGGBB color. */
export const tint = (color: string, alpha: number) =>
  color + Math.round(alpha * 255).toString(16).padStart(2, "0");

export const shadow: ViewStyle = { boxShadow: "0 6px 24px rgba(0,60,65,0.07), 0 1px 3px rgba(0,0,0,0.05)" };

export const macroMeta = {
  protein: { label: "Protein", color: colors.protein, unit: "g", icon: "protein" },
  carbs: { label: "Carbs", color: colors.carbs, unit: "g", icon: "carbs" },
  fat: { label: "Fat", color: colors.fat, unit: "g", icon: "fat" },
} as const;

/** Restrained rounding reads more premium than bubbly pills. */
export const radius = { sm: 6, md: 10, lg: 14, xl: 18, button: 12 } as const;

/** Serif for display text and headings; the system sans-serif for everything else. */
export const serif = { fontFamily: "PlayfairDisplay_700Bold" } as const;
export const serifSemi = { fontFamily: "PlayfairDisplay_600SemiBold" } as const;

export const font: Record<"hero" | "h1" | "h2" | "body" | "label" | "caption", TextStyle> = {
  hero: { ...serif, fontSize: 44, letterSpacing: -0.5 },
  h1: { ...serif, fontSize: 30, letterSpacing: -0.3 },
  h2: { ...serif, fontSize: 21, letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: "500" },
  label: { fontSize: 13, fontWeight: "600" },
  caption: { fontSize: 12, fontWeight: "500" },
};
