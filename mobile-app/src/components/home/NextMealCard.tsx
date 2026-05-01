import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AppCard from '../ui/AppCard';
import { radii, spacing, type Theme } from '../../theme/tokens';

interface NextMeal {
  time?: string;
  title?: string;
  note?: string;
}

interface Props {
  nextMeal?: NextMeal;
  theme: Theme;
  onPress?: () => void;
}

function getMealEmoji(title?: string): string {
  if (!title) return 'ğŸ½ï¸';
  const lower = title.toLowerCase();
  if (lower.includes('kahvaltı')) return 'ğŸŒ…';
  if (lower.includes('öğle') || lower.includes('öğün')) return 'â˜€ï¸';
  if (lower.includes('akşam')) return 'ğŸŒ™';
  if (lower.includes('ara') || lower.includes('atıştırma')) return 'ğŸ¥œ';
  return 'ğŸ½ï¸';
}

export default function NextMealCard({ nextMeal, theme, onPress }: Props) {
  return (
    <AppCard style={s.card}>
      <View style={[s.accent, { backgroundColor: theme.primary }]} />
      <View style={s.content}>
        <View style={s.left}>
          <Text style={s.emoji}>{getMealEmoji(nextMeal?.title)}</Text>
          <View>
            <Text style={[s.label, { color: theme.textMuted }]}>Sonraki Öğün</Text>
            {nextMeal ? (
              <>
                <Text style={[s.mealTitle, { color: theme.text }]} numberOfLines={1}>
                  {nextMeal.title ?? 'Öğün planlandı'}
                </Text>
                {nextMeal.time && (
                  <Text style={[s.time, { color: theme.primary }]}>{nextMeal.time}</Text>
                )}
              </>
            ) : (
              <Text style={[s.mealTitle, { color: theme.textMuted }]}>Öğün yok</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[s.detailBtn, { backgroundColor: theme.primaryLight }]}
          onPress={onPress}
          activeOpacity={0.7}
        >
        <Text style={[s.detailBtnTxt, { color: theme.primary }]}>Detay →</Text>
        </TouchableOpacity>
      </View>
    </AppCard>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    padding: 0,
    marginBottom: spacing.md,
  },
  accent: {
    width: 4,
    margin: spacing.md,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  emoji: { fontSize: 28 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 },
  mealTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  time: { fontSize: 12, fontWeight: '700' },
  detailBtn: {
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailBtnTxt: { fontSize: 12, fontWeight: '800' },
});

