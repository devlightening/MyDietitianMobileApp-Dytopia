import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface AppEmptyStateProps {
  icon: string;
  title: string;
  description: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
}

export default function AppEmptyState({
  icon, title, description, buttonLabel, onButtonPress,
}: AppEmptyStateProps) {
  const { theme } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -8, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0,  duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        s.container,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      {/* Decorative glow ring */}
      <View style={[s.glowRing, { borderColor: `${theme.primary}22`, backgroundColor: `${theme.primary}08` }]}>
        <Animated.View style={[s.iconWrap, { backgroundColor: theme.primaryLight, transform: [{ translateY: floatY }, { scale: pulse }] }]}>
          <Text style={s.icon}>{icon}</Text>
        </Animated.View>
      </View>

      <Text style={[s.title, { color: theme.text }]}>{title}</Text>
      <Text style={[s.desc, { color: theme.textSub }]}>{description}</Text>

      {buttonLabel && onButtonPress && (
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.primary }]}
          onPress={onButtonPress}
          activeOpacity={0.85}
        >
          <Text style={s.btnTxt}>{buttonLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  glowRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 32 },
  title: {
    fontSize: typography.h3,
    fontWeight: '900',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  desc: {
    fontSize: typography.caption,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
    marginBottom: spacing.base,
  },
  btn: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: radii.xl,
    alignItems: 'center',
  },
  btnTxt: { color: '#FFF', fontSize: 14, fontWeight: '900' },
});
