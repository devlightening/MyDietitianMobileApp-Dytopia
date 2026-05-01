export type InAppNotificationEventType =
  | "badge_unlocked"
  | "streak_milestone"
  | "meal_completed"
  | "meal_feedback_saved"
  | "alternate_recipe_applied"
  | "pantry_updated"
  | "shopping_items_added";

export type InAppNotificationTone = "emerald" | "primary" | "gold" | "coral" | "cyan";

export type InAppNotificationHaptic = "none" | "light" | "success" | "warning";

export interface InAppNotificationPayload {
  type: InAppNotificationEventType;
  dedupKey: string;
  title: string;
  body: string;
  icon: string;
  tone: InAppNotificationTone;
  ctaLabel?: string;
  onPress?: () => void;
  durationMs?: number;
  haptic?: InAppNotificationHaptic;
}
