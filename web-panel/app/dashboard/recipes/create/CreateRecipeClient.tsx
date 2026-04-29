'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChefHat, Loader2, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { IngredientAutocomplete, IngredientOption } from '@/components/ingredients/IngredientAutocomplete';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  isMandatory: boolean;
  isFlavoring: boolean;
  isProhibited: boolean;
}

type IngredientRole = 'mandatory' | 'optional' | 'flavoring' | 'prohibited';

interface CreateRecipePayload {
  name: string;
  description: string;
  isPublic: boolean;
  mandatoryIngredients: string[];
  optionalIngredients: string[];
  flavoringIngredients: string[];
  prohibitions: string[];
}

const ROLE_CONFIG: Record<IngredientRole, { label: string; className: string; nextRole: IngredientRole }> = {
  mandatory: {
    label: 'Zorunlu',
    className: 'border border-action/20 bg-action/10 text-action hover:bg-action/20',
    nextRole: 'optional',
  },
  optional: {
    label: 'Opsiyonel',
    className: 'border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20',
    nextRole: 'flavoring',
  },
  flavoring: {
    label: 'Lezzetlendirici',
    className: 'border border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-200/70',
    nextRole: 'prohibited',
  },
  prohibited: {
    label: 'Yasak',
    className: 'border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20',
    nextRole: 'mandatory',
  },
};

function getRole(ingredient: RecipeIngredient): IngredientRole {
  if (ingredient.isProhibited) return 'prohibited';
  if (ingredient.isFlavoring) return 'flavoring';
  if (ingredient.isMandatory) return 'mandatory';
  return 'optional';
}

function roleToFlags(role: IngredientRole): Pick<RecipeIngredient, 'isMandatory' | 'isFlavoring' | 'isProhibited'> {
  return {
    isMandatory: role === 'mandatory',
    isFlavoring: role === 'flavoring',
    isProhibited: role === 'prohibited',
  };
}

function createEmptyIngredient(): RecipeIngredient {
  return {
    ingredientId: '',
    ingredientName: '',
    isMandatory: true,
    isFlavoring: false,
    isProhibited: false,
  };
}

export default function CreateRecipeClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([createEmptyIngredient()]);
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: CreateRecipePayload) => api.post('/api/dietitian/recipes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      router.push('/dashboard/recipes');
    },
    onError: (error: any) => {
      setApiError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.message ||
          'Tarif oluşturulamadı. Lütfen tekrar deneyin.'
      );
    },
  });

  function handleIngredientSelect(index: number, ingredient: IngredientOption) {
    setIngredients((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ingredientId: ingredient.id,
              ingredientName: ingredient.canonicalName,
            }
          : item
      )
    );
  }

  function handleIngredientClear(index: number) {
    setIngredients((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ingredientId: '',
              ingredientName: '',
            }
          : item
      )
    );
  }

  function cycleRole(index: number) {
    setIngredients((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextRole = ROLE_CONFIG[getRole(item)].nextRole;
        return {
          ...item,
          ...roleToFlags(nextRole),
        };
      })
    );
  }

  function addIngredient() {
    setIngredients((current) => [...current, createEmptyIngredient()]);
  }

  function removeIngredient(index: number) {
    setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setApiError(null);

    if (!name.trim()) {
      setApiError('Tarif adı zorunludur.');
      return;
    }

    if (!description.trim()) {
      setApiError('Açıklama zorunludur.');
      return;
    }

    if (ingredients.some((item) => !item.ingredientId)) {
      setApiError('Tüm malzeme satırlarını doldurun veya boş satırları kaldırın.');
      return;
    }

    const mandatoryIngredients = ingredients
      .filter((item) => item.isMandatory && !item.isProhibited)
      .map((item) => item.ingredientId);
    const optionalIngredients = ingredients
      .filter((item) => !item.isMandatory && !item.isFlavoring && !item.isProhibited)
      .map((item) => item.ingredientId);
    const flavoringIngredients = ingredients
      .filter((item) => item.isFlavoring && !item.isProhibited)
      .map((item) => item.ingredientId);
    const prohibitions = ingredients.filter((item) => item.isProhibited).map((item) => item.ingredientId);

    if (mandatoryIngredients.length === 0) {
      setApiError('En az bir zorunlu malzeme eklenmelidir.');
      return;
    }

    mutation.mutate({
      name: name.trim(),
      description: description.trim(),
      isPublic: false,
      mandatoryIngredients,
      optionalIngredients,
      flavoringIngredients,
      prohibitions,
    });
  }

  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    ingredients.length > 0 &&
    ingredients.every((item) => item.ingredientId) &&
    !mutation.isPending;

  return (
    <div className="max-w-3xl space-y-8 fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl kpi-forest">
          <ChefHat className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Yeni Tarif</h1>
          <p className="text-sm text-muted-foreground">Klinik tarif kütüphanenize yeni bir tarif ekleyin.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="space-y-5 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Temel Bilgiler</h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Tarif Adı</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Örn. Yoğurtlu avokado salatası"
              className={cn(
                'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm',
                'placeholder:text-muted-foreground transition-shadow focus:outline-none focus:ring-2 focus:ring-ring/40'
              )}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Açıklama</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tarif hakkında kısa bir açıklama yazın."
              rows={3}
              className={cn(
                'w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm',
                'placeholder:text-muted-foreground transition-shadow focus:outline-none focus:ring-2 focus:ring-ring/40'
              )}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Görünürlük</label>
            <div className="rounded-2xl border border-action/15 bg-action/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-action" />
                <p className="text-sm font-semibold text-foreground">Klinik-özel tarif</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Bu panelden oluşturulan tarifler yalnızca sizin klinik hesabınızda görünür ve diğer
                diyetisyenlerin tarif listesine dahil edilmez.
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Malzemeler</h2>
            <p className="text-xs text-muted-foreground">
              Role tıklayarak sırayla değiştirin: Zorunlu -&gt; Opsiyonel -&gt; Lezzetlendirici -&gt; Yasak
            </p>
          </div>

          <div className="space-y-3">
            {ingredients.map((ingredient, index) => {
              const role = getRole(ingredient);
              const roleConfig = ROLE_CONFIG[role];

              return (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3.5 transition-colors hover:bg-muted/30"
                >
                  <div className="flex-1">
                    <IngredientAutocomplete
                      value={
                        ingredient.ingredientId
                          ? {
                              id: ingredient.ingredientId,
                              canonicalName: ingredient.ingredientName,
                            }
                          : null
                      }
                      onSelect={(selectedIngredient) => handleIngredientSelect(index, selectedIngredient)}
                      onClear={() => handleIngredientClear(index)}
                      placeholder="Malzeme adı ara..."
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => cycleRole(index)}
                    className={cn(
                      'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                      roleConfig.className
                    )}
                    title="Malzeme rolünü değiştir"
                  >
                    {roleConfig.label}
                  </button>

                  {ingredients.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Satırı kaldır"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center gap-2 py-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            <Plus className="h-4 w-4" />
            Malzeme ekle
          </button>
        </Card>

        {apiError ? (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/8 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{apiError}</span>
          </div>
        ) : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all',
              canSubmit
                ? 'bg-action text-action-foreground shadow-md hover:opacity-90 hover:shadow-lg active:scale-[0.98]'
                : 'cursor-not-allowed bg-muted text-muted-foreground'
            )}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <ChefHat className="h-4 w-4" />
                Tarifi kaydet
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
          >
            İptal
          </button>
        </div>
      </form>
    </div>
  );
}
