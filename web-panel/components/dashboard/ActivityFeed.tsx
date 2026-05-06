'use client';

import { useQuery } from '@tanstack/react-query';
import { getActivityFeed } from '@/lib/api/dashboard';
import {
  getActivityDescription,
  getActivityDetails,
  parseActivityMetadata,
  type ActivityType,
} from '@/lib/activity-format';
import {
  Activity,
  Bell,
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
  PackageCheck,
  Rabbit,
  Ruler,
  Shuffle,
  Siren,
  Sparkles,
  ShoppingCart,
  Trophy,
  User,
  Utensils,
  Weight,
} from 'lucide-react';

const ICON_MAP: Record<ActivityType, LucideIcon> = {
  client_linked: User,
  login: User,
  meal_logged: Utensils,
  meal_done: Utensils,
  meal_selection: Shuffle,
  meal_recipe_selected: Shuffle,
  meal_feedback: CheckCircle2,
  meal_feedback_saved: CheckCircle2,
  meal_alternative: Shuffle,
  meal_skipped: MinusCircle,
  kitchen_used: ChefHat,
  shopping_list: ShoppingCart,
  pantry: PackageCheck,
  notification_preferences: Bell,
  water_goal_hit: Droplets,
  measurement_logged: Ruler,
  weight_update: Weight,
  plan_assigned: Calendar,
  plan_updated: Calendar,
  compliance: CheckCircle2,
  badge_unlocked: Trophy,
  streak_milestone: Flame,
  streak_at_risk: Siren,
};

const COLOR_MAP: Record<ActivityType, { bg: string; color: string }> = {
  client_linked: { bg: 'var(--brand-primary-soft)', color: 'var(--brand-emerald)' },
  login: { bg: 'var(--brand-primary-soft)', color: 'var(--brand-emerald)' },
  meal_logged: { bg: 'var(--brand-accent-soft)', color: 'var(--brand-accent)' },
  meal_done: { bg: 'var(--brand-accent-soft)', color: 'var(--brand-accent)' },
  meal_selection: { bg: 'rgba(227, 196, 93, 0.12)', color: '#b99426' },
  meal_recipe_selected: { bg: 'rgba(227, 196, 93, 0.12)', color: '#b99426' },
  meal_feedback: { bg: 'var(--brand-primary-soft)', color: 'var(--brand-emerald)' },
  meal_feedback_saved: { bg: 'var(--brand-primary-soft)', color: 'var(--brand-emerald)' },
  meal_alternative: { bg: 'rgba(227, 196, 93, 0.12)', color: '#b99426' },
  meal_skipped: { bg: 'rgba(229, 126, 107, 0.10)', color: 'var(--brand-coral)' },
  kitchen_used: { bg: 'var(--brand-accent-soft)', color: 'var(--brand-accent)' },
  shopping_list: { bg: 'rgba(122, 141, 214, 0.12)', color: '#6f82d8' },
  pantry: { bg: 'var(--brand-primary-soft)', color: 'var(--brand-emerald)' },
  notification_preferences: { bg: 'rgba(122, 141, 214, 0.12)', color: '#6f82d8' },
  water_goal_hit: { bg: 'var(--preview-accent-soft)', color: 'var(--brand-accent)' },
  measurement_logged: { bg: 'rgba(227, 196, 93, 0.14)', color: '#b99426' },
  weight_update: { bg: 'rgba(227, 196, 93, 0.14)', color: '#b99426' },
  plan_assigned: { bg: 'rgba(122, 141, 214, 0.12)', color: '#6f82d8' },
  plan_updated: { bg: 'rgba(122, 141, 214, 0.12)', color: '#6f82d8' },
  compliance: { bg: 'var(--brand-primary-soft)', color: 'var(--brand-emerald)' },
  badge_unlocked: { bg: 'rgba(227, 196, 93, 0.14)', color: '#b99426' },
  streak_milestone: { bg: 'rgba(229, 126, 107, 0.12)', color: 'var(--brand-coral)' },
  streak_at_risk: { bg: 'rgba(229, 126, 107, 0.12)', color: 'var(--brand-coral)' },
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
    bg: 'var(--brand-primary-soft)',
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
    bg: 'var(--brand-accent-soft)',
    color: 'var(--brand-accent)',
  },
  water_keeper: {
    label: 'Su Koruyucusu',
    Icon: Droplets,
    bg: 'var(--brand-accent-soft)',
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
    bg: 'var(--brand-primary-soft)',
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
    bg: 'var(--brand-accent-soft)',
    color: 'var(--brand-accent)',
  },
  streak_7: {
    label: 'Haftalık Seri',
    Icon: CalendarCheck,
    bg: 'var(--brand-primary-soft)',
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
        className="inline-flex h-11 w-11 items-center justify-center rounded-[1.25rem] border border-white/80 shadow-[0_10px_26px_rgba(185,148,38,0.16)] ring-4 ring-white/65"
        style={{ background: badge.bg, color: badge.color }}
        aria-label={badge.label}
        title={badge.label}
      >
        <badge.Icon className="h-5 w-5" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {badge.label}
      </div>
    </div>
  );
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

