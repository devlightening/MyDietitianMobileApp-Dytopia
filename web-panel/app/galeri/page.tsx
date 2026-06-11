import { mobileShots, webShots } from "@/components/marketing/MarketingAssets";
import { BrowserFrame, CTA, PageShell, PhoneFrame, Tag } from "@/components/marketing/MarketingSite";

const mobileSelection = [0,3,8,12,15,18,20,23,26,30,34,38,42,45];
const webSelection = [0,2,5,6,9,10,13,16,20,24];

export default function GalleryPage() {
  return <PageShell>
    <section className="px-5 py-20 lg:px-8 lg:py-28"><div className="mx-auto max-w-[1320px]"><Tag>Gerçek ürün galerisi</Tag><div className="mt-7 grid gap-8 lg:grid-cols-[1fr_.7fr] lg:items-end"><h1 className="text-5xl font-black leading-[.98] tracking-[-.06em] sm:text-7xl">Sunum değil. Çalışan ürünün kendisi.</h1><p className="text-base font-medium leading-8 text-[#557269]">Galerideki tüm görseller doğrudan güncel mobil uygulama ve web panel ekranlarından seçildi. 46 mobil, 26 web ekranı.</p></div></div></section>
    <section className="bg-[#073c2c] px-5 py-20 text-white lg:px-8"><div className="mx-auto max-w-[1320px]"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Mobil uygulama</p><h2 className="mt-4 text-4xl font-black tracking-[-.05em] !text-white sm:text-6xl">Danışanın günlük deneyimi.</h2><div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">{mobileSelection.map(i=><PhoneFrame key={i} src={mobileShots[i]} className="w-full"/>)}</div></div></section>
    <section className="px-5 py-24 lg:px-8"><div className="mx-auto max-w-[1320px]"><Tag>Web panel</Tag><h2 className="mt-6 text-4xl font-black tracking-[-.05em] sm:text-6xl">Diyetisyenin operasyon merkezi.</h2><div className="mt-12 grid gap-6 lg:grid-cols-2">{webSelection.map(i=><BrowserFrame key={i} src={webShots[i]}/>)}</div></div></section>
    <CTA/>
  </PageShell>;
}
