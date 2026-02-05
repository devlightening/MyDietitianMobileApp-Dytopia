import React, { useEffect, useMemo, useRef } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from "react-native";
import { colors, radii, shadows, spacing } from "../theme";
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
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: y }] }, shadows.soft]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Quick Kitchen</Text>
            <Text style={styles.sub}>Swipe-up anywhere · select ingredients · go Kitchen</Text>
          </View>

          <IngredientSearch onSelect={add} />

          <View style={styles.chipsRow}>
            {chips.map((i) => (
              <IngredientChip key={i.id} ingredient={i} onRemove={() => remove(i.id)} />
            ))}
            {chips.length === 0 && <Text style={styles.empty}>No ingredient selected yet.</Text>}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={onGoKitchen}>
              <Text style={styles.primaryText}>Go Kitchen</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.18)", justifyContent: "flex-end" },
  backdropTap: { flex: 1 },

  sheet: {
    backgroundColor: colors.oat,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: "center",
    width: 54,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(47,82,51,0.18)",
    marginBottom: spacing.md,
  },
  header: { marginBottom: spacing.md },
  title: { fontSize: 16, fontWeight: "900", color: colors.text },
  sub: { marginTop: 6, fontSize: 12, color: colors.muted, fontWeight: "700" },

  chipsRow: { marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap" },
  empty: { fontSize: 12, color: colors.subtle, fontWeight: "700" },

  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryText: { color: colors.muted, fontWeight: "900" },
  primaryBtn: {
    flex: 1,
    backgroundColor: "rgba(74,124,89,0.18)",
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: colors.text, fontWeight: "900" },
});
