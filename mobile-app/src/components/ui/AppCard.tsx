import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export default function AppCard({ children, style, elevated = false }: AppCardProps) {
  const { theme, isDark } = useTheme();
  return (
    <View
      style={[
        s.card,
        isDark ? s.cardDark : s.cardLight,
        {
          backgroundColor: elevated ? theme.surfaceElevated : theme.surface,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderWidth: isDark ? 0.5 : 0.5,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.base,
  },
  cardLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  cardDark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
});
