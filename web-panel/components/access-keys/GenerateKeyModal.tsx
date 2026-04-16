'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Copy, Check, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface GenerateKeyModalProps {
  clientId: string
  clientName: string
  onClose: () => void
}

export function GenerateKeyModal({ clientId, clientName, onClose }: GenerateKeyModalProps) {
  const [duration, setDuration] = useState(3) // months
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()

  const generateMutation = useMutation({
    mutationFn: async (months: number) => {
      const res = await api.post(
        `/api/dietitian/clients/${clientId}/access-keys`,
        { durationMonths: months }
      )
      return res.data
    },
    onSuccess: (data) => {
      setGeneratedCode(data.code)
      toast.success('Access code generated!')
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    },
    onError: () => {
      toast.error('Failed to generate access code')
    }
  })

  const handleGenerate = () => {
    generateMutation.mutate(duration)
  }

  const handleCopy = async () => {
    if (!generatedCode) return
    await navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    toast.success('Code copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = (method: 'sms' | 'email' | 'whatsapp') => {
    if (!generatedCode) return

    const message = `Your MyDietitian premium access code: ${generatedCode}. Valid for ${duration} months.`

    switch (method) {
      case 'sms':
        window.open(`sms:?body=${encodeURIComponent(message)}`)
        break
      case 'email':
        window.open(`mailto:?subject=Your Premium Access Code&body=${encodeURIComponent(message)}`)
        break
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`)
        break
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Generate Access Code</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Generate a 6-digit access code for <strong>{clientName}</strong> to activate premium features.
        </p>

        {!generatedCode ? (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Premium Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map((months) => (
                  <button
                    key={months}
                    onClick={() => setDuration(months)}
                    className={`py-2 px-3 rounded-lg border-2 transition-all ${duration === months
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    {months}M
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {generateMutation.isPending ? 'Generating...' : 'Generate Code'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
              <p className="text-sm text-gray-600 mb-2 text-center">Access Code</p>
              <div className="text-4xl font-bold text-center text-blue-600 tracking-widest mb-4">
                {generatedCode}
              </div>
              <p className="text-xs text-gray-500 text-center">
                Valid for {duration} month{duration > 1 ? 's' : ''}
              </p>
            </div>

            <div className="space-y-2 mb-4">
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-green-600 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="font-medium">Copy Code</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleShare('sms')}
                  className="py-2 px-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all text-sm"
                >
                  SMS
                </button>
                <button
                  onClick={() => handleShare('email')}
                  className="py-2 px-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all text-sm"
                >
                  Email
                </button>
                <button
                  onClick={() => handleShare('whatsapp')}
                  className="py-2 px-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all text-sm"
                >
                  WhatsApp
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
