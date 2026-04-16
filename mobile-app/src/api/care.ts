import apiClient from "./client";

export interface CareTimelineItem {
  id: string;
  kind: "dietitian_note" | "client_message" | "dietitian_reply";
  direction: "inbound" | "outbound";
  text: string;
  createdAtUtc: string;
  isRead: boolean;
}

export interface CareDietitianInfo {
  id: string;
  name: string;
  clinicName?: string | null;
}

export interface CareThreadResponse {
  activeDietitian?: CareDietitianInfo | null;
  items: CareTimelineItem[];
}

export interface AppointmentSummary {
  id: string;
  title: string;
  scheduledAtUtc: string;
  mode: string;
  location?: string | null;
  note?: string | null;
  attendanceStatus?: "pending" | "attended" | "missed";
  attendanceMarkedAtUtc?: string | null;
}

export async function getCareThread(): Promise<CareThreadResponse> {
  const res = await apiClient.get<CareThreadResponse>("/api/client/messages");
  return {
    activeDietitian: res.data?.activeDietitian ?? null,
    items: res.data?.items ?? [],
  };
}

export async function sendCareMessage(text: string): Promise<CareTimelineItem> {
  const res = await apiClient.post<{ item: CareTimelineItem }>("/api/client/messages", { text });
  return res.data.item;
}

export async function getAppointments(): Promise<AppointmentSummary[]> {
  const res = await apiClient.get<{ items: AppointmentSummary[] }>("/api/client/appointments");
  return res.data?.items ?? [];
}

export async function markAppointmentAttendance(
  appointmentId: string,
  status: "attended" | "missed",
): Promise<{ appointment: AppointmentSummary; item?: CareTimelineItem }> {
  const res = await apiClient.post<{ appointment: AppointmentSummary; item?: CareTimelineItem }>(
    `/api/client/appointments/${appointmentId}/attendance`,
    { status },
  );
  return res.data;
}
