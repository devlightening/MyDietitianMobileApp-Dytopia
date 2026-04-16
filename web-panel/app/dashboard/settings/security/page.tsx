'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { changePassword, getCurrentUser } from '@/lib/api/auth';
import { toast } from '@/components/ui/Toast';

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  signOutOtherSessions: boolean;
}

const initialForm: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  signOutOtherSessions: true,
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Henüz kayıt yok';
  }

  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SecurityPage() {
  const [form, setForm] = useState<PasswordFormState>(initialForm);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: currentUser, refetch } = useQuery({
    queryKey: ['current-user', 'security'],
    queryFn: getCurrentUser,
    retry: 1,
  });

  const passwordRules = useMemo(
    () => [
      { key: 'length', label: 'En az 8 karakter', valid: form.newPassword.length >= 8 },
      { key: 'upper', label: 'En az 1 büyük harf', valid: /[A-ZÇĞİÖŞÜ]/.test(form.newPassword) },
      { key: 'lower', label: 'En az 1 küçük harf', valid: /[a-zçğıöşü]/.test(form.newPassword) },
      { key: 'digit', label: 'En az 1 rakam', valid: /\d/.test(form.newPassword) },
    ],
    [form.newPassword]
  );

  const passwordsMatch =
    form.confirmPassword.length === 0 || form.confirmPassword === form.newPassword;
  const isFormReady =
    Boolean(form.currentPassword) &&
    Boolean(form.newPassword) &&
    Boolean(form.confirmPassword) &&
    passwordsMatch &&
    passwordRules.every((rule) => rule.valid);

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        signOutOtherSessions: form.signOutOtherSessions,
      }),
    onSuccess: async (response) => {
      setForm(initialForm);
      setFormError(null);
      toast.success(response.message ?? 'Şifreniz güncellendi.');
      await refetch();
    },
    onError: (error: any) => {
      setFormError(error?.message ?? 'Şifre güncellenemedi.');
    },
  });

  function updateField<K extends keyof PasswordFormState>(key: K, value: PasswordFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!passwordsMatch) {
      setFormError('Yeni şifre ve tekrar alanı birbiriyle eşleşmiyor.');
      return;
    }

    if (!passwordRules.every((rule) => rule.valid)) {
      setFormError('Yeni şifre güvenlik gereksinimlerini karşılamıyor.');
      return;
    }

    void changePasswordMutation.mutateAsync();
  }

  const summaryItems = [
    { label: 'Hesap e-postası', value: currentUser?.email ?? 'Yükleniyor...' },
    { label: 'Son giriş', value: formatDateTime(currentUser?.lastLoginAtUtc) },
    { label: 'Son şifre değişimi', value: formatDateTime(currentUser?.lastPasswordChangedAtUtc) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SettingsCard
          icon={ShieldCheck}
          title="Hesap özeti"
          description="Panel erişiminizi koruyan temel güvenlik durumu."
          className="rounded-[28px] border-border bg-[var(--surface-raised)] shadow-[var(--shadow-card)]"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-[22px] border border-border bg-[var(--surface-overlay)] px-4 py-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[24px] border border-primary/15 bg-primary/5 px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BadgeCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Oturum güvenliği aktif</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Şifre değişiminden sonra diğer cihazlardaki oturumları kapatabilir ve panel
                  erişimini güvenlik damgası ile koruyabilirsiniz.
                </p>
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={KeyRound}
          title="Şifre gereksinimleri"
          description="Yeni şifre tüm cihazlarda aynı güvenlik standardını kullanır."
          className="rounded-[28px] border-border bg-[var(--surface-raised)] shadow-[var(--shadow-card)]"
        >
          <div className="space-y-3">
            {passwordRules.map((rule) => (
              <div
                key={rule.key}
                className="flex items-center gap-3 rounded-[22px] border border-border bg-[var(--surface-overlay)] px-4 py-3"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl border ${
                    rule.valid
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  <Check className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium text-foreground">{rule.label}</p>
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SettingsCard
          icon={LockKeyhole}
          title="Şifreyi değiştir"
          description="Mevcut parolanızı doğrulayın ve yeni güvenli şifrenizi belirleyin."
          className="rounded-[28px] border-border bg-[var(--surface-raised)] shadow-[var(--shadow-card)]"
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <PasswordField
                label="Mevcut şifre"
                value={form.currentPassword}
                onChange={(value) => updateField('currentPassword', value)}
                visible={showCurrentPassword}
                onToggleVisibility={() => setShowCurrentPassword((prev) => !prev)}
              />

              <div className="grid gap-4 lg:grid-cols-2">
                <PasswordField
                  label="Yeni şifre"
                  value={form.newPassword}
                  onChange={(value) => updateField('newPassword', value)}
                  visible={showNewPassword}
                  onToggleVisibility={() => setShowNewPassword((prev) => !prev)}
                />
                <PasswordField
                  label="Yeni şifre tekrar"
                  value={form.confirmPassword}
                  onChange={(value) => updateField('confirmPassword', value)}
                  visible={showConfirmPassword}
                  onToggleVisibility={() => setShowConfirmPassword((prev) => !prev)}
                  error={!passwordsMatch ? 'Şifreler eşleşmiyor.' : undefined}
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-[22px] border border-border bg-[var(--surface-overlay)] px-4 py-4">
              <input
                type="checkbox"
                checked={form.signOutOtherSessions}
                onChange={(event) => updateField('signOutOtherSessions', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  Diğer tüm cihazlardaki oturumları kapat
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  Açık olduğunda eski oturumlar yeni güvenlik damgası nedeniyle geçersiz hale gelir.
                </span>
              </span>
            </label>

            {formError ? (
              <div className="flex items-start gap-3 rounded-[22px] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-muted-foreground">
                Şifre güncellendiğinde mevcut tarayıcı oturumunuz korunur.
              </p>
              <Button
                type="submit"
                variant="primary"
                loading={changePasswordMutation.isPending}
                disabled={!isFormReady}
                className="h-11 rounded-2xl px-5"
              >
                Şifreyi güncelle
              </Button>
            </div>
          </form>
        </SettingsCard>

        <SettingsCard
          icon={AlertTriangle}
          title="Güvenli kullanım notları"
          description="Klinik panelinizi günlük kullanımda daha güvenli tutmak için öneriler."
          className="rounded-[28px] border-border bg-[var(--surface-raised)] shadow-[var(--shadow-card)]"
        >
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-[22px] border border-border bg-[var(--surface-overlay)] px-4 py-4">
              Ortak cihazlarda işiniz bittiğinde oturumu kapatın ve tarayıcıya şifre kaydetmeyi
              yalnızca kişisel cihazlarda kullanın.
            </div>
            <div className="rounded-[22px] border border-border bg-[var(--surface-overlay)] px-4 py-4">
              Şüpheli bir oturum fark ettiğinizde şifrenizi değiştirip diğer cihazları otomatik
              olarak kapatın.
            </div>
            <div className="rounded-[22px] border border-border bg-[var(--surface-overlay)] px-4 py-4">
              Hasta verileri açıkken ekran paylaşımı veya uzaktan destek süreçlerinde erişim
              sınırlarını dikkatle yönetin.
            </div>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          error={error}
          className="pr-12"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-xl p-2 text-muted-foreground transition hover:bg-[var(--surface-overlay)] hover:text-foreground"
          aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
