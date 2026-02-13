"use client"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Plus, ChefHat, AlertCircle, X } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { IngredientAutocomplete, IngredientOption } from '@/components/ingredients/IngredientAutocomplete'
import { getRecipes, createRecipe } from '@/lib/api/recipes'

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

export default function RecipesPage() {
  const t = useTranslations('recipes');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient()
  const { data: recipesData, isLoading, error, refetch } = useQuery({
    queryKey: ['recipes'],
    queryFn: getRecipes
  })

  const recipes = recipesData?.recipes || [];

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { ingredientId: '', ingredientName: '', amount: '', unit: '', isMandatory: true, isProhibited: false }
  ])

  const mutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string;
      ingredients: Array<{
        ingredientId: string;
        quantity: number;
        unit: string;
      }>;
      isPublic: boolean;
    }) => createRecipe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      setName("")
      setDescription("")
      setIngredients([{ ingredientId: '', ingredientName: '', amount: '', unit: '', isMandatory: true, isProhibited: false }])
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate: All ingredients must be selected
    const hasUnselectedIngredients = ingredients.some(ing => !ing.ingredientId);
    if (hasUnselectedIngredients) {
      alert('Lütfen tüm malzemeleri seçin');
      return;
    }

    // Transform ingredients to API format
    const apiIngredients = ingredients.map(ing => ({
      ingredientId: ing.ingredientId,
      quantity: parseFloat(ing.amount) || 0,
      unit: ing.unit
    }));

    mutation.mutate({
      name,
      description,
      ingredients: apiIngredients,
      isPublic: true
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('title')}</h2>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
      </div>

      {/* Add Recipe Form */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">{t('newRecipe')}</h3>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <Input
            placeholder={t('recipeName')}
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <Input
            placeholder={t('description')}
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
          />
          <RecipeIngredientsInput
            value={ingredients}
            onChange={setIngredients}
          />
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            disabled={!canSubmit}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            {mutation.isPending ? t('adding') : t('addRecipe')}
          </Button>
        </form>
      </Card>

      {/* Recipes List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-1/3 mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-6 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p className="text-destructive">{t('failedToLoad')}</p>
          <Button variant="secondary" onClick={() => refetch()} className="mt-4">
            {tCommon('retry')}
          </Button>
        </Card>
      ) : !recipes || recipes.length === 0 ? (
        <Card className="p-12 text-center">
          <ChefHat className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">{t('noRecipes')}</h3>
          <p className="text-muted-foreground">{t('noRecipesDescription')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {recipes.map((recipe: any) => (
            <Card key={recipe.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {recipe.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {recipe.description}
                  </p>
                </div>
                <Link href={`/dashboard/recipes/${recipe.id}`}>
                  <Button variant="secondary" className="ml-4">
                    View
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
