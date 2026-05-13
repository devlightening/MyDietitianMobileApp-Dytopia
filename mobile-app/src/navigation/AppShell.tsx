import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  StatusBar,
  Easing,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { useInAppNotifications } from "../context/InAppNotificationContext";
import DytopiaLogoBubble from "../components/decor/DytopiaLogoBubble";

import BottomBar, { TabKey } from "../components/BottomBar";
import KitchenQuickSheet from "../components/KitchenQuickSheet";

import DashboardScreen from "../screens/DashboardScreen";
import PlansScreen from "../screens/PlansScreen";
import KitchenScreen from "../screens/KitchenScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";

import type { Ingredient } from "../types/alternative";
import { getPantry } from "../api/pantry";
import { pingGamification } from "../api/gamification";
import { getCareThread } from "../api/care";
import { useGamification } from "../queries/useGamification";
import { useCareSignalR } from "../hooks/useCareSignalR";
import {
  buildBadgeCollection,
  getToneColor,
  mapGamificationToMotivation,
} from "../motivation/streaks";

import BadgeUnlockOverlay, { type BadgeInfo } from "../components/ui/BadgeUnlockOverlay";
import StreakMilestoneToast, { STREAK_MILESTONES } from "../components/ui/StreakMilestoneToast";
import { buildBadgeUnlockedBanner, buildStreakMilestoneBanner } from "../notifications/notificationEvents";
import { migrateLegacyFavoriteRecipes } from "../api/favorites";
import { subscribeToGamificationChanges } from "../utils/gamificationEvents";
import { Routes } from "./routes";

const TAB_ORDER: TabKey[] = ["dashboard", "plans", "kitchen", "messages", "profile"];
const SEEN_BADGES_KEY = "celebrated_badge_unlocks_v2";
const LEGACY_SEEN_BADGES_KEY = "celebrated_badge_ids_v1";
const SEEN_STREAKS_KEY = "celebrated_streak_milestones_v1";
const TAB_SHIFT = 6;
const TAB_EXIT_SHIFT = 4;

function pantrySignature(items: Ingredient[]): string {
  return items
    .map((item) => `${item.id}:${item.canonicalName}`)
    .sort()
    .join("|");
}

type SceneAnimationState = {
  opacity: Animated.Value;
  translateX: Animated.Value;
};

type SceneAnimationMap = Record<TabKey, SceneAnimationState>;
type QueuedBadgeInfo = BadgeInfo & { celebrationKey: string };

function getBadgeCelebrationKey(badge: ReturnType<typeof buildBadgeCollection>[number]): string {
  if (!badge.isDailyReset) {
    return badge.id;
  }

  const unlockedDate = badge.unlockedAtUtc
    ? new Date(badge.unlockedAtUtc).toISOString().slice(0, 10)
    : "daily";

  return `${badge.id}:${unlockedDate}`;
}

