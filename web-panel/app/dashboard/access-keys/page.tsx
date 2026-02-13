'use client';
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Key, Plus, Check, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { getAccessKeys, createAccessKeyForClient } from '@/lib/api/access-keys'

export default function AccessKeysPage() {
  const t = useTranslations('accessKeys');
  const router = useRouter();
  const { data: accessKeysData, isLoading, refetch } = useQuery({
    queryKey: ['accessKeys'],
    queryFn: getAccessKeys
  })

  const accessKeys = accessKeysData?.accessKeys || [];

  const [formData, setFormData] = useState({
    clientPublicUserId: '',
    startDate: '',
    endDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const handlePublicUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    if (!value.startsWith('MD-') && value.length > 0) {
      value = 'MD-' + value.replace(/^MD-?/, '');
    }

    if (value.length > 7 && value[7] !== '-') {
      value = value.slice(0, 7) + '-' + value.slice(7);
    }
    if (value.length > 12 && value[12] !== '-') {
      value = value.slice(0, 12) + '-' + value.slice(12);
    }

    value = value.slice(0, 17);
    setFormData(prev => ({ ...prev, clientPublicUserId: value }));
  };

  const isValidPublicUserId = (id: string) => {
    return /^MD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(id);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidPublicUserId(formData.clientPublicUserId)) {
      alert('Geçersiz Kullanıcı ID formatı. Format: MD-XXXX-XXXX-XX');
      return;
    }

    setLoading(true);
    try {
      const result = await createAccessKeyForClient(formData.clientPublicUserId, {
        startDate: formData.startDate,
        endDate: formData.endDate
      });

      setCreatedKey(result.accessKey);

      // Copy to clipboard
      navigator.clipboard.writeText(result.accessKey);
      alert(`Access key oluşturuldu ve panoya kopyalandı!\n\nKey: ${result.accessKey}`);

      setFormData({ clientPublicUserId: '', startDate: '', endDate: '' });
      refetch();
    } catch (error: any) {
      alert(error.message || 'Key oluşturulamadı');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{t('title')}</h2>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">{t('generateKey')}</h3>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-2">
              Danışan ID (MD-XXXX-XXXX-XX)
            </label>
            <input
              type="text"
              value={formData.clientPublicUserId}
              onChange={handlePublicUserIdChange}
              placeholder="MD-"
              className="w-full p-2 border rounded font-mono"
              required
            />
            {formData.clientPublicUserId && !isValidPublicUserId(formData.clientPublicUserId) && (
              <p className="text-sm text-red-500 mt-1">
                Geçersiz format. Örnek: MD-A1B2-C3D4-E5
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('startDate')}
              type="date"
              value={formData.startDate}
              onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              required
            />
            <Input
              label={t('endDate')}
              type="date"
              value={formData.endDate}
              onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            {loading ? 'Oluşturuluyor...' : t('create')}
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-10 w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : accessKeys?.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Key className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('noKeys')}</h3>
            <p className="text-sm text-muted-foreground">{t('noKeysDescription')}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {accessKeys?.map((k: any) => (
            <Card key={k.id} className="p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="w-5 h-5 text-primary" />
                    <code className="font-mono font-semibold text-foreground text-lg">{k.key}</code>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {t('validFrom')} <span className="font-medium text-foreground">{k.startDate}</span> {t('to')} <span className="font-medium text-foreground">{k.endDate}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('clientId')}: <span className="font-mono">{k.clientId}</span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => alert('Activate key (mocked)')}
                  className="w-full md:w-auto"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {t('activate')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
