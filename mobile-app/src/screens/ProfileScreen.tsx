import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { colors, radii, shadows, spacing } from "../theme";
import { useAuth } from "../auth/AuthContext";

export default function ProfileScreen() {
  const { user, isPremium, logout } = useAuth();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* User Info Card */}
        <View style={[styles.card, shadows.soft]}>
          <Text style={styles.cardTitle}>Account</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>User ID</Text>
            <Text style={styles.value}>{user?.publicUserId || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Status</Text>
            <View style={isPremium ? styles.premiumPill : styles.freePill}>
              <Text style={isPremium ? styles.premiumText : styles.freeText}>
                {isPremium ? "Premium" : "Free"}
              </Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutBtn, shadows.subtle]}
          onPress={logout}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.oat },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },

  header: { marginBottom: spacing.lg },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.forest,
    letterSpacing: -0.4,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    color: colors.forest,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  value: {
    color: colors.forest,
    fontSize: 14,
    fontWeight: "800",
  },

  premiumPill: {
    backgroundColor: "rgba(244, 211, 94, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(244, 211, 94, 0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  premiumText: { color: colors.forest, fontWeight: "800", fontSize: 12 },

  freePill: {
    backgroundColor: "rgba(74, 124, 89, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(74, 124, 89, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  freeText: { color: colors.sage, fontWeight: "800", fontSize: 12 },

  logoutBtn: {
    backgroundColor: "rgba(227, 91, 91, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(227, 91, 91, 0.18)",
    borderRadius: radii.xl,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  logoutText: {
    color: colors.error,
    fontWeight: "900",
    fontSize: 14,
  },
});
