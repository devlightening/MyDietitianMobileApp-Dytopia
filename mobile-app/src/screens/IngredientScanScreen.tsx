import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { useTheme } from '../context/ThemeContext';
import {
  analyzeIngredientImage,
  confirmDetection,
  type AnalyzeImageResponse,
  type DetectedIngredient,
  type VisionFeatureStatus,
} from '../api/vision';
import { logIngredientAcquisition } from '../api/acquisition';
import { radii, spacing } from '../theme/tokens';
import type { Ingredient } from '../types/alternative';

type IngredientScanParams = {
  IngredientScan: {
    onConfirm: (ingredients: Ingredient[]) => void;
    onUseSearchTerm?: (term: string) => void;
  };
};

type Phase = 'picker' | 'analyzing' | 'results';

export default function IngredientScanScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<IngredientScanParams, 'IngredientScan'>>();

  const [phase, setPhase] = useState<Phase>('picker');
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeImageResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const matched = analysis?.matched ?? [];
  const unmatched = analysis?.unmatched ?? [];

  const preselectedIds = useMemo(
    () => new Set(matched.filter(item => item.isAutoSelected).map(item => item.ingredientId)),
    [matched],
  );

  async function openCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Kamera izni gerekli. Ayarlardan izin verip tekrar deneyin.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      await submitImage(result.assets[0].base64, result.assets[0].mimeType ?? 'image/jpeg');
    }
  }

  async function openGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Galeri izni gerekli. Ayarlardan izin verip tekrar deneyin.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      await submitImage(result.assets[0].base64, result.assets[0].mimeType ?? 'image/jpeg');
    }
  }

  async function submitImage(base64Image: string, mediaType: string) {
    setStartedAt(Date.now());
    setPhase('analyzing');
    setError(null);

    try {
      const response = await analyzeIngredientImage(base64Image, mediaType);
      setAnalysis(response);
      setSelectedIds(new Set(response.matched.filter(item => item.isAutoSelected).map(item => item.ingredientId)));
      setPhase('results');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ??
          'Görüntü analizi tamamlanamadı. Lütfen farklı bir fotoğraf deneyin.',
      );
      setPhase('picker');
    }
  }

  function toggleSelection(item: DetectedIngredient) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(item.ingredientId)) {
        next.delete(item.ingredientId);
      } else {
        next.add(item.ingredientId);
      }

      return next;
    });
  }

  function handleSearchFallback(term: string) {
    route.params.onUseSearchTerm?.(term);
    navigation.goBack();
  }

  function handleConfirm() {
    const selected = matched.filter(item => selectedIds.has(item.ingredientId));
    const ingredients = selected.map<Ingredient>(item => ({
      id: item.ingredientId,
      canonicalName: item.canonicalName,
    }));

    if (analysis?.sessionId) {
      void confirmDetection(
        analysis.sessionId,
        selected.map(i => i.ingredientId),
      ).catch(() => undefined);
    }

    void logIngredientAcquisition({
      sessionId: analysis?.sessionId,
      source: 'Vision',
      rawInput: 'image-upload',
      selectedIngredients: selected.map(item => ({
        ingredientId: item.ingredientId,
        mappingType: item.mappingType,
        confidence: item.confidence,
      })),
      mappingType: selected[0]?.mappingType ?? 'Unresolved',
      requiredConfirmation: selected.some(item => item.requiresConfirmation),
      confirmedByUser: true,
      interactionCount: Math.max(1, selected.length),
      latencyMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
      startedAtUtc: startedAt ? new Date(startedAt).toISOString() : undefined,
      completedAtUtc: new Date().toISOString(),
    }).catch(() => undefined);

    route.params.onConfirm(ingredients);
    navigation.goBack();
  }

  const featureStatus: VisionFeatureStatus = analysis?.featureStatus ?? 'active';
  const autoCount = matched.filter(i => i.isAutoSelected).length;
  const reviewCount = matched.filter(i => !i.isAutoSelected).length;
  const unmatchedCount = unmatched.length;
  const selectedCount = matched.filter(item => selectedIds.has(item.ingredientId)).length;

  const isFeatureUnavailable =
    analysis !== null && featureStatus !== 'active';

  const isEmpty =
    analysis !== null &&
    featureStatus === 'active' &&
    analysis.totalDetected === 0 &&
    matched.length === 0 &&
    unmatched.length === 0;

  function handleAddSafeOnly() {
    const autoItems = matched.filter(i => i.isAutoSelected);
    setSelectedIds(new Set(autoItems.map(i => i.ingredientId)));
    const ingredients = autoItems.map<Ingredient>(item => ({
      id: item.ingredientId,
      canonicalName: item.canonicalName,
    }));

    if (analysis?.sessionId) {
      void confirmDetection(
        analysis.sessionId,
        autoItems.map(i => i.ingredientId),
      ).catch(() => undefined);
    }

    void logIngredientAcquisition({
      sessionId: analysis?.sessionId,
      source: 'Vision',
      rawInput: 'image-upload',
      selectedIngredients: autoItems.map(item => ({
        ingredientId: item.ingredientId,
        mappingType: item.mappingType,
        confidence: item.confidence,
      })),
      mappingType: autoItems[0]?.mappingType ?? 'Unresolved',
      requiredConfirmation: false,
      confirmedByUser: true,
      interactionCount: Math.max(1, autoItems.length),
      latencyMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
      startedAtUtc: startedAt ? new Date(startedAt).toISOString() : undefined,
      completedAtUtc: new Date().toISOString(),
    }).catch(() => undefined);
    route.params.onConfirm(ingredients);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.headerIcon} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="chevron-down" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Fotoğrafla Tara</Text>
        <View style={s.headerIcon} />
      </View>

      {phase === 'picker' && (
        <View style={s.centered}>
          <View style={[s.heroIcon, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Ionicons name="camera-outline" size={34} color={theme.primary} />
          </View>
          <Text style={[s.title, { color: theme.text }]}>Fotoğrafla Malzeme Tara</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>
            Faz 1: 30 temel malzeme için görsel algılama. Yüksek güvenli eşleşmeler otomatik seçilir, belirsizler onayını bekler.
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

      {phase === 'analyzing' && (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[s.title, { color: theme.text, marginTop: spacing.lg }]}>Görsel analiz ediliyor</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>
          Kanonik malzeme hattına uygun adaylar hazırlanıyor.
          </Text>
        </View>
      )}

      {phase === 'results' && (
        <>
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            {isFeatureUnavailable ? (
              <View style={[s.emptyState, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Ionicons name="cloud-offline-outline" size={48} color={theme.textMuted} />
                <Text style={[s.emptyTitle, { color: theme.text }]}>
                  {featureStatus === 'disabled'
                    ? 'Görsel tanıma devre dışı'
                    : 'API anahtarı eksik'}
                </Text>
                <Text style={[s.emptyText, { color: theme.textMuted }]}>
                  {featureStatus === 'disabled'
                    ? 'Sunucu yapılandırmasında VisionIngredient:Enabled = false. Yöneticiye bildirin.'
                    : 'OPENAI_API_KEY ortam değişkeni ayarlanmamış. Sunucu yapılandırmasını kontrol edin.'}
                </Text>
                <TouchableOpacity
                  style={[s.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surface, marginTop: spacing.sm }]}
                  onPress={() => { setAnalysis(null); setSelectedIds(new Set()); setPhase('picker'); }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-back-outline" size={18} color={theme.text} />
                  <Text style={[s.secondaryButtonText, { color: theme.text }]}>Geri dön</Text>
                </TouchableOpacity>
              </View>
            ) : isEmpty ? (
              <View style={[s.emptyState, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Ionicons name="search-circle-outline" size={48} color={theme.textMuted} />
                <Text style={[s.emptyTitle, { color: theme.text }]}>Malzeme tespit edilemedi</Text>
                <Text style={[s.emptyText, { color: theme.textMuted }]}>
                  Fotoğrafta Faz 1 malzemesi bulunamadı. Daha net veya farklı bir açıdan çekilmiş fotoğraf deneyin.
                </Text>
                <TouchableOpacity
                  style={[s.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surface, marginTop: spacing.sm }]}
                  onPress={() => { setAnalysis(null); setSelectedIds(new Set()); setPhase('picker'); }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera-outline" size={18} color={theme.text} />
                  <Text style={[s.secondaryButtonText, { color: theme.text }]}>Tekrar dene</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
            <View style={[s.summaryCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.summaryTitle, { color: theme.text }]}>
                {analysis?.totalDetected ?? 0} aday tespit edildi
              </Text>
              <View style={s.summaryStats}>
                {autoCount > 0 && (
                  <View style={[s.statChip, { backgroundColor: `${theme.emerald}18` }]}>
                    <Ionicons name="checkmark-circle" size={13} color={theme.emerald} />
                    <Text style={[s.statTxt, { color: theme.emerald }]}>{autoCount} otomatik</Text>
                  </View>
                )}
                {reviewCount > 0 && (
                  <View style={[s.statChip, { backgroundColor: `${theme.warning ?? '#F59E0B'}18` }]}>
                    <Ionicons name="alert-circle" size={13} color={theme.warning ?? '#F59E0B'} />
                    <Text style={[s.statTxt, { color: theme.warning ?? '#F59E0B' }]}>{reviewCount} onay bekliyor</Text>
                  </View>
                )}
                {unmatchedCount > 0 && (
                  <View style={[s.statChip, { backgroundColor: `${theme.error}15` }]}>
                    <Ionicons name="help-circle" size={13} color={theme.error} />
                    <Text style={[s.statTxt, { color: theme.error }]}>{unmatchedCount} tanınamadı</Text>
                  </View>
                )}
              </View>
            </View>

            {matched.length > 0 && (
              <>
                {/* Auto-selected items */}
                {matched.some(i => i.isAutoSelected) && (
                  <>
                    <View style={s.sectionRow}>
                      <Text style={[s.sectionLabel, { color: theme.textMuted }]}>Otomatik seçildi</Text>
                      <View style={[s.badge, { backgroundColor: `${theme.emerald}20` }]}>
                        <Ionicons name="checkmark-circle" size={12} color={theme.emerald} />
                        <Text style={[s.badgeTxt, { color: theme.emerald }]}>Yüksek güven</Text>
                      </View>
                    </View>
                    {matched.filter(i => i.isAutoSelected).map(item => {
                      const selected = selectedIds.has(item.ingredientId);
                      return (
                        <TouchableOpacity
                          key={item.ingredientId}
                          style={[
                            s.itemCard,
                            {
                              backgroundColor: selected ? `${theme.emerald}10` : theme.surface,
                              borderColor: selected ? `${theme.emerald}40` : theme.border,
                            },
                          ]}
                          onPress={() => toggleSelection(item)}
                          activeOpacity={0.82}
                        >
                          <View style={s.itemMain}>
                            <Text style={[s.itemTitle, { color: theme.text }]}>{item.canonicalName}</Text>
                            <Text style={[s.itemMeta, { color: theme.textMuted }]}>
                              %{Math.round(item.confidence * 100)} â€¢ {item.matchedBy ?? item.mappingType}
                            </Text>
                            {item.detectedName !== item.canonicalName && (
                              <Text style={[s.itemRaw, { color: theme.textMuted }]}>"{item.detectedName}"</Text>
                            )}
                          </View>
                          <View
                            style={[
                              s.checkbox,
                              {
                                borderColor: selected ? theme.emerald : theme.border,
                                backgroundColor: selected ? theme.emerald : 'transparent',
                              },
                            ]}
                          >
                            {selected && <Ionicons name="checkmark" size={14} color={theme.bg} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {/* Review-needed items */}
                {matched.some(i => !i.isAutoSelected) && (
                  <>
                    <View style={s.sectionRow}>
                      <Text style={[s.sectionLabel, { color: theme.textMuted }]}>Onay bekliyor</Text>
                      <View style={[s.badge, { backgroundColor: `${theme.warning ?? '#F59E0B'}20` }]}>
                        <Ionicons name="alert-circle" size={12} color={theme.warning ?? '#F59E0B'} />
                        <Text style={[s.badgeTxt, { color: theme.warning ?? '#F59E0B' }]}>Gözden geçir</Text>
                      </View>
                    </View>
                    {matched.filter(i => !i.isAutoSelected).map(item => {
                      const selected = selectedIds.has(item.ingredientId);
                      return (
                        <TouchableOpacity
                          key={item.ingredientId}
                          style={[
                            s.itemCard,
                            {
                              backgroundColor: selected ? theme.surfaceElevated : theme.surface,
                              borderColor: selected ? theme.primary : theme.border,
                            },
                          ]}
                          onPress={() => toggleSelection(item)}
                          activeOpacity={0.82}
                        >
                          <View style={s.itemMain}>
                            <Text style={[s.itemTitle, { color: theme.text }]}>{item.canonicalName}</Text>
                            <Text style={[s.itemMeta, { color: theme.textMuted }]}>
                              %{Math.round(item.confidence * 100)} â€¢ {item.matchedBy ?? item.mappingType} â€¢ onay gerekli
                            </Text>
                            {item.detectedName !== item.canonicalName && (
                              <Text style={[s.itemRaw, { color: theme.textMuted }]}>"{item.detectedName}"</Text>
                            )}
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
                    })}
                  </>
                )}
              </>
            )}

            {unmatched.length > 0 && (
              <>
                <View style={s.sectionRow}>
                  <Text style={[s.sectionLabel, { color: theme.textMuted }]}>Tanınamadı</Text>
                  <View style={[s.badge, { backgroundColor: `${theme.error}15` }]}>
                    <Ionicons name="help-circle" size={12} color={theme.error} />
                    <Text style={[s.badgeTxt, { color: theme.error }]}>Çözümsüz</Text>
                  </View>
                </View>
                {unmatched.map(name => (
                  <View
                    key={name}
                    style={[s.unmatchedCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <View style={s.itemMain}>
                      <Text style={[s.itemTitle, { color: theme.text }]}>{name}</Text>
                      <Text style={[s.itemMeta, { color: theme.textMuted }]}>
                        GPT tarafından algılandı, veritabanında eşleştirilemedi. Elle ara.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[s.inlineButton, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                      onPress={() => handleSearchFallback(name)}
                      activeOpacity={0.82}
                    >
                      <Ionicons name="search-outline" size={16} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
              </>
            )}
          </ScrollView>

          {!isEmpty && !isFeatureUnavailable && (
          <View style={[s.footer, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
            <TouchableOpacity
              style={[
                s.primaryButton,
                {
                  backgroundColor: selectedCount > 0 ? theme.primary : theme.surfaceElevated,
                },
              ]}
              disabled={selectedCount === 0}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={selectedCount > 0 ? theme.bg : theme.textMuted}
              />
              <Text
                style={[
                  s.primaryButtonText,
                  { color: selectedCount > 0 ? theme.bg : theme.textMuted },
                ]}
              >
                {selectedCount > 0 ? `${selectedCount} malzeme ekle` : 'Malzeme seç'}
              </Text>
            </TouchableOpacity>

            {autoCount > 0 && reviewCount > 0 && (
              <TouchableOpacity
                style={[s.safeButton, { borderColor: theme.emerald, backgroundColor: `${theme.emerald}12` }]}
                onPress={handleAddSafeOnly}
                activeOpacity={0.85}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color={theme.emerald} />
                <Text style={[s.safeButtonText, { color: theme.emerald }]}>
                  Sadece güvenli ekle ({autoCount})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[s.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
              onPress={() => {
                setAnalysis(null);
                setSelectedIds(preselectedIds);
                setPhase('picker');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-outline" size={18} color={theme.text} />
              <Text style={[s.secondaryButtonText, { color: theme.text }]}>Yeni fotoğraf</Text>
            </TouchableOpacity>
          </View>
          )}
        </>
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
  heroIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '700' },
  scrollContent: {
    padding: spacing.base,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryTitle: { fontSize: 16, fontWeight: '800' },
  summaryText: { fontSize: 13, lineHeight: 18 },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statTxt: { fontSize: 12, fontWeight: '700' },
  emptyState: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  safeButton: {
    minHeight: 48,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  safeButtonText: { fontSize: 14, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  itemCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  unmatchedCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemMain: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 15, fontWeight: '800' },
  itemMeta: { fontSize: 12.5, lineHeight: 18 },
  itemRaw: { fontSize: 12.5, fontStyle: 'italic' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
  },
});

