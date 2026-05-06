import apiClient from './client';

export type BarcodeResolveSource = 'local' | 'open_food_facts' | 'manual' | 'rule';

export type BarcodeResolveResponse = {
  barcode: string;
  found: boolean;
  source?: BarcodeResolveSource | null;
  productName?: string | null;
  brand?: string | null;
  canonicalIngredientId?: string | null;
  canonicalIngredientName?: string | null;
  confidence?: number | null;
  requiresManualMapping: boolean;
  message?: string | null;
};

export async function resolveBarcode(barcode: string): Promise<BarcodeResolveResponse> {
  const res = await apiClient.post<BarcodeResolveResponse>('/api/client/barcodes/resolve', {
    barcode,
  });

  return res.data;
}

export async function confirmBarcodeMapping(payload: {
  barcode: string;
  ingredientId: string;
  productName?: string | null;
  brand?: string | null;
}): Promise<BarcodeResolveResponse> {
  const res = await apiClient.post<BarcodeResolveResponse>('/api/client/barcodes/confirm-mapping', payload);
  return res.data;
}
