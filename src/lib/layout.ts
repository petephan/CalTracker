import { Platform, StyleSheet, type TextStyle } from "react-native";

/** Content caps at a phone-like width and centers on tablets / foldables / landscape. */
export const MAX_WIDTH = 560;

export const screen = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 18, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
});

/**
 * Hides the browser's focus ring on a web TextInput, for inputs whose container shows focus itself.
 * RN's types don't allow outlineStyle "none", but react-native-web passes it through.
 */
export const noFocusRing = (Platform.OS === "web" ? { outlineStyle: "none" } : {}) as unknown as TextStyle;
