import * as SecureStore from "expo-secure-store";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import type { AppointmentSummary } from "../api/care";
import type { NotificationPreferences } from "../api/notification-preferences";
import { getGamificationSummary } from "../api/gamification";
import type { TodayPlan } from "../data/plansRepo";
import { buildMotivationNotification } from "../motivation/streaks";
import { syncAppointmentReminderNotificationsAsync } from "./appointment-support";

export type AppNotificationPermissionStatus = "undetermined" | "denied" | "granted";

type NotificationTestModuleShape = {
  createNotificationChannel: () => Promise<boolean>;
  areNotificationsEnabled: () => Promise<boolean>;
  showTestNotification: (title: string, body: string) => Promise<boolean>;
};

const NotificationTestModule =
  NativeModules.NotificationTestModule as NotificationTestModuleShape | undefined;

const MOTIVATION_NOTIFICATION_KEY = "motivation_notification_v1";

function hasNativeModule() {
  return Platform.OS === "android" && !!NotificationTestModule;
}

async function ensureAndroidPermission(): Promise<AppNotificationPermissionStatus> {
  if (Platform.OS !== "android") {
    return "granted";
  }

  if (Platform.Version < 33) {
    return "granted";
  }

  const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  if (alreadyGranted) {
    return "granted";
  }

  return "undetermined";
}

export async function isNotificationsAvailableAsync(): Promise<boolean> {
  return hasNativeModule();
}

export async function configureNotificationsAsync(): Promise<void> {
  if (!hasNativeModule()) {
    return;
  }

  await NotificationTestModule!.createNotificationChannel();
}

export async function getNotificationPermissionStatusAsync(): Promise<AppNotificationPermissionStatus> {
  if (!hasNativeModule()) {
    return "denied";
  }

  const runtimeStatus = await ensureAndroidPermission();
  if (runtimeStatus !== "granted") {
    return runtimeStatus;
  }

  const enabled = await NotificationTestModule!.areNotificationsEnabled();
  return enabled ? "granted" : "denied";
}

export async function requestNotificationPermissionAsync(): Promise<AppNotificationPermissionStatus> {
  if (!hasNativeModule()) {
    return "denied";
  }

  if (Platform.OS === "android" && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      return "denied";
    }
  }

  const enabled = await NotificationTestModule!.areNotificationsEnabled();
  return enabled ? "granted" : "denied";
}

export async function clearManagedNotificationsAsync(): Promise<void> {
  return;
}

export async function scheduleNotificationsFromPreferencesAsync(
  preferences: NotificationPreferences,
  _todayPlan: TodayPlan | null,
  language: "tr" | "en",
  appointments: AppointmentSummary[] = [],
): Promise<void> {
  if (!hasNativeModule()) {
    return;
  }

  await NotificationTestModule!.createNotificationChannel();

  if (!preferences.notificationsEnabled) {
    await syncAppointmentReminderNotificationsAsync([], language, false);
    return;
  }

  await syncAppointmentReminderNotificationsAsync(appointments, language, true);
  await maybeSendMotivationNotification(language);
}

export async function schedulePreviewNotificationAsync(language: "tr" | "en"): Promise<void> {
  if (!hasNativeModule()) {
    return;
  }

  const fallback = {
    title: language === "tr" ? "Test bildirimi" : "Test notification",
    body: language === "tr"
      ? "Android emulator uzerinde local notification basariyla calisiyor."
      : "Local notification is working successfully on the Android emulator.",
  };

  try {
    const summary = await getGamificationSummary();
    const motivationPayload = buildMotivationNotification(
      {
        currentStreak: summary.currentStreak,
        bestStreak: summary.bestStreak,
        earnedBadgeCount: summary.earnedBadgeCount,
        nextMilestoneDays: summary.nextMilestoneDays,
        achievements: summary.achievements.map(item => ({
          id: item.id,
          progressCurrent: item.progressCurrent,
          progressTarget: item.progressTarget,
          unlocked: item.unlocked,
        })),
      },
      language,
      new Date().toISOString().slice(0, 10),
    );

    if (motivationPayload) {
      await NotificationTestModule!.showTestNotification(
        motivationPayload.title,
        motivationPayload.body,
      );
      return;
    }
  } catch {
    // Fall back to the generic preview notification below.
  }

  await NotificationTestModule!.showTestNotification(fallback.title, fallback.body);
}

async function maybeSendMotivationNotification(language: "tr" | "en") {
  try {
    const summary = await getGamificationSummary();
    const motivationPayload = buildMotivationNotification(
      {
        currentStreak: summary.currentStreak,
        bestStreak: summary.bestStreak,
        earnedBadgeCount: summary.earnedBadgeCount,
        nextMilestoneDays: summary.nextMilestoneDays,
        achievements: summary.achievements.map(item => ({
          id: item.id,
          progressCurrent: item.progressCurrent,
          progressTarget: item.progressTarget,
          unlocked: item.unlocked,
        })),
      },
      language,
      new Date().toISOString().slice(0, 10),
    );

    if (!motivationPayload) {
      return;
    }

    const lastSentKey = await SecureStore.getItemAsync(MOTIVATION_NOTIFICATION_KEY);
    if (lastSentKey === motivationPayload.dedupKey) {
      return;
    }

    await NotificationTestModule!.showTestNotification(
      motivationPayload.title,
      motivationPayload.body,
    );
    await SecureStore.setItemAsync(MOTIVATION_NOTIFICATION_KEY, motivationPayload.dedupKey);
  } catch {
    // Notification sync should remain non-blocking.
  }
}
