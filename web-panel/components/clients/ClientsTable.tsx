'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Eye, Key, Ban } from 'lucide-react'
import { ClientRow } from '@/lib/api/clients'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface ClientsTableProps {
  clients: ClientRow[]
  isLoading: boolean
  onGenerateKey: (publicUserId: string) => void
}

export function ClientsTable({ clients, isLoading, onGenerateKey }: ClientsTableProps) {
  const router = useRouter()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Danışan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Uyum %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Premium Bitiş
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Son Aktivite
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Bağlantı Tarihi
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32 mt-1" />
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
                    <Skeleton className="h-8 w-8 rounded" />
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
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Danışan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Uyum %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Premium Bitiş
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Son Aktivite
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Bağlantı Tarihi
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-background divide-y divide-border">
            {clients.map((client, index) => (
              <tr
                key={`${client.clientId}-${client.linkedAt || index}`}
                data-testid={`client-row-${client.clientId}`}
                className="hover:bg-muted/30 transition cursor-pointer"
                onClick={() => router.push(`/dashboard/clients/${client.clientId}`)}
              >
                {/* Name + Email */}
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{client.fullName}</span>
                    <span className="text-sm text-muted-foreground">{client.email}</span>
                  </div>
                </td>

                {/* Status Badge */}
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    {client.isPremium ? (
                      <Badge variant="primary">Premium</Badge>
                    ) : (
                      <Badge variant="secondary">Ücretsiz</Badge>
                    )}
                    {client.hasActivePlan && (
                      <Badge variant="secondary" className="text-xs text-green-600 border-green-600">
                        📋 Aktif Plan
                      </Badge>
                    )}
                  </div>
                </td>

                {/* Compliance % */}
                <td className="px-6 py-4">
                  {client.isPremium ? (
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

                {/* Premium End Date + Days Remaining */}
                <td className="px-6 py-4">
                  {client.premiumEndDate ? (
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">
                        {new Date(client.premiumEndDate).toLocaleDateString('tr-TR')}
                      </span>
                      {client.daysRemaining !== undefined && (
                        <span
                          className={`text-xs font-medium ${client.daysRemaining <= 7
                            ? 'text-red-600'
                            : client.daysRemaining <= 30
                              ? 'text-amber-600'
                              : 'text-green-600'
                            }`}
                        >
                          {client.daysRemaining === 0
                            ? 'Bugün sona eriyor'
                            : `${client.daysRemaining} gün kaldı`}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                {/* Last Activity */}
                <td className="px-6 py-4">
                  {client.lastActivityAt ? (
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(client.lastActivityAt), {
                        addSuffix: true,
                        locale: tr
                      })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                {/* Linked At */}
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(client.linkedAt).toLocaleDateString('tr-TR')}
                  </span>
                </td>

                {/* Actions Menu */}
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === client.clientId ? null : client.clientId)}
                      className="p-2 hover:bg-muted rounded-md transition"
                      aria-label="Actions"
                    >
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {openMenuId === client.clientId && (
                      <>
                        {/* Backdrop to close menu */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />

                        {/* Dropdown Menu */}
                        <div className="absolute right-0 mt-2 w-48 bg-background border rounded-md shadow-lg z-20">
                          <button
                            onClick={() => {
                              router.push(`/dashboard/clients/${client.clientId}`)
                              setOpenMenuId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Detayları Görüntüle
                          </button>

                          <button
                            onClick={() => {
                              onGenerateKey(client.publicUserId)
                              setOpenMenuId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition flex items-center gap-2"
                          >
                            <Key className="w-4 h-4" />
                            Anahtar Oluştur/Uzat
                          </button>

                          <button
                            disabled
                            className="w-full px-4 py-2 text-left text-sm text-muted-foreground cursor-not-allowed flex items-center gap-2 opacity-50"
                            title="Yakında gelecek"
                          >
                            <Ban className="w-4 h-4" />
                            İptal Et
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
