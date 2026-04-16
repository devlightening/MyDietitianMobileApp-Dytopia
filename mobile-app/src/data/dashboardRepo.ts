import apiClient from '../api/client';

/**
 * Dashboard data transfer object
 * Matches backend DashboardDTO.cs
 */
export interface DashboardDTO {
  /** Current date (ISO format) */
  date: string;

  /** Clinic name (premium only) */
  clinicName?: string;

  /** User's first name for greeting */
  greetingName?: string;

  /** Compliance percentage (0-100) */
  compliancePercent: number;

  /** Today's status */
  todayStatus: 'on-track' | 'needs-attention' | 'off-track';

  /** Next meal information (premium only) */
  nextMeal?: {
    /** Meal time (HH:mm format, e.g., "14:30") */
    time?: string;
    /** Meal title/name */
    title?: string;
    /** Optional note or instruction */
    note?: string;
    /** Meal ID for navigation */
    mealId?: number;
  };

  /** Pinned dietitian note (premium only) */
  dietitianNote?: string;

  /** Dashboard summary statistics (premium only) */
  summary?: {
    /** Current streak (days) */
    streak?: number;
    /** Calories consumed today */
    caloriesToday?: number;
    /** Water glasses consumed */
    waterGlasses?: number;
    /** Steps count */
    steps?: number;

    /** Earned badge count */
    badgeCount?: number;
  };

  /** Motivation metadata used by streak UI and notifications */
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

/**
 * Normalized error types for dashboard API
 */
export type DashboardError =
  | { type: 'NetworkError'; message: string; status?: never }
  | { type: 'Unauthorized'; message: string; status: 401 }
  | { type: 'NotFound'; message: string; status: 404 }
  | { type: 'ServerError'; message: string; status: number };

/**
 * Get dashboard data for the current user
 * Calls GET /api/client/dashboard
 */
export async function getDashboardData(): Promise<DashboardDTO> {
  try {
    const response = await apiClient.get<DashboardDTO>('/api/client/dashboard');
    return response.data;
  } catch (error: any) {
    // Normalize errors with proper status mapping
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message || error.response?.data?.error;

    // Network errors (no response from server)
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      const err: DashboardError = {
        type: 'NetworkError',
        message: 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.'
      };
      throw err;
    }

    // 401 Unauthorized
    if (status === 401) {
      const err: DashboardError = {
        type: 'Unauthorized',
        message: 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.',
        status: 401
      };
      throw err;
    }

    // 404 Not Found
    if (status === 404) {
      const err: DashboardError = {
        type: 'NotFound',
        message: __DEV__
          ? 'Dashboard endpoint bulunamadı: /api/client/dashboard'
          : 'Dashboard yüklenemedi.',
        status: 404
      };
      throw err;
    }

    // 500+ Server Error
    if (status && status >= 500) {
      const err: DashboardError = {
        type: 'ServerError',
        message: serverMessage || 'Sunucu hatası. Lütfen tekrar deneyin.',
        status
      };
      throw err;
    }

    // Other HTTP errors
    const err: DashboardError = {
      type: 'ServerError',
      message: serverMessage || 'Dashboard yüklenirken bir hata oluştu.',
      status: status || 500
    };
    throw err;
  }
}
