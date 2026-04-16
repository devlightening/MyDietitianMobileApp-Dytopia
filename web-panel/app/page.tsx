import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TabletSmartphone,
  Users,
  Zap,
  Star,
  TrendingUp,
} from "lucide-react";

export const metadata: Metadata = {
  title: "MyDietitian | 2026 Diyetisyen SaaS Platformu",
  description:
    "MyDietitian, diyetisyenler icin premium panel erisimi, access key ile danisan aktivasyonu ve akilli mutfak deneyimini tek platformda birlestirir.",
};

type IconCard = { title: string; description: string; icon: LucideIcon };
type Shot = { src: string; title: string; caption: string };
type Plan = {
  name: string;
  duration: string;
  badge: string;
  featured?: boolean;
  description: string;
  bullets: string[];
};

const heroHighlights = [
  "Diyetisyen paneli + mobil uygulama + access key zinciri",
  "Kural tabanlı tarif motoru ve ingredient standardizasyonu",
  "White-label klinik deneyimi ve tenant izolasyonu",
  "2026 odaklı daha premium ve daha operasyonel ürün dili",
];

const stats = [
  { value: "19+", label: "Mobil ekran", icon: TabletSmartphone },
  { value: "11+", label: "Panel modülü", icon: LayoutDashboard },
  { value: "4", label: "Abonelik planı", icon: CalendarDays },
  { value: "∞", label: "Danışan kapasitesi", icon: Users },
];

const featureCards: IconCard[] = [
  {
    title: "Dijital operasyon merkezi",
    description:
      "Dashboard, danışanlar, planlar, tarifler, iletişim ve access key modülleri tek panelde toplanır.",
    icon: LayoutDashboard,
  },
  {
    title: "Premium aktivasyon",
    description:
      "Diyetisyen panelden access key üretir; danışan mobil uygulamada premium moda geçerek o diyetisyene bağlanır.",
    icon: KeyRound,
  },
  {
    title: "Care Hub ve iletişim",
    description:
      "Mobil tarafta sohbet hissi veren akış, panel tarafında görünür klinik operasyon ve hızlı yanıt mantığı yaratır.",
    icon: MessageSquare,
  },
  {
    title: "Uyum ve hesap verebilirlik",
    description:
      "Plan tamamlama, streak, rozet ve aktivite sinyalleri diyetisyene veri tabanlı bir takip deneyimi sunar.",
    icon: BarChart3,
  },
  {
    title: "White-label klinik hissi",
    description:
      "Panel ve mobil deneyim diyetisyenin marka kimliğini ve klinik otoritesini yansıtacak şekilde tasarlanır.",
    icon: Stethoscope,
  },
  {
    title: "Güvenli panel modeli",
    description:
      "Self-signup yerine abonelik + aktivasyon + yetki kontrolü ile açılan premium panel kurgusu kullanılır.",
    icon: ShieldCheck,
  },
];


const flowSteps: IconCard[] = [
  {
    title: "Paket seçilir",
    description:
      "3, 6, 12 veya 24 aylık lisans seçilir. Free plan açık değildir.",
    icon: CalendarDays,
  },
  {
    title: "Aktivasyon maili gider",
    description:
      "Paneli kullanacak hesaba aktivasyon bağlantısı iletilir; şifre kullanıcı tarafından belirlenir.",
    icon: LockKeyhole,
  },
  {
    title: "Panel kurulur",
    description:
      "Diyetisyen imza tariflerini, planlarını, marka alanlarını ve access key mantığını panelden tanımlar.",
    icon: ClipboardList,
  },
  {
    title: "Danışan premium olur",
    description:
      "Danışan access key ile mobilde premium moda geçer ve o diyetisyenin veri setiyle çalışmaya başlar.",
    icon: TabletSmartphone,
  },
];

