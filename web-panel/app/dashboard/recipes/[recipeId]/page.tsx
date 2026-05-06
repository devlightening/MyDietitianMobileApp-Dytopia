'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart3,
  Clock3,
  Copy,
  Flame,
  PencilLine,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import EmptyState from '@/components/states/EmptyState';
import { RecipeEditorForm } from '@/components/recipes/RecipeEditorForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  createRecipe,
  deleteRecipe,
  favoriteRecipe,
  getRecipeAnalytics,
  getRecipeById,
  getRecipeRoute,
  RecipeDetail,
  SaveRecipeRequest,
  unfavoriteRecipe,
  updateRecipe,
} from '@/lib/api/recipes';

type RangeFilter = '7d' | '30d' | 'all';

const RANGE_OPTIONS: Array<{ key: RangeFilter; label: string }> = [
  { key: '7d', label: '7 gün' },
  { key: '30d', label: '30 gün' },
  { key: 'all', label: 'Tümü' },
];

function formatPercent(value: number) {
  return `%${Math.round(value * 100)}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function toInitialValue(recipe: RecipeDetail) {
  return {
    name: recipe.name,
    description: recipe.description,
    tags: recipe.tags,
    steps: recipe.steps,
    isPublic: recipe.isPublic,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    servings: recipe.servings,
    caloriesKcal: recipe.caloriesKcal,
    proteinGrams: recipe.proteinGrams,
    carbsGrams: recipe.carbsGrams,
    fatGrams: recipe.fatGrams,
    ingredients: [
      ...recipe.mandatoryIngredients.map((item) => ({ ingredientId: item.id, ingredientName: item.name, role: 'mandatory' as const, quantity: item.quantity != null ? String(item.quantity).replace('.', ',') : '', unit: item.unit ?? 'g' })),
      ...recipe.optionalIngredients.map((item) => ({ ingredientId: item.id, ingredientName: item.name, role: 'optional' as const, quantity: item.quantity != null ? String(item.quantity).replace('.', ',') : '', unit: item.unit ?? 'g' })),
      ...recipe.flavoringIngredients.map((item) => ({ ingredientId: item.id, ingredientName: item.name, role: 'flavoring' as const, quantity: item.quantity != null ? String(item.quantity).replace('.', ',') : '', unit: item.unit ?? 'g' })),
      ...recipe.prohibitedIngredients.map((item) => ({ ingredientId: item.id, ingredientName: item.name, role: 'prohibited' as const, quantity: '', unit: '' })),
    ],
  };
}

function toClonePayload(recipe: RecipeDetail): SaveRecipeRequest {
  return {
    name: `${recipe.name} Kopya`,
    description: recipe.description,
    isPublic: false,
    ingredients: [
      ...recipe.mandatoryIngredients.map((item) => ({ ingredientId: item.id, role: 'Mandatory' as const, quantity: item.quantity ?? null, unit: item.unit ?? null })),
      ...recipe.optionalIngredients.map((item) => ({ ingredientId: item.id, role: 'Optional' as const, quantity: item.quantity ?? null, unit: item.unit ?? null })),
      ...recipe.flavoringIngredients.map((item) => ({ ingredientId: item.id, role: 'Flavoring' as const, quantity: item.quantity ?? null, unit: item.unit ?? null })),
      ...recipe.prohibitedIngredients.map((item) => ({ ingredientId: item.id, role: 'Prohibited' as const, quantity: null, unit: null })),
    ],
    mandatoryIngredients: recipe.mandatoryIngredients.map((item) => item.id),
    optionalIngredients: recipe.optionalIngredients.map((item) => item.id),
    flavoringIngredients: recipe.flavoringIngredients.map((item) => item.id),
    prohibitions: recipe.prohibitedIngredients.map((item) => item.id),
    tags: recipe.tags,
    steps: recipe.steps,
    prepTimeMinutes: recipe.prepTimeMinutes ?? undefined,
    cookTimeMinutes: recipe.cookTimeMinutes ?? undefined,
    servings: recipe.servings ?? undefined,
    caloriesKcal: recipe.caloriesKcal ?? undefined,
    proteinGrams: recipe.proteinGrams ?? undefined,
    carbsGrams: recipe.carbsGrams ?? undefined,
    fatGrams: recipe.fatGrams ?? undefined,
  };
}

function formatIngredientLine(item: { name: string; displayAmount?: string | null; quantity?: number | null; unit?: string | null }) {
  if (item.displayAmount) return `${item.displayAmount} ${item.name}`;
  if (item.quantity != null && item.unit) return `${String(item.quantity).replace('.', ',')} ${item.unit} ${item.name}`;
  return `${item.name} · miktar girilmemiş`;
}

export default function RecipeDetailPage({ params }: { params: { recipeId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeFilter>('30d');
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['recipe-detail', params.recipeId, range],
    queryFn: () => getRecipeById(params.recipeId, range),
  });

  const recipe = detailQuery.data;

  const analyticsQuery = useQuery({
    queryKey: ['recipe-analytics', recipe?.id, range],
    queryFn: () => getRecipeAnalytics(recipe!.id, range),
    enabled: Boolean(recipe?.id),
  });

  const favoriteMutation = useMutation({
    mutationFn: (isFavorited: boolean) => (isFavorited ? unfavoriteRecipe(recipe!.id) : favoriteRecipe(recipe!.id)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['recipes-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['recipe-detail'] }),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: SaveRecipeRequest) => updateRecipe(recipe!.id, payload),
    onSuccess: async (updatedRecipe) => {
      setIsEditing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['recipes-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['recipe-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['recipe-analytics'] }),
      ]);
      router.replace(getRecipeRoute(updatedRecipe));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRecipe(recipe!.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['recipes-overview'] }),
      ]);
      router.push('/dashboard/recipes');
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (openEditorAfterCreate: boolean) => createRecipe(toClonePayload(recipe!)),
    onSuccess: async (createdRecipe, openEditorAfterCreate) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['recipes-overview'] }),
      ]);
      router.push(openEditorAfterCreate ? `${getRecipeRoute(createdRecipe)}?edit=1` : getRecipeRoute(createdRecipe));
    },
  });

  const analytics = analyticsQuery.data;

  useEffect(() => {
    if (!recipe) {
      return;
    }

    if (searchParams.get('edit') === '1' && recipe.canEdit) {
      setIsEditing(true);
    }

    if (params.recipeId !== recipe.slug) {
      const query = searchParams.get('edit') === '1' ? '?edit=1' : '';
      router.replace(`${getRecipeRoute(recipe)}${query}`);
    }
  }, [params.recipeId, recipe, router, searchParams]);

  const statusBadges = useMemo(() => {
    if (!recipe) return [];

    const badges: Array<{ label: string; variant?: 'primary' | 'secondary' | 'danger' }> = [
      { label: 'Klinik tarifi', variant: 'secondary' },
    ];

    if (recipe.isFavorited) badges.push({ label: 'Favori', variant: 'primary' });
    if (recipe.isArchived) badges.push({ label: 'Arşiv', variant: 'secondary' });
    if (recipe.isActiveInPlans) badges.push({ label: 'Planlarda aktif', variant: 'secondary' });

    return badges;
  }, [recipe]);

  if (detailQuery.isLoading) {
    return <div className="h-[420px] animate-pulse rounded-[32px] border border-border bg-card" />;
  }

  if (!recipe) {
    return (
      <EmptyState
        title="Tarif bulunamadı"
        description="Bu tarif silinmiş, arşivlenmiş ya da erişim alanınızın dışında olabilir."
        action={
          <Link href="/dashboard/recipes">
            <Button>Tarif kütüphanesine dön</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/recipes" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Tarif kütüphanesine dön
        </Link>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button key={option.key} variant={range === option.key ? 'primary' : 'secondary'} onClick={() => setRange(option.key)}>
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <section className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap gap-2">
              {statusBadges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>

            <h1 className="text-3xl font-bold text-foreground">{recipe.name}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {recipe.description || 'Bu tarif için henüz açıklama girilmemiş.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {recipe.prepTimeMinutes ? (
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  Hazırlık {recipe.prepTimeMinutes} dk
                </span>
              ) : null}
              {recipe.cookTimeMinutes ? (
                <span className="inline-flex items-center gap-2">
                  <Flame className="h-4 w-4" />
                  Pişirme {recipe.cookTimeMinutes} dk
                </span>
              ) : null}
              {recipe.servings ? (
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {recipe.servings} porsiyon
                </span>
              ) : null}
            </div>

            {recipe.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {recipe.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              URL: /dashboard/recipes/{recipe.slug}
            </p>
          </div>

          <aside className="w-full max-w-sm space-y-4 rounded-[28px] border border-border bg-background p-4">
            <div className="rounded-[22px] border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tarif aksiyonları</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Bu tarif kliniğinize ait. Düzenleme, kopyalama ve arşivleme işlemlerini buradan yönetebilirsiniz.
              </p>
            </div>

            <Button variant="action" className="w-full" onClick={() => favoriteMutation.mutate(recipe.isFavorited)}>
              <Star className={`h-4 w-4 ${recipe.isFavorited ? 'fill-current' : ''}`} />
              {recipe.isFavorited ? 'Klinik favorisinden çıkar' : 'Klinik favorisine ekle'}
            </Button>

            <Link href="/dashboard/plans" className="block">
              <Button variant="secondary" className="w-full">
                Planlarda kullan
              </Button>
            </Link>

            <Button variant="secondary" className="w-full" onClick={() => setIsEditing((current) => !current)}>
              <PencilLine className="h-4 w-4" />
              {isEditing ? 'Düzenlemeyi kapat' : 'Tarifi düzenle'}
            </Button>
            <Button variant="secondary" className="w-full" loading={cloneMutation.isPending} onClick={() => cloneMutation.mutate(false)}>
              <Copy className="h-4 w-4" />
              Kopyasını oluştur
            </Button>

            {recipe.canDelete ? (
              <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
                {recipe.deleteMode === 'archive' ? 'Arşive al' : 'Tarifi sil'}
              </Button>
            ) : null}
          </aside>
        </div>
      </section>

      {confirmDelete ? (
        <section className="rounded-[28px] border border-destructive/20 bg-destructive/10 p-5">
          <p className="text-sm text-foreground">
            {recipe.deleteMode === 'archive'
              ? 'Bu tarif geçmiş plan ve kullanım kayıtlarında yer aldığı için kalıcı olarak silinemez. Arşive almak ister misiniz?'
              : 'Bu tarif kalıcı olarak silinecek. Bu işlem geri alınamaz.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Onayla
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Vazgeç
            </Button>
          </div>
        </section>
      ) : null}

      {isEditing ? (
        <section className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-foreground">Tarifi düzenle</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tarif adı, malzemeler, etiketler ve yapılış adımlarını bu ekrandan güncelleyebilirsiniz.</p>
          </div>
          <RecipeEditorForm
            initialValue={toInitialValue(recipe)}
            submitLabel="Değişiklikleri kaydet"
            submitBusy={updateMutation.isPending}
            onCancel={() => setIsEditing(false)}
            onSubmit={async (payload) => {
              await updateMutation.mutateAsync(payload);
            }}
          />
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Malzemeler</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] bg-background p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Zorunlu</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                {recipe.mandatoryIngredients.map((item) => (
                  <p key={item.id}>{formatIngredientLine(item)}</p>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] bg-background p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Opsiyonel</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                {recipe.optionalIngredients.length > 0 ? recipe.optionalIngredients.map((item) => <p key={item.id}>{formatIngredientLine(item)}</p>) : <p>Opsiyonel malzeme yok.</p>}
              </div>
            </div>
            <div className="rounded-[24px] bg-background p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Lezzetlendirici</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                {recipe.flavoringIngredients.length > 0 ? recipe.flavoringIngredients.map((item) => <p key={item.id}>{formatIngredientLine(item)}</p>) : <p>Lezzetlendirici malzeme yok.</p>}
              </div>
            </div>
            <div className="rounded-[24px] bg-background p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Yasaklı</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                {recipe.prohibitedIngredients.length > 0 ? recipe.prohibitedIngredients.map((item) => <p key={item.id}>{item.name}</p>) : <p>Yasaklı malzeme yok.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Yapılış adımları</h2>
          {recipe.steps.length > 0 ? (
            <ol className="space-y-3">
              {recipe.steps.map((step, index) => (
                <li key={`${step}-${index}`} className="rounded-[22px] bg-background px-4 py-3 text-sm text-foreground">
                  <span className="mr-2 font-semibold text-primary">{index + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-[24px] border border-dashed border-border bg-background px-4 py-8 text-sm text-muted-foreground">
              Bu tarif için henüz yapılış adımı girilmemiş.
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Kullanım ve performans</h2>
        </div>

        {analytics ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-[24px] bg-background p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Plan sayısı</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{analytics.assignmentCount}</p>
              </div>
              <div className="rounded-[24px] bg-background p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tamamlama</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatPercent(analytics.plannedCompletionRate)}</p>
              </div>
              <div className="rounded-[24px] bg-background p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Alternatif seçim</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{analytics.alternativeSelectedCount}</p>
              </div>
              <div className="rounded-[24px] bg-background p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Benzersiz danışan</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{analytics.uniqueClientCount}</p>
              </div>
              <div className="rounded-[24px] bg-background p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Bileşik skor</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{analytics.preferenceScore}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
              <div className="rounded-[24px] bg-background p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Bu tarif neden güçlü?
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {analytics.strengthReasons.map((reason) => (
                    <p key={reason}>• {reason}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] bg-background p-5 text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Son kullanım:</span> {formatDate(analytics.lastUsedAt)}
                </p>
                <p className="mt-3">
                  <span className="font-semibold text-foreground">Son tamamlama:</span> {formatDate(analytics.lastCompletedAt)}
                </p>
                <p className="mt-3">
                  <span className="font-semibold text-foreground">14 günlük trend farkı:</span> {analytics.recentTrendDelta}
                </p>
                <p className="mt-3">
                  <span className="font-semibold text-foreground">Öneri görünürlüğü:</span> {analytics.recommendationPickCount}
                </p>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="Henüz kullanım verisi yok" description="Bu tarif planlarda kullanıldıkça performans içgörüleri burada dolacak." />
        )}
      </section>

      <section className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Danışan tercihleri</h2>
        </div>

        {analytics && analytics.clientPreferences.length > 0 ? (
          <div className="overflow-hidden rounded-[24px] border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-background">
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-4 py-3">Danışan</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Tamamlama</th>
                  <th className="px-4 py-3">Alternatif seçim</th>
                  <th className="px-4 py-3">Son etkileşim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {analytics.clientPreferences.map((item) => (
                  <tr key={item.clientId}>
                    <td className="px-4 py-3 font-medium text-foreground">{item.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.assignmentCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.completionCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.alternativeSelectionCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(item.lastInteractionAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Henüz tercih verisi yok"
            description="Bu tarif bir danışanın planına girdiğinde ya da alternatif olarak seçildiğinde burada görünür."
          />
        )}
      </section>
    </div>
  );
}
