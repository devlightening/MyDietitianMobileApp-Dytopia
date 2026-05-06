export interface AlternativeDecisionRequest {
  dietitianId?: string; // Set by backend from JWT
  plannedRecipeId: string;
  mealType: number;
  clientAvailableIngredients: string[];
}

export interface AlternativeRecipe {
  recipeId: string;
  recipeName: string;
  /** Ingredient coverage 0-100 */
  matchPercentage: number;
  missingIngredientsForAlternative?: string[];
  missingIngredientNamesForAlternative?: string[];
  /** Human-readable nutritional delta, e.g. "+3g Protein · âˆ’40 kcal" */
  nutritionalComparison?: string;
  recommendationReasons?: string[];
  planAlignmentNote?: string;
  // Nutritional values of the candidate recipe
  caloriesKcal?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  /** Nutritional proximity score 0-100 (Protein 40%, Calories 25%, Fat 25%, Carbs 10%) */
  nutritionalScore?: number;
  /** Combined ranking score (ingredient 30% + nutrition 50% + protein 15% + cookability 5%) */
  combinedScore?: number;
}

export interface AlternativeDecisionResponse {
  canCookOriginal: boolean;
  explanation: string;
  /** Up to 5 alternatives ordered by combined score (best first) */
  alternativeRecommendations: AlternativeRecipe[];
  /** Best alternative â€” same as alternativeRecommendations[0]. Backward compat. */
  alternativeRecommendation?: AlternativeRecipe;
  /** Array of ingredient Guid IDs that are missing */
  missingIngredients: string[];
  /** Human-readable names for missing ingredients */
  missingIngredientNames: string[];
}

export interface Ingredient {
  id: string;
  canonicalName: string;
  aliases?: string[];
}

