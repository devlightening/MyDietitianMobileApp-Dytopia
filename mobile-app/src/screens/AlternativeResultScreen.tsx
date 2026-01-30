import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import DecisionCard from '../components/DecisionCard';
import type { AlternativeDecisionResponse } from '../types/alternative';
import { colors, spacing } from '../theme';

type AlternativeResultRouteProp = RouteProp<{
  params: {
    decision: AlternativeDecisionResponse;
    recipeName: string;
  };
}>;

export default function AlternativeResultScreen() {
  const route = useRoute<AlternativeResultRouteProp>();
  const navigation = useNavigation();
  const { decision, recipeName } = route.params;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <DecisionCard
          canCookOriginal={decision.canCookOriginal}
          explanation={decision.explanation}
          alternativeRecipe={decision.alternativeRecipe}
          originalRecipeName={recipeName}
        />

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Today' as never)} // Routes.Premium.Today
        >
          <Text style={styles.backText}>Planıma Dön</Text>
        </TouchableOpacity>

        {decision.alternativeRecipe && (
          <Text style={styles.infoText}>
            💡 Alternatif öneri diyetisyenin belirlediği kurallara göre seçildi
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingTop: spacing.xl + 20,
  },
  backButton: {
    backgroundColor: colors.primary,
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  backText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },
});
