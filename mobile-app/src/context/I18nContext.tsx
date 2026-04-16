// src/context/I18nContext.tsx — Language / i18n context
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { tr } from '../i18n/tr';
import { en } from '../i18n/en';
import type { Translations } from '../i18n/tr';

export type Language = 'tr' | 'en';

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: Translations;
}

const LANG_KEY = 'app_language';

const translations: Record<Language, Translations> = { tr, en };

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('tr');

  useEffect(() => {
    SecureStore.getItemAsync(LANG_KEY).then((val) => {
      if (val === 'tr' || val === 'en') setLanguageState(val);
    });
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await SecureStore.setItemAsync(LANG_KEY, lang);
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
