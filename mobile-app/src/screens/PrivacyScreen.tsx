import React from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { radii, spacing } from "../theme/tokens";
import ProduceBubble from "../components/decor/ProduceBubble";

export default function PrivacyScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();

  const copy = language === "tr"
    ? {
        back: "â† Geri",
        title: "Gizlilik",
        subtitle: "Verilerinin uygulama içinde nasıl kullanıldığını açık şekilde gör.",
        items: [
          {
            title: "Hesap verileri",
            body: "Ad, e-posta ve premium durumu giriş, profil ve diyetisyen eşleştirmesi için tutulur.",
          },
          {
            title: "Ölçümler ve takip",
            body: "Bel, kalça, göğüs, su ve plan tamamlama kayıtları sadece kişisel takip ve analiz akışlarında kullanılır.",
          },
          {
            title: "Bildirim ayarları",
            body: "Su, öğün, ölçüm ve geri çağırma ayarların hesabına bağlı saklanır; cihazında yerel bildirim programı oluşturulur.",
          },
          {
            title: "Mutfak ve tarif akışı",
            body: "Seçtiğin malzemeler tarif öneri motorunda kullanılır; amaç kişisel öneri ve tez kapsamındaki değerlendirme akışını güçlendirmektir.",
          },
        ],
      }
    : {
        back: "â† Back",
        title: "Privacy",
        subtitle: "See clearly how your data is used inside the app.",
        items: [
          {
            title: "Account data",
            body: "Name, email, and premium status are stored for sign-in, profile, and dietitian linking flows.",
          },
          {
            title: "Measurements and tracking",
            body: "Waist, hip, chest, water, and plan completion records are used only for personal tracking and analysis flows.",
          },
          {
            title: "Notification preferences",
            body: "Your water, meal, measurement, and re-engagement settings are stored with your account and scheduled locally on your device.",
          },
          {
            title: "Kitchen and recipe flow",
            body: "The ingredients you select are used by the recipe recommendation engine to produce personal suggestions and thesis-aligned evaluation flows.",
          },
        ],
      };

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <ProduceBubble
        icon="fruit-pear"
        iconSize={32}
        iconColor={`${theme.primary}40`}
        style={[s.topGlow, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="leaf"
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

        {copy.items.map((item) => (
          <View key={item.title} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardTitle, { color: theme.text }]}>{item.title}</Text>
            <Text style={[s.cardBody, { color: theme.textSub }]}>{item.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topGlow: {
    position: "absolute",
    top: -70,
    right: -60,
    width: 190,
    height: 190,
    borderRadius: 95,
    opacity: 0.84,
  },
  bottomGlow: {
    position: "absolute",
    bottom: -90,
    left: -70,
    width: 210,
    height: 210,
    borderRadius: 105,
    opacity: 0.7,
  },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl + 16, paddingBottom: 140 },
  backRow: { marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: "900" },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { marginTop: 6, marginBottom: spacing.lg, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", marginBottom: 8 },
  cardBody: { fontSize: 13, fontWeight: "600", lineHeight: 20 },
});

