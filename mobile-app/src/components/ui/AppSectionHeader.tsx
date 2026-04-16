import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radii } from '../../theme/tokens';
import { dur, spring } from '../../hooks/useAuraMotion';

interface AppSectionHeaderProps {
  title: string;
  color?: string;
  count?: number;
  emoji?: string;
  delay?: number;
  subtitle?: string;
}

export default function AppSectionHeader({
  title,
  color,
  count,
  emoji,
  delay = 0,
  subtitle,
}: AppSectionHeaderProps) {
  const { theme } = useTheme();
  const c = color ?? theme.textMuted;

  const countOpacity = useSharedValue(count && count > 0 ? 1 : 0);
  const countScale   = useSharedValue(count && count > 0 ? 1 : 0.8);

  useEffect(() => {
    if (count && count > 0) {
      countOpacity.value = withTiming(1, { duration: dur.fast });
      countScale.value   = withSpring(1, spring.snappy);
    } else {
      countOpacity.value = withTiming(0, { duration: dur.fast });
      countScale.value   = withSpring(0.8, spring.gentle);
    }
  }, [count]);

  const countStyle = useAnimatedStyle(() => ({
    opacity:   countOpacity.value,
    transform: [{ scale: countScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(dur.base)}
      style={s.row}
    >
      <View style={[s.dot, { backgroundColor: c }]} />
      <View style={s.titleWrap}>
        <Text style={[s.title, { color: c }]}>
          {emoji ? `${emoji} ${title}` : title}
        </Text>
        {!!subtitle && (
          <Text style={[s.sub, { color: theme.textMuted }]}>{subtitle}</Text>
        )}
      </View>
      {count !== undefined && (
        <Animated.View style={[s.countPill, { backgroundColor: `${c}12`, borderColor: `${c}28` }, countStyle]}>
          <Text style={[s.countTxt, { color: c }]}>{Math.floor(count)}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm + 2,
    paddingHorizontal: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  titleWrap: { flex: 1 },
  title: {
    fontSize: 10.5,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    lineHeight: 14,
  },
  sub: {
    marginTop: 3,
    fontSize: 11.5,
    fontWeight: '500',
  },
  countPill: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countTxt: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
});
