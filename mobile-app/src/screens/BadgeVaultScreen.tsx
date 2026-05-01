import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import ConfettiOverlay, { type ConfettiRef } from "../components/ui/ConfettiOverlay";
import { useNavigation } from "@react-navigation/native";
import BadgeDetailSheet from "../components/gamification/BadgeDetailSheet";
import ProduceBubble from "../components/decor/ProduceBubble";
import { useTranslation } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import {
  buildBadgeCollection,
  buildMotivationSummary,
  getMotivationSpotlight,
  getToneColor,
  mapGamificationToMotivation,
  type BadgeCollectionItem,
} from "../motivation/streaks";
import { useGamification } from "../queries/useGamification";
import { radii, spacing } from "../theme/tokens";
import { useFadeRise, useFloating, useHeroEntrance } from "../hooks/useAuraMotion";

function getNextBadgePreview(badge: BadgeCollectionItem | null, language: "tr" | "en") {
  if (!badge) return null;
  const target = Math.max(1, badge.progressTarget || badge.targetFallback || 1);
  const current = Math.max(0, Math.min(target, badge.progressCurrent || 0));
  const remaining = Math.max(0, target - current);
  const percent = Math.round((current / target) * 100);

  return {
    progress: `${current}/${target}`,
    percent: `%${percent}`,
    remaining: badge.unlocked
      ? (language === "tr" ? "Tamamlandı" : "Complete")
      : (language === "tr" ? `${remaining} kaldı` : `${remaining} left`),
    nudge: badge.unlocked
      ? (language === "tr" ? "Bu rozeti açtın; sıradaki hedef için ritmini koru." : "Unlocked. Keep the rhythm for the next target.")
      : (language === "tr" ? "Bugün küçük bir adım bile bu rozete yaklaştırır." : "Even one small action today moves this badge closer."),
  };
}

