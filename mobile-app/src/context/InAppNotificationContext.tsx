import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import InAppNotificationBanner from "../components/ui/InAppNotificationBanner";
import type { NotificationPreferences } from "../api/notification-preferences";
import { useNotifications } from "./NotificationContext";
import type { InAppNotificationEventType, InAppNotificationPayload } from "../notifications/notificationTypes";

interface InAppNotificationContextValue {
  notify: (payload: InAppNotificationPayload) => void;
}

const DEDUP_WINDOW_MS = 10_000;
const DEFAULT_DURATION_MS = 2400;

const InAppNotificationContext = createContext<InAppNotificationContextValue | null>(null);

function shouldShowForPreferences(
  payload: InAppNotificationPayload,
  preferences: NotificationPreferences,
) {
  if (!preferences.notificationsEnabled || !preferences.inAppCoachNotificationsEnabled) {
    return false;
  }

  const achievementTypes: InAppNotificationEventType[] = ["badge_unlocked", "streak_milestone"];
  const pantryTypes: InAppNotificationEventType[] = ["pantry_updated", "shopping_items_added", "alternate_recipe_applied"];

  if (achievementTypes.includes(payload.type)) {
    return preferences.achievementNotificationsEnabled;
  }

  if (pantryTypes.includes(payload.type)) {
    return preferences.pantryActivityNotificationsEnabled;
  }

  return true;
}

export function InAppNotificationProvider({ children }: { children: React.ReactNode }) {
  const { preferences } = useNotifications();
  const [queue, setQueue] = useState<InAppNotificationPayload[]>([]);
  const [current, setCurrent] = useState<InAppNotificationPayload | null>(null);
  const dedupRef = useRef<Map<string, number>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissCurrent = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCurrent(null);
  }, []);

  const playHaptic = useCallback(async (payload: InAppNotificationPayload) => {
    try {
      if (payload.haptic === "success") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (payload.haptic === "warning") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (payload.haptic === "light") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Non-blocking.
    }
  }, []);

  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    void playHaptic(next);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCurrent(null);
    }, next.durationMs ?? DEFAULT_DURATION_MS);
  }, [current, playHaptic, queue]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const notify = useCallback((payload: InAppNotificationPayload) => {
    if (!shouldShowForPreferences(payload, preferences)) {
      return;
    }

    const now = Date.now();
    const lastShownAt = dedupRef.current.get(payload.dedupKey);
    if (lastShownAt && now - lastShownAt < DEDUP_WINDOW_MS) {
      return;
    }

    dedupRef.current.set(payload.dedupKey, now);
    setQueue((currentQueue) => [...currentQueue, payload]);
  }, [preferences]);

  const value = useMemo<InAppNotificationContextValue>(() => ({ notify }), [notify]);

  return (
    <InAppNotificationContext.Provider value={value}>
      {children}
      {current ? (
        <InAppNotificationBanner
          notification={current}
          onDismiss={dismissCurrent}
        />
      ) : null}
    </InAppNotificationContext.Provider>
  );
}

export function useInAppNotifications() {
  const context = useContext(InAppNotificationContext);
  if (!context) {
    throw new Error("useInAppNotifications must be used within InAppNotificationProvider");
  }
  return context;
}
