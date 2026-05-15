import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TabletSmartphone,
  Utensils,
  Users,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dytopia | Diyetisyenler için premium SaaS platformu",
  description:
    "Dytopia, diyetisyen web paneli ve danışan mobil uygulamasını tek premium klinik operasyon sisteminde birleştirir.",
};

type Shot = {
  src: string;
  title: string;
  caption: string;
  category: string;
};

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const pad = (value: number) => value.toString().padStart(2, "0");

const mobileGroups = [
  { category: "Alışveriş listesi", count: 3, caption: "Planlardan otomatik okunur liste" },
  { category: "Ana sayfa", count: 13, caption: "Günlük ritim, uyum ve favori akışlar" },
  { category: "Dolabım", count: 2, caption: "Danışanın elindeki malzeme yönetimi" },
  { category: "AI Mutfak", count: 6, caption: "Malzemeden tarif üreten premium deneyim" },
  { category: "Care Hub", count: 2, caption: "Diyetisyen ve danışan iletişimi" },
  { category: "Oyunlar", count: 4, caption: "Rozet, seri ve motivasyon katmanı" },
  { category: "Planım", count: 6, caption: "Öğün, alternatif ve tamamlama ekranları" },
  { category: "Profil", count: 7, caption: "Kimlik, tema, dil ve hesap yönetimi" },
  { category: "Tabak tarama", count: 3, caption: "Yemek görseli üzerinden takip akışı" },
];

const webGroups = [
  { category: "Ayarlar", count: 2, caption: "Klinik ve panel ayarları" },
  { category: "Danışanlar", count: 3, caption: "Premium durum, uyum ve takip listesi" },
  { category: "Dashboard", count: 3, caption: "Klinik operasyonun ana merkezi" },
  { category: "Erişim anahtarları", count: 1, caption: "Süreli premium aktivasyon" },
  { category: "Care Hub", count: 1, caption: "Panelden iletişim merkezi" },
  { category: "Planlar", count: 5, caption: "Haftalık ve günlük plan yönetimi" },
  { category: "Randevular", count: 2, caption: "Klinik takvim ve görüşme akışı" },
  { category: "Tarifler", count: 9, caption: "Tarif kütüphanesi ve içe aktarma" },
];

function expandGroups(
  groups: Array<{ category: string; count: number; caption: string }>,
  base: "mobile" | "web",
  ext: "jpeg" | "jpg",
) {
  let index = 1;
  return groups.flatMap((group) =>
    Array.from({ length: group.count }, (_, itemIndex) => {
      const shotIndex = index++;
      return {
        src: `/landing/${base}/${base}-${pad(shotIndex)}.${ext}`,
        title: `${group.category} ${itemIndex + 1}`,
        caption: group.caption,
        category: group.category,
      };
    }),
  );
}

const mobileShots = expandGroups(mobileGroups, "mobile", "jpeg");
const webShots = expandGroups(webGroups, "web", "jpg");

const heroPhones = [mobileShots[3], mobileShots[19], mobileShots[24]];
const heroWeb = webShots[5];

const features: Feature[] = [
  {
    icon: LayoutDashboard,
    title: "Diyetisyen operasyon paneli",
    description:
      "Dashboard, danışanlar, planlar, randevular, tarifler, ölçümler, erişim anahtarları ve iletişim merkezi tek panelde yönetilir.",
  },
  {
    icon: TabletSmartphone,
    title: "Danışan mobil uygulaması",
    description:
      "Danışan günlük planını, uyumunu, alışveriş listesini, mutfak akışını, profilini ve motivasyon kartlarını aynı uygulamada görür.",
  },
  {
    icon: KeyRound,
    title: "Premium access key",
    description:
      "Diyetisyen süreli anahtar üretir; danışan mobil uygulamada bu kodla premium moda geçer ve doğru kliniğe bağlanır.",
  },
  {
    icon: Utensils,
    title: "AI mutfak ve tarif kütüphanesi",
    description:
      "Malzeme, tarif, plan ve alışveriş listesi arasında ürün hissi güçlü, kullanılabilir bir beslenme deneyimi kurulur.",
  },
  {
    icon: MessageCircle,
    title: "Care Hub iletişimi",
    description:
      "Sohbet, not ve klinik geri bildirim akışları panel ile mobil uygulama arasında düzenli bir iletişim katmanı oluşturur.",
  },
  {
    icon: ShieldCheck,
    title: "Premium SaaS modeli",
    description:
      "Ücretsiz plan karmaşası yoktur; lisans, panel erişimi, mobil aktivasyon ve klinik operasyon premium bir yapıda çalışır.",
  },
];

