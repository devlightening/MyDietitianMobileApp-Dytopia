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

export interface CreateRecipeRequest {
  name: string;
  description?: string;
  isPublic: boolean;
  ingredients: {
    ingredientId: string;
    quantity: number;
    unit: string;
  }[];
}

/**
 * Get all recipes created by the authenticated dietitian
 */
export async function getRecipes(): Promise<{ recipes: Recipe[] }> {
  const res = await api.get('/api/dietitian/recipes');
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