const plans: Plan[] = [
  {
    name: "Pilot Başlangıç",
    duration: "3 Ay",
    badge: "Hızlı doğrulama",
    description:
      "Küçük hasta grubunda access key ve panel akışını test etmek için.",
    bullets: [
      "Tam panel erişimi",
      "Access key oluşturma",
      "Mobil premium aktivasyon",
      "E-posta ile teknik destek",
    ],
  },
  {
    name: "Büyüme Dönemi",
    duration: "6 Ay",
    badge: "Dengeli",
    description:
      "Düzenli operasyon başlatan diyetisyenler için daha stabil kullanım modeli.",
    bullets: [
      "Tüm premium modüller",
      "Care Hub ve uyum verisi",
      "Marka ayarları",
      "Öncelikli destek",
    ],
  },
  {
    name: "Klinik Paket",
    duration: "12 Ay",
    badge: "Önerilen",
    featured: true,
    description:
      "MyDietitian'ın asıl değerini tam dönem kullanmak isteyenler için ana lisans.",
    bullets: [
      "Yıllık panel kullanımı",
      "Özel tarif havuzu",
      "Raporlama ve motivasyon",
      "Öncelikli destek + onboarding",
    ],
  },
  {
    name: "Uzun Dönem Ölçek",
    duration: "24 Ay",
    badge: "Uzun vadeli",
    description:
      "Dijital klinik modelini daha uzun süreli kurmak isteyen klinikler için.",
    bullets: [
      "Uzun süreli lisans",
      "Operasyon devamlılığı",
      "Daha öngörülebilir kurgu",
      "VIP destek hattı",
    ],
  },
];

const mobileShots: Shot[] = [
  {
    src: "/showcase/mobile/m1.png",
    title: "Premium ana ekran",
    caption: "Günlük ritim ve merkez aksiyonlar.",
  },
  {
    src: "/showcase/mobile/m2.png",
    title: "Plan akışı",
    caption: "Bekleyen ve tamamlanan öğünler.",
  },
  {
    src: "/showcase/mobile/m3.png",
    title: "Günlük ritim",
    caption: "Uyum, su ve seri takibi.",
  },
  {
    src: "/showcase/mobile/m4.png",
    title: "Rozet ve seri",
    caption: "Motive eden kartlar.",
  },
  {
    src: "/showcase/mobile/m5.png",
    title: "Ölçüm ve asistan",
    caption: "Kişisel takip ve mutfak asistanı.",
  },
  {
    src: "/showcase/mobile/m6.png",
    title: "Planım",
    caption: "Timeline mantığı ile okunur akış.",
  },
  {
    src: "/showcase/mobile/m7.png",
    title: "Bugünün öğünleri",
    caption: "Yapıldı butonu ile uyum verisi.",
  },
  {
    src: "/showcase/mobile/m8.png",
    title: "AI Mutfak",
    caption: "Malzeme seçimi ve laboratuvar mantığı.",
  },
  {
    src: "/showcase/mobile/m9.png",
    title: "Seçilen malzemeler",
    caption: "Malzeme seti ve ritim kartları.",
  },
  {
    src: "/showcase/mobile/m10.png",
    title: "Ritim kartları",
    caption: "Mutfak gamification blokları.",
  },
  {
    src: "/showcase/mobile/m11.png",
    title: "Tarif laboratuvarı",
    caption: "Tarif bul aksiyonuna hazırlık.",
  },
  {
    src: "/showcase/mobile/m12.png",
    title: "Tarif motoru",
    caption: "Merkez aksiyonla arama başlar.",
  },
  {
    src: "/showcase/mobile/m13.png",
    title: "Mutfak animasyonu",
    caption: "Tarif motoru çalışırken hareketli deneyim.",
  },
  {
    src: "/showcase/mobile/m14.png",
    title: "Tarif bulundu",
    caption: "Eşleşme öncesi geçiş ekranı.",
  },
  {
    src: "/showcase/mobile/m15.png",
    title: "Önerilen tarif",
    caption: "Klinik puan ve neden önerildi blokları.",
  },
  {
    src: "/showcase/mobile/m16.png",
    title: "Care Hub sohbeti",
    caption: "Diyetisyen-danışan iletişimi.",
  },
  {
    src: "/showcase/mobile/m17.png",
    title: "Profili düzenle",
    caption: "Avatar ve hesap ayarları.",
  },
  {
    src: "/showcase/mobile/m18.png",
    title: "Kimlik ve tema",
    caption: "Tema, dil ve kimlik kartı.",
  },
  {
    src: "/showcase/mobile/m19.png",
    title: "Tamamlanan gün",
    caption: "Alışveriş listesi ve plan özeti.",
  },
];

