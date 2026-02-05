import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, radii, shadows, spacing } from "../theme";
import AppHeader from "../components/AppHeader";
import IngredientSearch from "../components/IngredientSearch";
import IngredientChip from "../components/IngredientChip";
import { Routes } from "../navigation/routes";
import type { Ingredient } from "../types/alternative";

export default function KitchenScreen({
  selectedIngredients,
  onChangeSelected,
  openQuickSheet,
}: {
  selectedIngredients: Ingredient[];
  onChangeSelected: (v: Ingredient[]) => void;
  openQuickSheet: () => void;
}) {
  const nav = useNavigation();

  function add(i: Ingredient) {
    if (selectedIngredients.some((x) => x.id === i.id)) return;
    onChangeSelected([...selectedIngredients, i]);
  }
  function remove(id: string) {
    onChangeSelected(selectedIngredients.filter((x) => x.id !== id));
  }

  return (
    <View style={styles.root}>
      <AppHeader freeTitle="Kitchen" premiumTitle="Kitchen" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Inventory Management</Text>
        <Text style={styles.p}>Quickly select what you have — then MERGE for a recipe result.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
          <QuickPack label="Breakfast" onPress={() => add({ id: "egg", canonicalName: "Egg" })} />
          <QuickPack label="Salad" onPress={() => add({ id: "cucumber", canonicalName: "Cucumber" })} />
          <QuickPack label="Snacks" onPress={() => add({ id: "yogurt", canonicalName: "Yogurt" })} />
          <QuickPack label="Protein" onPress={() => add({ id: "tuna", canonicalName: "Tuna" })} />
        </ScrollView>

        <View style={{ marginTop: spacing.lg }}>
          <IngredientSearch onSelect={add} />
        </View>

        <View style={[styles.box, shadows.subtle]}>
          <Text style={styles.boxTitle}>Your Ingredients</Text>
          <View style={styles.chips}>
            {selectedIngredients.map((i) => (
              <IngredientChip key={i.id} ingredient={i} onRemove={() => remove(i.id)} />
            ))}
            {selectedIngredients.length === 0 && <Text style={styles.empty}>No ingredient selected yet.</Text>}
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* BIG MERGE CTA (ONLY deep forest color) */}
      <TouchableOpacity
        style={[styles.merge, shadows.soft]}
        onPress={() => {
          (nav as any).navigate(Routes.App.CheckIngredients, {
            source: "kitchen",
            selectedIngredients,
          });
        }}
      >
        <Text style={styles.mergeText}>BİRLEŞTİR</Text>
      </TouchableOpacity>

      {/* Optional helper to show the futuristic sheet */}
      <TouchableOpacity style={styles.floatingHint} onPress={openQuickSheet}>
        <Text style={styles.floatingHintText}>↑ Quick Kitchen</Text>
      </TouchableOpacity>
    </View>
  );
}

function QuickPack({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.pack, shadows.subtle]} onPress={onPress}>
      <Text style={styles.packLabel}>{label}</Text>
      <Text style={styles.packHint}>Tap to add</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.oat },
  content: { padding: spacing.lg, paddingBottom: 160 },

  h1: { fontSize: 22, fontWeight: "900", color: colors.text },
  p: { marginTop: 8, fontSize: 13, color: colors.muted, fontWeight: "600", lineHeight: 18 },

  pack: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: spacing.md,
    minWidth: 120,
  },
  packLabel: { fontSize: 14, fontWeight: "900", color: colors.text },
  packHint: { marginTop: 6, fontSize: 11, color: colors.coral, fontWeight: "800" },

  box: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  boxTitle: { fontSize: 12, color: colors.muted, fontWeight: "900", letterSpacing: 0.5 },
  chips: { marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap" },
  empty: { fontSize: 12, color: colors.subtle, fontWeight: "700" },

  merge: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 98,
    backgroundColor: colors.forest, // ONLY main CTA color
    borderRadius: radii.xl,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  mergeText: { color: "#fff", fontWeight: "900", letterSpacing: 1.2, fontSize: 16 },

  floatingHint: {
    position: "absolute",
    right: spacing.lg,
    bottom: 190,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  floatingHintText: { color: colors.muted, fontWeight: "900", fontSize: 12 },
});
