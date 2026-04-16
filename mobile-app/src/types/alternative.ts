export interface AlternativeDecisionRequest {
  dietitianId?: string; // Set by backend from JWT
  plannedRecipeId: string;
  mealType: number;
  clientAvailableIngredients: string[];
}

export interface AlternativeRecipe {
  recipeId: string;
  recipeName: string;
  matchPercentage: number;
  missingIngredientsForAlternative?: string[];
  nutritionalComparison?: string;
}

export interface AlternativeDecisionResponse {
  canCookOriginal: boolean;
  explanation: string;
  /** Backend field name: alternativeRecommendation */
  alternativeRecommendation?: AlternativeRecipe;
  /** Array of ingredient Guid IDs that are missing (not human-readable names) */
  missingIngredients: string[];
  /** Human-readable names for missing ingredients (parallel to missingIngredients) */
  missingIngredientNames: string[];
}

export interface Ingredient {
  id: string;
  canonicalName: string;
  aliases?: string[];
}
