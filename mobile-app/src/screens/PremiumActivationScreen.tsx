import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing } from '../theme';

export default function PremiumActivationScreen() {
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { activatePremium, refreshUserState } = useAuth();
  const navigation = useNavigation();

  async function handleActivate() {
    if (!accessKey.trim()) {
      Alert.alert('Hata', 'Lütfen access key girin');
      return;
    }

    setLoading(true);
    try {
      const result = await activatePremium(accessKey);

      if (result.success) {
        // 🔥 Refresh user state to get updated premium status
        // This will trigger root navigator to switch to PremiumStack
        await refreshUserState();
        
        // Close modal
        navigation.goBack();
        
        Alert.alert(
          '🎉 Premium Aktif!',
          `${result.dietitianName} ile çalışmaya başladınız. ${result.message}`,
          [
            {
              text: 'Harika!',
              onPress: () => {
                // Root navigator will automatically switch to PremiumStack
                // when isPremium becomes true (already done via refreshUserState)
              },
            },
          ]
        );
      } else {
        Alert.alert('Aktivasyon Başarısız', result.message);
      }
    } catch (error: any) {
      Alert.alert('Hata', 'Aktivasyon sırasında bir sorun oluştu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Geri</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>🔑 Premium Aktivasyonu</Text>
        <Text style={styles.subtitle}>
          Diyetisyeninizden aldığınız access key'i girerek premium özelliklerini aktif edin
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Access Key (örn: MD-XXXX-YYYY)"
          value={accessKey}
          onChangeText={setAccessKey}
          autoCapitalize="characters"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleActivate}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Aktif ediliyor...' : 'Aktif Et'}
          </Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 Bilgi</Text>
          <Text style={styles.infoText}>
            • Access key diyetisyeniniz tarafından oluşturulur{'\n'}
            • Key'iniz süresiz mi yoksa belirli bir süre için mi geçerli, diyetisyeniniz bilgilendirir{'\n'}
            • Aktivasyon sonrası hemen diyet planınıza erişebilirsiniz
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: spacing.lg,
    paddingTop: spacing.xl + 20,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
    textAlign: 'center',
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
