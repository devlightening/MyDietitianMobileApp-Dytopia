import React from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DytopiaWatermark from "../components/decor/DytopiaWatermark";
import ProduceBubble from "../components/decor/ProduceBubble";
import PressableScale from "../components/ui/PressableScale";
import { useFeedback } from "../context/FeedbackContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { radii, spacing } from "../theme/tokens";

export default function ProfileFeedbackScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const {
    feedbackMode,
    setFeedbackMode,
    toastDurationMs,
    setToastDurationMs,
    timerBannerEnabled,
    setTimerBannerEnabled,
    showToast,
    showDialog,
  } = useFeedback();

  const tr = language === "tr";
  const modes = [
    { key: "full" as const, icon: "sparkles-outline" as const, title: tr ? "Full" : "Full", body: tr ? "Toast + dialog + haptic aktif" : "Toast + dialog + haptics enabled" },
    { key: "haptic" as const, icon: "phone-portrait-outline" as const, title: tr ? "Haptic" : "Haptic", body: tr ? "Sessiz ama dokunsal geri bildirim" : "Quiet but tactile feedback" },
    { key: "silent" as const, icon: "moon-outline" as const, title: tr ? "Silent" : "Silent", body: tr ? "Minimum uyarı, titreşim yok" : "Minimal alerts, no haptics" },
  ];
  const durations = [2200, 3200, 5200];

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <DytopiaWatermark position="center" size={320} opacity={0.04} />
      <ProduceBubble icon="leaf" iconSize={34} iconColor={`${theme.primary}42`} style={[s.glowA, { backgroundColor: theme.primaryGlow }]} />
      <ProduceBubble icon="corn" iconSize={30} iconColor={`${theme.accentGold}42`} style={[s.glowB, { backgroundColor: `${theme.accentGold}22` }]} />

      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 20) + 20 }]} showsVerticalScrollIndicator={false}>
        <View style={s.nav}>
          <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => (navigation as any).goBack()} activeOpacity={0.82}>
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.navTitle, { color: theme.text }]}>{tr ? "Bildirim ve His" : "Feedback Center"}</Text>
          <View style={s.navSpacer} />
        </View>

        <View style={[s.hero, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <View style={[s.heroIcon, { backgroundColor: theme.primaryLight }]}>
            <MaterialCommunityIcons name="gesture-tap-button" size={34} color={theme.primary} />
          </View>
          <Text style={[s.title, { color: theme.text }]}>{tr ? "Uygulamanın sana nasıl dokunacağını seç" : "Choose how the app talks back"}</Text>
          <Text style={[s.subtitle, { color: theme.textSub }]}>
            {tr ? "Toast süresi, haptic profili ve pişirme timer banner davranışı burada yönetilir." : "Control toast timing, haptics, and cooking timer banner behavior here."}
          </Text>
        </View>

        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>{tr ? "Geri bildirim profili" : "Feedback profile"}</Text>
          <View style={s.modeGrid}>
            {modes.map((mode) => {
              const active = feedbackMode === mode.key;
              return (
                <PressableScale
                  key={mode.key}
                  style={[s.modeCard, { backgroundColor: active ? theme.primary : theme.surfaceElevated, borderColor: active ? theme.primary : theme.border }]}
                  onPress={() => void setFeedbackMode(mode.key)}
                >
                  <Ionicons name={mode.icon} size={20} color={active ? "#fff" : theme.primary} />
                  <Text style={[s.modeTitle, { color: active ? "#fff" : theme.text }]}>{mode.title}</Text>
                  <Text style={[s.modeBody, { color: active ? "rgba(255,255,255,0.78)" : theme.textMuted }]}>{mode.body}</Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>{tr ? "Toast süresi" : "Toast duration"}</Text>
          <View style={s.segmentRow}>
            {durations.map((duration) => {
              const active = toastDurationMs === duration;
              return (
                <TouchableOpacity
                  key={duration}
                  style={[s.segment, { backgroundColor: active ? theme.primaryLight : theme.surfaceElevated, borderColor: active ? theme.borderEmerald : theme.border }]}
                  onPress={() => void setToastDurationMs(duration)}
                  activeOpacity={0.84}
                >
                  <Text style={[s.segmentTxt, { color: active ? theme.primary : theme.textSub }]}>{duration / 1000}s</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>{tr ? "Mini timer banner" : "Mini timer banner"}</Text>
              <Text style={[s.rowBody, { color: theme.textMuted }]}>{tr ? "Pişirme timer’ı ekrandan çıksan bile üstte sakin şekilde yaşasın." : "Let cooking timers live calmly at the top while you move around."}</Text>
            </View>
            <TouchableOpacity
              style={[s.switch, { backgroundColor: timerBannerEnabled ? theme.primary : theme.surfaceElevated, borderColor: timerBannerEnabled ? theme.primary : theme.border }]}
              onPress={() => void setTimerBannerEnabled(!timerBannerEnabled)}
              activeOpacity={0.84}
            >
              <View style={[s.knob, { backgroundColor: "#fff", transform: [{ translateX: timerBannerEnabled ? 22 : 0 }] }]} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.testRow}>
          <TouchableOpacity
            style={[s.testBtn, { backgroundColor: theme.primary }]}
            onPress={() => showToast({ variant: "success", title: tr ? "Test bildirimi" : "Test toast", message: tr ? "Bu küçük bildirim böyle görünecek." : "This is how a small notification feels." })}
            activeOpacity={0.86}
          >
            <Ionicons name="notifications-outline" size={18} color="#fff" />
            <Text style={s.testTxt}>{tr ? "Toast dene" : "Try toast"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.testBtn, { backgroundColor: theme.accentGold }]}
            onPress={() => showDialog({
              variant: "info",
              icon: "sparkles-outline",
              eyebrow: tr ? "Önizleme" : "Preview",
              title: tr ? "Temalı dialog hazır" : "Themed dialog ready",
              message: tr ? "Native sistem uyarısı yerine Dytopia dili." : "Dytopia language instead of native alerts.",
              primaryAction: { label: tr ? "Harika" : "Nice" },
            })}
            activeOpacity={0.86}
          >
            <Ionicons name="albums-outline" size={18} color="#fff" />
            <Text style={s.testTxt}>{tr ? "Dialog dene" : "Try dialog"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.base },
  glowA: { position: "absolute", top: 70, right: -68, width: 220, height: 220, borderRadius: 110, opacity: 0.55 },
  glowB: { position: "absolute", bottom: 130, left: -76, width: 180, height: 180, borderRadius: 90, opacity: 0.42 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  backBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  navTitle: { fontSize: 17, fontWeight: "900" },
  navSpacer: { width: 42 },
  hero: { borderWidth: 1, borderRadius: radii.xxl, padding: 20, marginBottom: spacing.md },
  heroIcon: { width: 68, height: 68, borderRadius: 25, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -0.7 },
  subtitle: { fontSize: 14, lineHeight: 20, fontWeight: "600", marginTop: 8 },
  card: { borderWidth: 1, borderRadius: radii.xl, padding: 15, marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "900", marginBottom: 10 },
  modeGrid: { gap: 9 },
  modeCard: { borderWidth: 1, borderRadius: radii.xl, padding: 14, gap: 5 },
  modeTitle: { fontSize: 14, fontWeight: "900" },
  modeBody: { fontSize: 12, fontWeight: "700", lineHeight: 17 },
  segmentRow: { flexDirection: "row", gap: 9 },
  segment: { flex: 1, borderWidth: 1, borderRadius: radii.full, paddingVertical: 12, alignItems: "center" },
  segmentTxt: { fontSize: 13, fontWeight: "900" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  rowBody: { fontSize: 12.5, lineHeight: 18, fontWeight: "700" },
  switch: { width: 58, height: 34, borderRadius: 999, borderWidth: 1, padding: 3, justifyContent: "center" },
  knob: { width: 26, height: 26, borderRadius: 13 },
  testRow: { flexDirection: "row", gap: 10 },
  testBtn: { flex: 1, minHeight: 54, borderRadius: radii.full, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  testTxt: { color: "#fff", fontSize: 13.5, fontWeight: "900" },
});
