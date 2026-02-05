import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors, spacing } from '../theme';

/**
 * Skeleton loading component for Dashboard cards
 * Shows shimmer effect while data is loading
 */
export default function SkeletonCard() {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.shimmer, styles.title, { opacity }]} />
      <Animated.View style={[styles.shimmer, styles.subtitle, { opacity }]} />
      <Animated.View style={[styles.shimmer, styles.content, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  shimmer: {
    backgroundColor: colors.border,
    borderRadius: 4,
  },
  title: {
    width: '40%',
    height: 20,
    marginBottom: spacing.sm,
  },
  subtitle: {
    width: '60%',
    height: 16,
    marginBottom: spacing.md,
  },
  content: {
    width: '100%',
    height: 80,
  },
});
