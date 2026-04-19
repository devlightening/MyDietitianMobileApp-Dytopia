/**
 * AURA CLINICAL OS — Plans Screen
 * Guided daily ritual: sectioned flow, focus refresh, macro chips, next-meal hero
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Alert, Modal,
  Animated as RNAnimated,
} from "react-native";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { Routes } from "../navigation/routes";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { useNotifications } from "../context/NotificationContext";
import { radii, spacing } from "../theme/tokens";
import { useFadeRise, useScaleSettle, useStaggerItem } from "../hooks/useAuraMotion";
import { useGamification } from "../queries/useGamification";
import { buildMotivationSummary, mapGamificationToMotivation, type DashboardMotivation } from "../motivation/streaks";
import {
  getPlansData, getTodayPlan, completeMeal, skipMeal, undoMealCompletion,
  type ClientPlan, type TodayPlan, type MealItem, type MealType, type MealCompletionStatus,
} from "../data/plansRepo";
import AppEmptyState from "../components/ui/AppEmptyState";
import ProduceBubble from "../components/decor/ProduceBubble";
import AlternativePickerSheet from "../components/AlternativePickerSheet";
import AlternativeCompareSheet from "../components/AlternativeCompareSheet";
import RecipeNutritionPanel from "../components/recipes/RecipeNutritionPanel";

/* ── helpers ── */
function getTodayFormatted(): string {
  return new Date().toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function updateItemStatus(plan: TodayPlan, itemId: string, status: MealCompletionStatus): TodayPlan {
  return {
    ...plan,
    items: plan.items.map(i => i.id === itemId ? { ...i, completionStatus: status } : i),
  };
}

/* ── constants ── */
const MEAL_TYPE_META: Record<MealType, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  Breakfast:  { icon: "sunny-outline", label: "Kahvaltı"      },
  MidMorning: { icon: "nutrition-outline", label: "Ara Öğün"  },
  Lunch:      { icon: "restaurant-outline", label: "Öğle"     },
  Afternoon:  { icon: "cafe-outline", label: "İkindi"         },
  Dinner:     { icon: "moon-outline", label: "Akşam"          },
  Evening:    { icon: "sparkles-outline", label: "Gece Arası" },
  Snack:      { icon: "leaf-outline", label: "Atıştırmalık"   },
};

const MEAL_TYPE_INDEX: Record<MealType, number> = {
  Breakfast: 0, MidMorning: 1, Lunch: 2,
  Afternoon: 3, Dinner: 4, Evening: 5, Snack: 6,
};

function isTodayDateKey(dateKey?: string): boolean {
  if (!dateKey) return false;
  const now = new Date();
  const localKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dateKey === localKey;
}

function buildMealLockMessage(item: MealItem, language: "tr" | "en"): string | null {
  if (item.isActionableNow !== false) return null;
  const time = item.actionBlockedUntilTime ?? item.time;
  const date = item.actionBlockedUntilDate;
  if (language === "en") {
    return isTodayDateKey(date)
      ? `Available at ${time}`
      : `Available on ${date} at ${time}`;
  }

  return isTodayDateKey(date)
    ? `${time}'de açılır`
    : `${date} ${time} itibarıyla açılır`;
}

