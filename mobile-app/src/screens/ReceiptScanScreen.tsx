import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";

import { useTheme } from "../context/ThemeContext";
import { analyzeReceiptPantryImage } from "../api/pantry";
import {
  confirmDetection,
  type AnalyzeImageResponse,
  type DetectedIngredient,
  type VisionFeatureStatus,
} from "../api/vision";
import { logIngredientAcquisition } from "../api/acquisition";
import { radii, spacing } from "../theme/tokens";
import type { Ingredient } from "../types/alternative";

type ReceiptScanParams = {
  ReceiptScan: {
    onConfirm: (ingredients: Ingredient[]) => void;
    onUseSearchTerm?: (term: string) => void;
  };
};

type Phase = "picker" | "analyzing" | "results";

export default function ReceiptScanScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ReceiptScanParams, "ReceiptScan">>();

  const [phase, setPhase] = useState<Phase>("picker");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeImageResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const matched = analysis?.matched ?? [];
  const unmatched = analysis?.unmatched ?? [];

  const safeAutoIds = useMemo(
    () => new Set(matched.filter((item) => item.isAutoSelected).map((item) => item.ingredientId)),
    [matched],
  );

  async function openCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Kamera izni gerekli. Ayarlardan izin verip tekrar deneyin.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      base64: true,
      quality: 0.75,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      await submitImage(result.assets[0].base64, result.assets[0].mimeType ?? "image/jpeg");
    }
  }

  async function openGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Galeri izni gerekli. Ayarlardan izin verip tekrar deneyin.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      base64: true,
      quality: 0.75,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      await submitImage(result.assets[0].base64, result.assets[0].mimeType ?? "image/jpeg");
    }
  }

  async function submitImage(base64Image: string, mediaType: string) {
    setStartedAt(Date.now());
    setPhase("analyzing");
    setError(null);

    try {
      const response = await analyzeReceiptPantryImage(base64Image, mediaType);
      setAnalysis(response);
      setSelectedIds(new Set(response.matched.filter((item) => item.isAutoSelected).map((item) => item.ingredientId)));
      setPhase("results");
    } catch (err: any) {
      setError(
        err?.response?.data?.error ??
          "Fiş analizi tamamlanamadı. Daha net bir fotoğraf ile tekrar deneyin.",
      );
      setPhase("picker");
    }
  }

  function toggleSelection(item: DetectedIngredient) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.ingredientId)) {
        next.delete(item.ingredientId);
      } else {
        next.add(item.ingredientId);
      }
      return next;
    });
  }

  function handleUseSearchTerm(term: string) {
    route.params.onUseSearchTerm?.(term);
    navigation.goBack();
  }

  function handleConfirm() {
    const selected = matched.filter((item) => selectedIds.has(item.ingredientId));
    const ingredients = selected.map<Ingredient>((item) => ({
      id: item.ingredientId,
      canonicalName: item.canonicalName,
    }));

    if (analysis?.sessionId) {
      void confirmDetection(
        analysis.sessionId,
        selected.map((item) => item.ingredientId),
      ).catch(() => undefined);
    }

    void logIngredientAcquisition({
      sessionId: analysis?.sessionId,
      source: "Receipt",
      rawInput: "receipt-image",
      selectedIngredients: selected.map((item) => ({
        ingredientId: item.ingredientId,
        mappingType: item.mappingType,
        confidence: item.confidence,
      })),
      mappingType: selected[0]?.mappingType ?? "Unresolved",
      requiredConfirmation: selected.some((item) => item.requiresConfirmation),
      confirmedByUser: true,
      interactionCount: Math.max(1, selected.length),
      latencyMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
      startedAtUtc: startedAt ? new Date(startedAt).toISOString() : undefined,
      completedAtUtc: new Date().toISOString(),
    }).catch(() => undefined);

    route.params.onConfirm(ingredients);
    navigation.goBack();
  }

  const featureStatus: VisionFeatureStatus = analysis?.featureStatus ?? "active";
  const isFeatureUnavailable = analysis !== null && featureStatus !== "active";
  const isEmpty =
    analysis !== null &&
    featureStatus === "active" &&
    analysis.totalDetected === 0 &&
    matched.length === 0 &&
    unmatched.length === 0;

  const selectedCount = matched.filter((item) => selectedIds.has(item.ingredientId)).length;
  const s = styles(theme);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.headerIcon} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="chevron-down" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Fiş Tara</Text>
        <View style={s.headerIcon} />
      </View>

      {phase === "picker" && (
        <View style={s.centered}>
          <View style={[s.heroIcon, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Ionicons name="receipt-outline" size={34} color={theme.primary} />
          </View>
          <Text style={[s.title, { color: theme.text }]}>Market fişini okut</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>
            Sistem fişteki yenilebilir ürünleri ayıklar, pantry'ye eklenmeye hazır hale getirir.
          </Text>

          {error && (
            <View style={[s.alert, { backgroundColor: `${theme.error}12`, borderColor: `${theme.error}30` }]}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.error} />
              <Text style={[s.alertText, { color: theme.error }]}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.primaryButton, { backgroundColor: theme.primary }]}
            onPress={openCamera}
            activeOpacity={0.85}
          >
            <Ionicons name="camera" size={18} color={theme.bg} />
            <Text style={[s.primaryButtonText, { color: theme.bg }]}>Kamerayla çek</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            onPress={openGallery}
            activeOpacity={0.85}
          >
            <Ionicons name="images-outline" size={18} color={theme.text} />
            <Text style={[s.secondaryButtonText, { color: theme.text }]}>Galeriden seç</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === "analyzing" && (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[s.title, { color: theme.text, marginTop: spacing.lg }]}>Fiş okunuyor</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>
            Ürün satırları ayrıştırılıyor ve pantry adayları hazırlanıyor.
          </Text>
        </View>
      )}

      {phase === "results" && (
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {isFeatureUnavailable ? (
            <View style={[s.emptyState, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Ionicons name="cloud-offline-outline" size={46} color={theme.textMuted} />
              <Text style={[s.emptyTitle, { color: theme.text }]}>
                {featureStatus === "disabled" ? "Fiş tarama devre dışı" : "API anahtarı eksik"}
              </Text>
              <Text style={[s.emptyText, { color: theme.textMuted }]}>
                Sunucu tarafında görsel tarama servisi hazır değil.
              </Text>
            </View>
          ) : isEmpty ? (
            <View style={[s.emptyState, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Ionicons name="search-circle-outline" size={46} color={theme.textMuted} />
              <Text style={[s.emptyTitle, { color: theme.text }]}>Uygun ürün bulunamadı</Text>
              <Text style={[s.emptyText, { color: theme.textMuted }]}>
                Fişte okunabilir ürün satırı bulunamadı. Daha düz ve net bir fotoğraf deneyin.
              </Text>
            </View>
          ) : (
            <>
              <View style={[s.summaryCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[s.summaryTitle, { color: theme.text }]}>
                  {analysis?.totalDetected ?? 0} pantry adayı bulundu
                </Text>
                <Text style={[s.summarySub, { color: theme.textMuted }]}>
                  Seçilen ürünler dolabına eklenecek. Gerekirse inceleyip düzelt.
                </Text>
              </View>

              {matched.length > 0 && (
                <View style={s.section}>
                  <Text style={[s.sectionLabel, { color: theme.textMuted }]}>Eşleşen ürünler</Text>
                  {matched.map((item) => {
                    const selected = selectedIds.has(item.ingredientId);
                    const safe = safeAutoIds.has(item.ingredientId);
                    const accent = safe ? theme.emerald : theme.warning ?? "#F59E0B";
                    return (
                      <TouchableOpacity
                        key={`${item.ingredientId}-${item.detectedName}`}
                        style={[
                          s.itemCard,
                          {
                            backgroundColor: selected ? `${accent}12` : theme.surface,
                            borderColor: selected ? `${accent}40` : theme.border,
                          },
                        ]}
                        onPress={() => toggleSelection(item)}
                        activeOpacity={0.82}
                      >
                        <View style={s.itemMain}>
                          <Text style={[s.itemTitle, { color: theme.text }]}>{item.canonicalName}</Text>
                          <Text style={[s.itemMeta, { color: theme.textMuted }]}>
                            {item.detectedName} · %{Math.round(item.confidence * 100)}
                          </Text>
                          <Text style={[s.itemHint, { color: accent }]}>
                            {safe ? "Yüksek güven" : "Onay önerilir"}
                          </Text>
                        </View>
                        <View
                          style={[
                            s.checkbox,
                            {
                              borderColor: selected ? accent : theme.border,
                              backgroundColor: selected ? accent : "transparent",
                            },
                          ]}
                        >
                          {selected && <Ionicons name="checkmark" size={14} color={theme.bg} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {unmatched.length > 0 && (
                <View style={s.section}>
                  <Text style={[s.sectionLabel, { color: theme.textMuted }]}>İnceleme isteyen satırlar</Text>
                  {unmatched.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[s.unmatchedRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => handleUseSearchTerm(item)}
                      activeOpacity={0.82}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.unmatchedTitle, { color: theme.text }]}>{item}</Text>
                        <Text style={[s.unmatchedSub, { color: theme.textMuted }]}>
                          Manuel aramaya gönder
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward-circle-outline" size={18} color={theme.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[
                  s.confirmButton,
                  { backgroundColor: theme.primary },
                  selectedCount === 0 && s.disabled,
                ]}
                onPress={handleConfirm}
                disabled={selectedCount === 0}
                activeOpacity={0.85}
              >
                <Text style={s.confirmButtonText}>
                  {selectedCount === 0 ? "En az bir ürün seç" : `${selectedCount} ürünü dolabıma ekle`}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function styles(theme: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
    },
    headerIcon: { width: 32, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "900" },
    centered: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      justifyContent: "center",
      alignItems: "center",
    },
    heroIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      marginBottom: spacing.lg,
    },
    title: { fontSize: 24, fontWeight: "900", textAlign: "center" },
    subtitle: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.lg },
    alert: {
      borderWidth: 1,
      borderRadius: radii.xl,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      flexDirection: "row",
      gap: 8,
      marginBottom: spacing.md,
    },
    alertText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18 },
    primaryButton: {
      width: "100%",
      borderRadius: radii.xl,
      paddingVertical: 15,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      marginBottom: spacing.sm,
    },
    primaryButtonText: { fontSize: 15, fontWeight: "800" },
    secondaryButton: {
      width: "100%",
      borderRadius: radii.xl,
      borderWidth: 1,
      paddingVertical: 15,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    secondaryButtonText: { fontSize: 15, fontWeight: "700" },
    scrollContent: { padding: spacing.lg, paddingBottom: 36, gap: spacing.lg },
    emptyState: {
      borderWidth: 1,
      borderRadius: radii.xxl,
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.sm,
    },
    emptyTitle: { fontSize: 18, fontWeight: "900", textAlign: "center" },
    emptyText: { fontSize: 13, lineHeight: 20, textAlign: "center" },
    summaryCard: {
      borderWidth: 1,
      borderRadius: radii.xxl,
      padding: spacing.lg,
      gap: 6,
    },
    summaryTitle: { fontSize: 17, fontWeight: "900" },
    summarySub: { fontSize: 13, lineHeight: 19 },
    section: { gap: spacing.sm },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    itemCard: {
      borderWidth: 1,
      borderRadius: radii.xl,
      padding: spacing.md,
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
    },
    itemMain: { flex: 1, gap: 2 },
    itemTitle: { fontSize: 15, fontWeight: "800" },
    itemMeta: { fontSize: 12, fontWeight: "500" },
    itemHint: { fontSize: 11, fontWeight: "800" },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    unmatchedRow: {
      borderWidth: 1,
      borderRadius: radii.xl,
      padding: spacing.md,
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
    },
    unmatchedTitle: { fontSize: 14, fontWeight: "700" },
    unmatchedSub: { fontSize: 12, fontWeight: "500", marginTop: 3 },
    confirmButton: {
      borderRadius: radii.xxl,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.sm,
    },
    confirmButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
    disabled: { opacity: 0.45 },
  });
}

