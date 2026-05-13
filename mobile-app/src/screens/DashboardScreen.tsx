/**
 * AURA CLINICAL OS ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â‚¬Å¡Ã‚¬Ãƒ¢Ã¢â€š¬Ã‚ Daily Ritual Hub
 * Redesigned: actionable cards, real data, clear hierarchy
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  ActivityIndicator, RefreshControl, StatusBar, Alert,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withSequence, withRepeat, withDelay,
  cancelAnimation, runOnUI,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../auth/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Routes } from '../navigation/routes';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { spacing, radii } from '../theme/tokens';
import { useDashboard } from '../queries/useDashboard';
import { useGamification } from '../queries/useGamification';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFadeRise, useStaggerItem, useHeroEntrance, useHaloBreathe, useShimmerBand, useFloating } from '../hooks/useAuraMotion';
import api from '../api/client';
import { getTodayTracking, updateTodayTracking, type TodayTracking } from '../api/progress';
import { getPantry } from '../api/pantry';
import { getShoppingList, type ShoppingListSummary } from '../api/shopping-list';
import { getActiveAnnouncement, type ActiveAnnouncement } from '../api/announcements';
import { getFavoriteRecipesSummary, type FavoriteRecipesSummaryDto } from '../api/favorites';
import { getDailyGames, type DailyGamePack } from '../api/games';
import { getMealLogs, type MealLog } from '../api/meal-logs';
import ProduceBubble from '../components/decor/ProduceBubble';
import DytopiaWatermark from '../components/decor/DytopiaWatermark';
import DytopiaLogoBubble from '../components/decor/DytopiaLogoBubble';
import BadgeDetailSheet from '../components/gamification/BadgeDetailSheet';
import { refreshWidgetsFromApp } from '../widgets/services/widgetSyncService';
import * as Haptics from 'expo-haptics';
import {
  type BadgeCollectionItem,
  type DashboardMotivation,
  buildBadgeCollection,
  buildMotivationSummary,
  getHighlightAchievements,
  getMotivationSpotlight,
  getToneColor,
  mapGamificationToMotivation,
} from '../motivation/streaks';
import { getPlansData, type ClientPlan } from '../data/plansRepo';
import type { DashboardDTO } from '../data/dashboardRepo';
import { useQuery } from '@tanstack/react-query';
import {
  buildRescueMission,
  buildTodayPanelItems,
  type RescueMission,
  type TodayPanelItem,
} from '../features/smartInsights';
import { runCoachTaskAction } from '../features/coachTasks';
import { getResponsiveGridItemWidth } from '../utils/responsiveLayout';

interface Measurement {
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  atUtc: string;
}

type GreetingKeys = { night: string; morning: string; noon: string; afternoon: string; evening: string };
function getGreeting(g: GreetingKeys): string {
  const h = new Date().getHours();
  if (h < 6)  return g.night;
  if (h < 12) return g.morning;
  if (h < 14) return g.noon;
  if (h < 18) return g.afternoon;
  return g.evening;
}

type ComplianceKeys = { compliancePerfect: string; complianceGreat: string; complianceGood: string; complianceFair: string; compliancePoor: string };
function getComplianceLabel(pct: number, d: ComplianceKeys): string {
  if (pct >= 90) return d.compliancePerfect;
  if (pct >= 70) return d.complianceGreat;
  if (pct >= 45) return d.complianceGood;
  if (pct >= 20) return d.complianceFair;
  return d.compliancePoor;
}

function summarizeMealLogs(logs: MealLog[]) {
  return logs.reduce(
    (acc, log) => ({
      count: acc.count + 1,
      calories: acc.calories + (log.caloriesKcal ?? 0),
      protein: acc.protein + (log.proteinGrams ?? 0),
      carbs: acc.carbs + (log.carbsGrams ?? 0),
      fat: acc.fat + (log.fatGrams ?? 0),
    }),
    { count: 0, calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

const noop = () => {};
const WATER_GOAL = 10;
const WATER_GLASS_ML = 200;
const WATER_MAX_GLASSES = 50;
const EMPTY_SHOPPING_SUMMARY: ShoppingListSummary = { total: 0, checkedCount: 0, activeCount: 0 };
const ACTION_RAIL_GAP = 8;
const ACTION_RAIL_COLUMNS = 3;
const TODAY_PULSE_GAP = 9;

type ContinueCardModel = {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  onPress: () => void;
};

type DashboardCoachTask = NonNullable<DashboardDTO['coachTask']>;

type DashboardNextMealState = 'upcoming' | 'all-complete' | 'no-plan' | 'none';

function getDashboardNextMealState(nextMeal?: {
  kind?: string;
  mealItemId?: string | null;
  title?: string | null;
} | null): DashboardNextMealState {
  if (!nextMeal) return 'none';
  if (nextMeal.kind === 'all-complete') return 'all-complete';
  if (nextMeal.kind === 'no-plan') return 'no-plan';
  if (nextMeal.kind === 'upcoming') return 'upcoming';
  if (nextMeal.mealItemId) return 'upcoming';

  const title = (nextMeal.title ?? '').toLocaleLowerCase('tr-TR');
  if (title.includes('tamamlandı')) return 'all-complete';
  if (title.includes('plan') && (title.includes('yok') || title.includes('görünmüyor'))) return 'no-plan';
  return 'none';
}

function DayHeaderBand({
  theme,
  language,
  title,
  subtitle,
}: {
  theme: import('../theme/tokens').Theme;
  language: "tr" | "en";
  title: string;
  subtitle: string;
}) {
  return (
    <View style={[s.dayBand, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
      <DytopiaLogoBubble size={110} opacity={0.22} logoOpacity={0.36} style={s.dayBandBlobA} />
      <DytopiaLogoBubble size={86} opacity={0.18} logoOpacity={0.34} style={s.dayBandBlobB} />
      <View style={s.dayBandTop}>
        <View style={[s.dayBandChip, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <Ionicons name="leaf-outline" size={14} color={theme.primaryDark} />
          <Text style={[s.dayBandChipText, { color: theme.primaryDark }]}>
            {language === "tr" ? "Günlük Ritim" : "Daily Ritual"}
          </Text>
        </View>
        <View style={[s.dayBandMini, { backgroundColor: theme.surfaceElevated }]}>
          <Text style={[s.dayBandMiniText, { color: theme.emerald }]}>
            {language === "tr" ? "Taze mod" : "Fresh mode"}
          </Text>
        </View>
      </View>
      <Text style={[s.dayBandTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[s.dayBandSubtitle, { color: theme.textSub }]}>{subtitle}</Text>
    </View>
  );
}

function AmbientProduceBubbles() {
  const bubbles = [
    {
      key: 'apple-top',
      size: 134,
      top: 96,
      right: 12,
      opacity: 0.2,
      logoOpacity: 0.34,
    },
    {
      key: 'carrot-mid',
      size: 118,
      top: 352,
      left: -12,
      opacity: 0.17,
      logoOpacity: 0.32,
    },
    {
      key: 'pear-lower',
      size: 112,
      top: 652,
      right: -10,
      opacity: 0.15,
      logoOpacity: 0.3,
    },
    {
      key: 'leaf-bottom',
      size: 124,
      top: 974,
      left: -24,
      opacity: 0.16,
      logoOpacity: 0.31,
    },
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bubbles.map(bubble => (
        <DytopiaLogoBubble
          key={bubble.key}
          size={bubble.size}
          opacity={bubble.opacity}
          logoOpacity={bubble.logoOpacity}
          style={[
            s.produceBubble,
            {
              width: bubble.size,
              height: bubble.size,
              borderRadius: bubble.size / 2,
              top: bubble.top,
              left: bubble.left,
              right: bubble.right,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function DashboardScreen({
  onPressPlans,
  onPressKitchen,
  onPressMessages,
  onTabSwipeEnabledChange,
  isActive = true,
}: {
  onPressPlans?: () => void;
  onPressKitchen?: () => void;
  onPressMessages?: () => void;
  onTabSwipeEnabledChange?: (enabled: boolean) => void;
  isActive?: boolean;
} = {}) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { t, language } = useTranslation();
  const { data, isLoading, refetch, isRefetching, isStale } = useDashboard(isActive);
  const { data: gamification } = useGamification();
  const { data: plansData } = useQuery({
    queryKey: ['client-plans'],
    queryFn: getPlansData,
    enabled: (user?.isPremium ?? false) && isActive,
    staleTime: 2 * 60 * 1000,
  });
  const activePlan = plansData?.plans.find(p => p.isActive) ?? null;

  const { data: activeAnnouncement } = useQuery({
    queryKey: ['active-announcement'],
    queryFn: getActiveAnnouncement,
    enabled: (user?.isPremium ?? false) && isActive,
    staleTime: 5 * 60 * 1000,
  });
  const { data: favoriteSummary } = useQuery({
    queryKey: ['favorite-recipes-summary'],
    queryFn: getFavoriteRecipesSummary,
    enabled: (user?.isPremium ?? false) && isActive,
    staleTime: 60_000,
  });
  const { data: dailyGames } = useQuery({
    queryKey: ['daily-games', language],
    queryFn: () => getDailyGames(language),
    enabled: (user?.isPremium ?? false) && isActive,
    staleTime: 45_000,
  });
  const todayMealLogDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: mealLogs = [] } = useQuery({
    queryKey: ['meal-logs-dashboard', todayMealLogDate],
    queryFn: () => getMealLogs(todayMealLogDate),
    enabled: (user?.isPremium ?? false) && isActive,
    staleTime: 45_000,
  });

  const compliancePercent = data?.compliancePercent ?? 0;
  const todayStatus       = data?.todayStatus ?? 'on-track';
  const nextMeal          = data?.nextMeal;
  const nextMealState     = getDashboardNextMealState(nextMeal);
  const upcomingNextMeal  = nextMealState === 'upcoming' ? nextMeal : undefined;
  const summary           = data?.summary;
  const motivation        = mapGamificationToMotivation(gamification) ?? data?.motivation;
  const streakValue = gamification?.currentStreak ?? summary?.streak ?? 0;
  const mealLogSummary = useMemo(() => summarizeMealLogs(mealLogs), [mealLogs]);

  // Water uses tracking as the source of truth so dashboard, hydration screen, and widgets stay aligned.
  const [waterTracking, setWaterTracking] = useState<TodayTracking | null>(null);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [waterBusy, setWaterBusy] = useState(false);
  const [pantryCount, setPantryCount] = useState(0);
  const [shoppingSummary, setShoppingSummary] = useState<ShoppingListSummary>(EMPTY_SHOPPING_SUMMARY);
  const waterBusyRef = useRef(false);

  const applyWaterTracking = useCallback((nextTracking: TodayTracking) => {
    setWaterTracking(nextTracking);
    setWaterGlasses(Math.max(0, nextTracking.waterGlasses));
  }, []);

  const loadWaterTracking = useCallback(async () => {
    try {
      const nextTracking = await getTodayTracking();
      applyWaterTracking(nextTracking);
    } catch {
      // Dashboard should not block if the hydration endpoint is temporarily unavailable.
    }
  }, [applyWaterTracking]);

  useEffect(() => {
    if (!isActive) return;
    void loadWaterTracking();
  }, [isActive, loadWaterTracking]);

  useFocusEffect(
    useCallback(() => {
      if (!isActive) return;
      void loadWaterTracking();
    }, [isActive, loadWaterTracking]),
  );

  useEffect(() => {
    if (!isActive || !isStale || isLoading || isRefetching) return;
    void refetch();
  }, [isActive, isLoading, isRefetching, isStale, refetch]);

  useEffect(() => {
    if (!isActive) return;

    let active = true;
    void Promise.allSettled([
      getPantry(),
      user?.isPremium ? getShoppingList() : Promise.resolve({ summary: EMPTY_SHOPPING_SUMMARY, items: [] }),
    ]).then(([pantryResult, shoppingResult]) => {
      if (!active) return;

      if (pantryResult.status === 'fulfilled') {
        setPantryCount(pantryResult.value.length);
      }

      if (shoppingResult.status === 'fulfilled') {
        setShoppingSummary(shoppingResult.value.summary ?? EMPTY_SHOPPING_SUMMARY);
      }
    });

    return () => {
      active = false;
    };
  }, [isActive, user?.isPremium]);

  const handleAddWater = useCallback(async () => {
    if (waterBusyRef.current || waterGlasses >= WATER_MAX_GLASSES) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prev = waterGlasses;
    const next = prev + 1;
    const prevTracking = waterTracking;
    waterBusyRef.current = true;
    setWaterBusy(true);
    setWaterGlasses(next);
    if (prevTracking) {
      setWaterTracking({ ...prevTracking, waterGlasses: next });
    }
    try {
      const updated = await updateTodayTracking(
        next,
        prevTracking?.steps ?? 0,
        prevTracking?.notes ?? null,
      );
      applyWaterTracking(updated);
      void refreshWidgetsFromApp(user?.isPremium ?? false);
    } catch {
      setWaterGlasses(prev);
      if (prevTracking) {
        setWaterTracking(prevTracking);
      }
    } finally {
      waterBusyRef.current = false;
      setWaterBusy(false);
    }
  }, [applyWaterTracking, user?.isPremium, waterGlasses, waterTracking]);

  const handleRemoveWater = useCallback(async () => {
    if (waterBusyRef.current || waterGlasses <= 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prev = waterGlasses;
    const next = prev - 1;
    const prevTracking = waterTracking;
    waterBusyRef.current = true;
    setWaterBusy(true);
    setWaterGlasses(next);
    if (prevTracking) {
      setWaterTracking({ ...prevTracking, waterGlasses: next });
    }
    try {
      const updated = await updateTodayTracking(
        next,
        prevTracking?.steps ?? 0,
        prevTracking?.notes ?? null,
      );
      applyWaterTracking(updated);
      void refreshWidgetsFromApp(user?.isPremium ?? false);
    } catch {
      setWaterGlasses(prev);
      if (prevTracking) {
        setWaterTracking(prevTracking);
      }
    } finally {
      waterBusyRef.current = false;
      setWaterBusy(false);
    }
  }, [applyWaterTracking, user?.isPremium, waterGlasses, waterTracking]);

  const heroStyle     = useHeroEntrance();
  const continueStyle = useFadeRise(220, 12);
  const actionsStyle  = useFadeRise(160, 10);
  const favoritePocketStyle = useFadeRise(240, 10);
  const gridStyle     = useFadeRise(280, 12);

  const handleActivate = useCallback(() => {
    (navigation as any).navigate(Routes.Modal.ActivatePremium);
  }, [navigation]);

  const handleMeasurements = useCallback(() => {
    (navigation as any).navigate(Routes.App.ProfileMeasurements);
  }, [navigation]);

  const handleOpenBadgeVault = useCallback(() => {
    (navigation as any).navigate(Routes.App.BadgeVault);
  }, [navigation]);

  const handleOpenWater = useCallback(() => {
    (navigation as any).navigate(Routes.App.Hydration);
  }, [navigation]);

  const handleOpenPantry = useCallback(() => {
    (navigation as any).navigate(Routes.App.Pantry);
  }, [navigation]);

  const handleOpenShoppingList = useCallback(() => {
    (navigation as any).navigate(Routes.App.ShoppingList);
  }, [navigation]);
  const handleOpenFavorites = useCallback(() => {
    (navigation as any).navigate(Routes.App.Favorites);
  }, [navigation]);
  const handleOpenGames = useCallback(() => {
    (navigation as any).navigate(Routes.App.GameCenter);
  }, [navigation]);
  const handleOpenMealLog = useCallback(() => {
    (navigation as any).navigate(Routes.App.MealLog);
  }, [navigation]);
  const lockTabSwipe = useCallback(() => {
    onTabSwipeEnabledChange?.(false);
  }, [onTabSwipeEnabledChange]);
  const releaseTabSwipe = useCallback(() => {
    onTabSwipeEnabledChange?.(true);
  }, [onTabSwipeEnabledChange]);

  const handleCoachTask = useCallback((task?: DashboardCoachTask | null) => {
    if (!task) return;
    if (task.actionKey === 'MESSAGES' && onPressMessages) {
      onPressMessages();
      return;
    }
    void runCoachTaskAction(navigation as any, task.actionKey);
  }, [navigation, onPressMessages]);

  const todayPanelItems = useMemo<TodayPanelItem[]>(() => buildTodayPanelItems({
    language,
    waterGlasses,
    waterGoal: WATER_GOAL,
    pantryCount,
    nextMealTitle: nextMeal?.title ?? nextMeal?.time,
    nextMealMinutesUntil: nextMeal?.minutesUntil ?? null,
    motivation,
  }), [language, motivation, nextMeal?.minutesUntil, nextMeal?.time, nextMeal?.title, pantryCount, waterGlasses]);

  const rescueMission = useMemo<RescueMission>(() => buildRescueMission({
    language,
    waterGlasses,
    waterGoal: WATER_GOAL,
    pantryCount,
    shoppingSummary,
    motivation,
    nextMealTitle: nextMeal?.title ?? nextMeal?.time,
  }), [language, motivation, nextMeal?.time, nextMeal?.title, pantryCount, shoppingSummary, waterGlasses]);

  const continueCard: ContinueCardModel = (() => {
    if (!(user?.isPremium ?? false)) {
      return {
        eyebrow: language === 'tr' ? 'Sonraki adım' : 'Next move',
        title: language === 'tr' ? 'Premium alanını aç ve planını bağla' : 'Unlock premium and connect your plan',
        body: language === 'tr'
          ? 'Kişisel plan, seri takibi ve su hedefleri tek akışta burada toplanır.'
          : 'Your personal plan, streaks, and hydration goals live here once premium is active.',
        cta: language === 'tr' ? "Premium'u aç" : 'Open premium',
        icon: 'sparkles-outline',
        accent: theme.accentGold,
        onPress: handleActivate,
      };
    }

    if (nextMealState === 'upcoming' && nextMeal) {
      const mealTitle = nextMeal.title ?? nextMeal.time ?? (language === 'tr' ? 'Sıradaki öğün' : 'Next meal');
      return {
        eyebrow: language === 'tr' ? 'Şimdi devam et' : 'Continue now',
        title: language === 'tr' ? `${mealTitle} seni bekliyor` : `${mealTitle} is up next`,
        body: language === 'tr'
          ? 'Bugünkü akışını kaybetmeden sıradaki öğününü aç ve planını tamamlamaya devam et.'
          : "Jump back into today's flow and keep your plan moving with the next meal.",
        cta: language === 'tr' ? 'Planı aç' : 'Open plan',
        icon: 'restaurant-outline',
        accent: theme.primary,
        onPress: onPressPlans ?? noop,
      };
    }

    if (nextMealState === 'all-complete') {
      return {
        eyebrow: language === 'tr' ? 'Gün tamamlandı' : 'Day complete',
        title: language === 'tr' ? 'Bugünün planını tamamladın' : "You completed today's plan",
        body: language === 'tr'
          ? 'Tüm öğünlerini tamamladın. İstersen planını gözden geçir ya da su hedefini bitirerek günü güçlü kapat.'
          : 'All meals are complete. Review your plan or finish your hydration goal to close the day strong.',
        cta: language === 'tr' ? 'Planımı gör' : 'View my plan',
        icon: 'checkmark-circle-outline',
        accent: theme.emerald,
        onPress: onPressPlans ?? noop,
      };
    }

    if (nextMealState === 'no-plan') {
      return {
        eyebrow: language === 'tr' ? 'Bugün sakin' : 'Quiet day',
        title: language === 'tr' ? 'Bugün için plan görünmüyor' : 'No plan is visible for today',
        body: language === 'tr'
          ? 'Yeni plan yayınlandığında burada göreceksin. Bu arada tariflere göz atabilir veya alışveriş listesini güncelleyebilirsin.'
          : 'You will see your next plan here. For now, you can explore recipes or refresh your shopping list.',
        cta: language === 'tr' ? 'Mutfağı aç' : 'Open kitchen',
        icon: 'leaf-outline',
        accent: theme.emerald,
        onPress: onPressKitchen ?? noop,
      };
    }

    if (waterGlasses < WATER_GOAL) {
      return {
        eyebrow: language === 'tr' ? 'Ritmi koru' : 'Keep the rhythm',
        title: language === 'tr' ? 'Su hedefinden geri kalma' : 'Stay on top of hydration',
        body: language === 'tr'
          ? `${Math.max(WATER_GOAL - waterGlasses, 0)} bardak daha içersen günlük 2 L hedefini tamamlarsın.`
          : `${Math.max(WATER_GOAL - waterGlasses, 0)} more glasses gets you to today's 2 L goal.`,
        cta: language === 'tr' ? 'Su ekranına git' : 'Open hydration',
        icon: 'water-outline',
        accent: '#38BDF8',
        onPress: handleOpenWater,
      };
    }

    if (data?.coachTask) {
      return {
        eyebrow: language === 'tr' ? 'Bugünün görevi' : "Today's task",
        title: data.coachTask.title,
        body: data.coachTask.body,
        cta: data.coachTask.cta,
        icon: 'sparkles-outline',
        accent: theme.emerald,
        onPress: () => handleCoachTask(data.coachTask),
      };
    }

    if (data?.dietitianNote && onPressMessages) {
      return {
        eyebrow: language === 'tr' ? 'Yeni not' : 'New note',
        title: language === 'tr' ? 'Diyetisyeninden gelen notu kontrol et' : 'Check the latest note from your dietitian',
        body: language === 'tr'
          ? 'Günün ritmini korumak için mesajlarını gözden geçir ve gereken yanıtı ver.'
          : 'Review your latest message and reply if anything needs your attention.',
        cta: language === 'tr' ? 'Mesajları aç' : 'Open messages',
        icon: 'chatbubble-ellipses-outline',
        accent: theme.accent,
        onPress: onPressMessages,
      };
    }

    if (activePlan) {
      return {
        eyebrow: language === 'tr' ? 'Plan görünümü' : 'Plan view',
        title: language === 'tr' ? 'Bugünkü akışını kontrol et' : "Review today's flow",
        body: language === 'tr'
          ? 'Tamamlanan, bekleyen ve alternatif öğünlerini tek yerden gözden geçir.'
          : 'See completed, pending, and alternative meals together in one calm timeline.',
        cta: language === 'tr' ? 'Planımı aç' : 'Open my plan',
        icon: 'calendar-outline',
        accent: theme.emerald,
        onPress: onPressPlans ?? noop,
      };
    }

    return {
      eyebrow: language === 'tr' ? 'Keşfet' : 'Explore',
      title: language === 'tr' ? 'Mutfağa dön ve yeni bir tarif seç' : 'Head to the kitchen and pick a new recipe',
      body: language === 'tr'
        ? 'Bugün için sakin bir tarif turu yap, malzemelerine göre yeni seçenekler keşfet.'
        : 'Take a calm recipe pass and discover new options based on what you have.',
      cta: language === 'tr' ? 'Mutfağı aç' : 'Open kitchen',
      icon: 'leaf-outline',
      accent: theme.emerald,
      onPress: onPressKitchen ?? noop,
    };
  })();

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <DytopiaWatermark position="center" size={310} opacity={0.036} />
      <AmbientProduceBubbles />
      <DytopiaLogoBubble size={220} opacity={0.26} logoOpacity={0.34} style={s.screenGlowA} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
            progressViewOffset={60}
          />
        }
      >
        {/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ HERO CAPSULE ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ */}
        <DayHeaderBand
          theme={theme}
          language={language}
          title={user?.isPremium ? "Bugün için iyi bir ritim kur." : "Dytopia'ya yeni bir görünüm geldi."}
          subtitle={user?.isPremium ? "Planın, ölçümlerin ve tarif akışın tek bir merkezde." : "Tarifleri keşfet, profilini hazırla ve premium plana daha güçlü bir deneyimle geç."}
        />
        <Animated.View style={[heroStyle]}>
          <HeroCapsule
            theme={theme}
            isPremium={user?.isPremium ?? false}
            name={data?.greetingName}
            clinicName={data?.clinicName}
            compliancePercent={compliancePercent}
            todayStatus={todayStatus}
            onActivate={handleActivate}
          />
        </Animated.View>

        {activeAnnouncement && (
          <AnnouncementBanner theme={theme} announcement={activeAnnouncement} language={language} />
        )}

        <Animated.View style={[continueStyle]}>
          <ContinueJourneyCard
            theme={theme}
            language={language}
            card={continueCard}
          />
        </Animated.View>

        {/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ SMART ACTIONS RAIL ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ */}
        <Animated.View style={[actionsStyle]}>
          <SmartActionsRail
            theme={theme}
            isPremium={user?.isPremium ?? false}
            onPressPlans={onPressPlans}
            onPressKitchen={onPressKitchen}
            onPressMessages={onPressMessages}
            onPressActivate={handleActivate}
            onPressMeasurements={handleMeasurements}
            onPressShopping={handleOpenShoppingList}
            onPressPantry={handleOpenPantry}
            language={language}
          />
        </Animated.View>

        {/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ CONTENT GRID ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ */}
        {isLoading ? (
          <DashboardLoadingState theme={theme} language={language} />
        ) : (
          <Animated.View style={[gridStyle]}>
            {user?.isPremium ? (
                <PremiumGrid
                  theme={theme}
                  compliancePercent={compliancePercent}
                  streak={streakValue}
                water={waterGlasses}
                waterBusy={waterBusy}
                pantryCount={pantryCount}
                shoppingSummary={shoppingSummary}
                motivation={motivation}
                todayPanelItems={todayPanelItems}
                rescueMission={rescueMission}
                dailyGames={dailyGames}
                mealLogSummary={mealLogSummary}
                nextMeal={upcomingNextMeal}
                coachTask={data?.coachTask}
                dietitianNote={data?.dietitianNote}
                activePlan={activePlan}
                onPressKitchen={onPressKitchen}
                onPressPlans={onPressPlans}
                  onPressMessages={onPressMessages}
                  onPressCoachTask={handleCoachTask}
                  onPressMeasurements={handleMeasurements}
                  onPressPantry={handleOpenPantry}
                  onPressBadgeVault={handleOpenBadgeVault}
                  onPressGames={handleOpenGames}
                  onPressMealLog={handleOpenMealLog}
                  onPressWater={handleAddWater}
                  onRemoveWater={handleRemoveWater}
                onHorizontalGestureStart={lockTabSwipe}
                onHorizontalGestureEnd={releaseTabSwipe}
                language={language}
              />
            ) : (
              <FreeGrid
                theme={theme}
                  publicUserId={user?.publicUserId}
                  onPressActivate={handleActivate}
                  onPressKitchen={onPressKitchen}
                  onPressMeasurements={handleMeasurements}
                  onPressPantry={handleOpenPantry}
                />
            )}
          </Animated.View>
        )}

        {user?.isPremium ? (
          <Animated.View style={[favoritePocketStyle]}>
            <FavoritesPocketCard
              theme={theme}
              language={language}
              summary={favoriteSummary}
              onPress={handleOpenFavorites}
            />
          </Animated.View>
        ) : null}

        <View style={s.bottomPad} />
      </ScrollView>
    </View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚
   HERO CAPSULE
ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ */
function AnnouncementBanner({
  theme,
  announcement,
  language,
}: {
  theme: import('../theme/tokens').Theme;
  announcement: ActiveAnnouncement;
  language: 'tr' | 'en';
}) {
  const shimmer = useShimmerBand(true);
  const endsDate = new Date(announcement.endsAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

  return (
    <View style={[annS.card, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
      <Animated.View style={[StyleSheet.absoluteFill, annS.shimmerOverlay, shimmer]} pointerEvents="none" />
      <View style={annS.iconWrap}>
        <Ionicons name="megaphone-outline" size={18} color={theme.primary} />
      </View>
      <View style={annS.content}>
        <Text style={[annS.label, { color: theme.primary }]} numberOfLines={1}>
          {language === 'tr' ? 'Diyetisyeninden' : 'From your dietitian'}
        </Text>
        <Text style={[annS.title, { color: theme.text }]} numberOfLines={2}>
          {announcement.title}
        </Text>
        <Text style={[annS.body, { color: theme.textSub }]} numberOfLines={4}>
          {announcement.body}
        </Text>
        <Text style={[annS.date, { color: theme.textMuted }]}>
          {language === 'tr' ? `${endsDate} tarihine kadar geçerli` : `Valid until ${endsDate}`}
        </Text>
      </View>
    </View>
  );
}

const annS = StyleSheet.create({
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    overflow: 'hidden',
  },
  shimmerOverlay: {
    borderRadius: radii.xxl,
    opacity: 0.06,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  date: {
    fontSize: 11,
    marginTop: 2,
  },
});

function HeroCapsule({
  theme, isPremium, name, clinicName, compliancePercent, todayStatus, onActivate,
}: {
  theme: import('../theme/tokens').Theme;
  isPremium: boolean;
  name?: string;
  clinicName?: string;
  compliancePercent: number;
  todayStatus: string;
  onActivate: () => void;
}) {
  const { t } = useTranslation();
  const barPct   = Math.min(compliancePercent, 100);
  const barColor = compliancePercent >= 90 ? theme.emerald
                 : compliancePercent >= 70 ? theme.success
                 : compliancePercent >= 45 ? theme.accentGold
                 : compliancePercent >= 20 ? theme.accentCoral
                 : theme.error;
  const haloStyle = useHaloBreathe(isPremium);

  return (
    <View style={[s.heroCapsule, { borderColor: theme.borderEmerald }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surface, borderRadius: radii.xxl }]} />
      {isPremium && (
        <Animated.View
          style={[StyleSheet.absoluteFill, s.heroHaloRing, { borderColor: theme.emerald }, haloStyle]}
          pointerEvents="none"
        />
      )}
      <ProduceBubble
        icon="fruit-pear"
        iconSize={22}
        iconColor={`${theme.primary}32`}
        style={[s.heroGlowTR, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="leaf"
        iconSize={18}
        iconColor={`${theme.emerald}32`}
        style={[s.heroGlowBL, { backgroundColor: theme.emeraldGlow }]}
      />

      {/* Clinic / free badge + status */}
      <View style={s.heroTopRow}>
        {isPremium ? (
          <View style={s.heroClinicRow}>
            <View style={[s.heroClinicDot, { backgroundColor: theme.emerald }]} />
            <Text style={[s.heroClinicName, { color: theme.textSub }]} numberOfLines={1}>
              {clinicName ?? t.dashboard.clinicDefault}
            </Text>
          </View>
        ) : (
          <View style={[s.heroBadgeFree, { borderColor: theme.border }]}>
            <Text style={[s.heroBadgeFreeText, { color: theme.textMuted }]}>Ücretsiz Plan</Text>
          </View>
        )}
        <View style={[s.heroStatusBadge, { backgroundColor: `${barColor}18`, borderColor: `${barColor}40` }]}>
          <View style={[s.heroStatusDot, { backgroundColor: barColor }]} />
          <Text style={[s.heroStatusLabel, { color: barColor }]}>
            {getComplianceLabel(compliancePercent, t.dashboard)}
          </Text>
        </View>
      </View>

      {/* Greeting */}
      <View style={s.heroGreetingBlock}>
        <Text style={[s.heroGreeting, { color: theme.textMuted }]}>{getGreeting(t.greeting)}</Text>
        <Text style={[s.heroName, { color: theme.text }]} numberOfLines={2}>
          {name ?? t.dashboard.greetingDefault}
        </Text>
      </View>

      {/* Compliance bar (premium only) */}
      {isPremium && (
        <View style={s.heroProgressBlock}>
          <View style={s.heroProgressHeader}>
            <Text style={[s.heroProgressLabel, { color: theme.textMuted }]}>{t.dashboard.compliance}</Text>
            <Text style={[s.heroProgressPct, { color: barColor }]}>{compliancePercent}%</Text>
          </View>
          <View style={[s.heroTrack, { backgroundColor: theme.borderLight }]}>
            <View style={[s.heroFill, { width: `${barPct}%`, backgroundColor: barColor, shadowColor: barColor }]} />
          </View>
        </View>
      )}

      {/* Free CTA */}
      {!isPremium && (
        <TouchableOpacity
          style={[s.heroActivateBtn, { backgroundColor: theme.primary, shadowColor: theme.primaryGlow }]}
          onPress={onActivate}
          activeOpacity={0.85}
        >
          <Ionicons name="key-outline" size={14} color="#fff" />
          <Text style={s.heroActivateTxt}>{t.dashboard.activateKey}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚
   SMART ACTIONS RAIL
ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ */
function makeActionsPremium(
  d: { actionPlans: string; actionKitchen: string; actionMeasures: string; actionMessages: string },
  language: 'tr' | 'en',
) {
  return [
    { id: 'plans',    icon: 'calendar-outline'   as const, label: d.actionPlans,    color: '#1FA876' },
    { id: 'kitchen',  icon: 'restaurant-outline' as const, label: d.actionKitchen,  color: '#38BDF8' },
    { id: 'measures', icon: 'body-outline'       as const, label: d.actionMeasures, color: '#F59E0B' },
    { id: 'messages', icon: 'mail-outline'       as const, label: d.actionMessages, color: '#E879F9' },
    { id: 'shopping', icon: 'cart-outline'       as const, label: language === 'tr' ? 'Alışveriş' : 'Shopping', color: '#34D399' },
    { id: 'pantry',   icon: 'basket-outline'     as const, label: language === 'tr' ? 'Dolabım' : 'Pantry',     color: '#60A5FA' },
  ];
}

function makeActionsFree(
  d: { actionRecipes: string; actionPremium: string; actionMeasures: string; actionCopyId: string },
  language: 'tr' | 'en',
) {
  return [
    { id: 'kitchen',  icon: 'restaurant-outline' as const, label: d.actionRecipes,  color: '#1FA876' },
    { id: 'activate', icon: 'key-outline'        as const, label: d.actionPremium,  color: '#F59E0B' },
    { id: 'measures', icon: 'body-outline'       as const, label: d.actionMeasures, color: '#38BDF8' },
    { id: 'share',    icon: 'copy-outline'       as const, label: d.actionCopyId,   color: '#E879F9' },
    { id: 'shopping', icon: 'cart-outline'       as const, label: language === 'tr' ? 'Alışveriş' : 'Shopping', color: '#34D399' },
    { id: 'pantry',   icon: 'basket-outline'     as const, label: language === 'tr' ? 'Dolabım' : 'Pantry',     color: '#60A5FA' },
  ];
}

function SmartActionsRail({
  theme, isPremium, onPressPlans, onPressKitchen, onPressMessages,
  onPressActivate, onPressMeasurements, onPressShopping, onPressPantry, language,
}: {
  theme: import('../theme/tokens').Theme;
  isPremium: boolean;
  onPressPlans?: () => void;
  onPressKitchen?: () => void;
  onPressMessages?: () => void;
  onPressActivate: () => void;
  onPressMeasurements: () => void;
  onPressShopping: () => void;
  onPressPantry: () => void;
  language: 'tr' | 'en';
}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const railWidth = Math.max(0, width - spacing.base * 2);
  const chipWidth = getResponsiveGridItemWidth(
    railWidth,
    ACTION_RAIL_COLUMNS,
    ACTION_RAIL_GAP,
  );

  function handleShare() {
    if (user?.publicUserId) {
      Clipboard.setStringAsync(user.publicUserId).then(() => {
        Alert.alert(t.common.copied, `${t.dashboard.userId}:\n${user.publicUserId}`);
      });
    }
  }

  const actions = isPremium ? makeActionsPremium(t.dashboard, language) : makeActionsFree(t.dashboard, language);
  const handlers: Record<string, () => void> = {
    plans:    onPressPlans    ?? noop,
    kitchen:  onPressKitchen  ?? noop,
    measures: onPressMeasurements,
    messages: onPressMessages ?? noop,
    activate: onPressActivate,
    share:    handleShare,
    shopping: onPressShopping,
    pantry:   onPressPantry,
  };

  return (
    <View style={s.actionsRail}>
      {actions.map((action, i) => (
        <ActionChip
          key={action.id}
          icon={action.icon}
          label={action.label}
          color={action.color}
          theme={theme}
          index={i}
          width={chipWidth}
          onPress={handlers[action.id] ?? noop}
        />
      ))}
    </View>
  );
}

function ActionChip({
  icon, label, color, theme, index, width, onPress,
}: {
  icon: any; label: string; color: string;
  theme: import('../theme/tokens').Theme;
  index: number; width: number; onPress: () => void;
}) {
  const style = useStaggerItem(index, 160, 45);
  return (
    <Animated.View style={[style, s.actionChipSlot, { width }]}>
      <TouchableOpacity
        style={[s.actionChip, { backgroundColor: `${color}12`, borderColor: `${color}28` }]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <View style={[s.actionIconWrap, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text
          style={[s.actionLabel, { color: theme.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          maxFontSizeMultiplier={1.1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚
   PREMIUM GRID
ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ */
function FavoritesPocketCard({
  theme,
  language,
  summary,
  onPress,
}: {
  theme: import('../theme/tokens').Theme;
  language: 'tr' | 'en';
  summary?: FavoriteRecipesSummaryDto;
  onPress: () => void;
}) {
  const totalFavorites = summary?.totalFavorites ?? 0;
  const bestMatched = summary?.bestMatchedFavorite;
  const recentFavorites = summary?.recentFavorites ?? [];

  return (
    <TouchableOpacity
      style={[s.favoritePocket, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={26}
        iconColor={`${theme.accentCoral}40`}
        style={[s.favoritePocketGlow, { backgroundColor: `${theme.accentCoral}18` }]}
      />
      <View style={s.favoritePocketTop}>
        <View style={{ flex: 1 }}>
          <Text style={[s.favoritePocketEyebrow, { color: theme.primary }]}>
            {language === 'tr' ? 'FAVORİLERİM' : 'MY FAVORITES'}
          </Text>
          <Text style={[s.favoritePocketTitle, { color: theme.text }]}>
            {language === 'tr' ? 'Sevdiğin tarifler elinin altında' : 'Keep your favorite recipes close'}
          </Text>
        </View>
        <View style={[s.favoritePocketBadge, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
          <Text style={[s.favoritePocketBadgeValue, { color: theme.primaryDark }]}>{totalFavorites}</Text>
          <Text style={[s.favoritePocketBadgeLabel, { color: theme.textMuted }]}>
            {language === 'tr' ? 'aktif' : 'active'}
          </Text>
        </View>
      </View>

      <Text style={[s.favoritePocketBody, { color: theme.textSub }]} numberOfLines={2}>
        {totalFavorites > 0
          ? (language === 'tr'
            ? 'Premium süren boyunca sevdiğin tarifleri sakla ve dolabına en uygun olanları tek dokunuşla geri aç.'
            : 'Keep favorite recipes while premium is active and reopen the ones that best fit your pantry.')
          : (language === 'tr'
            ? 'Henüz favori tarif eklemedin. Beğendiğin tarifleri kalp ikonuyla burada biriktirebilirsin.'
            : 'You have not saved any favorites yet. Use the heart icon to collect recipes here.')}
      </Text>

      <View style={s.favoritePocketMetrics}>
        <View style={[s.favoritePocketMetricCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[s.favoritePocketMetricLabel, { color: theme.textMuted }]}>
            {language === 'tr' ? 'En hazır favori' : 'Best pantry fit'}
          </Text>
          <Text style={[s.favoritePocketMetricValue, { color: theme.emerald }]}>
            {bestMatched ? `%${bestMatched.pantryCoverage.percent}` : '—'}
          </Text>
          <Text style={[s.favoritePocketMetricSub, { color: theme.textSub }]} numberOfLines={1}>
            {bestMatched?.name ?? (language === 'tr' ? 'Hazır favorin burada görünür' : 'Your ready favorite appears here')}
          </Text>
        </View>

        <View style={[s.favoritePocketMetricCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[s.favoritePocketMetricLabel, { color: theme.textMuted }]}>
            {language === 'tr' ? 'Son eklenenler' : 'Recently saved'}
          </Text>
          <View style={s.favoritePocketRecentList}>
            {recentFavorites.slice(0, 2).map(item => (
              <Text key={item.recipeId} style={[s.favoritePocketRecentItem, { color: theme.text }]} numberOfLines={1}>
                • {item.name}
              </Text>
            ))}
            {recentFavorites.length === 0 ? (
              <Text style={[s.favoritePocketMetricSub, { color: theme.textSub }]}>
                {language === 'tr' ? 'İlk beğendiğin tarif burada yer alır' : 'Your first saved recipe will appear here'}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={s.favoritePocketFooter}>
        <Text style={[s.favoritePocketFooterText, { color: theme.primaryDark }]}>
          {language === 'tr' ? 'Tümünü gör' : 'See all'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.primaryDark} />
      </View>
    </TouchableOpacity>
  );
}

function ContinueJourneyCard({
  theme,
  language,
  card,
}: {
  theme: import('../theme/tokens').Theme;
  language: 'tr' | 'en';
  card: ContinueCardModel;
}) {
  return (
    <TouchableOpacity
      style={[s.continueCard, { backgroundColor: theme.surface, borderColor: `${card.accent}35` }]}
      onPress={card.onPress}
      activeOpacity={0.88}
    >
      <View style={[s.continueAccent, { backgroundColor: `${card.accent}18` }]} />
      <View style={s.continueTopRow}>
        <View style={[s.continueEyebrowPill, { backgroundColor: `${card.accent}16`, borderColor: `${card.accent}30` }]}>
          <Text style={[s.continueEyebrow, { color: card.accent }]}>{card.eyebrow}</Text>
        </View>
        <View style={[s.continueIconWrap, { backgroundColor: `${card.accent}16`, borderColor: `${card.accent}30` }]}>
          <Ionicons name={card.icon} size={16} color={card.accent} />
        </View>
      </View>
      <Text style={[s.continueTitle, { color: theme.text }]}>{card.title}</Text>
      <Text style={[s.continueBody, { color: theme.textSub }]}>{card.body}</Text>
      <View style={s.continueFooter}>
        <Text style={[s.continueCTA, { color: card.accent }]}>{card.cta}</Text>
        <View style={[s.continueCTAChip, { backgroundColor: `${card.accent}14`, borderColor: `${card.accent}28` }]}>
          <Text style={[s.continueCTAChipText, { color: card.accent }]}>
            {language === 'tr' ? 'Devam et' : 'Keep going'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DashboardLoadingState({
  theme,
  language,
}: {
  theme: import('../theme/tokens').Theme;
  language: "tr" | "en";
}) {
  return (
    <View style={s.loadingWrap}>
      <View style={[s.loadingCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
        <View style={[s.loadingBrandPill, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
          <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
          <Text style={[s.loadingBrandText, { color: theme.primaryDark }]}>
            {language === "tr" ? "Dytopia gününü hazırlıyor" : "Dytopia is preparing your day"}
          </Text>
        </View>
        <View style={[s.loadingBarLg, { backgroundColor: theme.glassEmerald }]} />
        <View style={[s.loadingBarMd, { backgroundColor: theme.surfaceElevated }]} />
        <View style={s.loadingRow}>
          <View style={[s.loadingPill, { backgroundColor: theme.surfaceElevated }]} />
          <View style={[s.loadingPill, { backgroundColor: theme.surfaceElevated }]} />
          <View style={[s.loadingPill, { backgroundColor: theme.surfaceElevated }]} />
        </View>
      </View>
      <View style={[s.loadingGridRow, { gap: spacing.sm }]}>
        <View style={[s.loadingPanel, { backgroundColor: theme.surface, borderColor: theme.border }]} />
        <View style={[s.loadingPanel, { backgroundColor: theme.surface, borderColor: theme.border }]} />
      </View>
    </View>
  );
}

function PremiumGrid({
  theme, compliancePercent, streak, water, waterBusy, pantryCount, shoppingSummary, motivation, todayPanelItems, rescueMission, dailyGames, nextMeal, coachTask, dietitianNote,
  mealLogSummary, activePlan, onPressKitchen, onPressPlans, onPressMessages, onPressCoachTask, onPressMeasurements, onPressPantry, onPressBadgeVault, onPressGames, onPressMealLog,
  onPressWater, onRemoveWater, onHorizontalGestureStart, onHorizontalGestureEnd, language,
}: {
  theme: import('../theme/tokens').Theme;
  compliancePercent: number;
  streak: number;
  water: number;
  waterBusy: boolean;
  pantryCount: number;
  shoppingSummary: ShoppingListSummary;
  motivation?: DashboardMotivation;
  todayPanelItems: TodayPanelItem[];
  rescueMission: RescueMission;
  dailyGames?: DailyGamePack;
  mealLogSummary: ReturnType<typeof summarizeMealLogs>;
  nextMeal?: any;
  coachTask?: DashboardCoachTask;
  dietitianNote?: string;
  activePlan?: ClientPlan | null;
  onPressKitchen?: () => void;
  onPressPlans?: () => void;
  onPressMessages?: () => void;
  onPressCoachTask?: (task?: DashboardCoachTask | null) => void;
  onPressMeasurements: () => void;
  onPressPantry: () => void;
  onPressBadgeVault: () => void;
  onPressGames: () => void;
  onPressMealLog: () => void;
  onPressWater?: () => void;
  onRemoveWater?: () => void;
  onHorizontalGestureStart?: () => void;
  onHorizontalGestureEnd?: () => void;
  language: 'tr' | 'en';
}) {
  let idx = 0;
  return (
    <View style={s.grid}>
      <TodayPulsePanel
        theme={theme}
        pantryCount={pantryCount}
        shoppingSummary={shoppingSummary}
        items={todayPanelItems}
        language={language}
        index={idx++}
      />

      <StatsShelf
        theme={theme}
        compliancePercent={compliancePercent}
        streak={streak}
        water={water}
        waterBusy={waterBusy}
        language={language}
        index={idx++}
        onPressWater={onPressWater}
        onRemoveWater={onRemoveWater}
      />

      {/* Active Plan block ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â‚¬Å¡Ã‚¬Ãƒ¢Ã¢â€š¬Ã‚ always shown for premium; shows plan if assigned, empty state otherwise */}
      <ActivePlanBlock
        theme={theme}
        plan={activePlan ?? null}
        onPressPlans={onPressPlans}
        language={language}
        index={idx++}
      />

      <DailyGamesCard
        theme={theme}
        language={language}
        pack={dailyGames}
        onPress={onPressGames}
        index={idx++}
      />

      <PlateScanHomeCard
        theme={theme}
        language={language}
        summary={mealLogSummary}
        onPress={onPressMealLog}
        index={idx++}
      />

      <RescueMissionCard
        theme={theme}
        mission={rescueMission}
        language={language}
        onPressKitchen={onPressKitchen}
        onPressPantry={onPressPantry}
        onPressPlans={onPressPlans}
        onPressWater={onPressWater}
        index={idx++}
      />

      <MotivationShelf
        theme={theme}
        motivation={motivation}
        language={language}
        index={idx++}
        onPressBadgeVault={onPressBadgeVault}
        onHorizontalGestureStart={onHorizontalGestureStart}
        onHorizontalGestureEnd={onHorizontalGestureEnd}
      />

      {nextMeal && (
        <NextMealCard
          theme={theme}
          meal={nextMeal}
          onPressPlans={onPressPlans}
          index={idx++}
        />
      )}

      {coachTask ? (
        <CoachTaskCard
          theme={theme}
          task={coachTask}
          onPressTask={() => onPressCoachTask?.(coachTask)}
          index={idx++}
        />
      ) : null}

      {dietitianNote ? (
        <DietitianNoteCard
          theme={theme}
          note={dietitianNote}
          onPressMessages={onPressMessages}
          index={idx++}
        />
      ) : null}

      <LatestMeasurementsCard
        theme={theme}
        onPressMeasurements={onPressMeasurements}
        index={idx++}
      />

      <KitchenEntryCard
        theme={theme}
        onPress={onPressKitchen}
        index={idx++}
      />

      <PantryEntryCard
        theme={theme}
        onPress={onPressPantry}
        index={idx++}
      />
    </View>
  );
}

function PlateScanHomeCard({
  theme,
  language,
  summary,
  onPress,
  index,
}: {
  theme: import('../theme/tokens').Theme;
  language: 'tr' | 'en';
  summary: ReturnType<typeof summarizeMealLogs>;
  onPress: () => void;
  index: number;
}) {
  const style = useStaggerItem(index, 300, 60);
  const calories = Math.round(summary.calories);

  return (
    <Animated.View style={style}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        style={[s.plateScanCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}
      >
        <View style={[s.plateScanIcon, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
          <Ionicons name="camera-outline" size={23} color={theme.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.plateScanEyebrow, { color: theme.primary }]}>
            {language === 'tr' ? 'GÜNLÜK YENİLENLER' : 'DAILY EATS'}
          </Text>
          <Text style={[s.plateScanTitle, { color: theme.text }]}>
            {language === 'tr' ? 'Bugün ne yedin?' : 'What did you eat today?'}
          </Text>
          <Text style={[s.plateScanBody, { color: theme.textSub }]}>
            {language === 'tr'
              ? 'Tabağını tara; 1 porsiyon yaklaşık kalori ve makrolar günlük listeye eklenir.'
              : 'Scan your plate; approximate 1 portion calories and macros join your daily list.'}
          </Text>
          <View style={s.plateScanStats}>
            <View style={[s.plateScanStat, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Text style={[s.plateScanStatValue, { color: theme.primaryDark }]}>{summary.count}</Text>
              <Text style={[s.plateScanStatLabel, { color: theme.textMuted }]}>{language === 'tr' ? 'kayıt' : 'logs'}</Text>
            </View>
            <View style={[s.plateScanStat, { backgroundColor: '#FFF8DE', borderColor: '#EAD47A55' }]}>
              <Text style={[s.plateScanStatValue, { color: '#94770D' }]}>{calories}</Text>
              <Text style={[s.plateScanStatLabel, { color: '#94770D' }]}>kcal</Text>
            </View>
          </View>
        </View>
        <View style={[s.plateScanArrow, { backgroundColor: theme.primary }]}>
          <Ionicons name="scan-outline" size={22} color="#fff" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function DailyGamesCard({
  theme,
  language,
  pack,
  onPress,
  index,
}: {
  theme: import('../theme/tokens').Theme;
  language: 'tr' | 'en';
  pack?: DailyGamePack;
  onPress: () => void;
  index: number;
}) {
  const style = useStaggerItem(index, 300, 60);
  const total = pack?.totalCount ?? 4;
  const completed = pack?.completedCount ?? 0;
  const ratio = Math.min(1, completed / Math.max(1, total));
  const challengeMeta = [
    { type: 'memory', icon: 'grid-outline' as const, label: language === 'tr' ? 'Eşleştir' : 'Match', color: theme.accentCyan },
    { type: 'quiz', icon: 'help-circle-outline' as const, label: language === 'tr' ? 'Sorular' : 'Quiz', color: theme.accentGold },
    { type: 'word', icon: 'text-outline' as const, label: language === 'tr' ? 'Kelime' : 'Words', color: theme.primary },
    { type: 'guess', icon: 'search-outline' as const, label: language === 'tr' ? 'Tahmin' : 'Guess', color: theme.accentCoral },
    { type: 'market', icon: 'storefront-outline' as const, label: language === 'tr' ? 'Market' : 'Market', color: theme.emerald },
  ];
  const completedTypes = new Set((pack?.challenges ?? [])
    .filter(challenge => challenge.status === 'completed')
    .map(challenge => challenge.type));

  return (
    <Animated.View style={style}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        style={[s.dailyGamesCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}
      >
        <View style={[s.dailyGamesGlow, { backgroundColor: `${theme.accentCyan}18` }]} />
        <View style={s.dailyGamesTop}>
          <View style={[s.dailyGamesIcon, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
            <Ionicons name="game-controller-outline" size={21} color={theme.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.dailyGamesEyebrow, { color: theme.primary }]}>
              {language === 'tr' ? 'BUGÜNÜN MİNİ OYUNLARI' : "TODAY'S MINI GAMES"}
            </Text>
            <Text style={[s.dailyGamesTitle, { color: theme.text }]}>
              {language === 'tr' ? 'Oyun Canavarı rozetine koş' : 'Chase the Game Monster badge'}
            </Text>
            <Text style={[s.dailyGamesBody, { color: theme.textSub }]}>
              {language === 'tr'
                ? 'Kartlar, sorular, kelime, tahmin ve market koşusu. Hepsi kısa, hepsi rozetli.'
                : 'Cards, questions, words, guessing, and market run. Short, friendly, badge-ready.'}
            </Text>
          </View>
          <View style={[s.dailyGamesScore, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
            <Text style={[s.dailyGamesScoreValue, { color: theme.primaryDark }]}>{completed}/{total}</Text>
            <Text style={[s.dailyGamesScoreLabel, { color: theme.textMuted }]}>
              {language === 'tr' ? 'bitti' : 'done'}
            </Text>
          </View>
        </View>

        <View style={[s.dailyGamesTrack, { backgroundColor: theme.borderLight }]}>
          <View style={[s.dailyGamesFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: theme.primary }]} />
        </View>

        <View style={s.dailyGamesPills}>
          {challengeMeta.map((item) => {
            const done = completedTypes.has(item.type as any);
            return (
              <View
                key={item.type}
                style={[s.dailyGamesPill, { backgroundColor: `${item.color}12`, borderColor: `${item.color}26` }]}
              >
                <Ionicons name={done ? 'checkmark-circle' : item.icon} size={14} color={item.color} />
                <Text style={[s.dailyGamesPillText, { color: done ? item.color : theme.textSub }]}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function TodayPulsePanel({
  theme,
  pantryCount,
  shoppingSummary,
  items,
  language,
  index,
}: {
  theme: import('../theme/tokens').Theme;
  pantryCount: number;
  shoppingSummary: ShoppingListSummary;
  items: TodayPanelItem[];
  language: 'tr' | 'en';
  index: number;
}) {
  const style = useStaggerItem(index, 300, 60);
  const toneColor = (tone: TodayPanelItem["tone"]) => {
    switch (tone) {
      case 'emerald': return theme.emerald;
      case 'gold': return theme.accentGold;
      case 'coral': return theme.accentCoral;
      case 'cyan': return theme.accentCyan;
      default: return theme.primary;
    }
  };

  return (
    <Animated.View style={style}>
      <View style={[s.todayPulseCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
        <View style={s.todayPulseHeader}>
          <View>
            <Text style={[s.todayPulseEyebrow, { color: theme.primary }]}>
              {language === 'tr' ? 'BUGÜN PANELİ' : 'TODAY PANEL'}
            </Text>
            <Text style={[s.todayPulseTitle, { color: theme.text }]}>
              {language === 'tr' ? 'Tek bakışta bugünün resmi' : 'The shape of your day at a glance'}
            </Text>
          </View>
          <View style={[s.todayPulseMeta, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Text style={[s.todayPulseMetaTxt, { color: theme.textMuted }]}>
              {language === 'tr' ? `${pantryCount} dolap · ${shoppingSummary.activeCount} eksik` : `${pantryCount} pantry · ${shoppingSummary.activeCount} gaps`}
            </Text>
          </View>
        </View>

        <View style={s.todayPulseGrid}>
          {items.map((item) => {
            const accent = toneColor(item.tone);
            return (
              <View
                key={item.key}
                style={[
                  s.todayPulseTile,
                  { backgroundColor: theme.surfaceElevated, borderColor: `${accent}28` },
                ]}
              >
                <View style={[s.todayPulseIcon, { backgroundColor: `${accent}14`, borderColor: `${accent}2A` }]}>
                  <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={accent} />
                </View>
                <Text style={[s.todayPulseValue, { color: theme.text }]}>{item.value}</Text>
                <Text
                  style={[s.todayPulseTileTitle, { color: theme.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  maxFontSizeMultiplier={1.1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[s.todayPulseTileBody, { color: theme.textMuted }]}
                  numberOfLines={3}
                  maxFontSizeMultiplier={1.1}
                >
                  {item.body}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

function RescueMissionCard({
  theme,
  mission,
  language,
  onPressKitchen,
  onPressPantry,
  onPressPlans,
  onPressWater,
  index,
}: {
  theme: import('../theme/tokens').Theme;
  mission: RescueMission;
  language: 'tr' | 'en';
  onPressKitchen?: () => void;
  onPressPantry?: () => void;
  onPressPlans?: () => void;
  onPressWater?: () => void;
  index: number;
}) {
  const style = useStaggerItem(index, 300, 60);
  const accent =
    mission.tone === 'cyan' ? theme.accentCyan :
    mission.tone === 'gold' ? theme.accentGold :
    mission.tone === 'coral' ? theme.accentCoral :
    mission.tone === 'emerald' ? theme.emerald :
    theme.primary;

  const handlePress = () => {
    if (mission.icon === 'water-outline') {
      onPressWater?.();
      return;
    }
    if (mission.icon === 'basket-outline') {
      onPressPantry?.();
      return;
    }
    if (mission.icon === 'cart-outline') {
      onPressPlans?.();
      return;
    }
    onPressKitchen?.();
  };

  return (
    <Animated.View style={style}>
      <TouchableOpacity
        activeOpacity={0.84}
        onPress={handlePress}
        style={[s.rescueCard, { backgroundColor: theme.surface, borderColor: `${accent}30` }]}
      >
        <View style={[s.rescueAccent, { backgroundColor: `${accent}14` }]} />
        <View style={s.rescueHeader}>
          <View style={[s.rescueIcon, { backgroundColor: `${accent}14`, borderColor: `${accent}2A` }]}>
            <Ionicons name={mission.icon as keyof typeof Ionicons.glyphMap} size={18} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.rescueEyebrow, { color: accent }]}>
              {language === 'tr' ? 'BUGÜNÜ KURTAR' : 'RESCUE TODAY'}
            </Text>
            <Text style={[s.rescueTitle, { color: theme.text }]}>{mission.title}</Text>
          </View>
          <View style={[s.rescueProgress, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Text style={[s.rescueProgressTxt, { color: accent }]}>{mission.progressLabel}</Text>
          </View>
        </View>
        <Text style={[s.rescueBody, { color: theme.textSub }]}>{mission.body}</Text>
        <View style={s.rescueFooter}>
          <Text style={[s.rescueCTA, { color: accent }]}>{mission.cta}</Text>
          <Ionicons name="arrow-forward" size={16} color={accent} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ Active Plan Block ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ */
function ActivePlanBlock({
  theme, plan, onPressPlans, language, index,
}: {
  theme: import('../theme/tokens').Theme;
  plan: ClientPlan | null;
  onPressPlans?: () => void;
  language: 'tr' | 'en';
  index: number;
}) {
  const style = useStaggerItem(index, 300, 60);
  const completionPct = plan && plan.mealCount > 0
    ? Math.round((plan.completedMeals / plan.mealCount) * 100)
    : 0;

  return (
    <Animated.View style={style}>
      <View style={[s.activePlanCard, { backgroundColor: theme.surface, borderColor: plan ? theme.borderEmerald : theme.border }]}>
        {/* Header row */}
        <View style={s.activePlanHeader}>
          <View style={[s.activePlanBadge, { backgroundColor: plan ? theme.glassEmerald : theme.surfaceElevated, borderColor: plan ? theme.borderEmerald : theme.border }]}>
            {plan && <View style={[s.activePlanDot, { backgroundColor: theme.emerald }]} />}
            <Text style={[s.activePlanBadgeTxt, { color: plan ? theme.emerald : theme.textMuted }]}>
              {language === 'tr' ? 'Aktif Planın' : 'Your Active Plan'}
            </Text>
          </View>
        </View>

        {plan ? (
          <>
            {/* Plan name */}
            <Text style={[s.activePlanName, { color: theme.text }]} numberOfLines={2}>
              {plan.name}
            </Text>

            {/* Date range */}
            {(plan.startDate || plan.endDate) && (
              <Text style={[s.activePlanDates, { color: theme.textSub }]}>
                {plan.startDate ? new Date(plan.startDate).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' }) : ''}
          {plan.startDate && plan.endDate ? ' → ' : ''}
                {plan.endDate ? new Date(plan.endDate).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' }) : ''}
              </Text>
            )}

            {/* Progress bar */}
            {plan.mealCount > 0 && (
              <View style={s.activePlanProgressBlock}>
                <View style={s.activePlanProgressHeader}>
                  <Text style={[s.activePlanProgressLabel, { color: theme.textMuted }]}>
                    {language === 'tr' ? `${plan.completedMeals}/${plan.mealCount} öğün` : `${plan.completedMeals}/${plan.mealCount} meals`}
                  </Text>
                  <Text style={[s.activePlanProgressPct, { color: theme.emerald }]}>{completionPct}%</Text>
                </View>
                <View style={[s.activePlanTrack, { backgroundColor: theme.borderLight }]}>
                  <View style={[s.activePlanFill, { width: `${completionPct}%`, backgroundColor: theme.emerald }]} />
                </View>
              </View>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={[s.activePlanCta, { backgroundColor: theme.primary }]}
              onPress={onPressPlans}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={14} color="#fff" />
              <Text style={s.activePlanCtaTxt}>
                {language === 'tr' ? 'Planı aç' : 'Open plan'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[s.activePlanEmptyTitle, { color: theme.text }]}>
              {language === 'tr' ? 'Henüz aktif planın yok' : 'No active plan yet'}
            </Text>
            <Text style={[s.activePlanEmptySubtitle, { color: theme.textMuted }]}>
              {language === 'tr'
                ? 'Diyetisyenin sana bir plan atadığında burada görünür.'
                : 'Your plan will appear here once your dietitian assigns one.'}
            </Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ Stats Shelf ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ */
function StatsShelf({ theme, compliancePercent, streak, water, waterBusy, language, index, onPressWater, onRemoveWater }: {
  theme: import('../theme/tokens').Theme;
  compliancePercent: number; streak: number; water: number; waterBusy: boolean; language: 'tr' | 'en'; index: number;
  onPressWater?: () => void;
  onRemoveWater?: () => void;
}) {
  const style = useStaggerItem(index, 300, 60);
  const { t } = useTranslation();
  return (
    <Animated.View style={[s.statsShelf, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <StatCell value={`${streak}`}            unit={t.dashboard.days} label={t.dashboard.streak}                           color={theme.accent}  iconName="flame-outline" />
      <View style={[s.statDivider, { backgroundColor: theme.borderLight }]} />
      <StatCell value={`${compliancePercent}`} unit="%"                label={language === 'tr' ? 'Uyum' : 'Adherence'}    color={theme.emerald} iconName="checkmark-circle-outline" />
      <View style={[s.statDivider, { backgroundColor: theme.borderLight }]} />
      <MiniGlass
        water={water}
        goal={WATER_GOAL}
        busy={waterBusy}
        theme={theme}
        language={language}
        label={language === 'tr' ? 'Su' : 'Water'}
        onAdd={onPressWater}
        onRemove={onRemoveWater}
      />
    </Animated.View>
  );
}

function MotivationShelf({
  theme,
  motivation,
  language,
  index,
  onPressBadgeVault,
  onHorizontalGestureStart,
  onHorizontalGestureEnd,
}: {
  theme: import('../theme/tokens').Theme;
  motivation?: DashboardMotivation;
  language: 'tr' | 'en';
  index: number;
  onPressBadgeVault: () => void;
  onHorizontalGestureStart?: () => void;
  onHorizontalGestureEnd?: () => void;
}) {
  const style = useStaggerItem(index, 300, 60);
  const floatStyle = useFloating(80, 4, 2600);
  const haloStyle = useHaloBreathe((motivation?.currentStreak ?? 0) > 0);
  const shimmerStyle = useShimmerBand(true);
  const summary = buildMotivationSummary(motivation, language);
  const allBadges = buildBadgeCollection(motivation, language);
  const badges = getHighlightAchievements(motivation, language, 4);
  const spotlight = getMotivationSpotlight(motivation, language);
  const [selectedBadge, setSelectedBadge] = useState<BadgeCollectionItem | null>(null);
  const totalBadgeCount = motivation?.totalBadgeCount ?? allBadges.length;
  const pantryBadge = allBadges.find((item) => item.id === 'pantry_ready');
  const lockedBadgeCount = Math.max(totalBadgeCount - (motivation?.earnedBadgeCount ?? 0), 0);
  const statTiles = [
    {
      key: 'streak',
      icon: 'flame-outline' as const,
      accent: theme.emerald,
      value: `${motivation?.currentStreak ?? 0}`,
      label: language === 'tr' ? 'aktif seri' : 'live streak',
    },
    {
      key: 'badges',
      icon: 'ribbon-outline' as const,
      accent: theme.accentGold,
      value: `${motivation?.earnedBadgeCount ?? 0}/${totalBadgeCount}`,
      label: language === 'tr' ? 'açık rozet' : 'live badges',
    },
    {
      key: 'pantry',
      icon: 'basket-outline' as const,
      accent: theme.accentCyan,
      value: pantryBadge ? pantryBadge.progressLabel : '0/8',
      label: language === 'tr' ? 'dolap görevi' : 'pantry quest',
    },
  ];

  return (
    <Animated.View style={style}>
      <View style={[s.motivationCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
        <ProduceBubble
          icon="leaf"
          iconSize={18}
          iconColor={`${theme.primary}32`}
          style={[s.motivationGlow, { backgroundColor: theme.primaryGlow }]}
        />
        <View style={s.motivationTopRow}>
          <View style={s.motivationTextWrap}>
            <Text style={[s.motivationEyebrow, { color: theme.emerald }]}>
            {language === 'tr' ? 'SERİ ALANI' : 'STREAK LANE'}
            </Text>
            <Text style={[s.motivationTitle, { color: theme.text }]}>{summary.title}</Text>
            <Text style={[s.motivationSubtitle, { color: theme.textSub }]}>{summary.subtitle}</Text>
          </View>
          <View style={s.streakBubbleWrap}>
            <Animated.View
              pointerEvents="none"
              style={[
                s.streakPulse,
                {
                  backgroundColor: `${theme.emerald}12`,
                  borderColor: `${theme.emerald}26`,
                },
                haloStyle,
              ]}
            />
            <Animated.View style={floatStyle}>
              <Pressable
                onPress={() => spotlight && setSelectedBadge(spotlight)}
                style={[s.streakBubble, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}
              >
                <Text style={[s.streakBubbleValue, { color: theme.emerald }]}>{motivation?.currentStreak ?? 0}</Text>
                <Text style={[s.streakBubbleLabel, { color: theme.textMuted }]}>
                  {language === 'tr' ? 'gün' : 'days'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </View>

        <View style={s.motivationMetaRow}>
          <View style={[s.footerPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Ionicons name="shield-checkmark-outline" size={12} color={theme.emerald} />
            <Text style={[s.footerPillText, { color: theme.textSub }]}>
              {language === 'tr'
                ? `${motivation?.earnedBadgeCount ?? 0}/${totalBadgeCount} rozet açık`
                : `${motivation?.earnedBadgeCount ?? 0}/${totalBadgeCount} badges live`}
            </Text>
          </View>
          <View style={[s.footerPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Ionicons
              name={motivation?.streakAtRisk ? 'alert-circle-outline' : 'sparkles-outline'}
              size={12}
              color={motivation?.streakAtRisk ? theme.accentCoral : theme.primary}
            />
            <Text style={[s.footerPillText, { color: theme.textSub }]}>
              {motivation?.streakAtRisk
                ? (language === 'tr' ? 'seri ilgi bekliyor' : 'streak needs attention')
                : motivation && motivation.nextMilestoneDays > 0
                  ? (language === 'tr'
                      ? `${motivation.nextMilestoneDays} gün sonra yeni rozet`
                      : `${motivation.nextMilestoneDays} days to next badge`)
                  : (language === 'tr' ? 'ana seri açık' : 'core streak live')}
            </Text>
          </View>
          <View style={[s.footerPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Ionicons name="finger-print-outline" size={12} color={theme.textMuted} />
            <Text style={[s.footerPillText, { color: theme.textSub }]}>
              {language === 'tr' ? 'Rozete dokun, kuralı gör' : 'tap a badge to inspect'}
            </Text>
          </View>
        </View>

        <View style={s.motivationStatsStrip}>
          {statTiles.map((tile) => (
            <View
              key={tile.key}
              style={[s.motivationStatTile, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            >
              <View style={[s.motivationStatIcon, { backgroundColor: `${tile.accent}16` }]}>
                <Ionicons name={tile.icon} size={14} color={tile.accent} />
              </View>
              <Text style={[s.motivationStatValue, { color: theme.text }]}>{tile.value}</Text>
              <Text style={[s.motivationStatLabel, { color: theme.textMuted }]}>{tile.label}</Text>
            </View>
          ))}
        </View>

        {spotlight ? (
          <Pressable
            onPress={() => setSelectedBadge(spotlight)}
            style={[
              s.motivationSpotlight,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: `${getToneColor(theme, spotlight.tone)}32`,
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                s.motivationSpotlightShimmer,
                { backgroundColor: `${getToneColor(theme, spotlight.tone)}18` },
                shimmerStyle,
              ]}
            />
            <View style={s.motivationSpotlightHeader}>
              <View>
                <Text style={[s.motivationSpotlightEyebrow, { color: theme.textMuted }]}>
                  {language === 'tr' ? 'ÖNE ÇIKAN' : 'SPOTLIGHT'}
                </Text>
                <Text style={[s.motivationSpotlightHeading, { color: theme.text }]}>
                  {spotlight.unlocked
                    ? (language === 'tr' ? 'Yeni açılan favori rozet' : 'Freshly unlocked favorite')
                    : (language === 'tr' ? 'Sıradaki rozet avın' : 'Your next badge hunt')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </View>

            <View style={s.motivationSpotlightBody}>
              <View
                style={[
                  s.motivationSpotlightSeal,
                  {
                    backgroundColor: `${getToneColor(theme, spotlight.tone)}14`,
                    borderColor: `${getToneColor(theme, spotlight.tone)}32`,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={spotlight.icon}
                  size={24}
                  color={getToneColor(theme, spotlight.tone)}
                />
              </View>
              <View style={s.motivationSpotlightText}>
                <Text style={[s.motivationSpotlightTitle, { color: theme.text }]}>{spotlight.title}</Text>
                <Text style={[s.motivationSpotlightCopy, { color: theme.textSub }]} numberOfLines={2}>
                  {spotlight.unlocked ? spotlight.earnedDetail : spotlight.hint}
                </Text>
                <View style={[s.badgeProgressTrack, { backgroundColor: theme.borderLight }]}>
                  <View
                    style={[
                      s.badgeProgressFill,
                      {
                        width: `${Math.max(8, Math.round(spotlight.ratio * 100))}%`,
                        backgroundColor: getToneColor(theme, spotlight.tone),
                      },
                    ]}
                  />
                </View>
                <Text style={[s.motivationSpotlightMeta, { color: theme.textMuted }]}>
                  {spotlight.progressLabel} | {spotlight.statusLabel}
                </Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.badgeRail}
          onTouchStart={onHorizontalGestureStart}
          onTouchEnd={onHorizontalGestureEnd}
          onTouchCancel={onHorizontalGestureEnd}
          onScrollBeginDrag={onHorizontalGestureStart}
          onScrollEndDrag={onHorizontalGestureEnd}
          onMomentumScrollEnd={onHorizontalGestureEnd}
        >
          {badges.map((badge) => {
            const accent = getToneColor(theme, badge.tone);
            return (
              <Pressable
                key={badge.id}
                onPress={() => setSelectedBadge(badge)}
                style={[
                  s.badgeCard,
                  {
                    backgroundColor: badge.unlocked ? `${accent}10` : theme.surfaceElevated,
                    borderColor: badge.unlocked ? `${accent}34` : theme.border,
                  },
                ]}
              >
                <View style={s.badgeCardTop}>
                  <View style={[s.badgeStatusPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[s.badgeStatusTxt, { color: badge.isRecentUnlock ? theme.accentGold : accent }]}>
                      {badge.isRecentUnlock ? (language === 'tr' ? 'YENİ' : 'NEW') : badge.statusLabel}
                    </Text>
                  </View>
                </View>
                <View style={[s.badgeSeal, { backgroundColor: `${accent}14`, borderColor: `${accent}30` }]}>
                  <View style={[s.badgeCore, { backgroundColor: theme.surface }]}>
                    <MaterialCommunityIcons name={badge.icon} size={22} color={accent} />
                  </View>
                  {badge.unlocked && (
                    <View style={[s.badgeCheck, { backgroundColor: accent }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[s.badgeTitle, { color: theme.text }]} numberOfLines={2}>
                  {badge.title}
                </Text>
                <Text style={[s.badgeSubtitle, { color: theme.textMuted }]} numberOfLines={3}>
                  {badge.unlocked ? badge.flavor : badge.hint}
                </Text>
                <View style={[s.badgeProgressTrack, { backgroundColor: theme.borderLight }]}>
                  <View
                    style={[
                      s.badgeProgressFill,
                      { width: `${Math.max(8, Math.round(badge.ratio * 100))}%`, backgroundColor: accent },
                    ]}
                  />
                </View>
                <View style={s.badgeFooter}>
                  <Text style={[s.badgeFooterText, { color: theme.textSub }]}>{badge.progressLabel}</Text>
                  <Text style={[s.badgeFooterText, { color: accent }]}>
                    {language === 'tr' ? 'incele' : 'inspect'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.motivationFooter}>
          <View style={[s.footerPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Ionicons name="trophy-outline" size={12} color={theme.accentGold} />
            <Text style={[s.footerPillText, { color: theme.textSub }]}>
              {language === 'tr'
                ? `${motivation?.earnedBadgeCount ?? 0} rozet açık`
                : `${motivation?.earnedBadgeCount ?? 0} badges live`}
            </Text>
          </View>
          <View style={[s.footerPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={12} color={theme.accentCyan} />
            <Text style={[s.footerPillText, { color: theme.textSub }]}>
              {language === 'tr'
                ? `${lockedBadgeCount} rozet sırada`
                : `${lockedBadgeCount} badges waiting`}
            </Text>
          </View>
          <View style={[s.footerPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Ionicons name="sparkles-outline" size={12} color={theme.primary} />
            <Text style={[s.footerPillText, { color: theme.textSub }]}>
              {motivation && motivation.nextMilestoneDays > 0
                ? (language === 'tr'
                    ? `sonraki seri: ${motivation.nextMilestoneDays} gün`
                    : `next streak: ${motivation.nextMilestoneDays} days`)
                : (language === 'tr' ? 'ana seri açık' : 'core streak live')}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.motivationCTA, { backgroundColor: theme.primary, shadowColor: theme.primaryGlow }]}
            onPress={onPressBadgeVault}
            activeOpacity={0.86}
          >
            <Ionicons name="apps-outline" size={13} color="#fff" />
            <Text style={s.motivationCTAText}>
              {language === 'tr' ? 'Daha fazlası | tüm rozetler' : 'show more | all badges'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <BadgeDetailSheet
        visible={Boolean(selectedBadge)}
        badge={selectedBadge}
        theme={theme}
        language={language}
        onClose={() => setSelectedBadge(null)}
      />
    </Animated.View>
  );
}

function StatCell({ value, unit, label, color, iconName }: {
  value: string; unit: string; label: string; color: string; iconName: any;
}) {
  const { theme } = useTheme();
  return (
    <View style={s.statCell}>
      <Ionicons name={iconName} size={16} color={color} style={{ marginBottom: 4 }} />
      <Text style={[s.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[s.statUnit, { color }]}>{unit}</Text>
      <Text style={[s.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ Mini Glass ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ */
const MG_W = 48;
const MG_H = 62;

function MiniGlass({ water, goal, busy, theme, language, label, onAdd, onRemove }: {
  water: number; goal: number;
  busy: boolean;
  theme: import('../theme/tokens').Theme;
  language: 'tr' | 'en';
  label: string;
  onAdd?: () => void;
  onRemove?: () => void;
}) {
  const color = theme.accentCyan;
  const done  = water >= goal;
  const overGoal = Math.max(0, water - goal);
  const pct   = Math.min(1, water / goal);
  const litersText = `${((water * WATER_GLASS_ML) / 1000).toFixed(1)}L`;
  const statusText = overGoal > 0
    ? (language === 'tr' ? `+${overGoal} taşma` : `+${overGoal} spill`)
    : litersText;

  const fillH      = useSharedValue(pct * MG_H);
  const glassScale = useSharedValue(1);
  const waveX      = useSharedValue(0);
  // 2 damla ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â‚¬Å¡Ã‚¬Ãƒ¢Ã¢â€š¬Ã‚ her taÃƒÆ’Ã¢â‚¬¦Ãƒâ€¦Ã‚¸ma anÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±nda yeniden tetiklenir
  const d1Y = useSharedValue(0); const d1O = useSharedValue(0);
  const d2Y = useSharedValue(0); const d2O = useSharedValue(0);

  // Su seviyesi deÃƒÆ’Ã¢â‚¬Ãƒâ€¦Ã‚¸iÃƒÆ’Ã¢â‚¬¦Ãƒâ€¦Ã‚¸tikÃƒÆ’Ã†'Ãƒâ€šÃ‚§e dolum animasyonu
  useEffect(() => {
    fillH.value = withSpring(pct * MG_H, { damping: 20, stiffness: 90 });
  }, [pct]);

  // SÃƒÆ’Ã†'Ãƒâ€šÃ‚¼rekli dalga
  useEffect(() => {
    waveX.value = withRepeat(
      withSequence(withTiming(4, { duration: 1300 }), withTiming(-4, { duration: 1300 })),
      -1, true,
    );
  }, []);

  // Her taÃƒÆ’Ã¢â‚¬¦Ãƒâ€¦Ã‚¸ma basÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±ÃƒÆ’Ã¢â‚¬¦Ãƒâ€¦Ã‚¸ÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±nda ÃƒÆ’Ã†'Ãƒâ€šÃ‚§aÃƒÆ’Ã¢â‚¬Ãƒâ€¦Ã‚¸rÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±lÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±r
  function triggerSpill() {
    runOnUI(() => {
      'worklet';
      cancelAnimation(d1Y); cancelAnimation(d1O);
      cancelAnimation(d2Y); cancelAnimation(d2O);
      // Damla 1 ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â‚¬Å¡Ã‚¬Ãƒ¢Ã¢â€š¬Ã‚ sol kenar
      d1Y.value = 0; d1O.value = 0;
      d1O.value = withSequence(
        withTiming(1, { duration: 50 }),
        withDelay(320, withTiming(0, { duration: 340 })),
      );
      d1Y.value = withTiming(46, { duration: 710 });
      // Damla 2 ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â‚¬Å¡Ã‚¬Ãƒ¢Ã¢â€š¬Ã‚ saÃƒÆ’Ã¢â‚¬Ãƒâ€¦Ã‚¸ kenar, biraz gecikmeli
      d2Y.value = 0; d2O.value = 0;
      d2O.value = withDelay(140, withSequence(
        withTiming(1, { duration: 50 }),
        withDelay(310, withTiming(0, { duration: 320 })),
      ));
      d2Y.value = withDelay(140, withTiming(52, { duration: 750 }));
    })();
  }

  const fillStyle  = useAnimatedStyle(() => ({ height: fillH.value }));
  const waveStyle  = useAnimatedStyle(() => ({ transform: [{ translateX: waveX.value }] }));
  const glassStyle = useAnimatedStyle(() => ({ transform: [{ scale: glassScale.value }] }));
  const d1Style    = useAnimatedStyle(() => ({ transform: [{ translateY: d1Y.value }], opacity: d1O.value }));
  const d2Style    = useAnimatedStyle(() => ({ transform: [{ translateY: d2Y.value }], opacity: d2O.value }));

  function handlePress() {
    if (busy) return;
    if (done) {
      // Dolu ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â‚¬Å¡Ã‚¬Ãƒ¢Ã¢â€š¬Ã‚ artÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±rmaz ama her basÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±ÃƒÆ’Ã¢â‚¬¦Ãƒâ€¦Ã‚¸ta taÃƒÆ’Ã¢â‚¬¦Ãƒâ€¦Ã‚¸ma gÃƒÆ’Ã†'Ãƒâ€šÃ‚¶ster
      triggerSpill();
    }
    runOnUI(() => {
      'worklet';
      cancelAnimation(glassScale);
      glassScale.value = withSequence(
        withSpring(0.86, { damping: 4, stiffness: 800 }),
        withSpring(1.08, { damping: 8, stiffness: 300 }),
        withSpring(1,    { damping: 15, stiffness: 200 }),
      );
    })();
    onAdd?.();
  }

  function handleLongPress() {
    if (busy || water === 0) return;
    runOnUI(() => {
      'worklet';
      cancelAnimation(glassScale);
      glassScale.value = withSequence(
        withSpring(0.94, { damping: 8, stiffness: 500 }),
        withSpring(1,    { damping: 14, stiffness: 250 }),
      );
    })();
    onRemove?.();
  }

  return (
    <View style={mg.container}>
      {/* TaÃƒÆ’Ã¢â‚¬¦Ãƒâ€¦Ã‚¸ma damlalarÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚± ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â‚¬Å¡Ã‚¬Ãƒ¢Ã¢â€š¬Ã‚ bardak aÃƒÆ’Ã¢â‚¬Ãƒâ€¦Ã‚¸zÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±ndan aÃƒÆ’Ã¢â‚¬¦Ãƒâ€¦Ã‚¸aÃƒÆ’Ã¢â‚¬Ãƒâ€¦Ã‚¸ÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚± dÃƒÆ’Ã†'Ãƒâ€šÃ‚¼ÃƒÆ’Ã¢â‚¬¦Ãƒâ€¦Ã‚¸er */}
      <View style={mg.spillZone} pointerEvents="none">
        <Animated.View style={[mg.drop, mg.dropLeft, d1Style]}>
          <View style={[mg.dropDot, { backgroundColor: color }]} />
        </Animated.View>
        <Animated.View style={[mg.drop, mg.dropRight, d2Style]}>
          <View style={[mg.dropDot, { backgroundColor: color, width: 5, height: 6 }]} />
        </Animated.View>
      </View>

      {/* Bardak */}
      <Animated.View style={glassStyle}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={500}
          disabled={busy}
          android_ripple={null}
        >
          <View style={mg.glassFrame}>
            <View style={[mg.glassRim, { backgroundColor: `${color}34` }]} />
            <View style={[mg.glass, {
            borderColor: done ? color : `${color}50`,
            backgroundColor: theme.bg,
          }]}>
            {/* Su dolumu ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â‚¬Å¡Ã‚¬Ãƒ¢Ã¢â€š¬Ã‚ alttan yukarÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚± */}
            <View style={[mg.glassShine, { backgroundColor: `${theme.surface}A8` }]} />
            <Animated.View style={[mg.fill, { backgroundColor: `${color}25` }, fillStyle]}>
              {/* Dalga yÃƒÆ’Ã†'Ãƒâ€šÃ‚¼zeyi */}
              <Animated.View style={[mg.wave, { backgroundColor: done ? color : `${color}88` }, waveStyle]} />
            </Animated.View>
            {/* Doluluk parÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±ltÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±sÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚± ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â‚¬Å¡Ã‚¬Ãƒ¢Ã¢â€š¬Ã‚ saÃƒÆ’Ã¢â‚¬Ãƒâ€¦Ã‚¸ ÃƒÆ’Ã†'Ãƒâ€šÃ‚¼st kÃƒÆ’Ã†'Ãƒâ€šÃ‚¶ÃƒÆ’Ã¢â‚¬¦Ãƒâ€¦Ã‚¸e */}
            {done && (
              <View style={[mg.fullGlow, { backgroundColor: `${color}20` }]} />
            )}
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* Bardak sayÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚±sÃƒÆ’Ã¢â‚¬Ãƒâ€šÃ‚± rozeti */}
      <View style={[mg.badge, {
        backgroundColor: done ? color : `${color}18`,
        borderColor: done ? `${color}80` : `${color}40`,
      }]}>
        <Text style={[mg.badgeTxt, { color: done ? '#fff' : color }]}>{water}</Text>
      </View>

      {/* Alt etiket */}
      <Text style={[mg.label, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[mg.meta, { color: overGoal > 0 ? color : theme.textSub }]}>{statusText}</Text>
    </View>
  );
}

const mg = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 16, paddingBottom: 2, position: 'relative' },

  spillZone: { position: 'absolute', top: 16, left: 0, right: 0, height: 70, zIndex: 10 },
  drop:      { position: 'absolute', top: 0, alignItems: 'center' },
  dropLeft:  { left: '18%' },
  dropRight: { right: '18%' },
  dropDot:   { width: 4, height: 5, borderRadius: 3 },

  glassFrame: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  glassRim: {
    width: MG_W + 10,
    height: 5,
    borderRadius: 999,
    marginBottom: -2,
    opacity: 0.9,
  },
  glass: {
    width: MG_W,
    height: MG_H,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
    overflow: 'hidden',
  },
  glassShine: {
    position: 'absolute',
    top: 9,
    right: 7,
    width: 7,
    height: 24,
    borderRadius: 999,
    opacity: 0.45,
  },
  fill:     { position: 'absolute', bottom: 0, left: 0, right: 0 },
  wave:     { position: 'absolute', top: 0, left: -8, right: -8, height: 2.5, borderRadius: 1.5 },
  fullGlow: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },

  badge: {
    position: 'absolute',
    top: 12,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    zIndex: 20,
  },
  badgeTxt: { fontSize: 8.5, fontWeight: '900' },
  label:    { fontSize: 9.5, fontWeight: '600', marginTop: 5 },
  meta:     { fontSize: 8.5, fontWeight: '700', marginTop: 1 },
});

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ Next Meal Card ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ */
function NextMealCard({ theme, meal, onPressPlans, index }: {
  theme: import('../theme/tokens').Theme;
  meal: any;
  onPressPlans?: () => void;
  index: number;
}) {
  const style = useStaggerItem(index, 300, 60);
  const { t } = useTranslation();
  const mealTitle = meal.title ?? meal.customName ?? t.dashboard.nextMeal;
  const mealTime  = meal.time  ?? '';

  return (
    <Animated.View style={style}>
      <View style={[s.nextMealCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
        <ProduceBubble
          icon="corn"
          iconSize={18}
          iconColor={`${theme.emerald}34`}
          style={[s.nextMealGlow, { backgroundColor: theme.emeraldGlow }]}
        />

        <View style={s.nextMealHeader}>
          <View style={[s.nextMealBadge, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
            <View style={[s.nextMealDot, { backgroundColor: theme.emerald }]} />
            <Text style={[s.nextMealBadgeTxt, { color: theme.emerald }]}>{t.dashboard.nextMeal}</Text>
          </View>
          {!!mealTime && (
            <Text style={[s.nextMealTime, { color: theme.primary }]}>{mealTime}</Text>
          )}
        </View>

        <Text style={[s.nextMealTitle, { color: theme.text }]} numberOfLines={2}>
          {mealTitle}
        </Text>

        <TouchableOpacity
          style={[s.nextMealCta, { backgroundColor: theme.primary, shadowColor: theme.primaryGlow }]}
          onPress={onPressPlans ?? noop}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={13} color="#fff" />
          <Text style={s.nextMealCtaTxt}>{t.dashboard.viewPlan}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function CoachTaskCard({
  theme,
  task,
  onPressTask,
  index,
}: {
  theme: import('../theme/tokens').Theme;
  task: DashboardCoachTask;
  onPressTask?: () => void;
  index: number;
}) {
  const style = useStaggerItem(index, 300, 60);
  const { language } = useTranslation();

  return (
    <Animated.View style={style}>
      <View style={[s.noteCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
        <View style={s.notePinRow}>
          <View style={[s.notePinDot, { backgroundColor: theme.emerald }]} />
          <Text style={[s.notePinLabel, { color: theme.primary }]}>
            {language === 'tr' ? 'Mini görev' : 'Mini task'}
          </Text>
          <Ionicons name="flash-outline" size={11} color={theme.primary} />
        </View>

        <Text style={[s.noteTaskTitle, { color: theme.text }]}>{task.title}</Text>
        <Text style={[s.noteText, { color: theme.textSub }]} numberOfLines={3}>{task.body}</Text>

        <TouchableOpacity
          style={[s.taskCta, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}
          onPress={onPressTask}
          activeOpacity={0.82}
        >
          <Text style={[s.taskCtaText, { color: theme.primary }]}>{task.cta}</Text>
          <Ionicons name="arrow-forward" size={12} color={theme.primary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ Dietitian Note Card ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ */
function DietitianNoteCard({ theme, note, onPressMessages, index }: {
  theme: import('../theme/tokens').Theme;
  note: string;
  onPressMessages?: () => void;
  index: number;
}) {
  const style = useStaggerItem(index, 300, 60);
  const { t } = useTranslation();
  return (
    <Animated.View style={style}>
      <View style={[s.noteCard, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
        <View style={s.notePinRow}>
          <View style={[s.notePinDot, { backgroundColor: theme.emerald }]} />
          <Text style={[s.notePinLabel, { color: theme.primary }]}>{t.dashboard.dietitianNote}</Text>
          <Ionicons name="pin-outline" size={11} color={theme.primary} />
        </View>
        <Text style={[s.noteText, { color: theme.textSub }]} numberOfLines={3}>{note}</Text>
        <TouchableOpacity
          style={s.noteCtaRow}
          onPress={onPressMessages ?? noop}
          activeOpacity={0.7}
        >
          <Text style={[s.noteCtaTxt, { color: theme.primary }]}>Tüm Notlarım</Text>
          <Ionicons name="arrow-forward" size={12} color={theme.primary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ Latest Measurements Card ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ */
function LatestMeasurementsCard({ theme, onPressMeasurements, index }: {
  theme: import('../theme/tokens').Theme;
  onPressMeasurements: () => void;
  index: number;
}) {
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [fetching, setFetching]       = useState(true);
  const style = useStaggerItem(index, 300, 60);

  useEffect(() => {
    api.get<{ measurements: Measurement[] }>('/api/client/measurements')
      .then(res => setMeasurement(res.data?.measurements?.[0] ?? null))
      .catch(() => setMeasurement(null))
      .finally(() => setFetching(false));
  }, []);

  const hasData = !!measurement && (measurement.waistCm || measurement.hipCm || measurement.chestCm);

  return (
    <Animated.View style={style}>
      <View style={[s.measCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={s.measHeader}>
          <View style={[s.measIconWrap, { backgroundColor: `${theme.accentGold}20` }]}>
            <Ionicons name="body-outline" size={16} color={theme.accentGold} />
          </View>
          <Text style={[s.measTitle, { color: theme.text }]}>Son Ölçümler</Text>
          {fetching && (
            <ActivityIndicator size="small" color={theme.primary} style={s.measSpinner} />
          )}
        </View>

        {!fetching && hasData && measurement ? (
          <>
            <View style={s.measRow}>
              {!!measurement.waistCm && (
                <MeasCell label="Bel"   value={`${measurement.waistCm}`} unit="cm" color={theme.accentGold} />
              )}
              {!!measurement.hipCm && (
                <MeasCell label="Kalça" value={`${measurement.hipCm}`}   unit="cm" color={theme.accentCyan} />
              )}
              {!!measurement.chestCm && (
                <MeasCell label="Göğüs" value={`${measurement.chestCm}`} unit="cm" color={theme.accent} />
              )}
            </View>
            <TouchableOpacity style={s.measCtaRow} onPress={onPressMeasurements} activeOpacity={0.7}>
              <Text style={[s.measCtaTxt, { color: theme.primary }]}>Ölçümlerim</Text>
              <Ionicons name="arrow-forward" size={12} color={theme.primary} />
            </TouchableOpacity>
          </>
        ) : !fetching ? (
          <View style={s.measEmpty}>
            <Text style={[s.measEmptyTxt, { color: theme.textMuted }]}>
              Henüz ölçüm kaydedilmedi
            </Text>
            <TouchableOpacity
              style={[s.measEmptyBtn, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}
              onPress={onPressMeasurements}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={13} color={theme.emerald} />
              <Text style={[s.measEmptyBtnTxt, { color: theme.emerald }]}>Ölçüm Ekle</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function MeasCell({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={s.measCell}>
      <Text style={[s.measValue, { color: theme.text }]}>{value}</Text>
      <Text style={[s.measUnit, { color }]}>{unit}</Text>
      <Text style={[s.measLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ Kitchen Entry Card ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚Ãƒ¢Ã¢â‚¬Å¡Ã‚¬ */
function KitchenEntryCard({ theme, onPress, index }: {
  theme: import('../theme/tokens').Theme;
  onPress?: () => void;
  index: number;
}) {
  const style       = useStaggerItem(index, 300, 60);
  const floatStyle  = useFloating(0);
  const shimStyle   = useShimmerBand(true);
  return (
    <Animated.View style={style}>
      <TouchableOpacity
        style={[s.kitchenCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderEmerald }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Shimmer band over card */}
        <Animated.View style={[s.kitchenShimmer, shimStyle]} pointerEvents="none" />

        <View style={s.kitchenCardLeft}>
          <Animated.View style={[s.kitchenOrb, { backgroundColor: theme.primaryLight }, floatStyle]}>
            <Ionicons name="restaurant" size={22} color={theme.primary} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={[s.kitchenCardTitle, { color: theme.text }]}>Mutfak Asistanı</Text>
            <Text style={[s.kitchenCardSub, { color: theme.textMuted }]}>
              Malzemelerinden tarif önerir
            </Text>
          </View>
        </View>
        <View style={[s.kitchenArrow, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
          <Ionicons name="arrow-forward" size={14} color={theme.emerald} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚
   FREE GRID
ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ */
function PantryEntryCard({ theme, onPress, index }: {
  theme: import('../theme/tokens').Theme;
  onPress?: () => void;
  index: number;
}) {
  const style = useStaggerItem(index, 300, 60);
  const floatStyle = useFloating(40, 3, 2400);
  return (
    <Animated.View style={style}>
      <TouchableOpacity
        style={[s.kitchenCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View style={s.kitchenCardLeft}>
          <Animated.View style={[s.kitchenOrb, { backgroundColor: `${theme.emerald}14` }, floatStyle]}>
            <Ionicons name="basket-outline" size={21} color={theme.emerald} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={[s.kitchenCardTitle, { color: theme.text }]}>Dolabım</Text>
            <Text style={[s.kitchenCardSub, { color: theme.textMuted }]}>
              Evdeki malzemeleri düzenle ve hazır tut
            </Text>
          </View>
        </View>
        <View style={[s.kitchenArrow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Ionicons name="arrow-forward" size={14} color={theme.emerald} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function FreeGrid({ theme, publicUserId, onPressActivate, onPressKitchen, onPressMeasurements, onPressPantry }: {
  theme: import('../theme/tokens').Theme;
  publicUserId?: string;
  onPressActivate: () => void;
  onPressKitchen?: () => void;
  onPressMeasurements: () => void;
  onPressPantry: () => void;
}) {
  const s0 = useStaggerItem(0, 300, 70);
  const s1 = useStaggerItem(1, 300, 70);
  const s2 = useStaggerItem(2, 300, 70);
  const s3 = useStaggerItem(3, 300, 70);
  const { t } = useTranslation();

  function handleCopyId() {
    if (publicUserId) {
      Clipboard.setStringAsync(publicUserId).then(() => {
        Alert.alert(t.common.copied, `${t.dashboard.userId}:\n${publicUserId}`);
      });
    }
  }

  return (
    <View style={s.grid}>

      {/* User ID card ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â‚¬Å¡Ã‚¬Ãƒ¢Ã¢â€š¬Ã‚ share with dietitian */}
      {!!publicUserId && (
        <Animated.View style={s0}>
          <View style={[s.idCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ProduceBubble
              icon="food-apple-outline"
              iconSize={18}
              iconColor={`${theme.primary}30`}
              style={[s.idGlow, { backgroundColor: theme.primaryGlow }]}
            />
            <View style={s.idHeader}>
              <View style={[s.idIconWrap, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name="finger-print-outline" size={16} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.idLabel, { color: theme.text }]}>Kullanıcı ID</Text>
                <Text style={[s.idHint, { color: theme.textMuted }]}>
                  Bu kodu diyetisyeninize verin
                </Text>
              </View>
            </View>
            <View style={[s.idValueRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
              <Text style={[s.idValue, { color: theme.primary }]} numberOfLines={1} selectable>
                {publicUserId}
              </Text>
              <TouchableOpacity
                style={[s.idCopyBtn, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}
                onPress={handleCopyId}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={14} color={theme.emerald} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Premium upsell */}
      <Animated.View style={s1}>
        <TouchableOpacity
          style={[s.upsellShelf, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}
          onPress={onPressActivate}
          activeOpacity={0.85}
        >
          <View style={[s.upsellIconRing, { borderColor: theme.borderEmerald, backgroundColor: theme.glassEmerald }]}>
            <Ionicons name="key" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.upsellTitle, { color: theme.text }]}>Premium'a Yükselt</Text>
            <Text style={[s.upsellSub, { color: theme.textMuted }]}>
              Diyetisyeninle bağlan, kişisel plan al
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Measurements */}
      <Animated.View style={s2}>
        <TouchableOpacity
          style={[s.freeTile, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={onPressMeasurements}
          activeOpacity={0.8}
        >
          <View style={[s.freeTileIcon, { backgroundColor: `${theme.accentGold}20` }]}>
            <Ionicons name="body-outline" size={18} color={theme.accentGold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.freeTileTitle, { color: theme.text }]}>Ölçümlerim</Text>
            <Text style={[s.freeTileSub, { color: theme.textMuted }]}>Bel, kalça, göğüs takibi</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      </Animated.View>

      {/* Kitchen */}
      <Animated.View style={s3}>
        <KitchenEntryCard theme={theme} onPress={onPressKitchen} index={0} />
        <PantryEntryCard theme={theme} onPress={onPressPantry} index={1} />
      </Animated.View>
    </View>
  );
}

/* ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚
   STYLES
ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ÃƒÆ’Ã‚¢Ãƒ¢Ã¢â€š¬Ã‚¢Ãƒâ€šÃ‚ */
const s = StyleSheet.create({
  root:        { flex: 1 },
  produceBubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.98,
    shadowColor: '#2f9e63',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  scroll:      { paddingTop: 62, paddingHorizontal: spacing.base },
  loadingWrap: { paddingTop: 8, gap: spacing.sm },
  loadingCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 16,
    minHeight: 148,
  },
  loadingBrandPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginBottom: 14,
  },
  loadingBrandText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  loadingBarLg: {
    width: '56%',
    height: 18,
    borderRadius: 9,
    marginBottom: 10,
  },
  loadingBarMd: {
    width: '84%',
    height: 12,
    borderRadius: 6,
    marginBottom: 18,
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  loadingPill: {
    flex: 1,
    height: 62,
    borderRadius: radii.lg,
  },
  loadingGridRow: {
    flexDirection: 'row',
  },
  loadingPanel: {
    flex: 1,
    minHeight: 154,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  bottomPad:   { height: 180 },
  screenGlowA: {
    position: 'absolute',
    top: 18,
    right: -58,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.72,
  },
  dayBand: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#0F3D2E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  dayBandBlobA: {
    position: 'absolute',
    top: -38,
    right: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
    opacity: 0.9,
  },
  dayBandBlobB: {
    position: 'absolute',
    bottom: -34,
    left: -18,
    width: 86,
    height: 86,
    borderRadius: 43,
    opacity: 0.75,
  },
  dayBandTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 10,
  },
  dayBandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dayBandChipText: { fontSize: 11, fontWeight: '800' },
  dayBandMini: {
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dayBandMiniText: { fontSize: 10, fontWeight: '800' },
  dayBandTitle: {
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 28,
    marginBottom: 4,
    maxWidth: 280,
  },
  dayBandSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    maxWidth: 310,
    opacity: 0.88,
  },

  /* Hero Capsule */
  heroCapsule: {
    borderRadius: 28, borderWidth: 1, padding: 18, marginBottom: spacing.sm,
    overflow: 'hidden', shadowColor: '#0F3D2E',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 18, elevation: 7,
  },
  heroHaloRing: { borderRadius: radii.xxl, borderWidth: 1.5 },
  heroGlowTR: { position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: 80, opacity: 0.20 },
  heroGlowBL: { position: 'absolute', bottom: -30, left: -40, width: 120, height: 120, borderRadius: 60, opacity: 0.12 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heroClinicRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  heroClinicDot: { width: 6, height: 6, borderRadius: 3 },
  heroClinicName: { fontSize: 12, fontWeight: '600', flex: 1 },
  heroBadgeFree: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  heroBadgeFreeText: { fontSize: 10, fontWeight: '700' },
  heroStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  heroStatusDot:   { width: 5, height: 5, borderRadius: 2.5 },
  heroStatusLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  heroGreetingBlock: { marginBottom: 14 },
  heroGreeting:      { fontSize: 12, fontWeight: '500', marginBottom: 3 },
  heroName:          { fontSize: 27, fontWeight: '900', letterSpacing: -0.6, lineHeight: 32 },
  heroProgressBlock:  { marginBottom: 10 },
  heroProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  heroProgressLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  heroProgressPct:    { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  heroTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  heroFill: {
    height: '100%', borderRadius: 3,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.65, shadowRadius: 5, elevation: 3,
  },
  heroActivateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13, borderRadius: radii.lg, marginTop: 6,
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.30, shadowRadius: 12, elevation: 6,
  },
  heroActivateTxt: { color: '#FFF', fontSize: 13, fontWeight: '800' },

  /* Smart Actions Rail */
  actionsRail: { flexDirection: 'row', flexWrap: 'wrap', gap: ACTION_RAIL_GAP, marginBottom: spacing.sm },
  actionChipSlot: { flexShrink: 0 },
  actionChip: {
    alignItems: 'center', borderRadius: 22, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 6, gap: 6,
    minHeight: 88,
  },
  actionIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center', width: '100%' },

  /* Favorites Pocket */
  favoritePocket: {
    borderRadius: 28,
    borderWidth: 1.2,
    padding: 15,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    gap: 11,
    shadowColor: '#0F3D2E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  favoritePocketGlow: {
    position: 'absolute',
    top: -28,
    right: -16,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  favoritePocketTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  favoritePocketEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  favoritePocketTitle: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    maxWidth: 245,
  },
  favoritePocketBadge: {
    minWidth: 56,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  favoritePocketBadgeValue: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  favoritePocketBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  favoritePocketBody: {
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 520,
  },
  favoritePocketMetrics: {
    flexDirection: 'row',
    gap: 9,
  },
  favoritePocketMetricCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 10,
    gap: 5,
  },
  favoritePocketMetricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  favoritePocketMetricValue: {
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 26,
  },
  favoritePocketMetricSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  favoritePocketRecentList: {
    gap: 4,
    minHeight: 34,
  },
  favoritePocketRecentItem: {
    fontSize: 12,
    fontWeight: '700',
  },
  favoritePocketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  favoritePocketFooterText: {
    fontSize: 13,
    fontWeight: '800',
  },

  /* Continue Card */
  continueCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 15,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#0F3D2E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  continueAccent: {
    position: 'absolute',
    top: -22,
    right: -18,
    width: 96,
    height: 96,
    borderRadius: 48,
    opacity: 0.9,
  },
  continueTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  continueEyebrowPill: {
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  continueEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  continueIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.3,
    marginBottom: 6,
    maxWidth: 280,
  },
  continueBody: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
    maxWidth: 300,
  },
  continueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  continueCTA: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  continueCTAChip: {
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  continueCTAChipText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  todayPulseCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 15,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#0F3D2E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  todayPulseHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'flex-start' },
  todayPulseEyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 },
  todayPulseTitle: { fontSize: 15.5, fontWeight: '900', lineHeight: 20, marginTop: 4 },
  todayPulseMeta: { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  todayPulseMetaTxt: { fontSize: 10, fontWeight: '800' },
  todayPulseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: TODAY_PULSE_GAP,
    marginTop: 6,
  },
  todayPulseTile: { width: '48.4%', flexGrow: 0, flexShrink: 0, minHeight: 116, borderRadius: 20, borderWidth: 1, padding: 11 },
  todayPulseIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  todayPulseValue: { fontSize: 15, fontWeight: '900', marginBottom: 1 },
  todayPulseTileTitle: { fontSize: 11.5, fontWeight: '800', marginBottom: 4 },
  todayPulseTileBody: { fontSize: 10, lineHeight: 14.5, fontWeight: '500' },
  rescueCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 15,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#0F3D2E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  rescueAccent: {
    position: 'absolute',
    top: -26,
    right: -18,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  rescueHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rescueIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescueEyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8, marginBottom: 3 },
  rescueTitle: { fontSize: 16, fontWeight: '900', lineHeight: 21 },
  rescueProgress: { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  rescueProgressTxt: { fontSize: 11, fontWeight: '800' },
  rescueBody: { fontSize: 12.5, lineHeight: 18, marginTop: 12, marginBottom: 12, paddingRight: 18 },
  rescueFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rescueCTA: { fontSize: 12.5, fontWeight: '900' },

  /* Grid */
  grid: { gap: spacing.sm },

  plateScanCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    shadowColor: '#0F3D2E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  plateScanIcon: {
    width: 56,
    height: 56,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateScanEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.9, marginBottom: 3 },
  plateScanTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  plateScanBody: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 4 },
  plateScanStats: { flexDirection: 'row', gap: 7, marginTop: 10 },
  plateScanStat: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', gap: 5, alignItems: 'baseline' },
  plateScanStatValue: { fontSize: 13, fontWeight: '900' },
  plateScanStatLabel: { fontSize: 10, fontWeight: '800' },
  plateScanArrow: { width: 44, height: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  dailyGamesCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 15,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#0F3D2E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  dailyGamesGlow: {
    position: 'absolute',
    top: -28,
    right: -18,
    width: 118,
    height: 118,
    borderRadius: 59,
  },
  dailyGamesTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dailyGamesIcon: {
    width: 48,
    height: 48,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyGamesEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.9, marginBottom: 3 },
  dailyGamesTitle: { fontSize: 17, fontWeight: '900', lineHeight: 21, letterSpacing: -0.2 },
  dailyGamesBody: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 4 },
  dailyGamesScore: {
    minWidth: 58,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dailyGamesScoreValue: { fontSize: 18, fontWeight: '900' },
  dailyGamesScoreLabel: { fontSize: 10, fontWeight: '700' },
  dailyGamesTrack: { height: 7, borderRadius: radii.full, overflow: 'hidden', marginTop: 13 },
  dailyGamesFill: { height: '100%', borderRadius: radii.full },
  dailyGamesPills: { flexDirection: 'row', gap: 7, marginTop: 11 },
  dailyGamesPill: {
    flex: 1,
    minHeight: 34,
    borderRadius: radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  dailyGamesPillText: { fontSize: 10, fontWeight: '900' },

  /* Stats Shelf */
  statsShelf: {
    flexDirection: 'row', borderRadius: 26, borderWidth: 1,
    paddingVertical: 16, marginBottom: spacing.sm,
    shadowColor: '#0F3D2E', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 5,
  },
  statCell:    { flex: 1, alignItems: 'center', paddingVertical: 2 },
  statDivider: { width: 1, marginVertical: 8 },
  waterCell:   { flex: 1, alignItems: 'center', position: 'relative' },
  waterPlus:   { position: 'absolute', top: -2, right: 8, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue:   { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, lineHeight: 26 },
  statUnit:    { fontSize: 9,  fontWeight: '800', marginTop: 1 },
  statLabel:   { fontSize: 9.5, fontWeight: '600', marginTop: 4 },

  /* Motivation Card */
  motivationCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 15,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#0F3D2E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  motivationGlow: {
    position: 'absolute',
    top: -42,
    right: -34,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.18,
  },
  motivationTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 14,
  },
  motivationTextWrap: { flex: 1, paddingRight: 6 },
  motivationEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  motivationTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    letterSpacing: -0.4,
    marginBottom: 4,
    maxWidth: 220,
  },
  motivationSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 230,
  },
  motivationMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  motivationStatsStrip: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  motivationStatTile: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motivationStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  motivationStatValue: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 2,
  },
  motivationStatLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  streakBubbleWrap: {
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakPulse: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
  },
  streakBubble: {
    minWidth: 68,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  streakBubbleValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  streakBubbleLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  motivationSpotlight: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
    marginBottom: 14,
  },
  motivationSpotlightShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 84,
    opacity: 0.24,
  },
  motivationSpotlightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  motivationSpotlightEyebrow: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  motivationSpotlightHeading: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  motivationSpotlightBody: {
    flexDirection: 'row',
    gap: 12,
  },
  motivationSpotlightSeal: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motivationSpotlightText: { flex: 1 },
  motivationSpotlightTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  motivationSpotlightCopy: { fontSize: 11.5, lineHeight: 17, marginBottom: 9 },
  motivationSpotlightMeta: { fontSize: 10.5, fontWeight: '700', marginTop: 6 },
  badgeRail: { gap: 10, paddingRight: 8 },
  badgeCard: {
    width: 168,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  badgeCardTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  badgeStatusPill: {
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeStatusTxt: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 },
  badgeSeal: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  badgeCore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCheck: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTitle: { fontSize: 12, fontWeight: '800', lineHeight: 16, marginBottom: 4, minHeight: 32 },
  badgeSubtitle: { fontSize: 10.5, fontWeight: '500', lineHeight: 15, minHeight: 30, marginBottom: 10 },
  badgeProgressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  badgeProgressFill: { height: '100%', borderRadius: 3 },
  badgeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  badgeFooterText: { fontSize: 10, fontWeight: '800' },
  motivationFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    alignItems: 'center',
  },
  footerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  footerPillText: { fontSize: 10.5, fontWeight: '700' },
  motivationCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 4,
  },
  motivationCTAText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },

  /* Next Meal Card */
  nextMealCard: {
    borderRadius: 26, borderWidth: 1, padding: 15, marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#0F3D2E', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3,
  },
  nextMealGlow: { position: 'absolute', top: -40, right: -30, width: 120, height: 120, borderRadius: 60, opacity: 0.15 },
  nextMealHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  nextMealBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  nextMealDot:      { width: 5, height: 5, borderRadius: 2.5 },
  nextMealBadgeTxt: { fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  nextMealTime:     { fontSize: 13, fontWeight: '800' },
  nextMealTitle:    { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, lineHeight: 21, marginBottom: 14 },
  nextMealCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: radii.md, alignSelf: 'stretch',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  nextMealCtaTxt: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  /* Dietitian Note Card */
  noteCard: {
    borderRadius: 26, borderWidth: 1, padding: 15, marginBottom: spacing.sm,
  },
  notePinRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  notePinDot:   { width: 5, height: 5, borderRadius: 2.5 },
  notePinLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 },
  noteTaskTitle:{ fontSize: 15, fontWeight: '800', marginBottom: 6 },
  noteText:     { fontSize: 13, fontWeight: '500', lineHeight: 19, marginBottom: 10 },
  taskCta:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 10 },
  taskCtaText:  { fontSize: 12, fontWeight: '800' },
  noteCtaRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  noteCtaTxt:   { fontSize: 11, fontWeight: '800' },

  /* Measurements Card */
  measCard: {
    borderRadius: 26, borderWidth: 1, padding: 15, marginBottom: spacing.sm,
    shadowColor: '#0F3D2E', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3,
  },
  measHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  measIconWrap:{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  measTitle:   { fontSize: 13, fontWeight: '800', flex: 1 },
  measSpinner: { marginLeft: 'auto' as any },
  measRow:     { flexDirection: 'row', marginBottom: 12 },
  measCell:    { flex: 1, alignItems: 'center' },
  measValue:   { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  measUnit:    { fontSize: 8.5, fontWeight: '800', marginTop: 1 },
  measLabel:   { fontSize: 9.5, fontWeight: '600', marginTop: 3 },
  measCtaRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  measCtaTxt:  { fontSize: 11, fontWeight: '800' },
  measEmpty:   { alignItems: 'center', gap: 10, paddingBottom: 4 },
  measEmptyTxt:{ fontSize: 12, fontWeight: '500' },
  measEmptyBtn:{
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, borderWidth: 1,
  },
  measEmptyBtnTxt: { fontSize: 12, fontWeight: '700' },

  /* Kitchen Entry Card */
  kitchenCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 26, borderWidth: 1, padding: 15, marginBottom: spacing.sm, overflow: 'hidden',
    shadowColor: '#0F3D2E', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3,
  },
  kitchenShimmer: {
    position: 'absolute', top: 0, bottom: 0, width: 56,
    backgroundColor: 'rgba(255,255,255,0.07)', transform: [{ skewX: '-18deg' }],
  },
  kitchenCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  kitchenOrb: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  kitchenCardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  kitchenCardSub:   { fontSize: 11, fontWeight: '500' },
  kitchenArrow: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },

  /* Active Plan Block */
  activePlanCard: {
    borderRadius: 26, borderWidth: 1, padding: 15, marginBottom: spacing.sm,
    shadowColor: '#0F3D2E', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3,
  },
  activePlanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  activePlanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  activePlanDot: { width: 6, height: 6, borderRadius: 3 },
  activePlanBadgeTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  activePlanName: { fontSize: 16, fontWeight: '800', marginBottom: 4, lineHeight: 22 },
  activePlanDates: { fontSize: 12, fontWeight: '500', marginBottom: 12 },
  activePlanProgressBlock: { marginBottom: 14 },
  activePlanProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  activePlanProgressLabel: { fontSize: 11, fontWeight: '500' },
  activePlanProgressPct: { fontSize: 11, fontWeight: '700' },
  activePlanTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  activePlanFill: { height: 6, borderRadius: 3 },
  activePlanCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: radii.md, paddingVertical: 10, marginTop: 2,
  },
  activePlanCtaTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  activePlanEmptyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  activePlanEmptySubtitle: { fontSize: 12, fontWeight: '400', lineHeight: 18 },

  /* Free: User ID Card */
  idCard: {
    borderRadius: radii.xl, borderWidth: 1, padding: 16, marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 4,
  },
  idGlow:    { position: 'absolute', top: -40, right: -30, width: 100, height: 100, borderRadius: 50, opacity: 0.12 },
  idHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  idIconWrap:{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  idLabel:   { fontSize: 13, fontWeight: '800', marginBottom: 1 },
  idHint:    { fontSize: 11, fontWeight: '500' },
  idValueRow:{
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radii.md, borderWidth: 1, paddingLeft: 12, paddingRight: 6, paddingVertical: 8,
  },
  idValue:   { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  idCopyBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },

  /* Free: Premium Upsell */
  upsellShelf: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: radii.xl, borderWidth: 1, padding: 16, marginBottom: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5,
  },
  upsellIconRing:{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  upsellTitle:   { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  upsellSub:     { fontSize: 11, fontWeight: '500', lineHeight: 16 },

  /* Free: Tile row */
  freeTile: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: radii.xl, borderWidth: 1, padding: 14, marginBottom: spacing.sm,
  },
  freeTileIcon:  { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  freeTileTitle: { fontSize: 13, fontWeight: '800', marginBottom: 1 },
  freeTileSub:   { fontSize: 11, fontWeight: '500' },
});


