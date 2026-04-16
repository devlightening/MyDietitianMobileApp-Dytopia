import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  StatusBar,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
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

const TAB_ORDER: TabKey[] = ["dashboard", "plans", "kitchen", "messages", "profile"];

export default function AppShell() {
  const { theme, isDark } = useTheme();
  const [active, setActive] = useState<TabKey>("dashboard");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Ingredient[]>([]);
  const pantryLoadedRef = useRef(false);
  const pantrySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeRef = useRef<TabKey>("dashboard");
  useEffect(() => { activeRef.current = active; }, [active]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const switchTabFn = useRef<(tab: TabKey) => void>(() => {});

  switchTabFn.current = useCallback((newTab: TabKey) => {
    if (newTab === activeRef.current) return;
    Animated.timing(fadeAnim, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setActive(newTab);
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2.8,
      onPanResponderEnd: (_, gs) => {
        const idx = TAB_ORDER.indexOf(activeRef.current);
        const dist = Math.abs(gs.dx);
        const vel = Math.abs(gs.vx);
        if (dist < 50 && vel < 0.35) return;
        if (gs.dx < 0 && idx < TAB_ORDER.length - 1) switchTabFn.current(TAB_ORDER[idx + 1]);
        else if (gs.dx > 0 && idx > 0) switchTabFn.current(TAB_ORDER[idx - 1]);
      },
    })
  ).current;

  const handleTabChange = useCallback((tab: TabKey) => {
    switchTabFn.current(tab);
  }, []);

  useEffect(() => {
    let alive = true;

    async function hydratePantry() {
      try {
        void pingGamification().catch(() => undefined);
        const pantryItems = await getPantry();
        if (!alive) return;

        setSelected(
          pantryItems.map((item) => ({
            id: item.ingredientId,
            canonicalName: item.ingredientName,
          })),
        );
      } catch {
        if (!alive) return;
        setSelected((current) => current);
      } finally {
        pantryLoadedRef.current = true;
      }
    }

    void hydratePantry();

    return () => {
      alive = false;
      if (pantrySaveTimerRef.current) {
        clearTimeout(pantrySaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pantryLoadedRef.current) return;

    if (pantrySaveTimerRef.current) {
      clearTimeout(pantrySaveTimerRef.current);
    }

    pantrySaveTimerRef.current = setTimeout(() => {
      void replacePantry(selected);
    }, 320);

    return () => {
      if (pantrySaveTimerRef.current) {
        clearTimeout(pantrySaveTimerRef.current);
      }
    };
  }, [selected]);

  const Screen = useMemo(() => {
    switch (active) {
      case "dashboard":
        return (
          <DashboardScreen
            onPressPlans={() => switchTabFn.current("plans")}
            onPressKitchen={() => switchTabFn.current("kitchen")}
            onPressMessages={() => switchTabFn.current("messages")}
          />
        );
      case "plans":
        return <PlansScreen onPressKitchen={() => switchTabFn.current("kitchen")} />;
      case "kitchen":
        return (
          <KitchenScreen
            selectedIngredients={selected}
            onChangeSelected={setSelected}
            openQuickSheet={() => setSheetOpen(true)}
          />
        );
      case "messages":
        return <MessagesScreen />;
      case "profile":
        return <ProfileScreen />;
      default:
        return <DashboardScreen />;
    }
  }, [active, selected]);

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={34}
        iconColor={`${theme.primary}42`}
        style={[s.blobA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="carrot"
        iconSize={30}
        iconColor={`${theme.emerald}42`}
        style={[s.blobB, { backgroundColor: theme.emeraldGlow }]}
      />
      <ProduceBubble
        icon="fruit-pear"
        iconSize={28}
        iconColor={`${theme.accent}50`}
        style={[s.blobC, { backgroundColor: `${theme.accent}22` }]}
      />
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />
      <Animated.View style={[s.screen, { opacity: fadeAnim }]} {...panResponder.panHandlers}>
        {Screen}
      </Animated.View>
      <BottomBar active={active} onChange={handleTabChange} />
      <KitchenQuickSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selectedIngredients={selected}
        onChangeSelected={setSelected}
        onGoKitchen={() => {
          setSheetOpen(false);
          switchTabFn.current("kitchen");
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
  blobA: {
    position: "absolute",
    top: -56,
    right: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.42,
  },
  blobB: {
    position: "absolute",
    bottom: 116,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.34,
  },
  blobC: {
    position: "absolute",
    top: "40%",
    right: -70,
    width: 126,
    height: 126,
    borderRadius: 63,
    opacity: 0.26,
  },
});
