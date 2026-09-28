import * as Haptics from "expo-haptics";
import { router, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "../../components/Icon";
import { colors, radius, shadow } from "../../lib/theme";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ICONS: Record<string, IconName> = { index: "home", progress: "chart", settings: "settings" };

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

/** Floating white tab bar with labels, and the black "+" (scan) button beside it — the camera is the app's core action. */
function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.bar} pointerEvents="box-none">
        <View style={styles.pill}>
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            const color = focused ? colors.text : colors.muted;
            return (
              <Pressable
                key={route.key}
                style={[styles.tab, focused && styles.tabActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (!focused) navigation.navigate(route.name);
                }}
              >
                <Icon name={ICONS[route.name] ?? "home"} size={20} color={color} />
                <Text style={[styles.tabLabel, { color }]}>{descriptors[route.key].options.title}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/scan");
          }}
          accessibilityLabel="Scan a meal"
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <Icon name="plus" size={28} color={colors.onPrimary} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 16 },
  bar: { width: "100%", maxWidth: 520, flexDirection: "row", alignItems: "center", gap: 12 },
  pill: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 5,
    justifyContent: "space-between",
    ...shadow,
  },
  tab: { flex: 1, height: 54, borderRadius: radius.lg - 4, alignItems: "center", justifyContent: "center", gap: 2 },
  tabActive: { backgroundColor: colors.cardHi },
  tabLabel: { fontSize: 10, fontWeight: "700" },
  fab: {
    width: 62,
    height: 62,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal,
    boxShadow: "0 8px 20px rgba(0,109,117,0.3)",
  },
});
