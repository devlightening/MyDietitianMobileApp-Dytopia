/**
 * AURA CLINICAL OS — Daily Ritual Hub
 * Redesigned: actionable cards, real data, clear hierarchy
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Alert,
} from 'react-native';
import Animated from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Routes } from '../navigation/routes';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { spacing, radii } from '../theme/tokens';
import { useDashboard } from '../queries/useDashboard';
import { useGamification } from '../queries/useGamification';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFadeRise, useStaggerItem, useHeroEntrance, useHaloBreathe, useShimmerBand, useFloating } from '../hooks/useAuraMotion';
import api from '../api/client';
import { updateTodayTracking } from '../api/progress';
import ProduceBubble from '../components/decor/ProduceBubble';
import { refreshWidgetsFromApp } from '../widgets/services/widgetSyncService';
import * as Haptics from 'expo-haptics';
import {
  type DashboardMotivation,
  buildMotivationSummary,
  getBadgeMeta,
  getHighlightAchievements,
  getToneColor,
  mapGamificationToMotivation,
} from '../motivation/streaks';
import { getPlansData, type ClientPlan } from '../data/plansRepo';
import { useQuery } from '@tanstack/react-query';

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

const noop = () => {};

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
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={24}
        iconColor={`${theme.primary}34`}
        style={[s.dayBandBlobA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="leaf"
        iconSize={18}
        iconColor={`${theme.emerald}3A`}
        style={[s.dayBandBlobB, { backgroundColor: theme.emeraldGlow }]}
      />
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

function AmbientProduceBubbles({
  theme,
}: {
  theme: import('../theme/tokens').Theme;
}) {
  const bubbles = [
    {
      key: 'apple-top',
      icon: 'food-apple-outline' as const,
      size: 134,
      top: 96,
      right: 12,
      iconSize: 32,
      iconColor: `${theme.primary}46`,
      bg: `${theme.primary}18`,
    },
    {
      key: 'carrot-mid',
      icon: 'carrot' as const,
      size: 118,
      top: 352,
      left: -12,
      iconSize: 28,
      iconColor: `${theme.emerald}44`,
      bg: `${theme.emerald}16`,
    },
    {
      key: 'pear-lower',
      icon: 'fruit-pear' as const,
      size: 112,
      top: 652,
      right: -10,
      iconSize: 26,
      iconColor: `${theme.primary}40`,
      bg: `${theme.primary}14`,
    },
    {
      key: 'leaf-bottom',
      icon: 'leaf' as const,
      size: 124,
      top: 974,
      left: -24,
      iconSize: 30,
      iconColor: `${theme.emerald}42`,
      bg: `${theme.emerald}15`,
    },
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bubbles.map(bubble => (
        <View
          key={bubble.key}
          style={[
            s.produceBubble,
            {
              width: bubble.size,
              height: bubble.size,
              borderRadius: bubble.size / 2,
              top: bubble.top,
              left: bubble.left,
              right: bubble.right,
              backgroundColor: bubble.bg,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={bubble.icon}
            size={bubble.iconSize}
            color={bubble.iconColor}
          />
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen({
  onPressPlans,
  onPressKitchen,
  onPressMessages,
}: {
  onPressPlans?: () => void;
  onPressKitchen?: () => void;
  onPressMessages?: () => void;
} = {}) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { t, language } = useTranslation();
  const { data, isLoading, refetch, isRefetching } = useDashboard();
  const { data: gamification } = useGamification();
  const { data: plansData } = useQuery({
    queryKey: ['client-plans'],
    queryFn: getPlansData,
    enabled: user?.isPremium ?? false,
    staleTime: 2 * 60 * 1000,
  });
  const activePlan = plansData?.plans.find(p => p.isActive) ?? null;

  const compliancePercent = data?.compliancePercent ?? 0;
  const todayStatus       = data?.todayStatus ?? 'on-track';
  const nextMeal          = data?.nextMeal;
  const summary           = data?.summary;
  const motivation        = mapGamificationToMotivation(gamification) ?? data?.motivation;
  const streakValue       = gamification?.currentStreak ?? summary?.streak ?? 0;
  const [localWater, setLocalWater] = useState<number | null>(null);
  const waterValue = localWater ?? gamification?.today?.waterGlasses ?? summary?.waterGlasses ?? 0;

  useEffect(() => {
    const remote = gamification?.today?.waterGlasses ?? summary?.waterGlasses;
    if (remote != null && localWater === null) setLocalWater(remote);
  }, [gamification, summary]);

  const handleAddWater = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = waterValue + 1;
    setLocalWater(next);
    try {
      await updateTodayTracking(next);
      void refreshWidgetsFromApp(user?.isPremium ?? false);
    } catch {
      setLocalWater(waterValue);
    }
  }, [user?.isPremium, waterValue]);

  const heroStyle    = useHeroEntrance();
  const actionsStyle = useFadeRise(160, 10);
  const gridStyle    = useFadeRise(280, 12);

  const handleActivate = useCallback(() => {
    (navigation as any).navigate(Routes.Modal.ActivatePremium);
  }, [navigation]);

  const handleMeasurements = useCallback(() => {
    (navigation as any).navigate(Routes.App.ProfileMeasurements);
  }, [navigation]);

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <AmbientProduceBubbles theme={theme} />
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={34}
        iconColor={`${theme.primary}44`}
        style={[s.screenGlowA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="carrot"
        iconSize={28}
        iconColor={`${theme.emerald}42`}
        style={[s.screenGlowB, { backgroundColor: theme.emeraldGlow }]}
      />

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
        {/* ═══════ HERO CAPSULE ═══════ */}
        <DayHeaderBand
          theme={theme}
          language={language}
          title={user?.isPremium ? "Bugün için iyi bir ritim kur." : "MyDietitian'a yeni bir görünüm geldi."}
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

        {/* ═══════ SMART ACTIONS RAIL ═══════ */}
        <Animated.View style={[actionsStyle]}>
          <SmartActionsRail
            theme={theme}
            isPremium={user?.isPremium ?? false}
            onPressPlans={onPressPlans}
            onPressKitchen={onPressKitchen}
            onPressMessages={onPressMessages}
            onPressActivate={handleActivate}
            onPressMeasurements={handleMeasurements}
          />
        </Animated.View>

        {/* ═══════ CONTENT GRID ═══════ */}
        {isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <Animated.View style={[gridStyle]}>
            {user?.isPremium ? (
              <PremiumGrid
                theme={theme}
                compliancePercent={compliancePercent}
                streak={streakValue}
                water={waterValue}
                motivation={motivation}
                nextMeal={nextMeal}
                dietitianNote={data?.dietitianNote}
                activePlan={activePlan}
                onPressKitchen={onPressKitchen}
                onPressPlans={onPressPlans}
                onPressMessages={onPressMessages}
                onPressMeasurements={handleMeasurements}
                onPressWater={handleAddWater}
                language={language}
              />
            ) : (
              <FreeGrid
                theme={theme}
                publicUserId={user?.publicUserId}
                onPressActivate={handleActivate}
                onPressKitchen={onPressKitchen}
                onPressMeasurements={handleMeasurements}
              />
            )}
          </Animated.View>
        )}

        <View style={s.bottomPad} />
      </ScrollView>
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   HERO CAPSULE
══════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════
   SMART ACTIONS RAIL
