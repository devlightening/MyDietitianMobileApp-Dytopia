import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { colors, radii, shadows, spacing } from "../theme";

type R = RouteProp<
  {
    params: {
      recipe: {
        title: string;
        badges: string[];
        ingredients: string[];
      };
    };
  },
  "params"
>;

export default function AlternativeResultScreen() {
  const nav = useNavigation();
  const route = useRoute<R>();
  const recipe = route.params.recipe;

  return (
    <View style={styles.root}>
      {/* soft gradient-ish wash */}
      <View style={styles.wash} />

      {/* confetti (static, premium) */}
      <Text style={styles.confetti}>✦ ✦ ✦ ✦ ✦</Text>

      <View style={[styles.card, shadows.soft]}>
        <Text style={styles.title}>{recipe.title}</Text>

        <View style={styles.badges}>
          <View style={[styles.badgeGreen]}>
            <Text style={styles.badgeText}>Perfect Match</Text>
          </View>
          <View style={[styles.badgeGold]}>
            <Text style={styles.badgeText}>Dietitian Approved</Text>
          </View>
        </View>

        <Text style={styles.sub}>Ingredients snapshot</Text>
        <Text style={styles.list}>{recipe.ingredients.join(", ")}</Text>
      </View>

      {/* gift box concept */}
      <View style={[styles.box, shadows.subtle]}>
        <Text style={styles.boxText}>🎁</Text>
      </View>

      <TouchableOpacity style={styles.back} onPress={() => (nav as any).goBack()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.oat, alignItems: "center", justifyContent: "center" },
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(74,124,89,0.06)",
  },
  confetti: {
    position: "absolute",
    top: 72,
    fontSize: 22,
    color: "rgba(244,211,94,0.85)",
  },

  card: {
    width: "86%",
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    zIndex: 2,
  },
  title: { fontSize: 18, fontWeight: "900", color: colors.text },
  badges: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },

  badgeGreen: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(74,124,89,0.16)",
    borderWidth: 1,
    borderColor: "rgba(74,124,89,0.22)",
  },
  badgeGold: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(244,211,94,0.22)",
    borderWidth: 1,
    borderColor: "rgba(244,211,94,0.35)",
  },
  badgeText: { fontWeight: "900", color: colors.text, fontSize: 12 },

  sub: { marginTop: spacing.lg, fontSize: 12, color: colors.muted, fontWeight: "900" },
  list: { marginTop: 8, fontSize: 12, color: colors.text, fontWeight: "700", lineHeight: 18 },

  box: {
    marginTop: -18,
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: "rgba(255,140,97,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,140,97,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  boxText: { fontSize: 44 },

  back: { position: "absolute", bottom: 50, paddingVertical: 10, paddingHorizontal: 18 },
  backText: { fontWeight: "900", color: colors.muted },
});
