'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { IngredientAutocomplete, IngredientOption } from '@/components/ingredients/IngredientAutocomplete';
import { Button } from '@/components/ui/Button';
import { SaveRecipeRequest } from '@/lib/api/recipes';

type RecipeIngredientRole = 'mandatory' | 'optional' | 'flavoring' | 'prohibited';

const UNIT_OPTIONS = [
  'g',
  'kg',
  'mg',
  'ml',
  'L',
  'adet',
  'dilim',
  'bardak',
  'su bardağı',
  'çay bardağı',
  'yemek kaşığı',
  'tatlı kaşığı',
  'çay kaşığı',
  'kase',
  'avuç',
  'tutam',
  'paket',
  'porsiyon',
  'demet',
];

const ROLE_TO_API = {
  mandatory: 'Mandatory',
  optional: 'Optional',
  flavoring: 'Flavoring',
  prohibited: 'Prohibited',
} as const;

export interface RecipeIngredientEntry {
  ingredientId: string;
  ingredientName: string;
  role: RecipeIngredientRole;
  quantity?: string;
  unit?: string;
}

export interface RecipeFormInitialValue {
  name: string;
  description: string;
  tags: string[];
  steps: string[];
  isPublic: boolean;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  ingredients: RecipeIngredientEntry[];
}

interface RecipeEditorFormProps {
  initialValue?: RecipeFormInitialValue;
  submitLabel: string;
  submitBusy?: boolean;
  onSubmit: (payload: SaveRecipeRequest) => Promise<void> | void;
  onCancel?: () => void;
}

const DEFAULT_VALUE: RecipeFormInitialValue = {
  name: '',
  description: '',
  tags: [],
  steps: [],
  isPublic: false,
  prepTimeMinutes: null,
  cookTimeMinutes: null,
  servings: null,
  caloriesKcal: null,
  proteinGrams: null,
  carbsGrams: null,
  fatGrams: null,
  ingredients: [{ ingredientId: '', ingredientName: '', role: 'mandatory', quantity: '', unit: 'g' }],
};

function parseAmount(value?: string): number | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatInitialQuantity(value?: number | null): string {
  if (value == null) return '';
  return String(value).replace('.', ',');
}

function requiresAmount(role: RecipeIngredientRole) {
  return role !== 'prohibited';
}

