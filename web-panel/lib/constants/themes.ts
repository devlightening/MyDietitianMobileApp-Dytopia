// Preset theme definitions
export const PRESET_THEMES = [
  {
    key: 'sage',
    name: 'Doğal Yeşil',
    description: 'Sakin ve sağlık odaklı',
    primary: '#4A7C59',
    accent: '#8FBC8F',
  },
  {
    key: 'ocean',
    name: 'Okyanus Mavisi',
    description: 'Kurumsal ve güven veren',
    primary: '#2C5F8D',
    accent: '#4A9ECA',
  },
  {
    key: 'sunset',
    name: 'Yumuşak Mercan',
    description: 'Sıcak ve davetkâr',
    primary: '#E07856',
    accent: '#FFB088',
  },
  {
    key: 'lavender',
    name: 'Lavanta',
    description: 'Yumuşak ve zarif',
    primary: '#8B7AB8',
    accent: '#B8A8D9',
  },
  {
    key: 'forest',
    name: 'Derin Orman',
    description: 'Güçlü ve dengeli',
    primary: '#2D5016',
    accent: '#6B8E23',
  },
  {
    key: 'rose',
    name: 'Gül Tonu',
    description: 'Modern ve rafine',
    primary: '#B76E79',
    accent: '#E8B4B8',
  },
] as const;

export type ThemePreset = typeof PRESET_THEMES[number];
