import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { radii, type Theme } from "../../theme/tokens";

type Props = {
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  accent: string;
  theme: Theme;
  title?: string | null;
};

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

export default function RecipeNutritionPanel({
  caloriesKcal,
  proteinGrams,
  carbsGrams,
  fatGrams,
  accent,
  theme,
  title = "BESİN DEĞERLERİ",
}: Props) {
  const items = [
    {
      label: "Kalori",
      value: caloriesKcal,
      unit: "kcal",
      color: theme.macroCalorie ?? accent,
    },
    {
      label: "Protein",
      value: proteinGrams,
      unit: "g",
      color: theme.macroProtein ?? theme.emerald,
    },
    {
      label: "Karb",
      value: carbsGrams,
      unit: "g",
      color: theme.macroCarb ?? theme.accentGold,
    },
    {
      label: "Yağ",
      value: fatGrams,
      unit: "g",
      color: theme.macroFat ?? theme.accentCoral,
    },
  ].filter((item) => item.value != null);

  if (items.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        s.macroTable,
        {
          backgroundColor: `${theme.primary}06`,
          borderColor: `${theme.primary}14`,
        },
      ]}
    >
      {!!title && <Text style={[s.macroTableTitle, { color: theme.textMuted }]}>{title}</Text>}
      <View style={s.macroRow}>
        {items.map((item) => (
          <View key={item.label} style={s.macroCell}>
            <Text style={[s.macroCellVal, { color: theme.text }]}>
              {formatNumber(item.value as number)}
              <Text style={[s.macroCellUnit, { color: theme.textMuted }]}> {item.unit}</Text>
            </Text>
            <Text style={[s.macroCellLabel, { color: theme.textMuted }]}>{item.label}</Text>
            <View style={[s.macroCellBar, { backgroundColor: item.color }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  macroTable: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  macroTableTitle: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  macroRow: {
    flexDirection: "row",
    gap: 4,
  },
  macroCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  macroCellVal: {
    fontSize: 16,
    fontWeight: "900",
  },
  macroCellUnit: {
    fontSize: 10,
    fontWeight: "700",
  },
  macroCellLabel: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  macroCellBar: {
    width: "80%",
    height: 3,
    borderRadius: 2,
    marginTop: 2,
  },
});

