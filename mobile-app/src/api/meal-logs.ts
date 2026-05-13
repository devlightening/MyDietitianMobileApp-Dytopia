import apiClient from './client';

export interface MealLog {
  id: string;
  date: string;
  mealType: string;
  notes: string | null;
  photoUrl: string | null;
  foodName: string | null;
  caloriesKcal: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  portionCount: number;
  aiConfidence: number | null;
  analysisJson: string | null;
  source: string;
  createdAtUtc: string;
}

export interface MealPhotoAnalysis {
  featureStatus: string;
  foodName: string;
  confidence: number;
  portionCount: number;
  caloriesKcal: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  ingredients: string[];
  notes: string;
  estimated: boolean;
  analysisJson: string | null;
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
  foodName?: string | null;
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  portionCount?: number | null;
  aiConfidence?: number | null;
  analysisJson?: string | null;
  source?: string | null;
}): Promise<MealLog> {
  const res = await apiClient.post<MealLog>('/api/client/meal-logs', payload);
  return res.data;
}

export async function analyzeMealPhoto(payload: {
  base64Image: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  mealType?: string | null;
}): Promise<MealPhotoAnalysis> {
  const res = await apiClient.post<MealPhotoAnalysis>('/api/client/meal-logs/analyze-photo', payload, {
    timeout: 45000,
  });
  return res.data;
}

export async function deleteMealLog(id: string): Promise<void> {
  await apiClient.delete(`/api/client/meal-logs/${id}`);
}
