import api from '../api';

export interface AccessKey {
  id: string;
  accessKey: string;
  publicUserId: string;
  clientFullName: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateAccessKeyRequest {
  publicUserId: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

/**
 * Get all access keys created by the authenticated dietitian
 */
export async function getAccessKeys(): Promise<{ accessKeys: AccessKey[] }> {
  const res = await api.get('/api/dietitian/access-keys');
  return res.data;
}

/**
 * Create a new access key for a client (canonical route)
 */
export async function createAccessKeyForClient(
  publicUserId: string,
  data: { startDate: string; endDate: string }
): Promise<{ accessKey: string }> {
  const res = await api.post(`/api/dietitian/clients/${publicUserId}/access-key`, data);
  return res.data;
}

/**
 * Revoke premium access for a client
 */
export async function revokePremium(publicUserId: string): Promise<{ success: boolean }> {
  const res = await api.delete(`/api/dietitian/clients/${publicUserId}/premium`);
  return res.data;
}
