import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing } from '../theme';
import api from '../api/client';

export default function ProfileMeasurementsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestMeasurement, setLatestMeasurement] = useState<any>(null);

  React.useEffect(() => {
    loadLatestMeasurement();
  }, []);

  async function loadLatestMeasurement() {
    try {
      const response = await api.get('/api/client/progress/measurements');
      if (response.data.latest) {
        setLatestMeasurement(response.data.latest);
        setHeightCm(response.data.latest.heightCm.toString());
      }
    } catch (error) {
      console.log('No measurements yet');
    }
  }

  async function handleSubmit() {
    if (!weightKg || !heightCm) {
      Alert.alert('Eksik Bilgi', 'Lütfen kilo ve boyunuzu girin');
      return;
    }

    const weight = parseFloat(weightKg);
    const height = parseInt(heightCm);

    if (weight <= 0 || weight > 500) {
      Alert.alert('Geçersiz', 'Kilo 0-500 kg arasında olmalı');
      return;
    }

    if (height <= 0 || height > 300) {
      Alert.alert('Geçersiz', 'Boy 0-300 cm arasında olmalı');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/client/progress/measurements', {
        weightKg: weight,
        heightCm: height
      });

      Alert.alert(
        '✅ Harika!',
        `${response.data.message}\n\nBMI: ${response.data.bmi.toFixed(1)} (${response.data.bmiCategory})\nBMR: ${response.data.bmr.toFixed(0)} kalori`
      );

      setWeightKg('');
      loadLatestMeasurement();
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.message || 'Ölçüm kaydedilemedi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ölçümlerim</Text>
        <Text style={styles.subtitle}>
          Kendin için güzel bir adım - verile rin planını daha iyi hale getirecek
        </Text>
      </View>

      {latestMeasurement && (
        <View style={styles.latestCard}>
          <Text style={styles.cardTitle}>Son Ölçüm</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{latestMeasurement.weightKg} kg</Text>
              <Text style={styles.metricLabel}>Kilo</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{latestMeasurement.bmi.toFixed(1)}</Text>
              <Text style={styles.metricLabel}>BMI ({latestMeasurement.bmiCategory})</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{latestMeasurement.bmr.toFixed(0)}</Text>
              <Text style={styles.metricLabel}>BMR (kcal)</Text>
            </View>
          </View>
          <Text style={styles.dateText}>
            {new Date(latestMeasurement.createdAt).toLocaleDateString('tr-TR')}
          </Text>
        </View>
      )}

      <View style={styles.form}>
        <Text style={styles.formTitle}>Yeni Ölçüm Ekle</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kilo (kg)</Text>
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
            placeholder="Örn: 75.5"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Boy (cm)</Text>
          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="number-pad"
            placeholder="Örn: 175"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Kaydediliyor...' : 'Ölçümü Kaydet'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Günde bir kez ölçüm kaydedebilirsiniz
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl + 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  latestCard: {
    margin: spacing.lg,
    marginTop: 0,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  form: {
    margin: spacing.lg,
    marginTop: 0,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    backgroundColor: colors.textMuted,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
});
