"use client";

import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { ChefHat, Key, Users, TrendingUp, Plus, Search, Settings, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const quickActions = [
  {
    href: '/dashboard/recipes/create',
    icon: ChefHat,
    label: 'Tarif Oluştur',
    desc: 'Yeni özel tarif ekle',
    color: 'kpi-sage',
  },
  {
    href: '/dashboard/access-keys',
    icon: Key,
    label: 'Erişim Anahtarı',
    desc: 'Danışan premium aktivasyon',
    color: 'kpi-coral',
  },
  {
    href: '/dashboard/recipe-match',
    icon: Search,
    label: 'Tarif Eşleştir',
    desc: 'Sepet bazlı tarif bul',
    color: 'kpi-forest',
  },
  {
    href: '/dashboard/settings/branding',
    icon: Settings,
    label: 'Klinik Branding',
    desc: 'Logo & renk ayarları',
    color: 'kpi-oat',
  },
];

export default function DashboardPage() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    retry: 1,
    meta: {
      errorMessage: 'İstatistikler yüklenemedi. Lütfen sayfayı yenileyin.'
    }
  });

  if (isError && !stats) {
    return (
      <div className="p-12 text-center card-premium">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-foreground">Veriler Yüklenemedi</h2>
        <p className="text-muted-foreground mt-2">Sunucu ile bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edin.</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-action text-action-foreground rounded-xl font-semibold shadow-md active:scale-95 transition-all"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  // Derive pending invites from access key count for display
  const pendingInvites = stats?.accessKeyCount ?? 0;

  // Demo-friendly fallbacks
  const isDemoMode = !isLoading && (!stats || (stats.totalClientsCount === 0 && stats.recipeCount === 0));

  return (
    <div className="space-y-8 fade-in">
      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gradient-sage">Kontrol Paneli</h1>
            {isDemoMode && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                LOCAL DEMO MODE
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {isDemoMode ? 'Örnek verilerle kontrol panelini keşfedin' : 'Danışan yönetimi ve tarif kütüphanenize genel bakış'}
          </p>
        </div>
        <Link
          href="/dashboard/recipes/create"
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold',
            'bg-action text-action-foreground',
            'hover:opacity-90 active:scale-95 transition-all duration-150',
            'shadow-md hover:shadow-lg'
          )}
        >
          <Plus className="w-4 h-4" />
          Yeni Tarif
        </Link>
      </div>

      {/* ── KPI Row ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Toplam Danışan"
          value={stats?.totalClientsCount || (isDemoMode ? 12 : 0)}
          subtitle={isDemoMode ? "Örnek Veri" : "Bağlı danışanlar"}
          icon={Users}
          href="/dashboard/clients"
          loading={isLoading}
          colorVar="sage"
        />
        <KPICard
          title="Aktif Erişim Anahtarı"
          value={pendingInvites || (isDemoMode ? 4 : 0)}
          subtitle={isDemoMode ? "Örnek Veri" : "Aktif premium hesaplar"}
          icon={Key}
          href="/dashboard/access-keys"
          loading={isLoading}
          colorVar="coral"
        />
        <KPICard
          title="Tariflerim"
          value={stats?.recipeCount || (isDemoMode ? 48 : 0)}
          subtitle={isDemoMode ? "Örnek Veri" : "Özel & herkese açık"}
          icon={ChefHat}
          href="/dashboard/recipes"
          loading={isLoading}
          colorVar="forest"
        />
        <KPICard
          title="Aktif Danışan"
          value={stats?.activeClientsCount || (isDemoMode ? 3 : 0)}
          subtitle={isDemoMode ? "Örnek Veri" : "Bugün aktif premium"}
          icon={TrendingUp}
          href="/dashboard/clients"
          loading={isLoading}
          colorVar="oat"
        />
      </div>

      {/* ── Main Content Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Activity Feed — takes 2 cols */}
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>

        {/* Quick Actions sidebar */}
        <div className="space-y-4">
          <div className="card-premium p-5">
            <h3 className="text-base font-semibold text-foreground mb-1">Hızlı İşlemler</h3>
            <p className="text-xs text-muted-foreground mb-4">Sık kullanılan kısayollar</p>
            <div className="space-y-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-colors group"
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110',
                      action.color
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground leading-tight">{action.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{action.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Demo tip card */}
          <div className="card-premium p-5 border-l-4 border-l-accent">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-1">Demo İpucu</p>
            <p className="text-sm text-foreground font-medium">Tarif Eşleştirme</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Danışanın mutfağındaki malzemeleri girerek en uygun tarifleri anında keşfedin.
            </p>
            <Link
              href="/dashboard/recipe-match"
              className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-action hover:underline"
            >
              Dene <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
