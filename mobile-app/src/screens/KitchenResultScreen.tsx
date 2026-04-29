import React, { useEffect, useMemo, useState } from "react";
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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { spacing, radii } from "../theme/tokens";
import { addIngredientsToShoppingList } from "../api/shopping-list";
import { matchKitchen, type RecipeMatchResult } from "../api/kitchen";
import { useGamification } from "../queries/useGamification";
import RecipeCard, { type MatchType } from "../components/recipes/RecipeCard";
import RecipeSearchStage from "../components/kitchen/RecipeSearchStage";
import { Routes } from "../navigation/routes";
import {
  buildWhySuggested,
  formatCompatibilityPercent,
  getScoreColor,
  normalizeCompatibilityPercent,
} from "../utils/recipeMatchPresentation";
import { prioritizeRecipeMatches, summarizeRecipePriority } from "../features/smartInsights";

type ScreenRoute = RouteProp<{ params: { ingredientIds: string[]; ingredientNames: string[] } }, "params">;
type TabKey = "all" | "full" | "partial" | "clinic";
const SEARCH_STAGE_MIN_MS = 3800;

/** Clinic UI only when backend marks ownership of the linked clinic — never infer from DietitianId alone */
const isOwnedByLinkedClinic = (recipe: RecipeMatchResult) =>
  recipe.isOwnedByActiveDietitian === true ||
  (typeof recipe.sourceType === "string" && recipe.sourceType.startsWith("LINKED_CLINIC"));

const isCatalogFallback = (recipe: RecipeMatchResult) =>
  recipe.isPublicFallback === true ||
  recipe.sourceType === "GLOBAL_PUBLIC_FALLBACK" ||
  recipe.sourceType === "OTHER_DIETITIAN_PUBLIC";

const isFull = (recipe: RecipeMatchResult) => recipe.matchStatus === "FULL_MATCH";
// isPartial covers both ONE_MISSING and PARTIAL_MATCH (2-missing, ≥50% covered)
const isPartial = (recipe: RecipeMatchResult) => recipe.matchStatus !== "FULL_MATCH";

const toMatchType = (recipe: RecipeMatchResult): MatchType => {
  if (isOwnedByLinkedClinic(recipe)) {
    return isFull(recipe) ? "clinic" : "partial";
  }
  if (isCatalogFallback(recipe)) {
    return isFull(recipe) ? "catalog" : "partial";
  }
  return isFull(recipe) ? "full" : "partial";
};

