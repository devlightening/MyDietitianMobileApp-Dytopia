import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const PARTICLE_COUNT = 22;
const COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316', '#ec4899'];
const SHAPES = ['●', '■', '▲', '◆'];

export interface ConfettiRef {
  trigger: () => void;
}

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  rot: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
  shape: string;
  size: number;
}

const ConfettiOverlay = forwardRef<ConfettiRef>((_, ref) => {
  const particles = useRef<Particle[]>(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: new Animated.Value(W / 2),
      y: new Animated.Value(H * 0.45),
      rot: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      color: COLORS[i % COLORS.length],
      shape: SHAPES[i % SHAPES.length],
      size: 8 + Math.random() * 8,
    }))
  ).current;

  useImperativeHandle(ref, () => ({
    trigger() {
      const anims = particles.map((p) => {
        const angle = (Math.random() * Math.PI * 2);
        const dist = 80 + Math.random() * 220;
        const targetX = W / 2 + Math.cos(angle) * dist;
        const targetY = H * 0.45 + Math.sin(angle) * dist - 60;
        const duration = 700 + Math.random() * 600;

        p.x.setValue(W / 2);
        p.y.setValue(H * 0.45);
        p.rot.setValue(0);
        p.opacity.setValue(0);
        p.scale.setValue(0);

        return Animated.parallel([
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0, duration: 400, delay: duration - 400, useNativeDriver: true }),
          ]),
          Animated.spring(p.scale, { toValue: 1, damping: 8, stiffness: 200, useNativeDriver: true }),
          Animated.timing(p.x, { toValue: targetX, duration, useNativeDriver: true }),
          Animated.timing(p.y, {
            toValue: targetY + 80,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.rot, { toValue: 360 * (Math.random() > 0.5 ? 1 : -1) * 2, duration, useNativeDriver: true }),
        ]);
      });

      Animated.stagger(18, anims).start();
    },
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const rotInterp = p.rot.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });
        return (
          <Animated.Text
            key={i}
            style={[
              styles.particle,
              {
                color: p.color,
                fontSize: p.size,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { rotate: rotInterp },
                  { scale: p.scale },
                ],
                opacity: p.opacity,
              },
            ]}
          >
            {p.shape}
          </Animated.Text>
        );
      })}
    </View>
  );
});

ConfettiOverlay.displayName = 'ConfettiOverlay';
export default ConfettiOverlay;

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontWeight: '900',
  },
});
