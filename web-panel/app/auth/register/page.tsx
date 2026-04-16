import Link from "next/link";
import { CalendarDays, KeyRound, MailCheck, ShieldCheck } from "lucide-react";

const steps = [
  {
    title: "Paket seçimi",
    text: "Diyetisyen için 3, 6, 12 veya 24 aylık premium lisans seçilir. Bu ürün kurgu içinde free kullanım bulunmaz.",
    icon: CalendarDays,
  },
  {
    title: "Aktivasyon maili",
    text: "Satın alma sonrası panele erişecek kullanıcıya aktivasyon bağlantısı gönderilir.",
    icon: MailCheck,
  },
  {
    title: "Şifre belirleme",
    text: "Kullanıcı kendi şifresini oluşturur; hesap bu aşamada aktif hale gelir.",
    icon: ShieldCheck,
  },
  {
    title: "Access key yönetimi",
    text: "Panel açıldıktan sonra diyetisyen danışan premium akışını access key ile yönetir.",
    icon: KeyRound,
  },
];

export default function DietitianRegisterPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--surface-base)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: "rgba(71,185,114,0.16)" }} />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full blur-3xl" style={{ background: "rgba(0,191,179,0.10)" }} />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-[34px] border border-border/80 bg-white/88 p-8 shadow-[0_24px_80px_rgba(31,73,46,0.10)] backdrop-blur-xl sm:p-10">
          <div className="max-w-3xl">
            <span className="badge-base badge-premium">Açık self-signup kapalı</span>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              MyDietitian panel hesabı satın alma sonrası aktive edilir.
            </h1>
            <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">
              Bu ürün kurgusunda diyetisyen paneli herkese açık kayıt alanı değildir. Hesap,
              paket seçimi ve aktivasyon akışı tamamlandıktan sonra açılır.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-[1.6rem] border border-border/80 bg-[var(--surface-overlay)] p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-primary-soft)] text-[var(--brand-emerald)]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 text-xl font-black tracking-tight text-foreground">{step.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.text}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/" className="btn-primary">
              Satış sayfasına dön
            </Link>
            <Link href="/auth/login" className="btn-ghost">
              Panel giriş alanı
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
