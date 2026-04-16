'use client';

import { InputHTMLAttributes, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Building2, FileText, Globe, Phone, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getSettings, updateSettings } from '@/lib/api/settings';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsSaveBar } from '@/components/settings/SettingsSaveBar';

const profileSchema = z.object({
  clinicName: z
    .string()
    .min(1, 'Klinik adı zorunludur.')
    .max(100, 'Klinik adı en fazla 100 karakter olabilir.'),
  dietitianDisplayName: z
    .string()
    .min(1, 'Görünen ad zorunludur.')
    .max(100, 'Görünen ad en fazla 100 karakter olabilir.'),
  phoneNumber: z
    .string()
    .max(30, 'Telefon numarası en fazla 30 karakter olabilir.')
    .optional()
    .or(z.literal('')),
  websiteUrl: z
    .string()
    .max(255, 'Web sitesi en fazla 255 karakter olabilir.')
    .refine((value) => !value || /^https?:\/\/.+/i.test(value), {
      message: 'Web sitesi adresi http:// veya https:// ile başlamalıdır.',
    })
    .optional()
    .or(z.literal('')),
  bio: z
    .string()
    .max(500, 'Tanıtım metni en fazla 500 karakter olabilir.')
    .optional()
    .or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>;
}

function TextInput({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-900">{label}</label>
      <input
        {...props}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
      <FieldError message={error} />
    </div>
  );
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      clinicName: '',
      dietitianDisplayName: '',
      phoneNumber: '',
      websiteUrl: '',
      bio: '',
    },
  });

  useEffect(() => {
    if (!settings) {
      return;
    }

    form.reset({
      clinicName: settings.clinicName,
      dietitianDisplayName: settings.dietitianDisplayName,
      phoneNumber: settings.phoneNumber ?? '',
      websiteUrl: settings.websiteUrl ?? '',
      bio: settings.bio ?? '',
    });
  }, [form, settings]);

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormData) => {
      if (!settings) {
        return Promise.reject('Ayarlar yüklenmedi.');
      }

      return updateSettings({
        clinicName: values.clinicName.trim(),
        dietitianDisplayName: values.dietitianDisplayName.trim(),
        primaryColorHex: settings?.primaryColorHex ?? '#16a34a',
        accentColorHex: settings?.accentColorHex ?? '#7dd3fc',
        themePresetKey: settings?.themePresetKey ?? null,
        phoneNumber: values.phoneNumber?.trim() || null,
        websiteUrl: values.websiteUrl?.trim() || null,
        bio: values.bio?.trim() || null,
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      form.reset({
        clinicName: data.clinicName,
        dietitianDisplayName: data.dietitianDisplayName,
        phoneNumber: data.phoneNumber ?? '',
        websiteUrl: data.websiteUrl ?? '',
        bio: data.bio ?? '',
      });
      toast.success('Profil ayarları güncellendi.');
    },
    onError: () => {
      toast.error('Profil ayarları güncellenemedi.');
    },
  });

  const handleSave = async () => {
    if (!settings) {
      toast.error('Profil ayarlarÄ± henÃ¼z hazÄ±r deÄŸil.');
      return;
    }

    const isValid = await form.trigger();
    if (!isValid) {
      return;
    }

    updateMutation.mutate(form.getValues());
  };

  const handleDiscard = () => {
    if (!settings) {
      return;
    }

    form.reset({
      clinicName: settings.clinicName,
      dietitianDisplayName: settings.dietitianDisplayName,
      phoneNumber: settings.phoneNumber ?? '',
      websiteUrl: settings.websiteUrl ?? '',
      bio: settings.bio ?? '',
    });
    toast.success('Değişiklikler geri alındı.');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <p className="text-sm text-slate-500">Profil ayarları yükleniyor...</p>
      </div>
    );
  }

  const isDirty = form.formState.isDirty;

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <SettingsCard
            icon={Building2}
            title="Klinik kimliği"
            description="Yan menüde, dashboard özetlerinde ve panel genelinde görünen temel bilgiler."
            className="rounded-[28px] border-emerald-100 shadow-[0_16px_48px_-40px_rgba(16,185,129,0.35)]"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <TextInput
                label="Klinik adı"
                placeholder="Ör. Aydın Sağlık Merkezi"
                error={form.formState.errors.clinicName?.message}
                {...form.register('clinicName')}
              />
              <TextInput
                label="Panelde görünen ad"
                placeholder="Ör. Uzm. Dyt. Elif Kaya"
                hint="Danışan listeleri ve ekip içi görünümde bu ad kullanılır."
                error={form.formState.errors.dietitianDisplayName?.message}
                {...form.register('dietitianDisplayName')}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Phone}
            title="İletişim ve tanıtım"
            description="Klinik profilinizi daha kurumsal gösterecek iletişim bilgileri."
            className="rounded-[28px] border-slate-200 shadow-sm"
          >
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <TextInput
                  label="Telefon numarası"
                  placeholder="Ör. +90 555 000 00 00"
                  error={form.formState.errors.phoneNumber?.message}
                  {...form.register('phoneNumber')}
                />
                <TextInput
                  label="Web sitesi"
                  placeholder="https://www.ornekklinik.com"
                  hint="Varsa kurumsal sitenizin tam adresini girin."
                  error={form.formState.errors.websiteUrl?.message}
                  {...form.register('websiteUrl')}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">
                  Kısa tanıtım metni
                </label>
                <textarea
                  {...form.register('bio')}
                  rows={5}
                  placeholder="Uzmanlık alanlarınızı, yaklaşımınızı veya kliniğinizin sunduğu deneyimi özetleyin."
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Bu metin gelecekte tanıtım yüzeylerinde ve profil kartlarında kullanılabilir.</span>
                  <span>{form.watch('bio')?.length ?? 0}/500</span>
                </div>
                <FieldError message={form.formState.errors.bio?.message} />
              </div>
            </div>
          </SettingsCard>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-6 shadow-[0_16px_48px_-40px_rgba(16,185,129,0.4)]">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <User className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Profil ön izlemesi</h2>
                <p className="text-xs text-slate-500">Panelde görünecek kurumsal kimlik özeti</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white">
                  {(form.watch('clinicName') || 'K').trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {form.watch('clinicName') || 'Klinik adı'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {form.watch('dietitianDisplayName') || 'Panelde görünen ad'}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-emerald-600" />
                  <span>{form.watch('phoneNumber') || 'Telefon bilgisi eklenmedi'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  <span className="truncate">
                    {form.watch('websiteUrl') || 'Web sitesi bilgisi eklenmedi'}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span className="line-clamp-4 leading-6">
                    {form.watch('bio') || 'Kısa tanıtım metni henüz eklenmedi.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Önerilen kullanım</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Klinik adı kısa ve net olursa yan menüde daha dengeli görünür.</li>
              <li>Telefon ve web sitesi bilgileri ekip içi operasyonlarda hızlı erişim sağlar.</li>
              <li>Tanıtım metninde uzmanlık alanlarınızı 2-3 cümle ile özetlemeniz yeterlidir.</li>
            </ul>
          </div>
        </div>
      </div>

      <SettingsSaveBar
        isDirty={isDirty}
        isSaving={updateMutation.isPending}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
