import api from '../api';

export interface MealPlan {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  targetCalories?: number;
  isTemplate: boolean;
  createdAt: string;
}

export interface MealSlot {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  mealType: number; // 1=Breakfast, 2=Snack1, 3=Lunch, 4=Snack2, 5=Dinner, 6=Snack3
  recipeId?: string;
  recipeName?: string;
}

export interface PlanDetail extends MealPlan {
  slots: MealSlot[];
}

export async function getPlans(): Promise<{ plans: MealPlan[] }> {
  const response = await api.get('/api/dietitian/plans');
  return response.data;
}

export async function getPlanDetail(planId: string): Promise<PlanDetail> {
  const response = await api.get(`/api/dietitian/plans/${planId}`);
  return response.data;
}

export async function createPlan(data: {
  name: string;
  description?: string;
  targetCalories?: number;
  isTemplate: boolean;
  slots: Array<{
    dayOfWeek: number;
    mealType: number;
    recipeId?: string;
  }>;
}): Promise<PlanDetail> {
  const response = await api.post('/api/dietitian/plans', data);
  return response.data;
}

export async function updatePlan(
  planId: string,
  data: Partial<{
    name: string;
    description?: string;
    targetCalories?: number;
    slots: Array<{
      dayOfWeek: number;
      mealType: number;
      recipeId?: string;
    }>;
  }>
): Promise<PlanDetail> {
  const response = await api.put(`/api/dietitian/plans/${planId}`, data);
  return response.data;
}

export async function deletePlan(planId: string): Promise<void> {
  await api.delete(`/api/dietitian/plans/${planId}`);
}

export async function assignPlanToClient(planId: string, clientId: string): Promise<void> {
  await api.post(`/api/dietitian/plans/${planId}/assign`, { clientId });
}

// Dashboard and analytics
export interface DashboardSummary {
  activePremiumClients: number;
  averageCompliance: number;
  expiringSoon: number;
  atRisk: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await api.get('/api/dietitian/dashboard/summary');
  return res.data;
}

// Client-specific plan management
export interface ClientPlan {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  mealCount: number;
  completedMeals: number;
}

export async function getClientPlans(clientId: string): Promise<{ items: ClientPlan[] }> {
  const res = await api.get(`/api/dietitian/plans/clients/${clientId}`);
  return res.data;
}

export interface AssignPlanToClientRequest {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  meals: Array<{
    recipeId: string;
    dayOfWeek: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    servings: number;
  }>;
}

export async function assignNewPlanToClient(
  clientId: string,
  data: AssignPlanToClientRequest
): Promise<{ id: string; name: string; startDate: string; endDate?: string; mealCount: number }> {
  const res = await api.post(`/api/dietitian/plans/clients/${clientId}/assign`, data);
  return res.data;
}
