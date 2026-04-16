'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, Loader2, Plus, X, CheckCircle2,
  Clock, Send, Eye, EyeOff, Trash2, Users, AlertCircle,
  CalendarDays, Flame, RefreshCw, Copy, BookOpen, ChevronDown, LayoutTemplate,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { getRecipes, type Recipe } from '@/lib/api/recipes'
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

function AddMealModal({
  planId,
  planDate,
  existingItem,
  onClose,
  onSaved,
}: {
  planId: string
  planDate: string
  existingItem?: MealItemData
  onClose: () => void
  onSaved: (item: MealItemData) => void
}) {
  const isTodayPlan = planDate === toDateStr(new Date())
  const minAllowedTime = isTodayPlan ? toCurrentTimeStr() : undefined
  const [form, setForm] = useState<AddMealForm>({
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
    const nextValue = e.target.value
    setForm(f => ({ ...f, [key]: nextValue }))
    if (key === 'calories' || key === 'proteinGrams' || key === 'carbsGrams' || key === 'fatGrams') {
      setNutritionTouched((prev) => ({ ...prev, [key]: true }))
      setAutoFilledFromRecipe(false)
    }
  }

  const applyRecipeNutrition = (recipe: Recipe) => {
    setForm((prev) => ({
      ...prev,
      calories: recipe.caloriesKcal != null ? String(recipe.caloriesKcal) : '',
      proteinGrams: recipe.proteinGrams != null ? String(recipe.proteinGrams) : '',
      carbsGrams: recipe.carbsGrams != null ? String(recipe.carbsGrams) : '',
      fatGrams: recipe.fatGrams != null ? String(recipe.fatGrams) : '',
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
        calories:     data.calories     ? parseInt(data.calories)       : null,
        proteinGrams: data.proteinGrams ? parseFloat(data.proteinGrams) : null,
        carbsGrams:   data.carbsGrams   ? parseFloat(data.carbsGrams)   : null,
        fatGrams:     data.fatGrams     ? parseFloat(data.fatGrams)     : null,
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
    setError(null)
    mutation.mutate(form)
  }

  const cfg = MEAL_TYPE_CONFIG[form.mealType]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md z-10 overflow-hidden">

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
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* Time + MealType */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Saat</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={set('time')}
                  min={minAllowedTime}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
                {minAllowedTime && (
                  <p className="text-[11px] text-amber-400">
                    Bugün için yalnızca {minAllowedTime} ve sonrası seçilebilir.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Öğün Tipi</label>
                <select
                  value={form.mealType}
                  onChange={set('mealType')}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                >
                  {MEAL_TYPES.map(t => (
                    <option key={t} value={t}>{MEAL_TYPE_CONFIG[t].label}</option>
                  ))}
                </select>
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
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
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
                      type="number"
                      min="0"
                      step={key === 'calories' ? '1' : '0.1'}
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
  onEdit,
  onDelete,
  isDeleting,
}: {
  meal: MealItemData
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const cfg = MEAL_TYPE_CONFIG[meal.mealType] ?? MEAL_TYPE_CONFIG.Snack
  return (
    <div
      className="group flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
      style={{
        background: `${cfg.dotHex}18`,
        borderColor: `${cfg.dotHex}40`,
      }}
      onClick={onEdit}
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
    </div>
  )
}

// ── DayColumn ──────────────────────────────────────────────────────────────────

function DayColumn({
  date, isToday, plan, clientId,
  onPlanCreated, onMealAdded, onMealDeleted, onPublishToggle, onPlanDeleted, onPlanCopied,
  onSaveAsTemplate,
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
}) {
  const dateStr = toDateStr(date)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingMeal, setEditingMeal] = useState<MealItemData | null>(null)
  const [localPlan, setLocalPlan] = useState<DailyPlanData | undefined>(undefined)
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyTargetDate, setCopyTargetDate] = useState('')
  const [copyError, setCopyError] = useState<string | null>(null)

  const effectivePlan = plan ?? localPlan
  const isPublished   = effectivePlan?.status === 'Published'
  const meals         = effectivePlan?.meals ?? []
  const totalCal      = meals.reduce((s, m) => s + (m.calories ?? 0), 0)

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
      <div className={cn(
        'flex min-h-[420px] flex-col rounded-[26px] border bg-white/92 shadow-[0_10px_30px_rgba(31,73,46,0.05)] transition-all duration-200',
        isToday && !isPublished ? 'border-primary/25 shadow-[0_16px_36px_rgba(71,185,114,0.10)]' : '',
        isPublished ? 'border-primary/30 bg-[rgba(247,252,248,0.96)]' : 'border-border/80',
        !effectivePlan ? 'bg-white/72' : '',
      )}>
        {/* Day header */}
        <div className={cn(
          'flex items-start justify-between rounded-t-[26px] border-b px-3.5 py-3.5',
          isToday ? 'bg-primary/8 border-primary/15' : 'bg-surface-overlay/70 border-border/60',
          isPublished ? 'bg-primary/10 border-primary/15' : '',
        )}>
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
                onEdit={() => setEditingMeal(meal)}
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
      </div>

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
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
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

export default function PlansPage() {
  const today = useMemo(() => new Date(), [])
  const [weekStart, setWeekStart] = useState(() => getIsoWeekMonday(today))
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [plans, setPlans] = useState<DailyPlanData[]>([])

  // Template panel state
  const [applyTemplateModal, setApplyTemplateModal] = useState<{ template: TemplateSummary } | null>(null)
  const [applyTargetDate, setApplyTargetDate] = useState('')
  const [applyError, setApplyError] = useState<string | null>(null)
  const [saveFromPlanModal, setSaveFromPlanModal] = useState<{ plan: DailyPlanData } | null>(null)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

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

  const handleMealDeleted = useCallback((planId: string, mealId: string) => {
    setPlans(prev => prev.map(p =>
      p.id === planId ? { ...p, meals: p.meals.filter(m => m.id !== mealId) } : p
    ))
  }, [])

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
        className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]"
        variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.16, 1, 0.3, 1] } } }}
      >

        {/* ── Left column: Clients + Templates ── */}
        <div className="space-y-4">

          {/* Client Sidebar */}
          <div className="card-sfcos sticky top-4 overflow-hidden p-0">
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
          <div className="card-sfcos overflow-hidden p-0">
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

        </div>

        {/* ── Week content ── */}
        <div className="space-y-4">

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
            </>
          )}
        </div>
      </motion.div>

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
