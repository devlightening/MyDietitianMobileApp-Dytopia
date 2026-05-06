import React, { useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { useInAppNotifications } from "../context/InAppNotificationContext";
import ProduceBubble from "../components/decor/ProduceBubble";
import DytopiaWatermark from "../components/decor/DytopiaWatermark";
import { radii, spacing } from "../theme/tokens";
import {
  getFavoriteRecipes,
  unfavoriteRecipe,
  type FavoriteRecipeCardDto,
} from "../api/favorites";
import { Routes } from "../navigation/routes";
import type { RecipeMatchResult } from "../api/kitchen";

function formatMacro(value?: number | null, unit: string = "g") {
  if (value == null) return "—";
  return `${Number(value).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}${unit}`;
}

function buildRecipeResult(item: FavoriteRecipeCardDto): RecipeMatchResult {
  return {
    recipeId: item.recipeId,
    name: item.name,
    description: item.description ?? "",
    matchStatus: "FULL_MATCH",
    matchCategory: "FULL_MATCH",
    sourceType: item.sourceType === "clinic" ? "LINKED_CLINIC_PRIVATE" : "GLOBAL_PUBLIC_FALLBACK",
    compatibilityPercent: item.pantryCoverage.percent,
    score: item.pantryCoverage.percent,
    mandatoryCount: item.pantryCoverage.mandatory.total,
    matchedMandatoryCount: item.pantryCoverage.mandatory.matchedCount,
    usedSubstitutes: false,
    missing: [],
    steps: [],
    hasSteps: false,
    isPublic: item.sourceType !== "clinic",
    isDietitianRecipe: item.sourceType === "clinic",
    isOwnedByActiveDietitian: item.sourceType === "clinic",
    isPublicFallback: item.sourceType !== "clinic",
    motivationText: "",
    caloriesKcal: item.caloriesKcal ?? undefined,
    proteinGrams: item.proteinGrams ?? undefined,
    carbsGrams: item.carbsGrams ?? undefined,
    fatGrams: item.fatGrams ?? undefined,
  };
}

export default function FavoritesScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { notify } = useInAppNotifications();

  const favoritesEnabled = user?.isPremium === true;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["favorite-recipes"],
    queryFn: getFavoriteRecipes,
    enabled: favoritesEnabled,
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  const bestMatched = items.reduce<FavoriteRecipeCardDto | null>((best, current) => {
    if (!best) return current;
    return current.pantryCoverage.percent > best.pantryCoverage.percent ? current : best;
  }, null);

  const handleRemoveFavorite = useCallback(async (item: FavoriteRecipeCardDto) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Non-blocking.
    }

    const currentItems = data?.items ?? [];
    queryClient.setQueryData(["favorite-recipes"], {
      ...data,
      items: currentItems.filter((entry) => entry.recipeId !== item.recipeId),
      total: Math.max((data?.total ?? currentItems.length) - 1, 0),
    });

    const currentSummary = queryClient.getQueryData<any>(["favorite-recipes-summary"]);
    if (currentSummary) {
      queryClient.setQueryData(["favorite-recipes-summary"], {
        ...currentSummary,
        totalFavorites: Math.max((currentSummary.totalFavorites ?? 1) - 1, 0),
        recentFavorites: (currentSummary.recentFavorites ?? []).filter((entry: FavoriteRecipeCardDto) => entry.recipeId !== item.recipeId),
        bestMatchedFavorite: currentSummary.bestMatchedFavorite?.recipeId === item.recipeId ? null : currentSummary.bestMatchedFavorite,
      });
    }

    try {
      await unfavoriteRecipe(item.recipeId);
      notify({
        type: "pantry_updated",
        dedupKey: `favorite_removed:${item.recipeId}`,
        title: language === "tr" ? "Favoriden kaldırıldı" : "Removed from favorites",
        body: language === "tr"
          ? `${item.name} favorilerinden çıkarıldı.`
          : `${item.name} was removed from your favorites.`,
        icon: "heart-dislike-outline",
        tone: "primary",
        haptic: "light",
        durationMs: 2200,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["favorite-recipes"] }),
        queryClient.invalidateQueries({ queryKey: ["favorite-recipes-summary"] }),
      ]);
    } catch {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["favorite-recipes"] }),
        queryClient.invalidateQueries({ queryKey: ["favorite-recipes-summary"] }),
      ]);
      notify({
        type: "pantry_updated",
        dedupKey: `favorite_remove_error:${item.recipeId}`,
        title: language === "tr" ? "Favori güncellenemedi" : "Favorite update failed",
        body: language === "tr"
          ? "Tarif favorilerinden çıkarılamadı. Lütfen tekrar dene."
          : "The recipe could not be removed from favorites. Please try again.",
        icon: "alert-circle-outline",
        tone: "coral",
        haptic: "warning",
        durationMs: 2600,
      });
    }
  }, [data, language, notify, queryClient]);

  if (!favoritesEnabled) {
    return (
      <View style={[s.centered, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
        <Text style={[s.emptyTitle, { color: theme.text }]}>
          {language === "tr" ? "Favoriler premium ile açılır" : "Favorites unlock with premium"}
        </Text>
        <Text style={[s.emptyBody, { color: theme.textMuted }]}>
          {language === "tr"
            ? "Premium tekrar aktif olduğunda sevdiğin tarifler burada yeniden görünür."
            : "When premium becomes active again, your saved recipes will appear here."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <DytopiaWatermark position="center" size={280} opacity={0.03} />
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={30}
        iconColor={`${theme.accentCoral}42`}
        style={[s.glowA, { backgroundColor: `${theme.accentCoral}20` }]}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
      >
        <Animated.View entering={FadeIn.duration(280)} style={[s.hero, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <View style={s.heroTop}>
            <TouchableOpacity
              style={[s.backButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={() => (navigation as any).goBack()}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={16} color={theme.textSub} />
              <Text style={[s.backText, { color: theme.textSub }]}>
                {language === "tr" ? "Profilime dön" : "Back to profile"}
              </Text>
            </TouchableOpacity>
            <View style={[s.totalBadge, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Text style={[s.totalValue, { color: theme.primaryDark }]}>{data?.total ?? 0}</Text>
              <Text style={[s.totalLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "aktif favori" : "active favorites"}
              </Text>
            </View>
          </View>

          <Text style={[s.eyebrow, { color: theme.primary }]}>
            {language === "tr" ? "PREMIUM FAVORİLERİM" : "PREMIUM FAVORITES"}
          </Text>
          <Text style={[s.title, { color: theme.text }]}>
            {language === "tr" ? "Sevdiğin tarifleri tek yerde tut" : "Keep your favorite recipes together"}
          </Text>
          <Text style={[s.subtitle, { color: theme.textSub }]}>
            {language === "tr"
              ? "Diyetisyeninle uyumlu tarifleri burada sakla, dolabına göre en hazır olanları hızlıca aç."
              : "Save aligned recipes here and reopen the ones that best fit your pantry."}
          </Text>

          <View style={s.heroStats}>
            <View style={[s.heroStatCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.heroStatValue, { color: theme.text }]}>{items.length}</Text>
              <Text style={[s.heroStatLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "saklanan tarif" : "saved recipes"}
              </Text>
            </View>
            <View style={[s.heroStatCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.heroStatValue, { color: theme.emerald }]}>{bestMatched?.pantryCoverage.percent ?? 0}%</Text>
              <Text style={[s.heroStatLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "en hazır favori" : "best pantry fit"}
              </Text>
            </View>
          </View>
        </Animated.View>

        {isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : items.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(280)} style={[s.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[s.emptyIconWrap, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Ionicons name="heart-outline" size={22} color={theme.primary} />
            </View>
            <Text style={[s.emptyTitle, { color: theme.text }]}>
              {language === "tr" ? "Henüz favori tarif yok" : "No favorite recipes yet"}
            </Text>
            <Text style={[s.emptyBody, { color: theme.textMuted }]}>
              {language === "tr"
                ? "Tarif detayındaki kalp ikonuna dokunarak sevdiğin tarifleri burada saklayabilirsin."
                : "Tap the heart on a recipe detail page to keep it here."}
            </Text>
          </Animated.View>
        ) : (
          <View style={s.cards}>
            {items.map((item, index) => (
              <Animated.View key={item.recipeId} entering={FadeInDown.delay(index * 55).duration(320)}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => (navigation as any).navigate(Routes.App.RecipeDetail, {
                    result: buildRecipeResult(item),
                    fromFavorites: true,
                  })}
                >
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={s.cardBadgeRow}>
                        <View style={[s.sourceBadge, {
                          backgroundColor: item.sourceType === "clinic" ? theme.glassEmerald : `${theme.accentGold}12`,
                          borderColor: item.sourceType === "clinic" ? theme.borderEmerald : `${theme.accentGold}28`,
                        }]}>
                          <Text style={[s.sourceBadgeText, {
                            color: item.sourceType === "clinic" ? theme.primaryDark : theme.accentGold,
                          }]}>
                            {item.sourceType === "clinic"
                              ? (language === "tr" ? "Klinik favori" : "Clinic favorite")
                              : (language === "tr" ? "Genel favori" : "General favorite")}
                          </Text>
                        </View>
                        <View style={[s.coverageBadge, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}24` }]}>
                          <Text style={[s.coverageBadgeText, { color: theme.primary }]}>
                            %{item.pantryCoverage.percent}
                          </Text>
                        </View>
                      </View>
                      <Text style={[s.cardTitle, { color: theme.text }]}>{item.name}</Text>
                      {!!item.description && (
                        <Text style={[s.cardDesc, { color: theme.textMuted }]} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[s.heartButton, { backgroundColor: `${theme.accentCoral}10`, borderColor: `${theme.accentCoral}24` }]}
                      onPress={() => void handleRemoveFavorite(item)}
                    >
                      <Ionicons name="heart" size={16} color={theme.accentCoral} />
                    </TouchableOpacity>
                  </View>

                  <View style={[s.coveragePanel, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
                    <Text style={[s.coveragePanelTitle, { color: theme.text }]}>
                      {language === "tr" ? "Dolap uyumu canlı karşılaştırma" : "Live pantry comparison"}
                    </Text>
                    <Text style={[s.coveragePanelBody, { color: theme.textMuted }]}>
                      {language === "tr"
                        ? "Açtığında dolabındaki ürünlere göre anlık hesaplanır."
                        : "Calculated live from your pantry each time you open it."}
                    </Text>
                    <View style={s.coverageBars}>
                      {[ 
                        { label: language === "tr" ? "Zorunlu" : "Mandatory", value: item.pantryCoverage.mandatoryPercent, color: theme.emerald },
                        { label: language === "tr" ? "Opsiyonel" : "Optional", value: item.pantryCoverage.optionalPercent, color: theme.primary },
                        { label: language === "tr" ? "Lezzetlendirici" : "Flavoring", value: item.pantryCoverage.flavoringPercent, color: theme.accentGold },
                      ].map((bar) => (
                        <View key={bar.label} style={s.coverageRow}>
                          <View style={s.coverageRowHead}>
                            <Text style={[s.coverageRowLabel, { color: theme.textSub }]}>{bar.label}</Text>
                            <Text style={[s.coverageRowValue, { color: bar.color }]}>%{bar.value}</Text>
                          </View>
                          <View style={[s.coverageTrack, { backgroundColor: theme.borderLight }]}>
                            <View style={[s.coverageFill, { width: `${bar.value}%`, backgroundColor: bar.color }]} />
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {item.missingMandatoryNames.length > 0 && (
                    <View style={s.chipsWrap}>
                      {item.missingMandatoryNames.slice(0, 3).map((name) => (
                        <View key={name} style={[s.missingChip, { backgroundColor: `${theme.accentGold}10`, borderColor: `${theme.accentGold}24` }]}>
                          <Text style={[s.missingChipText, { color: theme.accentGold }]}>
                            {name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={s.macrosRow}>
                    <View style={s.macroCell}>
                      <Text style={[s.macroValue, { color: theme.text }]}>{item.caloriesKcal ?? "—"}</Text>
                      <Text style={[s.macroLabel, { color: theme.textMuted }]}>kcal</Text>
                    </View>
                    <View style={s.macroCell}>
                      <Text style={[s.macroValue, { color: theme.text }]}>{formatMacro(item.proteinGrams)}</Text>
                      <Text style={[s.macroLabel, { color: theme.textMuted }]}>
                        {language === "tr" ? "Protein" : "Protein"}
                      </Text>
                    </View>
                    <View style={s.macroCell}>
                      <Text style={[s.macroValue, { color: theme.text }]}>{formatMacro(item.carbsGrams)}</Text>
                      <Text style={[s.macroLabel, { color: theme.textMuted }]}>
                        {language === "tr" ? "Karb" : "Carbs"}
                      </Text>
                    </View>
                    <View style={s.macroCell}>
                      <Text style={[s.macroValue, { color: theme.text }]}>{formatMacro(item.fatGrams)}</Text>
                      <Text style={[s.macroLabel, { color: theme.textMuted }]}>
                        {language === "tr" ? "Yağ" : "Fat"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: 18,
    paddingBottom: 110,
    gap: spacing.lg,
  },
  glowA: {
    position: "absolute",
    top: 92,
    right: -24,
    width: 132,
    height: 132,
    borderRadius: 66,
    opacity: 0.22,
  },
  hero: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backText: {
    fontSize: 13,
    fontWeight: "700",
  },
  totalBadge: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  totalLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  heroStats: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  heroStatValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  heroStatLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
  },
  loadingWrap: {
    paddingTop: 56,
    alignItems: "center",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cardBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  sourceBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  coverageBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  coverageBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  cardDesc: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
  },
  heartButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coveragePanel: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
  },
  coveragePanelTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  coveragePanelBody: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
  },
  coverageBars: {
    gap: 10,
    marginTop: spacing.md,
  },
  coverageRow: {
    gap: 6,
  },
  coverageRowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  coverageRowLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  coverageRowValue: {
    fontSize: 12,
    fontWeight: "800",
  },
  coverageTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  coverageFill: {
    height: 8,
    borderRadius: 999,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  missingChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  missingChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  macrosRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  macroCell: {
    flex: 1,
    alignItems: "center",
  },
  macroValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  macroLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
  },
});
