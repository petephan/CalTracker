import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton, SecondaryButton } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { dayKey, formatTime, keyToDate, relativeDayLabel } from "../../lib/date";
import { screen } from "../../lib/layout";
import { confirmDeleteMeal, newMealId } from "../../lib/meals";
import { useStore } from "../../lib/store";
import { colors, font, macroMeta, radius } from "../../lib/theme";
import type { Macros, Meal, MealType } from "../../lib/types";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const DEFAULT_HOUR: Record<MealType, number> = { breakfast: 8, lunch: 12, dinner: 19, snack: 15 };
const FIELDS = ["calories", "protein", "carbs", "fat"] as const;

/** View and edit one meal. `/meal/new?day=YYYY-MM-DD` adds a meal by hand. */
export default function MealScreen() {
  const insets = useSafeAreaInsets();
  const { id, day: dayParam } = useLocalSearchParams<{ id: string; day?: string }>();
  const { meals, addMeal, updateMeal, deleteMeal } = useStore();
  const existing = meals.find((m) => m.id === id);
  const isNew = id === "new";
  const day = existing?.day ?? dayParam ?? dayKey();

  const [name, setName] = useState(existing?.name ?? "");
  const [mealType, setMealType] = useState<MealType>(existing?.mealType ?? "snack");
  const [values, setValues] = useState<Record<keyof Macros, string>>(() => {
    const v = (k: keyof Macros) => (existing ? String(Math.round(existing[k])) : "");
    return { calories: v("calories"), protein: v("protein"), carbs: v("carbs"), fat: v("fat") };
  });

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (!existing && !isNew) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.muted}>This meal no longer exists.</Text>
        <SecondaryButton label="Close" onPress={close} />
      </View>
    );
  }

  const n = (k: keyof Macros) => Math.max(0, parseInt(values[k], 10) || 0);
  const valid = name.trim().length > 0 && values.calories !== "";

  const save = () => {
    if (!valid) return;
    const macros = { calories: n("calories"), protein: n("protein"), carbs: n("carbs"), fat: n("fat") };
    if (existing) {
      updateMeal({ ...existing, ...macros, name: name.trim(), mealType });
    } else {
      const when = day === dayKey() ? new Date() : keyToDate(day);
      if (day !== dayKey()) when.setHours(DEFAULT_HOUR[mealType], 0, 0, 0);
      const meal: Meal = {
        id: newMealId(),
        name: name.trim(),
        mealType,
        photoUri: null,
        items: [],
        servings: 1,
        ...macros,
        createdAt: when.getTime(),
        loggedAt: Date.now(),
        day,
      };
      addMeal(meal);
    }
    close();
  };

  const remove = async () => {
    if (existing && (await confirmDeleteMeal(existing, deleteMeal))) close();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        {existing?.photoUri ? (
          <Image source={{ uri: existing.photoUri }} style={styles.photo} />
        ) : (
          <View style={{ height: insets.top + 64 }} />
        )}
        <View style={[screen.content, { paddingTop: 16 }]}>
          <View style={{ gap: 4 }}>
            <Text style={styles.kicker}>
              {relativeDayLabel(day)}
              {existing ? ` · ${formatTime(existing.createdAt)}` : ""}
            </Text>
            <Text style={styles.title}>{isNew ? "Add a meal" : "Edit meal"}</Text>
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={100}
            placeholder="e.g. Chicken salad"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />

          <Text style={styles.label}>Meal</Text>
          <View style={styles.chips}>
            {MEAL_TYPES.map((m) => (
              <Pressable key={m} onPress={() => setMealType(m)} style={[styles.chip, mealType === m && styles.chipOn]}>
                <Text style={[styles.chipText, mealType === m && { color: colors.bg }]}>{m[0].toUpperCase() + m.slice(1)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Nutrition</Text>
          <View style={styles.card}>
            {FIELDS.map((k, i) => (
              <View key={k} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={[styles.dot, { backgroundColor: k === "calories" ? colors.accent : macroMeta[k].color }]} />
                <Text style={styles.rowLabel}>{k === "calories" ? "Calories" : macroMeta[k].label}</Text>
                <TextInput
                  value={values[k]}
                  onChangeText={(t) => setValues({ ...values, [k]: t.replace(/[^0-9]/g, "") })}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.faint}
                  style={styles.numInput}
                  maxLength={5}
                  selectTextOnFocus
                />
                <Text style={styles.unit}>{k === "calories" ? "kcal" : "g"}</Text>
              </View>
            ))}
          </View>

          {existing && existing.items.length > 0 && (
            <>
              <Text style={styles.label}>What we saw</Text>
              <View style={styles.card}>
                {existing.items.map((it, i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{it.name}</Text>
                      <Text style={styles.muted}>{it.portion}</Text>
                    </View>
                    <Text style={styles.rowLabel}>{Math.round(it.calories * existing.servings)} kcal</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {existing && <SecondaryButton label="Delete meal" onPress={remove} danger />}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.footerInner}>
          <SecondaryButton label="Cancel" onPress={close} />
          <PrimaryButton label={isNew ? "Add meal" : "Save"} onPress={save} disabled={!valid} style={{ flex: 1 }} />
        </View>
      </View>

      <Pressable onPress={close} style={[styles.closeBtn, { top: insets.top + 12 }]} hitSlop={10}>
        <Icon name="close" size={22} />
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", gap: 16 },
  photo: { width: "100%", height: 280, backgroundColor: colors.card },
  kicker: { ...font.label, color: colors.muted },
  title: { ...font.h1, color: colors.text },
  label: { ...font.label, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  input: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingVertical: 8 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { ...font.body, color: colors.text, flex: 1 },
  numInput: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 90,
    textAlign: "right",
  },
  unit: { ...font.caption, color: colors.muted, width: 30 },
  muted: { ...font.caption, color: colors.muted },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.scrim, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  footerInner: { flexDirection: "row", gap: 10, width: "100%", maxWidth: 520, alignSelf: "center" },
  closeBtn: {
    position: "absolute",
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});
