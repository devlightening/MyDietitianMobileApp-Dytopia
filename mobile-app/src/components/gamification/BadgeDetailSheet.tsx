import React, { useEffect, useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { BadgeCollectionItem } from "../../motivation/streaks";
import { getToneColor } from "../../motivation/streaks";
import type { Theme } from "../../theme/tokens";
import { radii, spacing } from "../../theme/tokens";

export default function BadgeDetailSheet({
  visible,
  badge,
  theme,
  language,
  onClose,
}: {
  visible: boolean;
  badge?: BadgeCollectionItem | null;
  theme: Theme;
  language: "tr" | "en";
  onClose: () => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: 220 });
  }, [progress, visible]);

  const accent = badge ? getToneColor(theme, badge.tone) : theme.primary;
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [28, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.97, 1]) },
    ],
  }));

  const unlockedAtLabel = useMemo(() => {
    if (!badge?.unlockedAtUtc) return null;
    try {
      return new Date(badge.unlockedAtUtc).toLocaleDateString(
        language === "tr" ? "tr-TR" : "en-US",
        { day: "numeric", month: "short" },
      );
    } catch {
      return null;
    }
  }, [badge?.unlockedAtUtc, language]);

  const insightItems = useMemo(() => ([
    {
      label: language === "tr" ? "Aile" : "Family",
      value: badge?.familyLabel ?? "",
    },
    {
      label: language === "tr" ? "İlerleme" : "Progress",
      value: badge?.progressLabel ?? "",
    },
    {
      label: language === "tr" ? "Döngü" : "Mode",
      value: badge?.isDailyReset
        ? (language === "tr" ? "24 saatlik" : "24-hour")
        : (language === "tr" ? "Kalıcı" : "Persistent"),
    },
    {
      label: language === "tr" ? "Durum" : "Status",
      value: badge?.statusLabel ?? "",
    },
  ]), [badge?.familyLabel, badge?.isDailyReset, badge?.progressLabel, badge?.statusLabel, language]);

  if (!visible || !badge) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.root}>
        <Animated.View style={[s.overlay, { backgroundColor: "rgba(11, 18, 13, 0.42)" }, overlayStyle]} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: `${accent}44`,
              shadowColor: theme.shadowCard,
            },
            sheetStyle,
          ]}
        >
          <View style={s.grabberWrap}>
            <View style={[s.grabber, { backgroundColor: theme.border }]} />
          </View>

          <View style={s.topRow}>
            <View style={s.titleWrap}>
              <Text style={[s.eyebrow, { color: accent }]}>
                {badge.familyLabel.toUpperCase()}
              </Text>
              <Text style={[s.title, { color: theme.text }]}>{badge.title}</Text>
              <Text style={[s.subtitle, { color: theme.textSub }]}>{badge.subtitle}</Text>
            </View>

            <Pressable
              onPress={onClose}
              style={[s.closeButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            >
              <Ionicons name="close" size={16} color={theme.textMuted} />
            </Pressable>
          </View>

          <View style={s.heroRow}>
            <View style={[s.seal, { backgroundColor: `${accent}14`, borderColor: `${accent}38` }]}>
              <View style={[s.sealCore, { backgroundColor: theme.surface }]}>
                <MaterialCommunityIcons name={badge.icon} size={28} color={accent} />
              </View>
              {badge.unlocked ? (
                <View style={[s.cornerBadge, { backgroundColor: accent }]}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                </View>
              ) : (
                <View style={[s.cornerBadge, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <Ionicons name="lock-closed" size={11} color={theme.textMuted} />
                </View>
              )}
            </View>

            <View style={s.metaCol}>
              <View style={s.pillRow}>
                <View style={[s.pill, { backgroundColor: `${accent}12`, borderColor: `${accent}32` }]}>
                  <Text style={[s.pillText, { color: accent }]}>{badge.statusLabel}</Text>
                </View>
                {badge.isRecentUnlock && (
                  <View style={[s.pill, { backgroundColor: `${theme.accentGold}15`, borderColor: `${theme.accentGold}36` }]}>
                    <Text style={[s.pillText, { color: theme.accentGold }]}>
                      {language === "tr" ? "YENİ" : "NEW"}
                    </Text>
                  </View>
                )}
                {badge.isDailyReset && (
                  <View style={[s.pill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                    <Text style={[s.pillText, { color: theme.textSub }]}>
                      {language === "tr" ? "24 saat" : "24h"}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={[s.progressLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "İlerleme" : "Progress"}
              </Text>
              <View style={[s.track, { backgroundColor: theme.borderLight }]}>
                <View
                  style={[
                    s.fill,
                    {
                      width: `${Math.max(8, Math.round(badge.ratio * 100))}%`,
                      backgroundColor: accent,
                    },
                  ]}
                />
              </View>
              <Text style={[s.progressValue, { color: theme.textSub }]}>
                {badge.progressLabel}
                {unlockedAtLabel
                  ? ` · ${language === "tr" ? "açılış" : "unlocked"} ${unlockedAtLabel}`
                  : ""}
              </Text>
            </View>
          </View>

          <View style={s.insightGrid}>
            {insightItems.map((item) => (
              <View
                key={item.label}
                style={[s.insightCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              >
                <Text style={[s.insightLabel, { color: theme.textMuted }]}>{item.label}</Text>
                <Text style={[s.insightValue, { color: theme.text }]} numberOfLines={1}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          <View style={[s.infoCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Text style={[s.infoTitle, { color: theme.text }]}>
              {badge.unlocked
                    ? (language === "tr" ? "Bu rozeti nasıl aldın" : "How you earned it")
                    : (language === "tr" ? "Kilidi nasıl açılır" : "How to unlock")}
            </Text>
            <Text style={[s.infoBody, { color: theme.textSub }]}>{badge.detailCopy}</Text>
          </View>

          <View style={[s.infoCard, { backgroundColor: `${accent}10`, borderColor: `${accent}22` }]}>
            <Text style={[s.infoTitle, { color: theme.text }]}>
              {language === "tr" ? "Oyun modu yorumu" : "Game mode flavor"}
            </Text>
            <Text style={[s.infoBody, { color: theme.textSub }]}>{badge.flavor}</Text>
          </View>

          {badge.resetDetail ? (
            <View style={[s.resetRow, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Ionicons name="time-outline" size={15} color={theme.emerald} />
              <Text style={[s.resetText, { color: theme.emerald }]}>{badge.resetDetail}</Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 18,
  },
  grabberWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  grabber: {
    width: 48,
    height: 5,
    borderRadius: 999,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 14,
  },
  titleWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  seal: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sealCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  cornerBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  metaCol: {
    flex: 1,
  },
  insightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  insightCard: {
    width: "47%",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  insightValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  track: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 7,
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
  progressValue: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  infoCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 6,
  },
  infoBody: {
    fontSize: 12.5,
    lineHeight: 19,
  },
  resetRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 2,
  },
  resetText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 17,
  },
});