const workflow = [
  { icon: CalendarDays, title: "Paket seçilir", text: "3, 6, 12 veya 24 aylık lisansla klinik için net kullanım dönemi başlar." },
  { icon: Stethoscope, title: "Panel hazırlanır", text: "Diyetisyen marka, danışan, tarif ve plan yapılarını panelden düzenler." },
  { icon: KeyRound, title: "Danışan bağlanır", text: "Access key ile danışan mobil uygulamada premium olarak kliniğe bağlanır." },
  { icon: BarChart3, title: "Uyum izlenir", text: "Plan, ölçüm, mesaj, mutfak ve motivasyon verileri panelden takip edilir." },
];

const plans = [
  { name: "Pilot Başlangıç", duration: "3 Ay", text: "Sistemi küçük danışan grubunda denemek isteyen diyetisyenler için." },
  { name: "Büyüme Dönemi", duration: "6 Ay", text: "Aktif danışan takibi yapan ve düzenli dijital operasyon kuran klinikler için." },
  { name: "Klinik Paket", duration: "12 Ay", text: "Dytopia değerini tam yıl kullanmak isteyen profesyonel klinikler için.", featured: true },
  { name: "Uzun Dönem", duration: "24 Ay", text: "Dijital klinik modelini uzun vadeli çalışma düzenine çevirmek isteyenler için." },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.26)]">
        <Stethoscope className="h-5 w-5" />
      </div>
      <div>
        <div className="text-lg font-black leading-none tracking-tight text-slate-950">Dytopia</div>
        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Clinic SaaS</div>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
      <Sparkles className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function PhoneCard({ shot, priority = false }: { shot: Shot; priority?: boolean }) {
  return (
    <article className="group relative w-[176px] shrink-0 overflow-hidden rounded-[2rem] border border-white/90 bg-white p-2 shadow-[0_24px_60px_rgba(15,50,32,0.16)] transition duration-300 hover:-translate-y-1 sm:w-[205px]">
      <div className="relative overflow-hidden rounded-[1.55rem] bg-emerald-50">
        <Image
          src={shot.src}
          alt={`${shot.title} ekran görüntüsü`}
          width={1080}
          height={2340}
          priority={priority}
          className="h-auto w-full transition duration-500 group-hover:scale-[1.025]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/82 via-slate-950/22 to-transparent p-4 pt-24">
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white backdrop-blur">
            Mobil
          </span>
          <h3 className="mt-2 text-sm font-black text-white">{shot.category}</h3>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/74">{shot.caption}</p>
        </div>
      </div>
    </article>
  );
}

function WebCard({ shot, priority = false }: { shot: Shot; priority?: boolean }) {
  return (
    <article className="group relative w-[540px] shrink-0 overflow-hidden rounded-[1.7rem] border border-white/90 bg-white p-2 shadow-[0_24px_65px_rgba(15,50,32,0.13)] transition duration-300 hover:-translate-y-1 sm:w-[660px]">
      <div className="relative overflow-hidden rounded-[1.25rem] bg-emerald-50">
        <Image
          src={shot.src}
          alt={`${shot.title} web panel ekran görüntüsü`}
          width={1918}
          height={863}
          priority={priority}
          className="h-auto w-full transition duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent p-5 pt-24">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur">
            Web Panel
          </span>
          <h3 className="mt-3 text-lg font-black text-white">{shot.category}</h3>
          <p className="mt-1 text-sm font-medium text-white/76">{shot.caption}</p>
        </div>
      </div>
    </article>
  );
}

