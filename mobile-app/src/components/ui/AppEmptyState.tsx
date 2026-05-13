import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { BRAND_LOGO } from '../../assets/brandAssets';

interface AppEmptyStateProps {
  icon: string;
  title: string;
  description: string;
  variant?: 'empty' | 'error' | 'offline' | 'search';
  buttonLabel?: string;
  onButtonPress?: () => void;
  secondaryButtonLabel?: string;
  onSecondaryButtonPress?: () => void;
}

export default function AppEmptyState({
  icon, title, description, variant = 'empty', buttonLabel, onButtonPress, secondaryButtonLabel, onSecondaryButtonPress,
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

  const accent = variant === 'error'
    ? theme.error
    : variant === 'offline'
      ? theme.warning
      : variant === 'search'
        ? theme.accentCyan
        : theme.primary;

  return (
    <Animated.View
      style={[
        s.container,
        { backgroundColor: theme.surface, borderColor: `${accent}26` },
      ]}
    >
      {/* Decorative glow ring */}
      <View style={[s.glowRing, { borderColor: `${accent}24`, backgroundColor: `${accent}08` }]}>
        <Animated.View style={[s.iconWrap, { backgroundColor: `${accent}16`, transform: [{ translateY: floatY }, { scale: pulse }] }]}>
          <Text style={s.icon}>{icon}</Text>
        </Animated.View>
      </View>

      <Text style={[s.title, { color: theme.text }]}>{title}</Text>
      <Text style={[s.desc, { color: theme.textSub }]}>{description}</Text>

      {buttonLabel && onButtonPress && (
        <TouchableOpacity
          style={[s.btn, { backgroundColor: accent }]}
          onPress={onButtonPress}
          activeOpacity={0.85}
        >
          <Text style={s.btnTxt}>{buttonLabel}</Text>
        </TouchableOpacity>
      )}

      {secondaryButtonLabel && onSecondaryButtonPress && (
        <TouchableOpacity
          style={[s.secondaryBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          onPress={onSecondaryButtonPress}
          activeOpacity={0.85}
        >
          <Text style={[s.secondaryBtnTxt, { color: theme.text }]}>{secondaryButtonLabel}</Text>
        </TouchableOpacity>
      )}

      <View style={[s.brandPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
        <Image source={BRAND_LOGO} style={s.brandLogo} resizeMode="contain" fadeDuration={0} />
        <Text style={[s.brandText, { color: theme.textMuted }]}>Dytopia</Text>
      </View>
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
  secondaryBtn: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    paddingVertical: 13,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryBtnTxt: { fontSize: 13, fontWeight: '900' },
  brandPill: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  brandLogo: { width: 18, height: 18, borderRadius: 6 },
  brandText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.2 },
});
