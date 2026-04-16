import api from '../api';

export interface CareHubThreadSummary {
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  publicUserId?: string | null;
  unreadCount: number;
  hasUnread: boolean;
  latestText?: string | null;
  latestAtUtc: string;
  latestDirection: 'inbound' | 'outbound' | 'system';
  latestSource: 'message' | 'reply' | 'note' | 'linked';
  nextAppointmentTitle?: string | null;
  nextAppointmentAtUtc?: string | null;
}

export interface CareHubSummaryResponse {
  unreadMessagesCount: number;
  clientsWithUnreadCount: number;
  totalThreads: number;
  threads: CareHubThreadSummary[];
}

export async function getCareHubSummary(limit: number = 8): Promise<CareHubSummaryResponse> {
  const res = await api.get('/api/dietitian/care-hub/summary', {
    params: { limit },
  });
  return {
    unreadMessagesCount: res.data?.unreadMessagesCount ?? 0,
    clientsWithUnreadCount: res.data?.clientsWithUnreadCount ?? 0,
    totalThreads: res.data?.totalThreads ?? 0,
    threads: res.data?.threads ?? [],
  };
}
