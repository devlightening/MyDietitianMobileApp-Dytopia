import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
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
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../context/ThemeContext";
import { analyzeReceiptPantryImage } from "../api/pantry";
import {
  confirmDetection,
  type AnalyzeImageResponse,
  type DetectedIngredient,
  type VisionFeatureStatus,
} from "../api/vision";
import { logIngredientAcquisition } from "../api/acquisition";
import { compressImage } from "../utils/imageCompressor";
import { radii, spacing } from "../theme/tokens";
import type { Ingredient } from "../types/alternative";

const BRAND_LOGO = require("../../assets/dytopia-logo.png");

const SCAN_MESSAGES = [
  "Fotoğraf analiz ediliyor...",
  "Malzemeler tanımlanıyor...",
  "Sonuçlar hazırlanıyor...",
];

function AnalyzingView({ theme }: { theme: any }) {
  const [msgIndex, setMsgIndex] = useState(0);

  const ring1Scale = useSharedValue(1.0);
  const ring1Opacity = useSharedValue(0.35);
  const ring2Scale = useSharedValue(0.95);
  const ring3Opacity = useSharedValue(0.55);
  const logoScale = useSharedValue(1.0);
  const scanAngle = useSharedValue(0);

  useEffect(() => {
    ring1Scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: 1600, easing: Easing.in(Easing.quad) }),
      ), -1, false,
    );
    ring1Opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 1600, easing: Easing.in(Easing.quad) }),
      ), -1, false,
    );
    ring2Scale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1600, easing: Easing.out(Easing.quad) }),
          withTiming(0.95, { duration: 1600, easing: Easing.in(Easing.quad) }),
        ), -1, false,
      ),
    );
    ring3Opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1200 }),
        withTiming(0.4, { duration: 1200 }),
      ), -1, false,
    );
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1400, easing: Easing.out(Easing.ease) }),
        withTiming(0.97, { duration: 1400, easing: Easing.in(Easing.ease) }),
      ), -1, false,
    );
    scanAngle.value = withRepeat(
      withTiming(360, { duration: 2800, easing: Easing.linear }),
      -1, false,
    );

    const timer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % SCAN_MESSAGES.length);
    }, 2400);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    opacity: ring3Opacity.value,
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));
  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${scanAngle.value}deg` }],
  }));

  return (
    <View style={sa.container}>
      <View style={sa.orbitArea}>
        <Animated.View style={[sa.ring, sa.ring1, { borderColor: `${theme.primary}20` }, ring1Style]} />
        <Animated.View style={[sa.ring, sa.ring2, { borderColor: `${theme.primary}36` }, ring2Style]} />
        <Animated.View style={[sa.ring, sa.ring3, { borderColor: theme.borderEmerald }, ring3Style]} />
        <Animated.View
          style={[
            sa.scanArc,
            {
              borderTopColor: theme.primary,
              borderRightColor: `${theme.primary}40`,
              borderBottomColor: "transparent",
              borderLeftColor: "transparent",
            },
            scanStyle,
          ]}
        />
        <Animated.View
          style={[sa.logoBubble, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }, logoStyle]}
        >
          <Image source={BRAND_LOGO} style={sa.logoImg} resizeMode="contain" />
        </Animated.View>
      </View>

      <Animated.Text
        key={msgIndex}
        entering={FadeInDown.duration(380)}
        style={[sa.message, { color: theme.text }]}
      >
        {SCAN_MESSAGES[msgIndex]}
      </Animated.Text>
      <Text style={[sa.hint, { color: theme.textMuted }]}>Bu işlem 10–20 saniye sürebilir</Text>
    </View>
  );
}

const sa = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  // Fixed 200×200 canvas — all children absolutely positioned from (0,0)
  orbitArea: {
    width: 200,
    height: 200,
    marginBottom: 44,
  },
  ring: {
    position: "absolute",
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  // Each ring centered: top = left = (200 − size) / 2
  ring1: { width: 200, height: 200, top: 0,  left: 0  },
  ring2: { width: 152, height: 152, top: 24, left: 24 },
  ring3: { width: 108, height: 108, top: 46, left: 46 },
  // Scan sweep arc — slightly inset from ring1
  scanArc: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 2,
  },
  // Logo bubble — (200 − 76) / 2 = 62
  logoBubble: {
    position: "absolute",
    top: 62,
    left: 62,
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  logoImg: {
    width: 62,
    height: 62,
    borderRadius: 16,
  },
  message: {
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  hint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
});

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
      base64: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const compressed = await compressImage(result.assets[0].uri, "receipt");
      await submitImage(compressed.base64, compressed.mediaType);
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
      base64: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const compressed = await compressImage(result.assets[0].uri, "receipt");
      await submitImage(compressed.base64, compressed.mediaType);
    }
  }

  async function submitImage(base64Image: string, mediaType: string) {
    setStartedAt(Date.now());
    setPhase("analyzing");
    setError(null);

    try {
      const response = await analyzeReceiptPantryImage(base64Image, mediaType);

      if (response.reason === "image_too_large") {
        setError(response.userMessage ?? "Fotoğraf çok büyük. Lütfen tekrar deneyin.");
        setPhase("picker");
        return;
      }

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

      {phase === "analyzing" && <AnalyzingView theme={theme} />}

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
                  {matched.length} ürün tespit edildi
                </Text>
                <Text style={[s.summarySub, { color: theme.textMuted }]}>
                  Eklemek istediklerini seç, geri kalanları geç.
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
                          <Text style={[s.itemHint, { color: accent }]}>
                            {safe ? "Otomatik eşleşti" : "Lütfen kontrol edin"}
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

