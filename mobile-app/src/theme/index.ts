// src/theme/index.ts — Backward-compat + new token system

// ── New system (use everywhere) ─────────────────────────────────────────────
export { lightTheme, darkTheme, spacing, radii } from './tokens';
export type { Theme } from './tokens';
export { typography } from './typography';

// ── Legacy exports (kept for any files not yet migrated) ────────────────────
export { colors } from './colors';
export { shadows } from './shadows';
