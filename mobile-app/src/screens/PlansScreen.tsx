/**
 * AURA CLINICAL OS — Plans Screen
 * Guided daily ritual: sectioned flow, focus refresh, macro chips, next-meal hero
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
import { useInAppNotifications } from "../context/InAppNotificationContext";
import { radii, spacing } from "../theme/tokens";
import { useFadeRise, useScaleSettle, useStaggerItem } from "../hooks/useAuraMotion";
import { useGamification } from "../queries/useGamification";
import { buildMotivationSummary, mapGamificationToMotivation, type DashboardMotivation } from "../motivation/streaks";
import {
  getPlansData, getTodayPlan, completeMeal, skipMeal, undoMealCompletion,
  saveMealFeedback, selectMealRecipe,
  type ClientPlan, type TodayPlan, type MealItem, type MealType, type MealCompletionStatus, type MealCompletionTarget,
} from "../data/plansRepo";
import AppEmptyState from "../components/ui/AppEmptyState";
import DytopiaLoadingState from "../components/ui/DytopiaLoadingState";
import ProduceBubble from "../components/decor/ProduceBubble";
import DytopiaWatermark from "../components/decor/DytopiaWatermark";
import AlternativePickerSheet from "../components/AlternativePickerSheet";
import AlternativeCompareSheet from "../components/AlternativeCompareSheet";
import RecipeNutritionPanel from "../components/recipes/RecipeNutritionPanel";
import { buildWeeklyDigest } from "../features/smartInsights";
import {
  buildAlternateRecipeAppliedNotification,
  buildMealCompletedNotification,
  buildMealFeedbackNotificationForSource,
} from "../notifications/notificationEvents";

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

type MealTypeGroup = {
  key: MealType;
  label: string;
  order: number;
  items: MealItem[];
  indexById: Record<string, number>;
};

function getMealGroupLabel(mealType: MealType): string {
  switch (mealType) {
    case "Breakfast": return "Kahvaltı";
    case "MidMorning": return "Ara Öğün";
    case "Lunch": return "Öğle";
    case "Afternoon": return "İkindi";
    case "Dinner": return "Akşam Yemeği";
    case "Evening": return "Gece";
    case "Snack": return "Atıştırmalık";
    default: return "Öğün";
  }
}

function getMealGroupOrder(mealType: MealType): number {
  switch (mealType) {
    case "Breakfast": return 1;
    case "MidMorning": return 2;
    case "Lunch": return 3;
    case "Afternoon": return 4;
    case "Dinner": return 5;
    case "Evening": return 6;
    case "Snack": return 7;
    default: return 999;
  }
}

function parseTimeToMinutes(time: string): number {
  const raw = String(time ?? "").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.MAX_SAFE_INTEGER;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return Number.MAX_SAFE_INTEGER;
  return hours * 60 + minutes;
}

function groupPlanItemsByMealType(items: MealItem[]): MealTypeGroup[] {
  const grouped = new Map<MealType, MealItem[]>();

  for (const item of items) {
    const list = grouped.get(item.mealType);
    if (list) list.push(item);
    else grouped.set(item.mealType, [item]);
  }

  const groups = Array.from(grouped.entries())
    .map(([mealType, groupItems]) => ({
      key: mealType,
      label: getMealGroupLabel(mealType),
      order: getMealGroupOrder(mealType),
      items: [...groupItems].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)),
      indexById: {} as Record<string, number>,
    }))
    .sort((a, b) => a.order - b.order);

  let runningIndex = 0;
  for (const group of groups) {
    for (const item of group.items) {
      group.indexById[item.id] = runningIndex++;
    }
  }

  return groups;
}

function getSelectedMealRecipeLabel(item: MealItem, language: "tr" | "en"): string | null {
  if (item.selectedRecipeSource === "Alternative" && item.selectedRecipeName) {
    return language === "tr"
      ? `Seçilen tarif: ${item.selectedRecipeName}`
      : `Selected recipe: ${item.selectedRecipeName}`;
  }
  return null;
}

function hasSelectedAlternativeRecipe(item: MealItem): boolean {
  return item.selectedRecipeSource === "Alternative" &&
    !!item.selectedRecipeId &&
    item.selectedRecipeId !== item.recipeId;
}

function hasAlternativeComparisonState(item: MealItem): boolean {
  return item.completionStatus === "Alternative" || hasSelectedAlternativeRecipe(item);
}

function getAlternativeRecipeForMeal(item: MealItem) {
  const selectedAlternative = hasSelectedAlternativeRecipe(item);

  return {
    recipeId: selectedAlternative
      ? item.selectedRecipeId
      : (item.alternativeRecipeId ?? item.selectedRecipeId),
    recipeName: selectedAlternative
      ? (item.selectedRecipeName ?? item.alternativeRecipeName ?? "Alternatif tarif")
      : (item.alternativeRecipeName ?? item.selectedRecipeName ?? "Alternatif tarif"),
    calories: selectedAlternative
      ? (item.selectedCalories ?? item.alternativeCalories)
      : (item.alternativeCalories ?? item.selectedCalories),
    macros: selectedAlternative
      ? (item.selectedMacros ?? item.alternativeMacros)
      : (item.alternativeMacros ?? item.selectedMacros),
  };
}

function getEffectiveRecipeForMeal(item: MealItem) {
  const isSelectedAlternative = hasSelectedAlternativeRecipe(item);

  return {
    recipeId: isSelectedAlternative ? item.selectedRecipeId : item.recipeId,
    recipeName: isSelectedAlternative
      ? (item.selectedRecipeName ?? item.recipeName ?? item.title)
      : (item.recipeName ?? item.title),
    calories: isSelectedAlternative ? item.selectedCalories : item.calories,
    macros: isSelectedAlternative ? item.selectedMacros : item.macros,
  };
}

function getRecipeForMealTarget(item: MealItem, target?: MealCompletionTarget) {
  if (target === "Original") {
    return {
      recipeId: item.recipeId,
      recipeName: item.recipeName ?? item.title,
      calories: item.calories,
      macros: item.macros,
    };
  }

  if (target === "Alternative") {
    const alternativeRecipe = getAlternativeRecipeForMeal(item);
    return {
      recipeId: alternativeRecipe.recipeId,
      recipeName: alternativeRecipe.recipeName,
      calories: alternativeRecipe.calories,
      macros: alternativeRecipe.macros,
    };
  }

  return getEffectiveRecipeForMeal(item);
}

function getDefaultCompletionTarget(item: MealItem): MealCompletionTarget {
  return hasSelectedAlternativeRecipe(item)
    ? "Alternative"
    : "Original";
}

function getCompletionRecipeName(item: MealItem, target: MealCompletionTarget): string {
  if (target === "Alternative") {
    return item.selectedRecipeName ?? item.alternativeRecipeName ?? item.title;
  }

  return item.recipeName ?? item.title;
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

function getMinutesUntilLocalTime(time?: string | null): number | null {
  if (!time) return null;
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 60_000);
}

function buildUpcomingMealBadge(item: MealItem, language: "tr" | "en") {
  if (item.completionStatus !== "Planned") return null;

  const minutesLeft = getMinutesUntilLocalTime(item.actionBlockedUntilTime ?? item.time);
  if (item.isActionableNow !== false) {
    return {
      label: language === "tr" ? "Şimdi açıldı" : "Open now",
      tone: "open" as const,
      icon: "checkmark-circle-outline" as const,
    };
  }

  if (minutesLeft !== null && minutesLeft > 0 && minutesLeft <= 90) {
    return {
      label: language === "tr" ? `${minutesLeft} dk kaldı` : `${minutesLeft} min left`,
      tone: "soon" as const,
      icon: "time-outline" as const,
    };
  }

  const time = item.actionBlockedUntilTime ?? item.time;
  return {
    label: language === "tr" ? `${time}'de açılır` : `Opens at ${time}`,
    tone: "locked" as const,
    icon: "lock-closed-outline" as const,
  };
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
  onTabSwipeEnabledChange,
}: {
  onPressKitchen?: () => void;
  isActive?: boolean;
  onTabSwipeEnabledChange?: (enabled: boolean) => void;
} = {}) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { syncSchedules } = useNotifications();
  const { notify } = useInAppNotifications();
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
  const [mealFeedback, setMealFeedback] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!onTabSwipeEnabledChange) return;
    const hasBlockingOverlay = !!selectedMeal || !!altPickerMeal || !!altCompareMeal;
    onTabSwipeEnabledChange(!hasBlockingOverlay);
    return () => {
      onTabSwipeEnabledChange(true);
    };
  }, [altCompareMeal, altPickerMeal, onTabSwipeEnabledChange, selectedMeal]);

  const isFirstLoad  = useRef(true);
  const headerStyle  = useFadeRise(0, 16);

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

  /* ── actions (preserve existing logic exactly) ── */
  const handleComplete = useCallback(async (
    item: MealItem,
    completionTarget: MealCompletionTarget = getDefaultCompletionTarget(item),
  ) => {
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
      await completeMeal(item.id, undefined, completionTarget);
      await syncSchedules();
      await load();
      notify(buildMealCompletedNotification(language, getCompletionRecipeName(item, completionTarget)));
    } catch {
      Alert.alert("Hata", "Öğün tamamlanamadı. Lütfen tekrar deneyin.");
    } finally { setActingOn(null); }
  }, [actingOn, language, load, notify, syncSchedules]);

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
    setAltPickerMeal(item);
  }, []);

  const handleResetSelectedRecipe = useCallback(async (item: MealItem) => {
    if (actingOn) return;
    setActingOn(item.id);
    try {
      await selectMealRecipe(item.id, "Original");
      await load();
    } catch {
      Alert.alert("Hata", "Tarif tercihi güncellenemedi. Lütfen tekrar deneyin.");
    } finally {
      setActingOn(null);
    }
  }, [actingOn, load]);

  const handleViewRecipe = useCallback((item: MealItem, target?: MealCompletionTarget) => {
    const effectiveRecipe = getRecipeForMealTarget(item, target);
    if (!effectiveRecipe.recipeId) return;
    // Pass calories/macros from MealItem for immediate display; RecipeDetailScreen fetches
    // full ingredient/step data via plan-context endpoint when explanation is absent.
    (navigation as any).navigate(Routes.App.RecipeDetail, {
      result: {
        recipeId: effectiveRecipe.recipeId,
        name: effectiveRecipe.recipeName,
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
        caloriesKcal: effectiveRecipe.calories,
        proteinGrams: effectiveRecipe.macros?.proteinGrams,
        carbsGrams: effectiveRecipe.macros?.carbsGrams,
        fatGrams: effectiveRecipe.macros?.fatGrams,
      },
    });
  }, [navigation]);

  const handleViewAlternativeRecipeForMeal = useCallback((item: MealItem) => {
    const alternativeRecipe = getAlternativeRecipeForMeal(item);
    if (!alternativeRecipe.recipeId) return;
    (navigation as any).navigate(Routes.App.RecipeDetail, {
      result: {
        recipeId: alternativeRecipe.recipeId,
        name: alternativeRecipe.recipeName,
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
        caloriesKcal: alternativeRecipe.calories,
        proteinGrams: alternativeRecipe.macros?.proteinGrams,
        carbsGrams: alternativeRecipe.macros?.carbsGrams,
        fatGrams: alternativeRecipe.macros?.fatGrams,
      },
    });
  }, [navigation]);

  const handleOpenMealDetail = useCallback((item: MealItem) => {
    if (hasAlternativeComparisonState(item)) {
      setAltCompareMeal(item);
    } else {
      setSelectedMeal(item);
    }
  }, []);

  const handlePickerConfirmed = useCallback((payload?: { type: "alternative" | "original"; recipeName?: string }) => {
    void load();
    void syncSchedules();
    if (payload?.type === "alternative") {
      notify(buildAlternateRecipeAppliedNotification(language, payload.recipeName ?? "Seçilen tarif"));
    }
  }, [language, load, notify, syncSchedules]);

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

  /* ── derived ── */
  const todayItems   = todayPlan?.items
    ? [...todayPlan.items].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];
  const pendingItems = todayItems.filter(i => i.completionStatus === "Planned");
  const doneItems    = todayItems.filter(i => i.completionStatus === "Done" || i.completionStatus === "Alternative");
  const skippedItems = todayItems.filter(i => i.completionStatus === "Skipped");
  const groupedPending = useMemo(() => groupPlanItemsByMealType(pendingItems), [pendingItems]);
  const doneCount    = doneItems.length;
  const totalCount   = todayItems.length;
  const nextMeal     = pendingItems[0] ?? null;
  const weeklyDigest = useMemo(() => buildWeeklyDigest({
    language,
    plans,
    todayItems,
  }), [language, plans, todayItems]);

  useEffect(() => {
    if (!todayPlan?.items?.length) {
      setMealFeedback({});
      return;
    }

    const seeded = todayPlan.items.reduce<Record<string, string>>((acc, item) => {
      if (item.feedbackKey) acc[item.id] = item.feedbackKey;
      return acc;
    }, {});
    setMealFeedback(seeded);
  }, [todayPlan]);

  const handleQuickFeedback = useCallback(async (
    item: MealItem,
    feedbackKey: string,
    _label: string,
    recipeSource: MealCompletionTarget = "Original",
  ) => {
    const previous = mealFeedback[item.id];
    setMealFeedback((current) => ({ ...current, [item.id]: feedbackKey }));
    try {
      await saveMealFeedback(item.id, feedbackKey, recipeSource);
      const feedbackRecipe = getRecipeForMealTarget(item, recipeSource);
      notify(buildMealFeedbackNotificationForSource(
        language,
        feedbackRecipe.recipeName ?? item.title,
        feedbackKey as "filling" | "light" | "repeat" | "hard",
        recipeSource,
      ));
    } catch {
      setMealFeedback((current) => {
        const next = { ...current };
        if (previous) next[item.id] = previous;
        else delete next[item.id];
        return next;
      });
      Alert.alert(
        language === "tr" ? "Kayıt başarısız" : "Save failed",
        language === "tr"
          ? "Öğün değerlendirmesi şu anda kaydedilemedi. Lütfen tekrar dene."
          : "The meal feedback could not be saved right now. Please try again.",
      );
    }
  }, [language, mealFeedback, notify]);

  /* ── loading state ── */
  if (loading) {
    return (
      <View style={[s.root, s.centered, { backgroundColor: theme.bg, padding: spacing.lg }]}>
        <DytopiaWatermark position="center" size={300} opacity={0.036} />
        <DytopiaLoadingState
          title={language === "tr" ? "Plan akışın hazırlanıyor" : "Preparing your plan flow"}
          subtitle={language === "tr" ? "Dytopia bugünkü öğünlerini ve ritmini senkronize ediyor." : "Dytopia is syncing your meals and daily rhythm."}
        />
      </View>
    );
  }

  /* ── render ── */
  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <DytopiaWatermark position="center" size={300} opacity={0.036} />
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
        <TouchableOpacity
          style={[s.shoppingLink, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => (navigation as any).navigate(Routes.App.Pantry)}
          activeOpacity={0.82}
        >
          <View style={[s.shoppingLinkIcon, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Ionicons name="basket-outline" size={16} color={theme.emerald} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.shoppingLinkTitle, { color: theme.text }]}>
              {language === "tr" ? "Dolabım" : "Pantry"}
            </Text>
            <Text style={[s.shoppingLinkSub, { color: theme.textMuted }]}>
              {language === "tr"
                ? "Evde olan malzemelerini güncelle, mutfak ekranı hazır başlasın"
                : "Refresh what is at home so kitchen flows start ready"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSub} />
        </TouchableOpacity>
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
                title="Bugün için plan tanımlanmamış"
                description="Diyetisyeniniz size özel bir plan hazırladığında burada görünecek."
              />
            ) : (
              <>
                {/* Daily macro summary */}
              <MacroSummaryBar items={todayItems} theme={theme} language={language} />

                <WeeklyDigestCard
                  theme={theme}
                  digest={weeklyDigest}
                />

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
                    {groupedPending.map((group) => (
                      <View key={`pending-group-${group.key}`}>
                        <GroupHeader
                          label={group.label}
                          count={group.items.length}
                          theme={theme}
                        />
                        {group.items.map((item) => (
                          <PendingCard
                              key={item.id}
                              item={item}
                              index={group.indexById[item.id] ?? 0}
                              language={language}
                              theme={theme}
                              isActing={actingOn === item.id}
                              onOpenDetail={() => handleOpenMealDetail(item)}
                              onComplete={(target) => void handleComplete(item, target)}
                              onSkip={() => void handleSkip(item)}
                              onAlternative={() => void handleAlternative(item)}
                              onResetSelection={() => void handleResetSelectedRecipe(item)}
                              onViewRecipe={(target) => handleViewRecipe(item, target)}
                          />
                        ))}
                      </View>
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
                        language={language}
                        theme={theme}
                        isActing={actingOn === item.id}
                        currentFeedback={mealFeedback[item.id]}
                        onSelectFeedback={handleQuickFeedback}
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
        onResetSelection={() => {
          if (!selectedMeal) return;
          const item = selectedMeal;
          setSelectedMeal(null);
          void handleResetSelectedRecipe(item);
        }}
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
        onViewAlternativeRecipe={altCompareMeal && getAlternativeRecipeForMeal(altCompareMeal).recipeId ? handleViewAlternativeRecipe : undefined}
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
   MEAL GROUP HEADER (mealType grouping inside Pending)
═══════════════════════════════════════════════════════ */
function GroupHeader({
  label,
  count,
  theme,
}: {
  label: string;
  count: number;
  theme: import("../theme/tokens").Theme;
}) {
  return (
    <View style={s.mealGroupHeaderRow}>
      <Text style={[s.mealGroupHeaderLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[s.mealGroupHeaderCount, { color: theme.textMuted }]}>{`• ${count} öğün`}</Text>
    </View>
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

function WeeklyDigestCard({
  theme,
  digest,
}: {
  theme: import("../theme/tokens").Theme;
  digest: ReturnType<typeof buildWeeklyDigest>;
}) {
  const accent =
    digest.tone === "emerald" ? theme.emerald :
    digest.tone === "coral" ? theme.accentCoral :
    theme.primary;

  return (
    <View style={[s.digestCard, { backgroundColor: theme.surface, borderColor: `${accent}30` }]}>
      <View style={s.digestHead}>
        <View style={[s.digestIcon, { backgroundColor: `${accent}14`, borderColor: `${accent}26` }]}>
          <Ionicons name="pulse-outline" size={16} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.digestTitle, { color: theme.text }]}>{digest.title}</Text>
          <Text style={[s.digestBody, { color: theme.textSub }]}>{digest.body}</Text>
        </View>
      </View>
      <View style={s.digestStats}>
        <View style={[s.digestPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[s.digestPillValue, { color: accent }]}>{digest.highlight}</Text>
        </View>
        <View style={[s.digestPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[s.digestPillValue, { color: theme.text }]}>{digest.secondary}</Text>
        </View>
      </View>
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
  onResetSelection,
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
  onResetSelection: () => void;
  onViewRecipe: () => void;
}) {
  if (!item) return null;

  const meta = MEAL_TYPE_META[item.mealType] ?? MEAL_TYPE_META.Snack;
  const hasMacros = item.calories || item.macros?.proteinGrams || item.macros?.carbsGrams || item.macros?.fatGrams;
  const isCompleted = item.completionStatus === "Done" || item.completionStatus === "Alternative";
  const lockMessage = buildMealLockMessage(item, language);
  const isLocked = !!lockMessage;
  const isAlternativeCompletion = hasAlternativeComparisonState(item);
  const statusTone =
    item.completionStatus === "Skipped"
      ? { label: "Atlandı", color: theme.textMuted, bg: theme.borderLight, border: theme.border }
      : isCompleted
        ? { label: isAlternativeCompletion ? "Alternatif" : "Tamamlandı", color: theme.emerald, bg: theme.glassEmerald, border: theme.borderEmerald }
        : { label: "Bekliyor", color: theme.primary, bg: theme.primaryLight, border: theme.borderEmerald };
  const selectedRecipeLabel = getSelectedMealRecipeLabel(item, language);

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

          {!!selectedRecipeLabel && (
            <View style={[s.detailNoteBox, { backgroundColor: theme.surfaceElevated, borderLeftColor: theme.primary }]}>
              <Text style={[s.detailNoteLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "Aktif tarif tercihi" : "Active recipe choice"}
              </Text>
              <Text style={[s.detailNoteText, { color: theme.textSub }]}>{selectedRecipeLabel}</Text>
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
              disabled={isActing}
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
                      disabled={isActing}
                    >
                      <Ionicons name="swap-horizontal-outline" size={14} color={theme.textMuted} />
                      <Text style={[s.detailGhostBtnText, { color: theme.textMuted }]}>
                        {language === "tr" ? "Alternatif Seç" : "Choose alternative"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {item.selectedRecipeSource === "Alternative" && (
                    <TouchableOpacity
                      style={[s.detailGhostBtn, { borderColor: theme.border }]}
                      onPress={onResetSelection}
                      activeOpacity={0.75}
                      disabled={isActing}
                    >
                      <Ionicons name="refresh-outline" size={14} color={theme.textMuted} />
                      <Text style={[s.detailGhostBtnText, { color: theme.textMuted }]}>
                        {language === "tr" ? "Orijinale Dön" : "Back to original"}
                      </Text>
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
  item, index, language, theme, isActing, onOpenDetail, onComplete, onSkip, onAlternative, onResetSelection, onViewRecipe,
}: {
  item: MealItem;
  index: number;
  language: "tr" | "en";
  theme: import("../theme/tokens").Theme;
  isActing: boolean;
  onOpenDetail: () => void;
  onComplete: (target: MealCompletionTarget) => void;
  onSkip: () => void;
  onAlternative: () => void;
  onResetSelection: () => void;
  onViewRecipe: (target: MealCompletionTarget) => void;
}) {
  const style = useStaggerItem(index, 120, 60);
  const meta  = MEAL_TYPE_META[item.mealType] ?? MEAL_TYPE_META.Snack;
  const lockMessage = buildMealLockMessage(item, language);
  const isLocked = !!lockMessage;
  const upcomingBadge = buildUpcomingMealBadge(item, language);
  const upcomingBadgeColor = upcomingBadge?.tone === "open"
    ? theme.emerald
    : upcomingBadge?.tone === "soon"
      ? theme.accentGold
      : theme.textMuted;
  const selectedRecipeLabel = getSelectedMealRecipeLabel(item, language);
  const hasAlternativeSelection = item.selectedRecipeSource === "Alternative" && !!item.selectedRecipeName;
  const [showSelectedSide, setShowSelectedSide] = useState(false);
  const lastTapRef = useRef(0);
  const isFlippingRef = useRef(false);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipScaleX = useRef(new RNAnimated.Value(1)).current;
  const displayAlternativeSide = hasAlternativeSelection && showSelectedSide;
  const displayTitle = displayAlternativeSide ? (item.selectedRecipeName ?? item.title) : item.title;
  const displayTime = item.time;
  const displayCalories = displayAlternativeSide ? item.selectedCalories : item.calories;
  const displayMacros = displayAlternativeSide ? item.selectedMacros : item.macros;
  const hasDisplayMacros =
    displayCalories ||
    displayMacros?.proteinGrams ||
    displayMacros?.carbsGrams ||
    displayMacros?.fatGrams;

  const triggerFlip = useCallback((nextSide?: boolean) => {
    if (!hasAlternativeSelection || isFlippingRef.current) return;
    isFlippingRef.current = true;
    RNAnimated.timing(flipScaleX, { toValue: 0, duration: 170, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) {
        isFlippingRef.current = false;
        return;
      }
      setShowSelectedSide(prev => (typeof nextSide === "boolean" ? nextSide : !prev));
      RNAnimated.timing(flipScaleX, { toValue: 1, duration: 190, useNativeDriver: true }).start(() => {
        isFlippingRef.current = false;
      });
    });
  }, [flipScaleX, hasAlternativeSelection]);

  const handleCardPress = useCallback(() => {
    if (!hasAlternativeSelection) {
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
    if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
    singleTapTimeoutRef.current = setTimeout(() => {
      lastTapRef.current = 0;
      singleTapTimeoutRef.current = null;
      onOpenDetail();
    }, 285);
  }, [hasAlternativeSelection, onOpenDetail, triggerFlip]);

  useEffect(() => {
    setShowSelectedSide(false);
    lastTapRef.current = 0;
  }, [item.id, item.selectedRecipeId]);

  useEffect(() => () => {
    if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
  }, []);

  return (
    <Animated.View style={[style, s.timelineRow]}>
      <View style={s.timelineRail}>
        <View style={[s.timelineLine, { backgroundColor: index === 0 ? `${theme.primary}55` : theme.border }]} />
        <View style={[s.timelineDot, { backgroundColor: theme.surface, borderColor: index === 0 ? theme.primary : theme.border }]}>
          <View style={[s.timelineDotCore, { backgroundColor: index === 0 ? theme.primary : theme.textMuted }]} />
        </View>
      </View>
      <RNAnimated.View style={[
        s.pendingCard,
        {
          flex: 1,
          backgroundColor: theme.surface,
          borderColor: displayAlternativeSide ? `${theme.accentGold}38` : theme.border,
          transform: [{ scaleX: flipScaleX }],
        },
      ]}>
        <View style={[s.cardStrip, { backgroundColor: theme.primary + "70" }]} />

        <View style={s.pendingBody}>
          <TouchableOpacity activeOpacity={0.86} onPress={handleCardPress}>
          {/* Time + emoji + title */}
          <View style={s.cardTopRow}>
            <Text style={[s.cardTime, { color: displayAlternativeSide ? theme.accentGold : theme.primary }]}>{displayTime}</Text>
            <View style={[s.mealIconWrap, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
              <Ionicons name={meta.icon} size={16} color={theme.primaryDark} />
            </View>
            <View style={s.cardTitleBlock}>
              <Text style={[s.cardTypeLabel, { color: theme.textMuted }]}>
                {displayAlternativeSide ? (language === "tr" ? "Aktif alternatif" : "Active alternative") : meta.label}
              </Text>
              <Text style={[s.cardTitle, { color: theme.text }]} numberOfLines={2}>
                {displayTitle}
              </Text>
            </View>
            {upcomingBadge ? (
              <View
                style={[
                  s.upcomingPill,
                  { backgroundColor: `${upcomingBadgeColor}12`, borderColor: `${upcomingBadgeColor}30` },
                ]}
              >
                <Ionicons name={upcomingBadge.icon} size={12} color={upcomingBadgeColor} />
                <Text style={[s.upcomingPillTxt, { color: upcomingBadgeColor }]}>
                  {upcomingBadge.label}
                </Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            )}
          </View>

          {/* Macro chips — semantic nutrition colors */}
          {!!hasDisplayMacros && (
            <View style={s.macroRow}>
              {!!displayCalories && (
                <MacroChip value={`${displayCalories} kcal`} color={theme.macroCalorie} />
              )}
              {!!displayMacros?.proteinGrams && (
                <MacroChip value={`P ${displayMacros.proteinGrams}g`} color={theme.macroProtein} />
              )}
              {!!displayMacros?.carbsGrams && (
                <MacroChip value={`K ${displayMacros.carbsGrams}g`} color={theme.macroCarb} />
              )}
              {!!displayMacros?.fatGrams && (
                <MacroChip value={`Y ${displayMacros.fatGrams}g`} color={theme.macroFat} />
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
          {!!selectedRecipeLabel && (
            <View style={[s.selectedRecipeBox, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}28` }]}>
              <View style={s.selectedRecipeTextWrap}>
                <View style={[s.selectedRecipeIconWrap, { backgroundColor: `${theme.primary}16`, borderColor: `${theme.primary}26` }]}>
                  <Ionicons name="sparkles-outline" size={13} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.selectedRecipeLabel, { color: theme.primary }]}>{selectedRecipeLabel}</Text>
                  <Text style={[s.selectedRecipeHint, { color: theme.textMuted }]}>
                    {language === "tr"
                      ? "Çift dokunarak planlanan tarif ile seçilen alternatifi karşılaştır."
                      : "Double tap to compare planned and selected recipes."}
                  </Text>
                </View>
              </View>
              {hasAlternativeSelection && (
                <TouchableOpacity
                  style={[s.selectedRecipeResetBtn, { backgroundColor: theme.surface, borderColor: `${theme.primary}24` }]}
                  onPress={onResetSelection}
                  disabled={isActing}
                  activeOpacity={0.76}
                  accessibilityRole="button"
                  accessibilityLabel={language === "tr" ? "Orijinale dön" : "Use original"}
                >
                  <Ionicons name="refresh-outline" size={21} color={theme.primary} />
                </TouchableOpacity>
              )}
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
            <TouchableOpacity
              style={[s.doneBtn, { backgroundColor: theme.primary, shadowColor: theme.primaryGlow }]}
              onPress={() => onComplete(displayAlternativeSide ? "Alternative" : "Original")}
              disabled={isActing || isLocked}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={isLocked
                ? (language === "tr" ? "Saati bekliyor" : "Waiting for time")
                : (language === "tr" ? "Yaptım" : "Complete")}
            >
              {isActing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name={isLocked ? "lock-closed-outline" : "checkmark-circle-outline"} size={23} color="#fff" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.ghostBtn, { borderColor: `${theme.accentCoral}22`, backgroundColor: `${theme.accentCoral}0D` }]}
              onPress={onSkip}
              disabled={isActing || isLocked}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={language === "tr" ? "Atla" : "Skip"}
            >
              <Ionicons name="close-circle-outline" size={23} color={theme.accentCoral} />
            </TouchableOpacity>

            {!!item.recipeId && (
              <TouchableOpacity
                style={[s.ghostBtn, { borderColor: `${theme.accentCyan}30`, backgroundColor: `${theme.accentCyan}12` }]}
                onPress={onAlternative}
                disabled={isActing}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={language === "tr" ? "Alternatif seç" : "Choose alternative"}
              >
                <Ionicons name="shuffle-outline" size={23} color={theme.accentCyan} />
              </TouchableOpacity>
            )}

            {!!item.recipeId && (
              <TouchableOpacity
                style={[s.ghostBtn, { borderColor: theme.borderEmerald, backgroundColor: `${theme.primary}08` }]}
                onPress={() => onViewRecipe(displayAlternativeSide ? "Alternative" : "Original")}
                disabled={isActing}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={language === "tr" ? "Tarifi gör" : "View recipe"}
              >
                <Ionicons name="book-outline" size={23} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </RNAnimated.View>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════
   DONE CARD — polished success card with alt flip
═══════════════════════════════════════════════════════ */
function DoneCard({
  item, index, language, theme, isActing, currentFeedback, onSelectFeedback, onOpenDetail, onViewRecipe, onViewAlternativeRecipe, onUndo, flipResetKey,
}: {
  item: MealItem;
  index: number;
  language: "tr" | "en";
  theme: import("../theme/tokens").Theme;
  isActing: boolean;
  currentFeedback?: string;
  onSelectFeedback: (item: MealItem, feedbackKey: string, label: string, recipeSource: MealCompletionTarget) => void;
  onOpenDetail: () => void;
  onViewRecipe: () => void;
  onViewAlternativeRecipe: () => void;
  onUndo: () => void;
  flipResetKey: number;
}) {
  const style  = useStaggerItem(index, 180, 50);
  const meta   = MEAL_TYPE_META[item.mealType] ?? MEAL_TYPE_META.Snack;
  const isAlt  = hasAlternativeComparisonState(item);
  const alternativeRecipe = getAlternativeRecipeForMeal(item);
  const hasMacros    = item.calories || item.macros?.proteinGrams || item.macros?.carbsGrams || item.macros?.fatGrams;
  const hasAltMacros = alternativeRecipe.calories || alternativeRecipe.macros?.proteinGrams || alternativeRecipe.macros?.carbsGrams || alternativeRecipe.macros?.fatGrams;
  const accentColor = isAlt ? theme.accentGold : theme.emerald;
  const statusBorder = `${accentColor}2C`;
  const statusSurface = `${accentColor}12`;
  const feedbackOptions = language === "tr"
    ? [
        { key: "filling", label: "Tok tuttu", icon: "flash-outline" as const },
        { key: "light", label: "Hafif geldi", icon: "leaf-outline" as const },
        { key: "again", label: "Tekrar isterim", icon: "heart-outline" as const },
        { key: "hard", label: "Zor hazırlandı", icon: "time-outline" as const },
      ]
    : [
        { key: "filling", label: "Filling", icon: "flash-outline" as const },
        { key: "light", label: "Too light", icon: "leaf-outline" as const },
        { key: "again", label: "Repeat this", icon: "heart-outline" as const },
        { key: "hard", label: "Hard to prep", icon: "time-outline" as const },
      ];
  const lastTapRef = useRef(0);
  const isFlippingRef = useRef(false);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackExpandedValue = useRef(new RNAnimated.Value(0)).current;

  const [showBack, setShowBack]   = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const flipScaleX                = useRef(new RNAnimated.Value(1)).current;
  const prevResetKey              = useRef(flipResetKey);
  const contextualTitle = showBack && isAlt
    ? alternativeRecipe.recipeName
    : (item.recipeName ?? item.title);
  const contextualRecipeHandler = showBack && isAlt ? onViewAlternativeRecipe : onViewRecipe;
  const contextualRecipeAvailable = showBack && isAlt ? !!alternativeRecipe.recipeId : !!item.recipeId;
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

  useEffect(() => {
    RNAnimated.timing(feedbackExpandedValue, {
      toValue: feedbackExpanded ? 1 : 0,
      duration: feedbackExpanded ? 220 : 170,
      useNativeDriver: false,
    }).start();
  }, [feedbackExpanded, feedbackExpandedValue]);

  const feedbackBodyHeight = feedbackExpandedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 150],
  });

  const feedbackBodyOpacity = feedbackExpandedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const selectedFeedbackLabel = feedbackOptions.find((option) => option.key === currentFeedback)?.label;
  const canEvaluateCurrentFace = true;
  const evaluationTargetLabel = isAlt
    ? (alternativeRecipe.recipeName ?? item.title)
    : (item.recipeName ?? item.title);

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
                {!!(showBack && isAlt ? alternativeRecipe.calories : item.calories) && (
                  <MacroChip
                    value={`${showBack && isAlt ? alternativeRecipe.calories : item.calories} kcal`}
                    color={theme.macroCalorie}
                  />
                )}
                {!!(showBack && isAlt ? alternativeRecipe.macros?.proteinGrams : item.macros?.proteinGrams) && (
                  <MacroChip
                    value={`P ${showBack && isAlt ? alternativeRecipe.macros?.proteinGrams : item.macros?.proteinGrams}g`}
                    color={theme.macroProtein}
                  />
                )}
                {!!(showBack && isAlt ? alternativeRecipe.macros?.carbsGrams : item.macros?.carbsGrams) && (
                  <MacroChip
                    value={`K ${showBack && isAlt ? alternativeRecipe.macros?.carbsGrams : item.macros?.carbsGrams}g`}
                    color={theme.macroCarb}
                  />
                )}
                {!!(showBack && isAlt ? alternativeRecipe.macros?.fatGrams : item.macros?.fatGrams) && (
                  <MacroChip
                    value={`Y ${showBack && isAlt ? alternativeRecipe.macros?.fatGrams : item.macros?.fatGrams}g`}
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
              accessibilityRole="button"
              accessibilityLabel={language === "tr" ? "Tarifi gör" : "View recipe"}
            >
              <Ionicons
                name="book-outline"
                size={22}
                color={contextualRecipeAvailable ? accentColor : theme.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.doneFeedbackBtn,
                {
                  borderColor: canEvaluateCurrentFace
                    ? (currentFeedback ? `${theme.primary}34` : theme.border)
                    : theme.border,
                  backgroundColor: canEvaluateCurrentFace
                    ? (currentFeedback ? `${theme.primary}12` : theme.surfaceElevated)
                    : `${theme.textMuted}10`,
                },
              ]}
              onPress={() => canEvaluateCurrentFace && setFeedbackExpanded((value) => !value)}
              disabled={!canEvaluateCurrentFace}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={currentFeedback
                ? (language === "tr" ? "Notu güncelle" : "Update note")
                : (language === "tr" ? "Değerlendir" : "Review")}
            >
              <Ionicons
                name={canEvaluateCurrentFace
                  ? (currentFeedback ? "chatbubble-ellipses-outline" : "sparkles-outline")
                  : "lock-closed-outline"}
                size={22}
                color={canEvaluateCurrentFace
                  ? (currentFeedback ? theme.primary : theme.textMuted)
                  : theme.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.doneUndoBtn, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
              onPress={onUndo}
              disabled={isActing}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={language === "tr" ? "Geri al" : "Undo"}
            >
              {isActing ? (
                <ActivityIndicator size="small" color={theme.textMuted} />
              ) : (
                <Ionicons name="arrow-undo-outline" size={22} color={theme.textSub} />
              )}
            </TouchableOpacity>
          </View>

          <RNAnimated.View
            style={[
              s.doneFeedbackPanelWrap,
              {
                height: feedbackBodyHeight,
                opacity: feedbackBodyOpacity,
              },
            ]}
          >
            <View style={[s.doneFeedbackPanel, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={s.doneFeedbackPanelHeader}>
                <View>
                  <Text style={[s.doneFeedbackPanelTitle, { color: theme.text }]}>
                    {language === "tr" ? "Öğünü değerlendir" : "Rate this meal"}
                  </Text>
                  <Text style={[s.doneFeedbackPanelSub, { color: theme.textMuted }]}>
                    {language === "tr"
                      ? (selectedFeedbackLabel
                        ? `Seçili not: ${selectedFeedbackLabel}`
                        : isAlt
                        ? `${evaluationTargetLabel} için deneyimini işaretle.`
                        : "Tek dokunuşla deneyimini işaretle.")
                      : (selectedFeedbackLabel
                        ? `Selected note: ${selectedFeedbackLabel}`
                        : isAlt
                        ? `Rate your experience for ${evaluationTargetLabel}.`
                        : "Mark your experience in one tap.")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setFeedbackExpanded(false)}
                  style={[s.doneFeedbackClose, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  activeOpacity={0.78}
                >
                  <Ionicons name="close" size={14} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={s.doneFeedbackOptions}>
                {feedbackOptions.map((option) => {
                  const active = currentFeedback === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      activeOpacity={0.82}
                      onPress={() => onSelectFeedback(
                        item,
                        option.key,
                        option.label,
                        showBack && isAlt ? "Alternative" : "Original",
                      )}
                      style={[
                        s.doneFeedbackChip,
                        {
                          backgroundColor: active ? `${theme.primary}12` : theme.surface,
                          borderColor: active ? `${theme.primary}32` : theme.border,
                        },
                      ]}
                    >
                      <Ionicons name={option.icon} size={14} color={active ? theme.primary : theme.textMuted} />
                      <Text style={[s.doneFeedbackChipTxt, { color: active ? theme.primary : theme.text }]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </RNAnimated.View>
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
  scroll:  { paddingHorizontal: spacing.lg, paddingTop: spacing.xl + 12 },
  bottomPad: { height: 176 },
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    overflow: "hidden",
    shadowColor: "#0F3D2E",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
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
    marginBottom: spacing.sm,
  },
  plansHeroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  plansHeroChipText: { fontSize: 12, fontWeight: "800" },
  plansHeroMini: {
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  plansHeroMiniText: { fontSize: 11, fontWeight: "800" },
  plansHeroTitle: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 30,
    marginBottom: 6,
    maxWidth: 270,
  },
  plansHeroSubtitle: {
    fontSize: 12.5,
    lineHeight: 19,
    maxWidth: 310,
  },

  header:    { marginBottom: spacing.md },
  pageTitle: { fontSize: 34, fontWeight: "900", letterSpacing: -0.5, marginBottom: 2 },
  todayLine: { fontSize: 13, fontWeight: "700" },

  shoppingLink: {
    borderWidth: 1,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.sm,
    shadowColor: "#0F3D2E",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  shoppingLinkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  shoppingLinkSub: { fontSize: 12, lineHeight: 16.5 },
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
  digestCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    marginBottom: spacing.md,
    shadowColor: "#0F3D2E",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  digestHead: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  digestIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  digestTitle: { fontSize: 13.5, fontWeight: "800", marginBottom: 3 },
  digestBody: { fontSize: 11.5, lineHeight: 17 },
  digestStats: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  digestPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  digestPillValue: { fontSize: 11.5, fontWeight: "800", lineHeight: 16 },
  exploreLink:    { marginTop: spacing.md, paddingVertical: spacing.sm },
  exploreLinkTxt: { fontSize: 13, fontWeight: "800" },

  allPlansLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase",
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },

  /* ── Progress Card ── */
  progressCard: {
    borderRadius: 26, borderWidth: 1, padding: 18, marginBottom: spacing.md,
    overflow: "hidden",
    shadowColor: "#0F3D2E", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5,
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
    borderRadius: 18, borderWidth: 1,
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
    borderRadius: 18, borderWidth: 1,
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
  mealGroupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.sm,
    marginBottom: 6,
    paddingLeft: 6,
  },
  mealGroupHeaderLabel: { fontSize: 12, fontWeight: "800" },
  mealGroupHeaderCount: { fontSize: 12, fontWeight: "600" },

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
  upcomingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 116,
  },
  upcomingPillTxt: { fontSize: 10, fontWeight: "900" },
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
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    shadowColor: "#0F3D2E",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
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
  selectedRecipeBox: {
    marginTop: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  selectedRecipeTextWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  selectedRecipeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedRecipeLabel: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  selectedRecipeHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  selectedRecipeResetBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    width: 44,
    height: 38,
    justifyContent: "center",
  },
  selectedRecipeResetTxt: {
    fontSize: 11,
    fontWeight: "800",
  },

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
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 9,
  },
  timelineRail: {
    width: 18,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  timelineLine: {
    position: "absolute",
    top: 13,
    bottom: -spacing.sm,
    width: 2,
    borderRadius: 999,
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  timelineDotCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pendingCard: {
    borderRadius: 26, borderWidth: 1, marginBottom: spacing.sm,
    flexDirection: "row", overflow: "hidden",
    shadowColor: "#0F3D2E", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4,
  },
  pendingBody: { flex: 1, padding: spacing.md, paddingLeft: spacing.sm, gap: 2 },
  pendingActions: { marginTop: 12, flexDirection: "row", gap: 9, alignItems: "center" },
  doneBtn: {
    flex: 1,
    height: 56,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 23,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 4,
  },
  doneBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "900" },
  secondaryBtnRow: { flexDirection: "row", gap: 8 },
  ghostBtn: {
    flex: 1,
    height: 56,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 23, borderWidth: 1,
  },
  ghostBtnTxt: { fontSize: 11, fontWeight: "700" },

  /* ── Done card ── */
  doneCard: {
    borderRadius: 26, borderWidth: 1, marginBottom: spacing.sm,
    overflow: "hidden",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 4,
  },
  doneAccentBar: { height: 3, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  doneBody: { padding: spacing.md, gap: 11 },
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
  doneActionRow: { flexDirection: "row", gap: 10, alignItems: "center", width: "100%" },
  doneDetailBtn: {
    flex: 1, height: 56,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 23, borderWidth: 1,
  },
  doneDetailBtnTxt: { fontSize: 13, fontWeight: "800" },
  doneFeedbackBtn: {
    flex: 1, height: 56,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 23, borderWidth: 1,
  },
  doneFeedbackBtnTxt: { fontSize: 12.5, fontWeight: "800" },
  doneUndoBtn: {
    flex: 1, height: 56,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 23, borderWidth: 1,
  },
  doneUndoBtnTxt: { fontSize: 13, fontWeight: "700" },
  doneFeedbackPanelWrap: {
    overflow: "hidden",
  },
  doneFeedbackPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: 10,
  },
  doneFeedbackPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  doneFeedbackPanelTitle: { fontSize: 12.5, fontWeight: "800", marginBottom: 2 },
  doneFeedbackPanelSub: { fontSize: 11.5, lineHeight: 16 },
  doneFeedbackClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  doneFeedbackOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  doneFeedbackChip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  doneFeedbackChipTxt: { fontSize: 11.5, fontWeight: "700" },

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
    borderRadius: 26, borderWidth: 1, marginBottom: spacing.sm,
    flexDirection: "row", overflow: "hidden",
    shadowColor: "#0F3D2E", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
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


