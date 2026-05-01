import apiClient from "./client";

export interface NotificationPreferences {
  notificationsEnabled: boolean;
  inAppCoachNotificationsEnabled: boolean;
  achievementNotificationsEnabled: boolean;
  pantryActivityNotificationsEnabled: boolean;
  hydrationRemindersEnabled: boolean;
  hydrationIntervalMinutes: number;
  hydrationStartLocalTime: string;
  hydrationEndLocalTime: string;
  mealPlanRemindersEnabled: boolean;
  mealReminderLeadMinutes: number;
  measurementRemindersEnabled: boolean;
  measurementReminderDayOfWeek: number;
  measurementReminderLocalTime: string;
  reengagementRemindersEnabled: boolean;
  reengagementDelayHours: number;
  timeZoneId: string;
  lastAppOpenAtUtc?: string | null;
  lastNotificationSyncAtUtc?: string | null;
  updatedAtUtc?: string | null;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notificationsEnabled: true,
  inAppCoachNotificationsEnabled: true,
  achievementNotificationsEnabled: true,
  pantryActivityNotificationsEnabled: true,
  hydrationRemindersEnabled: true,
  hydrationIntervalMinutes: 120,
  hydrationStartLocalTime: "09:00",
  hydrationEndLocalTime: "21:00",
  mealPlanRemindersEnabled: true,
  mealReminderLeadMinutes: 20,
  measurementRemindersEnabled: true,
  measurementReminderDayOfWeek: 1,
  measurementReminderLocalTime: "20:00",
  reengagementRemindersEnabled: true,
  reengagementDelayHours: 48,
  timeZoneId: "Europe/Istanbul",
  lastAppOpenAtUtc: null,
  lastNotificationSyncAtUtc: null,
  updatedAtUtc: null,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiClient.get<NotificationPreferences>("/api/client/notification-preferences");
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...response.data };
}

export async function updateNotificationPreferences(
  input: NotificationPreferences,
): Promise<NotificationPreferences> {
  const response = await apiClient.put<NotificationPreferences>(
    "/api/client/notification-preferences",
    input,
  );
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...response.data };
}

export async function postNotificationHeartbeat(): Promise<void> {
  await apiClient.post("/api/client/notification-preferences/heartbeat");
}

export async function markNotificationSync(): Promise<void> {
  await apiClient.post("/api/client/notification-preferences/sync-mark");
}
