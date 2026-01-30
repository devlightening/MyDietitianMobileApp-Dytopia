"use client";

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Package,
  LogOut
} from 'lucide-react';
import { logout } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

const adminMenuItems = [
  { key: 'ingredients', href: '/admin/ingredients', icon: Package },
];

export function AdminSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('common');
  const tAdmin = useTranslations('admin.ingredients');

  const handleLogout = async () => {
    queryClient.clear();
    await logout();
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <aside className={cn(
      'h-full bg-card border-r border-border/50 flex flex-col transition-all fixed left-0 top-0 z-40',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo Section */}
      <div className={cn(
        'h-16 flex items-center px-4 border-b border-border/50',
        collapsed && 'justify-center px-0'
      )}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">AD</span>
          </div>
        ) : (
          <Link href="/admin/ingredients" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:bg-primary/90 transition-colors">
              <span className="text-primary-foreground font-bold text-sm">AD</span>
            </div>
            <span className="font-semibold text-lg text-foreground">Admin Panel</span>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto">
        {adminMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || 
            (item.href !== '/admin/ingredients' && pathname?.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative group',
                'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                isActive && 'bg-primary/10 text-primary font-medium',
                collapsed && 'justify-center px-0'
              )}
            >
              {isActive && !collapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
              )}
              <Icon className={cn(
                'w-5 h-5 flex-shrink-0',
                isActive && 'text-primary'
              )} />
              {!collapsed && (
                <span className={cn(
                  'text-sm',
                  isActive && 'font-medium'
                )}>{tAdmin('title')}</span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-md text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                  {tAdmin('title')}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-3 border-t border-border/50">
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
            'hover:bg-destructive/10 text-muted-foreground hover:text-destructive',
            'group',
            collapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0 group-hover:text-destructive" />
          {!collapsed && (
            <span className="text-sm font-medium">{t('logout')}</span>
          )}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-md text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
              {t('logout')}
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

