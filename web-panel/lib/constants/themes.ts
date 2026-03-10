// Preset theme definitions
export const PRESET_THEMES = [
  {
    key: 'sage',
    name: 'Sage & Forest',
    description: 'Calm and natural',
    primary: '#4A7C59',
    accent: '#8FBC8F',
  },
  {
    key: 'ocean',
    name: 'Ocean Blue',
    description: 'Professional and trustworthy',
    primary: '#2C5F8D',
    accent: '#4A9ECA',
  },
  {
    key: 'sunset',
    name: 'Sunset Coral',
    description: 'Warm and inviting',
    primary: '#E07856',
    accent: '#FFB088',
  },
  {
    key: 'lavender',
    name: 'Lavender Dream',
    description: 'Soft and elegant',
    primary: '#8B7AB8',
    accent: '#B8A8D9',
  },
  {
    key: 'forest',
    name: 'Deep Forest',
    description: 'Rich and grounded',
    primary: '#2D5016',
    accent: '#6B8E23',
  },
  {
    key: 'rose',
    name: 'Rose Gold',
    description: 'Modern and sophisticated',
    primary: '#B76E79',
    accent: '#E8B4B8',
  },
] as const;

export type ThemePreset = typeof PRESET_THEMES[number];
