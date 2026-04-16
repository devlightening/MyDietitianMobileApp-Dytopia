'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ChefHat,
  Flame,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import EmptyState from '@/components/states/EmptyState';
import { RecipeEditorForm } from '@/components/recipes/RecipeEditorForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  createRecipe,
  deleteRecipe,
  getRecipeOverview,
  getRecipeRoute,
  getRecipes,
  RecipeListItem,
  SaveRecipeRequest,
} from '@/lib/api/recipes';

type RecipeFilter = 'all' | 'favorites' | 'preferred' | 'used' | 'archived';
type RangeFilter = '7d' | '30d' | 'all';
type SourceFilter = 'all' | 'clinic' | 'general';
type SortKey = 'recommended' | 'completion' | 'usage' | 'alphabetical';

const FILTERS: Array<{ key: RecipeFilter; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'favorites', label: 'Klinik favorileri' },
  { key: 'preferred', label: 'En çok tercih edilen' },
  { key: 'used', label: 'En çok kullanılan' },
  { key: 'archived', label: 'Arşiv' },
];

const RANGE_OPTIONS: Array<{ key: RangeFilter; label: string }> = [
  { key: '7d', label: '7 gün' },
  { key: '30d', label: '30 gün' },
  { key: 'all', label: 'Tümü' },
];

const SOURCE_OPTIONS: Array<{ key: SourceFilter; label: string }> = [
  { key: 'all', label: 'Tüm kaynaklar' },
  { key: 'clinic', label: 'Klinik tarifleri' },
  { key: 'general', label: 'Genel tarifler' },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'recommended', label: 'Önerilen sıralama' },
  { key: 'completion', label: 'Tamamlama oranı' },
  { key: 'usage', label: 'Planlarda kullanım' },
  { key: 'alphabetical', label: 'A’dan Z’ye' },
];

function formatPercent(value: number) {
  return `%${Math.round(value * 100)}`;
}

