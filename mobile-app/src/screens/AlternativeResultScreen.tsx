import React, { useRef, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Alert } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { radii, spacing } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import type { AlternativeDecisionResponse } from "../types/alternative";
import { addIngredientsToShoppingList } from "../api/shopping-list";
import { alternativeMeal } from "../data/plansRepo";

type R = RouteProp<{
  params: {
    decision: AlternativeDecisionResponse;
    recipeName: string;
    mealId: string;
    plannedRecipeId: string;
  };
}, "params">;

type MatchState = "FULL_MATCH" | "HAS_ALTERNATIVE" | "NO_ALTERNATIVE";

function getMatchState(canCook: boolean, hasAlternative: boolean): MatchState {
  if (canCook) return "FULL_MATCH";
  if (hasAlternative) return "HAS_ALTERNATIVE";
  return "NO_ALTERNATIVE";
}

function buildExplanationFromPayload(
  matchState: MatchState,
  missingCount: number,
  altMatchPct?: number,
): string {
  if (matchState === "FULL_MATCH") {
    return "Tüm malzemeler tamam! Hemen yapabilirsin.";
  }
  if (matchState === "HAS_ALTERNATIVE") {
    if (altMatchPct !== undefined && altMatchPct >= 90) {
      return `Harika uyum! Alternatif tarif %${Math.round(altMatchPct)} uyumlu.`;
    }
    if (altMatchPct !== undefined) {
      return `Alternatif tarif bulundu — %${Math.round(altMatchPct)} uyum.`;
    }
    return "Elindekilere uygun bir alternatif tarif bulduk.";
  }
  if (missingCount > 0) {
    return `${missingCount} zorunlu malzeme eksik — şu an yapılamaz.`;
  }
  return "Şu an uygun tarif bulunamadı.";
}

