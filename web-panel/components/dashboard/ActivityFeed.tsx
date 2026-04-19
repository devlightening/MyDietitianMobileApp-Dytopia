'use client';

import { useQuery } from '@tanstack/react-query';
import { getActivityFeed, ActivityFeedItem } from '@/lib/api/dashboard';
import {
  Activity,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChefHat,
  Clock,
  Crown,
  Droplets,
  Dumbbell,
  Flame,
  Gift,
  LucideIcon,
  MinusCircle,
  Rabbit,
  Ruler,
  Shuffle,
  Siren,
  Sparkles,
  Trophy,
  User,
  Utensils,
  Weight,
} from 'lucide-react';

const ICON_MAP: Record<ActivityFeedItem['type'], LucideIcon> = {
  client_linked:      User,
  login:              User,
  meal_logged:        Utensils,
  meal_alternative:   Shuffle,
  meal_skipped:       MinusCircle,
  kitchen_used:       ChefHat,
  water_goal_hit:     Droplets,
  measurement_logged: Ruler,
  weight_update:      Weight,
  plan_assigned:      Calendar,
  compliance:         CheckCircle2,
  badge_unlocked:     Trophy,
  streak_milestone:   Flame,
  streak_at_risk:     Siren,
};

const COLOR_MAP: Record<ActivityFeedItem['type'], { bg: string; color: string }> = {
  client_linked:      { bg: 'rgba(71, 185, 114, 0.12)',  color: 'var(--brand-emerald)' },
  login:              { bg: 'rgba(71, 185, 114, 0.12)',  color: 'var(--brand-emerald)' },
  meal_logged:        { bg: 'rgba(87, 184, 199, 0.12)',  color: 'var(--brand-accent)'  },
  meal_alternative:   { bg: 'rgba(227, 196, 93, 0.12)', color: '#b99426'               },
  meal_skipped:       { bg: 'rgba(229, 126, 107, 0.10)', color: 'var(--brand-coral)'   },
  kitchen_used:       { bg: 'rgba(87, 184, 199, 0.12)',  color: 'var(--brand-accent)'  },
  water_goal_hit:     { bg: 'rgba(87, 184, 199, 0.16)',  color: 'var(--brand-accent)'  },
  measurement_logged: { bg: 'rgba(227, 196, 93, 0.14)', color: '#b99426'               },
  weight_update:      { bg: 'rgba(227, 196, 93, 0.14)', color: '#b99426'               },
  plan_assigned:      { bg: 'rgba(122, 141, 214, 0.12)', color: '#6f82d8'              },
  compliance:         { bg: 'rgba(71, 185, 114, 0.12)',  color: 'var(--brand-emerald)' },
  badge_unlocked:     { bg: 'rgba(227, 196, 93, 0.14)', color: '#b99426'               },
  streak_milestone:   { bg: 'rgba(229, 126, 107, 0.12)', color: 'var(--brand-coral)'  },
  streak_at_risk:     { bg: 'rgba(229, 126, 107, 0.12)', color: 'var(--brand-coral)'  },
};

type BadgeVisual = {
  label: string;
  Icon: LucideIcon;
  bg: string;
  color: string;
};

const BADGE_VISUALS: Record<string, BadgeVisual> = {
  protein_focus: {
    label: 'Protein Canavarı',
    Icon: Dumbbell,
    bg: 'rgba(71, 185, 114, 0.12)',
    color: 'var(--brand-emerald)',
  },
  veggie_focus: {
    label: 'Sebze Dostu',
    Icon: Rabbit,
    bg: 'rgba(227, 196, 93, 0.14)',
    color: '#b99426',
  },
  kitchen_spark: {
    label: 'Mutfak Kıvılcımı',
    Icon: ChefHat,
    bg: 'rgba(87, 184, 199, 0.12)',
    color: 'var(--brand-accent)',
  },
  water_keeper: {
    label: 'Su Koruyucusu',
    Icon: Droplets,
    bg: 'rgba(87, 184, 199, 0.12)',
    color: 'var(--brand-accent)',
  },
  flex_saver: {
    label: 'Esnek Uyum',
    Icon: Shuffle,
    bg: 'rgba(227, 196, 93, 0.14)',
    color: '#b99426',
  },
  plan_keeper: {
    label: 'Plan Koruyucu',
    Icon: CalendarCheck,
    bg: 'rgba(71, 185, 114, 0.12)',
    color: 'var(--brand-emerald)',
  },
  streak_3: {
    label: '3 Günlük Seri',
    Icon: Flame,
    bg: 'rgba(229, 126, 107, 0.12)',
    color: 'var(--brand-coral)',
  },
  perfect_day: {
    label: 'Mükemmel Uyum',
    Icon: Gift,
    bg: 'rgba(87, 184, 199, 0.12)',
    color: 'var(--brand-accent)',
  },
  streak_7: {
    label: 'Haftalık Seri',
    Icon: CalendarCheck,
    bg: 'rgba(71, 185, 114, 0.12)',
    color: 'var(--brand-emerald)',
  },
  streak_14: {
    label: 'Ritim Ustası',
    Icon: Crown,
    bg: 'rgba(227, 196, 93, 0.14)',
    color: '#b99426',
  },
};

