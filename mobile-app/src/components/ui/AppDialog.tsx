import React, { useEffect, useRef } from "react";
import { Animated as RNAnimated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeContext";
import { radii, spacing } from "../../theme/tokens";

type DialogVariant = "success" | "warning" | "error" | "info";
type DialogActionTone = "primary" | "warning" | "danger" | "muted";

interface DialogAction {
  label: string;
  onPress: () => void;
  tone?: DialogActionTone;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}

interface AppDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  eyebrow?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  variant?: DialogVariant;
  primaryAction: DialogAction;
  secondaryAction?: DialogAction;
  suggestions?: DialogAction[];
  onDismiss?: () => void;
}

export default function AppDialog({
  visible,
  title,
  message,
  eyebrow,
  icon,
  variant = "info",
  primaryAction,
  secondaryAction,
  suggestions,
  onDismiss,
}: AppDialogProps) {
  const { theme, isDark } = useTheme();
  const iconScale = useRef(new RNAnimated.Value(0.94)).current;
  const accent =
    variant === "success"
      ? theme.success
      : variant === "warning"
        ? theme.warning
        : variant === "error"
          ? theme.error
          : theme.primary;
  const resolvedIcon =
    icon ?? (variant === "success" ? "checkmark-circle-outline" : variant === "warning" ? "alert-circle-outline" : variant === "error" ? "close-circle-outline" : "information-circle-outline");

  function actionColor(tone?: DialogActionTone) {
    if (tone === "warning") return theme.warning;
    if (tone === "danger") return theme.error;
    if (tone === "muted") return theme.surfaceElevated;
    return accent;
  }

  function actionTextColor(tone?: DialogActionTone) {
    return tone === "muted" ? theme.text : "#FFFFFF";
  }

  useEffect(() => {
    if (!visible) return;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(iconScale, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(iconScale, { toValue: 0.96, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [iconScale, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={s.layer}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}>
          <Animated.View
            entering={FadeIn.duration(140)}
            exiting={FadeOut.duration(120)}
            style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(3,8,5,0.72)" : "rgba(12,31,20,0.54)" }]}
          />
        </Pressable>

        <Animated.View
          entering={FadeInDown.duration(260).springify().damping(17)}
          exiting={FadeOut.duration(130)}
          style={[s.card, { backgroundColor: theme.surface, borderColor: theme.borderEmerald, shadowColor: theme.shadowEmerald }]}
        >
          <View style={[s.glow, { backgroundColor: `${accent}22` }]} />
          <RNAnimated.View style={[s.iconWrap, { backgroundColor: `${accent}18`, borderColor: `${accent}38`, transform: [{ scale: iconScale }] }]}>
            <Ionicons name={resolvedIcon} size={34} color={accent} />
          </RNAnimated.View>

          {!!eyebrow && <Text style={[s.eyebrow, { color: accent }]}>{eyebrow}</Text>}
          <Text style={[s.title, { color: theme.text }]}>{title}</Text>
          {!!message && <Text style={[s.message, { color: theme.textSub }]}>{message}</Text>}

          {!!suggestions?.length && (
            <View style={s.suggestions}>
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.label}
                  style={[s.suggestionBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                  activeOpacity={0.84}
                  onPress={suggestion.onPress}
                >
                  <Ionicons name={suggestion.icon ?? "sparkles-outline"} size={16} color={actionColor(suggestion.tone)} />
                  <Text style={[s.suggestionTxt, { color: theme.text }]}>{suggestion.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={s.actions}>
            {!!secondaryAction && (
              <TouchableOpacity
                style={[s.secondaryBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                activeOpacity={0.84}
                onPress={secondaryAction.onPress}
              >
                <Text style={[s.secondaryTxt, { color: theme.text }]}>{secondaryAction.label}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: actionColor(primaryAction.tone), shadowColor: actionColor(primaryAction.tone) }]}
              activeOpacity={0.88}
              onPress={primaryAction.onPress}
            >
              <Text style={[s.primaryTxt, { color: actionTextColor(primaryAction.tone) }]}>{primaryAction.label}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  layer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: 20,
    alignItems: "center",
    overflow: "hidden",
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  glow: {
    position: "absolute",
    top: -90,
    width: 210,
    height: 210,
    borderRadius: 105,
  },
  iconWrap: {
    width: 70,
    height: 70,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 7,
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.55,
  },
  message: {
    marginTop: 9,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    width: "100%",
  },
  suggestions: {
    width: "100%",
    gap: 8,
    marginTop: 16,
  },
  suggestionBtn: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  suggestionTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryTxt: {
    fontSize: 14,
    fontWeight: "900",
  },
  primaryBtn: {
    flex: 1.25,
    minHeight: 52,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    shadowOpacity: 0.22,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  primaryTxt: {
    fontSize: 15,
    fontWeight: "900",
  },
});
