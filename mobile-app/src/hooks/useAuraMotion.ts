/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AURA CLINICAL OS — Motion & Animation System
 *
 * Production-grade Reanimated v3 hooks with maximal spring physics,
 * and GPU-optimized transforms.
 *
 * Philosophy: Motion is communication. Every animation tells a story.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
  Extrapolation,
  cancelAnimation,
} from 'react-native-reanimated';
import { useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// ⏱️  Duration Tokens
// ═══════════════════════════════════════════════════════════════════════════════

export const dur = {
  micro:     100,
  fast:      160,
  base:      240,
  medium:    360,
  slow:      520,
  hero:      680,
  cinematic: 1000,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 🌊 Spring Physics
// ═══════════════════════════════════════════════════════════════════════════════

export const spring = {
  snappy:     { damping: 18, stiffness: 280, mass: 0.8,  overshootClamping: false },
  standard:   { damping: 22, stiffness: 180, mass: 1,    overshootClamping: false },
  playful:    { damping: 12, stiffness: 210, mass: 0.9,  overshootClamping: false },
  bouncy:     { damping: 10, stiffness: 220, mass: 0.85, overshootClamping: false },
  smooth:     { damping: 32, stiffness: 90,  mass: 1.2,  overshootClamping: false },
  gentle:     { damping: 28, stiffness: 120, mass: 1.1,  overshootClamping: false },
  precise:    { damping: 26, stiffness: 240, mass: 0.95, overshootClamping: true  },
  deliberate: { damping: 40, stiffness: 60,  mass: 1.5,  overshootClamping: false },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 Easing Functions
// ═══════════════════════════════════════════════════════════════════════════════

export const ease = {
  inQuad:      Easing.in(Easing.quad),
  inCubic:     Easing.in(Easing.cubic),
  inQuart:     Easing.in(Easing.quad),
  inExpo:      Easing.in(Easing.exp),

  outQuad:     Easing.out(Easing.quad),
  outCubic:    Easing.out(Easing.cubic),
  outExpo:     Easing.out(Easing.exp),
  outQuart:    Easing.out(Easing.quad),
  outCirc:     Easing.out(Easing.circle),
  outElastic:  Easing.out(Easing.elastic(1)),

  inOutSmooth: Easing.inOut(Easing.cubic),
  inOutQuart:  Easing.inOut(Easing.quad),

  linear:      Easing.linear,
  snap:        Easing.out(Easing.quad),
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 🪝 Core Entrance Hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function useFadeRise(delay = 0, distance = 16, duration = dur.base) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(distance);

  useEffect(() => {
    opacity.value    = withDelay(delay, withTiming(1, { duration, easing: ease.outCubic }));
    translateY.value = withDelay(delay, withSpring(0, spring.standard));
  }, [delay, distance, duration]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

export function useScaleSettle(delay = 0, fromScale = 0.92) {
  const scale   = useSharedValue(fromScale);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: dur.fast, easing: ease.outCubic }));
    scale.value   = withDelay(delay, withSpring(1, spring.snappy));
  }, [delay, fromScale]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
}

export function useBlurReveal(delay = 0, initialScale = 0.96) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(initialScale);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: dur.medium, easing: ease.outExpo }));
    scale.value   = withDelay(delay, withSpring(1, spring.gentle));
  }, [delay, initialScale]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
}

export function useStaggerItem(index: number, baseDelay = 0, staggerMs = 50) {
  return useFadeRise(baseDelay + index * staggerMs, 12, dur.base);
}

export function useRotateEntrance(delay = 0, fromRotation = -8) {
  const opacity  = useSharedValue(0);
  const rotation = useSharedValue(fromRotation);
  const scale    = useSharedValue(0.9);

  useEffect(() => {
    opacity.value  = withDelay(delay, withTiming(1, { duration: dur.medium, easing: ease.outCubic }));
    rotation.value = withDelay(delay, withSpring(0, spring.playful));
    scale.value    = withDelay(delay, withSpring(1, spring.standard));
  }, [delay, fromRotation]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));
}