const webShots: Shot[] = [
  {
    src: "/showcase/webpanel/w1.jpg",
    title: "Ana panel",
    caption: "KPI kartları ve canlı akış.",
  },
  {
    src: "/showcase/webpanel/w2.jpg",
    title: "Dashboard detay",
    caption: "Motivasyon ve iletişim blokları.",
  },
  {
    src: "/showcase/webpanel/w3.jpg",
    title: "Danışan listesi",
    caption: "Premium durum, uyum ve aksiyonlar.",
  },
  {
    src: "/showcase/webpanel/w4.jpg",
    title: "Danışan aksiyonları",
    caption: "Filtre ve hızlı işlem mantığı.",
  },
  {
    src: "/showcase/webpanel/w5.jpg",
    title: "Danışan yönetimi",
    caption: "Klinik operasyon tablosu.",
  },
  {
    src: "/showcase/webpanel/w6.jpg",
    title: "Erişim anahtarları",
    caption: "Süre bazlı premium aktivasyon.",
  },
  {
    src: "/showcase/webpanel/w7.jpg",
    title: "İletişim merkezi",
    caption: "Görüşme akışı ve hızlı yanıtlar.",
  },
  {
    src: "/showcase/webpanel/w8.jpg",
    title: "Plan yönetimi",
    caption: "Günlük ve haftalık plan kurgusu.",
  },
  {
    src: "/showcase/webpanel/w9.jpg",
    title: "Haftalık plan",
    caption: "Taslak ve yayında mantığı.",
  },
  {
    src: "/showcase/webpanel/w10.jpg",
    title: "Tarif editörü",
    caption: "Structured ingredient seçimi.",
  },
  {
    src: "/showcase/webpanel/w11.jpg",
    title: "Tarif kütüphanesi",
    caption: "İmza tarifleri yönetimi.",
  },
];

const double = <T,>(items: T[]) => [...items, ...items];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-emerald-dim)] bg-[var(--brand-primary-softer)] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-emerald)]">
      <Sparkles className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function MobileCard({
  shot,
  priority = false,
}: {
  shot: Shot;
  priority?: boolean;
}) {
  return (
    <article className="group relative w-[200px] shrink-0 overflow-hidden rounded-[2rem] border border-[var(--border-default)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-emerald-dim)] hover:shadow-[var(--shadow-card-hover)]">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-overlay)]">
        <Image
          src={shot.src}
          alt={shot.title}
          width={1080}
          height={2340}
          priority={priority}
          className="h-auto w-full transition-transform duration-500 ease-out group-hover:scale-[1.025]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[rgba(8,28,16,0.85)] via-[rgba(8,28,16,0.2)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/90 backdrop-blur-md">
            Mobile
          </div>
          <h3 className="mt-1.5 text-sm font-black tracking-tight text-white">
            {shot.title}
          </h3>
          <p className="mt-0.5 text-[11px] leading-5 text-white/72">
            {shot.caption}
          </p>
        </div>
      </div>
    </article>
  );
}

