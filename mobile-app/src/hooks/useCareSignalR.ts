import { useEffect, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import * as SignalR from "@microsoft/signalr";
import { API_BASE_URL } from "../config/api";

type SyncEvent = {
  eventType: string;
  payload?: Record<string, unknown>;
};

/**
 * Connects to /hubs/sync and calls onCareUpdate whenever a
 * "care.thread.updated" event arrives for the current user.
 * The hook enables itself only when `enabled` is true (screen is active).
 */
export function useCareSignalR(onCareUpdate: () => void, enabled: boolean) {
  const connectionRef = useRef<SignalR.HubConnection | null>(null);
  const onUpdateRef   = useRef(onCareUpdate);

  useEffect(() => { onUpdateRef.current = onCareUpdate; }, [onCareUpdate]);

  useEffect(() => {
    if (!enabled) return;

    const connection = new SignalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/sync`, {
        accessTokenFactory: async () => (await SecureStore.getItemAsync("access_token")) ?? "",
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(SignalR.LogLevel.Warning)
      .build();

    connection.on("sync.event", (envelope: SyncEvent) => {
      if (envelope?.eventType === "care.thread.updated") {
        onUpdateRef.current();
      }
    });

    connectionRef.current = connection;

    void connection.start().catch(() => {
      // Silent — will retry via withAutomaticReconnect
    });

    return () => {
      connectionRef.current = null;
      void connection.stop();
    };
  }, [enabled]);
}
