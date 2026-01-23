"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface SidebarContextType {
  isLocked: boolean;
  isHovered: boolean;
  isOpen: boolean;
  toggleLock: () => void;
  setHovered: (hovered: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEY = 'sidebar-locked-state';
const HOVER_DELAY_MS = 80;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [isHovered, setIsHoveredState] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load locked state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setIsLocked(true);
    }
  }, []);

  // Save locked state to localStorage
  const toggleLock = useCallback(() => {
    setIsLocked(prev => {
      const newValue = !prev;
      localStorage.setItem(STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  // Debounced hover handler
  const setHovered = useCallback((hovered: boolean) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    if (hovered) {
      // Add delay before showing (prevent accidental triggers)
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHoveredState(true);
      }, HOVER_DELAY_MS);
    } else {
      // Immediate hide
      setIsHoveredState(false);
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const isOpen = isLocked || isHovered;

  return (
    <SidebarContext.Provider value={{ isLocked, isHovered, isOpen, toggleLock, setHovered }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
