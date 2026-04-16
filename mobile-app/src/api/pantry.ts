import apiClient from "./client";
import type { Ingredient } from "../types/alternative";

export interface PantryItem {
  ingredientId: string;
  ingredientName: string;
  quantity?: number | null;
  unit?: string | null;
  updatedAtUtc: string;
}

interface PantryResponse {
  items: PantryItem[];
}

export async function getPantry(): Promise<PantryItem[]> {
  const res = await apiClient.get<PantryResponse>("/api/client/pantry");
  return res.data?.items ?? [];
}

export async function replacePantry(items: Ingredient[]): Promise<PantryItem[]> {
  const res = await apiClient.put<PantryResponse>("/api/client/pantry", {
    items: items.map((item) => ({
      ingredientId: item.id,
      quantity: null,
      unit: null,
    })),
  });

  return res.data?.items ?? [];
}
