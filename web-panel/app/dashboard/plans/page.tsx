'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronRight, Loader2, UtensilsCrossed, Calendar, Lock, Globe } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface ClientRow {
  clientId: string
  fullName: string
  hasActivePlan?: boolean
}

interface Plan {
  id: string
  name: string
  description?: string
  startDate?: string
  endDate?: string
  isActive?: boolean
  mealCount?: number
  completedMeals?: number
  isPublic?: boolean
}

function PlanCard({ plan }: { plan: Plan }) {
  const start = plan.startDate ? new Date(plan.startDate).toLocaleDateString('tr-TR') : null
  const end = plan.endDate ? new Date(plan.endDate).toLocaleDateString('tr-TR') : null
  const completed = plan.completedMeals ?? 0
  const total = plan.mealCount ?? 0
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="p-4 rounded-xl border border-border bg-muted/10 hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-foreground truncate">{plan.name}</p>
            {plan.isPublic !== undefined && (
              plan.isPublic
                ? <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                : <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          {plan.description && (
            <p className="text-xs text-muted-foreground truncate">{plan.description}</p>
          )}
        </div>
        <span className={cn(
          'text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0',
          plan.isActive ? 'badge-premium' : 'badge-inactive'
        )}>
          {plan.isActive ? 'Aktif' : 'Pasif'}
        </span>
      </div>

      {/* Date range */}
      {(start || end) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <Calendar className="w-3 h-3" />
          <span>{start ?? '—'}{end ? ` → ${end}` : ''}</span>
        </div>
      )}

      {/* Meal progress bar */}
      {total > 0 && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Öğün Tamamlama</span>
            <span className="font-medium text-foreground">{completed}/{total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-action transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlansPage() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients-for-plans'],
    queryFn: async () => {
      const res = await api.get('/api/dietitian/clients', { params: { page: 1, pageSize: 50 } })
      return res.data as { items: ClientRow[]; total: number }
    },
  })
  const clients = clientsData?.items ?? []
  const selectedClient = clients.find(c => c.clientId === selectedClientId)

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['plans', selectedClientId],
    queryFn: async () => {
      const res = await api.get(`/api/dietitian/plans/clients/${selectedClientId}`)
      return res.data as { items: Plan[] }
    },
    enabled: !!selectedClientId,
  })
  const plans = plansData?.items ?? []

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-sage">Beslenme Planları</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Danışanlarınız için oluşturulan öğün planlarını görüntüleyin
          </p>
        </div>
        {selectedClientId && (
          <Link
            href={`/dashboard/diet-plans/create?clientId=${selectedClientId}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <UtensilsCrossed className="w-4 h-4" />
            Plan Oluştur
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Client List ────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="card-premium p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
              Danışan Seçin
            </h2>

            {clientsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...
              </div>
            ) : clients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">
                Henüz danışanınız yok.
              </p>
            ) : (
              <ul className="space-y-1 max-h-[480px] overflow-y-auto -mx-1 px-1">
                {clients.map(client => (
                  <li key={client.clientId}>
                    <button
                      onClick={() => setSelectedClientId(client.clientId)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors',
                        selectedClientId === client.clientId
                          ? 'bg-action text-action-foreground'
                          : 'hover:bg-muted/60 text-foreground'
                      )}
                    >
                      <span className="truncate">{client.fullName}</span>
                      <ChevronRight className={cn(
                        'w-4 h-4 flex-shrink-0 opacity-50',
                        selectedClientId === client.clientId && 'opacity-100'
                      )} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Plans Panel ────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="card-premium p-5 min-h-[400px] flex flex-col">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              {selectedClient ? `${selectedClient.fullName} — Planlar` : 'Plan Listesi'}
            </h2>

            {!selectedClientId ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl kpi-forest flex items-center justify-center mx-auto mb-4">
                  <CalendarDays className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Danışan Seçin</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Planları görmek için soldaki listeden bir danışan seçin.
                </p>
              </div>
            ) : plansLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Planlar yükleniyor...</span>
              </div>
            ) : plans.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl kpi-oat flex items-center justify-center mx-auto mb-4">
                  <CalendarDays className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Plan Bulunamadı</p>
                <p className="text-xs text-muted-foreground">
                  {selectedClient?.fullName} için henüz oluşturulmuş plan yok.
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto">
                {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
