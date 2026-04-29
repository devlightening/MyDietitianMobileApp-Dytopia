import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { GamificationSummaryDTO } from "../api/gamification";
import type { Language } from "../context/I18nContext";
import type { Theme } from "../theme/tokens";

export type MotivationBadgeId =
  | "protein_focus"
  | "veggie_focus"
  | "kitchen_spark"
  | "pantry_ready"
  | "likir_likir"
  | "water_keeper"
  | "flex_saver"
  | "plan_keeper"
  | "streak_3"
  | "perfect_day"
  | "streak_7"
  | "streak_14";

type BadgeTone = "emerald" | "gold" | "coral" | "cyan";
type BadgeFamily = "nutrition" | "hydration" | "streak" | "planner" | "kitchen" | "pantry";

interface LocalizedBadgeCopy {
  en: string;
  tr: string;
}

interface BadgeCatalogEntry {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  tone: BadgeTone;
  family: BadgeFamily;
  priority: number;
  targetFallback: number;
  title: LocalizedBadgeCopy;
  subtitle: LocalizedBadgeCopy;
  hint: LocalizedBadgeCopy;
  earnedDetail: LocalizedBadgeCopy;
  flavor: LocalizedBadgeCopy;
  resetDetail?: LocalizedBadgeCopy;
}

export interface MotivationAchievement {
  id: string;
  progressCurrent: number;
  progressTarget: number;
  unlocked: boolean;
  unlockedAtUtc?: string | null;
}

export interface DashboardMotivation {
  currentStreak: number;
  bestStreak: number;
  earnedBadgeCount: number;
  totalBadgeCount?: number;
  nextMilestoneDays: number;
  streakAtRisk?: boolean;
  atRiskReason?: string | null;
  recentUnlocks?: string[];
  achievements: MotivationAchievement[];
}

export interface BadgeVisualMeta {
  id: string;
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  tone: BadgeTone;
  family: BadgeFamily;
  familyLabel: string;
  priority: number;
  hint: string;
  earnedDetail: string;
  flavor: string;
  resetDetail?: string;
  targetFallback: number;
}

export interface BadgeCollectionItem extends MotivationAchievement, BadgeVisualMeta {
  ratio: number;
  isRecentUnlock: boolean;
  isDailyReset: boolean;
  progressLabel: string;
  statusLabel: string;
  detailCopy: string;
}

