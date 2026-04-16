'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface ExtendKeyModalProps {
  clientId: string
  clientName: string
  keyId: string
  currentEndDate: string
  isOpen: boolean
  onClose: () => void
}

export function ExtendKeyModal({
  clientId,
  clientName,
  keyId,
  currentEndDate,
  isOpen,
  onClose
}: ExtendKeyModalProps) {
  const [extensionMonths, setExtensionMonths] = useState(3)
  const queryClient = useQueryClient()

  const extendMutation = useMutation({
    mutationFn: async (months: number) => {
      const res = await api.post(
        `/api/dietitian/clients/${clientId}/access-keys/${keyId}/extend`,
        { extensionMonths: months }
      )
      return res.data
    },
    onSuccess: (data) => {
      toast.success(`Premium access extended by ${extensionMonths} months!`)
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to extend access key')
    }
  })

  const handleExtend = () => {
    extendMutation.mutate(extensionMonths)
  }

  const calculateNewEndDate = () => {
    const current = new Date(currentEndDate)
    const newDate = new Date(current)
    newDate.setMonth(newDate.getMonth() + extensionMonths)
    return newDate.toLocaleDateString('tr-TR')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Premium Süresini Uzat</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Client Info */}
          <div>
            <p className="text-sm text-muted-foreground">Danışan</p>
            <p className="font-medium">{clientName}</p>
          </div>

          {/* Current End Date */}
          <div>
            <p className="text-sm text-muted-foreground">Mevcut Bitiş Tarihi</p>
            <p className="font-medium">
              {new Date(currentEndDate).toLocaleDateString('tr-TR')}
            </p>
          </div>

          {/* Extension Duration */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Uzatma Süresi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 3, 6].map((months) => (
                <button
                  key={months}
                  onClick={() => setExtensionMonths(months)}
                  className={`px-4 py-3 rounded-lg border-2 transition ${extensionMonths === months
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50'
                    }`}
                >
                  {months} Ay
                </button>
              ))}
            </div>
          </div>

          {/* New End Date Preview */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Yeni Bitiş Tarihi</p>
            <p className="text-lg font-semibold text-primary">
              {calculateNewEndDate()}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition"
          >
            İptal
          </button>
          <button
            onClick={handleExtend}
            disabled={extendMutation.isPending}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {extendMutation.isPending ? 'Uzatılıyor...' : 'Uzat'}
          </button>
        </div>
      </div>
    </div>
  )
}
