import { NativeModules, Platform } from "react-native";
import type {
  DailySummaryWidgetSnapshot,
  HydrationWidgetSnapshot,
} from "../types";

interface WidgetSessionPayload {
  accessToken: string | null;
  apiBaseUrl: string;
  isAuthenticated: boolean;
  isPremium: boolean;
}

interface NativeWidgetBridgeModuleShape {
  syncSession: (sessionJson: string) => Promise<void>;
  setHydrationSnapshot: (snapshotJson: string) => Promise<void>;
  setDailySummarySnapshot: (snapshotJson: string) => Promise<void>;
  requestImmediateSync: () => Promise<void>;
  refreshWidgets: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const WidgetBridgeModule =
  NativeModules.WidgetBridgeModule as NativeWidgetBridgeModuleShape | undefined;

function isSupported() {
  return Platform.OS === "android" && !!WidgetBridgeModule;
}

export async function syncNativeWidgetSession(
  payload: WidgetSessionPayload,
): Promise<void> {
  if (!isSupported()) {
    return;
  }

  await WidgetBridgeModule!.syncSession(JSON.stringify(payload));
}

export async function setNativeHydrationSnapshot(
  snapshot: HydrationWidgetSnapshot,
): Promise<void> {
  if (!isSupported()) {
    return;
  }

  await WidgetBridgeModule!.setHydrationSnapshot(JSON.stringify(snapshot));
}

export async function setNativeDailySummarySnapshot(
  snapshot: DailySummaryWidgetSnapshot,
): Promise<void> {
  if (!isSupported()) {
    return;
  }

  await WidgetBridgeModule!.setDailySummarySnapshot(JSON.stringify(snapshot));
}

export async function requestNativeWidgetImmediateSync(): Promise<void> {
  if (!isSupported()) {
    return;
  }

  await WidgetBridgeModule!.requestImmediateSync();
}

export async function refreshNativeWidgets(): Promise<void> {
  if (!isSupported()) {
    return;
  }

  await WidgetBridgeModule!.refreshWidgets();
}

export async function clearNativeWidgetStore(): Promise<void> {
  if (!isSupported()) {
    return;
  }

  await WidgetBridgeModule!.clearAll();
}
