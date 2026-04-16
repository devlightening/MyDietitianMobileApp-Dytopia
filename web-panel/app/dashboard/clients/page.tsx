'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Key, Sparkles } from 'lucide-react'
import { motion, type Variants } from 'motion/react'
import { getClients, ClientsQueryParams } from '@/lib/api/clients'
import { ClientsFilters } from '@/components/clients/ClientsFilters'
import { ClientsTable } from '@/components/clients/ClientsTable'
import { ClientsPagination } from '@/components/clients/ClientsPagination'
import { AccessKeyModal } from '@/components/access-keys/AccessKeyModal'

const fadeRise: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] } },
}

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

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
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'premium' | 'free'>('all')
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [lowCompliance, setLowCompliance] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>()

  const debouncedSearch = useDebounce(search, 400)

  const queryParams: ClientsQueryParams = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: status === 'all' ? undefined : status,
    expiringSoon: expiringSoon || undefined,
    lowCompliance: lowCompliance || undefined,
    sortBy: 'lastActivity',
    sortDir: 'desc',
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['clients', queryParams],
    queryFn: () => getClients(queryParams),
    keepPreviousData: true,
  })

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, expiringSoon, lowCompliance])

  const hasActiveFilters = search !== '' || status !== 'all' || expiringSoon || lowCompliance

  const handleClearFilters = useCallback(() => {
    setSearch('')
    setStatus('all')
    setExpiringSoon(false)
    setLowCompliance(false)
  }, [])

  const handleGenerateKey = useCallback((clientId: string) => {
    setSelectedClientId(clientId)
    setIsModalOpen(true)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
  }, [])

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={stagger}>
      <motion.section variants={fadeRise} className="card-premium p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-glass)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
              <Sparkles className="h-3.5 w-3.5" />
              Danışan yönetimi
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
              Danışan listesi
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Danışanları arayabilir, premium durumunu izleyebilir ve gerektiğinde erişim
              anahtarı oluşturabilirsiniz. Güncel durumlar bu ekranda toplu olarak görünür.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-border/70 bg-[var(--surface-glass)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Toplam danışan</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{data?.total ?? 0}</p>
            </div>

            <button
              onClick={() => {
                setSelectedClientId(undefined)
                setIsModalOpen(true)
              }}
              className="btn-primary shrink-0"
            >
              <Key className="h-4 w-4" />
              Anahtar oluştur
            </button>
          </div>
        </div>
      </motion.section>

      <motion.div variants={fadeRise}>
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
      </motion.div>

      {error && (
        <motion.div variants={fadeRise}>
          <div className="card-sfcos p-12 text-center">
            <p className="mb-4 font-medium text-rose-500">Danışanlar yüklenirken bir hata oluştu.</p>
            <button className="btn-ghost" onClick={() => window.location.reload()}>
              Tekrar dene
            </button>
          </div>
        </motion.div>
      )}

      {!isLoading && !error && data && data.items.length === 0 && (
        <motion.div variants={fadeRise}>
          <div
            className="rounded-[28px] p-14 text-center"
            data-testid="clients-empty"
            style={{
              background: 'linear-gradient(145deg, var(--surface-raised), var(--surface-overlay))',
              border: '1px dashed var(--border-emerald-dim)',
            }}
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {hasActiveFilters ? 'Danışan bulunamadı' : 'Henüz danışanınız yok'}
            </h3>
            <p className="mx-auto mt-2 mb-6 max-w-sm text-sm text-muted-foreground">
              {hasActiveFilters
                ? 'Arama kriterlerinize uygun danışan bulunamadı. Filtreleri temizleyerek tekrar deneyin.'
                : 'İlk erişim anahtarı oluşturulduğunda bağlı danışanlarınız bu alanda listelenecek.'}
            </p>
            {hasActiveFilters ? (
              <button className="btn-ghost" onClick={handleClearFilters}>
                Filtreleri temizle
              </button>
            ) : (
              <button className="btn-primary mx-auto" onClick={() => setIsModalOpen(true)}>
                <Key className="h-4 w-4" />
                İlk anahtarı oluştur
              </button>
            )}
          </div>
        </motion.div>
      )}

      {!error && (data?.items.length ?? 0) > 0 && (
        <motion.div variants={fadeRise} className="space-y-4">
          <ClientsTable
            clients={data?.items ?? []}
            isLoading={isLoading}
            onGenerateKey={handleGenerateKey}
          />
          <ClientsPagination
            page={page}
            pageSize={pageSize}
            total={data?.total ?? 0}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </motion.div>
      )}

      {isLoading && !data && (
        <motion.div variants={fadeRise}>
          <ClientsTable clients={[]} isLoading={true} onGenerateKey={() => {}} />
        </motion.div>
      )}

      <AccessKeyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedClientId(undefined)
        }}
        mode="generate"
        initialClientId={selectedClientId}
      />
    </motion.div>
  )
}