export function useSlideIn(delay = 0, fromPosition = -80) {
  const opacity    = useSharedValue(0);
  const translateX = useSharedValue(fromPosition);

  useEffect(() => {
    opacity.value    = withDelay(delay, withTiming(1, { duration: dur.base, easing: ease.outCubic }));
    translateX.value = withDelay(delay, withSpring(0, spring.standard));
  }, [delay, fromPosition]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));
}

export function useFlipCard(delay = 0, isFront = true, flipDuration = dur.base) {
  const rotationX = useSharedValue(isFront ? 0 : 180);

  useEffect(() => {
    rotationX.value = withDelay(
      delay,
      withTiming(isFront ? 0 : 180, { duration: flipDuration, easing: ease.inOutSmooth }),
    );
  }, [isFront, delay, flipDuration]);

  return useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${rotationX.value}deg` }],
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎭 Advanced Interaction Hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function usePulseRing(active: boolean, intensity = 1.15, cycleDuration = 1200) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(intensity, { duration: cycleDuration / 2, easing: ease.inOutSmooth }),
          withTiming(1,         { duration: cycleDuration / 2, easing: ease.inOutSmooth }),
        ), -1,
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(1,   { duration: cycleDuration / 2 }),
          withTiming(0.4, { duration: cycleDuration / 2 }),
        ), -1,
      );
    } else {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value   = withSpring(1, spring.snappy);
      opacity.value = withTiming(0.6, { duration: dur.fast });
    }
  }, [active, intensity, cycleDuration]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
}

export function useShimmerLoading(isLoading: boolean) {
  const shimmerX = useSharedValue(-100);

  useEffect(() => {
    if (isLoading) {
      shimmerX.value = withRepeat(
        withTiming(100, { duration: 2000, easing: ease.linear }), -1,
      );
    } else {
      cancelAnimation(shimmerX);
      shimmerX.value = -100;
    }
  }, [isLoading]);

  return useAnimatedStyle(() => ({
    opacity: isLoading ? 1 : 0,
    transform: [{ translateX: interpolate(shimmerX.value, [-100, 100], [-100, 100]) }],
  }));
}

export function useBounce(delay = 0, bounceHeight = 12) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withSequence(withSpring(-bounceHeight, spring.playful), withSpring(0, spring.playful)),
    );
  }, [delay, bounceHeight]);

  return useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
}

export function useCountUp(target: number, duration = 1200) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(target, { duration, easing: ease.outExpo });
  }, [target, duration]);

  return progress;
}

export function useFloating(delay = 0, amplitude = 8, cycleDuration = 3000) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    setTimeout(() => {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-amplitude, { duration: cycleDuration / 2, easing: ease.inOutSmooth }),
          withTiming(amplitude,  { duration: cycleDuration / 2, easing: ease.inOutSmooth }),
        ), -1,
      );
    }, delay);
  }, [delay, amplitude, cycleDuration]);

  return useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
}

export function useTabPress(active: boolean) {
  const scale       = useSharedValue(active ? 1 : 0.9);
  const glowOpacity = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    scale.value       = withSpring(active ? 1 : 0.9, spring.snappy);
    glowOpacity.value = withTiming(active ? 1 : 0, { duration: dur.fast, easing: ease.outCubic });
  }, [active]);

  return {
    iconStyle: useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })),
    glowStyle: useAnimatedStyle(() => ({ opacity: glowOpacity.value })),
  };
}

export function useHeroEntrance(delay = 0, distance = 24) {
  const opacity    = useSharedValue(0);
  const scale      = useSharedValue(0.92);
  const translateY = useSharedValue(distance);

  useEffect(() => {
    opacity.value    = withDelay(delay, withTiming(1, { duration: dur.slow, easing: ease.outExpo }));
    scale.value      = withDelay(delay, withSpring(1, spring.gentle));
    translateY.value = withDelay(delay, withSpring(0, spring.gentle));
  }, [delay, distance]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));
}

export function useCenterHeroEntrance(delay = 0, fromScale = 0.9) {
  const opacity    = useSharedValue(0);
  const scale      = useSharedValue(fromScale);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value    = withDelay(delay, withTiming(1, { duration: dur.medium, easing: ease.outCubic }));
    scale.value      = withDelay(delay, withSpring(1, spring.gentle));
    translateY.value = withDelay(delay, withTiming(0, { duration: dur.medium, easing: ease.outCubic }));
  }, [delay, fromScale]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));
}

export function useCtaPulse(active: boolean, maxScale = 1.02) {
  const scale = useSharedValue(1);
  const glow  = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(maxScale, { duration: 850, easing: ease.inOutSmooth }),
          withTiming(1,        { duration: 850, easing: ease.inOutSmooth }),
        ), -1, false,
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(0.9,  { duration: 850, easing: ease.inOutSmooth }),
          withTiming(0.35, { duration: 850, easing: ease.inOutSmooth }),
        ), -1, false,
      );
      return;
    }
    cancelAnimation(scale);
    cancelAnimation(glow);
    scale.value = withTiming(1, { duration: dur.fast });
    glow.value  = withTiming(0, { duration: dur.fast });
  }, [active, maxScale]);

  return {
    ctaStyle:  useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })),
    glowStyle: useAnimatedStyle(() => ({ opacity: glow.value })),
  };
}

export function useLoadingRings(active: boolean) {
  const ringA   = useSharedValue(0);
  const ringB   = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      opacity.value = withTiming(1, { duration: dur.fast });
      ringA.value   = withRepeat(withTiming(360,  { duration: 2400, easing: ease.linear }), -1, false);
      ringB.value   = withRepeat(withTiming(-360, { duration: 3400, easing: ease.linear }), -1, false);
      return;
    }
    cancelAnimation(ringA);
    cancelAnimation(ringB);
    ringA.value   = 0;
    ringB.value   = 0;
    opacity.value = withTiming(0, { duration: dur.fast });
  }, [active]);

  return {
    ringAStyle: useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ rotate: `${ringA.value}deg` }],
    })),
    ringBStyle: useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ rotate: `${ringB.value}deg` }],
    })),
  };
}

export function useSubtleFloat(active = true, amplitude = 3, cycleDuration = 2200) {
  const y = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      y.value = withTiming(0, { duration: dur.fast });
      return;
    }
    y.value = withRepeat(
      withSequence(
        withTiming(-amplitude, { duration: cycleDuration / 2, easing: ease.inOutSmooth }),
        withTiming(amplitude,  { duration: cycleDuration / 2, easing: ease.inOutSmooth }),
      ), -1, false,
    );
  }, [active, amplitude, cycleDuration]);

  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}

export function useLoadingCorePulse(active: boolean, minScale = 1, maxScale = 1.16) {
  const scale   = useSharedValue(minScale);
  const opacity = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (active) {
      opacity.value = withTiming(1, { duration: dur.fast });
      scale.value   = withRepeat(
        withSequence(
          withTiming(maxScale, { duration: 720, easing: ease.inOutSmooth }),
          withTiming(minScale, { duration: 720, easing: ease.inOutSmooth }),
        ), -1, false,
      );
      return;
    }
    cancelAnimation(scale);
    scale.value   = withTiming(minScale, { duration: dur.fast });
    opacity.value = withTiming(0, { duration: dur.fast });
  }, [active, minScale, maxScale]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
}

// ── Halo Breathe — slow concentric ring breathing for premium status ──────────
export function useHaloBreathe(active: boolean, cycleDuration = 2800) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      opacity.value = withTiming(0, { duration: dur.base });
      scale.value   = withTiming(1, { duration: dur.base });
      return;
    }
    opacity.value = withTiming(0.55, { duration: dur.medium });
    scale.value   = withRepeat(
      withSequence(
        withTiming(1.14, { duration: cycleDuration / 2, easing: ease.inOutSmooth }),
        withTiming(1,    { duration: cycleDuration / 2, easing: ease.inOutSmooth }),
      ), -1, false,
    );
  }, [active, cycleDuration]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
}

// ── Success Reveal — elegant success state entrance ───────────────────────────
export function useSuccessReveal(trigger: boolean) {
  const scale   = useSharedValue(0.82);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    opacity.value = withTiming(1, { duration: dur.base, easing: ease.outCubic });
    scale.value   = withSpring(1, spring.snappy);
  }, [trigger]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
}

export function useCommandDockPulse(active: boolean, maxScale = 1.015) {
  const scale = useSharedValue(1);
  const glow  = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(maxScale, { duration: 900, easing: ease.inOutSmooth }),
          withTiming(1,        { duration: 900, easing: ease.inOutSmooth }),
        ), -1, false,
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 900, easing: ease.inOutSmooth }),
          withTiming(0.25, { duration: 900, easing: ease.inOutSmooth }),
        ), -1, false,
      );
      return;
    }
    cancelAnimation(scale);
    cancelAnimation(glow);
    scale.value = withTiming(1, { duration: dur.fast });
    glow.value  = withTiming(0, { duration: dur.fast });
  }, [active, maxScale]);

  return {
    scaleStyle: useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })),
    glowStyle:  useAnimatedStyle(() => ({ opacity: glow.value })),
  };
}

export function useReactorIdle(active: boolean) {
  const rotate = useSharedValue(0);
  const pulse  = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      cancelAnimation(rotate);
      cancelAnimation(pulse);
      rotate.value = 0;
      pulse.value  = withTiming(1, { duration: dur.fast });
      return;
    }
    rotate.value = withRepeat(withTiming(360, { duration: 9000, easing: ease.linear }), -1, false);
    pulse.value  = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1500, easing: ease.inOutSmooth }),
        withTiming(1,    { duration: 1500, easing: ease.inOutSmooth }),
      ), -1, false,
    );
  }, [active]);

  return {
    ringStyle: useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] })),
    coreStyle: useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] })),
  };
}

export function useReactorMerge(active: boolean) {
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);
  const halo  = useSharedValue(1);
  const core  = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      cancelAnimation(ringA);
      cancelAnimation(ringB);
      cancelAnimation(halo);
      cancelAnimation(core);
      ringA.value = 0;
      ringB.value = 0;
      halo.value  = 1;
      core.value  = 1;
      return;
    }
    ringA.value = withRepeat(withTiming(360,  { duration: 2600, easing: ease.linear }), -1, false);
    ringB.value = withRepeat(withTiming(-360, { duration: 4200, easing: ease.linear }), -1, false);
    halo.value  = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: ease.inOutSmooth }),
        withTiming(1,    { duration: 900, easing: ease.inOutSmooth }),
      ), -1, false,
    );
    core.value  = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1000, easing: ease.inOutSmooth }),
        withTiming(1,    { duration: 1000, easing: ease.inOutSmooth }),
      ), -1, false,
    );
  }, [active]);

  return {
    ringStyle:        useAnimatedStyle(() => ({ transform: [{ rotate: `${ringA.value}deg` }] })),
    counterRingStyle: useAnimatedStyle(() => ({ transform: [{ rotate: `${ringB.value}deg` }] })),
    haloStyle:        useAnimatedStyle(() => ({ transform: [{ scale: halo.value }] })),
    coreStyle:        useAnimatedStyle(() => ({ transform: [{ scale: core.value }] })),
  };
}

export function useSweepScan(active: boolean) {
  const rotate  = useSharedValue(0);
  const opacity = useSharedValue(0.15);

  useEffect(() => {
    if (!active) {
      cancelAnimation(rotate);
      cancelAnimation(opacity);
      rotate.value  = 0;
      opacity.value = withTiming(0.12, { duration: dur.fast });
      return;
    }
    rotate.value  = withRepeat(withTiming(360, { duration: 2800, easing: ease.linear }), -1, false);
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 700 }),
        withTiming(0.15, { duration: 700 }),
      ), -1, false,
    );
  }, [active]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotate.value}deg` }],
  }));
}

