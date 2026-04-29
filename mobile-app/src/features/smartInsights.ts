import type { RecipeMatchResult } from "../api/kitchen";
import type { PantryItem } from "../api/pantry";
import type { ShoppingListSummary } from "../api/shopping-list";
import type { ClientPlan, MealItem } from "../data/plansRepo";
import type { DashboardMotivation } from "../motivation/streaks";

type Language = "tr" | "en";

export type InsightTone = "emerald" | "primary" | "gold" | "coral" | "cyan";

export interface TodayPanelItem {
  key: string;
  title: string;
  body: string;
  value: string;
  icon: string;
  tone: InsightTone;
}

export interface RescueMission {
  title: string;
  body: string;
  cta: string;
  icon: string;
  tone: InsightTone;
  progressLabel: string;
}

export interface PantryActivitySummary {
  total: number;
  freshCount: number;
  restingCount: number;
  oldestLabel: string;
  newestLabel: string;
  insightTitle: string;
  insightBody: string;
}

export interface WeeklyDigest {
  title: string;
  body: string;
  highlight: string;
  secondary: string;
  tone: InsightTone;
}

export interface RecipePrioritySummary {
  readyNow: number;
  almostReady: number;
  needsShopping: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDaysAgo(days: number, language: Language) {
  if (days <= 0) return language === "tr" ? "bugün" : "today";
  if (days === 1) return language === "tr" ? "1 gün önce" : "1 day ago";
  return language === "tr" ? `${days} gün önce` : `${days} days ago`;
}

function formatDaysAhead(days: number, language: Language) {
  if (days <= 0) return language === "tr" ? "bugün" : "today";
  if (days === 1) return language === "tr" ? "1 gün" : "1 day";
  return language === "tr" ? `${days} gün` : `${days} days`;
}

export function buildTodayPanelItems(args: {
  language: Language;
  waterGlasses: number;
  waterGoal: number;
  pantryCount: number;
  nextMealTitle?: string | null;
  nextMealMinutesUntil?: number | null;
  motivation?: DashboardMotivation;
}): TodayPanelItem[] {
  const { language, waterGlasses, waterGoal, pantryCount, nextMealTitle, nextMealMinutesUntil, motivation } = args;
  const waterGap = Math.max(waterGoal - waterGlasses, 0);
  const nextBadge = motivation?.nextMilestoneDays ?? 0;

  return [
    {
      key: "water",
      title: language === "tr" ? "Su ritmi" : "Hydration",
      body:
        language === "tr"
          ? `${waterGap} bardak daha ile hedefe varırsın.`
          : `${waterGap} more glasses to reach the goal.`,
      value: `${waterGlasses}/${waterGoal}`,
      icon: "water-outline",
      tone: waterGlasses >= waterGoal ? "emerald" : "cyan",
    },
    {
      key: "meal",
      title: language === "tr" ? "Sıradaki öğün" : "Next meal",
      body: nextMealTitle
        ? language === "tr"
          ? `${nextMealTitle}${typeof nextMealMinutesUntil === "number" && nextMealMinutesUntil > 0 ? ` ${nextMealMinutesUntil} dk içinde` : " hazır bekliyor"}.`
          : `${nextMealTitle}${typeof nextMealMinutesUntil === "number" && nextMealMinutesUntil > 0 ? ` in ${nextMealMinutesUntil} min` : " is waiting for you"}.`
        : language === "tr"
          ? "Bugün sakin gidiyor; mutfakla ritmi açabilirsin."
          : "The day is calm; open the kitchen to kick things off.",
      value: nextMealTitle ? (language === "tr" ? "hazır" : "ready") : language === "tr" ? "serbest" : "free",
      icon: "restaurant-outline",
      tone: nextMealTitle ? "primary" : "gold",
    },
    {
      key: "pantry",
      title: language === "tr" ? "Dolap hazırlığı" : "Pantry readiness",
      body:
        language === "tr"
          ? `${pantryCount} aktif malzeme ile mutfak daha hızlı açılır.`
          : `${pantryCount} active pantry items keep the kitchen fast.`,
      value: `${pantryCount}`,
      icon: "basket-outline",
      tone: pantryCount >= 8 ? "emerald" : "gold",
    },
    {
      key: "badge",
      title: language === "tr" ? "Sıradaki rozet" : "Next badge",
      body:
        nextBadge > 0
          ? language === "tr"
            ? `${formatDaysAhead(nextBadge, language)} daha istikrar yeni rozeti açar.`
            : `${formatDaysAhead(nextBadge, language)} more of consistency unlocks the next badge.`
          : language === "tr"
            ? "Yeni bir rozet açmaya çok yakınsın."
            : "You are very close to another badge.",
      value: nextBadge > 0 ? formatDaysAhead(nextBadge, language) : language === "tr" ? "yakında" : "soon",
      icon: "ribbon-outline",
      tone: "gold",
    },
  ];
}

export function buildRescueMission(args: {
  language: Language;
  waterGlasses: number;
  waterGoal: number;
  pantryCount: number;
  shoppingSummary?: ShoppingListSummary | null;
  motivation?: DashboardMotivation;
  nextMealTitle?: string | null;
}): RescueMission {
  const { language, waterGlasses, waterGoal, pantryCount, shoppingSummary, motivation, nextMealTitle } = args;
  const waterGap = Math.max(waterGoal - waterGlasses, 0);

  if (waterGap >= 3) {
    return {
      title: language === "tr" ? "Bugünü sudan toparla" : "Rescue the day with water",
      body:
        language === "tr"
          ? `${waterGap} bardaklık alan açık. İlk hızlı kazanım su hedefi.`
          : `${waterGap} glasses are still open. Hydration is your fastest win.`,
      cta: language === "tr" ? "Su hedefini kapat" : "Close the water goal",
      icon: "water-outline",
      tone: "cyan",
      progressLabel: `${waterGlasses}/${waterGoal}`,
    };
  }

  if (motivation?.streakAtRisk) {
    return {
      title: language === "tr" ? "Seriyi bugün koru" : "Protect the streak today",
      body:
        language === "tr"
          ? "Tek bir plan aksiyonu veya mutfak seçimi seriyi açık tutar."
          : "One plan action or kitchen move keeps the streak alive.",
      cta: language === "tr" ? "Bugünü kurtar" : "Rescue today",
      icon: "flame-outline",
      tone: "coral",
      progressLabel: language === "tr" ? "seri riskte" : "streak at risk",
    };
  }

  if ((shoppingSummary?.activeCount ?? 0) > 0) {
    return {
      title: language === "tr" ? "Eksikleri tek koşuda kapat" : "Close the gaps in one run",
      body:
        language === "tr"
          ? `${shoppingSummary?.activeCount ?? 0} aktif alışveriş maddesi bugünkü akışı rahatlatır.`
          : `${shoppingSummary?.activeCount ?? 0} active shopping items would smooth today's flow.`,
      cta: language === "tr" ? "Listeyi aç" : "Open the list",
      icon: "cart-outline",
      tone: "gold",
      progressLabel: `${shoppingSummary?.activeCount ?? 0}`,
    };
  }

  if (pantryCount < 5) {
    return {
      title: language === "tr" ? "Dolabı biraz daha güçlendir" : "Strengthen the pantry",
      body:
        language === "tr"
          ? "Bir iki temel malzeme daha eklemek tarif eşleşmelerini güçlendirir."
          : "A few staple ingredients will improve recipe matches.",
      cta: language === "tr" ? "Dolabımı güncelle" : "Update pantry",
      icon: "basket-outline",
      tone: "emerald",
      progressLabel: `${pantryCount}/8`,
    };
  }

  return {
    title: language === "tr" ? "Mini görevin hazır" : "Your mini mission is ready",
    body: nextMealTitle
      ? language === "tr"
        ? `${nextMealTitle} ile bugünün ritmini temiz bir şekilde tamamlayabilirsin.`
        : `${nextMealTitle} is the cleanest move to finish today's rhythm.`
      : language === "tr"
        ? "Bugün mutfaktan tek hızlı tarif seçimi ritmi aktif tutar."
        : "One quick recipe from the kitchen keeps the rhythm active today.",
    cta: language === "tr" ? "Akışı tamamla" : "Complete the flow",
    icon: "sparkles-outline",
    tone: "primary",
    progressLabel: language === "tr" ? "hazır" : "ready",
  };
}

export function buildPantryActivitySummary(items: PantryItem[], language: Language): PantryActivitySummary {
  if (items.length === 0) {
    return {
      total: 0,
      freshCount: 0,
      restingCount: 0,
      oldestLabel: language === "tr" ? "yok" : "none",
      newestLabel: language === "tr" ? "yok" : "none",
      insightTitle: language === "tr" ? "Dolabın sakin" : "Pantry is calm",
      insightBody:
        language === "tr"
          ? "Bir fiş taraması veya manuel ekleme mutfak akışını hızla canlandırır."
          : "A receipt scan or manual add will quickly energize the kitchen flow.",
    };
  }

  const now = Date.now();
  const ages = items.map((item) => Math.max(0, Math.floor((now - new Date(item.updatedAtUtc).getTime()) / DAY_MS)));
  const freshCount = ages.filter((days) => days <= 3).length;
  const restingCount = ages.filter((days) => days >= 7).length;
  const newest = Math.min(...ages);
  const oldest = Math.max(...ages);

  return {
    total: items.length,
    freshCount,
    restingCount,
    oldestLabel: formatDaysAgo(oldest, language),
    newestLabel: formatDaysAgo(newest, language),
    insightTitle:
      freshCount >= Math.max(3, Math.round(items.length * 0.4))
        ? language === "tr"
          ? "Dolap canlı görünüyor"
          : "Pantry looks active"
        : language === "tr"
          ? "Dolap biraz tazelenebilir"
          : "Pantry could use a refresh",
    insightBody:
      freshCount >= Math.max(3, Math.round(items.length * 0.4))
        ? language === "tr"
          ? `${freshCount} malzeme yeni eklenmiş; mutfak eşleşmeleri için iyi bir taban var.`
          : `${freshCount} ingredients were updated recently; this is a strong base for kitchen matches.`
        : language === "tr"
          ? `${restingCount} malzeme uzun süredir dokunulmamış duruyor. Yeni tarama iyi gelir.`
          : `${restingCount} ingredients have been resting for a while. A fresh scan would help.`,
  };
}

export function buildWeeklyDigest(args: {
  language: Language;
  plans: ClientPlan[];
  todayItems: MealItem[];
}): WeeklyDigest {
  const { language, plans, todayItems } = args;
  const totalMeals = plans.reduce((sum, plan) => sum + plan.mealCount, 0);
  const completedMeals = plans.reduce((sum, plan) => sum + plan.completedMeals, 0);
  const ratio = totalMeals > 0 ? completedMeals / totalMeals : 0;
  const doneToday = todayItems.filter((item) => item.completionStatus === "Done" || item.completionStatus === "Alternative").length;
  const skippedToday = todayItems.filter((item) => item.completionStatus === "Skipped").length;

  if (ratio >= 0.75) {
    return {
      title: language === "tr" ? "Haftalık ritim güçlü" : "Weekly rhythm is strong",
      body:
        language === "tr"
          ? "Plan tamamlama oranın yüksek; bu haftayı çok temiz götürüyorsun."
          : "Your plan completion rate is high; the week is moving cleanly.",
      highlight: language === "tr" ? `%${Math.round(ratio * 100)} uyum` : `${Math.round(ratio * 100)}% aligned`,
      secondary: language === "tr" ? `${doneToday} öğün bugün kapandı` : `${doneToday} meals closed today`,
      tone: "emerald",
    };
  }

  if (skippedToday > 0) {
    return {
      title: language === "tr" ? "Ritimde açık var" : "There is a gap in the rhythm",
      body:
        language === "tr"
          ? "Atlanan öğünleri hafif ama planlı bir seçimle toparlayabilirsin."
          : "You can recover skipped meals with one light but intentional choice.",
      highlight: language === "tr" ? `${skippedToday} atlanan öğün` : `${skippedToday} skipped meals`,
      secondary: language === "tr" ? "Bugünü Kurtar kartına göz at" : "Check the rescue card",
      tone: "coral",
    };
  }

  return {
    title: language === "tr" ? "Haftalık akışın okunuyor" : "Your weekly flow is taking shape",
    body:
      language === "tr"
        ? "Plan ilerledikçe sistem senin için daha net öneriler çıkarır."
        : "As your plan advances, the system will surface clearer suggestions.",
    highlight:
      language === "tr"
        ? `${completedMeals}/${totalMeals || todayItems.length || 1} öğün`
        : `${completedMeals}/${totalMeals || todayItems.length || 1} meals`,
    secondary:
      language === "tr"
        ? `${doneToday} öğün bugün tamamlandı`
        : `${doneToday} meals completed today`,
    tone: "primary",
  };
}

export function prioritizeRecipeMatches(results: RecipeMatchResult[]) {
  return [...results].sort((a, b) => {
    const aMissing = a.missing?.length ?? 0;
    const bMissing = b.missing?.length ?? 0;
    const aClinic = a.isOwnedByActiveDietitian ? 1 : 0;
    const bClinic = b.isOwnedByActiveDietitian ? 1 : 0;
    const aFull = a.matchStatus === "FULL_MATCH" ? 1 : 0;
    const bFull = b.matchStatus === "FULL_MATCH" ? 1 : 0;
    const aCompat = a.compatibilityPercent ?? 0;
    const bCompat = b.compatibilityPercent ?? 0;

    if (bFull !== aFull) return bFull - aFull;
    if (bClinic !== aClinic) return bClinic - aClinic;
    if (aMissing !== bMissing) return aMissing - bMissing;
    if (bCompat !== aCompat) return bCompat - aCompat;
    return (b.score ?? 0) - (a.score ?? 0);
  });
}

export function summarizeRecipePriority(results: RecipeMatchResult[]): RecipePrioritySummary {
  return results.reduce<RecipePrioritySummary>(
    (acc, item) => {
      const missingCount = item.missing?.length ?? 0;
      if (item.matchStatus === "FULL_MATCH" || missingCount === 0) {
        acc.readyNow += 1;
      } else if (missingCount <= 2) {
        acc.almostReady += 1;
      } else {
        acc.needsShopping += 1;
      }
      return acc;
    },
    { readyNow: 0, almostReady: 0, needsShopping: 0 },
  );
}

