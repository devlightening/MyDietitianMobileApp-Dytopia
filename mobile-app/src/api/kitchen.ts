import apiClient from "./client";
import type { Ingredient } from '../types/alternative';

// â”€â”€â”€ Recipe Match â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface MatchedMissingItem {
  ingredient: { id: string; name: string };
  suggestedSubstitutes: { id: string; name: string }[];
}

export type MatchCategory = "FULL_MATCH" | "SUBSTITUTE_MATCH" | "PARTIAL_MISSING";

/** Server truth for ownership â€” do not infer from DietitianId alone */
export type KitchenSourceType =
  | "LINKED_CLINIC_PRIVATE"
  | "LINKED_CLINIC_PUBLIC"
  | "GLOBAL_PUBLIC_FALLBACK"
  | "OTHER_DIETITIAN_PUBLIC";

export interface RecipeMatchExplanation {
  matchCategory: MatchCategory;
  matchStatus: "FULL_MATCH" | "ONE_MISSING" | "PARTIAL_MATCH";
  sourceType: KitchenSourceType | string;
  sourceDietitianId?: string | null;
  sourceDietitianName?: string | null;
  isOwnedByActiveDietitian?: boolean;
  isPublicFallback?: boolean;
  /** @deprecated Prefer isOwnedByActiveDietitian */
  isTenantRecipe?: boolean;
  isPublicRecipe: boolean;
  totalMandatoryCount: number;
  matchedMandatoryCount: number;
  coreMandatoryMatchedCount?: number;
  condimentMandatoryMatchedCount?: number;
  optionalCount: number;
  matchedOptionalCount: number;
  supportTotalCount?: number;
  supportMatchedCount?: number;
  usedSubstitutes: { id: string; name: string }[];
  missingMandatory: MatchedMissingItem[];
  missingMandatoryIngredientNames?: string[];
  matchedIngredients: { id: string; name: string }[];
  matchedOptionalIngredients?: { id: string; name: string }[];
  missingOptionalIngredients?: { id: string; name: string }[];
  matchedFlavoringIngredients?: { id: string; name: string }[];
  missingFlavoringIngredients?: { id: string; name: string }[];
  matchedSupportIngredients?: { id: string; name: string }[];
  missingSupportIngredients?: { id: string; name: string }[];
  flavoringTotalCount?: number;
  flavoringMatchedCount?: number;
  condimentMatches?: string[];
  blockedByRules: string[];
  rankingReason: string;
  narrationInput: string;
}

export interface RecipeMatchResult {
  recipeId: string;
  name: string;
  description: string;
  matchStatus: "FULL_MATCH" | "ONE_MISSING" | "PARTIAL_MATCH";
  matchCategory: MatchCategory;
  sourceType: KitchenSourceType | string;
  sourceDietitianId?: string | null;
  sourceDietitianName?: string | null;
  /** True only when the recipe belongs to the client's linked clinic */
  isOwnedByActiveDietitian?: boolean;
  /** True when recipe is public catalog / other author â€” not the linked clinic's private pool */
  isPublicFallback?: boolean;
  compatibilityPercent?: number;
  score: number;
  scoreRaw?: number;
  mandatoryCount: number;
  matchedMandatoryCount: number;
  usedSubstitutes: boolean;
  missing: MatchedMissingItem[];
  steps: string[];
  hasSteps: boolean;
  isPublic: boolean;
  /** @deprecated Use isOwnedByActiveDietitian */
  isDietitianRecipe: boolean;
  motivationText: string;
  explanation?: RecipeMatchExplanation;
  // Nutritional values (present when the recipe has them set)
  caloriesKcal?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
}

export interface RecipeMatchMeta {
  selectedIngredientCount: number;
  isPremium: boolean;
  activeDietitianId?: string;
  allowGlobalPublicFallback?: boolean;
  tenantRecipeCount: number;
  publicRecipeCount: number;
  fullMatchCount: number;
  partialMatchCount: number;
}

export interface RecipeMatchResponse {
  page: number;
  pageSize: number;
  total: number;
  results: RecipeMatchResult[];
  meta?: RecipeMatchMeta;
}

export async function matchKitchen(ingredientIds: string[]): Promise<RecipeMatchResponse> {
  const res = await apiClient.post<RecipeMatchResponse>("/api/recipes/match", {
    ingredientIds,
  });
  return res.data;
}

// â”€â”€â”€ Ingredient Packs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface IngredientPackItem {
  id: string;
  name: string;
}

export interface IngredientPack {
  id: string;
  name: string;
  sortOrder: number;
  items: IngredientPackItem[];
}

export async function getIngredientPacks(): Promise<IngredientPack[]> {
  try {
    const res = await apiClient.get<{ packs: IngredientPack[] }>("/api/ingredients/packs");
    return res.data?.packs ?? [];
  } catch {
    return [];
  }
}

/**
 * Returns the most recently used ingredients from the client's pantry.
 * Powers the "Son Kullandıklarım" quick-add row in KitchenScreen.
 * Returns [] on any error (unauthenticated users silently get nothing).
 */
export async function getRecentPantryIngredients(limit = 8): Promise<Ingredient[]> {
  try {
    const res = await apiClient.get<{ items: { id: string; name: string }[] }>(
      `/api/client/pantry/recent?limit=${limit}`,
    );
    return (res.data?.items ?? []).map(item => ({ id: item.id, canonicalName: item.name }));
  } catch {
    return [];
  }
}

// â”€â”€â”€ Plan Meal Completion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function completeMealItem(mealItemId: string): Promise<void> {
  await apiClient.post(`/api/client/meals/${mealItemId}/complete`);
}

export async function uncompleteMealItem(mealItemId: string): Promise<void> {
  await apiClient.delete(`/api/client/meals/${mealItemId}/complete`);
}