export function useSoftOrbit(active: boolean, delay = 0) {
  const rotate  = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(rotate);
      rotate.value  = 0;
      opacity.value = withTiming(0, { duration: dur.fast });
      return;
    }
    opacity.value = withDelay(delay, withTiming(1, { duration: dur.base }));
    rotate.value  = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 5200, easing: ease.linear }), -1, false),
    );
  }, [active, delay]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotate.value}deg` }],
  }));
}

/**
 * useIdleOrbit — always-on orbit that never stops.
 * Rotation starts on mount and runs forever at `idleSpeed`.
 * When `active` is true the opacity brightens and speed increases (achieved by
 * restarting only when active flips, preserving visual continuity via opacity).
 */
export function useIdleOrbit(active: boolean, delay = 0) {
  const rotate  = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Start rotation once on mount — never stop it
  useEffect(() => {
    rotate.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 8400, easing: ease.linear }), -1, false),
    );
    opacity.value = withDelay(delay, withTiming(active ? 1 : 0.38, { duration: dur.base }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactively adjust brightness only — rotation keeps going uninterrupted
  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0.38, { duration: dur.medium });
  }, [active]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotate.value}deg` }],
  }));
}

export function useShimmerBand(active: boolean) {
  const x       = useSharedValue(-160);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(x);
      x.value       = -160;
      opacity.value = withTiming(0, { duration: dur.fast });
      return;
    }
    opacity.value = withTiming(0.18, { duration: dur.fast });
    x.value       = withRepeat(
      withSequence(
        withTiming(240,  { duration: 1500, easing: ease.inOutSmooth }),
        withTiming(-160, { duration: 0 }),
      ), -1, false,
    );
  }, [active]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }],
  }));
}

