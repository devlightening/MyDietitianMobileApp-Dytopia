import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Language } from "../context/I18nContext";
import type { GamificationSummaryDTO } from "../api/gamification";

export type MotivationBadgeId =
  | "protein_focus"
  | "veggie_focus"
  | "kitchen_spark"
  | "water_keeper"
  | "flex_saver"
  | "plan_keeper"
  | "streak_3"
  | "perfect_day"
  | "streak_7"
  | "streak_14";

export interface MotivationAchievement {
  id: string;
  progressCurrent: number;
  progressTarget: number;
  unlocked: boolean;
}

export interface DashboardMotivation {
  currentStreak: number;
  bestStreak: number;
  earnedBadgeCount: number;
  nextMilestoneDays: number;
  achievements: MotivationAchievement[];
}

export function mapGamificationToMotivation(
  summary?: GamificationSummaryDTO | null,
): DashboardMotivation | undefined {
  if (!summary) return undefined;

  return {
    currentStreak: summary.currentStreak,
    bestStreak: summary.bestStreak,
    earnedBadgeCount: summary.earnedBadgeCount,
    nextMilestoneDays: summary.nextMilestoneDays,
    achievements: summary.achievements.map((item) => ({
      id: item.id,
      progressCurrent: item.progressCurrent,
      progressTarget: item.progressTarget,
      unlocked: item.unlocked,
    })),
  };
}

type BadgeTone = "emerald" | "gold" | "coral" | "cyan";

export interface BadgeVisualMeta {
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  tone: BadgeTone;
  priority: number;
}

const badgeCatalog: Record<MotivationBadgeId, {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  tone: BadgeTone;
  priority: number;
  title: Record<Language, string>;
  subtitle: Record<Language, string>;
}> = {
  protein_focus: {
    icon: "dumbbell",
    tone: "emerald",
    priority: 92,
    title: { tr: "Protein Canavarı", en: "Protein Power" },
    subtitle: { tr: "Planın protein dengesi güçlü.", en: "Your plan is rich in protein balance." },
  },
  veggie_focus: {
    icon: "carrot",
    tone: "gold",
    priority: 88,
    title: { tr: "Sebze Dostu", en: "Veggie Friend" },
    subtitle: { tr: "Sebze ağırlıklı seçimler aktif.", en: "Vegetable-forward choices are active." },
  },
  kitchen_spark: {
    icon: "chef-hat",
    tone: "cyan",
    priority: 90,
    title: { tr: "Mutfak Kıvılcımı", en: "Kitchen Spark" },
    subtitle: { tr: "Tarif üretimi düzenli akıyor.", en: "Recipe generation is becoming a habit." },
  },
  water_keeper: {
    icon: "water",
    tone: "cyan",
    priority: 84,
    title: { tr: "Su Koruyucusu", en: "Water Keeper" },
    subtitle: { tr: "Su hedefi üst üste tutuluyor.", en: "Your hydration target is staying consistent." },
  },
  flex_saver: {
    icon: "swap-horizontal",
    tone: "gold",
    priority: 89,
    title: { tr: "Esnek Uyum", en: "Flex Saver" },
    subtitle: { tr: "Alternatif seçimle ritim korunuyor.", en: "You saved the rhythm with a smart alternative." },
  },
  plan_keeper: {
    icon: "calendar-check",
    tone: "emerald",
    priority: 94,
    title: { tr: "Plan Koruyucu", en: "Plan Keeper" },
    subtitle: { tr: "Haftalık plan ritmi kararlılıkla sürüyor.", en: "Your weekly plan rhythm is staying steady." },
  },
  streak_3: {
    icon: "fire",
    tone: "coral",
    priority: 96,
    title: { tr: "3 Günlük Seri", en: "3-Day Streak" },
    subtitle: { tr: "Ritmin artık görünür halde.", en: "Your rhythm is now visible." },
  },
  perfect_day: {
    icon: "gift-outline",
    tone: "cyan",
    priority: 100,
    title: { tr: "Mükemmel Uyum", en: "Perfect Match" },
    subtitle: { tr: "Bugünün planı eksiksiz kapandı.", en: "Today's plan closed without friction." },
  },
  streak_7: {
    icon: "calendar-star",
    tone: "emerald",
    priority: 98,
    title: { tr: "Haftalık Seri", en: "Weekly Streak" },
    subtitle: { tr: "Bir haftalık düzen yakalandı.", en: "A full week of rhythm is active." },
  },
  streak_14: {
    icon: "crown-outline",
    tone: "gold",
    priority: 99,
    title: { tr: "Ritim Ustası", en: "Rhythm Master" },
    subtitle: { tr: "İki haftalık kararlılık aktif.", en: "Two weeks of consistency are active." },
  },
};

