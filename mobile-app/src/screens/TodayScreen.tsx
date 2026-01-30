import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { getTodayPlan } from '../api/diet-plans';
import { colors, spacing } from '../theme';
import { getMealTypeName } from '../types/diet-plan';
import { useAuth } from '../auth/AuthContext';
import { Routes } from '../navigation/routes';

export default function TodayScreen() {
  // 🔥 ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP
  const { logout, user, refreshUserState, isStateLoaded } = useAuth();
  const navigation = useNavigation();
  
  // 🔥 Calculate isPremium explicitly - undefined means FREE
  const isPremium = user?.isPremium === true;
  
  // Query always called, but request only enabled when premium and state loaded
  // 🔥 Double guard: enabled check + defensive guard in getTodayPlan
  const planQuery = useQuery({
    queryKey: ['todayPlan'],
    queryFn: () => getTodayPlan(user || undefined), // Pass user for defensive guard
    retry: false, // Don't auto-retry, handle errors manually
    enabled: isStateLoaded && isPremium, // 🔥 Free iken request yok
  });

  const { data, isLoading, error, refetch } = planQuery;

  // Extract error info (always computed, no condition)
  const errorCode = (error as any)?.code;
  const errorStatus = (error as any)?.status;

  // 🔥 ALL useEffect HOOKS MUST BE CALLED UNCONDITIONALLY
  // Handle 401 - Unauthorized
  useEffect(() => {
    if (errorStatus === 401 || errorCode === 'AUTH_REQUIRED') {
      Alert.alert(
        'Oturum Sonlandı',
        'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
        [
          {
            text: 'Tamam',
            onPress: async () => {
              await logout();
              // Root navigator will automatically switch to AuthStack
            },
          },
        ]
      );
    }
  }, [errorStatus, errorCode, logout]);

  // Handle 403 - Premium Required (refresh state to sync)
  useEffect(() => {
    if (errorStatus === 403 || errorCode === 'PREMIUM_REQUIRED') {
      // Refresh user state to ensure we have latest premium status
      refreshUserState();
    }
  }, [errorStatus, errorCode, refreshUserState]);

  // 🔥 NOW SAFE TO DO CONDITIONAL RENDERS (after all hooks)

  // Early return: Loading state
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Plan yükleniyor...</Text>
      </View>
    );
  }

  // Handle 401 - Unauthorized (UI)
  if (errorStatus === 401 || errorCode === 'AUTH_REQUIRED') {
    return null; // Alert shown in useEffect
  }

  // Handle 403 - Premium Required (UI)
  // DO NOT manually navigate - let root navigator handle stack switching
  if (errorStatus === 403 || errorCode === 'PREMIUM_REQUIRED') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Premium Gerekli</Text>
        <Text style={styles.errorText}>
          Bu özellik premium üyelik gerektirir. Premium'a geçmek için aşağıdaki butona tıklayın.
        </Text>
        <TouchableOpacity
          style={styles.activateButton}
          onPress={async () => {
            // Refresh state first
            await refreshUserState();
            // Navigate to modal - accessible from any stack
            navigation.getParent()?.navigate(Routes.Modal.ActivatePremium as never);
          }}
        >
          <Text style={styles.activateButtonText}>Premium'a Geç →</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // 🔥 Early return: If not premium, show premium required (defensive)
  // This should never happen if root navigator works correctly, but safety first
  if (!isPremium) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Premium Gerekli</Text>
        <Text style={styles.errorText}>
          Bu özellik premium üyelik gerektirir.
        </Text>
        <TouchableOpacity
          style={styles.activateButton}
          onPress={() => {
            navigation.getParent()?.navigate(Routes.Modal.ActivatePremium as never);
          }}
        >
          <Text style={styles.activateButtonText}>Premium'a Geç →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Handle 404 - Plan Not Found
  if (errorStatus === 404 || errorCode === 'PLAN_NOT_FOUND') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bugün</Text>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logoutText}>Çıkış</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Plan Henüz Oluşturulmadı</Text>
          <Text style={styles.emptyText}>
            Diyetisyeniniz henüz sizin için bir plan oluşturmadı. Lütfen daha sonra tekrar kontrol edin.
          </Text>
        </View>
      </View>
    );
  }

  // Handle other errors
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Plan Yüklenemedi</Text>
        <Text style={styles.errorText}>
          {(error as any)?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bugün</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.date}>{new Date(data!.date).toLocaleDateString('tr-TR')}</Text>

      {data!.dailyTargetCalories && (
        <Text style={styles.calories}>Hedef: {data!.dailyTargetCalories} kcal</Text>
      )}

      {data!.meals.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Bugün için plan yok</Text>
        </View>
      ) : (
        <FlatList
          data={data!.meals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealType}>{getMealTypeName(item.type)}</Text>
                {item.isMandatory && (
                  <View style={styles.mandatoryBadge}>
                    <Text style={styles.mandatoryText}>Zorunlu</Text>
                  </View>
                )}
              </View>
              <Text style={styles.recipeName}>
                {item.plannedRecipeName || item.customName || 'Tarif atanmamış'}
              </Text>
              <Text style={styles.infoText}>Bu öğün diyet planının bir parçasıdır</Text>

              {item.plannedRecipeName && item.plannedRecipeId && (
                <TouchableOpacity
                  style={styles.checkButton}
                  onPress={() => {
                    (navigation as any).navigate(Routes.Premium.CheckIngredients, {
                      mealId: item.id,
                      plannedRecipeId: item.plannedRecipeId,
                      mealType: item.type,
                      recipeName: item.plannedRecipeName,
                    });
                  }}
                >
                  <Text style={styles.checkButtonText}>Malzemelerimi Kontrol Et →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
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
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl + 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  logoutText: {
    color: colors.error,
    fontSize: 14,
  },
  date: {
    fontSize: 16,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  calories: {
    fontSize: 14,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  mealCard: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mealType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  mandatoryBadge: {
    backgroundColor: colors.mandatory,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mandatoryText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  recipeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  checkButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: spacing.md,
  },
  activateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    marginTop: spacing.lg,
  },
  activateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
