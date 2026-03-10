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
  hasActiveFilters
}: ClientsFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Search and Status Filter Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="clients-search"
            type="text"
            placeholder="Danışan adı veya e-posta ile ara..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          <Button
            variant={status === 'all' ? 'primary' : 'secondary'}
            onClick={() => onStatusChange('all')}
          >
            Tümü
          </Button>
          <Button
            variant={status === 'premium' ? 'primary' : 'secondary'}
            onClick={() => onStatusChange('premium')}
          >
            Premium
          </Button>
          <Button
            variant={status === 'free' ? 'primary' : 'secondary'}
            onClick={() => onStatusChange('free')}
          >
            Ücretsiz
          </Button>
        </div>
      </div>

      {/* Quick Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Hızlı Filtreler:</span>

        <button
          type="button"
          className="cursor-pointer"
          onClick={() => onExpiringSoonChange(!expiringSoon)}
        >
          <Badge
            variant={expiringSoon ? 'primary' : 'secondary'}
            className="hover:opacity-80 transition pointer-events-none"
          >
            {expiringSoon && '✓ '}Yakında Sona Erecek (7 gün)
          </Badge>
        </button>

        <button
          type="button"
          className="cursor-pointer"
          onClick={() => onLowComplianceChange(!lowCompliance)}
        >
          <Badge
            variant={lowCompliance ? 'primary' : 'secondary'}
            className="hover:opacity-80 transition pointer-events-none"
          >
            {lowCompliance && '✓ '}Düşük Uyum (&lt;60%)
          </Badge>
        </button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={onClearFilters}
            className="ml-2"
          >
            <X className="w-4 h-4 mr-1" />
            Filtreleri Temizle
          </Button>
        )}
      </div>
    </div>
  )
}
