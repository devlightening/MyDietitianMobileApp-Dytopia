import * as SecureStore from "expo-secure-store";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import type { AppointmentSummary } from "../api/care";

type AppointmentNativeModuleShape = {
  scheduleNotification: (
    identifier: string,
    title: string,
    body: string,
    triggerAtMillis: number,
  ) => Promise<boolean>;
  cancelScheduledNotification: (identifier: string) => Promise<boolean>;
  upsertCalendarEvent: (
    title: string,
    startAtMillis: number,
    endAtMillis: number,
    location?: string | null,
    note?: string | null,
    existingEventId?: string | null,
  ) => Promise<string | null>;
};

const AppointmentNativeModule =
  NativeModules.NotificationTestModule as AppointmentNativeModuleShape | undefined;

const APPOINTMENT_REMINDER_IDS_KEY = "appointment_reminder_ids_v1";
const APPOINTMENT_CALENDAR_EVENT_KEY = "appointment_calendar_events_v1";

function hasNativeSupport() {
  return Platform.OS === "android" && !!AppointmentNativeModule;
}

function appointmentTitle(appointment: AppointmentSummary) {
  return appointment.title?.trim() || "Diyetisyen görüşmesi";
}

function buildReminderBody(appointment: AppointmentSummary, language: "tr" | "en") {
  const start = new Date(appointment.scheduledAtUtc);
  const timeLabel = start.toLocaleTimeString(language === "tr" ? "tr-TR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (language === "tr") {
    return `${appointmentTitle(appointment)} bugün saat ${timeLabel}. Hazırlıklarını unutma.`;
  }

  return `${appointmentTitle(appointment)} is today at ${timeLabel}. Keep your session in view.`;
}

function buildHourBeforeBody(appointment: AppointmentSummary, language: "tr" | "en") {
  if (language === "tr") {
    return `${appointmentTitle(appointment)} için son 1 saat. Görüşme öncesi hazır ol.`;
  }

  return `One hour left for ${appointmentTitle(appointment)}. Get ready for your session.`;
}

function buildReminderDescriptors(appointment: AppointmentSummary, language: "tr" | "en", now: Date) {
  const scheduledAt = new Date(appointment.scheduledAtUtc);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now) {
    return [];
  }

  const descriptors: Array<{
    id: string;
    title: string;
    body: string;
    triggerAtMillis: number;
  }> = [];

  const reminderTitle = language === "tr" ? "Bugün görüşmeniz var" : "You have a session today";
  const hourBeforeTitle = language === "tr" ? "1 saat sonra görüşmeniz var" : "Your session starts in 1 hour";

  const morningReminder = new Date(scheduledAt);
  morningReminder.setHours(9, 0, 0, 0);

  if (morningReminder > now && morningReminder < scheduledAt) {
    descriptors.push({
      id: `appointment:${appointment.id}:day`,
      title: reminderTitle,
      body: buildReminderBody(appointment, language),
      triggerAtMillis: morningReminder.getTime(),
    });
  }

  const hourBefore = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
  if (hourBefore > now) {
    descriptors.push({
      id: `appointment:${appointment.id}:hour`,
      title: hourBeforeTitle,
      body: buildHourBeforeBody(appointment, language),
      triggerAtMillis: hourBefore.getTime(),
    });
  }

  return descriptors;
}

async function loadStoredIds(key: string): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function saveStoredIds(key: string, ids: string[]) {
  if (ids.length === 0) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  await SecureStore.setItemAsync(key, JSON.stringify(ids));
}

async function loadCalendarEventMap(): Promise<Record<string, string>> {
  const raw = await SecureStore.getItemAsync(APPOINTMENT_CALENDAR_EVENT_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveCalendarEventMap(next: Record<string, string>) {
  const keys = Object.keys(next);
  if (keys.length === 0) {
    await SecureStore.deleteItemAsync(APPOINTMENT_CALENDAR_EVENT_KEY);
    return;
  }

  await SecureStore.setItemAsync(APPOINTMENT_CALENDAR_EVENT_KEY, JSON.stringify(next));
}

export async function syncAppointmentReminderNotificationsAsync(
  appointments: AppointmentSummary[],
  language: "tr" | "en",
  notificationsEnabled: boolean,
) {
  if (!hasNativeSupport()) {
    return;
  }

  const previouslyScheduled = await loadStoredIds(APPOINTMENT_REMINDER_IDS_KEY);

  if (!notificationsEnabled) {
    await Promise.all(previouslyScheduled.map((id) => AppointmentNativeModule!.cancelScheduledNotification(id)));
    await saveStoredIds(APPOINTMENT_REMINDER_IDS_KEY, []);
    return;
  }

  const now = new Date();
  const upcomingAppointments = appointments.filter((appointment) => {
    if (appointment.attendanceStatus && appointment.attendanceStatus !== "pending") {
      return false;
    }

    const scheduledAt = new Date(appointment.scheduledAtUtc);
    return !Number.isNaN(scheduledAt.getTime()) && scheduledAt > now;
  });

  const descriptors = upcomingAppointments.flatMap((appointment) =>
    buildReminderDescriptors(appointment, language, now),
  );

  const nextIds = descriptors.map((descriptor) => descriptor.id);
  const staleIds = previouslyScheduled.filter((id) => !nextIds.includes(id));

  await Promise.all(staleIds.map((id) => AppointmentNativeModule!.cancelScheduledNotification(id)));
  await Promise.all(nextIds.map((id) => AppointmentNativeModule!.cancelScheduledNotification(id)));

  for (const descriptor of descriptors) {
    await AppointmentNativeModule!.scheduleNotification(
      descriptor.id,
      descriptor.title,
      descriptor.body,
      descriptor.triggerAtMillis,
    );
  }

  await saveStoredIds(APPOINTMENT_REMINDER_IDS_KEY, nextIds);
}

export async function isAppointmentAddedToCalendarAsync(appointmentId: string): Promise<boolean> {
  if (!hasNativeSupport()) {
    return false;
  }

  const map = await loadCalendarEventMap();
  return typeof map[appointmentId] === "string" && map[appointmentId].length > 0;
}

export async function addAppointmentToCalendarAsync(appointment: AppointmentSummary): Promise<boolean> {
  if (!hasNativeSupport()) {
    return false;
  }

  if (Platform.OS === "android") {
    const readGranted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALENDAR);
    const writeGranted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR);
    if (
      readGranted !== PermissionsAndroid.RESULTS.GRANTED ||
      writeGranted !== PermissionsAndroid.RESULTS.GRANTED
    ) {
      return false;
    }
  }

  const scheduledAt = new Date(appointment.scheduledAtUtc);
  if (Number.isNaN(scheduledAt.getTime())) {
    return false;
  }

  const calendarMap = await loadCalendarEventMap();
  const existingEventId = calendarMap[appointment.id] ?? null;
  const eventId = await AppointmentNativeModule!.upsertCalendarEvent(
    appointmentTitle(appointment),
    scheduledAt.getTime(),
    scheduledAt.getTime() + 60 * 60 * 1000,
    appointment.location ?? null,
    appointment.note ?? null,
    existingEventId,
  );

  if (!eventId) {
    return false;
  }

  calendarMap[appointment.id] = eventId;
  await saveCalendarEventMap(calendarMap);
  return true;
}




