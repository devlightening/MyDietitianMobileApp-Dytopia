'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Key, Plus, Copy, Check, Clock, ShieldCheck, ShieldOff, Loader2, AlertCircle } from 'lucide-react';
import { getAccessKeys, createAccessKeyForClient } from '@/lib/api/access-keys';
import { cn } from '@/lib/utils';

// Duration presets for quick selection
const DURATION_PRESETS = [
  { label: '1 ay', days: 30 },
  { label: '3 ay', days: 90 },
  { label: '6 ay', days: 180 },
  { label: '1 yıl', days: 365 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function KeyStatusBadge({ isActive, expiresAt }: { isActive: boolean; expiresAt?: string }) {
  const now = new Date();
  const expired = expiresAt && new Date(expiresAt) < now;
  if (!isActive || expired) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full badge-inactive">
        <ShieldOff className="w-3 h-3" /> Pasif
      </span>
    );
  }
  const expiringSoon = expiresAt && (new Date(expiresAt).getTime() - now.getTime()) < 7 * 24 * 3600 * 1000;
  if (expiringSoon) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full badge-expiring">
        <Clock className="w-3 h-3" /> Yakında Doluyor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full badge-premium">
      <ShieldCheck className="w-3 h-3" /> Aktif
    </span>
  );
}

export default function AccessKeysPage() {
  const { data: accessKeysData, isLoading, refetch } = useQuery({
    queryKey: ['accessKeys'],
    queryFn: getAccessKeys,
  });
  const accessKeys = accessKeysData?.accessKeys || [];

  const [form, setForm] = useState({ clientPublicUserId: '', startDate: todayStr(), endDate: addDays(30) });
  const [submitting, setSubmitting] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValidId = (id: string) => /^MD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(id);

  function formatId(raw: string): string {
    let v = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (v.length > 0 && !v.startsWith('MD-')) v = 'MD-' + v.replace(/^MD-?/, '');
    if (v.length > 7 && v[7] !== '-') v = v.slice(0, 7) + '-' + v.slice(7);
    if (v.length > 12 && v[12] !== '-') v = v.slice(0, 12) + '-' + v.slice(12);
    return v.slice(0, 17);
  }

  function applyPreset(days: number) {
    setForm(prev => ({ ...prev, startDate: todayStr(), endDate: addDays(days) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!isValidId(form.clientPublicUserId)) {
      setErrorMsg('Geçersiz Danışan ID formatı. Örnek: MD-A1B2-C3D4-E5');
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
      refetch();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Anahtar oluşturulamadı.');
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
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gradient-sage">Erişim Anahtarları</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Danışanlarınız için premium erişim anahtarı oluşturun ve yönetin
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Create Form (2 cols) ─────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-xl kpi-coral flex items-center justify-center">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Yeni Anahtar Oluştur</h2>
                <p className="text-xs text-muted-foreground">Premium aktivasyon</p>
              </div>
            </div>

            {/* Generated key result */}
            {generatedKey && (
              <div className="relative p-4 rounded-xl bg-action/5 border border-action/20">
                <p className="text-xs font-semibold uppercase tracking-wider text-action mb-2">Oluşturuldu ✓</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-lg font-bold text-foreground tracking-widest break-all">
                    {generatedKey}
                  </code>
                  <button
                    onClick={() => copyKey(generatedKey)}
                    className="p-2 rounded-lg hover:bg-action/10 transition-colors flex-shrink-0"
                    title="Panoya kopyala"
                  >
                    {copied ? <Check className="w-4 h-4 text-action" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Bu anahtarı danışanınızla paylaşın.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Client ID */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Danışan ID
                </label>
                <input
                  type="text"
                  value={form.clientPublicUserId}
                  onChange={e => setForm(prev => ({ ...prev, clientPublicUserId: formatId(e.target.value) }))}
                  placeholder="MD-XXXX-XXXX-XX"
                  className={cn(
                    'w-full px-3 py-2.5 rounded-lg border text-sm font-mono bg-background',
                    'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow',
                    form.clientPublicUserId && !isValidId(form.clientPublicUserId)
                      ? 'border-destructive text-destructive'
                      : 'border-input text-foreground'
                  )}
                  required
                />
                {form.clientPublicUserId && !isValidId(form.clientPublicUserId) && (
                  <p className="text-xs text-destructive mt-1">Format: MD-ABCD-EFGH-IJ</p>
                )}
              </div>

              {/* Duration presets */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Süre Kısayolu</label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATION_PRESETS.map(p => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => applyPreset(p.days)}
                      className={cn(
                        'py-1.5 text-xs font-medium rounded-lg border transition-colors',
                        form.endDate === addDays(p.days)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date inputs */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Başlangıç"
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                  required
                />
                <Input
                  label="Bitiş"
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/8 border border-destructive/20 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !isValidId(form.clientPublicUserId)}
                className="w-full h-10 text-sm font-semibold"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Oluşturuluyor...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Anahtar Oluştur</>
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* ── Keys List (3 cols) ───────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Oluşturulan Anahtarlar</h2>
            <span className="text-xs text-muted-foreground">{accessKeys.length} anahtar</span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card-premium p-5 space-y-3">
                  <div className="h-5 w-1/2 shimmer rounded" />
                  <div className="h-4 w-2/3 shimmer rounded" />
                </div>
              ))}
            </div>
          ) : accessKeys.length === 0 ? (
            <Card className="p-14 text-center">
              <div className="w-16 h-16 rounded-2xl kpi-coral flex items-center justify-center mx-auto mb-4">
                <Key className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">Henüz anahtar yok</h3>
              <p className="text-sm text-muted-foreground">
                Soldaki formu kullanarak ilk premium erişim anahtarını oluşturun.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {accessKeys.map((k: any) => {
                const expiresAt = k.expiresAtUtc || k.endDate || k.ExpiresAtUtc;
                return (
                  <Card key={k.id ?? k.KeyValue} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="font-mono text-base font-bold text-foreground tracking-wider truncate">
                            {k.keyValue || k.key || k.KeyValue || '—'}
                          </code>
                          <button
                            onClick={() => copyKey(k.keyValue || k.key || k.KeyValue || '')}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {expiresAt && (
                            <p>Bitiş: <span className="font-medium text-foreground">{new Date(expiresAt).toLocaleDateString('tr-TR')}</span></p>
                          )}
                          {k.clientId && <p className="font-mono opacity-60">Client: {String(k.clientId).slice(0, 8)}…</p>}
                        </div>
                      </div>
                      <KeyStatusBadge isActive={k.isActive ?? k.IsActive ?? true} expiresAt={expiresAt} />
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
