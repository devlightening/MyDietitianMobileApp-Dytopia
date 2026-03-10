'use client'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useTranslations } from 'next-intl'
import { Palette } from 'lucide-react'

export default function BrandingPage() {
  const t = useTranslations('common')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('branding')}</h1>
          <p className="text-muted-foreground mt-2">
            Markanızı özelleştirin ve danışanlarınıza profesyonel bir deneyim sunun.
          </p>
        </div>
        <Button variant="primary" disabled>
          <Palette className="w-4 h-4 mr-2" />
          Ayarları Düzenle
        </Button>
      </div>

      {/* Placeholder Content */}
      <Card className="p-12 text-center">
        <div className="max-w-md mx-auto">
          <Palette className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Yakında Gelecek</h3>
          <p className="text-muted-foreground">
            Markalama özellikleri şu anda geliştirilme aşamasındadır. Yakında logo, renk şeması ve özel alan adı ayarlarını yapabileceksiniz.
          </p>
        </div>
      </Card>
    </div>
  )
}