const badgeCatalog: Record<MotivationBadgeId, BadgeCatalogEntry> = {
  protein_focus: {
    icon: "dumbbell",
    tone: "emerald",
    family: "nutrition",
    priority: 92,
    targetFallback: 70,
    title: { tr: "Protein Canavari", en: "Protein Power" },
    subtitle: { tr: "Günlük protein gücünü topladın.", en: "You stacked serious protein power today." },
    hint: { tr: "Bir günde 70 g protein hedefine ulaş.", en: "Reach 70 g of protein in a single day." },
    earnedDetail: { tr: "Gün içinde 70 g proteine ulaşarak rozeti açtın.", en: "You unlocked this by reaching 70 g of protein in one day." },
    flavor: { tr: "Kaslar sahnede alkis tutuyor.", en: "Your muscles are giving a standing ovation." },
  },
  veggie_focus: {
    icon: "carrot",
    tone: "gold",
    family: "nutrition",
    priority: 88,
    targetFallback: 3,
    title: { tr: "Sebze Dostu", en: "Veggie Friend" },
    subtitle: { tr: "Tabakta 3 sebze dokunuşu yakaladın.", en: "You landed 3 vegetable-forward moments." },
    hint: { tr: "Gün içinde 3 sebze sinyali topla.", en: "Collect 3 vegetable signals in one day." },
    earnedDetail: { tr: "Üç sebze odaklı seçimle bu rozeti açtın.", en: "You unlocked this with three vegetable-focused choices." },
    flavor: { tr: "Mutfakta yesil ligine girdin.", en: "You made it into the green league." },
  },
  kitchen_spark: {
    icon: "chef-hat",
    tone: "cyan",
    family: "kitchen",
    priority: 90,
    targetFallback: 5,
    title: { tr: "Mutfak Kıvılcımı", en: "Kitchen Spark" },
    subtitle: { tr: "Mutfak asistanıyla 5 aktif gün biriktir.", en: "Build 5 active kitchen-assistant days." },
    hint: { tr: "Tarif asistanını kullandığın 5 gün topla.", en: "Collect 5 days where you use the recipe assistant." },
    earnedDetail: { tr: "Beş farklı günde tarif oluşturarak bunu açtın.", en: "You unlocked this by generating recipes across five days." },
    flavor: { tr: "Ocak tarafında artık elektrik var.", en: "There is real energy in your kitchen now." },
  },
  pantry_ready: {
    icon: "fridge-outline",
    tone: "gold",
    family: "pantry",
    priority: 91,
    targetFallback: 8,
    title: { tr: "Dolap Bekçisi", en: "Pantry Keeper" },
    subtitle: { tr: "Dolabında 8 aktif malzeme tutup mutfağı hazırda beklettin.", en: "You kept 8 active pantry items on standby for the kitchen." },
    hint: { tr: "Dolabında aynı anda 8 aktif malzeme bulundur.", en: "Keep 8 active pantry items available at the same time." },
    earnedDetail: { tr: "Dolabını 8 malzemelik hazır oyun alanına çevirerek bu rozeti açtın.", en: "You unlocked this by turning your pantry into an 8-item ready zone." },
    flavor: { tr: "Buzdolabı seni mahalle nöbetçisi ilan etti.", en: "Your fridge quietly promoted you to neighborhood watch." },
  },
  likir_likir: {
    icon: "cup-water",
    tone: "cyan",
    family: "hydration",
    priority: 97,
    targetFallback: 10,
    title: { tr: "Likir Likir", en: "Gulp Gulp" },
    subtitle: { tr: "Bugün 10 bardakla 2 litreyi devirdin.", en: "You cleared 10 glasses and hit 2 liters today." },
    hint: { tr: "Bir gün içinde 10 bardak su iç.", en: "Drink 10 glasses of water in a single day." },
    earnedDetail: { tr: "Günlük 2 litre hedefini tamamlayıp bu komik rozeti açtın.", en: "You unlocked this funny badge by finishing your daily 2-liter goal." },
    flavor: { tr: "Bardaklar sıraya girdi, lavabo saygı duruşunda.", en: "The glasses lined up and the sink stood at attention." },
    resetDetail: { tr: "Bu rozet günlük. Her 24 saatte sıfırlanır ve yeniden avlanır.", en: "This is a daily badge. It resets every 24 hours so you can chase it again." },
  },
  water_keeper: {
    icon: "water",
    tone: "cyan",
    family: "hydration",
    priority: 86,
    targetFallback: 3,
    title: { tr: "Su Kombosu", en: "Hydro Combo" },
    subtitle: { tr: "Üç gün üst üste 10 bardak suyu koru.", en: "Hold the 10-glass hydration goal for 3 straight days." },
    hint: { tr: "Üç gün üst üste 10 bardak su iç.", en: "Drink 10 glasses of water for 3 consecutive days." },
    earnedDetail: { tr: "Üç günlük su serisi yakalayarak komboyu açtın.", en: "You unlocked this by chaining together a 3-day hydration streak." },
    flavor: { tr: "Su sayacı artık seri kombo modunda.", en: "Your hydration counter is officially in combo mode." },
  },
  flex_saver: {
    icon: "swap-horizontal",
    tone: "gold",
    family: "planner",
    priority: 89,
    targetFallback: 1,
    title: { tr: "Esnek Uyum", en: "Flex Saver" },
    subtitle: { tr: "Alternatif seçimle günün ritmini kurtardın.", en: "You saved the day with a smart alternative." },
    hint: { tr: "Planlı bir öğünü alternatif seçimle uyumlu şekilde tamamla.", en: "Complete a planned meal with a smart alternative while keeping the day compliant." },
    earnedDetail: { tr: "Planı bozmadan alternatifle devam edip rozeti açtın.", en: "You unlocked this by adapting without breaking the plan." },
    flavor: { tr: "Plan bozulmadı, sadece daha havalı bir yan yol açtı.", en: "The plan did not break, it just found a cooler route." },
  },
  plan_keeper: {
    icon: "calendar-check",
    tone: "emerald",
    family: "planner",
    priority: 94,
    targetFallback: 5,
    title: { tr: "Plan Koruyucu", en: "Plan Keeper" },
    subtitle: { tr: "Son 7 günde 5 kaliteli gün yakala.", en: "Land 5 qualified days inside the last 7 days." },
    hint: { tr: "Son 7 günün 5'inde plan ritmini koru.", en: "Keep your plan rhythm on 5 of the last 7 days." },
    earnedDetail: { tr: "Haftalık planda 5 güçlü gün biriktirerek açtın.", en: "You unlocked this by stacking five strong planning days in a week." },
    flavor: { tr: "Takvim sana gizli bir yıldız ödülü verdi.", en: "Your calendar quietly handed you an MVP award." },
  },
  streak_3: {
    icon: "fire",
    tone: "coral",
    family: "streak",
    priority: 96,
    targetFallback: 3,
    title: { tr: "3 Günlük Seri", en: "3-Day Streak" },
    subtitle: { tr: "Üç gün arka arkaya ritimde kaldın.", en: "You stayed in rhythm for 3 days in a row." },
    hint: { tr: "Genel ritmini 3 gün üst üste koru.", en: "Keep your main rhythm alive for 3 consecutive days." },
    earnedDetail: { tr: "Üç günlük ana seriyi çalıştırıp bu rozeti açtın.", en: "You unlocked this by activating a 3-day core streak." },
    flavor: { tr: "Kıvılcım artık ateşe dönüştü.", en: "The spark officially turned into fire." },
  },
  perfect_day: {
    icon: "gift-outline",
    tone: "cyan",
    family: "planner",
    priority: 100,
    targetFallback: 1,
    title: { tr: "Mükemmel Uyum", en: "Perfect Match" },
    subtitle: { tr: "Planlı tüm öğünleri eksiksiz kapattın.", en: "You closed every planned meal without missing a beat." },
    hint: { tr: "Planlı tüm öğünleri aynı günde tamamla.", en: "Finish every planned meal in the same day." },
    earnedDetail: { tr: "Günlük plandaki tüm öğünleri tamamlayıp açtın.", en: "You unlocked this by finishing every planned meal in one day." },
    flavor: { tr: "Bugün plan tarafında temiz bir 100 geldi.", en: "That was a clean 100 on the plan board today." },
  },
  streak_7: {
    icon: "calendar-star",
    tone: "emerald",
    family: "streak",
    priority: 98,
    targetFallback: 7,
    title: { tr: "Haftalık Seri", en: "Weekly Streak" },
    subtitle: { tr: "Yedi günlük istikrar çizgisi açtın.", en: "You unlocked a full 7-day streak line." },
    hint: { tr: "Ana ritmini 7 gün üst üste koru.", en: "Keep your core rhythm alive for 7 straight days." },
    earnedDetail: { tr: "Bir haftalık seri yaparak bunu açtın.", en: "You unlocked this by holding the streak for a full week." },
    flavor: { tr: "Takvim artık seni tanıdık biri gibi selamlıyor.", en: "The calendar now greets you like a regular." },
  },
  streak_14: {
    icon: "crown-outline",
    tone: "gold",
    family: "streak",
    priority: 99,
    targetFallback: 14,
    title: { tr: "Ritim Ustası", en: "Rhythm Master" },
    subtitle: { tr: "İki haftalık seriyle taç seviyesine çıktın.", en: "A two-week streak pushed you into crown territory." },
    hint: { tr: "Ana ritmini 14 gün üst üste koru.", en: "Keep your core rhythm alive for 14 consecutive days." },
    earnedDetail: { tr: "İki haftalık seriyle üst seviye rozet açtın.", en: "You unlocked this top-tier badge with a 14-day streak." },
    flavor: { tr: "Seri paneli sana taç taktı.", en: "The streak board just crowned you." },
  },
};

