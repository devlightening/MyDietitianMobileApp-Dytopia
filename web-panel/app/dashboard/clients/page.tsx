"use client"

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { getClients, ClientsQueryParams } from '@/lib/api/clients'
import { ClientsFilters } from '@/components/clients/ClientsFilters'
import { ClientsTable } from '@/components/clients/ClientsTable'
import { ClientsPagination } from '@/components/clients/ClientsPagination'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AccessKeyModal } from '@/components/access-keys/AccessKeyModal'

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function ClientsPage() {
  // Filter state
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'premium' | 'free'>('all')
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [lowCompliance, setLowCompliance] = useState(false)

  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>()

  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(search, 400)

  // Build query params
  const queryParams: ClientsQueryParams = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: status === 'all' ? undefined : status,
    expiringSoon: expiringSoon || undefined,
    lowCompliance: lowCompliance || undefined,
    sortBy: 'lastActivity',
    sortDir: 'desc'
  }

  // Fetch clients
  const { data, isLoading, error } = useQuery({
    queryKey: ['clients', queryParams],
    queryFn: () => getClients(queryParams),
    keepPreviousData: true
  })

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, expiringSoon, lowCompliance])

  // Check if any filters are active
  const hasActiveFilters = search !== '' || status !== 'all' || expiringSoon || lowCompliance

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearch('')
    setStatus('all')
    setExpiringSoon(false)
    setLowCompliance(false)
  }, [])

  // Handle generate key action
  const handleGenerateKey = useCallback((clientId: string) => {
    setSelectedClientId(clientId)
    setIsModalOpen(true)
  }, [])

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1) // Reset to first page
  }, [])

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-sage">Danışanlarım</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Danışanlarınızı yönetin, uyum durumlarını takip edin ve premium erişim anahtarları oluşturun.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedClientId(undefined)
            setIsModalOpen(true)
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-action text-action-foreground hover:opacity-90 active:scale-95 transition-all duration-150 shadow-md hover:shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Anahtar Oluştur
        </button>
      </div>

      {/* Filters */}
      <ClientsFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        expiringSoon={expiringSoon}
        onExpiringSoonChange={setExpiringSoon}
        lowCompliance={lowCompliance}
        onLowComplianceChange={setLowCompliance}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Error State */}
      {error && (
        <Card className="p-12 text-center">
          <p className="text-destructive mb-4">
            Danışanlar yüklenirken bir hata oluştu.
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Tekrar Dene
          </Button>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && data && data.items.length === 0 && (
        <div className="card-premium p-14 text-center" data-testid="clients-empty">
          <div className="w-20 h-20 rounded-2xl kpi-sage flex items-center justify-center mx-auto mb-5">
            <Users className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {hasActiveFilters ? 'Danışan Bulunamadı' : 'Henüz Danışanınız Yok'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Arama kriterlerinize uygun danışan bulunamadı. Filtreleri temizleyerek tekrar deneyin.'
              : 'İlk erişim anahtarını oluşturduğunuzda, danışanlarınız burada görünecek.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={handleClearFilters}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              Filtreleri Temizle
            </button>
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action text-action-foreground text-sm font-semibold hover:opacity-90 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              İlk Anahtarı Oluştur
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!error && (data?.items.length ?? 0) > 0 && (
        <div className="space-y-4">
          <ClientsTable
            clients={data?.items ?? []}
            isLoading={isLoading}
            onGenerateKey={handleGenerateKey}
          />

          {/* Pagination */}
          <ClientsPagination
            page={page}
            pageSize={pageSize}
            total={data?.total ?? 0}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}

      {/* Loading State (show table skeleton) */}
      {isLoading && !data && (
        <ClientsTable
          clients={[]}
          isLoading={true}
          onGenerateKey={() => { }}
        />
      )}

      {/* Access Key Modal */}
      <AccessKeyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedClientId(undefined)
        }}
        mode="generate"
        initialClientId={selectedClientId}
      />
    </div>
  )
}
