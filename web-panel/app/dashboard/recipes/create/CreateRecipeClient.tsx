'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Plus, X, Lock, Globe, Loader2, AlertCircle, ChefHat } from 'lucide-react';
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

const ROLE_CONFIG: Record<IngredientRole, { label: string; className: string; nextRole: IngredientRole }> = {
  mandatory: {
    label: 'Zorunlu',
    className: 'bg-action/10 text-action border border-action/20 hover:bg-action/20',
    nextRole: 'optional',
  },
  optional: {
    label: 'İsteğe Bağlı',
    className: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20',
    nextRole: 'flavoring',
  },
  flavoring: {
    label: 'Lezzetlendirici',
    className: 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200/70',
    nextRole: 'prohibited',
  },
  prohibited: {
    label: 'Yasak',
    className: 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20',
    nextRole: 'mandatory',
  },
};

function getRole(ing: RecipeIngredient): IngredientRole {
  if (ing.isProhibited) return 'prohibited';
  if (ing.isFlavoring) return 'flavoring';
  if (ing.isMandatory) return 'mandatory';
  return 'optional';
}

function roleToFlags(role: IngredientRole): Pick<RecipeIngredient, 'isMandatory' | 'isFlavoring' | 'isProhibited'> {
  return {
    isMandatory: role === 'mandatory',
    isFlavoring: role === 'flavoring',
    isProhibited: role === 'prohibited',
  };
}

interface CreateRecipePayload {
  name: string;
  description: string;
  isPublic: boolean;
  mandatoryIngredients: string[];
  optionalIngredients: string[];
  flavoringIngredients: string[];
  prohibitions: string[];
}

export default function CreateRecipeClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { ingredientId: '', ingredientName: '', isMandatory: true, isFlavoring: false, isProhibited: false },
  ]);
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

  function handleIngredientSelect(idx: number, ingredient: IngredientOption) {
    setIngredients(prev => prev.map((ing, i) =>
      i === idx ? { ...ing, ingredientId: ingredient.id, ingredientName: ingredient.canonicalName } : ing
    ));
  }

  function handleIngredientClear(idx: number) {
    setIngredients(prev => prev.map((ing, i) =>
      i === idx ? { ...ing, ingredientId: '', ingredientName: '' } : ing
    ));
  }

  function cycleRole(idx: number) {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== idx) return ing;
      const role = ROLE_CONFIG[getRole(ing)].nextRole;
      return { ...ing, ...roleToFlags(role) };
    }));
  }

  function addIngredient() {
    setIngredients(prev => [...prev, { ingredientId: '', ingredientName: '', isMandatory: true, isFlavoring: false, isProhibited: false }]);
  }

  function removeIngredient(idx: number) {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!name.trim()) { setApiError('Tarif adı zorunludur.'); return; }
    if (!description.trim()) { setApiError('Açıklama zorunludur.'); return; }
    if (ingredients.some(ing => !ing.ingredientId)) {
      setApiError('Tüm malzeme satırlarını doldurun veya boş satırları kaldırın.');
      return;
    }
    const mandatoryIngredients = ingredients
      .filter(ing => ing.isMandatory && !ing.isProhibited).map(ing => ing.ingredientId);
    const optionalIngredients = ingredients
      .filter(ing => !ing.isMandatory && !ing.isFlavoring && !ing.isProhibited).map(ing => ing.ingredientId);
    const flavoringIngredients = ingredients
      .filter(ing => ing.isFlavoring && !ing.isProhibited).map(ing => ing.ingredientId);
    const prohibitions = ingredients
      .filter(ing => ing.isProhibited).map(ing => ing.ingredientId);
    if (mandatoryIngredients.length === 0) {
      setApiError('En az bir zorunlu malzeme eklenmelidir.');
      return;
    }
    mutation.mutate({ name: name.trim(), description: description.trim(), isPublic, mandatoryIngredients, optionalIngredients, flavoringIngredients, prohibitions });
  };

  const canSubmit = name.trim() && description.trim() &&
    ingredients.length > 0 && ingredients.every(ing => ing.ingredientId) && !mutation.isPending;

  return (
    <div className="space-y-8 fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl kpi-forest flex items-center justify-center">
          <ChefHat className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Yeni Tarif</h1>
          <p className="text-sm text-muted-foreground">Özel tarif kütüphanenize ekleyin</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info Card */}
        <Card className="p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Temel Bilgiler</h2>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Tarif Adı</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ör. Yoğurtlu Avokado Salatası"
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow placeholder:text-muted-foreground'
              )}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Açıklama</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tarif hakkında kısa bir açıklama..."
              rows={3}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm resize-none',
                'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow placeholder:text-muted-foreground'
              )}
              required
            />
          </div>

          {/* Visibility Toggle */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Görünürlük</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
                  !isPublic
                    ? 'bg-action text-action-foreground border-action shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-action/30'
                )}
              >
                <Lock className="w-4 h-4" />
                Özel (İmzalı Tarif)
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
                  isPublic
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/30'
                )}
              >
                <Globe className="w-4 h-4" />
                Herkese Açık
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {isPublic
                ? 'Diğer diyetisyenler bu tarifi görebilir'
                : 'Bu tarif sadece size ve danışanlarınıza özeldir'}
            </p>
          </div>
        </Card>

        {/* Ingredients Card */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Malzemeler</h2>
            <p className="text-xs text-muted-foreground">Role tıklayarak değiştir: Zorunlu → Opsiyonel → Lezzetlendirici → Yasak</p>
          </div>

          <div className="space-y-3">
            {ingredients.map((ing, idx) => {
              const role = getRole(ing);
              const roleConfig = ROLE_CONFIG[role];
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1">
                    <IngredientAutocomplete
                      value={ing.ingredientId ? { id: ing.ingredientId, canonicalName: ing.ingredientName } : null}
                      onSelect={(ingredient) => handleIngredientSelect(idx, ingredient)}
                      onClear={() => handleIngredientClear(idx)}
                      placeholder="Malzeme adı ara..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => cycleRole(idx)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
                      roleConfig.className
                    )}
                    title="Rolü değiştir"
                  >
                    {roleConfig.label}
                  </button>
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeIngredient(idx)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors py-1"
          >
            <Plus className="w-4 h-4" />
            Malzeme Ekle
          </button>
        </Card>

        {/* Error Display */}
        {apiError && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/8 border border-destructive/20 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all',
              canSubmit
                ? 'bg-action text-action-foreground hover:opacity-90 active:scale-[0.98] shadow-md hover:shadow-lg'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
            ) : (
              <><ChefHat className="w-4 h-4" /> Tarifi Kaydet</>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            İptal
          </button>
        </div>
      </form>
    </div>
  );
}