const familyLabels: Record<BadgeFamily, LocalizedBadgeCopy> = {
  nutrition: { tr: "Beslenme", en: "Nutrition" },
  hydration: { tr: "Su Oyunu", en: "Hydration" },
  streak: { tr: "Seri", en: "Streak" },
  planner: { tr: "Plan", en: "Planning" },
  kitchen: { tr: "Mutfak", en: "Kitchen" },
  pantry: { tr: "Dolap", en: "Pantry" },
};

const badgeIds = Object.keys(badgeCatalog) as MotivationBadgeId[];

export function mapGamificationToMotivation(
  summary?: GamificationSummaryDTO | null,
): DashboardMotivation | undefined {
  if (!summary) return undefined;

  return {
    currentStreak: summary.currentStreak,
    bestStreak: summary.bestStreak,
    earnedBadgeCount: summary.earnedBadgeCount,
    totalBadgeCount: summary.totalBadgeCount,
    nextMilestoneDays: summary.nextMilestoneDays,
    streakAtRisk: summary.streakAtRisk,
    atRiskReason: summary.atRiskReason,
    recentUnlocks: summary.recentUnlocks,
    achievements: summary.achievements.map((item) => ({
      id: item.id,
      progressCurrent: item.progressCurrent,
      progressTarget: item.progressTarget,
      unlocked: item.unlocked,
      unlockedAtUtc: item.unlockedAtUtc,
    })),
  };
}

