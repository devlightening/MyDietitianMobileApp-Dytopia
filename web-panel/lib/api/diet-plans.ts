import api from '../api';
import type {
  CreateDietPlanRequest,
  CreateDietPlanResult,
  DietPlan,
} from '../types/diet-plan';

/**
 * Create a new diet plan (canonical endpoint)
 */
export async function createDietPlan(
  data: Omit<CreateDietPlanRequest, 'dietitianId'>
): Promise<CreateDietPlanResult> {
  const response = await api.post<CreateDietPlanResult>('/api/dietitian/plans', data);
  return response.data;
}

/**
 * Get diet plan for a specific client (canonical endpoint)
 */
export async function getDietPlanByClient(clientId: string): Promise<DietPlan | null> {
  try {
    const response = await api.get<DietPlan>(`/api/dietitian/plans/client/${clientId}`);
    return response.data;
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Update an existing diet plan
 */
export async function updateDietPlan(
  planId: string,
  data: Partial<CreateDietPlanRequest>
): Promise<DietPlan> {
  const response = await api.put<DietPlan>(`/api/dietitian/plans/${planId}`, data);
  return response.data;
}

/**
 * Publish a diet plan (make it active for the client)
 */
export async function publishDietPlan(planId: string): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>(`/api/dietitian/plans/${planId}/publish`);
  return response.data;
}

/**
 * Duplicate an existing diet plan
 */
export async function duplicateDietPlan(
  planId: string,
  newStartDate: string
): Promise<{ newPlanId: string }> {
  const response = await api.post<{ newPlanId: string }>(
    `/api/dietitian/plans/${planId}/duplicate`,
    { newStartDate }
  );
  return response.data;
}

/**
 * Delete a diet plan
 */
export async function deleteDietPlan(planId: string): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>(`/api/dietitian/plans/${planId}`);
  return response.data;
}

