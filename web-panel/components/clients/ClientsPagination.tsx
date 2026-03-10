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
  onPageSizeChange
}: ClientsPaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  const canGoPrev = page > 1
  const canGoNext = page < totalPages

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
      {/* Results Count */}
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

      {/* Pagination Controls */}
      <div className="flex items-center gap-4">
        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sayfa başına:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border rounded-md bg-background"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center gap-2">
          <Button
            data-testid="clients-prev"
            variant="secondary"
            onClick={() => onPageChange(page - 1)}
            disabled={!canGoPrev}
          >
            <ChevronLeft className="w-4 h-4" />
            Önceki
          </Button>

          <span className="text-sm text-muted-foreground px-2">
            Sayfa {page} / {totalPages || 1}
          </span>

          <Button
            data-testid="clients-next"
            variant="secondary"
            onClick={() => onPageChange(page + 1)}
            disabled={!canGoNext}
          >
            Sonraki
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
