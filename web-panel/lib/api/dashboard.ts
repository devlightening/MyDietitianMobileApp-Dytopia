import api from '../api';

export interface DashboardStats {
  recipeCount: number;
  accessKeyCount: number;
  activeClientsCount: number;
  totalClientsCount: number;
}

export interface ActivityFeedItem {
  id: string;
  type:
    | 'client_linked'
    | 'login'
    | 'meal_logged'
    | 'weight_update'
    | 'plan_assigned'
    | 'compliance'
    | 'badge_unlocked'
    | 'streak_milestone'
    | 'streak_at_risk';
  clientId: string;
  clientName: string;
  timestamp: string;
  metadata?: {
    note?: string;
    weight?: number;
    mealName?: string;
    planName?: string;
    complianceRate?: number;
    badgeId?: string;
    currentStreak?: number;
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await api.get('/api/dietitian/dashboard/stats');
  return response.data;
}

export async function getActivityFeed(limit: number = 20): Promise<ActivityFeedItem[]> {
  const response = await api.get('/api/dietitian/gamification/activity', {
    params: { limit },
  });
  return response.data.activities || response.data.items || [];
}
