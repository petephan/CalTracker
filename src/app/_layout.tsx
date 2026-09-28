import { PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold, useFonts } from "@expo-google-fonts/playfair-display";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";
import { onReminderTap, rescheduleReminders } from "../lib/notifications";
import { computeStreak, StoreProvider, useStore } from "../lib/store";
import { colors } from "../lib/theme";

export default function RootLayout() {
  // Display serif for headings. Render nothing until it loads so text never flashes in the fallback font.
  const [fontsLoaded, fontError] = useFonts({ PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold });
  if (!fontsLoaded && !fontError) return null;

  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <ReminderSync />
      <RootStack />
    </StoreProvider>
  );
}

/** Signed out, only the login screen is reachable; signed in without a plan, only onboarding. */
function RootStack() {
  const { profile, signedIn } = useStore();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={signedIn && !!profile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="result" options={{ presentation: "fullScreenModal", animation: "fade" }} />
        <Stack.Screen name="day/[date]" />
        <Stack.Screen name="meal/[id]" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ animation: "fade" }} />
      </Stack.Protected>
    </Stack>
  );
}

/** Keeps the local reminder schedule in sync with what's been logged, and routes reminder taps to the camera. */
function ReminderSync() {
  const { meals, reminders, loaded } = useStore();

  useEffect(() => {
    if (!loaded) return;
    const sync = () =>
      rescheduleReminders(meals, reminders, computeStreak(meals).current).catch(console.warn);
    sync();
    const sub = AppState.addEventListener("change", (s) => s === "active" && sync());
    return () => sub.remove();
  }, [meals, reminders, loaded]);

  useEffect(() => onReminderTap(() => router.push("/scan")), []);

  return null;
}
