import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { useTheme } from '../context/ThemeContext';
import { logIngredientAcquisition, resolveBarcode, type AcquisitionCandidate, type ResolveBarcodeResponse } from '../api/acquisition';
import { radii, spacing } from '../theme/tokens';
import type { Ingredient } from '../types/alternative';

type BarcodeScanParams = {
  BarcodeScan: {
    onConfirm: (ingredients: Ingredient[]) => void;
    onUseSearchTerm?: (term: string) => void;
  };
};

type Phase = 'scanner' | 'analyzing' | 'results';

export default function BarcodeScanScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<BarcodeScanParams, 'BarcodeScan'>>();
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>('scanner');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolveBarcodeResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [scanned, setScanned] = useState(false);

  const candidates = result?.candidates ?? [];

  async function handleBarcodeScanned(event: { data?: string }) {
    const barcode = event.data?.trim();
    if (!barcode || scanned) {
      return;
    }

    setScanned(true);
    setStartedAt(Date.now());
    setPhase('analyzing');
    setError(null);

    try {
      const response = await resolveBarcode(barcode);
      setResult(response);
      const autoCandidate = response.candidates.find(candidate => !candidate.requiresConfirmation);
      setSelectedId(autoCandidate?.ingredientId ?? response.candidates[0]?.ingredientId ?? null);
      setPhase('results');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ??
          'Barkod çözümlenemedi. Farklı bir ürün veya metin araması deneyin.',
      );
      setPhase('scanner');
      setScanned(false);
    }
  }

  function handleRetry() {
    setResult(null);
    setSelectedId(null);
    setError(null);
    setScanned(false);
    setPhase('scanner');
  }

  function handleSearchFallback() {
    const fallbackText = result?.productName || result?.barcode;
    if (fallbackText) {
      route.params.onUseSearchTerm?.(fallbackText);
    }

    navigation.goBack();
  }

  function handleConfirm() {
    const selectedCandidate = candidates.find(candidate => candidate.ingredientId === selectedId);
    if (!selectedCandidate || !result) {
      return;
    }

    void logIngredientAcquisition({
      sessionId: result.sessionId,
      source: 'Barcode',
      rawInput: result.barcode,
      selectedIngredients: [
        {
          ingredientId: selectedCandidate.ingredientId,
          mappingType: selectedCandidate.mappingType,
          confidence: selectedCandidate.confidence,
        },
      ],
      mappingType: selectedCandidate.mappingType,
      requiredConfirmation: selectedCandidate.requiresConfirmation,
      confirmedByUser: true,
      interactionCount: 1,
      latencyMs: Math.max(0, Date.now() - startedAt),
      startedAtUtc: new Date(startedAt).toISOString(),
      completedAtUtc: new Date().toISOString(),
      productName: result.productName ?? undefined,
      brand: result.brand ?? undefined,
    }).catch(() => undefined);

    route.params.onConfirm([
      {
        id: selectedCandidate.ingredientId,
        canonicalName: selectedCandidate.canonicalName,
      },
    ]);
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
          <Ionicons name="barcode-outline" size={40} color={theme.primary} />
          <Text style={[s.title, { color: theme.text }]}>Barkod tarayıcı izni gerekiyor</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>
            Paketli ürünleri kanonik malzeme ailesine çevirmek için kameraya erişim vermelisin.
          </Text>
          <TouchableOpacity
            style={[s.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => requestPermission()}
            activeOpacity={0.85}
          >
            <Text style={[s.primaryButtonText, { color: theme.bg }]}>İzin ver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.headerIcon} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="chevron-down" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Barkod tara</Text>
        <View style={s.headerIcon} />
      </View>

      {phase === 'scanner' && (
        <View style={s.scannerWrap}>
          <Text style={[s.title, { color: theme.text }]}>Paketli ürün barkodunu okut</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>
            Sistem önce yerel eşleme önbelleğine, sonra Open Food Facts yardımcı verisine bakar.
          </Text>

          <View style={[s.cameraShell, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={[s.scanFrame, { borderColor: theme.primary }]} />
          </View>

          {error && (
            <View style={[s.alert, { backgroundColor: `${theme.error}12`, borderColor: `${theme.error}30` }]}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.error} />
              <Text style={[s.alertText, { color: theme.error }]}>{error}</Text>
            </View>
          )}
        </View>
      )}

      {phase === 'analyzing' && (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[s.title, { color: theme.text, marginTop: spacing.lg }]}>Barkod çözülüyor</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>
            Ürün adı kanonik malzeme ailesine eşleniyor.
          </Text>
        </View>
      )}

      {phase === 'results' && result && (
        <View style={s.resultsWrap}>
          <View style={[s.resultCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Text style={[s.resultTitle, { color: theme.text }]}>{result.productName || result.barcode}</Text>
            <Text style={[s.resultMeta, { color: theme.textMuted }]}>
              {result.brand ? `${result.brand} â€¢ ` : ''}
              {result.sourceProvider} â€¢ {Math.round(result.confidence * 100)}%
            </Text>
            <Text style={[s.resultMeta, { color: theme.textMuted }]}>
              {result.mappingType}
              {result.requiresConfirmation ? ' â€¢ kullanıcı onayı gerekli' : ' â€¢ güvenli otomatik eşleşme'}
            </Text>
          </View>

          {candidates.length > 0 ? (
            candidates.map((candidate: AcquisitionCandidate) => {
              const selected = selectedId === candidate.ingredientId;
              return (
                <TouchableOpacity
                  key={candidate.ingredientId}
                  style={[
                    s.candidateCard,
                    {
                      backgroundColor: selected ? theme.surfaceElevated : theme.surface,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedId(candidate.ingredientId)}
                  activeOpacity={0.82}
                >
                  <View style={s.candidateMain}>
                    <Text style={[s.candidateTitle, { color: theme.text }]}>{candidate.canonicalName}</Text>
                    <Text style={[s.resultMeta, { color: theme.textMuted }]}>
                      {candidate.mappingType} â€¢ {Math.round(candidate.confidence * 100)}%
                    </Text>
                  </View>
                  <View
                    style={[
                      s.checkbox,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.primary : 'transparent',
                      },
                    ]}
                  >
                    {selected && <Ionicons name="checkmark" size={14} color={theme.bg} />}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={[s.resultCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.resultTitle, { color: theme.text }]}>Doğrudan malzeme adayı bulunamadı</Text>
              <Text style={[s.resultMeta, { color: theme.textMuted }]}>
                Ürünü metin aramasıyla doğrulamak daha güvenli olacak.
              </Text>
            </View>
          )}

          <View style={s.actions}>
            <TouchableOpacity
              style={[
                s.primaryButton,
                { backgroundColor: selectedId ? theme.primary : theme.surfaceElevated },
              ]}
              disabled={!selectedId}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text style={[s.primaryButtonText, { color: selectedId ? theme.bg : theme.textMuted }]}>
                Seçili malzemeyi ekle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
              onPress={handleSearchFallback}
              activeOpacity={0.85}
            >
              <Ionicons name="search-outline" size={18} color={theme.text} />
              <Text style={[s.secondaryButtonText, { color: theme.text }]}>Metin aramasına geç</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
              onPress={handleRetry}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-outline" size={18} color={theme.text} />
              <Text style={[s.secondaryButtonText, { color: theme.text }]}>Tekrar tara</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    flex: 1,
    padding: spacing.base,
    gap: spacing.md,
  },
  resultCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  resultTitle: { fontSize: 16, fontWeight: '800' },
  resultMeta: { fontSize: 13, lineHeight: 18 },
  candidateCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  candidateMain: { flex: 1, gap: 4 },
  candidateTitle: { fontSize: 15, fontWeight: '800' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

