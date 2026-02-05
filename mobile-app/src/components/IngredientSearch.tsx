import React, { useState } from "react";
import { View, TextInput, ScrollView, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors, radii, spacing, shadows } from "../theme";
import { searchIngredients } from "../api/alternative";
import type { Ingredient } from "../types/alternative";

export default function IngredientSearch({ onSelect }: { onSelect: (i: Ingredient) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);

  async function onChange(text: string) {
    setQ(text);
    if (text.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    const res = await searchIngredients(text.trim());
    setItems(res);
    setLoading(false);
  }

  return (
    <View>
      <TextInput
        value={q}
        onChangeText={onChange}
        placeholder="Search ingredient (egg, yogurt, tuna...)"
        placeholderTextColor={colors.subtle}
        style={[styles.input, shadows.subtle]}
      />

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.sage} />
        </View>
      )}

      {items.length > 0 && (
        <View style={[styles.results, shadows.subtle]}>
          <ScrollView
            style={styles.resultsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.resultRow}
                onPress={() => {
                  onSelect(item);
                  setQ("");
                  setItems([]);
                }}
              >
                <View style={styles.dot} />
                <Text style={styles.resultText}>{item.canonicalName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.text,
    fontWeight: "700",
  },
  loadingRow: { paddingTop: spacing.sm, alignItems: "center" },
  results: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    maxHeight: 220,
  },
  resultsList: {
    maxHeight: 220,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,140,97,0.65)", marginRight: 10 },
  resultText: { fontSize: 14, color: colors.text, fontWeight: "800" },
});
