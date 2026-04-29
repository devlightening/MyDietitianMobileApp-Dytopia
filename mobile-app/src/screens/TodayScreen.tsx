import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  Image,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  cancelAnimation,
  runOnUI,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import ConfettiOverlay, { type ConfettiRef } from '../components/ui/ConfettiOverlay';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { radii, spacing } from '../theme/tokens';
import {
  getTodayPlan,
  completeMeal,
  skipMeal,
  undoMealCompletion,
  type TodayPlan,
  type MealItem,
  type MealCompletionStatus,
} from '../data/plansRepo';
import {
  getTodayTracking,
  updateTodayTracking,
  type TodayTracking,
} from '../api/progress';
import { DEFAULT_HYDRATION_GOAL_GLASSES } from '../widgets/types';
import { Routes } from '../navigation/routes';
import { useAuth } from '../auth/AuthContext';
import { refreshWidgetsFromApp } from '../widgets/services/widgetSyncService';
import SkeletonCard from '../components/SkeletonCard';
import * as Haptics from 'expo-haptics';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import * as ImagePicker from 'expo-image-picker';

function mealTypeLabel(type: string, lang: 'tr' | 'en'): string {
  const map: Record<string, { tr: string; en: string }> = {
    Breakfast:   { tr: 'Kahvaltı',  en: 'Breakfast'   },
    MidMorning:  { tr: 'Kuşluk',    en: 'Mid-Morning'  },
    Lunch:       { tr: 'Öğle',      en: 'Lunch'        },
    Afternoon:   { tr: 'İkindi',    en: 'Afternoon'    },
    Dinner:      { tr: 'Akşam',     en: 'Dinner'       },
    Evening:     { tr: 'Gece',      en: 'Evening'      },
    Snack:       { tr: 'Atıştırma', en: 'Snack'        },
  };
  return map[type]?.[lang] ?? type;
}

function statusConfig(status: MealCompletionStatus, theme: any) {
  switch (status) {
    case 'Done':        return { icon: 'checkmark-circle'  as const, color: theme.emerald,    label: { tr: 'Yendi',      en: 'Done'     } };
    case 'Skipped':     return { icon: 'remove-circle'     as const, color: theme.textMuted,  label: { tr: 'Atlandı',    en: 'Skipped'  } };
    case 'Alternative': return { icon: 'swap-horizontal'   as const, color: theme.accentGold, label: { tr: 'Alternatif', en: 'Alt.'     } };
    default:            return { icon: 'ellipse-outline'   as const, color: theme.border,     label: { tr: 'Bekliyor',   en: 'Pending'  } };
  }
}

