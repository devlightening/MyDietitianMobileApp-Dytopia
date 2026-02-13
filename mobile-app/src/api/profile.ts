import { apiClient } from './client';

export async function getMyProfile() {
  const response = await apiClient.get('/api/client/me');
  return response.data;
}
