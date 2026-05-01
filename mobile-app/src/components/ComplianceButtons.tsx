import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';

interface ComplianceButtonsProps {
  mealId: string;
  onMark: (status: 'done' | 'alternative' | 'skipped') => void;
  currentStatus?: 'done' | 'alternative' | 'skipped';
  disabled?: boolean;
}

export default function ComplianceButtons({ mealId, onMark, currentStatus, disabled = false }: ComplianceButtonsProps) {
  const { theme } = useTheme();

  const BTNS = [
  { status: 'done'        as const, emoji: '✓', label: 'Yaptım',      bg: theme.success + '18',  active: theme.success },
    { status: 'alternative' as const, emoji: 'ğŸ”', label: 'Alternatif',  bg: theme.warning + '18',  active: theme.warning },
    { status: 'skipped'     as const, emoji: 'â­ï¸', label: 'Yapamadım',   bg: theme.border,           active: theme.textMuted },
  ];

  return (
    <View style={[s.container, { borderTopColor: theme.borderLight }]}>
      <Text style={[s.title, { color: theme.textSub }]}>Bu öğünü tamamladın mı?</Text>
      <View style={s.buttonsRow}>
        {BTNS.map(({ status, emoji, label, bg, active }) => (
          <TouchableOpacity
            key={status}
            style={[
              s.button,
              { backgroundColor: bg },
              currentStatus === status && { borderColor: active, borderWidth: 2 },
              disabled && s.disabledButton,
            ]}
            onPress={() => onMark(status)}
            disabled={disabled}
          >
            <Text style={s.buttonEmoji}>{emoji}</Text>
            <Text style={[s.buttonText, { color: theme.text }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1 },
  title: { fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  buttonsRow: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1, padding: spacing.sm, borderRadius: radii.md, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  disabledButton: { opacity: 0.5 },
  buttonEmoji: { fontSize: 20, marginBottom: 4 },
  buttonText: { fontSize: 12, fontWeight: '600' },
});

