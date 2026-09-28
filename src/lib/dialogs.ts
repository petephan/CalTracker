import { Alert, Platform } from "react-native";

// React Native's Alert does nothing on web, so fall back to the browser's own dialogs there.

export function confirmAsync(title: string, message: string, confirmLabel = "Delete"): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

export function showAlert(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
