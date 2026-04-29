import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AlternativeRecipe } from '../types/alternative';
import { radii, spacing } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';

interface DecisionCardProps {
  canCookOriginal: boolean;
  explanation: string;
  alternativeRecipe?: AlternativeRecipe;
  originalRecipeName: string;
}

export default function DecisionCard({ canCookOriginal, explanation, alternativeRecipe, originalRecipeName }: DecisionCardProps) {
  const { theme } = useTheme();

  if (canCookOriginal) {
    return (
      <View style={[s.card, { backgroundColor: theme.success + '18', borderColor: theme.success + '50' }]}>
        <Text style={s.emoji}>ğŸ‰</Text>
        <Text style={[s.title, { color: theme.text }]}>Harika!</Text>
        <Text style={[s.message, { color: theme.textSub }]}>{explanation}</Text>
        <Text style={[s.recipeName, { color: theme.primary }]}>{originalRecipeName}</Text>
        <Text style={[s.subtitle, { color: theme.textMuted }]}>Bu öğünü güvenle yapabilirsin</Text>
      </View>
    );
  }

  if (alternativeRecipe) {
    return (
      <View style={[s.card, { backgroundColor: theme.warning + '15', borderColor: theme.warning + '50' }]}>
        <Text style={s.emoji}>âš ï¸</Text>
        <Text style={[s.title, { color: theme.text }]}>Dikkat!</Text>
        <Text style={[s.message, { color: theme.textSub }]}>{explanation}</Text>
        <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
        <Text style={[s.alternativeLabel, { color: theme.textMuted }]}>Bunun yerine şunu öneriyoruz:</Text>
        <Text style={[s.alternativeRecipe, { color: theme.warning }]}>{alternativeRecipe.recipeName}</Text>
        <Text style={[s.matchText, { color: theme.textMuted }]}>
          Uygunluk: %{Math.round(alternativeRecipe.matchPercentage)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: theme.error + '15', borderColor: theme.error + '50' }]}>
      <Text style={s.emoji}>ğŸ˜•</Text>
      <Text style={[s.title, { color: theme.text }]}>Üzgünüz</Text>
      <Text style={[s.message, { color: theme.textSub }]}>{explanation}</Text>
      <Text style={[s.subtitle, { color: theme.textMuted }]}>Diyetisyeninle iletişime geçmeni öneririz</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { margin: spacing.lg, padding: spacing.lg, borderRadius: radii.xl, alignItems: 'center', borderWidth: 1.5 },
  emoji: { fontSize: 48, marginBottom: spacing.md },
  title: { fontSize: 24, fontWeight: '900', marginBottom: spacing.sm },
  message: { fontSize: 14, textAlign: 'center', marginBottom: spacing.md, lineHeight: 22 },
  recipeName: { fontSize: 18, fontWeight: '900', marginBottom: spacing.sm },
  subtitle: { fontSize: 13, textAlign: 'center' },
  divider: { width: '100%', height: 1, marginVertical: spacing.md },
  alternativeLabel: { fontSize: 13, marginBottom: spacing.sm },
  alternativeRecipe: { fontSize: 18, fontWeight: '900', marginBottom: spacing.sm },
  matchText: { fontSize: 13 },
});

