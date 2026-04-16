'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Check,
  ChefHat,
  CreditCard,
  Crown,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import { getSettings } from '@/lib/api/settings';
import { SettingsCard } from '@/components/settings/SettingsCard';

const includedFeatures = [
  { icon: Users, label: 'Danışan yönetimi ve durum takibi' },
  { icon: LayoutDashboard, label: 'Dashboard ve operasyon görünümü' },
  { icon: ChefHat, label: 'Plan oluşturma ve yayınlama akışı' },
  { icon: KeyRound, label: 'Premium erişim anahtarı yönetimi' },
  { icon: MessageSquare, label: 'Care Hub mesaj akışı' },
  { icon: BarChart3, label: 'Uyum, ilerleme ve takip özetleri' },
] as const;

export default function SubscriptionPage() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Abonelik</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Plan durumu ve lisans kapsamı</p>
        </div>
        <Link
          href="/iletisim"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <MessageSquare className="h-4 w-4" />
          İletişime Geç
        </Link>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <SettingsCard
            icon={CreditCard}
            title="Mevcut plan"
            description="Panelinizin açık olan lisans durumu ve erişim kapsamı."
            className="rounded-[28px] border-emerald-100 shadow-[0_16px_48px_-40px_rgba(16,185,129,0.35)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                  <Crown className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {isLoading ? 'Klinik yükleniyor...' : settings?.clinicName || 'Klinik paneli'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Beta erişim planı</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Aktif
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  Beta
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Lisans türü
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Beta erişim</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Kullanım durumu
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Süre sınırı olmadan açık</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Destek seviyesi
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Standart ürün desteği</p>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Sparkles}
            title="Plan kapsamı"
            description="Mevcut erişiminizle kullanabildiğiniz temel yönetim modülleri."
            className="rounded-[28px] border-slate-200 shadow-sm"
          >
            <div className="grid gap-3 md:grid-cols-2">
              {includedFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.label}
                    className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-4"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{feature.label}</p>
                    </div>
                    <Check className="ml-auto h-4 w-4 shrink-0 text-emerald-600" />
                  </div>
                );
              })}
            </div>
          </SettingsCard>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-6 shadow-[0_16px_48px_-40px_rgba(245,158,11,0.28)]">
            <h2 className="text-base font-semibold text-slate-900">Premium geçişi</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Daha ileri raporlama, öncelikli destek ve kurumsal onboarding talepleri için satış
              ekibiyle görüşebilirsiniz.
            </p>

            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-amber-500" />
                Öncelikli destek ve kurulum desteği
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-amber-500" />
                İleri seviye raporlama ihtiyaçları için değerlendirme
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-amber-500" />
                Ekip kullanımı ve ölçekleme planlaması
              </li>
            </ul>

            <a
              href="mailto:sales@mydietitian.com?subject=Premium Plan Talebi"
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              Premium plan için iletişime geç
            </a>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Not</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Plan durumu ve ticari kapsam ileride ürün tarafında daha ayrıntılı olarak
              yönetilecektir. Bu ekran şu an lisans görünürlüğü ve destek yönlendirmesi için
              hazırlanmıştır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
