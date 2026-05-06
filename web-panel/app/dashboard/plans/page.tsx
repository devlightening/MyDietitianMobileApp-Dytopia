'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, Loader2, Plus, X, CheckCircle2,
  Clock, Send, Eye, EyeOff, Trash2, Users, AlertCircle,
  CalendarDays, Flame, RefreshCw, Copy, BookOpen, ChevronDown, LayoutTemplate, Search,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { getRecipes, type Recipe } from '@/lib/api/recipes'
import { Dropdown } from '@/components/ui/Dropdown'
import { TimeField } from '@/components/ui/TimeField'
import {
  listTemplates, createTemplateFromPlan, deleteTemplate, applyTemplate,
  type TemplateSummary,
} from '@/lib/api/plan-templates'
import { toast } from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClientRow {
  clientId: string
  fullName: string
}

type MealType = 'Breakfast' | 'MidMorning' | 'Lunch' | 'Afternoon' | 'Dinner' | 'Evening' | 'Snack'
type PlanStatus = 'Draft' | 'Published'
type RecipeDockSort = 'recommended' | 'alphabetical'

interface MealItemData {
  id: string
  time: string
  mealType: MealType
  title: string
  note?: string
  orderIndex: number
  calories?: number
  proteinGrams?: number
  carbsGrams?: number
  fatGrams?: number
  recipeId?: string
}

interface DailyPlanData {
  id: string
  date: string
  status: PlanStatus
  meals: MealItemData[]
  updatedAt: string
}

// ── Meal type config ───────────────────────────────────────────────────────────

const MEAL_TYPE_CONFIG: Record<MealType, { label: string; color: string; dot: string; dotHex: string }> = {
  Breakfast:  { label: 'Kahvaltı',      color: 'bg-amber-950/30 border-amber-700/40 text-amber-400',    dot: 'bg-amber-400',   dotHex: '#FBBF24' },
  MidMorning: { label: 'Ara Öğün',      color: 'bg-emerald-950/30 border-emerald-700/40 text-emerald-400', dot: 'bg-emerald-500', dotHex: '#22C97A' },
  Lunch:      { label: 'Öğle',          color: 'bg-sky-950/30 border-sky-700/40 text-sky-400',           dot: 'bg-sky-400',     dotHex: '#38BDF8' },
  Afternoon:  { label: 'İkindi',        color: 'bg-violet-950/30 border-violet-700/40 text-violet-400',  dot: 'bg-violet-400',  dotHex: '#A78BFA' },
  Dinner:     { label: 'Akşam Yemeği',  color: 'bg-indigo-950/30 border-indigo-700/40 text-indigo-400', dot: 'bg-indigo-400',  dotHex: '#818CF8' },
  Evening:    { label: 'Gece',          color: 'bg-slate-800/50 border-slate-600/40 text-slate-400',     dot: 'bg-slate-400',   dotHex: '#94A3B8' },
  Snack:      { label: 'Atıştırmalık',  color: 'bg-rose-950/30 border-rose-700/40 text-rose-400',        dot: 'bg-rose-400',    dotHex: '#FB7185' },
}

const MEAL_TYPES = Object.keys(MEAL_TYPE_CONFIG) as MealType[]
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const RECIPE_DOCK_MEAL_FILTERS: Array<{ label: string; mealType: MealType }> = [
  { label: 'Kahvaltı', mealType: 'Breakfast' },
  { label: 'Ara Öğün', mealType: 'MidMorning' },
  { label: 'Öğle', mealType: 'Lunch' },
  { label: 'İkindi', mealType: 'Afternoon' },
  { label: 'Akşam', mealType: 'Dinner' },
  { label: 'Gece', mealType: 'Evening' },
  { label: 'Atıştırmalık', mealType: 'Snack' },
]

const DEFAULT_TIME_BY_MEALTYPE: Record<MealType, string> = {
  Breakfast: '08:00',
  MidMorning: '11:00',
  Lunch: '14:00',
  Afternoon: '16:00',
  Dinner: '19:00',
  Evening: '22:00',
  Snack: '15:00',
}

function getQuickTimeChips(mealType: MealType): string[] {
  const base = DEFAULT_TIME_BY_MEALTYPE[mealType] ?? '12:00'
  const [hh, mm] = base.split(':').map((p) => parseInt(p, 10))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return [base]
  const clamp = (v: number) => Math.max(0, Math.min(23, v))
  const toStr = (h: number) => `${String(clamp(h)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  return [toStr(hh - 1), base, toStr(hh + 1)]
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function getIsoWeekMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toCurrentTimeStr(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const alert = (message: string) => toast(message)

// ── AddMealModal ───────────────────────────────────────────────────────────────

interface AddMealForm {
  time: string
  mealType: MealType
  title: string
  note: string
  calories: string
  proteinGrams: string
  carbsGrams: string
  fatGrams: string
  recipeId: string | null
  recipeName: string | null
}

type NutritionFieldKey = 'calories' | 'proteinGrams' | 'carbsGrams' | 'fatGrams'

function normalizeDecimalInput(value: string): string {
  const cleaned = value.replace(',', '.').replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join('')}`
}

function formatNumericField(value: unknown, kind: 'integer' | 'decimal'): string {
  if (value == null || value === '') return ''
  const normalized = normalizeDecimalInput(String(value).trim())
  if (!normalized) return ''
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return ''
  if (kind === 'integer') return String(Math.round(numeric))
  return Number(numeric.toFixed(2)).toString()
}

