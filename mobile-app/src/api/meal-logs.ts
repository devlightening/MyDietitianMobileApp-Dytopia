import apiClient from './client';

export interface MealLog {
  id: string;
  date: string;
  mealType: string;
  notes: string | null;
  photoUrl: string | null;
  createdAtUtc: string;
}

export async function getMealLogs(date?: string): Promise<MealLog[]> {
  const params = date ? { date } : {};
  const res = await apiClient.get<{ logs: MealLog[] }>('/api/client/meal-logs', { params });
  return res.data.logs;
}

export async function createMealLog(payload: {
  mealType: string;
  notes?: string | null;
  photoUrl?: string | null;
  date?: string;
}): Promise<MealLog> {
  const res = await apiClient.post<MealLog>('/api/client/meal-logs', payload);
  return res.data;
}

export async function deleteMealLog(id: string): Promise<void> {
  await apiClient.delete(`/api/client/meal-logs/${id}`);
}
