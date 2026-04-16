export interface Theme {
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceOverlay: string;
  glass: string;
  glassBorder: string;
  glassEmerald: string;

  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryGlow: string;
  emerald: string;
  emeraldGlow: string;

  accent: string;
  accentCyan: string;
  accentGold: string;
  accentCoral: string;

  macroProtein: string;
  macroCarb: string;
  macroFat: string;
  macroCalorie: string;

  text: string;
  textSub: string;
  textMuted: string;

  border: string;
  borderLight: string;
  borderEmerald: string;
  success: string;
  warning: string;
  error: string;

  shadowCard: string;
  shadowEmerald: string;
}

export const lightTheme: Theme = {
  bg: "#F6FBF7",
  surface: "#FFFFFF",
  surfaceElevated: "#ECF7EE",
  surfaceOverlay: "#DFF1E3",
  glass: "rgba(255,255,255,0.86)",
  glassBorder: "rgba(72,128,92,0.12)",
  glassEmerald: "rgba(71,185,114,0.12)",

  primary: "#47B972",
  primaryLight: "rgba(71,185,114,0.14)",
  primaryDark: "#2F8F57",
  primaryGlow: "rgba(71,185,114,0.26)",
  emerald: "#2C9D66",
  emeraldGlow: "rgba(44,157,102,0.22)",

  accent: "#7BC7A2",
  accentCyan: "#57B8C7",
  accentGold: "#E3C45D",
  accentCoral: "#E57E6B",

  macroProtein: "#E57E6B",
  macroCarb: "#57B8C7",
  macroFat: "#E3C45D",
  macroCalorie: "#8BCF92",

  text: "#183324",
  textSub: "rgba(24,51,36,0.70)",
  textMuted: "rgba(24,51,36,0.44)",

  border: "rgba(52,111,73,0.10)",
  borderLight: "rgba(52,111,73,0.05)",
  borderEmerald: "rgba(71,185,114,0.30)",
  success: "#2F8F57",
  warning: "#CFB145",
  error: "#D2665C",

  shadowCard: "rgba(31,73,46,0.12)",
  shadowEmerald: "rgba(71,185,114,0.18)",
};

export const darkTheme: Theme = {
  bg: "#0F1B14",
  surface: "#16261C",
  surfaceElevated: "#1C3024",
  surfaceOverlay: "#24402F",
  glass: "rgba(22,38,28,0.86)",
  glassBorder: "rgba(228,247,233,0.08)",
  glassEmerald: "rgba(71,185,114,0.16)",

  primary: "#61D288",
  primaryLight: "rgba(97,210,136,0.16)",
  primaryDark: "#47B972",
  primaryGlow: "rgba(97,210,136,0.24)",
  emerald: "#47B972",
  emeraldGlow: "rgba(97,210,136,0.20)",

  accent: "#8BD9B0",
  accentCyan: "#69C4CF",
  accentGold: "#E8CE75",
  accentCoral: "#F08A78",

  macroProtein: "#F08A78",
  macroCarb: "#69C4CF",
  macroFat: "#E8CE75",
  macroCalorie: "#8BD9B0",

  text: "#EFFAF2",
  textSub: "rgba(239,250,242,0.72)",
  textMuted: "rgba(239,250,242,0.44)",

  border: "rgba(239,250,242,0.10)",
  borderLight: "rgba(239,250,242,0.05)",
  borderEmerald: "rgba(97,210,136,0.30)",
  success: "#61D288",
  warning: "#E8CE75",
  error: "#F08A78",

  shadowCard: "rgba(0,0,0,0.34)",
  shadowEmerald: "rgba(97,210,136,0.20)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
  full: 9999,
} as const;

export const motion = {
  durationFast: 150,
  durationBase: 220,
  durationSlow: 380,
  durationSlower: 600,
  springConfig: {
    tension: 180,
    friction: 22,
    useNativeDriver: true,
  },
  springConfigBouncy: {
    tension: 240,
    friction: 18,
    useNativeDriver: true,
  },
} as const;

export const typography = {
  size: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 15,
    lg: 17,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
    "5xl": 48,
  },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
    black: "900" as const,
  },
  tracking: {
    tight: -0.035,
    normal: 0,
    wide: 0.04,
    wider: 0.08,
    widest: 0.12,
  },
} as const;
