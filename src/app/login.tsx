import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/Button";
import { Logo } from "../components/Logo";
import { isValidEmail, MIN_PASSWORD } from "../lib/auth";
import { noFocusRing } from "../lib/layout";
import { useStore } from "../lib/store";
import { colors, font, radius } from "../lib/theme";

/** Sign in, or create an account. Accounts are Supabase logins, so the same one works on any device. */
export default function Login() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useStore();
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!isValidEmail(email)) return setError("Enter a valid email address.");
    if (creating && password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (!creating) await signIn(email, password);
      else if ((await signUp(email, password)) === "confirm-email") {
        setCreating(false);
        setPassword("");
        setNotice("Check your inbox and tap the link to confirm your email, then sign in.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setCreating((c) => !c);
    setError(null);
    setNotice(null);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <Logo size={34} />

          <View style={{ gap: 8 }}>
            <Text style={styles.title}>{creating ? "Create your account" : "Welcome back"}</Text>
            <Text style={styles.subtitle}>
              {creating ? "Track meals with a photo. Takes a minute to set up." : "Sign in to pick up where you left off."}
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            <Field
              label="Email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType={creating ? "username" : "emailAddress"}
              returnKeyType="next"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              placeholder={creating ? `At least ${MIN_PASSWORD} characters` : "Your password"}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={creating ? "new-password" : "current-password"}
              textContentType={creating ? "newPassword" : "password"}
              returnKeyType="go"
              onSubmitEditing={submit}
              trailing={
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Text style={styles.link}>{showPassword ? "Hide" : "Show"}</Text>
                </Pressable>
              }
            />
            {error && <Text style={styles.error}>{error}</Text>}
            {notice && <Text style={styles.muted}>{notice}</Text>}
          </View>

          <PrimaryButton
            label={busy ? "One moment…" : creating ? "Create account" : "Sign in"}
            onPress={submit}
            disabled={busy || !email || !password}
          />

          <Pressable onPress={switchMode} hitSlop={8} style={{ alignSelf: "center" }}>
            <Text style={styles.muted}>
              {creating ? "Already have an account? " : "New to CalSnap? "}
              <Text style={styles.link}>{creating ? "Sign in" : "Create an account"}</Text>
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>Your meals and plan sync to your account.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, trailing, ...input }: TextInputProps & { label: string; trailing?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <TextInput
          {...input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={colors.faint}
          style={[styles.input, noFocusRing]}
        />
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: "space-between", paddingHorizontal: 24, gap: 24 },
  inner: { flex: 1, justifyContent: "center", gap: 28, width: "100%", maxWidth: 400, alignSelf: "center" },
  title: { ...font.h1, color: colors.text },
  subtitle: { ...font.body, color: colors.muted, lineHeight: 21 },
  label: { ...font.label, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldFocused: { borderColor: colors.accent },
  input: { flex: 1, alignSelf: "stretch", color: colors.text, fontSize: 16 },
  link: { ...font.label, color: colors.accent },
  muted: { ...font.label, color: colors.muted },
  error: { ...font.label, color: colors.text },
  footer: { ...font.caption, color: colors.faint, textAlign: "center" },
});