══════════════════════════════════════════════════════ */
function makeActionsPremium(d: { actionPlans: string; actionKitchen: string; actionMeasures: string; actionMessages: string }) {
  return [
    { id: 'plans',    icon: 'calendar-outline'   as const, label: d.actionPlans,    color: '#1FA876' },
    { id: 'kitchen',  icon: 'restaurant-outline' as const, label: d.actionKitchen,  color: '#38BDF8' },
    { id: 'measures', icon: 'body-outline'       as const, label: d.actionMeasures, color: '#F59E0B' },
    { id: 'messages', icon: 'mail-outline'       as const, label: d.actionMessages, color: '#E879F9' },
  ];
}

function makeActionsFree(d: { actionRecipes: string; actionPremium: string; actionMeasures: string; actionCopyId: string }) {
  return [
    { id: 'kitchen',  icon: 'restaurant-outline' as const, label: d.actionRecipes,  color: '#1FA876' },
    { id: 'activate', icon: 'key-outline'        as const, label: d.actionPremium,  color: '#F59E0B' },
    { id: 'measures', icon: 'body-outline'       as const, label: d.actionMeasures, color: '#38BDF8' },
    { id: 'share',    icon: 'copy-outline'       as const, label: d.actionCopyId,   color: '#E879F9' },
  ];
}

