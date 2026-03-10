import api from '../api';

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  ingredients: RecipeIngredient[];
  createdAt: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
}

// FIX: Field names must match backend CreateRecipeRequest DTO exactly.
// Backend record: (Name, Description, IsPublic, MandatoryIngredients:Guid[], OptionalIngredients:Guid[]?, Prohibitions:Guid[]?)
export interface CreateRecipeRequest {
  name: string;
  description?: string;
  isPublic: boolean;
  mandatoryIngredients: string[];
  optionalIngredients?: string[];
  prohibitions?: string[];
  tags?: string[];
  instructions?: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
}

// FIX: Backend IngredientDto uses `canonicalName`, not `name`.
// We expose both for backward compatibility inside the app.
export interface Ingredient {
  id: string;
  canonicalName: string;  // primary field from backend IngredientDto
  name: string;           // alias for canonicalName — populated by searchIngredients mapper
  aliases?: string[];
  category?: string;
}

export interface PopularRecipe {
  recipeId: string;
  recipeName: string;
  completionCount: number;
}

/**
 * Search ingredients with autocomplete.
 * FIX: Backend returns { page, pageSize, total, ingredients: [{id, canonicalName, aliases}] }
 * but the rest of the app expects { items: Ingredient[] }.
 * This function normalises the response.
 */
export async function searchIngredients(query: string, limit = 20): Promise<{ items: Ingredient[] }> {
  const res = await api.get('/api/ingredients/search', {
    params: { q: query, limit }
  });
  // Backend shape: { page, pageSize, total, ingredients: IngredientDto[] }
  const raw: Array<{ id: string; canonicalName: string; aliases?: string[] }> =
    res.data?.ingredients ?? res.data?.items ?? [];
  const items: Ingredient[] = raw.map((i) => ({
    id: i.id,
    canonicalName: i.canonicalName,
    name: i.canonicalName,   // alias so old code using .name still works
    aliases: i.aliases,
  }));
  return { items };
}

/**
 * Get all recipes created by the authenticated dietitian
 */
export async function getRecipes(params?: {
  page?: number;
  pageSize?: number;
  visibility?: 'public' | 'private';
  q?: string;
}): Promise<{ items: Recipe[]; total: number; page: number; pageSize: number }> {
  const res = await api.get('/api/dietitian/recipes', { params });
  return res.data;
}

/**
 * Get a specific recipe by ID
 */
export async function getRecipeById(recipeId: string): Promise<Recipe> {
  const res = await api.get(`/api/dietitian/recipes/${recipeId}`);
  return res.data;
}

/**
 * Create a new recipe
 */
export async function createRecipe(data: CreateRecipeRequest): Promise<Recipe> {
  const res = await api.post('/api/dietitian/recipes', data);
  return res.data;
}

/**
 * Update an existing recipe
 */
export async function updateRecipe(recipeId: string, data: CreateRecipeRequest): Promise<Recipe> {
  const res = await api.put(`/api/dietitian/recipes/${recipeId}`, data);
  return res.data;
}

/**
 * Delete a recipe
 */
export async function deleteRecipe(recipeId: string): Promise<{ success: boolean }> {
  const res = await api.delete(`/api/dietitian/recipes/${recipeId}`);
  return res.data;
}

/**
 * Get popular recipes
 */
export async function getPopularRecipes(range: 'week' | 'month' | 'all' = 'week'): Promise<{ items: PopularRecipe[] }> {
  const res = await api.get('/api/dietitian/recipes/popular', {
    params: { range }
  });
  return res.data;
}
