"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarPlus,
  ChefHat,
  Clock,
  Key,
  MapPin,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { getDashboardStats } from '@/lib/api/dashboard';
import { getCareHubSummary, type CareHubSummaryResponse } from '@/lib/api/care-hub';
import { getDietitianGamificationSummary } from '@/lib/api/gamification';
import { getDietitianAppointments, type DietitianAppointment } from '@/lib/api/appointments';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Günaydın';
  if (hour < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

function formatTime(utc: string) {
  return new Date(utc).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(utc: string): string {
  const diff = new Date(utc).getTime() - Date.now();
  if (diff <= 0) return 'Şu an';
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} saat ${minutes} dk sonra`;
  if (hours > 0) return `${hours} saat sonra`;
  return `${minutes} dk sonra`;
}

function isToday(utc: string) {
  const d = new Date(utc);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

// ─── Reusable small components ────────────────────────────────────────────────

function StatCard({
  href,
  icon: Icon,
  label,
  value,
  description,
}: {
  href: string;
  icon: typeof Users;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <Link href={href} className="group card-sfcos interactive-card block p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value.toLocaleString('tr-TR')}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

function FocusItem({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-[var(--surface-glass)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <span className="text-sm font-semibold text-primary">{value}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

// ─── Appointments Section ─────────────────────────────────────────────────────

function AppointmentsSection({ appointments }: { appointments: DietitianAppointment[] }) {
  const now = Date.now();

  const upcoming = appointments
    .filter((a) => !a.isCancelled && new Date(a.scheduledAtUtc).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledAtUtc).getTime() - new Date(b.scheduledAtUtc).getTime());

  const next = upcoming[0] ?? null;

  const todayRest = upcoming.filter((a) => isToday(a.scheduledAtUtc)).slice(0, 6);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* ── Next Appointment Card ── */}
      {next ? (
        <Link
          href={`/dashboard/care-hub?clientId=${next.clientId}`}
          className="group relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.12)] transition hover:border-primary/35 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)]"
        >
          {/* Decorative glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">
                  Sıradaki randevu
                </p>
              </div>

              <h2 className="mt-3 truncate text-2xl font-bold text-foreground sm:text-3xl">
                {next.clientName}
              </h2>

              <p className="mt-1 text-base font-medium text-muted-foreground">{next.title}</p>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  {formatTime(next.scheduledAtUtc)}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-semibold',
                    next.mode === 'online'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
                  )}
                >
                  {next.mode === 'online' ? '● Online' : '● Yüz Yüze'}
                </span>
                {next.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {next.location}
                  </span>
                )}
              </div>
            </div>

            {/* Countdown bubble */}
            <div className="flex-shrink-0 text-right">
              <div className="inline-flex flex-col items-end rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4">
                <p className="text-3xl font-black leading-none tracking-tight text-primary">
                  {formatTime(next.scheduledAtUtc)}
                </p>
                <p className="mt-1.5 text-xs font-semibold text-primary/70">
                  {isToday(next.scheduledAtUtc)
                    ? formatCountdown(next.scheduledAtUtc)
                    : new Date(next.scheduledAtUtc).toLocaleDateString('tr-TR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                </p>
              </div>
              <p className="mt-2 flex items-center justify-end gap-1 text-xs text-muted-foreground transition group-hover:text-primary">
                Care Hub'da aç <ArrowRight className="h-3 w-3" />
              </p>
            </div>
          </div>
        </Link>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
          <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">Yaklaşan randevu yok</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Danışanlarınızla görüşme planlamak için yeni randevu oluşturun.
          </p>
          <Link
            href="/dashboard/appointments"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            <CalendarPlus className="h-4 w-4" />
            Randevu Oluştur
          </Link>
        </div>
      )}

      {/* ── Today's Schedule ── */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/80">
              Bugün
            </p>
            <h3 className="mt-1 text-base font-semibold text-foreground">
              {todayRest.length > 0
                ? `${todayRest.length} görüşme planlandı`
                : 'Görüşme yok'}
            </h3>
          </div>
          <Link
            href="/dashboard/appointments"
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/20 hover:text-primary"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Ekle
          </Link>
        </div>

        {todayRest.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">Bugün için randevu yok</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayRest.map((appt) => {
              const isPast = new Date(appt.scheduledAtUtc).getTime() < now;
              const isNext = appt.id === next?.id;
              return (
                <Link
                  key={appt.id}
                  href={`/dashboard/care-hub?clientId=${appt.clientId}`}
                  className={cn(
                    'group flex items-center gap-3 rounded-2xl border px-4 py-3 transition',
                    isNext
                      ? 'border-primary/30 bg-primary/8'
                      : isPast
                        ? 'border-border/50 bg-muted/30 opacity-60'
                        : 'border-border bg-[var(--surface-glass)] hover:border-primary/20 hover:bg-primary/5',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                      isNext ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {appt.mode === 'online' ? (
                      <Video className="h-3.5 w-3.5" />
                    ) : (
                      <Users className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm font-semibold', isNext ? 'text-primary' : 'text-foreground')}>
                      {appt.clientName}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatTime(appt.scheduledAtUtc)}</p>
                  </div>
                  {isNext && (
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                      Sıradaki
                    </span>
                  )}
                  {isPast && !isNext && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">Geçti</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        <Link
          href="/dashboard/appointments"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/20 hover:text-primary"
        >
          Tüm randevular
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}

// ─── Care Summary ─────────────────────────────────────────────────────────────

function CareSummaryCard({ careHub }: { careHub?: CareHubSummaryResponse }) {
  const threads = careHub?.threads ?? [];

  return (
    <section className="card-sfcos p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">İletişim merkezi</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">Yanıt bekleyen görüşmeler</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Yeni mesajları ve geri dönüş bekleyen görüşmeleri tek ekrandan takip edebilirsiniz.
          </p>
        </div>
        <div className="rounded-2xl border border-rose-500/15 bg-rose-500/10 px-3 py-2 text-right">
          <p className="text-2xl font-bold text-rose-500">{careHub?.unreadMessagesCount ?? 0}</p>
          <p className="text-[11px] font-semibold text-rose-400">yeni mesaj</p>
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-overlay px-5 py-8 text-center">
          <p className="text-sm font-semibold text-foreground">Yeni mesaj yok</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Danışanlar yazdığında iletişim akışı burada güncellenecek.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.slice(0, 4).map((thread) => (
            <Link
              key={thread.clientId}
              href={`/dashboard/care-hub?clientId=${thread.clientId}`}
              className="block rounded-2xl border border-border/80 bg-[var(--surface-glass)] px-4 py-3 transition hover:border-primary/15 hover:bg-primary/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{thread.clientName}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {thread.latestText || 'Görüşme hazır'}
                  </p>
                </div>
                {thread.unreadCount > 0 ? (
                  <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-500">
                    {thread.unreadCount} yeni
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function MotivationCard({ motivation }: { motivation?: any }) {
  const topClient = motivation?.clients?.[0];

  return (
    <section className="card-sfcos p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">Motivasyon</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">Uyum ritmi</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seri, rozet ve risk sinyallerini sade bir özetle takip edin.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/10 px-3 py-2 text-right">
          <p className="text-2xl font-bold text-amber-600">{motivation?.clientsAtRiskCount ?? 0}</p>
          <p className="text-[11px] font-semibold text-amber-500">riskte</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-surface-overlay px-3 py-3">
          <p className="text-xs text-muted-foreground">Aktif seri</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{motivation?.activeStreaksCount ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-surface-overlay px-3 py-3">
          <p className="text-xs text-muted-foreground">Yeni rozet</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{motivation?.newUnlocksCount ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-surface-overlay px-3 py-3">
          <p className="text-xs text-muted-foreground">Riskte</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{motivation?.clientsAtRiskCount ?? 0}</p>
        </div>
      </div>

      {topClient ? (
        <Link
          href={`/dashboard/clients/${topClient.clientId}?tab=notes`}
          className="mt-4 block rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4 transition hover:border-primary/25 hover:bg-primary/10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Öne çıkan danışan</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{topClient.clientName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {topClient.currentStreak} gün seri, {topClient.earnedBadgeCount} rozet
          </p>
        </Link>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface-overlay px-4 py-5 text-sm text-muted-foreground">
          Motivasyon verileri geldikçe burada öncelikli danışanlar listelenecek.
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    retry: 1,
  });

  const { data: careHub } = useQuery({
    queryKey: ['care-hub-summary', 'dashboard'],
    queryFn: () => getCareHubSummary(5),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const { data: motivation } = useQuery({
    queryKey: ['dietitian-gamification-summary', 'dashboard'],
    queryFn: () => getDietitianGamificationSummary(6),
    refetchInterval: 20000,
    staleTime: 10000,
  });

  // Fetch upcoming appointments for the next 14 days
  const today = new Date();
  const twoWeeksLater = new Date(today);
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

  const { data: appointments = [] } = useQuery({
    queryKey: ['dietitian-appointments', 'dashboard'],
    queryFn: () =>
      getDietitianAppointments({
        from: today.toISOString(),
        to: twoWeeksLater.toISOString(),
        limit: 20,
      }),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (isError && !stats) {
    return (
      <div className="card-sfcos flex flex-col items-center gap-4 p-12 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Panel verileri alınamadı</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sunucu şu anda yanıt vermiyor olabilir. Sayfayı yenileyip tekrar deneyin.
          </p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-primary">
          Sayfayı yenile
        </button>
      </div>
    );
  }

  const totalClientsCount = stats?.totalClientsCount ?? 0;
  const accessKeyCount = stats?.accessKeyCount ?? 0;
  const recipeCount = stats?.recipeCount ?? 0;
  const activeClientsCount = stats?.activeClientsCount ?? 0;

  const nextAppt = appointments
    .filter((a) => !a.isCancelled && new Date(a.scheduledAtUtc).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduledAtUtc).getTime() - new Date(b.scheduledAtUtc).getTime())[0];

  const todayApptCount = appointments.filter(
    (a) => !a.isCancelled && isToday(a.scheduledAtUtc),
  ).length;

  return (
    <div className="space-y-8">
      {/* ── Hero ── */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="card-premium p-7 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-glass)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary/85">
                <Sparkles className="h-3.5 w-3.5" />
                {formatGreeting()}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Bugünkü klinik görünümü
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Danışan hareketlerini, plan durumunu ve iletişim trafiğini bu ekrandan takip
                edebilirsiniz. Öncelikli başlıklar ve güncel sayaçlar burada yer alır.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/clients" className="btn-primary">
                <Users className="h-4 w-4" />
                Danışanları aç
              </Link>
              <Link href="/dashboard/appointments" className="btn-ghost">
                <CalendarDays className="h-4 w-4" />
                Randevular
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-[var(--surface-glass)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">İletişim</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{careHub?.unreadMessagesCount ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">Yanıt bekleyen mesaj</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[var(--surface-glass)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Aktif takip</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{activeClientsCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Bugün planla ilerleyen danışan</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[var(--surface-glass)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Bugün randevu</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{todayApptCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {nextAppt
                  ? `Sıradaki: ${formatTime(nextAppt.scheduledAtUtc)}`
                  : 'Planlanmış görüşme yok'}
              </p>
            </div>
          </div>
        </div>

        <aside className="card-sfcos p-5">
          <div className="flex items-center gap-2 text-primary">
            <Bell className="h-4 w-4" />
            <p className="text-sm font-semibold">Bugün öncelikli başlıklar</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Günlük operasyon sırasında önce bakılması gereken alanlar.
          </p>

          <div className="mt-5 space-y-3">
            <FocusItem
              title="Sıradaki randevu"
              value={nextAppt ? formatTime(nextAppt.scheduledAtUtc) : '—'}
              note={
                nextAppt
                  ? `${nextAppt.clientName} · ${isToday(nextAppt.scheduledAtUtc) ? formatCountdown(nextAppt.scheduledAtUtc) : new Date(nextAppt.scheduledAtUtc).toLocaleDateString('tr-TR', { weekday: 'long' })}`
                  : 'Yaklaşan randevu yok.'
              }
            />
            <FocusItem
              title="Mesaj takibi"
              value={`${careHub?.clientsWithUnreadCount ?? 0} kişi`}
              note="Yeni yazan danışanları iletişim ekranında önceleyin."
            />
            <FocusItem
              title="Erişim anahtarları"
              value={`${accessKeyCount}`}
              note="Süresi bitecek premium kullanıcılar için uzatma planlayın."
            />
            <FocusItem
              title="Tarif kütüphanesi"
              value={`${recipeCount}`}
              note="Güncel tarifler plan oluşturma sürecini hızlandırır."
            />
          </div>
        </aside>
      </section>

      {/* ── Appointments — most prominent section ── */}
      <AppointmentsSection appointments={appointments} />

      {/* ── Stat Cards ── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          href="/dashboard/clients"
          icon={Users}
          label="Toplam danışan"
          value={totalClientsCount}
          description={isLoading ? 'Veriler yükleniyor' : 'Bağlı danışanlarınızın toplam sayısı'}
        />
        <StatCard
          href="/dashboard/appointments"
          icon={CalendarDays}
          label="Bugün randevu"
          value={todayApptCount}
          description="Bugün için planlanmış görüşme sayısı"
        />
        <StatCard
          href="/dashboard/access-keys"
          icon={Key}
          label="Erişim anahtarı"
          value={accessKeyCount}
          description="Kullanımda olan veya hazır bekleyen premium anahtarlar"
        />
        <StatCard
          href="/dashboard/recipes"
          icon={ChefHat}
          label="Tarif kütüphanesi"
          value={recipeCount}
          description="Plan hazırlarken kullanılan kayıtlı tarifler"
        />
      </section>

      {/* ── Activity + Care + Motivation ── */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <ActivityFeed />

        <div className="space-y-6">
          <CareSummaryCard careHub={careHub} />
          <MotivationCard motivation={motivation} />
        </div>
      </section>
    </div>
  );
}
