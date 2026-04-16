'use client';

import { useEffect, useState } from 'react';
import { Bell, CalendarClock, KeyRound, MessageSquare, TimerReset, TrendingUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsSaveBar } from '@/components/settings/SettingsSaveBar';
import { ToggleSwitch } from '@/components/settings/ToggleSwitch';

const STORAGE_KEY = 'mydietitian-web-panel-notification-preferences';

type NotificationPreferences = {
  careHubAlerts: boolean;
  planPublishReminders: boolean;
  lowComplianceAlerts: boolean;
  accessKeyAlerts: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
};

const defaultPreferences: NotificationPreferences = {
  careHubAlerts: true,
  planPublishReminders: true,
  lowComplianceAlerts: true,
  accessKeyAlerts: true,
  dailySummary: false,
  weeklySummary: true,
};

export default function NotificationsPage() {
  const [savedPreferences, setSavedPreferences] =
    useState<NotificationPreferences>(defaultPreferences);
  const [draftPreferences, setDraftPreferences] =
    useState<NotificationPreferences>(defaultPreferences);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (storedValue) {
      try {
        const parsed = JSON.parse(storedValue) as NotificationPreferences;
        setSavedPreferences(parsed);
        setDraftPreferences(parsed);
      } catch {
        setSavedPreferences(defaultPreferences);
        setDraftPreferences(defaultPreferences);
      }
    }

    setIsLoaded(true);
  }, []);

  const updateDraft = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setDraftPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const isDirty = JSON.stringify(savedPreferences) !== JSON.stringify(draftPreferences);

  const handleSave = async () => {
    setIsSaving(true);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 250);
    });

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draftPreferences));
    setSavedPreferences(draftPreferences);
    setIsSaving(false);
    toast.success('Bildirim tercihleri kaydedildi.');
  };

  const handleDiscard = () => {
    setDraftPreferences(savedPreferences);
    toast.success('Bildirim tercihleri geri alındı.');
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <p className="text-sm text-slate-500">Bildirim tercihleri hazırlanıyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <SettingsCard
            icon={Bell}
            title="Operasyon bildirimleri"
            description="Panel içinde görmek istediğiniz günlük uyarılar."
            className="rounded-[28px] border-emerald-100 shadow-[0_16px_48px_-40px_rgba(16,185,129,0.35)]"
          >
            <div className="divide-y divide-slate-100">
              <ToggleSwitch
                checked={draftPreferences.careHubAlerts}
                onChange={(value) => updateDraft('careHubAlerts', value)}
                label="Care Hub yeni mesaj uyarıları"
                description="Yanıt bekleyen yeni hasta mesajları için panel içinde öne çıkan uyarılar gösterilir."
                icon={MessageSquare}
              />
              <ToggleSwitch
                checked={draftPreferences.planPublishReminders}
                onChange={(value) => updateDraft('planPublishReminders', value)}
                label="Plan yayınlama hatırlatmaları"
                description="Taslakta bekleyen öğün planları için hatırlatma kartları gösterilir."
                icon={CalendarClock}
              />
              <ToggleSwitch
                checked={draftPreferences.lowComplianceAlerts}
                onChange={(value) => updateDraft('lowComplianceAlerts', value)}
                label="Düşük uyum uyarıları"
                description="Uyum seviyesi dikkat gerektiren danışanlar dashboard üzerinde öne çıkarılır."
                icon={TrendingUp}
              />
              <ToggleSwitch
                checked={draftPreferences.accessKeyAlerts}
                onChange={(value) => updateDraft('accessKeyAlerts', value)}
                label="Erişim anahtarı bilgilendirmeleri"
                description="Süresi yaklaşan veya yeni oluşturulan premium anahtarlar için hatırlatma sunulur."
                icon={KeyRound}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={TimerReset}
            title="Özet tercihleri"
            description="Panele giriş yaptığınızda görmek istediğiniz özet kartları."
            className="rounded-[28px] border-slate-200 shadow-sm"
          >
            <div className="divide-y divide-slate-100">
              <ToggleSwitch
                checked={draftPreferences.dailySummary}
                onChange={(value) => updateDraft('dailySummary', value)}
                label="Günlük operasyon özeti"
                description="Günün plan, mesaj ve danışan takibi özetini ilk açılışta ön plana çıkarır."
              />
              <ToggleSwitch
                checked={draftPreferences.weeklySummary}
                onChange={(value) => updateDraft('weeklySummary', value)}
                label="Haftalık performans özeti"
                description="Haftalık plan akışı ve takip performansı için özet görünümü gösterir."
              />
            </div>
          </SettingsCard>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-slate-50 p-6 shadow-[0_16px_48px_-40px_rgba(14,165,233,0.22)]">
            <h2 className="text-base font-semibold text-slate-900">Tercihlerin kapsamı</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Bu ekran şimdilik web panel davranışlarını bu tarayıcı için düzenler. Merkezi
              bildirim servisi devreye alındığında tercihler hesap bazlı olarak senkronlanacaktır.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Öneri</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Yoğun klinik kullanımında Care Hub, düşük uyum ve plan yayınlama hatırlatmalarını açık
              tutmanız günlük operasyon yönetimini kolaylaştırır.
            </p>
          </div>
        </div>
      </div>

      <SettingsSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saveLabel="Bildirim tercihlerini kaydet"
      />
    </div>
  );
}
