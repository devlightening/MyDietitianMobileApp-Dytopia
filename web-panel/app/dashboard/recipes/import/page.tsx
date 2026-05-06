"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { AlertCircle, ArrowLeft, ChevronRight, Loader2, Search, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  confirmImport,
  DuplicateResolutionMode,
  getImportPreview,
  ImportIngredient,
  ImportMode,
  ImportRecipe,
  reviewImportSession,
  searchIngredientsForImport,
  uploadImportFile,
} from '@/lib/api/recipeImport';

type Step = 'upload' | 'preview' | 'confirm';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const MODES: { key: ImportMode; title: string; description: string }[] = [
  { key: 'auto',     title: 'Akıllı tanı',   description: 'Belge yapısını otomatik algılar.' },
  { key: 'table',    title: 'Tablolu dosya',  description: 'Excel ve kolonlu yapı için.' },
  { key: 'freeform', title: 'Serbest belge',  description: 'Word ve metin PDF için.' },
];

const MATCH_STYLE: Record<string, string> = {
  Exact:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  Alias:      'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
  Normalized: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200',
  Fuzzy:      'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  Ambiguous:  'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200',
  Manual:     'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
  None:       'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
};

function MatchBadge({ type, confidence }: { type: string; confidence: number }) {
  const label = type === 'None' ? 'Eşleşmedi'
    : type === 'Ambiguous' ? 'Belirsiz'
    : `${type} · ${Math.round(confidence * 100)}%`;
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', MATCH_STYLE[type] ?? MATCH_STYLE.None)}>
      {label}
    </span>
  );
}

function Summary({ title, value, hint }: { title: string; value: string | number; hint: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </Card>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-secondary" />
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="h-48 rounded-3xl bg-secondary" />
      ))}
      <div className="flex justify-end">
        <div className="h-11 w-56 rounded-full bg-secondary" />
      </div>
    </div>
  );
}

