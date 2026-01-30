import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing } from '../theme';
import { Routes } from '../navigation/routes';
import * as Clipboard from 'expo-clipboard';

export default function FreeHomeScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();

  async function copyUserId() {
    if (user?.publicUserId) {
      await Clipboard.setStringAsync(user.publicUserId);
      Alert.alert('✅ Kopyalandı!', `Kullanıcı ID'niz panoya kopyalandı:\n${user.publicUserId}`);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>MyDietitian</Text>
          {user?.publicUserId && (
            <View style={styles.idCard}>
              <Text style={styles.idLabel}>KULLANICI ID</Text>
              <View style={styles.idRow}>
                <Text style={styles.userId}>{user.publicUserId}</Text>
                <TouchableOpacity onPress={copyUserId} style={styles.copyButton}>
                  <Text style={styles.copyIcon}>📋</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.userIdHint}>
                Bu ID'yi diyetisyeninizle paylaşın
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.welcomeTitle}>🌟 Hoş Geldiniz!</Text>
        <Text style={styles.welcomeText}>
          MyDietitian hesabınız oluşturuldu. Ücretsiz özellikleri kullanabilir veya premium özelliklerden faydalanmak için diyetisyeninizden aldığınız access key ile aktivasyon yapabilirsiniz.
        </Text>

        <TouchableOpacity
          style={styles.activateButton}
          onPress={() => {
            // Navigate to modal - accessible from any stack
            navigation.getParent()?.navigate(Routes.Modal.ActivatePremium as never);
          }}
        >
          <Text style={styles.activateButtonText}>Premium'a Geç →</Text>
        </TouchableOpacity>

        <View style={styles.featuresGrid}>
          <TouchableOpacity
            style={styles.featureCard}
            onPress={() => {
              // TODO: Navigate to Public Recipes when implemented
              Alert.alert('Yakında', 'Public Recipes özelliği yakında eklenecek');
            }}
          >
            <Text style={styles.featureIcon}>📚</Text>
            <Text style={styles.featureCardTitle}>Public Recipes</Text>
            <Text style={styles.featureCardText}>Ücretsiz tarifler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureCard}
            onPress={() => {
              // TODO: Navigate to Measurements when implemented
              Alert.alert('Yakında', 'Measurements özelliği yakında eklenecek');
            }}
          >
            <Text style={styles.featureIcon}>📊</Text>
            <Text style={styles.featureCardTitle}>Measurements</Text>
            <Text style={styles.featureCardText}>Ölçüm takibi</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featureBox}>
          <Text style={styles.featureTitle}>✨ Premium Özellikleri</Text>
          <Text style={styles.featureItem}>🥗 Kişisel diyet planları</Text>
          <Text style={styles.featureItem}>📊 Öğün takibi ve uyum skorları</Text>
          <Text style={styles.featureItem}>🔄 Alternatif öğün önerileri</Text>
          <Text style={styles.featureItem}>📈 İlerleme ve streak takibi</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Diyetisyen ile çalışmıyorsanız, size uygun bir diyetisyen bulmak için iletişime geçebilirsiniz.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    paddingTop: spacing.xl + 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  idCard: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    marginTop: spacing.xs,
  },
  idLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  copyButton: {
    padding: spacing.xs,
    backgroundColor: colors.primary + '20',
    borderRadius: 8,
  },
  copyIcon: {
    fontSize: 20,
  },
  userIdHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  logoutText: {
    color: colors.error,
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  featureBox: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  featureItem: {
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  activateButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  activateButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#f0f9ff',
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  infoText: {
    fontSize: 14,
    color: '#0c4a6e',
    lineHeight: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  featureCard: {
    width: '48%',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  featureCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  featureCardText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
