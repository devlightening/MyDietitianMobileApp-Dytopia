// src/theme/colors.ts
export const colors = {
  // Backgrounds
  oat: "#F9F7F2",
  surface: "#FFFFFF",          // card surface (pure white kullanmıyoruz ana bg'de, ama kart için olur)
  surfaceSoft: "#F6F4EE",      // oat'a yakın soft surface

  // Brand
  sage: "#4A7C59",
  forest: "#2F5233",

  // Accents
  coral: "#FF8C61",
  gold: "#F4D35E",

  // System
  border: "rgba(47, 82, 51, 0.10)",
  text: "#142019",
  muted: "rgba(20, 32, 25, 0.55)",
  subtle: "rgba(20, 32, 25, 0.35)",

  // Semantic (gerekirse)
  success: "#4A7C59",
  warning: "#F4D35E",
  error: "#E35B5B",

  // Backward compatibility aliases (for existing screens)
  background: "#FFFFFF",       // maps to surface
  card: "#F6F4EE",            // maps to surfaceSoft
  textMuted: "rgba(20, 32, 25, 0.55)", // maps to muted
};
