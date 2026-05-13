import type { Ingredient } from "../types/alternative";

type ScanResultHandler = {
  onConfirm?: (ingredients: Ingredient[]) => void;
  onUseSearchTerm?: (term: string) => void;
};

const handlers = new Map<string, ScanResultHandler>();

export function registerScanResultHandler(handler: ScanResultHandler): string {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  handlers.set(id, handler);
  return id;
}

export function resolveScanResult(id: string | undefined, ingredients: Ingredient[]): void {
  const handler = id ? handlers.get(id) : undefined;
  handler?.onConfirm?.(ingredients);
}

export function resolveScanSearchTerm(id: string | undefined, term: string): void {
  const handler = id ? handlers.get(id) : undefined;
  handler?.onUseSearchTerm?.(term);
}

export function clearScanResultHandler(id: string | undefined): void {
  if (id) {
    handlers.delete(id);
  }
}
