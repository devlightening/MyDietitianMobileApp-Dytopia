import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { spacing, radii } from '../theme/tokens';
import {
  analyzeMealPhoto,
  createMealLog,
  deleteMealLog,
  getMealLogs,
  type MealLog,
  type MealPhotoAnalysis,
} from '../api/meal-logs';
import { compressImage } from '../utils/imageCompressor';

const MEAL_TYPES = ['Breakfast', 'MidMorning', 'Lunch', 'Afternoon', 'Dinner', 'Evening', 'Snack'] as const;

const MEAL_TYPE_LABELS: Record<string, { tr: string; en: string }> = {
  Breakfast: { tr: 'Kahvaltı', en: 'Breakfast' },
  MidMorning: { tr: 'Kuşluk', en: 'Mid-Morning' },
  Lunch: { tr: 'Öğle', en: 'Lunch' },
  Afternoon: { tr: 'İkindi', en: 'Afternoon' },
  Dinner: { tr: 'Akşam', en: 'Dinner' },
  Evening: { tr: 'Gece', en: 'Evening' },
  Snack: { tr: 'Atıştırma', en: 'Snack' },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export default function MealLogScreen() {
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const lang = language as 'tr' | 'en';

  const [logs, setLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('Snack');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<MealPhotoAnalysis | null>(null);

  const copy = lang === 'tr' ? {
    title: 'Günlük Yenilenler',
    eyebrow: 'Tabak tarama',
    subtitle: 'Fotoğrafı çek; tabağındaki yemeği 1 porsiyon kabul ederek yaklaşık besin değerlerini hazırlar.',
    today: 'Bugün',
    scanPlate: 'Tabak tara',
    gallery: 'Galeriden seç',
    cameraPermission: 'Kamera izni gerekli.',
    galleryPermission: 'Galeri izni gerekli.',
    noLogs: 'Bugün henüz yenilen kayıt yok.',
    estimateReady: 'Tahmin hazır',
    addDaily: 'Günlük Yenilenlere Ekle',
    cancel: 'İptal',
    deleteConfirm: 'Bu kaydı silmek istiyor musun?',
    delete: 'Sil',
    deleteCancel: 'Vazgeç',
    onePortion: '1 porsiyon',
    approx: 'yaklaşık',
    confidence: 'güven',
    macros: 'Makrolar',
    ingredients: 'Görünenler',
    analyzing: 'Tabağın analiz ediliyor',
    analyzingSub: 'Yaklaşık tahmin hazırlanıyor; kayıt ancak sen onaylarsan eklenir.',
    saved: 'Günlük yenilenlere eklendi.',
    error: 'Tabak şu an okunamadı. Daha net bir fotoğrafla tekrar dene.',
  } : {
    title: 'Daily Eats',
    eyebrow: 'Plate scan',
    subtitle: 'Take a photo; the plate is estimated as 1 portion and prepared with approximate nutrition values.',
    today: 'Today',
    scanPlate: 'Scan plate',
    gallery: 'Choose photo',
    cameraPermission: 'Camera permission is required.',
    galleryPermission: 'Gallery permission is required.',
    noLogs: 'No eaten entries yet today.',
    estimateReady: 'Estimate ready',
    addDaily: 'Add to Daily Eats',
    cancel: 'Cancel',
    deleteConfirm: 'Delete this entry?',
    delete: 'Delete',
    deleteCancel: 'Cancel',
    onePortion: '1 portion',
    approx: 'approx',
    confidence: 'confidence',
    macros: 'Macros',
    ingredients: 'Visible ingredients',
    analyzing: 'Analyzing your plate',
    analyzingSub: 'Preparing an approximate estimate; it is saved only after your confirmation.',
    saved: 'Added to Daily Eats.',
    error: 'Could not read the plate. Try a clearer photo.',
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getMealLogs(todayIso());
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const totals = useMemo(() => {
    return logs.reduce(
      (acc, log) => ({
        count: acc.count + 1,
        calories: acc.calories + toNumber(log.caloriesKcal),
        protein: acc.protein + toNumber(log.proteinGrams),
        carbs: acc.carbs + toNumber(log.carbsGrams),
        fat: acc.fat + toNumber(log.fatGrams),
      }),
      { count: 0, calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [logs]);

  const todayFormatted = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  async function analyzePickedUri(uri: string) {
    setAnalyzing(true);
    setAnalysis(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const compressed = await compressImage(uri, 'ingredient');
      const result = await analyzeMealPhoto({
        base64Image: compressed.base64,
        mediaType: compressed.mediaType,
        mealType: selectedType,
      });
      setAnalysis(result);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(copy.title, copy.error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAnalyzing(false);
    }
  }

  async function openCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(copy.title, copy.cameraPermission);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      base64: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await analyzePickedUri(result.assets[0].uri);
    }
  }

  async function openGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(copy.title, copy.galleryPermission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      base64: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await analyzePickedUri(result.assets[0].uri);
    }
  }

  async function confirmAnalysis() {
    if (!analysis) return;
    setSaving(true);
    try {
      await createMealLog({
        mealType: selectedType,
        notes: analysis.notes,
        foodName: analysis.foodName,
        caloriesKcal: analysis.caloriesKcal,
        proteinGrams: analysis.proteinGrams,
        carbsGrams: analysis.carbsGrams,
        fatGrams: analysis.fatGrams,
        portionCount: 1,
        aiConfidence: analysis.confidence,
        analysisJson: analysis.analysisJson,
        source: 'photo_ai',
      });
      setAnalysis(null);
      await load(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(copy.title, copy.saved);
    } catch {
      Alert.alert(copy.title, lang === 'tr' ? 'Kayıt oluşturulamadı.' : 'Could not save the entry.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(log: MealLog) {
    Alert.alert('', copy.deleteConfirm, [
      { text: copy.deleteCancel, style: 'cancel' },
      {
        text: copy.delete,
        style: 'destructive',
        onPress: async () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await deleteMealLog(log.id).catch(() => {});
          await load(true);
        },
      },
    ]);
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 36 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={theme.primary} />
        }
      >
        <View style={s.header}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => (navigation as any).goBack()}
          >
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: theme.primary }]}>{copy.eyebrow}</Text>
            <Text style={[s.title, { color: theme.text }]}>{copy.title}</Text>
          </View>
          <View style={[s.countPill, { backgroundColor: theme.primary + '14', borderColor: theme.primary + '30' }]}>
            <Text style={[s.countNum, { color: theme.primary }]}>{totals.count}</Text>
            <Text style={[s.countLabel, { color: theme.textMuted }]}>{lang === 'tr' ? 'kayıt' : 'logs'}</Text>
          </View>
        </View>

        <View style={[s.hero, { backgroundColor: theme.surface, borderColor: theme.primary + '28' }]}>
          <View style={[s.heroIcon, { backgroundColor: theme.primary + '14' }]}>
            <Ionicons name="camera-outline" size={28} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { color: theme.text }]}>{copy.scanPlate}</Text>
            <Text style={[s.heroSub, { color: theme.textSub }]}>{copy.subtitle}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeRow}>
          {MEAL_TYPES.map(type => (
            <TouchableOpacity
              key={type}
              style={[
                s.typeChip,
                { backgroundColor: theme.surface, borderColor: selectedType === type ? theme.primary : theme.border },
                selectedType === type && { backgroundColor: theme.primary + '16' },
              ]}
              onPress={() => setSelectedType(type)}
            >
              <Text style={[s.typeChipTxt, { color: selectedType === type ? theme.primary : theme.textMuted }]}>
                {MEAL_TYPE_LABELS[type]?.[lang] ?? type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.primaryAction, { backgroundColor: theme.primary }]}
            onPress={() => void openCamera()}
            disabled={analyzing}
          >
            <Ionicons name="scan-outline" size={20} color="#fff" />
            <Text style={s.primaryActionText}>{copy.scanPlate}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.secondaryAction, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => void openGallery()}
            disabled={analyzing}
          >
            <Ionicons name="images-outline" size={20} color={theme.primary} />
            <Text style={[s.secondaryActionText, { color: theme.primary }]}>{copy.gallery}</Text>
          </TouchableOpacity>
        </View>

        {analyzing && (
          <View style={[s.analyzingCard, { backgroundColor: theme.surface, borderColor: theme.primary + '25' }]}>
            <ActivityIndicator color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[s.analyzingTitle, { color: theme.text }]}>{copy.analyzing}</Text>
              <Text style={[s.analyzingSub, { color: theme.textSub }]}>{copy.analyzingSub}</Text>
            </View>
          </View>
        )}

        {analysis && (
          <View style={[s.analysisCard, { backgroundColor: theme.surface, borderColor: theme.primary + '35' }]}>
            <View style={s.analysisTop}>
              <View style={s.analysisHeading}>
                <Text style={[s.eyebrow, { color: theme.primary }]}>{copy.estimateReady}</Text>
                <Text style={[s.analysisTitle, { color: theme.text }]}>{analysis.foodName}</Text>
              </View>
              <View style={[s.portionPill, { backgroundColor: '#F5E4A4', borderColor: '#E5C44F' }]}>
                <Text style={[s.portionText, { color: '#8A6C08' }]}>{copy.onePortion}</Text>
              </View>
            </View>
            <View style={s.estimateRow}>
              <MetricPill label="kcal" value={analysis.caloriesKcal ?? 0} color={theme.primary} suffix="" />
              <MetricPill label="P" value={analysis.proteinGrams ?? 0} color="#DF6B62" suffix="g" />
              <MetricPill label="K" value={analysis.carbsGrams ?? 0} color="#4EB6C5" suffix="g" />
              <MetricPill label="Y" value={analysis.fatGrams ?? 0} color="#D5B53F" suffix="g" />
            </View>
            <Text style={[s.confidence, { color: theme.textMuted }]}>
              {Math.round(analysis.confidence * 100)}% {copy.confidence} · {copy.approx}
            </Text>
            {analysis.ingredients.length > 0 && (
              <View style={s.ingredientWrap}>
                {analysis.ingredients.map(item => (
                  <View key={item} style={[s.ingredientChip, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '22' }]}>
                    <Text style={[s.ingredientText, { color: theme.primary }]}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={[s.note, { color: theme.textSub }]}>{analysis.notes}</Text>
            <View style={s.formActions}>
              <TouchableOpacity
                style={[s.cancelBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                onPress={() => setAnalysis(null)}
              >
                <Text style={[s.cancelText, { color: theme.textMuted }]}>{copy.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: theme.primary }]}
                onPress={() => void confirmAnalysis()}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{copy.addDaily}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[s.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View>
            <Text style={[s.summaryLabel, { color: theme.textMuted }]}>{todayFormatted}</Text>
            <Text style={[s.summaryTitle, { color: theme.text }]}>{copy.today}</Text>
          </View>
          <View style={s.summaryGrid}>
            <SummaryStat label="kcal" value={Math.round(totals.calories)} color={theme.primary} />
            <SummaryStat label="P" value={Math.round(totals.protein)} color="#DF6B62" />
            <SummaryStat label="K" value={Math.round(totals.carbs)} color="#4EB6C5" />
            <SummaryStat label="Y" value={Math.round(totals.fat)} color="#D5B53F" />
          </View>
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={theme.primary} /></View>
        ) : logs.length === 0 ? (
          <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="restaurant-outline" size={34} color={theme.textMuted} />
            <Text style={[s.emptyTxt, { color: theme.textMuted }]}>{copy.noLogs}</Text>
          </View>
        ) : (
          logs.map(log => (
            <View key={log.id} style={[s.logCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={s.logTop}>
                <View style={[s.typeBadge, { backgroundColor: theme.primary + '14', borderColor: theme.primary + '28' }]}>
                  <Text style={[s.typeBadgeTxt, { color: theme.primary }]}>
                    {MEAL_TYPE_LABELS[log.mealType]?.[lang] ?? log.mealType}
                  </Text>
                </View>
                {log.source === 'photo_ai' && (
                  <View style={[s.aiBadge, { backgroundColor: '#EEF7FF', borderColor: '#B9E3FF' }]}>
                    <Ionicons name="sparkles-outline" size={12} color="#3A9CC7" />
                    <Text style={[s.aiBadgeTxt, { color: '#3A9CC7' }]}>{lang === 'tr' ? 'Fotoğraf' : 'Photo'}</Text>
                  </View>
                )}
                <Text style={[s.logTime, { color: theme.textMuted }]}>
                  {new Date(log.createdAtUtc).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <TouchableOpacity onPress={() => void handleDelete(log)} style={s.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color={theme.error} />
                </TouchableOpacity>
              </View>
              <Text style={[s.logTitle, { color: theme.text }]}>{log.foodName || log.notes || MEAL_TYPE_LABELS[log.mealType]?.[lang] || log.mealType}</Text>
              <View style={s.estimateRow}>
                <MetricPill label="kcal" value={log.caloriesKcal ?? 0} color={theme.primary} suffix="" muted={!log.caloriesKcal} />
                <MetricPill label="P" value={log.proteinGrams ?? 0} color="#DF6B62" suffix="g" muted={!log.proteinGrams} />
                <MetricPill label="K" value={log.carbsGrams ?? 0} color="#4EB6C5" suffix="g" muted={!log.carbsGrams} />
                <MetricPill label="Y" value={log.fatGrams ?? 0} color="#D5B53F" suffix="g" muted={!log.fatGrams} />
              </View>
              {log.notes && log.notes !== log.foodName && (
                <Text style={[s.logNotes, { color: theme.textSub }]}>{log.notes}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function MetricPill({ label, value, color, suffix, muted }: { label: string; value: number; color: string; suffix: string; muted?: boolean }) {
  const display = label === 'kcal' ? Math.round(value).toString() : `${Math.round(value)}${suffix}`;
  return (
    <View style={[s.metricPill, { borderColor: color + '33', backgroundColor: muted ? '#F5F8F5' : color + '12' }]}>
      <Text style={[s.metricValue, { color: muted ? '#9AA7A0' : color }]}>{display}</Text>
      <Text style={[s.metricLabel, { color: muted ? '#9AA7A0' : color }]}>{label}</Text>
    </View>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.summaryStat}>
      <Text style={[s.summaryValue, { color }]}>{value}</Text>
      <Text style={[s.summaryStatLabel, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.base, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.xs },
  backBtn: { width: 50, height: 50, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -1.1 },
  countPill: { width: 66, height: 66, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  countNum: { fontSize: 22, fontWeight: '900' },
  countLabel: { fontSize: 11, fontWeight: '800' },
  hero: { borderWidth: 1, borderRadius: 30, padding: 18, flexDirection: 'row', gap: 14, alignItems: 'center' },
  heroIcon: { width: 58, height: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '900' },
  heroSub: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginTop: 4 },
  typeRow: { gap: 8, paddingVertical: 2 },
  typeChip: { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  typeChipTxt: { fontSize: 13, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryAction: { flex: 1.15, borderRadius: 22, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryActionText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  secondaryAction: { flex: 1, borderRadius: 22, borderWidth: 1, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryActionText: { fontWeight: '900', fontSize: 15 },
  analyzingCard: { borderRadius: 26, borderWidth: 1, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  analyzingTitle: { fontSize: 18, fontWeight: '900' },
  analyzingSub: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 3 },
  analysisCard: { borderRadius: 30, borderWidth: 1, padding: 18, gap: 12 },
  analysisTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  analysisHeading: { flex: 1, minWidth: 0 },
  analysisTitle: { fontSize: 24, fontWeight: '900', flexShrink: 1 },
  portionPill: { flexShrink: 0, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  portionText: { fontSize: 12, fontWeight: '900', textAlign: 'center' },
  estimateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  metricValue: { fontSize: 14, fontWeight: '900' },
  metricLabel: { fontSize: 11, fontWeight: '900' },
  confidence: { fontSize: 12, fontWeight: '800' },
  ingredientWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ingredientChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  ingredientText: { fontSize: 12, fontWeight: '800' },
  note: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  cancelBtn: { flex: 0.75, borderRadius: 20, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '900' },
  saveBtn: { flex: 1.35, borderRadius: 20, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  summaryCard: { borderRadius: 28, borderWidth: 1, padding: 18, gap: 16 },
  summaryLabel: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  summaryTitle: { fontSize: 22, fontWeight: '900' },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryStat: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 22, fontWeight: '900' },
  summaryStatLabel: { fontSize: 11, fontWeight: '900' },
  center: { paddingTop: 30, alignItems: 'center' },
  empty: { borderRadius: 28, borderWidth: 1, padding: 34, alignItems: 'center', gap: spacing.sm },
  emptyTxt: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  logCard: { borderRadius: 28, borderWidth: 1, padding: 16, gap: 10 },
  logTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  typeBadgeTxt: { fontSize: 11, fontWeight: '900' },
  aiBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', gap: 4, alignItems: 'center' },
  aiBadgeTxt: { fontSize: 11, fontWeight: '900' },
  logTime: { flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  deleteBtn: { padding: 4 },
  logTitle: { fontSize: 20, fontWeight: '900' },
  logNotes: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
