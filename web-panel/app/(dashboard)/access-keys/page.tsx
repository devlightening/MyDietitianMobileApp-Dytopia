"use client"
import { useQuery, useMutation } from '@tanstack/react-query'
import api, { ApiError } from '@/lib/api'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Key, Plus, Trash2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AccessKeyScope, AccessKeyStatus, AccessKey, CreateAccessKeyResponse } from '@/types/accessKey'
import { ScopeSelector } from '@/components/access-keys/ScopeSelector'
import { StatusBadge } from '@/components/access-keys/StatusBadge'
import { ScopeBadge } from '@/components/access-keys/ScopeBadge'
import { CopyableKey } from '@/components/access-keys/CopyableKey'
import { cn } from '@/lib/utils'

function fetchAccessKeys() {
  return api
    .get('/api/dietitian/access-keys')
    .then(res => res.data.accessKeys)
    .catch((err: ApiError) => {
      // api.ts returns ApiError, not AxiosError
      // Don't swallow errors - let React Query handle them
      // UI will show error state
      throw err;
    });
}

export default function AccessKeysPage() {
  const t = useTranslations('accessKeys');
  const { data: accessKeys, isLoading, error, refetch } = useQuery({
    queryKey: ['accessKeys'],
    queryFn: fetchAccessKeys,
    retry: false
  })

  const [formData, setFormData] = useState({
    clientPublicUserId: '',
    scope: AccessKeyScope.Full,
    startDate: '',
    endDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string>('');

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

  const validateDates = (start: string, end: string): boolean => {
    if (!start || !end) {
      setDateError('');
      return true;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      setDateError('Başlangıç tarihi geçmişte olamaz');
      return false;
    }

    if (endDate <= startDate) {
      setDateError('Bitiş tarihi başlangıç tarihinden sonra olmalı');
      return false;
    }

    setDateError('');
    return true;
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    validateDates(newFormData.startDate, newFormData.endDate);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidPublicUserId(formData.clientPublicUserId)) {
      alert('Geçersiz Kullanıcı ID formatı. Format: MD-XXXX-XXXX-XX');
      return;
    }

    if (!validateDates(formData.startDate, formData.endDate)) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/dietitian/access-keys', {
        clientId: formData.clientPublicUserId,
        scope: formData.scope,
        startDate: formData.startDate,
        endDate: formData.endDate
      });

      // Show the created key
      setCreatedKey(response.data.key || 'KEY-CREATED-SUCCESSFULLY');

      // Reset form
      setFormData({
        clientPublicUserId: '',
        scope: AccessKeyScope.Full,
        startDate: '',
        endDate: ''
      });

      // Refetch list
      refetch();
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Key oluşturulamadı');
    } finally {
      setLoading(false);
    }
  }

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.delete(`/api/dietitian/access-keys/${keyId}`),
    onSuccess: () => {
      refetch();
    }
  });

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Bu anahtarı iptal etmek istediğinizden emin misiniz?')) {
      return;
    }
    try {
      await revokeMutation.mutateAsync(keyId);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Key iptal edilemedi');
    }
  };

  // Calculate status based on dates (temporary until backend provides it)
  const getKeyStatus = (key: any): AccessKeyStatus => {
    if (key.status) return key.status;
    const now = new Date();
    const end = new Date(key.endDate || key.expiresAt);
    return end < now ? AccessKeyStatus.Expired : AccessKeyStatus.Active;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{t('title')}</h2>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Success Message */}
      {createdKey && (
        <Card className="p-6 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                ✨ Access Key Başarıyla Oluşturuldu!
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                Aşağıdaki anahtarı danışanınızla paylaşabilirsiniz:
              </p>
              <CopyableKey keyValue={createdKey} />
              <button
                onClick={() => setCreatedKey(null)}
                className="mt-3 text-sm text-green-600 dark:text-green-400 hover:underline"
              >
                Kapat
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Create Form */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t('generateKey')}</h3>
        </div>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          {/* Public User ID */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Danışan ID
              <span className="text-muted-foreground ml-2 font-normal">(MD-XXXX-XXXX-XX)</span>
            </label>
            <input
              type="text"
              value={formData.clientPublicUserId}
              onChange={handlePublicUserIdChange}
              placeholder="MD-"
              className="w-full p-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              required
            />
            {formData.clientPublicUserId && !isValidPublicUserId(formData.clientPublicUserId) && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>Geçersiz format. Örnek: MD-A1B2-C3D4-E5</span>
              </div>
            )}
          </div>

          {/* Scope Selector */}
          <ScopeSelector
            value={formData.scope}
            onChange={(scope) => setFormData(prev => ({ ...prev, scope }))}
          />

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Başlangıç Tarihi"
              type="date"
              value={formData.startDate}
              onChange={e => handleDateChange('startDate', e.target.value)}
              required
            />
            <Input
              label="Bitiş Tarihi"
              type="date"
              value={formData.endDate}
              onChange={e => handleDateChange('endDate', e.target.value)}
              required
            />
          </div>

          {dateError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-600 dark:text-red-400">{dateError}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={loading || !!dateError || !isValidPublicUserId(formData.clientPublicUserId)}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            {loading ? 'Oluşturuluyor...' : 'Access Key Oluştur'}
          </Button>
        </form>
      </Card>

      {/* Keys List */}
      {error ? (
        <Card className="p-12 text-center border-red-200 dark:border-red-800">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Erişim Hatası</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {(error as any)?.message || 'Access keys yüklenemedi'}
            </p>
            {(error as any)?.code === 'DIETITIAN_PROFILE_MISSING' && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  💡 Diyetisyen profiliniz eksik görünüyor. Lütfen destek ekibi ile iletişime geçin.
                </p>
              </div>
            )}
            <button
              onClick={() => refetch()}
              className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Tekrar Dene
            </button>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
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
          {accessKeys?.map((k: any) => {
            const status = getKeyStatus(k);
            const scope = k.scope || AccessKeyScope.Full;
            const isExpired = status === AccessKeyStatus.Expired;
            const isRevoked = status === AccessKeyStatus.Revoked;

            return (
              <Card
                key={k.id}
                className={cn(
                  "p-6 transition-all duration-200",
                  isExpired || isRevoked
                    ? "opacity-60 bg-muted/30"
                    : "hover:shadow-lg hover:border-primary/50"
                )}
              >
                <div className="flex flex-col gap-4">
                  {/* Header with badges */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={status} />
                      <ScopeBadge scope={scope} />
                    </div>
                    {status === AccessKeyStatus.Active && (
                      <Button
                        variant="ghost"
                        onClick={() => handleRevoke(k.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        İptal Et
                      </Button>
                    )}
                  </div>

                  {/* Key */}
                  <CopyableKey keyValue={k.key} />

                  {/* Details */}
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">Geçerlilik:</span>{' '}
                      {k.startDate || k.startsAt} - {k.endDate || k.expiresAt}
                    </div>
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">Danışan ID:</span>{' '}
                      <code className="font-mono text-xs">{k.clientId}</code>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  )
}
