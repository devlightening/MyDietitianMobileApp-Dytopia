// src/i18n/index.ts — i18n barrel
export { tr } from './tr';
export { en } from './en';
export type { Translations } from './tr';
export type { Language } from '../context/I18nContext';
export { useTranslation, I18nProvider } from '../context/I18nContext';
