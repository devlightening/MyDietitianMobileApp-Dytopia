"use client";

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-lg',
        'border border-border/60 bg-[var(--surface-glass)] hover:bg-[var(--surface-overlay)]',
        'transition-all hover:scale-105 active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      type="button"
      aria-label={isDark ? 'Açık moda geç' : 'Koyu moda geç'}
      title={isDark ? 'Açık moda geç' : 'Koyu moda geç'}
    >
      <Sun
        className={cn(
          'absolute h-4 w-4 text-foreground transition-all',
          isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
        )}
      />
      <Moon
        className={cn(
          'absolute h-4 w-4 text-foreground transition-all',
          isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
        )}
      />
    </button>
  );
}
