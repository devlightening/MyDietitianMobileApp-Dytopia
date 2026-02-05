import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../theme";
import AppHeader from "../components/AppHeader";

export default function MessagesScreen() {
  return (
    <View style={styles.root}>
      <AppHeader freeTitle="Messages" premiumTitle="Messages" />
      <View style={styles.body}>
        <Text style={styles.h}>Dietitian / Clinic Chat</Text>
        <Text style={styles.p}>This tab is reserved for clinic-grade communication (B2B2C).</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.oat },
  body: { flex: 1, padding: spacing.lg, paddingTop: spacing.lg },
  h: { fontSize: 18, fontWeight: "900", color: colors.text },
  p: { marginTop: 10, fontSize: 13, color: colors.muted, fontWeight: "700", lineHeight: 18 },
});
