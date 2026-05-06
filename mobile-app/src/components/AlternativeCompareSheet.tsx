import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { radii, spacing } from "../theme/tokens";
import type { MealItem } from "../data/plansRepo";

const MEAL_TYPE_META: Record<string, { icon: string; label: string }> = {
  Breakfast:  { icon: "sunny-outline",      label: "Kahvaltı"      },
  MidMorning: { icon: "nutrition-outline",  label: "Ara Öğün"      },
  Lunch:      { icon: "restaurant-outline", label: "Öğle"          },
  Afternoon:  { icon: "cafe-outline",       label: "İkindi"        },
  Dinner:     { icon: "moon-outline",       label: "Akşam"         },
  Evening:    { icon: "sparkles-outline",   label: "Gece Arası"    },
  Snack:      { icon: "leaf-outline",       label: "Atıştırmalık"  },
};

interface Props {
  meal: MealItem | null;
  onClose: () => void;
  onUndo: () => void;
  onChooseAnotherAlternative?: () => void;
  onViewAlternativeRecipe?: () => void;
}

export default function AlternativeCompareSheet({ meal, onClose, onUndo, onChooseAnotherAlternative, onViewAlternativeRecipe }: Props) {
  const { theme } = useTheme();
  const visible = meal !== null;

  const translateY      = useRef(new Animated.Value(600)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      translateY.setValue(600);
      backdropOpacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 180, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  function dismiss() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 600, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onClose);
  }

  if (!meal) return null;

  const meta     = MEAL_TYPE_META[meal.mealType] ?? MEAL_TYPE_META.Snack;
  const hasMacros = meal.calories || meal.macros?.proteinGrams || meal.macros?.carbsGrams || meal.macros?.fatGrams;
  const alternativeRecipeId =
    meal.selectedRecipeSource === "Alternative" && meal.selectedRecipeId && meal.selectedRecipeId !== meal.recipeId
      ? meal.selectedRecipeId
      : (meal.alternativeRecipeId ?? meal.selectedRecipeId);
  const alternativeRecipeName =
    meal.selectedRecipeSource === "Alternative" && meal.selectedRecipeName
      ? meal.selectedRecipeName
      : (meal.alternativeRecipeName ?? meal.selectedRecipeName ?? "Alternatif Tarif");
  const alternativeCalories =
    meal.selectedRecipeSource === "Alternative"
      ? (meal.selectedCalories ?? meal.alternativeCalories)
      : (meal.alternativeCalories ?? meal.selectedCalories);
  const alternativeMacros =
    meal.selectedRecipeSource === "Alternative"
      ? (meal.selectedMacros ?? meal.alternativeMacros)
      : (meal.alternativeMacros ?? meal.selectedMacros);
  const hasAlternativeMacros = alternativeCalories || alternativeMacros?.proteinGrams || alternativeMacros?.carbsGrams || alternativeMacros?.fatGrams;

  const backdropColor = backdropOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.46)"],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <View style={s.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor as any }]} />
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />

        <Animated.View
          style={[s.sheet, { backgroundColor: theme.surface, borderColor: theme.border, transform: [{ translateY }] }]}
        >
          <View style={[s.handle, { backgroundColor: theme.border }]} />

          {/* â”€â”€ Header â”€â”€ */}
          <View style={s.headerRow}>
            <View style={[s.iconWrap, { backgroundColor: `${theme.accent}1A`, borderColor: `${theme.accent}30` }]}>
              <Ionicons name="swap-horizontal-outline" size={18} color={theme.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[s.headerTitle, { color: theme.text }]}>Alternatif Öğün Detayı</Text>
              <Text style={[s.headerSub, { color: theme.textMuted }]}>
                {meal.time} · {meta.label}
              </Text>
            </View>
            <View style={[s.altBadge, { backgroundColor: `${theme.accent}18`, borderColor: `${theme.accent}30` }]}>
              <Text style={[s.altBadgeTxt, { color: theme.accent }]}>ALTERNATİF</Text>
            </View>
          </View>

          <View style={[s.divider, { backgroundColor: theme.border }]} />

          {/* â”€â”€ Comparison â”€â”€ */}
          <View style={s.compareRow}>
            {/* Left â€” original planned meal */}
            <View style={[s.compareCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.compareCardLabel, { color: theme.textMuted }]}>Planlanan</Text>
              <Ionicons
                name={meta.icon as any}
                size={22}
                color={theme.textSub}
                style={{ marginVertical: 8 }}
              />
              <Text style={[s.compareCardName, { color: theme.textSub }]} numberOfLines={3}>
                {meal.recipeName ?? meal.title}
              </Text>
              {hasMacros && !!meal.calories && (
                <Text style={[s.compareCardMacro, { color: theme.textMuted }]}>
                  {meal.calories} kcal
                </Text>
              )}
            </View>

            {/* Arrow */}
            <View style={s.arrowCol}>
              <View style={[s.arrowCircle, { backgroundColor: `${theme.accent}18`, borderColor: `${theme.accent}30` }]}>
                <Ionicons name="arrow-forward" size={16} color={theme.accent} />
              </View>
            </View>

            {/* Right â€” alternative */}
            <View style={[s.compareCard, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Text style={[s.compareCardLabel, { color: theme.emerald }]}>Yenilen</Text>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={theme.emerald}
                style={{ marginVertical: 8 }}
              />
              <Text style={[s.compareCardName, { color: theme.text }]} numberOfLines={3}>
                {alternativeRecipeName}
              </Text>
              <Text style={[s.compareCardMacro, { color: theme.emerald }]}>✓ Kaydedildi</Text>
            </View>
          </View>

          {/* â”€â”€ Macros if available â”€â”€ */}
          <View style={[s.infoBanner, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}26` }]}>
            <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
            <Text style={[s.infoBannerTxt, { color: theme.textSub }]}>
              Alternatif tercihin plan akışında tamamlanmış sayıldı. İstersen geri alıp planlanan öğüne dönebilir ya da başka bir alternatif deneyebilirsin.
            </Text>
          </View>

          {hasMacros && (
            <View style={[s.macroBar, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.macroBarLabel, { color: theme.textMuted }]}>Planlanan besin değerleri</Text>
              <View style={s.macroChipsRow}>
                {!!meal.calories && (
                  <View style={[s.chip, { backgroundColor: `${theme.macroCalorie}18`, borderColor: `${theme.macroCalorie}30` }]}>
                    <Text style={[s.chipTxt, { color: theme.macroCalorie }]}>{meal.calories} kcal</Text>
                  </View>
                )}
                {!!meal.macros?.proteinGrams && (
                  <View style={[s.chip, { backgroundColor: `${theme.macroProtein}18`, borderColor: `${theme.macroProtein}30` }]}>
                    <Text style={[s.chipTxt, { color: theme.macroProtein }]}>P {meal.macros.proteinGrams}g</Text>
                  </View>
                )}
                {!!meal.macros?.carbsGrams && (
                  <View style={[s.chip, { backgroundColor: `${theme.macroCarb}18`, borderColor: `${theme.macroCarb}30` }]}>
                    <Text style={[s.chipTxt, { color: theme.macroCarb }]}>K {meal.macros.carbsGrams}g</Text>
                  </View>
                )}
                {!!meal.macros?.fatGrams && (
                  <View style={[s.chip, { backgroundColor: `${theme.macroFat}18`, borderColor: `${theme.macroFat}30` }]}>
                    <Text style={[s.chipTxt, { color: theme.macroFat }]}>Y {meal.macros.fatGrams}g</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* â”€â”€ Actions â”€â”€ */}
          {hasAlternativeMacros && (
            <View style={[s.macroBar, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Text style={[s.macroBarLabel, { color: theme.emerald }]}>Seçilen alternatif</Text>
              <View style={s.macroChipsRow}>
                {!!alternativeCalories && (
                  <View style={[s.chip, { backgroundColor: `${theme.macroCalorie}18`, borderColor: `${theme.macroCalorie}30` }]}>
                    <Text style={[s.chipTxt, { color: theme.macroCalorie }]}>{alternativeCalories} kcal</Text>
                  </View>
                )}
                {!!alternativeMacros?.proteinGrams && (
                  <View style={[s.chip, { backgroundColor: `${theme.macroProtein}18`, borderColor: `${theme.macroProtein}30` }]}>
                    <Text style={[s.chipTxt, { color: theme.macroProtein }]}>P {alternativeMacros.proteinGrams}g</Text>
                  </View>
                )}
                {!!alternativeMacros?.carbsGrams && (
                  <View style={[s.chip, { backgroundColor: `${theme.macroCarb}18`, borderColor: `${theme.macroCarb}30` }]}>
                    <Text style={[s.chipTxt, { color: theme.macroCarb }]}>K {alternativeMacros.carbsGrams}g</Text>
                  </View>
                )}
                {!!alternativeMacros?.fatGrams && (
                  <View style={[s.chip, { backgroundColor: `${theme.macroFat}18`, borderColor: `${theme.macroFat}30` }]}>
                    <Text style={[s.chipTxt, { color: theme.macroFat }]}>Y {alternativeMacros.fatGrams}g</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={s.actions}>
            {!!alternativeRecipeId && !!onViewAlternativeRecipe && (
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: theme.primary }]}
                onPress={() => { dismiss(); onViewAlternativeRecipe(); }}
                activeOpacity={0.8}
              >
                <Ionicons name="book-outline" size={16} color="#fff" />
                <Text style={s.primaryBtnTxt}>Alternatif Tarifi Gör</Text>
              </TouchableOpacity>
            )}

            {!!meal.recipeId && !!onChooseAnotherAlternative && (
              <TouchableOpacity
                style={[s.secondaryBtn, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}
                onPress={() => { dismiss(); onChooseAnotherAlternative(); }}
                activeOpacity={0.75}
              >
                <Ionicons name="swap-horizontal-outline" size={15} color={theme.emerald} />
                <Text style={[s.secondaryBtnTxt, { color: theme.emerald }]}>Başka alternatif dene</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={() => { dismiss(); onUndo(); }}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-undo-outline" size={15} color={theme.textMuted} />
              <Text style={[s.secondaryBtnTxt, { color: theme.textMuted }]}>Geri Al</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.ghostBtn, { borderColor: theme.border }]}
              onPress={dismiss}
              activeOpacity={0.7}
            >
              <Text style={[s.ghostBtnTxt, { color: theme.textMuted }]}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },

  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 4,
  },

  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 16,
  },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  headerSub:   { fontSize: 12, fontWeight: "600", marginTop: 1 },
  altBadge: {
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: radii.full, borderWidth: 1,
  },
  altBadgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },

  divider: { height: 1, marginHorizontal: -spacing.lg, marginBottom: 20 },

  compareRow: { flexDirection: "row", gap: 0, marginBottom: 14 },
  compareCard: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  compareCardLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" },
  compareCardName:  { fontSize: 13, fontWeight: "800", textAlign: "center", lineHeight: 18 },
  compareCardMacro: { fontSize: 11, fontWeight: "700", marginTop: 6 },

  arrowCol: { width: 36, alignItems: "center", justifyContent: "center" },
  arrowCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  infoBannerTxt: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 18 },

  macroBar: {
    borderRadius: radii.lg, borderWidth: 1,
    padding: 12, marginBottom: 4,
  },
  macroBarLabel: { fontSize: 10, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  macroChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: radii.full, borderWidth: 1,
  },
  chipTxt: { fontSize: 11, fontWeight: "800" },

  actions: { marginTop: 16, gap: 10 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 15, borderRadius: radii.xl,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6,
  },
  primaryBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "900" },

  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: radii.xl, borderWidth: 1,
  },
  secondaryBtnTxt: { fontSize: 14, fontWeight: "800" },

  ghostBtn: {
    alignItems: "center", paddingVertical: 11, borderRadius: radii.lg, borderWidth: 1,
  },
  ghostBtnTxt: { fontSize: 13, fontWeight: "700" },
});

