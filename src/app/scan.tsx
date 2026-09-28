import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { showAlert } from "../lib/dialogs";
import { pendingPhoto, preparePhoto } from "../lib/photo";
import { colors, font } from "../lib/theme";

export default function Scan() {
  const insets = useSafeAreaInsets();
  const { day } = useLocalSearchParams<{ day?: string }>();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const handoff = async (uri: string) => {
    setBusy(true);
    try {
      pendingPhoto.set(await preparePhoto(uri));
      router.replace(day ? { pathname: "/result", params: { day } } : "/result");
    } catch (e) {
      console.warn(e);
      showAlert("Couldn't process that photo", "Please try again.");
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!camera.current || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9 });
      await handoff(photo.uri);
    } catch (e) {
      console.warn(e);
      showAlert("Camera error", "Couldn't take the photo. Try again or choose from your library.");
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (!res.canceled && res.assets[0]) await handoff(res.assets[0].uri);
  };

  const granted = permission?.granted;

  return (
    <View style={styles.root}>
      {granted ? (
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.permission]}>
          <Icon name="camera" size={40} color={colors.tealLight} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>Snap your meal and we&apos;ll estimate its calories and macros.</Text>
          {permission && (
            <Pressable style={styles.permButton} onPress={permission.canAskAgain ? requestPermission : () => Linking.openSettings()}>
              <Text style={styles.permButtonText}>{permission.canAskAgain ? "Allow camera" : "Open Settings to allow"}</Text>
            </Pressable>
          )}
          <Text style={styles.permBody}>…or pick a photo from your library below.</Text>
        </View>
      )}

      {/* Viewfinder */}
      {granted && (
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.tip}>Fit the whole plate in the frame · good light helps</Text>
        </View>
      )}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.roundBtn} hitSlop={10}>
          <Icon name="close" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Scan food</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={pick} style={styles.roundBtn} disabled={busy}>
          <Icon name="image" size={22} color="#fff" />
        </Pressable>
        <Pressable onPress={capture} disabled={!granted || !ready || busy} style={[styles.shutter, (!granted || !ready) && { opacity: 0.4 }]}>
          {busy ? <ActivityIndicator color={colors.bg} /> : <View style={styles.shutterInner} />}
        </Pressable>
        <View style={{ width: 44 }} />
      </View>
    </View>
  );
}

const C = 34;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  permission: { alignItems: "center", justifyContent: "center", gap: 12, padding: 32, backgroundColor: "#000" },
  permTitle: { ...font.h2, color: "#fff" },
  permBody: { ...font.body, color: colors.muted, textAlign: "center" },
  permButton: { backgroundColor: colors.teal, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, marginVertical: 8 },
  permButtonText: { color: colors.onPrimary, fontWeight: "700", fontSize: 15 },
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 18 },
  frame: { width: "80%", aspectRatio: 1 },
  corner: { position: "absolute", width: C, height: C, borderColor: "#fff" },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 20 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 20 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 20 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 20 },
  tip: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    overflow: "hidden",
  },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  title: { ...font.body, color: "#fff", fontWeight: "700" },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 40 },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#fff" },
});
