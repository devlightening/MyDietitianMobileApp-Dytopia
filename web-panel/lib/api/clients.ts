import api from '../api';

export interface Client {
  id: string;
  fullName: string;
  email: string;
  publicUserId: string;
  isPremium: boolean;
  premiumActivatedAt?: string;
  premiumExpiresAt?: string;
  activeDietitianId?: string;
}

export interface ClientDetail extends Client {
  gender: number;
  birthDate: string;
  latestWeight?: number;
  latestHeight?: number;
  latestBmi?: number;
  latestBmr?: number;
}

export interface ClientMeasurement {
  id: string;
  weightKg: number;
  heightCm: number;
  bmi: number;
  bmr: number;
  createdAt: string;
}

/**
 * Get list of all clients for the authenticated dietitian
 */
export async function getClients(): Promise<{ clients: Client[] }> {
  const res = await api.get('/api/dietitian/clients');
  return res.data;
}

/**
 * Get detailed information for a specific client by ID
 * IDOR protected - only returns clients linked to authenticated dietitian
 */
export async function getClientById(clientId: string): Promise<ClientDetail> {
  const res = await api.get(`/api/dietitian/clients/${clientId}`);
  return res.data;
}

/**
 * Get client measurements history
 */
export async function getClientMeasurements(
  clientId: string,
  lastNDays?: number
): Promise<{ measurements: ClientMeasurement[] }> {
  const params = lastNDays ? { lastNDays } : {};
  const res = await api.get(`/api/dietitian/clients/${clientId}/measurements`, { params });
  return res.data;
}
