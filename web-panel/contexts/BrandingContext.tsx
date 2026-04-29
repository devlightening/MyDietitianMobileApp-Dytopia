'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSettings, type DietitianSettings } from '@/lib/api/settings';
import { applyBrandingToDom, removeBrandingFromDom } from '@/lib/branding/applyBranding';

interface BrandingContextType {
  settings: DietitianSettings | null;
  isLoading: boolean;
  applyBranding: (nextSettings: DietitianSettings) => void;
  previewBranding: (nextSettings: DietitianSettings) => void;
  restoreBranding: () => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DietitianSettings | null>(null);
  const persistedSettingsRef = useRef<DietitianSettings | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const applyBranding = (nextSettings: DietitianSettings) => {
    persistedSettingsRef.current = nextSettings;
    setSettings(nextSettings);
    applyBrandingToDom(nextSettings);
  };

  const previewBranding = (nextSettings: DietitianSettings) => {
    applyBrandingToDom(nextSettings);
  };

  const restoreBranding = () => {
    if (persistedSettingsRef.current) {
      applyBrandingToDom(persistedSettingsRef.current);
      return;
    }

    removeBrandingFromDom();
  };

  useEffect(() => {
    if (!data) {
      return;
    }

    applyBranding(data);
  }, [data]);

  useEffect(() => {
    return () => {
      restoreBranding();
    };
  }, []);

  const value = useMemo<BrandingContextType>(
    () => ({
      settings,
      isLoading,
      applyBranding,
      previewBranding,
      restoreBranding,
    }),
    [isLoading, settings]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }

  return context;
}
