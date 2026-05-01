import React from "react";
import { Alert, Linking, ScrollView, Share, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { radii, spacing } from "../theme/tokens";
import ProduceBubble from "../components/decor/ProduceBubble";

const ANDROID_PACKAGE = "com.anonymous.mobileapp";

export default function RateAppScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();

  const copy = language === "tr"
    ? {
        back: "← Geri",
        title: "Uygulamayı Değerlendir",
        subtitle: "Deneyimini puanla, paylaş veya mağaza bağlantısını aç.",
        openStore: "Mağaza Sayfasını Aç",
        share: "Uygulamayı Paylaş",
        support: "Geri Bildirim Gönder",
        storeError: "Mağaza bağlantısı açılamadı.",
      }
    : {
        back: "← Back",
        title: "Rate the App",
        subtitle: "Rate your experience, share the app, or open the store page.",
        openStore: "Open Store Page",
        share: "Share App",
        support: "Send Feedback",
        storeError: "The store link could not be opened.",
      };

  async function handleOpenStore() {
    const storeUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
    const marketUrl = `market://details?id=${ANDROID_PACKAGE}`;

    try {
      const canOpenMarket = await Linking.canOpenURL(marketUrl);
      await Linking.openURL(canOpenMarket ? marketUrl : storeUrl);
    } catch {
      Alert.alert(copy.title, copy.storeError);
    }
  }

  async function handleShare() {
    await Share.share({
      message: `MyDietitian: https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
    });
  }

  async function handleSupport() {
    const url = `mailto:support@mydietitian.app?subject=${encodeURIComponent("MyDietitian Feedback")}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(copy.title, copy.storeError);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={32}
        iconColor={`${theme.primary}40`}
        style={[s.topGlow, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="corn"
        iconSize={34}
        iconColor={`${theme.primary}42`}
        style={[s.bottomGlow, { backgroundColor: theme.emeraldGlow }]}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => (navigation as any).goBack()} style={s.backRow}>
          <Text style={[s.backText, { color: theme.primary }]}>{copy.back}</Text>
        </TouchableOpacity>

        <Text style={[s.title, { color: theme.text }]}>{copy.title}</Text>
        <Text style={[s.subtitle, { color: theme.textSub }]}>{copy.subtitle}</Text>

        <View style={[s.starsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.starsTitle, { color: theme.text }]}>{language === "tr" ? "Bizi puanla" : "Rate us"}</Text>
          <View style={s.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <View key={star} style={[s.starBubble, { backgroundColor: `${theme.accentGold}16`, borderColor: `${theme.accentGold}28` }]}>
                <Ionicons name="star" size={20} color={theme.accentGold} />
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={[s.action, { backgroundColor: theme.primary }]} onPress={() => void handleOpenStore()} activeOpacity={0.84}>
          <Text style={s.actionText}>{copy.openStore}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.secondary, { borderColor: theme.border }]} onPress={() => void handleShare()} activeOpacity={0.84}>
          <Text style={[s.secondaryText, { color: theme.text }]}>{copy.share}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.secondary, { borderColor: theme.border }]} onPress={() => void handleSupport()} activeOpacity={0.84}>
          <Text style={[s.secondaryText, { color: theme.text }]}>{copy.support}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topGlow: {
    position: "absolute",
    top: -72,
    right: -56,
    width: 188,
    height: 188,
    borderRadius: 94,
    opacity: 0.84,
  },
  bottomGlow: {
    position: "absolute",
    bottom: -88,
    left: -72,
    width: 208,
    height: 208,
    borderRadius: 104,
    opacity: 0.7,
  },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl + 16, paddingBottom: 140 },
  backRow: { marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: "900" },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { marginTop: 6, marginBottom: spacing.lg, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  starsCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  starsTitle: { fontSize: 16, fontWeight: "900", marginBottom: spacing.md },
  starRow: { flexDirection: "row", gap: 10 },
  starBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  action: {
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginBottom: spacing.sm,
  },
  actionText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  secondary: {
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginBottom: spacing.sm,
  },
  secondaryText: { fontSize: 14, fontWeight: "800" },
});

