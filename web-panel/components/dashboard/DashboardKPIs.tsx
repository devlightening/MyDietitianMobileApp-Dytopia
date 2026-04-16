'use client'

import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from '@/lib/api/plans'
import { Card } from '@/components/ui/Card'
import { Users, TrendingUp, AlertCircle, Clock } from 'lucide-react'

export function DashboardKPIs() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    refetchInterval: 60000 // Refresh every minute
  })

  const kpis = [
    {
      title: 'Aktif Premium Danışanlar',
      value: data?.activePremiumClients ?? 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Ortalama Uyum',
      value: `${data?.averageCompliance ?? 0}%`,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Yakında Sona Erecek',
      value: data?.expiringSoon ?? 0,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100'
    },
    {
      title: 'Risk Altında',
      value: data?.atRisk ?? 0,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    }
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-12 w-12 bg-muted rounded-lg mb-4" />
            <div className="h-4 w-24 bg-muted rounded mb-2" />
            <div className="h-8 w-16 bg-muted rounded" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <Card key={index} className="p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{kpi.title}</p>
                <p className="text-3xl font-bold">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${kpi.bgColor}`}>
                <Icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
