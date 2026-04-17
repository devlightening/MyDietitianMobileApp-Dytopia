import apiClient from './client';

export interface TodayTracking {
  date: string;
  waterGlasses: number;
  steps: number;
  notes: string | null;
}

export async function getTodayTracking(): Promise<TodayTracking> {
  const res = await apiClient.get<TodayTracking>('/api/client/tracking/today');
  return res.data;
}

export async function updateTodayTracking(
  waterGlasses: number,
  steps = 0,
  notes: string | null = null,
): Promise<TodayTracking> {
  const res = await apiClient.put<TodayTracking>('/api/client/tracking/today', {
    waterGlasses,
    steps,
    notes,
  });
  return res.data;
}
