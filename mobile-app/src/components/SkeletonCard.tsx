import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';

export default function SkeletonCard() {
  const { theme } = useTheme();
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={[s.card, { backgroundColor: theme.surface }]}>
      <Animated.View style={[s.shimmer, s.title, { opacity, backgroundColor: theme.border }]} />
      <Animated.View style={[s.shimmer, s.subtitle, { opacity, backgroundColor: theme.border }]} />
      <Animated.View style={[s.shimmer, s.content, { opacity, backgroundColor: theme.border }]} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radii.xl, padding: spacing.lg, marginBottom: spacing.md },
  shimmer: { borderRadius: 4 },
  title: { width: '40%', height: 20, marginBottom: spacing.sm },
  subtitle: { width: '60%', height: 16, marginBottom: spacing.md },
  content: { width: '100%', height: 80 },
});
