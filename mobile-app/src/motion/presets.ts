import { dur, ease, spring } from "../hooks/useAuraMotion";

export const motionDurations = {
  feedbackFast: 180,
  cardEnter: 280,
  cardEnterSlow: 340,
  pulseLoop: 860,
  shimmerLoop: 1500,
  celebrate: 520,
} as const;
export const motionEasing = {
  feedback: ease.outCubic,
  card: ease.outExpo,
  pulse: ease.inOutSmooth,
} as const;

export const motionSpring = {
  card: spring.gentle,
  settle: spring.snappy,
  playful: spring.playful,
} as const;

export const motionTokens = {
  dur,
  ease,
  spring,
  durations: motionDurations,
  easing: motionEasing,
  springs: motionSpring,
} as const;
