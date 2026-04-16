import api from '../api';

export interface CurrentUserResponse {
  userId: string;
  email: string;
  role: 'dietitian' | 'admin' | 'client';
  fullName?: string;
  clinicName?: string;
  dietitianId?: string;
  clientId?: string;
  publicUserId?: string;
  lastPasswordChangedAtUtc?: string | null;
  lastLoginAtUtc?: string | null;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  signOutOtherSessions: boolean;
}

export interface ChangePasswordResponse {
  ok: boolean;
  token?: string;
  expiresAtUtc?: string;
  message?: string;
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  const response = await api.get('/api/auth/me');
  return response.data;
}

export async function changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
  const response = await api.post('/api/auth/change-password', payload);
  return response.data;
}
