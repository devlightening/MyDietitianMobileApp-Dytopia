import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import AppButton from './AppButton';

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

  return (
    <View style={[s.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[s.iconWrap, { backgroundColor: theme.primaryLight }]}>
        <Text style={s.icon}>{icon}</Text>
      </View>
      <Text style={[s.title, { color: theme.text }]}>{title}</Text>
      <Text style={[s.desc, { color: theme.textSub }]}>{description}</Text>
      {buttonLabel && onButtonPress && (
        <AppButton label={buttonLabel} onPress={onButtonPress} style={s.btn} />
      )}
    </View>
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
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
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
  btn: { alignSelf: 'stretch', marginTop: spacing.sm },
});
