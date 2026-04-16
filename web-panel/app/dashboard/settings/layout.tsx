'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  CreditCard,
  Monitor,
  Palette,
  Settings,
  ShieldCheck,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsLayoutProps {
  children: ReactNode;
}

const settingsNav = [
  {
    name: 'Profil',
    href: '/dashboard/settings/profile',
    icon: User,
    description: 'Klinik kimliği ve iletişim bilgileri',
  },
  {
    name: 'Marka ve tema',
    href: '/dashboard/settings/branding',
    icon: Palette,
    description: 'Renkler, logo ve panel görünümü',
  },
  {
    name: 'Hesap güvenliği',
    href: '/dashboard/settings/security',
    icon: ShieldCheck,
    description: 'Şifre, oturum ve hesap koruması',
  },
  {
    name: 'Bildirimler',
    href: '/dashboard/settings/notifications',
    icon: Bell,
    description: 'Panel uyarıları ve özet tercihleri',
  },
  {
    name: 'Görünüm',
    href: '/dashboard/settings/appearance',
    icon: Monitor,
    description: 'Açık, koyu ve sistem modu',
  },
  {
    name: 'Abonelik',
    href: '/dashboard/settings/subscription',
    icon: CreditCard,
    description: 'Plan durumu ve lisans kapsamı',
  },
] as const;

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-6 pb-10">
      <section className="card-premium p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Settings className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Ayarlar</h1>
                <p className="text-sm text-muted-foreground">
                  Klinik panelinizi tek merkezden yönetin.
                </p>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Kurumsal görünümünüzü, hesap güvenliğinizi, bildirim tercihlerinizi ve çalışma
              düzeninizi bu alandan yönetebilirsiniz.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-[var(--surface-glass)] px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Yönetim merkezi
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Kaydedilen tercihler panel genelinde anında uygulanır.
            </p>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-3xl border border-border bg-[var(--surface-glass)] p-2 shadow-[var(--shadow-card)]">
        <nav className="flex min-w-max gap-2">
          {settingsNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex min-w-[190px] items-start gap-3 rounded-2xl px-4 py-3 transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-[var(--shadow-emerald-sm)]'
                    : 'text-muted-foreground hover:bg-[var(--surface-overlay)] hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                    isActive
                      ? 'border-white/15 bg-white/10 text-white'
                      : 'border-border bg-[var(--surface-overlay)] text-primary group-hover:border-primary/15'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span
                    className={cn(
                      'mt-1 block text-xs leading-5',
                      isActive ? 'text-primary-foreground/85' : 'text-muted-foreground'
                    )}
                  >
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div>{children}</div>
    </div>
  );
}
