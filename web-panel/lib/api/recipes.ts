import api from '../api';

export interface RecipeIngredientSummary {
  id: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  displayAmount?: string | null;
}

export interface RecipeAnalyticsPreview {
  assignmentCount: number;
  plannedCompletionCount: number;
  plannedCompletionRate: number;
  alternativeSelectedCount: number;
  recommendationPickCount: number;
  uniqueClientCount: number;
  lastUsedAt?: string | null;
  lastCompletedAt?: string | null;
  recentTrendDelta: number;
  preferenceScore: number;
}

export interface RecipeListItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  isPublic: boolean;
  isArchived: boolean;
  isFavorited: boolean;
  sourceType: 'clinic' | 'general';
  mandatoryIngredientCount: number;
  optionalIngredientCount: number;
  prohibitedIngredientCount: number;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  tags: string[];
  isActiveInPlans: boolean;
  analyticsPreview: RecipeAnalyticsPreview;
}

export type Recipe = RecipeListItem;

export interface RecipeDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  isPublic: boolean;
  isArchived: boolean;
  isFavorited: boolean;
  sourceType: 'clinic' | 'general';
  tags: string[];
  steps: string[];
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  mandatoryIngredients: RecipeIngredientSummary[];
  optionalIngredients: RecipeIngredientSummary[];
  flavoringIngredients: RecipeIngredientSummary[];
  prohibitedIngredients: RecipeIngredientSummary[];
  canEdit: boolean;
  canDelete: boolean;
  canArchive: boolean;
  deleteMode: 'archive' | 'delete';
  isActiveInPlans: boolean;
  analyticsPreview: RecipeAnalyticsPreview;
}

export interface RecipeClientPreference {
  clientId: string;
  clientName: string;
  assignmentCount: number;
  completionCount: number;
  alternativeSelectionCount: number;
  lastInteractionAt?: string | null;
}

export interface RecipeAnalytics {
  recipeId: string;
  assignmentCount: number;
  plannedCompletionCount: number;
  plannedCompletionRate: number;
  alternativeSelectedCount: number;
  recommendationPickCount: number;
  uniqueClientCount: number;
  lastUsedAt?: string | null;
  lastCompletedAt?: string | null;
  recentTrendDelta: number;
  preferenceScore: number;
  strengthReasons: string[];
  clientPreferences: RecipeClientPreference[];
}

export interface RecipeOverviewSummary {
  totalRecipes: number;
  archivedRecipes: number;
  favoriteRecipes: number;
  activePlanRecipes: number;
}

export interface RecipeOverview {
  summary: RecipeOverviewSummary;
  favorites: RecipeListItem[];
  mostCompleted: RecipeListItem[];
  mostPreferred: RecipeListItem[];
  rising: RecipeListItem[];
}

export interface Ingredient {
  id: string;
  canonicalName: string;
  name: string;
  aliases?: string[];
  category?: string;
}

export interface SaveRecipeRequest {
  name: string;
  description?: string;
  isPublic: boolean;
  ingredients?: SaveRecipeIngredient[];
  mandatoryIngredients: string[];
  optionalIngredients?: string[];
  flavoringIngredients?: string[];
  prohibitions?: string[];
  tags?: string[];
  steps?: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  caloriesKcal?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
}

export interface SaveRecipeIngredient {
  ingredientId: string;
  role: 'Mandatory' | 'Optional' | 'Flavoring' | 'Prohibited';
  quantity?: number | null;
  unit?: string | null;
}

export interface PopularRecipe {
  recipeId: string;
  recipeName: string;
  completionCount: number;
}

export function getRecipeRoute(recipe: { id: string; slug?: string | null }): string {
  return `/dashboard/recipes/${recipe.slug || recipe.id}`;
}

export async function searchIngredients(query: string, limit = 20): Promise<{ items: Ingredient[] }> {
  const res = await api.get('/api/ingredients/search', {
    params: { q: query, limit },
  });
  const raw: Array<{ id: string; canonicalName: string; aliases?: string[] }> =
    res.data?.ingredients ?? res.data?.items ?? [];
  return {
    items: raw.map((item) => ({
      id: item.id,
      canonicalName: item.canonicalName,
      name: item.canonicalName,
      aliases: item.aliases,
    })),
  };
}

export async function getRecipes(params?: {
  page?: number;
  pageSize?: number;
  visibility?: 'public' | 'private';
  q?: string;
  tag?: string;
  source?: 'all' | 'clinic' | 'public';
  status?: 'active' | 'archived' | 'all';
  range?: '7d' | '30d' | 'all';
}): Promise<{ items: RecipeListItem[]; total: number; page: number; pageSize: number }> {
  const res = await api.get('/api/dietitian/recipes', { params });
  return res.data;
}

export async function getRecipeOverview(range: '7d' | '30d' | 'all' = '30d'): Promise<RecipeOverview> {
  const res = await api.get('/api/dietitian/recipes/overview', {
    params: { range },
  });
  return res.data;
}

export async function getRecipeById(recipeId: string, range: '7d' | '30d' | 'all' = '30d'): Promise<RecipeDetail> {
  const recipeIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const endpoint = recipeIdPattern.test(recipeId)
    ? `/api/dietitian/recipes/${recipeId}`
    : `/api/dietitian/recipes/slug/${encodeURIComponent(recipeId)}`;
  const res = await api.get(endpoint, { params: { range } });
  return res.data;
}

export async function getRecipeAnalytics(recipeId: string, range: '7d' | '30d' | 'all' = '30d'): Promise<RecipeAnalytics> {
  const res = await api.get(`/api/dietitian/recipes/${recipeId}/analytics`, {
    params: { range },
  });
  return res.data;
}

export async function createRecipe(data: SaveRecipeRequest): Promise<RecipeDetail> {
  const res = await api.post('/api/dietitian/recipes', data);
  return res.data;
}

export async function updateRecipe(recipeId: string, data: SaveRecipeRequest): Promise<RecipeDetail> {
  const res = await api.put(`/api/dietitian/recipes/${recipeId}`, data);
  return res.data;
}

export async function deleteRecipe(recipeId: string): Promise<{ mode: 'archive' | 'deleted'; message: string }> {
  const res = await api.delete(`/api/dietitian/recipes/${recipeId}`);
  return res.data;
}

export async function favoriteRecipe(recipeId: string): Promise<{ isFavorited: boolean; message: string }> {
  const res = await api.post(`/api/dietitian/recipes/${recipeId}/favorite`);
  return res.data;
}

export async function unfavoriteRecipe(recipeId: string): Promise<{ isFavorited: boolean; message: string }> {
  const res = await api.delete(`/api/dietitian/recipes/${recipeId}/favorite`);
  return res.data;
}

export async function getPopularRecipes(range: 'week' | 'month' | 'all' = 'week'): Promise<{ items: PopularRecipe[] }> {
  const res = await api.get('/api/dietitian/recipes/popular', {
    params: { range },
  });
  return res.data;
}
