'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Check,
  ImagePlus,
  Palette,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useBranding } from '@/contexts/BrandingContext';
import { PRESET_THEMES, ThemePreset } from '@/lib/constants/themes';
import { cn } from '@/lib/utils';
import {
  deleteLogo,
  type DietitianSettings,
  updateSettings,
  uploadLogo,
} from '@/lib/api/settings';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsSaveBar } from '@/components/settings/SettingsSaveBar';

const brandingSchema = z.object({
  primaryColorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Geçerli bir ana renk girin.'),
  accentColorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Geçerli bir vurgu rengi girin.'),
  themePresetKey: z.string().nullable().optional(),
});

type BrandingFormData = z.infer<typeof brandingSchema>;

function isHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function findPreset(primaryColorHex: string, accentColorHex: string) {
  return (
    PRESET_THEMES.find(
      (preset) =>
        preset.primary.toUpperCase() === primaryColorHex.toUpperCase() &&
        preset.accent.toUpperCase() === accentColorHex.toUpperCase()
    ) ?? null
  );
}

function buildPreviewSettings(
  settings: DietitianSettings | null,
  values: BrandingFormData,
  logoUrl: string | null
): DietitianSettings | null {
  if (!settings) {
    return null;
  }

  return {
    ...settings,
    primaryColorHex: values.primaryColorHex.toUpperCase(),
    accentColorHex: values.accentColorHex.toUpperCase(),
    themePresetKey: values.themePresetKey ?? null,
    logoUrl,
  };
}

