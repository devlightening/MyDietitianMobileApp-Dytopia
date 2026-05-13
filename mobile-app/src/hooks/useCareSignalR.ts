import { useEffect, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import * as SignalR from "@microsoft/signalr";
import { API_BASE_URL } from "../config/api";

type SyncEvent = {
  eventType: string;
  payload?: Record<string, unknown>;
};

const signalRLogger: SignalR.ILogger = {
  log(level, message) {
    if (level >= SignalR.LogLevel.Error) {
      console.warn("[SignalR]", message);
      return;
    }

    if (level >= SignalR.LogLevel.Warning) {
      console.warn("[SignalR]", message);
    }
  },
};

async function stopConnectionSafely(connection: SignalR.HubConnection) {
  if (connection.state === SignalR.HubConnectionState.Disconnected) return;

  try {
    await connection.stop();
  } catch (error) {
    console.warn("[SignalR] stop ignored", error);
  }
}

/**
 * Connects to /hubs/sync and calls onCareUpdate whenever a
 * "care.thread.updated" event arrives for the current user.
 * The hook enables itself only when `enabled` is true (screen is active).
 */
export function useCareSignalR(onCareUpdate: () => void, enabled: boolean) {
  const connectionRef = useRef<SignalR.HubConnection | null>(null);
  const onUpdateRef = useRef(onCareUpdate);
  const lifecycleRef = useRef(0);

  useEffect(() => {
    onUpdateRef.current = onCareUpdate;
  }, [onCareUpdate]);

  useEffect(() => {
    const lifecycleId = ++lifecycleRef.current;
    let cancelled = false;

    if (!enabled) {
      const existing = connectionRef.current;
      connectionRef.current = null;
      if (existing) void stopConnectionSafely(existing);
      return;
    }

    const connection = new SignalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/sync`, {
        accessTokenFactory: async () => (await SecureStore.getItemAsync("access_token")) ?? "",
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalRLogger)
      .build();

    connection.on("sync.event", (envelope: SyncEvent) => {
      if (envelope?.eventType === "care.thread.updated") {
        onUpdateRef.current();
      }
    });

    connectionRef.current = connection;

    const startPromise = connection.start().catch((error) => {
      if (!cancelled) {
        console.warn("[SignalR] start skipped", error);
      }
    });

    return () => {
      cancelled = true;
      if (connectionRef.current === connection) {
        connectionRef.current = null;
      }

      void startPromise.finally(() => {
        const isLatestLifecycle = lifecycleRef.current === lifecycleId;
        const shouldStop =
          !isLatestLifecycle ||
          connection.state !== SignalR.HubConnectionState.Disconnected;

        if (shouldStop) {
          void stopConnectionSafely(connection);
        }
      });
    };
  }, [enabled]);
}
