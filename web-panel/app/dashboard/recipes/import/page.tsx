"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
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

const MODES: { key: ImportMode; title: string; description: string }[] = [
  { key: 'auto', title: 'Akıllı tanı', description: 'Belge yapısını otomatik algılar.' },
  { key: 'table', title: 'Tablolu dosya', description: 'Excel ve kolonlu yapı için.' },
  { key: 'freeform', title: 'Serbest belge', description: 'Word ve metin PDF için.' },
];

const MATCH_STYLE: Record<string, string> = {
  Exact: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  Alias: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
  Normalized: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200',
  Fuzzy: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  Ambiguous: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200',
  Manual: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
  None: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
};

function MatchBadge({ type, confidence }: { type: string; confidence: number }) {
  const label = type === 'None' ? 'Eşleşmedi' : type === 'Ambiguous' ? 'Belirsiz' : `${type} · ${Math.round(confidence * 100)}%`;
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', MATCH_STYLE[type] ?? MATCH_STYLE.None)}>{label}</span>;
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
        <span className="text-sm text-foreground">{ingredient.matchedCanonicalName ?? 'Manuel seçim bekleniyor'}</span>
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Malzeme ara"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {open && query.trim().length >= 2 ? (
          <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border border-border bg-card p-2 shadow-lg">
            {results && results.length > 0 ? results.map((item) => (
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
            )) : <p className="px-3 py-2 text-sm text-muted-foreground">Sonuç bulunamadı.</p>}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        disabled={!ingredient.matchedIngredientId || !ingredient.matchedCanonicalName}
        onClick={() => ingredient.matchedIngredientId && ingredient.matchedCanonicalName && onResolveAll(ingredient.matchedIngredientId, ingredient.matchedCanonicalName)}
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

  useEffect(() => {
    const previousAlert = window.alert;
    window.alert = (message?: unknown) => {
      toast.error(String(message ?? 'İşlem tamamlanamadı.'));
    };

    return () => {
      window.alert = previousAlert;
    };
  }, []);

  const uploadMutation = useMutation({
    mutationFn: ({ file, mode }: { file: File; mode: ImportMode }) => uploadImportFile(file, mode),
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setStep('preview');
      setRecipes([]);
      setHydratedSessionId(null);
    },
  });

  const previewQuery = useQuery({
    queryKey: ['recipe-import-preview', sessionId],
    queryFn: () => getImportPreview(sessionId!),
    enabled: !!sessionId && step !== 'upload',
    refetchInterval: step === 'preview' ? 1500 : false,
  });

  useEffect(() => {
    if (!previewQuery.data || !sessionId || hydratedSessionId === sessionId || previewQuery.data.recipes.length === 0) return;
    setRecipes(previewQuery.data.recipes);
    setHydratedSessionId(sessionId);
  }, [hydratedSessionId, previewQuery.data, sessionId]);

  const reviewMutation = useMutation({
    mutationFn: () => reviewImportSession(sessionId!, {
      saveAsTemplate,
      recipes: recipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        isPublic: recipe.isPublic,
        duplicateResolutionMode: recipe.duplicateResolutionMode,
        targetRecipeId: recipe.existingRecipeId,
        isSkipped: recipe.isSkipped,
        steps: recipe.steps,
        tags: recipe.tags,
        prepTimeText: recipe.prepTimeText,
        cookTimeText: recipe.cookTimeText,
        servingsText: recipe.servingsText,
        needsReview: recipe.needsReview,
        ingredients: recipe.ingredients.map((ingredient) => ({
          id: ingredient.id,
          matchedIngredientId: ingredient.matchedIngredientId,
          matchedCanonicalName: ingredient.matchedCanonicalName,
          role: ingredient.role,
          amountRaw: ingredient.amountRaw,
          amountValue: ingredient.amountValue,
          unit: ingredient.unit,
          needsReview: ingredient.needsReview,
          resolutionState: ingredient.isResolved ? 'Resolved' : 'NeedsReview',
          issueCodes: ingredient.issueCodes,
        })),
      })),
    }),
    onSuccess: () => setStep('confirm'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmImport(sessionId!),
  });

  const unresolvedMandatory = useMemo(
    () => recipes.filter((recipe) => !recipe.isSkipped).flatMap((recipe) => recipe.ingredients).filter((ingredient) => !ingredient.isResolved && ingredient.role !== 'Optional').length,
    [recipes]
  );

  const patchRecipe = (recipeId: string, patch: Partial<ImportRecipe>) => {
    setRecipes((current) => current.map((recipe) => recipe.id === recipeId ? { ...recipe, ...patch } : recipe));
  };

  const patchIngredient = (recipeId: string, ingredientId: string, patch: Partial<ImportIngredient>) => {
    setRecipes((current) => current.map((recipe) => recipe.id !== recipeId ? recipe : ({
      ...recipe,
      ingredients: recipe.ingredients.map((ingredient) => ingredient.id === ingredientId ? { ...ingredient, ...patch } : ingredient),
    })));
  };

  const resolveAll = (rawName: string, matchedIngredientId: string, matchedCanonicalName: string) => {
    setRecipes((current) => current.map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((ingredient) => ingredient.rawName.trim().toLowerCase() === rawName.trim().toLowerCase()
        ? { ...ingredient, matchedIngredientId, matchedCanonicalName, matchType: 'Manual', matchConfidence: 1, isResolved: true, needsReview: false }
        : ingredient),
    })));
  };

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'docx', 'pdf'].includes(ext)) {
      toast.error('Lütfen CSV, XLSX, DOCX veya seçilebilir metin içeren PDF yükleyin.');
      return;
    }
    uploadMutation.mutate({ file, mode });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/recipes')} className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Tarif kütüphanesi</p>
          <h1 className="text-4xl font-bold text-foreground">Tarif içe aktar</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Dağınık dosyaları önce aday kayda dönüştürüp sonra kontrollü şekilde tarif listesine aktarıyoruz.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-full border border-border bg-card px-4 py-3">
        {['upload', 'preview', 'confirm'].map((key, index) => {
          const current = step === key;
          const done = ['upload', 'preview', 'confirm'].indexOf(step) > index;
          return (
            <div key={key} className="flex items-center gap-3">
              <div className={cn('flex items-center gap-2 text-sm font-semibold', current ? 'text-primary' : done ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground')}>
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs', current ? 'bg-primary text-primary-foreground' : done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-secondary text-muted-foreground')}>{done ? '✓' : index + 1}</span>
                {key === 'upload' ? 'Dosya yükle' : key === 'preview' ? 'İncele' : 'Onayla'}
              </div>
              {index < 2 ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
            </div>
          );
        })}
      </div>

      {step === 'upload' ? (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            {MODES.map((item) => (
              <button key={item.key} type="button" onClick={() => setMode(item.key)} className={cn('rounded-3xl border p-5 text-left transition', mode === item.key ? 'border-primary bg-primary/8' : 'border-border bg-card hover:border-primary/30 hover:bg-secondary/70')}>
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

          <Card className="p-8">
            <div onClick={() => inputRef.current?.click()} className="cursor-pointer rounded-[2rem] border-2 border-dashed border-border bg-secondary/30 px-6 py-16 text-center hover:border-primary/30 hover:bg-secondary/60">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary text-primary"><Upload className="h-8 w-8" /></div>
              <p className="mt-5 text-lg font-semibold text-foreground">Dosyayı sürükleyin veya seçmek için tıklayın</p>
              <p className="mt-2 text-sm text-muted-foreground">.csv, .xlsx, .docx, .pdf · Maks. 10 MB</p>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">Seçili mod: {MODES.find((item) => item.key === mode)?.title}</p>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.docx,.pdf" className="hidden" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />
            </div>
            {uploadMutation.isPending ? <div className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-primary"><Loader2 className="h-4 w-4 animate-spin" /> Dosya analiz kuyruğuna alındı...</div> : null}
            {uploadMutation.isError ? <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{(uploadMutation.error as any)?.response?.data?.error ?? 'Dosya yüklenemedi.'}</div> : null}
          </Card>
        </div>
      ) : null}

      {step === 'preview' && previewQuery.data ? (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-5">
            <Summary title="Tarif" value={previewQuery.data.totalRecipes} hint={previewQuery.data.originalFileName} />
            <Summary title="Eşleşen" value={previewQuery.data.matchedIngredients} hint="Doğrudan bağlanan malzemeler" />
            <Summary title="Belirsiz" value={previewQuery.data.ambiguousIngredients} hint="Birden fazla aday var" />
            <Summary title="Eşleşmeyen" value={previewQuery.data.unmatchedIngredients} hint="Manuel seçim isteyenler" />
            <Summary title="Güven" value={previewQuery.data.confidenceScore ? `${Math.round(previewQuery.data.confidenceScore * 100)}%` : '—'} hint={`${previewQuery.data.parserUsed ?? 'Bilinmiyor'} · ${previewQuery.data.documentKind}`} />
          </div>

          {previewQuery.data.issues.length > 0 ? <Card className="space-y-2 p-4">{previewQuery.data.issues.map((issue) => <div key={`${issue.code}-${issue.message}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"><strong>{issue.code}</strong><div className="mt-1">{issue.message}</div>{issue.hint ? <div className="mt-1 text-xs opacity-80">{issue.hint}</div> : null}</div>)}</Card> : null}

          {previewQuery.data.totalRecipes === 0 ? (
            <Card className="space-y-3 p-6">
              <div className="flex items-center gap-3 text-foreground"><AlertCircle className="h-5 w-5 text-danger" /><p className="text-lg font-semibold">Bu belgeden tarif adayı çıkarılamadı</p></div>
              <p className="text-sm text-muted-foreground">Metin içeren bir belge yükleyin veya Word / Excel olarak yeniden dışa aktarıp tekrar deneyin.</p>
            </Card>
          ) : null}

          {recipes.map((recipe) => (
            <Card key={recipe.id} className={cn('space-y-4 p-5', recipe.isSkipped && 'opacity-60')}>
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Tarif adı" value={recipe.title} onChange={(event) => patchRecipe(recipe.id, { title: event.target.value })} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-foreground/90">Görünürlük</label>
                  <select value={recipe.isPublic ? 'public' : 'private'} onChange={(event) => patchRecipe(recipe.id, { isPublic: event.target.value === 'public' })} className="input-sfcos h-11">
                    <option value="private">Sadece klinik</option>
                    <option value="public">Genel kütüphane</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Input label="Hazırlık süresi" value={recipe.prepTimeText ?? ''} onChange={(event) => patchRecipe(recipe.id, { prepTimeText: event.target.value })} />
                <Input label="Pişirme süresi" value={recipe.cookTimeText ?? ''} onChange={(event) => patchRecipe(recipe.id, { cookTimeText: event.target.value })} />
                <Input label="Porsiyon" value={recipe.servingsText ?? ''} onChange={(event) => patchRecipe(recipe.id, { servingsText: event.target.value })} />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1.5"><label className="text-sm font-semibold text-foreground/90">Açıklama</label><textarea rows={4} value={recipe.description ?? ''} onChange={(event) => patchRecipe(recipe.id, { description: event.target.value })} className="input-sfcos min-h-[120px] resize-y py-3" /></div>
                <div className="flex flex-col gap-1.5"><label className="text-sm font-semibold text-foreground/90">Yapılış adımları</label><textarea rows={4} value={recipe.steps.join('\n')} onChange={(event) => patchRecipe(recipe.id, { steps: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} className="input-sfcos min-h-[120px] resize-y py-3" /></div>
              </div>

              <Input label="Etiketler" value={recipe.tags.join(', ')} helperText="Virgül ile ayırın" onChange={(event) => patchRecipe(recipe.id, { tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />

              {recipe.hasDuplicate ? (
                <div className="flex flex-col gap-1.5 rounded-2xl bg-secondary/50 p-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mükerrer çözümü</label>
                  <select value={recipe.duplicateResolutionMode} onChange={(event) => patchRecipe(recipe.id, { duplicateResolutionMode: event.target.value as DuplicateResolutionMode })} className="input-sfcos h-11">
                    <option value="CreateNew">Yeni oluştur</option>
                    <option value="UpdateExisting">Mevcut tarifi güncelle</option>
                    <option value="Skip">Bu kaydı atla</option>
                  </select>
                </div>
              ) : null}

              <Button variant={recipe.isSkipped ? 'secondary' : 'ghost'} onClick={() => patchRecipe(recipe.id, { isSkipped: !recipe.isSkipped })}>
                {recipe.isSkipped ? 'Kaydı tekrar dahil et' : 'Bu kaydı atla'}
              </Button>

              <div className="space-y-4">
                {recipe.ingredients.map((ingredient) => (
                  <div key={ingredient.id} className="rounded-[1.5rem] border border-border bg-background p-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr_0.8fr_0.8fr]">
                      <div><p className="text-sm font-semibold text-foreground">{ingredient.rawName}</p><p className="mt-1 text-xs text-muted-foreground">{ingredient.rawLineText ?? 'Ham satır bilgisi yok'}</p></div>
                      <IngredientLookup
                        ingredient={ingredient}
                        onResolve={(matchedIngredientId, matchedCanonicalName) => patchIngredient(recipe.id, ingredient.id, { matchedIngredientId, matchedCanonicalName, matchType: 'Manual', matchConfidence: 1, isResolved: true, needsReview: false })}
                        onResolveAll={(matchedIngredientId, matchedCanonicalName) => resolveAll(ingredient.rawName, matchedIngredientId, matchedCanonicalName)}
                      />
                      <div className="space-y-2">
                        <Input label="Miktar" value={ingredient.amountRaw ?? ''} onChange={(event) => patchIngredient(recipe.id, ingredient.id, { amountRaw: event.target.value })} />
                        <Input label="Birim" value={ingredient.unit ?? ''} onChange={(event) => patchIngredient(recipe.id, ingredient.id, { unit: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-semibold text-foreground/90">Rol</label>
                          <select value={ingredient.role} onChange={(event) => patchIngredient(recipe.id, ingredient.id, { role: event.target.value as ImportIngredient['role'] })} className="input-sfcos h-11">
                            <option value="Mandatory">Zorunlu</option>
                            <option value="Optional">Opsiyonel</option>
                            <option value="Substitute">Alternatif</option>
                            <option value="Prohibited">Yasak</option>
                          </select>
                        </div>
                        <div className="rounded-2xl bg-secondary px-3 py-2 text-xs text-muted-foreground">Parse güveni: %{Math.round(ingredient.parseConfidence * 100)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <Card className="space-y-4 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-foreground">İnceleme özeti</p>
                <p className="mt-1 text-sm text-muted-foreground">{unresolvedMandatory > 0 ? `${unresolvedMandatory} zorunlu malzeme hâlâ kesin eşleşmedi.` : 'Kritik zorunlu malzeme açığı görünmüyor.'}</p>
              </div>
              <label className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-foreground">
                <input type="checkbox" checked={saveAsTemplate} onChange={(event) => setSaveAsTemplate(event.target.checked)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                Bu düzeni gelecekte hatırla
              </label>
            </div>
            <div className="flex justify-end">
              <Button disabled={reviewMutation.isPending || previewQuery.data.totalRecipes === 0} onClick={() => reviewMutation.mutate()}>
                {reviewMutation.isPending ? 'Kaydediliyor...' : 'İncelemeyi kaydet ve onaya geç'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {step === 'confirm' ? (
        confirmMutation.isSuccess ? (
          <Card className="mx-auto max-w-2xl space-y-5 p-8 text-center">
            <p className="text-2xl font-semibold text-foreground">İçe aktarma tamamlandı</p>
            <div className="grid gap-3 md:grid-cols-4">
              <Summary title="Yeni" value={confirmMutation.data.createdCount} hint="Oluşturuldu" />
              <Summary title="Güncellendi" value={confirmMutation.data.updatedCount} hint="Mevcut tarif" />
              <Summary title="Atlandı" value={confirmMutation.data.skippedCount} hint="Kaydedilmedi" />
              <Summary title="Uyarı" value={confirmMutation.data.warningCount} hint="Review geçmişi" />
            </div>
            <Button onClick={() => router.push('/dashboard/recipes')}>Tarif kütüphanesine dön</Button>
          </Card>
        ) : (
          <Card className="mx-auto max-w-2xl space-y-5 p-8">
            <p className="text-2xl font-semibold text-foreground">İçe aktarmayı onaylayın</p>
            {previewQuery.data ? <div className="grid gap-3 md:grid-cols-4"><Summary title="Tarif" value={previewQuery.data.totalRecipes} hint="İşlenecek kayıt" /><Summary title="Belirsiz" value={previewQuery.data.ambiguousIngredients} hint="Manuel kontrol" /><Summary title="Eşleşmeyen" value={previewQuery.data.unmatchedIngredients} hint="Kayda girmeyecek" /><Summary title="Uyarı" value={previewQuery.data.warningsCount} hint="Review geçmişi" /></div> : null}
            {confirmMutation.isError ? <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{(confirmMutation.error as any)?.response?.data?.error ?? 'Onay sırasında hata oluştu.'}</div> : null}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => router.push('/dashboard/recipes')}>Tariflere dön</Button>
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>{confirmMutation.isPending ? 'Kaydediliyor...' : 'Onayla ve kütüphaneye işle'}</Button>
            </div>
          </Card>
        )
      ) : null}
    </div>
  );
}
