'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Clock,
  MapPin,
  Pencil,
  Trash2,
  UserCircle2,
  Video,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dropdown } from '@/components/ui/Dropdown';
import { DateTimeField } from '@/components/ui/DateTimeField';
import {
  cancelAppointment,
  createAppointment,
  getDietitianAppointments,
  updateAppointment,
  type AppointmentPayload,
  type DietitianAppointment,
} from '@/lib/api/appointments';
import { getClients } from '@/lib/api/clients';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(utc: string) {
  return new Date(utc).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(utc: string) {
  const date = new Date(utc);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'Bugün';
  if (sameDay(date, tomorrow)) return 'Yarın';

  return date.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function groupByDay(items: DietitianAppointment[]) {
  const groups: Record<string, DietitianAppointment[]> = {};
  for (const item of items) {
    const key = new Date(item.scheduledAtUtc).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

function toLocalDatetimeValue(utc: string) {
  const d = new Date(utc);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  editing: DietitianAppointment | null;
  onClose: () => void;
  onSave: (clientId: string, payload: AppointmentPayload, id?: string) => Promise<void>;
  clients: { clientId: string; fullName: string }[];
  isSaving: boolean;
}

function AppointmentModal({ editing, onClose, onSave, clients, isSaving }: ModalProps) {
  const [clientId, setClientId] = useState(editing?.clientId ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [scheduledAt, setScheduledAt] = useState(
    editing ? toLocalDatetimeValue(editing.scheduledAtUtc) : '',
  );
  const [mode, setMode] = useState(editing?.mode ?? 'online');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!clientId) return setError('Danışan seçiniz.');
    if (!title.trim()) return setError('Başlık gereklidir.');
    if (!scheduledAt) return setError('Tarih ve saat seçiniz.');

    const utcIso = new Date(scheduledAt).toISOString();
    const payload: AppointmentPayload = {
      title: title.trim(),
      scheduledAtUtc: utcIso,
      mode,
      location: location.trim() || undefined,
      note: note.trim() || undefined,
    };

    try {
      await onSave(clientId, payload, editing?.id);
    } catch {
      setError('Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-base font-semibold text-foreground">
            {editing ? 'Randevuyu Düzenle' : 'Yeni Randevu'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Client */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Danışan
            </label>
            <Dropdown
              value={clientId}
              onChange={setClientId}
              disabled={!!editing}
              options={[{ label: 'Seçiniz', value: '' }, ...clients.map((c) => ({ label: c.fullName, value: c.clientId }))]}
            />
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Başlık
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Haftalık check-in"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Date & Time */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tarih ve Saat
            </label>
            <DateTimeField value={scheduledAt} onChange={setScheduledAt} />
          </div>

          {/* Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Görüşme Türü
            </label>
            <div className="flex gap-3">
              {(['online', 'in-person'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 rounded-xl border py-2.5 text-sm font-medium transition',
                    mode === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {m === 'online' ? 'Online' : 'Yüz Yüze'}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Konum <span className="normal-case font-normal">(opsiyonel)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Zoom linki veya adres"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Not <span className="normal-case font-normal">(opsiyonel)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Danışana gösterilecek not..."
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {isSaving ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Attendance Badge ──────────────────────────────────────────────────────────

function AttendanceBadge({ status }: { status: string }) {
  if (status === 'attended')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Geldi
      </span>
    );
  if (status === 'missed')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
        Gelmedi
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      Bekliyor
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterKey = 'today' | 'week' | 'all';

function getDateParams(filter: FilterKey) {
  const now = new Date();
  if (filter === 'today') {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { from: now.toISOString(), to: end.toISOString() };
  }
  if (filter === 'week') {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return { from: now.toISOString(), to: end.toISOString() };
  }
  return { from: undefined, to: undefined };
}

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('week');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DietitianAppointment | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<DietitianAppointment | null>(null);

  const { from, to } = getDateParams(filter);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['dietitian-appointments', filter],
    queryFn: () => getDietitianAppointments({ from, to }),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients-for-appointment'],
    queryFn: () => getClients({ page: 1, pageSize: 200 }),
  });

  const clients = clientsData?.items ?? [];

  const saveMutation = useMutation({
    mutationFn: async ({
      clientId,
      payload,
      id,
    }: {
      clientId: string;
      payload: AppointmentPayload;
      id?: string;
    }) => {
      if (id) {
        return updateAppointment(clientId, id, payload);
      }
      return createAppointment(clientId, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dietitian-appointments'] });
      setModalOpen(false);
      setEditTarget(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (appt: DietitianAppointment) => cancelAppointment(appt.clientId, appt.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dietitian-appointments'] });
      setConfirmCancel(null);
    },
  });

  const now = new Date();
  const visible = appointments.filter((a) => !a.isCancelled);

  const todayCount = visible.filter(
    (a) => new Date(a.scheduledAtUtc).toDateString() === now.toDateString(),
  ).length;

  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekCount = visible.filter((a) => {
    const d = new Date(a.scheduledAtUtc);
    return d >= now && d <= weekEnd;
  }).length;

  const pendingCount = visible.filter((a) => a.attendanceStatus === 'pending').length;
  const grouped = groupByDay(visible);

  function openEdit(appt: DietitianAppointment) {
    setEditTarget(appt);
    setModalOpen(true);
  }

  function openNew() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditTarget(null);
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Randevular</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Danışanlarınızla planlanan görüşmeler
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-border bg-background p-1">
              {(
                [
                  { key: 'today' as FilterKey, label: 'Bugün' },
                  { key: 'week' as FilterKey, label: 'Bu Hafta' },
                  { key: 'all' as FilterKey, label: 'Tümü' },
                ]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    filter === key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <CalendarPlus className="h-4 w-4" />
              Yeni Randevu
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide">Bugün</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{todayCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wide">Bu Hafta</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{weekCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wide">Bekleyen</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{pendingCount}</p>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/30 py-20 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-semibold text-foreground">Randevu bulunamadı</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bu dönem için planlanmış görüşme yok.
            </p>
            <button
              type="button"
              onClick={openNew}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
            >
              <CalendarPlus className="h-4 w-4" />
              İlk Randevuyu Oluştur
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([dayKey, items]) => (
              <div key={dayKey}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {formatDayLabel(items[0].scheduledAtUtc)}
                </h3>
                <div className="space-y-3">
                  {items.map((appt) => (
                    <div
                      key={appt.id}
                      className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            {appt.mode === 'online' ? (
                              <Video className="h-4 w-4" />
                            ) : (
                              <UserCircle2 className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {appt.clientName}
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-sm text-muted-foreground">{appt.title}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(appt.scheduledAtUtc)}
                              </span>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-xs font-medium',
                                  appt.mode === 'online'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
                                )}
                              >
                                {appt.mode === 'online' ? 'Online' : 'Yüz Yüze'}
                              </span>
                              {appt.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {appt.location}
                                </span>
                              )}
                            </div>
                            {appt.note && (
                              <p className="mt-1.5 text-xs text-muted-foreground">{appt.note}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <AttendanceBadge status={appt.attendanceStatus} />
                          <button
                            type="button"
                            onClick={() => openEdit(appt)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            title="Düzenle"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCancel(appt)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                            title="İptal"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New/Edit Modal */}
      {modalOpen && (
        <AppointmentModal
          editing={editTarget}
          onClose={closeModal}
          onSave={async (clientId, payload, id) => {
            await saveMutation.mutateAsync({ clientId, payload, id });
          }}
          clients={clients}
          isSaving={saveMutation.isPending}
        />
      )}

      {/* Cancel Confirm */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmCancel(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-foreground">Randevuyu İptal Et</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong className="text-foreground">{confirmCancel.clientName}</strong> ile{' '}
              <strong className="text-foreground">
                {formatTime(confirmCancel.scheduledAtUtc)}
              </strong>{' '}
              saatindeki randevu iptal edilecek. Bu işlem geri alınamaz.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmCancel(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => cancelMutation.mutate(confirmCancel)}
                disabled={cancelMutation.isPending}
                className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60"
              >
                {cancelMutation.isPending ? 'İptal ediliyor...' : 'İptal Et'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
