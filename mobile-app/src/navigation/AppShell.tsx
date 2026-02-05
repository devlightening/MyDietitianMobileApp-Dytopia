import React, { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { colors } from "../theme";

import BottomBar, { TabKey } from "../components/BottomBar";
import KitchenQuickSheet from "../components/KitchenQuickSheet";
import QuickKitchenHandle from "../components/QuickKitchenHandle";

import DashboardScreen from "../screens/DashboardScreen";
import PlansScreen from "../screens/PlansScreen";
import KitchenScreen from "../screens/KitchenScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";

import type { Ingredient } from "../types/alternative";

export default function AppShell() {
  const [active, setActive] = useState<TabKey>("dashboard");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Ingredient[]>([]);

  const Screen = useMemo(() => {
    switch (active) {
      case "dashboard":
        return <DashboardScreen />;
      case "plans":
        return <PlansScreen />;
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
    <View style={styles.root}>
      <View style={styles.screen}>{Screen}</View>

      <BottomBar active={active} onChange={setActive} />

      {/* Dedicated handle for Quick Kitchen - only responds to upward swipes from handle */}
      <QuickKitchenHandle onSwipeUp={() => setSheetOpen(true)} />

      <KitchenQuickSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selectedIngredients={selected}
        onChangeSelected={setSelected}
        onGoKitchen={() => {
          setSheetOpen(false);
          setActive("kitchen");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.oat },
  screen: { flex: 1 },
});
