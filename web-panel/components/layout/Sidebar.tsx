"use client";

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Calendar,
  CalendarDays,
  ChefHat,
  Key,
  LayoutDashboard,
  LogOut,
  Palette,
  Pin,
  PinOff,
  Users,
} from 'lucide-react';
import { logout } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSidebar } from '@/contexts/SidebarContext';
import { useBranding } from '@/contexts/BrandingContext';
import { getCareHubSummary } from '@/lib/api/care-hub';

const menuItems = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'clients', href: '/dashboard/clients', icon: Users },
  { key: 'appointments', href: '/dashboard/appointments', icon: CalendarDays },
  { key: 'plans', href: '/dashboard/plans', icon: Calendar },
  { key: 'recipes', href: '/dashboard/recipes', icon: ChefHat },
  { key: 'careHub', href: '/dashboard/care-hub', icon: Bell },
  { key: 'accessKeys', href: '/dashboard/access-keys', icon: Key },
  { key: 'settings', href: '/dashboard/settings', icon: Palette },
];

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 248;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('common');
  const { isLocked, isOpen, toggleLock, setHovered } = useSidebar();
  const { settings } = useBranding();

  const { data: careSummary } = useQuery({
    queryKey: ['care-hub-summary', 'sidebar'],
    queryFn: () => getCareHubSummary(6),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const clinicName = settings?.clinicName || 'MyDietitian';
  const logoUrl = settings?.logoUrl;
  const initials = clinicName.substring(0, 2).toUpperCase();
  const unreadCareCount = careSummary?.unreadMessagesCount ?? 0;

  const handleLogout = async () => {
    const success = await logout(queryClient);
    if (success) {
      router.replace('/auth/login');
      router.refresh();
    }
  };

  return (
    <aside
      onMouseEnter={() => {
        if (!isLocked) setHovered(true);
      }}
      onMouseLeave={() => {
        if (!isLocked) setHovered(false);
      }}
      className="fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border/80 backdrop-blur-xl transition-all duration-300 ease-out"
      style={{
        background: 'var(--surface-glass)',
        width: isOpen ? `${EXPANDED_WIDTH}px` : `${COLLAPSED_WIDTH}px`,
        boxShadow: '0 0 0 1px var(--border-subtle), 14px 0 34px rgba(0, 0, 0, 0.14)',
      }}
    >
      <div className={cn('border-b border-border/80', isOpen ? 'px-4 py-4' : 'px-2 py-4')}>
        {isOpen ? (
          <div className="rounded-2xl border border-border/80 bg-[var(--surface-raised)] p-3 shadow-sm shadow-black/5 dark:shadow-black/30">
            <div className="flex items-start justify-between gap-3">
              <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/15 text-base font-bold text-primary">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{clinicName}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                    Diyetisyen paneli
                  </p>
                </div>
              </Link>

              <button
                onClick={toggleLock}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-[var(--surface-glass)] text-muted-foreground transition hover:border-primary/20 hover:text-primary"
                aria-label={isLocked ? 'Kenar çubuğu sabitlemesini kapat' : 'Kenar çubuğunu sabitle'}
                title={isLocked ? 'Kenar çubuğu sabitlemesini kapat' : 'Kenar çubuğunu sabitle'}
              >
                {isLocked ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Link
              href="/dashboard"
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-primary/15 text-sm font-bold text-primary"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </Link>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const careBadge = item.key === 'careHub' ? unreadCareCount : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              className={cn('nav-item group relative', isOpen ? 'justify-start' : 'justify-center px-0')}
              data-active={isActive}
            >
              <div className="relative flex-shrink-0">
                <Icon className="h-[18px] w-[18px]" />
                {!isOpen && careBadge > 0 ? (
                  <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {careBadge > 9 ? '9+' : careBadge}
                  </span>
                ) : null}
              </div>

              {isOpen ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate">{t(item.key)}</span>
                  {careBadge > 0 ? (
                    <span className="ml-auto inline-flex items-center rounded-full bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-500">
                      {careBadge} yeni
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="pointer-events-none absolute left-full ml-3 rounded-xl border border-border/80 bg-[var(--surface-raised)] px-3 py-2 text-xs font-medium text-foreground opacity-0 shadow-lg shadow-black/10 transition-opacity duration-150 group-hover:opacity-100">
                  {t(item.key)}
                  {careBadge > 0 ? (
                    <span className="ml-2 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                      {careBadge}
                    </span>
                  ) : null}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/80 p-2.5">
        <button
          onClick={handleLogout}
          className={cn(
            'group relative flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-sm font-semibold text-muted-foreground transition',
            'hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-500',
            !isOpen && 'justify-center px-0'
          )}
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0 transition group-hover:-translate-x-0.5" />
          {isOpen ? <span>{t('logout')}</span> : null}

          {!isOpen ? (
            <div className="pointer-events-none absolute left-full ml-3 rounded-xl border border-border/80 bg-[var(--surface-raised)] px-3 py-2 text-xs font-medium text-foreground opacity-0 shadow-lg shadow-black/10 transition-opacity duration-150 group-hover:opacity-100">
              {t('logout')}
            </div>
          ) : null}
        </button>
      </div>
    </aside>
  );
}
