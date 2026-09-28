import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { checkServer, defaultServerUrl } from "../../lib/api";
import { confirmAsync, showAlert } from "../../lib/dialogs";
import { noFocusRing, screen } from "../../lib/layout";
import { Icon } from "../../components/Icon";
import { ensurePermission } from "../../lib/notifications";
import { deletePhoto } from "../../lib/photo";
import { ACTIVITY_OPTIONS, calculatePlan, formatHeight, formatPace, formatWeight, GOAL_TITLE } from "../../lib/plan";
import { DEFAULT_GOALS, DEFAULT_REMINDERS, useStore } from "../../lib/store";
import { colors, font, macroMeta, radius } from "../../lib/theme";
import type { Goals, ReminderItem } from "../../lib/types";

/** react-native-web ignores thumbColor for the "on" state and uses its own green unless this is set. */
const WEB_SWITCH = { activeThumbColor: colors.onPrimary } as object;

/** A short note under each reminder's name explaining when it's skipped. */
function reminderHint(r: ReminderItem): string {
  if (r.kind === "custom") return "Every day";
  if (r.kind === "streak") return "Only if nothing's logged that day";
  return `Skipped once ${r.kind} is logged`;
}

const GOAL_MAX: Goals = { calories: 20000, protein: 2000, carbs: 2000, fat: 2000 };

