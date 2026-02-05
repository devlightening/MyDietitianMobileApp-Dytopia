import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../theme';
import type { DashboardError } from '../data/dashboardRepo';

interface ErrorStateProps {
  error: DashboardError;
  onRetry: () => void;
  onLogout?: () => void;
}

/**
 * Professional error state component with action-specific UI
 * AG-DASH-FIX-03: Different UI for 401/404/500/network errors
 */
export default function ErrorState({ error, onRetry, onLogout }: ErrorStateProps) {
  // 401 Unauthorized - Session expired
  if (error.type === 'Unauthorized') {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>Oturum Süreniz Doldu</Text>
        <Text style={styles.message}>{error.message}</Text>
        {onLogout && (
          <TouchableOpacity style={styles.button} onPress={onLogout}>
            <Text style={styles.buttonText}>Giriş Yap</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // 404 Not Found - Endpoint missing
  if (error.type === 'NotFound') {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>🔍</Text>
        <Text style={styles.title}>Endpoint Bulunamadı</Text>
        <Text style={styles.message}>{error.message}</Text>
        {__DEV__ && (
          <Text style={styles.devInfo}>
            Status: {error.status} | Path: /api/client/dashboard
          </Text>
        )}
        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Network Error - Cannot reach server
  if (error.type === 'NetworkError') {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>📡</Text>
        <Text style={styles.title}>Bağlantı Hatası</Text>
        <Text style={styles.message}>{error.message}</Text>
        <Text style={styles.hint}>
          Wi-Fi bağlantınızı kontrol edin veya backend'in çalıştığından emin olun.
        </Text>
        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Server Error (500+)
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>Sunucu Hatası</Text>
      <Text style={styles.message}>{error.message}</Text>
      {__DEV__ && error.status && (
        <Text style={styles.devInfo}>HTTP Status: {error.status}</Text>
      )}
      <TouchableOpacity style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Tekrar Dene</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  hint: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  devInfo: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 4,
  },
  button: {
    backgroundColor: colors.sage,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
    minWidth: 140,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
