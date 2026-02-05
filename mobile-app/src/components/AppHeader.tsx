import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../theme";

interface AppHeaderProps {
  freeTitle?: string;
  premiumTitle?: string;
}

export default function AppHeader({ freeTitle, premiumTitle }: AppHeaderProps) {
  const title = premiumTitle || freeTitle || "MyDietitian";

  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.oat,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text,
  },
});
