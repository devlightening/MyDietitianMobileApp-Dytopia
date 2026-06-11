import React, { useEffect, useRef } from 'react';
import {
  Animated, Dimensions, Easing, Modal, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ConfettiOverlay, { type ConfettiRef } from './ConfettiOverlay';

const { width: W } = Dimensions.get('window');

const SEAL_SIZE  = 130;
const GLOW_SIZE  = 180;
const RING_SIZE  = 170;
const SPARK_N    = 10;

export interface BadgeInfo {
  id: string;
  title: string;
  flavor: string;
  icon: string;
  color: string;
}

interface Props {
  badge: BadgeInfo | null;
  onDismiss: () => void;
}

export default function BadgeUnlockOverlay({ badge, onDismiss }: Props) {
  const visible = badge !== null;

  // â”€â”€ Animated values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const backdrop   = useRef(new Animated.Value(0)).current;
  const sealScale  = useRef(new Animated.Value(0)).current;
  const sealTY     = useRef(new Animated.Value(-80)).current;
  const glowScale  = useRef(new Animated.Value(0.4)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const ringRot    = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const eyebrowO   = useRef(new Animated.Value(0)).current;
  const eyebrowTY  = useRef(new Animated.Value(12)).current;
  const titleO     = useRef(new Animated.Value(0)).current;
  const titleTY    = useRef(new Animated.Value(14)).current;
  const flavorO    = useRef(new Animated.Value(0)).current;
  const btnO       = useRef(new Animated.Value(0)).current;
  const btnTY      = useRef(new Animated.Value(10)).current;

  // Sparkles
  const sparks = useRef(
    Array.from({ length: SPARK_N }, (_, i) => ({
      angle: (i / SPARK_N) * Math.PI * 2,
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.4),
    }))
  ).current;

  // Glow pulse loop ref
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const ringLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const secondBurstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiRef = useRef<ConfettiRef>(null);

  function resetAll() {
    backdrop.setValue(0);
    sealScale.setValue(0); sealTY.setValue(-80);
    glowScale.setValue(0.4); glowOpacity.setValue(0);
    ringRot.setValue(0); ringOpacity.setValue(0);
    eyebrowO.setValue(0); eyebrowTY.setValue(12);
    titleO.setValue(0); titleTY.setValue(14);
    flavorO.setValue(0);
    btnO.setValue(0); btnTY.setValue(10);
    sparks.forEach(s => { s.x.setValue(0); s.y.setValue(0); s.opacity.setValue(0); s.scale.setValue(0.4); });
    glowLoopRef.current?.stop();
    ringLoopRef.current?.stop();
  }

  function fireSparkles() {
    const anims = sparks.map(s => {
      const tx = Math.cos(s.angle) * 100;
      const ty = Math.sin(s.angle) * 100;
      return Animated.parallel([
        Animated.sequence([
          Animated.timing(s.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(s.opacity, { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
        ]),
        Animated.spring(s.scale, { toValue: 1, damping: 10, stiffness: 120, useNativeDriver: true }),
        Animated.timing(s.x, { toValue: tx, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(s.y, { toValue: ty, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]);
    });
    Animated.stagger(30, anims).start();
  }

  function startGlowLoop(color: string) {
    glowLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1.18, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 0.96, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    );
    glowLoopRef.current.start();
  }

  function startRingLoop() {
    ringLoopRef.current = Animated.loop(
      Animated.timing(ringRot, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true })
    );
    ringLoopRef.current.start();
  }

  function dismiss() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    if (secondBurstTimer.current) clearTimeout(secondBurstTimer.current);
    glowLoopRef.current?.stop();
    ringLoopRef.current?.stop();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.spring(sealScale, { toValue: 0.1, damping: 14, stiffness: 160, useNativeDriver: true }),
      Animated.timing(sealTY, { toValue: -60, duration: 280, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(eyebrowO, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(titleO, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(flavorO, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(btnO, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(onDismiss);
  }

  useEffect(() => {
    if (!visible || !badge) return;
    resetAll();

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // â”€â”€ Entrance sequence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Phase 1: backdrop + glow fade in
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Phase 2: seal drops in (slight delay for dramatic effect)
    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.spring(sealScale, { toValue: 1, damping: 9, stiffness: 100, useNativeDriver: true }),
        Animated.spring(sealTY, { toValue: 0, damping: 14, stiffness: 120, useNativeDriver: true }),
      ]),
    ]).start();

    // Phase 3: ring + sparkles + confetti
    Animated.sequence([
      Animated.delay(250),
      Animated.timing(ringOpacity, { toValue: 0.9, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      startRingLoop();
      fireSparkles();
      confettiRef.current?.trigger();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      secondBurstTimer.current = setTimeout(() => {
        confettiRef.current?.trigger();
        fireSparkles();
      }, 1100);
    });

    startGlowLoop(badge.color);

    // Phase 4: text reveal (staggered)
    const textReveal = [
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(eyebrowO, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(eyebrowTY, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
      Animated.delay(60),
      Animated.parallel([
        Animated.timing(titleO, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(titleTY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(60),
      Animated.timing(flavorO, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(btnO, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(btnTY, { toValue: 0, damping: 14, stiffness: 180, useNativeDriver: true }),
      ]),
    ];
    Animated.sequence(textReveal).start();

    // Keep the reward visible long enough to read without blocking the user indefinitely.
    dismissTimer.current = setTimeout(dismiss, 6200);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      if (secondBurstTimer.current) clearTimeout(secondBurstTimer.current);
      glowLoopRef.current?.stop();
      ringLoopRef.current?.stop();
    };
  }, [visible, badge?.id]);

  if (!badge) return null;

  const ringRotDeg = ringRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const backdropRgba = backdrop.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)'] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: backdropRgba as any }]} />

        {/* Center content */}
        <View style={s.center} pointerEvents="box-none">

          {/* Glow orb */}
          <Animated.View style={[s.glow, { backgroundColor: badge.color, transform: [{ scale: glowScale }], opacity: glowOpacity }]} />

          {/* Rotating ring */}
          <Animated.View style={[s.ring, { borderColor: `${badge.color}55`, opacity: ringOpacity, transform: [{ rotate: ringRotDeg }] }]}>
            {/* Ring nodes */}
            <View style={[s.ringNode, { backgroundColor: badge.color, top: -4, left: RING_SIZE / 2 - 4 }]} />
            <View style={[s.ringNode, { backgroundColor: badge.color, bottom: -4, left: RING_SIZE / 2 - 4 }]} />
            <View style={[s.ringNode, { backgroundColor: badge.color, left: -4, top: RING_SIZE / 2 - 4 }]} />
            <View style={[s.ringNode, { backgroundColor: badge.color, right: -4, top: RING_SIZE / 2 - 4 }]} />
          </Animated.View>

          {/* Sparkles */}
          {sparks.map((sp, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                s.sparkle,
                {
                  backgroundColor: i % 2 === 0 ? badge.color : '#fff',
                  opacity: sp.opacity,
                  transform: [
                    { translateX: sp.x },
                    { translateY: sp.y },
                    { scale: sp.scale },
                  ],
                },
              ]}
            />
          ))}

          {/* Badge seal */}
          <Animated.View style={[s.sealWrap, { transform: [{ scale: sealScale }, { translateY: sealTY }] }]}>
            <View style={[s.sealOuter, { borderColor: badge.color, shadowColor: badge.color }]}>
              <View style={[s.sealInner, { backgroundColor: `${badge.color}18` }]}>
                <MaterialCommunityIcons name={badge.icon as any} size={58} color={badge.color} />
              </View>
            </View>
          </Animated.View>

          {/* Texts */}
          <Animated.Text style={[s.eyebrow, { color: badge.color, opacity: eyebrowO, transform: [{ translateY: eyebrowTY }] }]}>
            ✦  YENİ ROZET KAZANILDI  ✦
          </Animated.Text>

          <Animated.Text style={[s.badgeName, { opacity: titleO, transform: [{ translateY: titleTY }] }]}>
            {badge.title}
          </Animated.Text>

          <Animated.Text style={[s.flavor, { opacity: flavorO }]} numberOfLines={3}>
            {badge.flavor}
          </Animated.Text>

          {/* Button */}
          <Animated.View style={[s.btnWrap, { opacity: btnO, transform: [{ translateY: btnTY }] }]}>
            <Pressable style={[s.btn, { backgroundColor: badge.color }]} onPress={dismiss}>
              <Text style={s.btnTxt}>Rozeti aldım</Text>
            </Pressable>
          </Animated.View>
        </View>

        <ConfettiOverlay ref={confettiRef} />
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  glow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    opacity: 0.26,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  ringNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sparkle: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  sealWrap: {
    marginBottom: 28,
  },
  sealOuter: {
    width: SEAL_SIZE,
    height: SEAL_SIZE,
    borderRadius: SEAL_SIZE / 2,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 18,
  },
  sealInner: {
    width: SEAL_SIZE - 16,
    height: SEAL_SIZE - 16,
    borderRadius: (SEAL_SIZE - 16) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  badgeName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 10,
    lineHeight: 32,
  },
  flavor: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.64)',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: W - 80,
    marginBottom: 32,
  },
  btnWrap: { width: '100%', maxWidth: 260 },
  btn: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
  },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
});

