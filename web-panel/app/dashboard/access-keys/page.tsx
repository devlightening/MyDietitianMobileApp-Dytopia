'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Key,
  Loader2,
  Plus,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { getAccessKeys, createAccessKeyForClient } from '@/lib/api/access-keys';
import { cn } from '@/lib/utils';

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DURATION_PRESETS = [
  { label: '1 ay', days: 30 },
  { label: '3 ay', days: 90 },
  { label: '6 ay', days: 180 },
  { label: '1 yıl', days: 365 },
];

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function todayStr(): string {
  return toDateInputValue(new Date());
}

function KeyStatusBadge({ isActive, expiresAt }: { isActive: boolean; expiresAt?: string }) {
  const now = new Date();
  const expired = expiresAt && new Date(expiresAt) < now;

  if (!isActive || expired) {
    return (
      <span className="badge-base badge-inactive">
        <ShieldOff className="h-3 w-3" />
        Pasif
      </span>
    );
  }

  const expiringSoon =
    expiresAt && new Date(expiresAt).getTime() - now.getTime() < 7 * 24 * 3600 * 1000;

  if (expiringSoon) {
    return (
      <span className="badge-base badge-expiring">
        <Clock className="h-3 w-3" />
        Yakında doluyor
      </span>
    );
  }

  return (
    <span className="badge-base badge-active">
      <ShieldCheck className="h-3 w-3" />
      Aktif
    </span>
  );
}

export default function AccessKeysPage() {
  const { data: accessKeysData, isLoading, refetch } = useQuery({
    queryKey: ['accessKeys'],
    queryFn: getAccessKeys,
  });

  const accessKeys = accessKeysData?.accessKeys || [];

  const [form, setForm] = useState({
    clientPublicUserId: '',
    startDate: todayStr(),
    endDate: addDays(30),
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValidId = (id: string) => /^MD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(id);

  function formatId(raw: string): string {
    let value = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (value.length > 0 && !value.startsWith('MD-')) value = `MD-${value.replace(/^MD-?/, '')}`;
    if (value.length > 7 && value[7] !== '-') value = `${value.slice(0, 7)}-${value.slice(7)}`;
    if (value.length > 12 && value[12] !== '-') value = `${value.slice(0, 12)}-${value.slice(12)}`;
    return value.slice(0, 17);
  }

  function applyPreset(days: number) {
    setForm((prev) => ({ ...prev, startDate: todayStr(), endDate: addDays(days) }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg(null);

    if (!isValidId(form.clientPublicUserId)) {
      setErrorMsg('Geçersiz danışan ID biçimi. Örnek: MD-A1B2-C3D4-E5');
      return;
    }

    if (!form.startDate || !form.endDate) {
      setErrorMsg('Başlangıç ve bitiş tarihlerini doldurun.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await createAccessKeyForClient(form.clientPublicUserId, {
        createdAtUtc: form.startDate,
        expiresAtUtc: form.endDate,
      });

      const key = result.key ?? result.accessKey;
      setGeneratedKey(key);
      setForm({ clientPublicUserId: '', startDate: todayStr(), endDate: addDays(30) });
      void refetch();
    } catch (error: any) {
      setErrorMsg(error?.response?.data?.message || error?.message || 'Anahtar oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8">
      <section className="card-premium p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-glass)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
              <Key className="h-3.5 w-3.5" />
              Premium erişimi
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
              Erişim anahtarları
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Danışanlarınız için premium erişim sürelerini bu ekrandan oluşturabilir,
              aktif anahtarları aynı yerde takip edebilirsiniz.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-[var(--surface-glass)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Hazır anahtar</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{accessKeys.length}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Yeni anahtar oluştur</h2>
              <p className="mt-1 text-sm text-muted-foreground">Danışan ID girin ve süreyi seçin.</p>
            </div>
          </div>

          {generatedKey ? (
            <div className="mb-5 rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Oluşturuldu</p>
              <div className="mt-3 flex items-center gap-3">
                <code className="flex-1 break-all text-lg font-bold tracking-[0.18em] text-foreground">
                  {generatedKey}
                </code>
                <button
                  onClick={() => copyKey(generatedKey)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-[var(--surface-raised)] text-muted-foreground transition hover:border-primary/20 hover:text-primary"
                  title="Panoya kopyala"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Bu anahtarı danışanınızla paylaşabilirsiniz.</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Danışan ID</label>
              <input
                type="text"
                value={form.clientPublicUserId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, clientPublicUserId: formatId(e.target.value) }))
                }
                placeholder="MD-XXXX-XXXX-XX"
                className={cn(
                  'input-sfcos font-mono tracking-[0.06em]',
                  form.clientPublicUserId && !isValidId(form.clientPublicUserId) && 'border-danger text-danger',
                )}
                required
              />
              {form.clientPublicUserId && !isValidId(form.clientPublicUserId) ? (
                <p className="mt-1 text-xs text-danger">Biçim: MD-ABCD-EFGH-IJ</p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">Süre kısayolu</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => applyPreset(preset.days)}
                    className={cn(
                      'h-11 rounded-full border text-sm font-semibold transition',
                      form.endDate === addDays(preset.days)
                        ? 'border-primary/20 bg-primary text-primary-foreground shadow-sm shadow-emerald-900/10'
                        : 'border-border bg-[var(--surface-glass)] text-muted-foreground hover:border-primary/20 hover:text-foreground',
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Başlangıç"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                required
              />
              <Input
                label="Bitiş"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>

            {errorMsg ? (
              <div className="flex items-start gap-2 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !isValidId(form.clientPublicUserId)}
              className="h-12 w-full rounded-2xl text-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Anahtar oluştur
                </>
              )}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Oluşturulan anahtarlar</h2>
              <p className="mt-1 text-sm text-muted-foreground">Aktif ve süresi yaklaşan anahtarlar</p>
            </div>
            <span className="badge-base badge-free">{accessKeys.length} anahtar</span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="card-sfcos p-5">
                  <div className="h-5 w-1/3 rounded-xl shimmer" />
                  <div className="mt-3 h-4 w-1/2 rounded-xl shimmer" />
                </div>
              ))}
            </div>
          ) : accessKeys.length === 0 ? (
            <Card className="p-14 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Key className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Henüz anahtar yok</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Soldaki formu kullanarak ilk premium erişim anahtarını oluşturun.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {accessKeys.map((accessKey: any) => {
                const expiresAt = accessKey.expiresAtUtc || accessKey.endDate || accessKey.ExpiresAtUtc;
                const rawKey = accessKey.keyValue || accessKey.key || accessKey.KeyValue || '-';

                return (
                  <Card key={accessKey.id ?? rawKey} className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="truncate text-base font-bold tracking-[0.14em] text-foreground">
                            {rawKey}
                          </code>
                          <button
                            onClick={() => copyKey(rawKey)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-[var(--surface-raised)] text-muted-foreground transition hover:border-primary/20 hover:text-primary"
                            title="Panoya kopyala"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <p>
                            Bitiş:{' '}
                            <span className="font-medium text-foreground">
                              {expiresAt ? new Date(expiresAt).toLocaleDateString('tr-TR') : '-'}
                            </span>
                          </p>
                          {accessKey.clientId ? (
                            <p className="truncate">
                              Danışan: <span className="font-mono">{String(accessKey.clientId).slice(0, 8)}...</span>
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <KeyStatusBadge
                        isActive={accessKey.isActive ?? accessKey.IsActive ?? true}
                        expiresAt={expiresAt}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
