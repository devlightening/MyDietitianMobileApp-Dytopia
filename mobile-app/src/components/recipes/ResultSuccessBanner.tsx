import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { spacing, radii, type Theme } from '../../theme/tokens';
import { dur, spring, ease, useLoadingRings } from '../../hooks/useAuraMotion';

interface Props {
  count: number;
  theme: Theme;
}

export default function ResultSuccessBanner({ count, theme }: Props) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(-12);
  const scale      = useSharedValue(0.96);
  const { ringAStyle, ringBStyle } = useLoadingRings(count > 0);

  useEffect(() => {
    if (count <= 0) {
      opacity.value = withTiming(0, { duration: dur.fast });
      return;
    }

    opacity.value    = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: dur.base, easing: ease.outCubic }),
    );
    translateY.value = withSequence(
      withTiming(-12, { duration: 0 }),
      withSpring(0, spring.snappy),
    );
    scale.value      = withSequence(
      withTiming(0.96, { duration: 0 }),
      withSpring(1, spring.snappy),
    );

    const t = setTimeout(() => {
      opacity.value    = withTiming(0, { duration: dur.medium, easing: ease.inCubic });
      translateY.value = withTiming(-12, { duration: dur.medium });
    }, 3000);

    return () => clearTimeout(t);
  }, [count]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (count <= 0) return null;

  return (
    <Animated.View style={s.container} pointerEvents="none">
      <Animated.View
        style={[
          s.banner,
          {
            backgroundColor: theme.surfaceElevated,
            borderColor:     `${theme.borderEmerald}CC`,
            shadowColor:     theme.emerald,
          },
          wrapStyle,
        ]}
      >
        {/* Reactor mini */}
        <View style={s.reactorWrap}>
          <Animated.View style={[s.ringOuter, { borderColor: `${theme.emerald}38` }, ringAStyle]} />
          <Animated.View style={[s.ringInner, { borderColor: `${theme.primary}30` }, ringBStyle]} />
          <View style={[s.coreDot, { backgroundColor: theme.emerald }]} />
        </View>

        {/* Text */}
        <View>
          <Text style={[s.title, { color: theme.emerald }]}>{count} tarif bulundu</Text>
          <Text style={[s.sub,   { color: theme.textMuted }]}>Eşleşmeler hazır</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  banner: {
    borderWidth: 1.2,
    borderRadius: radii.full,
    paddingVertical: 9,
    paddingHorizontal: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 5,
  },
  reactorWrap: {
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.2,
  },
  ringInner: {
    position: 'absolute',
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1,
  },
  coreDot: {
    width: 7, height: 7, borderRadius: 3.5,
  },
  title: { fontSize: 13, fontWeight: '900', letterSpacing: -0.1 },
  sub:   { marginTop: 2, fontSize: 11, fontWeight: '600', opacity: 0.8 },
});

