/**
 * AURA CLINICAL OS â€” Free Hero
 * Kept for fallback use; main dashboard uses inline HeroCapsule
 */
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, type Theme } from '../../theme/tokens';
import { useScaleSettle } from '../../hooks/useAuraMotion';

interface Props {
  theme: Theme;
  onKitchenPress: () => void;
  onActivatePress: () => void;
}

export default function FreeHero({ theme, onKitchenPress, onActivatePress }: Props) {
  const cardStyle = useScaleSettle(0, 0.95);

  return (
    <Animated.View style={[cardStyle]}>
      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Ambient glow */}
        <View style={[s.glow, { backgroundColor: theme.primaryGlow }]} pointerEvents="none" />

        {/* Icon orb */}
        <View style={[s.orb, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
          <Ionicons name="restaurant" size={28} color={theme.primary} />
        </View>

        <Text style={[s.title, { color: theme.text }]}>Mutfağında neler var?</Text>
        <Text style={[s.desc, { color: theme.textSub }]}>
          Elindeki malzemeleri gir, sana uygun tarifleri birlikte bulalım.
        </Text>

        <TouchableOpacity
          style={[s.kitchenBtn, { backgroundColor: theme.primary, shadowColor: theme.primaryGlow }]}
          onPress={onKitchenPress}
          activeOpacity={0.85}
        >
          <Ionicons name="flash" size={15} color="#fff" />
          <Text style={s.kitchenBtnTxt}>Mutfağa Git</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.activateLink} onPress={onActivatePress} activeOpacity={0.7}>
          <View style={[s.activateChip, { borderColor: theme.borderEmerald, backgroundColor: theme.glassEmerald }]}>
            <Ionicons name="key-outline" size={12} color={theme.primary} />
            <Text style={[s.activateTxt, { color: theme.primary }]}>
              Diyetisyen kodun var mı? Premium'a geç
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius:  radii.xxl,
    padding:       22,
    marginBottom:  spacing.md,
    overflow:      'hidden',
    borderWidth:   1,
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius:  18,
    elevation:     8,
  },
  glow: {
    position:     'absolute',
    top:          -40,
    right:        -40,
    width:        140,
    height:       140,
    borderRadius: 70,
    opacity:      0.15,
  },

  orb: {
    width:          56,
    height:         56,
    borderRadius:   28,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    marginBottom:   16,
  },

  title: {
    fontSize:      22,
    fontWeight:    '900',
    letterSpacing: -0.5,
    marginBottom:  8,
  },
  desc: {
    fontSize:      13,
    fontWeight:    '500',
    lineHeight:    20,
    marginBottom:  20,
  },

  kitchenBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    borderRadius:   radii.full,
    paddingVertical: 14,
    marginBottom:   14,
    shadowOffset:   { width: 0, height: 6 },
    shadowOpacity:  0.30,
    shadowRadius:   12,
    elevation:      6,
  },
  kitchenBtnTxt: {
    color: '#FFF', fontSize: 14, fontWeight: '900',
  },

  activateLink: { alignItems: 'center' },
  activateChip: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    paddingHorizontal: 14,
    paddingVertical:  8,
    borderRadius:     radii.full,
    borderWidth:      1,
  },
  activateTxt: { fontSize: 12, fontWeight: '700' },
});

