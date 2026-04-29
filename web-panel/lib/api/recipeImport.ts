import api from '../api';

export type ImportSessionStatus =
  | 'Uploading'
  | 'Parsing'
  | 'NeedsReview'
  | 'ReadyToConfirm'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export type ImportDocumentKind = 'StructuredTable' | 'SemiStructuredDoc' | 'TextPdf' | 'Unsupported';
export type ImportMode = 'auto' | 'table' | 'freeform';
export type MatchType = 'Exact' | 'Alias' | 'Normalized' | 'Fuzzy' | 'Ambiguous' | 'Manual' | 'None';
export type IngredientRole = 'Mandatory' | 'Optional' | 'Flavoring' | 'Substitute' | 'Prohibited';
export type IssueSeverity = 'Info' | 'Warning' | 'Error';
export type DuplicateResolutionMode = 'CreateNew' | 'UpdateExisting' | 'Skip';

export interface ImportIngredient {
  id: string;
  rawName: string;
  normalizedName: string;
  rawLineText?: string;
  amountRaw?: string;
  amountValue?: number;
  unit?: string;
  role: IngredientRole;
  matchedIngredientId?: string;
  matchedCanonicalName?: string;
  matchType: MatchType;
  matchConfidence: number;
  parseConfidence: number;
  isResolved: boolean;
  needsReview: boolean;
  issueCodes: string[];
}

export interface ImportIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  hint?: string;
  sessionRecipeId?: string;
  sessionIngredientId?: string;
}

export interface ImportRecipe {
  id: string;
  title: string;
  description?: string;
  isPublic: boolean;
  needsReview: boolean;
  rawSourceBlock?: string;
  steps: string[];
  tags: string[];
  prepTimeText?: string;
  cookTimeText?: string;
  servingsText?: string;
  hasDuplicate: boolean;
  existingRecipeId?: string;
  duplicateResolutionMode: DuplicateResolutionMode;
  isSkipped: boolean;
  displayOrder: number;
  ingredients: ImportIngredient[];
  issues: ImportIssue[];
}

export interface ImportSessionPreview {
  sessionId: string;
  status: ImportSessionStatus;
  originalFileName: string;
  documentKind: ImportDocumentKind;
  parserUsed?: string;
  confidenceScore?: number;
  warnings: string[];
  totalRecipes: number;
  matchedIngredients: number;
  ambiguousIngredients: number;
  unmatchedIngredients: number;
  blockingIssues: number;
  warningsCount: number;
  errorMessage?: string;
  issues: ImportIssue[];
  recipes: ImportRecipe[];
}

export interface ReviewedIngredientDto {
  id: string;
  matchedIngredientId?: string;
  matchedCanonicalName?: string;
  role?: string;
  amountRaw?: string;
  amountValue?: number;
  unit?: string;
  needsReview?: boolean;
  resolutionState?: string;
  issueCodes?: string[];
}

export interface ReviewedRecipeDto {
  id: string;
  title?: string;
  description?: string;
  isPublic?: boolean;
  duplicateResolutionMode?: DuplicateResolutionMode;
  targetRecipeId?: string;
  isSkipped?: boolean;
  steps?: string[];
  tags?: string[];
  prepTimeText?: string;
  cookTimeText?: string;
  servingsText?: string;
  needsReview?: boolean;
  ingredients?: ReviewedIngredientDto[];
}

export interface ReviewRequest {
  saveAsTemplate: boolean;
  recipes: ReviewedRecipeDto[];
}

export interface ConfirmResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  warningCount: number;
  reviewedRecipeCount: number;
  createdRecipeNames: string[];
}

const BASE = '/api/dietitian/recipes/imports';

export async function uploadImportFile(file: File, mode: ImportMode): Promise<{ sessionId: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('mode', mode);

  const response = await api.post<{ sessionId: string }>(BASE, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

export async function getImportPreview(sessionId: string): Promise<ImportSessionPreview> {
  const response = await api.get<ImportSessionPreview>(`${BASE}/${sessionId}`);
  return response.data;
}

export async function reviewImportSession(sessionId: string, request: ReviewRequest): Promise<void> {
  await api.put(`${BASE}/${sessionId}/review`, request);
}

export async function confirmImport(sessionId: string): Promise<ConfirmResult> {
  const response = await api.post<ConfirmResult>(`${BASE}/${sessionId}/confirm`);
  return response.data;
}

export interface IngredientSearchItem {
  id: string;
  canonicalName: string;
}

export async function searchIngredientsForImport(query: string): Promise<IngredientSearchItem[]> {
  if (!query.trim()) {
    return [];
  }

  const response = await api.get<{ ingredients: IngredientSearchItem[] }>('/api/ingredients/search', {
    params: { q: query.trim(), pageSize: 10 },
  });

  return response.data.ingredients ?? [];
}
