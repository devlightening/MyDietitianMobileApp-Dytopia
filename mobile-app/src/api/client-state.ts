import apiClient from './client';

export interface ClientStateResponse {
  userId: string;
  publicUserId: string;
  isPremium: boolean;
  premiumUntilUtc: string | null;
  activeDietitianId: string | null;
  fullName: string;
  email: string;
}

export async function getClientState(): Promise<ClientStateResponse> {
  const response = await apiClient.get<ClientStateResponse>('/api/client/me');
  return response.data;
}
