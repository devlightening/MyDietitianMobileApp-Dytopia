import apiClient from "../api/client";

export interface ClientPlan {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  mealCount: number;
  completedMeals: number;
}

export interface PlansData {
  plans: ClientPlan[];
  isPremium: boolean;
}

// ─── Today's Plan (Sprint 1) ───────────────────────────────────────────────

export interface MacrosData {
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
}

/**
 * MealType string values from backend PlanMealItemType enum.
 * Breakfast | MidMorning | Lunch | Afternoon | Dinner | Evening | Snack
 */
export type MealType =
  | "Breakfast"
  | "MidMorning"
  | "Lunch"
  | "Afternoon"
  | "Dinner"
  | "Evening"
  | "Snack";

/** One of four status values. "Planned" is the default (not acted on yet). */
export type MealCompletionStatus = "Planned" | "Done" | "Skipped" | "Alternative";
export type MealCompletionTarget = "Original" | "Alternative";

export interface MealItem {
  id: string;
  time: string; // "HH:mm"
  mealType: MealType;
  title: string;
  note?: string;
  orderIndex: number;
  // Planned recipe nutrition
  calories?: number;
  macros?: MacrosData;
  recipeId?: string;
  recipeName?: string;
  selectedRecipeId?: string;
  selectedRecipeName?: string;
  selectedRecipeSource?: "Original" | "Alternative";
  selectedCalories?: number;
  selectedMacros?: MacrosData;
  completionStatus: MealCompletionStatus;
  feedbackKey?: string | null;
  alternativeRecipeId?: string;
  // Alternative recipe details (populated by server when completionStatus="Alternative")
  alternativeRecipeName?: string;
  alternativeCalories?: number;
  alternativeMacros?: MacrosData;
  isActionableNow?: boolean;
  actionBlockedUntilDate?: string;
  actionBlockedUntilTime?: string;
}

export interface TodayPlan {
  id: string;
  clientId: string;
  date: string;
  status: string;
  items: MealItem[];
  updatedAt: string;
}

export interface NextMeal {
  mealItemId: string;
  time: string;
  mealType: MealType;
  title: string;
  recipeId?: string;
  minutesUntil: number;
}

// ─── API calls ─────────────────────────────────────────────────────────────

/**
 * Get all meal plans assigned to this client from /api/client/meal-plans.
 * Returns empty list for free users or when no plans are assigned.
 */
export async function getPlansData(): Promise<PlansData> {
  try {
    const res = await apiClient.get<{ plans: ClientPlan[] }>(
      "/api/client/meal-plans"
    );
    return { plans: res.data?.plans ?? [], isPremium: true };
  } catch (e: any) {
    // 403 = free user — not an error, just no data
    if (e?.response?.status === 403) {
      return { plans: [], isPremium: false };
    }
    throw e;
  }
}

/**
 * GET /api/client/plans/today
 * Returns today's published meal plan with per-item completion status.
 * Returns null if no plan exists for today.
 */
export async function getTodayPlan(): Promise<TodayPlan | null> {
  try {
    const res = await apiClient.get<{ plan: TodayPlan | null }>(
      "/api/client/plans/today"
    );
    return res.data?.plan ?? null;
  } catch (e: any) {
    if (e?.response?.status === 403) return null;
    throw e;
  }
}

/**
 * GET /api/client/meals/next
 * Returns the next uncompleted meal for the dashboard hero widget.
 */
export async function getNextMeal(): Promise<NextMeal | null> {
  try {
    const res = await apiClient.get<{ nextMeal: NextMeal | null }>(
      "/api/client/meals/next"
    );
    return res.data?.nextMeal ?? null;
  } catch (e: any) {
    if (e?.response?.status === 403) return null;
    throw e;
  }
}

/** POST /api/client/meals/{id}/complete */
export async function completeMeal(
  mealItemId: string,
  note?: string,
  completionTarget?: MealCompletionTarget,
): Promise<void> {
  await apiClient.post(`/api/client/meals/${mealItemId}/complete`, { note, completionTarget });
}

/** POST /api/client/meals/{id}/skip */
export async function skipMeal(mealItemId: string, note?: string): Promise<void> {
  await apiClient.post(`/api/client/meals/${mealItemId}/skip`, { note });
}

/** POST /api/client/meals/{id}/alternative */
export async function alternativeMeal(
  mealItemId: string,
  alternativeRecipeId?: string,
  note?: string
): Promise<void> {
  await apiClient.post(`/api/client/meals/${mealItemId}/alternative`, {
    alternativeRecipeId,
    note,
  });
}

/** DELETE /api/client/meals/{id}/complete — undo completion */
export async function undoMealCompletion(mealItemId: string): Promise<void> {
  await apiClient.delete(`/api/client/meals/${mealItemId}/complete`);
}

export async function selectMealRecipe(
  mealItemId: string,
  selectionType: "Original" | "Alternative",
  alternativeRecipeId?: string,
): Promise<void> {
  await apiClient.post(`/api/client/meals/${mealItemId}/selected-recipe`, {
    selectionType,
    alternativeRecipeId: selectionType === "Alternative" ? alternativeRecipeId : undefined,
  });
}

/** POST /api/client/meals/{id}/feedback */
export async function saveMealFeedback(
  mealItemId: string,
  feedbackKey: string,
  recipeSource?: MealCompletionTarget,
): Promise<void> {
  await apiClient.post(`/api/client/meals/${mealItemId}/feedback`, { feedbackKey, recipeSource });
}
