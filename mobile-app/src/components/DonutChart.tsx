import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

interface DonutChartProps {
  percent: number;
}

export default function DonutChart({ percent }: DonutChartProps) {
  return (
    <View style={styles.container}>
      <View style={styles.donut}>
        <Text style={styles.value}>{percent}%</Text>
        <Text style={styles.caption}>Today's Compliance</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  donut: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 14,
    borderColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 44,
    fontWeight: "900",
    color: colors.forest,
    marginTop: 6,
  },
  caption: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.muted,
    marginTop: 4,
  },
});
