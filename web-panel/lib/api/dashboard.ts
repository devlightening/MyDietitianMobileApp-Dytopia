import api from '../api';
import type { ActivityMetadata, ActivityType } from '@/lib/activity-format';

export interface DashboardStats {
  recipeCount: number;
  accessKeyCount: number;
  activeClientsCount: number;
  totalClientsCount: number;
}

export interface ActivityFeedItem {
  id: string;
  type: ActivityType;
  clientId: string;
  clientName: string;
  timestamp: string;
  metadata?: ActivityMetadata | string | null;
}

export interface DietitianFavoriteTopRecipe {
  recipeId: string;
  recipeName: string;
  slug: string;
  sourceType: 'clinic' | 'general';
  favoriteCount: number;
  lastFavoritedAtUtc: string;
}

export interface DietitianFavoriteActivity {
  clientId: string;
  clientName: string;
  clientIsPremium: boolean;
  recipeId: string;
  recipeName: string;
  recipeSlug: string;
  sourceType: 'clinic' | 'general';
  favoritedAtUtc: string;
}

export interface DietitianFavoriteOverview {
  totalActiveFavorites: number;
  uniqueClientCount: number;
  topRecipes: DietitianFavoriteTopRecipe[];
  recentActivity: DietitianFavoriteActivity[];
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

export async function getDietitianFavoriteOverview(): Promise<DietitianFavoriteOverview> {
  const response = await api.get('/api/dietitian/recipe-favorites/overview');
  return response.data;
}
