"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { dietitianLogin } from "@/lib/auth-api";

export default function DietitianLoginPage() {
  const [values, setValues] = useState({ email: "", password: "", remember: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setValues(current => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setError("");
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    try { await dietitianLogin({ email: values.email.trim(), password: values.password }); window.location.href = "/dashboard"; }
    catch (err: any) { setError(err?.message || "E-posta veya şifre hatalı."); }
    finally { setLoading(false); }
  };

  return <main className="login-premium fixed inset-0 z-10 min-h-screen w-full overflow-y-auto overflow-x-hidden bg-[#F9F7F2] text-[#2D3436]">
    <div className="login-blob absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#4A7C59]/20 blur-3xl"/><div className="login-blob absolute -bottom-48 -right-36 h-[38rem] w-[38rem] rounded-full bg-[#F4D35E]/20 blur-3xl [animation-delay:-4s]"/><div className="marketing-grid"/>
    <Link href="/" className="absolute left-5 top-5 z-30 inline-flex items-center gap-2 rounded-full border border-[#4A7C59]/15 bg-white/70 px-4 py-2 text-xs font-black backdrop-blur-xl"><ArrowLeft size={14}/> Ana sayfa</Link>
    <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1500px] lg:grid-cols-[1.05fr_.95fr]">
      <section className="hidden p-8 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <Link href="/" className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white shadow-xl"><Image src="/brand/dytopia-logo.png" alt="" width={46} height={46}/></span><span><b className="block text-xl font-black">Dytopia</b><small className="text-[9px] font-black uppercase tracking-[.22em] text-[#4A7C59]">Diyet Uyum Asistanı</small></span></Link>
        <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-[#4A7C59]/12 bg-white/55 px-4 py-2 text-[10px] font-black uppercase tracking-[.18em] text-[#4A7C59]"><Sparkles size={13}/> Güvenli klinik çalışma alanı</span><h1 className="mt-7 text-6xl font-black leading-[.96] tracking-[-.065em]">Dijital kliniğinize hoş geldiniz.</h1><p className="mt-6 max-w-xl text-lg font-medium leading-8 text-[#65736d]">Danışan uyumunu, tariflerinizi ve Access Key süreçlerinizi tek panelden yönetin.</p><div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs font-bold text-[#607269]"><span className="flex items-center gap-2"><Users size={16} className="text-[#4A7C59]"/> Danışan yönetimi</span><span className="flex items-center gap-2"><BarChart3 size={16} className="text-[#4A7C59]"/> Uyum görünürlüğü</span><span className="flex items-center gap-2"><KeyRound size={16} className="text-[#4A7C59]"/> Access Key</span></div></div>
        <p className="flex items-center gap-2 text-xs font-bold text-[#65736d]"><ShieldCheck size={16} className="text-[#4A7C59]"/> Güvenli oturum · Klinik verileri koruması</p>
      </section>
      <section className="flex items-center justify-center px-5 py-20 lg:px-12"><div className="login-card login-phone-shell relative w-full max-w-lg rounded-[3.25rem] border border-white/90 bg-white/68 px-6 pb-8 pt-14 shadow-[0_35px_100px_rgba(47,82,51,.13)] backdrop-blur-2xl sm:px-10 sm:pb-10"><span className="login-dynamic-island" aria-hidden="true"><i/></span><div className="lg:hidden"><Image src="/brand/dytopia-logo.png" alt="Dytopia" width={52} height={52}/></div><p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-[#4A7C59]">Kurumsal erişim</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em]">Diyetisyen Paneli</h2><p className="mt-3 text-sm font-medium leading-6 text-[#65736d]">Klinik operasyonunuza güvenle devam edin.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <LoginField icon={Mail} label="E-posta" id="email" name="email" type="email" value={values.email} onChange={change} placeholder="isim@klinik.com" autoComplete="email" required/>
          <div><label htmlFor="password" className="text-[11px] font-extrabold text-[#708079]">Şifre</label><div className="login-field mt-2 flex h-[58px] items-center rounded-[1.35rem] border border-[#dfe6e1] bg-white/75 px-4 transition focus-within:border-[#9bb6a2] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#4A7C59]/8"><LockKeyhole size={18} className="text-[#6f9278]"/><input id="password" name="password" type={showPassword?"text":"password"} value={values.password} onChange={change} autoComplete="current-password" required placeholder="Şifrenizi girin" className="login-input h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold outline-none"/><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[#718078] transition hover:bg-[#edf3ee]" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?"Şifreyi gizle":"Şifreyi göster"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div>
          <div className="flex items-center justify-between gap-3"><label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#65736d]"><input type="checkbox" name="remember" checked={values.remember} onChange={change} className="h-4 w-4 accent-[#4A7C59]"/> Beni hatırla</label><span className="text-xs font-bold text-[#4A7C59]">Şifremi unuttum</span></div>
          {error&&<div role="alert" className="rounded-2xl border border-[#FF8C61]/30 bg-[#FF8C61]/10 px-4 py-3 text-sm font-bold text-[#a74425]">{error}</div>}
          <button disabled={loading} className="marketing-button flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#2F5233] text-sm font-black text-white shadow-[0_18px_45px_rgba(47,82,51,.24)] disabled:cursor-not-allowed disabled:opacity-60">{loading?"Giriş yapılıyor...":"Giriş yap"}<ArrowRight size={16}/></button>
        </form>
        <p className="mt-7 text-center text-xs font-semibold leading-6 text-[#65736d]">Aktif hesabınız yok mu? <Link href="/#iletisim" className="font-black text-[#4A7C59]">Demo görüşmesi planlayın.</Link></p>
      </div></section>
    </div>
  </main>;
}

function LoginField({icon:Icon,label,...props}:React.InputHTMLAttributes<HTMLInputElement>&{icon:typeof Mail;label:string}) {
  return <div><label htmlFor={props.id} className="text-[11px] font-extrabold text-[#708079]">{label}</label><div className="login-field mt-2 flex h-[58px] items-center rounded-[1.35rem] border border-[#dfe6e1] bg-white/75 px-4 transition focus-within:border-[#9bb6a2] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#4A7C59]/8"><Icon size={18} className="text-[#6f9278]"/><input {...props} className="login-input h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold outline-none"/></div></div>;
}
