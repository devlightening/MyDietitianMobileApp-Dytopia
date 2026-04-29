import React, { useRef, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Alert, Dimensions,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { radii, spacing } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import type { AlternativeDecisionResponse, AlternativeRecipe } from "../types/alternative";
import { addIngredientsToShoppingList } from "../api/shopping-list";
import { alternativeMeal } from "../data/plansRepo";

const { width: SCREEN_W } = Dimensions.get("window");
// Each carousel page occupies the full screen width; card has internal horizontal padding.
const PAGE_W = SCREEN_W;
const CARD_PADDING_H = spacing.lg;

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

export default function AlternativeResultScreen() {
  const nav = useNavigation();
  const route = useRoute<R>();
  const { theme } = useTheme();
  const { decision, recipeName, mealId, plannedRecipeId } = route.params;

  const [addingToList, setAddingToList] = useState(false);
  const [adoptingIndex, setAdoptingIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const canCook    = decision?.canCookOriginal ?? false;
  const alts       = decision?.alternativeRecommendations ?? [];
  const hasAlts    = alts.length > 0;
  const missingIds = decision?.missingIngredients ?? [];
  const missingNames = decision?.missingIngredientNames ?? [];

  const matchState  = getMatchState(canCook, hasAlts);
  const stateColor  = matchState === "FULL_MATCH" ? theme.primary
    : matchState === "HAS_ALTERNATIVE" ? theme.warning : theme.error;

  const heroFade    = useRef(new Animated.Value(0)).current;
  const heroScale   = useRef(new Animated.Value(0.88)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroFade,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(heroScale, { toValue: 1, damping: 14, stiffness: 130, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentFade,  { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, damping: 18, stiffness: 120, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const HERO_ICON:  Record<MatchState, string> = { FULL_MATCH: "âœ“", HAS_ALTERNATIVE: "â‡„", NO_ALTERNATIVE: "âœ•" };
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

  async function handleAdoptAlternative(alt: AlternativeRecipe, idx: number) {
    if (!alt?.recipeId || !mealId) return;
    setAdoptingIndex(idx);
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
      setAdoptingIndex(null);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <View style={[s.stripeBg, { backgroundColor: stateColor + '18' }]} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        // Prevents the outer vertical ScrollView from hijacking horizontal swipes in the carousel.
        directionalLockEnabled
      >

        {/* Hero card */}
        <Animated.View style={[
          s.heroCard,
          { borderColor: stateColor + '38', backgroundColor: stateColor + '08',
            opacity: heroFade, transform: [{ scale: heroScale }] },
        ]}>
          <View style={[s.heroIconWrap, { backgroundColor: stateColor + '20', borderColor: stateColor + '40' }]}>
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
              <Text style={[s.successNote, { color: theme.primary }]}>
                Tüm malzemeler tamam! Hemen yapabilirsin.
              </Text>
            </View>
          )}

          {/* Original recipe's missing ingredients (explains why alternatives are shown) */}
          {missingNames.length > 0 && matchState !== "FULL_MATCH" && (
            <View style={[s.card, { backgroundColor: theme.warning + '07', borderColor: theme.warning + '30' }]}>
              <Text style={[s.cardLabel, { color: theme.warning }]}>ORIJINAL TARİFTE EKSİK</Text>
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

          {/* Alternatives carousel */}
          {hasAlts && (
            <View style={[s.carouselWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={s.altHeaderRow}>
                <Text style={[s.cardLabel, { color: theme.textMuted }]}>
                  {alts.length === 1 ? 'ÖNERİLEN ALTERNATİF' : `${alts.length} ALTERNATİF TARİF`}
                </Text>
                {alts.length > 1 && (
                  <Text style={[s.swipeHint, { color: theme.textMuted }]}>← kaydır →</Text>
                )}
              </View>

              {/* Horizontal ScrollView instead of FlatList â€” avoids nested-FlatList height issues.
                  Each page is full PAGE_W; card uses internal horizontal padding for visual inset. */}
              <Animated.ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                scrollEventThrottle={16}
                nestedScrollEnabled
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: true },
                )}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
                  setActiveIndex(Math.max(0, Math.min(idx, alts.length - 1)));
                }}
              >
                {alts.map((item, index) => {
                  const inputRange = [(index - 1) * PAGE_W, index * PAGE_W, (index + 1) * PAGE_W];
                  const scale   = scrollX.interpolate({ inputRange, outputRange: [0.92, 1, 0.92], extrapolate: 'clamp' });
                  const opacity = scrollX.interpolate({ inputRange, outputRange: [0.50, 1, 0.50], extrapolate: 'clamp' });
                  return (
                    <Animated.View
                      key={item.recipeId}
                      style={[s.carouselPage, { transform: [{ scale }], opacity }]}
                    >
                      <AltDetailCard
                        alt={item}
                        rank={index + 1}
                        total={alts.length}
                        theme={theme}
                        isAdopting={adoptingIndex === index}
                        onAdopt={() => void handleAdoptAlternative(item, index)}
                      />
                    </Animated.View>
                  );
                })}
              </Animated.ScrollView>

              {alts.length > 1 && (
                <View style={s.dotsRow}>
                  {alts.map((_, i) => (
                    <View
                      key={i}
                      style={[s.dot, { backgroundColor: i === activeIndex ? theme.primary : theme.border }]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* NO_ALTERNATIVE */}
          {matchState === "NO_ALTERNATIVE" && (
            <View style={[s.card, s.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={s.emptyIcon}>🛒</Text>
              <Text style={[s.emptyTitle, { color: theme.text }]}>Alternatif bulunamadı</Text>
              <Text style={[s.emptyText, { color: theme.textSub }]}>
                Şu an mevcut malzemelerinle uyumlu ve besin değerleri yakın bir alternatif tarif yok.
                Diyetisyeninle görüşebilirsin.
              </Text>
            </View>
          )}
        </Animated.View>

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

// — Alternative detail card —

function AltDetailCard({
  alt, rank, total, theme, isAdopting, onAdopt,
}: {
  alt: AlternativeRecipe;
  rank: number;
  total: number;
  theme: any;
  isAdopting: boolean;
  onAdopt: () => void;
}) {
  const combinedScore     = alt.combinedScore     ?? 0;
  const nutritionalScore  = alt.nutritionalScore  ?? 0;
  const matchPct          = alt.matchPercentage   ?? 0;
  const scoreColor        = combinedScore >= 75 ? theme.emerald : combinedScore >= 50 ? theme.primary : theme.warning;

  const hasMacros   = !!(alt.caloriesKcal || alt.proteinGrams || alt.fatGrams || alt.carbsGrams);
  const hasDelta    = !!alt.nutritionalComparison;
  const hasReasons  = (alt.recommendationReasons?.length ?? 0) > 0;
  const hasMissing  = (alt.missingIngredientNamesForAlternative?.length ?? 0) > 0;
  const hasNote     = !!alt.planAlignmentNote;

  return (
    <View style={[dc.card, { backgroundColor: theme.surfaceElevated, borderColor: `${scoreColor}28` }]}>

      {/* Rank badge */}
      {total > 1 && (
        <View style={dc.rankRow}>
          <View style={[dc.rankBadge, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}28` }]}>
            <Text style={[dc.rankTxt, { color: theme.primary }]}>{rank}. Öneri</Text>
          </View>
        </View>
      )}

      {/* Recipe name */}
      <Text style={[dc.name, { color: theme.text }]} numberOfLines={2}>{alt.recipeName}</Text>

      {/* Score trio */}
      <View style={dc.scoreRow}>
        <ScorePill label="Genel Uyum"   value={`%${Math.round(combinedScore)}`}    color={scoreColor}       theme={theme} />
        <ScorePill label="Besin Uyumu"  value={`%${Math.round(nutritionalScore)}`} color={theme.emerald}    theme={theme} />
        <ScorePill label="Malzeme"      value={`%${Math.round(matchPct)}`}         color={theme.primary}    theme={theme} />
      </View>

      {/* Macro table */}
      {hasMacros && (
        <View style={[dc.macroTable, { backgroundColor: `${theme.primary}06`, borderColor: `${theme.primary}14` }]}>
          <Text style={[dc.macroTableTitle, { color: theme.textMuted }]}>BESİN DEĞERLERİ</Text>
          <View style={dc.macroRow}>
            {alt.caloriesKcal != null && (
              <MacroCell label="Kalori"  value={`${alt.caloriesKcal}`} unit="kcal" color={theme.macroCalorie ?? theme.primary}    theme={theme} />
            )}
            {alt.proteinGrams != null && (
              <MacroCell label="Protein" value={`${alt.proteinGrams}`} unit="g"    color={theme.macroProtein ?? theme.emerald}    theme={theme} />
            )}
            {alt.carbsGrams != null && (
              <MacroCell label="Karb"    value={`${alt.carbsGrams}`}   unit="g"    color={theme.macroCarb    ?? theme.accentGold}  theme={theme} />
            )}
            {alt.fatGrams != null && (
              <MacroCell label="Yağ"     value={`${alt.fatGrams}`}     unit="g"    color={theme.macroFat     ?? theme.accentCoral} theme={theme} />
            )}
          </View>
        </View>
      )}

      {/* Nutritional delta vs original */}
      {hasDelta && (
        <View style={[dc.deltaBox, { backgroundColor: `${theme.textMuted}0A`, borderColor: `${theme.textMuted}20` }]}>
          <Text style={[dc.deltaLabel, { color: theme.textMuted }]}>Orijinale göre fark</Text>
          <Text style={[dc.deltaValue, { color: theme.textSub }]}>{alt.nutritionalComparison}</Text>
        </View>
      )}

      {/* Why recommended â€” per-card, scrolls with the card */}
      {hasReasons && (
        <View style={[dc.reasonsBox, { backgroundColor: `${theme.primary}07`, borderColor: `${theme.primary}20` }]}>
          <Text style={[dc.sectionLabel, { color: theme.textMuted }]}>NEDEN ÖNERİLDİ</Text>
          {alt.recommendationReasons!.slice(0, 3).map((reason, i) => (
            <View key={i} style={dc.reasonRow}>
              <Text style={[dc.reasonBullet, { color: theme.primary }]}>•</Text>
              <Text style={[dc.reasonText, { color: theme.textSub }]}>{reason}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Missing ingredients specific to this alternative */}
      {hasMissing && (
        <View style={[dc.missingBox, { backgroundColor: `${theme.warning}08`, borderColor: `${theme.warning}25` }]}>
          <Text style={[dc.sectionLabel, { color: theme.warning }]}>BU TARİF İÇİN EKSİK</Text>
          <View style={dc.missingChips}>
            {alt.missingIngredientNamesForAlternative!.map((name, i) => (
              <View key={i} style={[dc.missingChip, { backgroundColor: `${theme.warning}14`, borderColor: `${theme.warning}35` }]}>
                <Text style={[dc.missingChipTxt, { color: theme.text }]}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Plan alignment note */}
      {hasNote && (
        <Text style={[dc.alignNote, { color: theme.textMuted }]}>{alt.planAlignmentNote}</Text>
      )}

      {/* Adopt CTA */}
      <TouchableOpacity
        style={[dc.adoptBtn, { backgroundColor: theme.primary }]}
        onPress={onAdopt}
        disabled={isAdopting}
        activeOpacity={0.85}
      >
        <Text style={dc.adoptBtnTxt}>
          {isAdopting ? 'Seçiliyor...' : 'Bu Alternatifi Seç'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ScorePill({ label, value, color, theme }: { label: string; value: string; color: string; theme: any }) {
  return (
    <View style={[dc.scorePill, { backgroundColor: `${color}10`, borderColor: `${color}25` }]}>
      <Text style={[dc.scorePillVal, { color }]}>{value}</Text>
      <Text style={[dc.scorePillLbl, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

function MacroCell({ label, value, unit, color, theme }: { label: string; value: string; unit: string; color: string; theme: any }) {
  return (
    <View style={dc.macroCell}>
      <Text style={[dc.macroCellVal, { color: theme.text }]}>
        {value}<Text style={[dc.macroCellUnit, { color: theme.textMuted }]}>{unit}</Text>
      </Text>
      <Text style={[dc.macroCellLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={[dc.macroCellBar, { backgroundColor: color }]} />
    </View>
  );
}

// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const s = StyleSheet.create({
  root:    { flex: 1 },
  stripeBg: { height: 220, position: "absolute", top: 0, left: 0, right: 0 },
  scroll:   { paddingTop: 56, paddingBottom: 56, paddingHorizontal: spacing.lg, gap: spacing.md },

  heroCard: {
    borderRadius: radii.xl, borderWidth: 1.5, padding: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm,
  },
  heroIconWrap:  { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  heroIconText:  { fontSize: 22, fontWeight: "900" },
  heroTextBlock: { flex: 1 },
  heroStatus:    { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  heroRecipeName:{ fontSize: 18, fontWeight: "900", lineHeight: 24 },

  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, overflow: "hidden" },
  cardLabel: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing.sm },
  successNote:   { fontSize: 15, fontWeight: "700", lineHeight: 22 },

  missingList:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  missingChip:    { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  missingChipText:{ fontSize: 12, fontWeight: '700' },

  actionBtn:     { borderRadius: radii.full, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', marginTop: spacing.sm },
  actionBtnText: { fontSize: 14, fontWeight: '800' },

  // Carousel container: negative horizontal margin extends to screen edges, removing outer padding.
  // The Animated.ScrollView pages by PAGE_W (full screen width).
  carouselWrapper: {
    borderRadius: radii.xl, borderWidth: 1, overflow: "hidden",
    marginHorizontal: -spacing.lg,  // extend to screen edges
    paddingTop: spacing.md,
  },
  altHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  swipeHint: { fontSize: 11, fontWeight: "600" },

  // Each carousel page = PAGE_W. Card content sits inside with horizontal padding.
  carouselPage: {
    width: PAGE_W,
    paddingHorizontal: CARD_PADDING_H,
    paddingBottom: spacing.sm,
  },

  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: spacing.md },
  dot:     { width: 6, height: 6, borderRadius: 3 },

  emptyCard:  { alignItems: "center", paddingVertical: spacing.xl },
  emptyIcon:  { fontSize: 44, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
  emptyText:  { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 20, paddingHorizontal: spacing.sm },

  backBtn: {
    marginTop: spacing.sm, alignSelf: "center", borderWidth: 1,
    borderRadius: radii.xl, paddingVertical: 14, paddingHorizontal: spacing.xl,
  },
  backBtnText: { fontWeight: "900", fontSize: 15 },
});

const dc = StyleSheet.create({
  card: {
    borderWidth: 1.5, borderRadius: radii.xl,
    padding: spacing.md, gap: spacing.sm,
  },
  rankRow:   { flexDirection: "row" },
  rankBadge: { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  rankTxt:   { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  name: { fontSize: 17, fontWeight: "900", lineHeight: 23 },

  scoreRow:    { flexDirection: "row", gap: 8 },
  scorePill:   { flex: 1, borderRadius: radii.lg, borderWidth: 1, paddingVertical: 8, alignItems: "center", gap: 3 },
  scorePillVal:{ fontSize: 15, fontWeight: "900" },
  scorePillLbl:{ fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },

  macroTable:      { borderRadius: radii.lg, borderWidth: 1, padding: 10, gap: 6 },
  macroTableTitle: { fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  macroRow:        { flexDirection: "row", gap: 4 },
  macroCell:       { flex: 1, alignItems: "center", gap: 2 },
  macroCellVal:    { fontSize: 15, fontWeight: "900" },
  macroCellUnit:   { fontSize: 10, fontWeight: "700" },
  macroCellLabel:  { fontSize: 9, fontWeight: "700", textAlign: "center" },
  macroCellBar:    { width: "80%", height: 3, borderRadius: 2, marginTop: 2 },

  deltaBox:   { borderRadius: radii.lg, borderWidth: 1, padding: 10, gap: 3 },
  deltaLabel: { fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.6 },
  deltaValue: { fontSize: 12, fontWeight: "700", lineHeight: 18 },

  // "NEDEN ÖNERİLDİ" â€” lives inside each card, scrolls with it
  reasonsBox: { borderRadius: radii.lg, borderWidth: 1, padding: 10, gap: 6 },
  sectionLabel: { fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  reasonRow:  { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  reasonBullet:{ fontSize: 13, fontWeight: "900", lineHeight: 19, marginTop: 1 },
  reasonText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18 },

  // Missing ingredients for this specific alternative
  missingBox:    { borderRadius: radii.lg, borderWidth: 1, padding: 10, gap: 6 },
  missingChips:  { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  missingChip:   { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  missingChipTxt:{ fontSize: 11, fontWeight: "700" },

  alignNote: { fontSize: 11, fontWeight: "600", textAlign: "center", fontStyle: "italic" },

  adoptBtn:    { paddingVertical: 13, borderRadius: radii.xl, alignItems: "center", marginTop: spacing.xs ?? 4 },
  adoptBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "900" },
});

