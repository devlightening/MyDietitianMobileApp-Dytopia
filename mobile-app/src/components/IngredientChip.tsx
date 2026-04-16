import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { radii, spacing } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import type { Ingredient } from "../types/alternative";

export default function IngredientChip({
  ingredient,
  onRemove,
}: {
  ingredient: Ingredient;
  onRemove?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={[s.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[s.dot, { backgroundColor: theme.primary }]} />
      <Text style={[s.text, { color: theme.text }]}>{ingredient.canonicalName}</Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={s.xBtn}>
          <Text style={[s.x, { color: theme.textMuted }]}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, opacity: 0.75, marginRight: 8 },
  text: { fontSize: 13, fontWeight: "800" },
  xBtn: { marginLeft: 10, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  x: { fontSize: 16, fontWeight: "900" },
});
