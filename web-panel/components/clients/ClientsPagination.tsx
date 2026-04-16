'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ClientsPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function ClientsPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: ClientsPaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  const canGoPrev = page > 1
  const canGoNext = page < totalPages

  return (
    <div className="card-sfcos flex flex-col items-center justify-between gap-4 border-none p-4 sm:flex-row">
      <div className="text-sm text-muted-foreground">
        {total > 0 ? (
          <>
            <span className="font-medium">{startItem}</span>
            {' - '}
            <span className="font-medium">{endItem}</span>
            {' / '}
            <span className="font-medium">{total}</span>
            {' danışan gösteriliyor'}
          </>
        ) : (
          'Danışan bulunamadı'
        )}
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sayfa başına:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-10 rounded-full border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            data-testid="clients-prev"
            variant="secondary"
            onClick={() => onPageChange(page - 1)}
            disabled={!canGoPrev}
            className="px-4"
          >
            <ChevronLeft className="h-4 w-4" />
            Önceki
          </Button>

          <span className="px-2 text-sm text-muted-foreground">
            Sayfa {page} / {totalPages || 1}
          </span>

          <Button
            data-testid="clients-next"
            variant="secondary"
            onClick={() => onPageChange(page + 1)}
            disabled={!canGoNext}
            className="px-4"
          >
            Sonraki
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
