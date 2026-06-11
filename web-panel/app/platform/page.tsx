import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { mobileShots, webShots } from "@/components/marketing/MarketingAssets";
import { BrowserFrame, CTA, FeatureGrid, PageShell, PhoneFrame, Tag } from "@/components/marketing/MarketingSite";

export default function PlatformPage() {
  return <PageShell>
    <section className="px-5 py-20 lg:px-8 lg:py-28"><div className="mx-auto max-w-[1320px] text-center"><Tag>Platform</Tag><h1 className="mx-auto mt-7 max-w-5xl text-5xl font-black leading-[.98] tracking-[-.06em] sm:text-7xl">Diyetisyenlik hizmetini dijital bir sisteme dönüştürün.</h1><p className="mx-auto mt-7 max-w-3xl text-lg font-medium leading-8 text-[#557269]">Klinik operasyonu, danışan bağlılığı ve günlük beslenme akışları tek ürün mimarisinde çalışır.</p></div></section>
    <section className="px-5 pb-24 lg:px-8"><div className="mx-auto max-w-[1320px]"><FeatureGrid/></div></section>
    <section className="bg-[#e8f6ed] px-5 py-24 lg:px-8"><div className="mx-auto grid max-w-[1320px] gap-16 lg:grid-cols-2 lg:items-center"><div><Tag>Diyetisyen paneli</Tag><h2 className="mt-6 text-4xl font-black leading-[1] tracking-[-.05em] sm:text-6xl">Klinik operasyonunun kontrol merkezi.</h2><p className="mt-6 text-base font-medium leading-8 text-[#557269]">Danışan kartları, planlar, randevular, tarif kütüphanesi, erişim anahtarları ve Care Hub birbirinden kopuk araçlar olmaktan çıkar.</p><ul className="mt-8 grid gap-3">{["Danışan uyumu ve aktivite görünürlüğü","Haftalık plan ve alternatif yönetimi","Tarif kütüphanesi ve içe aktarma","Premium erişim anahtarı yönetimi"].map(x=><li key={x} className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 size={17} className="text-emerald-600"/>{x}</li>)}</ul></div><BrowserFrame src={webShots[6]}/></div></section>
    <section className="px-5 py-24 lg:px-8"><div className="mx-auto grid max-w-[1320px] gap-16 lg:grid-cols-2 lg:items-center"><div className="flex justify-center gap-5"><PhoneFrame src={mobileShots[4]} className="w-[210px] rotate-[-4deg]"/><PhoneFrame src={mobileShots[21]} className="mt-12 w-[210px] rotate-[4deg]"/></div><div><Tag>Danışan uygulaması</Tag><h2 className="mt-6 text-4xl font-black leading-[1] tracking-[-.05em] sm:text-6xl">Takip edilmek değil, desteklenmek hissettirir.</h2><p className="mt-6 text-base font-medium leading-8 text-[#557269]">Danışan planını uygular, alternatif seçer, mutfağını yönetir, alışveriş listesini hazırlar ve ilerlemesini görür.</p><Link href="/galeri" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#073c2c] px-6 py-3.5 text-sm font-black text-white">Mobil deneyimi görün <ArrowRight size={15}/></Link></div></div></section>
    <CTA/>
  </PageShell>;
}
