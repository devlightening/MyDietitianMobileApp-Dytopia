"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { BellRing, CalendarClock, FileText, Reply, Send, UserCircle2, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCareHubSummary } from '@/lib/api/care-hub';
import {
  addClientCareNote,
  getClientCareHub,
  sendClientCareReply,
  type CareTimelineItem,
} from '@/lib/api/clients';
import { useCareSignalR } from '@/hooks/useCareSignalR';

function formatDateTime(value?: string | null) {
  if (!value) return 'Plan yok';
  return new Date(value).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(value?: string | null) {
  if (!value) return 'az önce';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.round(hours / 24);
  return `${days} gün önce`;
}

export default function CareHubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [composeMode, setComposeMode] = useState<'reply' | 'note'>('reply');
  const [replyTarget, setReplyTarget] = useState<CareTimelineItem | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['care-hub-summary'],
    queryFn: () => getCareHubSummary(20),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const selectedClientIdFromUrl = searchParams.get('clientId');
  const selectedClientId = selectedClientIdFromUrl ?? summary?.threads?.[0]?.clientId ?? '';

  useEffect(() => {
    if (!selectedClientIdFromUrl && summary?.threads?.[0]?.clientId) {
      router.replace(`/dashboard/care-hub?clientId=${summary.threads[0].clientId}`);
    }
  }, [router, selectedClientIdFromUrl, summary]);

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['client-care', selectedClientId],
    queryFn: () => getClientCareHub(selectedClientId),
    enabled: Boolean(selectedClientId),
    refetchOnWindowFocus: false,
  });

  const activeThread = useMemo(
    () => summary?.threads?.find((thread) => thread.clientId === selectedClientId) ?? null,
    [selectedClientId, summary],
  );

  const taskTemplates = useMemo(() => ([
    {
      key: 'pantry',
      label: 'Dolap görevi',
      text: '[TASK|PANTRY|Dolabını Tazele|Dolabı Aç] Dolabındaki ürünleri güncelle ve akşam için bir tarif seç.',
    },
    {
      key: 'hydration',
      label: 'Su görevi',
      text: '[TASK|HYDRATION|Su Ritmini Koru|Suya Git] Bugün su hedefini kapatmak için birkaç bardak daha ekle.',
    },
    {
      key: 'shopping',
      label: 'Alışveriş görevi',
      text: '[TASK|SHOPPING|Eksikleri Kapat|Listeyi Aç] Eksik malzemelerini kontrol edip alışveriş listesini toparla.',
    },
  ]), []);

  // Real-time: invalidate queries whenever SignalR fires care.thread.updated
  const handleSignalRUpdate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['care-hub-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['client-care', selectedClientId] });
  }, [queryClient, selectedClientId]);

  useCareSignalR(handleSignalRUpdate, true);

  const replyMutation = useMutation({
    mutationFn: (payload: { clientId: string; text: string; replyToId?: string | null; replyToSnippet?: string | null }) =>
      sendClientCareReply(payload.clientId, payload.text, payload.replyToId, payload.replyToSnippet),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['care-hub-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['client-care', selectedClientId] });
      setDraft('');
      setReplyTarget(null);
    },
  });

  const noteMutation = useMutation({
    mutationFn: (payload: { clientId: string; text: string }) => addClientCareNote(payload.clientId, payload.text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['care-hub-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['client-care', selectedClientId] });
      setDraft('');
      setReplyTarget(null);
    },
  });

  function selectThread(clientId: string) {
    router.replace(`/dashboard/care-hub?clientId=${clientId}`);
  }

  function handleReplyTo(item: CareTimelineItem) {
    setComposeMode('reply');
    setReplyTarget(item);
  }

  async function handleSubmit() {
    const text = draft.trim();
    if (!text || !selectedClientId) return;

    if (composeMode === 'reply') {
      await replyMutation.mutateAsync({
        clientId: selectedClientId,
        text,
        replyToId: replyTarget?.id ?? null,
        replyToSnippet: replyTarget?.text ?? null,
      });
      return;
    }

    await noteMutation.mutateAsync({ clientId: selectedClientId, text });
  }

  return (
    <div className="space-y-6">
      <Card className="card-premium p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: 'rgba(71,185,114,0.12)', border: '1px solid rgba(71,185,114,0.24)' }}
              >
                <BellRing className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">İletişim merkezi</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Danışan notlarını, yeni mesajları ve yanıt akışını tek merkezden yönetin.
                </p>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold" style={{ color: 'var(--brand-emerald)' }}>
              {summary?.unreadMessagesCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">okunmamış mesaj</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Mesaj kutusu</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Yeni danışan mesajları önce burada görünür.
              </p>
            </div>
            <span className="badge-base badge-premium">
              {summary?.clientsWithUnreadCount ?? 0} aktif
            </span>
          </div>

          <div className="space-y-2">
            {summaryLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2 rounded-2xl border border-border p-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))
            ) : summary?.threads?.length ? (
              summary.threads.map((thread) => (
                <button
                  key={thread.clientId}
                  onClick={() => selectThread(thread.clientId)}
                  className="w-full rounded-2xl border p-4 text-left transition-all"
                  style={{
                    background: selectedClientId === thread.clientId ? 'rgba(71,185,114,0.08)' : 'var(--surface-raised)',
                    borderColor: selectedClientId === thread.clientId ? 'rgba(71,185,114,0.3)' : 'var(--border-default)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{thread.clientName}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {thread.latestText || 'İletişim kaydı hazır'}
                      </p>
                    </div>
                    {thread.unreadCount > 0 && (
                      <span
                        className="flex-shrink-0 rounded-full px-2 py-1 text-[11px] font-bold"
                        style={{ background: 'rgba(248,113,113,0.14)', color: '#FCA5A5' }}
                      >
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>{formatRelative(thread.latestAtUtc)}</span>
                    {thread.nextAppointmentAtUtc && (
                      <span className="truncate">Randevu: {formatDateTime(thread.nextAppointmentAtUtc)}</span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">Henüz görüşme akışı yok</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mobilde yeni not geldikçe burada sıralanacak.
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {threadData?.client?.fullName ?? activeThread?.clientName ?? 'Danışan görüşmesi'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Yanıtlarla görüşmeyi sürdürün, klinik notlarla takibi düzenli tutun.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Yaklaşan görüşme</div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {threadData?.appointments?.[0]?.scheduledAtUtc
                    ? formatDateTime(threadData.appointments[0].scheduledAtUtc)
                    : 'Plan yok'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setComposeMode('reply')}
                className="rounded-full px-3 py-2 text-xs font-semibold"
                style={{
                  background: composeMode === 'reply' ? 'rgba(71,185,114,0.12)' : 'var(--surface-glass)',
                  color: composeMode === 'reply' ? 'var(--brand-primary)' : 'hsl(var(--muted-foreground))',
                  border: composeMode === 'reply' ? '1px solid rgba(71,185,114,0.22)' : '1px solid var(--border-default)',
                }}
              >
                Hızlı yanıt
              </button>
              <button
                onClick={() => {
                  setComposeMode('note');
                  setReplyTarget(null);
                }}
                className="rounded-full px-3 py-2 text-xs font-semibold"
                style={{
                  background: composeMode === 'note' ? 'var(--surface-overlay)' : 'var(--surface-glass)',
                  color: composeMode === 'note' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                  border: '1px solid var(--border-default)',
                }}
              >
                Klinik not
              </button>
            </div>

            {replyTarget && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-primary">Yanıtlanıyor</p>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground">{replyTarget.text}</p>
                  </div>
                  <button
                    onClick={() => setReplyTarget(null)}
                    className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

              <div className="space-y-3 rounded-2xl border border-border bg-[var(--surface-glass)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {composeMode === 'reply' ? (
                  <>
                    <Reply className="h-4 w-4 text-primary" />
                    Yanıt gönder
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 text-primary" />
                    Klinik not ekle
                  </>
                )}
                </div>
                {composeMode === 'note' ? (
                  <div className="flex flex-wrap gap-2">
                    {taskTemplates.map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        onClick={() => setDraft(template.text)}
                        className="rounded-full border border-border bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                placeholder={
                  composeMode === 'reply'
                    ? 'Danışana kısa ve net bir yanıt yaz...'
                    : 'Takip notu, hatırlatma veya klinik yönlendirme yaz...'
                }
                className="input-sfcos min-h-[120px] w-full resize-none px-4 py-3 text-sm"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {composeMode === 'reply'
                    ? 'Bu mesaj danışan tarafındaki görüşme akışında görünür.'
                    : 'Bu not zaman çizelgesinde diyetisyen notu olarak görünür.'}
                </p>
                <Button
                  variant={composeMode === 'reply' ? 'action' : 'primary'}
                  onClick={handleSubmit}
                  disabled={!selectedClientId || !draft.trim()}
                  loading={replyMutation.isPending || noteMutation.isPending}
                >
                  <Send className="mr-2 inline-flex h-4 w-4" />
                  {composeMode === 'reply' ? 'Yanıtı gönder' : 'Notu kaydet'}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Görüşme akışı</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Danışan mesajları, diyetisyen notları ve hızlı yanıtlar birlikte görünür.
                </p>
              </div>
              {threadData?.appointments?.[0] && (
                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {threadData.appointments[0].title}
                  {threadData.appointments[0].attendanceStatus === 'attended' && (
                    <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      Gitti
                    </span>
                  )}
                  {threadData.appointments[0].attendanceStatus === 'missed' && (
                    <span className="rounded-full bg-amber-500/14 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Gitmedi
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {threadLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-2 rounded-2xl border border-border p-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))
              ) : threadData?.items?.length ? (
                threadData.items.map((item) => {
                  const isInbound = item.direction === 'inbound';
                  const badgeLabel =
                    item.kind === 'dietitian_note'
                      ? 'Klinik not'
                      : item.kind === 'dietitian_reply'
                        ? 'Yanıt'
                        : 'Danışan mesajı';

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border p-4"
                      style={{
                        background: isInbound ? 'var(--surface-glass)' : 'rgba(71,185,114,0.08)',
                        borderColor: isInbound ? 'var(--border-default)' : 'rgba(71,185,114,0.20)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex items-start gap-3">
                          <div
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
                              style={{
                                background: isInbound ? 'var(--surface-overlay)' : 'rgba(71,185,114,0.14)',
                                border: isInbound ? '1px solid var(--border-default)' : '1px solid rgba(71,185,114,0.26)',
                              }}
                          >
                            {isInbound ? (
                              <UserCircle2 className="h-5 w-5 text-foreground" />
                            ) : (
                              <Reply className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {isInbound ? 'Danışan' : 'Diyetisyen'}
                              </span>
                              <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                {badgeLabel}
                              </span>
                            </div>
                            {/* Reply quote */}
                            {item.replyToSnippet ? (
                              <div className="mt-2 rounded-xl border-l-4 border-primary/60 bg-primary/6 px-3 py-2">
                                <p className="line-clamp-2 text-xs text-muted-foreground">{item.replyToSnippet}</p>
                              </div>
                            ) : null}
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                              {item.text}
                            </p>
                            <button
                              onClick={() => handleReplyTo(item)}
                              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <Reply className="h-3.5 w-3.5" />
                              Yanıtla
                            </button>
                          </div>
                        </div>
                        <div className="min-w-[108px] text-right text-xs text-muted-foreground">
                          <p>{formatDateTime(item.createdAtUtc)}</p>
                          <p className="mt-1">{formatRelative(item.createdAtUtc)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
                  <p className="text-sm font-medium text-foreground">Bu akışta henüz mesaj yok</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Danışan mesaj gönderdiğinde veya ilk notu paylaştığınızda akışı burada göreceksiniz.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
