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
 * Create a new access key for a client (canonical route).
 * FIX: Backend CreateAccessKeyForClientRequest DTO uses createdAtUtc / expiresAtUtc fields.
 * Backend response returns { success, key, publicUserId, startDate, endDate }.
 */
export async function createAccessKeyForClient(
  publicUserId: string,
  data: { createdAtUtc: string; expiresAtUtc: string }
): Promise<{ key: string; accessKey: string; success: boolean; startDate: string; endDate: string }> {
  const res = await api.post(`/api/dietitian/clients/${publicUserId}/access-key`, data);
  // Normalise: backend returns `key`, expose as both `key` and `accessKey` for compat
  const d = res.data;
  return { ...d, accessKey: d.key ?? d.accessKey };
}

/**
 * Revoke premium access for a client
 */
export async function revokePremium(publicUserId: string): Promise<{ success: boolean }> {
  const res = await api.delete(`/api/dietitian/clients/${publicUserId}/premium`);
  return res.data;
}
