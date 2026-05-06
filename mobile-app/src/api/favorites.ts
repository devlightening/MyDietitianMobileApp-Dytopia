import * as SecureStore from "expo-secure-store";
import apiClient from "./client";

export const LEGACY_RECIPE_FAVORITES_KEY = "recipe_favorites_v1";

const FAVORITES_MIGRATION_PREFIX = "recipe_favorites_server_migrated_v1_";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FavoriteIngredientSummary {
  id: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  displayAmount?: string | null;
}

export interface FavoriteCoverageGroup {
  matched: FavoriteIngredientSummary[];
  missing: FavoriteIngredientSummary[];
  total: number;
  matchedCount: number;
  missingCount: number;
}

export interface FavoriteCoverageSummary {
  percent: number;
  matchedCount: number;
  missingCount: number;
  mandatoryPercent: number;
  optionalPercent: number;
  flavoringPercent: number;
  mandatoryWeight: number;
  optionalWeight: number;
  flavoringWeight: number;
  mandatory: FavoriteCoverageGroup;
  optional: FavoriteCoverageGroup;
  flavoring: FavoriteCoverageGroup;
}

export interface FavoriteRecipeCardDto {
  recipeId: string;
  name: string;
  slug: string;
  description: string;
  sourceType: "clinic" | "general";
  isFavorited: boolean;
  lastFavoritedAtUtc: string;
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  tags: string[];
  pantryCoverage: FavoriteCoverageSummary;
  missingMandatoryNames: string[];
  missingOptionalNames: string[];
  missingFlavoringNames: string[];
}

export interface FavoriteRecipesResponse {
  items: FavoriteRecipeCardDto[];
  total: number;
}

export interface FavoriteRecipesSummaryDto {
  totalFavorites: number;
  recentFavorites: FavoriteRecipeCardDto[];
  bestMatchedFavorite?: FavoriteRecipeCardDto | null;
}

export async function getFavoriteRecipes(): Promise<FavoriteRecipesResponse> {
  const res = await apiClient.get<FavoriteRecipesResponse>("/api/client/recipes/favorites");
  return res.data;
}

export async function getFavoriteRecipesSummary(): Promise<FavoriteRecipesSummaryDto> {
  const res = await apiClient.get<FavoriteRecipesSummaryDto>("/api/client/recipes/favorites/summary");
  return res.data;
}

export async function favoriteRecipe(recipeId: string): Promise<{ isFavorited: boolean; message: string }> {
  const res = await apiClient.post<{ isFavorited: boolean; message: string }>(`/api/client/recipes/${recipeId}/favorite`);
  return res.data;
}

export async function unfavoriteRecipe(recipeId: string): Promise<{ isFavorited: boolean; message: string }> {
  const res = await apiClient.delete<{ isFavorited: boolean; message: string }>(`/api/client/recipes/${recipeId}/favorite`);
  return res.data;
}

export async function importLegacyFavoriteRecipes(recipeIds: string[]): Promise<{ importedCount: number; skippedCount: number }> {
  const res = await apiClient.post<{ importedCount: number; skippedCount: number }>(
    "/api/client/recipes/favorites/import",
    { recipeIds },
  );
  return res.data;
}

function getMigrationKey(publicUserId?: string) {
  return `${FAVORITES_MIGRATION_PREFIX}${publicUserId ?? "anonymous"}`;
}

export async function migrateLegacyFavoriteRecipes(publicUserId?: string): Promise<number> {
  if (!publicUserId) return 0;

  const migrationKey = getMigrationKey(publicUserId);
  const alreadyMigrated = await SecureStore.getItemAsync(migrationKey).catch(() => null);
  if (alreadyMigrated === "done") {
    return 0;
  }

  const raw = await SecureStore.getItemAsync(LEGACY_RECIPE_FAVORITES_KEY).catch(() => null);
  if (!raw) {
    await SecureStore.setItemAsync(migrationKey, "done").catch(() => {});
    return 0;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  const recipeIds = Array.isArray(parsed)
    ? parsed
        .filter((item): item is string => typeof item === "string" && UUID_PATTERN.test(item))
        .map(item => item.trim())
    : [];

  if (recipeIds.length === 0) {
    await SecureStore.deleteItemAsync(LEGACY_RECIPE_FAVORITES_KEY).catch(() => {});
    await SecureStore.setItemAsync(migrationKey, "done").catch(() => {});
    return 0;
  }

  const result = await importLegacyFavoriteRecipes(recipeIds);
  await SecureStore.deleteItemAsync(LEGACY_RECIPE_FAVORITES_KEY).catch(() => {});
  await SecureStore.setItemAsync(migrationKey, "done").catch(() => {});
  return result.importedCount;
}
