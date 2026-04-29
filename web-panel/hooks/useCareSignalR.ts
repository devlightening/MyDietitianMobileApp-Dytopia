"use client";

import { useEffect, useRef } from "react";
import * as SignalR from "@microsoft/signalr";

type SyncEvent = {
  eventType: string;
  payload?: Record<string, unknown>;
};

/**
 * Connects to /hubs/sync (same-origin, cookie auth) and calls
 * onCareUpdate whenever "care.thread.updated" arrives.
 * Enabled only when `enabled` is true.
 */
export function useCareSignalR(onCareUpdate: () => void, enabled: boolean) {
  const onUpdateRef = useRef(onCareUpdate);
  useEffect(() => { onUpdateRef.current = onCareUpdate; }, [onCareUpdate]);

  useEffect(() => {
    if (!enabled) return;

    const connection = new SignalR.HubConnectionBuilder()
      .withUrl("/hubs/sync", {
        // Cookie auth — browser sends cookie automatically (same-origin)
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(SignalR.LogLevel.Warning)
      .build();

    connection.on("sync.event", (envelope: SyncEvent) => {
      if (envelope?.eventType === "care.thread.updated") {
        onUpdateRef.current();
      }
    });

    void connection.start().catch(() => {
      // Silent — withAutomaticReconnect handles retry
    });

    return () => { void connection.stop(); };
  }, [enabled]);
}
