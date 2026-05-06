'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ChefHat } from 'lucide-react';
import { RecipeEditorForm } from '@/components/recipes/RecipeEditorForm';
import { createRecipe, getRecipeRoute, type SaveRecipeRequest } from '@/lib/api/recipes';

export default function CreateRecipeClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: SaveRecipeRequest) => createRecipe(payload),
    onSuccess: async (recipe) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['recipes-overview'] }),
      ]);
      router.push(getRecipeRoute(recipe));
    },
  });

  return (
    <div className="max-w-4xl space-y-8 fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl kpi-forest">
          <ChefHat className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Yeni Tarif</h1>
          <p className="text-sm text-muted-foreground">
            Klinik tarif kütüphanenize ölçülü, plan ve alışveriş listesiyle uyumlu bir tarif ekleyin.
          </p>
        </div>
      </div>

      <section className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
        <RecipeEditorForm
          submitLabel="Tarifi oluştur"
          submitBusy={mutation.isPending}
          onSubmit={async (payload) => {
            await mutation.mutateAsync(payload);
          }}
        />
        {mutation.error ? (
          <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {(mutation.error as any)?.response?.data?.message ||
              (mutation.error as any)?.response?.data?.detail ||
              (mutation.error as Error).message ||
              'Tarif oluşturulamadı. Lütfen tekrar deneyin.'}
          </div>
        ) : null}
      </section>
    </div>
  );
}
