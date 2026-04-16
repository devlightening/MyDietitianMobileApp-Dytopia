import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { radii, spacing, type Theme } from '../../theme/tokens';

interface Props {
  theme:             Theme;
  clinicName?:       string;
  greetingName?:     string;
  compliancePercent: number;
  todayStatus:       'on-track' | 'needs-attention' | 'off-track';
}

function getMotivation(pct: number, status: Props['todayStatus']): string {
  if (pct >= 100) return 'Harika! Bugünkü planı tamamladın.';
  if (pct >= 75)  return 'Çok iyi gidiyorsun, devam et!';
  if (pct >= 40)  return 'Planına sadık kalman önemli.';
  if (status === 'off-track') return 'Bugün planına dönebilirsin.';
  return 'Sağlıklı bir güne başla!';
}

function getBarColor(pct: number): [string, string] {
  if (pct >= 75) return ['#FAFAFA', '#E4E4E7'];
  if (pct >= 40) return ['#D4D4D8', '#A1A1AA'];
  return ['#71717A', '#52525B'];
}

export default function PremiumHero({
  theme,
  clinicName,
  greetingName,
  compliancePercent,
  todayStatus,
}: Props) {
  const barWidth  = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.96)).current;
  const cardOpac  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1, tension: 160, friction: 16, useNativeDriver: true,
      }),
      Animated.timing(cardOpac, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
      Animated.timing(barWidth, {
        toValue: Math.min(compliancePercent, 100),
        duration: 1100,
        delay: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [compliancePercent]);

  const [barFg, barBg] = getBarColor(compliancePercent);
  const motivation     = getMotivation(compliancePercent, todayStatus);

  return (
    <Animated.View
      style={[
        s.card,
        {
          borderColor:     theme.borderEmerald,
          transform:       [{ scale: cardScale }],
          opacity:         cardOpac,
          shadowColor:     theme.primaryGlow,
        },
      ]}
    >
      {/* Background gradient layers */}
      <View style={[s.bgBase, { backgroundColor: theme.surface }]} />
      <View style={s.bgGlowTop} />
      <View style={s.bgGlowBottom} />

      {/* Decorative orb top-right */}
      <View style={[s.orbLarge, { borderColor: theme.borderEmerald }]} />
      <View style={[s.orbSmall, { backgroundColor: theme.primary }]} />

      {/* Grid lines overlay */}
      <View style={s.gridLines} pointerEvents="none" />

      {/* ── Content ── */}
      <View style={s.content}>

        {/* Top row: clinic + premium badge */}
        <View style={s.topRow}>
          <View style={s.clinicRow}>
            <View style={[s.clinicDot, { backgroundColor: theme.emerald }]} />
            <Text style={[s.clinicName, { color: theme.textSub }]} numberOfLines={1}>
              {clinicName ?? 'Kliniğim'}
            </Text>
          </View>
          <View style={[s.premiumPill, { borderColor: theme.borderEmerald }]}>
            <View style={[s.premiumDot, { backgroundColor: theme.emerald }]} />
            <Text style={[s.premiumTxt, { color: theme.emerald }]}>Premium</Text>
          </View>
        </View>

        {/* Greeting */}
        <Text style={[s.greeting, { color: theme.text }]} numberOfLines={2}>
          {greetingName ? `Hoş geldin,\n${greetingName}` : 'Hoş geldin'}
        </Text>

        {/* Progress block */}
        <View style={s.progressBlock}>
          <View style={s.progressHeader}>
            <Text style={[s.progressLabel, { color: theme.textMuted }]}>
              GÜNLÜK UYUM
            </Text>
            <Text style={[s.progressPct, { color: barFg }]}>
              {compliancePercent}%
            </Text>
          </View>

          {/* Track */}
          <View style={[s.track, { backgroundColor: theme.borderLight }]}>
            <Animated.View
              style={[
                s.fill,
                {
                  backgroundColor: barFg,
                  width: barWidth.interpolate({
                    inputRange:  [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                  shadowColor: barFg,
                },
              ]}
            />
            {/* Glow end cap */}
            <Animated.View
              style={[
                s.fillGlow,
                {
                  backgroundColor: barFg,
                  left: barWidth.interpolate({
                    inputRange:  [0, 100],
                    outputRange: ['-4%', '94%'],
                  }),
                  shadowColor: barFg,
                },
              ]}
            />
          </View>

          {/* Sub-labels */}
          <View style={s.trackLabels}>
            <Text style={[s.trackLabel, { color: theme.textMuted }]}>0%</Text>
            <Text style={[s.trackLabel, { color: theme.textMuted }]}>100%</Text>
          </View>
        </View>

        {/* Motivation message */}
        <View style={[s.motivationRow, { borderTopColor: theme.borderLight }]}>
          <View style={[s.motivationDot, { backgroundColor: barFg }]} />
          <Text style={[s.motivation, { color: theme.textSub }]}>
            {motivation}
          </Text>
        </View>

      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius:  radii.xl + 4,
    marginBottom:  spacing.md,
    overflow:      'hidden',
    borderWidth:   1,
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.30,
    shadowRadius:  24,
    elevation:     14,
  },

  /* Background layers */
  bgBase: {
    ...StyleSheet.absoluteFillObject,
  },
  bgGlowTop: {
    position:        'absolute',
    top:             -60,
    right:           -60,
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: 'rgba(26,157,108,0.14)',
  },
  bgGlowBottom: {
    position:        'absolute',
    bottom:          -40,
    left:            -30,
    width:           160,
    height:          160,
    borderRadius:    80,
    backgroundColor: 'rgba(0,191,179,0.06)',
  },
  orbLarge: {
    position:     'absolute',
    top:          -24,
    right:        -24,
    width:        120,
    height:       120,
    borderRadius: 60,
    borderWidth:  1,
    opacity:      0.30,
  },
  orbSmall: {
    position:     'absolute',
    top:          18,
    right:        20,
    width:        14,
    height:       14,
    borderRadius: 7,
    opacity:      0.40,
  },
  gridLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.025,
  },

  /* Content */
  content: {
    padding: 22,
  },

  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   16,
  },
  clinicRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    flex:          1,
  },
  clinicDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  clinicName: {
    fontSize:      12,
    fontWeight:    '600',
    letterSpacing: 0.02,
    flex:          1,
  },
  premiumPill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              5,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:     20,
    borderWidth:      1,
    backgroundColor:  'rgba(26,157,108,0.10)',
  },
  premiumDot: {
    width:        5,
    height:       5,
    borderRadius: 2.5,
  },
  premiumTxt: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  greeting: {
    fontSize:      26,
    fontWeight:    '800',
    letterSpacing: -0.5,
    lineHeight:    31,
    marginBottom:  22,
  },

  /* Progress */
  progressBlock: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
    marginBottom:   10,
  },
  progressLabel: {
    fontSize:      9.5,
    fontWeight:    '700',
    letterSpacing: 0.8,
  },
  progressPct: {
    fontSize:      20,
    fontWeight:    '900',
    letterSpacing: -0.5,
  },
  track: {
    height:       6,
    borderRadius: 3,
    overflow:     'visible',
    position:     'relative',
  },
  fill: {
    height:        '100%',
    borderRadius:  3,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.70,
    shadowRadius:  6,
    elevation:     4,
  },
  fillGlow: {
    position:      'absolute',
    top:           -3,
    width:         12,
    height:        12,
    borderRadius:  6,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.80,
    shadowRadius:  8,
    elevation:     6,
  },
  trackLabels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      6,
  },
  trackLabel: {
    fontSize:  9,
    fontWeight:'600',
  },

  /* Motivation */
  motivationRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingTop:    14,
    borderTopWidth: 1,
  },
  motivationDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    flexShrink:   0,
  },
  motivation: {
    fontSize:   13,
    fontWeight: '500',
    lineHeight: 18,
    flex:       1,
  },
});

