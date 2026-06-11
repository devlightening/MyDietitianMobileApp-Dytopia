"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Menu, Sparkles, X } from "lucide-react";
import { useState } from "react";
import MarketingEffects from "./MarketingEffects";

const nav = [
  ["Platform", "#platform"],
  ["Özellikler", "#ozellikler"],
  ["Nasıl Çalışır", "#nasil-calisir"],
  ["Fiyatlandırma", "#fiyatlandirma"],
  ["SSS", "#sss"],
  ["İletişim", "#iletisim"],
] as const;

export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className="flex items-center gap-3" aria-label="Dytopia ana sayfa">
    <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_12px_30px_rgba(47,82,51,.16)]">
      <Image src="/brand/dytopia-logo.png" alt="" width={42} height={42} priority />
    </span>
    <span><b className={`block text-lg font-black leading-none ${light ? "text-white" : "text-[#2D3436]"}`}>Dytopia</b><small className={`mt-1 block text-[9px] font-black uppercase tracking-[.25em] ${light ? "text-[#F4D35E]" : "text-[#4A7C59]"}`}>Diyet Uyum Asistanı</small></span>
  </Link>;
}

export function Header() {
  const [open, setOpen] = useState(false);
  return <header className="marketing-header sticky top-0 z-50 border-b border-[#4A7C59]/10 bg-[#F9F7F2]/85 backdrop-blur-2xl">
    <div className="mx-auto flex h-[76px] max-w-[1380px] items-center justify-between px-5 lg:px-8">
      <Brand />
      <nav className="hidden items-center gap-6 lg:flex">{nav.map(([label, href]) => <Link key={href} href={href} className="text-xs font-extrabold text-[#5e6d68] transition hover:text-[#2F5233]">{label}</Link>)}</nav>
      <div className="flex items-center gap-2">
        <Link href="/auth/login" className="hidden rounded-full px-4 py-2.5 text-sm font-bold text-[#40574b] sm:block">Panel girişi</Link>
        <Link href="#iletisim" className="marketing-button inline-flex items-center gap-2 rounded-full bg-[#2F5233] px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(47,82,51,.2)]">Demo al <ArrowRight size={15}/></Link>
        <button type="button" aria-label="Menüyü aç" aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-11 w-11 place-items-center rounded-full border border-[#4A7C59]/15 bg-white lg:hidden">{open ? <X size={18}/> : <Menu size={18}/>}</button>
      </div>
    </div>
    {open && <nav className="border-t border-[#4A7C59]/10 bg-[#F9F7F2]/95 px-5 py-5 backdrop-blur-2xl lg:hidden">{nav.map(([label, href]) => <Link onClick={() => setOpen(false)} key={href} href={href} className="block border-b border-[#4A7C59]/10 py-3 text-sm font-extrabold">{label}</Link>)}</nav>}
  </header>;
}

export function Footer() {
  return <footer className="bg-[#233d29] px-5 py-16 text-white">
    <div className="mx-auto grid max-w-[1380px] gap-12 lg:grid-cols-[1.5fr_.7fr_.7fr_.8fr]">
      <div><Brand light/><p className="mt-6 max-w-md text-sm font-medium leading-7 text-white/55">Diyetisyen operasyonunu ve danışanın günlük mutfak kararlarını tek premium klinik sisteminde buluşturur.</p></div>
      <FooterGroup title="Platform" links={[["Özellikler","#ozellikler"],["Mutfak","#mutfak"],["Web panel","#web-panel"]]}/>
      <FooterGroup title="Başlayın" links={[["Demo al","#iletisim"],["Fiyatlandırma","#fiyatlandirma"],["Panel girişi","/auth/login"]]}/>
      <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#F4D35E]">İletişim</p><p className="mt-5 text-sm font-semibold text-white/65">info@mydietitian.com</p><p className="mt-3 text-sm font-semibold text-white/65">Hafta içi 09:00–18:00</p></div>
    </div>
    <div className="mx-auto mt-14 flex max-w-[1380px] flex-wrap justify-between gap-3 border-t border-white/10 pt-6 text-xs font-semibold text-white/35"><span>© 2026 Dytopia</span><span>Klinik güveni, mutfak uygulanabilirliği.</span></div>
  </footer>;
}

function FooterGroup({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#F4D35E]">{title}</p><div className="mt-5 grid gap-3 text-sm font-semibold text-white/65">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div></div>;
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return <main className="marketing-site relative min-h-screen overflow-hidden bg-[#F9F7F2] text-[#2D3436]"><MarketingEffects/><div className="marketing-grid"/><Header/><div className="relative z-[1]">{children}</div><Footer/></main>;
}

export function Tag({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <span className={`marketing-tag inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[.19em] shadow-sm ${dark ? "border-white/15 bg-white/10 text-[#F4D35E]" : "border-[#4A7C59]/20 bg-white/75 text-[#4A7C59]"}`}><Sparkles size={13}/>{children}</span>;
}

export function BrowserFrame({ src, className = "", alt = "Dytopia diyetisyen web paneli" }: { src: string; className?: string; alt?: string }) {
  return <div className={`marketing-frame overflow-hidden rounded-[1.7rem] border border-white bg-white p-2 shadow-[0_28px_70px_rgba(47,82,51,.16)] ${className}`}><div className="flex h-8 items-center gap-1.5 px-3"><i className="h-2.5 w-2.5 rounded-full bg-[#FF8C61]"/><i className="h-2.5 w-2.5 rounded-full bg-[#F4D35E]"/><i className="h-2.5 w-2.5 rounded-full bg-[#77ba83]"/></div><Image src={src} alt={alt} width={1918} height={863} className="w-full rounded-[1.2rem] border border-[#4A7C59]/10"/></div>;
}

export function PhoneFrame({ src, className = "", alt = "Dytopia danışan mobil uygulaması" }: { src: string; className?: string; alt?: string }) {
  return <div className={`marketing-frame iphone-frame relative rounded-[2.75rem] bg-[#1b1d1c] p-[6px] shadow-[0_30px_70px_rgba(25,35,29,.28)] ${className}`}>
    <i className="iphone-action-button"/><i className="iphone-volume-up"/><i className="iphone-volume-down"/><i className="iphone-power-button"/>
    <div className="iphone-screen relative overflow-hidden rounded-[2.38rem] bg-white">
      <span className="iphone-island" aria-hidden="true"><i/></span>
      <Image src={src} alt={alt} width={1080} height={2340} className="h-auto w-full" loading="lazy"/>
    </div>
  </div>;
}

export function SectionIntro({ eyebrow, title, text, dark = false }: { eyebrow: string; title: string; text?: string; dark?: boolean }) {
  return <div data-reveal className="max-w-4xl"><Tag dark={dark}>{eyebrow}</Tag><h2 className={`mt-6 text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-6xl ${dark ? "!text-white" : "text-[#2D3436]"}`}>{title}</h2>{text && <p className={`mt-6 max-w-2xl text-base font-medium leading-8 ${dark ? "text-white/60" : "text-[#65736d]"}`}>{text}</p>}</div>;
}

export function CTA() {
  return <section className="px-5 py-20 lg:px-8"><div className="marketing-cta mx-auto max-w-[1380px] rounded-[2.5rem] bg-[#2F5233] px-8 py-14 text-white"><h2 className="max-w-3xl text-4xl font-black !text-white sm:text-6xl">Dytopia’yı kendi kliniğinizde görün.</h2><Link href="/#iletisim" className="mt-8 inline-flex rounded-full bg-[#F4D35E] px-6 py-4 text-sm font-black text-[#2D3436]">Demo al</Link></div></section>;
}

export function FeatureGrid() {
  return <div className="grid gap-4 md:grid-cols-3">{["Klinik operasyonu","Danışan deneyimi","Akıllı mutfak"].map(title=><article key={title} className="premium-card rounded-[1.7rem] border border-[#E3E8E5] bg-white p-6"><Check className="text-[#4A7C59]" size={20}/><h3 className="mt-5 text-lg font-black">{title}</h3></article>)}</div>;
}