export default function Settings() {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const [draft, setDraft] = useState<Record<keyof Goals, string>>(toStrings(store.goals));
  const [url, setUrl] = useState(store.serverUrl ?? "");
  const [serverStatus, setServerStatus] = useState<string | null>(null);
  const { profile, goals, setGoals } = store;

  // Goals can change from outside this screen (onboarding), so keep the text fields in sync.
  const [syncedGoals, setSyncedGoals] = useState(goals);
  if (syncedGoals !== goals) {
    setSyncedGoals(goals);
    setDraft(toStrings(goals));
  }

  const recommended = profile ? calculatePlan(profile).goals : null;
  const usingRecommended =
    !!recommended && (Object.keys(recommended) as (keyof Goals)[]).every((k) => recommended[k] === goals[k]);

  const commitGoal = (k: keyof Goals) => {
    const n = parseInt(draft[k], 10);
    // Same caps as the database, so a typo can't make the goals fail to save.
    const next = Number.isFinite(n) && n > 0 ? { ...store.goals, [k]: Math.min(n, GOAL_MAX[k]) } : store.goals;
    store.setGoals(next);
    setDraft(toStrings(next));
  };

  /** Standard 30% protein / 40% carbs / 30% fat split from the calorie goal. */
  const autoMacros = () => {
    const c = store.goals.calories;
    const next = {
      calories: c,
      protein: Math.round((c * 0.3) / 4),
      carbs: Math.round((c * 0.4) / 4),
      fat: Math.round((c * 0.3) / 9),
    };
    store.setGoals(next);
    setDraft(toStrings(next));
  };

  /** Browsers can't receive CalSnap notifications, so reminders there are saved without asking for permission. */
  const canNotify = async () => {
    if (Platform.OS === "web" || (await ensurePermission())) return true;
    showAlert("Notifications are off", "Enable notifications for CalSnap in your device settings.");
    return false;
  };

  const setReminder = async (id: string, patch: Partial<Omit<ReminderItem, "id" | "kind">>) => {
    if (patch.enabled && !(await canNotify())) return;
    store.updateReminder(id, patch);
  };

  const addReminder = async () => {
    if (await canNotify()) store.addReminder();
  };

  const deleteReminder = async (r: ReminderItem) => {
    if (await confirmAsync("Delete this reminder?", r.label)) store.deleteReminder(r.id);
  };

  const missingDefaults = DEFAULT_REMINDERS.some((d) => !store.reminders.some((r) => r.id === d.id));

  const testServer = async () => {
    const target = url.trim() || defaultServerUrl();
    setServerStatus("Checking…");
    const res = await checkServer(target);
    setServerStatus(res.ok ? `Connected${res.demo ? " (demo mode)" : ` · ${res.model}`}` : `Can't reach ${target}`);
  };

  const reset = async () => {
    if (!(await confirmAsync("Erase all data?", "This deletes every logged meal, weigh-in and reminder, your streak and your plan. Your login stays.", "Erase")))
      return;
    try {
      await store.resetAll();
    } catch {
      return showAlert("Couldn't erase your data", "Check your connection and try again.");
    }
    store.meals.forEach((m) => deletePhoto(m.photoUri));
    setDraft(toStrings(DEFAULT_GOALS));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[screen.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 136 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        {profile && (
          <Section title="Your plan" action={{ label: "Update", onPress: () => router.push("/onboarding") }}>
            <Row first>
              <Text style={styles.label}>Goal</Text>
              <Text style={styles.value}>
                {GOAL_TITLE[profile.goal]}
                {profile.paceKgPerWeek ? ` · ${formatPace(profile.paceKgPerWeek, profile.units)}` : ""}
              </Text>
            </Row>
            <Row>
              <Text style={styles.label}>Body</Text>
              <Text style={styles.value}>
                {formatHeight(profile.heightCm, profile.units)} · {formatWeight(profile.weightKg, profile.units)}
                {profile.targetWeightKg ? ` → ${formatWeight(profile.targetWeightKg, profile.units)}` : ""}
              </Text>
            </Row>
            <Row>
              <Text style={styles.label}>Activity</Text>
              <Text style={styles.value}>{ACTIVITY_OPTIONS.find((a) => a.value === profile.activity)?.title}</Text>
            </Row>
          </Section>
        )}

        <Section
          title="Daily goals"
          subtitle={
            recommended && !usingRecommended
              ? `Your recommended targets are ${recommended.calories} kcal · P ${recommended.protein}g · C ${recommended.carbs}g · F ${recommended.fat}g.`
              : undefined
          }
          action={
            recommended && !usingRecommended
              ? { label: "Use recommended", onPress: () => setGoals(recommended) }
              : { label: "Auto-split macros", onPress: autoMacros }
          }
        >
          {(["calories", "protein", "carbs", "fat"] as const).map((k, i) => (
            <Row key={k} first={i === 0}>
              <View style={styles.labelWrap}>
                <View style={[styles.dot, { backgroundColor: k === "calories" ? colors.accent : macroMeta[k].color }]} />
                <Text style={styles.label}>{k === "calories" ? "Calories" : macroMeta[k].label}</Text>
              </View>
              <View style={styles.inputWrap}>
                <TextInput
                  value={draft[k]}
                  onChangeText={(t) => setDraft({ ...draft, [k]: t.replace(/[^0-9]/g, "") })}
                  onEndEditing={() => commitGoal(k)}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  style={styles.input}
                  maxLength={5}
                  selectTextOnFocus
                />
                <Text style={styles.unit}>{k === "calories" ? "kcal" : "g"}</Text>
              </View>
            </Row>
          ))}
        </Section>

        <Section
          title="Reminders"
          subtitle="Tap a name to rename it, or type a new time. Meal reminders skip meals you've already logged."
          action={missingDefaults ? { label: "Restore defaults", onPress: store.restoreDefaultReminders } : undefined}
        >
          {store.reminders.map((r, i) => (
            <Row key={r.id} first={i === 0}>
              <View style={{ flex: 1 }}>
                <ReminderName value={r.label} onCommit={(label) => setReminder(r.id, { label })} />
                <Text style={styles.hintText}>{reminderHint(r)}</Text>
                {r.enabled && (
                  <TimeField hour={r.hour} minute={r.minute} onChange={(hour, minute) => setReminder(r.id, { hour, minute })} />
                )}
              </View>
              <Pressable onPress={() => deleteReminder(r)} hitSlop={8} style={styles.trash} accessibilityLabel={`Delete ${r.label}`}>
                <Icon name="trash" size={16} color={colors.muted} />
              </Pressable>
              <Switch
                value={r.enabled}
                onValueChange={(v) => setReminder(r.id, { enabled: v })}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.onPrimary}
                {...WEB_SWITCH}
              />
            </Row>
          ))}
          <Row first={store.reminders.length === 0}>
            <Pressable onPress={addReminder} style={styles.addRow} hitSlop={6}>
              <Icon name="plus" size={18} color={colors.accent} />
              <Text style={styles.action}>Add reminder</Text>
            </Pressable>
          </Row>
        </Section>
        {Platform.OS === "web" && (
          <Text style={styles.subtitle}>Reminders are saved here but only notify you in the phone app.</Text>
        )}

        <Section title="AI server" subtitle={`Leave blank to auto-detect (${defaultServerUrl()}).`}>
          <Row first>
            <TextInput
              value={url}
              onChangeText={setUrl}
              onEndEditing={() => store.setServerUrl(url.trim() || null)}
              placeholder={defaultServerUrl()}
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, { flex: 1, textAlign: "left" }]}
            />
            <Pressable onPress={testServer} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Test</Text>
            </Pressable>
          </Row>
          {serverStatus && <Text style={styles.status}>{serverStatus}</Text>}
        </Section>

        {store.email && (
          <Section title="Account">
            <Row first>
              <Text style={[styles.label, { flex: 1 }]} numberOfLines={1}>
                {store.email}
              </Text>
              <Pressable onPress={store.signOut} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>Sign out</Text>
              </Pressable>
            </Row>
          </Section>
        )}

        <Pressable onPress={reset} style={styles.danger}>
          <Text style={styles.dangerText}>Erase all data</Text>
        </Pressable>
        <Text style={styles.footer}>CalSnap · synced to your account</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const toHour12 = (h: number) => String(h % 12 || 12);

/**
 * Type the time directly: hour, minute, then AM/PM. Out-of-range entries snap back to the saved time on blur.
 */