function IngredientLookup({
  ingredient,
  onResolve,
  onResolveAll,
}: {
  ingredient: ImportIngredient;
  onResolve: (matchedIngredientId: string, matchedCanonicalName: string) => void;
  onResolveAll: (matchedIngredientId: string, matchedCanonicalName: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { data: results } = useQuery({
    queryKey: ['import-ing-search', query],
    queryFn: () => searchIngredientsForImport(query),
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <MatchBadge type={ingredient.matchType} confidence={ingredient.matchConfidence} />
        <span className="text-sm text-foreground">
          {ingredient.matchedCanonicalName ?? 'Manuel seçim bekleniyor'}
        </span>
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Malzeme ara"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {open && query.trim().length >= 2 ? (
          <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border border-border bg-card p-2 shadow-lg">
            {results && results.length > 0
              ? results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
                    onMouseDown={() => {
                      onResolve(item.id, item.canonicalName);
                      setQuery(item.canonicalName);
                      setOpen(false);
                    }}
                  >
                    {item.canonicalName}
                  </button>
                ))
              : <p className="px-3 py-2 text-sm text-muted-foreground">Sonuç bulunamadı.</p>}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        disabled={!ingredient.matchedIngredientId || !ingredient.matchedCanonicalName}
        onClick={() =>
          ingredient.matchedIngredientId &&
          ingredient.matchedCanonicalName &&
          onResolveAll(ingredient.matchedIngredientId, ingredient.matchedCanonicalName)
        }
        className="text-xs font-semibold text-primary disabled:text-muted-foreground"
      >
        Aynı ham malzemeyi tüm tariflerde böyle eşleştir
      </button>
    </div>
  );
}

export default function RecipeImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [mode, setMode] = useState<ImportMode>('auto');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<ImportRecipe[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);
  const [hydratedSessionId, setHydratedSessionId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Redirect window.alert → toast (defensive, in case any dep uses alert)
  useEffect(() => {
    const prev = window.alert;
    window.alert = (msg?: unknown) => toast.error(String(msg ?? 'İşlem tamamlanamadı.'));
    return () => { window.alert = prev; };
  }, []);

  const uploadMutation = useMutation({
    mutationFn: ({ file, mode }: { file: File; mode: ImportMode }) => uploadImportFile(file, mode),
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setStep('preview');
      setRecipes([]);
      setHydratedSessionId(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Dosya yüklenemedi.');
    },
  });

  const previewQuery = useQuery({
    queryKey: ['recipe-import-preview', sessionId],
    queryFn: () => getImportPreview(sessionId!),
    enabled: !!sessionId && step !== 'upload',
    // Stop polling once the session leaves the transient states (Parsing / Uploading).
    refetchInterval: (data) => {
      const status = data?.status;
      if (!status || status === 'Uploading' || status === 'Parsing') return 1500;
      return false;
    },
  });

  // Hydrate local recipes state from first successful preview load (one-time per session).
  useEffect(() => {
    if (
      !previewQuery.data ||
      !sessionId ||
      hydratedSessionId === sessionId ||
      previewQuery.data.recipes.length === 0
    ) return;
    setRecipes(previewQuery.data.recipes);
    setHydratedSessionId(sessionId);
  }, [hydratedSessionId, previewQuery.data, sessionId]);

  const reviewMutation = useMutation({
    mutationFn: () =>
      reviewImportSession(sessionId!, {
        saveAsTemplate,
        recipes: recipes.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          isPublic: r.isPublic,
          duplicateResolutionMode: r.duplicateResolutionMode,
          targetRecipeId: r.existingRecipeId,
          isSkipped: r.isSkipped,
          steps: r.steps,
          tags: r.tags,
          prepTimeText: r.prepTimeText,
          cookTimeText: r.cookTimeText,
          servingsText: r.servingsText,
          needsReview: r.needsReview,
          ingredients: r.ingredients.map((ing) => ({
            id: ing.id,
            matchedIngredientId: ing.matchedIngredientId,
            matchedCanonicalName: ing.matchedCanonicalName,
            role: ing.role,
            amountRaw: ing.amountRaw,
            amountValue: ing.amountValue,
            unit: ing.unit,
            needsReview: ing.needsReview,
            resolutionState: ing.isResolved ? 'Resolved' : 'NeedsReview',
            issueCodes: ing.issueCodes,
          })),
        })),
      }),
    onSuccess: () => setStep('confirm'),
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'İnceleme kaydedilemedi.');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmImport(sessionId!),
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Onay sırasında hata oluştu.');
    },
  });

  const unresolvedMandatory = useMemo(
    () =>
      recipes
        .filter((r) => !r.isSkipped)
        .flatMap((r) => r.ingredients)
        .filter((ing) => !ing.isResolved && ing.role !== 'Optional' && ing.role !== 'Flavoring')
        .length,
    [recipes],
  );

  const patchRecipe = (recipeId: string, patch: Partial<ImportRecipe>) =>
    setRecipes((cur) => cur.map((r) => r.id === recipeId ? { ...r, ...patch } : r));

  const patchIngredient = (recipeId: string, ingredientId: string, patch: Partial<ImportIngredient>) =>
    setRecipes((cur) =>
      cur.map((r) =>
        r.id !== recipeId ? r : {
          ...r,
          ingredients: r.ingredients.map((ing) =>
            ing.id === ingredientId ? { ...ing, ...patch } : ing,
          ),
        },
      ),
    );

  const resolveAll = (rawName: string, matchedIngredientId: string, matchedCanonicalName: string) =>
    setRecipes((cur) =>
      cur.map((r) => ({
        ...r,
        ingredients: r.ingredients.map((ing) =>
          ing.rawName.trim().toLowerCase() === rawName.trim().toLowerCase()
            ? { ...ing, matchedIngredientId, matchedCanonicalName, matchType: 'Manual', matchConfidence: 1, isResolved: true, needsReview: false }
            : ing,
        ),
      })),
    );

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'docx', 'pdf'].includes(ext)) {
      toast.error('Lütfen CSV, XLSX, DOCX veya seçilebilir metin içeren PDF yükleyin.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Dosya 10 MB sınırını aşıyor. Daha küçük bir dosya seçin.');
      return;
    }
    uploadMutation.mutate({ file, mode });
  }, [mode, uploadMutation]);

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const isPreviewLoading =
    step === 'preview' &&
    (previewQuery.isLoading || previewQuery.data?.status === 'Parsing' || previewQuery.data?.status === 'Uploading');

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/recipes')}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Tarif kütüphanesi</p>
          <h1 className="text-4xl font-bold text-foreground">Tarif içe aktar</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Dağınık dosyaları önce aday kayda dönüştürüp sonra kontrollü şekilde tarif listesine aktarıyoruz.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-3 rounded-full border border-border bg-card px-4 py-3">
        {(['upload', 'preview', 'confirm'] as Step[]).map((key, index) => {
          const current = step === key;
          const done = (['upload', 'preview', 'confirm'] as Step[]).indexOf(step) > index;
          return (
            <div key={key} className="flex items-center gap-3">
              <div className={cn('flex items-center gap-2 text-sm font-semibold', current ? 'text-primary' : done ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground')}>
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs', current ? 'bg-primary text-primary-foreground' : done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-secondary text-muted-foreground')}>
                  {done ? '✓' : index + 1}
                </span>
                {key === 'upload' ? 'Dosya yükle' : key === 'preview' ? 'İncele' : 'Onayla'}
              </div>
              {index < 2 ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: Upload ── */}
      {step === 'upload' ? (
        <div className="space-y-6">
          {/* Mode selector */}
          <div className="grid gap-3 md:grid-cols-3">
            {MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key)}
                className={cn(
                  'rounded-3xl border p-5 text-left transition',
                  mode === item.key
                    ? 'border-primary bg-primary/8'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-secondary/70',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', mode === item.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground')}>
                    <Wand2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <Card className="p-8">
            <div
              onClick={() => !uploadMutation.isPending && inputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'cursor-pointer rounded-[2rem] border-2 border-dashed px-6 py-16 text-center transition',
                isDragOver
                  ? 'border-primary bg-primary/10 scale-[1.01]'
                  : 'border-border bg-secondary/30 hover:border-primary/30 hover:bg-secondary/60',
                uploadMutation.isPending && 'pointer-events-none opacity-60',
              )}
            >
              <div className={cn('mx-auto flex h-16 w-16 items-center justify-center rounded-3xl transition', isDragOver ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary')}>
                <Upload className="h-8 w-8" />
              </div>
              <p className="mt-5 text-lg font-semibold text-foreground">
                {isDragOver ? 'Bırakın, yüklensin!' : 'Dosyayı sürükleyin veya seçmek için tıklayın'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">.csv · .xlsx · .docx · .pdf · Maks. 10 MB</p>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Seçili mod: {MODES.find((item) => item.key === mode)?.title}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.docx,.pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {uploadMutation.isPending ? (
              <div className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-primary">
                <Loader2 className="h-4 w-4 animate-spin" /> Dosya analiz kuyruğuna alındı...
              </div>
            ) : null}

            {uploadMutation.isError ? (
              <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {(uploadMutation.error as any)?.response?.data?.error ?? 'Dosya yüklenemedi. Lütfen tekrar deneyin.'}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {/* ── STEP 2: Preview ── */}
      {step === 'preview' ? (
        isPreviewLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {previewQuery.data?.status === 'Parsing' ? 'Belge ayrıştırılıyor, malzemeler eşleştiriliyor…' : 'Önizleme yükleniyor…'}
            </div>
            <PreviewSkeleton />
          </div>
        ) : previewQuery.data ? (
          <div className="space-y-6">
            {/* Summary pills */}
            <div className="grid gap-3 md:grid-cols-5">
              <Summary title="Tarif"        value={previewQuery.data.totalRecipes}        hint={previewQuery.data.originalFileName} />
              <Summary title="Eşleşen"      value={previewQuery.data.matchedIngredients}  hint="Doğrudan bağlanan malzemeler" />
              <Summary title="Belirsiz"     value={previewQuery.data.ambiguousIngredients} hint="Birden fazla aday var" />
              <Summary title="Eşleşmeyen"   value={previewQuery.data.unmatchedIngredients} hint="Manuel seçim isteyenler" />
              <Summary
                title="Güven"
                value={previewQuery.data.confidenceScore ? `${Math.round(previewQuery.data.confidenceScore * 100)}%` : '—'}
                hint={`${previewQuery.data.parserUsed ?? 'Bilinmiyor'} · ${previewQuery.data.documentKind}`}
              />
            </div>

            {/* Global issues */}
            {previewQuery.data.issues.length > 0 ? (
              <Card className="space-y-2 p-4">
                {previewQuery.data.issues.map((issue) => (
                  <div
                    key={`${issue.code}-${issue.message}`}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                  >
                    <strong>{issue.code}</strong>
                    <div className="mt-1">{issue.message}</div>
                    {issue.hint ? <div className="mt-1 text-xs opacity-80">{issue.hint}</div> : null}
                  </div>
                ))}
              </Card>
            ) : null}

            {/* No recipes parsed */}
            {previewQuery.data.totalRecipes === 0 ? (
              <Card className="space-y-3 p-6">
                <div className="flex items-center gap-3 text-foreground">
                  <AlertCircle className="h-5 w-5 text-danger" />
                  <p className="text-lg font-semibold">Bu belgeden tarif adayı çıkarılamadı</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Metin içeren bir belge yükleyin veya Word / Excel olarak yeniden dışa aktarıp tekrar deneyin.
                </p>
              </Card>
            ) : null}

            {/* Recipe cards */}
            {recipes.map((recipe) => (
              <Card key={recipe.id} className={cn('space-y-4 p-5', recipe.isSkipped && 'opacity-60')}>
                <div className="grid gap-3 md:grid-cols-1">
                  <Input
                    label="Tarif adı"
                    value={recipe.title}
                    onChange={(e) => patchRecipe(recipe.id, { title: e.target.value })}
                  />
                  {/* Visibility — wired to isPublic state */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-foreground/90">Görünürlük</label>
                    <select
                      value={recipe.isPublic ? 'public' : 'private'}
                      onChange={(e) => patchRecipe(recipe.id, { isPublic: e.target.value === 'public' })}
                      className="select-sfcos h-11"
                    >
                      <option value="private">Sadece klinik</option>
                      <option value="public">Genel kütüphane</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <Input label="Hazırlık süresi" value={recipe.prepTimeText ?? ''} onChange={(e) => patchRecipe(recipe.id, { prepTimeText: e.target.value })} />
                  <Input label="Pişirme süresi"  value={recipe.cookTimeText  ?? ''} onChange={(e) => patchRecipe(recipe.id, { cookTimeText:  e.target.value })} />
                  <Input label="Porsiyon"         value={recipe.servingsText  ?? ''} onChange={(e) => patchRecipe(recipe.id, { servingsText:  e.target.value })} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-foreground/90">Açıklama</label>
                    <textarea
                      rows={4}
                      value={recipe.description ?? ''}
                      onChange={(e) => patchRecipe(recipe.id, { description: e.target.value })}
                      className="input-sfcos min-h-[120px] resize-y py-3"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-foreground/90">Yapılış adımları</label>
                    <textarea
                      rows={4}
                      value={recipe.steps.join('\n')}
                      onChange={(e) =>
                        patchRecipe(recipe.id, { steps: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
                      }
                      className="input-sfcos min-h-[120px] resize-y py-3"
                    />
                  </div>
                </div>

                <Input
                  label="Etiketler"
                  value={recipe.tags.join(', ')}
                  helperText="Virgül ile ayırın"
                  onChange={(e) =>
                    patchRecipe(recipe.id, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
                  }
                />

                {recipe.hasDuplicate ? (
                  <div className="flex flex-col gap-1.5 rounded-2xl bg-secondary/50 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Mükerrer çözümü
                    </label>
                    <select
                      value={recipe.duplicateResolutionMode}
                      onChange={(e) => patchRecipe(recipe.id, { duplicateResolutionMode: e.target.value as DuplicateResolutionMode })}
                      className="select-sfcos h-11"
                    >
                      <option value="CreateNew">Yeni oluştur</option>
                      <option value="UpdateExisting">Mevcut tarifi güncelle</option>
                      <option value="Skip">Bu kaydı atla</option>
                    </select>
                  </div>
                ) : null}

                <Button
                  variant={recipe.isSkipped ? 'secondary' : 'ghost'}
                  onClick={() => patchRecipe(recipe.id, { isSkipped: !recipe.isSkipped })}
                >
                  {recipe.isSkipped ? 'Kaydı tekrar dahil et' : 'Bu kaydı atla'}
                </Button>

                {/* Ingredient rows */}
                <div className="space-y-4">
                  {recipe.ingredients.map((ingredient) => (
                    <div key={ingredient.id} className="rounded-[1.5rem] border border-border bg-background p-4">
                      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr_0.8fr_0.8fr]">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{ingredient.rawName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{ingredient.rawLineText ?? 'Ham satır bilgisi yok'}</p>
                        </div>
                        <IngredientLookup
                          ingredient={ingredient}
                          onResolve={(mid, mcn) =>
                            patchIngredient(recipe.id, ingredient.id, {
                              matchedIngredientId: mid, matchedCanonicalName: mcn,
                              matchType: 'Manual', matchConfidence: 1, isResolved: true, needsReview: false,
                            })
                          }
                          onResolveAll={(mid, mcn) => resolveAll(ingredient.rawName, mid, mcn)}
                        />
                        <div className="space-y-2">
                          <Input label="Miktar" value={ingredient.amountRaw ?? ''} onChange={(e) => patchIngredient(recipe.id, ingredient.id, { amountRaw: e.target.value })} />
                          <Input label="Birim"  value={ingredient.unit      ?? ''} onChange={(e) => patchIngredient(recipe.id, ingredient.id, { unit:      e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-foreground/90">Rol</label>
                            <select
                              value={ingredient.role}
                              onChange={(e) => patchIngredient(recipe.id, ingredient.id, { role: e.target.value as ImportIngredient['role'] })}
                              className="select-sfcos h-11"
                            >
                              <option value="Mandatory">Zorunlu</option>
                              <option value="Optional">Opsiyonel</option>
                              <option value="Flavoring">Lezzetlendirici</option>
                              <option value="Substitute">Alternatif</option>
                              <option value="Prohibited">Yasak</option>
                            </select>
                          </div>
                          <div className="rounded-2xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
                            Parse güveni: %{Math.round(ingredient.parseConfidence * 100)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

            {/* Review footer */}
            <Card className="space-y-4 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">İnceleme özeti</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {unresolvedMandatory > 0
                      ? `${unresolvedMandatory} zorunlu malzeme hâlâ kesin eşleşmedi.`
                      : 'Kritik zorunlu malzeme açığı görünmüyor.'}
                  </p>
                </div>
                <label className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  Bu düzeni gelecekte hatırla
                </label>
              </div>
              {reviewMutation.isError ? (
                <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {(reviewMutation.error as any)?.response?.data?.error ?? 'İnceleme kaydedilemedi.'}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  disabled={reviewMutation.isPending || previewQuery.data.totalRecipes === 0}
                  onClick={() => reviewMutation.mutate()}
                >
                  {reviewMutation.isPending ? 'Kaydediliyor…' : 'İncelemeyi kaydet ve onaya geç'}
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          // Fallback: query errored before data arrived
          <Card className="space-y-3 p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-danger" />
              <p className="text-lg font-semibold text-foreground">Önizleme yüklenemedi</p>
            </div>
            <p className="text-sm text-muted-foreground">Lütfen sayfayı yenileyip tekrar deneyin.</p>
            <Button variant="secondary" onClick={() => setStep('upload')}>Geri dön</Button>
          </Card>
        )
      ) : null}

      {/* ── STEP 3: Confirm ── */}
      {step === 'confirm' ? (
        confirmMutation.isSuccess ? (
          <Card className="mx-auto max-w-2xl space-y-5 p-8 text-center">
            <p className="text-2xl font-semibold text-foreground">İçe aktarma tamamlandı</p>
            <div className="grid gap-3 md:grid-cols-4">
              <Summary title="Yeni"        value={confirmMutation.data.createdCount} hint="Oluşturuldu" />
              <Summary title="Güncellendi" value={confirmMutation.data.updatedCount} hint="Mevcut tarif" />
              <Summary title="Atlandı"     value={confirmMutation.data.skippedCount} hint="Kaydedilmedi" />
              <Summary title="Uyarı"       value={confirmMutation.data.warningCount} hint="Review geçmişi" />
            </div>
            <Button onClick={() => router.push('/dashboard/recipes')}>Tarif kütüphanesine dön</Button>
          </Card>
        ) : (
          <Card className="mx-auto max-w-2xl space-y-5 p-8">
            <p className="text-2xl font-semibold text-foreground">İçe aktarmayı onaylayın</p>
            {previewQuery.data ? (
              <div className="grid gap-3 md:grid-cols-4">
                <Summary title="Tarif"       value={previewQuery.data.totalRecipes}        hint="İşlenecek kayıt" />
                <Summary title="Belirsiz"    value={previewQuery.data.ambiguousIngredients} hint="Manuel kontrol" />
                <Summary title="Eşleşmeyen" value={previewQuery.data.unmatchedIngredients} hint="Kayda girmeyecek" />
                <Summary title="Uyarı"       value={previewQuery.data.warningsCount}        hint="Review geçmişi" />
              </div>
            ) : null}
            {confirmMutation.isError ? (
              <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {(confirmMutation.error as any)?.response?.data?.error ?? 'Onay sırasında hata oluştu.'}
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => router.push('/dashboard/recipes')}>Tariflere dön</Button>
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
                {confirmMutation.isPending ? 'Kaydediliyor…' : 'Onayla ve kütüphaneye işle'}
              </Button>
            </div>
          </Card>
        )
      ) : null}
    </div>
  );
}
