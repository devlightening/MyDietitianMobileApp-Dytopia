import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365];

interface Props {
  streak: number | null;
  onDismiss: () => void;
}

function getMilestoneData(streak: number) {
  if (streak >= 365) return { emoji: '🏅', label: '1 yıl seri!', color: '#f59e0b', msg: 'Efsane bir bağlılık! 365 gün dur durak bilmeden.' };
  if (streak >= 180) return { emoji: '🏆', label: '6 ay seri!', color: '#8b5cf6', msg: 'İnanılmaz — tam 180 gün kesintisiz!' };
  if (streak >= 90)  return { emoji: '💎', label: '90 günlük seri', color: '#3b82f6', msg: 'Alışkanlık artık bir yaşam biçimi.' };
  if (streak >= 60)  return { emoji: '🔥', label: '60 günlük seri', color: '#ef4444', msg: '2 ay boyunca hiç durmadın. Mükemmel!' };
  if (streak >= 30)  return { emoji: '⚡', label: '30 günlük seri', color: '#f97316', msg: 'Bir ay tamamlandı. Harika gidiyorsun!' };
  if (streak >= 21)  return { emoji: '🌟', label: '21 günlük seri', color: '#eab308', msg: '3 hafta! Alışkanlığın kökleniyor.' };
  if (streak >= 14)  return { emoji: '✨', label: '2 haftalık seri', color: '#22c55e', msg: '14 gün tutturmak ciddi bir başarı.' };
  if (streak >= 7)   return { emoji: '🎯', label: '1 haftalık seri', color: '#22c55e', msg: 'İlk haftanı tamamladın. Devam et!' };
  return              { emoji: '🎉', label: `${streak} günlük seri`, color: '#22c55e', msg: 'Her gün bir adım!' };
}

export default function StreakMilestoneToast({ streak, onDismiss }: Props) {
  const { theme } = useTheme();
  const visible = streak !== null && streak > 0;

  const translateY = useRef(new Animated.Value(120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0.88)).current;
  const fireScale  = useRef(new Animated.Value(1)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireLoopRef  = useRef<Animated.CompositeAnimation | null>(null);

  function dismiss() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    fireLoopRef.current?.stop();
    Animated.parallel([
      Animated.timing(translateY, { toValue: 140, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(onDismiss);
  }

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(120);
    opacity.setValue(0);
    scale.setValue(0.88);
    fireLoopRef.current?.stop();

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Slide up with bounce
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 14, stiffness: 140, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 160, useNativeDriver: true }),
    ]).start();

    // Fire emoji pulse loop
    fireLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(fireScale, { toValue: 1.22, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(fireScale, { toValue: 1.0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    fireLoopRef.current.start();

    dismissTimer.current = setTimeout(dismiss, 3200);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      fireLoopRef.current?.stop();
    };
  }, [visible, streak]);

  if (!visible || streak === null) return null;

  const d = getMilestoneData(streak);

  return (
    <Animated.View
      style={[
        s.wrap,
        {
          backgroundColor: theme.surface,
          borderColor: `${d.color}44`,
          shadowColor: d.color,
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <Pressable style={s.inner} onPress={dismiss}>
        {/* Left glow dot */}
        <View style={[s.colorBar, { backgroundColor: d.color }]} />

        <Animated.Text style={[s.emoji, { transform: [{ scale: fireScale }] }]}>
          {d.emoji}
        </Animated.Text>

        <View style={s.textCol}>
          <Text style={[s.label, { color: d.color }]}>{d.label}</Text>
          <Text style={[s.msg, { color: theme.textSub }]} numberOfLines={2}>
            {d.msg}
          </Text>
        </View>

        <View style={[s.badge, { backgroundColor: `${d.color}18`, borderColor: `${d.color}30` }]}>
          <Text style={[s.badgeNum, { color: d.color }]}>{streak}</Text>
          <Text style={[s.badgeUnit, { color: d.color }]}>gün</Text>
        </View>
      </Pressable>

      {/* Progress bar auto-dismiss indicator */}
      <View style={[s.timerTrack, { backgroundColor: `${d.color}18` }]}>
        <TimerBar color={d.color} duration={3200} visible={visible} />
      </View>
    </Animated.View>
  );
}

function TimerBar({ color, duration, visible }: { color: string; duration: number; visible: boolean }) {
  const width = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    width.setValue(1);
    Animated.timing(width, { toValue: 0, duration, easing: Easing.linear, useNativeDriver: false }).start();
  }, [visible]);
  return (
    <Animated.View style={[s.timerFill, { backgroundColor: color, width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 14,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  colorBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  emoji: { fontSize: 32, marginLeft: 4 },
  textCol: { flex: 1 },
  label: { fontSize: 14, fontWeight: '900', letterSpacing: -0.2, marginBottom: 2 },
  msg:   { fontSize: 12.5, lineHeight: 17 },
  badge: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 6,
    alignItems: 'center',
  },
  badgeNum:  { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  badgeUnit: { fontSize: 10, fontWeight: '800', marginTop: -2 },
  timerTrack: { height: 3 },
  timerFill:  { height: '100%' },
});

