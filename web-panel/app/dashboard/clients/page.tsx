"use client"

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

interface ClientSummary {
  id: string // GUID for routing
  publicUserId: string // AccessKey code for display
  fullName: string
  isActive: boolean
  lastLoginAt?: string
  currentWeight?: number
  linkedAt: string
}

export default function ClientsPage() {
  const { data: clients, isLoading } = useQuery<ClientSummary[]>({
    queryKey: ['dietitian-clients'],
    queryFn: async () => {
      const res = await api.get('/api/dietitian/clients')
      return res.data.clients
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Danışanlarım</h1>
        <p className="text-muted-foreground mt-2">
          Aktif ve geçmiş danışanlarınızı görüntüleyin
        </p>
      </div>

      {isLoading ? (
        <div>Yükleniyor...</div>
      ) : !clients || clients.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            Henüz danışanınız yok. İlk access key'i oluşturduğunuzda burada görünecek.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
            >
              <Card className="p-6 hover:shadow-lg transition cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{client.fullName}</h3>
                    <p className="text-sm text-muted-foreground font-mono">
                      {client.publicUserId}
                    </p>
                    {client.currentWeight && (
                      <p className="text-sm mt-1">
                        Son Kilo: <span className="font-medium">{client.currentWeight} kg</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {client.isActive ? (
                      <Badge variant="default">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary">Pasif</Badge>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Bağlantı: {new Date(client.linkedAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
