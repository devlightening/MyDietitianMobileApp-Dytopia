import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { getAppointments } from "../api/care";
import { useTranslation } from "./I18nContext";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  markNotificationSync,
  postNotificationHeartbeat,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "../api/notification-preferences";
import { getTodayPlan } from "../data/plansRepo";
import {
  clearManagedNotificationsAsync,
  configureNotificationsAsync,
  getNotificationPermissionStatusAsync,
  requestNotificationPermissionAsync,
  scheduleNotificationsFromPreferencesAsync,
  schedulePreviewNotificationAsync,
  type AppNotificationPermissionStatus,
} from "../services/notifications";

interface NotificationContextValue {
  preferences: NotificationPreferences;
  isLoading: boolean;
  isSaving: boolean;
  permissionStatus: AppNotificationPermissionStatus;
  refreshPreferences: () => Promise<void>;
  savePreferences: (next: NotificationPreferences) => Promise<NotificationPreferences>;
  requestPermission: () => Promise<AppNotificationPermissionStatus>;
  syncSchedules: (nextPreferences?: NotificationPreferences) => Promise<void>;
  sendPreviewNotification: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isPremium } = useAuth();
  const { language } = useTranslation();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<AppNotificationPermissionStatus>("undetermined");
  const lastForegroundSyncRef = useRef(0);

  useEffect(() => {
    void configureNotificationsAsync();
    void refreshPermissionStatus();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      void clearManagedNotificationsAsync();
      return;
    }

    void bootstrap();
  }, [isAuthenticated]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void handleAppForeground();
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, preferences, permissionStatus, language, isPremium]);

  async function refreshPermissionStatus() {
    const status = await getNotificationPermissionStatusAsync();
    setPermissionStatus(status);
  }

  async function bootstrap() {
    setIsLoading(true);
    try {
      const next = await getNotificationPreferences();
      setPreferences(next);
      await refreshPermissionStatus();
      await handleAppForeground(true, next);
    } catch (error) {
      console.warn("Notification bootstrap failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAppForeground(force = false, current?: NotificationPreferences) {
    if (!isAuthenticated) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastForegroundSyncRef.current < 60_000) {
      return;
    }

    lastForegroundSyncRef.current = now;

    try {
      await postNotificationHeartbeat();
    } catch (error) {
      console.warn("Notification heartbeat failed:", error);
    }

    const permission = await getNotificationPermissionStatusAsync();
    setPermissionStatus(permission);
    if (permission !== "granted") {
      return;
    }

    await syncSchedules(current ?? preferences);
  }

  async function refreshPreferences() {
    if (!isAuthenticated) {
      return;
    }

    setIsLoading(true);
    try {
      const next = await getNotificationPreferences();
      setPreferences(next);
    } finally {
      setIsLoading(false);
    }
  }

  async function syncSchedules(nextPreferences?: NotificationPreferences) {
    if (!isAuthenticated) {
      return;
    }

    const current = nextPreferences ?? preferences;
    const plan = isPremium ? await getTodayPlan() : null;
    const appointments = isPremium ? await getAppointments().catch(() => []) : [];
    await scheduleNotificationsFromPreferencesAsync(current, plan, language, appointments);
    try {
      await markNotificationSync();
    } catch (error) {
      console.warn("Notification sync mark failed:", error);
    }
  }

  async function savePreferences(next: NotificationPreferences): Promise<NotificationPreferences> {
    setIsSaving(true);
    try {
      const saved = await updateNotificationPreferences(next);
      setPreferences(saved);

      const permission = await getNotificationPermissionStatusAsync();
      setPermissionStatus(permission);
      if (permission === "granted") {
        await syncSchedules(saved);
      } else {
        await clearManagedNotificationsAsync();
      }

      return saved;
    } finally {
      setIsSaving(false);
    }
  }

  async function requestPermission(): Promise<AppNotificationPermissionStatus> {
    const status = await requestNotificationPermissionAsync();
    setPermissionStatus(status);
    if (status === "granted") {
      await syncSchedules();
    }
    return status;
  }

  async function sendPreviewNotification() {
    if (permissionStatus !== "granted") {
      return;
    }
    await schedulePreviewNotificationAsync(language);
  }

  const value = useMemo<NotificationContextValue>(() => ({
    preferences,
    isLoading,
    isSaving,
    permissionStatus,
    refreshPreferences,
    savePreferences,
    requestPermission,
    syncSchedules,
    sendPreviewNotification,
  }), [preferences, isLoading, isSaving, permissionStatus]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
