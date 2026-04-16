/**
 * AURA CLINICAL OS — Web Motion Presets
 * Built on motion (framer-motion v11)
 */

/* ── Duration tokens (seconds for framer-motion) ────── */
export const duration = {
  micro:  0.12,
  fast:   0.18,
  base:   0.26,
  medium: 0.36,
  slow:   0.48,
  hero:   0.60,
} as const;

/* ── Easing curves ──────────────────────────────────── */
export const ease = {
  outExpo:   [0.16, 1, 0.3, 1],
  spring:    [0.34, 1.56, 0.64, 1],
  smooth:    [0.45, 0, 0.55, 1],
  outCubic:  [0.33, 1, 0.68, 1],
} as const;

/* ── Reusable variants ──────────────────────────────── */

export const fadeRise = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

export const fadeRiseTransition = {
  duration: duration.base,
  ease:     ease.outExpo,
};

export const scaleSettle = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1 },
};

export const scaleSettleTransition = {
  duration: duration.base,
  ease:     ease.spring,
};

export const blurReveal = {
  hidden:  { opacity: 0, scale: 0.96, filter: 'blur(8px)' },
  visible: { opacity: 1, scale: 1,    filter: 'blur(0px)' },
};

export const blurRevealTransition = {
  duration: duration.medium,
  ease:     ease.outExpo,
};

/* ── Stagger container ─────────────────────────────── */
export const staggerChildren = (
  delay = 0.05,
  delayChildren = 0.08,
) => ({
  hidden:  {},
  visible: {
    transition: {
      staggerChildren: delay,
      delayChildren,
    },
  },
});

/* ── Slide in from direction ──────────────────────── */
export const slideInLeft = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
};

export const slideInRight = {
  hidden:  { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0 },
};

/* ── Modal / drawer ────────────────────────────────── */
export const modalReveal = {
  hidden:  { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1,    y: 0 },
  exit:    { opacity: 0, scale: 0.97, y: 4 },
};

export const backdropReveal = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
};
