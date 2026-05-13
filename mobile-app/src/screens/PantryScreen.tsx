import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from "react-native-reanimated";

import IngredientSearch from "../components/IngredientSearch";
import AnimatedCard from "../components/ui/AnimatedCard";
import PulseBadge from "../components/ui/PulseBadge";
import ShimmerLine from "../components/ui/ShimmerLine";
import SuccessSettleWrapper from "../components/ui/SuccessSettleWrapper";
import { getPantry, replacePantry, type PantryItem, type PantryUpdateSource } from "../api/pantry";
import { buildPantryActivitySummary } from "../features/smartInsights";
import { buildPantryUpdatedNotification } from "../notifications/notificationEvents";
import { Routes } from "../navigation/routes";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { useInAppNotifications } from "../context/InAppNotificationContext";
import { useFeedback } from "../context/FeedbackContext";
import { radii, spacing } from "../theme/tokens";
import { registerScanResultHandler, resolveScanResult } from "../utils/scanResultStore";
import type { Ingredient } from "../types/alternative";

type PantryParams = {
  Pantry: {
    selectedIngredients?: Ingredient[];
    scanResultId?: string;
  };
};

function mapPantryToIngredients(items: PantryItem[]): Ingredient[] {
  return items.map((item) => ({
    id: item.ingredientId,
    canonicalName: item.ingredientName,
  }));
}

function mapIngredientsToPantrySnapshot(items: Ingredient[]): PantryItem[] {
  const nowIso = new Date().toISOString();
  return items.map((item) => ({
    ingredientId: item.id,
    ingredientName: item.canonicalName,
    quantity: null,
    unit: null,
    updatedAtUtc: nowIso,
  }));
}

function getDaysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function formatPantryUpdateLabel(items: PantryItem[], language: "tr" | "en"): string {
  const latest = items
    .map((item) => new Date(item.updatedAtUtc).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => b - a)[0];

  if (!latest) return language === "tr" ? "Henüz güncellenmedi" : "Not updated yet";

  const days = Math.max(0, Math.floor((Date.now() - latest) / 86_400_000));
  if (days === 0) return language === "tr" ? "Bugün güncellendi" : "Updated today";
  if (days === 1) return language === "tr" ? "Dün güncellendi" : "Updated yesterday";
  return language === "tr" ? `${days} gün önce` : `${days} days ago`;
}

function buildPantryFreshnessTags(
  item: PantryItem | undefined,
  index: number,
  total: number,
  language: "tr" | "en",
): string[] {
  const tags: string[] = [];
  const days = getDaysSince(item?.updatedAtUtc);

  if (days === null) {
    tags.push(language === "tr" ? "Aktif" : "Active");
  } else if (days === 0) {
    tags.push(language === "tr" ? "Yeni eklendi" : "Newly added");
  } else if (days >= 10) {
    tags.push(language === "tr" ? "Uzun süredir dokunulmadı" : "Untouched for a while");
  } else {
    tags.push(language === "tr" ? "Son güncellendi" : "Recently updated");
  }

  if (total >= 6 && index < 3) {
    tags.push(language === "tr" ? "Sık kullanılan" : "Frequently used");
  }

  return tags.slice(0, 2);
}

