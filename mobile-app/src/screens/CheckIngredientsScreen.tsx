import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { decideAlternative, getRecipePlanContext, type RecipeIngredientItem } from '../api/alternative';
import { addIngredientsToShoppingList } from '../api/shopping-list';
import { getPantry } from '../api/pantry';
import { Routes } from '../navigation/routes';
import { radii, spacing } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';

// Backend MealType enum: Breakfast=1, Lunch=2, Dinner=3, Snack=4
const MEAL_TYPE_TO_INT: Record<string, number> = {
  Breakfast: 1, MidMorning: 4, Lunch: 2,
  Afternoon: 4, Dinner: 3, Evening: 4, Snack: 4,
};

type CheckIngredientsRouteProp = RouteProp<{
  params: {
    mealId: string;
    plannedRecipeId: string;
    mealType: string | number;
    recipeName: string;
  };
}>;

interface IngredientCheckItem extends RecipeIngredientItem {
  checked: boolean;
  group: 'mandatory' | 'optional';
}

export default function CheckIngredientsScreen() {
  const route = useRoute<CheckIngredientsRouteProp>();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { mealId, plannedRecipeId, mealType, recipeName } = route.params;

  const [items, setItems] = useState<IngredientCheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const [context, pantryItems] = await Promise.all([
          getRecipePlanContext(plannedRecipeId),
          getPantry().catch(() => []),
        ]);

        const pantryIds = new Set(pantryItems.map(p => p.ingredientId));

        const mandatory: IngredientCheckItem[] = context.ingredients.mandatory.map(i => ({
          ...i,
          checked: pantryIds.has(i.id),
          group: 'mandatory' as const,
        }));
        const optional: IngredientCheckItem[] = context.ingredients.optional.map(i => ({
          ...i,
          checked: pantryIds.has(i.id),
          group: 'optional' as const,
        }));

        if (active) setItems([...mandatory, ...optional]);
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [plannedRecipeId]);

  const toggle = useCallback((id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  }, []);

  const missingMandatory = items.filter(i => i.group === 'mandatory' && !i.checked);
  const checkedIds = items.filter(i => i.checked).map(i => i.id);
  const canCheck = checkedIds.length > 0;

  async function handleCheck() {
    if (!canCheck) {
      Alert.alert('Uyarı', 'Lütfen en az bir malzeme seçin');
      return;
    }
    setChecking(true);
    try {
      const mealTypeInt = typeof mealType === 'number'
        ? mealType
        : (MEAL_TYPE_TO_INT[mealType as string] ?? 4);
      const result = await decideAlternative({
        plannedRecipeId,
        mealType: mealTypeInt,
        clientAvailableIngredients: checkedIds,
      });
      (navigation as any).navigate(Routes.App.AlternativeResult, {
        decision: result,
        recipeName,
        mealId,
        plannedRecipeId,
      });
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.message || 'Kontrol yapılırken bir sorun oluştu');
    } finally {
      setChecking(false);
    }
  }

  async function handleAddMissingToList() {
    if (missingMandatory.length === 0) return;
    setAddingToList(true);
    try {
      await addIngredientsToShoppingList(
        missingMandatory.map(i => i.id),
        'PlannedRecipe',
        plannedRecipeId,
      );
      Alert.alert(
        'Listeye Eklendi',
        `${missingMandatory.length} eksik malzeme alışveriş listenize eklendi.`,
      );
    } catch {
      Alert.alert('Hata', 'Malzemeler listeye eklenemedi. Tekrar deneyin.');
    } finally {
      setAddingToList(false);
    }
  }

  const mandatoryItems = items.filter(i => i.group === 'mandatory');
  const optionalItems = items.filter(i => i.group === 'optional');

  const s = styles(theme);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[s.loadingText, { color: theme.textSub }]}>Tarif yükleniyor...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={[s.errorTitle, { color: theme.text }]}>Tarif yüklenemedi</Text>
        <Text style={[s.errorSub, { color: theme.textSub }]}>Lütfen tekrar deneyin.</Text>
        <TouchableOpacity style={[s.backBtn, { borderColor: theme.border }]} onPress={() => navigation.goBack()}>
          <Text style={[s.backBtnText, { color: theme.text }]}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} keyboardShouldPersistTaps="handled">
      <View style={s.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
          <Text style={[s.backText, { color: theme.primary }]}>â† Geri</Text>
        </TouchableOpacity>

        <Text style={[s.title, { color: theme.text }]}>Malzeme Kontrolü</Text>
        <Text style={[s.subtitle, { color: theme.textSub }]}>{recipeName}</Text>

        {mandatoryItems.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: theme.textMuted }]}>ZORUNLU MALZEMELER</Text>
            {mandatoryItems.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[
                  s.row,
                  {
                    backgroundColor: theme.surface,
                    borderColor: item.checked ? theme.primary + '40' : theme.border,
                  },
                ]}
                onPress={() => toggle(item.id)}
                activeOpacity={0.75}
              >
                <View style={[
                  s.checkbox,
                  {
                    backgroundColor: item.checked ? theme.primary : 'transparent',
                    borderColor: item.checked ? theme.primary : theme.textMuted,
                  },
                ]}>
                  {item.checked && <Text style={s.checkmark}>âœ“</Text>}
                </View>
                <Text style={[
                  s.rowText,
                  { color: item.checked ? theme.text : theme.textSub },
                ]}>
                  {item.name}
                </Text>
                {!item.checked && (
                  <View style={[s.missingTag, { backgroundColor: theme.warning + '18', borderColor: theme.warning + '40' }]}>
                    <Text style={[s.missingTagText, { color: theme.warning }]}>Eksik</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {optionalItems.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: theme.textMuted }]}>OPSİYONEL MALZEMELER</Text>
            {optionalItems.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[
                  s.row,
                  {
                    backgroundColor: theme.surface,
                    borderColor: item.checked ? theme.primary + '30' : theme.border,
                    opacity: 0.9,
                  },
                ]}
                onPress={() => toggle(item.id)}
                activeOpacity={0.75}
              >
                <View style={[
                  s.checkbox,
                  {
                    backgroundColor: item.checked ? theme.primary + 'CC' : 'transparent',
                    borderColor: item.checked ? theme.primary : theme.textMuted,
                  },
                ]}>
                  {item.checked && <Text style={s.checkmark}>âœ“</Text>}
                </View>
                <Text style={[s.rowText, { color: item.checked ? theme.text : theme.textSub }]}>
                  {item.name}
                </Text>
                <View style={[s.optionalTag, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '30' }]}>
                  <Text style={[s.optionalTagText, { color: theme.primary }]}>Opsiyonel</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {missingMandatory.length > 0 && (
          <View style={[s.missingBanner, { backgroundColor: theme.warning + '10', borderColor: theme.warning + '30' }]}>
            <Text style={[s.missingBannerTitle, { color: theme.warning }]}>
              {missingMandatory.length} zorunlu malzeme eksik
            </Text>
            <Text style={[s.missingBannerSub, { color: theme.textSub }]}>
              {missingMandatory.map(i => i.name).join(', ')}
            </Text>
            <TouchableOpacity
              style={[s.listBtn, { borderColor: theme.warning + '55', backgroundColor: theme.warning + '14' }]}
              onPress={handleAddMissingToList}
              disabled={addingToList}
              activeOpacity={0.8}
            >
              <Text style={[s.listBtnText, { color: theme.warning }]}>
                {addingToList ? 'Ekleniyor...' : 'Eksikleri Alışveriş Listesine Ekle'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[
            s.primaryBtn,
            { backgroundColor: theme.primary },
            (!canCheck || checking) && s.disabled,
          ]}
          onPress={handleCheck}
          disabled={!canCheck || checking}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>
            {checking ? 'Kontrol Ediliyor...' : 'Elimdekilerle Devam Et'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={[s.cancelText, { color: theme.textMuted }]}>İptal</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function styles(theme: any) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    loadingText: { marginTop: spacing.md, fontSize: 14, fontWeight: '600' },
    errorTitle: { fontSize: 18, fontWeight: '900', marginBottom: spacing.sm },
    errorSub: { fontSize: 14, fontWeight: '600', marginBottom: spacing.lg },
    backBtn: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing.lg, paddingVertical: 10 },
    backBtnText: { fontSize: 14, fontWeight: '700' },

    content: { padding: spacing.lg, paddingTop: spacing.xl + 20, paddingBottom: 48 },
    backRow: { marginBottom: spacing.md },
    backText: { fontSize: 14, fontWeight: '900' },
    title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.3, marginBottom: 4 },
    subtitle: { fontSize: 14, fontWeight: '600', marginBottom: spacing.lg },

    section: { marginBottom: spacing.lg },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: radii.xl,
      borderWidth: 1,
      marginBottom: 8,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    checkmark: { color: '#FFF', fontSize: 13, fontWeight: '900' },
    rowText: { flex: 1, fontSize: 15, fontWeight: '600' },
    missingTag: {
      borderRadius: radii.full,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    missingTagText: { fontSize: 10, fontWeight: '800' },
    optionalTag: {
      borderRadius: radii.full,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    optionalTagText: { fontSize: 10, fontWeight: '700' },

    missingBanner: {
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: 8,
    },
    missingBannerTitle: { fontSize: 13, fontWeight: '900' },
    missingBannerSub: { fontSize: 12, fontWeight: '500', lineHeight: 18 },
    listBtn: {
      borderRadius: radii.full,
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      marginTop: 4,
    },
    listBtnText: { fontSize: 13, fontWeight: '800' },

    primaryBtn: {
      padding: spacing.md,
      borderRadius: radii.xl,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    disabled: { opacity: 0.5 },
    primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    cancelButton: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
    cancelText: { fontSize: 15, fontWeight: '600' },
  });
}

