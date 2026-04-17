import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { spacing, radii } from '../theme/tokens';
import apiClient from '../api/client';
import type { TodayPlan, MealItem } from '../data/plansRepo';

interface WeekPlan extends TodayPlan {
  date: string;
}

interface WeekData {
  plans: WeekPlan[];
}

const DAY_LABELS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMondayOfWeek(): Date {
  const d = new Date();
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function calcCompliance(plan: WeekPlan): { done: number; total: number; pct: number } {
  const total = plan.items.length;
  const done = plan.items.filter(i => i.completionStatus === 'Done').length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function calcTotalMacros(plans: WeekPlan[]) {
  let cal = 0, protein = 0, carbs = 0, fat = 0, count = 0;
  plans.forEach(p => {
    p.items.forEach((item: MealItem) => {
      if (item.completionStatus !== 'Done') return;
      cal += item.calories ?? 0;
      protein += item.macros?.proteinGrams ?? 0;
      carbs += item.macros?.carbsGrams ?? 0;
      fat += item.macros?.fatGrams ?? 0;
      if (item.calories) count++;
    });
  });
  return { cal: Math.round(cal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), trackedMeals: count };
}

export default function WeeklySummaryScreen() {
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const lang = language as 'tr' | 'en';

  const [data, setData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const copy = lang === 'tr' ? {
    title: 'Haftalık Özet',
    compliance: 'Uyum',
    meals: 'Öğün',
    done: 'Tamamlandı',
    skipped: 'Atlandı',
    noData: 'Bu hafta için plan bulunamadı.',
    macros: 'Haftalık Tüketim',
    calories: 'kcal',
    protein: 'Protein',
    carbs: 'Karbonhidrat',
    fat: 'Yağ',
    trackedMeals: 'takipli öğün',
  } : {
    title: 'Weekly Summary',
    compliance: 'Compliance',
    meals: 'Meals',
    done: 'Done',
    skipped: 'Skipped',
    noData: 'No plan found for this week.',
    macros: 'Weekly Intake',
    calories: 'kcal',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    trackedMeals: 'tracked meals',
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get<WeekData>('/api/client/plans/week');
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const monday = getMondayOfWeek();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return isoDate(d);
  });

  const todayIso = isoDate(new Date());
  const dayLabels = lang === 'tr' ? DAY_LABELS_TR : DAY_LABELS_EN;

  const planByDate = new Map<string, WeekPlan>((data?.plans ?? []).map(p => [p.date.slice(0, 10), p]));

  // Overall week compliance
  const allPlans = data?.plans ?? [];
  const weekDone = allPlans.reduce((s, p) => s + p.items.filter(i => i.completionStatus === 'Done').length, 0);
  const weekTotal = allPlans.reduce((s, p) => s + p.items.length, 0);
  const weekPct = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

  const macros = calcTotalMacros(allPlans);

  const barMax = Math.max(
    ...weekDays.map(d => planByDate.get(d)?.items.length ?? 0), 1
  );

  function barColor(pct: number) {
    if (pct >= 80) return theme.emerald;
    if (pct >= 50) return theme.accentGold;
    return theme.error;
  }

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
          <Text style={[s.title, { color: theme.text }]}>{copy.title}</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={theme.primary} size="large" /></View>
        ) : (
          <>
            {/* Week compliance summary card */}
            <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.sectionLabel, { color: theme.textMuted }]}>{copy.compliance}</Text>
              <Text style={[s.bigPct, { color: weekPct >= 70 ? theme.emerald : theme.accentGold }]}>
                {weekPct}%
              </Text>
              <Text style={[s.subLabel, { color: theme.textMuted }]}>
                {weekDone}/{weekTotal} {copy.done.toLowerCase()}
              </Text>
              {/* Progress bar */}
              <View style={[s.bar, { backgroundColor: theme.border }]}>
                <View style={[s.barFill, { width: `${weekPct}%` as any, backgroundColor: barColor(weekPct) }]} />
              </View>
            </View>

            {/* Day-by-day bar chart */}
            <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.sectionLabel, { color: theme.textMuted }]}>
                {lang === 'tr' ? 'Günlük Öğün Uyumu' : 'Daily Meal Compliance'}
              </Text>
              <View style={s.chartRow}>
                {weekDays.map((date, idx) => {
                  const plan = planByDate.get(date);
                  const isToday = date === todayIso;
                  const comp = plan ? calcCompliance(plan) : { done: 0, total: 0, pct: 0 };
                  const barH = plan ? Math.max((comp.done / barMax) * 100, comp.done > 0 ? 6 : 2) : 2;
                  const totalH = plan ? Math.max((comp.total / barMax) * 100, 4) : 4;

                  return (
                    <View key={date} style={s.dayCol}>
                      <View style={[s.barTrack, { height: 100 }]}>
                        {/* Total (ghost) */}
                        {plan && (
                          <View style={[
                            s.barSegTotal,
                            { height: totalH, backgroundColor: theme.border },
                          ]} />
                        )}
                        {/* Done */}
                        {comp.done > 0 && (
                          <View style={[
                            s.barSegDone,
                            { height: barH, backgroundColor: barColor(comp.pct) },
                          ]} />
                        )}
                        {!plan && (
                          <View style={[s.barSegTotal, { height: 3, backgroundColor: `${theme.border}60` }]} />
                        )}
                      </View>
                      <Text style={[s.dayLabel, { color: isToday ? theme.primary : theme.textMuted, fontWeight: isToday ? '800' : '600' }]}>
                        {dayLabels[idx]}
                      </Text>
                      {plan && (
                        <Text style={[s.dayPct, { color: barColor(comp.pct) }]}>{comp.pct}%</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Macros card */}
            {macros.trackedMeals > 0 && (
              <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.sectionLabel, { color: theme.textMuted }]}>{copy.macros}</Text>
                <Text style={[s.macroCalories, { color: theme.text }]}>
                  {macros.cal.toLocaleString()} <Text style={{ color: theme.textMuted, fontSize: 14 }}>{copy.calories}</Text>
                </Text>
                <Text style={[s.subLabel, { color: theme.textMuted, marginBottom: spacing.sm }]}>
                  {macros.trackedMeals} {copy.trackedMeals}
                </Text>
                <View style={s.macroRow}>
                  {[
                    { label: copy.protein, val: macros.protein, color: theme.primary },
                    { label: copy.carbs, val: macros.carbs, color: theme.accentGold },
                    { label: copy.fat, val: macros.fat, color: theme.accentCyan ?? theme.textMuted },
                  ].map(m => (
                    <View key={m.label} style={[s.macroCell, { backgroundColor: `${m.color}12`, borderColor: `${m.color}28` }]}>
                      <Text style={[s.macroVal, { color: m.color }]}>{m.val}g</Text>
                      <Text style={[s.macroLbl, { color: theme.textMuted }]}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Day list */}
            {weekDays.map((date, idx) => {
              const plan = planByDate.get(date);
              if (!plan) return null;
              const comp = calcCompliance(plan);
              const isToday = date === todayIso;
              return (
                <View key={date} style={[s.dayCard, { backgroundColor: theme.surface, borderColor: isToday ? `${theme.primary}40` : theme.border }]}>
                  <View style={s.dayCardHeader}>
                    <Text style={[s.dayCardDate, { color: isToday ? theme.primary : theme.text }]}>
                      {dayLabels[idx]} {date.slice(8, 10)}/{date.slice(5, 7)}
                    </Text>
                    <View style={[s.compBadge, { backgroundColor: `${barColor(comp.pct)}18`, borderColor: `${barColor(comp.pct)}30` }]}>
                      <Text style={[s.compBadgeTxt, { color: barColor(comp.pct) }]}>
                        {comp.done}/{comp.total}
                      </Text>
                    </View>
                  </View>
                  {plan.items.map(item => (
                    <View key={item.id} style={s.mealRow}>
                      <Ionicons
                        name={
                          item.completionStatus === 'Done' ? 'checkmark-circle' :
                          item.completionStatus === 'Skipped' ? 'remove-circle' : 'ellipse-outline'
                        }
                        size={14}
                        color={
                          item.completionStatus === 'Done' ? theme.emerald :
                          item.completionStatus === 'Skipped' ? theme.textMuted : theme.border
                        }
                      />
                      <Text style={[s.mealName, { color: item.completionStatus === 'Skipped' ? theme.textMuted : theme.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.calories != null && (
                        <Text style={[s.mealCal, { color: theme.textMuted }]}>{item.calories} kcal</Text>
                      )}
                    </View>
                  ))}
                </View>
              );
            })}

            {allPlans.length === 0 && (
              <View style={[s.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="calendar-outline" size={36} color={theme.textMuted} />
                <Text style={[s.emptyTxt, { color: theme.textMuted }]}>{copy.noData}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.base, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  card: { borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.xs },
  bigPct: { fontSize: 48, fontWeight: '900', lineHeight: 56 },
  subLabel: { fontSize: 12, fontWeight: '600', marginTop: 2, marginBottom: spacing.sm },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.sm },
  dayCol: { flex: 1, alignItems: 'center' },
  barTrack: { justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  barSegTotal: { width: 10, borderRadius: 5, position: 'absolute', bottom: 0 },
  barSegDone: { width: 10, borderRadius: 5, position: 'absolute', bottom: 0 },
  dayLabel: { fontSize: 11, marginTop: 4 },
  dayPct: { fontSize: 9, fontWeight: '800', marginTop: 1 },
  macroCalories: { fontSize: 32, fontWeight: '900', lineHeight: 38 },
  macroRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  macroCell: { flex: 1, borderRadius: radii.lg, borderWidth: 1, padding: spacing.sm, alignItems: 'center' },
  macroVal: { fontSize: 16, fontWeight: '900' },
  macroLbl: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  dayCard: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.md },
  dayCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  dayCardDate: { fontSize: 14, fontWeight: '800' },
  compBadge: { borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  compBadgeTxt: { fontSize: 11, fontWeight: '800' },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  mealName: { flex: 1, fontSize: 13, fontWeight: '600' },
  mealCal: { fontSize: 11, fontWeight: '700' },
  emptyCard: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.xxl ?? 32, alignItems: 'center', gap: spacing.sm },
  emptyTxt: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
