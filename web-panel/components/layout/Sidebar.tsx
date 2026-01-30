"use client";

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ChefHat,
  Key,
  LogOut,
  Users,
  Plus,
  Search,
  Pin,
  PinOff
} from 'lucide-react';
import { logout } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSidebar } from '@/contexts/SidebarContext';

const menuItems = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'recipes', href: '/dashboard/recipes', icon: ChefHat },
  { key: 'createRecipe', href: '/dashboard/recipes/create', icon: Plus },
  { key: 'recipeMatch', href: '/dashboard/recipe-match', icon: Search, badge: 'NEW' },
  { key: 'clients', href: '/dashboard/clients', icon: Users },
  { key: 'accessKeys', href: '/dashboard/access-keys', icon: Key },
];

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 240;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('common');
  const { isLocked, isHovered, isOpen, toggleLock, setHovered } = useSidebar();

  const handleLogout = async () => {
    queryClient.clear();
    await logout();
    router.replace('/auth/login');
    router.refresh();
  };

  const handleMouseEnter = () => {
    if (!isLocked) {
      setHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isLocked) {
      setHovered(false);
    }
  };

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'h-full bg-card border-r border-border/50 flex flex-col transition-all duration-200 ease-in-out',
        'fixed left-0 top-0 z-40',
        isOpen ? 'w-60' : 'w-16',
        // Add shadow when hovering (unlocked state)
        !isLocked && isHovered && 'shadow-xl'
      )}
      style={{
        width: isOpen ? `${EXPANDED_WIDTH}px` : `${COLLAPSED_WIDTH}px`
      }}
    >
      {/* Logo Section */}
      <div className={cn(
        'h-16 flex items-center border-b border-border/50 transition-all duration-200',
        isOpen ? 'justify-between px-4' : 'justify-center px-2'
      )}>
        {!isOpen ? (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">MD</span>
          </div>
        ) : (
          <>
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:bg-primary/90 transition-colors">
                <span className="text-primary-foreground font-bold text-sm">MD</span>
              </div>
              <span className="font-semibold text-lg text-foreground">MyDietitian</span>
            </Link>

            {/* Lock/Pin Button */}
            <button
              onClick={toggleLock}
              className={cn(
                'p-1.5 rounded-md transition-all duration-200',
                'hover:bg-accent',
                isLocked ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-label={isLocked ? 'Unlock sidebar' : 'Lock sidebar'}
              title={isLocked ? 'Unlock sidebar' : 'Lock sidebar'}
            >
              {isLocked ? (
                <Pin className="w-4 h-4 transition-transform duration-200 hover:scale-110" />
              ) : (
                <PinOff className="w-4 h-4 transition-transform duration-200 hover:scale-110" />
              )}
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative group',
                'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                isActive && 'bg-primary/10 text-primary font-medium',
                !isOpen && 'justify-center px-0'
              )}
            >
              {isActive && isOpen && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
              )}
              <Icon className={cn(
                'w-5 h-5 flex-shrink-0',
                isActive && 'text-primary'
              )} />
              {isOpen && (
                <div className="flex items-center gap-2 flex-1">
                  <span className={cn(
                    'text-sm',
                    isActive && 'font-medium'
                  )}>{t(item.key)}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-xs font-semibold bg-primary text-primary-foreground rounded">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
              {!isOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-md text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                  {t(item.key)}
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
            !isOpen && 'justify-center px-0'
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0 group-hover:text-destructive" />
          {isOpen && (
            <span className="text-sm font-medium">{t('logout')}</span>
          )}
          {!isOpen && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-md text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
              {t('logout')}
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
