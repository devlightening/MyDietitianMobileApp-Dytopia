import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";

interface DonutChartProps {
  percent: number;
}

export default function DonutChart({ percent }: DonutChartProps) {
  const { theme } = useTheme();
  return (
    <View style={s.container}>
      <View style={[s.donut, { backgroundColor: theme.surfaceElevated, borderColor: theme.primary }]}>
        <Text style={[s.value, { color: theme.text }]}>{percent}%</Text>
        <Text style={[s.caption, { color: theme.textMuted }]}>Uyum</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  donut: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 14,
    alignItems: "center", justifyContent: "center",
  },
  value: { fontSize: 44, fontWeight: "900", marginTop: 6 },
  caption: { fontSize: 12, fontWeight: "800", marginTop: 4 },
});
