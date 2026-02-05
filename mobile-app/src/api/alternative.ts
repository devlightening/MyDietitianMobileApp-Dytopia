import apiClient from "./client";
import type {
  AlternativeDecisionRequest,
  AlternativeDecisionResponse,
  Ingredient,
} from "../types/alternative";

const FALLBACK: Ingredient[] = [
  { id: "egg", canonicalName: "Egg" },
  { id: "yogurt", canonicalName: "Yogurt" },
  { id: "tuna", canonicalName: "Tuna" },
  { id: "tomato", canonicalName: "Tomato" },
  { id: "cucumber", canonicalName: "Cucumber" },
];

export async function searchIngredients(query: string): Promise<Ingredient[]> {
  // If backend endpoint differs, UI still works with fallback list
  try {
    const res = await apiClient.get<Ingredient[]>("/api/ingredients/search", { params: { query } });
    return res.data ?? [];
  } catch {
    const q = query.trim().toLowerCase();
    return FALLBACK.filter((i) => i.canonicalName.toLowerCase().includes(q));
  }
}

export async function decideAlternative(payload: AlternativeDecisionRequest): Promise<AlternativeDecisionResponse> {
  const res = await apiClient.post<AlternativeDecisionResponse>("/api/alternative/decide", payload);
  return res.data;
}
