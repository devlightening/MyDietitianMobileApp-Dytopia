import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../theme";
import type { Ingredient } from "../types/alternative";

export default function IngredientChip({
  ingredient,
  onRemove,
}: {
  ingredient: Ingredient;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.chip}>
      <View style={styles.dot} />
      <Text style={styles.text}>{ingredient.canonicalName}</Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={styles.xBtn}>
          <Text style={styles.x}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(74,124,89,0.75)", marginRight: 8 },
  text: { fontSize: 13, color: colors.text, fontWeight: "800" },
  xBtn: { marginLeft: 10, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  x: { fontSize: 16, color: colors.muted, fontWeight: "900" },
});
