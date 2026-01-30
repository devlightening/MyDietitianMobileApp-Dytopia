import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { decideAlternative } from '../api/alternative';
import IngredientSearch from '../components/IngredientSearch';
import IngredientChip from '../components/IngredientChip';
import type { Ingredient } from '../types/alternative';
import { colors, spacing } from '../theme';

type CheckIngredientsRouteProp = RouteProp<{
  params: {
    mealId: string;
    plannedRecipeId: string;
    mealType: number;
    recipeName: string;
  };
}>;

export default function CheckIngredientsScreen() {
  const route = useRoute<CheckIngredientsRouteProp>();
  const navigation = useNavigation();
  const { mealId, plannedRecipeId, mealType, recipeName } = route.params;

  const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);

  function handleAddIngredient(ingredient: Ingredient) {
    if (!selectedIngredients.find(i => i.id === ingredient.id)) {
      setSelectedIngredients([...selectedIngredients, ingredient]);
    }
  }

  function handleRemoveIngredient(id: string) {
    setSelectedIngredients(selectedIngredients.filter(i => i.id !== id));
  }

  async function handleCheck() {
    if (selectedIngredients.length === 0) {
      Alert.alert('Uyarı', 'Lütfen en az bir malzeme seçin');
      return;
    }

    setLoading(true);
    try {
      const result = await decideAlternative({
        plannedRecipeId,
        mealType,
        clientAvailableIngredients: selectedIngredients.map(i => i.id),
      });

      navigation.navigate('AlternativeResult' as never, { // Routes.Premium.AlternativeResult
        decision: result,
        recipeName,
      } as never);
    } catch (error: any) {
      Alert.alert(
        'Hata',
        error.response?.data?.message || 'Kontrol yapılırken bir sorun oluştu'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Evinde neler var?</Text>
        <Text style={styles.subtitle}>Öğün: {recipeName}</Text>

        <IngredientSearch onSelect={handleAddIngredient} />

        {selectedIngredients.length > 0 && (
          <View style={styles.selectedSection}>
            <Text style={styles.selectedTitle}>Seçilen Malzemeler:</Text>
            <View style={styles.chipsContainer}>
              {selectedIngredients.map(ingredient => (
                <IngredientChip
                  key={ingredient.id}
                  ingredient={ingredient}
                  onRemove={() => handleRemoveIngredient(ingredient.id)}
                />
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.checkButton,
            (selectedIngredients.length === 0 || loading) && styles.disabled
          ]}
          onPress={handleCheck}
          disabled={selectedIngredients.length === 0 || loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Kontrol Ediliyor...' : 'Malzemelerimi Kontrol Et'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>İptal</Text>
        </TouchableOpacity>
      </View>
    </ScrollView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl + 20,
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
    marginBottom: spacing.lg,
  },
  selectedSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checkButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 16,
  },
});
