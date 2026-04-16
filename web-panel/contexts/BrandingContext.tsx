'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSettings, type DietitianSettings } from '@/lib/api/settings';
import { applyBrandingToDom } from '@/lib/branding/applyBranding';

interface BrandingContextType {
  settings: DietitianSettings | null;
  isLoading: boolean;
  applyBranding: (settings: DietitianSettings) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DietitianSettings | null>(null);

  // Fetch settings
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    retry: false, // Don't retry on error to prevent spam
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    staleTime: 60_000, // Consider data fresh for 60 seconds
  });

  // Apply branding using the helper
  const applyBranding = (settings: DietitianSettings) => {
    applyBrandingToDom(settings);
    setSettings(settings);
  };

  // Apply branding when data loads
  useEffect(() => {
    if (data) {
      applyBranding(data);
    }
  }, [data]);

  return (
    <BrandingContext.Provider value={{ settings, isLoading, applyBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
