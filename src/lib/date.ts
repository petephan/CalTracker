import type { MealType } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** The last `n` day keys, oldest first, ending today. */
export function lastNDays(n: number, end: string = dayKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

export function mealTypeFor(d: Date = new Date()): MealType {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 17 && h < 21.5) return "dinner";
  return "snack";
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatClock(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return formatTime(d.getTime());
}

export function relativeDayLabel(key: string): string {
  const today = dayKey();
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  return keyToDate(key).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