function readMetaText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildMealActivityDescription(type: string, meta: Record<string, unknown>): string | null {
  const mealTitle = readMetaText(meta.mealTitle) || readMetaText(meta.mealName) || readMetaText(meta.plannedRecipeName);
  const selectedRecipeName =
    readMetaText(meta.selectedRecipeName) ||
    readMetaText(meta.completedRecipeName) ||
    readMetaText(meta.alternativeRecipeName) ||
    readMetaText(meta.recipeName);
  const plannedRecipeName = readMetaText(meta.plannedRecipeName) || mealTitle;
  const completedSource = readMetaText(meta.completedRecipeSource);
  const feedbackRecipeName = readMetaText(meta.feedbackRecipeName) || selectedRecipeName;
  const feedbackRecipeSource = readMetaText(meta.feedbackRecipeSource);
  const feedbackLabel = readMetaText(meta.feedbackLabel);

  if (type === 'meal_selection' || type === 'meal_recipe_selected') {
    if (meta.selectedRecipeSource === 'Alternative') {
      return `${mealTitle || 'Bu öğün'} için alternatif seçildi: ${selectedRecipeName || 'Seçilen tarif'}`;
    }
    return `${mealTitle || 'Bu öğün'} için planlanan tarife dönüldü`;
  }

  if (type === 'meal_alternative' || ((type === 'meal_done' || type === 'meal_logged') && completedSource === 'Alternative')) {
    return `${plannedRecipeName || mealTitle || 'Bu öğün'} için alternatif olarak ${selectedRecipeName || 'seçilen tarif'} yapıldı`;
  }

  if (type === 'meal_feedback' || type === 'meal_feedback_saved') {
    const targetLabel = feedbackRecipeSource === 'Alternative' ? 'alternatif tarif' : 'planlanan tarif';
    const recipeLabel = feedbackRecipeName || plannedRecipeName || mealTitle || 'öğün';
    return feedbackLabel
      ? `${recipeLabel} için ${targetLabel} değerlendirildi: ${feedbackLabel}`
      : `${recipeLabel} için ${targetLabel} değerlendirildi`;
  }

  return null;
}

function buildMealActivityDetails(type: string, meta: Record<string, unknown>): string[] | null {
  const details: string[] = [];
  const mealTime = readMetaText(meta.mealTime);
  const mealType = readMetaText(meta.mealType);
  const plannedRecipeName = readMetaText(meta.plannedRecipeName);
  const selectedRecipeName =
    readMetaText(meta.selectedRecipeName) ||
    readMetaText(meta.completedRecipeName) ||
    readMetaText(meta.alternativeRecipeName);
  const completedSource = readMetaText(meta.completedRecipeSource);
  const feedbackRecipeName = readMetaText(meta.feedbackRecipeName) || selectedRecipeName;
  const feedbackRecipeSource = readMetaText(meta.feedbackRecipeSource);
  const feedbackLabel = readMetaText(meta.feedbackLabel);

  if (mealTime) details.push(`Saat ${mealTime}`);
  if (mealType) details.push(mealType);

  if (type === 'meal_selection' || type === 'meal_recipe_selected') {
    if (plannedRecipeName) details.push(`Planlanan: ${plannedRecipeName}`);
    if (selectedRecipeName) details.push(`Seçilen: ${selectedRecipeName}`);
    if (meta.selectedRecipeSource === 'Alternative') details.push('Alternatif tercih');
    return details;
  }

  if (type === 'meal_alternative' || ((type === 'meal_done' || type === 'meal_logged') && completedSource === 'Alternative')) {
    if (plannedRecipeName) details.push(`Planlanan: ${plannedRecipeName}`);
    if (selectedRecipeName) details.push(`Yapılan: ${selectedRecipeName}`);
    details.push('Alternatif yapıldı');
    return details;
  }

  if (type === 'meal_feedback' || type === 'meal_feedback_saved') {
    if (plannedRecipeName && feedbackRecipeSource === 'Alternative') details.push(`Planlanan: ${plannedRecipeName}`);
    if (feedbackRecipeName) details.push(`${feedbackRecipeSource === 'Alternative' ? 'Değerlendirilen' : 'Tarif'}: ${feedbackRecipeName}`);
    if (feedbackRecipeSource) details.push(feedbackRecipeSource === 'Alternative' ? 'Alternatif yüz' : 'Planlanan yüz');
    if (feedbackLabel) details.push(feedbackLabel);
    return details;
  }

  return null;
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
            const meta = parseActivityMetadata(activity.metadata);
            const descriptionOverride = buildMealActivityDescription(activity.type, meta);
            const detailOverride = buildMealActivityDetails(activity.type, meta);
            const details = detailOverride ?? getActivityDetails(activity.type, meta);
            const isBadgeActivity = activity.type === 'badge_unlocked';
            const colors = COLOR_MAP[activity.type] ?? {
              bg: 'rgba(24, 51, 36, 0.05)',
              color: 'hsl(var(--muted-foreground))',
            };

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-2xl border border-border/80 bg-white/70 px-4 py-4 transition hover:border-primary/15 hover:bg-primary/5"
              >
                {isBadgeActivity ? (
                  <BadgeToken badgeId={typeof meta.badgeId === 'string' ? meta.badgeId : undefined} />
                ) : (
                  <div
                    className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: colors.bg, color: colors.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm leading-6 text-foreground">
                      <span className="font-semibold">{activity.clientName}</span>{' '}
                      {descriptionOverride ?? getActivityDescription(activity.type, meta)}
                    </p>
                  </div>
                  {details.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {details.map((detail) => (
                        <span
                          key={detail}
                          className="rounded-full bg-surface-overlay px-2 py-1 text-[11px] font-medium text-muted-foreground"
                        >
                          {detail}
                        </span>
                      ))}
                    </div>
                  ) : null}
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
