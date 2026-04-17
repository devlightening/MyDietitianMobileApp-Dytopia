import React, { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import {
  clearWidgetsFromApp,
  refreshWidgetsFromApp,
  requestWidgetBackgroundRefresh,
} from "./services/widgetSyncService";

export default function WidgetSyncBootstrap() {
  const { isAuthenticated, isPremium } = useAuth();

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    if (!isAuthenticated) {
      void clearWidgetsFromApp();
      return;
    }

    void refreshWidgetsFromApp(isPremium);
    void requestWidgetBackgroundRefresh();
  }, [isAuthenticated, isPremium]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && isAuthenticated) {
        void refreshWidgetsFromApp(isPremium);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, isPremium]);

  return null;
}