function GalleryPhone({ shot, index }: { shot: Shot; index: number }) {
  return (
    <article className="rounded-[1.35rem] border border-emerald-950/10 bg-white p-2 shadow-[0_16px_42px_rgba(15,50,32,0.08)]">
      <div className="overflow-hidden rounded-[1rem] bg-emerald-50">
        <Image
          src={shot.src}
          alt={`${shot.title} galeri görseli`}
          width={1080}
          height={2340}
          priority={index < 4}
          className="h-auto w-full"
        />
      </div>
      <div className="px-2 py-3">
        <p className="text-sm font-black text-slate-950">{shot.title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{shot.caption}</p>
      </div>
    </article>
  );
}

function GalleryWeb({ shot, index }: { shot: Shot; index: number }) {
  return (
    <article className="rounded-[1.35rem] border border-emerald-950/10 bg-white p-2 shadow-[0_16px_42px_rgba(15,50,32,0.08)]">
      <div className="overflow-hidden rounded-[1rem] bg-emerald-50">
        <Image
          src={shot.src}
          alt={`${shot.title} galeri görseli`}
          width={1918}
          height={863}
          priority={index < 2}
          className="h-auto w-full"
        />
      </div>
      <div className="px-2 py-3">
        <p className="text-sm font-black text-slate-950">{shot.title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{shot.caption}</p>
      </div>
    </article>
  );
}

export default function HomePage() {
  const mobileMarquee = [...mobileShots, ...mobileShots];
  const webMarquee = [...webShots, ...webShots];

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4fbf6] text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-emerald-950/10 bg-[#f7fcf8]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {[
              ["Platform", "#platform"],
              ["Galeri", "#gallery"],
              ["İşleyiş", "#workflow"],
              ["Fiyatlar", "#pricing"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="rounded-full px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-white hover:text-emerald-700">
                {label}
              </a>
            ))}
          </nav>
          <Link href="/auth/login" className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.25)] transition hover:bg-emerald-700">
            Panel Girişi
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative border-b border-emerald-950/10 pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.13),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.94fr_1.06fr] lg:px-8 lg:py-28">
          <div className="max-w-3xl">
            <Eyebrow>Premium diyetisyen SaaS platformu</Eyebrow>
            <h1 className="mt-7 text-[3.35rem] font-black leading-[0.96] tracking-[-0.055em] text-slate-950 sm:text-7xl lg:text-[5.9rem]">
              Dijital kliniğin web ve mobil merkezi.
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-slate-600 sm:text-xl">
              Dytopia; diyetisyen panelini, danışan mobil uygulamasını, premium access key sistemini, tarif motorunu, ölçüm takibini ve Care Hub iletişimini tek profesyonel SaaS deneyiminde birleştirir.
            </p>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                ["46", "Mobil ekran görseli"],
                ["26", "Web panel görseli"],
                ["Premium", "Ücretsiz plan yok"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-[1.35rem] border border-white/80 bg-white/76 p-5 shadow-sm backdrop-blur">
                  <p className="text-2xl font-black text-slate-950">{value}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#gallery" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-7 py-4 text-base font-black text-white shadow-[0_22px_50px_rgba(15,23,42,0.24)] transition hover:bg-emerald-700">
                Galeriyi İncele
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#pricing" className="inline-flex items-center rounded-full border border-emerald-900/15 bg-white/85 px-7 py-4 text-base font-black text-slate-850 shadow-sm backdrop-blur transition hover:border-emerald-400 hover:text-emerald-700">
                Paketleri Gör
              </a>
            </div>
          </div>

          <div className="relative min-h-[620px]">
            <div className="absolute left-0 right-0 top-3 overflow-hidden rounded-[2rem] border border-white/90 bg-white p-2 shadow-[0_36px_100px_rgba(15,50,32,0.16)]">
              <Image
                src={heroWeb.src}
                alt="Dytopia web panel dashboard"
                width={1918}
                height={863}
                priority
                className="h-auto w-full rounded-[1.45rem]"
              />
            </div>
            <div className="absolute bottom-0 left-2 flex items-end gap-4 sm:left-10">
              {heroPhones.map((shot, index) => (
                <div key={shot.src} className={index === 1 ? "mb-10" : ""}>
                  <PhoneCard shot={shot} priority />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-3xl">
            <Eyebrow>Platform yapısı</Eyebrow>
            <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.035em] sm:text-6xl">
              Bir landing değil, gerçek ürünün profesyonel vitrini.
            </h2>
            <p className="mt-5 text-lg font-semibold leading-8 text-slate-600">
              Sayfadaki tüm ekranlar doğrudan verdiğin web panel ve mobil uygulama ekran görüntüsü klasörlerinden gelir. Eski showcase görselleri kullanılmaz.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-[1.6rem] border border-emerald-950/10 bg-white p-6 shadow-[0_18px_48px_rgba(15,50,32,0.08)]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-black tracking-tight text-slate-950">{feature.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-[#e8f7ee] py-24">
        <div className="mx-auto mb-12 max-w-7xl px-4 sm:px-6 lg:px-8">
          <Eyebrow>Canlı ürün akışı</Eyebrow>
          <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-[-0.035em] sm:text-6xl">
            Mobil ve web ekranları aynı klinik temada birlikte çalışır.
          </h2>
        </div>

        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-[#e8f7ee] to-transparent sm:w-44" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-[#e8f7ee] to-transparent sm:w-44" />
          <div className="animate-marquee gap-5 pl-6" style={{ animationDuration: "76s" }}>
            {mobileMarquee.map((shot, index) => (
              <PhoneCard key={`${shot.src}-${index}`} shot={shot} priority={index < 4} />
            ))}
          </div>
        </div>

        <div className="relative mt-16 overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-[#e8f7ee] to-transparent sm:w-44" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-[#e8f7ee] to-transparent sm:w-44" />
          <div className="animate-marquee-reverse gap-5 pl-6" style={{ animationDuration: "84s" }}>
            {webMarquee.map((shot, index) => (
              <WebCard key={`${shot.src}-${index}`} shot={shot} priority={index < 3} />
            ))}
          </div>
        </div>
      </section>

      <section id="gallery" className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>Galeri</Eyebrow>
              <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-[-0.035em] sm:text-6xl">
                Tüm yeni mobil ekranlar.
              </h2>
            </div>
            <p className="max-w-xl text-sm font-semibold leading-7 text-slate-600">
              Ana sayfa, mutfak, plan, Care Hub, profil, alışveriş listesi, oyunlaştırma ve tabak tarama ekranları; tamamı yeni klasörden alınır.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {mobileShots.map((shot, index) => (
              <GalleryPhone key={shot.src} shot={shot} index={index} />
            ))}
          </div>

          <div className="mb-10 mt-24 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>Web panel galerisi</Eyebrow>
              <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-[-0.035em] sm:text-6xl">
                Tüm yeni web panel ekranları.
              </h2>
            </div>
            <p className="max-w-xl text-sm font-semibold leading-7 text-slate-600">
              Dashboard, danışanlar, planlar, tarifler, ayarlar, randevular, erişim anahtarları ve Care Hub görselleri yeni klasörden gelir.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {webShots.map((shot, index) => (
              <GalleryWeb key={shot.src} shot={shot} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y border-emerald-950/10 bg-[#eef8f2] px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 grid gap-6 lg:grid-cols-[0.9fr_1fr] lg:items-end">
            <div>
              <Eyebrow>İşleyiş</Eyebrow>
              <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.035em] sm:text-6xl">
                Satın alımdan aktif dijital kliniğe.
              </h2>
            </div>
            <p className="max-w-2xl text-lg font-semibold leading-8 text-slate-600">
              Sistem, diyetisyenin operasyonunu sadeleştirirken danışanın günlük uygulama kullanımını canlı tutacak şekilde kurgulanır.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflow.map((step, index) => (
              <article key={step.title} className="relative overflow-hidden rounded-[1.6rem] border border-emerald-950/10 bg-white p-6 shadow-[0_18px_48px_rgba(15,50,32,0.08)]">
                <div className="absolute right-5 top-4 text-6xl font-black text-emerald-100">0{index + 1}</div>
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="relative mt-8 text-xl font-black tracking-tight">{step.title}</h3>
                <p className="relative mt-3 text-sm font-semibold leading-7 text-slate-600">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-3xl">
            <Eyebrow>Fiyatlandırma</Eyebrow>
            <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.035em] sm:text-6xl">
              Ücretsiz plan yok. Sadece premium klinik deneyimi.
            </h2>
            <p className="mt-5 text-lg font-semibold leading-8 text-slate-600">
              Tüm paketlerde web panel, mobil premium deneyim, access key sistemi, tarif ve plan operasyonu dahildir.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative rounded-[1.7rem] border p-7 shadow-[0_20px_55px_rgba(15,50,32,0.09)] ${
                  plan.featured ? "border-emerald-400 bg-slate-950 text-white" : "border-emerald-950/10 bg-white text-slate-950"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Önerilen
                  </span>
                )}
                <h3 className="text-xl font-black">{plan.name}</h3>
                <div className={`mt-5 text-5xl font-black ${plan.featured ? "text-emerald-300" : "text-emerald-700"}`}>{plan.duration}</div>
                <p className={`mt-4 text-sm font-semibold leading-7 ${plan.featured ? "text-white/72" : "text-slate-600"}`}>{plan.text}</p>
                <ul className="mt-7 space-y-3">
                  {["Tam web panel erişimi", "Mobil premium aktivasyon", "Access key yönetimi", "Klinik operasyon modülleri"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm font-bold">
                      <CheckCircle2 className={`h-4 w-4 ${plan.featured ? "text-emerald-300" : "text-emerald-600"}`} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/iletisim"
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-black transition ${
                    plan.featured ? "bg-emerald-500 text-white hover:bg-emerald-400" : "border border-emerald-700/25 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  İletişime Geç
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-emerald-950/10 bg-slate-950 px-4 py-24 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Eyebrow>Canlıya hazır ürün dili</Eyebrow>
            <h2 className="mt-6 text-4xl font-black leading-tight tracking-[-0.035em] sm:text-6xl">
              Dytopia artık gerçek ekranlarıyla premium bir SaaS vitrini.
            </h2>
            <p className="mt-5 text-lg font-semibold leading-8 text-white/68">
              Ana sayfa, ürünün hem diyetisyen tarafını hem danışan mobil deneyimini doğrudan gösterir. Teferruatlıdır, taranabilir ve güven verir.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#gallery" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-4 text-base font-black text-white transition hover:bg-emerald-400">
                Galeriye Dön
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/auth/login" className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-8 py-4 text-base font-black text-white backdrop-blur transition hover:bg-white/15">
                Panel Girişi
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              [Zap, "Hızlı aktivasyon"],
              [ClipboardList, "Plan yönetimi"],
              [Users, "Danışan takibi"],
              [BarChart3, "Uyum verisi"],
            ].map(([Icon, label]) => (
              <div key={label as string} className="rounded-[1.4rem] border border-white/10 bg-white/8 p-5">
                <Icon className="h-5 w-5 text-emerald-300" />
                <p className="mt-8 text-sm font-black">{label as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-emerald-950/10 bg-white px-4 py-9 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 sm:flex-row">
          <Logo />
          <div className="flex gap-5 text-sm font-bold text-slate-500">
            <a href="#platform" className="hover:text-emerald-700">Platform</a>
            <a href="#gallery" className="hover:text-emerald-700">Galeri</a>
            <a href="#pricing" className="hover:text-emerald-700">Fiyatlar</a>
          </div>
          <p className="text-sm font-semibold text-slate-500">© 2026 Dytopia. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </main>
  );
}