function WebCard({ shot, priority = false }: { shot: Shot; priority?: boolean }) {
  return (
    <article className="group relative w-[560px] shrink-0 overflow-hidden rounded-[1.8rem] border border-[var(--border-default)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-emerald-dim)] hover:shadow-[var(--shadow-card-hover)]">
      <div className="relative overflow-hidden rounded-[1.3rem] border border-[var(--border-subtle)] bg-[var(--surface-overlay)]">
        <Image
          src={shot.src}
          alt={shot.title}
          width={1918}
          height={863}
          priority={priority}
          className="h-auto w-full transition-transform duration-500 ease-out group-hover:scale-[1.025]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[rgba(8,28,16,0.80)] via-[rgba(8,28,16,0.18)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/92 backdrop-blur-md">
            Web Panel
          </div>
          <h3 className="mt-2.5 text-lg font-black tracking-tight text-white">
            {shot.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-white/78">
            {shot.caption}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function HomePage() {
  const mobileRowA = double(mobileShots);
  const webRow = double(webShots);

  return (
    <main className="relative overflow-hidden bg-[var(--surface-base)]">
      {/* ── Ambient background ── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-60 -top-20 h-[700px] w-[700px] rounded-full bg-[rgba(71,185,114,0.11)] blur-3xl" />
        <div className="absolute -right-60 top-80 h-[600px] w-[600px] rounded-full bg-[rgba(87,184,199,0.07)] blur-3xl" />
        <div className="absolute bottom-60 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[rgba(71,185,114,0.06)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(52,111,73,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(52,111,73,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[rgba(246,251,247,0.85)] backdrop-blur-2xl dark:bg-[rgba(15,27,20,0.85)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-primary)] shadow-[0_4px_14px_rgba(71,185,114,0.35)] pulse-glow">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22C6.5 22 2 17.5 2 12C2 8 4.5 4.5 8 3C8 3 7 8 12 8C17 8 16 3 16 3C19.5 4.5 22 8 22 12C22 17.5 17.5 22 12 22Z" />
              </svg>
            </div>
            <span className="text-[1.15rem] font-black tracking-tight text-[hsl(var(--foreground))]">
              MyDietitian
            </span>
          </div>

          {/* Nav links */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {[
              ["Özellikler", "#features"],
              ["Nasıl Çalışır", "#how"],
              ["Ekranlar", "#screens"],
              ["Fiyatlar", "#pricing"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-4 py-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[hsl(var(--foreground))]"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <Link href="/auth/login" className="btn-primary gap-2 text-sm">
            Panel Girişi
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="relative mx-auto max-w-7xl px-4 pb-12 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="fade-in flex justify-center">
            <Eyebrow>2026 Diyetisyen SaaS Platformu</Eyebrow>
          </div>

          <h1 className="fade-in stagger-1 mt-8 text-[3.2rem] font-black leading-[1.04] tracking-[-0.045em] text-[hsl(var(--foreground))] sm:text-6xl lg:text-[5rem]">
            Diyetisyenin{" "}
            <span className="text-gradient-emerald">dijital kliniği</span>
            {"."}
            <br />
            <span className="text-[hsl(var(--muted-foreground))] opacity-70">
              Danışanların uyum merkezi.
            </span>
          </h1>

          <p className="fade-in stagger-2 mx-auto mt-7 max-w-2xl text-xl leading-8 text-[hsl(var(--muted-foreground))]">
            Panel erişimi, access key ile danışan aktivasyonu, kural tabanlı
            tarif motoru ve gamification — hepsi tek abonelikte. Ücretsiz tier
            yok; yalnızca premium deneyim.
          </p>

          {/* Highlights */}
          <ul className="fade-in stagger-3 mt-8 flex flex-col items-start gap-2 text-left sm:mx-auto sm:max-w-xl sm:flex-col">
            {heroHighlights.map((h) => (
              <li key={h} className="flex items-start gap-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-emerald)]" />
                {h}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="fade-in stagger-4 mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#pricing"
              className="btn-primary px-7 py-3.5 text-base font-bold"
            >
              Planları İncele
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/auth/login" className="btn-ghost px-7 py-3.5 text-base">
              Panele Giriş Yap
            </Link>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════ */}
      <section className="border-y border-[var(--border-default)] bg-[var(--surface-raised)] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-primary-soft)]">
                  <s.icon className="h-5 w-5 text-[var(--brand-emerald)]" />
                </div>
                <div className="text-3xl font-black tracking-tight text-[hsl(var(--foreground))]">
                  {s.value}
                </div>
                <div className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] opacity-70">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          MOBILE SCREENSHOTS MARQUEE
      ══════════════════════════════════════ */}
      <section id="screens" className="overflow-hidden py-20">
        <div className="mx-auto mb-10 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Eyebrow>Mobil Uygulama</Eyebrow>
              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                Danışanın cebindeki klinik
              </h2>
              <p className="mt-3 max-w-xl text-lg text-[hsl(var(--muted-foreground))]">
                Premium aktif danışanlara özel, diyetisyen veri setiyle çalışan
                akıllı mobil deneyim. 19 farklı ekran, tek bütünleşik akış.
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-28 bg-gradient-to-r from-[var(--surface-base)] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-28 bg-gradient-to-l from-[var(--surface-base)] to-transparent" />
          <div className="animate-marquee gap-4 pl-4">
            {mobileRowA.map((shot, i) => (
              <MobileCard key={`a-${i}`} shot={shot} priority={i < 5} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURES
      ══════════════════════════════════════ */}
      <section
        id="features"
        className="bg-[var(--surface-overlay)] py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 max-w-2xl">
            <Eyebrow>Özellikler</Eyebrow>
            <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
              Klinik operasyonun tüm katmanları
            </h2>
            <p className="mt-4 text-lg leading-8 text-[hsl(var(--muted-foreground))]">
              Diyetisyen web paneli, danışan mobil uygulaması ve akıllı
              bağlantı sistemi — tek abonelikte, sıfır karmaşıklıkla.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card, i) => (
              <div
                key={card.title}
                className={`card-sfcos group p-7 fade-in stagger-${Math.min(i + 1, 7)}`}
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-primary-soft)] transition-all duration-200 group-hover:bg-[var(--surface-glass-hover)] group-hover:shadow-[var(--shadow-emerald-sm)]">
                  <card.icon className="h-5 w-5 text-[var(--brand-emerald)]" />
                </div>
                <h3 className="text-[1rem] font-bold tracking-tight text-[hsl(var(--foreground))]">
                  {card.title}
                </h3>
                <p className="mt-2.5 text-[0.925rem] leading-6 text-[hsl(var(--muted-foreground))]">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════ */}
      <section id="how" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 max-w-2xl">
            <Eyebrow>Nasıl Çalışır</Eyebrow>
            <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
              Satın aldan aktif kliniğe 4 adım
            </h2>
            <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
              Self-signup yok. Abonelik satın alındıktan sonra hesap
              otomatik oluşturulur; giriş bilgileri e-posta ile iletilir.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {flowSteps.map((step, i) => (
              <div
                key={step.title}
                className={`card-sfcos relative overflow-hidden p-7 fade-in stagger-${i + 1}`}
              >
                {/* Step number watermark */}
                <div className="absolute right-4 top-3 select-none text-[5rem] font-black leading-none text-[var(--brand-primary-softer)]">
                  0{i + 1}
                </div>

                <div className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-primary)] shadow-[0_8px_22px_rgba(71,185,114,0.28)]">
                  <step.icon className="h-5 w-5 text-white" />
                </div>

                {/* Connector line (except last) */}
                {i < 3 && (
                  <div className="absolute right-0 top-[2.6rem] hidden h-[1px] w-6 bg-gradient-to-r from-[var(--border-emerald-dim)] to-transparent lg:block" />
                )}

                <h3 className="relative text-base font-bold tracking-tight">
                  {step.title}
                </h3>
                <p className="relative mt-2.5 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          WEB PANEL SCREENSHOTS MARQUEE
      ══════════════════════════════════════ */}
      <section className="overflow-hidden bg-[var(--surface-overlay)] py-24">
        <div className="mx-auto mb-12 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Eyebrow>Web Panel</Eyebrow>
              <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                Klinik operasyonunun merkezi
              </h2>
              <p className="mt-4 max-w-xl text-lg text-[hsl(var(--muted-foreground))]">
                Danışan yönetimi, plan oluşturma, access key ve iletişim
                merkezi — hepsi tek dashboard'da.
              </p>
            </div>
            <div className="shrink-0">
              <span className="badge-base badge-active font-semibold">
                <TrendingUp className="h-3.5 w-3.5" /> Canlı
              </span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-36 bg-gradient-to-r from-[var(--surface-overlay)] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-36 bg-gradient-to-l from-[var(--surface-overlay)] to-transparent" />
          <div
            className="animate-marquee gap-5 pl-6"
            style={{ animationDuration: "60s" }}
          >
            {webRow.map((shot, i) => (
              <WebCard key={`w-${i}`} shot={shot} priority={i < 3} />
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          PRICING
      ══════════════════════════════════════ */}
      <section
        id="pricing"
        className="bg-[var(--surface-overlay)] py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 max-w-2xl">
            <Eyebrow>Fiyatlandırma</Eyebrow>
            <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
              Ücretsiz plan yok.{" "}
              <span className="text-gradient-emerald">Yalnızca premium.</span>
            </h2>
            <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
              Satın alma sonrası hesabınız otomatik oluşturulur; giriş
              bilgileriniz e-posta ile iletilir. Aynı gün paneli
              kullanmaya başlayabilirsiniz.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col ${plan.featured ? "card-premium" : "card-sfcos"} p-8`}
              >
                {plan.featured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="badge-base badge-premium flex items-center gap-1.5 px-4 py-1.5 text-xs shadow-[var(--shadow-emerald-sm)]">
                      <Star className="h-3 w-3 fill-current" /> Önerilen
                    </span>
                  </div>
                )}

                <div>
                  <span className="badge-base badge-new text-[11px]">
                    {plan.badge}
                  </span>
                </div>

                <h3 className="mt-4 text-xl font-black tracking-tight text-[hsl(var(--foreground))]">
                  {plan.name}
                </h3>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-5xl font-black text-[var(--brand-emerald)]">
                    {plan.duration}
                  </span>
                  <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    lisans
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  {plan.description}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-emerald)]" />
                      <span className="text-[hsl(var(--foreground))]">{b}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/iletisim"
                  className={`mt-8 block w-full py-3.5 text-center font-bold ${plan.featured ? "btn-primary" : "btn-emerald-outline"}`}
                >
                  İletişime Geç
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Tüm planlarda tam panel + mobil erişim dahildir. · Abonelik
            bitiminde yenileme gerekir. · Faturanız e-posta ile iletilir.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURE HIGHLIGHT — ACCESS KEY
      ══════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow>Access Key Sistemi</Eyebrow>
              <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                Danışan aktivasyonu{" "}
                <span className="text-gradient-emerald">tek kodla</span>
              </h2>
              <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
                Diyetisyen web panelinden süreli access key oluşturur.
                Danışan mobil uygulamaya kodu girer; premium moda geçer ve
                diyetisyenin veri setiyle bağlanır. Karmaşık kayıt yok,
                anında aktivasyon.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: Zap,
                    title: "Anında aktif",
                    desc: "Key girildiği an premium mod devreye girer.",
                  },
                  {
                    icon: CalendarDays,
                    title: "Süreli erişim",
                    desc: "Gün veya ay bazlı süre tanımlayabilirsiniz.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Güvenli bağlantı",
                    desc: "Yalnızca o diyetisyenin verisine erişim açılır.",
                  },
                  {
                    icon: Users,
                    title: "Çoklu danışan",
                    desc: "Her danışan için ayrı key yönetilebilir.",
                  },
                ].map((item) => (
                  <div key={item.title} className="card-stat">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-primary-soft)]">
                      <item.icon className="h-4 w-4 text-[var(--brand-emerald)]" />
                    </div>
                    <div className="text-sm font-bold">{item.title}</div>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Access key UI mockup */}
            <div className="glass-card relative overflow-hidden p-8">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--brand-glow-soft)] blur-2xl" />
              <div className="relative">
                <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--brand-emerald)]">
                  Panel → Erişim Anahtarları
                </div>
                <h4 className="text-lg font-black tracking-tight">
                  Yeni anahtar oluştur
                </h4>

                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                      Danışan
                    </div>
                    <div className="mt-1 font-bold">Selin Aydın</div>
                  </div>
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                      Süre
                    </div>
                    <div className="mt-1 font-bold">30 gün</div>
                  </div>
                  <div className="rounded-xl border border-[var(--border-emerald)] bg-[var(--brand-primary-soft)] px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-emerald)]">
                      Oluşturulan Key
                    </div>
                    <div className="mt-2 font-mono text-2xl font-black tracking-[0.25em] text-[var(--brand-emerald)]">
                      MYD-7F4K
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <div className="flex-1 rounded-full bg-[var(--brand-primary)] py-2.5 text-center text-sm font-bold text-white">
                    Kopyala
                  </div>
                  <div className="flex-1 rounded-full border border-[var(--border-emerald)] bg-[var(--brand-primary-softer)] py-2.5 text-center text-sm font-bold text-[var(--brand-emerald)]">
                    Gönder
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[var(--surface-overlay)] py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[var(--brand-glow)] blur-3xl" />
          <div className="absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[var(--brand-accent-soft)] blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(52,111,73,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(52,111,73,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Eyebrow>Başlamaya Hazır mısınız?</Eyebrow>
          <h2 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Dijital kliniğinizi{" "}
            <span className="text-gradient-emerald">bugün kurun</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-8 text-[hsl(var(--muted-foreground))]">
            Satın alma işleminin ardından hesabınız otomatik oluşturulur.
            Aynı gün web panelini ve danışan aktivasyonunu kullanmaya
            başlayabilirsiniz.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#pricing"
              className="btn-primary px-8 py-4 text-base font-bold shadow-[0_16px_36px_rgba(71,185,114,0.28)]"
            >
              Plan Seç
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/auth/login" className="btn-ghost px-8 py-4 text-base">
              Hesabım Var
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-sm text-[hsl(var(--muted-foreground))]">
            {[
              "Anında aktivasyon",
              "E-posta ile giriş bilgisi",
              "Tam panel erişimi",
              "Mobil + web dahil",
            ].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--brand-emerald)]" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer className="border-t border-[var(--border-default)] bg-[var(--surface-base)] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-primary)]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22C6.5 22 2 17.5 2 12C2 8 4.5 4.5 8 3C8 3 7 8 12 8C17 8 16 3 16 3C19.5 4.5 22 8 22 12C22 17.5 17.5 22 12 22Z" />
                </svg>
              </div>
              <span className="font-black text-[hsl(var(--foreground))]">
                MyDietitian
              </span>
            </div>

            {/* Links */}
            <div className="flex gap-5 text-sm font-medium text-[hsl(var(--muted-foreground))]">
              <a href="#features" className="hover:text-[var(--brand-emerald)] transition-colors">
                Özellikler
              </a>
              <a href="#pricing" className="hover:text-[var(--brand-emerald)] transition-colors">
                Fiyatlar
              </a>
              <Link href="/auth/login" className="hover:text-[var(--brand-emerald)] transition-colors">
                Giriş
              </Link>
            </div>

            <p className="text-sm text-[hsl(var(--muted-foreground))] opacity-70">
              © 2026 MyDietitian. Tüm hakları saklıdır.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