export function getBadgeMeta(id: string, language: Language): BadgeVisualMeta {
  const badge = badgeCatalog[id as MotivationBadgeId];
  if (!badge) {
    return {
      id,
      title: language === "tr" ? "Yeni Rozet" : "New Badge",
      subtitle: language === "tr" ? "Uyum ritmin güçleniyor." : "Your adherence rhythm is growing stronger.",
      icon: "star-four-points-outline",
      tone: "emerald",
      family: "streak",
      familyLabel: language === "tr" ? "Seri" : "Streak",
      priority: 0,
      hint: language === "tr" ? "Planına sadık kaldıkça yeni rozetler açılır." : "New badges unlock as you stay loyal to the plan.",
      earnedDetail: language === "tr" ? "Bu rozet ilerleme paneline yeni eklendi." : "This badge was recently added to the progress board.",
      flavor: language === "tr" ? "Yeni bir meydan okuma seni bekliyor." : "A fresh challenge is waiting for you.",
      targetFallback: 1,
    };
  }

  return {
    id,
    title: badge.title[language],
    subtitle: badge.subtitle[language],
    icon: badge.icon,
    tone: badge.tone,
    family: badge.family,
    familyLabel: familyLabels[badge.family][language],
    priority: badge.priority,
    hint: badge.hint[language],
    earnedDetail: badge.earnedDetail[language],
    flavor: badge.flavor[language],
    resetDetail: badge.resetDetail?.[language],
    targetFallback: badge.targetFallback,
  };
}

