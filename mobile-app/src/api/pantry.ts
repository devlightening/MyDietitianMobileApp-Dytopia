import apiClient from "./client";
import type { Ingredient } from "../types/alternative";
import type { AnalyzeImageResponse } from "./vision";

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

export type PantryUpdateSource = "manual" | "barcode" | "photo" | "receipt";

export async function replacePantry(
  items: Ingredient[],
  options?: { sourceType?: PantryUpdateSource },
): Promise<PantryItem[]> {
  const res = await apiClient.put<PantryResponse>("/api/client/pantry", {
    items: items.map((item) => ({
      ingredientId: item.id,
      quantity: null,
      unit: null,
    })),
    sourceType: options?.sourceType ?? "manual",
  });

  return res.data?.items ?? [];
}

export async function analyzeReceiptPantryImage(
  base64Image: string,
  mediaType: string = "image/jpeg",
): Promise<AnalyzeImageResponse> {
  const res = await apiClient.post<AnalyzeImageResponse>(
    "/api/client/pantry/analyze-receipt",
    { base64Image, mediaType },
    { timeout: 35_000 },
  );

  return res.data;
}
