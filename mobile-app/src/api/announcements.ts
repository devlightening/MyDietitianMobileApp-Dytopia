import apiClient from "./client";

export interface ActiveAnnouncement {
  id: string;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string;
}

export async function getActiveAnnouncement(): Promise<ActiveAnnouncement | null> {
  const res = await apiClient.get<{ announcement: ActiveAnnouncement | null }>("/api/client/announcements/active");
  return res.data?.announcement ?? null;
}
