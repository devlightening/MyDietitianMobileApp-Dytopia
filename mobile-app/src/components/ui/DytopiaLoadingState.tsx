import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { radii, spacing } from "../../theme/tokens";

const BRAND_LOGO = require("../../../assets/dytopia-logo.png");

type Props = {
  title?: string;
  subtitle?: string;
};

export default function DytopiaLoadingState({
  title = "Dytopia hazırlanıyor",
  subtitle = "Planın, dolabın ve önerilerin senkronize ediliyor.",
}: Props) {
  const { theme } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.045, duration: 1250, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1250, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
      <View style={[s.halo, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Image source={BRAND_LOGO} style={s.logo} resizeMode="contain" />
        </Animated.View>
      </View>
      <Text style={[s.title, { color: theme.text }]}>{title}</Text>
      <Text style={[s.subtitle, { color: theme.textSub }]}>{subtitle}</Text>
      <ActivityIndicator size="small" color={theme.primary} style={s.spinner} />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 230,
    shadowColor: "#183324",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  halo: {
    width: 104,
    height: 104,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 260,
  },
  spinner: { marginTop: spacing.md },
});