export default function PantryScreen() {
  const { theme } = useTheme();
  const { language } = useTranslation();
  const { notify } = useInAppNotifications();
  const { showDialog, showToast } = useFeedback();
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<PantryParams, "Pantry">>();
  const initialSelected = useMemo(
    () => route.params?.selectedIngredients ?? [],
    [route.params?.selectedIngredients],
  );

  const [selected, setSelected] = useState<Ingredient[]>(initialSelected);
  const [pantrySnapshot, setPantrySnapshot] = useState<PantryItem[]>(
    mapIngredientsToPantrySnapshot(initialSelected),
  );
  const [loading, setLoading] = useState(initialSelected.length === 0);
  const [syncing, setSyncing] = useState(false);
  const [searchPrefill, setSearchPrefill] = useState("");
  const [searchPrefillKey, setSearchPrefillKey] = useState(0);
  const isPremium = user?.isPremium === true;

  useEffect(() => {
    if (initialSelected.length > 0) {
      setSelected(initialSelected);
      setPantrySnapshot(mapIngredientsToPantrySnapshot(initialSelected));
    } else {
      setLoading(true);
    }

    let active = true;

    void getPantry()
      .then((items) => {
        if (!active) return;
        setPantrySnapshot(items);
        setSelected(mapPantryToIngredients(items));
      })
      .catch(() => {
        if (!active) return;
        if (initialSelected.length === 0) {
          setPantrySnapshot([]);
          setSelected([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);
  const activity = useMemo(() => buildPantryActivitySummary(pantrySnapshot, language), [language, pantrySnapshot]);
  const snapshotById = useMemo(
    () => new Map(pantrySnapshot.map((item) => [item.ingredientId, item])),
    [pantrySnapshot],
  );
  const latestUpdateLabel = useMemo(
    () => formatPantryUpdateLabel(pantrySnapshot, language),
    [language, pantrySnapshot],
  );
  const staleCount = useMemo(
    () => pantrySnapshot.filter((item) => {
      const days = getDaysSince(item.updatedAtUtc);
      return days != null && days >= 10;
    }).length,
    [pantrySnapshot],
  );

  const syncSnapshotWithIngredients = useCallback((ingredients: Ingredient[]) => {
    setPantrySnapshot(mapIngredientsToPantrySnapshot(ingredients));
  }, []);

  const persistSelection = useCallback(async (
    next: Ingredient[],
    fallback: Ingredient[],
    errorMessage: string,
    sourceType: PantryUpdateSource = "manual",
  ): Promise<boolean> => {
    setSyncing(true);
    setSelected(next);
    syncSnapshotWithIngredients(next);

    try {
      const updated = await replacePantry(next, { sourceType });
      const normalized = mapPantryToIngredients(updated);
      setPantrySnapshot(updated);
      setSelected(normalized);
      resolveScanResult(route.params?.scanResultId, normalized);

      const changeLabel = normalized.length === 0
        ? (language === "tr" ? "Dolap temizlendi." : "Your pantry was cleared.")
        : normalized.length > fallback.length
          ? (language === "tr" ? "Yeni ürünler eklendi." : "New pantry items were added.")
          : normalized.length < fallback.length
            ? (language === "tr" ? "Seçili ürünler güncellendi." : "Selected pantry items were updated.")
            : (language === "tr" ? "Dolap seçimi yenilendi." : "Your pantry selection was refreshed.");

      notify(buildPantryUpdatedNotification(language, normalized.length, changeLabel));
      return true;
    } catch {
      setSelected(fallback);
      syncSnapshotWithIngredients(fallback);
      showToast({
        variant: "error",
        title: language === "tr" ? "Dolap güncellenemedi" : "Pantry update failed",
        message: errorMessage,
      });
      return false;
    } finally {
      setSyncing(false);
    }
  }, [language, notify, route.params?.scanResultId, showToast, syncSnapshotWithIngredients]);

  const appendIngredients = useCallback(async (
    ingredients: Ingredient[],
    sourceType: PantryUpdateSource = "manual",
  ) => {
    const current = selected;
    const existing = new Set(current.map((item) => item.id));
    const toAdd = ingredients.filter((item) => !existing.has(item.id));
    if (toAdd.length === 0) return;

    const next = [...toAdd, ...current];
    await persistSelection(
      next,
      current,
      language === "tr"
        ? "Ürün dolaba eklenemedi. Lütfen tekrar deneyin."
        : "The pantry item could not be added. Please try again.",
      sourceType,
    );
  }, [language, persistSelection, selected]);

  const addIngredient = useCallback((ingredient: Ingredient) => {
    void appendIngredients([ingredient]);
  }, [appendIngredients]);

  const removeIngredient = useCallback((id: string) => {
    const current = selected;
    const removed = current.find((item) => item.id === id);
    const next = current.filter((item) => item.id !== id);
    if (next.length === current.length) return;

    void (async () => {
      const ok = await persistSelection(
        next,
        current,
        language === "tr"
          ? "Ürün dolaptan çıkarılamadı. Lütfen tekrar deneyin."
          : "The pantry item could not be removed. Please try again.",
      );
      if (!ok || !removed) return;
      showToast({
        variant: "warning",
        title: language === "tr" ? "Dolaptan çıkarıldı" : "Removed from pantry",
        message: removed.canonicalName,
        durationMs: 5600,
        action: {
          label: language === "tr" ? "Geri al" : "Undo",
          icon: "return-up-back-outline",
          tone: "warning",
          onPress: () => {
            void persistSelection(
              current,
              next,
              language === "tr" ? "Ürün geri alınamadı. Lütfen tekrar deneyin." : "The item could not be restored. Please try again.",
            );
          },
        },
      });
    })();
  }, [language, persistSelection, selected, showToast]);

  const handleSearchFallback = useCallback((term: string) => {
    setSearchPrefill(term);
    setSearchPrefillKey((value) => value + 1);
  }, []);

  const openPremiumScanGate = useCallback(() => {
    showDialog({
      variant: "info",
      icon: "lock-closed-outline",
      eyebrow: language === "tr" ? "Premium tarama" : "Premium scan",
      title: language === "tr" ? "AI tarama premium ile açılır" : "AI scanning unlocks with premium",
      message: language === "tr"
        ? "Free modda dolabını manuel arama ile kullanabilirsin. Kamera, fiş ve barkod taraması klinik bağlantılı premium özelliktir."
        : "In free mode, use manual pantry search. Camera, receipt and barcode scans are premium clinic features.",
      secondaryAction: { label: language === "tr" ? "Tamam" : "OK", tone: "muted" },
      primaryAction: {
        label: language === "tr" ? "Premium'u Aktive Et" : "Activate premium",
        tone: "primary",
        onPress: () => {
          const parent = (navigation as any).getParent?.();
          if (parent?.navigate) {
            parent.navigate(Routes.Modal.ActivatePremium);
            return;
          }
          (navigation as any).navigate(Routes.Modal.ActivatePremium);
        },
      },
    });
  }, [language, navigation, showDialog]);

  const handleReceiptScan = useCallback(() => {
    if (!isPremium) {
      openPremiumScanGate();
      return;
    }

    const scanResultId = registerScanResultHandler({
      onConfirm: (ingredients: Ingredient[]) => {
        void appendIngredients(ingredients, "receipt");
      },
      onUseSearchTerm: handleSearchFallback,
    });
    (navigation as any).navigate(Routes.App.ReceiptScan, {
      scanResultId,
    });
  }, [appendIngredients, handleSearchFallback, isPremium, navigation, openPremiumScanGate]);

  const handleIngredientScan = useCallback(() => {
    if (!isPremium) {
      openPremiumScanGate();
      return;
    }

    const scanResultId = registerScanResultHandler({
      onConfirm: (ingredients: Ingredient[]) => {
        void appendIngredients(ingredients, "photo");
      },
      onUseSearchTerm: handleSearchFallback,
    });
    (navigation as any).navigate(Routes.App.IngredientScan, {
      scanResultId,
    });
  }, [appendIngredients, handleSearchFallback, isPremium, navigation, openPremiumScanGate]);

  const handleBarcodeScan = useCallback(() => {
    if (!isPremium) {
      openPremiumScanGate();
      return;
    }

    const scanResultId = registerScanResultHandler({
      onConfirm: (ingredients: Ingredient[]) => {
        void appendIngredients(ingredients, "barcode");
      },
      onUseSearchTerm: handleSearchFallback,
    });
    (navigation as any).navigate(Routes.App.BarcodeScan, {
      usageContext: "pantry",
      scanResultId,
    });
  }, [appendIngredients, handleSearchFallback, isPremium, navigation, openPremiumScanGate]);

  const handleClear = useCallback(() => {
    if (selected.length === 0) return;

    showDialog({
      variant: "warning",
      icon: "trash-outline",
      eyebrow: language === "tr" ? "Dolap düzeni" : "Pantry cleanup",
      title: language === "tr" ? "Dolabımı temizle" : "Clear my pantry",
      message: language === "tr"
        ? "Tüm seçili dolap ürünleri kaldırılsın mı?"
        : "Remove every selected pantry item?",
      secondaryAction: { label: language === "tr" ? "İptal" : "Cancel", tone: "muted" },
      primaryAction: {
        label: language === "tr" ? "Temizle" : "Clear",
        tone: "warning",
        onPress: () => {
          void persistSelection(
            [],
            selected,
            language === "tr"
              ? "Dolap temizlenemedi. Lütfen tekrar deneyin."
              : "The pantry could not be cleared. Please try again.",
          );
        },
      },
    });
  }, [language, persistSelection, selected, showDialog]);

  const handleRefreshFreshness = useCallback(() => {
    if (selected.length === 0) return;
    void persistSelection(
      selected,
      selected,
      language === "tr" ? "Dolap tazeliği yenilenemedi." : "Pantry freshness could not be refreshed.",
      "manual",
    );
  }, [language, persistSelection, selected]);

  const s = styles(theme);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]} edges={["top", "bottom"]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: theme.text }]}>
            {language === "tr" ? "Dolabım" : "My Pantry"}
          </Text>
          <Text style={[s.headerSub, { color: theme.textMuted }]}>
            {isPremium
              ? (language === "tr"
                ? "Fişten ekle, elle düzenle, mutfak akışını hazır tut"
                : "Add from receipts, refine manually, and keep the kitchen flow ready")
              : (language === "tr"
                ? "Elle düzenle, klasik tarif havuzuna hazır tut"
                : "Manage manually and stay ready for the classic recipe pool")}
          </Text>
        </View>
        <View style={s.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <AnimatedCard
          delay={30}
          style={[
            s.hero,
            { backgroundColor: theme.surface, borderColor: `${theme.border}D0` },
          ]}
        >
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroTitle, { color: theme.text }]}>
                {language === "tr" ? "Dolap durumu" : "Pantry status"}
              </Text>
              <Text style={[s.heroSub, { color: theme.textMuted }]}>
                {language === "tr"
                  ? "Aktif ürünler mutfakta ve alternatif ekranlarında ön seçili gelir."
                  : "Active items arrive preselected in kitchen and alternative flows."}
              </Text>
              <Text style={[s.heroUpdateLine, { color: theme.primary }]}>
                {language === "tr" ? `Son güncelleme: ${latestUpdateLabel}` : `Last update: ${latestUpdateLabel}`}
              </Text>
            </View>
            <View
              style={[
                s.countChip,
                { backgroundColor: `${theme.primary}16`, borderColor: `${theme.primary}32` },
              ]}
            >
              <Text style={[s.countChipTxt, { color: theme.primary }]}>
                {selected.length} {language === "tr" ? "ürün" : "items"}
              </Text>
            </View>
          </View>

          <View style={s.metricsRow}>
            <View style={[s.metricTile, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricValue, { color: theme.emerald }]}>{activity.freshCount}</Text>
              <Text style={[s.metricLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "Yeni kalanlar" : "Fresh items"}
              </Text>
            </View>
            <View style={[s.metricTile, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricValue, { color: theme.primary }]}>{activity.restingCount}</Text>
              <Text style={[s.metricLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "Bekleyenler" : "Resting"}
              </Text>
            </View>
            <View style={[s.metricTile, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricValue, { color: theme.accentGold }]}>{activity.oldestLabel}</Text>
              <Text style={[s.metricLabel, { color: theme.textMuted }]}>
                {language === "tr" ? "En eski hareket" : "Oldest move"}
              </Text>
            </View>
          </View>

          {staleCount > 0 && (
            <TouchableOpacity
              style={[s.freshnessBand, { backgroundColor: `${theme.warning}12`, borderColor: `${theme.warning}32` }]}
              onPress={handleRefreshFreshness}
              activeOpacity={0.84}
              disabled={syncing}
            >
              <Ionicons name="refresh-circle-outline" size={18} color={theme.warning} />
              <Text style={[s.freshnessTxt, { color: theme.text }]}>
                {language === "tr"
                  ? `${staleCount} ürün uzun süredir güncellenmedi · tazeliği yenile`
                  : `${staleCount} items look stale · refresh freshness`}
              </Text>
            </TouchableOpacity>
          )}

          <View style={[s.insightBand, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
            <View style={[s.insightIcon, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.insightTitle, { color: theme.text }]}>{activity.insightTitle}</Text>
              <Text style={[s.insightBody, { color: theme.textMuted }]}>{activity.insightBody}</Text>
            </View>
          </View>

          <View style={s.actionRow}>
            <TouchableOpacity
              onPress={handleReceiptScan}
              activeOpacity={0.85}
              disabled={syncing}
              style={[
                s.primaryAction,
                { backgroundColor: theme.primary, opacity: syncing ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="receipt-outline" size={16} color={theme.bg} />
              <Text style={[s.primaryActionTxt, { color: theme.bg }]}>
                {language === "tr" ? "Fiş Tara" : "Scan receipt"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleIngredientScan}
              activeOpacity={0.85}
              disabled={syncing}
              style={[
                s.secondaryAction,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  opacity: syncing ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="camera-outline" size={16} color={theme.text} />
              <Text style={[s.secondaryActionTxt, { color: theme.text }]}>
                {language === "tr" ? "Fotoğrafla Tara" : "Scan from photo"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBarcodeScan}
              activeOpacity={0.85}
              disabled={syncing}
              style={[
                s.secondaryAction,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  opacity: syncing ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="barcode-outline" size={16} color={theme.text} />
              <Text style={[s.secondaryActionTxt, { color: theme.text }]}>
                {language === "tr" ? "Barkod Tara" : "Scan barcode"}
              </Text>
            </TouchableOpacity>
          </View>
        </AnimatedCard>

        <AnimatedCard delay={110} style={s.section}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>
            {language === "tr" ? "Ürün ekle" : "Add item"}
          </Text>
          <Text style={[s.sectionSub, { color: theme.textMuted }]}>
            {language === "tr"
              ? "Malzeme ara veya eşleşmeyen fiş satırını buradan tamamla."
              : "Search ingredients or complete unmatched receipt rows here."}
          </Text>
          <IngredientSearch
            onSelect={addIngredient}
            initialQuery={searchPrefill}
            initialQueryKey={searchPrefillKey}
          />
        </AnimatedCard>

        <AnimatedCard delay={170} style={s.section}>
          <View style={s.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>
                {language === "tr" ? "Aktif dolap ürünleri" : "Active pantry items"}
              </Text>
              <Text style={[s.sectionSub, { color: theme.textMuted }]}>
                {language === "tr"
                  ? "Bunlar tarif bulurken elinde var kabul edilir."
                  : "These are treated as available during recipe matching."}
              </Text>
            </View>
            {selected.length > 0 ? (
              <TouchableOpacity onPress={handleClear} activeOpacity={0.82} disabled={syncing}>
                <Text style={[s.clearTxt, { color: theme.textMuted, opacity: syncing ? 0.6 : 1 }]}>
                  {language === "tr" ? "Temizle" : "Clear"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View
            style={[
              s.listCard,
              { backgroundColor: theme.surface, borderColor: `${theme.border}D0` },
            ]}
          >
            {syncing ? (
              <ShimmerLine active color={`${theme.primary}12`} style={s.syncSweep} />
            ) : null}
            {loading ? (
              <Text style={[s.emptyTxt, { color: theme.textMuted }]}>
                {language === "tr" ? "Dolap yükleniyor..." : "Loading pantry..."}
              </Text>
            ) : selected.length === 0 ? (
              <Text style={[s.emptyTxt, { color: theme.textMuted }]}>
                {language === "tr"
                  ? "Henüz dolap ürünü yok. Yukarıdan manuel ekleyebilirsin."
                  : "There are no pantry items yet. Add items manually above."}
              </Text>
            ) : (
              selected.map((ingredient, index) => {
                const tags = buildPantryFreshnessTags(
                  snapshotById.get(ingredient.id),
                  index,
                  selected.length,
                  language,
                );

                return (
                <Animated.View
                  key={ingredient.id}
                  entering={FadeInDown.delay(index * 40).duration(280)}
                  exiting={FadeOutUp.duration(180)}
                  layout={LinearTransition.springify().damping(18)}
                  style={[
                    s.itemRow,
                    {
                      borderBottomColor: theme.borderLight,
                      borderBottomWidth: index === selected.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  <View style={s.itemMain}>
                    <View
                      style={[
                        s.itemDot,
                        {
                          backgroundColor: selectedIds.has(ingredient.id)
                            ? theme.emerald
                            : theme.textMuted,
                        },
                      ]}
                    />
                    <View style={s.itemTextBlock}>
                      <Text style={[s.itemName, { color: theme.text }]}>{ingredient.canonicalName}</Text>
                      <View style={s.itemTagRow}>
                        {tags.map((tag) => (
                          <View
                            key={tag}
                            style={[
                              s.itemTag,
                              { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight },
                            ]}
                          >
                            <Text style={[s.itemTagText, { color: theme.textMuted }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeIngredient(ingredient.id)}
                    activeOpacity={0.8}
                    disabled={syncing}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                </Animated.View>
                );
              })
            )}
          </View>
        </AnimatedCard>

        {syncing ? (
          <View
            style={[
              s.syncBand,
              { backgroundColor: theme.primaryGlow, borderColor: theme.borderEmerald },
            ]}
          >
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[s.syncBandText, { color: theme.primaryDark }]}>
              {language === "tr" ? "Dolap güncelleniyor..." : "Updating pantry..."}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function styles(theme: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    headerBtn: { minWidth: 48, minHeight: 36, justifyContent: "center", alignItems: "center" },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: "900" },
    headerSub: { fontSize: 12, fontWeight: "500", marginTop: 2 },
    content: { padding: spacing.lg, paddingBottom: 36, gap: spacing.lg },
    hero: {
      borderWidth: 1,
      borderRadius: radii.xxl,
      padding: spacing.lg,
      gap: spacing.md,
    },
    heroTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
    heroTitle: { fontSize: 18, fontWeight: "900", marginBottom: 4 },
    heroSub: { fontSize: 13, fontWeight: "500", lineHeight: 19, maxWidth: 260 },
    heroUpdateLine: { fontSize: 11.5, fontWeight: "800", marginTop: 8 },
    metricsRow: { flexDirection: "row", gap: 10 },
    metricTile: {
      flex: 1,
      borderRadius: radii.lg,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    metricValue: { fontSize: 15, fontWeight: "900", marginBottom: 3 },
    metricLabel: { fontSize: 10.5, fontWeight: "700", lineHeight: 14 },
    freshnessBand: {
      marginTop: 12,
      borderRadius: radii.xl,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 11,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    freshnessTxt: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "800" },
    insightBand: {
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: 12,
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    insightIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    insightTitle: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
    insightBody: { fontSize: 11.5, lineHeight: 16 },
    countChip: {
      alignSelf: "flex-start",
      borderRadius: radii.full,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    countChipTxt: { fontSize: 12, fontWeight: "800" },
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    primaryAction: {
      flex: 1,
      minWidth: 132,
      borderRadius: radii.xl,
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    secondaryAction: {
      flex: 1,
      minWidth: 132,
      borderRadius: radii.xl,
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    primaryActionTxt: { fontSize: 14, fontWeight: "800" },
    secondaryActionTxt: { fontSize: 14, fontWeight: "700" },
    section: { gap: spacing.sm },
    sectionHead: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
    sectionTitle: { fontSize: 16, fontWeight: "900" },
    sectionSub: { fontSize: 12, fontWeight: "500", lineHeight: 18 },
    clearTxt: { fontSize: 13, fontWeight: "700" },
    listCard: {
      borderWidth: 1,
      borderRadius: radii.xxl,
      overflow: "hidden",
      position: "relative",
    },
    syncSweep: {
      left: -48,
      top: 10,
      bottom: 10,
      opacity: 0.75,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
    },
    itemMain: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    itemDot: { width: 8, height: 8, borderRadius: 4 },
    itemTextBlock: { flex: 1, gap: 7 },
    itemName: { fontSize: 14, fontWeight: "700" },
    itemTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    itemTag: {
      borderRadius: radii.full,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    itemTagText: { fontSize: 10, fontWeight: "800" },
    emptyTxt: { padding: spacing.lg, fontSize: 13, lineHeight: 19, textAlign: "center" },
    syncBand: {
      borderRadius: radii.xl,
      borderWidth: 1,
      paddingVertical: 16,
      paddingHorizontal: spacing.lg,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    syncBandText: { fontSize: 15, fontWeight: "800" },
  });
}
