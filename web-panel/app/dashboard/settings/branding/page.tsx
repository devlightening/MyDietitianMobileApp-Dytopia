'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Check, ImagePlus, Palette, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { applyBrandingToDom } from '@/lib/branding/applyBranding';
import { PRESET_THEMES, ThemePreset } from '@/lib/constants/themes';
import { cn } from '@/lib/utils';
import {
  deleteLogo,
  getSettings,
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

function findPreset(primaryColorHex: string, accentColorHex: string) {
  return (
    PRESET_THEMES.find(
      (preset) =>
        preset.primary.toUpperCase() === primaryColorHex.toUpperCase() &&
        preset.accent.toUpperCase() === accentColorHex.toUpperCase()
    ) ?? null
  );
}

export default function BrandingPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

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
    };
  }, [logoObjectUrl]);

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

  const isDirty =
    form.formState.isDirty || logoFile !== null || isLogoMarkedForRemoval || false;

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
    setLogoObjectUrl(null);
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
      applyBrandingToDom(nextSettings);

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
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <p className="text-sm text-slate-500">Marka ayarları yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <SettingsCard
            icon={Palette}
            title="Hazır tema paletleri"
            description="Klinik görünümünüz için hızlı ve dengeli renk kombinasyonları."
            className="rounded-[28px] border-emerald-100 shadow-[0_16px_48px_-40px_rgba(16,185,129,0.35)]"
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
                      'relative rounded-3xl border p-4 text-left transition-all',
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50'
                    )}
                  >
                    {isSelected ? (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                    <div className="mb-4 flex gap-2">
                      <span
                        className="h-10 flex-1 rounded-2xl border border-white/80 shadow-sm"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <span
                        className="h-10 flex-1 rounded-2xl border border-white/80 shadow-sm"
                        style={{ backgroundColor: preset.accent }}
                      />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{preset.name}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Palette}
            title="Renk ayarları"
            description="Hazır temaları kullanabilir veya kendi renklerinizi belirleyebilirsiniz."
            className="rounded-[28px] border-slate-200 shadow-sm"
          >
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
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
                {form.formState.errors.primaryColorHex ? (
                  <p className="mt-2 text-xs font-medium text-rose-600">
                    {form.formState.errors.primaryColorHex.message}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Menü aktif durumu ve ana aksiyon butonlarında kullanılır.
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
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
                {form.formState.errors.accentColorHex ? (
                  <p className="mt-2 text-xs font-medium text-rose-600">
                    {form.formState.errors.accentColorHex.message}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Rozetler, ikincil butonlar ve görsel vurgularda kullanılır.
                  </p>
                )}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={ImagePlus}
            title="Logo yönetimi"
            description="Panelin üst alanlarında ve kurumsal yüzeylerde kullanılacak logoyu belirleyin."
            className="rounded-[28px] border-slate-200 shadow-sm"
          >
            <div className="space-y-5">
              <div className="rounded-[24px] border border-dashed border-emerald-200 bg-emerald-50/40 p-5">
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
                          PNG, JPG veya WebP formatında yüklediğiniz görsel kullanılacak.
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

              <div>
                <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  <ImagePlus className="h-4 w-4 text-emerald-600" />
                  Logo seç
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleLogoChange}
                    className="sr-only"
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  Maksimum dosya boyutu 2 MB. Önerilen format: saydam arka planlı PNG.
                </p>
              </div>
            </div>
          </SettingsCard>
        </div>

        <div className="space-y-6">
          <div className="sticky top-6 rounded-[28px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/50 to-slate-50 p-6 shadow-[0_16px_48px_-38px_rgba(16,185,129,0.35)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Canlı ön izleme</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Seçtiğiniz renklerin panel hissine etkisi
                </p>
              </div>
              {lastSavedAt ? (
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                  Son kayıt: {new Date(lastSavedAt).toLocaleString('tr-TR')}
                </span>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
                <div
                  className="flex items-center justify-between px-4 py-3 text-white"
                  style={{ backgroundColor: primaryColorHex }}
                >
                  <div className="flex items-center gap-3">
                    {effectiveLogoUrl ? (
                      <img
                        src={effectiveLogoUrl}
                        alt="Logo ön izlemesi"
                        className="h-9 w-9 rounded-xl bg-white p-1 object-contain"
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-sm font-bold">
                        {(settings?.clinicName || 'K').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-semibold">{settings?.clinicName || 'Klinik adı'}</p>
                      <p className="text-xs text-white/80">
                        {settings?.dietitianDisplayName || 'Diyetisyen'}
                      </p>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: accentColorHex, color: '#0f172a' }}
                  >
                    Aktif görünüm
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Dashboard kartı
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      Günlük operasyon özeti
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Danışan takibi, plan akışı ve care hub mesajları bu tonda görünür.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                      style={{ backgroundColor: primaryColorHex }}
                    >
                      Birincil buton
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900"
                      style={{ backgroundColor: accentColorHex }}
                    >
                      İkincil vurgu
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Renk özeti
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
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
