import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={s.container}>
      <Text style={s.icon}>{icon}</Text>
      <Text style={[s.title, { color: theme.text }]}>{title}</Text>
      <Text style={[s.description, { color: theme.textSub }]}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={[s.button, { backgroundColor: theme.primary }]} onPress={onAction}>
          <Text style={s.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  icon: { fontSize: 64, marginBottom: spacing.md },
  title: { fontSize: 20, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'center' },
  description: { fontSize: 14, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  button: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radii.lg },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
