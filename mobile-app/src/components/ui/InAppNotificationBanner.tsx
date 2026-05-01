import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, spacing } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import type { InAppNotificationPayload, InAppNotificationTone } from "../../notifications/notificationTypes";

type Props = {
  notification: InAppNotificationPayload;
  onDismiss: () => void;
};

function resolveToneColors(theme: ReturnType<typeof useTheme>["theme"], tone: InAppNotificationTone) {
  switch (tone) {
    case "emerald":
      return { border: theme.borderEmerald, glow: theme.glassEmerald, icon: theme.emerald };
    case "gold":
      return { border: `${theme.accentGold}48`, glow: `${theme.accentGold}12`, icon: theme.accentGold };
    case "coral":
      return { border: `${theme.accentCoral}48`, glow: `${theme.accentCoral}12`, icon: theme.accentCoral };
    case "cyan":
      return { border: `${theme.primary}40`, glow: `${theme.primary}10`, icon: theme.primary };
    default:
      return { border: theme.border, glow: theme.glass, icon: theme.primary };
  }
}

export default function InAppNotificationBanner({ notification, onDismiss }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const tone = resolveToneColors(theme, notification.tone);

  useEffect(() => {
    translateY.setValue(-140);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }, [notification.dedupKey, opacity, translateY]);

  return (
    <Animated.View
      style={[
        s.wrap,
        {
          top: insets.top + spacing.sm,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          s.card,
          {
            backgroundColor: theme.surface,
            borderColor: tone.border,
            shadowColor: theme.primaryDark,
          },
        ]}
      >
        <View style={[s.iconWrap, { backgroundColor: tone.glow, borderColor: tone.border }]}>
          <Ionicons name={notification.icon as any} size={18} color={tone.icon} />
        </View>
        <View style={s.content}>
          <Text style={[s.title, { color: theme.text }]} numberOfLines={1}>{notification.title}</Text>
          <Text style={[s.body, { color: theme.textSub }]} numberOfLines={2}>{notification.body}</Text>
        </View>
        {notification.ctaLabel ? (
          <TouchableOpacity
            onPress={notification.onPress}
            activeOpacity={0.84}
            style={[s.cta, { backgroundColor: tone.glow, borderColor: tone.border }]}
          >
            <Text style={[s.ctaText, { color: tone.icon }]}>{notification.ctaLabel}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onDismiss} activeOpacity={0.75} style={s.close}>
            <Ionicons name="close" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 80,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: "900" },
  body: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
  cta: {
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ctaText: { fontSize: 11.5, fontWeight: "900" },
  close: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
