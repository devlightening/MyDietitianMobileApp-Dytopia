'use client';

import { useEffect, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { SettingsCard } from '@/components/settings/SettingsCard';

const themes = [
  {
    key: 'light',
    label: 'Açık mod',
    description: 'Klinik kullanım için ferah ve yüksek okunabilirlik sunar.',
    icon: Sun,
    preview: 'from-white via-emerald-50 to-slate-100',
    accent: 'bg-emerald-500',
  },
  {
    key: 'dark',
    label: 'Koyu mod',
    description: 'Gerçek siyah yüzeylerle akşam kullanımı için daha konforlu görünür.',
    icon: Moon,
    preview: 'from-[#060808] via-[#0b1110] to-[#111918]',
    accent: 'bg-emerald-400',
  },
  {
    key: 'system',
    label: 'Sistem tercihi',
    description: 'Cihazınızdaki açık veya koyu modu otomatik olarak takip eder.',
    icon: Monitor,
    preview: 'from-white via-slate-100 to-[#0b1110]',
    accent: 'bg-emerald-500',
  },
] as const;

export default function AppearancePage() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="max-w-5xl space-y-6">
      <SettingsCard
        icon={Monitor}
        title="Panel görünümü"
        description="Çalışma düzeninize uygun tema tercihini belirleyin."
        className="rounded-[28px] border-border bg-[var(--surface-raised)] shadow-[var(--shadow-card)]"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {themes.map((item) => {
            const Icon = item.icon;
            const isSelected = mounted && theme === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTheme(item.key)}
                className={cn(
                  'relative rounded-[24px] border p-5 text-left transition-all',
                  isSelected
                    ? 'border-primary/25 bg-primary/5 shadow-[var(--shadow-emerald-sm)]'
                    : 'border-border bg-[var(--surface-raised)] hover:border-primary/20 hover:bg-[var(--surface-overlay)]'
                )}
              >
                {isSelected ? (
                  <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}

                <div
                  className={cn(
                    'mb-4 flex h-24 items-end gap-2 rounded-[20px] border border-white/10 bg-gradient-to-r p-3',
                    item.preview
                  )}
                >
                  <span className="h-2 w-24 rounded-full bg-white/70 dark:bg-white/20" />
                  <span className="h-2 w-14 rounded-full bg-white/50 dark:bg-white/10" />
                  <span className={cn('ml-auto h-6 w-6 rounded-full shadow-sm', item.accent)} />
                </div>

                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border',
                      isSelected
                        ? 'border-primary/15 bg-primary/10 text-primary'
                        : 'border-border bg-[var(--surface-overlay)] text-muted-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[28px] border border-border bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-semibold text-foreground">Görünüm notları</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <li>Açık mod klinik panel hissini daha yalın ve profesyonel gösterir.</li>
            <li>Koyu mod gerçek siyah yüzeyler kullandığı için uzun akşam seanslarında daha rahattır.</li>
            <li>Sistem tercihi seçildiğinde panel cihazınızın genel görünüm kararını izler.</li>
          </ul>
        </div>

        <div className="card-premium p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
            Geçerli görünüm
          </p>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {mounted
              ? resolvedTheme === 'dark'
                ? 'Koyu görünüm aktif'
                : 'Açık görünüm aktif'
              : 'Tema hazırlanıyor'}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tema tercihiniz bu tarayıcıda saklanır ve sonraki oturumlarda korunur.
          </p>

          <div className="mt-5 rounded-[24px] border border-border bg-[var(--surface-glass)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Anlık tema durumu</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Seçili mod: {theme === 'system' ? 'Sistem tercihi' : theme === 'dark' ? 'Koyu mod' : 'Açık mod'}
                </p>
              </div>
              <span className="badge-base badge-premium">
                {resolvedTheme === 'dark' ? 'Koyu çıktı' : 'Açık çıktı'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
