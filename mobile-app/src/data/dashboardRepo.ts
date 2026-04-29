import apiClient from '../api/client';

/**
 * Dashboard data transfer object
 * Matches backend DashboardDTO.cs
 */
export interface DashboardDTO {
  date: string;
  clinicName?: string;
  greetingName?: string;
  compliancePercent: number;
  todayStatus: 'on-track' | 'needs-attention' | 'off-track';
  nextMeal?: {
    kind?: 'upcoming' | 'all-complete' | 'no-plan';
    mealItemId?: string;
    time?: string;
    mealType?: string;
    title?: string;
    note?: string;
    recipeId?: string;
    minutesUntil?: number;
  };
  dietitianNote?: string;
  coachTask?: {
    actionKey: string;
    title: string;
    body: string;
    cta: string;
  };
  summary?: {
    streak?: number;
    caloriesToday?: number;
    waterGlasses?: number;
    steps?: number;
    badgeCount?: number;
  };
  motivation?: {
    currentStreak: number;
    bestStreak: number;
    earnedBadgeCount: number;
    nextMilestoneDays: number;
    achievements: Array<{
      id: string;
      progressCurrent: number;
      progressTarget: number;
      unlocked: boolean;
    }>;
  };
}

export type DashboardError =
  | { type: 'NetworkError'; message: string; status?: never }
  | { type: 'Unauthorized'; message: string; status: 401 }
  | { type: 'NotFound'; message: string; status: 404 }
  | { type: 'ServerError'; message: string; status: number };

export async function getDashboardData(): Promise<DashboardDTO> {
  try {
    const response = await apiClient.get<DashboardDTO>('/api/client/dashboard');
    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message || error.response?.data?.error;

    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      const err: DashboardError = {
        type: 'NetworkError',
        message: 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.',
      };
      throw err;
    }

    if (status === 401) {
      const err: DashboardError = {
        type: 'Unauthorized',
        message: 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.',
        status: 401,
      };
      throw err;
    }

    if (status === 404) {
      const err: DashboardError = {
        type: 'NotFound',
        message: __DEV__
          ? 'Dashboard endpoint bulunamadı: /api/client/dashboard'
          : 'Dashboard yüklenemedi.',
        status: 404,
      };
      throw err;
    }

    if (status && status >= 500) {
      const err: DashboardError = {
        type: 'ServerError',
        message: serverMessage || 'Sunucu hatası. Lütfen tekrar deneyin.',
        status,
      };
      throw err;
    }

    const err: DashboardError = {
      type: 'ServerError',
      message: serverMessage || 'Dashboard yüklenirken bir hata oluştu.',
      status: status || 500,
    };
    throw err;
  }
}