function getBadgeVisual(badgeId?: string): BadgeVisual {
  if (badgeId && BADGE_VISUALS[badgeId]) {
    return BADGE_VISUALS[badgeId];
  }

  return {
    label: 'Rozet',
    Icon: Sparkles,
    bg: 'rgba(227, 196, 93, 0.14)',
    color: '#b99426',
  };
}

function BadgeToken({ badgeId }: { badgeId?: string }) {
  const badge = getBadgeVisual(badgeId);

  return (
    <div className="group relative inline-flex flex-shrink-0">
      <div
        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 shadow-sm"
        style={{ background: badge.bg, color: badge.color }}
        aria-label={badge.label}
        title={badge.label}
      >
        <badge.Icon className="h-4 w-4" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {badge.label}
      </div>
    </div>
  );
}

function getDescription(activity: ActivityFeedItem): string {
  switch (activity.type) {
    case 'client_linked':
      return activity.metadata?.note || 'kliniğe bağlandı';
    case 'login':
      return 'uygulamaya giriş yaptı';
    case 'meal_logged':
      return activity.metadata?.mealName
        ? `öğünü tamamladı: ${activity.metadata.mealName}`
        : 'öğünü tamamladı';
    case 'meal_alternative':
      return activity.metadata?.alternativeRecipeName
        ? `alternatif öğün seçti: ${activity.metadata.alternativeRecipeName}`
        : activity.metadata?.mealName
        ? `alternatif öğün seçti (${activity.metadata.mealName})`
        : 'alternatif öğün seçti';
    case 'meal_skipped':
      return activity.metadata?.mealName
        ? `bir öğünü atladı (${activity.metadata.mealName})`
        : 'bir öğünü atladı';
    case 'kitchen_used':
      return activity.metadata?.recipeName
        ? `mutfak kullandı: ${activity.metadata.recipeName}`
        : 'mutfak kullandı';
    case 'water_goal_hit':
      return activity.metadata?.glasses
        ? `${activity.metadata.glasses} bardak su içti 💧`
        : 'su hedefine ulaştı 💧';
    case 'measurement_logged':
      return activity.metadata?.weight
        ? `ölçüm kaydetti: ${activity.metadata.weight} kg`
        : 'ölçüm kaydetti';
    case 'weight_update':
      return `kilo güncelledi: ${activity.metadata?.weight || 0} kg`;
    case 'plan_assigned':
      return `plana atandı: ${activity.metadata?.planName || ''}`;
    case 'compliance':
      return `uyum oranı: %${activity.metadata?.complianceRate || 0}`;
    case 'badge_unlocked':
      return 'yeni rozet kazandı';
    case 'streak_milestone':
      return `${activity.metadata?.currentStreak || 0} günlük seri seviyesine ulaştı`;
    case 'streak_at_risk':
      return 'günlük ritim zayıflıyor';
    default:
      return 'bir hareket gerçekleştirdi';
  }
}

function formatTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMinutes < 1) return 'Az önce';
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;

  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours} sa önce`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;

  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function ActivityFeed() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => getActivityFeed(15),
    refetchInterval: 30000,
  });

  return (
    <section className="card-sfcos h-full p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Canlı akış</h2>
            <p className="text-sm text-muted-foreground">Danışan hareketleri ve uygulamadan gelen son olaylar</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          30 sn yenilenir
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-start gap-3 rounded-2xl bg-surface-overlay px-4 py-4">
              <div className="h-10 w-10 rounded-2xl shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded-xl shimmer" />
                <div className="h-3 w-1/3 rounded-xl shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : !activities || activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-overlay px-6 py-12 text-center">
          <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-semibold text-foreground">Henüz aktivite kaydı yok</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Uygulama kullanımı arttıkça bu alan daha anlamlı hale gelecek.
          </p>
        </div>
      ) : (
        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {activities.map((activity) => {
            const Icon = ICON_MAP[activity.type] ?? Clock;
            const colors = COLOR_MAP[activity.type] ?? {
              bg: 'rgba(24, 51, 36, 0.05)',
              color: 'hsl(var(--muted-foreground))',
            };

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-2xl border border-border/80 bg-white/70 px-4 py-4 transition hover:border-primary/15 hover:bg-primary/5"
              >
                <div
                  className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: colors.bg, color: colors.color }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm leading-6 text-foreground">
                      <span className="font-semibold">{activity.clientName}</span> {getDescription(activity)}
                    </p>
                    {activity.type === 'badge_unlocked' ? (
                      <BadgeToken badgeId={activity.metadata?.badgeId} />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatTime(activity.timestamp)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
