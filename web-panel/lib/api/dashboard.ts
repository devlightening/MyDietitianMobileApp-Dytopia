import api from '../api';

export interface DashboardStats {
  recipeCount: number;
  accessKeyCount: number;
  activeClientsCount: number;
  totalClientsCount: number;
}

export interface ActivityFeedItem {
  id: string;
  type: 'login' | 'meal_logged' | 'weight_update' | 'plan_assigned' | 'compliance';
  clientId: string;
  clientName: string;
  timestamp: string;
  metadata?: {
    weight?: number;
    mealName?: string;
    planName?: string;
    complianceRate?: number;
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await api.get('/api/dietitian/dashboard/stats');
  return response.data;
}

export async function getActivityFeed(limit: number = 20): Promise<ActivityFeedItem[]> {
  const response = await api.get('/api/dietitian/dashboard/activity', {
    params: { limit },
  });
  return response.data.activities || [];
}
