import type { Language } from "../context/I18nContext";
import type { InAppNotificationPayload } from "./notificationTypes";

type MealFeedbackKey = "filling" | "light" | "repeat" | "hard";

const feedbackLabelMap: Record<Language, Record<MealFeedbackKey, string>> = {
  tr: {
    filling: "Tok tuttu",
    light: "Hafif geldi",
    repeat: "Tekrar isterim",
    hard: "Zor hazırlandı",
  },
  en: {
    filling: "Filling",
    light: "Light",
    repeat: "Would repeat",
    hard: "Hard to prepare",
  },
};

export function buildMealCompletedNotification(language: Language, mealTitle: string): InAppNotificationPayload {
  return {
    type: "meal_completed",
    dedupKey: `meal_completed:${mealTitle}`,
    title: language === "tr" ? "Öğün tamamlandı" : "Meal completed",
    body: language === "tr"
      ? `${mealTitle} plan akışına işlendi. Güzel gidiyorsun.`
      : `${mealTitle} is now marked in your plan. You are doing well.`,
    icon: "checkmark-circle-outline",
    tone: "emerald",
    haptic: "success",
    durationMs: 2600,
  };
}

export function buildMealFeedbackNotification(
  language: Language,
  mealTitle: string,
  feedbackKey: MealFeedbackKey,
): InAppNotificationPayload {
  const label = feedbackLabelMap[language][feedbackKey];
  return {
    type: "meal_feedback_saved",
    dedupKey: `meal_feedback:${mealTitle}:${feedbackKey}`,
    title: language === "tr" ? "Öğün değerlendirmesi kaydedildi" : "Meal feedback saved",
    body: language === "tr"
      ? `${mealTitle} için "${label}" notu eklendi.`
      : `"${label}" note was saved for ${mealTitle}.`,
    icon: "chatbubble-ellipses-outline",
    tone: "primary",
    haptic: "light",
    durationMs: 2400,
  };
}

export function buildAlternateRecipeAppliedNotification(
  language: Language,
  recipeName: string,
): InAppNotificationPayload {
  return {
    type: "alternate_recipe_applied",
    dedupKey: `alternate_recipe:${recipeName}`,
    title: language === "tr" ? "Alternatif tarif uygulandı" : "Alternative recipe applied",
    body: language === "tr"
      ? `${recipeName} bugünkü akışa kaydedildi.`
      : `${recipeName} has been saved into today's flow.`,
    icon: "sparkles-outline",
    tone: "primary",
    haptic: "success",
    durationMs: 2800,
  };
}

export function buildPantryUpdatedNotification(
  language: Language,
  count: number,
  changeLabel: string,
): InAppNotificationPayload {
  return {
    type: "pantry_updated",
    dedupKey: `pantry_updated:${changeLabel}:${count}`,
    title: language === "tr" ? "Dolap güncellendi" : "Pantry updated",
    body: language === "tr"
      ? `${changeLabel} Toplam aktif ürün sayın ${count}.`
      : `${changeLabel} Your active pantry count is now ${count}.`,
    icon: "basket-outline",
    tone: "emerald",
    haptic: "light",
    durationMs: 2400,
  };
}

export function buildShoppingItemsAddedNotification(
  language: Language,
  count: number,
): InAppNotificationPayload {
  return {
    type: "shopping_items_added",
    dedupKey: `shopping_items_added:${count}`,
    title: language === "tr" ? "Eksikler listeye eklendi" : "Missing items added",
    body: language === "tr"
      ? `${count} malzeme alışveriş listene aktarıldı.`
      : `${count} ingredients were added to your shopping list.`,
    icon: "cart-outline",
    tone: "gold",
    haptic: "success",
    durationMs: 2800,
  };
}

export function buildBadgeUnlockedBanner(
  language: Language,
  title: string,
  flavor: string,
  badgeId: string,
): InAppNotificationPayload {
  return {
    type: "badge_unlocked",
    dedupKey: `badge_unlocked:${badgeId}`,
    title: language === "tr" ? `${title} açıldı` : `${title} unlocked`,
    body: flavor,
    icon: "ribbon-outline",
    tone: "gold",
    haptic: "success",
    durationMs: 3200,
  };
}

export function buildStreakMilestoneBanner(language: Language, streak: number): InAppNotificationPayload {
  return {
    type: "streak_milestone",
    dedupKey: `streak_milestone:${streak}`,
    title: language === "tr" ? `${streak} günlük seri aktif` : `${streak}-day streak active`,
    body: language === "tr"
      ? "Bugünkü ritmini korudun. Bu akışı devam ettir."
      : "You protected today's rhythm. Keep the momentum going.",
    icon: "flame-outline",
    tone: "coral",
    haptic: "success",
    durationMs: 3200,
  };
}
