import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import type { DashboardError } from '../data/dashboardRepo';

interface ErrorStateProps {
  error: DashboardError;
  onRetry: () => void;
  onLogout?: () => void;
}

export default function ErrorState({ error, onRetry, onLogout }: ErrorStateProps) {
  const { theme } = useTheme();

  const content = (() => {
    if (error.type === 'Unauthorized') return { icon: '🔒', title: 'Oturum Süreniz Doldu', action: onLogout ? { label: 'Giriş Yap', fn: onLogout } : null };
    if (error.type === 'NotFound')      return { icon: '🔍', title: 'Bağlantı Kurulamadı',  action: { label: 'Tekrar Dene', fn: onRetry } };
    if (error.type === 'NetworkError')  return { icon: '📡', title: 'Bağlantı Hatası',       action: { label: 'Tekrar Dene', fn: onRetry } };
    return { icon: '⚠️', title: 'Sunucu Hatası', action: { label: 'Tekrar Dene', fn: onRetry } };
  })();

  return (
    <View style={s.container}>
      <Text style={s.icon}>{content.icon}</Text>
      <Text style={[s.title, { color: theme.text }]}>{content.title}</Text>
      <Text style={[s.message, { color: theme.textSub }]}>{error.message}</Text>
      {content.action && (
        <TouchableOpacity
          style={[s.button, { backgroundColor: theme.primary }]}
          onPress={content.action.fn}
        >
          <Text style={s.buttonText}>{content.action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  icon: { fontSize: 48, marginBottom: spacing.md },
  title: { fontSize: 20, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 21 },
  button: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radii.lg, minWidth: 140 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
