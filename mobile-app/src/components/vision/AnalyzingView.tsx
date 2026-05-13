import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { BRAND_LOGO } from "../../assets/brandAssets";

const DEFAULT_MESSAGES = [
  "Fotoğraf analiz ediliyor...",
  "Malzemeler tanımlanıyor...",
  "Sonuçlar hazırlanıyor...",
];

type Props = {
  theme: any;
  messages?: string[];
  hint?: string;
};

export default function AnalyzingView({
  theme,
  messages = DEFAULT_MESSAGES,
  hint = "Bu işlem 10–20 saniye sürebilir",
}: Props) {
  const [msgIndex, setMsgIndex] = useState(0);

  const ring1Scale = useSharedValue(1.0);
  const ring1Opacity = useSharedValue(0.35);
  const ring2Scale = useSharedValue(0.95);
  const ring3Opacity = useSharedValue(0.55);
  const logoScale = useSharedValue(1.0);
  const scanAngle = useSharedValue(0);

  useEffect(() => {
    ring1Scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: 1600, easing: Easing.in(Easing.quad) }),
      ), -1, false,
    );
    ring1Opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 1600, easing: Easing.in(Easing.quad) }),
      ), -1, false,
    );
    ring2Scale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1600, easing: Easing.out(Easing.quad) }),
          withTiming(0.95, { duration: 1600, easing: Easing.in(Easing.quad) }),
        ), -1, false,
      ),
    );
    ring3Opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1200 }),
        withTiming(0.4, { duration: 1200 }),
      ), -1, false,
    );
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1400, easing: Easing.out(Easing.ease) }),
        withTiming(0.97, { duration: 1400, easing: Easing.in(Easing.ease) }),
      ), -1, false,
    );
    scanAngle.value = withRepeat(
      withTiming(360, { duration: 2800, easing: Easing.linear }),
      -1, false,
    );

    const timer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 2400);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    opacity: ring3Opacity.value,
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));
  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${scanAngle.value}deg` }],
  }));

  return (
    <View style={s.container}>
      <View style={s.orbitArea}>
        <Animated.View style={[s.ring, s.ring1, { borderColor: `${theme.primary}20` }, ring1Style]} />
        <Animated.View style={[s.ring, s.ring2, { borderColor: `${theme.primary}36` }, ring2Style]} />
        <Animated.View style={[s.ring, s.ring3, { borderColor: theme.borderEmerald }, ring3Style]} />
        <Animated.View
          style={[
            s.scanArc,
            {
              borderTopColor: theme.primary,
              borderRightColor: `${theme.primary}40`,
              borderBottomColor: "transparent",
              borderLeftColor: "transparent",
            },
            scanStyle,
          ]}
        />
        <Animated.View
          style={[s.logoBubble, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }, logoStyle]}
        >
          <Image source={BRAND_LOGO} style={s.logoImg} resizeMode="contain" fadeDuration={0} />
        </Animated.View>
      </View>

      <Animated.Text
        key={msgIndex}
        entering={FadeInDown.duration(380)}
        style={[s.message, { color: theme.text }]}
      >
        {messages[msgIndex]}
      </Animated.Text>
      <Text style={[s.hint, { color: theme.textMuted }]}>{hint}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  orbitArea: {
    width: 200,
    height: 200,
    marginBottom: 44,
  },
  ring: {
    position: "absolute",
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  ring1: { width: 200, height: 200, top: 0, left: 0 },
  ring2: { width: 152, height: 152, top: 24, left: 24 },
  ring3: { width: 108, height: 108, top: 46, left: 46 },
  scanArc: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 2,
  },
  logoBubble: {
    position: "absolute",
    top: 62,
    left: 62,
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  logoImg: {
    width: 62,
    height: 62,
    borderRadius: 16,
  },
  message: {
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  hint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
});
