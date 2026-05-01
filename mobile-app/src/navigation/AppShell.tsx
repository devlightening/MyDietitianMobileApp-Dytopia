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
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { useInAppNotifications } from "../context/InAppNotificationContext";
import ProduceBubble from "../components/decor/ProduceBubble";

import BottomBar, { TabKey } from "../components/BottomBar";
import KitchenQuickSheet from "../components/KitchenQuickSheet";

import DashboardScreen from "../screens/DashboardScreen";
import PlansScreen from "../screens/PlansScreen";
import KitchenScreen from "../screens/KitchenScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";

import type { Ingredient } from "../types/alternative";
import { getPantry, replacePantry } from "../api/pantry";
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

const TAB_ORDER: TabKey[] = ["dashboard", "plans", "kitchen", "messages", "profile"];
const SEEN_BADGES_KEY = "celebrated_badge_ids_v1";
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

export default function AppShell() {
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { notify } = useInAppNotifications();
  const navigation = useNavigation();
  const [active, setActive] = useState<TabKey>("dashboard");
  const [visitedTabs, setVisitedTabs] = useState<TabKey[]>(["dashboard"]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Ingredient[]>([]);
  const [messagesAttention, setMessagesAttention] = useState(false);
  const [tabSwipeEnabled, setTabSwipeEnabled] = useState(true);
  const tabSwipeEnabledRef = useRef(true);
  const pantryLoadedRef = useRef(false);
  const pantryHydratingRef = useRef(true);
  const lastSyncedPantryRef = useRef("");
  const pantrySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [pendingBadge, setPendingBadge] = useState<BadgeInfo | null>(null);
  const [pendingStreak, setPendingStreak] = useState<number | null>(null);

  // Persistence refs — loaded from SecureStore
  const seenBadgesRef  = useRef<Set<string>>(new Set());
  const seenStreaksRef  = useRef<Set<number>>(new Set());
  const celebInitRef   = useRef(false); // true after first gamification load

  // ── Load persisted seen IDs ──────────────────────────────────────────────
  useEffect(() => {
    void SecureStore.getItemAsync(SEEN_BADGES_KEY).then(val => {
      if (val) (JSON.parse(val) as string[]).forEach(id => seenBadgesRef.current.add(id));
    });
    void SecureStore.getItemAsync(SEEN_STREAKS_KEY).then(val => {
      if (val) (JSON.parse(val) as number[]).forEach(n => seenStreaksRef.current.add(n));
    });
  }, []);

  // ── Gamification watch ───────────────────────────────────────────────────
  const { data: gamification } = useGamification();

  useEffect(() => {
    if (!gamification) return;

    const motivation = mapGamificationToMotivation(gamification);
    if (!motivation) return;

    const badges = buildBadgeCollection(motivation, 'tr');
    const unlocked = badges.filter(b => b.unlocked);

    if (!celebInitRef.current) {
      // First load — mark everything as already seen, no celebration
      unlocked.forEach(b => seenBadgesRef.current.add(b.id));
      const streakVal = motivation.currentStreak ?? 0;
      STREAK_MILESTONES.filter(m => m <= streakVal).forEach(m => seenStreaksRef.current.add(m));
      celebInitRef.current = true;
      return;
    }

    // Check for newly unlocked badges
    const newBadges = unlocked.filter(b => !seenBadgesRef.current.has(b.id));
    if (newBadges.length > 0 && !pendingBadge) {
      const badge = newBadges[0];
      setPendingBadge({
        id: badge.id,
        title: badge.title,
        flavor: badge.flavor,
        icon: badge.icon,
        color: getToneColor(theme, badge.tone),
      });
      notify(buildBadgeUnlockedBanner(language, badge.title, badge.flavor, badge.id));
      unlocked.forEach(b => seenBadgesRef.current.add(b.id));
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
  }, [gamification]);

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
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2.8,
      onPanResponderEnd: (_, gs) => {
        if (!tabSwipeEnabledRef.current) return;
        const idx  = TAB_ORDER.indexOf(activeRef.current);
        const dist = Math.abs(gs.dx);
        const vel  = Math.abs(gs.vx);
        if (dist < 50 && vel < 0.35) return;
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

  const refreshCareAttention = useCallback(async () => {
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
  }, []);

  useCareSignalR(() => {
    void refreshCareAttention();
  }, true);

  useEffect(() => {
    void refreshCareAttention();
  }, [refreshCareAttention]);

  useEffect(() => {
    if (active === "messages") {
      setMessagesAttention(false);
      void refreshCareAttention();
    }
  }, [active, refreshCareAttention]);

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
        setSelected(normalized);
        lastSyncedPantryRef.current = pantrySignature(normalized);
      } catch {
        if (!alive) return;
        setSelected(current => current);
      } finally {
        pantryHydratingRef.current = false;
        pantryLoadedRef.current = true;
      }
    }
    void hydratePantry();
    return () => {
      alive = false;
      pantryHydratingRef.current = false;
      if (pantrySaveTimerRef.current) clearTimeout(pantrySaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pantryLoadedRef.current || pantryHydratingRef.current) return;
    const signature = pantrySignature(selected);
    if (signature === lastSyncedPantryRef.current) return;

    if (pantrySaveTimerRef.current) clearTimeout(pantrySaveTimerRef.current);

    pantrySaveTimerRef.current = setTimeout(() => {
      // Re-check: by the time the timer fires, a focus re-hydration may have
      // already synced lastSyncedPantryRef — skip the PUT if signatures match.
      const currentSignature = pantrySignature(selected);
      if (currentSignature === lastSyncedPantryRef.current) return;
      void replacePantry(selected)
        .then(() => {
          lastSyncedPantryRef.current = currentSignature;
        })
        .catch(() => undefined);
    }, 1500);

    return () => { if (pantrySaveTimerRef.current) clearTimeout(pantrySaveTimerRef.current); };
  }, [selected]);

  // Re-hydrate pantry from backend whenever Shell regains focus after a
  // stack-screen (PantryScreen, RecipeDetail, etc.) is popped.  This prevents
  // the auto-save from overwriting changes made inside PantryScreen.
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
          // Update ref FIRST so the auto-save effect sees a match and skips the PUT
          lastSyncedPantryRef.current = newSig;
          setSelected(normalized);
        })
        .catch(() => undefined);
    });
    return unsubscribe;
  }, [navigation]);

  // ── Screens ──────────────────────────────────────────────────────────────
  const dashboardScene = useMemo(() => (
    <DashboardScreen
      isActive={active === "dashboard"}
      onPressPlans={openPlansTab}
      onPressKitchen={openKitchenTab}
      onPressMessages={openMessagesTab}
    />
  ), [active, openKitchenTab, openMessagesTab, openPlansTab]);

  const plansScene = useMemo(() => (
    <PlansScreen
      isActive={active === "plans"}
      onPressKitchen={openKitchenTab}
      onTabSwipeEnabledChange={handleTabSwipeEnabledChange}
    />
  ), [active, handleTabSwipeEnabledChange, openKitchenTab]);

  const kitchenScene = useMemo(() => (
    <KitchenScreen
      selectedIngredients={selected}
      onChangeSelected={setSelected}
      openQuickSheet={openQuickKitchen}
      isActive={active === "kitchen"}
    />
  ), [active, openQuickKitchen, selected]);

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
      <ProduceBubble icon="food-apple-outline" iconSize={34} iconColor={`${theme.primary}42`} style={[s.blobA, { backgroundColor: theme.primaryGlow }]} />
      <ProduceBubble icon="carrot" iconSize={30} iconColor={`${theme.emerald}42`} style={[s.blobB, { backgroundColor: theme.emeraldGlow }]} />
      <ProduceBubble icon="fruit-pear" iconSize={28} iconColor={`${theme.accent}50`} style={[s.blobC, { backgroundColor: `${theme.accent}22` }]} />

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

      <BottomBar active={active} onChange={handleTabChange} messagesAttention={messagesAttention} />

      <KitchenQuickSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selectedIngredients={selected}
        onChangeSelected={setSelected}
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