export default function AppShell() {
  const { user } = useAuth();
  const isPremium = user?.isPremium === true;
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { notify } = useInAppNotifications();
  const navigation = useNavigation();
  const [active, setActive] = useState<TabKey>("dashboard");
  const [visitedTabs, setVisitedTabs] = useState<TabKey[]>(["dashboard"]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kitchenIngredients, setKitchenIngredients] = useState<Ingredient[]>([]);
  const [pantryIngredients, setPantryIngredients] = useState<Ingredient[]>([]);
  const [messagesAttention, setMessagesAttention] = useState(false);
  const [tabSwipeEnabled, setTabSwipeEnabled] = useState(true);
  const tabSwipeEnabledRef = useRef(true);
  const pantryLoadedRef = useRef(false);
  const lastSyncedPantryRef = useRef("");
  const transitionLockRef = useRef(false);
  const latestInboundMessageIdRef = useRef<string | null>(null);
  const careSeededRef = useRef(false);
  const careRefreshLockRef = useRef(false);
  const sceneAnimationsRef = useRef<SceneAnimationMap>({
    dashboard: { opacity: new Animated.Value(1), translateX: new Animated.Value(0) },
    plans: { opacity: new Animated.Value(0), translateX: new Animated.Value(0) },
    kitchen: { opacity: new Animated.Value(0), translateX: new Animated.Value(0) },
    messages: { opacity: new Animated.Value(0), translateX: new Animated.Value(0) },
    profile: { opacity: new Animated.Value(0), translateX: new Animated.Value(0) },
  });

  // ── Celebration state ────────────────────────────────────────────────────
  const [pendingBadge, setPendingBadge] = useState<QueuedBadgeInfo | null>(null);
  const [badgeQueue, setBadgeQueue] = useState<QueuedBadgeInfo[]>([]);
  const [pendingStreak, setPendingStreak] = useState<number | null>(null);
  // Persistence refs — loaded from SecureStore
  const seenBadgesRef  = useRef<Set<string>>(new Set());
  const seenStreaksRef  = useRef<Set<number>>(new Set());
  const celebInitRef   = useRef(false); // true after first gamification load

  // ── Load persisted seen IDs ──────────────────────────────────────────────
  useEffect(() => {
    void Promise.all([
      SecureStore.getItemAsync(SEEN_BADGES_KEY),
      SecureStore.getItemAsync(LEGACY_SEEN_BADGES_KEY),
    ]).then(([currentVal, legacyVal]) => {
      if (currentVal) {
        (JSON.parse(currentVal) as string[]).forEach(id => seenBadgesRef.current.add(id));
        return;
      }

      if (legacyVal) {
        (JSON.parse(legacyVal) as string[]).forEach(id => seenBadgesRef.current.add(id));
      }
    });
    void SecureStore.getItemAsync(SEEN_STREAKS_KEY).then(val => {
      if (val) (JSON.parse(val) as number[]).forEach(n => seenStreaksRef.current.add(n));
    });
  }, []);

  useEffect(() => {
    if (!user?.isPremium) return;
    void migrateLegacyFavoriteRecipes(user.publicUserId).catch(() => {
      // Non-blocking. Legacy favorites can still be retried on the next app session.
    });
  }, [user?.isPremium, user?.publicUserId]);

  // ── Gamification watch ───────────────────────────────────────────────────
  const { data: gamification, refetch: refetchGamification } = useGamification();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToGamificationChanges(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refetchGamification();
      }, 180);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [refetchGamification]);

  useEffect(() => {
    if (pendingBadge || badgeQueue.length === 0) return;
    const [nextBadge, ...rest] = badgeQueue;
    setPendingBadge(nextBadge);
    setBadgeQueue(rest);
  }, [badgeQueue, pendingBadge]);

  useEffect(() => {
    if (!gamification) return;

    const motivation = mapGamificationToMotivation(gamification);
    if (!motivation) return;

    const badges = buildBadgeCollection(motivation, language);
    const unlocked = badges.filter(b => b.unlocked);

    if (!celebInitRef.current) {
      // First load — mark everything as already seen, no celebration
      unlocked.forEach((badge) => {
        seenBadgesRef.current.add(getBadgeCelebrationKey(badge));
      });
      const streakVal = motivation.currentStreak ?? 0;
      STREAK_MILESTONES.filter(m => m <= streakVal).forEach(m => seenStreaksRef.current.add(m));
      celebInitRef.current = true;
      void SecureStore.setItemAsync(SEEN_BADGES_KEY, JSON.stringify([...seenBadgesRef.current]));
      return;
    }

    // Check for newly unlocked badges
    const recentUnlockIds = new Set(gamification.recentUnlocks ?? []);
    const newBadges = unlocked
      .filter((badge) => !seenBadgesRef.current.has(getBadgeCelebrationKey(badge)))
      .sort((left, right) => {
        const leftRecent = recentUnlockIds.has(left.id) ? 0 : 1;
        const rightRecent = recentUnlockIds.has(right.id) ? 0 : 1;
        return leftRecent - rightRecent || right.priority - left.priority;
      });
    if (newBadges.length > 0) {
      const badgeInfos = newBadges.map((badge) => ({
        celebrationKey: getBadgeCelebrationKey(badge),
        id: badge.id,
        title: badge.title,
        flavor: badge.flavor,
        icon: badge.icon,
        color: getToneColor(theme, badge.tone),
      }));
      setBadgeQueue((current) => {
        const existingKeys = new Set([
          ...current.map((item) => item.celebrationKey),
          ...(pendingBadge ? [pendingBadge.celebrationKey] : []),
        ]);
        return [
          ...current,
          ...badgeInfos.filter((item) => !existingKeys.has(item.celebrationKey)),
        ];
      });
      newBadges.forEach((badge) => {
        notify(buildBadgeUnlockedBanner(language, badge.title, badge.flavor, badge.id));
        seenBadgesRef.current.add(getBadgeCelebrationKey(badge));
      });
      void SecureStore.setItemAsync(SEEN_BADGES_KEY, JSON.stringify([...seenBadgesRef.current]));
      return; // Show badge first, streak toast will wait
    }

    // Check streak milestones
    const streakVal = motivation.currentStreak ?? 0;
    const newMilestone = STREAK_MILESTONES.find(
      m => m === streakVal && !seenStreaksRef.current.has(m)
    );
    if (newMilestone && !pendingStreak && !pendingBadge) {
      setPendingStreak(newMilestone);
      notify(buildStreakMilestoneBanner(language, newMilestone));
      seenStreaksRef.current.add(newMilestone);
      void SecureStore.setItemAsync(SEEN_STREAKS_KEY, JSON.stringify([...seenStreaksRef.current]));
    }
  }, [gamification, language, notify, theme]);

  // ── Tab switching ────────────────────────────────────────────────────────
  const activeRef = useRef<TabKey>("dashboard");
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { tabSwipeEnabledRef.current = tabSwipeEnabled; }, [tabSwipeEnabled]);
  const switchTabFn = useRef<(tab: TabKey) => void>(() => {});

  switchTabFn.current = useCallback((newTab: TabKey) => {
    if (newTab === activeRef.current || transitionLockRef.current) return;

    transitionLockRef.current = true;
    const currentTab = activeRef.current;
    const currentScene = sceneAnimationsRef.current[currentTab];
    const nextScene = sceneAnimationsRef.current[newTab];
    const curIdx  = TAB_ORDER.indexOf(currentTab);
    const nextIdx = TAB_ORDER.indexOf(newTab);
    const dir     = nextIdx > curIdx ? 1 : -1;
    nextScene.opacity.setValue(0);
    nextScene.translateX.setValue(dir * TAB_SHIFT);
    setVisitedTabs((current) => (current.includes(newTab) ? current : [...current, newTab]));
    setActive(newTab);

    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(currentScene.opacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(currentScene.translateX, {
          toValue: -dir * TAB_EXIT_SHIFT,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(nextScene.opacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(nextScene.translateX, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        currentScene.translateX.setValue(0);
        transitionLockRef.current = false;
      });
    });
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        tabSwipeEnabledRef.current &&
        Math.abs(gs.dx) > 28 && Math.abs(gs.dx) > Math.abs(gs.dy) * 3.2,
      onPanResponderEnd: (_, gs) => {
        if (!tabSwipeEnabledRef.current) return;
        const idx  = TAB_ORDER.indexOf(activeRef.current);
        const dist = Math.abs(gs.dx);
        const vel  = Math.abs(gs.vx);
        if (dist < 72 && vel < 0.45) return;
        if (gs.dx < 0 && idx < TAB_ORDER.length - 1) switchTabFn.current(TAB_ORDER[idx + 1]);
        else if (gs.dx > 0 && idx > 0) switchTabFn.current(TAB_ORDER[idx - 1]);
      },
    })
  ).current;

  const handleTabChange = useCallback((tab: TabKey) => {
    if (tab === "messages") setMessagesAttention(false);
    switchTabFn.current(tab);
  }, []);

  const handleTabSwipeEnabledChange = useCallback((enabled: boolean) => {
    tabSwipeEnabledRef.current = enabled;
    setTabSwipeEnabled(enabled);
  }, []);

  const openPlansTab = useCallback(() => switchTabFn.current("plans"), []);
  const openKitchenTab = useCallback(() => switchTabFn.current("kitchen"), []);
  const openMessagesTab = useCallback(() => {
    setMessagesAttention(false);
    switchTabFn.current("messages");
  }, []);
  const openQuickKitchen = useCallback(() => setSheetOpen(true), []);
  const openGameCenter = useCallback(() => {
    setSheetOpen(false);
    navigation.navigate(Routes.App.GameCenter as never);
  }, [navigation]);

  const refreshCareAttention = useCallback(async () => {
    if (!isPremium) {
      setMessagesAttention(false);
      careSeededRef.current = false;
      latestInboundMessageIdRef.current = null;
      return;
    }
    if (careRefreshLockRef.current) return;
    careRefreshLockRef.current = true;
    try {
      const thread = await getCareThread();
      const latestInbound = [...thread.items]
        .filter((item) => item.direction === "inbound")
        .sort((left, right) => new Date(right.createdAtUtc).getTime() - new Date(left.createdAtUtc).getTime())[0];

      const nextInboundId = latestInbound?.id ?? null;
      if (!careSeededRef.current) {
        latestInboundMessageIdRef.current = nextInboundId;
        careSeededRef.current = true;
        if (activeRef.current === "messages") setMessagesAttention(false);
        return;
      }

      const hasNewInbound = !!nextInboundId && nextInboundId !== latestInboundMessageIdRef.current;
      latestInboundMessageIdRef.current = nextInboundId;

      if (activeRef.current === "messages") {
        setMessagesAttention(false);
        return;
      }

      if (hasNewInbound) {
        setMessagesAttention(true);
      }
    } catch {
      // Sessiz kal: alt bar dikkat işareti arka plan iyileştirmesidir.
    } finally {
      careRefreshLockRef.current = false;
    }
  }, [isPremium]);

  useCareSignalR(() => {
    void refreshCareAttention();
  }, isPremium);

  useEffect(() => {
    if (!isPremium) {
      setMessagesAttention(false);
      return;
    }
    void refreshCareAttention();
  }, [isPremium, refreshCareAttention]);

  useEffect(() => {
    if (!isPremium) {
      setMessagesAttention(false);
      return;
    }
    if (active === "messages") {
      setMessagesAttention(false);
      void refreshCareAttention();
    }
  }, [active, isPremium, refreshCareAttention]);

  // ── Pantry ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    async function hydratePantry() {
      try {
        void pingGamification().catch(() => undefined);
        const pantryItems = await getPantry();
        if (!alive) return;
        const normalized = pantryItems.map(item => ({
          id: item.ingredientId,
          canonicalName: item.ingredientName,
        }));
        setPantryIngredients(normalized);
        setKitchenIngredients((current) => current.length > 0 ? current : normalized);
        lastSyncedPantryRef.current = pantrySignature(normalized);
      } catch {
        if (!alive) return;
      } finally {
        pantryLoadedRef.current = true;
      }
    }
    void hydratePantry();
    return () => {
      alive = false;
    };
  }, []);

  // Re-hydrate pantry from backend whenever Shell regains focus after a
  // stack-screen is popped. Kitchen keeps its own temporary pot state; only
  // PantryScreen writes durable pantry changes.
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (!pantryLoadedRef.current) return; // Skip the very first focus (hydratePantry handles it)
      void getPantry()
        .then((items) => {
          const normalized = items.map((item) => ({
            id: item.ingredientId,
            canonicalName: item.ingredientName,
          }));
          const newSig = pantrySignature(normalized);
          if (newSig === lastSyncedPantryRef.current) return;
          lastSyncedPantryRef.current = newSig;
          setPantryIngredients(normalized);
        })
        .catch(() => undefined);
    });
    return unsubscribe;
  }, [navigation]);

  const handlePantryUpdated = useCallback((ingredients: Ingredient[]) => {
    setPantryIngredients(ingredients);
    lastSyncedPantryRef.current = pantrySignature(ingredients);
  }, []);

  // ── Screens ──────────────────────────────────────────────────────────────
  const dashboardScene = useMemo(() => (
    <DashboardScreen
      isActive={active === "dashboard"}
      onPressPlans={openPlansTab}
      onPressKitchen={openKitchenTab}
      onPressMessages={openMessagesTab}
      onTabSwipeEnabledChange={handleTabSwipeEnabledChange}
    />
  ), [active, handleTabSwipeEnabledChange, openKitchenTab, openMessagesTab, openPlansTab]);

  const plansScene = useMemo(() => (
    <PlansScreen
      isActive={active === "plans"}
      onPressKitchen={openKitchenTab}
      onTabSwipeEnabledChange={handleTabSwipeEnabledChange}
    />
  ), [active, handleTabSwipeEnabledChange, openKitchenTab]);

  const kitchenScene = useMemo(() => (
    <KitchenScreen
      selectedIngredients={kitchenIngredients}
      onChangeSelected={setKitchenIngredients}
      pantryIngredients={pantryIngredients}
      onChangePantry={handlePantryUpdated}
      openQuickSheet={openQuickKitchen}
      isActive={active === "kitchen"}
      onTabSwipeEnabledChange={handleTabSwipeEnabledChange}
    />
  ), [active, handlePantryUpdated, handleTabSwipeEnabledChange, kitchenIngredients, openQuickKitchen, pantryIngredients]);

  const messagesScene = useMemo(() => (
    <MessagesScreen isActive={active === "messages"} />
  ), [active]);

  const profileScene = useMemo(() => <ProfileScreen />, []);

  const scenes = useMemo<Record<TabKey, React.ReactNode>>(() => ({
    dashboard: dashboardScene,
    plans: plansScene,
    kitchen: kitchenScene,
    messages: messagesScene,
    profile: profileScene,
  }), [dashboardScene, kitchenScene, messagesScene, plansScene, profileScene]);

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <DytopiaLogoBubble size={200} opacity={0.3} logoOpacity={0.36} style={s.blobA} />
      <DytopiaLogoBubble size={160} opacity={0.24} logoOpacity={0.34} style={s.blobB} />
      <DytopiaLogoBubble size={126} opacity={0.18} logoOpacity={0.32} style={s.blobC} />

      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />

      <View style={s.sceneDeck} {...panResponder.panHandlers}>
        {TAB_ORDER.map((tab) => {
          if (!visitedTabs.includes(tab)) return null;
          const scene = sceneAnimationsRef.current[tab];
          const isSceneActive = active === tab;
          return (
            <Animated.View
              key={tab}
              pointerEvents={isSceneActive ? "auto" : "none"}
              style={[
                s.sceneLayer,
                {
                  opacity: scene.opacity,
                  zIndex: isSceneActive ? 2 : 1,
                  transform: [
                    { translateX: scene.translateX },
                  ],
                },
              ]}
            >
              {scenes[tab]}
            </Animated.View>
          );
        })}
      </View>

      <BottomBar active={active} onChange={handleTabChange} onOpenGames={openGameCenter} messagesAttention={messagesAttention} />

      <KitchenQuickSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selectedIngredients={kitchenIngredients}
        onChangeSelected={setKitchenIngredients}
        onGoKitchen={() => { setSheetOpen(false); switchTabFn.current("kitchen"); }}
      />

      {/* ── Celebrations ── */}
      <StreakMilestoneToast
        streak={pendingStreak}
        onDismiss={() => setPendingStreak(null)}
      />

      <BadgeUnlockOverlay
        badge={pendingBadge}
        onDismiss={() => setPendingBadge(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  sceneDeck: { flex: 1 },
  sceneLayer: { ...StyleSheet.absoluteFillObject },
  blobA: { position: "absolute", top: -56,   right: -30, width: 200, height: 200, borderRadius: 100, opacity: 0.42 },
  blobB: { position: "absolute", bottom: 116, left: -60,  width: 160, height: 160, borderRadius: 80,  opacity: 0.34 },
  blobC: { position: "absolute", top: "40%", right: -70,  width: 126, height: 126, borderRadius: 63,  opacity: 0.26 },
});
