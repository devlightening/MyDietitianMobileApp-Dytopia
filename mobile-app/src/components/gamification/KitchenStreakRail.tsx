import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { Theme } from "../../theme/tokens";
import { radii, spacing } from "../../theme/tokens";
import type { GamificationSummaryDTO } from "../../api/gamification";
import {
  buildMotivationSummary,
  getBadgeMeta,
  getHighlightAchievements,
  getToneColor,
  mapGamificationToMotivation,
  type DashboardMotivation,
} from "../../motivation/streaks";

export default function KitchenStreakRail({
  theme,
  language,
  summary,
  onTabSwipeEnabledChange,
}: {
  theme: Theme;
  language: "tr" | "en";
  summary?: GamificationSummaryDTO;
  onTabSwipeEnabledChange?: (enabled: boolean) => void;
}) {
  const motivation = mapGamificationToMotivation(summary);
  const summaryCopy = buildMotivationSummary(motivation, language);
  const badges = getHighlightAchievements(motivation, language, 4);
  const lockTabSwipe = React.useCallback(() => {
    onTabSwipeEnabledChange?.(false);
  }, [onTabSwipeEnabledChange]);
  const releaseTabSwipe = React.useCallback(() => {
    onTabSwipeEnabledChange?.(true);
  }, [onTabSwipeEnabledChange]);

  return (
    <View style={s.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
        onTouchStart={lockTabSwipe}
        onTouchEnd={releaseTabSwipe}
        onTouchCancel={releaseTabSwipe}
        onScrollBeginDrag={lockTabSwipe}
        onScrollEndDrag={releaseTabSwipe}
        onMomentumScrollEnd={releaseTabSwipe}
      >
        <View
          style={[
            s.heroCard,
            {
              backgroundColor: `${theme.surface}F4`,
              borderColor: `${theme.borderEmerald}B2`,
              shadowColor: theme.primaryGlow,
            },
          ]}
        >
          <View style={s.heroTop}>
            <View style={s.heroTextBlock}>
              <Text style={[s.eyebrow, { color: theme.emerald }]}>
                {language === "tr" ? "AI SERİ" : "AI STREAK"}
              </Text>
              <Text style={[s.title, { color: theme.text }]} numberOfLines={1}>
                {summaryCopy.title}
              </Text>
              <Text style={[s.subtitle, { color: theme.textMuted }]} numberOfLines={2}>
                {summary?.streakAtRisk
                  ? summary.atRiskReason || summaryCopy.subtitle
                  : summaryCopy.subtitle}
              </Text>
            </View>
            <View style={[s.streakBubble, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Text style={[s.streakValue, { color: theme.emerald }]}>{summary?.currentStreak ?? 0}</Text>
              <Text style={[s.streakLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "gün" : "days"}
              </Text>
            </View>
          </View>

          <View style={s.heroMetaRow}>
            <View style={[s.pill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Ionicons
                name={summary?.streakAtRisk ? "alert-circle-outline" : "sparkles-outline"}
                size={12}
                color={summary?.streakAtRisk ? theme.accentCoral : theme.primary}
              />
              <Text style={[s.pillText, { color: theme.textSub }]}>
                {summary?.streakAtRisk
                  ? (language === "tr" ? "seri riskte" : "streak at risk")
                  : summary?.nextMilestoneDays
                    ? (language === "tr"
                        ? `${summary.nextMilestoneDays} gün sonra yeni rozet`
                        : `${summary.nextMilestoneDays} days to next badge`)
                    : (language === "tr" ? "ana seri aktif" : "core streak live")}
              </Text>
            </View>
            <View style={[s.pill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Ionicons name="trophy-outline" size={12} color={theme.accentGold} />
              <Text style={[s.pillText, { color: theme.textSub }]}>
                {language === "tr"
                  ? `${summary?.earnedBadgeCount ?? 0} rozet açık`
                  : `${summary?.earnedBadgeCount ?? 0} badges live`}
              </Text>
            </View>
          </View>
        </View>

        {badges.map((badge) => {
          const meta = getBadgeMeta(badge.id, language);
          const toneColor = getToneColor(theme, meta.tone);
          const ratio = badge.progressTarget > 0 ? Math.min(1, badge.progressCurrent / badge.progressTarget) : 0;

          return (
            <View
              key={badge.id}
              style={[
                s.badgeCard,
                {
                  backgroundColor: `${theme.surface}F3`,
                  borderColor: badge.unlocked ? `${toneColor}88` : `${theme.border}B0`,
                },
              ]}
            >
              <View style={[s.badgeIconWrap, { backgroundColor: `${toneColor}18`, borderColor: `${toneColor}32` }]}>
                <MaterialCommunityIcons name={meta.icon} size={20} color={toneColor} />
              </View>
              <Text style={[s.badgeTitle, { color: theme.text }]} numberOfLines={2}>
                {meta.title}
              </Text>
              <Text style={[s.badgeSubtitle, { color: theme.textMuted }]} numberOfLines={2}>
                {meta.subtitle}
              </Text>
              <View style={[s.progressTrack, { backgroundColor: `${theme.textMuted}16` }]}>
                <View style={[s.progressFill, { width: `${ratio * 100}%`, backgroundColor: toneColor }]} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  row: {
    gap: 12,
    paddingHorizontal: 4,
  },
  heroCard: {
    width: 256,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 14,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  heroTextBlock: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  streakBubble: {
    minWidth: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  streakValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
  },
  streakLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 2,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeCard: {
    width: 146,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 14,
    justifyContent: "space-between",
  },
  badgeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    marginBottom: 4,
  },
  badgeSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    minHeight: 32,
    marginBottom: 10,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
});