export function useSignalPulse(active: boolean) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (!active) {
      scale.value   = withTiming(1, { duration: dur.fast });
      opacity.value = withTiming(0.2, { duration: dur.fast });
      return;
    }
    scale.value   = withRepeat(
      withSequence(withTiming(1.08, { duration: 760 }), withTiming(1, { duration: 760 })), -1, false,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0.85, { duration: 760 }), withTiming(0.25, { duration: 760 })), -1, false,
    );
  }, [active]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
}

export function useQuietCountPop(trigger: number) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.16, spring.playful),
      withSpring(1, spring.snappy),
    );
  }, [trigger]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

export function useCollapseExpand(isOpen: boolean, maxHeight = 300) {
  const height  = useSharedValue(isOpen ? maxHeight : 0);
  const opacity = useSharedValue(isOpen ? 1 : 0);

  useEffect(() => {
    height.value  = withSpring(isOpen ? maxHeight : 0, spring.standard);
    opacity.value = withTiming(isOpen ? 1 : 0, { duration: dur.base, easing: ease.outCubic });
  }, [isOpen, maxHeight]);

  return useAnimatedStyle(() => ({
    height:   height.value,
    opacity:  opacity.value,
    overflow: 'hidden',
  }));
}

export function useShake(trigger: boolean, intensity = 4, cycles = 6) {
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    const sequence: any[] = [];
    for (let i = 0; i < cycles; i++) {
      sequence.push(withTiming(intensity * (i % 2 === 0 ? 1 : -1), { duration: 40, easing: ease.linear }));
    }
    sequence.push(withTiming(0, { duration: 40, easing: ease.linear }));
    translateX.value = withSequence(...sequence);
  }, [trigger, intensity, cycles]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
}
