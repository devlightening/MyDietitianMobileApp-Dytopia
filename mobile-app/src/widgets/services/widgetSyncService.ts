import { API_BASE_URL } from "../../config/api";
import { getWidgetSnapshotBundle } from "../data/widgetDataSource";
import {
  clearNativeWidgetStore,
  refreshNativeWidgets,
  requestNativeWidgetImmediateSync,
  setNativeDailySummarySnapshot,
  setNativeHydrationSnapshot,
  syncNativeWidgetSession,
} from "../native/widgetBridge";

interface WidgetSessionInput {
  accessToken: string | null;
  isAuthenticated: boolean;
  isPremium: boolean;
}

export async function syncWidgetSessionFromAuth(
  input: WidgetSessionInput,
): Promise<void> {
  try {
    if (!input.isAuthenticated || !input.accessToken) {
      await clearNativeWidgetStore();
      return;
    }

    await syncNativeWidgetSession({
      accessToken: input.accessToken,
      apiBaseUrl: API_BASE_URL,
      isAuthenticated: input.isAuthenticated,
      isPremium: input.isPremium,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn("Widget session sync failed:", error);
    }
  }
}

export async function refreshWidgetsFromApp(
  isPremium: boolean,
): Promise<void> {
  try {
    const bundle = await getWidgetSnapshotBundle(isPremium);
    await Promise.all([
      setNativeHydrationSnapshot(bundle.hydration),
      setNativeDailySummarySnapshot(bundle.dailySummary),
    ]);
    await refreshNativeWidgets();
  } catch (error) {
    if (__DEV__) {
      console.warn("Widget refresh from app failed:", error);
    }
  }
}

export async function requestWidgetBackgroundRefresh(): Promise<void> {
  try {
    await requestNativeWidgetImmediateSync();
  } catch (error) {
    if (__DEV__) {
      console.warn("Widget background refresh request failed:", error);
    }
  }
}

export async function clearWidgetsFromApp(): Promise<void> {
  try {
    await clearNativeWidgetStore();
  } catch (error) {
    if (__DEV__) {
      console.warn("Widget clear failed:", error);
    }
  }
}
