import apiClient from './client';

export type AcquisitionSource = 'Text' | 'Barcode' | 'Vision';
export type MappingType =
  | 'ExactIngredient'
  | 'IngredientFamily'
  | 'CompositeProduct'
  | 'Unresolved';

export interface AcquisitionCandidate {
  ingredientId: string;
  canonicalName: string;
  mappingType: MappingType;
  confidence: number;
  sourceProvider: string;
  requiresConfirmation: boolean;
}

export interface ResolveBarcodeResponse {
  sessionId: string;
  barcode: string;
  productName?: string | null;
  brand?: string | null;
  mappingType: MappingType;
  confidence: number;
  requiresConfirmation: boolean;
  sourceProvider: string;
  candidates: AcquisitionCandidate[];
}

export interface AcquisitionSelectionPayload {
  ingredientId: string;
  mappingType: MappingType;
  confidence: number;
}

export interface LogIngredientAcquisitionPayload {
  sessionId?: string;
  source: AcquisitionSource;
  rawInput: string;
  selectedIngredients: AcquisitionSelectionPayload[];
  mappingType: MappingType;
  requiredConfirmation: boolean;
  confirmedByUser: boolean;
  interactionCount: number;
  latencyMs: number;
  startedAtUtc?: string;
  completedAtUtc?: string;
  productName?: string;
  brand?: string;
}

export async function resolveBarcode(barcode: string): Promise<ResolveBarcodeResponse> {
  const res = await apiClient.post<ResolveBarcodeResponse>('/api/ingredients/resolve-barcode', {
    barcode,
  });

  return res.data;
}

export async function logIngredientAcquisition(
  payload: LogIngredientAcquisitionPayload,
): Promise<string> {
  const res = await apiClient.post<{ logId: string }>('/api/ingredients/acquisition/log', payload);
  return res.data.logId;
}
