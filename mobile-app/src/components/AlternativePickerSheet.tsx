import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { radii, spacing } from "../theme/tokens";
import { alternativeMeal, completeMeal, type MealItem } from "../data/plansRepo";
import { decideAlternative } from "../api/alternative";
import { getPantry } from "../api/pantry";
import type { AlternativeDecisionResponse, AlternativeRecipe } from "../types/alternative";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W - spacing.lg * 2 - 32;

const MEAL_TYPE_INDEX: Record<string, number> = {
  Breakfast: 1,
  MidMorning: 4,
  Lunch: 2,
  Afternoon: 4,
  Dinner: 3,
  Evening: 4,
  Snack: 4,
};

function buildDecisionSummary(result: AlternativeDecisionResponse | null): string {
  if (!result) return "";

  if (result.canCookOriginal && result.alternativeRecommendations.length === 0) {
    return "Planlanan öğünü elindeki malzemelerle hazırlayabilirsin.";
  }

  if (result.alternativeRecommendations.length > 0) {
    return "Elindeki malzemeler ve besin dengesi birlikte değerlendirilerek en uygun alternatifler sıralandı.";
  }

  if (result.missingIngredientNames.length > 0) {
    return `${result.missingIngredientNames.length} zorunlu malzeme eksik görünüyor. Dilersen önce eksikleri tamamlayabilirsin.`;
  }

  return "Şu an için daha uygun bir alternatif bulunamadı.";
}

function buildFallbackReasons(alt: AlternativeRecipe): string[] {
  const reasons: string[] = [];

  if ((alt.nutritionalScore ?? 0) >= 85) {
    reasons.push("Besin dengesi planlanan öğüne çok yakın.");
  } else if ((alt.nutritionalScore ?? 0) >= 70) {
    reasons.push("Besin dengesi planlanan öğüne yakın kalır.");
  }

  if (!(alt.missingIngredientNamesForAlternative?.length ?? 0)) {
    reasons.push("Ek zorunlu malzeme gerektirmez.");
  }

  if ((alt.matchPercentage ?? 0) >= 85) {
    reasons.push("Elindeki malzemelerin büyük çoğuyla hazırlanabilir.");
  } else if ((alt.matchPercentage ?? 0) >= 70) {
    reasons.push("Mutfaktaki malzemelerle büyük ölçüde uyumludur.");
  }

  if (reasons.length === 0) {
    reasons.push("Planlanan öğüne göre kontrollü bir esneklik sunar.");
  }

  return reasons.slice(0, 3);
}

function getRecommendationReasons(alt: AlternativeRecipe): string[] {
  const reasons = alt.recommendationReasons?.filter(Boolean) ?? [];
  return (reasons.length > 0 ? reasons : buildFallbackReasons(alt)).slice(0, 3);
}

function getPlanAlignmentNote(alt: AlternativeRecipe): string {
  if (alt.planAlignmentNote?.trim()) {
    return alt.planAlignmentNote.trim();
  }

  if ((alt.nutritionalScore ?? 0) >= 85 && (alt.matchPercentage ?? 0) >= 80) {
    return "Plan uyumunu yüksek düzeyde korur.";
  }

  if ((alt.combinedScore ?? 0) >= 75) {
    return "Plan akışına yakın kalır.";
  }

  return "Esnek bir tercih olarak dengeli kalır.";
}

function getPlanAlignmentLabel(alt: AlternativeRecipe): string {
  const note = getPlanAlignmentNote(alt).toLowerCase();

  if (note.includes("yüksek") || note.includes("yuksek")) {
    return "Plan uyumu yüksek";
  }

  if (note.includes("yakın") || note.includes("yakin")) {
    return "Plana yakın";
  }

  return "Esnek uyum";
}

function getAlignmentColors(alt: AlternativeRecipe, theme: any) {
  const combinedScore = alt.combinedScore ?? 0;

  if (combinedScore >= 85) {
    return { text: theme.emerald, bg: `${theme.emerald}14`, border: `${theme.emerald}34` };
  }

  if (combinedScore >= 70) {
    return { text: theme.primary, bg: `${theme.primary}12`, border: `${theme.primary}32` };
  }

  return { text: theme.warning, bg: `${theme.warning}14`, border: `${theme.warning}34` };
}