export default function KitchenResultScreen() {
  const navigation = useNavigation();
  const route = useRoute<ScreenRoute>();
  const { ingredientIds, ingredientNames } = route.params;
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: gamification } = useGamification();

  const [results, setResults] = useState<RecipeMatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [addingToList, setAddingToList] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);

  const copy = language === "en"
    ? {
        back: "Kitchen",
        all: "All",
        full: "Full Match",
        partial: "Almost",
        clinic: "Clinic",
        title: "Suggested recipes",
        sub: "The strongest recipe matches for your selected ingredients.",
        feature: "TOP MATCH",
        featureTitle: "Suggested Recipe",
        why: "Why this recipe?",
        retry: "Try Again",
        empty: "No matching recipes found",
        emptySub: "Try a different ingredient combination.",
        bottom: "Back to Kitchen",
        ingredients: "ingredients",
        clinicSub: "Dietitian-prioritized recipes",
        fullSub: "Ready to cook now",
        partialSub: "Needs one or two additions",
        addMissing: "Add missing ingredients to list",
        refreshPantry: "Refresh pantry",
        added: "Missing ingredients added to your shopping list.",
        streakLabel: "Rhythm update",
        streakSafe: "Today's kitchen action is feeding your streak.",
        streakRisk: "Your streak still needs a stronger action today.",
        streakCount: "day streak",
        readyNow: "Ready now",
        almostReady: "1-2 away",
        needsShopping: "Needs list",
      }
    : {
        back: "Mutfak",
        all: "Tümü",
        full: "Tam Uyum",
        partial: "Eksikle",
        clinic: "Klinik",
        title: "Önerilen tarifler",
        sub: "Seçtiğin malzemeler için en güçlü tarif eşleşmeleri.",
        feature: "EN GÜÇLÜ EŞLEŞME",
        featureTitle: "Önerilen Tarif",
        why: "Neden önerildi?",
        retry: "Tekrar Dene",
        empty: "Uygun tarif bulunamadı",
        emptySub: "Farklı bir malzeme kombinasyonu dene.",
        bottom: "Mutfağa Dön",
        ingredients: "malzeme",
        clinicSub: "Diyetisyen öncelikli tarifler",
        fullSub: "Hemen hazırlanabilir",
        partialSub: "Bir iki ekleme gerekiyor",
        addMissing: "Eksikleri listeye ekle",
        refreshPantry: "Dolabımı Güncelle",
        added: "Eksik malzemeler alışveriş listene eklendi.",
        streakLabel: "Ritim güncellemesi",
        streakSafe: "Bugünkü mutfak aksiyonu serini besliyor.",
        streakRisk: "Seriyi korumak için bugün biraz daha aksiyon gerekiyor.",
        streakCount: "günlük seri",
        readyNow: "Hazır şimdi",
        almostReady: "1-2 eksik",
        needsShopping: "Listeye düşen",
      };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!loading) return;

    setLoadingPhase(0);
    const phaseTimer = setInterval(() => {
      setLoadingPhase((prev) => Math.min(prev + 1, 2));
    }, 1320);

    return () => clearInterval(phaseTimer);
  }, [loading]);

  async function load() {
    setLoading(true);
    setLoadingPhase(0);
    setError(null);
    const introDelay = new Promise((resolve) => setTimeout(resolve, SEARCH_STAGE_MIN_MS));
    try {
      const res = await matchKitchen(ingredientIds);
      await introDelay;
      setResults(prioritizeRecipeMatches(res.results ?? []));
    } catch (e: any) {
      await introDelay;
      setError(e?.response?.data?.detail || e?.response?.data?.message || copy.empty);
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const clinic = results.filter((item) => isOwnedByLinkedClinic(item));
    const full = results.filter((item) => !isOwnedByLinkedClinic(item) && isFull(item));
    const partial = results.filter((item) => isPartial(item));

    // Pick featured by highest compatibilityPercent across ALL results — not by category.
    const featured = [...results].sort((a, b) =>
      normalizeCompatibilityPercent(b) - normalizeCompatibilityPercent(a),
    )[0] ?? null;

    return {
      featured,
      clinic: clinic.filter((item) => item.recipeId !== featured?.recipeId),
      full: full.filter((item) => item.recipeId !== featured?.recipeId),
      partial: partial.filter((item) => item.recipeId !== featured?.recipeId),
    };
  }, [results]);

  const prioritySummary = useMemo(() => summarizeRecipePriority(results), [results]);

  const sections = {
    all: { clinic: grouped.clinic, full: grouped.full, partial: grouped.partial },
    clinic: { clinic: grouped.clinic, full: [], partial: [] },
    full: { clinic: [], full: [...grouped.clinic.filter(isFull), ...grouped.full], partial: [] },
    partial: { clinic: [], full: [], partial: grouped.partial },
  }[tab];

  const tabs = [
    { key: "all" as TabKey, label: copy.all },
    { key: "full" as TabKey, label: copy.full },
    { key: "partial" as TabKey, label: copy.partial },
    { key: "clinic" as TabKey, label: copy.clinic },
  ];

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: theme.bg }]}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent
        />
        <View
          style={[
            s.loadingRoot,
            {
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 24),
            },
          ]}
        >
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => (navigation as any).goBack()}
          >
            <Ionicons name="chevron-back" size={15} color={theme.textSub} />
            <Text style={[s.backTxt, { color: theme.textSub }]}>{copy.back}</Text>
          </TouchableOpacity>

          <RecipeSearchStage
            theme={theme}
            ingredientNames={ingredientNames}
            language={language}
            phase={loadingPhase}
          />
        </View>
      </View>
    );
  }

  async function handleAddMissingToList() {
    const missingIds = grouped.featured?.missing?.map((item) => item.ingredient.id) ?? [];
    if (!grouped.featured || missingIds.length === 0) return;

    setAddingToList(true);
    try {
      await addIngredientsToShoppingList(
        missingIds,
        "Recipe",
        grouped.featured.recipeId,
        grouped.featured.name,
      );
      Alert.alert(language === "tr" ? "Tamam" : "OK", copy.added, [
        {
          text: language === "tr" ? "Tamam" : "OK",
          onPress: () => (navigation as any).navigate(Routes.App.ShoppingList),
        },
      ]);
    } catch {
      Alert.alert(language === "tr" ? "Hata" : "Error", language === "tr" ? "Listeye ekleme başarısız." : "Could not add missing items.");
    } finally {
      setAddingToList(false);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 20) + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => (navigation as any).goBack()}
        >
          <Ionicons name="chevron-back" size={15} color={theme.textSub} />
          <Text style={[s.backTxt, { color: theme.textSub }]}>{copy.back}</Text>
        </TouchableOpacity>

        <View style={[s.hero, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <Text style={[s.heroTitle, { color: theme.text }]}>{copy.title}</Text>
          <Text style={[s.heroSub, { color: theme.textMuted }]}>{copy.sub}</Text>
          <View style={s.ingRow}>
            {ingredientNames.map((name) => (
              <View
                key={name}
                style={[s.ingChip, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}20` }]}
              >
                <Text style={[s.ingChipTxt, { color: theme.primary }]}>{name}</Text>
              </View>
            ))}
          </View>
          <Text style={[s.meta, { color: theme.emerald }]}>
            {ingredientNames.length} {copy.ingredients}
          </Text>
          <View style={s.priorityRow}>
            <View style={[s.priorityPill, { backgroundColor: `${theme.emerald}12`, borderColor: `${theme.emerald}24` }]}>
              <Text style={[s.priorityValue, { color: theme.emerald }]}>{prioritySummary.readyNow}</Text>
              <Text style={[s.priorityLabel, { color: theme.textMuted }]}>{copy.readyNow}</Text>
            </View>
            <View style={[s.priorityPill, { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}24` }]}>
              <Text style={[s.priorityValue, { color: theme.primary }]}>{prioritySummary.almostReady}</Text>
              <Text style={[s.priorityLabel, { color: theme.textMuted }]}>{copy.almostReady}</Text>
            </View>
            <View style={[s.priorityPill, { backgroundColor: `${theme.accentGold}12`, borderColor: `${theme.accentGold}24` }]}>
              <Text style={[s.priorityValue, { color: theme.accentGold }]}>{prioritySummary.needsShopping}</Text>
              <Text style={[s.priorityLabel, { color: theme.textMuted }]}>{copy.needsShopping}</Text>
            </View>
          </View>
        </View>

        {!loading && !!error && (
          <View style={[s.stateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.stateTitle, { color: theme.text }]}>{error}</Text>
            <TouchableOpacity
              style={[s.stateBtn, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
              onPress={() => void load()}
            >
              <Text style={[s.stateBtnTxt, { color: theme.text }]}>{copy.retry}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && results.length === 0 && (
          <View style={[s.stateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.stateTitle, { color: theme.text }]}>{copy.empty}</Text>
            <Text style={[s.stateSub, { color: theme.textMuted }]}>{copy.emptySub}</Text>
          </View>
        )}

        {!loading && !error && grouped.featured && (() => {
          const featuredPct = normalizeCompatibilityPercent(grouped.featured);
          const featuredColor = getScoreColor(featuredPct);
          return (
          <Animated.View entering={FadeInDown.duration(260)} style={s.featureWrap}>
            <View style={s.featureHead}>
              <View style={[s.featureBadge, { backgroundColor: `${featuredColor}12`, borderColor: `${featuredColor}22` }]}>
                <Text style={[s.featureBadgeTxt, { color: featuredColor }]}>{copy.feature}</Text>
              </View>
              <View style={[s.featureScore, { borderColor: `${featuredColor}30`, backgroundColor: `${featuredColor}12` }]}>
                <Text style={[s.featureScoreTxt, { color: featuredColor }]}>{formatCompatibilityPercent(grouped.featured)}</Text>
              </View>
            </View>
            <Text style={[s.featureTitle, { color: theme.text }]}>{copy.featureTitle}</Text>
            {gamification && (
              <View style={[s.streakCallout, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
                <View style={[s.streakCalloutIcon, { backgroundColor: `${gamification.streakAtRisk ? theme.accentCoral : theme.primary}18`, borderColor: `${gamification.streakAtRisk ? theme.accentCoral : theme.primary}26` }]}>
                  <Ionicons
                    name={gamification.streakAtRisk ? "alert-circle-outline" : "sparkles-outline"}
                    size={15}
                    color={gamification.streakAtRisk ? theme.accentCoral : theme.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.streakCalloutLabel, { color: theme.emerald }]}>{copy.streakLabel}</Text>
                  <Text style={[s.streakCalloutText, { color: theme.text }]}>
                    {gamification.currentStreak > 0
                      ? `${gamification.currentStreak} ${copy.streakCount} · ${gamification.streakAtRisk ? copy.streakRisk : copy.streakSafe}`
                      : copy.streakSafe}
                  </Text>
                </View>
              </View>
            )}
            <RecipeCard
              recipeId={grouped.featured.recipeId}
              name={grouped.featured.name}
              description={grouped.featured.description}
              motivationText={grouped.featured.motivationText}
              matchType={toMatchType(grouped.featured)}
              missing={grouped.featured.missing}
              compatibilityPercent={grouped.featured.compatibilityPercent}
              score={grouped.featured.score}
              theme={theme}
              featured
              onOpen={() => (navigation as any).navigate(Routes.App.RecipeDetail, { result: grouped.featured })}
            />
            {!!grouped.featured.explanation && (
              <View style={[s.whyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.whyTitle, { color: theme.textMuted }]}>{copy.why}</Text>
                {(() => {
                  const why = buildWhySuggested(grouped.featured, language as "tr" | "en");
                  return (
                    <>
                      <Text style={[s.whySummary, { color: theme.emerald }]}>{why.summaryLine}</Text>
                      <Text style={[s.whyText, { color: theme.text }]}>{why.paragraph}</Text>
                      <View style={s.factsRow}>
                        {why.facts.map((fact) => (
                          <View key={fact.label} style={[s.factChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                            <Text style={[s.factLabel, { color: theme.textMuted }]}>{fact.label}</Text>
                            <Text style={[s.factValue, { color: theme.text }]}>{fact.value}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  );
                })()}
              </View>
            )}
            {!!grouped.featured.missing?.length && (
              <View style={s.featureActionRow}>
                <TouchableOpacity
                  style={[s.listBtn, { backgroundColor: theme.primary, flex: 1 }]}
                  onPress={() => void handleAddMissingToList()}
                  disabled={addingToList}
                >
                  {addingToList ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="cart-outline" size={15} color="#FFFFFF" />
                      <Text style={s.listBtnTxt}>{copy.addMissing}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.secondaryActionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => (navigation as any).navigate(Routes.App.Pantry)}
                >
                  <Ionicons name="basket-outline" size={15} color={theme.text} />
                  <Text style={[s.secondaryActionTxt, { color: theme.text }]}>{copy.refreshPantry}</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
          );
        })()}

        {!loading && !error && results.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              s.tabBar,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {tabs.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  s.tabItem,
                  tab === item.key && { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}24` },
                ]}
                onPress={() => setTab(item.key)}
              >
                <Text style={[s.tabTxt, { color: tab === item.key ? theme.primary : theme.textMuted }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {([
          { key: "clinic", title: copy.clinic, sub: copy.clinicSub, items: sections.clinic },
          { key: "full", title: copy.full, sub: copy.fullSub, items: sections.full },
          { key: "partial", title: copy.partial, sub: copy.partialSub, items: sections.partial },
        ] as const).map((section) => section.items.length > 0 && (
          <Animated.View
            key={section.key}
            entering={FadeIn.duration(220)}
            style={[s.section, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[s.sectionTitle, { color: theme.text }]}>{section.title}</Text>
            <Text style={[s.sectionSub, { color: theme.textMuted }]}>{section.sub}</Text>
            {section.items.map((item) => (
              <RecipeCard
                key={item.recipeId}
                recipeId={item.recipeId}
                name={item.name}
                description={item.description}
                motivationText={item.motivationText}
                matchType={toMatchType(item)}
                missing={item.missing}
                compatibilityPercent={item.compatibilityPercent}
                score={item.score}
                theme={theme}
                onOpen={() => (navigation as any).navigate(Routes.App.RecipeDetail, { result: item })}
              />
            ))}
          </Animated.View>
        ))}

        <TouchableOpacity
          style={[s.bottomBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => (navigation as any).goBack()}
        >
          <Text style={[s.bottomBtnTxt, { color: theme.textSub }]}>{copy.bottom}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: {
    flex: 1,
    paddingHorizontal: spacing.base,
  },
  scroll: { paddingHorizontal: spacing.base },
  backBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 13,
    paddingVertical: 7,
    marginBottom: spacing.md,
  },
  backTxt: { fontSize: 13, fontWeight: "700" },
  hero: { borderWidth: 1, borderRadius: radii.xxl, padding: 18, marginBottom: spacing.md },
  heroTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8, marginBottom: 6 },
  heroSub: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  ingRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 10 },
  ingChip: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 11, paddingVertical: 7 },
  ingChipTxt: { fontSize: 11, fontWeight: "700" },
  meta: { fontSize: 12, fontWeight: "900" },
  priorityRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  priorityPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  priorityValue: { fontSize: 16, fontWeight: "900", marginBottom: 2 },
  priorityLabel: { fontSize: 10.5, fontWeight: "700", lineHeight: 14 },
  stateCard: { borderWidth: 1, borderRadius: radii.xxl, padding: 22, alignItems: "center", marginBottom: spacing.md },
  stateTitle: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  stateSub: { fontSize: 12.5, lineHeight: 18, marginTop: 6, textAlign: "center" },
  stateBtn: { marginTop: 10, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 16, paddingVertical: 9 },
  stateBtnTxt: { fontSize: 13, fontWeight: "800" },
  featureWrap: { marginBottom: spacing.md },
  featureHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  featureBadge: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 6 },
  featureBadgeTxt: { fontSize: 10, fontWeight: "900" },
  featureScore: { minWidth: 72, height: 72, borderRadius: 36, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  featureScoreTxt: { fontSize: 18, fontWeight: "900" },
  featureTitle: { fontSize: 26, fontWeight: "900", letterSpacing: -0.6, marginBottom: 8 },
  streakCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: spacing.sm,
  },
  streakCalloutIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  streakCalloutLabel: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  streakCalloutText: { fontSize: 12.5, lineHeight: 18, fontWeight: "700" },
  whyBox: { borderWidth: 1, borderRadius: radii.xl, padding: 14, marginTop: spacing.xs },
  whyTitle: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 },
  whySummary: { fontSize: 12.5, fontWeight: "800", marginBottom: 7 },
  whyText: { fontSize: 12, lineHeight: 18 },
  factsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  factChip: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 10, paddingVertical: 8, minWidth: 100 },
  factLabel: { fontSize: 10, fontWeight: "700", marginBottom: 2 },
  factValue: { fontSize: 12, fontWeight: "900" },
  listBtn: {
    marginTop: spacing.sm,
    minHeight: 50,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  featureActionRow: { flexDirection: "row", gap: 10, marginTop: spacing.sm },
  secondaryActionBtn: {
    marginTop: spacing.sm,
    minHeight: 50,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActionTxt: { fontSize: 12.5, fontWeight: "800" },
  listBtnTxt: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  tabBar: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: 6,
    gap: 6,
    marginBottom: spacing.md,
  },
  tabItem: {
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabTxt: { fontSize: 11.5, fontWeight: "800", textAlign: "center" },
  section: { borderWidth: 1, borderRadius: radii.xxl, padding: 16, marginBottom: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: "900", marginBottom: 3 },
  sectionSub: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  bottomBtn: { borderWidth: 1, borderRadius: radii.xl, paddingVertical: 14, alignItems: "center", marginTop: spacing.xs },
  bottomBtnTxt: { fontSize: 13, fontWeight: "700" },
});
