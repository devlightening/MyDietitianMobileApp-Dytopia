'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface ClientsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: 'all' | 'premium' | 'free'
  onStatusChange: (value: 'all' | 'premium' | 'free') => void
  expiringSoon: boolean
  onExpiringSoonChange: (value: boolean) => void
  lowCompliance: boolean
  onLowComplianceChange: (value: boolean) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function ClientsFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  expiringSoon,
  onExpiringSoonChange,
  lowCompliance,
  onLowComplianceChange,
  onClearFilters,
  hasActiveFilters,
}: ClientsFiltersProps) {
  return (
    <div className="card-sfcos space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="clients-search"
            type="text"
            placeholder="Danışan adı veya e-posta ile ara..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-12 rounded-full pl-11"
          />
        </div>

        <div className="flex flex-wrap gap-2 rounded-full bg-surface-overlay p-1.5">
          <Button
            variant={status === 'all' ? 'primary' : 'secondary'}
            onClick={() => onStatusChange('all')}
            className="h-10 rounded-full px-5"
          >
            Tümü
          </Button>
          <Button
            variant={status === 'premium' ? 'primary' : 'secondary'}
            onClick={() => onStatusChange('premium')}
            className="h-10 rounded-full px-5"
          >
            Premium
          </Button>
          <Button
            variant={status === 'free' ? 'primary' : 'secondary'}
            onClick={() => onStatusChange('free')}
            className="h-10 rounded-full px-5"
          >
            Ücretsiz
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Hızlı filtreler:</span>

        <button
          type="button"
          className="cursor-pointer"
          onClick={() => onExpiringSoonChange(!expiringSoon)}
        >
          <Badge
            variant={expiringSoon ? 'primary' : 'secondary'}
            className="pointer-events-none transition hover:opacity-80"
          >
            {expiringSoon ? 'Seçili • ' : ''}Yakında sona erecek (7 gün)
          </Badge>
        </button>

        <button
          type="button"
          className="cursor-pointer"
          onClick={() => onLowComplianceChange(!lowCompliance)}
        >
          <Badge
            variant={lowCompliance ? 'primary' : 'secondary'}
            className="pointer-events-none transition hover:opacity-80"
          >
            {lowCompliance ? 'Seçili • ' : ''}Düşük uyum (&lt;60%)
          </Badge>
        </button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={onClearFilters}
            className="ml-2"
          >
            <X className="mr-1 h-4 w-4" />
            Filtreleri temizle
          </Button>
        )}
      </div>
    </div>
  )
}