function TimeField({ hour, minute, onChange }: { hour: number; minute: number; onChange: (hour: number, minute: number) => void }) {
  const [h, setH] = useState(toHour12(hour));
  const [m, setM] = useState(pad2(minute));
  const [focused, setFocused] = useState<"h" | "m" | null>(null);
  const pm = hour >= 12;

  // Keep the fields in step when the saved time changes (e.g. after AM/PM or "Restore defaults").
  const [synced, setSynced] = useState(`${hour}:${minute}`);
  if (synced !== `${hour}:${minute}`) {
    setSynced(`${hour}:${minute}`);
    setH(toHour12(hour));
    setM(pad2(minute));
  }

  /** The typed time if it's valid, else the saved one. Reading the drafts means a half-typed hour isn't lost when AM/PM is tapped. */
  const current = () => {
    const hh = parseInt(h, 10);
    const mm = parseInt(m, 10);
    return hh >= 1 && hh <= 12 && mm >= 0 && mm <= 59 ? { hh, mm } : null;
  };

  const commit = () => {
    setFocused(null);
    const t = current();
    if (!t) {
      setH(toHour12(hour));
      setM(pad2(minute));
      return;
    }
    setM(pad2(t.mm));
    const h24 = (t.hh % 12) + (pm ? 12 : 0);
    if (h24 !== hour || t.mm !== minute) onChange(h24, t.mm);
  };

  const setPm = (next: boolean) => {
    const t = current() ?? { hh: hour % 12 || 12, mm: minute };
    onChange((t.hh % 12) + (next ? 12 : 0), t.mm);
  };

  const box = (which: "h" | "m", value: string, set: (t: string) => void, label: string) => (
    <TextInput
      value={value}
      onChangeText={(t) => set(t.replace(/[^0-9]/g, ""))}
      onFocus={() => setFocused(which)}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="number-pad"
      returnKeyType="done"
      maxLength={2}
      selectTextOnFocus
      accessibilityLabel={label}
      style={[styles.timeInput, focused === which && styles.timeInputFocused, noFocusRing]}
    />
  );

  return (
    <View style={styles.timeRow}>
      {box("h", h, setH, "Hour")}
      <Text style={styles.timeColon}>:</Text>
      {box("m", m, setM, "Minute")}
      <View style={styles.ampm}>
        {(["AM", "PM"] as const).map((p) => {
          const on = (p === "PM") === pm;
          return (
            <Pressable
              key={p}
              onPress={() => !on && setPm(p === "PM")}
              style={[styles.ampmBtn, on && styles.ampmOn]}
              accessibilityLabel={p}
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.ampmText, on && { color: colors.onPrimary }]}>{p}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Inline-editable reminder name. Saves on blur / return; an empty name falls back to the previous one. */
function ReminderName({ value, onCommit }: { value: string; onCommit: (label: string) => void }) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };
  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      returnKeyType="done"
      maxLength={40}
      placeholder="Reminder name"
      placeholderTextColor={colors.faint}
      style={[styles.nameInput, noFocusRing]}
      accessibilityLabel="Reminder name"
    />
  );
}

function toStrings(g: Goals) {
  return {
    calories: String(g.calories ?? DEFAULT_GOALS.calories),
    protein: String(g.protein ?? DEFAULT_GOALS.protein),
    carbs: String(g.carbs ?? DEFAULT_GOALS.carbs),
    fat: String(g.fat ?? DEFAULT_GOALS.fat),
  };
}

function Section({ title, subtitle, action, children }: {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && (
          <Pressable onPress={action.onPress} hitSlop={8}>
            <Text style={styles.action}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return <View style={[styles.row, !first && styles.rowBorder]}>{children}</View>;
}

const styles = StyleSheet.create({
  title: { ...font.h1, color: colors.text },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { ...font.label, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  action: { ...font.label, color: colors.accent },
  subtitle: { ...font.caption, color: colors.faint },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingVertical: 10, gap: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  labelWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { ...font.body, color: colors.text },
  value: { ...font.body, color: colors.muted, flex: 1, textAlign: "right" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  input: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    textAlign: "right",
  },
  unit: { ...font.caption, color: colors.muted, width: 30 },
  nameInput: {
    ...font.body,
    color: colors.text,
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  trash: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  hintText: { ...font.caption, color: colors.muted, marginTop: 2 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  timeInput: {
    width: 44,
    height: 36,
    padding: 0,
    textAlign: "center",
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.bg,
  },
  timeInputFocused: { borderColor: colors.accent, backgroundColor: colors.card },
  timeColon: { ...font.body, color: colors.muted, fontWeight: "700" },
  ampm: { flexDirection: "row", marginLeft: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  ampmBtn: { paddingHorizontal: 10, height: 34, justifyContent: "center" },
  ampmOn: { backgroundColor: colors.text },
  ampmText: { ...font.caption, color: colors.muted, fontWeight: "700" },
  smallBtn: { backgroundColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 9 },
  smallBtnText: { color: colors.text, fontWeight: "700" },
  status: { ...font.caption, color: colors.muted, paddingHorizontal: 4 },
  danger: { alignItems: "center", paddingVertical: 16, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.text, marginTop: 8 },
  dangerText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
  footer: { ...font.caption, color: colors.faint, textAlign: "center" },
});
