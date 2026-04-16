import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator, View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outlined' | 'outlined-danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function AppButton({
  label, onPress, variant = 'primary', loading = false, disabled = false, style,
}: AppButtonProps) {
  const { theme } = useTheme();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'outlined-danger';
  const tint = isDanger ? theme.error : theme.primary;

  return (
    <TouchableOpacity
      style={[
        s.btn,
        isPrimary
          ? { backgroundColor: tint, shadowColor: tint }
          : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: tint },
        (disabled || loading) && s.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? '#FFF' : tint} />
      ) : (
        <Text style={[s.label, { color: isPrimary ? '#FFF' : tint }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  label: {
    fontSize: typography.bodySm,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
  },
});
