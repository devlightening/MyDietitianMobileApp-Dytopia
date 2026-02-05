import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radii, shadows, spacing } from "../theme";

export type TabKey = "dashboard" | "plans" | "kitchen" | "messages" | "profile";

export default function BottomBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Tab label="Dashboard" active={active === "dashboard"} onPress={() => onChange("dashboard")} />
        <Tab label="Plans" active={active === "plans"} onPress={() => onChange("plans")} />

        <TouchableOpacity style={[styles.center, shadows.soft]} onPress={() => onChange("kitchen")}>
          <Text style={styles.centerIcon}>⟡</Text>
          <Text style={styles.centerText}>Kitchen</Text>
        </TouchableOpacity>

        <Tab label="Messages" active={active === "messages"} onPress={() => onChange("messages")} />
        <Tab label="Profile" active={active === "profile"} onPress={() => onChange("profile")} />
      </View>
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress}>
      <Text style={[styles.icon, { color: active ? colors.sage : colors.subtle }]}>{label[0]}</Text>
      <Text style={[styles.label, { color: active ? colors.sage : colors.subtle }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: "transparent",
  },
  bar: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.subtle,
  },
  tab: { width: 64, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  icon: { fontSize: 16, marginBottom: 4, fontWeight: "900" },
  label: { fontSize: 11, fontWeight: "800" },

  center: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
  },
  centerIcon: { fontSize: 20, color: colors.sage, marginBottom: 4 },
  centerText: { fontSize: 12, fontWeight: "900", color: colors.text },
});