export default function BadgeVaultScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { data, isLoading, isRefetching, refetch } = useGamification();
  const motivation = mapGamificationToMotivation(data);
  const summary = buildMotivationSummary(motivation, language);
  const badges = useMemo(() => buildBadgeCollection(motivation, language), [language, motivation]);
  const spotlight = getMotivationSpotlight(motivation, language);
  const [selectedBadge, setSelectedBadge] = useState<BadgeCollectionItem | null>(null);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked" | "streak" | "hydration" | "pantry">("all");
  const confettiRef = useRef<ConfettiRef>(null);

  function handleBadgePress(badge: BadgeCollectionItem) {
    setSelectedBadge(badge);
    if (badge.unlocked) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      confettiRef.current?.trigger();
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  const heroStyle = useHeroEntrance();
  const spotlightStyle = useFadeRise(110, 12);
  const floatStyle = useFloating(0, 4, 2600);

  const unlockedBadges = useMemo(() => badges.filter((item) => item.unlocked), [badges]);
  const totalBadgeCount = motivation?.totalBadgeCount ?? badges.length;
  const earnedBadgeCount = motivation?.earnedBadgeCount ?? unlockedBadges.length;
  const streakValue = motivation?.currentStreak ?? 0;
  const filterChips = useMemo(() => [
    { key: "all" as const, label: language === "tr" ? "Tümü" : "All" },
    { key: "unlocked" as const, label: language === "tr" ? "Açık" : "Unlocked" },
    { key: "locked" as const, label: language === "tr" ? "Kilitli" : "Locked" },
    { key: "streak" as const, label: language === "tr" ? "Seri" : "Streak" },
    { key: "hydration" as const, label: language === "tr" ? "Su" : "Hydration" },
    { key: "pantry" as const, label: language === "tr" ? "Dolap" : "Pantry" },
  ], [language]);
  const filteredBadges = useMemo(() => {
    switch (filter) {
      case "unlocked":
        return badges.filter((item) => item.unlocked);
      case "locked":
        return badges.filter((item) => !item.unlocked);
      case "streak":
      case "hydration":
      case "pantry":
        return badges.filter((item) => item.family === filter);
      case "all":
      default:
        return badges;
    }
  }, [badges, filter]);
  const visibleUnlockedBadges = useMemo(() => filteredBadges.filter((item) => item.unlocked), [filteredBadges]);
  const visibleLockedBadges = useMemo(() => filteredBadges.filter((item) => !item.unlocked), [filteredBadges]);
  const lockedCount = totalBadgeCount - earnedBadgeCount;
  const nextBadgePreview = useMemo(
    () => getNextBadgePreview(spotlight, language),
    [language, spotlight],
  );

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      <ProduceBubble
        icon="food-apple-outline"
        iconSize={30}
        iconColor={`${theme.accentGold}45`}
        style={[s.bgGlowTop, { backgroundColor: `${theme.accentGold}16` }]}
      />
      <ProduceBubble
        icon="leaf"
        iconSize={26}
        iconColor={`${theme.accentCyan}40`}
        style={[s.bgGlowBottom, { backgroundColor: `${theme.accentCyan}16` }]}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={s.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[s.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </Pressable>

          <View style={s.headerTextWrap}>
            <Text style={[s.headerEyebrow, { color: theme.textMuted }]}>
              {language === "tr" ? "ROZET KASASI" : "BADGE VAULT"}
            </Text>
            <Text style={[s.headerTitle, { color: theme.text }]}>
              {language === "tr" ? "Tüm rozetlerini incele" : "Inspect your full badge set"}
            </Text>
          </View>
        </View>

        <Animated.View
          style={[
            s.heroCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.borderEmerald,
              shadowColor: theme.shadowEmerald,
            },
            heroStyle,
          ]}
        >
          <Animated.View style={[s.heroOrb, { backgroundColor: theme.primaryGlow }, floatStyle]}>
            <MaterialCommunityIcons name="shield-star-outline" size={22} color={theme.primary} />
          </Animated.View>

          <Text style={[s.heroTitle, { color: theme.text }]}>{summary.title}</Text>
          <Text style={[s.heroSubtitle, { color: theme.textSub }]}>{summary.subtitle}</Text>

          <View style={s.heroStatsRow}>
            <View style={[s.heroStat, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.heroStatValue, { color: theme.accentGold }]}>{earnedBadgeCount}</Text>
              <Text style={[s.heroStatLabel, { color: theme.textMuted }]}>
                {language === "tr" ? `açık / ${totalBadgeCount}` : `live / ${totalBadgeCount}`}
              </Text>
            </View>
            <View style={[s.heroStat, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.heroStatValue, { color: theme.emerald }]}>{streakValue}</Text>
              <Text style={[s.heroStatLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "ana seri" : "core streak"}
              </Text>
            </View>
            <View style={[s.heroStat, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.heroStatValue, { color: theme.accentCyan }]}>
                {lockedCount}
              </Text>
              <Text style={[s.heroStatLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "kilitli rozet" : "locked badges"}
              </Text>
            </View>
          </View>
        </Animated.View>

        {spotlight ? (
          <Animated.View style={spotlightStyle}>
            <Pressable
              onPress={() => handleBadgePress(spotlight)}
              style={[
                s.spotlightCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: `${getToneColor(theme, spotlight.tone)}44`,
                },
              ]}
            >
              <View style={s.sectionTop}>
                <View>
                  <Text style={[s.sectionEyebrow, { color: theme.textMuted }]}>
                    {language === "tr" ? "SIRADAKI AV" : "NEXT HUNT"}
                  </Text>
                  <Text style={[s.sectionTitle, { color: theme.text }]}>
                    {spotlight.unlocked
                      ? (language === "tr" ? "Öne çıkan açık rozet" : "Unlocked badge spotlight")
                      : (language === "tr" ? "En yakın kilitli rozet" : "Closest locked badge")}
                  </Text>
                </View>
                <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
              </View>

              <View style={s.spotlightBody}>
                <View
                  style={[
                    s.spotlightSeal,
                    {
                      backgroundColor: `${getToneColor(theme, spotlight.tone)}14`,
                      borderColor: `${getToneColor(theme, spotlight.tone)}38`,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={spotlight.icon}
                    size={26}
                    color={getToneColor(theme, spotlight.tone)}
                  />
                </View>

                <View style={s.spotlightTextCol}>
                  <Text style={[s.spotlightTitle, { color: theme.text }]}>{spotlight.title}</Text>
                  <Text style={[s.spotlightCopy, { color: theme.textSub }]} numberOfLines={3}>
                    {spotlight.unlocked ? spotlight.earnedDetail : spotlight.hint}
                  </Text>
                  <View style={[s.track, { backgroundColor: theme.borderLight }]}>
                    <View
                      style={[
                        s.fill,
                        {
                          width: `${Math.max(8, Math.round(spotlight.ratio * 100))}%`,
                          backgroundColor: getToneColor(theme, spotlight.tone),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[s.spotlightMeta, { color: theme.textMuted }]}>
                    {spotlight.progressLabel} | {spotlight.statusLabel}
                  </Text>

                  {nextBadgePreview ? (
                    <View style={s.spotlightPreviewWrap}>
                      <View style={s.spotlightPreviewRow}>
                        <View style={[s.spotlightPreviewChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                          <Text style={[s.spotlightPreviewValue, { color: theme.text }]}>{nextBadgePreview.progress}</Text>
                          <Text style={[s.spotlightPreviewLabel, { color: theme.textMuted }]}>
                            {language === "tr" ? "tamamlandı" : "done"}
                          </Text>
                        </View>
                        <View style={[s.spotlightPreviewChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                          <Text style={[s.spotlightPreviewValue, { color: getToneColor(theme, spotlight.tone) }]}>
                            {nextBadgePreview.percent}
                          </Text>
                          <Text style={[s.spotlightPreviewLabel, { color: theme.textMuted }]}>
                            {language === "tr" ? "ilerleme" : "progress"}
                          </Text>
                        </View>
                        <View style={[s.spotlightPreviewChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                          <Text style={[s.spotlightPreviewValue, { color: theme.accentGold }]}>
                            {nextBadgePreview.remaining}
                          </Text>
                          <Text style={[s.spotlightPreviewLabel, { color: theme.textMuted }]}>
                            {language === "tr" ? "hedef" : "target"}
                          </Text>
                        </View>
                      </View>
                      <Text style={[s.spotlightNudge, { color: theme.textSub }]}>
                        {nextBadgePreview.nudge}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          </Animated.View>
        ) : null}

        {isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : null}

        <View style={s.filterRow}>
          {filterChips.map((chip) => {
            const active = filter === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setFilter(chip.key)}
                style={[
                  s.filterChip,
                  {
                    backgroundColor: active ? theme.primary : theme.surface,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text style={[s.filterChipText, { color: active ? "#fff" : theme.textSub }]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionHeader
          theme={theme}
          title={language === "tr" ? "Açık rozetler" : "Unlocked badges"}
          subtitle={language === "tr"
            ? "Kazandıkların burada canlı görünür."
            : "Your earned badges stay live here."}
        />
        <View style={s.grid}>
          {visibleUnlockedBadges.map((badge) => (
            <BadgeVaultCard
              key={badge.id}
              badge={badge}
              theme={theme}
              language={language}
              onPress={() => handleBadgePress(badge)}
            />
          ))}
        </View>

        <SectionHeader
          theme={theme}
          title={language === "tr" ? "Kilitli rozetler" : "Locked badges"}
          subtitle={language === "tr"
            ? "Dokun ve nasıl açıldıklarını öğren."
            : "Tap any of them to see how they unlock."}
        />
        <View style={s.grid}>
          {visibleLockedBadges.map((badge) => (
            <BadgeVaultCard
              key={badge.id}
              badge={badge}
              theme={theme}
              language={language}
              onPress={() => handleBadgePress(badge)}
            />
          ))}
        </View>
        {filteredBadges.length === 0 ? (
          <View style={[s.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="albums-outline" size={18} color={theme.textMuted} />
            <Text style={[s.emptyTitle, { color: theme.text }]}>
              {language === "tr" ? "Bu filtrede rozet görünmüyor" : "No badges match this filter"}
            </Text>
            <Text style={[s.emptySubtitle, { color: theme.textMuted }]}>
              {language === "tr"
                ? "Başka bir sekme seç ya da serini ilerletip yeni rozetler aç."
                : "Try another tab or keep progressing to unlock more badges."}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <BadgeDetailSheet
        visible={Boolean(selectedBadge)}
        badge={selectedBadge}
        theme={theme}
        language={language}
        onClose={() => setSelectedBadge(null)}
      />

      <ConfettiOverlay ref={confettiRef} />
    </View>
  );
}

function SectionHeader({
  theme,
  title,
  subtitle,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  title: string;
  subtitle: string;
}) {
  return (
    <View style={s.sectionHeader}>
      <Text style={[s.sectionTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[s.sectionSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
    </View>
  );
}

function BadgeVaultCard({
  badge,
  theme,
  language,
  onPress,
}: {
  badge: BadgeCollectionItem;
  theme: ReturnType<typeof useTheme>["theme"];
  language: "tr" | "en";
  onPress: () => void;
}) {
  const accent = getToneColor(theme, badge.tone);

  return (
    <Pressable
      onPress={onPress}
      style={[
        s.badgeCard,
        {
          backgroundColor: badge.unlocked ? `${accent}10` : theme.surface,
          borderColor: badge.unlocked ? `${accent}44` : theme.border,
        },
      ]}
    >
      <View style={s.badgeTopRow}>
        <View style={[s.badgeSeal, { backgroundColor: `${accent}14`, borderColor: `${accent}30` }]}>
          <MaterialCommunityIcons name={badge.icon} size={20} color={accent} />
        </View>
        <View style={[s.statusPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[s.statusPillText, { color: badge.unlocked ? accent : theme.textMuted }]}>
            {badge.statusLabel}
          </Text>
        </View>
      </View>

      <Text style={[s.badgeTitle, { color: theme.text }]} numberOfLines={2}>
        {badge.title}
      </Text>
      <Text style={[s.badgeSubtitle, { color: theme.textMuted }]} numberOfLines={3}>
        {badge.unlocked ? badge.flavor : badge.hint}
      </Text>

      <View style={[s.track, { backgroundColor: theme.borderLight }]}>
        <View style={[s.fill, { width: `${Math.max(8, Math.round(badge.ratio * 100))}%`, backgroundColor: accent }]} />
      </View>

      <View style={s.cardFooter}>
        <Text style={[s.cardFooterText, { color: theme.textSub }]}>
          {badge.progressLabel}
        </Text>
        <Text style={[s.cardFooterText, { color: accent }]}>
          {language === "tr" ? "incele" : "inspect"}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingTop: 68,
    paddingHorizontal: spacing.base,
    paddingBottom: 42,
  },
  bgGlowTop: {
    position: "absolute",
    top: -42,
    right: -36,
    width: 176,
    height: 176,
    borderRadius: 88,
    opacity: 0.46,
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: 120,
    left: -48,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.38,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "800",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  heroOrb: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.92,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
    letterSpacing: -0.5,
    paddingRight: 56,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    maxWidth: 290,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroStat: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroStatValue: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
  },
  heroStatLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 3,
  },
  spotlightCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  sectionTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
  },
  spotlightBody: {
    flexDirection: "row",
    gap: 14,
  },
  spotlightSeal: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  spotlightTextCol: {
    flex: 1,
  },
  spotlightTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  spotlightCopy: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 10,
  },
  spotlightMeta: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
  spotlightPreviewWrap: {
    gap: 8,
    marginTop: 10,
  },
  spotlightPreviewRow: {
    flexDirection: "row",
    gap: 7,
  },
  spotlightPreviewChip: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  spotlightPreviewValue: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 2,
  },
  spotlightPreviewLabel: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  spotlightNudge: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "700",
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  emptySubtitle: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  badgeCard: {
    width: "48.2%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  badgeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  badgeSeal: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
    marginBottom: 5,
    minHeight: 36,
  },
  badgeSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    minHeight: 48,
    marginBottom: 10,
  },
  track: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 9,
  },
  cardFooterText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
});