export function RecipeEditorForm({
  initialValue,
  submitLabel,
  submitBusy = false,
  onSubmit,
  onCancel,
}: RecipeEditorFormProps) {
  const [name, setName] = useState(DEFAULT_VALUE.name);
  const [description, setDescription] = useState(DEFAULT_VALUE.description);
  const [tagsInput, setTagsInput] = useState('');
  const [stepsInput, setStepsInput] = useState('');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState('');
  const [servings, setServings] = useState('');
  const [caloriesKcal, setCaloriesKcal] = useState('');
  const [proteinGrams, setProteinGrams] = useState('');
  const [carbsGrams, setCarbsGrams] = useState('');
  const [fatGrams, setFatGrams] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredientEntry[]>(DEFAULT_VALUE.ingredients);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const next = initialValue ?? DEFAULT_VALUE;
    setName(next.name);
    setDescription(next.description);
    setTagsInput(next.tags.join(', '));
    setStepsInput(next.steps.join('\n'));
    setPrepTimeMinutes(next.prepTimeMinutes ? String(next.prepTimeMinutes) : '');
    setCookTimeMinutes(next.cookTimeMinutes ? String(next.cookTimeMinutes) : '');
    setServings(next.servings ? String(next.servings) : '');
    setCaloriesKcal(next.caloriesKcal != null ? String(next.caloriesKcal) : '');
    setProteinGrams(next.proteinGrams != null ? String(next.proteinGrams).replace('.', ',') : '');
    setCarbsGrams(next.carbsGrams != null ? String(next.carbsGrams).replace('.', ',') : '');
    setFatGrams(next.fatGrams != null ? String(next.fatGrams).replace('.', ',') : '');
    setIngredients(next.ingredients.length > 0 ? next.ingredients : DEFAULT_VALUE.ingredients);
    setFormError(null);
  }, [initialValue]);

  const validationState = useMemo(() => {
    const mandatoryCount = ingredients.filter((item) => item.role === 'mandatory' && item.ingredientId).length;
    const hasAllIngredients = ingredients.every((item) => item.ingredientId);
    const hasAmounts = ingredients.every((item) => {
      if (!requiresAmount(item.role)) return true;
      const amount = parseAmount(item.quantity);
      return amount != null && amount > 0 && Boolean(item.unit);
    });
    const stepCount = stepsInput.split('\n').map((item) => item.trim()).filter(Boolean).length;
    return {
      hasName: name.trim().length >= 4,
      hasAllIngredients,
      hasAmounts,
      hasMandatory: mandatoryCount > 0,
      hasSteps: stepCount > 0,
    };
  }, [ingredients, name, stepsInput]);

  const canSubmit =
    validationState.hasName &&
    validationState.hasAllIngredients &&
    validationState.hasAmounts &&
    validationState.hasMandatory &&
    validationState.hasSteps;

  const updateIngredient = (index: number, patch: Partial<RecipeIngredientEntry>) => {
    setIngredients((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const tags = tagsInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const steps = stepsInput
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    if (name.trim().length < 4) {
      setFormError('Tarif adı en az 4 karakter olmalı.');
      return;
    }

    if (ingredients.some((item) => !item.ingredientId)) {
      setFormError('Lütfen tüm malzemeleri seçin.');
      return;
    }

    if (!ingredients.some((item) => item.role === 'mandatory')) {
      setFormError('En az 1 zorunlu malzeme seçin.');
      return;
    }

    const invalidMeasuredIngredient = ingredients.find((item) => {
      if (!requiresAmount(item.role)) return false;
      const amount = parseAmount(item.quantity);
      return amount == null || amount <= 0 || !item.unit;
    });

    if (invalidMeasuredIngredient) {
      setFormError('Zorunlu, opsiyonel ve lezzetlendirici malzemeler için miktar ve birim girin.');
      return;
    }

    if (steps.length === 0) {
      setFormError('En az 1 yapılış adımı girin.');
      return;
    }

    const measuredIngredients = ingredients.map((item) => {
      const amount = parseAmount(item.quantity);
      return {
        ingredientId: item.ingredientId,
        role: ROLE_TO_API[item.role],
        quantity: requiresAmount(item.role) ? amount : null,
        unit: requiresAmount(item.role) ? item.unit ?? null : null,
      };
    });

    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      isPublic: false,
      ingredients: measuredIngredients,
      mandatoryIngredients: ingredients.filter((item) => item.role === 'mandatory').map((item) => item.ingredientId),
      optionalIngredients: ingredients.filter((item) => item.role === 'optional').map((item) => item.ingredientId),
      flavoringIngredients: ingredients.filter((item) => item.role === 'flavoring').map((item) => item.ingredientId),
      prohibitions: ingredients.filter((item) => item.role === 'prohibited').map((item) => item.ingredientId),
      tags,
      steps,
      prepTimeMinutes: prepTimeMinutes ? Number(prepTimeMinutes) : undefined,
      cookTimeMinutes: cookTimeMinutes ? Number(cookTimeMinutes) : undefined,
      servings: servings ? Number(servings) : undefined,
      caloriesKcal: caloriesKcal ? Number(caloriesKcal) : undefined,
      proteinGrams: proteinGrams ? Number(proteinGrams.replace(',', '.')) : undefined,
      carbsGrams: carbsGrams ? Number(carbsGrams.replace(',', '.')) : undefined,
      fatGrams: fatGrams ? Number(fatGrams.replace(',', '.')) : undefined,
    });
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>Tarif adı</span>
          <input className="input-sfcos" value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Fırında Sebze Köftesi" />
        </label>

        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>Kısa açıklama</span>
          <input className="input-sfcos" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tarifin kısa özetini yazın" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="space-y-2 text-sm font-medium text-foreground md:col-span-2">
          <span>Etiketler</span>
          <input className="input-sfcos" value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="Kahvaltı, pratik, yüksek protein" />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>Hazırlık (dk)</span>
          <input className="input-sfcos" type="number" min="0" value={prepTimeMinutes} onChange={(event) => setPrepTimeMinutes(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>Porsiyon</span>
          <input className="input-sfcos" type="number" min="1" value={servings} onChange={(event) => setServings(event.target.value)} />
        </label>
      </div>

      <label className="space-y-2 text-sm font-medium text-foreground">
        <span>Pişirme süresi (dk)</span>
        <input className="input-sfcos md:max-w-[220px]" type="number" min="0" value={cookTimeMinutes} onChange={(event) => setCookTimeMinutes(event.target.value)} />
      </label>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Besin Değerleri</p>
        <p className="mt-1 text-xs text-muted-foreground">Tarif planlara bağlandığında bu değerler öğüne otomatik taşınır.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Kalori (kcal)</span>
            <input className="input-sfcos" type="number" min="0" step="1" value={caloriesKcal} onChange={(event) => setCaloriesKcal(event.target.value)} />
          </label>
          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Protein (g)</span>
            <input className="input-sfcos" inputMode="decimal" value={proteinGrams} onChange={(event) => setProteinGrams(event.target.value)} />
          </label>
          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Karb (g)</span>
            <input className="input-sfcos" inputMode="decimal" value={carbsGrams} onChange={(event) => setCarbsGrams(event.target.value)} />
          </label>
          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Yağ (g)</span>
            <input className="input-sfcos" inputMode="decimal" value={fatGrams} onChange={(event) => setFatGrams(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Malzemeler ve Ölçüler</p>
            <p className="text-xs text-muted-foreground">Her kullanılan malzeme için miktar ve birim seçin. Yasaklı malzemelerde ölçü gerekmez.</p>
          </div>
          <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setIngredients((current) => [...current, { ingredientId: '', ingredientName: '', role: 'optional', quantity: '', unit: 'g' }])}>
            <Plus className="h-4 w-4" />
            Malzeme ekle
          </Button>
        </div>

        <div className="space-y-3">
          {ingredients.map((ingredient, index) => {
            const amountDisabled = !requiresAmount(ingredient.role);
            return (
              <div key={`${ingredient.ingredientId}-${index}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="grid gap-3 lg:grid-cols-[1fr_150px_130px_170px_auto]">
                  <IngredientAutocomplete
                    value={ingredient.ingredientId ? { id: ingredient.ingredientId, canonicalName: ingredient.ingredientName } : null}
                    onSelect={(selected: IngredientOption) => updateIngredient(index, { ingredientId: selected.id, ingredientName: selected.canonicalName })}
                    onClear={() => updateIngredient(index, { ingredientId: '', ingredientName: '' })}
                    placeholder="Malzeme ara"
                  />

                  <select
                    className="select-sfcos h-11"
                    value={ingredient.role}
                    onChange={(event) => {
                      const role = event.target.value as RecipeIngredientRole;
                      updateIngredient(index, {
                        role,
                        quantity: requiresAmount(role) ? ingredient.quantity : '',
                        unit: requiresAmount(role) ? ingredient.unit || 'g' : '',
                      });
                    }}
                  >
                    <option value="mandatory">Zorunlu</option>
                    <option value="optional">Opsiyonel</option>
                    <option value="flavoring">Lezzetlendirici</option>
                    <option value="prohibited">Yasaklı</option>
                  </select>

                  <input
                    className="input-sfcos"
                    inputMode="decimal"
                    disabled={amountDisabled}
                    value={ingredient.quantity ?? ''}
                    onChange={(event) => updateIngredient(index, { quantity: event.target.value })}
                    placeholder="örn. 2"
                  />

                  <select
                    className="select-sfcos h-11"
                    disabled={amountDisabled}
                    value={ingredient.unit ?? ''}
                    onChange={(event) => updateIngredient(index, { unit: event.target.value })}
                  >
                    <option value="">Birim seç</option>
                    {UNIT_OPTIONS.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-11 rounded-2xl px-0 text-destructive"
                    onClick={() => setIngredients((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <label className="space-y-2 text-sm font-medium text-foreground">
        <span>Yapılış adımları</span>
        <textarea
          className="input-sfcos min-h-[140px] resize-y"
          value={stepsInput}
          onChange={(event) => setStepsInput(event.target.value)}
          placeholder={`1. Malzemeleri hazırlayın\n2. Tavayı ısıtın\n3. Karışımı pişirin`}
        />
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground">
        <span className="h-4 w-4 rounded-full bg-primary/15" />
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold text-foreground">Klinik-özel</span>
          Bu panelden oluşturulan tarifler yalnızca sizin kliniğinizde görünür.
        </span>
      </label>

      {formError ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <div className={`rounded-2xl border px-4 py-3 text-sm ${canSubmit ? 'border-action/30 bg-action/10 text-action' : 'border-border bg-secondary text-muted-foreground'}`}>
        {canSubmit
          ? 'Form kayda hazır. Ölçülü tarif bilgileri mobilde ve alışveriş listesinde kullanılacak.'
          : 'Kaydetmek için: tarif adı, tüm malzemeler, ölçü-birim bilgileri, en az 1 zorunlu malzeme ve en az 1 yapılış adımı gerekli.'}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Vazgeç
          </Button>
        ) : null}
        <Button
          type="submit"
          variant={canSubmit ? 'action' : 'secondary'}
          loading={submitBusy}
          disabled={!canSubmit}
          className={canSubmit ? 'min-w-[180px] shadow-md' : 'min-w-[180px]'}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export { UNIT_OPTIONS as RECIPE_UNIT_OPTIONS, formatInitialQuantity };