function RecipeStrip({ title, icon, items }: { title: string; icon: React.ReactNode; items: RecipeListItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {items.map((recipe) => (
          <Link
            key={recipe.id}
            href={getRecipeRoute(recipe)}
            className="group rounded-3xl border border-border bg-background px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="line-clamp-1 font-semibold text-foreground">{recipe.name}</p>
              {recipe.isFavorited ? <Star className="h-4 w-4 fill-current text-primary" /> : null}
            </div>
            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{recipe.description || 'Açıklama eklenmemiş.'}</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{recipe.analyticsPreview.assignmentCount} plan</span>
              <span>{formatPercent(recipe.analyticsPreview.plannedCompletionRate)} tamamlama</span>
              <span>{recipe.analyticsPreview.alternativeSelectedCount} alternatif seçim</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecipeCard({
  recipe,
  onOpen,
  onDelete,
}: {
  recipe: RecipeListItem;
  onOpen: (recipe: RecipeListItem) => void;
  onDelete: (recipe: RecipeListItem) => void;
}) {
  const route = getRecipeRoute(recipe);

  return (
    <article
      className="group cursor-pointer rounded-[28px] border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-within:ring-2 focus-within:ring-primary/40"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(recipe)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(recipe);
        }
      }}
      aria-label={`${recipe.name} tarif detayına git`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ChefHat className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-foreground group-hover:text-primary">
                {recipe.name}
              </span>
              {recipe.isFavorited ? <Badge>Favori</Badge> : null}
              {recipe.isArchived ? <Badge variant="secondary">Arşiv</Badge> : null}
              {recipe.sourceType === 'general' ? <Badge variant="secondary">Genel tarif</Badge> : null}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{recipe.description || 'Kısa açıklama eklenmemiş.'}</p>
          </div>
        </div>
        <Link href={route} onClick={(event) => event.stopPropagation()}>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground">{recipe.mandatoryIngredientCount} zorunlu</span>
        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground">{recipe.optionalIngredientCount} opsiyonel</span>
        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground">{recipe.prohibitedIngredientCount} yasaklı</span>
        {recipe.prepTimeMinutes ? (
          <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground">{recipe.prepTimeMinutes} dk hazırlık</span>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Plan</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{recipe.analyticsPreview.assignmentCount}</p>
        </div>
        <div className="rounded-2xl bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tamamlama</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatPercent(recipe.analyticsPreview.plannedCompletionRate)}</p>
        </div>
        <div className="rounded-2xl bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Alternatif</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{recipe.analyticsPreview.alternativeSelectedCount}</p>
        </div>
        <div className="rounded-2xl bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Skor</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{recipe.analyticsPreview.preferenceScore}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Besin Özeti</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-foreground md:grid-cols-4">
          <span>{recipe.caloriesKcal ?? '—'} kcal</span>
          <span>{recipe.proteinGrams ?? '—'}g protein</span>
          <span>{recipe.carbsGrams ?? '—'}g karb</span>
          <span>{recipe.fatGrams ?? '—'}g yağ</span>
        </div>
      </div>

      {recipe.sourceType === 'clinic' ? (
        <div className="mt-4 flex gap-2">
          <Link href={`${route}?edit=1`} className="flex-1" onClick={(event) => event.stopPropagation()}>
            <Button variant="secondary" className="w-full">Tarifi Düzenle</Button>
          </Link>
          <Button
            variant="danger"
            className="flex-1"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(recipe);
            }}
          >
            Tarifi Sil
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export default function RecipesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<RecipeFilter>('all');
  const [range, setRange] = useState<RangeFilter>('30d');
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recommended');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<RecipeListItem | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['recipes-overview', range],
    queryFn: () => getRecipeOverview(range),
  });

  const recipesQuery = useQuery({
    queryKey: ['recipes', 'library', range],
    queryFn: () => getRecipes({ page: 1, pageSize: 200, status: 'all', source: 'all', range }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: SaveRecipeRequest) => createRecipe(payload),
    onSuccess: async (recipe) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['recipes-overview'] }),
      ]);
      router.push(getRecipeRoute(recipe));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (recipeId: string) => deleteRecipe(recipeId),
    onSuccess: async () => {
      setDeleteCandidate(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['recipes-overview'] }),
      ]);
    },
  });

  const recipes = recipesQuery.data?.items ?? [];

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    recipes.forEach((recipe) => {
      recipe.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });

    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'tr'))
      .slice(0, 12)
      .map(([tag]) => tag);
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('tr');

    const visibleRecipes = recipes.filter((recipe) => {
      if (filter === 'archived') {
        return recipe.isArchived;
      }

      if (recipe.isArchived) {
        return false;
      }

      if (filter === 'favorites' && !recipe.isFavorited) {
        return false;
      }

      if (sourceFilter === 'clinic' && recipe.sourceType !== 'clinic') {
        return false;
      }

      if (sourceFilter === 'general' && recipe.sourceType !== 'general') {
        return false;
      }

      if (selectedTag && !recipe.tags.includes(selectedTag)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [recipe.name, recipe.description, ...recipe.tags].join(' ').toLocaleLowerCase('tr');
      return haystack.includes(normalizedSearch);
    });

    const sortedRecipes = [...visibleRecipes];

    if (filter === 'preferred') {
      sortedRecipes.sort((left, right) => right.analyticsPreview.preferenceScore - left.analyticsPreview.preferenceScore);
      return sortedRecipes;
    }

    if (filter === 'used') {
      sortedRecipes.sort((left, right) => right.analyticsPreview.assignmentCount - left.analyticsPreview.assignmentCount);
      return sortedRecipes;
    }

    sortedRecipes.sort((left, right) => {
      if (sortKey === 'alphabetical') {
        return left.name.localeCompare(right.name, 'tr');
      }

      if (sortKey === 'completion') {
        return Number(right.analyticsPreview.plannedCompletionRate) - Number(left.analyticsPreview.plannedCompletionRate);
      }

      if (sortKey === 'usage') {
        return right.analyticsPreview.assignmentCount - left.analyticsPreview.assignmentCount;
      }

      if (left.isFavorited !== right.isFavorited) {
        return Number(right.isFavorited) - Number(left.isFavorited);
      }

      return right.analyticsPreview.preferenceScore - left.analyticsPreview.preferenceScore;
    });

    return sortedRecipes;
  }, [filter, recipes, searchTerm, selectedTag, sortKey, sourceFilter]);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-primary">Tarif yönetimi</p>
            <h1 className="text-3xl font-bold text-foreground">Tarif kütüphanesi ve tercih içgörüleri</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tariflerinizi oluşturun, en çok tercih edilenleri izleyin ve danışan davranışına göre güçlü tarifleri öne çıkarın.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <Button key={option.key} variant={range === option.key ? 'primary' : 'secondary'} onClick={() => setRange(option.key)}>
                {option.label}
              </Button>
            ))}
            <Link href="/dashboard/recipes/import">
              <Button variant="ghost">
                <Upload className="h-4 w-4" />
                İçe aktar
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {overviewQuery.data ? (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aktif tarif</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{overviewQuery.data.summary.totalRecipes}</p>
          </div>
          <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Favori</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{overviewQuery.data.summary.favoriteRecipes}</p>
          </div>
          <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aktif planlarda</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{overviewQuery.data.summary.activePlanRecipes}</p>
          </div>
          <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Arşiv</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{overviewQuery.data.summary.archivedRecipes}</p>
          </div>
        </div>
      ) : null}

      {overviewQuery.data ? (
        <div className="grid gap-4">
          <RecipeStrip title="Klinik favorileri" icon={<Star className="h-4 w-4 text-primary" />} items={overviewQuery.data.favorites} />
          <RecipeStrip title="En çok tamamlanan" icon={<Flame className="h-4 w-4 text-primary" />} items={overviewQuery.data.mostCompleted} />
          <RecipeStrip title="En çok tercih edilen" icon={<Sparkles className="h-4 w-4 text-primary" />} items={overviewQuery.data.mostPreferred} />
          <RecipeStrip title="Yükselen tarifler" icon={<TrendingUp className="h-4 w-4 text-primary" />} items={overviewQuery.data.rising} />
        </div>
      ) : null}

      <section className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-foreground">Yeni tarif oluştur</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tarif ayrıntıları, malzeme rolleri ve yapılış adımlarını tek yerden yönetin.</p>
        </div>
        <RecipeEditorForm
          submitLabel="Tarifi oluştur"
          submitBusy={createMutation.isPending}
          onSubmit={async (payload) => {
            await createMutation.mutateAsync(payload);
          }}
        />
      </section>

      <section className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Tarif kütüphanesi</h2>
            <p className="text-sm text-muted-foreground">Arayın, filtreleyin ve en doğru tarife hızlıca ulaşın.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <Button key={item.key} variant={filter === item.key ? 'primary' : 'secondary'} onClick={() => setFilter(item.key)}>
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-[28px] border border-border bg-background p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tarif adı, açıklama veya etikete göre ara"
                className="pl-11 pr-11"
              />
              {searchTerm ? (
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  onClick={() => setSearchTerm('')}
                  aria-label="Aramayı temizle"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>Kaynak</span>
              <select className="input-sfcos h-11" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}>
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>Sıralama</span>
              <select className="input-sfcos h-11" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Etiketler</span>
            <Button variant={selectedTag === null ? 'primary' : 'secondary'} className="h-9 px-3 text-xs" onClick={() => setSelectedTag(null)}>
              Tümü
            </Button>
            {availableTags.map((tag) => (
              <Button key={tag} variant={selectedTag === tag ? 'primary' : 'secondary'} className="h-9 px-3 text-xs" onClick={() => setSelectedTag(tag)}>
                {tag}
              </Button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>{filteredRecipes.length} tarif gösteriliyor</p>
            {(searchTerm || selectedTag || sourceFilter !== 'all' || sortKey !== 'recommended') ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 font-medium text-primary transition hover:text-primary/80"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedTag(null);
                  setSourceFilter('all');
                  setSortKey('recommended');
                }}
              >
                Filtreleri temizle
              </button>
            ) : null}
          </div>
        </div>

        {recipesQuery.isLoading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[240px] animate-pulse rounded-[28px] border border-border bg-background" />
            ))}
          </div>
        ) : filteredRecipes.length === 0 ? (
          <EmptyState
            title="Bu görünümde tarif bulunamadı"
            description="Arama kelimesini değiştirin, farklı etiket seçin ya da yeni bir tarif oluşturun."
            icon={<Users className="h-8 w-8 text-muted-foreground" />}
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onOpen={(item) => router.push(getRecipeRoute(item))}
                onDelete={setDeleteCandidate}
              />
            ))}
          </div>
        )}
      </section>
      {deleteCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45" onClick={() => !deleteMutation.isPending && setDeleteCandidate(null)} />
          <section className="relative w-full max-w-md rounded-[28px] border border-destructive/25 bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-foreground">Bu tarifi silmek istediğinize emin misiniz?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Tarif kullanım durumuna göre silinebilir veya arşive alınır. Arşive alınan tarif aktif listede görünmez.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteCandidate(null)} disabled={deleteMutation.isPending}>
                Vazgeç
              </Button>
              <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteCandidate.id)}>
                Sil / Arşivle
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
