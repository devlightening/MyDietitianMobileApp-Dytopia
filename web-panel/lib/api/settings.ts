import api from '../api';

export interface DietitianSettings {
  clinicName: string;
  dietitianDisplayName: string;
  primaryColorHex: string;
  accentColorHex: string;
  themePresetKey?: string | null;
  logoUrl?: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
  websiteUrl?: string | null;
  updatedAt: string;
}

export interface UpdateDietitianSettings {
  clinicName: string;
  dietitianDisplayName: string;
  primaryColorHex: string;
  accentColorHex: string;
  themePresetKey?: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
  websiteUrl?: string | null;
}

export async function getSettings(): Promise<DietitianSettings> {
  const response = await api.get('/api/dietitian/settings');
  return response.data;
}

export async function updateSettings(data: UpdateDietitianSettings): Promise<DietitianSettings> {
  const response = await api.put('/api/dietitian/settings', data);
  return response.data;
}

export async function uploadLogo(file: File): Promise<DietitianSettings> {
  const formData = new FormData();
  formData.append('file', file);

  // Don't set Content-Type manually - axios will set it with proper boundary
  const response = await api.post('/api/dietitian/settings/logo', formData);
  return response.data;
}

export async function deleteLogo(): Promise<DietitianSettings> {
  const response = await api.delete('/api/dietitian/settings/logo');
  return response.data;
}
