'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Search, Loader2, CheckCircle2, AlertCircle, ChefHat, X, Sparkles, ShoppingBasket, Users } from 'lucide-react'
import { motion, type Variants } from 'motion/react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const fadeRise: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] } },
}
const stagger: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

interface RecipeMatch {
  recipeId: string
  recipeName: string
  score: number           // API uses 'score'
  missingIngredients: { id: string; name: string }[] // API returns objects
  substitutes?: string[]
  isPublic: boolean
  explanation?: string
}

interface Client {
  clientId: string
  fullName: string
  email?: string
}

interface BasketItem {
  id: string
  name: string
}

export default function RecipeMatchPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [basketIngredients, setBasketIngredients] = useState<BasketItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // FIX: use api interceptor (adds JWT header)
  const { data: clientsData } = useQuery({
    queryKey: ['dietitian-clients'],
    queryFn: async () => {
      const res = await api.get('/api/dietitian/clients', { params: { page: 1, pageSize: 100 } })
      return res.data
    }
  })
  const clients: Client[] = clientsData?.items ?? []

  // FIX: use api interceptor and map canonicalName
  const { data: ingredientsData, isLoading: searchingIngredients } = useQuery({
    queryKey: ['ingredients-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return { items: [] }
      const res = await api.get(`/api/ingredients/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
      const raw = res.data?.ingredients ?? res.data?.items ?? []
      return { items: raw }
    },
    enabled: searchQuery.length >= 2
  })

  const matchMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/dietitian/recipes/match', {
        clientId: selectedClientId || null,
        basketIngredientIds: basketIngredients.map(i => i.id)
      })
      return res.data
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.message || '';
      if (msg.includes('401')) toast.error('Oturum süreniz dolmuş, lütfen tekrar giriş yapın');
      else if (msg.includes('503')) toast.error('Sistem şu an yoğun, lütfen birazdan tekrar deneyin');
      else toast.error('Tarif eşleştirme sırasında bir sorun oluştu. Lütfen malzemeleri kontrol edip tekrar deneyin.');
    }
  })

  const addIngredient = (ingredient: { id: string; canonicalName: string }) => {
    if (!basketIngredients.find(i => i.id === ingredient.id)) {
      setBasketIngredients([...basketIngredients, { id: ingredient.id, name: ingredient.canonicalName }])
      setSearchQuery('')
    }
  }

  const removeIngredient = (id: string) => {
    setBasketIngredients(basketIngredients.filter(i => i.id !== id))
  }

  const matches: RecipeMatch[] = matchMutation.data?.matches ?? []

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={stagger}>
      {/* Header */}
      <motion.div variants={fadeRise}>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'hsl(var(--foreground))' }}>
          Tarif Eşleştirici
        </h1>
        <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Danışanın mutfağındaki malzemelere göre en uygun tarifleri keşfedin
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left Panel: Controls ──────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Client Selector */}
          <div className="card-premium p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg kpi-sage flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Danışan Seç</h2>
            </div>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="input-sfcos"
              style={{ color: !selectedClientId ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))' }}
            >
              <option value="">— Genel eşleştirme (opsiyonel) —</option>
              {clients.map((c) => (
                <option key={c.clientId} value={c.clientId}>{c.fullName}</option>
              ))}
            </select>
          </div>

          {/* Ingredient Basket */}
          <div className="card-premium p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg kpi-forest flex items-center justify-center">
                <ShoppingBasket className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Malzeme Sepeti</h2>
              {basketIngredients.length > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-action/10 text-action">
                  {basketIngredients.length} malzeme
                </span>
              )}
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Malzeme ara..."
                className="input-sfcos pl-9"
              />
            </div>

            {/* Search Results Dropdown */}
            {searchQuery.length >= 2 && (
              <div className="mb-3 max-h-44 overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                {searchingIngredients ? (
                  <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Aranıyor...
                  </div>
                ) : (ingredientsData?.items?.length ?? 0) > 0 ? (
                  ingredientsData!.items.map((ingredient: any) => (
                    <button
                      key={ingredient.id}
                      onClick={() => addIngredient({ id: ingredient.id, canonicalName: ingredient.canonicalName ?? ingredient.name })}
                      className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted/60 transition-colors border-b border-border/50 last:border-0"
                    >
                      {ingredient.canonicalName ?? ingredient.name}
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">Malzeme bulunamadı</div>
                )}
              </div>
            )}

            {/* Popular Suggestions */}
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 mb-2 px-1">
                Sık Kullanılanlar
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Yumurta', 'Yoğurt', 'Tavuk Göğsü', 'Domates', 'Yulaf', 'Zeytinyağı', 'Elma'].map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setSearchQuery(name);
                      // The search query will trigger the query, and user can click the result.
                      // Alternatively, we could automatically pick the first result if we wanted "magic".
                    }}
                    className="px-2.5 py-1 rounded-md bg-muted/50 hover:bg-action/10 hover:text-action text-[11px] font-medium transition-colors border border-border/50"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Basket Items */}
            {basketIngredients.length === 0 ? (
              <div className="py-6 text-center bg-muted/20 rounded-xl border border-dashed border-border/50">
                <ShoppingBasket className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Malzeme arayın veya yukarıdaki <br /> önerilere tıklayın
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {basketIngredients.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium badge-premium"
                  >
                    {item.name}
                    <button
                      onClick={() => removeIngredient(item.id)}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Match Button */}
            <button
              onClick={() => matchMutation.mutate()}
              disabled={basketIngredients.length === 0 || matchMutation.isPending}
              className={cn(
                'w-full mt-4 btn-primary justify-center',
                (basketIngredients.length === 0 || matchMutation.isPending) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {matchMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Eşleştiriliyor...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Tarif Bul</>
              )}
            </button>
          </div>
        </div>

        {/* ── Right Panel: Results ──────────────────────── */}
        <div className="lg:col-span-3">
          {!matchMutation.data && !matchMutation.isPending && !matchMutation.isError ? (
            /* Empty state before search */
            <div className="card-premium p-16 text-center h-full flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-2xl kpi-forest flex items-center justify-center mx-auto mb-5">
                <ChefHat className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Tarif Asistanı</h3>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Soldaki sepete malzeme ekleyin, ardından &quot;Tarif Bul&quot; butonuna basın.
                Sistem danışanın profiline göre en uygun tarifleri sıralar.
              </p>
            </div>
          ) : matchMutation.isPending ? (
            <div className="card-premium p-16 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">En uygun tarifler analiz ediliyor...</p>
            </div>
          ) : matchMutation.isError ? (
            <div className="card-premium p-10 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive/50" />
              <h3 className="text-base font-semibold text-foreground mb-1">Bir şeyler ters gitti</h3>
              <p className="text-sm text-muted-foreground">Eşleştirme motoruna şu an ulaşılamıyor. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.</p>
              <button className="btn-ghost mt-4" onClick={() => matchMutation.mutate()}>
                Yeniden Dene
              </button>
            </div>
          ) : matches.length === 0 ? (
            <div className="card-premium p-14 text-center">
              <ChefHat className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
              <h3 className="text-base font-semibold text-foreground mb-1">Uygun tarif bulunamadı</h3>
              <p className="text-sm text-muted-foreground">Sepete farklı malzeme ekleyerek tekrar deneyin.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">{matches.length} Tarif Bulundu</h2>
                <span className="text-xs text-muted-foreground">Uyum skoruna göre sıralı</span>
              </div>
              {matches.map((match) => (
                <div key={match.recipeId} className="card-premium p-5 interactive-card">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-foreground truncate">{match.recipeName}</h3>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          match.isPublic ? 'badge-free' : 'badge-premium'
                        )}>
                          {match.isPublic ? 'Genel' : 'Özel'}
                        </span>
                      </div>
                      {match.explanation && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{match.explanation}</p>
                      )}
                    </div>
                    {/* Match Score */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={cn(
                        'w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold',
                        match.score >= 80 ? 'kpi-forest' :
                        match.score >= 50 ? 'kpi-sage' : 'kpi-coral'
                      )}>
                        {match.score}%
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">uyum</span>
                    </div>
                  </div>

                  {match.score === 100 && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-action mb-3">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Tüm malzemeler mevcut
                    </div>
                  )}

                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Eksik: </span>
                      {match.missingIngredients.map(i => i.name).join(', ')}
                    </div>

                  {match.substitutes?.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">Alternatif: </span>
                      {match.substitutes.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
