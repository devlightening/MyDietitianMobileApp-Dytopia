import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
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
import * as Haptics from 'expo-haptics';

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
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TodayTracking | null>(null);
  const [waterBusy, setWaterBusy] = useState(false);

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
          [{ text: 'OK', onPress: () => void logout() }],
        );
      } else {
        setLoadError(e?.message ?? (lang === 'tr' ? 'Bir hata oluştu.' : 'Something went wrong.'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lang, logout]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function handleComplete(meal: MealItem) {
    setBusyId(meal.id);
    void Haptics.impactAsync(
      meal.completionStatus === 'Done'
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium,
    );
    try {
      if (meal.completionStatus === 'Done') {
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
    setWaterBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const updated = await updateTodayTracking(next, tracking.steps, tracking.notes);
      setTracking(updated);
      void refreshWidgetsFromApp(true);
    } catch {
      // silent — user can retry from HydrationScreen
    } finally {
      setWaterBusy(false);
    }
  }, [tracking, waterBusy]);

  const today = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const doneCount   = plan?.items.filter(i => i.completionStatus === 'Done').length ?? 0;
  const totalCount  = plan?.items.length ?? 0;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
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
            onPress={() => (navigation as any).navigate(Routes.App.MealLog)}
          >
            <Ionicons name="journal-outline" size={18} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, { borderColor: theme.border, backgroundColor: theme.surface, marginRight: 8 }]}
            onPress={() => (navigation as any).navigate(Routes.App.WeeklySummary)}
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
            <View style={[s.progressCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
              <View style={s.progressTop}>
                <Text style={[s.progressLabel, { color: theme.text }]}>
                  {lang === 'tr' ? 'Günlük İlerleme' : 'Daily Progress'}
                </Text>
                <Text style={[s.progressPct, { color: progressPct === 100 ? theme.emerald : theme.primary }]}>
                  {progressPct}%
                </Text>
              </View>
              <View style={[s.barBg, { backgroundColor: theme.surfaceElevated }]}>
                <View
                  style={[
                    s.barFill,
                    {
                      width: `${progressPct}%` as any,
                      backgroundColor: progressPct === 100 ? theme.emerald : theme.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[s.progressStat, { color: theme.textMuted }]}>
                {lang === 'tr' ? `${doneCount} / ${totalCount} öğün tamamlandı` : `${doneCount} / ${totalCount} meals done`}
              </Text>
            </View>

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

            {/* Meal cards */}
            {plan.items.map(meal => (
              <MealCard
                key={meal.id}
                meal={meal}
                lang={lang}
                theme={theme}
                busy={busyId === meal.id}
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
            ))}
          </>
        ) : (
          <View style={[s.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="calendar-outline" size={52} color={theme.textMuted} style={{ marginBottom: spacing.md }} />
            <Text style={[s.emptyTitle, { color: theme.text }]}>
              {lang === 'tr' ? 'Bugün Plan Yok' : 'No Plan Today'}
            </Text>
            <Text style={[s.emptySub, { color: theme.textMuted }]}>
              {lang === 'tr'
                ? 'Diyetisyeniniz henüz bugün için plan oluşturmadı.'
                : "Your dietitian hasn't set a plan for today yet."}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── MealCard ─────────────────────────────────────────────────────────────────

function MealCard({
  meal, lang, theme, busy, onComplete, onSkip, onCheckIngredients,
}: {
  meal: MealItem;
  lang: 'tr' | 'en';
  theme: any;
  busy: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onCheckIngredients?: () => void;
}) {
  const cfg     = statusConfig(meal.completionStatus, theme);
  const isDone  = meal.completionStatus === 'Done';
  const isSkip  = meal.completionStatus === 'Skipped';
  const blocked = !meal.isActionableNow && meal.completionStatus === 'Planned';

  return (
    <View
      style={[
        s.mealCard,
        {
          backgroundColor: isDone ? `${theme.emerald}08` : theme.surface,
          borderColor: isDone ? `${theme.emerald}30` : theme.border,
        },
      ]}
    >
      {/* Type + status row */}
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

      {/* Name */}
      <Text style={[s.mealName, { color: isSkip ? theme.textMuted : theme.text, textDecorationLine: isSkip ? 'line-through' : 'none' }]}>
        {meal.title || meal.recipeName || (lang === 'tr' ? 'Tarif atanmamış' : 'No recipe assigned')}
      </Text>

      {!!meal.note && <Text style={[s.mealNote, { color: theme.textMuted }]}>{meal.note}</Text>}

      {/* Macros */}
      {(meal.macros || meal.calories) && (
        <View style={s.macroRow}>
          {meal.macros?.proteinGrams != null && <MacroBadge label="P" value={`${meal.macros.proteinGrams}g`} color={theme.accentCyan} theme={theme} />}
          {meal.macros?.carbsGrams   != null && <MacroBadge label="K" value={`${meal.macros.carbsGrams}g`}   color={theme.accentGold}  theme={theme} />}
          {meal.macros?.fatGrams     != null && <MacroBadge label="Y" value={`${meal.macros.fatGrams}g`}     color={theme.error}       theme={theme} />}
          {meal.calories             != null && <MacroBadge label="kcal" value={`${meal.calories}`}          color={theme.textMuted}   theme={theme} />}
        </View>
      )}

      {/* Actions */}
      {!isSkip && (
        <View style={s.actions}>
          {busy ? (
            <ActivityIndicator size="small" color={theme.primary} />
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
          {lang === 'tr' ? `⏰ ${meal.actionBlockedUntilTime ?? ''} itibarıyla açılır` : `⏰ Opens at ${meal.actionBlockedUntilTime ?? ''}`}
        </Text>
      )}
    </View>
  );
}

// ─── Water Widget ─────────────────────────────────────────────────────────────

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
  const pct = Math.min(1, glasses / goal);
  const barWidth = useSharedValue(0);
  const plusScale = useSharedValue(1);
  const dropY = useSharedValue(0);
  const dropOpacity = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withSpring(pct, { damping: 18, stiffness: 120 });
  }, [pct, barWidth]);

  const barStyle = useAnimatedStyle(() => ({ flex: barWidth.value }));
  const plusStyle = useAnimatedStyle(() => ({ transform: [{ scale: plusScale.value }] }));
  const dropStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dropY.value }],
    opacity: dropOpacity.value,
  }));

  function handleAdd() {
    // bounce the button
    plusScale.value = withSequence(
      withSpring(0.82, { damping: 10, stiffness: 400 }),
      withSpring(1,    { damping: 14, stiffness: 300 }),
    );
    // drop animation
    dropY.value = 0;
    dropOpacity.value = 1;
    dropY.value = withTiming(22, { duration: 480 });
    dropOpacity.value = withTiming(0, { duration: 480 });
    onAdd();
  }

  const color = theme.accentCyan;
  const done  = glasses >= goal;

  // render up to 10 drop icons
  const displayGoal = Math.min(goal, 10);
  const filled      = Math.min(glasses, displayGoal);

  return (
    <Animated.View entering={FadeInDown.delay(80).duration(320)} style={[w.card, { backgroundColor: theme.surface, borderColor: done ? `${color}45` : theme.border }]}>
      {/* Header row */}
      <TouchableOpacity onPress={onNavigate} activeOpacity={0.75} style={w.headerRow}>
        <View style={[w.iconBox, { backgroundColor: `${color}16` }]}>
          <Ionicons name="water" size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[w.title, { color: theme.text }]}>
            {lang === 'tr' ? 'Su Takibi' : 'Hydration'}
          </Text>
          <Text style={[w.sub, { color: theme.textMuted }]}>
            {done
              ? (lang === 'tr' ? 'Günlük hedefe ulaştın!' : 'Daily goal reached!')
              : (lang === 'tr' ? `${goal - glasses} bardak kaldı` : `${goal - glasses} glasses left`)}
          </Text>
        </View>
        <Text style={[w.counter, { color: done ? color : theme.text }]}>
          {glasses}<Text style={[w.counterGoal, { color: theme.textMuted }]}>/{goal}</Text>
        </Text>
        <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
      </TouchableOpacity>

      {/* Drop icons row */}
      <View style={w.dropsRow}>
        {Array.from({ length: displayGoal }).map((_, i) => (
          <Ionicons
            key={i}
            name={i < filled ? 'water' : 'water-outline'}
            size={18}
            color={i < filled ? color : `${color}35`}
          />
        ))}
      </View>

      {/* Animated progress bar */}
      <View style={[w.track, { backgroundColor: `${color}14` }]}>
        <Animated.View style={[w.fill, { backgroundColor: color }, barStyle]} />
      </View>

      {/* Action row */}
      <View style={w.actionRow}>
        <TouchableOpacity
          onPress={onRemove}
          disabled={busy || glasses === 0}
          style={[w.minusBtn, { borderColor: theme.border, backgroundColor: theme.surfaceElevated, opacity: glasses === 0 ? 0.4 : 1 }]}
        >
          <Ionicons name="remove" size={18} color={theme.textMuted} />
        </TouchableOpacity>

        {/* Drop floating anim */}
        <View style={w.plusWrap}>
          <Animated.View pointerEvents="none" style={[w.floatDrop, dropStyle]}>
            <Ionicons name="water" size={18} color={color} />
          </Animated.View>
          <Animated.View style={plusStyle}>
            <TouchableOpacity
              onPress={handleAdd}
              disabled={busy || done}
              activeOpacity={1}
              style={[w.plusBtn, { backgroundColor: done ? `${color}22` : color, opacity: done ? 0.7 : 1 }]}
            >
              {busy
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={w.plusTxt}>{lang === 'tr' ? '+1 Bardak' : '+1 Glass'}</Text>
                  </>
              }
            </TouchableOpacity>
          </Animated.View>
        </View>
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

  emptyCard:  { borderRadius: radii.xl, borderWidth: 1, padding: spacing.xl * 1.5, alignItems: 'center', marginTop: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginBottom: spacing.sm },
  emptySub:   { fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },

  errorTitle: { fontSize: 18, fontWeight: '900', marginBottom: spacing.sm, textAlign: 'center' },
  errorSub:   { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.xl },
  retryBtn:   { marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: 14, borderRadius: radii.xl },
  retryTxt:   { color: '#FFF', fontSize: 14, fontWeight: '900' },
});

const w = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title:       { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  sub:         { fontSize: 11, fontWeight: '600', marginTop: 1 },
  counter:     { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  counterGoal: { fontSize: 14, fontWeight: '600' },
  dropsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  minusBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusWrap: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
  },
  floatDrop: {
    position: 'absolute',
    top: -8,
    zIndex: 10,
  },
  plusBtn: {
    width: '100%',
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  plusTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
});