function AddMealModal({
  planId,
  planDate,
  existingItem,
  initialValues,
  onClose,
  onSaved,
}: {
  planId: string
  planDate: string
  existingItem?: MealItemData
  initialValues?: Partial<AddMealForm>
  onClose: () => void
  onSaved: (item: MealItemData) => void
}) {
  const isTodayPlan = planDate === toDateStr(new Date())
  const minAllowedTime = isTodayPlan ? toCurrentTimeStr() : undefined
  const [form, setForm] = useState<AddMealForm>(() => {
    const base: AddMealForm = {
      time:         existingItem?.time ?? (minAllowedTime && minAllowedTime > '08:00' ? minAllowedTime : '08:00'),
      mealType:     existingItem?.mealType           ?? 'Breakfast',
      title:        existingItem?.title              ?? '',
      note:         existingItem?.note               ?? '',
      calories:     existingItem?.calories?.toString()     ?? '',
      proteinGrams: existingItem?.proteinGrams?.toString() ?? '',
      carbsGrams:   existingItem?.carbsGrams?.toString()   ?? '',
      fatGrams:     existingItem?.fatGrams?.toString()     ?? '',
      recipeId:     existingItem?.recipeId           ?? null,
      recipeName:   null,
    }

    if (!existingItem && initialValues)
    {
      return {
        ...base,
        ...initialValues,
      }
    }

    return base
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [recipeSearch, setRecipeSearch] = useState('')
  const [recipeDropdownOpen, setRecipeDropdownOpen] = useState(false)
  const [debouncedRecipeSearch, setDebouncedRecipeSearch] = useState('')
  const [nutritionTouched, setNutritionTouched] = useState<Record<NutritionFieldKey, boolean>>({
    calories: false,
    proteinGrams: false,
    carbsGrams: false,
    fatGrams: false,
  })
  const [autoFilledFromRecipe, setAutoFilledFromRecipe] = useState(false)
  const hasManualNutritionOverride = Object.values(nutritionTouched).some(Boolean)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRecipeSearch(recipeSearch), 300)
    return () => clearTimeout(t)
  }, [recipeSearch])

  const { data: recipeSearchResults, isFetching: recipesSearching } = useQuery({
    queryKey: ['recipe-search-modal', debouncedRecipeSearch],
    queryFn: () => getRecipes({ q: debouncedRecipeSearch, pageSize: 8 }),
    enabled: debouncedRecipeSearch.length >= 2,
    staleTime: 30000,
  })

  const set = (key: keyof AddMealForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const nextValue =
      key === 'calories'
        ? formatNumericField(e.target.value, 'integer')
        : key === 'proteinGrams' || key === 'carbsGrams' || key === 'fatGrams'
          ? formatNumericField(e.target.value, 'decimal')
          : e.target.value
    setForm(f => ({ ...f, [key]: nextValue }))
    if (key === 'calories' || key === 'proteinGrams' || key === 'carbsGrams' || key === 'fatGrams') {
      setNutritionTouched((prev) => ({ ...prev, [key]: true }))
      setAutoFilledFromRecipe(false)
    }
  }

  const applyRecipeNutrition = (recipe: Recipe) => {
    setForm((prev) => ({
      ...prev,
      calories: formatNumericField(recipe.caloriesKcal, 'integer'),
      proteinGrams: formatNumericField(recipe.proteinGrams, 'decimal'),
      carbsGrams: formatNumericField(recipe.carbsGrams, 'decimal'),
      fatGrams: formatNumericField(recipe.fatGrams, 'decimal'),
    }))
    setNutritionTouched({
      calories: false,
      proteinGrams: false,
      carbsGrams: false,
      fatGrams: false,
    })
    setAutoFilledFromRecipe(true)
  }

  const mutation = useMutation({
    mutationFn: async (data: AddMealForm) => {
      const payload = {
        time:         data.time,
        mealType:     data.mealType,
        title:        data.title.trim(),
        note:         data.note.trim() || null,
        calories:     data.calories     ? parseInt(normalizeDecimalInput(data.calories), 10)       : null,
        proteinGrams: data.proteinGrams ? parseFloat(normalizeDecimalInput(data.proteinGrams)) : null,
        carbsGrams:   data.carbsGrams   ? parseFloat(normalizeDecimalInput(data.carbsGrams))   : null,
        fatGrams:     data.fatGrams     ? parseFloat(normalizeDecimalInput(data.fatGrams))     : null,
        recipeId:     data.recipeId     ?? null,
      }
      if (existingItem) {
        const res = await api.put(`/api/dietitian/daily-plans/${planId}/meals/${existingItem.id}`, payload)
        return res.data as MealItemData
      }
      const res = await api.post(`/api/dietitian/daily-plans/${planId}/meals`, payload)
      return res.data as MealItemData
    },
    onSuccess: (item) => {
      setSuccess(true)
      setTimeout(() => { onSaved(item); onClose() }, 700)
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? e?.message ?? 'Öğün kaydedilemedi.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Başlık zorunludur.'); return }
    const timeOk = !!form.time && form.time.length === 5 && form.time[2] === ':'
    if (!timeOk) { setError('Saat seÃ§iniz.'); return }
    if (minAllowedTime && form.time < minAllowedTime) { setError('BugÃ¼n iÃ§in yalnÄ±zca ' + minAllowedTime + ' ve sonrasÄ± seÃ§ilebilir.'); return }
    setError(null)
    mutation.mutate(form)
  }

  const cfg = MEAL_TYPE_CONFIG[form.mealType]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-visible">

        {/* Colored top accent */}
        <div className={cn('h-1 w-full', cfg.dot)} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {existingItem ? 'Öğünü Düzenle' : 'Yeni Öğün Ekle'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Danışan planına öğün bilgisi girin</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-muted/70 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {success ? (
          <div className="py-14 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">Kaydedildi!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5 space-y-4 overscroll-contain">

            {/* Time + MealType */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Saat</label>
                <TimeField
                  value={form.time}
                  onChange={(time) => setForm((prev) => ({ ...prev, time }))}
                  min={minAllowedTime}
                  disabled={mutation.isPending}
                />
                {minAllowedTime && (
                  <p className="text-[11px] text-amber-400">
                    Bugün için yalnızca {minAllowedTime} ve sonrası seçilebilir.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Öğün Tipi</label>
                <Dropdown
                  options={MEAL_TYPES.map((t) => ({ label: MEAL_TYPE_CONFIG[t].label, value: t }))}
                  value={form.mealType}
                  onChange={(mealType) => setForm((prev) => ({ ...prev, mealType: mealType as MealType }))}
                  disabled={mutation.isPending}
                />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Başlık <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={set('title')}
                placeholder="ör. Yulaf Ezmesi, Izgara Tavuk"
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Not <span className="text-muted-foreground font-normal">(isteğe bağlı)</span>
              </label>
              <textarea
                value={form.note}
                onChange={set('note')}
                placeholder="Danışan için hazırlık notu, porsiyon bilgisi..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
              />
            </div>

            {/* Recipe link */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 text-muted-foreground" />
                Tarif Bağla
                <span className="text-muted-foreground font-normal">(isteğe bağlı)</span>
              </label>
              {form.recipeId ? (
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                  <BookOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="flex-1 truncate text-sm text-foreground">{form.recipeName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, recipeId: null, recipeName: null }))
                      setAutoFilledFromRecipe(false)
                    }}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={recipeSearch}
                    onChange={e => { setRecipeSearch(e.target.value); setRecipeDropdownOpen(true) }}
                    onFocus={() => setRecipeDropdownOpen(true)}
                    placeholder="Tarif adı yazın..."
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                  />
                  {recipesSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                  {recipeDropdownOpen && recipeSearch.length >= 2 && recipeSearchResults && (
                    <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg overscroll-contain">
                      {recipeSearchResults.items.length === 0 ? (
                        <p className="px-3 py-2.5 text-xs text-muted-foreground">Eşleşen tarif bulunamadı</p>
                      ) : (
                        recipeSearchResults.items.map(recipe => (
                          <button
                            key={recipe.id}
                            type="button"
                            onMouseDown={() => {
                              setForm(f => ({
                                ...f,
                                recipeId: recipe.id,
                                recipeName: recipe.name,
                                title: f.title || recipe.name,
                              }))
                              applyRecipeNutrition(recipe)
                              setRecipeSearch('')
                              setRecipeDropdownOpen(false)
                            }}
                            className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-primary/5 transition-colors border-b border-border/50 last:border-0"
                          >
                            <span className="font-medium">{recipe.name}</span>
                            {recipe.description && (
                              <span className="block text-xs text-muted-foreground truncate">{recipe.description}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Macros */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-2 block">Besin Değerleri</label>
              {autoFilledFromRecipe && form.recipeId && !hasManualNutritionOverride ? (
                <p className="mb-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px] text-primary">
                  Tarife bağlı besin değerleri otomatik dolduruldu. Dilerseniz manuel güncelleyebilirsiniz.
                </p>
              ) : null}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'calories'     as const, label: 'Kalori',   unit: 'kcal', placeholder: '350' },
                  { key: 'proteinGrams' as const, label: 'Protein',  unit: 'g',    placeholder: '25' },
                  { key: 'carbsGrams'   as const, label: 'Karb',     unit: 'g',    placeholder: '40' },
                  { key: 'fatGrams'     as const, label: 'Yağ',      unit: 'g',    placeholder: '12' },
                ].map(({ key, label, unit, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {label} <span className="font-normal normal-case">({unit})</span>
                    </label>
                    <input
                      type="text"
                      inputMode={key === 'calories' ? 'numeric' : 'decimal'}
                      value={form[key]}
                      onChange={set(key)}
                      placeholder={placeholder}
                      className="w-full px-2 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-action text-action-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {mutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {existingItem ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── MealCard ───────────────────────────────────────────────────────────────────

function MealCard({
  meal,
  onOpenDetails,
  onDelete,
  isDeleting,
}: {
  meal: MealItemData
  onOpenDetails: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const cfg = MEAL_TYPE_CONFIG[meal.mealType] ?? MEAL_TYPE_CONFIG.Snack
  return (
    <motion.div
      layoutId={`meal-card-${meal.id}`}
      className="group flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
      style={{
        background: `${cfg.dotHex}18`,
        borderColor: `${cfg.dotHex}40`,
      }}
      onClick={onOpenDetails}
    >
      <div
        className="mt-0.5 h-full min-h-[40px] w-1.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: cfg.dotHex }}
      />
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center gap-1.5">
          <Clock className="h-2.5 w-2.5 flex-shrink-0 opacity-70" style={{ color: cfg.dotHex }} />
          <span className="text-[10px] font-bold opacity-85" style={{ color: cfg.dotHex }}>{meal.time}</span>
          <span className="truncate text-[9px] opacity-75" style={{ color: cfg.dotHex }}>{cfg.label}</span>
        </div>
        <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{meal.title}</p>
        {meal.calories != null && (
          <p className="mt-1 flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Flame className="h-2.5 w-2.5" style={{ color: cfg.dotHex }} />
            {meal.calories} kcal
          </p>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-white/70 opacity-0 transition-all hover:bg-red-50 group-hover:opacity-100"
      >
        {isDeleting ? (
          <Loader2 className="w-3 h-3 text-red-600 animate-spin" />
        ) : (
          <X className="w-3 h-3 text-red-600" />
        )}
      </button>
    </motion.div>
  )
}

// ── DayColumn ──────────────────────────────────────────────────────────────────

function DayColumn({
  date, isToday, plan, clientId,
  onPlanCreated, onMealAdded, onMealDeleted, onPublishToggle, onPlanDeleted, onPlanCopied,
  onSaveAsTemplate,
  onDropRecipe,
  dropMealType,
  dropColorHex,
  isDropOver,
  setDropOverDay,
}: {
  date: Date
  isToday: boolean
  plan?: DailyPlanData
  clientId: string
  onPlanCreated: (p: DailyPlanData) => void
  onMealAdded:   (planId: string, item: MealItemData) => void
  onMealDeleted: (planId: string, mealId: string) => void
  onPublishToggle: (planId: string, publish: boolean) => void
  onPlanDeleted:  (planId: string) => void
  onPlanCopied:   (p: DailyPlanData) => void
  onSaveAsTemplate: (plan: DailyPlanData) => void
  onDropRecipe?: (dateStr: string, recipeId: string) => void
  dropMealType?: MealType
  dropColorHex?: string
  isDropOver?: boolean
  setDropOverDay?: (dateStr: string | null) => void
}) {
  const dateStr = toDateStr(date)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingMeal, setEditingMeal] = useState<MealItemData | null>(null)
  const [expandedMeal, setExpandedMeal] = useState<MealItemData | null>(null)
  const [expandedDay, setExpandedDay] = useState(false)
  const [localPlan, setLocalPlan] = useState<DailyPlanData | undefined>(undefined)
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyTargetDate, setCopyTargetDate] = useState('')
  const [copyError, setCopyError] = useState<string | null>(null)

  const effectivePlan = plan ?? localPlan
  const isPublished   = effectivePlan?.status === 'Published'
  const meals         = effectivePlan?.meals ?? []
  const totalCal      = meals.reduce((s, m) => s + (m.calories ?? 0), 0)
  const expandedCfg   = expandedMeal ? (MEAL_TYPE_CONFIG[expandedMeal.mealType] ?? MEAL_TYPE_CONFIG.Snack) : null
  const dayLayoutId   = `day-card-${dateStr}`

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/dietitian/daily-plans/clients/${clientId}`, { date: dateStr })
      return res.data as DailyPlanData
    },
    onSuccess: (p) => {
      setLocalPlan(p)
      onPlanCreated(p)
      setShowAddModal(true)
    },
  })

  const publishMutation = useMutation({
    mutationFn: async ({ planId, publish }: { planId: string; publish: boolean }) => {
      const res = await api.put(`/api/dietitian/daily-plans/${planId}/${publish ? 'publish' : 'unpublish'}`)
      return res.data as DailyPlanData
    },
    onSuccess: (p) => onPublishToggle(p.id, p.status === 'Published'),
  })

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await api.delete(`/api/dietitian/daily-plans/${planId}`)
      return planId
    },
    onSuccess: (planId) => {
      setLocalPlan(undefined)
      onPlanDeleted(planId)
    },
  })

  const deleteMealMutation = useMutation({
    mutationFn: async ({ planId, mealId }: { planId: string; mealId: string }) => {
      await api.delete(`/api/dietitian/daily-plans/${planId}/meals/${mealId}`)
      return { planId, mealId }
    },
    onMutate: ({ mealId }) => setDeletingMealId(mealId),
    onSettled: () => setDeletingMealId(null),
    onSuccess: ({ planId, mealId }) => onMealDeleted(planId, mealId),
  })

  const copyDayMutation = useMutation({
    mutationFn: async (targetDate: string) => {
      const res = await api.post(`/api/dietitian/daily-plans/clients/${clientId}/copy-day`, {
        sourceDate: dateStr,
        targetDate,
        conflictMode: 'skip',
      })
      return res.data as DailyPlanData
    },
    onSuccess: (newPlan) => {
      setCopyError(null)
      setShowCopyModal(false)
      setCopyTargetDate('')
      onPlanCopied(newPlan)
    },
    onError: (e: any) => {
      const code = e?.response?.data?.code
      if (code === 'PLAN_EXISTS') {
        setCopyError('Seçilen tarihte zaten bir plan mevcut.')
      } else {
        setCopyError(e?.response?.data?.message ?? 'Kopyalama başarısız.')
      }
    },
  })

  const handleAddClick = () => {
    if (!effectivePlan) createPlanMutation.mutate()
    else setShowAddModal(true)
  }

  const dayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1

  return (
    <>
      <motion.div
        layoutId={dayLayoutId}
        data-drop-day={dateStr}
        className={cn(
          'flex min-h-[420px] flex-col rounded-[26px] border bg-white/92 shadow-[0_10px_30px_rgba(31,73,46,0.05)] transition-all duration-200',
          isToday && !isPublished ? 'border-primary/25 shadow-[0_16px_36px_rgba(71,185,114,0.10)]' : '',
          isPublished ? 'border-primary/30 bg-[rgba(247,252,248,0.96)]' : 'border-border/80',
          !effectivePlan ? 'bg-white/72' : '',
          isDropOver ? 'ring-2 ring-offset-0 shadow-[0_18px_44px_rgba(71,185,114,0.18)]' : '',
        )}
        style={isDropOver && dropColorHex ? { boxShadow: `0 18px 44px ${dropColorHex}22`, borderColor: `${dropColorHex}55` } : undefined}
        onDragOver={(e) => {
          if (!onDropRecipe) return
          e.preventDefault()
        }}
        onDragEnter={(e) => {
          if (!onDropRecipe) return
          e.preventDefault()
          setDropOverDay?.(dateStr)
        }}
        onDragLeave={(e) => {
          if (!onDropRecipe) return
          // Avoid flicker when moving between children inside the column.
          const next = e.relatedTarget as Node | null
          if (next && e.currentTarget.contains(next)) return
          setDropOverDay?.(null)
        }}
        onDrop={(e) => {
          if (!onDropRecipe) return
          e.preventDefault()
          const recipeId = e.dataTransfer.getData('text/recipeId') || e.dataTransfer.getData('recipeId')
          setDropOverDay?.(null)
          if (!recipeId) return
          onDropRecipe(dateStr, recipeId)
        }}
      >
        {/* Day header */}
        <div
          className={cn(
          'flex cursor-pointer select-none items-start justify-between rounded-t-[26px] border-b px-3.5 py-3.5 transition-colors',
          isToday ? 'bg-primary/8 border-primary/15' : 'bg-surface-overlay/70 border-border/60',
          isPublished ? 'bg-primary/10 border-primary/15' : '',
        )}
          role="button"
          tabIndex={0}
          onClick={() => setExpandedDay(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setExpandedDay(true)
          }}
        >
          <div>
            <p className={cn(
              'text-[10px] font-bold uppercase tracking-widest',
              isToday ? 'text-primary' : 'text-muted-foreground',
            )}>
              {DAYS_TR[dayIdx]}
            </p>
            <p className={cn(
              'text-sm font-bold leading-tight',
              isToday ? 'text-primary' : 'text-foreground',
            )}>
              {formatDay(date)}
            </p>
          </div>
          {effectivePlan && (
            <span className={cn(
              'mt-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border',
              isPublished
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200',
            )}>
              {isPublished ? 'Yayında' : 'Taslak'}
            </span>
          )}
        </div>

        {/* Meal list */}
        <div className="flex-1 min-h-[180px] max-h-[320px] space-y-2 overflow-y-auto px-2.5 pb-2 pt-2.5">
          {meals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CalendarDays className="mb-2 h-6 w-6 text-muted-foreground/35" />
              <p className="text-[11px] text-muted-foreground/60">Henüz öğün yok</p>
            </div>
          ) : (
            meals.map(meal => (
              <MealCard
                key={meal.id}
                meal={meal}
                onOpenDetails={() => setExpandedMeal(meal)}
                onDelete={() => effectivePlan && deleteMealMutation.mutate({ planId: effectivePlan.id, mealId: meal.id })}
                isDeleting={deletingMealId === meal.id}
              />
            ))
          )}
        </div>

        {/* Calorie total */}
        {meals.length > 0 && totalCal > 0 && (
          <div className="mx-2.5 mb-2 flex items-center justify-between rounded-2xl border border-border/70 bg-surface-overlay/70 px-3 py-2">
            <span className="text-[10px] text-muted-foreground">Toplam</span>
            <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
              <Flame className="w-3 h-3 text-[var(--brand-coral)]" />
              {totalCal} kcal
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="px-2 pb-2 space-y-1.5">
          {/* Add meal */}
          <button
            onClick={handleAddClick}
            disabled={createPlanMutation.isPending}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 rounded-2xl border border-dashed py-2.5 text-[11px] font-semibold transition-all',
              'border-border/70 bg-white/70 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
              createPlanMutation.isPending && 'opacity-60 cursor-not-allowed',
            )}
          >
            {createPlanMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            Öğün Ekle
          </button>

          {/* Plan actions */}
          {effectivePlan && (
            <div className="flex gap-1.5">
              <button
                onClick={() => publishMutation.mutate({ planId: effectivePlan.id, publish: !isPublished })}
                disabled={publishMutation.isPending || (!isPublished && meals.length === 0)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[11px] font-bold transition-all',
                  isPublished
                    ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40',
                )}
              >
                {publishMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : isPublished ? (
                  <><EyeOff className="w-3 h-3" /> Taslağa Al</>
                ) : (
                  <><Send className="w-3 h-3" /> Yayınla</>
                )}
              </button>
              {/* Copy day */}
              <button
                onClick={() => { setCopyTargetDate(''); setCopyError(null); setShowCopyModal(true) }}
                title="Bu günü kopyala"
                className="flex w-10 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                <Copy className="w-3 h-3" />
              </button>
              {/* Save as template */}
              {meals.length > 0 && (
                <button
                  onClick={() => onSaveAsTemplate(effectivePlan!)}
                  title="Bu günü şablon olarak kaydet"
                  className="flex w-10 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <LayoutTemplate className="w-3 h-3" />
                </button>
              )}
              {!isPublished && (
                <button
                  onClick={() => {
                    if (window.confirm('Bu planı silmek istediğinize emin misiniz?')) {
                      deletePlanMutation.mutate(effectivePlan.id)
                    }
                  }}
                  disabled={deletePlanMutation.isPending}
                  className="flex w-10 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                >
                  {deletePlanMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Expanded meal details */}
      <AnimatePresence>
        {expandedMeal && expandedCfg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.20 }}
              onClick={() => setExpandedMeal(null)}
            />

            <motion.div
              layoutId={`meal-card-${expandedMeal.id}`}
              className="relative z-10 w-full max-w-md cursor-default rounded-[28px] border p-4 shadow-2xl backdrop-blur-xl"
              style={{
                background: `linear-gradient(135deg, ${expandedCfg.dotHex}16, rgba(255,255,255,0.40))`,
                borderColor: `${expandedCfg.dotHex}55`,
              }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-1.5 rounded-full" style={{ backgroundColor: expandedCfg.dotHex }} />
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 opacity-80" style={{ color: expandedCfg.dotHex }} />
                      <span className="text-xs font-bold" style={{ color: expandedCfg.dotHex }}>
                        {expandedMeal.time}
                      </span>
                      <span className="truncate text-[11px] opacity-80" style={{ color: expandedCfg.dotHex }}>
                        {expandedCfg.label}
                      </span>
                    </div>
                  </div>
                  <h3 className="mt-2 truncate text-base font-extrabold text-foreground">{expandedMeal.title}</h3>
                </div>

                <button
                  onClick={() => setExpandedMeal(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border/70 bg-white/35 text-muted-foreground transition-colors hover:bg-white/55"
                  aria-label="Kapat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {expandedMeal.note && (
                <div className="mt-3 rounded-2xl border border-border/60 bg-white/30 px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground">Not</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-snug text-foreground">{expandedMeal.note}</p>
                </div>
              )}

              {(expandedMeal.calories != null ||
                expandedMeal.proteinGrams != null ||
                expandedMeal.carbsGrams != null ||
                expandedMeal.fatGrams != null) && (
                <div className="mt-3 rounded-2xl border border-border/60 bg-white/30 px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground">Besin Değerleri</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
                    {expandedMeal.calories != null && (
                      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-white/25 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Kalori</span>
                        <span className="font-extrabold text-foreground">{expandedMeal.calories} kcal</span>
                      </div>
                    )}
                    {expandedMeal.proteinGrams != null && (
                      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-white/25 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Protein</span>
                        <span className="font-extrabold text-foreground">{expandedMeal.proteinGrams} g</span>
                      </div>
                    )}
                    {expandedMeal.carbsGrams != null && (
                      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-white/25 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Karb</span>
                        <span className="font-extrabold text-foreground">{expandedMeal.carbsGrams} g</span>
                      </div>
                    )}
                    {expandedMeal.fatGrams != null && (
                      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-white/25 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Yağ</span>
                        <span className="font-extrabold text-foreground">{expandedMeal.fatGrams} g</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setExpandedMeal(null)
                    setEditingMeal(expandedMeal)
                  }}
                  className="flex-1 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Düzenle
                </button>
                <button
                  onClick={() => {
                    if (!effectivePlan) return
                    setExpandedMeal(null)
                    deleteMealMutation.mutate({ planId: effectivePlan.id, mealId: expandedMeal.id })
                  }}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
                >
                  Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Expanded day details */}
      <AnimatePresence>
        {expandedDay && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/35 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.20 }}
              onClick={() => setExpandedDay(false)}
            />

            <motion.div
              layoutId={dayLayoutId}
              className={cn(
                'relative z-10 w-full max-w-5xl overflow-hidden rounded-[30px] border shadow-2xl backdrop-blur-xl',
                isPublished ? 'border-primary/25' : 'border-border/70',
              )}
              style={{
                background: isPublished ? 'rgba(247,252,248,0.92)' : 'rgba(255,255,255,0.80)',
              }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={cn(
                'flex items-start justify-between border-b px-5 py-4',
                isToday ? 'bg-primary/10 border-primary/15' : 'bg-surface-overlay/70 border-border/60',
                isPublished ? 'bg-primary/12 border-primary/15' : '',
              )}>
                <div>
                  <p className={cn(
                    'text-[11px] font-bold uppercase tracking-widest',
                    isToday ? 'text-primary' : 'text-muted-foreground',
                  )}>
                    {DAYS_TR[dayIdx]}
                  </p>
                  <p className={cn(
                    'text-lg font-extrabold leading-tight',
                    isToday ? 'text-primary' : 'text-foreground',
                  )}>
                    {formatDay(date)}
                  </p>
                </div>

                <button
                  onClick={() => setExpandedDay(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-white/35 text-muted-foreground transition-colors hover:bg-white/55"
                  aria-label="Kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
                <div className="rounded-3xl border border-border/60 bg-white/30 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-muted-foreground">Öğünler</p>
                    {totalCal > 0 && (
                      <span className="text-xs font-extrabold text-foreground flex items-center gap-1">
                        <Flame className="h-4 w-4 text-[var(--brand-coral)]" />
                        {totalCal} kcal
                      </span>
                    )}
                  </div>

                  <div className="mt-3 max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                    {meals.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <CalendarDays className="mb-2 h-7 w-7 text-muted-foreground/35" />
                        <p className="text-sm font-semibold text-muted-foreground/70">Henüz öğün yok</p>
                      </div>
                    ) : (
                      meals.map(meal => (
                        <MealCard
                          key={`expanded-${meal.id}`}
                          meal={meal}
                          onOpenDetails={() => setExpandedMeal(meal)}
                          onDelete={() => effectivePlan && deleteMealMutation.mutate({ planId: effectivePlan.id, mealId: meal.id })}
                          isDeleting={deletingMealId === meal.id}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-border/60 bg-white/30 p-4">
                  <p className="text-xs font-bold text-muted-foreground">İşlemler</p>

                  <div className="mt-3 space-y-2">
                    <button
                      onClick={handleAddClick}
                      disabled={createPlanMutation.isPending}
                      className={cn(
                        'w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-sm font-bold transition-all',
                        'border-border/70 bg-white/30 text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-primary',
                        createPlanMutation.isPending && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      {createPlanMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Öğün Ekle
                    </button>

                    {effectivePlan && (
                      <button
                        onClick={() => publishMutation.mutate({ planId: effectivePlan.id, publish: !isPublished })}
                        disabled={publishMutation.isPending || (!isPublished && meals.length === 0)}
                        className={cn(
                          'w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-all',
                          isPublished
                            ? 'border border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100/80'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40',
                        )}
                      >
                        {publishMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isPublished ? (
                          <><EyeOff className="w-4 h-4" /> Taslağa Al</>
                        ) : (
                          <><Send className="w-4 h-4" /> Yayınla</>
                        )}
                      </button>
                    )}

                    {effectivePlan && (
                      <button
                        onClick={() => { setCopyTargetDate(''); setCopyError(null); setShowCopyModal(true) }}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white/30 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-white/45 hover:text-foreground"
                      >
                        <Copy className="w-4 h-4" />
                        Günü Kopyala
                      </button>
                    )}

                    {effectivePlan && meals.length > 0 && (
                      <button
                        onClick={() => onSaveAsTemplate(effectivePlan)}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white/30 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-white/45 hover:text-foreground"
                      >
                        <LayoutTemplate className="w-4 h-4" />
                        Şablon Olarak Kaydet
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit meal modal */}
      {(showAddModal || editingMeal) && effectivePlan && (
        <AddMealModal
          planId={effectivePlan.id}
          planDate={effectivePlan.date}
          existingItem={editingMeal ?? undefined}
          onClose={() => { setShowAddModal(false); setEditingMeal(null) }}
          onSaved={(item) => {
            onMealAdded(effectivePlan.id, item)
            setShowAddModal(false)
            setEditingMeal(null)
          }}
        />
      )}

      {/* Copy day modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCopyModal(false)} />
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm z-10 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground">Günü Kopyala</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDay(date)} planını başka bir güne kopyala</p>
              </div>
              <button onClick={() => setShowCopyModal(false)} className="w-8 h-8 rounded-xl hover:bg-muted/70 flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Hedef Tarih</label>
                <input
                  type="date"
                  value={copyTargetDate}
                  onChange={e => { setCopyTargetDate(e.target.value); setCopyError(null) }}
                  min={toDateStr(new Date())}
                  className="select-sfcos h-11"
                />
              </div>
              {copyError && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {copyError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="button"
                  disabled={!copyTargetDate || copyDayMutation.isPending}
                  onClick={() => copyTargetDate && copyDayMutation.mutate(copyTargetDate)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {copyDayMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  Kopyala
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

// ── Recipe dock + drag/drop helpers ──────────────────────────────────────────────

function normalizeTr(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR')
}

function RecipeMiniCard({
  recipe,
  dragging,
  onPointerDown,
  isSelected,
}: {
  recipe: Recipe
  dragging: boolean
  onPointerDown: (recipe: Recipe, e: React.PointerEvent<HTMLDivElement>) => void
  isSelected: boolean
}) {
  const primaryTag = recipe.tags?.[0]
  const secondaryTag = recipe.tags?.[1]
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-gradient-to-b from-white/55 to-emerald-50/35 px-3 py-2.5 shadow-sm backdrop-blur-[1px] transition-all',
        'hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20',
        dragging ? 'opacity-50 scale-[0.99]' : '',
        isSelected ? 'ring-2 ring-primary/35 border-primary/35 bg-primary/[0.06]' : '',
      )}
      role="button"
      tabIndex={0}
      draggable={false}
      onPointerDown={(e) => onPointerDown(recipe, e)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onPointerDown(recipe, e as any)
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold text-foreground">{recipe.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            {recipe.caloriesKcal != null && <span>{recipe.caloriesKcal} kcal</span>}
            {recipe.proteinGrams != null && <span>• P {Number(recipe.proteinGrams).toFixed(0)}g</span>}
            {recipe.carbsGrams != null && <span>• K {Number(recipe.carbsGrams).toFixed(0)}g</span>}
            {recipe.fatGrams != null && <span>• Y {Number(recipe.fatGrams).toFixed(0)}g</span>}
          </div>
        </div>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-border/60 bg-white/45 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          <span className="text-[12px] font-black">≡</span>
        </div>
      </div>

      {(primaryTag || secondaryTag) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {primaryTag && (
            <span className="rounded-full border border-border/60 bg-white/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {primaryTag}
            </span>
          )}
          {secondaryTag && (
            <span className="rounded-full border border-border/60 bg-white/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {secondaryTag}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function QuickAddRecipeModal({
  open,
  recipe,
  mealType,
  dateStr,
  timeValue,
  noteValue,
  onChangeTime,
  onChangeNote,
  onClose,
  onConfirm,
  onOpenFull,
}: {
  open: boolean
  recipe: Recipe | null
  mealType: MealType
  dateStr: string
  timeValue: string
  noteValue: string
  onChangeTime: (value: string) => void
  onChangeNote: (value: string) => void
  onClose: () => void
  onConfirm: () => void
  onOpenFull: () => void
}) {
  const cfg = MEAL_TYPE_CONFIG[mealType] ?? MEAL_TYPE_CONFIG.Snack
  const chips = getQuickTimeChips(mealType)

  return (
    <AnimatePresence>
      {open && recipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          <motion.div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-border/70 bg-white/80 shadow-2xl backdrop-blur-xl"
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border/60" style={{ background: `${cfg.dotHex}10` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: cfg.dotHex }}>
                    Hızlı Ekle • {dateStr}
                  </p>
                  <p className="mt-1 truncate text-lg font-extrabold text-foreground">{recipe.name}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    Öğün: <span className="font-extrabold" style={{ color: cfg.dotHex }}>{cfg.label}</span>
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-white/35 text-muted-foreground transition-colors hover:bg-white/55"
                  aria-label="Kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Saat</label>
                <div className="flex items-center gap-2">
                  <TimeField
                    value={timeValue}
                    onChange={onChangeTime}
                    className="flex-1"
                  />
                  <div className="flex gap-1.5">
                    {chips.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onChangeTime(t)}
                        className={cn(
                          'h-11 rounded-2xl border px-3 text-xs font-extrabold transition-colors',
                          timeValue === t
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-border/70 bg-white/45 text-muted-foreground hover:bg-white/60',
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <details className="rounded-2xl border border-border/60 bg-white/35 px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-bold text-foreground">
                  Not ekle <span className="text-xs text-muted-foreground font-semibold">(isteğe bağlı)</span>
                </summary>
                <textarea
                  value={noteValue}
                  onChange={(e) => onChangeNote(e.target.value)}
                  placeholder="Danışana not..."
                  className="mt-3 min-h-[72px] w-full resize-none rounded-2xl border border-border/70 bg-white/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/30"
                />
              </details>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onOpenFull}
                  className="flex-1 rounded-2xl border border-border/70 bg-white/45 px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-white/60"
                >
                  Ayrıntılı ekle
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Ekle
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default function PlansPage() {
  const today = useMemo(() => new Date(), [])
  const [weekStart, setWeekStart] = useState(() => getIsoWeekMonday(today))
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [plans, setPlans] = useState<DailyPlanData[]>([])
  const pageRootRef = useRef<HTMLDivElement | null>(null)

  // Template panel state
  const [applyTemplateModal, setApplyTemplateModal] = useState<{ template: TemplateSummary } | null>(null)
  const [applyTargetDate, setApplyTargetDate] = useState('')
  const [applyError, setApplyError] = useState<string | null>(null)
  const [saveFromPlanModal, setSaveFromPlanModal] = useState<{ plan: DailyPlanData } | null>(null)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Recipe dock + drag/drop state
  const [recipeDockOpen, setRecipeDockOpen] = useState(true)
  const [recipeMealFilter, setRecipeMealFilter] = useState<MealType>('Breakfast')
  const [recipeSearchTerm, setRecipeSearchTerm] = useState('')
  const [recipeSelectedTag, setRecipeSelectedTag] = useState<string | null>(null)
  const [recipeSort, setRecipeSort] = useState<RecipeDockSort>('recommended')
  const [activeDragRecipeId, setActiveDragRecipeId] = useState<string | null>(null)
  const [dropOverDay, setDropOverDay] = useState<string | null>(null)
  const dropOverDayRef = useRef<string | null>(null)
  const [pointerDrag, setPointerDrag] = useState<{
    recipe: Recipe
    startX: number
    startY: number
    x: number
    y: number
    started: boolean
  } | null>(null)
  const pointerDragPosRef = useRef<{ x: number; y: number; started: boolean }>({ x: 0, y: 0, started: false })
  const [quickAdd, setQuickAdd] = useState<{ recipe: Recipe; dateStr: string; mealType: MealType } | null>(null)
  const [quickAddTime, setQuickAddTime] = useState('')
  const [quickAddNote, setQuickAddNote] = useState('')
  const [globalAddModal, setGlobalAddModal] = useState<{ planId: string; planDate: string; initialValues: Partial<AddMealForm> } | null>(null)
  const [leftPanelsCollapsed, setLeftPanelsCollapsed] = useState(false)
  const clientsPanelRef = useRef<HTMLDivElement | null>(null)
  const templatesPanelRef = useRef<HTMLDivElement | null>(null)

  const getDashboardScrollEl = useCallback((): HTMLElement | null => {
    const byClosest = pageRootRef.current?.closest?.('main') as HTMLElement | null
    return byClosest ?? (document.querySelector('main') as HTMLElement | null) ?? null
  }, [])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const fromStr  = toDateStr(weekStart)
  const toStr    = toDateStr(weekDays[6])

  // ── Clients query ────────────────────────────────────────────────────────────

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients-for-plans'],
    queryFn: async () => {
      const res = await api.get('/api/dietitian/clients', { params: { page: 1, pageSize: 100 } })
      return res.data as { items: ClientRow[]; total: number }
    },
  })
  const clients        = clientsData?.items ?? []
  const selectedClient = clients.find(c => c.clientId === selectedClientId)

  // ── Recipes (dock) query ──────────────────────────────────────────────────────
  const recipesQuery = useQuery({
    queryKey: ['recipes', 'dock', '30d'],
    queryFn: () => getRecipes({ page: 1, pageSize: 200, status: 'all', source: 'clinic', range: '30d' }),
    staleTime: 60000,
    retry: 1,
    retryDelay: 1200,
  })
  const recipes = recipesQuery.data?.items ?? []

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>()
    recipes.forEach((recipe) => {
      recipe.tags?.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1))
    })

    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'tr'))
      .slice(0, 12)
      .map(([tag]) => tag)
  }, [recipes])

  const filteredRecipes = useMemo(() => {
    const q = normalizeTr(recipeSearchTerm)

    let result = recipes.filter((r) => {
      if (recipeSelectedTag && !(r.tags ?? []).includes(recipeSelectedTag)) return false
      if (!q) return true
      const hay = normalizeTr([r.name, r.description, ...(r.tags ?? [])].filter(Boolean).join(' '))
      return hay.includes(q)
    })

    const mealLabel = (MEAL_TYPE_CONFIG[recipeMealFilter]?.label ?? '').toLocaleLowerCase('tr-TR')
    if (mealLabel) {
      const hasAnyMealTag = result.some((r) => (r.tags ?? []).some((t) => normalizeTr(t).includes(mealLabel)))
      if (hasAnyMealTag) {
        result = result.filter((r) => (r.tags ?? []).some((t) => normalizeTr(t).includes(mealLabel)))
      }
    }

    result = recipeSort === 'alphabetical'
      ? result.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      : result.sort((a, b) =>
        (b.analyticsPreview?.preferenceScore ?? 0) - (a.analyticsPreview?.preferenceScore ?? 0) ||
        a.name.localeCompare(b.name, 'tr'),
      )

    return result
  }, [recipes, recipeSearchTerm, recipeSelectedTag, recipeMealFilter, recipeSort])

  // ── Week plans query ─────────────────────────────────────────────────────────

  const {
    isLoading: plansLoading,
    isError:   plansError,
    refetch:   refetchPlans,
  } = useQuery({
    queryKey: ['daily-plans', selectedClientId, fromStr],
    queryFn: async () => {
      const res = await api.get(`/api/dietitian/daily-plans/clients/${selectedClientId}`, {
        params: { from: fromStr, to: toStr },
      })
      const data = res.data as { plans: DailyPlanData[] }
      setPlans(data.plans)
      return data
    },
    enabled:        !!selectedClientId,
    retry:          1,
    retryDelay:     1000,
  })

  // ── Optimistic state handlers ────────────────────────────────────────────────

  const handlePlanCreated = useCallback((plan: DailyPlanData) => {
    setPlans(prev => [...prev.filter(p => p.date !== plan.date), plan])
  }, [])

  const handleMealAdded = useCallback((planId: string, item: MealItemData) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const exists = p.meals.find(m => m.id === item.id)
      const meals  = exists
        ? p.meals.map(m => m.id === item.id ? item : m)
        : [...p.meals, item]
      return { ...p, meals: meals.sort((a, b) => a.time.localeCompare(b.time)) }
    }))
  }, [])

  const ensurePlanForDate = useCallback(async (dateStr: string) => {
    const existing = plans.find(p => p.date === dateStr)
    if (existing) return existing
    if (!selectedClientId) return null
    const res = await api.post(`/api/dietitian/daily-plans/clients/${selectedClientId}`, { date: dateStr })
    const created = res.data as DailyPlanData
    handlePlanCreated(created)
    return created
  }, [plans, selectedClientId, handlePlanCreated])

  const handleMealDeleted = useCallback((planId: string, mealId: string) => {
    setPlans(prev => prev.map(p =>
      p.id === planId ? { ...p, meals: p.meals.filter(m => m.id !== mealId) } : p
    ))
  }, [])

  const handleRecipePointerDown = useCallback((recipe: Recipe, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    pointerDragPosRef.current = { x: e.clientX, y: e.clientY, started: false }
    setPointerDrag({
      recipe,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      started: false,
    })
  }, [])

  useEffect(() => {
    dropOverDayRef.current = dropOverDay
  }, [dropOverDay])

  useEffect(() => {
    if (!pointerDrag) return

    const threshold = 6

    const hitTestDay = (clientX: number, clientY: number) => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-drop-day]'))
      for (const node of nodes) {
        const rect = node.getBoundingClientRect()
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          return node.getAttribute('data-drop-day')
        }
      }
      return null
    }

    const onMove = (ev: PointerEvent) => {
      setPointerDrag((current) => {
        if (!current) return current
        const dx = Math.abs(ev.clientX - current.startX)
        const dy = Math.abs(ev.clientY - current.startY)
        const started = current.started || dx > threshold || dy > threshold
        if (started && !current.started) {
          setActiveDragRecipeId(current.recipe.id)
          setDropOverDay(null)
        }
        if (started) {
          const over = hitTestDay(ev.clientX, ev.clientY)
          setDropOverDay(over)
          dropOverDayRef.current = over
        }
        pointerDragPosRef.current = { x: ev.clientX, y: ev.clientY, started }
        return { ...current, x: ev.clientX, y: ev.clientY, started }
      })
    }

    const refreshOverFromCurrent = () => {
      setPointerDrag((current) => {
        if (!current || !current.started) return current
        const over = hitTestDay(current.x, current.y)
        setDropOverDay(over)
        dropOverDayRef.current = over
        return current
      })
    }

    const finish = (confirm: boolean) => {
      setPointerDrag((current) => {
        if (!current) return current
        const targetDay = dropOverDayRef.current
        const shouldConfirm = confirm && current.started && !!targetDay
        const recipeId = current.recipe.id
        window.setTimeout(() => {
          setPointerDrag(null)
          setActiveDragRecipeId(null)
          setDropOverDay(null)
          pointerDragPosRef.current = { x: 0, y: 0, started: false }
          if (shouldConfirm && targetDay) handleRecipeDrop(targetDay, recipeId)
        }, 0)
        return null
      })
    }

    const onUp = () => finish(true)
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') finish(false)
    }

    const scrollEl = getDashboardScrollEl()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    window.addEventListener('keydown', onKeyDown)
    scrollEl?.addEventListener('scroll', refreshOverFromCurrent, { passive: true })
    document.body.classList.add('select-none')
    document.body.style.cursor = 'grabbing'

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKeyDown)
      scrollEl?.removeEventListener('scroll', refreshOverFromCurrent as any)
      document.body.classList.remove('select-none')
      document.body.style.cursor = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointerDrag, getDashboardScrollEl])

  // Auto-scroll while pointer-dragging (user can move cursor to top/bottom to scroll the page).
  useEffect(() => {
    if (!pointerDrag?.started) return

    const thresholdPx = 130
    const maxSpeedPx = 44
    let rafId = 0
    let running = true
    const scrollEl = getDashboardScrollEl()

    const performScroll = (delta: number) => {
      if (!delta) return
      if (scrollEl) scrollEl.scrollTop += delta
      else window.scrollBy({ top: delta, behavior: 'auto' })
    }

    const loop = () => {
      if (!running) return
      const y = pointerDragPosRef.current.y
      const vh = window.innerHeight || 0
      let delta = 0
      if (y < thresholdPx) {
        const t = (thresholdPx - y) / thresholdPx
        delta = -Math.max(1, Math.round(maxSpeedPx * t))
      } else if (y > vh - thresholdPx) {
        const t = (y - (vh - thresholdPx)) / thresholdPx
        delta = Math.max(1, Math.round(maxSpeedPx * t))
      }
      performScroll(delta)
      rafId = window.requestAnimationFrame(loop)
    }

    rafId = window.requestAnimationFrame(loop)
    return () => {
      running = false
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [pointerDrag?.started, getDashboardScrollEl])

  function handleRecipeDrop(dateStr: string, recipeId: string) {
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) {
      toast('Tarif bulunamadı.')
      return
    }

    setQuickAdd({ recipe, dateStr, mealType: recipeMealFilter })
    setQuickAddTime(DEFAULT_TIME_BY_MEALTYPE[recipeMealFilter] ?? '12:00')
    setQuickAddNote('')
  }

  const closeQuickAdd = useCallback(() => {
    setQuickAdd(null)
    setQuickAddTime('')
    setQuickAddNote('')
  }, [])

  const confirmQuickAdd = useCallback(async () => {
    if (!quickAdd) return
    if (!selectedClientId) {
      toast('Önce danışan seçin.')
      return
    }

    try {
      const plan = await ensurePlanForDate(quickAdd.dateStr)
      if (!plan) {
        toast('Plan oluşturulamadı.')
        return
      }

      const payload = {
        time: quickAddTime || (DEFAULT_TIME_BY_MEALTYPE[quickAdd.mealType] ?? '12:00'),
        mealType: quickAdd.mealType,
        title: quickAdd.recipe.name.trim(),
        note: quickAddNote.trim() || null,
        calories: quickAdd.recipe.caloriesKcal ?? null,
        proteinGrams: quickAdd.recipe.proteinGrams ?? null,
        carbsGrams: quickAdd.recipe.carbsGrams ?? null,
        fatGrams: quickAdd.recipe.fatGrams ?? null,
        recipeId: quickAdd.recipe.id,
      }

      const res = await api.post(`/api/dietitian/daily-plans/${plan.id}/meals`, payload)
      handleMealAdded(plan.id, res.data as MealItemData)
      toast('Eklendi')
      closeQuickAdd()
    } catch (e: any) {
      toast(e?.response?.data?.message ?? 'Öğün eklenemedi.')
    }
  }, [quickAdd, selectedClientId, ensurePlanForDate, quickAddTime, quickAddNote, handleMealAdded, closeQuickAdd])

  const openFullFromQuickAdd = useCallback(async () => {
    if (!quickAdd) return
    if (!selectedClientId) {
      toast('Önce danışan seçin.')
      return
    }

    try {
      const plan = await ensurePlanForDate(quickAdd.dateStr)
      if (!plan) {
        toast('Plan oluşturulamadı.')
        return
      }

      setGlobalAddModal({
        planId: plan.id,
        planDate: plan.date,
        initialValues: {
          time: quickAddTime || (DEFAULT_TIME_BY_MEALTYPE[quickAdd.mealType] ?? '12:00'),
          mealType: quickAdd.mealType,
          title: quickAdd.recipe.name,
          note: quickAddNote,
          calories: quickAdd.recipe.caloriesKcal != null ? String(quickAdd.recipe.caloriesKcal) : '',
          proteinGrams: quickAdd.recipe.proteinGrams != null ? String(quickAdd.recipe.proteinGrams) : '',
          carbsGrams: quickAdd.recipe.carbsGrams != null ? String(quickAdd.recipe.carbsGrams) : '',
          fatGrams: quickAdd.recipe.fatGrams != null ? String(quickAdd.recipe.fatGrams) : '',
          recipeId: quickAdd.recipe.id,
          recipeName: quickAdd.recipe.name,
        },
      })

      closeQuickAdd()
    } catch (e: any) {
      toast(e?.response?.data?.message ?? 'Detay açılamadı.')
    }
  }, [quickAdd, selectedClientId, ensurePlanForDate, quickAddTime, quickAddNote, closeQuickAdd])

  const handlePublishToggle = useCallback((planId: string, isPublished: boolean) => {
    setPlans(prev => prev.map(p =>
      p.id === planId ? { ...p, status: isPublished ? 'Published' : 'Draft' } : p
    ))
  }, [])

  const handlePlanDeleted = useCallback((planId: string) => {
    setPlans(prev => prev.filter(p => p.id !== planId))
  }, [])

  const handlePlanCopied = useCallback((plan: DailyPlanData) => {
    // If the copied plan lands on the currently visible week, add it
    setPlans(prev => {
      const exists = prev.find(p => p.id === plan.id || p.date === plan.date)
      if (exists) return prev
      return [...prev, plan]
    })
  }, [])

  function prevWeek() { setWeekStart(d => addDays(d, -7)); setPlans([]) }
  function nextWeek() { setWeekStart(d => addDays(d, 7)); setPlans([]) }
  function goToday()  { setWeekStart(getIsoWeekMonday(today)); setPlans([]) }

  const weekLabel = `${formatDay(weekStart)} – ${formatDay(weekDays[6])}, ${weekStart.getFullYear()}`

  // Published/draft counts for selected week
  const publishedCount = plans.filter(p => p.status === 'Published').length
  const draftCount     = plans.filter(p => p.status === 'Draft').length

  // Draft plans that have at least 1 meal — eligible for bulk publish
  const draftPlansWithMeals = plans.filter(p => p.status === 'Draft' && p.meals.length > 0)

  const bulkPublishMutation = useMutation({
    mutationFn: async (planIds: string[]) => {
      const dates = plans
        .filter(p => planIds.includes(p.id))
        .map(p => p.date)
      const res = await api.post(`/api/dietitian/daily-plans/clients/${selectedClientId}/bulk-publish`, { dates })
      return { result: res.data as { published: number; skipped: number }, planIds }
    },
    onSuccess: ({ result, planIds }) => {
      if (result.published > 0) {
        setPlans(prev => prev.map(p =>
          planIds.includes(p.id) ? { ...p, status: 'Published' as PlanStatus } : p
        ))
      } else {
        alert('Yayınlanacak taslak plan bulunamadı.')
      }
    },
    onError: () => alert('Toplu yayınlama sırasında bir hata oluştu.'),
  })

  const [copyWeekPending, setCopyWeekPending] = useState(false)
  const copyWeekMutation = useMutation({
    mutationFn: async () => {
      const targetWeekStart = toDateStr(addDays(weekStart, 7))
      const res = await api.post(`/api/dietitian/daily-plans/clients/${selectedClientId}/copy-week`, {
        sourceWeekStart: fromStr,
        targetWeekStart,
        conflictMode: 'skip',
      })
      return res.data as { copied: number; skipped: number }
    },
    onMutate: () => setCopyWeekPending(true),
    onSettled: () => setCopyWeekPending(false),
    onSuccess: (result) => {
      if (result.copied > 0) {
        // Navigate to next week to see the copies
        nextWeek()
      } else {
        alert('Kopyalanacak plan bulunamadı. Hedef haftada zaten planlar mevcut olabilir.')
      }
    },
    onError: () => alert('Hafta kopyalanırken bir hata oluştu.'),
  })

  // ── Templates ────────────────────────────────────────────────────────────────

  const {
    data: templates = [],
    refetch: refetchTemplates,
    isLoading: templatesLoading,
  } = useQuery({
    queryKey: ['meal-plan-templates'],
    queryFn: () => listTemplates(),
  })

  const applyTemplateMutation = useMutation({
    mutationFn: async ({ templateId, targetDate }: { templateId: string; targetDate: string }) => {
      if (!selectedClientId) {
        return null
      }

      return applyTemplate(selectedClientId, { templateId, targetDate })
    },
    onSuccess: (newPlan) => {
      if (!newPlan) {
        setApplyError('Önce danışan seçin.')
        return
      }

      setApplyTemplateModal(null)
      setApplyTargetDate('')
      setApplyError(null)
      handlePlanCreated(newPlan as DailyPlanData)
    },
    onError: (e: any) => {
      const code = e?.response?.data?.code
      if (code === 'PLAN_EXISTS') {
        setApplyError('Bu tarihte zaten bir plan mevcut.')
      } else {
        setApplyError(e?.response?.data?.message ?? 'Şablon uygulanamadı.')
      }
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => deleteTemplate(templateId),
    onSuccess: () => refetchTemplates(),
    onError: () => alert('Şablon silinemedi.'),
  })

  async function handleSaveAsTemplate() {
    if (!saveFromPlanModal || !newTemplateName.trim()) return
    setSavingTemplate(true)
    try {
      await createTemplateFromPlan({
        planId: saveFromPlanModal.plan.id,
        name: newTemplateName.trim(),
      })
      await refetchTemplates()
      setSaveFromPlanModal(null)
      setNewTemplateName('')
    } catch {
      alert('Şablon kaydedilemedi.')
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <motion.div
      ref={pageRootRef}
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } }}
    >

      {/* ── Page header ── */}
      <motion.div
        className="flex items-start justify-between flex-wrap gap-4"
        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } } }}
      >
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>Günlük Plan Yönetimi</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Danışanlarınız için öğün planları oluşturun, düzenleyin ve yayınlayın
          </p>
        </div>

        {/* Week navigator */}
        <div className="card-sfcos flex items-center gap-2 px-2 py-1.5">
          <button
            onClick={prevWeek}
            className="w-8 h-8 rounded-xl hover:bg-muted/70 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={goToday}
            className="px-3 h-7 rounded-lg bg-action text-action-foreground text-xs font-bold transition-opacity hover:opacity-90"
          >
            Bugün
          </button>
          <span className="text-sm font-semibold text-foreground min-w-[200px] text-center select-none">
            {weekLabel}
          </span>
          <button
            onClick={nextWeek}
            className="w-8 h-8 rounded-xl hover:bg-muted/70 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </motion.div>

      <motion.div
        className="flex flex-col items-start gap-5 lg:flex-row"
        variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.16, 1, 0.3, 1] } } }}
      >

        {/* ── Left column: Clients + Templates ── */}
        <motion.div
          className="space-y-3 w-full lg:flex-none"
          animate={{ width: leftPanelsCollapsed ? 56 : 240 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-between px-1">
            <span className={cn(
              'text-[11px] font-bold uppercase tracking-widest text-muted-foreground',
              leftPanelsCollapsed ? 'sr-only' : '',
            )}>
              Paneller
            </span>
            <button
              type="button"
              onClick={() => setLeftPanelsCollapsed(v => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border/70 bg-white/40 text-muted-foreground transition-colors hover:bg-white/55"
              title={leftPanelsCollapsed ? 'Panelleri Aç' : 'Panelleri Kapat'}
            >
              {leftPanelsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {leftPanelsCollapsed ? (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="sticky top-4 flex flex-col items-center gap-2"
            >
              <button
                type="button"
                onClick={() => {
                  setLeftPanelsCollapsed(false)
                  window.setTimeout(() => clientsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 220)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white/55 text-muted-foreground transition-colors hover:bg-white/70"
                title="DanÄ±ÅŸanlar"
              >
                <Users className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeftPanelsCollapsed(false)
                  window.setTimeout(() => templatesPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 220)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white/55 text-muted-foreground transition-colors hover:bg-white/70"
                title="Åablonlar"
              >
                <LayoutTemplate className="h-5 w-5" />
              </button>
            </motion.div>
          ) : (
            <>
          {/* Client Sidebar */}
          <div ref={clientsPanelRef} className="card-sfcos sticky top-4 overflow-hidden p-0">
            <div className="border-b border-border/70 bg-surface-overlay/70 px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Danışanlar
              </h2>
              {clientsData && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{clients.length} danışan</p>
              )}
            </div>

            <div className="max-h-[520px] overflow-y-auto p-2">
              {clientsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 px-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...
                </div>
              ) : clients.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 px-2 text-center">Henüz danışanınız yok.</p>
              ) : (
                <ul className="space-y-0.5">
                  {clients.map(client => {
                    const isSelected = selectedClientId === client.clientId
                    return (
                      <li key={client.clientId}>
                        <button
                          onClick={() => { setSelectedClientId(client.clientId); setPlans([]) }}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition-all',
                            isSelected
                              ? 'border-primary/20 bg-primary/10 text-primary shadow-[0_10px_24px_rgba(71,185,114,0.10)]'
                              : 'border-transparent text-foreground hover:border-border hover:bg-secondary/70',
                          )}
                        >
                          <div className={cn(
                            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl text-[11px] font-bold',
                            isSelected ? 'bg-primary text-white' : 'bg-primary/10 text-primary',
                          )}>
                            {getInitials(client.fullName)}
                          </div>
                          <span className="truncate">{client.fullName}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Template Panel */}
          <div ref={templatesPanelRef} className="card-sfcos overflow-hidden p-0">
            <div className="border-b border-border/70 bg-surface-overlay/70 px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <LayoutTemplate className="w-3.5 h-3.5" /> Şablonlar
              </h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">{templates.length} şablon kayıtlı</p>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2">
              {templatesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 px-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...
                </div>
              ) : templates.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 px-2 text-center leading-relaxed">
                  Henüz şablon yok.<br />
                  Bir gün sütunundaki <strong>···</strong> menüsünden kaydedin.
                </p>
              ) : (
                <ul className="space-y-1">
                  {templates.map(tpl => (
                    <li key={tpl.id} className="group flex items-center gap-2 rounded-xl border border-border/60 bg-white/80 px-3 py-2.5 hover:border-primary/20 hover:bg-primary/5 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{tpl.name}</p>
                        <p className="text-[10px] text-muted-foreground">{tpl.itemCount} öğün</p>
                      </div>
                      <button
                        title="Uygula"
                        disabled={!selectedClientId}
                        onClick={() => {
                          setApplyError(null)
                          setApplyTargetDate('')
                          setApplyTemplateModal({ template: tpl })
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white disabled:opacity-30 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Sil"
                        onClick={() => {
                          if (window.confirm(`"${tpl.name}" şablonunu silmek istiyor musunuz?`)) {
                            deleteTemplateMutation.mutate(tpl.id)
                          }
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

            </>
          )}

        </motion.div>

        {/* ── Week content ── */}
        <div className="space-y-4 flex-1 min-w-0">

          {/* Stats bar (when client selected) */}
          {selectedClientId && !plansLoading && !plansError && (
            <div className="card-sfcos flex items-center gap-3 px-4 py-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {selectedClient?.fullName} — {weekLabel}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {publishedCount > 0 && (
                  <span className="badge-base badge-active">
                    <Eye className="w-3 h-3" /> {publishedCount} gün yayında
                  </span>
                )}
                {draftCount > 0 && (
                  <span className="badge-base badge-expiring">
                    {draftCount} taslak
                  </span>
                )}
                {draftPlansWithMeals.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm(`${draftPlansWithMeals.length} günlük taslak plan yayınlanacak. Emin misiniz?`)) {
                        bulkPublishMutation.mutate(draftPlansWithMeals.map(p => p.id))
                      }
                    }}
                    disabled={bulkPublishMutation.isPending}
                    className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                  >
                    {bulkPublishMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Tümünü Yayınla ({draftPlansWithMeals.length})
                  </button>
                )}
                {plans.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Bu haftayı (${weekLabel}) bir sonraki haftaya kopyalamak istiyor musunuz? Hedef haftada mevcut planlar korunur.`)) {
                        copyWeekMutation.mutate()
                      }
                    }}
                    disabled={copyWeekPending}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary disabled:opacity-50"
                  >
                    {copyWeekPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                    Haftayı Kopyala →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Grid / states */}
          {!selectedClientId ? (
            <div className="card-premium flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <CalendarDays className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-foreground mb-1">Danışan Seçin</p>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Haftalık öğün planlarını görmek ve düzenlemek için soldaki listeden bir danışan seçin.
              </p>
            </div>
          ) : plansLoading ? (
            <div className="card-premium flex flex-col items-center justify-center gap-3 py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Planlar yükleniyor...</p>
            </div>
          ) : plansError ? (
            <div className="card-premium flex flex-col items-center justify-center gap-4 py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-red-200 bg-red-50">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground mb-1">Plan verileri yüklenemedi</p>
                <p className="text-sm text-muted-foreground">
                  API sunucusu yanıt vermiyor. Sunucunun çalıştığından emin olun.
                </p>
              </div>
              <button
                onClick={() => refetchPlans()}
                className="flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/20 hover:text-primary"
              >
                <RefreshCw className="w-4 h-4" /> Tekrar Dene
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-2 xl:grid-cols-7">
                {weekDays.map((day) => {
                  const ds   = toDateStr(day)
                  const plan = plans.find(p => p.date === ds)
                  return (
                    <DayColumn
                      key={ds}
                      date={day}
                      isToday={ds === toDateStr(today)}
                      plan={plan}
                      clientId={selectedClientId}
                      onPlanCreated={handlePlanCreated}
                      onMealAdded={handleMealAdded}
                      onMealDeleted={handleMealDeleted}
                      onPublishToggle={handlePublishToggle}
                      onPlanDeleted={handlePlanDeleted}
                      onPlanCopied={handlePlanCopied}
                      onSaveAsTemplate={(plan) => { setNewTemplateName(''); setSaveFromPlanModal({ plan }) }}
                      onDropRecipe={handleRecipeDrop}
                      dropMealType={recipeMealFilter}
                      dropColorHex={MEAL_TYPE_CONFIG[recipeMealFilter]?.dotHex}
                      isDropOver={!!activeDragRecipeId && dropOverDay === ds}
                      setDropOverDay={setDropOverDay}
                    />
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full border border-amber-200 bg-amber-50" />
                  Taslak — sadece diyetisyen görür
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full border border-emerald-200 bg-emerald-50" />
                  Yayında — danışan mobil uygulamada görür
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full border border-primary/30 bg-primary/10" />
                  Bugün
                </span>
              </div>

              {/* Recipe library dock */}
              <div className="mt-4 rounded-[32px] border border-border bg-[rgba(247,252,248,0.70)] shadow-[0_12px_34px_rgba(31,73,46,0.06)] backdrop-blur-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRecipeDockOpen(v => !v)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <div>
                    <p className="text-sm font-extrabold text-foreground">Tarif Kütüphanesi</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Kartı sürükleyip bir güne bırakın. Seçili öğün filtresi drop türünü belirler.
                    </p>
                  </div>
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-white/35 text-muted-foreground transition-transform',
                    recipeDockOpen ? 'rotate-180' : 'rotate-0',
                  )}>
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {recipeDockOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="px-5 pb-5"
                    >
                      <div className="rounded-[28px] border border-border/70 bg-gradient-to-b from-white/40 to-emerald-50/40 p-4 backdrop-blur-[2px]">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_220px]">
                          <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 flex h-11 -translate-y-1/2 items-center">
                              <Search className="h-4 w-4 text-muted-foreground" />
                            </span>
                            <input
                              value={recipeSearchTerm}
                              onChange={(e) => setRecipeSearchTerm(e.target.value)}
                              placeholder="Tarif adı, açıklama veya etikete göre ara"
                              className="h-11 w-full rounded-2xl border border-border/70 bg-white/45 pl-11 pr-11 text-sm font-semibold text-foreground outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] focus:border-primary/30"
                            />
                            {recipeSearchTerm ? (
                              <button
                                type="button"
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                                onClick={() => setRecipeSearchTerm('')}
                                aria-label="Aramayı temizle"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>

                          <label className="space-y-2 text-sm font-medium text-foreground">
                            <span>Sıralama</span>
                            <select
                              className="select-sfcos h-11"
                              value={recipeSort}
                              onChange={(e) => setRecipeSort(e.target.value as RecipeDockSort)}
                            >
                              <option value="recommended">Önerilen sıralama</option>
                              <option value="alphabetical">A’dan Z’ye</option>
                            </select>
                          </label>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Öğün</span>
                          {RECIPE_DOCK_MEAL_FILTERS.map((item) => (
                            <button
                              key={item.mealType}
                              type="button"
                              onClick={() => setRecipeMealFilter(item.mealType)}
                              className={cn(
                                'h-9 rounded-full border px-3 text-xs font-bold transition-colors',
                                recipeMealFilter === item.mealType
                                  ? 'border-primary/30 bg-primary/10 text-primary'
                                  : 'border-border/70 bg-white/30 text-muted-foreground hover:bg-white/45',
                              )}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Etiketler</span>
                          <button
                            type="button"
                            onClick={() => setRecipeSelectedTag(null)}
                            className={cn(
                              'h-9 rounded-full border px-3 text-xs font-bold transition-colors',
                              recipeSelectedTag === null
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-border/70 bg-white/30 text-muted-foreground hover:bg-white/45',
                            )}
                          >
                            Tümü
                          </button>
                          {availableTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setRecipeSelectedTag(tag)}
                              className={cn(
                                'h-9 rounded-full border px-3 text-xs font-bold transition-colors',
                                recipeSelectedTag === tag
                                  ? 'border-primary/30 bg-primary/10 text-primary'
                                  : 'border-border/70 bg-white/30 text-muted-foreground hover:bg-white/45',
                              )}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                          <p>{filteredRecipes.length} tarif gösteriliyor</p>
                          {(recipeSearchTerm || recipeSelectedTag || recipeSort !== 'recommended') ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 font-medium text-primary transition hover:text-primary/80"
                              onClick={() => {
                                setRecipeSearchTerm('')
                                setRecipeSelectedTag(null)
                                setRecipeSort('recommended')
                              }}
                            >
                              Filtreleri temizle
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                        {recipesQuery.isLoading ? (
                          Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="h-[92px] rounded-2xl border border-border/60 bg-white/30 animate-pulse" />
                          ))
                        ) : filteredRecipes.length === 0 ? (
                          <div className="col-span-full rounded-3xl border border-border bg-white/30 px-6 py-10 text-center">
                            <p className="text-sm font-bold text-foreground">Tarif bulunamadı</p>
                            <p className="mt-1 text-sm text-muted-foreground">Arama kelimesini değiştirin veya farklı etiket seçin.</p>
                          </div>
                        ) : (
                          filteredRecipes.map((recipe) => (
                            <RecipeMiniCard
                              key={recipe.id}
                              recipe={recipe}
                              dragging={activeDragRecipeId === recipe.id}
                              onPointerDown={handleRecipePointerDown}
                              isSelected={pointerDrag?.recipe.id === recipe.id}
                            />
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Quick add recipe modal */}
      <QuickAddRecipeModal
        open={!!quickAdd}
        recipe={quickAdd?.recipe ?? null}
        mealType={quickAdd?.mealType ?? recipeMealFilter}
        dateStr={quickAdd?.dateStr ?? ''}
        timeValue={quickAddTime}
        noteValue={quickAddNote}
        onChangeTime={setQuickAddTime}
        onChangeNote={setQuickAddNote}
        onClose={closeQuickAdd}
        onConfirm={confirmQuickAdd}
        onOpenFull={openFullFromQuickAdd}
      />

      {/* Global add meal modal (prefilled) */}
      {globalAddModal && (
        <AddMealModal
          planId={globalAddModal.planId}
          planDate={globalAddModal.planDate}
          initialValues={globalAddModal.initialValues}
          onClose={() => setGlobalAddModal(null)}
          onSaved={(item) => {
            handleMealAdded(globalAddModal.planId, item)
            setGlobalAddModal(null)
          }}
        />
      )}

      {/* Pointer-drag overlay (wheel scroll works while dragging) */}
      <AnimatePresence>
        {pointerDrag && (
          <motion.div
            className="fixed left-0 top-0 z-[60] pointer-events-none"
            initial={{ opacity: 0, scale: 0.98, x: pointerDrag.x + 12, y: pointerDrag.y + 12 }}
            animate={{ opacity: pointerDrag.started ? 1 : 0.75, scale: 1, x: pointerDrag.x + 12, y: pointerDrag.y + 12 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.12 }}
          >
            <div className={cn(
              'w-[260px] rounded-2xl border border-border/70 shadow-2xl backdrop-blur-xl',
              'bg-white/75',
              pointerDrag.started ? 'opacity-70' : 'opacity-55',
              'ring-2 ring-primary/20',
            )}>
              <div className="px-3 py-2.5">
                <p className="truncate text-[12px] font-bold text-foreground">{pointerDrag.recipe.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                  {pointerDrag.recipe.caloriesKcal != null && <span>{pointerDrag.recipe.caloriesKcal} kcal</span>}
                  {pointerDrag.recipe.proteinGrams != null && <span>• P {Number(pointerDrag.recipe.proteinGrams).toFixed(0)}g</span>}
                  {pointerDrag.recipe.carbsGrams != null && <span>• K {Number(pointerDrag.recipe.carbsGrams).toFixed(0)}g</span>}
                  {pointerDrag.recipe.fatGrams != null && <span>• Y {Number(pointerDrag.recipe.fatGrams).toFixed(0)}g</span>}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {MEAL_TYPE_CONFIG[recipeMealFilter]?.label ?? 'Öğün'} • bırakınca ekle
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Apply Template Modal ── */}
      {applyTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Şablon Uygula</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-semibold">{applyTemplateModal.template.name}</span>
                  {' '}({applyTemplateModal.template.itemCount} öğün)
                </p>
              </div>
              <button onClick={() => setApplyTemplateModal(null)} className="rounded-xl p-1.5 hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <label className="block text-xs font-semibold text-foreground mb-1.5">Hangi güne uygulansın?</label>
            <input
              type="date"
              value={applyTargetDate}
              onChange={e => { setApplyTargetDate(e.target.value); setApplyError(null) }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />

            {applyError && (
              <p className="mt-2 text-xs text-red-500">{applyError}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setApplyTemplateModal(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                disabled={!applyTargetDate || applyTemplateMutation.isPending}
                onClick={() => applyTemplateMutation.mutate({
                  templateId: applyTemplateModal.template.id,
                  targetDate: applyTargetDate,
                })}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {applyTemplateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutTemplate className="w-4 h-4" />}
                Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save As Template Modal ── */}
      {saveFromPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Şablon Olarak Kaydet</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {saveFromPlanModal.plan.date} — {saveFromPlanModal.plan.meals.length} öğün
                </p>
              </div>
              <button onClick={() => setSaveFromPlanModal(null)} className="rounded-xl p-1.5 hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <label className="block text-xs font-semibold text-foreground mb-1.5">Şablon Adı</label>
            <input
              type="text"
              placeholder="örn. Standart Kahvaltı Seti"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              maxLength={100}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setSaveFromPlanModal(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                disabled={!newTemplateName.trim() || savingTemplate}
                onClick={handleSaveAsTemplate}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutTemplate className="w-4 h-4" />}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  )
}