export function getBadgeMeta(id: string, language: Language): BadgeVisualMeta {
  const badge = badgeCatalog[id as MotivationBadgeId];
  if (!badge) {
    return {
      title: language === "tr" ? "Yeni Rozet" : "New Badge",
      subtitle: language === "tr" ? "Uyum ritmin güçleniyor." : "Your adherence rhythm is growing stronger.",
      icon: "star-four-points-outline",
      tone: "emerald",
      priority: 0,
    };
  }

  return {
    title: badge.title[language],
    subtitle: badge.subtitle[language],
    icon: badge.icon,
    tone: badge.tone,
    priority: badge.priority,
  };
}

export function getToneColor(theme: any, tone: BadgeTone): string {
  switch (tone) {
    case "gold":
      return theme.accentGold;
    case "coral":
      return theme.accentCoral;
    case "cyan":
      return theme.accentCyan;
    case "emerald":
    default:
      return theme.emerald;
  }
}

export function getHighlightAchievements(
  motivation: DashboardMotivation | undefined,
  language: Language,
  limit = 3,
) {
  if (!motivation) return [];

  return [...motivation.achievements]
    .sort((a, b) => {
      const aMeta = getBadgeMeta(a.id, language);
      const bMeta = getBadgeMeta(b.id, language);
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked && b.unlocked) return bMeta.priority - aMeta.priority;
      const aRatio = a.progressTarget > 0 ? a.progressCurrent / a.progressTarget : 0;
      const bRatio = b.progressTarget > 0 ? b.progressCurrent / b.progressTarget : 0;
      return bRatio - aRatio || bMeta.priority - aMeta.priority;
    })
    .slice(0, limit);
}

export function buildMotivationSummary(
  motivation: DashboardMotivation | undefined,
  language: Language,
) {
  if (!motivation) {
    return {
      title: language === "tr" ? "Serini bugün başlat." : "Start your streak today.",
      subtitle: language === "tr"
        ? "Planındaki ilk öğünü tamamlayınca motivasyon rozeti akmaya başlar."
        : "Complete the first meal in your plan to start the reward flow.",
    };
  }

  if (motivation.currentStreak >= 7) {
    return {
      title: language === "tr"
        ? `${motivation.currentStreak} günlük seri aktif`
        : `${motivation.currentStreak}-day streak active`,
      subtitle: language === "tr"
        ? "Ritmin artık kalıcı görünüyor. Bugünün planını da temiz kapat."
        : "Your rhythm looks stable now. Close today’s plan cleanly too.",
    };
  }

  if (motivation.currentStreak >= 3) {
    return {
      title: language === "tr"
        ? `${motivation.currentStreak} günlük seri canlı`
        : `${motivation.currentStreak}-day streak is live`,
      subtitle: language === "tr"
        ? `Haftalık seri için ${motivation.nextMilestoneDays} gün daha kaldı.`
        : `${motivation.nextMilestoneDays} more days to reach the weekly streak.`,
    };
  }

  if (motivation.nextMilestoneDays > 0) {
    return {
      title: language === "tr" ? "Seri alanı hazır" : "Streak lane is ready",
      subtitle: language === "tr"
        ? `İlk büyük rozet için ${motivation.nextMilestoneDays} günlük düzen yeterli.`
        : `${motivation.nextMilestoneDays} more steady days unlock your first major badge.`,
    };
  }

  return {
    title: language === "tr" ? "Uyum ritmi aktif" : "Adherence rhythm is active",
    subtitle: language === "tr"
      ? "Planına uydukça yeni rozetler burada belirir."
      : "As you follow your plan, new badges surface here.",
  };
}

export function buildMotivationNotification(
  motivation: DashboardMotivation | undefined,
  language: Language,
  dayKey: string,
) {
  if (!motivation) return null;

  if ([3, 7, 14].includes(motivation.currentStreak)) {
    const streakId = `streak_${motivation.currentStreak}` as MotivationBadgeId;
    const meta = getBadgeMeta(streakId, language);
    return {
      dedupKey: `${dayKey}:${streakId}`,
      title: meta.title,
      body: language === "tr"
        ? `${motivation.currentStreak} günlük plan serin aktif. Ritmi bozma, bugün de devam et.`
        : `Your ${motivation.currentStreak}-day plan streak is active. Keep the rhythm going today.`,
    };
  }

  const perfectDay = motivation.achievements.find((item) => item.id === "perfect_day" && item.unlocked);
  if (perfectDay) {
    const meta = getBadgeMeta("perfect_day", language);
    return {
      dedupKey: `${dayKey}:perfect_day`,
      title: meta.title,
      body: language === "tr"
        ? "Bugünün planını sorunsuz kapattın. Bu ritmi yarına da taşı."
        : "You closed today’s plan smoothly. Carry that rhythm into tomorrow too.",
    };
  }

  return null;
}
