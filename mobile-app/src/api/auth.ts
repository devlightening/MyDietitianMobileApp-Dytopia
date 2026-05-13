import apiClient from './client';
import type { RegisterRequest, LoginRequest, AuthResponse, ActivatePremiumRequest, ActivatePremiumResponse } from '../types/auth';

export async function registerClient(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/api/client/register', data);
  return response.data;
}

export async function loginClient(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/api/client/login', data);
  return response.data;
}

export async function activatePremium(data: ActivatePremiumRequest): Promise<ActivatePremiumResponse> {
  const response = await apiClient.post<ActivatePremiumResponse>('/api/client/activate-premium', data);
  return response.data;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  signOutOtherSessions?: boolean;
}

export interface ChangePasswordResponse {
  ok: boolean;
  token: string;
  expiresAtUtc: string;
  message: string;
}

export async function changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  const response = await apiClient.post<ChangePasswordResponse>('/api/auth/change-password', data);
  return response.data;
}
