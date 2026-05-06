import apiClient from './client';
import type { MappingType } from './acquisition';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Availability state of the vision detection feature returned with every response.
 * "active"          — feature is enabled and OPENAI_API_KEY is set.
 * "disabled"        — VisionIngredient:Enabled = false in server config.
 * "apikeymissing"   — enabled but the API key environment variable is not set.
 */
export type VisionFeatureStatus = 'active' | 'disabled' | 'apikeymissing';

export interface DetectedIngredient {
  ingredientId: string;
  canonicalName: string;
  confidence: number;
  /** Raw name returned by the vision service before normalization */
  detectedName: string;
  /** Normalized (lowercase-trimmed) form used for resolver lookup */
  normalizedLabel: string;
  /**
   * Which resolver layer matched this ingredient.
   * "mapping_table" | "canonical" | "exact_alias" | "fuzzy" | "llm"
   */
  matchedBy: string;
  mappingType: MappingType;
  /** True when the ingredient can be added without user confirmation (high-confidence approved mapping). */
  isAutoSelected: boolean;
  /** True when a match exists but the user should review before accepting (general label, fuzzy, etc.). */
  requiresConfirmation: boolean;
}

export interface AnalyzeImageResponse {
  sessionId: string;
  /** Availability state — always present. Check this before rendering results. */
  featureStatus: VisionFeatureStatus;
  totalDetected: number;
  /** GPT-4o prompt tokens consumed (0 when featureStatus !== "active"). */
  promptTokens: number;
  /** GPT-4o completion tokens consumed (0 when featureStatus !== "active"). */
  completionTokens: number;
  matched: DetectedIngredient[];
  /** Food names GPT detected but the DB could not normalize */
  unmatched: string[];
  /**
   * Machine-readable failure reason. Undefined on success.
   * "image_too_large" — image exceeded backend size limit even after client-side compression.
   */
  reason?: 'image_too_large';
  /** User-facing Turkish error message. Present only when reason is set. */
  userMessage?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function analyzeIngredientImage(
  base64Image: string,
  mediaType: string = 'image/jpeg',
): Promise<AnalyzeImageResponse> {
  const res = await apiClient.post<AnalyzeImageResponse>(
    '/api/ingredients/analyze-image',
    { base64Image, mediaType },
    {
      // Vision calls can take 20-25s — override the default 10s client timeout
      timeout: 35_000,
    },
  );
  return res.data;
}

/**
 * Records which ingredients the user accepted after reviewing scan results.
 * Call this once after the user confirms or dismisses the review screen.
 */
export async function confirmDetection(
  sessionId: string,
  acceptedIngredientIds: string[],
): Promise<void> {
  await apiClient.post('/api/ingredients/detect/confirm', {
    sessionId,
    acceptedIngredientIds,
  });
}
