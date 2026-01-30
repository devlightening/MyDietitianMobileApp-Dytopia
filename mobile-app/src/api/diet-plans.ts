import apiClient from './client';
import type { TodayPlan } from '../types/diet-plan';
import axios from 'axios';

export interface PlanError {
  code: string;
  message: string;
}

/**
 * Get today's diet plan (Premium only)
 * Defensive guard: Prevents free users from calling premium endpoint
 * 🔥 Double guard: enabled check in useQuery + this client-side guard
 */
export async function getTodayPlan(user?: { isPremium?: boolean }): Promise<TodayPlan> {
  // 🔥 Defensive guard: Free users should never call this endpoint
  // isPremium must be explicitly true, undefined/false means FREE
  if (user?.isPremium !== true) {
    const error = new Error('Bu özellik premium üyelik gerektirir') as any;
    error.code = 'PREMIUM_REQUIRED_CLIENT_SIDE_GUARD';
    error.status = 403;
    error.type = 'premium_required';
    throw error;
  }

  try {
    const response = await apiClient.get<TodayPlan>('/api/diet-plans/today');
    return response.data;
  } catch (error: any) {
    // Re-throw with error code for better handling
    if (axios.isAxiosError(error) && error.response?.data) {
      const errorData = error.response.data as PlanError;
      const enhancedError = new Error(errorData.message || 'Plan yüklenemedi');
      (enhancedError as any).code = errorData.code || 'UNKNOWN_ERROR';
      (enhancedError as any).status = error.response.status;
      throw enhancedError;
    }
    throw error;
  }
}