interface Props {
  meal: MealItem | null;
  onClose: () => void;
  onConfirmed: (payload?: { type: "alternative" | "original"; recipeName?: string }) => void;
}

export default function AlternativePickerSheet({ meal, onClose, onConfirmed }: Props) {
  const { theme } = useTheme();
  const visible = meal !== null;

  const translateY = useRef(new Animated.Value(600)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AlternativeDecisionResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const loadRef = useRef<(() => Promise<void>) | null>(null);

  loadRef.current = async () => {
    if (!meal?.recipeId) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setActiveIndex(0);

    try {
      const pantryItems = await getPantry();
      const ids = pantryItems.map((item) => item.ingredientId);
      const response = await decideAlternative({
        plannedRecipeId: meal.recipeId,
        mealType: MEAL_TYPE_INDEX[meal.mealType] ?? 4,
        clientAvailableIngredients: ids,
      });

      setResult(response);
    } catch {
      setError("Alternatif yüklenemedi. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      translateY.setValue(600);
      backdropOpacity.setValue(0);
      setResult(null);
      setError(null);
      setActing(false);
      setActiveIndex(0);
      return;
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();

    void loadRef.current?.();
  }, [visible, meal?.id, translateY, backdropOpacity]);

  function dismiss() {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 600,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(onClose);
  }

  async function handleSelectAlternative(alt: AlternativeRecipe) {
    if (!meal) return;

    setActing(true);
    try {
      await alternativeMeal(meal.id, alt.recipeId);
      onConfirmed({ type: "alternative", recipeName: alt.recipeName });
      dismiss();
    } catch {
      setError("İşlem gerçekleştirilemedi. Tekrar deneyin.");
      setActing(false);
    }
  }

  async function handleCookOriginal() {
    if (!meal) return;

    setActing(true);
    try {
      await completeMeal(meal.id);
      onConfirmed({ type: "original" });
      dismiss();
    } catch {
      setError("İşlem gerçekleştirilemedi. Tekrar deneyin.");
      setActing(false);
    }
  }

  const alternatives = result?.alternativeRecommendations ?? [];
  const canCook = result?.canCookOriginal;
  const decisionSummary = buildDecisionSummary(result);

  const selectedAlt = useMemo(
    () => alternatives[activeIndex] ?? null,
    [activeIndex, alternatives]
  );
  const selectedAltReasons = selectedAlt ? getRecommendationReasons(selectedAlt) : [];
  const selectedAltAlignmentNote = selectedAlt ? getPlanAlignmentNote(selectedAlt) : "";
  const selectedAltMissingNames = selectedAlt?.missingIngredientNamesForAlternative ?? [];
  const selectedAltAlignmentColors = selectedAlt ? getAlignmentColors(selectedAlt, theme) : null;

  if (!meal) return null;

  const backdropColor = backdropOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.46)"],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor as any }]} />
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              transform: [{ translateY }],
            },
          ]}
        >
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            <View style={styles.headerRow}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${theme.accent}1A`, borderColor: `${theme.accent}30` },
                ]}
              >
                <Ionicons name="swap-horizontal-outline" size={18} color={theme.accent} />
              </View>
              <View style={styles.headerBody}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Alternatif Öğün</Text>
                <Text style={[styles.headerSub, { color: theme.textMuted }]} numberOfLines={1}>
                  {meal.recipeName ?? meal.title}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {loading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator color={theme.primary} size="large" />
                <Text style={[styles.centerText, { color: theme.textMuted }]}>
                  Besin değerlerine göre alternatifiniz aranıyorâ€¦
                </Text>
              </View>
            ) : null}

            {!loading && error ? (
              <View style={styles.centerBlock}>
                <Ionicons name="alert-circle-outline" size={28} color={theme.textMuted} />
                <Text style={[styles.centerText, { color: theme.textMuted }]}>{error}</Text>
                <TouchableOpacity
                  onPress={() => void loadRef.current?.()}
                  style={[styles.retryButton, { borderColor: theme.border }]}
                >
                  <Text style={[styles.retryText, { color: theme.primary }]}>Tekrar Dene</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!loading && result ? (
              <View style={styles.resultArea}>
                {decisionSummary ? (
                  <View
                    style={[
                      styles.explanationBox,
                      {
                        backgroundColor: theme.surfaceElevated,
                        borderLeftColor: theme.borderEmerald,
                      },
                    ]}
                  >
                    <Text style={[styles.explanationText, { color: theme.textSub }]}>
                      {decisionSummary}
                    </Text>
                  </View>
                ) : null}

                {canCook && alternatives.length === 0 ? (
                  <View
                    style={[
                      styles.statusBox,
                      {
                        backgroundColor: theme.glassEmerald,
                        borderColor: theme.borderEmerald,
                      },
                    ]}
                  >
                    <Ionicons name="checkmark-circle-outline" size={22} color={theme.emerald} />
                    <Text style={[styles.statusText, { color: theme.emerald }]}>
                      Elinizdekilerle orijinal tarifi yapabilirsiniz.
                    </Text>
                  </View>
                ) : null}

                {!canCook && alternatives.length === 0 ? (
                  <View
                    style={[
                      styles.statusBox,
                      { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                    ]}
                  >
                    <Ionicons name="information-circle-outline" size={22} color={theme.textMuted} />
                    <Text style={[styles.statusText, { color: theme.textMuted }]}>
                      Elinizdekilerle uygun bir alternatif bulunamadı.
                    </Text>
                  </View>
                ) : null}

                {selectedAlt && selectedAltAlignmentColors ? (
                  <View
                    style={[
                      styles.insightCard,
                      { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                    ]}
                  >
                    <View style={styles.insightHeader}>
                      <Text style={[styles.insightTitle, { color: theme.text }]}>
                        Neden önerildi?
                      </Text>
                      <View
                        style={[
                          styles.alignmentBadge,
                          {
                            backgroundColor: selectedAltAlignmentColors.bg,
                            borderColor: selectedAltAlignmentColors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name="sparkles-outline"
                          size={12}
                          color={selectedAltAlignmentColors.text}
                        />
                        <Text
                          style={[
                            styles.alignmentBadgeText,
                            { color: selectedAltAlignmentColors.text },
                          ]}
                        >
                          {getPlanAlignmentLabel(selectedAlt)}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.alignmentNote, { color: theme.textSub }]}>
                      {selectedAltAlignmentNote}
                    </Text>

                    <View style={styles.reasonList}>
                      {selectedAltReasons.map((reason, index) => (
                        <View
                          key={`${selectedAlt.recipeId}-reason-${index}`}
                          style={[
                            styles.reasonChip,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                          ]}
                        >
                          <Ionicons name="checkmark-circle-outline" size={13} color={theme.primary} />
                          <Text style={[styles.reasonChipText, { color: theme.text }]}>{reason}</Text>
                        </View>
                      ))}
                    </View>

                    {selectedAltMissingNames.length > 0 ? (
                      <View
                        style={[
                          styles.missingBox,
                          {
                            backgroundColor: `${theme.warning}10`,
                            borderColor: `${theme.warning}28`,
                          },
                        ]}
                      >
                        <Ionicons name="basket-outline" size={14} color={theme.warning} />
                        <Text style={[styles.missingText, { color: theme.textSub }]}>
                          Ek gerekebilir: {selectedAltMissingNames.join(", ")}
                        </Text>
                      </View>
                    ) : null}

                    <Text style={[styles.selectionHint, { color: theme.textMuted }]}>
                      Seçtiğinde öğün alternatif tercih ile tamamlandı olarak kaydedilir.
                    </Text>
                  </View>
                ) : null}

                {alternatives.length > 0 ? (
                  <View>
                    <View style={styles.carouselHeader}>
                      <Text style={[styles.carouselLabel, { color: theme.textMuted }]}>
                        {alternatives.length === 1
                          ? "Önerilen Alternatif"
                          : `${alternatives.length} Alternatif Tarif`}
                      </Text>
                      {alternatives.length > 1 ? (
                        <Text style={[styles.swipeHint, { color: theme.textMuted }]}>
                          â† kaydır â†’
                        </Text>
                      ) : null}
                    </View>

                    <FlatList
                      data={alternatives}
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      snapToInterval={CARD_W + 12}
                      decelerationRate="fast"
                      keyExtractor={(item) => item.recipeId}
                      onMomentumScrollEnd={(event) => {
                        const idx = Math.round(
                          event.nativeEvent.contentOffset.x / (CARD_W + 12)
                        );
                        setActiveIndex(Math.max(0, Math.min(idx, alternatives.length - 1)));
                      }}
                      renderItem={({ item, index }) => (
                        <AlternativeCard
                          alt={item}
                          rank={index + 1}
                          total={alternatives.length}
                          theme={theme}
                          width={CARD_W}
                        />
                      )}
                      ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                      contentContainerStyle={{ paddingRight: 4 }}
                      style={{ marginHorizontal: -4 }}
                    />

                    {alternatives.length > 1 ? (
                      <View style={styles.dotsRow}>
                        {alternatives.map((_, index) => (
                          <View
                            key={index}
                            style={[
                              styles.dot,
                              { backgroundColor: index === activeIndex ? theme.primary : theme.border },
                            ]}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            {selectedAlt && !acting ? (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={() => void handleSelectAlternative(selectedAlt)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={17} color="#fff" />
                <Text style={styles.primaryButtonText}>Bu Alternatifi Seç</Text>
              </TouchableOpacity>
            ) : null}

            {acting ? (
              <View
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.primary, justifyContent: "center" },
                ]}
              >
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : null}

            {!acting ? (
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.glassEmerald,
                    borderColor: theme.borderEmerald,
                  },
                ]}
                onPress={() => void handleCookOriginal()}
                activeOpacity={0.8}
              >
                <Ionicons name="restaurant" size={16} color={theme.emerald} />
                <Text style={[styles.secondaryButtonText, { color: theme.emerald }]}>
                  Orijinali Yaptım
                </Text>
              </TouchableOpacity>
            ) : null}

            {!acting ? (
              <TouchableOpacity
                style={[styles.ghostButton, { borderColor: theme.border }]}
                onPress={dismiss}
                activeOpacity={0.7}
              >
                <Text style={[styles.ghostButtonText, { color: theme.textMuted }]}>Kapat</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function AlternativeCard({
  alt,
  rank,
  total,
  theme,
  width,
}: {
  alt: AlternativeRecipe;
  rank: number;
  total: number;
  theme: any;
  width: number;
}) {
  const nutritionalScore = alt.nutritionalScore ?? 0;
  const matchPct = alt.matchPercentage ?? 0;
  const combinedScore = alt.combinedScore ?? 0;

  const scoreColor =
    combinedScore >= 75 ? theme.emerald : combinedScore >= 50 ? theme.primary : theme.warning;

  return (
    <View
      style={[
        cardStyles.card,
        {
          width,
          backgroundColor: theme.surfaceElevated,
          borderColor: `${scoreColor}30`,
        },
      ]}
    >
      {total > 1 ? (
        <View
          style={[
            cardStyles.rankBadge,
            { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}30` },
          ]}
        >
          <Text style={[cardStyles.rankText, { color: theme.primary }]}>
            {rank}/{total}
          </Text>
        </View>
      ) : null}

      <Text style={[cardStyles.recipeName, { color: theme.text }]} numberOfLines={2}>
        {alt.recipeName}
      </Text>

      {alt.nutritionalComparison ? (
        <View
          style={[
            cardStyles.comparisonCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View
            style={[
              cardStyles.comparisonIconWrap,
              { backgroundColor: `${scoreColor}14`, borderColor: `${scoreColor}24` },
            ]}
          >
            <Ionicons name="analytics-outline" size={14} color={scoreColor} />
          </View>
          <View style={cardStyles.comparisonBody}>
            <Text style={[cardStyles.comparisonEyebrow, { color: theme.textMuted }]}>
              Planlanan öğüne göre
            </Text>
            <Text style={[cardStyles.comparisonValue, { color: theme.text }]} numberOfLines={2}>
              {alt.nutritionalComparison}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={cardStyles.scoreRow}>
        <View
          style={[
            cardStyles.scorePill,
            { backgroundColor: `${scoreColor}14`, borderColor: `${scoreColor}30` },
          ]}
        >
          <Text style={[cardStyles.scoreLabel, { color: scoreColor }]}>Uyum</Text>
          <Text style={[cardStyles.scoreValue, { color: scoreColor }]}>
            %{Math.round(combinedScore)}
          </Text>
        </View>

        <View
          style={[
            cardStyles.scorePill,
            { backgroundColor: `${theme.emerald}10`, borderColor: `${theme.emerald}25` },
          ]}
        >
          <Text style={[cardStyles.scoreLabel, { color: theme.emerald }]}>Besin</Text>
          <Text style={[cardStyles.scoreValue, { color: theme.emerald }]}>
            %{Math.round(nutritionalScore)}
          </Text>
        </View>

        <View
          style={[
            cardStyles.scorePill,
            { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}25` },
          ]}
        >
          <Text style={[cardStyles.scoreLabel, { color: theme.primary }]}>Malzeme</Text>
          <Text style={[cardStyles.scoreValue, { color: theme.primary }]}>
            %{Math.round(matchPct)}
          </Text>
        </View>
      </View>

      {alt.caloriesKcal || alt.proteinGrams || alt.fatGrams || alt.carbsGrams ? (
        <View
          style={[
            cardStyles.macroRow,
            { backgroundColor: `${theme.primary}08`, borderColor: `${theme.primary}18` },
          ]}
        >
          {alt.caloriesKcal != null ? (
            <MacroChip
              label="kcal"
              value={String(alt.caloriesKcal)}
              color={theme.macroCalorie ?? theme.primary}
              theme={theme}
            />
          ) : null}
          {alt.proteinGrams != null ? (
            <MacroChip
              label="Protein"
              value={`${alt.proteinGrams}g`}
              color={theme.macroProtein ?? theme.emerald}
              theme={theme}
            />
          ) : null}
          {alt.carbsGrams != null ? (
            <MacroChip
              label="Karb"
              value={`${alt.carbsGrams}g`}
              color={theme.macroCarb ?? theme.accentGold}
              theme={theme}
            />
          ) : null}
          {alt.fatGrams != null ? (
            <MacroChip
              label="Yağ"
              value={`${alt.fatGrams}g`}
              color={theme.macroFat ?? theme.accentCoral}
              theme={theme}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MacroChip({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  color: string;
  theme: any;
}) {
  return (
    <View style={cardStyles.macroChip}>
      <Text style={[cardStyles.macroValue, { color: theme.text }]}>{value}</Text>
      <Text style={[cardStyles.macroLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 4,
    maxHeight: "90%",
    overflow: "hidden",
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerBody: {
    flex: 1,
    marginLeft: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: -spacing.lg,
    marginBottom: 16,
  },
  centerBlock: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 10,
  },
  centerText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 280,
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "800",
  },
  resultArea: {
    gap: 12,
  },
  explanationBox: {
    borderLeftWidth: 3,
    borderRadius: radii.md,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 10,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 19,
  },
  insightCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  insightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  insightTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  alignmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  alignmentBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  alignmentNote: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  reasonList: {
    gap: 8,
  },
  reasonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  reasonChipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  missingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  missingText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  selectionHint: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  carouselHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  carouselLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  swipeHint: {
    fontSize: 11,
    fontWeight: "600",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actions: {
    marginTop: 8,
    gap: 10,
    paddingTop: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: radii.xl,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },
  ghostButton: {
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  ghostButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  rankBadge: {
    alignSelf: "flex-start",
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  recipeName: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 21,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 8,
  },
  scorePill: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: 6,
    alignItems: "center",
    gap: 2,
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: "900",
  },
  comparisonCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  comparisonIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  comparisonBody: {
    flex: 1,
    gap: 2,
  },
  comparisonEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  comparisonValue: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  macroRow: {
    flexDirection: "row",
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 10,
  },
  macroChip: {
    flex: 1,
    alignItems: "center",
  },
  macroValue: {
    fontSize: 13,
    fontWeight: "900",
  },
  macroLabel: {
    fontSize: 9,
    fontWeight: "700",
    marginTop: 1,
  },
});