export default function BrandingPage() {
  const queryClient = useQueryClient();
  const {
    settings,
    isLoading,
    applyBranding,
    previewBranding,
    restoreBranding,
  } = useBranding();

  const form = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      primaryColorHex: '#4A7C59',
      accentColorHex: '#8FBC8F',
      themePresetKey: 'sage',
    },
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [isLogoMarkedForRemoval, setIsLogoMarkedForRemoval] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) {
      return;
    }

    form.reset({
      primaryColorHex: settings.primaryColorHex,
      accentColorHex: settings.accentColorHex,
      themePresetKey:
        settings.themePresetKey ??
        findPreset(settings.primaryColorHex, settings.accentColorHex)?.key ??
        null,
    });
    setLogoPreviewUrl(settings.logoUrl ?? null);
    setIsLogoMarkedForRemoval(false);
    setLastSavedAt(settings.updatedAt);
  }, [form, settings]);

  useEffect(() => {
    return () => {
      if (logoObjectUrl) {
        URL.revokeObjectURL(logoObjectUrl);
      }
      restoreBranding();
    };
  }, [logoObjectUrl, restoreBranding]);

  const primaryColorHex = form.watch('primaryColorHex');
  const accentColorHex = form.watch('accentColorHex');
  const selectedPresetKey = form.watch('themePresetKey');

  const selectedPreset = useMemo(
    () => PRESET_THEMES.find((preset) => preset.key === selectedPresetKey) ?? null,
    [selectedPresetKey]
  );

  const effectiveLogoUrl = isLogoMarkedForRemoval
    ? null
    : logoObjectUrl || logoPreviewUrl || settings?.logoUrl || null;

  const previewSettings = useMemo(
    () =>
      isHexColor(primaryColorHex) && isHexColor(accentColorHex)
        ? buildPreviewSettings(
            settings,
            {
              primaryColorHex,
              accentColorHex,
              themePresetKey: selectedPresetKey ?? null,
            },
            effectiveLogoUrl
          )
        : null,
    [accentColorHex, effectiveLogoUrl, primaryColorHex, selectedPresetKey, settings]
  );

  useEffect(() => {
    if (previewSettings) {
      previewBranding(previewSettings);
      return;
    }

    restoreBranding();
  }, [previewBranding, previewSettings, restoreBranding]);

  const isDirty = form.formState.isDirty || logoFile !== null || isLogoMarkedForRemoval;

  const updatePresetSelection = (primary: string, accent: string) => {
    const matchedPreset = findPreset(primary, accent);
    form.setValue('themePresetKey', matchedPreset?.key ?? null, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handlePresetSelect = (preset: ThemePreset) => {
    form.setValue('primaryColorHex', preset.primary, { shouldDirty: true, shouldValidate: true });
    form.setValue('accentColorHex', preset.accent, { shouldDirty: true, shouldValidate: true });
    form.setValue('themePresetKey', preset.key, { shouldDirty: true, shouldValidate: true });
  };

  const handleColorInputChange =
    (field: 'primaryColorHex' | 'accentColorHex') => (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value.toUpperCase();
      form.setValue(field, nextValue, { shouldDirty: true, shouldValidate: true });
      const nextPrimary = field === 'primaryColorHex' ? nextValue : form.getValues('primaryColorHex');
      const nextAccent = field === 'accentColorHex' ? nextValue : form.getValues('accentColorHex');
      updatePresetSelection(nextPrimary, nextAccent);
    };

  const resetLogoObjectUrl = () => {
    if (logoObjectUrl) {
      URL.revokeObjectURL(logoObjectUrl);
      setLogoObjectUrl(null);
    }
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Yalnızca PNG, JPG veya WebP dosyaları kullanılabilir.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo dosyası en fazla 2 MB olabilir.');
      return;
    }

    resetLogoObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    setLogoObjectUrl(objectUrl);
    setLogoFile(file);
    setIsLogoMarkedForRemoval(false);
  };

  const handleMarkLogoForRemoval = () => {
    resetLogoObjectUrl();
    setLogoFile(null);
    setIsLogoMarkedForRemoval(true);
  };

  const handleDiscard = () => {
    if (!settings) {
      return;
    }

    form.reset({
      primaryColorHex: settings.primaryColorHex,
      accentColorHex: settings.accentColorHex,
      themePresetKey:
        settings.themePresetKey ??
        findPreset(settings.primaryColorHex, settings.accentColorHex)?.key ??
        null,
    });
    resetLogoObjectUrl();
    setLogoFile(null);
    setLogoPreviewUrl(settings.logoUrl ?? null);
    setIsLogoMarkedForRemoval(false);
    restoreBranding();
    toast.success('Marka ayarları geri alındı.');
  };

  const handleSave = async () => {
    if (!settings) {
      return;
    }

    const isValid = await form.trigger();
    if (!isValid) {
      return;
    }

    setIsSaving(true);

    try {
      let nextSettings: DietitianSettings = settings;

      if (isLogoMarkedForRemoval && settings.logoUrl) {
        nextSettings = await deleteLogo();
      } else if (logoFile) {
        nextSettings = await uploadLogo(logoFile);
      }

      const values = form.getValues();

      nextSettings = await updateSettings({
        clinicName: nextSettings.clinicName,
        dietitianDisplayName: nextSettings.dietitianDisplayName,
        primaryColorHex: values.primaryColorHex.toUpperCase(),
        accentColorHex: values.accentColorHex.toUpperCase(),
        themePresetKey: values.themePresetKey ?? null,
        phoneNumber: nextSettings.phoneNumber ?? null,
        bio: nextSettings.bio ?? null,
        websiteUrl: nextSettings.websiteUrl ?? null,
      });

      queryClient.setQueryData(['settings'], nextSettings);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      applyBranding(nextSettings);

      form.reset({
        primaryColorHex: nextSettings.primaryColorHex,
        accentColorHex: nextSettings.accentColorHex,
        themePresetKey:
          nextSettings.themePresetKey ??
          findPreset(nextSettings.primaryColorHex, nextSettings.accentColorHex)?.key ??
          null,
      });

      resetLogoObjectUrl();
      setLogoFile(null);
      setLogoPreviewUrl(nextSettings.logoUrl ?? null);
      setIsLogoMarkedForRemoval(false);
      setLastSavedAt(nextSettings.updatedAt);
      toast.success('Marka ve tema ayarları kaydedildi.');
    } catch {
      toast.error('Marka ayarları kaydedilemedi.');
      restoreBranding();
    } finally {
      setIsSaving(false);
    }
  };

  const themeGuide = [
    {
      title: 'Yan menü ve aktif durumlar',
      description: 'Seçtiğin ana renk aktif menü, filtre chipleri ve ana aksiyonlarda kullanılır.',
    },
    {
      title: 'Kart yüzeyleri ve glow katmanı',
      description: 'Yumuşak gölgeler ve arka plan parlamaları aynı paletten türetilir.',
    },
    {
      title: 'İkincil vurgu ve bilgi alanları',
      description: 'Vurgu rengi bilgilendirme kartları, rozetler ve öne çıkan ikincil alanlarda görünür.',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[30px] border border-[var(--border-default)] bg-[var(--surface-raised)]">
        <p className="text-sm text-muted-foreground">Marka ayarları yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[32px] border border-[var(--border-emerald-dim)] bg-[var(--surface-raised)] shadow-[var(--shadow-card)]">
            <div className="grid gap-5 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-7">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-emerald-dim)] bg-[var(--brand-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-emerald)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Canlı marka sistemi
                </div>
                <div>
                  <h1 className="text-[1.9rem] font-bold tracking-[-0.04em] text-foreground">
                    Panel kimliğini seçtiğin tema ile bütünleştir
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                    Burada seçtiğin palet yalnızca bir ön izleme değil; yan menüden butonlara, kartlardan
                    bilgi yüzeylerine kadar panelin tamamında aynı tasarım dilini oluşturur.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Seçili tema
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {selectedPreset?.name || 'Özel renk kurgusu'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {selectedPreset?.description ||
                      'Ana ve vurgu rengi birbirine özel ayarlandığı için kişiselleştirilmiş görünüm kullanılıyor.'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-[var(--border-default)] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Tema imzası
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <span
                      className="h-11 flex-1 rounded-2xl border border-white/80 shadow-sm"
                      style={{ backgroundColor: primaryColorHex }}
                    />
                    <span
                      className="h-11 flex-1 rounded-2xl border border-white/80 shadow-sm"
                      style={{ backgroundColor: accentColorHex }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <SettingsCard
            icon={Palette}
            title="Hazır tema paletleri"
            description="Diyetisyen panelinin farklı tonlarını hızlıca deneyebilmen için dengeli kombinasyonlar hazırladık."
            className="shadow-[var(--shadow-card)]"
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PRESET_THEMES.map((preset) => {
                const isSelected = selectedPreset?.key === preset.key;

                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={cn(
                      'group relative rounded-[26px] border p-4 text-left transition-all duration-200',
                      isSelected
                        ? 'border-[var(--border-emerald)] bg-[var(--brand-primary-softer)] shadow-[var(--shadow-emerald-sm)]'
                        : 'border-[var(--border-default)] bg-white hover:-translate-y-0.5 hover:border-[var(--border-emerald-dim)] hover:shadow-[var(--shadow-card)]'
                    )}
                  >
                    <div className="mb-4 flex gap-2">
                      <span
                        className="h-11 flex-1 rounded-2xl border border-white/80 shadow-sm"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <span
                        className="h-11 flex-1 rounded-2xl border border-white/80 shadow-sm"
                        style={{ backgroundColor: preset.accent }}
                      />
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{preset.name}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{preset.description}</p>
                      </div>

                      {isSelected ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)] shadow-[var(--shadow-emerald-sm)]">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Palette}
            title="Renk sistemi"
            description="Hazır paleti seçebilir ya da ana rengi ve vurgu rengini manuel belirleyebilirsin."
          >
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">Ana renk</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColorHex}
                      onChange={handleColorInputChange('primaryColorHex')}
                      className="h-12 w-16 rounded-2xl border border-slate-200 bg-white p-1"
                    />
                    <input
                      type="text"
                      value={primaryColorHex}
                      onChange={handleColorInputChange('primaryColorHex')}
                      className="input-sfcos rounded-2xl"
                    />
                  </div>
                  {form.formState.errors.primaryColorHex ? (
                    <p className="mt-2 text-xs font-medium text-rose-600">
                      {form.formState.errors.primaryColorHex.message}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Yan menü aktif durumu, ana butonlar ve baskın başlık alanlarında kullanılır.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">Vurgu rengi</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={accentColorHex}
                      onChange={handleColorInputChange('accentColorHex')}
                      className="h-12 w-16 rounded-2xl border border-slate-200 bg-white p-1"
                    />
                    <input
                      type="text"
                      value={accentColorHex}
                      onChange={handleColorInputChange('accentColorHex')}
                      className="input-sfcos rounded-2xl"
                    />
                  </div>
                  {form.formState.errors.accentColorHex ? (
                    <p className="mt-2 text-xs font-medium text-rose-600">
                      {form.formState.errors.accentColorHex.message}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Rozetler, yardımcı bilgi kartları ve ikincil CTA tonlarında görünür.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wand2 className="h-4 w-4 text-[var(--brand-emerald)]" />
                  Tema bu alanlarda hissedilir
                </div>
                <div className="space-y-3">
                  {themeGuide.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-[var(--border-default)] bg-white px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={ImagePlus}
            title="Logo yönetimi"
            description="Klinik logon panelin üst bölümlerinde, kart kapaklarında ve marka yüzeylerinde kullanılacak."
          >
            <div className="space-y-5">
              <div className="rounded-[26px] border border-dashed border-[var(--border-emerald)] bg-[var(--brand-primary-softer)] p-5">
                {effectiveLogoUrl ? (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-3 shadow-sm">
                        <img
                          src={effectiveLogoUrl}
                          alt="Klinik logosu"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Logo hazır</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Yüklediğin görsel menü, üst alan ve ön izleme yüzeylerinde kullanılacak.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleMarkLogoForRemoval}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Logoyu kaldır
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Henüz logo eklenmedi</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Kare ya da yatay oranlı, temiz arka plana sahip bir logo en iyi sonucu verir.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[var(--border-default)] bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Yeni logo yükle</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Maksimum dosya boyutu 2 MB. Saydam arka planlı PNG en temiz görünümü sağlar.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-[var(--surface-overlay)]">
                  <ImagePlus className="h-4 w-4 text-[var(--brand-emerald)]" />
                  Logo seç
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleLogoChange}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </SettingsCard>
        </div>

        <div className="space-y-6">
          <div className="sticky top-6 space-y-5 rounded-[32px] border border-[var(--border-emerald-dim)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Canlı ön izleme</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Renklerin panel hissine etkisini burada anında görebilirsin.
                </p>
              </div>
              {lastSavedAt ? (
                <span className="rounded-full bg-[var(--surface-overlay)] px-3 py-1 text-xs font-medium text-muted-foreground">
                  Son kayıt: {new Date(lastSavedAt).toLocaleString('tr-TR')}
                </span>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-white shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 text-[var(--brand-primary-contrast)]"
                style={{ backgroundColor: primaryColorHex }}
              >
                <div className="flex items-center gap-3">
                  {effectiveLogoUrl ? (
                    <img
                      src={effectiveLogoUrl}
                      alt="Logo ön izlemesi"
                      className="h-10 w-10 rounded-xl bg-white p-1 object-contain"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm font-bold">
                      {(settings?.clinicName || 'K').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-semibold">{settings?.clinicName || 'Klinik adı'}</p>
                    <p className="text-xs opacity-80">
                      {settings?.dietitianDisplayName || 'Diyetisyen'}
                    </p>
                  </div>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
                  style={{ backgroundColor: accentColorHex, color: 'var(--brand-accent-contrast)' }}
                >
                  Aktif görünüm
                </span>
              </div>

              <div className="space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-overlay)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Yan menü
                    </p>
                    <div className="mt-3 space-y-2">
                      <div
                        className="rounded-2xl px-3 py-2 text-sm font-semibold"
                        style={{ background: 'var(--brand-primary-soft)', color: 'var(--brand-emerald)' }}
                      >
                        Aktif sekme
                      </div>
                      <div className="rounded-2xl border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-slate-600">
                        Pasif sekme
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border-default)] bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Bilgi vurgusu
                    </p>
                    <div className="mt-3 space-y-2">
                      <div
                        className="rounded-2xl px-3 py-2 text-sm font-semibold"
                        style={{
                          backgroundColor: accentColorHex,
                          color: 'var(--brand-accent-contrast)',
                        }}
                      >
                        Vurgu kartı
                      </div>
                      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-slate-600">
                        Destekleyici içerik
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--border-default)] bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Dashboard kartı
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Günlük operasyon özeti</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Danışan takibi, plan akışı ve ekip iletişimi seçtiğin ton ailesiyle daha tutarlı görünür.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm"
                    style={{
                      backgroundColor: primaryColorHex,
                      color: 'var(--brand-primary-contrast)',
                    }}
                  >
                    Birincil buton
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl px-4 py-3 text-sm font-semibold"
                    style={{
                      backgroundColor: accentColorHex,
                      color: 'var(--brand-accent-contrast)',
                    }}
                  >
                    İkincil vurgu
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Renk özeti
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Ana renk</span>
                  <span className="font-medium text-slate-900">{primaryColorHex}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Vurgu rengi</span>
                  <span className="font-medium text-slate-900">{accentColorHex}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Seçili tema</span>
                  <span className="font-medium text-slate-900">
                    {selectedPreset?.name || 'Özel renkler'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SettingsSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saveLabel="Marka ayarlarını kaydet"
      />
    </div>
  );
}
