import React, { useEffect, useMemo, useRef } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from "react-native";
import { radii, spacing } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import IngredientSearch from "./IngredientSearch";
import IngredientChip from "./IngredientChip";
import type { Ingredient } from "../types/alternative";

const { height: H } = Dimensions.get("window");

export default function KitchenQuickSheet({
  visible,
  onClose,
  selectedIngredients,
  onChangeSelected,
  onGoKitchen,
}: {
  visible: boolean;
  onClose: () => void;
  selectedIngredients: Ingredient[];
  onChangeSelected: (v: Ingredient[]) => void;
  onGoKitchen: () => void;
}) {
  const { theme } = useTheme();
  const y = useRef(new Animated.Value(H)).current;

  useEffect(() => {
    Animated.spring(y, {
      toValue: visible ? 0 : H,
      useNativeDriver: true,
      damping: 18,
      stiffness: 160,
      mass: 0.9,
    }).start();
  }, [visible, y]);

  const chips = useMemo(() => selectedIngredients, [selectedIngredients]);

  function add(i: Ingredient) {
    if (chips.some((x) => x.id === i.id)) return;
    onChangeSelected([...chips, i]);
  }
  function remove(id: string) {
    onChangeSelected(chips.filter((x) => x.id !== id));
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={s.backdropTap} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[
          s.sheet,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            transform: [{ translateY: y }],
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
            elevation: 16,
          },
        ]}>
          <View style={[s.handle, { backgroundColor: theme.border }]} />

          <View style={s.header}>
            <Text style={[s.title, { color: theme.text }]}>Hızlı Mutfak</Text>
            <Text style={[s.sub, { color: theme.textMuted }]}>Malzeme seç · mutfağa git</Text>
          </View>

          {/* zIndex wrapper — dropdown must float above chips/actions below */}
          <View style={s.searchWrapper}>
            <IngredientSearch onSelect={add} />
          </View>

          <View style={s.chipsRow}>
            {chips.map((i) => (
              <IngredientChip key={i.id} ingredient={i} onRemove={() => remove(i.id)} />
            ))}
            {chips.length === 0 && (
              <Text style={[s.empty, { color: theme.textMuted }]}>Henüz malzeme seçilmedi.</Text>
            )}
          </View>

          <View style={s.actions}>
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={onClose}
            >
              <Text style={[s.secondaryText, { color: theme.textSub }]}>Kapat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: theme.primaryLight }]}
              onPress={onGoKitchen}
            >
              <Text style={[s.primaryText, { color: theme.primary }]}>🍳 Mutfağa Git</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  backdropTap: { flex: 1 },

  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  handle: {
    alignSelf: "center",
    width: 54,
    height: 5,
    borderRadius: 3,
    marginBottom: spacing.md,
  },
  header: { marginBottom: spacing.md },
  title: { fontSize: 16, fontWeight: "900" },
  sub: { marginTop: 6, fontSize: 12, fontWeight: "700" },

  searchWrapper: {
    zIndex: 100,
    elevation: 10,
  },

  chipsRow: { marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  empty: { fontSize: 12, fontWeight: "700" },

  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryText: { fontWeight: "900", fontSize: 14 },
  primaryBtn: {
    flex: 1,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { fontWeight: "900", fontSize: 14 },
});
