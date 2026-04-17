import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { spacing, radii } from '../theme/tokens';
import { getMealLogs, createMealLog, deleteMealLog, type MealLog } from '../api/meal-logs';

const MEAL_TYPES = ['Breakfast', 'MidMorning', 'Lunch', 'Afternoon', 'Dinner', 'Evening', 'Snack'] as const;

const MEAL_TYPE_LABELS: Record<string, { tr: string; en: string }> = {
  Breakfast:  { tr: 'Kahvaltı',  en: 'Breakfast'   },
  MidMorning: { tr: 'Kuşluk',    en: 'Mid-Morning'  },
  Lunch:      { tr: 'Öğle',      en: 'Lunch'        },
  Afternoon:  { tr: 'İkindi',    en: 'Afternoon'    },
  Dinner:     { tr: 'Akşam',     en: 'Dinner'       },
  Evening:    { tr: 'Gece',      en: 'Evening'      },
  Snack:      { tr: 'Atıştırma', en: 'Snack'        },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
  const [adding, setAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('Snack');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const copy = lang === 'tr' ? {
    title: 'Yemek Günlüğü',
    today: 'Bugün',
    noLogs: 'Henüz kayıt yok.',
    addLog: 'Öğün Ekle',
    cancel: 'İptal',
    save: 'Kaydet',
    notes: 'Not (isteğe bağlı)',
    mealType: 'Öğün türü',
    deleteConfirm: 'Bu kaydı silmek istiyor musun?',
    delete: 'Sil',
    deleteCancel: 'İptal',
  } : {
    title: 'Meal Journal',
    today: 'Today',
    noLogs: 'No entries yet.',
    addLog: 'Log Meal',
    cancel: 'Cancel',
    save: 'Save',
    notes: 'Note (optional)',
    mealType: 'Meal type',
    deleteConfirm: 'Delete this entry?',
    delete: 'Delete',
    deleteCancel: 'Cancel',
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getMealLogs(todayIso());
      setLogs(data);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function handleSave() {
    setSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createMealLog({ mealType: selectedType, notes: notes.trim() || null });
      setNotes('');
      setAdding(false);
      await load(true);
    } catch {
      Alert.alert(lang === 'tr' ? 'Hata' : 'Error', lang === 'tr' ? 'Kaydedilemedi.' : 'Could not save.');
    } finally { setSaving(false); }
  }

  async function handleDelete(log: MealLog) {
    Alert.alert('', copy.deleteConfirm, [
      { text: copy.deleteCancel, style: 'cancel' },
      {
        text: copy.delete, style: 'destructive', onPress: async () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await deleteMealLog(log.id).catch(() => {});
          await load(true);
        }
      }
    ]);
  }

  const todayFormatted = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => (navigation as any).goBack()}
          >
            <Ionicons name="chevron-back" size={16} color={theme.textSub} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[s.subDate, { color: theme.textMuted }]}>{todayFormatted}</Text>
            <Text style={[s.title, { color: theme.text }]}>{copy.title}</Text>
          </View>
        </View>

        {/* Add form */}
        {adding ? (
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.primary + '40' }]}>
            <Text style={[s.formLabel, { color: theme.textMuted }]}>{copy.mealType}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll}>
              <View style={s.typeRow}>
                {MEAL_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      s.typeChip,
                      { borderColor: selectedType === t ? theme.primary : theme.border },
                      selectedType === t && { backgroundColor: theme.primary + '18' },
                    ]}
                    onPress={() => setSelectedType(t)}
                  >
                    <Text style={[s.typeChipTxt, { color: selectedType === t ? theme.primary : theme.textSub }]}>
                      {MEAL_TYPE_LABELS[t]?.[lang] ?? t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[s.formLabel, { color: theme.textMuted, marginTop: spacing.sm }]}>{copy.notes}</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              placeholder={copy.notes}
              placeholderTextColor={theme.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={500}
            />

            <View style={s.formActions}>
              <TouchableOpacity
                style={[s.formBtn, { borderColor: theme.border, backgroundColor: theme.bg }]}
                onPress={() => setAdding(false)}
              >
                <Text style={[s.formBtnTxt, { color: theme.textMuted }]}>{copy.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.formBtn, { borderColor: theme.primary, backgroundColor: theme.primary }]}
                onPress={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[s.formBtnTxt, { color: '#fff' }]}>{copy.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: theme.primary + '14', borderColor: theme.primary + '40' }]}
            onPress={() => { setAdding(true); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
            <Text style={[s.addBtnTxt, { color: theme.primary }]}>{copy.addLog}</Text>
          </TouchableOpacity>
        )}

        {/* Logs list */}
        {loading ? (
          <View style={s.center}><ActivityIndicator color={theme.primary} /></View>
        ) : logs.length === 0 ? (
          <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="journal-outline" size={32} color={theme.textMuted} />
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
                <Text style={[s.logTime, { color: theme.textMuted }]}>
                  {new Date(log.createdAtUtc).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <TouchableOpacity onPress={() => void handleDelete(log)} style={s.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color={theme.error} />
                </TouchableOpacity>
              </View>
              {log.notes && (
                <Text style={[s.logNotes, { color: theme.textSub }]}>{log.notes}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.base, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  subDate: { fontSize: 11, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '900' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radii.xl, borderWidth: 1, padding: spacing.md },
  addBtnTxt: { fontSize: 15, fontWeight: '700' },
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg },
  formLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  typeScroll: { marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  typeChipTxt: { fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: radii.lg, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  formBtn: { flex: 1, borderRadius: radii.lg, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  formBtnTxt: { fontSize: 14, fontWeight: '700' },
  center: { paddingTop: 40, alignItems: 'center' },
  empty: { borderRadius: radii.xl, borderWidth: 1, padding: 32, alignItems: 'center', gap: spacing.sm },
  emptyTxt: { fontSize: 14, fontWeight: '600' },
  logCard: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.md },
  logTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeTxt: { fontSize: 11, fontWeight: '700' },
  logTime: { flex: 1, fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  logNotes: { fontSize: 13, marginTop: 8, lineHeight: 19 },
});
