'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IngredientAutocomplete, IngredientOption } from '@/components/ingredients/IngredientAutocomplete';
import api from '@/lib/api';

interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  amount: string;
  unit: string;
  isMandatory: boolean;
  isProhibited: boolean;
}

function RecipeIngredientsInput({
  value,
  onChange
}: {
  value: RecipeIngredient[];
  onChange: (ingredients: RecipeIngredient[]) => void;
}) {
  const t = useTranslations('recipes');

  function handleIngredientSelect(idx: number, ingredient: IngredientOption) {
    const updated = value.map((ing, i) =>
      i === idx ? { ...ing, ingredientId: ingredient.id, ingredientName: ingredient.canonicalName } : ing
    );
    onChange(updated);
  }

  function handleIngredientClear(idx: number) {
    const updated = value.map((ing, i) =>
      i === idx ? { ...ing, ingredientId: '', ingredientName: '' } : ing
    );
    onChange(updated);
  }

  function handleIngredientChange(idx: number, field: 'amount' | 'unit', fieldValue: string) {
    const updated = value.map((ing, i) =>
      i === idx ? { ...ing, [field]: fieldValue } : ing
    );
    onChange(updated);
  }

  function handleMandatoryToggle(idx: number) {
    const updated = value.map((ing, i) =>
      i === idx ? { ...ing, isMandatory: !ing.isMandatory } : ing
    );
    onChange(updated);
  }

  function handleProhibitedToggle(idx: number) {
    const updated = value.map((ing, i) =>
      i === idx ? { ...ing, isProhibited: !ing.isProhibited } : ing
    );
    onChange(updated);
  }

  function addIngredient() {
    onChange([...value, { ingredientId: '', ingredientName: '', amount: '', unit: '', isMandatory: true, isProhibited: false }]);
  }

  function removeIngredient(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">{t('ingredients')}</label>
      <div className="space-y-3">
        {value.map((ing, idx) => (
          <div key={idx} className="flex flex-col gap-2 p-3 border border-border rounded-md bg-muted/30">
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <IngredientAutocomplete
                  value={ing.ingredientId ? { id: ing.ingredientId, canonicalName: ing.ingredientName } : null}
                  onSelect={(ingredient) => handleIngredientSelect(idx, ingredient)}
                  onClear={() => handleIngredientClear(idx)}
                  placeholder={t('ingredientName')}
                />
              </div>
              {value.length > 1 && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => removeIngredient(idx)}
                  className="px-3"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder={t('amount')}
                value={ing.amount}
                onChange={e => handleIngredientChange(idx, 'amount', e.target.value)}
                type="number"
                step="0.01"
              />
              <Input
                className="w-32"
                placeholder={t('unit')}
                value={ing.unit}
                onChange={e => handleIngredientChange(idx, 'unit', e.target.value)}
              />
              <Button
                type="button"
                variant={ing.isMandatory ? 'primary' : 'secondary'}
                onClick={() => handleMandatoryToggle(idx)}
                className="whitespace-nowrap"
              >
                {ing.isMandatory ? t('mandatory') : t('optional')}
              </Button>
              <Button
                type="button"
                variant={ing.isProhibited ? 'danger' : 'secondary'}
                onClick={() => handleProhibitedToggle(idx)}
                className="whitespace-nowrap"
              >
                {ing.isProhibited ? t('prohibited') : t('allowed')}
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={addIngredient}
          className="w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('addIngredient')}
        </Button>
      </div>
    </div>
  );
}

export default function CreateRecipeClient() {
  const t = useTranslations('recipes');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { ingredientId: '', ingredientName: '', amount: '', unit: '', isMandatory: true, isProhibited: false }
  ]);

  const mutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string;
      mandatoryIngredientIds: string[];
      optionalIngredientIds: string[];
      prohibitedIngredientIds: string[];
    }) => api.post('/api/recipes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      router.push('/dashboard/recipes');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate: All ingredients must be selected
    const hasUnselectedIngredients = ingredients.some(ing => !ing.ingredientId);
    if (hasUnselectedIngredients) {
      // Could show a toast/error message here
      return;
    }

    // Separate mandatory and optional ingredients
    const mandatoryIngredientIds = ingredients
      .filter(ing => ing.isMandatory && ing.ingredientId)
      .map(ing => ing.ingredientId);

    const optionalIngredientIds = ingredients
      .filter(ing => !ing.isMandatory && !ing.isProhibited && ing.ingredientId)
      .map(ing => ing.ingredientId);

    const prohibitedIngredientIds = ingredients
      .filter(ing => ing.isProhibited && ing.ingredientId)
      .map(ing => ing.ingredientId);

    mutation.mutate({
      name,
      description,
      mandatoryIngredientIds,
      optionalIngredientIds,
      prohibitedIngredientIds
    });
  };

  const canSubmit = name.trim() &&
    description.trim() &&
    ingredients.length > 0 &&
    ingredients.every(ing => ing.ingredientId) &&
    !mutation.isPending;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{t('newRecipe')}</h2>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            placeholder={t('recipeName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            placeholder={t('description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <RecipeIngredientsInput
            value={ingredients}
            onChange={setIngredients}
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit}
              loading={mutation.isPending}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              {mutation.isPending ? t('adding') : t('addRecipe')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
