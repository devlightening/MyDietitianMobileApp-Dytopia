import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import IngredientSearch from "../components/IngredientSearch";
import { getPantry, replacePantry, type PantryItem } from "../api/pantry";
import { buildPantryActivitySummary } from "../features/smartInsights";
import { Routes } from "../navigation/routes";
import { useTheme } from "../context/ThemeContext";
import { radii, spacing } from "../theme/tokens";
import type { Ingredient } from "../types/alternative";

type PantryParams = {
  Pantry: {
    selectedIngredients?: Ingredient[];
    onConfirm?: (ingredients: Ingredient[]) => void;
  };
};

export default function PantryScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<PantryParams, "Pantry">>();
  const initialSelected = route.params?.selectedIngredients ?? [];

  const [selected, setSelected] = useState<Ingredient[]>(initialSelected);
  const [pantrySnapshot, setPantrySnapshot] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(initialSelected.length === 0);
  const [saving, setSaving] = useState(false);
  const [searchPrefill, setSearchPrefill] = useState("");
  const [searchPrefillKey, setSearchPrefillKey] = useState(0);

  useEffect(() => {
    if (initialSelected.length > 0) {
      setPantrySnapshot(
        initialSelected.map((item) => ({
          ingredientId: item.id,
          ingredientName: item.canonicalName,
          quantity: null,
          unit: null,
          updatedAtUtc: new Date().toISOString(),
        })),
      );
      setLoading(false);
      return;
    }

    let active = true;
    void getPantry()
      .then((items) => {
        if (!active) return;
        setPantrySnapshot(items);
        setSelected(items.map((item) => ({ id: item.ingredientId, canonicalName: item.ingredientName })));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialSelected]);

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);
  const activity = useMemo(() => buildPantryActivitySummary(pantrySnapshot, "tr"), [pantrySnapshot]);

  function syncSnapshotWithIngredients(ingredients: Ingredient[]) {
    const nowIso = new Date().toISOString();
    setPantrySnapshot(
      ingredients.map((item) => ({
        ingredientId: item.id,
        ingredientName: item.canonicalName,
        quantity: null,
        unit: null,
        updatedAtUtc: nowIso,
      })),
    );
  }

  function appendIngredients(ingredients: Ingredient[]) {
    setSelected((current) => {
      const existing = new Set(current.map((item) => item.id));
      const toAdd = ingredients.filter((item) => !existing.has(item.id));
      const next = toAdd.length > 0 ? [...toAdd, ...current] : current;
      syncSnapshotWithIngredients(next);
      return next;
    });
  }

  function addIngredient(ingredient: Ingredient) {
    appendIngredients([ingredient]);
  }

  function removeIngredient(id: string) {
    setSelected((current) => {
      const next = current.filter((item) => item.id !== id);
      syncSnapshotWithIngredients(next);
      return next;
    });
  }

  function handleSearchFallback(term: string) {
    setSearchPrefill(term);
    setSearchPrefillKey((value) => value + 1);
  }

  function handleReceiptScan() {
    (navigation as any).navigate(Routes.App.ReceiptScan, {
      onConfirm: (ingredients: Ingredient[]) => {
        appendIngredients(ingredients);
      },
      onUseSearchTerm: handleSearchFallback,
    });
  }

  function handleIngredientScan() {
    (navigation as any).navigate(Routes.App.IngredientScan, {
      onConfirm: (ingredients: Ingredient[]) => {
        appendIngredients(ingredients);
      },
      onUseSearchTerm: handleSearchFallback,
    });
  }

  async function handleSave() {
    if (saving) return;

    setSaving(true);
    try {
      const updated = await replacePantry(selected);
      setPantrySnapshot(updated);
      route.params?.onConfirm?.(
        updated.map((item) => ({ id: item.ingredientId, canonicalName: item.ingredientName })),
      );
      navigation.goBack();
    } catch {
      Alert.alert("Hata", "Dolap güncellenemedi. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    if (selected.length === 0) return;

    Alert.alert(
      "Dolabımı temizle",
      "Tüm seçili dolap ürünleri kaldırılsın mı?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Temizle",
          style: "destructive",
          onPress: () => {
            setSelected([]);
            setPantrySnapshot([]);
          },
        },
      ],
    );
  }

  const s = styles(theme);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]} edges={["top", "bottom"]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: theme.text }]}>Dolabım</Text>
          <Text style={[s.headerSub, { color: theme.textMuted }]}>
            Fişten ekle, elle düzenle, mutfak akışını hazır tut
          </Text>
        </View>
        <View style={s.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View
          style={[
            s.hero,
            { backgroundColor: theme.surface, borderColor: `${theme.border}D0` },
          ]}
        >
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroTitle, { color: theme.text }]}>Dolap durumu</Text>
              <Text style={[s.heroSub, { color: theme.textMuted }]}>
                Aktif ürünler mutfakta ve alternatif ekranlarında ön seçili gelir.
              </Text>
            </View>
            <View
              style={[
                s.countChip,
                { backgroundColor: `${theme.primary}16`, borderColor: `${theme.primary}32` },
              ]}
            >
              <Text style={[s.countChipTxt, { color: theme.primary }]}>
                {selected.length} ürün
              </Text>
            </View>
          </View>

          <View style={s.metricsRow}>
            <View style={[s.metricTile, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricValue, { color: theme.emerald }]}>{activity.freshCount}</Text>
              <Text style={[s.metricLabel, { color: theme.textMuted }]}>Yeni kalanlar</Text>
            </View>
            <View style={[s.metricTile, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricValue, { color: theme.primary }]}>{activity.restingCount}</Text>
              <Text style={[s.metricLabel, { color: theme.textMuted }]}>Bekleyenler</Text>
            </View>
            <View style={[s.metricTile, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricValue, { color: theme.accentGold }]}>{activity.oldestLabel}</Text>
              <Text style={[s.metricLabel, { color: theme.textMuted }]}>En eski hareket</Text>
            </View>
          </View>

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
              style={[
                s.primaryAction,
                { backgroundColor: theme.primary },
              ]}
            >
              <Ionicons name="receipt-outline" size={16} color={theme.bg} />
              <Text style={[s.primaryActionTxt, { color: theme.bg }]}>Fiş Tara</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleIngredientScan}
              activeOpacity={0.85}
              style={[
                s.secondaryAction,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              ]}
            >
              <Ionicons name="camera-outline" size={16} color={theme.text} />
              <Text style={[s.secondaryActionTxt, { color: theme.text }]}>Fotoğrafla Tara</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>Ürün ekle</Text>
          <Text style={[s.sectionSub, { color: theme.textMuted }]}>
            Malzeme ara veya eşleşmeyen fiş satırını buradan tamamla.
          </Text>
          <IngredientSearch
            onSelect={addIngredient}
            initialQuery={searchPrefill}
            initialQueryKey={searchPrefillKey}
          />
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>Aktif dolap ürünleri</Text>
              <Text style={[s.sectionSub, { color: theme.textMuted }]}>
                Bunlar tarif bulurken elinde var kabul edilir.
              </Text>
            </View>
            {selected.length > 0 && (
              <TouchableOpacity onPress={handleClear} activeOpacity={0.82}>
                <Text style={[s.clearTxt, { color: theme.textMuted }]}>Temizle</Text>
              </TouchableOpacity>
            )}
          </View>

          <View
            style={[
              s.listCard,
              { backgroundColor: theme.surface, borderColor: `${theme.border}D0` },
            ]}
          >
            {loading ? (
              <Text style={[s.emptyTxt, { color: theme.textMuted }]}>Dolap yükleniyor...</Text>
            ) : selected.length === 0 ? (
              <Text style={[s.emptyTxt, { color: theme.textMuted }]}>
                Henüz dolap ürünü yok. Fiş tarayabilir veya yukarıdan manuel ekleyebilirsin.
              </Text>
            ) : (
              selected.map((ingredient) => (
                <View
                  key={ingredient.id}
                  style={[s.itemRow, { borderBottomColor: theme.borderLight }]}
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
                    <Text style={[s.itemName, { color: theme.text }]}>{ingredient.canonicalName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeIngredient(ingredient.id)} activeOpacity={0.8}>
                    <Ionicons name="close-circle-outline" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => void handleSave()}
          activeOpacity={0.86}
          disabled={saving}
          style={[s.saveBtn, { backgroundColor: theme.emerald, opacity: saving ? 0.7 : 1 }]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={s.saveBtnTxt}>Dolabımı Güncelle</Text>
            </>
          )}
        </TouchableOpacity>
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
    actionRow: { flexDirection: "row", gap: 10 },
    primaryAction: {
      flex: 1,
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
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      borderBottomWidth: 1,
    },
    itemMain: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    itemDot: { width: 8, height: 8, borderRadius: 4 },
    itemName: { fontSize: 14, fontWeight: "700", flex: 1 },
    emptyTxt: { padding: spacing.lg, fontSize: 13, lineHeight: 19, textAlign: "center" },
    saveBtn: {
      minHeight: 54,
      borderRadius: radii.xl,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    saveBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  });
}

