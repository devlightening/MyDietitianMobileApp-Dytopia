import apiClient from "./client";
import type {
  AlternativeDecisionRequest,
  AlternativeDecisionResponse,
  Ingredient,
} from "../types/alternative";

// ─── Recipe Plan Context ───────────────────────────────────────────────────────

export interface RecipeIngredientItem {
  id: string;
  name: string;
}

export interface RecipePlanContext {
  recipeId: string;
  recipeName: string;
  description: string;
  steps: string[];
  caloriesKcal?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  ingredients: {
    mandatory: RecipeIngredientItem[];
    optional: RecipeIngredientItem[];
  };
}

export async function getRecipePlanContext(recipeId: string): Promise<RecipePlanContext> {
  const res = await apiClient.get<RecipePlanContext>(`/api/client/recipes/${recipeId}/plan-context`);
  return res.data;
}

// Shape returned by GET /api/ingredients/search?q=...
interface IngredientSearchResponse {
  page: number;
  pageSize: number;
  total: number;
  ingredients: Ingredient[];
}

const FALLBACK: Ingredient[] = [
  { id: "yumurta-fallback", canonicalName: "Yumurta" },
  { id: "yogurt-fallback",  canonicalName: "Yoğurt" },
  { id: "domates-fallback", canonicalName: "Domates" },
  { id: "tavuk-fallback",   canonicalName: "Tavuk Göğsü" },
  { id: "sut-fallback",     canonicalName: "Süt" },
];

export async function searchIngredients(query: string): Promise<Ingredient[]> {
  try {
    // Primary param is "q"; backend also accepts legacy "query" alias
    const res = await apiClient.get<IngredientSearchResponse>(
      "/api/ingredients/search",
      { params: { q: query } }
    );
    // Extract the nested ingredients array from the paginated response envelope
    return res.data?.ingredients ?? [];
  } catch {
    // Network/server error → show local fallback filtered by query
    const q = query.trim().toLowerCase();
    return FALLBACK.filter((i) => i.canonicalName.toLowerCase().includes(q));
  }
}

export async function decideAlternative(payload: AlternativeDecisionRequest): Promise<AlternativeDecisionResponse> {
  const res = await apiClient.post<AlternativeDecisionResponse>("/api/alternative/decide", payload);
  return res.data;
}
