import { DietitianSettings } from '@/lib/api/settings';

function hexToHsl(hex: string): string {
  const value = hex.replace(/^#/, '');
  const r = parseInt(value.substring(0, 2), 16) / 255;
  const g = parseInt(value.substring(2, 4), 16) / 255;
  const b = parseInt(value.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyBrandingToDom(settings: DietitianSettings | null) {
  if (!settings) {
    return;
  }

  const root = document.documentElement;
  const primaryHsl = hexToHsl(settings.primaryColorHex);
  const accentHsl = hexToHsl(settings.accentColorHex);

  root.style.setProperty('--primary', primaryHsl);
  root.style.setProperty('--accent', accentHsl);
  root.style.setProperty('--brand-primary', settings.primaryColorHex);
  root.style.setProperty('--brand-accent', settings.accentColorHex);
  root.style.setProperty('--ring', primaryHsl);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', settings.primaryColorHex);
  }
}

export function removeBrandingFromDom() {
  const root = document.documentElement;
  root.style.removeProperty('--primary');
  root.style.removeProperty('--accent');
  root.style.removeProperty('--brand-primary');
  root.style.removeProperty('--brand-accent');
  root.style.removeProperty('--ring');
}