export default function TodayScreen() {
  const { theme, isDark } = useTheme();
  const { language }      = useTranslation();
  const { logout }        = useAuth();
  const navigation        = useNavigation();
  const insets            = useSafeAreaInsets();
  const lang              = language as 'tr' | 'en';

  const [plan, setPlan]         = useState<TodayPlan | null>(null);
  const [loading, setLoading]   = useState(true);
  const [contentReady, setContentReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TodayTracking | null>(null);
  const [waterBusy, setWaterBusy] = useState(false);
  const [flipResetKey, setFlipResetKey] = useState(0);
  const confettiRef = useRef<ConfettiRef>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [data, track] = await Promise.all([getTodayPlan(), getTodayTracking().catch(() => null)]);
      setPlan(data);
      if (track) setTracking(track);
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status;
      const code   = e?.response?.data?.code ?? e?.code;
      if (status === 401 || code === 'AUTH_REQUIRED') {
        Alert.alert(
          lang === 'tr' ? 'Oturum Sonlandı' : 'Session Expired',
          lang === 'tr' ? 'Lütfen tekrar giriş yapın.' : 'Please log in again.',
          [{ text: lang === 'tr' ? 'Tamam' : 'OK', onPress: () => void logout() }],
        );
      } else {
        setLoadError(e?.message ?? (lang === 'tr' ? 'Bir hata oluştu.' : 'Something went wrong.'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setContentReady(true);
    }
  }, [lang, logout]);

  useFocusEffect(useCallback(() => {
    setFlipResetKey(k => k + 1);
    void load();
  }, [load]));

  async function handleComplete(meal: MealItem) {
    const isCompleted = meal.completionStatus === 'Done' || meal.completionStatus === 'Alternative';
    setBusyId(meal.id);
    void Haptics.impactAsync(
      isCompleted
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium,
    );
    try {
      if (isCompleted) {
        await undoMealCompletion(meal.id);
      } else {
        await completeMeal(meal.id);
      }
      await load(true);
      void refreshWidgetsFromApp(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? (lang === 'tr' ? 'İşlem başarısız.' : 'Action failed.');
      Alert.alert(lang === 'tr' ? 'Hata' : 'Error', msg);
    } finally { setBusyId(null); }
  }

  async function handleSkip(meal: MealItem) {
    setBusyId(meal.id);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await skipMeal(meal.id);
      await load(true);
      void refreshWidgetsFromApp(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? (lang === 'tr' ? 'Öğün atlanamadı.' : 'Could not skip meal.');
      Alert.alert(lang === 'tr' ? 'Hata' : 'Error', msg);
    } finally { setBusyId(null); }
  }

  const handleWater = useCallback(async (delta: number) => {
    if (!tracking || waterBusy) return;
    const next = Math.max(0, tracking.waterGlasses + delta);
    const prev = tracking;
    // Optimistic update â€” update UI immediately, rollback on error
    setTracking({ ...tracking, waterGlasses: next });
    setWaterBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const updated = await updateTodayTracking(next, tracking.steps, tracking.notes);
      setTracking(updated);
      void refreshWidgetsFromApp(true);
    } catch {
      setTracking(prev);
    } finally {
      setWaterBusy(false);
    }
  }, [tracking, waterBusy]);

  const today = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const doneCount   = plan?.items.filter(i => i.completionStatus === 'Done' || i.completionStatus === 'Alternative').length ?? 0;
  const totalCount  = plan?.items.length ?? 0;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Progress bar animasyonu
  const barWidthAnim = useSharedValue(0);
  useEffect(() => {
    barWidthAnim.value = withTiming(progressPct, { duration: 750 });
  }, [progressPct]);
  const barFillAnimStyle = useAnimatedStyle(() => ({
    width: `${barWidthAnim.value}%` as any,
  }));

  // %100 kutlaması â€” kart pulse
  const cardPulse    = useSharedValue(1);
  const prevPct      = useRef(0);
  const showCelebrate = progressPct === 100 && totalCount > 0;
  useEffect(() => {
    if (progressPct === 100 && prevPct.current < 100 && totalCount > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      confettiRef.current?.trigger();
      runOnUI(() => {
        'worklet';
        cardPulse.value = withSequence(
          withSpring(1.03, { damping: 4, stiffness: 500 }),
          withSpring(0.98, { damping: 8, stiffness: 300 }),
          withSpring(1,    { damping: 12, stiffness: 200 }),
        );
      })();
    }
    prevPct.current = progressPct;
  }, [progressPct, totalCount]);
  const cardPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardPulse.value }],
  }));

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: theme.bg }]}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          <View style={s.header}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={[sk.line, { width: 120, height: 11, backgroundColor: theme.border }]} />
              <View style={[sk.line, { width: 200, height: 22, backgroundColor: theme.border }]} />
            </View>
          </View>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.error} style={{ marginBottom: spacing.md }} />
        <Text style={[s.errorTitle, { color: theme.text }]}>{lang === 'tr' ? 'Yüklenemedi' : 'Load failed'}</Text>
        <Text style={[s.errorSub, { color: theme.textMuted }]}>{loadError}</Text>
        <TouchableOpacity style={[s.retryBtn, { backgroundColor: theme.primary }]} onPress={() => void load()}>
          <Text style={s.retryTxt}>{lang === 'tr' ? 'Tekrar Dene' : 'Retry'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <Animated.View entering={FadeIn.duration(260)} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(true); }}
            tintColor={theme.primary}
          />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={[s.dateLabel, { color: theme.textMuted }]}>{today}</Text>
            <Text style={[s.pageTitle, { color: theme.text }]}>{lang === 'tr' ? "Bugünün Planı" : "Today's Plan"}</Text>
          </View>
          <TouchableOpacity
            style={[s.iconBtn, { borderColor: theme.border, backgroundColor: theme.surface, marginRight: 8 }]}
            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); (navigation as any).navigate(Routes.App.MealLog); }}
          >
            <Ionicons name="journal-outline" size={18} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, { borderColor: theme.border, backgroundColor: theme.surface, marginRight: 8 }]}
            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); (navigation as any).navigate(Routes.App.WeeklySummary); }}
          >
            <Ionicons name="bar-chart-outline" size={18} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={() =>
              Alert.alert(
                lang === 'tr' ? 'Çıkış' : 'Logout',
                lang === 'tr' ? 'Çıkış yapmak istediğinize emin misiniz?' : 'Are you sure?',
                [
                  { text: lang === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                  { text: lang === 'tr' ? 'Çıkış Yap' : 'Logout', style: 'destructive', onPress: () => void logout() },
                ],
              )
            }
          >
            <Ionicons name="log-out-outline" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {plan ? (
          <>
            {/* Progress card */}
            <Animated.View
              entering={FadeInDown.delay(40).duration(320)}
              style={[s.progressCard, { backgroundColor: theme.surface, borderColor: showCelebrate ? theme.emerald : theme.borderEmerald }, cardPulseStyle]}
            >
              <View style={s.progressTop}>
                <Text style={[s.progressLabel, { color: theme.text }]}>
                  {lang === 'tr' ? 'Günlük İlerleme' : 'Daily Progress'}
                </Text>
                <Text style={[s.progressPct, { color: progressPct === 100 ? theme.emerald : theme.primary }]}>
                  {progressPct}%
                </Text>
              </View>
              <View style={[s.barBg, { backgroundColor: theme.surfaceElevated }]}>
                <Animated.View
                  style={[
                    s.barFill,
                    { backgroundColor: progressPct === 100 ? theme.emerald : theme.primary },
                    barFillAnimStyle,
                  ]}
                />
              </View>
              <Text style={[s.progressStat, { color: theme.textMuted }]}>
                {lang === 'tr' ? `${doneCount} / ${totalCount} öğün tamamlandı` : `${doneCount} / ${totalCount} meals done`}
              </Text>
            </Animated.View>

            {/* %100 kutlama banner */}
            {showCelebrate && (
              <Animated.View
                entering={FadeInDown.delay(80).duration(400)}
                style={[s.celebrateBanner, { backgroundColor: `${theme.emerald}15`, borderColor: `${theme.emerald}40` }]}
              >
                <Text style={s.celebrateEmoji}>ğŸ‰</Text>
                <Text style={[s.celebrateTxt, { color: theme.emerald }]}>
                  {lang === 'tr' ? 'Tüm öğünler tamamlandı! Harika iş!' : 'All meals complete! Great job!'}
                </Text>
              </Animated.View>
            )}

            {/* Water widget */}
            <WaterWidget
              glasses={tracking?.waterGlasses ?? 0}
              goal={DEFAULT_HYDRATION_GOAL_GLASSES}
              busy={waterBusy}
              lang={lang}
              theme={theme}
              onAdd={() => void handleWater(1)}
              onRemove={() => void handleWater(-1)}
              onNavigate={() => (navigation as any).navigate(Routes.App.Hydration)}
            />

            {/* Meal cards â€” stagger animasyonu */}
            {plan.items.map((meal, index) => (
              <Animated.View key={meal.id} entering={FadeInDown.delay(120 + index * 70).duration(320)}>
                <SwipeToComplete
                  onComplete={() => void handleComplete(meal)}
                  disabled={
                    meal.completionStatus === 'Done' ||
                    meal.completionStatus === 'Alternative' ||
                    meal.completionStatus === 'Skipped' ||
                    busyId === meal.id
                  }
                  theme={theme}
                >
                  <MealCard
                    meal={meal}
                    lang={lang}
                    theme={theme}
                    busy={busyId === meal.id}
                    flipResetKey={flipResetKey}
                    onComplete={() => void handleComplete(meal)}
                    onSkip={() => void handleSkip(meal)}
                    onCheckIngredients={
                      meal.recipeId
                        ? () => (navigation as any).navigate(Routes.Premium.CheckIngredients, {
                            mealId: meal.id,
                            plannedRecipeId: meal.recipeId,
                            mealType: meal.mealType,
                            recipeName: meal.recipeName ?? meal.title,
                          })
                        : undefined
                    }
                  />
                </SwipeToComplete>
              </Animated.View>
            ))}
          </>
        ) : (
          <Animated.View entering={FadeInDown.delay(80).duration(320)} style={[s.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="calendar-outline" size={52} color={theme.textMuted} style={{ marginBottom: spacing.md }} />
            <Text style={[s.emptyTitle, { color: theme.text }]}>
              {lang === 'tr' ? 'Bugün Plan Yok' : 'No Plan Today'}
            </Text>
            <Text style={[s.emptySub, { color: theme.textMuted }]}>
              {lang === 'tr'
                ? 'Diyetisyeniniz henüz bugün için plan oluşturmadı.'
                : "Your dietitian hasn't set a plan for today yet."}
            </Text>
          </Animated.View>
        )}
      </ScrollView>
      </Animated.View>

      <ConfettiOverlay ref={confettiRef} />
    </View>
  );
}

// â”€â”€â”€ SwipeToComplete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SwipeToComplete({
  onComplete,
  disabled,
  theme,
  children,
}: {
  onComplete: () => void;
  disabled: boolean;
  theme: any;
  children: React.ReactNode;
}) {
  const tx = useRef(new RNAnimated.Value(0)).current;
  const revealed = useRef(new RNAnimated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        !disabled && gs.dx < -8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.4,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          tx.setValue(gs.dx);
          revealed.setValue(Math.min(1, Math.abs(gs.dx) / 90));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -80 || gs.vx < -0.6) {
          RNAnimated.timing(tx, { toValue: -400, duration: 200, useNativeDriver: true }).start(() => {
            tx.setValue(0);
            revealed.setValue(0);
            onComplete();
          });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          RNAnimated.spring(tx, { toValue: 0, damping: 14, stiffness: 200, useNativeDriver: true }).start();
          RNAnimated.timing(revealed, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const revealScale = revealed.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <View style={{ overflow: 'hidden', borderRadius: 20 }}>
      {/* Green "done" reveal behind card */}
      <RNAnimated.View
        style={[
          sw.revealBg,
          {
            backgroundColor: `${theme.emerald}20`,
            opacity: revealed,
            transform: [{ scale: revealScale }],
          },
        ]}
      >
        <Text style={[sw.revealIcon, { color: theme.emerald }]}>âœ“</Text>
      </RNAnimated.View>

      <RNAnimated.View {...pan.panHandlers} style={{ transform: [{ translateX: tx }] }}>
        {children}
      </RNAnimated.View>
    </View>
  );
}

// â”€â”€â”€ MealCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MealCard({
  meal, lang, theme, busy, onComplete, onSkip, onCheckIngredients, flipResetKey,
}: {
  meal: MealItem;
  lang: 'tr' | 'en';
  theme: any;
  busy: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onCheckIngredients?: () => void;
  flipResetKey: number;
}) {
  const cfg     = statusConfig(meal.completionStatus, theme);
  const isDone  = meal.completionStatus === 'Done';
  const isSkip  = meal.completionStatus === 'Skipped';
  const isAlt   = meal.completionStatus === 'Alternative';
  const blocked = !meal.isActionableNow && meal.completionStatus === 'Planned';

  const [photoUri, setPhotoUri]   = useState<string | null>(null);
  const [showBack, setShowBack]   = useState(false);
  const flipScaleX                = useRef(new RNAnimated.Value(1)).current;
  const cardScale                 = useSharedValue(1);
  const cardStyle                 = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  // Reset to front when screen regains focus
  const prevResetKey = useRef(flipResetKey);
  useEffect(() => {
    if (flipResetKey !== prevResetKey.current && showBack) {
      RNAnimated.timing(flipScaleX, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
        setShowBack(false);
        RNAnimated.timing(flipScaleX, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      });
    }
    prevResetKey.current = flipResetKey;
  }, [flipResetKey]);

  function triggerFlip() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    RNAnimated.timing(flipScaleX, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowBack(prev => !prev);
      RNAnimated.timing(flipScaleX, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }

  function pressIn() {
    cardScale.value = withSpring(0.975, { damping: 14, stiffness: 400 });
  }
  function pressOut() {
    cardScale.value = withSpring(1, { damping: 12, stiffness: 300 });
  }

  async function handlePhotoPress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  return (
    <Animated.View style={cardStyle}>
      <RNAnimated.View
        style={[
          s.mealCard,
          {
            backgroundColor: showBack
              ? `${theme.accentGold}08`
              : (isDone ? `${theme.emerald}08` : theme.surface),
            borderColor: showBack
              ? `${theme.accentGold}38`
              : (isDone ? `${theme.emerald}30` : theme.border),
            transform: [{ scaleX: flipScaleX }],
          },
        ]}
      >
        {showBack ? (
          /* â”€â”€ Arka yüz: seçilen alternatif detayları â”€â”€ */
          <View style={{ gap: spacing.sm }}>
            <View style={[s.backFaceHeader, { backgroundColor: `${theme.accentGold}15`, borderColor: `${theme.accentGold}32` }]}>
              <Ionicons name="swap-horizontal" size={13} color={theme.accentGold} />
              <Text style={[s.backFaceHeaderTxt, { color: theme.accentGold }]}>
                {lang === 'tr' ? 'Seçilen Alternatif' : 'Alternative Selected'}
              </Text>
            </View>

            <Text style={[s.backFaceFrom, { color: theme.textMuted }]} numberOfLines={1}>
              {meal.recipeName ?? meal.title} â†’
            </Text>

            <Text style={[s.backFaceName, { color: theme.text }]}>
              {meal.alternativeRecipeName ?? 'â€”'}
            </Text>

            {(meal.alternativeMacros || meal.alternativeCalories != null) && (
              <View style={s.macroRow}>
                {meal.alternativeMacros?.proteinGrams != null && (
                  <MacroBadge label="P"    value={`${meal.alternativeMacros.proteinGrams}g`} color={theme.accentCyan} theme={theme} />
                )}
                {meal.alternativeMacros?.carbsGrams != null && (
                  <MacroBadge label="K"    value={`${meal.alternativeMacros.carbsGrams}g`}   color={theme.accentGold} theme={theme} />
                )}
                {meal.alternativeMacros?.fatGrams != null && (
                  <MacroBadge label="Y"    value={`${meal.alternativeMacros.fatGrams}g`}     color={theme.error}      theme={theme} />
                )}
                {meal.alternativeCalories != null && (
                  <MacroBadge label="kcal" value={`${meal.alternativeCalories}`}             color={theme.textMuted}  theme={theme} />
                )}
              </View>
            )}

            <TouchableOpacity
              style={[s.altFlipBtn, { borderColor: `${theme.accentGold}40`, backgroundColor: `${theme.accentGold}10` }]}
              onPress={triggerFlip}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={13} color={theme.accentGold} />
              <Text style={[s.altFlipBtnTxt, { color: theme.accentGold }]}>
                {lang === 'tr' ? 'Orijinal Plana Dön' : 'Show Original Plan'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* â”€â”€ Ön yüz: orijinal plan bilgileri â”€â”€ */
          <>
            <View style={s.mealTop}>
              <View style={s.mealTopLeft}>
                <View style={[s.typeChip, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}28` }]}>
                  <Text style={[s.typeChipTxt, { color: theme.primary }]}>{mealTypeLabel(meal.mealType, lang)}</Text>
                </View>
                {!!meal.time && <Text style={[s.mealTime, { color: theme.textMuted }]}>{meal.time}</Text>}
              </View>
              <View style={[s.statusPill, { backgroundColor: `${cfg.color}18` }]}>
                <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                <Text style={[s.statusTxt, { color: cfg.color }]}>{cfg.label[lang]}</Text>
              </View>
            </View>

            <Text style={[s.mealName, { color: isSkip ? theme.textMuted : theme.text, textDecorationLine: isSkip ? 'line-through' : 'none' }]}>
              {meal.title || meal.recipeName || (lang === 'tr' ? 'Tarif atanmamış' : 'No recipe assigned')}
            </Text>

            {!!meal.note && <Text style={[s.mealNote, { color: theme.textMuted }]}>{meal.note}</Text>}

            {(meal.macros || meal.calories) && (
              <View style={s.macroRow}>
                {meal.macros?.proteinGrams != null && <MacroBadge label="P"    value={`${meal.macros.proteinGrams}g`} color={theme.accentCyan} theme={theme} />}
                {meal.macros?.carbsGrams   != null && <MacroBadge label="K"    value={`${meal.macros.carbsGrams}g`}   color={theme.accentGold} theme={theme} />}
                {meal.macros?.fatGrams     != null && <MacroBadge label="Y"    value={`${meal.macros.fatGrams}g`}     color={theme.error}      theme={theme} />}
                {meal.calories             != null && <MacroBadge label="kcal" value={`${meal.calories}`}             color={theme.textMuted}  theme={theme} />}
              </View>
            )}

            {!isSkip && (
              <View style={s.actions}>
                {busy ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : isAlt ? (
                  <TouchableOpacity
                    style={[s.altFlipBtn, { flex: 1, borderColor: `${theme.accentGold}40`, backgroundColor: `${theme.accentGold}10` }]}
                    onPress={triggerFlip}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="swap-horizontal" size={13} color={theme.accentGold} />
                    <Text style={[s.altFlipBtnTxt, { color: theme.accentGold }]}>
                      {lang === 'tr' ? 'Alternatifi Gör' : 'See Alternative'}
                    </Text>
                  </TouchableOpacity>
                ) : isDone ? (
                  <TouchableOpacity style={[s.undoBtn, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]} onPress={onComplete} activeOpacity={0.8}>
                    <Ionicons name="arrow-undo-outline" size={13} color={theme.textMuted} />
                    <Text style={[s.undoBtnTxt, { color: theme.textMuted }]}>{lang === 'tr' ? 'Geri Al' : 'Undo'}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[s.doneBtn, { backgroundColor: blocked ? theme.surfaceElevated : theme.primary, opacity: blocked ? 0.5 : 1 }]}
                      onPress={onComplete}
                      onPressIn={pressIn}
                      onPressOut={pressOut}
                      disabled={blocked}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="checkmark" size={15} color={blocked ? theme.textMuted : '#FFF'} />
                      <Text style={[s.doneBtnTxt, { color: blocked ? theme.textMuted : '#FFF' }]}>
                        {lang === 'tr' ? 'Yedim' : 'Done'}
                      </Text>
                    </TouchableOpacity>

                    {onCheckIngredients && (
                      <TouchableOpacity style={[s.ghostBtn, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]} onPress={onCheckIngredients} activeOpacity={0.8}>
                        <Ionicons name="list-outline" size={13} color={theme.text} />
                        <Text style={[s.ghostBtnTxt, { color: theme.text }]}>{lang === 'tr' ? 'Malzemeler' : 'Ingredients'}</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity style={[s.skipBtn, { borderColor: `${theme.error}28`, backgroundColor: `${theme.error}08` }]} onPress={onSkip} disabled={busy} activeOpacity={0.8}>
                      <Text style={[s.skipBtnTxt, { color: theme.error }]}>{lang === 'tr' ? 'Atla' : 'Skip'}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {blocked && meal.completionStatus === 'Planned' && (
              <Text style={[s.blockedHint, { color: theme.textMuted }]}>
                {lang === 'tr' ? `â° ${meal.actionBlockedUntilTime ?? ''} itibarıyla açılır` : `â° Opens at ${meal.actionBlockedUntilTime ?? ''}`}
              </Text>
            )}

            <View style={s.photoRow}>
              {photoUri ? (
                <Pressable onPress={handlePhotoPress} style={[s.photoThumb, { borderColor: theme.border }]}>
                  <Image source={{ uri: photoUri }} style={s.photoImg} />
                  <View style={[s.photoOverlay, { backgroundColor: `${theme.bg}80` }]}>
                    <Ionicons name="camera-outline" size={13} color={theme.textMuted} />
                  </View>
                </Pressable>
              ) : (
                <TouchableOpacity
                  style={[s.cameraBtn, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                  onPress={handlePhotoPress}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera-outline" size={13} color={theme.textMuted} />
                  <Text style={[s.cameraBtnTxt, { color: theme.textMuted }]}>
                    {lang === 'tr' ? 'Fotoğraf' : 'Photo'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </RNAnimated.View>
    </Animated.View>
  );
}

// â”€â”€â”€ Water Widget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const GLASS_W = 100;
const GLASS_H = 156;

function WaterWidget({
  glasses, goal, busy, lang, theme, onAdd, onRemove, onNavigate,
}: {
  glasses: number;
  goal: number;
  busy: boolean;
  lang: 'tr' | 'en';
  theme: any;
  onAdd: () => void;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  const color  = theme.accentCyan;
  const done   = glasses >= goal;
  const overGoal = Math.max(0, glasses - goal);
  const pct    = Math.min(1, glasses / goal);
  const liters = (glasses * 0.2).toFixed(1);

  const fillH      = useSharedValue(pct * GLASS_H);
  const glassScale = useSharedValue(1);
  const waveX      = useSharedValue(0);
  const ov1Y = useSharedValue(0); const ov1O = useSharedValue(0);
  const ov2Y = useSharedValue(0); const ov2O = useSharedValue(0);
  const ov3Y = useSharedValue(0); const ov3O = useSharedValue(0);

  useEffect(() => {
    fillH.value = withSpring(pct * GLASS_H, { damping: 22, stiffness: 85 });
  }, [pct]);

  useEffect(() => {
    waveX.value = withRepeat(
      withSequence(withTiming(6, { duration: 1500 }), withTiming(-6, { duration: 1500 })),
      -1,
      true,
    );
  }, []);

  const wasDone = useRef(false);
  useEffect(() => {
    if (done && !wasDone.current) {
      runOnUI(() => {
        'worklet';
        ov1Y.value = 0; ov1O.value = 0;
        ov2Y.value = 0; ov2O.value = 0;
        ov3Y.value = 0; ov3O.value = 0;
        ov1O.value = withSequence(withTiming(1, { duration: 80 }), withDelay(380, withTiming(0, { duration: 340 })));
        ov1Y.value = withTiming(50, { duration: 800 });
        ov2O.value = withDelay(190, withSequence(withTiming(1, { duration: 80 }), withDelay(360, withTiming(0, { duration: 340 }))));
        ov2Y.value = withDelay(190, withTiming(58, { duration: 880 }));
        ov3O.value = withDelay(360, withSequence(withTiming(1, { duration: 80 }), withDelay(340, withTiming(0, { duration: 320 }))));
        ov3Y.value = withDelay(360, withTiming(42, { duration: 720 }));
      })();
    } else if (!done && wasDone.current) {
      runOnUI(() => {
        'worklet';
        cancelAnimation(ov1Y); cancelAnimation(ov1O); ov1O.value = 0;
        cancelAnimation(ov2Y); cancelAnimation(ov2O); ov2O.value = 0;
        cancelAnimation(ov3Y); cancelAnimation(ov3O); ov3O.value = 0;
      })();
    }
    wasDone.current = done;
  }, [done]);

  const fillStyle  = useAnimatedStyle(() => ({ height: fillH.value }));
  const waveStyle  = useAnimatedStyle(() => ({ transform: [{ translateX: waveX.value }] }));
  const glassStyle = useAnimatedStyle(() => ({ transform: [{ scale: glassScale.value }] }));
  const ov1Style   = useAnimatedStyle(() => ({ transform: [{ translateY: ov1Y.value }], opacity: ov1O.value }));
  const ov2Style   = useAnimatedStyle(() => ({ transform: [{ translateY: ov2Y.value }], opacity: ov2O.value }));
  const ov3Style   = useAnimatedStyle(() => ({ transform: [{ translateY: ov3Y.value }], opacity: ov3O.value }));

  function handlePress() {
    if (busy) return;
    if (done) {
      runOnUI(() => {
        'worklet';
        ov1Y.value = 0; ov1O.value = 0;
        ov2Y.value = 0; ov2O.value = 0;
        ov3Y.value = 0; ov3O.value = 0;
        ov1O.value = withSequence(withTiming(1, { duration: 80 }), withDelay(380, withTiming(0, { duration: 340 })));
        ov1Y.value = withTiming(50, { duration: 800 });
        ov2O.value = withDelay(190, withSequence(withTiming(1, { duration: 80 }), withDelay(360, withTiming(0, { duration: 340 }))));
        ov2Y.value = withDelay(190, withTiming(58, { duration: 880 }));
        ov3O.value = withDelay(360, withSequence(withTiming(1, { duration: 80 }), withDelay(340, withTiming(0, { duration: 320 }))));
        ov3Y.value = withDelay(360, withTiming(42, { duration: 720 }));
      })();
    }
    runOnUI(() => {
      'worklet';
      cancelAnimation(glassScale);
      glassScale.value = withSequence(
        withSpring(0.91, { damping: 5, stiffness: 700 }),
        withSpring(1.05, { damping: 9, stiffness: 300 }),
        withSpring(1,    { damping: 16, stiffness: 200 }),
      );
    })();
    onAdd();
  }

  function handleLongPress() {
    if (busy || glasses === 0) return;
    runOnUI(() => {
      'worklet';
      cancelAnimation(glassScale);
      glassScale.value = withSequence(
        withSpring(0.95, { damping: 8, stiffness: 500 }),
        withSpring(1,    { damping: 14, stiffness: 250 }),
      );
    })();
    onRemove();
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(80).duration(320)}
      style={[w.card, { backgroundColor: theme.surface, borderColor: done ? `${color}55` : theme.border }]}
    >
      {/* Header â†’ navigates to HydrationScreen */}
      <TouchableOpacity onPress={onNavigate} activeOpacity={0.75} style={w.headerRow}>
        <View style={[w.iconBox, { backgroundColor: `${color}18` }]}>
          <Ionicons name="water" size={16} color={color} />
        </View>
        <Text style={[w.headerTitle, { color: theme.text }]}>
          {lang === 'tr' ? 'Su Takibi' : 'Hydration'}
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={[w.litersVal, { color: done ? color : theme.text }]}>
          {liters}
          <Text style={[w.litersGoal, { color: theme.textMuted }]}>{' / 2.0L'}</Text>
        </Text>
        <Ionicons name="chevron-forward" size={14} color={theme.textMuted} style={{ marginLeft: 6 }} />
      </TouchableOpacity>

      {/* Glass area */}
      <View style={w.glassArea}>
        {/* Overflow drops above rim */}
        <View style={w.overflowZone} pointerEvents="none">
          <Animated.View style={[w.overDrop, { left: '20%' }, ov1Style]}>
            <Ionicons name="water" size={12} color={color} />
          </Animated.View>
          <Animated.View style={[w.overDrop, { left: '48%' }, ov2Style]}>
            <Ionicons name="water" size={15} color={color} />
          </Animated.View>
          <Animated.View style={[w.overDrop, { left: '70%' }, ov3Style]}>
            <Ionicons name="water" size={11} color={color} />
          </Animated.View>
        </View>

        {/* Pressable glass */}
        <Animated.View style={glassStyle}>
          <Pressable
            onPress={handlePress}
            onLongPress={handleLongPress}
            delayLongPress={450}
          >
            <View style={[w.glass, { borderColor: done ? color : `${color}55`, backgroundColor: theme.bg }]}>
              {/* Water fill climbs from bottom */}
              <Animated.View style={[w.waterFill, { backgroundColor: `${color}28` }, fillStyle]}>
                {/* Wave surface on top of water */}
                <Animated.View style={[w.waveSurface, { backgroundColor: done ? color : `${color}95` }, waveStyle]} />
              </Animated.View>
              {busy && (
                <ActivityIndicator
                  size="small"
                  color={color}
                  style={{ position: 'absolute', top: '50%', alignSelf: 'center' }}
                />
              )}
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* Dot indicators */}
      <View style={w.dotRow}>
        {Array.from({ length: goal }).map((_, i) => (
          <View key={i} style={[w.dot, { backgroundColor: i < glasses ? color : `${color}22` }]} />
        ))}
      </View>

      {/* Bottom row: count + hint */}
      <View style={w.bottomRow}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
          <AnimatedCounter value={glasses} duration={400} style={[w.glassCount, { color: done ? color : theme.text }]} />
          <Text style={[w.glassGoal, { color: theme.textMuted }]}>{'/' + goal + ' ' + (lang === 'tr' ? 'bardak' : 'glasses')}</Text>
        </View>
        <Text style={[w.hint, { color: theme.textMuted }]}>
          {done
            ? (lang === 'tr' ? 'Hedefe ulaştın ğŸ‰' : 'Goal reached ğŸ‰')
            : (lang === 'tr' ? 'bas · uzun bas azalt' : 'tap · hold to remove')}
        </Text>
      </View>
    </Animated.View>
  );
}

function MacroBadge({ label, value, color, theme }: { label: string; value: string; color: string; theme: any }) {
  return (
    <View style={[s.macroBadge, { backgroundColor: `${color}12`, borderColor: `${color}22` }]}>
      <Text style={[s.macroLbl, { color }]}>{label}</Text>
      <Text style={[s.macroVal, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  scroll: { paddingHorizontal: spacing.base, gap: spacing.md },

  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dateLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  pageTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  iconBtn:   { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  progressCard: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.md, gap: 8 },
  progressTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 14, fontWeight: '800' },
  progressPct:   { fontSize: 18, fontWeight: '900' },
  barBg:   { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  progressStat: { fontSize: 12, fontWeight: '700' },

  mealCard: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  mealTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealTopLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typeChip:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, borderWidth: 1 },
  typeChipTxt: { fontSize: 11, fontWeight: '800' },
  mealTime:    { fontSize: 12, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  statusTxt:  { fontSize: 11, fontWeight: '800' },
  mealName:   { fontSize: 17, fontWeight: '800', lineHeight: 22 },
  mealNote:   { fontSize: 12.5, fontStyle: 'italic', lineHeight: 18 },

  macroRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  macroBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radii.full, borderWidth: 1 },
  macroLbl:   { fontSize: 10, fontWeight: '900' },
  macroVal:   { fontSize: 11, fontWeight: '800' },

  actions:   { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: 2 },
  doneBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: radii.lg },
  doneBtnTxt: { fontSize: 13, fontWeight: '900' },
  undoBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radii.lg, borderWidth: 1 },
  undoBtnTxt: { fontSize: 12, fontWeight: '800' },
  ghostBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 9, borderRadius: radii.lg, borderWidth: 1 },
  ghostBtnTxt: { fontSize: 12, fontWeight: '800' },
  skipBtn:   { paddingHorizontal: spacing.sm, paddingVertical: 9, borderRadius: radii.lg, borderWidth: 1 },
  skipBtnTxt: { fontSize: 12, fontWeight: '800' },
  blockedHint: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  altFlipBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, justifyContent: 'center' },
  altFlipBtnTxt: { fontSize: 12, fontWeight: '800' },

  backFaceHeader:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6, alignSelf: 'flex-start' },
  backFaceHeaderTxt: { fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  backFaceFrom:      { fontSize: 12, fontWeight: '700', fontStyle: 'italic' },
  backFaceName:      { fontSize: 18, fontWeight: '900', lineHeight: 23 },

  celebrateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radii.xl, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  celebrateEmoji: { fontSize: 18 },
  celebrateTxt:   { fontSize: 13, fontWeight: '700', flex: 1 },

  emptyCard:  { borderRadius: radii.xl, borderWidth: 1, padding: spacing.xl * 1.5, alignItems: 'center', marginTop: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginBottom: spacing.sm },
  emptySub:   { fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },

  errorTitle: { fontSize: 18, fontWeight: '900', marginBottom: spacing.sm, textAlign: 'center' },
  errorSub:   { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.xl },
  retryBtn:   { marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: 14, borderRadius: radii.xl },
  retryTxt:   { color: '#FFF', fontSize: 14, fontWeight: '900' },

  photoRow: { flexDirection: 'row', marginTop: 4 },
  photoThumb: { width: 52, height: 40, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cameraBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  cameraBtnTxt: { fontSize: 11, fontWeight: '700' },
});

const sk = StyleSheet.create({
  line: { borderRadius: 6 },
});

const sw = StyleSheet.create({
  revealBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 24,
    borderRadius: 20,
  },
  revealIcon: { fontSize: 28, fontWeight: '900' },
});

const w = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  litersVal:   { fontSize: 15, fontWeight: '900', letterSpacing: -0.3 },
  litersGoal:  { fontSize: 12, fontWeight: '600' },

  glassArea: {
    alignItems: 'center',
    paddingTop: 26,
  },
  overflowZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 26,
  },
  overDrop: {
    position: 'absolute',
    top: 0,
  },
  glass: {
    width: GLASS_W,
    height: GLASS_H,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  waterFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  waveSurface: {
    position: 'absolute',
    top: 0,
    left: -10,
    right: -10,
    height: 3,
    borderRadius: 2,
  },

  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glassCount: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  glassGoal:  { fontSize: 13, fontWeight: '600' },
  hint:       { fontSize: 11, fontWeight: '600' },
});

