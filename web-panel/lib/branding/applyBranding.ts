import { DietitianSettings } from '@/lib/api/settings';

/**
 * Convert hex color to HSL values for Tailwind CSS variables
 * Returns format: "hue saturation% lightness%" (e.g., "210 80% 45%")
 */
function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

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

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lPercent = Math.round(l * 100);

  return `${h} ${s}% ${lPercent}%`;
}

/**
 * Apply branding settings to the DOM by updating CSS variables
 * This allows theme changes to affect the entire application
 */
export function applyBrandingToDom(settings: DietitianSettings | null) {
  if (!settings) return;

  const root = document.documentElement;

  // Convert hex colors to HSL for Tailwind CSS variables
  const primaryHSL = hexToHSL(settings.primaryColorHex);
  const accentHSL = hexToHSL(settings.accentColorHex);

  // Apply primary color (used for buttons, active states, etc.)
  root.style.setProperty('--primary', primaryHSL);

  // Apply accent color (used for highlights, badges, etc.)
  root.style.setProperty('--accent', accentHSL);

  // Also set hex versions for direct use
  root.style.setProperty('--brand-primary', settings.primaryColorHex);
  root.style.setProperty('--brand-accent', settings.accentColorHex);

  // Update ring color to match primary
  root.style.setProperty('--ring', primaryHSL);

  // Update meta theme-color for mobile browsers
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', settings.primaryColorHex);
  }

  console.log('✅ Theme applied:', {
    primary: settings.primaryColorHex,
    accent: settings.accentColorHex,
    primaryHSL,
    accentHSL,
  });
}

/**
 * Remove branding from DOM (reset to defaults)
 */
export function removeBrandingFromDom() {
  const root = document.documentElement;
  root.style.removeProperty('--primary');
  root.style.removeProperty('--accent');
  root.style.removeProperty('--brand-primary');
  root.style.removeProperty('--brand-accent');
  root.style.removeProperty('--ring');
}
