import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TouchableOpacity } from "react-native";
import { colors, radii, shadows, spacing } from "../theme";
import DonutChart from "../components/DonutChart";
import { useAuth } from "../auth/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { Routes } from "../navigation/routes";
import { useDashboard } from "../queries/useDashboard";
import SkeletonCard from "../components/SkeletonCard";
import ErrorState from "../components/ErrorState";
import type { DashboardDTO } from "../data/dashboardRepo";
import { API_BASE_URL } from "../config/api";


type Props = {
  // Props are now optional - data comes from repository
  clinicName?: string;
  isPremium?: boolean;
  userName?: string;
  onPressActivate?: () => void;
};

export default function DashboardScreen({
  clinicName: clinicNameProp,
  isPremium: isPremiumProp,
  userName: userNameProp,
  onPressActivate,
}: Props = {}) {
  const { user } = useAuth();
  const nav = useNavigation();

  // React Query hook for dashboard data
  const { data, isLoading, isError, error, refetch, isRefetching } = useDashboard();

  // Use auth context if available, otherwise use props
  const isPremium = isPremiumProp ?? user?.isPremium ?? false;
  const userName = userNameProp ?? data?.greetingName ?? "User";
  const clinicName = clinicNameProp ?? data?.clinicName ?? "Dyt. Elif Clinic";

  const headerTitle = useMemo(() => {
    // Premium ise clinic brand öne çıksın, free ise selam da olabilir
    return isPremium ? clinicName : clinicName;
  }, [clinicName, isPremium]);

  const handleActivate = () => {
    if (onPressActivate) {
      onPressActivate();
    } else {
      (nav as any).navigate(Routes.Modal.ActivatePremium);
    }
  };

  const handleLogout = () => {
    const { logout } = useAuth();
    logout();
  };

  // Show skeleton loading while fetching data (only if no cached data)
  if (isLoading && !data) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  // Show error state with retry (only if no cached data)
  // AG-DASH-FIX-05: If data exists, show it with error banner instead
  if (isError && !data) {
    return (
      <View style={styles.root}>
        <ErrorState
          error={error!}
          onRetry={() => refetch()}
          onLogout={handleLogout}
        />
      </View>
    );
  }

  // Use data from repository
  const compliancePercent = data?.compliancePercent ?? 0;
  const nextMealTime = data?.nextMeal?.time ?? "—";
  const nextMealTitle = data?.nextMeal?.title ?? "No meal scheduled";
  const nextMealNote = data?.nextMeal?.note ?? "";

  return (
    <View style={styles.root}>
      {/* AG-DASH-FIX-05: Error banner when data exists but refetch failed */}
      {isError && data && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            ⚠️ Güncellenemedi. {error?.message || 'Bağlantı hatası.'}
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.errorBannerRetry}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AG-DASH-FIX-06: Dev diagnostics */}
      {__DEV__ && (
        <View style={styles.devDiagnostics}>
          <Text style={styles.devText}>API: {API_BASE_URL}</Text>
          {isError && error && (
            <Text style={styles.devText}>
              Error: {error.type} {error.status ? `(${error.status})` : ''}
            </Text>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.sage}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.clinicTitle}>{headerTitle}</Text>

            {isPremium ? (
              <View style={styles.premiumPill}>
                <Text style={styles.premiumCrown}>👑</Text>
                <Text style={styles.premiumText}>Premium</Text>
              </View>
            ) : (
              <View style={styles.freePill}>
                <Text style={styles.freeText}>Free</Text>
              </View>
            )}
          </View>

          {!isPremium && (
            <Text style={styles.greeting}>
              Merhaba {userName} 👋 Bugün planına bağlanmadan da ilerleyebilirsin.
            </Text>
          )}

          {isPremium && (
            <Text style={styles.greeting}>
              Bugünün klinik planı hazır. Uyum skorunu ve sıradaki öğünü kontrol et.
            </Text>
          )}
        </View>

        {/* Compliance (Hero Card) */}
        <View style={[styles.card, shadows.soft]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Compliance</Text>
            <Text style={styles.cardMeta}>Today</Text>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <DonutChart percent={compliancePercent} />
          </View>

          <View style={styles.divider} />

          {/* Quick insights */}
          <View style={styles.insightRow}>
            <View style={styles.insightPill}>
              <Text style={styles.insightDot}>●</Text>
              <Text style={styles.insightText}>On track</Text>
            </View>

            <View style={styles.insightPillAlt}>
              <Text style={styles.insightTextAlt}>Clinic-grade</Text>
            </View>
          </View>
        </View>

        {/* Next meal card */}
        <View style={[styles.card, shadows.soft]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Next Meal</Text>
            <Text style={styles.cardMeta}>{nextMealTime}</Text>
          </View>

          <View style={styles.nextMealRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mealTitle}>{nextMealTitle}</Text>
              {nextMealNote && <Text style={styles.mealNote}>{nextMealNote}</Text>}
            </View>

            <View style={styles.checkCircle}>
              <Text style={styles.checkMark}>✓</Text>
            </View>
          </View>
        </View>

        {/* Free guidance banner (soft upsell) */}
        {!isPremium && (
          <View style={[styles.banner, shadows.subtle]}>
            <Text style={styles.bannerTitle}>Free kullanıcılar için yönlendirme</Text>
            <Text style={styles.bannerText}>
              Premium'a geçmek zorunda değilsin. İstersen diyetisyeninin verdiği{" "}
              <Text style={styles.bold}>Access Key</Text> ile clinic planını açabilirsin.
            </Text>

            <Pressable
              onPress={handleActivate}
              style={({ pressed }) => [
                styles.bannerBtn,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={styles.bannerBtnText}>Access Key ile Premium Aç</Text>
            </Pressable>
          </View>
        )}

        {/* Bottom nav için boşluk */}
        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.oat },
  centered: { justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },

  header: { marginBottom: spacing.lg },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  clinicTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.forest,
    letterSpacing: -0.4,
    flex: 1,
  },
  greeting: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
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

  freePill: {
    backgroundColor: "rgba(74, 124, 89, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(74, 124, 89, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  freeText: { color: colors.sage, fontWeight: "800", fontSize: 12 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: colors.forest,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },

  insightRow: { flexDirection: "row", gap: spacing.sm },
  insightPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(74, 124, 89, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(74, 124, 89, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  insightDot: { color: colors.sage, fontWeight: "900" },
  insightText: { color: colors.forest, fontWeight: "800", fontSize: 12 },

  insightPillAlt: {
    backgroundColor: "rgba(47, 82, 51, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(47, 82, 51, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    justifyContent: "center",
  },
  insightTextAlt: { color: colors.forest, fontWeight: "800", fontSize: 12 },

  nextMealRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  mealTitle: { color: colors.forest, fontSize: 18, fontWeight: "900" },
  mealNote: { marginTop: 4, color: colors.muted, fontSize: 12, fontWeight: "700" },

  checkCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(74, 124, 89, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(74, 124, 89, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { color: colors.sage, fontWeight: "900", fontSize: 16 },

  banner: {
    backgroundColor: "rgba(255, 140, 97, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 140, 97, 0.18)",
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  bannerTitle: {
    color: colors.forest,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },
  bannerText: { color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  bold: { color: colors.forest, fontWeight: "900" },
  bannerBtn: {
    marginTop: spacing.md,
    backgroundColor: "rgba(255, 140, 97, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 140, 97, 0.28)",
    borderRadius: radii.xl,
    paddingVertical: 14,
    alignItems: "center",
  },
  bannerBtnText: { color: colors.forest, fontWeight: "900", fontSize: 14 },

  // AG-DASH-FIX-05: Error banner styles
  errorBanner: {
    backgroundColor: colors.error + '15',
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    marginRight: spacing.sm,
  },
  errorBannerRetry: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.sage,
  },

  // AG-DASH-FIX-06: Dev diagnostics styles
  devDiagnostics: {
    backgroundColor: '#000',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  devText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#0f0',
  },
});
