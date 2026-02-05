import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { colors, radii, shadows, spacing } from "../theme";
import { Routes } from "../navigation/routes";
import { getPlansData, type PlansData, type PlanItem } from "../data/plansRepo";

export default function PlansScreen() {
  const { user } = useAuth();
  const nav = useNavigation();
  const isPremium = user?.isPremium === true;

  const [data, setData] = useState<PlansData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const plansData = await getPlansData("today");
      setData(plansData);
    } catch (error) {
      console.error("Failed to load plans:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={colors.sage} />
      </View>
    );
  }

  const todayPlans = data?.todayPlans ?? [];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.sage}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Plans</Text>
          {isPremium && (
            <View style={styles.premiumPill}>
              <Text style={styles.premiumCrown}>👑</Text>
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          )}
        </View>

        {isPremium ? (
          <>
            {/* Premium: Show actual plans */}
            {todayPlans.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Today's Plan</Text>
                {todayPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </>
            ) : (
              <EmptyState
                icon="📋"
                title="No plans today"
                description="Your dietitian hasn't assigned any plans yet."
              />
            )}
          </>
        ) : (
          <>
            {/* Free: Show contextual guidance */}
            <EmptyState
              icon="🔑"
              title="Premium Plans"
              description="Activate premium with your dietitian's access key to see personalized meal plans and tracking."
              actionLabel="Activate Premium"
              onAction={() => (nav as any).navigate(Routes.Modal.ActivatePremium)}
            />
          </>
        )}

        {/* Bottom padding for tab bar */}
        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

function PlanCard({ plan }: { plan: PlanItem }) {
  return (
    <View style={[styles.planCard, shadows.soft]}>
      <View style={styles.planHeader}>
        <View>
          <Text style={styles.planTime}>{plan.time}</Text>
          <Text style={styles.planTitle}>{plan.title}</Text>
        </View>
        <View style={plan.completed ? styles.checkCircleCompleted : styles.checkCircle}>
          {plan.completed && <Text style={styles.checkMark}>✓</Text>}
        </View>
      </View>
      <Text style={styles.planDescription}>{plan.description}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={[styles.emptyState, shadows.subtle]}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.oat },
  centered: { justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.forest,
    letterSpacing: -0.4,
  },
  premiumPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(244, 211, 94, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(244, 211, 94, 0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  premiumCrown: { fontSize: 12 },
  premiumText: { color: colors.forest, fontWeight: "800", fontSize: 12 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.forest,
    marginBottom: spacing.md,
  },

  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  planTime: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: 4,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.forest,
  },
  planDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
    lineHeight: 20,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  checkCircleCompleted: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(74, 124, 89, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(74, 124, 89, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: colors.sage,
    fontWeight: "900",
    fontSize: 14,
  },

  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.forest,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  emptyAction: {
    backgroundColor: "rgba(74, 124, 89, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(74, 124, 89, 0.18)",
    borderRadius: radii.xl,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  emptyActionText: {
    color: colors.forest,
    fontWeight: "900",
    fontSize: 14,
  },
});
