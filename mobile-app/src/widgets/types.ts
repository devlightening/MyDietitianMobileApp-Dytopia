export const DEFAULT_HYDRATION_GOAL_GLASSES = 10;

export type WidgetTaskKind = "meal" | "hydration" | "appointment";

export interface HydrationWidgetSnapshot {
  date: string;
  currentGlasses: number;
  goalGlasses: number;
  remainingGlasses: number;
  progressPercent: number;
  progressLabel: string;
  statusLabel: string;
  lastUpdatedAt: string;
  deepLink: string;
}

export interface DailySummaryTaskSnapshot {
  id: string;
  kind: WidgetTaskKind;
  title: string;
  subtitle: string;
  snoozeTitle: string;
  snoozeBody: string;
}

export interface DailySummaryWidgetSnapshot {
  date: string;
  hydrationLabel: string;
  hydrationStatus: string;
  adherencePercent: number;
  adherenceLabel: string;
  nextMealTitle: string;
  nextMealSubtitle: string;
  nextMealId: string | null;
  pendingReminderCount: number;
  pendingReminderLabel: string;
  tasks: DailySummaryTaskSnapshot[];
  deepLink: string;
  fallbackDeepLink: string;
  lastUpdatedAt: string;
}

export interface WidgetSnapshotBundle {
  hydration: HydrationWidgetSnapshot;
  dailySummary: DailySummaryWidgetSnapshot;
}
