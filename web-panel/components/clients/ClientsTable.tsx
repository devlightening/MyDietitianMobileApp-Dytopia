'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { MoreVertical, Eye, Key, Ban, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ClientRow } from '@/lib/api/clients'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

interface ClientsTableProps {
  clients: ClientRow[]
  isLoading: boolean
  onGenerateKey: (publicUserId: string) => void
}

interface MenuState {
  clientId: string
  top: number
  left: number
}

function getPremiumEndState(client: ClientRow): 'none' | 'active' | 'expired' {
  if (!client.premiumEndDate) return 'none'
  if (!client.isPremium) return 'expired'

  const endTime = new Date(client.premiumEndDate).getTime()
  return Number.isFinite(endTime) && endTime <= Date.now() ? 'expired' : 'active'
}

function getPremiumEndLabel(client: ClientRow): { text: string; tone: string } | null {
  const state = getPremiumEndState(client)
  if (state === 'none') return null

  if (state === 'expired') {
    return { text: 'Süresi bitti', tone: 'text-red-600' }
  }

  if (typeof client.daysRemaining !== 'number') return null

  if (client.daysRemaining <= 0) {
    return { text: 'Bugün sona eriyor', tone: 'text-red-600' }
  }

  if (client.daysRemaining <= 7) {
    return { text: `${client.daysRemaining} gün kaldı`, tone: 'text-red-600' }
  }

  if (client.daysRemaining <= 30) {
    return { text: `${client.daysRemaining} gün kaldı`, tone: 'text-amber-600' }
  }

  return { text: `${client.daysRemaining} gün kaldı`, tone: 'text-green-600' }
}

export function ClientsTable({ clients, isLoading, onGenerateKey }: ClientsTableProps) {
  const router = useRouter()
  const [menuState, setMenuState] = useState<MenuState | null>(null)
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const openMenuId = menuState?.clientId ?? null

  const closeMenu = () => setMenuState(null)

  const openMenuFor = (clientId: string) => {
    if (openMenuId === clientId) {
      closeMenu()
      return
    }

    const trigger = triggerRefs.current[clientId]
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const menuWidth = 248
    const estimatedHeight = 216
    const viewportPadding = 16
    const canOpenDown = rect.bottom + estimatedHeight <= window.innerHeight - viewportPadding
    const top = canOpenDown
      ? rect.bottom + 10
      : Math.max(viewportPadding, rect.top - estimatedHeight - 10)
    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding,
    )

    setMenuState({ clientId, top, left })
  }

  useEffect(() => {
    if (!menuState) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    const handleViewportChange = () => {
      closeMenu()
    }

    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [menuState])

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Danışan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Uyum %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Premium bitiş
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Son aktivite
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Bağlantı tarihi
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {[...Array(5)].map((_, index) => (
                <tr key={index}>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="mt-1 h-3 w-32" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-6 w-20" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-6 w-16" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden" data-testid="clients-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Danışan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Uyum %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Premium bitiş
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Son aktivite
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Bağlantı tarihi
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {clients.map((client, index) => {
              const premiumEndState = getPremiumEndState(client)
              const premiumEndLabel = getPremiumEndLabel(client)

              return (
              <tr
                key={`${client.clientId}-${client.linkedAt || index}`}
                data-testid={`client-row-${client.clientId}`}
                className="cursor-pointer transition hover:bg-muted/30"
                onClick={() => router.push(`/dashboard/clients/${client.clientId}`)}
              >
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{client.fullName}</span>
                    <span className="text-sm text-muted-foreground">{client.email}</span>
                  </div>
                </td>

                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    {client.isPremium ? (
                      <Badge variant="primary">Premium</Badge>
                    ) : premiumEndState === 'expired' ? (
                      <Badge variant="danger">Süresi bitti</Badge>
                    ) : (
                      <Badge variant="secondary">Ücretsiz</Badge>
                    )}
                    {client.hasActivePlan && (
                      <Badge variant="secondary" className="border-green-600 text-xs text-green-600">
                        Plan aktif
                      </Badge>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4">
                  {client.isPremium && premiumEndState === 'active' ? (
                    <Badge
                      variant={
                        client.compliancePercent >= 80
                          ? 'primary'
                          : client.compliancePercent >= 60
                            ? 'secondary'
                            : 'danger'
                      }
                    >
                      {client.compliancePercent}%
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                <td className="px-6 py-4">
                  {client.premiumEndDate ? (
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">
                        {new Date(client.premiumEndDate).toLocaleDateString('tr-TR')}
                      </span>
                      {premiumEndLabel && (
                        <span className={`text-xs font-medium ${premiumEndLabel.tone}`}>
                          {premiumEndLabel.text}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                <td className="px-6 py-4">
                  {client.lastActivityAt ? (
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(client.lastActivityAt), {
                        addSuffix: true,
                        locale: tr,
                      })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(client.linkedAt).toLocaleDateString('tr-TR')}
                  </span>
                </td>

                <td className="px-6 py-4" onClick={(event) => event.stopPropagation()}>
                  <div className="flex justify-end">
                    <button
                      ref={(node) => {
                        triggerRefs.current[client.clientId] = node
                      }}
                      onClick={() => openMenuFor(client.clientId)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition hover:border-border/80 hover:bg-muted/60"
                      aria-label="İşlemler"
                      aria-expanded={openMenuId === client.clientId}
                    >
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {typeof document !== 'undefined' && menuState && createPortal(
        <>
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="fixed inset-0 z-[60] cursor-default bg-transparent"
            onClick={closeMenu}
          />

          <div
            className="fixed z-[70] w-[248px] overflow-hidden rounded-2xl border border-border/80 bg-background/95 p-2 shadow-2xl backdrop-blur-xl"
            style={{
              top: `${menuState.top}px`,
              left: `${menuState.left}px`,
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
            }}
          >
            <div className="px-3 pb-2 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Hızlı işlemler
              </p>
            </div>

            <button
              onClick={() => {
                router.push(`/dashboard/clients/${menuState.clientId}`)
                closeMenu()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted/70"
            >
              <Eye className="h-4 w-4 text-primary" />
              Danışan kartını aç
            </button>

            <button
              onClick={() => {
                router.push(`/dashboard/clients/${menuState.clientId}?tab=notes`)
                closeMenu()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted/70"
            >
              <MessageSquare className="h-4 w-4 text-primary" />
              İletişim merkezine git
            </button>

            <button
              onClick={() => {
                const selectedClient = clients.find((item) => item.clientId === menuState.clientId)
                if (!selectedClient) return
                onGenerateKey(selectedClient.publicUserId)
                closeMenu()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted/70"
            >
              <Key className="h-4 w-4 text-primary" />
              Premium anahtarı oluştur / uzat
            </button>

            <div className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground opacity-80">
              <Ban className="h-4 w-4" />
              <span>İptal et</span>
              <span className="ml-auto rounded-full border border-border/80 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
                Yakında
              </span>
            </div>
          </div>
        </>,
        document.body,
      )}
    </Card>
  )
}