function PlansHeroBand({
  theme,
  language,
  title,
  subtitle,
}: {
  theme: import("../theme/tokens").Theme;
  language: "tr" | "en";
  title: string;
  subtitle: string;
}) {
  return (
    <View style={[s.plansHeroBand, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
      <ProduceBubble
        icon="leaf"
        iconSize={20}
        iconColor={`${theme.primary}34`}
        style={[s.plansHeroBlobA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="fruit-pear"
        iconSize={18}
        iconColor={`${theme.emerald}38`}
        style={[s.plansHeroBlobB, { backgroundColor: theme.emeraldGlow }]}
      />
      <View style={s.plansHeroTop}>
        <View style={[s.plansHeroChip, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <Ionicons name="calendar-outline" size={14} color={theme.primaryDark} />
          <Text style={[s.plansHeroChipText, { color: theme.primaryDark }]}>
            {language === "tr" ? "Öğün Akışı" : "Meal Timeline"}
          </Text>
        </View>
        <View style={[s.plansHeroMini, { backgroundColor: theme.surfaceElevated }]}>
          <Text style={[s.plansHeroMiniText, { color: theme.emerald }]}>
            {language === "tr" ? "Odak görünümü" : "Focus view"}
          </Text>
        </View>
      </View>
      <Text style={[s.plansHeroTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[s.plansHeroSubtitle, { color: theme.textSub }]}>{subtitle}</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN SCREEN
═══════════════════════════════════════════════════════ */
export default function PlansScreen({
  onPressKitchen,
  isActive = true,
}: {
  onPressKitchen?: () => void;
  isActive?: boolean;
} = {}) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { syncSchedules } = useNotifications();
  const { data: gamification } = useGamification();
  const isPremium = user?.isPremium === true;
  const motivation = mapGamificationToMotivation(gamification);

  const [plans, setPlans]           = useState<ClientPlan[]>([]);
  const [todayPlan, setTodayPlan]   = useState<TodayPlan | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn]         = useState<string | null>(null);
  const [flipResetKey, setFlipResetKey] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<MealItem | null>(null);
  const [altPickerMeal, setAltPickerMeal]   = useState<MealItem | null>(null);
  const [altCompareMeal, setAltCompareMeal] = useState<MealItem | null>(null);
  const [planToast, setPlanToast] = useState<{ title: string; body: string } | null>(null);

  const isFirstLoad  = useRef(true);
  const headerStyle  = useFadeRise(0, 16);
  const toastTranslateY = useRef(new RNAnimated.Value(-140)).current;
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── data ── */
  const load = useCallback(async () => {
    try {
      const [plansResult, todayResult] = await Promise.allSettled([
        getPlansData(),
        getTodayPlan(),
      ]);

      if (plansResult.status === "fulfilled") {
        setPlans(plansResult.value.plans);
      } else {
        setPlans([]);
      }

      if (todayResult.status === "fulfilled") {
        setTodayPlan(todayResult.value);
      } else {
        setTodayPlan(null);
      }
    } catch {
      setPlans([]);
      setTodayPlan(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load + silent reload when the Plans tab becomes active again.
  useEffect(() => {
    if (!isPremium) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!isActive) return;

    setFlipResetKey(k => k + 1);

    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      void load();
      return;
    }

    setRefreshing(true);
    void load();
  }, [isActive, isPremium, load]);

  const hidePlanToast = useCallback(() => {
    RNAnimated.parallel([
      RNAnimated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      RNAnimated.timing(toastTranslateY, { toValue: -140, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setPlanToast(null);
      }
    });
  }, [toastOpacity, toastTranslateY]);

  const showPlanToast = useCallback((title: string, body: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setPlanToast({ title, body });
    toastTranslateY.setValue(-140);
    toastOpacity.setValue(0);

    RNAnimated.parallel([
      RNAnimated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      RNAnimated.spring(toastTranslateY, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
    ]).start(() => {
      toastTimerRef.current = setTimeout(() => {
        toastTimerRef.current = null;
        hidePlanToast();
      }, 2400);
    });
  }, [hidePlanToast, toastOpacity, toastTranslateY]);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  /* ── actions (preserve existing logic exactly) ── */
  const handleComplete = useCallback(async (item: MealItem) => {
    if (actingOn) return;
    const lockMessage = buildMealLockMessage(item, language);
    if (lockMessage) {
      Alert.alert(language === "tr" ? "Henüz açılamadı" : "Not available yet", lockMessage);
      return;
    }
    if (item.completionStatus === "Done" || item.completionStatus === "Alternative") {
      setActingOn(item.id);
      try {
        await undoMealCompletion(item.id);
        setTodayPlan(prev => prev ? updateItemStatus(prev, item.id, "Planned") : prev);
        await syncSchedules();
      } catch {
        Alert.alert("Hata", "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.");
      } finally { setActingOn(null); }
      return;
    }
    setActingOn(item.id);
    try {
      await completeMeal(item.id);
      setTodayPlan(prev => prev ? updateItemStatus(prev, item.id, "Done") : prev);
      await syncSchedules();
    } catch {
      Alert.alert("Hata", "Öğün tamamlanamadı. Lütfen tekrar deneyin.");
    } finally { setActingOn(null); }
  }, [actingOn, language]);

  const handleSkip = useCallback(async (item: MealItem) => {
    if (actingOn) return;
    const lockMessage = buildMealLockMessage(item, language);
    if (lockMessage) {
      Alert.alert(language === "tr" ? "Henüz açılamadı" : "Not available yet", lockMessage);
      return;
    }
    setActingOn(item.id);
    try {
      await skipMeal(item.id);
      setTodayPlan(prev => prev ? updateItemStatus(prev, item.id, "Skipped") : prev);
      await syncSchedules();
    } catch {
      Alert.alert("Hata", "Öğün atlama kaydedilemedi. Lütfen tekrar deneyin.");
    } finally { setActingOn(null); }
  }, [actingOn, language]);

  const handleAlternative = useCallback((item: MealItem) => {
    if (!item.recipeId) return;
    const lockMessage = buildMealLockMessage(item, language);
    if (lockMessage) {
      Alert.alert(language === "tr" ? "Henüz açılamadı" : "Not available yet", lockMessage);
      return;
    }
    setAltPickerMeal(item);
  }, [language]);

  const handleViewRecipe = useCallback((item: MealItem) => {
    if (!item.recipeId) return;
    // Pass calories/macros from MealItem for immediate display; RecipeDetailScreen fetches
    // full ingredient/step data via plan-context endpoint when explanation is absent.
    (navigation as any).navigate(Routes.App.RecipeDetail, {
      result: {
        recipeId: item.recipeId,
        name: item.recipeName ?? item.title,
        description: '',
        score: 0,
        matchStatus: 'FULL_MATCH' as const,
        matchCategory: 'FULL_MATCH' as const,
        sourceType: 'LINKED_CLINIC_PRIVATE',
        mandatoryCount: 0,
        matchedMandatoryCount: 0,
        usedSubstitutes: false,
        missing: [],
        steps: [],
        hasSteps: false,
        isPublic: false,
        isDietitianRecipe: true,
        motivationText: '',
        isOwnedByActiveDietitian: true,
      },
    });
  }, [navigation]);

  const handleViewAlternativeRecipeForMeal = useCallback((item: MealItem) => {
    if (!item.alternativeRecipeId) return;
    (navigation as any).navigate(Routes.App.RecipeDetail, {
      result: {
        recipeId: item.alternativeRecipeId,
        name: item.alternativeRecipeName ?? "Alternatif Tarif",
        description: "",
        score: 0,
        matchStatus: "FULL_MATCH" as const,
        matchCategory: "FULL_MATCH" as const,
        sourceType: "LINKED_CLINIC_PRIVATE",
        mandatoryCount: 0,
        matchedMandatoryCount: 0,
        usedSubstitutes: false,
        missing: [],
        steps: [],
        hasSteps: false,
        isPublic: false,
        isDietitianRecipe: true,
        motivationText: "",
        isOwnedByActiveDietitian: true,
      },
    });
  }, [navigation]);

  const handleOpenMealDetail = useCallback((item: MealItem) => {
    if (item.completionStatus === "Alternative") {
      setAltCompareMeal(item);
    } else {
      setSelectedMeal(item);
    }
  }, []);

  const handlePickerConfirmed = useCallback((payload?: { type: "alternative" | "original"; recipeName?: string }) => {
    void load();
    void syncSchedules();
    if (payload?.type === "alternative") {
      showPlanToast(
        "Alternatif kaydedildi",
        `${payload.recipeName ?? "Seçilen tarif"} bugünkü öğün için alternatif olarak kaydedildi. Plan akışı korunur.`,
      );
    }
  }, [load, showPlanToast, syncSchedules]);

  const handleViewAlternativeRecipe = useCallback(() => {
    if (!altCompareMeal) return;
    handleViewAlternativeRecipeForMeal(altCompareMeal);
  }, [altCompareMeal, handleViewAlternativeRecipeForMeal]);

  const handleChooseAnotherAlternative = useCallback(() => {
    if (!altCompareMeal) return;
    const item = altCompareMeal;
    setAltCompareMeal(null);
    setAltPickerMeal(item);
  }, [altCompareMeal]);

  const handleCloseMealDetail = useCallback(() => {
    setSelectedMeal(null);
  }, []);

  const handleCompleteFromSheet = useCallback(() => {
    if (!selectedMeal) return;
    const item = selectedMeal;
    setSelectedMeal(null);
    void handleComplete(item);
  }, [handleComplete, selectedMeal]);

  const handleSkipFromSheet = useCallback(() => {
    if (!selectedMeal) return;
    const item = selectedMeal;
    setSelectedMeal(null);
    void handleSkip(item);
  }, [handleSkip, selectedMeal]);

  const handleAlternativeFromSheet = useCallback(() => {
    if (!selectedMeal) return;
    const item = selectedMeal;
    setSelectedMeal(null);
    setAltPickerMeal(item);
  }, [selectedMeal]);

  const handleViewRecipeFromSheet = useCallback(() => {
    if (!selectedMeal) return;
    const item = selectedMeal;
    setSelectedMeal(null);
    handleViewRecipe(item);
  }, [handleViewRecipe, selectedMeal]);

  /* ── loading state ── */
  if (loading) {
    return (
      <View style={[s.root, s.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  /* ── derived ── */
  const todayItems   = todayPlan?.items
    ? [...todayPlan.items].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];
  const pendingItems = todayItems.filter(i => i.completionStatus === "Planned");
  const doneItems    = todayItems.filter(i => i.completionStatus === "Done" || i.completionStatus === "Alternative");
  const skippedItems = todayItems.filter(i => i.completionStatus === "Skipped");
  const doneCount    = doneItems.length;
  const totalCount   = todayItems.length;
  const nextMeal     = pendingItems[0] ?? null;
  const toastTop     = (StatusBar.currentHeight ?? 0) + spacing.sm;

  /* ── render ── */
  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={32}
        iconColor={`${theme.primary}42`}
        style={[s.screenGlowA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="carrot"
        iconSize={28}
        iconColor={`${theme.emerald}42`}
        style={[s.screenGlowB, { backgroundColor: theme.emeraldGlow }]}
      />
      {planToast && (
        <RNAnimated.View
          pointerEvents="none"
          style={[
            s.planToastWrap,
            {
              top: toastTop,
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <View
            style={[
              s.planToastCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderEmerald,
                shadowColor: theme.primaryDark,
              },
            ]}
          >
            <View style={[s.planToastIcon, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
            </View>
            <View style={s.planToastContent}>
              <Text style={[s.planToastTitle, { color: theme.text }]}>{planToast.title}</Text>
              <Text style={[s.planToastBody, { color: theme.textSub }]}>{planToast.body}</Text>
            </View>
          </View>
        </RNAnimated.View>
      )}

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isPremium
            ? <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); void load(); }}
                tintColor={theme.primary}
              />
            : undefined
        }
      >
        {/* ─── Header ─── */}
        <PlansHeroBand
          theme={theme}
          language={language}
          title={isPremium ? "Öğünlerini akış halinde gör." : "Plan görünümü premium ile açılır."}
          subtitle={isPremium ? "Bekleyen, tamamlanan ve alternatif öğünler tek zaman çizgisinde." : "Kişisel planını bağlayınca günlük ritmin buradan akacak."}
        />
        <Animated.View style={[s.header, headerStyle]}>
          <Text style={[s.pageTitle, { color: theme.text }]}>Planım</Text>
          <Text style={[s.todayLine, { color: theme.textMuted }]}>{getTodayFormatted()}</Text>
        </Animated.View>
        {isPremium && (
          <TouchableOpacity
            style={[s.shoppingLink, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}
            onPress={() => (navigation as any).navigate(Routes.App.ShoppingList)}
            activeOpacity={0.82}
          >
            <View style={[s.shoppingLinkIcon, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.shoppingLinkTitle, { color: theme.text }]}>
                {language === "tr" ? "Alışveriş Listesi" : "Shopping List"}
              </Text>
              <Text style={[s.shoppingLinkSub, { color: theme.textMuted }]}>
                {language === "tr"
                  ? "AI, bugünkü tariflerinden eksikleri tek akışta çıkarır"
                  : "AI turns today’s plan into a clean grocery sweep"}
              </Text>
            </View>
            <View style={[s.shoppingLinkBadge, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.shoppingLinkBadgeTxt, { color: theme.primary }]}>AI</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSub} />
          </TouchableOpacity>
        )}
        {isPremium && motivation && (
          <MomentumRibbon
            theme={theme}
            motivation={motivation}
            language={language}
          />
        )}

        {/* ─── Premium gate ─── */}
        {!isPremium && (
          <>
            <AppEmptyState
              icon="📅"
              title="Henüz bir planınız yok"
              description="Diyetisyeninizden aldığınız kodla kişisel planınıza ulaşabilirsiniz."
              buttonLabel="🔑 Premium Kodu Gir"
              onButtonPress={() => (navigation as any).navigate(Routes.Modal.ActivatePremium)}
            />
            {onPressKitchen && (
              <TouchableOpacity style={s.exploreLink} onPress={onPressKitchen} activeOpacity={0.7}>
                <Text style={[s.exploreLinkTxt, { color: theme.primary }]}>🍳 Tarifleri Keşfet →</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ─── Premium content ─── */}
        {isPremium && (
          <>
            {todayItems.length === 0 ? (
              <AppEmptyState
                icon="🌿"
                title="Bugün için plan yok"
                description="Diyetisyeniniz size özel bir plan hazırladığında burada görünecek."
              />
            ) : (
              <>
                {/* Daily macro summary */}
              <MacroSummaryBar items={todayItems} theme={theme} language={language} />

                {/* Progress + next meal hero */}
                <DayProgressCard
                  theme={theme}
                  doneCount={doneCount}
                  totalCount={totalCount}
                  pendingCount={pendingItems.length}
                  nextMeal={nextMeal}
                />

                {/* SECTION: Pending */}
                {pendingItems.length > 0 && (
                  <>
                    <SectionHeader
                      label="BEKLEYEN"
                      count={pendingItems.length}
                      accentColor={theme.primary}
                      theme={theme}
                    />
                    {pendingItems.map((item, i) => (
                      <PendingCard
                          key={item.id}
                          item={item}
                          index={i}
                          language={language}
                          theme={theme}
                          isActing={actingOn === item.id}
                          onOpenDetail={() => handleOpenMealDetail(item)}
                          onComplete={() => void handleComplete(item)}
                          onSkip={() => void handleSkip(item)}
                          onAlternative={() => void handleAlternative(item)}
                          onViewRecipe={() => handleViewRecipe(item)}
                      />
                    ))}
                  </>
                )}

                {/* SECTION: Done */}
                {doneItems.length > 0 && (
                  <>
                    <SectionHeader
                      label="TAMAMLANANLAR"
                      count={doneItems.length}
                      accentColor={theme.emerald}
                      theme={theme}
                    />
                    {doneItems.map((item, i) => (
                      <DoneCard
                        key={item.id}
                        item={item}
                        index={i}
                        theme={theme}
                        isActing={actingOn === item.id}
                        flipResetKey={flipResetKey}
                        onOpenDetail={() => handleOpenMealDetail(item)}
                        onViewRecipe={() => handleViewRecipe(item)}
                        onViewAlternativeRecipe={() => handleViewAlternativeRecipeForMeal(item)}
                        onUndo={() => handleComplete(item)}
                      />
                    ))}
                  </>
                )}

                {/* SECTION: Skipped */}
                {skippedItems.length > 0 && (
                  <>
                    <SectionHeader
                      label="ATLANDILAR"
                      count={skippedItems.length}
                      accentColor={theme.textMuted}
                      theme={theme}
                    />
                    {skippedItems.map((item, i) => (
                      <SkippedCard
                        key={item.id}
                        item={item}
                        index={i}
                        theme={theme}
                        onOpenDetail={() => handleOpenMealDetail(item)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ─── All plans list (secondary) ─── */}
        {isPremium && plans.length > 0 && (
          <>
            <Text style={[s.allPlansLabel, { color: theme.textMuted }]}>Tüm Planlarım</Text>
            {plans.map((plan, index) => (
              <PlanCard key={plan.id} plan={plan} index={index} theme={theme} />
            ))}
          </>
        )}

        <View style={s.bottomPad} />
      </ScrollView>

      <MealDetailSheet
          item={selectedMeal}
          visible={selectedMeal != null}
          language={language}
          theme={theme}
          isActing={selectedMeal != null && actingOn === selectedMeal.id}
        onClose={handleCloseMealDetail}
        onComplete={handleCompleteFromSheet}
        onSkip={handleSkipFromSheet}
        onUndo={handleCompleteFromSheet}
        onAlternative={handleAlternativeFromSheet}
        onViewRecipe={handleViewRecipeFromSheet}
      />

      <AlternativePickerSheet
        meal={altPickerMeal}
        onClose={() => setAltPickerMeal(null)}
        onConfirmed={handlePickerConfirmed}
      />

      <AlternativeCompareSheet
        meal={altCompareMeal}
        onClose={() => setAltCompareMeal(null)}
        onUndo={() => { if (altCompareMeal) void handleComplete(altCompareMeal); }}
        onChooseAnotherAlternative={altCompareMeal?.recipeId ? handleChooseAnotherAlternative : undefined}
        onViewAlternativeRecipe={altCompareMeal?.alternativeRecipeId ? handleViewAlternativeRecipe : undefined}
      />
    </View>
  );
}

function MomentumRibbon({
  theme,
  motivation,
  language,
}: {
  theme: import("../theme/tokens").Theme;
  motivation: DashboardMotivation;
  language: "tr" | "en";
}) {
  const summary = buildMotivationSummary(motivation, language);
  return (
    <View style={[s.momentumCard, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
      <View style={[s.momentumIcon, { backgroundColor: `${theme.accentCoral}18`, borderColor: `${theme.accentCoral}28` }]}>
        <Ionicons name="flame-outline" size={16} color={theme.accentCoral} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.momentumTitle, { color: theme.text }]}>{summary.title}</Text>
        <Text style={[s.momentumSub, { color: theme.textSub }]} numberOfLines={2}>
          {summary.subtitle}
        </Text>
      </View>
      <View style={[s.momentumBadge, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
        <Text style={[s.momentumBadgeValue, { color: theme.emerald }]}>{motivation.currentStreak}</Text>
        <Text style={[s.momentumBadgeLabel, { color: theme.textMuted }]}>
          {language === "tr" ? "gun" : "days"}
        </Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════
   DAY PROGRESS + NEXT MEAL HERO
═══════════════════════════════════════════════════════ */
function DayProgressCard({
  theme, doneCount, totalCount, pendingCount, nextMeal,
}: {
  theme: import("../theme/tokens").Theme;
  doneCount: number;
  totalCount: number;
  pendingCount: number;
  nextMeal: MealItem | null;
}) {
  const style    = useScaleSettle(80, 0.97);
  const pct      = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const allDone  = pendingCount === 0;
  const barColor = pct >= 80 ? theme.emerald : pct >= 50 ? theme.primary : theme.accentGold;

  return (
    <Animated.View style={style}>
      <View style={[
        s.progressCard,
        { backgroundColor: theme.surface, borderColor: allDone ? theme.borderEmerald : theme.border },
      ]}>
        {allDone && (
          <View style={[s.progressCardGlow, { backgroundColor: theme.emeraldGlow }]} pointerEvents="none" />
        )}

        {/* Top: title + fraction badge */}
        <View style={s.progressCardTop}>
          <Text style={[s.progressCardTitle, { color: theme.text }]}>Bugünün Öğünleri</Text>
          <View style={[s.progressFractionBadge, { backgroundColor: `${barColor}18`, borderColor: `${barColor}40` }]}>
            <Text style={[s.progressFractionTxt, { color: barColor }]}>
              {doneCount}/{totalCount}
            </Text>
          </View>
        </View>

        {/* Sub message */}
        <Text style={[s.progressSubTxt, { color: theme.textMuted }]}>
          {allDone
            ? "Tüm öğünlerini tamamladın 🎉"
            : `${doneCount} tamamlandı · ${pendingCount} öğün kaldı`}
        </Text>

        {/* Bar */}
        <View style={[s.progressBarTrack, { backgroundColor: theme.borderLight }]}>
          <View style={[
            s.progressBarFill,
            { width: `${pct}%` as any, backgroundColor: barColor, shadowColor: barColor },
          ]} />
        </View>

        {/* Next meal banner / success */}
        {allDone ? (
          <View style={[s.nextBannerSuccess, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
            <Text style={s.nextBannerSuccessEmoji}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.nextBannerSuccessTitle, { color: theme.emerald }]}>Muhteşem bir gün!</Text>
              <Text style={[s.nextBannerSuccessSub, { color: theme.textSub }]}>
                Bugün kendine çok iyi baktın.
              </Text>
            </View>
          </View>
        ) : nextMeal ? (
          <View style={[s.nextBanner, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
            <View style={[s.nextBannerDot, { backgroundColor: theme.emerald }]} />
            <Text style={[s.nextBannerLabel, { color: theme.textMuted }]}>Sıradaki</Text>
            <View style={s.nextBannerMealRow}>
              <View style={[s.mealIconWrap, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
                <Ionicons name={MEAL_TYPE_META[nextMeal.mealType]?.icon ?? "restaurant-outline"} size={15} color={theme.emerald} />
              </View>
              <Text style={[s.nextBannerMealName, { color: theme.text }]} numberOfLines={1}>
                {nextMeal.title}
              </Text>
            </View>
            <Text style={[s.nextBannerTime, { color: theme.primary }]}>{nextMeal.time}</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION HEADER
═══════════════════════════════════════════════════════ */
function SectionHeader({
  label, count, accentColor, theme,
}: {
  label: string;
  count: number;
  accentColor: string;
  theme: import("../theme/tokens").Theme;
}) {
  return (
    <View style={s.sectionHeaderRow}>
      <View style={[s.sectionHeaderLine, { backgroundColor: accentColor }]} />
      <Text style={[s.sectionHeaderLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={[s.sectionHeaderPill, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}30`, borderWidth: 1 }]}>
        <Text style={[s.sectionHeaderCount, { color: accentColor }]}>{count}</Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════
   MACRO CHIP
═══════════════════════════════════════════════════════ */
function MacroChip({ value, color }: { value: string; color: string }) {
  return (
    <View style={[s.macroChip, { backgroundColor: `${color}12`, borderColor: `${color}28` }]}>
      <Text style={[s.macroChipTxt, { color }]}>{value}</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════
   DAILY MACRO SUMMARY BAR
═══════════════════════════════════════════════════════ */
function MacroSummaryBar({
  items,
  theme,
  language,
}: {
  items: MealItem[];
  theme: import("../theme/tokens").Theme;
  language: "tr" | "en";
}) {
  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + (item.calories ?? 0),
      protein:  acc.protein  + (item.macros?.proteinGrams ?? 0),
      carbs:    acc.carbs    + (item.macros?.carbsGrams   ?? 0),
      fat:      acc.fat      + (item.macros?.fatGrams     ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const hasData = totals.calories > 0 || totals.protein > 0 || totals.carbs > 0 || totals.fat > 0;
  if (!hasData) return null;

  return (
    <View style={[s.macroSummaryBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[s.macroSummaryLabel, { color: theme.textMuted }]}>
        {language === "en" ? "Daily Total" : "Günlük Toplam"}
      </Text>
      <RecipeNutritionPanel
        caloriesKcal={Math.round(totals.calories)}
        proteinGrams={Math.round(totals.protein)}
        carbsGrams={Math.round(totals.carbs)}
        fatGrams={Math.round(totals.fat)}
        accent={theme.primary}
        theme={theme}
        title=""
      />
    </View>
  );
}

function MealDetailSheet({
  item,
  visible,
  language,
  theme,
  isActing,
  onClose,
  onComplete,
  onSkip,
  onUndo,
  onAlternative,
  onViewRecipe,
}: {
  item: MealItem | null;
  visible: boolean;
  language: "tr" | "en";
  theme: import("../theme/tokens").Theme;
  isActing: boolean;
  onClose: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onUndo: () => void;
  onAlternative: () => void;
  onViewRecipe: () => void;
}) {
  if (!item) return null;

  const meta = MEAL_TYPE_META[item.mealType] ?? MEAL_TYPE_META.Snack;
  const hasMacros = item.calories || item.macros?.proteinGrams || item.macros?.carbsGrams || item.macros?.fatGrams;
  const isCompleted = item.completionStatus === "Done" || item.completionStatus === "Alternative";
  const lockMessage = buildMealLockMessage(item, language);
  const isLocked = !!lockMessage;
  const statusTone =
    item.completionStatus === "Skipped"
      ? { label: "Atlandı", color: theme.textMuted, bg: theme.borderLight, border: theme.border }
      : isCompleted
        ? { label: item.completionStatus === "Alternative" ? "Alternatif" : "Tamamlandı", color: theme.emerald, bg: theme.glassEmerald, border: theme.borderEmerald }
        : { label: "Bekliyor", color: theme.primary, bg: theme.primaryLight, border: theme.borderEmerald };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.detailBackdrop}>
        <TouchableOpacity style={s.detailBackdropTap} activeOpacity={1} onPress={onClose} />

        <View style={[s.detailSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[s.detailHandle, { backgroundColor: theme.border }]} />

          <View style={s.detailHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.detailEyebrow, { color: theme.textMuted }]}>
                {item.time} · {meta.label}
              </Text>
              <Text style={[s.detailTitle, { color: theme.text }]}>
                {item.title}
              </Text>
            </View>
            <View style={[s.detailStatusBadge, { backgroundColor: statusTone.bg, borderColor: statusTone.border }]}>
              <Text style={[s.detailStatusText, { color: statusTone.color }]}>{statusTone.label}</Text>
            </View>
          </View>

          {!!item.note && (
            <View style={[s.detailNoteBox, { backgroundColor: theme.surfaceElevated, borderLeftColor: theme.borderEmerald }]}>
              <Text style={[s.detailNoteLabel, { color: theme.textMuted }]}>Diyetisyen notu</Text>
              <Text style={[s.detailNoteText, { color: theme.textSub }]}>{item.note}</Text>
            </View>
          )}

          {isLocked && (
            <View style={[s.detailNoteBox, { backgroundColor: theme.surfaceElevated, borderLeftColor: theme.border }]}>
              <Text style={[s.detailNoteLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "Aksiyon zamanı" : "Action window"}
              </Text>
              <Text style={[s.detailNoteText, { color: theme.textSub }]}>{lockMessage}</Text>
            </View>
          )}

          {!!hasMacros && (
            <View style={s.detailMacroSection}>
              <Text style={[s.detailSectionLabel, { color: theme.textMuted }]}>Besin değerleri</Text>
              <View style={s.detailMacroRow}>
                {!!item.calories && <MacroChip value={`${item.calories} kcal`} color={theme.macroCalorie} />}
                {!!item.macros?.proteinGrams && <MacroChip value={`P ${item.macros.proteinGrams}g`} color={theme.macroProtein} />}
                {!!item.macros?.carbsGrams && <MacroChip value={`K ${item.macros.carbsGrams}g`} color={theme.macroCarb} />}
                {!!item.macros?.fatGrams && <MacroChip value={`Y ${item.macros.fatGrams}g`} color={theme.macroFat} />}
              </View>
            </View>
          )}

          {!!item.recipeId && (
            <TouchableOpacity
              style={[s.detailRecipeBtn, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}
              onPress={onViewRecipe}
              activeOpacity={0.8}
              disabled={isActing || isLocked}
            >
              <Ionicons name="book-outline" size={16} color={theme.primary} />
              <Text style={[s.detailRecipeBtnText, { color: theme.primary }]}>Tarifini Gör</Text>
            </TouchableOpacity>
          )}

          <View style={s.detailActions}>
            {isCompleted ? (
              <TouchableOpacity
                style={[s.detailPrimaryBtn, { backgroundColor: theme.primary }]}
                onPress={onUndo}
                activeOpacity={0.78}
                disabled={isActing}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="arrow-undo-outline" size={16} color="#fff" />
                    <Text style={s.detailPrimaryBtnText}>Geri Al</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[s.detailPrimaryBtn, { backgroundColor: theme.primary }]}
                  onPress={onComplete}
                  activeOpacity={0.78}
                  disabled={isActing || isLocked}
                >
                  {isActing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text style={s.detailPrimaryBtnText}>{isLocked ? (language === "tr" ? "Henüz Açılmadı" : "Locked") : "Tamamla"}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={s.detailSecondaryRow}>
                  <TouchableOpacity
                    style={[s.detailGhostBtn, { borderColor: theme.border }]}
                    onPress={onSkip}
                    activeOpacity={0.75}
                    disabled={isActing || isLocked}
                  >
                    <Ionicons name="close-circle-outline" size={14} color={theme.textMuted} />
                    <Text style={[s.detailGhostBtnText, { color: theme.textMuted }]}>Atla</Text>
                  </TouchableOpacity>

                  {!!item.recipeId && (
                    <TouchableOpacity
                      style={[s.detailGhostBtn, { borderColor: theme.border }]}
                      onPress={onAlternative}
                      activeOpacity={0.75}
                      disabled={isActing || isLocked}
                    >
                      <Ionicons name="swap-horizontal-outline" size={14} color={theme.textMuted} />
                      <Text style={[s.detailGhostBtnText, { color: theme.textMuted }]}>Alternatif</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════
   PENDING CARD — full size, primary actions
═══════════════════════════════════════════════════════ */
function PendingCard({
  item, index, language, theme, isActing, onOpenDetail, onComplete, onSkip, onAlternative, onViewRecipe,
}: {
  item: MealItem;
  index: number;
  language: "tr" | "en";
  theme: import("../theme/tokens").Theme;
  isActing: boolean;
  onOpenDetail: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onAlternative: () => void;
  onViewRecipe: () => void;
}) {
  const style = useStaggerItem(index, 120, 60);
  const meta  = MEAL_TYPE_META[item.mealType] ?? MEAL_TYPE_META.Snack;
  const hasMacros = item.calories || item.macros?.proteinGrams || item.macros?.carbsGrams || item.macros?.fatGrams;
  const lockMessage = buildMealLockMessage(item, language);
  const isLocked = !!lockMessage;

  return (
    <Animated.View style={style}>
      <View style={[s.pendingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[s.cardStrip, { backgroundColor: theme.primary + "70" }]} />

        <View style={s.pendingBody}>
          <TouchableOpacity activeOpacity={0.82} onPress={onOpenDetail}>
          {/* Time + emoji + title */}
          <View style={s.cardTopRow}>
            <Text style={[s.cardTime, { color: theme.primary }]}>{item.time}</Text>
            <View style={[s.mealIconWrap, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
              <Ionicons name={meta.icon} size={16} color={theme.primaryDark} />
            </View>
            <View style={s.cardTitleBlock}>
              <Text style={[s.cardTypeLabel, { color: theme.textMuted }]}>{meta.label}</Text>
              <Text style={[s.cardTitle, { color: theme.text }]} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            {isLocked ? (
              <View style={[s.lockPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Ionicons name="time-outline" size={12} color={theme.textMuted} />
                <Text style={[s.lockPillTxt, { color: theme.textMuted }]}>
                  {language === "tr" ? "Henüz değil" : "Locked"}
                </Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            )}
          </View>

          {/* Macro chips — semantic nutrition colors */}
          {!!hasMacros && (
            <View style={s.macroRow}>
              {!!item.calories && (
                <MacroChip value={`${item.calories} kcal`} color={theme.macroCalorie} />
              )}
              {!!item.macros?.proteinGrams && (
                <MacroChip value={`P ${item.macros.proteinGrams}g`} color={theme.macroProtein} />
              )}
              {!!item.macros?.carbsGrams && (
                <MacroChip value={`K ${item.macros.carbsGrams}g`} color={theme.macroCarb} />
              )}
              {!!item.macros?.fatGrams && (
                <MacroChip value={`Y ${item.macros.fatGrams}g`} color={theme.macroFat} />
              )}
            </View>
          )}

          {/* Note */}
          {!!item.note && (
            <View style={[s.noteBox, { backgroundColor: theme.surfaceElevated, borderLeftColor: theme.borderEmerald }]}>
              <Text style={[s.noteText, { color: theme.textSub }]} numberOfLines={3}>
                {item.note}
              </Text>
            </View>
          )}
          {isLocked && (
            <View style={[s.lockHintBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Ionicons name="lock-closed-outline" size={14} color={theme.textMuted} />
              <Text style={[s.lockHintText, { color: theme.textMuted }]}>{lockMessage}</Text>
            </View>
          )}
          </TouchableOpacity>

          {/* Actions */}
          <View style={s.pendingActions}>
            {/* Primary: Yaptım */}
            <TouchableOpacity
              style={[s.doneBtn, { backgroundColor: theme.primary, shadowColor: theme.primaryGlow }]}
              onPress={onComplete}
              disabled={isActing || isLocked}
              activeOpacity={0.75}
            >
              {isActing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name={isLocked ? "lock-closed-outline" : "checkmark-circle-outline"} size={15} color="#fff" />
                  <Text style={s.doneBtnTxt}>{isLocked ? (language === "tr" ? "Saati Bekliyor" : "Waiting") : "Yaptım"}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Secondary row: Atladım + Alternatif + Tarif */}
            <View style={s.secondaryBtnRow}>
              <TouchableOpacity
                style={[s.ghostBtn, { borderColor: theme.border }]}
                onPress={onSkip}
                disabled={isActing || isLocked}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={13} color={theme.textMuted} />
                <Text style={[s.ghostBtnTxt, { color: theme.textMuted }]}>Atladım</Text>
              </TouchableOpacity>

              {!!item.recipeId && (
                <TouchableOpacity
                  style={[s.ghostBtn, { borderColor: theme.border }]}
                  onPress={onAlternative}
                  disabled={isActing || isLocked}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal-outline" size={13} color={theme.textMuted} />
                  <Text style={[s.ghostBtnTxt, { color: theme.textMuted }]}>Alternatif</Text>
                </TouchableOpacity>
              )}

              {!!item.recipeId && (
                <TouchableOpacity
                  style={[s.ghostBtn, { borderColor: theme.borderEmerald }]}
                  onPress={onViewRecipe}
                  disabled={isActing}
                  activeOpacity={0.7}
                >
                  <Ionicons name="book-outline" size={13} color={theme.primary} />
                  <Text style={[s.ghostBtnTxt, { color: theme.primary }]}>Tarif</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════
   DONE CARD — polished success card with alt flip
═══════════════════════════════════════════════════════ */
function DoneCard({
  item, index, theme, isActing, onOpenDetail, onViewRecipe, onViewAlternativeRecipe, onUndo, flipResetKey,
}: {
  item: MealItem;
  index: number;
  theme: import("../theme/tokens").Theme;
  isActing: boolean;
  onOpenDetail: () => void;
  onViewRecipe: () => void;
  onViewAlternativeRecipe: () => void;
  onUndo: () => void;
  flipResetKey: number;
}) {
  const style  = useStaggerItem(index, 180, 50);
  const meta   = MEAL_TYPE_META[item.mealType] ?? MEAL_TYPE_META.Snack;
  const isAlt  = item.completionStatus === "Alternative";
  const hasMacros    = item.calories || item.macros?.proteinGrams || item.macros?.carbsGrams || item.macros?.fatGrams;
  const hasAltMacros = item.alternativeCalories || item.alternativeMacros?.proteinGrams || item.alternativeMacros?.carbsGrams || item.alternativeMacros?.fatGrams;
  const accentColor = isAlt ? theme.accentGold : theme.emerald;
  const statusBorder = `${accentColor}2C`;
  const statusSurface = `${accentColor}12`;
  const lastTapRef = useRef(0);
  const isFlippingRef = useRef(false);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showBack, setShowBack]   = useState(false);
  const flipScaleX                = useRef(new RNAnimated.Value(1)).current;
  const prevResetKey              = useRef(flipResetKey);
  const contextualTitle = showBack && isAlt
    ? (item.alternativeRecipeName ?? "Alternatif tarif")
    : (item.recipeName ?? item.title);
  const contextualRecipeHandler = showBack && isAlt ? onViewAlternativeRecipe : onViewRecipe;
  const contextualRecipeAvailable = showBack && isAlt ? !!item.alternativeRecipeId : !!item.recipeId;
  const contextualMeta = isAlt
    ? `${item.time} • ${showBack ? "Alternatif tarif" : "Planlanan tarif"}`
    : item.time;
  const flipGuideText = showBack
    ? "Planlanan öğün için 2 kere dokun."
    : "Alternatif için 2 kere dokun.";

  const triggerFlip = useCallback((nextSide?: boolean) => {
    if (!isAlt || isFlippingRef.current) return;
    isFlippingRef.current = true;

    RNAnimated.timing(flipScaleX, { toValue: 0, duration: 190, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) {
        isFlippingRef.current = false;
        return;
      }

      setShowBack(prev => (typeof nextSide === "boolean" ? nextSide : !prev));

      RNAnimated.timing(flipScaleX, { toValue: 1, duration: 220, useNativeDriver: true }).start(() => {
        isFlippingRef.current = false;
      });
    });
  }, [flipScaleX, isAlt]);

  useEffect(() => {
    if (flipResetKey !== prevResetKey.current && showBack) {
      triggerFlip(false);
    }
    if (singleTapTimeoutRef.current) {
      clearTimeout(singleTapTimeoutRef.current);
      singleTapTimeoutRef.current = null;
    }
    lastTapRef.current = 0;
    prevResetKey.current = flipResetKey;
  }, [flipResetKey, showBack, triggerFlip]);

  const handleCardTap = useCallback(() => {
    if (!isAlt) {
      onOpenDetail();
      return;
    }
    if (isFlippingRef.current) return;

    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapRef.current = 0;
      triggerFlip();
      return;
    }

    lastTapRef.current = now;
    if (singleTapTimeoutRef.current) {
      clearTimeout(singleTapTimeoutRef.current);
    }
    singleTapTimeoutRef.current = setTimeout(() => {
      lastTapRef.current = 0;
      singleTapTimeoutRef.current = null;
      onOpenDetail();
    }, 285);
  }, [isAlt, onOpenDetail, triggerFlip]);

  useEffect(() => () => {
    if (singleTapTimeoutRef.current) {
      clearTimeout(singleTapTimeoutRef.current);
    }
    lastTapRef.current = 0;
  }, []);

  return (
    <Animated.View style={style}>
      <RNAnimated.View style={[
        s.doneCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.primaryGlow,
          transform: [{ scaleX: flipScaleX }],
        },
      ]}>
        <View style={[s.doneAccentBar, { backgroundColor: theme.emerald }]} pointerEvents="none" />

        <View style={s.doneBody}>
          <View style={s.doneTopRow}>
            <View style={s.doneTopMeta}>
              <View style={[s.doneTypePill, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
                <Ionicons name={meta.icon} size={12} color={theme.emerald} />
                <Text style={[s.doneTypePillTxt, { color: theme.emerald }]}>{meta.label}</Text>
              </View>

              {isAlt && (
                <View style={[s.doneFaceSwitch, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <View
                    style={[
                      s.doneFaceOption,
                      !showBack && { backgroundColor: `${theme.emerald}14` },
                    ]}
                  >
                    <View style={[s.doneFaceDot, { backgroundColor: !showBack ? theme.emerald : `${theme.textMuted}66` }]} />
                    <Text style={[s.doneFaceOptionText, { color: !showBack ? theme.emerald : theme.textMuted }]}>
                      Planlanan
                    </Text>
                  </View>

                  <View
                    style={[
                      s.doneFaceOption,
                      showBack && { backgroundColor: `${theme.accentGold}14` },
                    ]}
                  >
                    <View style={[s.doneFaceDot, { backgroundColor: showBack ? theme.accentGold : `${theme.textMuted}66` }]} />
                    <Text style={[s.doneFaceOptionText, { color: showBack ? theme.accentGold : theme.textMuted }]}>
                      Alternatif
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={[s.doneStatusBadge, { backgroundColor: statusSurface, borderColor: statusBorder }]}>
              <Ionicons name="checkmark-circle" size={11} color={accentColor} />
              <Text style={[s.doneStatusTxt, { color: accentColor }]}>
                {isAlt ? "Seçim yapıldı" : "Tamamlandı"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              s.doneBodyTouch,
              isAlt && [s.doneBodyTouchAlt, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }],
            ]}
            onPress={handleCardTap}
            activeOpacity={0.96}
          >
            <View style={s.doneTitleBlock}>
              <Text style={[s.doneTimeLabel, { color: theme.textMuted }]}>{contextualMeta}</Text>
              <Text style={[s.doneTitleTxt, { color: theme.text }]} numberOfLines={2}>
                {contextualTitle}
              </Text>
            </View>

            {!!(showBack && isAlt ? hasAltMacros : hasMacros) && (
              <View style={s.doneMacroRow}>
                {!!(showBack && isAlt ? item.alternativeCalories : item.calories) && (
                  <MacroChip
                    value={`${showBack && isAlt ? item.alternativeCalories : item.calories} kcal`}
                    color={theme.macroCalorie}
                  />
                )}
                {!!(showBack && isAlt ? item.alternativeMacros?.proteinGrams : item.macros?.proteinGrams) && (
                  <MacroChip
                    value={`P ${showBack && isAlt ? item.alternativeMacros?.proteinGrams : item.macros?.proteinGrams}g`}
                    color={theme.macroProtein}
                  />
                )}
                {!!(showBack && isAlt ? item.alternativeMacros?.carbsGrams : item.macros?.carbsGrams) && (
                  <MacroChip
                    value={`K ${showBack && isAlt ? item.alternativeMacros?.carbsGrams : item.macros?.carbsGrams}g`}
                    color={theme.macroCarb}
                  />
                )}
                {!!(showBack && isAlt ? item.alternativeMacros?.fatGrams : item.macros?.fatGrams) && (
                  <MacroChip
                    value={`Y ${showBack && isAlt ? item.alternativeMacros?.fatGrams : item.macros?.fatGrams}g`}
                    color={theme.macroFat}
                  />
                )}
              </View>
            )}

            {isAlt && (
              <View style={s.doneGuideRow}>
                <Ionicons name="sync-outline" size={13} color={theme.textMuted} />
                <Text style={[s.doneGuideText, { color: theme.textMuted }]}>{flipGuideText}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={[s.doneDivider, { backgroundColor: theme.border }]} />
          <View style={s.doneActionRow}>
            <TouchableOpacity
              style={[
                s.doneDetailBtn,
                {
                  backgroundColor: contextualRecipeAvailable ? statusSurface : theme.surfaceElevated,
                  borderColor: contextualRecipeAvailable ? statusBorder : theme.border,
                },
              ]}
              onPress={contextualRecipeHandler}
              disabled={!contextualRecipeAvailable}
              activeOpacity={0.72}
            >
              <Ionicons
                name="book-outline"
                size={14}
                color={contextualRecipeAvailable ? accentColor : theme.textMuted}
              />
              <Text style={[s.doneDetailBtnTxt, { color: contextualRecipeAvailable ? accentColor : theme.textMuted }]}>
                Tarifi Gör
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.doneUndoBtn, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
              onPress={onUndo}
              disabled={isActing}
              activeOpacity={0.72}
            >
              {isActing ? (
                <ActivityIndicator size="small" color={theme.textMuted} />
              ) : (
                <>
                  <Ionicons name="arrow-undo-outline" size={14} color={theme.textSub} />
                  <Text style={[s.doneUndoBtnTxt, { color: theme.textSub }]}>Geri Al</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </RNAnimated.View>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════
   SKIPPED CARD — compact, muted
═══════════════════════════════════════════════════════ */
function SkippedCard({
  item, index, theme, onOpenDetail,
}: {
  item: MealItem;
  index: number;
  theme: import("../theme/tokens").Theme;
  onOpenDetail: () => void;
}) {
  const style = useStaggerItem(index, 240, 45);
  const meta  = MEAL_TYPE_META[item.mealType] ?? MEAL_TYPE_META.Snack;

  return (
    <Animated.View style={style}>
      <View style={[s.skippedCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={[s.cardStrip, { backgroundColor: theme.textMuted + "35" }]} />

        <View style={s.skippedInner}>
          {/* Info row */}
          <View style={s.skippedBody}>
            <Text style={[s.cardTime, { color: theme.textMuted }]}>{item.time}</Text>
            <View style={[s.mealIconWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name={meta.icon} size={15} color={theme.textMuted} />
            </View>
            <View style={s.cardTitleBlock}>
              <Text style={[s.cardTypeLabel, { color: theme.textMuted + "99" }]}>{meta.label}</Text>
              <Text style={[s.skippedTitle, { color: theme.textMuted }]} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <View style={[s.skippedBadge, { backgroundColor: theme.textMuted + "14", borderColor: theme.border }]}>
              <Text style={[s.skippedBadgeTxt, { color: theme.textMuted }]}>Atlandı</Text>
            </View>
          </View>

          {/* Detay button */}
          <TouchableOpacity
            style={[s.skippedDetailBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={onOpenDetail}
            activeOpacity={0.72}
          >
            <Ionicons name="eye-outline" size={12} color={theme.textSub} />
            <Text style={[s.skippedDetailBtnTxt, { color: theme.textSub }]}>Detay</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════
   PLAN CARD (secondary list — unchanged logic)
═══════════════════════════════════════════════════════ */
function PlanCard({
  plan, index, theme,
}: {
  plan: ClientPlan;
  index: number;
  theme: import("../theme/tokens").Theme;
}) {
  const style      = useFadeRise(index * 80);
  const progress   = plan.mealCount > 0 ? plan.completedMeals / plan.mealCount : 0;
  const progressPct = Math.round(progress * 100);
  const startStr   = formatDate(plan.startDate);
  const endStr     = formatDate(plan.endDate);
  const isActive   = plan.isActive;
  const stripColor = isActive ? theme.emerald : theme.textMuted + '40';
  const barColor   = progressPct >= 80 ? theme.emerald : progressPct >= 50 ? theme.primary : theme.accentGold;

  return (
    <Animated.View style={[
      s.planCard,
      {
        backgroundColor: isActive ? theme.surface : theme.surfaceElevated,
        borderColor:     isActive ? theme.borderEmerald : theme.border,
        shadowOpacity:   isActive ? 0.10 : 0.04,
      },
      style,
    ]}>
      <View style={[s.cardStrip, { backgroundColor: stripColor }]} />
      <View style={s.planBody}>

        {/* ── Status badge row ── */}
        <View style={s.planTopRow}>
          <View style={[
            s.activeBadge,
            isActive
              ? { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }
              : { backgroundColor: theme.borderLight },
          ]}>
            {isActive && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.emerald }} />}
            <Text style={[s.activeBadgeTxt, { color: isActive ? theme.emerald : theme.textMuted }]}>
              {isActive ? 'Aktif Plan' : 'Geçmiş'}
            </Text>
          </View>
          {plan.mealCount > 0 && (
            <View style={[s.mealBadge, { backgroundColor: theme.borderLight }]}>
              <Text style={[s.mealBadgeTxt, { color: theme.textMuted }]}>{plan.mealCount} öğün</Text>
            </View>
          )}
        </View>

        {/* ── Plan name ── */}
        <Text style={[s.planName, { color: isActive ? theme.text : theme.textSub, marginTop: 8 }]} numberOfLines={2}>
          {plan.name}
        </Text>

        {!!plan.description && plan.description.trim().length >= 15 && (
          <Text style={[s.planDesc, { color: theme.textSub }]} numberOfLines={2}>
            {plan.description}
          </Text>
        )}

        {/* ── Date range ── */}
        {(startStr || endStr) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <Ionicons name="calendar-outline" size={12} color={theme.textMuted} />
            <Text style={[s.dateTxt, { color: theme.textMuted, marginTop: 0 }]}>
              {startStr}{endStr ? ` → ${endStr}` : ''}
            </Text>
          </View>
        )}

        {/* ── Progress bar (for active AND completed plans with meals) ── */}
        {plan.mealCount > 0 && (
          <View style={[s.planProgressSection, { marginTop: isActive ? 14 : 10 }]}>
            <View style={s.planProgressHeader}>
              <Text style={[s.planProgressLabel, { color: theme.textMuted }]}>
                {isActive ? 'İlerleme' : 'Tamamlama'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.planProgressFraction, { color: theme.textSub }]}>
                  {plan.completedMeals}/{plan.mealCount}
                </Text>
                <Text style={[s.planProgressFraction, { color: barColor, fontWeight: '700' }]}>
                  %{progressPct}
                </Text>
              </View>
            </View>
            <View style={[s.progressBarTrack, { backgroundColor: theme.borderLight }]}>
              <View style={[
                s.progressBarFill,
                { backgroundColor: barColor, width: `${progressPct}%` as any, shadowColor: barColor },
              ]} />
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root:    { flex: 1 },
  centered:{ justifyContent: "center", alignItems: "center" },
  scroll:  { paddingHorizontal: spacing.lg, paddingTop: spacing.xl + 18 },
  planToastWrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 30,
  },
  planToastCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  planToastIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  planToastContent: { flex: 1, gap: 3 },
  planToastTitle: { fontSize: 13, fontWeight: "900" },
  planToastBody: { fontSize: 12, fontWeight: "600", lineHeight: 18 },
  bottomPad: { height: 132 },
  screenGlowA: {
    position: "absolute",
    top: 24,
    right: -56,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.7,
  },
  screenGlowB: {
    position: "absolute",
    top: 320,
    left: -68,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.5,
  },
  plansHeroBand: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  plansHeroBlobA: {
    position: "absolute",
    top: -40,
    right: -28,
    width: 112,
    height: 112,
    borderRadius: 56,
    opacity: 0.9,
  },
  plansHeroBlobB: {
    position: "absolute",
    bottom: -32,
    left: -18,
    width: 84,
    height: 84,
    borderRadius: 42,
    opacity: 0.78,
  },
  plansHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  plansHeroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  plansHeroChipText: { fontSize: 12, fontWeight: "800" },
  plansHeroMini: {
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  plansHeroMiniText: { fontSize: 11, fontWeight: "800" },
  plansHeroTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 32,
    marginBottom: 6,
    maxWidth: 280,
  },
  plansHeroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 310,
  },

  header:    { marginBottom: spacing.lg },
  pageTitle: { fontSize: 36, fontWeight: "900", letterSpacing: -0.5, marginBottom: 4 },
  todayLine: { fontSize: 13, fontWeight: "600" },

  shoppingLink: {
    borderWidth: 1,
    borderRadius: radii.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  shoppingLinkIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shoppingLinkBadge: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shoppingLinkBadgeTxt: { fontSize: 11, fontWeight: "900" },
  shoppingLinkTitle: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  shoppingLinkSub: { fontSize: 12, lineHeight: 17 },
  momentumCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  momentumIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  momentumTitle: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  momentumSub: { fontSize: 11.5, lineHeight: 17 },
  momentumBadge: {
    minWidth: 54,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  momentumBadgeValue: { fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  momentumBadgeLabel: { fontSize: 9, fontWeight: "700", marginTop: 1 },

  exploreLink:    { marginTop: spacing.md, paddingVertical: spacing.sm },
  exploreLinkTxt: { fontSize: 13, fontWeight: "800" },

  allPlansLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase",
    marginTop: spacing.xl, marginBottom: spacing.sm,
  },

  /* ── Progress Card ── */
  progressCard: {
    borderRadius: radii.xl, borderWidth: 1, padding: 18, marginBottom: spacing.md,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 6,
  },
  progressCardGlow: { position: "absolute", top: -50, right: -50, width: 160, height: 160, borderRadius: 80, opacity: 0.18 },
  progressCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  progressCardTitle: { fontSize: 15, fontWeight: "800" },
  progressFractionBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  progressFractionTxt: { fontSize: 13, fontWeight: "900" },
  progressSubTxt: { fontSize: 12, fontWeight: "600", marginBottom: 12 },
  progressBarTrack: { height: 5, borderRadius: 3, overflow: "hidden", marginBottom: 14 },
  progressBarFill: {
    height: "100%", borderRadius: 3,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 2,
  },

  /* Next meal banner */
  nextBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: radii.md, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  nextBannerDot:    { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  nextBannerLabel:  { fontSize: 10, fontWeight: "700", flexShrink: 0 },
  nextBannerMealRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  nextBannerMealName: { flex: 1, fontSize: 13, fontWeight: "700" },
  nextBannerTime:   { fontSize: 12, fontWeight: "900", flexShrink: 0 },

  /* Success banner */
  nextBannerSuccess: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: radii.md, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  nextBannerSuccessEmoji: { fontSize: 22 },
  nextBannerSuccessTitle: { fontSize: 14, fontWeight: "900", marginBottom: 1 },
  nextBannerSuccessSub:   { fontSize: 11, fontWeight: "500" },

  /* ── Section Header ── */
  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  sectionHeaderLine: { width: 3, height: 14, borderRadius: 2 },
  sectionHeaderLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.1, flex: 1 },
  sectionHeaderPill:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radii.full },
  sectionHeaderCount: { fontSize: 11, fontWeight: "900" },

  /* ── Shared card pieces ── */
  cardStrip: { width: 3, alignSelf: "stretch", marginVertical: 10, marginLeft: 6, borderRadius: 2 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardTime:   { fontSize: 13, fontWeight: "800", minWidth: 44, paddingTop: 1 },
  cardEmoji:  { fontSize: 19, lineHeight: 24 },
  mealIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleBlock: { flex: 1 },
  cardTypeLabel:  { fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 1 },
  cardTitle:  { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  lockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  lockPillTxt: { fontSize: 10, fontWeight: "800" },
  lockHintBox: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lockHintText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" },

  /* ── Macro Chip ── */
  macroRow:  { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  macroChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, borderWidth: 1 },
  macroChipTxt: { fontSize: 10, fontWeight: "700" },

  macroSummaryBar: {
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  macroSummaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  macroSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  macroSummaryChip: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  macroSummaryValue: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  macroSummaryUnit: {
    fontSize: 11,
    fontWeight: "700",
  },

  /* ── Note box ── */
  noteBox: {
    marginTop: 8, borderRadius: 6, padding: 9,
    borderLeftWidth: 2,
  },
  noteText: { fontSize: 12, fontWeight: "500", lineHeight: 17 },

  detailBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  detailBackdropTap: { flex: 1 },
  detailSheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    maxHeight: "82%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 18,
  },
  detailHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
  },
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  detailEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  detailStatusBadge: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailStatusText: { fontSize: 11, fontWeight: "800" },
  detailNoteBox: {
    borderLeftWidth: 3,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  detailNoteLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  detailNoteText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  detailMacroSection: { gap: spacing.sm },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  detailMacroRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailRecipeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  detailRecipeBtnText: { fontSize: 14, fontWeight: "800" },
  detailActions: { gap: spacing.sm },
  detailPrimaryBtn: {
    minHeight: 52,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  detailPrimaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  detailSecondaryRow: { flexDirection: "row", gap: spacing.sm },
  detailGhostBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  detailGhostBtnText: { fontSize: 13, fontWeight: "800" },
  detailRowText: { fontSize: 11, fontWeight: "700" },

  /* ── Pending card ── */
  pendingCard: {
    borderRadius: radii.xl, borderWidth: 1, marginBottom: spacing.sm,
    flexDirection: "row", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  pendingBody: { flex: 1, padding: spacing.md, paddingLeft: spacing.sm },
  pendingActions: { marginTop: 12, gap: 8 },
  doneBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: radii.md,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 4,
  },
  doneBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "900" },
  secondaryBtnRow: { flexDirection: "row", gap: 8 },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radii.full, borderWidth: 1, backgroundColor: "transparent",
  },
  ghostBtnTxt: { fontSize: 11, fontWeight: "700" },

  /* ── Done card ── */
  doneCard: {
    borderRadius: radii.xl, borderWidth: 1, marginBottom: spacing.sm,
    overflow: "hidden",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 4,
  },
  doneAccentBar: { height: 3, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  doneBody: { padding: spacing.md, gap: 10 },
  doneTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  doneTopMeta: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  doneBodyTouch: { gap: 10 },
  doneBodyTouchAlt: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  doneTypePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radii.full, borderWidth: 1,
  },
  doneTypePillTxt: { fontSize: 11, fontWeight: "800" },
  doneFaceSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.full,
    padding: 3,
  },
  doneFaceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radii.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  doneFaceDot: { width: 6, height: 6, borderRadius: 3 },
  doneFaceOptionText: { fontSize: 10.5, fontWeight: "800" },
  doneStatusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: radii.full, borderWidth: 1,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  doneStatusTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.2 },
  doneTitleBlock: { gap: 3 },
  doneTimeLabel: { fontSize: 11, fontWeight: "700" },
  doneTitleTxt: { fontSize: 16, fontWeight: "800", lineHeight: 22, letterSpacing: -0.3 },
  doneMacroRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  doneGuideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  doneGuideText: { fontSize: 11.5, fontWeight: "600", lineHeight: 16 },
  doneDivider: { height: 1, marginHorizontal: -spacing.md, opacity: 0.5 },
  doneActionRow: { flexDirection: "row", gap: 8 },
  doneDetailBtn: {
    flex: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: radii.lg, borderWidth: 1,
  },
  doneDetailBtnTxt: { fontSize: 13, fontWeight: "800" },
  doneUndoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.lg, borderWidth: 1,
  },
  doneUndoBtnTxt: { fontSize: 13, fontWeight: "700" },

  /* ── Skipped card ── */
  skippedCard: {
    borderRadius: radii.lg, borderWidth: 1, marginBottom: spacing.xs,
    flexDirection: "row", overflow: "hidden",
  },
  skippedInner: { flex: 1, paddingVertical: 10, paddingRight: spacing.md, paddingLeft: spacing.sm, gap: 8 },
  skippedBody: { flexDirection: "row", alignItems: "center", gap: 8 },
  skippedEmoji: { fontSize: 16, opacity: 0.55 },
  skippedTitle: { fontSize: 12, fontWeight: "600" },
  skippedBadge: { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0 },
  skippedBadgeTxt: { fontSize: 9.5, fontWeight: "700" },
  skippedDetailBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingVertical: 8, borderRadius: radii.md, borderWidth: 1,
  },
  skippedDetailBtnTxt: { fontSize: 12, fontWeight: "700" },

  /* ── Plan card ── */
  planCard: {
    borderRadius: radii.xl, borderWidth: 1, marginBottom: spacing.sm,
    flexDirection: "row", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  planBody: { flex: 1, padding: spacing.md },
  planTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  planName: { fontSize: 16, fontWeight: "900", flex: 1, marginRight: spacing.sm },
  badgeGroup: { flexDirection: "row", gap: 5, flexShrink: 0 },
  activeBadge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeTxt: { fontSize: 11, fontWeight: "800" },
  mealBadge: { borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 4 },
  mealBadgeTxt: { fontSize: 11, fontWeight: "700" },
  planDesc: { fontSize: 12, fontWeight: "500", lineHeight: 18, marginBottom: spacing.sm },
  dateTxt: { fontSize: 11, fontWeight: "600", marginBottom: spacing.sm },
  planProgressSection: { marginTop: spacing.xs },
  planProgressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  planProgressLabel: { fontSize: 10, fontWeight: "700" },
  planProgressFraction: { fontSize: 13, fontWeight: "900" },
});


