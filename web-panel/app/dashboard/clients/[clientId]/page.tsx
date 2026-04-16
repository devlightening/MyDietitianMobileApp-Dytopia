"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  getClientById,
  getClientActivities,
  getClientMeasurements,
  getClientCareHub,
  addClientCareNote,
  sendClientCareReply,
  createClientAppointment,
  cancelClientAppointment,
  addClientMeasurement,
  type CareTimelineItem,
} from '@/lib/api/clients';
import { getClientGamificationSummary, type ClientGamificationSummary } from '@/lib/api/gamification';
import { ComplianceDonut } from '@/components/clients/ComplianceDonut';
import { ClientTabs } from '@/components/clients/ClientTabs';
import { MeasurementsChart } from '@/components/clients/MeasurementsChart';
import { PlanTab } from '@/components/clients/PlanTab';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import {
  ArrowLeft,
  User,
  Activity,
  Scale,
  Calendar,
  FileText,
  Utensils,
  Weight,
  LogIn,
  CheckCircle2,
  Clock3,
  Send,
  PlusCircle,
  Reply,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const clientId = params.clientId as string;

  const [activeTab, setActiveTab] = useState('overview');
  const [noteContent, setNoteContent] = useState('');
  const [composeMode, setComposeMode] = useState<'note' | 'reply'>('note');
  const [replyTarget, setReplyTarget] = useState<CareTimelineItem | null>(null);
  const [appointmentTitle, setAppointmentTitle] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentLocation, setAppointmentLocation] = useState('');

  // Clinical measurement form state
  const [activityFilter, setActivityFilter] = useState<'all' | 'plan' | 'meals' | 'measurements' | 'badges'>('all');

  const [mWeightKg, setMWeightKg] = useState('');
  const [mHeightCm, setMHeightCm] = useState('');
  const [mBodyFat, setMBodyFat] = useState('');
  const [mMuscle, setMMuscle] = useState('');
  const [mWater, setMWater] = useState('');
  const [mWaistCm, setMWaistCm] = useState('');
  const [mHipCm, setMHipCm] = useState('');
  const [mChestCm, setMChestCm] = useState('');
  const [mNotes, setMNotes] = useState('');
  const [mRecordedAt, setMRecordedAt] = useState('');

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && ['overview', 'activities', 'measurements', 'plan', 'notes'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client-detail', clientId],
    queryFn: () => getClientById(clientId),
  });

  const { data: activitiesData } = useQuery({
    queryKey: ['client-activities', clientId],
    queryFn: () => getClientActivities(clientId),
    enabled: activeTab === 'activities',
  });

  const { data: measurementsData } = useQuery({
    queryKey: ['client-measurements', clientId],
    queryFn: () => getClientMeasurements(clientId),
    enabled: activeTab === 'measurements',
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const { data: careData } = useQuery({
    queryKey: ['client-care', clientId],
    queryFn: () => getClientCareHub(clientId),
    enabled: activeTab === 'notes',
    retry: 0,
    refetchOnWindowFocus: false,
  });
  const { data: motivationData } = useQuery({
    queryKey: ['client-motivation', clientId],
    queryFn: () => getClientGamificationSummary(clientId),
    enabled: activeTab === 'overview' || activeTab === 'notes',
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => addClientCareNote(clientId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-care', clientId] });
      setNoteContent('');
      setReplyTarget(null);
      setComposeMode('note');
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: (content: string) => sendClientCareReply(clientId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-care', clientId] });
      setNoteContent('');
      setReplyTarget(null);
      setComposeMode('reply');
    },
  });

  const addAppointmentMutation = useMutation({
    mutationFn: () =>
      createClientAppointment(clientId, {
        title: appointmentTitle,
        scheduledAtUtc: new Date(appointmentTime).toISOString(),
        mode: 'online',
        location: appointmentLocation || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-care', clientId] });
      setAppointmentTitle('');
      setAppointmentTime('');
      setAppointmentLocation('');
    },
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: (appointmentId: string) => cancelClientAppointment(clientId, appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-care', clientId] });
    },
  });

  const addMeasurementMutation = useMutation({
    mutationFn: () =>
      addClientMeasurement(clientId, {
        weightKg: mWeightKg ? parseFloat(mWeightKg) : null,
        heightCm: mHeightCm ? parseFloat(mHeightCm) : null,
        bodyFatPercent: mBodyFat ? parseFloat(mBodyFat) : null,
        musclePercent: mMuscle ? parseFloat(mMuscle) : null,
        waterPercent: mWater ? parseFloat(mWater) : null,
        waistCm: mWaistCm ? parseFloat(mWaistCm) : null,
        hipCm: mHipCm ? parseFloat(mHipCm) : null,
        chestCm: mChestCm ? parseFloat(mChestCm) : null,
        notes: mNotes || null,
        isClinicallyVerified: true,
        recordedAtUtc: mRecordedAt ? new Date(mRecordedAt).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-measurements', clientId] });
      setMWeightKg(''); setMHeightCm(''); setMBodyFat(''); setMMuscle('');
      setMWater(''); setMWaistCm(''); setMHipCm(''); setMChestCm('');
      setMNotes(''); setMRecordedAt('');
    },
  });

  const tabs = [
    { id: 'overview', label: 'Genel bakış', icon: <User className="w-4 h-4" /> },
    { id: 'activities', label: 'Aktiviteler', icon: <Activity className="w-4 h-4" /> },
    { id: 'measurements', label: 'Ölçümler', icon: <Scale className="w-4 h-4" /> },
    { id: 'plan', label: 'Plan', icon: <Calendar className="w-4 h-4" /> },
    { id: 'notes', label: 'İletişim', icon: <FileText className="w-4 h-4" /> },
  ];

  function handleTabChange(nextTab: string) {
    setActiveTab(nextTab);
    const query = nextTab === 'overview' ? '' : `?tab=${nextTab}`;
    router.replace(`/dashboard/clients/${clientId}${query}`);
  }

  if (clientLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Card className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-32" />
        </Card>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Danışan bulunamadı</p>
      </div>
    );
  }

  const activities = activitiesData?.activities || [];
  const measurements = measurementsData?.measurements || [];
  const careItems = careData?.items || [];
  const appointments = careData?.appointments || [];
  const complianceRate = client.compliancePercent ?? 0;

  function getActivityIcon(type: string) {
    switch (type) {
      case 'meal_logged':      return <Utensils className="w-4 h-4" />;
      case 'weight_update':   return <Weight className="w-4 h-4" />;
      case 'login':           return <LogIn className="w-4 h-4" />;
      case 'plan_assigned':   return <Calendar className="w-4 h-4" />;
      case 'badge_unlocked':  return <CheckCircle2 className="w-4 h-4" />;
      case 'streak_milestone':return <Activity className="w-4 h-4" />;
      case 'streak_at_risk':  return <Clock3 className="w-4 h-4" />;
      case 'compliance':      return <CheckCircle2 className="w-4 h-4" />;
      default:                return <Activity className="w-4 h-4" />;
    }
  }

  function getActivityColorClass(type: string): string {
    switch (type) {
      case 'meal_logged':      return 'bg-emerald-500/10 text-emerald-600';
      case 'weight_update':   return 'bg-primary/10 text-primary';
      case 'badge_unlocked':  return 'bg-amber-500/10 text-amber-600';
      case 'streak_milestone':return 'bg-orange-500/10 text-orange-600';
      case 'streak_at_risk':  return 'bg-destructive/10 text-destructive';
      case 'plan_assigned':   return 'bg-primary/10 text-primary';
      case 'compliance':      return 'bg-emerald-500/10 text-emerald-600';
      default:                return 'bg-muted text-muted-foreground';
    }
  }

  function getActivityTitle(type: string): string {
    switch (type) {
      case 'meal_logged':      return 'Öğün tamamlandı';
      case 'weight_update':   return 'Ölçüm kaydedildi';
      case 'login':           return 'Uygulamaya giriş';
      case 'plan_assigned':   return 'Plan atandı';
      case 'badge_unlocked':  return 'Rozet kazanıldı';
      case 'streak_milestone':return 'Seri başarısı';
      case 'streak_at_risk':  return 'Seri risk altında';
      case 'compliance':      return 'Günlük uyum';
      default:                return 'Aktivite';
    }
  }

  function getActivityDescription(activity: any): string {
    const meta = typeof activity.metadata === 'string'
      ? tryParseJson(activity.metadata)
      : activity.metadata;
    switch (activity.type) {
      case 'meal_logged':
        return meta?.mealName ? `${meta.mealName}` : 'Öğün kaydedildi';
      case 'weight_update':
        return meta?.weight != null
          ? `${meta.weight} kg${meta.bmi ? ` · BMI ${meta.bmi}` : ''}`
          : meta?.weightKg != null
            ? `${meta.weightKg} kg${meta.bmi ? ` · BMI ${meta.bmi}` : ''}`
            : 'Ölçüm güncellendi';
      case 'login':
        return 'Uygulamaya giriş yaptı';
      case 'plan_assigned':
        return meta?.planName ? `${meta.planName}` : 'Yeni plan atandı';
      case 'badge_unlocked':
        return meta?.badgeId ? `${meta.badgeId}${meta.level > 1 ? ` (Seviye ${meta.level})` : ''}` : 'Rozet';
      case 'streak_milestone':
        return meta?.currentStreak ? `${meta.currentStreak} günlük seri` : 'Seri hedefi aşıldı';
      case 'streak_at_risk':
        return 'Bugünkü seri korunmalı';
      case 'compliance':
        return meta?.isCompliant ? 'Günlük plan tamamlandı' : 'Günlük uyum eksik';
      default:
        return 'Aktivite gerçekleşti';
    }
  }

  function tryParseJson(s: string): any {
    try { return JSON.parse(s); } catch { return null; }
  }

  function formatDateTime(value: string): string {
    return new Date(value).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/clients')}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Danışanlara dön
      </Button>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{client.fullName}</h1>
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold',
                  client.isPremium ? 'bg-action/10 text-action' : 'bg-muted text-muted-foreground'
                )}
              >
                {client.isPremium ? 'Premium' : 'Ücretsiz'}
              </span>
            </div>
            {client.email && <p className="text-sm text-muted-foreground mt-1">{client.email}</p>}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {client.lastMeasurementDate && (
                <span className="text-xs text-muted-foreground">
                  Son ölçüm: {new Date(client.lastMeasurementDate).toLocaleDateString('tr-TR')}
                </span>
              )}
              {client.activePlanName && (
                <span className="text-xs text-primary font-semibold">
                  Plan: {client.activePlanName}
                </span>
              )}
              {!client.activePlanName && (
                <span className="text-xs text-muted-foreground">Plan yok</span>
              )}
            </div>
          </div>

          {/* Clinical mini-cards */}
          <div className="flex flex-wrap gap-3 sm:justify-end">
            {[
              { label: 'Kilo', value: client.latestWeight != null ? `${client.latestWeight.toFixed(1)} kg` : '—' },
              { label: 'Boy', value: client.latestHeight != null ? `${client.latestHeight.toFixed(0)} cm` : '—' },
              { label: 'BMI', value: client.latestBmi != null ? client.latestBmi.toFixed(1) : '—' },
              { label: 'Uyum', value: client.compliancePercent != null ? `%${client.compliancePercent}` : '—' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center px-3 py-2 rounded-xl bg-muted/40 min-w-[60px]">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="text-sm font-bold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <ClientTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Row 1: Compliance + Clinical */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-6 flex flex-col items-center justify-center">
                <ComplianceDonut percentage={complianceRate} />
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Son 7 günlük uyum görünümü
                </p>
              </Card>

              <Card className="p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-foreground mb-4">Klinik özet</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Güncel kilo', value: client.latestWeight != null ? `${client.latestWeight.toFixed(1)} kg` : '—' },
                    { label: 'BMI', value: client.latestBmi != null ? client.latestBmi.toFixed(1) : '—' },
                    { label: 'Boy', value: client.latestHeight != null ? `${client.latestHeight.toFixed(0)} cm` : '—' },
                    { label: 'BMR', value: client.latestBmr != null ? `${Math.round(client.latestBmr)} kcal` : '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-2xl font-bold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
                {client.activePlanName && (
                  <div className="mt-4 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15">
                    <p className="text-xs font-semibold text-primary mb-0.5">Aktif Plan</p>
                    <p className="text-sm font-medium text-foreground">{client.activePlanName}</p>
                    {client.activePlanEndDate && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Bitiş: {new Date(client.activePlanEndDate).toLocaleDateString('tr-TR')}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* Row 2: Motivation & Badges - full width */}
            <MotivationCard motivationData={motivationData ?? null} />
          </div>
        )}

        {activeTab === 'activities' && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Aktivite akışı</h3>
              {activities.length > 0 && (
                <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted">
                  {activities.length} olay
                </span>
              )}
            </div>

            {/* Filter chips */}
            {activities.length > 0 && (
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                {(
                  [
                    { id: 'all',          label: 'Tümü' },
                    { id: 'plan',         label: 'Plan' },
                    { id: 'meals',        label: 'Öğünler' },
                    { id: 'measurements', label: 'Ölçümler' },
                    { id: 'badges',       label: 'Rozetler' },
                  ] as const
                ).map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActivityFilter(f.id)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      activityFilter === f.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {(() => {
              const filtered = activities.filter(a => {
                if (activityFilter === 'all') return true;
                if (activityFilter === 'plan') return ['plan_assigned', 'plan_updated'].includes(a.type);
                if (activityFilter === 'meals') return a.type === 'meal_logged';
                if (activityFilter === 'measurements') return a.type === 'weight_update';
                if (activityFilter === 'badges') return ['badge_unlocked', 'streak_milestone', 'streak_at_risk'].includes(a.type);
                return true;
              });
              return filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground">
                    {activities.length === 0 ? 'Henüz aktivite yok' : 'Bu kategoride aktivite yok'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activities.length === 0
                      ? 'Danışan mobil uygulamayı kullandıkça aktiviteler burada görünür.'
                      : 'Farklı bir filtre seçin.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/20 transition-colors"
                    >
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                        getActivityColorClass(activity.type)
                      )}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium">{getActivityTitle(activity.type)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {getActivityDescription(activity)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {new Date(activity.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        )}

        {activeTab === 'measurements' && (
          <div className="space-y-6">
            {/* Clinical measurement entry form */}
            <Card className="p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Yeni klinik ölçüm ekle</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input
                  label="Kilo (kg)"
                  type="number"
                  placeholder="70.5"
                  value={mWeightKg}
                  onChange={(e) => setMWeightKg(e.target.value)}
                />
                <Input
                  label="Boy (cm)"
                  type="number"
                  placeholder="170"
                  value={mHeightCm}
                  onChange={(e) => setMHeightCm(e.target.value)}
                />
                <Input
                  label="Bel (cm)"
                  type="number"
                  placeholder="80"
                  value={mWaistCm}
                  onChange={(e) => setMWaistCm(e.target.value)}
                />
                <Input
                  label="Kalça (cm)"
                  type="number"
                  placeholder="95"
                  value={mHipCm}
                  onChange={(e) => setMHipCm(e.target.value)}
                />
                <Input
                  label="Göğüs (cm)"
                  type="number"
                  placeholder="90"
                  value={mChestCm}
                  onChange={(e) => setMChestCm(e.target.value)}
                />
                <Input
                  label="Yağ oranı (%)"
                  type="number"
                  placeholder="22"
                  value={mBodyFat}
                  onChange={(e) => setMBodyFat(e.target.value)}
                />
                <Input
                  label="Kas oranı (%)"
                  type="number"
                  placeholder="38"
                  value={mMuscle}
                  onChange={(e) => setMMuscle(e.target.value)}
                />
                <Input
                  label="Su oranı (%)"
                  type="number"
                  placeholder="55"
                  value={mWater}
                  onChange={(e) => setMWater(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <Input
                  label="Ölçüm tarihi (opsiyonel)"
                  type="datetime-local"
                  value={mRecordedAt}
                  onChange={(e) => setMRecordedAt(e.target.value)}
                />
                <Input
                  label="Notlar (opsiyonel)"
                  placeholder="Görüşme notu..."
                  value={mNotes}
                  onChange={(e) => setMNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  variant="action"
                  onClick={() => addMeasurementMutation.mutate()}
                  disabled={
                    addMeasurementMutation.isPending ||
                    (!mWeightKg && !mWaistCm && !mHeightCm)
                  }
                >
                  {addMeasurementMutation.isPending ? 'Kaydediliyor...' : 'Ölçümü kaydet'}
                </Button>
              </div>
            </Card>

            <MeasurementsChart measurements={measurements} />
          </div>
        )}

        {activeTab === 'plan' && <PlanTab clientId={clientId} />}

        {activeTab === 'notes' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <Card className="p-6 space-y-4">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Mobilde gelen notları burada görürsünüz</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Danışan uygulamadaki notlar ekranından mesaj gönderdiğinde bu zaman akışına otomatik olarak düşer.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">İletişim merkezi</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Diyetisyen notlarını, danışan yanıtlarını ve takip ritmini tek ekranda toplayın.
                  </p>
                </div>
                <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {careItems.length} güncelleme
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {composeMode === 'reply' ? (
                    <>
                      <Reply className="w-4 h-4 text-primary" />
                      Yanıt yaz
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-primary" />
                      Hızlı not
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setComposeMode('reply')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                      composeMode === 'reply'
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-background/60 text-muted-foreground'
                    )}
                  >
                    Yanıt
                  </button>
                  <button
                    onClick={() => {
                      setComposeMode('note');
                      setReplyTarget(null);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                      composeMode === 'note'
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-background/60 text-muted-foreground'
                    )}
                  >
                    Klinik not
                  </button>
                </div>

                {replyTarget && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-primary">Danışana yanıt hazırlanıyor</p>
                        <p className="text-sm text-foreground mt-1 line-clamp-2">{replyTarget.text}</p>
                      </div>
                      <button
                        onClick={() => setReplyTarget(null)}
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        Temizle
                      </button>
                    </div>
                  </div>
                )}

                <textarea
                  placeholder={composeMode === 'reply'
                    ? 'Görüşmeyi sürdürecek kısa bir yanıt yaz...'
                    : 'Takip notu, görüşme özeti veya hatırlatma ekle...'}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background resize-none"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {composeMode === 'reply'
                      ? 'Yanıt danışan tarafındaki görüşme akışında hemen görünür.'
                      : 'Bu not paylaşılan bakım zaman çizelgesinde hemen görünür.'}
                  </p>
                  <Button
                    variant="action"
                    onClick={() => {
                      if (composeMode === 'reply') {
                        sendReplyMutation.mutate(noteContent);
                        return;
                      }

                      addNoteMutation.mutate(noteContent);
                    }}
                    disabled={!noteContent.trim() || addNoteMutation.isPending || sendReplyMutation.isPending}
                    className="min-w-28"
                  >
                    {addNoteMutation.isPending || sendReplyMutation.isPending
                      ? 'Gönderiliyor...'
                      : composeMode === 'reply'
                        ? 'Yanıtı gönder'
                        : 'Notu kaydet'}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {careItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background/80 px-5 py-8 text-center">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">Henüz iletişim kaydı yok</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Danışanın zaman çizelgesini başlatmak için ilk notu ekleyin.
                    </p>
                  </div>
                ) : (
                  careItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-2xl border p-4 shadow-sm',
                        item.direction === 'outbound'
                          ? 'border-primary/20 bg-primary/5'
                          : 'border-border bg-background/95'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0',
                              item.direction === 'outbound'
                                ? 'bg-primary/15 text-primary'
                                : 'bg-secondary text-secondary-foreground'
                            )}
                          >
                            {item.direction === 'outbound' ? (
                              <FileText className="w-5 h-5" />
                            ) : (
                              <User className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">
                                {item.direction === 'outbound'
                                  ? item.kind === 'dietitian_reply'
                                    ? 'Diyetisyen yanıtı'
                                    : 'Diyetisyen notu'
                                  : 'Danışan mesajı'}
                              </p>
                              <span className="px-2 py-0.5 rounded-full bg-background/80 text-[11px] text-muted-foreground border border-border">
                                {item.kind === 'dietitian_note'
                                  ? 'Klinik not'
                                  : item.kind === 'dietitian_reply'
                                    ? 'Yanıt'
                                    : 'Mesaj'}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/90 mt-2 leading-6">{item.text}</p>
                            {item.direction === 'inbound' && (
                              <button
                                onClick={() => {
                                  setComposeMode('reply');
                                  setReplyTarget(item);
                                }}
                                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                              >
                                <Reply className="w-3.5 h-3.5" />
                                Bu mesaja yanıt yaz
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground min-w-28">
                          <p>{formatDateTime(item.createdAtUtc)}</p>
                          <p className="mt-1">{item.author}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Görüşme planla</h3>
                </div>
                <Input
                  label="Görüşme başlığı"
                  placeholder="Haftalık beslenme kontrolü"
                  value={appointmentTitle}
                  onChange={(e) => setAppointmentTitle(e.target.value)}
                />
                <Input
                  label="Tarih ve saat"
                  type="datetime-local"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                />
                <Input
                  label="Konum veya bağlantı"
                  placeholder="Google Meet / Muayene odası"
                  value={appointmentLocation}
                  onChange={(e) => setAppointmentLocation(e.target.value)}
                />
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => addAppointmentMutation.mutate()}
                  disabled={!appointmentTitle.trim() || !appointmentTime || addAppointmentMutation.isPending}
                >
                  {addAppointmentMutation.isPending ? 'Planlanıyor...' : 'Görüşmeyi kaydet'}
                </Button>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Yaklaşan görüşmeler</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Danışan takibini düzenli görüşmelerle canlı tutun.
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-action/10 text-action text-xs font-semibold">
                    {appointments.length} aktif
                  </div>
                </div>

                {appointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background/80 px-5 py-8 text-center">
                    <Clock3 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">Planlı görüşme yok</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Takibi daha düzenli hale getirmek için yeni bir görüşme ekleyin.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="rounded-2xl border border-border bg-background/95 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{appointment.title}</p>
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                                {appointment.mode}
                              </span>
                              {appointment.attendanceStatus === 'attended' && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600 text-[11px] font-semibold">
                                  Gitti
                                </span>
                              )}
                              {appointment.attendanceStatus === 'missed' && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/14 text-amber-700 text-[11px] font-semibold">
                                  Gitmedi
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(appointment.scheduledAtUtc)}
                            </p>
                            {appointment.attendanceMarkedAtUtc && (
                              <p className="text-[11px] text-muted-foreground">
                                Durum bildirimi: {formatDateTime(appointment.attendanceMarkedAtUtc)}
                              </p>
                            )}
                            {appointment.location && (
                              <p className="text-xs text-muted-foreground">{appointment.location}</p>
                            )}
                            {appointment.note && (
                              <p className="text-xs text-foreground/80">{appointment.note}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            className="text-danger hover:text-danger"
                            onClick={() => cancelAppointmentMutation.mutate(appointment.id)}
                            disabled={cancelAppointmentMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Badge definitions ────────────────────────────────────────────────────────

const BADGE_DEFS: Record<string, { emoji: string; name: string; desc: string; color: string }> = {
  streak_3:     { emoji: '🔥', name: '3 Günlük Ateş',    desc: '3 gün üst üste',        color: 'from-orange-500/20 to-red-500/10 border-orange-400/30' },
  streak_7:     { emoji: '⚡', name: 'Haftalık Güç',      desc: '7 gün üst üste',        color: 'from-yellow-500/20 to-amber-500/10 border-yellow-400/30' },
  streak_14:    { emoji: '💎', name: '2 Hafta Ustası',    desc: '14 gün üst üste',       color: 'from-cyan-500/20 to-blue-500/10 border-cyan-400/30' },
  perfect_day:  { emoji: '⭐', name: 'Mükemmel Gün',      desc: 'Tüm öğünler tamamlandı', color: 'from-yellow-400/20 to-amber-400/10 border-yellow-300/30' },
  protein_focus:{ emoji: '💪', name: 'Protein Odağı',     desc: 'Yüksek protein hedefi', color: 'from-violet-500/20 to-purple-500/10 border-violet-400/30' },
  veggie_focus: { emoji: '🥦', name: 'Sebze Dostu',       desc: 'Sebze odaklı öğünler',  color: 'from-green-500/20 to-emerald-500/10 border-green-400/30' },
  kitchen_spark:{ emoji: '🍳', name: 'Mutfak Kıvılcımı', desc: '5 gün mutfak aktif',    color: 'from-orange-400/20 to-yellow-400/10 border-orange-300/30' },
  water_keeper: { emoji: '💧', name: 'Su Dengesi',        desc: '3 gün su hedefi',       color: 'from-sky-500/20 to-blue-400/10 border-sky-400/30' },
  flex_saver:   { emoji: '🔄', name: 'Esnek Çözüm',       desc: 'Alternatif öğün ustası', color: 'from-teal-500/20 to-cyan-500/10 border-teal-400/30' },
  plan_keeper:  { emoji: '📋', name: 'Plan Sadakati',     desc: 'Haftada 5 gün uyum',    color: 'from-indigo-500/20 to-blue-500/10 border-indigo-400/30' },
};

const BADGE_ORDER = [
  'streak_3', 'streak_7', 'streak_14',
  'perfect_day', 'protein_focus', 'veggie_focus',
  'kitchen_spark', 'water_keeper', 'flex_saver', 'plan_keeper',
];

// ─── Motivation Card ──────────────────────────────────────────────────────────

function MotivationCard({ motivationData }: { motivationData: ClientGamificationSummary | null }) {
  const streak      = motivationData?.currentStreak ?? 0;
  const bestStreak  = motivationData?.bestStreak ?? 0;
  const atRisk      = motivationData?.streakAtRisk ?? false;
  const nextDays    = motivationData?.nextMilestoneDays ?? null;
  const badgeCount  = motivationData?.earnedBadgeCount ?? 0;
  const totalBadges = motivationData?.totalBadgeCount ?? BADGE_ORDER.length;
  const recent      = new Set<string>(motivationData?.recentUnlocks ?? []);

  // Progress to next milestone
  const nextMilestone = [3, 7, 14].find(m => m > streak) ?? 14;
  const prevMilestone = [0, 3, 7].filter(m => m <= streak).at(-1) ?? 0;
  const milestoneProgress = nextMilestone > prevMilestone
    ? Math.round(((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100;
  const nextBadge = streak >= 14 ? null : streak >= 7 ? BADGE_DEFS.streak_14 : streak >= 3 ? BADGE_DEFS.streak_7 : BADGE_DEFS.streak_3;
  const daysToNext = nextMilestone - streak;

  const streakEmoji = streak === 0 ? '💤' : atRisk ? '⚠️' : streak >= 14 ? '💎' : streak >= 7 ? '⚡' : '🔥';

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]">

        {/* Left: Streak panel */}
        <div className={cn(
          'p-6 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-border/50',
          atRisk
            ? 'bg-gradient-to-br from-amber-500/8 to-red-500/5'
            : streak > 0
              ? 'bg-gradient-to-br from-primary/8 to-primary/3'
              : 'bg-muted/20'
        )}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Motivasyon
            </span>
            {atRisk && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 border border-amber-400/25">
                Risk
              </span>
            )}
          </div>

          {/* Big streak counter */}
          <div className="flex items-end gap-3">
            <span className="text-5xl" role="img" aria-label="streak">{streakEmoji}</span>
            <div>
              <p className="text-5xl font-black text-foreground leading-none">{streak}</p>
              <p className="text-sm text-muted-foreground mt-1">günlük seri</p>
            </div>
          </div>

          {/* Risk message or normal status */}
          {atRisk ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2">
              <p className="text-xs font-semibold text-amber-700">
                {motivationData?.atRiskReason || 'Seri bugün korunmalı, henüz plan tamamlanmadı.'}
              </p>
            </div>
          ) : streak > 0 ? (
            <p className="text-sm text-muted-foreground">
              En iyi: <span className="font-semibold text-foreground">{bestStreak} gün</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Seri henüz başlamadı.</p>
          )}

          {/* Progress to next milestone */}
          {nextBadge && streak < 14 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Sonraki rozet</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  {nextBadge.emoji} {nextBadge.name}
                </span>
              </div>
              <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-2 rounded-full transition-all', atRisk ? 'bg-amber-500' : 'bg-primary')}
                  style={{ width: `${milestoneProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-right">
                {daysToNext} gün kaldı
              </p>
            </div>
          )}

          {streak >= 14 && (
            <div className="flex items-center gap-2 text-xs text-cyan-600 font-semibold">
              <span>💎</span> En yüksek seri rozetini taşıyor!
            </div>
          )}

          {/* Badge count summary */}
          <div className="mt-auto pt-2 flex items-center gap-3 border-t border-border/40">
            <div>
              <p className="text-2xl font-bold text-foreground">{badgeCount}</p>
              <p className="text-[11px] text-muted-foreground">/ {totalBadges} rozet</p>
            </div>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-primary/60"
                style={{ width: totalBadges > 0 ? `${Math.round((badgeCount / totalBadges) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* Right: Badge wall */}
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-4">
            Rozet koleksiyonu
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {BADGE_ORDER.map((id) => {
              const def = BADGE_DEFS[id];
              const earned = recent.has(id);
              return (
                <div
                  key={id}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all select-none',
                    earned
                      ? `bg-gradient-to-b ${def.color} shadow-sm`
                      : 'border-border/40 bg-muted/20 opacity-40 grayscale'
                  )}
                  title={def.desc}
                >
                  <span className="text-3xl leading-none" role="img" aria-label={def.name}>
                    {def.emoji}
                  </span>
                  <span className={cn(
                    'text-[11px] font-semibold text-center leading-tight',
                    earned ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {def.name}
                  </span>
                  {earned && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/20 text-primary border border-primary/20">
                      Kazanıldı
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {recent.size === 0 && badgeCount === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Danışan henüz rozet kazanmadı.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