export default function AlternativeResultScreen() {
  const nav = useNavigation();
  const route = useRoute<R>();
  const { theme } = useTheme();
  const { decision, recipeName, mealId, plannedRecipeId } = route.params;

  const [addingToList, setAddingToList] = useState(false);
  const [adoptingAlt, setAdoptingAlt] = useState(false);

  const canCook = decision?.canCookOriginal ?? false;
  const alt = decision?.alternativeRecommendation;
  const hasAlternative = !!alt;
  const missingIds = decision?.missingIngredients ?? [];
  const missingNames = decision?.missingIngredientNames ?? [];
  const missingCount = missingIds.length;

  const matchState = getMatchState(canCook, hasAlternative);
  const explanation = buildExplanationFromPayload(matchState, missingCount, alt?.matchPercentage);

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.88)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(heroScale, { toValue: 1, damping: 14, stiffness: 130, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, damping: 18, stiffness: 120, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const stateColor = matchState === "FULL_MATCH" ? theme.primary : matchState === "HAS_ALTERNATIVE" ? theme.warning : theme.error;
  const stripeBg = stateColor + '18';
  const heroBorder = stateColor + '38';
  const heroBg = stateColor + '08';
  const iconBg = stateColor + '20';
  const iconBorder = stateColor + '40';

  const HERO_ICON: Record<MatchState, string> = { FULL_MATCH: "✓", HAS_ALTERNATIVE: "⇄", NO_ALTERNATIVE: "✕" };
  const HERO_LABEL: Record<MatchState, string> = { FULL_MATCH: "Yapılabilir", HAS_ALTERNATIVE: "Alternatif Önerildi", NO_ALTERNATIVE: "Yapılamaz" };

  async function handleAddMissingToList() {
    if (missingIds.length === 0) return;
    setAddingToList(true);
    try {
      await addIngredientsToShoppingList(missingIds, 'PlannedRecipe', plannedRecipeId);
      Alert.alert(
        'Listeye Eklendi',
        `${missingIds.length} eksik malzeme alışveriş listenize eklendi.`,
        [{ text: 'Tamam', onPress: () => (nav as any).goBack() }],
      );
    } catch {
      Alert.alert('Hata', 'Malzemeler listeye eklenemedi.');
    } finally {
      setAddingToList(false);
    }
  }

  async function handleAdoptAlternative() {
    if (!alt?.recipeId || !mealId) return;
    setAdoptingAlt(true);
    try {
      await alternativeMeal(mealId, alt.recipeId);
      Alert.alert(
        'Alternatif Seçildi',
        `"${alt.recipeName}" planınıza eklendi.`,
        [{ text: 'Tamam', onPress: () => (nav as any).popToTop() }],
      );
    } catch {
      Alert.alert('Hata', 'Alternatif seçilirken bir sorun oluştu.');
    } finally {
      setAdoptingAlt(false);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <View style={[s.stripeBg, { backgroundColor: stripeBg }]} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <Animated.View style={[
          s.heroCard,
          { borderColor: heroBorder, backgroundColor: heroBg, opacity: heroFade, transform: [{ scale: heroScale }] },
        ]}>
          <View style={[s.heroIconWrap, { backgroundColor: iconBg, borderColor: iconBorder }]}>
            <Text style={[s.heroIconText, { color: stateColor }]}>{HERO_ICON[matchState]}</Text>
          </View>
          <View style={s.heroTextBlock}>
            <Text style={[s.heroStatus, { color: stateColor }]}>{HERO_LABEL[matchState]}</Text>
            <Text style={[s.heroRecipeName, { color: theme.text }]} numberOfLines={2}>{recipeName ?? "Tarif"}</Text>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: contentFade, transform: [{ translateY: contentSlide }], gap: spacing.md }}>

          {/* FULL_MATCH */}
          {matchState === "FULL_MATCH" && (
            <View style={[s.card, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '30' }]}>
              <Text style={[s.cardLabel, { color: theme.primary }]}>DEĞERLENDİRME</Text>
              <Text style={[s.successNote, { color: theme.primary }]}>{explanation}</Text>
            </View>
          )}

          {/* Explanation (non-FULL_MATCH) */}
          {matchState !== "FULL_MATCH" && !!explanation && (
            <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.cardLabel, { color: theme.textMuted }]}>DEĞERLENDİRME</Text>
              <Text style={[s.explanationText, { color: theme.text }]}>{explanation}</Text>
            </View>
          )}

          {/* Missing ingredients list */}
          {missingNames.length > 0 && matchState !== "FULL_MATCH" && (
            <View style={[s.card, { backgroundColor: theme.warning + '07', borderColor: theme.warning + '30' }]}>
              <Text style={[s.cardLabel, { color: theme.warning }]}>EKSİK MALZEMELER</Text>
              <View style={s.missingList}>
                {missingNames.map((name, i) => (
                  <View key={i} style={[s.missingChip, { backgroundColor: theme.warning + '14', borderColor: theme.warning + '38' }]}>
                    <Text style={[s.missingChipText, { color: theme.text }]}>{name}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: theme.warning + '14', borderColor: theme.warning + '50' }]}
                onPress={handleAddMissingToList}
                disabled={addingToList}
                activeOpacity={0.8}
              >
                <Text style={[s.actionBtnText, { color: theme.warning }]}>
                  {addingToList ? 'Ekleniyor...' : 'Eksikleri Alışveriş Listesine Ekle'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* HAS_ALTERNATIVE */}
          {matchState === "HAS_ALTERNATIVE" && alt && (
            <View style={[s.card, { backgroundColor: theme.warning + '08', borderColor: theme.warning + '38' }]}>
              <View style={s.altBadgeRow}>
                <View style={[s.altBadge, { backgroundColor: theme.warning + '25', borderColor: theme.warning + '55' }]}>
                  <Text style={[s.altBadgeText, { color: theme.text }]}>Alternatif Tarif</Text>
                </View>
                {alt.matchPercentage != null && (
                  <View style={[s.matchPill, { backgroundColor: theme.primary + '14', borderColor: theme.primary + '25' }]}>
                    <Text style={[s.matchPillText, { color: theme.primary }]}>%{Math.round(alt.matchPercentage)} uyum</Text>
                  </View>
                )}
              </View>
              <Text style={[s.altName, { color: theme.text }]}>{alt.recipeName}</Text>
              {!!alt.nutritionalComparison && (
                <View style={s.nutritionRow}>
                  <Text style={[s.nutritionBullet, { color: theme.textMuted }]}>•</Text>
                  <Text style={[s.nutritionNote, { color: theme.textSub }]}>{alt.nutritionalComparison}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[s.actionBtn, s.adoptBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={handleAdoptAlternative}
                disabled={adoptingAlt}
                activeOpacity={0.85}
              >
                <Text style={[s.actionBtnText, { color: '#FFF' }]}>
                  {adoptingAlt ? 'Seçiliyor...' : 'Bu Alternatifi Seç'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* NO_ALTERNATIVE empty state */}
          {matchState === "NO_ALTERNATIVE" && (
            <View style={[s.card, s.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={s.emptyIcon}>🛒</Text>
              <Text style={[s.emptyTitle, { color: theme.text }]}>Alternatif bulunamadı</Text>
              <Text style={[s.emptyText, { color: theme.textSub }]}>
                Şu an mevcut malzemelerinle uyumlu bir alternatif tarif yok. Diyetisyeninle görüşebilirsin.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Back CTA */}
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => (nav as any).goBack()}
          activeOpacity={0.8}
        >
          <Text style={[s.backBtnText, { color: theme.text }]}>Geri Dön</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  stripeBg: { height: 220, position: "absolute", top: 0, left: 0, right: 0 },
  scroll: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: spacing.lg, gap: spacing.md },

  heroCard: { borderRadius: radii.xl, borderWidth: 1.5, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  heroIconWrap: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  heroIconText: { fontSize: 22, fontWeight: "900" },
  heroTextBlock: { flex: 1 },
  heroStatus: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  heroRecipeName: { fontSize: 18, fontWeight: "900", lineHeight: 24 },

  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg },
  cardLabel: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing.sm },
  successNote: { fontSize: 15, fontWeight: "700", lineHeight: 22 },
  explanationText: { fontSize: 14, fontWeight: "600", lineHeight: 22 },

  missingList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  missingChip: { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  missingChipText: { fontSize: 12, fontWeight: '700' },

  actionBtn: { borderRadius: radii.full, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', marginTop: spacing.sm },
  adoptBtn: { marginTop: spacing.md },
  actionBtnText: { fontSize: 14, fontWeight: '800' },

  altBadgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  altBadge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  altBadgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  matchPill: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  matchPillText: { fontSize: 11, fontWeight: "800" },
  altName: { fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
  nutritionRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 2 },
  nutritionBullet: { fontSize: 14, lineHeight: 20 },
  nutritionNote: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 20 },

  emptyCard: { alignItems: "center", paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 44, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 20, paddingHorizontal: spacing.sm },

  backBtn: { marginTop: spacing.sm, alignSelf: "center", borderWidth: 1, borderRadius: radii.xl, paddingVertical: 14, paddingHorizontal: spacing.xl },
  backBtnText: { fontWeight: "900", fontSize: 15 },
});