function SmartActionsRail({
  theme, isPremium, onPressPlans, onPressKitchen, onPressMessages,
  onPressActivate, onPressMeasurements,
}: {
  theme: import('../theme/tokens').Theme;
  isPremium: boolean;
  onPressPlans?: () => void;
  onPressKitchen?: () => void;
  onPressMessages?: () => void;
  onPressActivate: () => void;
  onPressMeasurements: () => void;
}) {
  const { user } = useAuth();
  const { t } = useTranslation();

  function handleShare() {
    if (user?.publicUserId) {
      Clipboard.setStringAsync(user.publicUserId).then(() => {
        Alert.alert(t.common.copied, `${t.dashboard.userId}:\n${user.publicUserId}`);
      });
    }
  }

  const actions = isPremium ? makeActionsPremium(t.dashboard) : makeActionsFree(t.dashboard);
  const handlers: Record<string, () => void> = {
    plans:    onPressPlans    ?? noop,
    kitchen:  onPressKitchen  ?? noop,
    measures: onPressMeasurements,
    messages: onPressMessages ?? noop,
    activate: onPressActivate,
    share:    handleShare,
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
          onPress={handlers[action.id] ?? noop}
        />
      ))}
    </View>
  );
}

function ActionChip({
  icon, label, color, theme, index, onPress,
}: {
  icon: any; label: string; color: string;
  theme: import('../theme/tokens').Theme;
  index: number; onPress: () => void;
}) {
  const style = useStaggerItem(index, 160, 45);
  return (
    <Animated.View style={style}>
      <TouchableOpacity
        style={[s.actionChip, { backgroundColor: `${color}12`, borderColor: `${color}28` }]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <View style={[s.actionIconWrap, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={[s.actionLabel, { color: theme.text }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ══════════════════════════════════════════════════════
   PREMIUM GRID
══════════════════════════════════════════════════════ */
function PremiumGrid({
  theme, compliancePercent, streak, water, motivation, nextMeal, dietitianNote,
  activePlan, onPressKitchen, onPressPlans, onPressMessages, onPressMeasurements,
  onPressWater, language,
}: {
  theme: import('../theme/tokens').Theme;
  compliancePercent: number;
  streak: number;
  water: number;
  motivation?: DashboardMotivation;
  nextMeal?: any;
  dietitianNote?: string;
  activePlan?: ClientPlan | null;
  onPressKitchen?: () => void;
  onPressPlans?: () => void;
  onPressMessages?: () => void;
  onPressMeasurements: () => void;
  onPressWater?: () => void;
  language: 'tr' | 'en';
}) {
  let idx = 0;
  return (
    <View style={s.grid}>
      <StatsShelf
        theme={theme}
        compliancePercent={compliancePercent}
        streak={streak}
        water={water}
        language={language}
        index={idx++}
        onPressWater={onPressWater}
      />

      {/* Active Plan block — always shown for premium; shows plan if assigned, empty state otherwise */}
      <ActivePlanBlock
        theme={theme}
        plan={activePlan ?? null}
        onPressPlans={onPressPlans}
        language={language}
        index={idx++}
      />

      <MotivationShelf
        theme={theme}
        motivation={motivation}
        language={language}
        index={idx++}
      />

      {nextMeal && (
        <NextMealCard
          theme={theme}
          meal={nextMeal}
          onPressPlans={onPressPlans}
          index={idx++}
        />
      )}

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
    </View>
  );
}

/* ── Active Plan Block ── */
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

/* ── Stats Shelf ── */
function StatsShelf({ theme, compliancePercent, streak, water, language, index, onPressWater }: {
  theme: import('../theme/tokens').Theme;
  compliancePercent: number; streak: number; water: number; language: 'tr' | 'en'; index: number;
  onPressWater?: () => void;
}) {
  const style = useStaggerItem(index, 300, 60);
  const { t } = useTranslation();
  return (
    <Animated.View style={[s.statsShelf, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <StatCell value={`${streak}`}            unit={t.dashboard.days}    label={t.dashboard.streak}   color={theme.accent}     iconName="flame-outline" />
      <View style={[s.statDivider, { backgroundColor: theme.borderLight }]} />
      <StatCell value={`${compliancePercent}`} unit="%"                   label={language === 'tr' ? 'Uyum' : 'Adherence'} color={theme.emerald}    iconName="checkmark-circle-outline" />
      <View style={[s.statDivider, { backgroundColor: theme.borderLight }]} />
      <TouchableOpacity onPress={onPressWater} activeOpacity={onPressWater ? 0.7 : 1} style={s.waterCell}>
        <StatCell value={`${water}`} unit={t.dashboard.glasses} label={t.dashboard.water} color={theme.accentCyan} iconName="water-outline" />
        {onPressWater && (
          <View style={[s.waterPlus, { backgroundColor: theme.accentCyan }]}>
            <Ionicons name="add" size={10} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function MotivationShelf({
  theme,
  motivation,
  language,
  index,
}: {
  theme: import('../theme/tokens').Theme;
  motivation?: DashboardMotivation;
  language: 'tr' | 'en';
  index: number;
}) {
  const style = useStaggerItem(index, 300, 60);
  const summary = buildMotivationSummary(motivation, language);
  const badges = getHighlightAchievements(motivation, language, 3);

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
          <View>
            <Text style={[s.motivationEyebrow, { color: theme.emerald }]}>
              {language === 'tr' ? 'SERI ALANI' : 'STREAK LANE'}
            </Text>
            <Text style={[s.motivationTitle, { color: theme.text }]}>{summary.title}</Text>
            <Text style={[s.motivationSubtitle, { color: theme.textSub }]}>{summary.subtitle}</Text>
          </View>
          <View style={[s.streakBubble, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
            <Text style={[s.streakBubbleValue, { color: theme.emerald }]}>{motivation?.currentStreak ?? 0}</Text>
            <Text style={[s.streakBubbleLabel, { color: theme.textMuted }]}>
              {language === 'tr' ? 'gun' : 'days'}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.badgeRail}>
          {badges.map((badge) => {
            const meta = getBadgeMeta(badge.id, language);
            const accent = getToneColor(theme, meta.tone);
            const ratio = badge.progressTarget > 0 ? badge.progressCurrent / badge.progressTarget : 0;
            return (
              <View
                key={badge.id}
                style={[
                  s.badgeCard,
                  {
                    backgroundColor: badge.unlocked ? `${accent}10` : theme.surfaceElevated,
                    borderColor: badge.unlocked ? `${accent}34` : theme.border,
                  },
                ]}
              >
                <View style={[s.badgeSeal, { backgroundColor: `${accent}14`, borderColor: `${accent}30` }]}>
                  <View style={[s.badgeCore, { backgroundColor: theme.surface }]}>
                    <MaterialCommunityIcons name={meta.icon} size={22} color={accent} />
                  </View>
                  {badge.unlocked && (
                    <View style={[s.badgeCheck, { backgroundColor: theme.accentGold }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[s.badgeTitle, { color: theme.text }]} numberOfLines={2}>
                  {meta.title}
                </Text>
                <Text style={[s.badgeSubtitle, { color: theme.textMuted }]} numberOfLines={2}>
                  {meta.subtitle}
                </Text>
                <View style={[s.badgeProgressTrack, { backgroundColor: theme.borderLight }]}>
                  <View
                    style={[
                      s.badgeProgressFill,
                      { width: `${Math.max(8, Math.round(ratio * 100))}%`, backgroundColor: accent },
                    ]}
                  />
                </View>
              </View>
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
            <Ionicons name="sparkles-outline" size={12} color={theme.primary} />
            <Text style={[s.footerPillText, { color: theme.textSub }]}>
              {motivation && motivation.nextMilestoneDays > 0
                ? (language === 'tr'
                    ? `sonraki seri: ${motivation.nextMilestoneDays} gün`
                    : `next streak: ${motivation.nextMilestoneDays} days`)
                : (language === 'tr' ? 'ana seri açık' : 'core streak live')}
            </Text>
          </View>
        </View>
      </View>
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

/* ── Next Meal Card ── */
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

/* ── Dietitian Note Card ── */
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

/* ── Latest Measurements Card ── */
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

/* ── Kitchen Entry Card ── */
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
              Malzemelerinden tarif öner
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

/* ══════════════════════════════════════════════════════
   FREE GRID
══════════════════════════════════════════════════════ */
function FreeGrid({ theme, publicUserId, onPressActivate, onPressKitchen, onPressMeasurements }: {
  theme: import('../theme/tokens').Theme;
  publicUserId?: string;
  onPressActivate: () => void;
  onPressKitchen?: () => void;
  onPressMeasurements: () => void;
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

      {/* User ID card — share with dietitian */}
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
      </Animated.View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════ */
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
  scroll:      { paddingTop: 68, paddingHorizontal: spacing.base },
  loadingWrap: { paddingTop: 60, alignItems: 'center' },
  bottomPad:   { height: 138 },
  screenGlowA: {
    position: 'absolute',
    top: 18,
    right: -58,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.72,
  },
  screenGlowB: {
    position: 'absolute',
    top: 330,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.5,
  },
  dayBand: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: 16,
    marginBottom: spacing.md,
    overflow: 'hidden',
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
    marginBottom: 12,
  },
  dayBandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayBandChipText: { fontSize: 11, fontWeight: '800' },
  dayBandMini: {
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dayBandMiniText: { fontSize: 10, fontWeight: '800' },
  dayBandTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 28,
    marginBottom: 4,
    maxWidth: 280,
  },
  dayBandSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 310,
    opacity: 0.88,
  },

  /* Hero Capsule */
  heroCapsule: {
    borderRadius: radii.xxl, borderWidth: 1, padding: 22, marginBottom: spacing.md,
    overflow: 'hidden', shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },
  heroHaloRing: { borderRadius: radii.xxl, borderWidth: 1.5 },
  heroGlowTR: { position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: 80, opacity: 0.20 },
  heroGlowBL: { position: 'absolute', bottom: -30, left: -40, width: 120, height: 120, borderRadius: 60, opacity: 0.12 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
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
  heroGreetingBlock: { marginBottom: 16 },
  heroGreeting:      { fontSize: 12, fontWeight: '500', marginBottom: 3 },
  heroName:          { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, lineHeight: 33 },
  heroProgressBlock:  { marginBottom: 14 },
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
  actionsRail: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  actionChip: {
    flex: 1, alignItems: 'center', borderRadius: radii.lg, borderWidth: 1,
    paddingVertical: 12, paddingHorizontal: 6, gap: 6,
  },
  actionIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 9.5, fontWeight: '700', textAlign: 'center' },

  /* Grid */
  grid: { gap: spacing.sm },

  /* Stats Shelf */
  statsShelf: {
    flexDirection: 'row', borderRadius: radii.xl, borderWidth: 1,
    paddingVertical: 16, overflow: 'hidden', marginBottom: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
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
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 16,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
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
  badgeRail: { gap: 10, paddingRight: 8 },
  badgeCard: {
    width: 154,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
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
  motivationFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
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

  /* Next Meal Card */
  nextMealCard: {
    borderRadius: radii.xl, borderWidth: 1, padding: 16, marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5,
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
    borderRadius: radii.xl, borderWidth: 1, padding: 16, marginBottom: spacing.sm,
  },
  notePinRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  notePinDot:   { width: 5, height: 5, borderRadius: 2.5 },
  notePinLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 },
  noteText:     { fontSize: 13, fontWeight: '500', lineHeight: 19, marginBottom: 10 },
  noteCtaRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  noteCtaTxt:   { fontSize: 11, fontWeight: '800' },

  /* Measurements Card */
  measCard: {
    borderRadius: radii.xl, borderWidth: 1, padding: 16, marginBottom: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 4,
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
    borderRadius: radii.xl, borderWidth: 1, padding: 16, marginBottom: spacing.sm, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5,
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
    borderRadius: radii.xl, borderWidth: 1, padding: 16, marginBottom: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
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
