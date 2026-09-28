import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { addDays, dayKey, keyToDate } from "./date";
import type { Meal, MealType, Reminder, ReminderItem } from "./types";

// How many days ahead to schedule. Reminders are rebuilt every time the app opens or a
// meal is logged, so meals you've already tracked today never trigger a nag.
const DAYS_AHEAD = 7;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Meal reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

const MEAL_BODY: Record<Exclude<MealType, "snack">, string> = {
  breakfast: "Snap a quick photo — CalSnap does the math.",
  lunch: "One photo keeps your macros on target.",
  dinner: "Log it now and close out your day strong.",
};

function at(day: string, r: Reminder): Date {
  const d = keyToDate(day);
  d.setHours(r.hour, r.minute, 0, 0);
  return d;
}

export async function rescheduleReminders(meals: Meal[], reminders: ReminderItem[], streak: number) {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = Date.now();
  const today = dayKey();
  const loggedToday = new Set(meals.filter((m) => m.day === today).map((m) => m.mealType));
  const anythingToday = loggedToday.size > 0;

  const jobs: Promise<string>[] = [];
  const schedule = (date: Date, title: string, body: string) => {
    if (date.getTime() <= now) return;
    jobs.push(
      Notifications.scheduleNotificationAsync({
        content: { title, body, data: { url: "/scan" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: "reminders" },
      }),
    );
  };

  for (const r of reminders) {
    if (!r.enabled) continue;

    // Custom reminders repeat daily, so each one needs a single scheduled notification.
    if (r.kind === "custom") {
      jobs.push(
        Notifications.scheduleNotificationAsync({
          content: { title: r.label, body: "Tap to log a meal in CalSnap.", data: { url: "/scan" } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: "reminders" },
        }),
      );
      continue;
    }

    // Meal and streak reminders are scheduled day by day so today's can be skipped once it's logged.
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const day = addDays(today, i);
      if (r.kind === "streak") {
        if (i === 0 && anythingToday) continue;
        // Future days get generic copy: we can't know the streak then if the app isn't reopened.
        const title = i === 0 && streak > 0 ? `Your ${streak}-day streak ends at midnight` : "Don't let your streak slip";
        schedule(at(day, r), title, "Log one meal to keep it alive.");
      } else {
        if (i === 0 && loggedToday.has(r.kind)) continue;
        schedule(at(day, r), `Have you tracked ${r.label.toLowerCase()}?`, MEAL_BODY[r.kind]);
      }
    }
  }

  await Promise.all(jobs);
}

/** Calls `onTap` when the app is opened from a reminder (cold start or while running). Returns an unsubscribe. */
export function onReminderTap(onTap: () => void): () => void {
  const open = (r: Notifications.NotificationResponse | null) => {
    if (r?.notification.request.content.data?.url === "/scan") onTap();
  };
  Notifications.getLastNotificationResponseAsync().then(open);
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
