import apiClient from "./client";

export interface ShoppingListItem {
  id: string;
  ingredientId?: string | null;
  ingredientName?: string | null;
  title: string;
  quantity?: number | null;
  unit?: string | null;
  isChecked: boolean;
  sourceType: string;
  sourceReferenceId?: string | null;
  sourceMeals?: ShoppingSourceMeal[];
  primaryMealTitle?: string | null;
  primaryMealTime?: string | null;
  ingredientRoleSummary?: string[];
  generatedFromSelectedRecipe?: boolean;
  note?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ShoppingSourceMeal {
  mealItemId: string;
  mealTitle: string;
  mealTime: string;
  category: "Mandatory" | "Optional" | "Flavoring" | string;
  selectedRecipeName?: string | null;
  generatedFromSelectedRecipe?: boolean;
}

export interface ShoppingListSummary {
  total: number;
  checkedCount: number;
  activeCount: number;
}

export interface ShoppingPlanIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity?: number | null;
  unit?: string | null;
  displayAmount?: string | null;
}

export interface ShoppingIngredientGroups {
  mandatory: ShoppingPlanIngredient[];
  optional: ShoppingPlanIngredient[];
  flavoring: ShoppingPlanIngredient[];
}

export interface ShoppingCategoryCounts {
  mandatory: number;
  optional: number;
  flavoring: number;
}

export interface ShoppingPlanRecipeCard {
  mealItemId: string;
  mealTitle: string;
  mealTime: string;
  recipeId: string;
  recipeName: string;
  plannedRecipeName?: string | null;
  selectedRecipeSource: "Original" | "Alternative" | string;
  generatedFromSelectedRecipe: boolean;
  missingGroups: ShoppingIngredientGroups;
  pantryCoveredGroups: ShoppingIngredientGroups;
  coveragePercent: number;
  missingCount: number;
  pantryCoveredCount: number;
}

export interface ShoppingListResponse {
  items: ShoppingListItem[];
  summary: ShoppingListSummary;
  generation?: {
    status: "generated" | "empty";
    generatedCount: number;
    planDate: string;
    recipeCount?: number;
    mealCount?: number;
    mandatoryCount?: number;
    optionalCount?: number;
    flavoringCount?: number;
    pantryCoveredCount?: number;
    missingByCategory?: ShoppingCategoryCounts;
    coveredByCategory?: ShoppingCategoryCounts;
    recipeCards?: ShoppingPlanRecipeCard[];
    message: string;
  };
}

export async function getShoppingList(): Promise<ShoppingListResponse> {
  const res = await apiClient.get<ShoppingListResponse>("/api/client/shopping-list");
  return {
    items: res.data?.items ?? [],
    summary: res.data?.summary ?? { total: 0, checkedCount: 0, activeCount: 0 },
    generation: res.data?.generation,
  };
}

export async function addShoppingListItem(title: string): Promise<ShoppingListResponse> {
  const res = await apiClient.post<ShoppingListResponse>("/api/client/shopping-list", {
    title,
    ingredientId: null,
    quantity: null,
    unit: null,
    note: null,
  });
  return {
    items: res.data?.items ?? [],
    summary: res.data?.summary ?? { total: 0, checkedCount: 0, activeCount: 0 },
    generation: res.data?.generation,
  };
}

export async function addIngredientsToShoppingList(
  ingredientIds: string[],
  sourceType = "Kitchen",
  sourceReferenceId?: string,
  note?: string,
): Promise<ShoppingListResponse> {
  const res = await apiClient.post<ShoppingListResponse>("/api/client/shopping-list/ingredients", {
    ingredientIds,
    sourceType,
    sourceReferenceId,
    note,
  });
  return {
    items: res.data?.items ?? [],
    summary: res.data?.summary ?? { total: 0, checkedCount: 0, activeCount: 0 },
    generation: res.data?.generation,
  };
}

export async function generateShoppingListFromTodayPlan(): Promise<ShoppingListResponse> {
  const res = await apiClient.post<{
    response?: ShoppingListResponse;
    generation?: ShoppingListResponse["generation"];
    items?: ShoppingListItem[];
    summary?: ShoppingListSummary;
  }>("/api/client/shopping-list/generate/today-plan");

  const payload = res.data?.response ?? res.data;
  return {
    items: payload?.items ?? [],
    summary: payload?.summary ?? { total: 0, checkedCount: 0, activeCount: 0 },
    generation: res.data?.generation ?? payload?.generation,
  };
}

export async function generateShoppingListFromRecipe(recipeId: string): Promise<ShoppingListResponse> {
  const res = await apiClient.post<ShoppingListResponse>(`/api/client/shopping-list/generate/recipe/${recipeId}`);
  return {
    items: res.data?.items ?? [],
    summary: res.data?.summary ?? { total: 0, checkedCount: 0, activeCount: 0 },
    generation: res.data?.generation,
  };
}

export async function toggleShoppingListItem(itemId: string, isChecked: boolean): Promise<ShoppingListResponse> {
  const res = await apiClient.patch<ShoppingListResponse>(`/api/client/shopping-list/${itemId}/toggle`, {
    isChecked,
  });
  return {
    items: res.data?.items ?? [],
    summary: res.data?.summary ?? { total: 0, checkedCount: 0, activeCount: 0 },
    generation: res.data?.generation,
  };
}

export async function deleteShoppingListItem(itemId: string): Promise<void> {
  await apiClient.delete(`/api/client/shopping-list/${itemId}`);
}

export async function clearCheckedShoppingListItems(): Promise<ShoppingListResponse> {
  const res = await apiClient.delete<ShoppingListResponse>("/api/client/shopping-list/checked");
  return {
    items: res.data?.items ?? [],
    summary: res.data?.summary ?? { total: 0, checkedCount: 0, activeCount: 0 },
  };
}