export function getToneColor(theme: Theme, tone: BadgeTone): string {
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

export function buildBadgeCollection(
  motivation: DashboardMotivation | undefined,
  language: Language,
): BadgeCollectionItem[] {
  const achievementMap = new Map(motivation?.achievements.map((item) => [item.id, item]) ?? []);
  const recentUnlocks = new Set(motivation?.recentUnlocks ?? []);

  return badgeIds
    .map((id) => {
      const meta = getBadgeMeta(id, language);
      const achievement = achievementMap.get(id);
      const progressTarget = achievement?.progressTarget ?? meta.targetFallback;
      const safeTarget = progressTarget > 0 ? progressTarget : meta.targetFallback;
      const progressCurrent = Math.min(achievement?.progressCurrent ?? 0, safeTarget);
      const unlocked = achievement?.unlocked ?? false;
      const ratio = safeTarget > 0 ? Math.min(1, progressCurrent / safeTarget) : (unlocked ? 1 : 0);
      const isDailyReset = Boolean(meta.resetDetail);

      return {
        ...meta,
        progressCurrent: unlocked ? safeTarget : progressCurrent,
        progressTarget: safeTarget,
        unlocked,
        unlockedAtUtc: achievement?.unlockedAtUtc,
        ratio,
        isRecentUnlock: unlocked && recentUnlocks.has(id),
        isDailyReset,
        progressLabel: `${unlocked ? safeTarget : progressCurrent}/${safeTarget}`,
        statusLabel: unlocked
          ? (language === "tr" ? "Açık" : "Unlocked")
          : (isDailyReset
              ? (language === "tr" ? "Günlük Av" : "Daily Hunt")
              : (language === "tr" ? "Kilitli" : "Locked")),
        detailCopy: unlocked ? meta.earnedDetail : meta.hint,
      };
    })
    .sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked && b.unlocked) return b.priority - a.priority;
      return b.ratio - a.ratio || b.priority - a.priority;
    });
}

export function getHighlightAchievements(
  motivation: DashboardMotivation | undefined,
  language: Language,
  limit = 3,
) {
  return buildBadgeCollection(motivation, language).slice(0, limit);
}

export function getMotivationSpotlight(
  motivation: DashboardMotivation | undefined,
  language: Language,
) {
  const badges = buildBadgeCollection(motivation, language);
  return badges.find((item) => !item.unlocked) ?? badges[0];
}

export function buildMotivationSummary(
  motivation: DashboardMotivation | undefined,
  language: Language,
) {
  if (!motivation) {
    return {
      title: language === "tr" ? "Serini bugün başlat." : "Start your streak today.",
      subtitle: language === "tr"
        ? "Planındaki ilk öğünü tamamladığında rozet akışı canlanır."
        : "Complete the first meal in your plan to wake up the reward flow.",
    };
  }

  if (motivation.streakAtRisk) {
    return {
      title: language === "tr"
        ? `${motivation.currentStreak} günlük seri korunuyor`
        : `${motivation.currentStreak}-day streak needs a save`,
      subtitle: motivation.atRiskReason
        ?? (language === "tr"
          ? "Bugünkü ritim zayıfladı. Küçük bir hamleyle seriyi geri al."
          : "Today's rhythm slipped. One smart move will stabilize the streak again."),
    };
  }

  if (motivation.currentStreak >= 14) {
    return {
      title: language === "tr"
        ? `${motivation.currentStreak} günlük seri efsane modda`
        : `${motivation.currentStreak}-day streak is in legend mode`,
      subtitle: language === "tr"
        ? "Ritim paneli artık seni üst seviye bir oyuncu gibi görüyor."
        : "The rhythm board now treats you like a top-tier player.",
    };
  }

  if (motivation.currentStreak >= 7) {
    return {
      title: language === "tr"
        ? `${motivation.currentStreak} günlük seri aktif`
        : `${motivation.currentStreak}-day streak active`,
      subtitle: language === "tr"
        ? "Haftalık seriyi açtın. Sıradaki büyük taç için ritmi koru."
        : "You unlocked the weekly streak. Keep the rhythm for the next crown tier.",
    };
  }

  if (motivation.currentStreak >= 3) {
    return {
      title: language === "tr"
        ? `${motivation.currentStreak} günlük seri canlı`
        : `${motivation.currentStreak}-day streak is live`,
      subtitle: language === "tr"
        ? `Bir üst rozet için ${motivation.nextMilestoneDays} gün daha yeterli.`
        : `${motivation.nextMilestoneDays} more days are enough for the next major badge.`,
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
        ? "Bugünün planını sorunsuz kapattın. Bu ritmi yarına da taşımaya devam et."
        : "You closed today's plan smoothly. Carry that rhythm into tomorrow too.",
    };
  }

  return null;
}

