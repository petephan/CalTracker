// Local notifications aren't supported on web, so reminders are a no-op there.
import type { Meal, ReminderItem } from "./types";

export async function ensurePermission(): Promise<boolean> {
  return false;
}

export async function rescheduleReminders(_meals: Meal[], _reminders: ReminderItem[], _streak: number) {}

export function onReminderTap(_onTap: () => void): () => void {
  return () => {};
}
