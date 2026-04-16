import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { radii, spacing } from "../theme/tokens";
import ProduceBubble from "../components/decor/ProduceBubble";
import {
  getClientPreferences,
  updateClientPreferences,
  type ClientGoalPreferences,
} from "../api/preferences";

type PreferenceOption = { value: string; labelTr: string; labelEn: string };

const PRIMARY_GOALS: PreferenceOption[] = [
  { value: "Balance", labelTr: "Denge", labelEn: "Balance" },
  { value: "FatLoss", labelTr: "Yağ kaybı", labelEn: "Fat loss" },
  { value: "MuscleSupport", labelTr: "Kas desteği", labelEn: "Muscle support" },
  { value: "GutCare", labelTr: "Sindirim konforu", labelEn: "Gut care" },
];

const DIET_STYLES: PreferenceOption[] = [
  { value: "Flexible", labelTr: "Esnek", labelEn: "Flexible" },
  { value: "HighProtein", labelTr: "Protein odaklı", labelEn: "High protein" },
  { value: "Mediterranean", labelTr: "Akdeniz", labelEn: "Mediterranean" },
  { value: "LowSugar", labelTr: "Düşük şeker", labelEn: "Low sugar" },
];

const COOKING_TIMES: PreferenceOption[] = [
  { value: "Quick", labelTr: "15 dk", labelEn: "15 min" },
  { value: "Balanced", labelTr: "30 dk", labelEn: "30 min" },
  { value: "Weekend", labelTr: "45+ dk", labelEn: "45+ min" },
];

const REMINDER_TONES: PreferenceOption[] = [
  { value: "Supportive", labelTr: "Sakin", labelEn: "Supportive" },
  { value: "Coach", labelTr: "Koç gibi", labelEn: "Coach" },
  { value: "Minimal", labelTr: "Minimal", labelEn: "Minimal" },
];

export default function GoalPreferencesScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const insets = useSafeAreaInsets();

  const [preferences, setPreferences] = useState<ClientGoalPreferences>({
    primaryGoal: "Balance",
    dietStyle: "Flexible",
    cookingTimePreference: "Quick",
    reminderTone: "Supportive",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const copy = language === "en"
    ? {
        back: "Back",
        eyebrow: "GOAL SETUP",
        title: "Goal Preferences",
        subtitle: "Shape pantry, reminders and kitchen suggestions around your rhythm.",
        save: "Save preferences",
        saved: "Preferences saved",
        primaryGoal: "Primary goal",
        dietStyle: "Diet style",
        cookingTime: "Cooking pace",
        reminderTone: "Reminder tone",
      }
    : {
        back: "Geri",
        eyebrow: "HEDEF AYARI",
        title: "Hedef Tercihleri",
        subtitle: "Pantry, hatırlatıcılar ve mutfak önerileri ritmine göre şekillensin.",
        save: "Tercihleri kaydet",
        saved: "Tercihler kaydedildi",
        primaryGoal: "Ana hedef",
        dietStyle: "Beslenme stili",
        cookingTime: "Pişme hızı",
        reminderTone: "Hatırlatıcı tonu",
      };

  const load = useCallback(async () => {
    try {
      const data = await getClientPreferences();
      setPreferences(data);
    } catch {
      setPreferences({
        primaryGoal: "Balance",
        dietStyle: "Flexible",
        cookingTimePreference: "Quick",
        reminderTone: "Supportive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  async function handleSave() {
    setSaving(true);
    try {
      const next = await updateClientPreferences(preferences);
      setPreferences(next);
      Alert.alert("OK", copy.saved);
    } catch {
      Alert.alert("Error", language === "tr" ? "Tercihler kaydedilemedi." : "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }

  function renderOptionGroup(
    title: string,
    selected: string,
    options: PreferenceOption[],
    onSelect: (value: string) => void,
  ) {
    return (
      <View style={[s.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[s.groupTitle, { color: theme.text }]}>{title}</Text>
        <View style={s.optionWrap}>
          {options.map((option) => {
            const active = selected === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  s.optionChip,
                  {
                    backgroundColor: active ? `${theme.primary}16` : theme.surfaceElevated,
                    borderColor: active ? `${theme.primary}34` : theme.border,
                  },
                ]}
                onPress={() => onSelect(option.value)}
              >
                <Text style={[s.optionChipTxt, { color: active ? theme.primaryDark : theme.text }]}>
                  {language === "tr" ? option.labelTr : option.labelEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <ProduceBubble
        icon="leaf"
        iconSize={28}
        iconColor={`${theme.primary}40`}
        style={[s.glowA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="fruit-pear"
        iconSize={24}
        iconColor={`${theme.emerald}40`}
        style={[s.glowB, { backgroundColor: theme.emeraldGlow }]}
      />

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 20) + 48 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => (navigation as any).goBack()}
        >
          <Ionicons name="chevron-back" size={16} color={theme.textSub} />
          <Text style={[s.backTxt, { color: theme.textSub }]}>{copy.back}</Text>
        </TouchableOpacity>

        <View style={[s.hero, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <View style={[s.eyebrow, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
            <Text style={[s.eyebrowTxt, { color: theme.primaryDark }]}>{copy.eyebrow}</Text>
          </View>
          <Text style={[s.heroTitle, { color: theme.text }]}>{copy.title}</Text>
          <Text style={[s.heroSub, { color: theme.textSub }]}>{copy.subtitle}</Text>
        </View>

        {loading ? (
          <View style={[s.loadingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <>
            {renderOptionGroup(copy.primaryGoal, preferences.primaryGoal, PRIMARY_GOALS, (value) => {
              setPreferences((prev) => ({ ...prev, primaryGoal: value }));
            })}
            {renderOptionGroup(copy.dietStyle, preferences.dietStyle, DIET_STYLES, (value) => {
              setPreferences((prev) => ({ ...prev, dietStyle: value }));
            })}
            {renderOptionGroup(copy.cookingTime, preferences.cookingTimePreference, COOKING_TIMES, (value) => {
              setPreferences((prev) => ({ ...prev, cookingTimePreference: value }));
            })}
            {renderOptionGroup(copy.reminderTone, preferences.reminderTone, REMINDER_TONES, (value) => {
              setPreferences((prev) => ({ ...prev, reminderTone: value }));
            })}
          </>
        )}

        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnTxt}>{copy.save}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  glowA: {
    position: "absolute",
    top: -42,
    right: -26,
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.44,
  },
  glowB: {
    position: "absolute",
    bottom: 120,
    left: -64,
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.34,
  },
  scroll: { paddingHorizontal: spacing.base },
  backBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: spacing.base,
  },
  backTxt: { fontSize: 13, fontWeight: "700" },
  hero: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  eyebrow: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: spacing.base,
  },
  eyebrowTxt: { fontSize: 11, fontWeight: "800" },
  heroTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  heroSub: { fontSize: 13, lineHeight: 19 },
  loadingCard: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    paddingVertical: 40,
    alignItems: "center",
    marginBottom: spacing.base,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optionChipTxt: { fontSize: 12, fontWeight: "800" },
  saveBtn: {
    marginTop: spacing.sm,
    minHeight: 54,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnTxt: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});


