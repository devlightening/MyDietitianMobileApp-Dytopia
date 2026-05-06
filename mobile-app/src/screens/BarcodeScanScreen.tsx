import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import IngredientSearch from '../components/IngredientSearch';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { logIngredientAcquisition } from '../api/acquisition';
import { confirmBarcodeMapping, resolveBarcode, type BarcodeResolveResponse } from '../api/barcodes';
import { radii, spacing } from '../theme/tokens';
import type { Ingredient } from '../types/alternative';

type BarcodeScanParams = {
  BarcodeScan: {
    usageContext?: 'kitchen' | 'pantry';
    onConfirm: (ingredients: Ingredient[]) => void;
    onUseSearchTerm?: (term: string) => void;
  };
};

type Phase = 'scanner' | 'resolving' | 'result';

export default function BarcodeScanScreen() {
  const { theme } = useTheme();
  const { language } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<BarcodeScanParams, 'BarcodeScan'>>();
  const usageContext = route.params?.usageContext ?? 'kitchen';
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>('scanner');
  const [result, setResult] = useState<BarcodeResolveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const startedAtRef = useRef(Date.now());

  const copy = language === 'tr'
    ? {
        title: 'Barkodu kameraya göster',
        subtitle: 'Ürün barkodunu çerçeve içine getir.',
        permissionTitle: 'Kamera izni gerekiyor',
        permissionBody: 'Paketli ürün barkodlarını okumak için kameraya erişim vermelisin.',
        allow: 'İzin ver',
        resolving: 'Barkod çözümleniyor...',
        found: 'Ürün bulundu',
        matched: 'Eşleşen malzeme',
        add: usageContext === 'pantry' ? 'Dolabıma Ekle' : 'Kazana Ekle',
        rescan: 'Yeniden Tara',
        unknown: 'Bu barkodu tanıyamadık',
        choose: 'Lütfen hangi malzemeye karşılık geldiğini seç:',
        saved: 'Barkod kaydedildi',
        fallback: 'Metin aramasına geç',
      }
    : {
        title: 'Show the barcode',
        subtitle: 'Place the product barcode inside the frame.',
        permissionTitle: 'Camera permission required',
        permissionBody: 'Camera access is required to scan packaged product barcodes.',
        allow: 'Allow',
        resolving: 'Resolving barcode...',
        found: 'Product found',
        matched: 'Matched ingredient',
        add: usageContext === 'pantry' ? 'Add to Pantry' : 'Add to Pot',
        rescan: 'Scan Again',
        unknown: 'We could not identify this barcode',
        choose: 'Select the ingredient this product maps to:',
        saved: 'Barcode saved',
        fallback: 'Use text search',
      };

  async function handleBarcodeScanned(event: { data?: string }) {
    const barcode = event.data?.trim();
    if (!barcode || isResolving || barcode === lastScannedBarcode) {
      return;
    }

    setIsResolving(true);
    setLastScannedBarcode(barcode);
    setError(null);
    setResult(null);
    setPhase('resolving');
    startedAtRef.current = Date.now();

    try {
      const response = await resolveBarcode(barcode);
      setResult(response);
      setPhase('result');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Barkod çözümlenemedi.');
      setPhase('scanner');
      setLastScannedBarcode(null);
    } finally {
      setIsResolving(false);
    }
  }

  function resetScan() {
    setResult(null);
    setError(null);
    setIsResolving(false);
    setIsConfirming(false);
    setLastScannedBarcode(null);
    setPhase('scanner');
  }

  function addResolvedIngredient(response: BarcodeResolveResponse) {
    if (!response.canonicalIngredientId || !response.canonicalIngredientName) {
      return;
    }

    route.params.onConfirm([
      {
        id: response.canonicalIngredientId,
        canonicalName: response.canonicalIngredientName,
      },
    ]);

    void logIngredientAcquisition({
      source: 'Barcode',
      rawInput: response.barcode,
      selectedIngredients: [
        {
          ingredientId: response.canonicalIngredientId,
          mappingType: 'ExactIngredient',
          confidence: response.confidence ?? 1,
        },
      ],
      mappingType: 'ExactIngredient',
      requiredConfirmation: response.requiresManualMapping,
      confirmedByUser: true,
      interactionCount: 1,
      latencyMs: Math.max(0, Date.now() - startedAtRef.current),
      startedAtUtc: new Date(startedAtRef.current).toISOString(),
      completedAtUtc: new Date().toISOString(),
      productName: response.productName ?? undefined,
      brand: response.brand ?? undefined,
    }).catch(() => undefined);

    navigation.goBack();
  }

  async function handleManualIngredientSelect(ingredient: Ingredient) {
    if (!result || isConfirming) {
      return;
    }

    setIsConfirming(true);
    try {
      const confirmed = await confirmBarcodeMapping({
        barcode: result.barcode,
        ingredientId: ingredient.id,
        productName: result.productName,
        brand: result.brand,
      });

      Alert.alert(copy.saved, confirmed.message ?? `${result.barcode} -> ${ingredient.canonicalName}`);
      addResolvedIngredient(confirmed);
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.error ?? err?.message ?? 'Barkod eşleştirmesi kaydedilemedi.');
    } finally {
      setIsConfirming(false);
    }
  }

  function handleSearchFallback() {
    const fallbackText = result?.productName || result?.barcode;
    if (fallbackText) {
      route.params.onUseSearchTerm?.(fallbackText);
    }

    navigation.goBack();
  }

  if (!permission) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle="light-content" />
        <View style={s.centered}>
          <Ionicons name="barcode-outline" size={42} color={theme.primary} />
          <Text style={[s.title, { color: theme.text }]}>{copy.permissionTitle}</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>{copy.permissionBody}</Text>
          <TouchableOpacity
            style={[s.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => requestPermission()}
            activeOpacity={0.85}
          >
            <Text style={[s.primaryButtonText, { color: theme.bg }]}>{copy.allow}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canAddDirectly = result?.found && result.canonicalIngredientId && result.canonicalIngredientName;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.headerIcon} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="chevron-down" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Barkod Tara</Text>
        <View style={s.headerIcon} />
      </View>

      {phase === 'scanner' && (
        <View style={s.scannerWrap}>
          <Text style={[s.title, { color: theme.text }]}>{copy.title}</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>{copy.subtitle}</Text>

          <View style={[s.cameraShell, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={[s.scanFrame, { borderColor: theme.primary }]} />
          </View>

          {error ? (
            <View style={[s.alert, { backgroundColor: `${theme.error}12`, borderColor: `${theme.error}30` }]}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.error} />
              <Text style={[s.alertText, { color: theme.error }]}>{error}</Text>
            </View>
          ) : null}
        </View>
      )}

      {phase === 'resolving' && (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[s.title, { color: theme.text, marginTop: spacing.lg }]}>{copy.resolving}</Text>
        </View>
      )}

      {phase === 'result' && result && (
        <ScrollView contentContainerStyle={s.resultsWrap} keyboardShouldPersistTaps="handled">
          <View style={[s.resultCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Text style={[s.resultKicker, { color: result.found ? theme.emerald : theme.warning }]}>
              {result.found ? copy.found : copy.unknown}
            </Text>
            <Text style={[s.resultTitle, { color: theme.text }]}>{result.productName || result.barcode}</Text>
            <Text style={[s.resultMeta, { color: theme.textMuted }]}>
              {result.brand ? `${result.brand} • ` : ''}
              {result.source ?? 'manual'}{result.confidence != null ? ` • ${Math.round(result.confidence * 100)}%` : ''}
            </Text>
            {result.message ? <Text style={[s.resultMeta, { color: theme.textMuted }]}>{result.message}</Text> : null}
          </View>

          {canAddDirectly ? (
            <>
              <View style={[s.resultCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.resultKicker, { color: theme.textMuted }]}>{copy.matched}</Text>
                <Text style={[s.resultTitle, { color: theme.text }]}>{result.canonicalIngredientName}</Text>
              </View>

              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.primaryButton, { backgroundColor: theme.primary }]}
                  onPress={() => addResolvedIngredient(result)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.primaryButtonText, { color: theme.bg }]}>{copy.add}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                  onPress={resetScan}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh-outline" size={18} color={theme.text} />
                  <Text style={[s.secondaryButtonText, { color: theme.text }]}>{copy.rescan}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={[s.resultCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.resultTitle, { color: theme.text }]}>{copy.choose}</Text>
                <Text style={[s.resultMeta, { color: theme.textMuted }]}>Barkod: {result.barcode}</Text>
              </View>

              <IngredientSearch
                onSelect={handleManualIngredientSelect}
                initialQuery={result.productName ?? undefined}
                initialQueryKey={result.barcode.length}
              />

              {isConfirming ? (
                <View style={s.confirmingRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[s.resultMeta, { color: theme.textMuted }]}>Eşleştirme kaydediliyor...</Text>
                </View>
              ) : null}

              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                  onPress={handleSearchFallback}
                  activeOpacity={0.85}
                >
                  <Ionicons name="search-outline" size={18} color={theme.text} />
                  <Text style={[s.secondaryButtonText, { color: theme.text }]}>{copy.fallback}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                  onPress={resetScan}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh-outline" size={18} color={theme.text} />
                  <Text style={[s.secondaryButtonText, { color: theme.text }]}>{copy.rescan}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerIcon: { width: 32, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  scannerWrap: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  cameraShell: {
    flex: 1,
    minHeight: 340,
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: '72%',
    height: 110,
    borderRadius: radii.lg,
    borderWidth: 2,
  },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600' },
  resultsWrap: {
    flexGrow: 1,
    padding: spacing.base,
    gap: spacing.md,
  },
  resultCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  resultKicker: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  resultTitle: { fontSize: 17, fontWeight: '800' },
  resultMeta: { fontSize: 13, lineHeight: 18 },
  confirmingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  actions: { gap: spacing.sm, marginTop: 'auto' },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '700' },
});
