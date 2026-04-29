import { DietitianSettings } from '@/lib/api/settings';

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type HslColor = {
  h: number;
  s: number;
  l: number;
};

function normalizeHex(hex: string): string {
  const value = hex.trim().replace(/^#/, '');
  if (value.length === 3) {
    return `#${value
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`.toUpperCase();
  }

  return `#${value}`.toUpperCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex).replace(/^#/, '');

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    switch (max) {
      case red:
        h = ((green - blue) / delta) % 6;
        break;
      case green:
        h = (blue - red) / delta + 2;
        break;
      default:
        h = (red - green) / delta + 4;
        break;
    }
  }

  return {
    h: Math.round((h * 60 + 360) % 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToCssValue(color: HslColor): string {
  return `${Math.round(color.h)} ${Math.round(color.s)}% ${Math.round(color.l)}%`;
}

function shiftHsl(color: HslColor, adjustments: Partial<HslColor>): HslColor {
  return {
    h: adjustments.h ?? color.h,
    s: clamp(adjustments.s ?? color.s, 0, 100),
    l: clamp(adjustments.l ?? color.l, 0, 100),
  };
}

function rgba({ r, g, b }: RgbColor, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getContrastColor({ r, g, b }: RgbColor): string {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? '#0F172A' : '#FFFFFF';
}

function getContrastHsl(color: string): string {
  return hslToCssValue(rgbToHsl(hexToRgb(color)));
}

function buildBrandingCssVars(settings: DietitianSettings): Record<string, string> {
  const primaryHex = normalizeHex(settings.primaryColorHex);
  const accentHex = normalizeHex(settings.accentColorHex);
  const primaryRgb = hexToRgb(primaryHex);
  const accentRgb = hexToRgb(accentHex);
  const primaryHsl = rgbToHsl(primaryRgb);
  const accentHsl = rgbToHsl(accentRgb);
  const primaryContrastHex = getContrastColor(primaryRgb);
  const accentContrastHex = getContrastColor(accentRgb);

  const primaryDark = shiftHsl(primaryHsl, { l: primaryHsl.l - 10, s: primaryHsl.s + 4 });
  const primaryHover = shiftHsl(primaryHsl, { l: primaryHsl.l - 6, s: primaryHsl.s + 2 });
  const accentSoft = shiftHsl(accentHsl, { l: 94, s: Math.max(18, accentHsl.s - 12) });
  const accentStrong = shiftHsl(accentHsl, { l: accentHsl.l - 4, s: accentHsl.s + 2 });

  return {
    '--primary': hslToCssValue(primaryHsl),
    '--primary-foreground': getContrastHsl(primaryContrastHex),
    '--accent': hslToCssValue(accentSoft),
    '--accent-foreground': getContrastHsl(accentContrastHex),
    '--ring': hslToCssValue(primaryHsl),
    '--action': hslToCssValue(primaryDark),
    '--action-foreground': getContrastHsl(primaryContrastHex),
    '--brand-primary': primaryHex,
    '--brand-primary-rgb': `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`,
    '--brand-primary-hover': `hsl(${hslToCssValue(primaryHover)})`,
    '--brand-primary-soft': rgba(primaryRgb, 0.14),
    '--brand-primary-softer': rgba(primaryRgb, 0.08),
    '--brand-primary-contrast': primaryContrastHex,
    '--brand-emerald': `hsl(${hslToCssValue(primaryDark)})`,
    '--brand-glow': rgba(primaryRgb, 0.2),
    '--brand-glow-soft': rgba(primaryRgb, 0.1),
    '--brand-accent': accentHex,
    '--brand-accent-rgb': `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
    '--brand-accent-soft': rgba(accentRgb, 0.14),
    '--brand-accent-contrast': accentContrastHex,
    '--surface-overlay': rgba(primaryRgb, 0.08),
    '--surface-overlay-strong': rgba(primaryRgb, 0.14),
    '--surface-glass-emerald': rgba(primaryRgb, 0.09),
    '--surface-glass-hover': rgba(primaryRgb, 0.13),
    '--border-emerald': rgba(primaryRgb, 0.3),
    '--border-emerald-dim': rgba(primaryRgb, 0.18),
    '--border-glow': rgba(primaryRgb, 0.4),
    '--shadow-emerald': `0 18px 40px ${rgba(primaryRgb, 0.16)}`,
    '--shadow-emerald-sm': `0 10px 24px ${rgba(primaryRgb, 0.12)}`,
    '--shadow-glow': `0 0 0 4px ${rgba(primaryRgb, 0.16)}`,
    '--page-glow-primary': rgba(primaryRgb, 0.18),
    '--page-glow-accent': rgba(accentRgb, 0.1),
    '--page-glow-primary-dark': rgba(primaryRgb, 0.12),
    '--page-glow-accent-dark': rgba(accentRgb, 0.08),
    '--preview-primary-soft': rgba(primaryRgb, 0.16),
    '--preview-accent-soft': rgba(accentRgb, 0.16),
    '--preview-accent-strong': `hsl(${hslToCssValue(accentStrong)})`,
  };
}

export function applyBrandingToDom(settings: DietitianSettings | null) {
  if (!settings) {
    return;
  }

  const root = document.documentElement;
  const cssVars = buildBrandingCssVars(settings);

  Object.entries(cssVars).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });

  if (settings.themePresetKey) {
    root.dataset.brandPreset = settings.themePresetKey;
  } else {
    delete root.dataset.brandPreset;
  }

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', normalizeHex(settings.primaryColorHex));
  }
}

export function removeBrandingFromDom() {
  const root = document.documentElement;
  [
    '--primary',
    '--primary-foreground',
    '--accent',
    '--accent-foreground',
    '--ring',
    '--action',
    '--action-foreground',
    '--brand-primary',
    '--brand-primary-rgb',
    '--brand-primary-hover',
    '--brand-primary-soft',
    '--brand-primary-softer',
    '--brand-primary-contrast',
    '--brand-emerald',
    '--brand-glow',
    '--brand-glow-soft',
    '--brand-accent',
    '--brand-accent-rgb',
    '--brand-accent-soft',
    '--brand-accent-contrast',
    '--surface-overlay',
    '--surface-overlay-strong',
    '--surface-glass-emerald',
    '--surface-glass-hover',
    '--border-emerald',
    '--border-emerald-dim',
    '--border-glow',
    '--shadow-emerald',
    '--shadow-emerald-sm',
    '--shadow-glow',
    '--page-glow-primary',
    '--page-glow-accent',
    '--page-glow-primary-dark',
    '--page-glow-accent-dark',
    '--preview-primary-soft',
    '--preview-accent-soft',
    '--preview-accent-strong',
  ].forEach((name) => root.style.removeProperty(name));

  delete root.dataset.brandPreset;
}
