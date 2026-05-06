import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator } from "react-native";
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { useInAppNotifications } from "../context/InAppNotificationContext";
import { useFeedback } from "../context/FeedbackContext";
import { spacing, radii } from "../theme/tokens";
import { dur } from "../hooks/useAuraMotion";
import type { RecipeMatchResult } from "../api/kitchen";
import { getRecipePlanContext, type RecipePlanContext } from "../api/alternative";
import { favoriteRecipe, unfavoriteRecipe } from "../api/favorites";
import { addIngredientsToShoppingList } from "../api/shopping-list";
import ProduceBubble from "../components/decor/ProduceBubble";
import DytopiaWatermark from "../components/decor/DytopiaWatermark";
import RecipeNutritionPanel from "../components/recipes/RecipeNutritionPanel";
import { buildWhySuggested, formatCompatibilityPercent, getMatchTierLabel } from "../utils/recipeMatchPresentation";
import type { CookingIngredient, CookingModePayload } from "./CookingModeScreen";
import { Routes } from "../navigation/routes";

type ScreenRoute = RouteProp<{ params: { result: RecipeMatchResult; fromFavorites?: boolean } }, "params">;

// â”€â”€ Nutrition table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function NutritionTable({
  caloriesKcal, proteinGrams, carbsGrams, fatGrams, accent, theme,
}: {
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  accent: string;
  theme: any;
}) {
  const items = [
    { label: "Kalori",        value: caloriesKcal != null ? `${caloriesKcal}` : null, unit: "kcal", color: theme.macroCalorie ?? accent },
    { label: "Protein",       value: proteinGrams  != null ? `${proteinGrams}`  : null, unit: "g",    color: theme.macroProtein ?? theme.emerald },
    { label: "Karb",          value: carbsGrams    != null ? `${carbsGrams}`    : null, unit: "g",    color: theme.macroCarb    ?? theme.accentGold },
    { label: "Yağ",           value: fatGrams      != null ? `${fatGrams}`      : null, unit: "g",    color: theme.macroFat     ?? theme.accentCoral },
  ].filter(i => i.value !== null);

  if (items.length === 0) return null;

  // Total for progress bar calculation (protein+carbs+fat in grams)
  const totalGrams = (proteinGrams ?? 0) + (carbsGrams ?? 0) + (fatGrams ?? 0);

  return (
    <View style={nt.container}>
      {/* Main macro row */}
      <View style={nt.row}>
        {items.map(item => (
          <View key={item.label} style={[nt.cell, { backgroundColor: `${item.color}0C`, borderColor: `${item.color}20` }]}>
            <Text style={[nt.cellValue, { color: item.color }]}>
              {item.value}<Text style={[nt.cellUnit, { color: item.color + "CC" }]}>{item.unit}</Text>
            </Text>
            <Text style={[nt.cellLabel, { color: theme.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Macro bar (protein/carbs/fat proportions) */}
      {totalGrams > 0 && (
        <View style={nt.barWrap}>
          {proteinGrams != null && proteinGrams > 0 && (
            <View style={[nt.barSegment, { flex: proteinGrams / totalGrams, backgroundColor: theme.macroProtein ?? theme.emerald }]} />
          )}
          {carbsGrams != null && carbsGrams > 0 && (
            <View style={[nt.barSegment, { flex: carbsGrams / totalGrams, backgroundColor: theme.macroCarb ?? theme.accentGold }]} />
          )}
          {fatGrams != null && fatGrams > 0 && (
            <View style={[nt.barSegment, { flex: fatGrams / totalGrams, backgroundColor: theme.macroFat ?? theme.accentCoral }]} />
          )}
        </View>
      )}

      {/* Bar legend */}
      {totalGrams > 0 && (
        <View style={nt.legendRow}>
          {proteinGrams != null && <LegendDot label="Protein" color={theme.macroProtein ?? theme.emerald} theme={theme} />}
          {carbsGrams  != null && <LegendDot label="Karb"    color={theme.macroCarb    ?? theme.accentGold} theme={theme} />}
          {fatGrams    != null && <LegendDot label="Yağ"     color={theme.macroFat     ?? theme.accentCoral} theme={theme} />}
        </View>
      )}
    </View>
  );
}

function LegendDot({ label, color, theme }: { label: string; color: string; theme: any }) {
  return (
    <View style={nt.legendItem}>
      <View style={[nt.legendDot, { backgroundColor: color }]} />
      <Text style={[nt.legendLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const nt = StyleSheet.create({
  container: { gap: 10 },
  row: { flexDirection: "row", gap: 8 },
  cell: {
    flex: 1, borderRadius: 10, borderWidth: 1,
    paddingVertical: 10, alignItems: "center", gap: 3,
  },
  cellValue: { fontSize: 18, fontWeight: "900" },
  cellUnit: { fontSize: 11, fontWeight: "700" },
  cellLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  barWrap: { flexDirection: "row", height: 7, borderRadius: 4, overflow: "hidden", gap: 2 },
  barSegment: { borderRadius: 4 },
  legendRow: { flexDirection: "row", gap: 14, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: "700" },
});

function Pill({
  label,
  color,
  bg,
  border,
}: {
  label: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <View style={[s.pill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[s.pillTxt, { color }]}>{label}</Text>
    </View>
  );
}

function formatAmountValue(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return Number(value).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function formatIngredientLabel(item: { name: string; quantity?: number | null; unit?: string | null; displayAmount?: string | null }) {
  const amount = item.displayAmount?.trim() || (item.quantity != null && item.unit ? `${formatAmountValue(item.quantity)} ${item.unit}` : "");
  return amount ? `${amount} ${item.name}` : item.name;
}

function CoverageWeightRow({
  label,
  value,
  weight,
  color,
  theme,
}: {
  label: string;
  value: number;
  weight: string;
  color: string;
  theme: any;
}) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <View style={s.coverageWeightRow}>
      <View style={s.coverageWeightHead}>
        <Text style={[s.coverageWeightLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[s.coverageWeightValue, { color }]}>{safeValue}% · {weight}</Text>
      </View>
      <View style={[s.coverageWeightTrack, { backgroundColor: theme.surfaceElevated }]}>
        <View style={[s.coverageWeightFill, { width: `${safeValue}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function RecipeDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<ScreenRoute>();
  const { result } = route.params;
  const fromFavorites = route.params?.fromFavorites === true;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { notify } = useInAppNotifications();
  const { showDialog, showToast } = useFeedback();
  const insets = useSafeAreaInsets();

  // Hydrate recipe details when navigation payload is partial.
  const [planCtx, setPlanCtx] = useState<RecipePlanContext | null>(null);
  const [planCtxLoading, setPlanCtxLoading] = useState(false);
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const isPlanMode = !!result.recipeId && !result.explanation && (!result.steps || result.steps.length === 0);
  const canFavorite = user?.isPremium === true && !!result.recipeId;

  useEffect(() => {
    setFavoriteOverride(null);
  }, [result.recipeId]);

  useEffect(() => {
    if (!result.recipeId) return;
    let active = true;
    setPlanCtxLoading(true);
    getRecipePlanContext(result.recipeId)
      .then(ctx => {
        if (!active) return;
        setPlanCtx(ctx);
      })
      .catch(() => {})
      .finally(() => { if (active) setPlanCtxLoading(false); });
    return () => { active = false; };
  }, [result.recipeId]);

  const isFavorite = favoriteOverride ?? planCtx?.isFavorited ?? false;

  async function toggleFavorite() {
    if (!canFavorite || !result.recipeId || favoriteBusy) return;

    const nextFavorite = !isFavorite;
    setFavoriteBusy(true);
    setFavoriteOverride(nextFavorite);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Non-blocking.
    }

    try {
      if (nextFavorite) {
        await favoriteRecipe(result.recipeId);
      } else {
        await unfavoriteRecipe(result.recipeId);
      }

      setPlanCtx(current => current ? { ...current, isFavorited: nextFavorite } : current);
      notify({
        type: "pantry_updated",
        dedupKey: `recipe_favorite:${result.recipeId}:${nextFavorite ? "on" : "off"}`,
        title: language === "tr"
          ? (nextFavorite ? "Favorilere eklendi" : "Favorilerden çıkarıldı")
          : (nextFavorite ? "Added to favorites" : "Removed from favorites"),
        body: language === "tr"
          ? (nextFavorite
            ? `${displayName} premium favorilerine eklendi.`
            : `${displayName} favorilerinden çıkarıldı.`)
          : (nextFavorite
            ? `${displayName} was added to your premium favorites.`
            : `${displayName} was removed from your favorites.`),
        icon: nextFavorite ? "heart" : "heart-dislike-outline",
        tone: nextFavorite ? "coral" : "primary",
        haptic: "light",
        durationMs: 2200,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["favorite-recipes"] }),
        queryClient.invalidateQueries({ queryKey: ["favorite-recipes-summary"] }),
      ]);
    } catch {
      setFavoriteOverride(isFavorite);
      notify({
        type: "pantry_updated",
        dedupKey: `recipe_favorite_error:${result.recipeId}`,
        title: language === "tr" ? "Favori güncellenemedi" : "Favorite update failed",
        body: language === "tr"
          ? "Tarif favori durumuna alınamadı. Lütfen tekrar dene."
          : "The recipe favorite state could not be updated. Please try again.",
        icon: "alert-circle-outline",
        tone: "coral",
        haptic: "warning",
        durationMs: 2600,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["favorite-recipes"] }),
        queryClient.invalidateQueries({ queryKey: ["favorite-recipes-summary"] }),
      ]);
    } finally {
      setFavoriteBusy(false);
      setFavoriteOverride(null);
    }
  }

  const copy = language === "en" ? {
    back: "Recipe Results",
    clinic: "CLINIC",
    catalog: "CATALOG",
    general: "GENERAL",
    full: "FULL MATCH",
    partial: "1 MISSING",
    mandatory: "Mandatory",
    optional: "Optional",
    flavoring: "Flavoring",
    missing: "Missing",
    why: "Why suggested?",
    matched: "Covered ingredients",
    matchedMandatory: "Matched mandatory ingredients",
    matchedOptional: "Matched optional ingredients",
    matchedSupport: "Matched flavoring ingredients",
    pantryCoverageTitle: "Pantry coverage",
    pantryCoverageBody: "Your pantry covers this recipe by weighted ingredient priority.",
    pantryCoverageFormula: "Mandatory 70% • Optional 20% • Flavoring 10%",
    inPantry: "In your pantry",
    missingTitle: "Missing Mandatory Ingredients",
    strengthenTitle: "Missing but can strengthen",
    optionalAddable: "Can be added optionally",
    flavorBoost: "Can strengthen flavor",
    alternatives: "Suggested swap",
    usedSwaps: "Used swaps",
    steps: "How to make it",
    noSteps: "Preparation steps are not available for this recipe yet.",
    noStepsSub: "You can still review the ingredient fit and ask your dietitian for more detail.",
  } : {
    back: "Tarif Sonuçları",
    clinic: "KLİNİK",
    catalog: "KATALOG",
    general: "GENEL",
    full: "TAM UYUM",
    partial: "1 EKSİK",
    mandatory: "Zorunlu",
    optional: "Opsiyonel",
    flavoring: "Lezzetlendirici",
    missing: "Eksik",
    why: "Neden önerildi?",
    matched: "Karşılanan malzemeler",
    matchedMandatory: "Eşleşen zorunlular",
    matchedOptional: "Eşleşen opsiyoneller",
    matchedSupport: "Eşleşen lezzetlendiriciler",
    pantryCoverageTitle: "Dolap karşılama oranı",
    pantryCoverageBody: "Dolabındaki ürünler bu tarifi ağırlıklı malzeme önceliğine göre karşılıyor.",
    pantryCoverageFormula: "Zorunlu %70 • Opsiyonel %20 • Lezzetlendirici %10",
    inPantry: "Dolabında olanlar",
    missingTitle: "Eksik Zorunlu Malzemeler",
    strengthenTitle: "Eksik ama eklenirse güçlenir",
    optionalAddable: "Opsiyonel olarak eklenebilir",
    flavorBoost: "Lezzeti güçlendirebilir",
    alternatives: "Önerilen ikame",
    usedSwaps: "Kullanılan İkameler",
    steps: "Nasıl yapılır?",
    noSteps: "Bu tarif için hazırlık adımları henüz eklenmemiş.",
    noStepsSub: "Yine de malzeme uyumunu görebilir ve diyetisyeninden detay isteyebilirsin.",
  };

  const explanation = result.explanation;

  // In plan mode, merge plan context data into display variables
  const displayName = (isPlanMode && planCtx ? planCtx.recipeName : null) ?? result.name;
  const displayDescription = (isPlanMode && planCtx ? planCtx.description : null) ?? result.description;
  const displaySteps: string[] = (isPlanMode && planCtx ? planCtx.steps : null) ?? result.steps ?? [];
  const displayCaloriesKcal = planCtx?.caloriesKcal ?? result.caloriesKcal;
  const displayProteinGrams = planCtx?.proteinGrams ?? result.proteinGrams;
  const displayCarbsGrams = planCtx?.carbsGrams ?? result.carbsGrams;
  const displayFatGrams = planCtx?.fatGrams ?? result.fatGrams;
  const planMatchedMandatory = planCtx?.matchedGroups?.mandatory ?? planCtx?.ingredients.mandatory ?? [];
  const planMatchedOptional = planCtx?.matchedGroups?.optional ?? [];
  const planMatchedFlavoring = planCtx?.matchedGroups?.flavoring ?? [];
  const planMissingMandatory = planCtx?.missingGroups?.mandatory ?? [];
  const planMissingOptional = planCtx?.missingGroups?.optional ?? [];
  const planMissingFlavoring = planCtx?.missingGroups?.flavoring ?? [];

  const isClinic =
    result.isOwnedByActiveDietitian === true ||
    (typeof result.sourceType === "string" && result.sourceType.startsWith("LINKED_CLINIC"));
  const isCatalog =
    result.isPublicFallback === true ||
    result.sourceType === "GLOBAL_PUBLIC_FALLBACK" ||
    result.sourceType === "OTHER_DIETITIAN_PUBLIC";
  const isFullMatch = result.matchStatus === "FULL_MATCH";
  const accent = isClinic ? theme.accentGold : isCatalog ? theme.accentCyan : isFullMatch ? theme.emerald : theme.warning;
  const sourcePillLabel = isClinic ? copy.clinic : isCatalog ? copy.catalog : copy.general;
  const matchedIngredients = explanation?.matchedIngredients ?? planMatchedMandatory;
  const matchedOptionalIngredients = explanation?.matchedOptionalIngredients ?? planMatchedOptional;
  const matchedSupportIngredients = explanation?.matchedFlavoringIngredients ?? explanation?.matchedSupportIngredients ?? planMatchedFlavoring;
  const missingOptionalIngredients = explanation?.missingOptionalIngredients ?? planMissingOptional;
  const missingSupportIngredients = explanation?.missingFlavoringIngredients ?? explanation?.missingSupportIngredients ?? planMissingFlavoring;
  const missingItems = explanation
    ? (result.missing ?? [])
    : planMissingMandatory.map((ingredient) => ({ ingredient, suggestedSubstitutes: [] }));
  const usedSubstitutes = explanation?.usedSubstitutes ?? [];
  const why = isPlanMode && isClinic
    ? (
      language === "en"
        ? {
            summaryLine: "Planned meal · Clinic recipe",
            paragraph: "This recipe appears here because your dietitian placed it directly into your daily plan. It is one of the clinic recipes selected to support the meal flow, portion balance, and intent of your program.",
            facts: [
              { label: "Plan status", value: "Dietitian planned" },
              { label: "Recipe source", value: "Clinic" },
              { label: "Pantry note", value: "Compared below" },
            ],
          }
        : {
            summaryLine: "Planlanan öğün · Klinik tarifi",
            paragraph: "Bu tarif sana dolabındaki ürünlere göre otomatik önerilmedi; diyetisyenin tarafından doğrudan bugünkü planına yerleştirildi. Plan akışını, porsiyon dengesini ve öğünün hedefini destekleyen klinik tariflerinden biridir.",
            facts: [
              { label: "Plan durumu", value: "Diyetisyen planladı" },
              { label: "Tarif kaynağı", value: "Klinik" },
              { label: "Dolap notu", value: "Karşılaştırma aşağıda" },
            ],
          }
    )
    : buildWhySuggested(result, language as "tr" | "en");
  const displayCompatibility = planCtx?.coverage
    ? formatCompatibilityPercent({ compatibilityPercent: planCtx.coverage.percent })
    : formatCompatibilityPercent(result);
  const cookingIngredients: CookingIngredient[] = (() => {
    const fromPlan = [
      ...(planCtx?.ingredients.mandatory ?? []).map((item) => ({ ...item, role: "mandatory" as const })),
      ...(planCtx?.ingredients.optional ?? []).map((item) => ({ ...item, role: "optional" as const })),
      ...(planCtx?.ingredients.flavoring ?? []).map((item) => ({ ...item, role: "flavoring" as const })),
    ];

    if (fromPlan.length > 0) {
      return fromPlan.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        displayAmount: item.displayAmount,
        role: item.role,
      }));
    }

    const matched = [
      ...matchedIngredients.map((item) => ({ id: item.id, name: formatIngredientLabel(item), role: "mandatory" as const })),
      ...matchedOptionalIngredients.map((item) => ({ id: item.id, name: formatIngredientLabel(item), role: "optional" as const })),
      ...matchedSupportIngredients.map((item) => ({ id: item.id, name: formatIngredientLabel(item), role: "flavoring" as const })),
    ];
    const missing = missingItems.map((item) => ({
      id: item.ingredient.id,
      name: formatIngredientLabel(item.ingredient),
      role: "missing" as const,
    }));

    return [...matched, ...missing];
  })();
  const cookingMissingIngredients: CookingIngredient[] = missingItems.map((item) => ({
    id: item.ingredient.id,
    name: formatIngredientLabel(item.ingredient),
    role: "missing",
  }));
  const missingPreviewNames = cookingMissingIngredients.slice(0, 3).map((item) => item.name).join(", ");
  const missingDialogMessage = language === "tr"
    ? `${missingPreviewNames}${cookingMissingIngredients.length > 3 ? "..." : ""} eksik görünüyor. Yine de pişirmeye başlamak ister misin?`
    : `${missingPreviewNames}${cookingMissingIngredients.length > 3 ? "..." : ""} seem missing. Start cooking anyway?`;

  function openCookingMode() {
    const payload: CookingModePayload = {
      recipeId: result.recipeId,
      name: displayName,
      description: displayDescription,
      steps: displaySteps,
      ingredients: cookingIngredients,
      missingIngredients: cookingMissingIngredients,
      caloriesKcal: displayCaloriesKcal,
      proteinGrams: displayProteinGrams,
      carbsGrams: displayCarbsGrams,
      fatGrams: displayFatGrams,
      baseServings: planCtx?.coverage ? undefined : undefined,
      source: fromFavorites ? "favorite" : isPlanMode ? "plan" : "kitchen",
    };

    (navigation as any).navigate(Routes.App.CookingMode, { recipe: payload });
  }

  function handleStartCooking() {
    if (cookingMissingIngredients.length > 0) {
      showDialog({
        variant: "warning",
        icon: "basket-outline",
        eyebrow: language === "tr" ? "Dolap kontrolü" : "Pantry check",
        title: language === "tr" ? "Eksik malzeme var" : "Missing ingredients",
        message: missingDialogMessage,
        secondaryAction: {
          label: language === "tr" ? "Vazgeç" : "Cancel",
          tone: "muted",
        },
        suggestions: [
          {
            label: language === "tr" ? "Eksikleri alışveriş listesine ekle" : "Add missing items to list",
            icon: "cart-outline",
            tone: "warning",
            onPress: async () => {
              try {
                await addIngredientsToShoppingList(
                  cookingMissingIngredients.map((item) => item.id),
                  "Recipe",
                  result.recipeId,
                  language === "tr" ? `${displayName} için eksikler` : `Missing for ${displayName}`,
                );
                showToast({
                  variant: "success",
                  title: language === "tr" ? "Listeye eklendi" : "Added to list",
                  message: language === "tr" ? "Eksik malzemeler alışveriş listesine taşındı." : "Missing ingredients moved to your shopping list.",
                  action: {
                    label: language === "tr" ? "Aç" : "Open",
                    icon: "open-outline",
                    onPress: () => (navigation as any).navigate(Routes.App.ShoppingList),
                  },
                });
              } catch {
                showToast({
                  variant: "error",
                  title: language === "tr" ? "Listeye eklenemedi" : "Could not add",
                  message: language === "tr" ? "Birazdan tekrar dene." : "Try again in a moment.",
                });
              }
            },
          },
          {
            label: language === "tr" ? "Alternatif tarif ara" : "Find an alternative recipe",
            icon: "swap-horizontal-outline",
            onPress: () => (navigation as any).navigate(Routes.App.CheckIngredients),
          },
        ],
        primaryAction: {
          label: language === "tr" ? "Yine de başla" : "Start anyway",
          tone: "warning",
          onPress: openCookingMode,
        },
      });
      return;
    }

    openCookingMode();
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <DytopiaWatermark position="center" size={300} opacity={0.034} />
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={34}
        iconColor={`${theme.primary}42`}
        style={[s.glowA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="carrot"
        iconSize={30}
        iconColor={`${theme.primary}40`}
        style={[s.glowB, { backgroundColor: theme.emeraldGlow }]}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 18) + 150 },
        ]}
      >
        <View style={s.navRow}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            activeOpacity={0.82}
            onPress={() => (navigation as any).goBack()}
          >
            <Ionicons name="chevron-back" size={16} color={theme.textSub} />
            <Text style={[s.backTxt, { color: theme.textSub }]}>{copy.back}</Text>
          </TouchableOpacity>
          {canFavorite ? (
            <TouchableOpacity
              style={[s.favBtn, { backgroundColor: theme.surface, borderColor: isFavorite ? '#FF4757' : theme.border }]}
              activeOpacity={0.82}
              disabled={favoriteBusy}
              onPress={() => void toggleFavorite()}
            >
              {favoriteBusy ? (
                <ActivityIndicator size="small" color={isFavorite ? '#FF4757' : theme.textSub} />
              ) : (
                <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={18} color={isFavorite ? '#FF4757' : theme.textSub} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={s.favSpacer} />
          )}
        </View>

        <Animated.View entering={FadeIn.duration(dur.base)} style={[s.hero, { backgroundColor: theme.surface, borderColor: `${accent}28` }]}>
          <ProduceBubble
            icon="leaf"
            iconSize={30}
            iconColor={`${accent}46`}
            style={[s.heroGlow, { backgroundColor: `${accent}14` }]}
          />
          <View style={s.heroTop}>
            <View style={s.badgeRow}>
              <Pill
                label={sourcePillLabel}
                color={accent}
                bg={`${accent}12`}
                border={`${accent}24`}
              />
              <Pill
                label={(language === "tr" ? getMatchTierLabel(result, "tr") : getMatchTierLabel(result, "en")).toUpperCase()}
                color={isFullMatch ? theme.emerald : theme.warning}
                bg={`${isFullMatch ? theme.emerald : theme.warning}10`}
                border={`${isFullMatch ? theme.emerald : theme.warning}24`}
              />
            </View>
            {(typeof result.score === "number" || planCtx?.coverage) && (
              <View style={[s.scoreWrap, { borderColor: `${accent}24`, backgroundColor: `${accent}10` }]}>
                <Text style={[s.scoreTxt, { color: accent }]}>{displayCompatibility}</Text>
              </View>
            )}
          </View>

          {planCtxLoading && (
            <ActivityIndicator size="small" color={accent} style={{ marginBottom: 8 }} />
          )}
          <Text style={[s.title, { color: theme.text }]}>{displayName}</Text>
          {!!displayDescription && <Text style={[s.desc, { color: theme.textSub }]}>{displayDescription}</Text>}

          <View style={[s.metrics, { backgroundColor: `${accent}08`, borderColor: `${accent}1C` }]}>
            <View style={s.metricCell}>
              <Text style={[s.metricValue, { color: accent }]}>
                {planCtx?.coverage ? `${planCtx.coverage.mandatory.matchedCount}/${planCtx.coverage.mandatory.total}` : `${result.matchedMandatoryCount}/${result.mandatoryCount}`}
              </Text>
              <Text style={[s.metricLabel, { color: theme.textMuted }]}>{copy.mandatory}</Text>
            </View>
            <View style={[s.metricDivider, { backgroundColor: `${accent}24` }]} />
            <View style={s.metricCell}>
              <Text style={[s.metricValue, { color: theme.textMuted }]}>
                {planCtx?.coverage ? `${planCtx.coverage.optional.matchedCount}/${planCtx.coverage.optional.total}` : `${explanation?.matchedOptionalCount ?? 0}/${explanation?.optionalCount ?? 0}`}
              </Text>
              <Text style={[s.metricLabel, { color: theme.textMuted }]}>{copy.optional}</Text>
            </View>
            <View style={[s.metricDivider, { backgroundColor: `${accent}24` }]} />
            <View style={s.metricCell}>
              <Text style={[s.metricValue, { color: theme.textMuted }]}>{planCtx?.coverage?.missingCount ?? missingItems.length}</Text>
              <Text style={[s.metricLabel, { color: theme.textMuted }]}>{copy.missing}</Text>
            </View>
          </View>
        </Animated.View>

        {!!planCtx?.coverage && (
          <Animated.View entering={FadeInDown.delay(35).duration(dur.base)} style={[s.coverageCard, { backgroundColor: theme.surface, borderColor: `${accent}26` }]}>
            <View style={s.coverageTop}>
              <View style={[s.coverageRing, { backgroundColor: `${accent}12`, borderColor: `${accent}28` }]}>
                <Text style={[s.coverageRingText, { color: accent }]}>{displayCompatibility}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.coverageTitle, { color: theme.text }]}>{copy.pantryCoverageTitle}</Text>
                <Text style={[s.coverageBody, { color: theme.textSub }]}>{copy.pantryCoverageBody}</Text>
              </View>
            </View>
            <Text style={[s.coverageFormula, { color: theme.textMuted }]}>{copy.pantryCoverageFormula}</Text>
            <View style={s.coverageWeightBox}>
              <CoverageWeightRow
                label={copy.mandatory}
                value={planCtx.coverage.mandatoryPercent}
                weight="70%"
                color={theme.emerald}
                theme={theme}
              />
              <CoverageWeightRow
                label={copy.optional}
                value={planCtx.coverage.optionalPercent}
                weight="20%"
                color={theme.primary}
                theme={theme}
              />
              <CoverageWeightRow
                label={copy.flavoring}
                value={planCtx.coverage.flavoringPercent}
                weight="10%"
                color={theme.accentGold}
                theme={theme}
              />
            </View>
            <View style={s.coverageBreakdown}>
              <Pill label={`${copy.mandatory} ${planCtx.coverage.mandatoryPercent}%`} color={theme.emerald} bg={`${theme.emerald}10`} border={`${theme.emerald}24`} />
              <Pill label={`${copy.optional} ${planCtx.coverage.optionalPercent}%`} color={theme.primary} bg={`${theme.primary}10`} border={`${theme.primary}24`} />
              <Pill label={`${copy.flavoring} ${planCtx.coverage.flavoringPercent}%`} color={theme.accentGold} bg={`${theme.accentGold}10`} border={`${theme.accentGold}24`} />
            </View>
          </Animated.View>
        )}

        {!fromFavorites && (
          <Animated.View entering={FadeInDown.delay(50).duration(dur.base)} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.textMuted }]}>{copy.why}</Text>
            <Text style={[s.reasonSummary, { color: accent }]}>{why.summaryLine}</Text>
            <Text style={[s.reasonBox, { color: theme.text, backgroundColor: `${accent}0E`, borderColor: `${accent}20` }]}>
              {why.paragraph}
            </Text>
            <View style={s.factsRow}>
              {why.facts.map((fact) => (
                <View key={fact.label} style={[s.factItem, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
                  <Text style={[s.factLabel, { color: theme.textMuted }]}>{fact.label}</Text>
                  <Text style={[s.factValue, { color: theme.text }]}>{fact.value}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {(matchedIngredients.length > 0 || matchedOptionalIngredients.length > 0 || matchedSupportIngredients.length > 0) && (
          <Animated.View entering={FadeInDown.delay(90).duration(dur.base)} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.textMuted }]}>{copy.matched}</Text>
            {matchedIngredients.length > 0 && (
              <>
                <Text style={[s.groupTitle, { color: theme.emerald }]}>{copy.matchedMandatory}</Text>
                <View style={s.chipWrap}>
                  {matchedIngredients.map((item) => (
                    <Pill key={item.id} label={formatIngredientLabel(item)} color={theme.emerald} bg={`${theme.emerald}10`} border={`${theme.emerald}22`} />
                  ))}
                </View>
              </>
            )}
            {matchedOptionalIngredients.length > 0 && (
              <>
                <Text style={[s.groupTitle, { color: theme.primary }]}>{copy.matchedOptional}</Text>
                <View style={s.chipWrap}>
                  {matchedOptionalIngredients.map((item) => (
                    <Pill key={item.id} label={formatIngredientLabel(item)} color={theme.primary} bg={`${theme.primary}10`} border={`${theme.primary}22`} />
                  ))}
                </View>
              </>
            )}
            {matchedSupportIngredients.length > 0 && (
              <>
                <Text style={[s.groupTitle, { color: theme.accentGold }]}>{copy.matchedSupport}</Text>
                <View style={s.chipWrap}>
                  {matchedSupportIngredients.map((item) => (
                    <Pill key={item.id} label={formatIngredientLabel(item)} color={theme.accentGold} bg={`${theme.accentGold}10`} border={`${theme.accentGold}22`} />
                  ))}
                </View>
              </>
            )}
          </Animated.View>
        )}

        {(missingOptionalIngredients.length > 0 || missingSupportIngredients.length > 0) && (
          <Animated.View entering={FadeInDown.delay(115).duration(dur.base)} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.textMuted }]}>{copy.strengthenTitle}</Text>
            {missingOptionalIngredients.length > 0 && (
              <View style={[s.optionalRow, { backgroundColor: `${theme.primary}08`, borderColor: `${theme.primary}20` }]}>
                <Text style={[s.groupTitle, { color: theme.primary }]}>{copy.optionalAddable}</Text>
                <View style={s.chipWrap}>
                  {missingOptionalIngredients.map((item) => (
                    <Pill key={item.id} label={formatIngredientLabel(item)} color={theme.primary} bg={`${theme.primary}10`} border={`${theme.primary}22`} />
                  ))}
                </View>
              </View>
            )}
            {missingSupportIngredients.length > 0 && (
              <View style={[s.optionalRow, { backgroundColor: `${theme.accentGold}08`, borderColor: `${theme.accentGold}20` }]}>
                <Text style={[s.groupTitle, { color: theme.accentGold }]}>{copy.flavorBoost}</Text>
                <View style={s.chipWrap}>
                  {missingSupportIngredients.map((item) => (
                    <Pill key={item.id} label={formatIngredientLabel(item)} color={theme.accentGold} bg={`${theme.accentGold}10`} border={`${theme.accentGold}22`} />
                  ))}
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {missingItems.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(dur.base)} style={[s.card, { backgroundColor: theme.surface, borderColor: `${theme.warning}28` }]}>
            <Text style={[s.cardLabel, { color: theme.warning }]}>{copy.missingTitle}</Text>
            {missingItems.map((item) => (
              <View key={item.ingredient.id} style={[s.missingCard, { backgroundColor: theme.surfaceElevated, borderColor: `${theme.warning}22` }]}>
                <Text style={[s.missingName, { color: theme.warning }]}>{formatIngredientLabel(item.ingredient)}</Text>
                {item.suggestedSubstitutes.length > 0 && (
                  <>
                    <Text style={[s.swapLabel, { color: theme.textMuted }]}>{copy.alternatives}</Text>
                    <View style={s.chipWrap}>
                      {item.suggestedSubstitutes.map((sub) => (
                        <Pill
                          key={sub.id}
                          label={sub.name}
                          color={theme.primary}
                          bg={`${theme.primary}10`}
                          border={`${theme.primary}22`}
                        />
                      ))}
                    </View>
                  </>
                )}
              </View>
            ))}
          </Animated.View>
        )}

        {usedSubstitutes.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).duration(dur.base)} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.textMuted }]}>{copy.usedSwaps}</Text>
            <View style={s.chipWrap}>
              {usedSubstitutes.map((item) => (
                <Pill
                  key={item.id}
                  label={item.name}
                  color={theme.primary}
                  bg={`${theme.primary}10`}
                  border={`${theme.primary}22`}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {/* Nutrition section */}
        {(displayCaloriesKcal != null || displayProteinGrams != null || displayCarbsGrams != null || displayFatGrams != null) && (
          <Animated.View entering={FadeInDown.delay(160).duration(dur.base)} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <RecipeNutritionPanel
              caloriesKcal={displayCaloriesKcal}
              proteinGrams={displayProteinGrams}
              carbsGrams={displayCarbsGrams}
              fatGrams={displayFatGrams}
              accent={accent}
              theme={theme}
              title={language === "en" ? "Nutrition" : "Besin Değerleri"}
            />
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(180).duration(dur.base)} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.cardLabel, { color: theme.textMuted }]}>{copy.steps}</Text>
          {displaySteps.length ? (
            displaySteps.map((step, index) => (
              <View key={`${index}-${step}`} style={[s.stepRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
                <View style={[s.stepIndex, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}24` }]}>
                  <Text style={[s.stepIndexTxt, { color: theme.primary }]}>{index + 1}</Text>
                </View>
                <Text style={[s.stepText, { color: theme.text }]}>{step}</Text>
              </View>
            ))
          ) : (
            <View style={[s.noSteps, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
              <Ionicons name="document-text-outline" size={24} color={theme.textMuted} />
              <Text style={[s.noStepsTitle, { color: theme.textMuted }]}>{copy.noSteps}</Text>
              <Text style={[s.noStepsSub, { color: theme.textMuted }]}>{copy.noStepsSub}</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInDown.delay(220).duration(320)}
        style={[s.cookDock, { paddingBottom: Math.max(insets.bottom, 14), backgroundColor: theme.glass, borderColor: theme.glassBorder }]}
      >
        <TouchableOpacity
          style={[s.cookGhostBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          activeOpacity={0.82}
          onPress={() => (navigation as any).navigate(Routes.App.ShoppingList)}
        >
          <Ionicons name="cart-outline" size={17} color={theme.text} />
          <Text style={[s.cookGhostTxt, { color: theme.text }]}>
            {language === "tr" ? "Eksikler" : "Missing"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.cookPrimaryBtn, { backgroundColor: accent, shadowColor: accent }]}
          activeOpacity={0.86}
          onPress={handleStartCooking}
        >
          <MaterialCommunityIcons name="chef-hat" size={19} color="#FFFFFF" />
          <Text style={s.cookPrimaryTxt}>{language === "tr" ? "Pişirmeye Başla" : "Start Cooking"}</Text>
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  glowA: {
    position: "absolute",
    top: 18,
    right: -64,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.7,
  },
  glowB: {
    position: "absolute",
    top: 360,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.42,
  },
  scroll: { paddingHorizontal: spacing.base },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  favBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  favSpacer: {
    width: 36,
    height: 36,
  },
  backTxt: { fontSize: 13, fontWeight: "700" },
  hero: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: 18,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  heroGlow: {
    position: "absolute",
    top: -42,
    right: -26,
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 12,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  scoreWrap: {
    minWidth: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  scoreTxt: { fontSize: 18, fontWeight: "900" },
  title: { fontSize: 28, fontWeight: "900", lineHeight: 33, letterSpacing: -0.8, marginBottom: 6 },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  metrics: {
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  metricCell: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: 19, fontWeight: "900" },
  metricLabel: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  metricDivider: { width: 1, height: 28 },
  card: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: 16,
    marginBottom: spacing.md,
  },
  coverageCard: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: 16,
    marginBottom: spacing.md,
    gap: 12,
  },
  coverageTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coverageRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coverageRingText: { fontSize: 18, fontWeight: "900" },
  coverageTitle: { fontSize: 15, fontWeight: "900", marginBottom: 4 },
  coverageBody: { fontSize: 12.5, lineHeight: 18 },
  coverageFormula: { fontSize: 11.5, fontWeight: "800" },
  coverageWeightBox: {
    gap: 10,
    borderRadius: radii.xl,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  coverageWeightRow: { gap: 6 },
  coverageWeightHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  coverageWeightLabel: { fontSize: 12, fontWeight: "900" },
  coverageWeightValue: { fontSize: 11.5, fontWeight: "900" },
  coverageWeightTrack: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  coverageWeightFill: {
    height: "100%",
    borderRadius: 999,
  },
  coverageBreakdown: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cardLabel: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  reasonSummary: { fontSize: 12.5, fontWeight: "800", marginBottom: 8 },
  reasonBox: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "600",
    overflow: "hidden",
    marginBottom: 10,
  },
  factsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  factItem: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 10, paddingVertical: 8, minWidth: 98 },
  factLabel: { fontSize: 10.5, fontWeight: "700", marginBottom: 2 },
  factValue: { fontSize: 12, fontWeight: "900" },
  groupTitle: { fontSize: 12, fontWeight: "800", marginBottom: 8, marginTop: 2 },
  secondaryText: { fontSize: 13, lineHeight: 19 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 11,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  pillTxt: { fontSize: 11.5, fontWeight: "700" },
  optionalRow: {
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: 12,
    marginBottom: 10,
  },
  missingCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: 12,
    marginBottom: 10,
  },
  missingName: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  swapLabel: { fontSize: 11, fontWeight: "700", marginBottom: 8 },
  stepRow: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  stepIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepIndexTxt: { fontSize: 12, fontWeight: "900" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  noSteps: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: 18,
    alignItems: "center",
  },
  noStepsTitle: { fontSize: 13.5, lineHeight: 19, fontWeight: "700", textAlign: "center", marginTop: 8, marginBottom: 6 },
  noStepsSub: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  cookDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: spacing.base,
    flexDirection: "row",
    gap: 10,
  },
  cookGhostBtn: {
    minWidth: 112,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cookGhostTxt: { fontSize: 13, fontWeight: "900" },
  cookPrimaryBtn: {
    flex: 1,
    borderRadius: radii.full,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 7,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  cookPrimaryTxt: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.1,
  },
});


