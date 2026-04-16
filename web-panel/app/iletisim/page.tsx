'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  Phone,
  Send,
  User,
  MessageSquare,
  FileText,
} from 'lucide-react';

type FormState = 'idle' | 'loading' | 'success' | 'error';

const subjects = [
  'Abonelik ve Fiyatlandırma',
  'Panel Kullanımı',
  'Teknik Destek',
  'Mobil Uygulama',
  'Danışan Aktivasyonu',
  'Diğer',
];

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    setError('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setState('success');
      } else {
        const data = await res.json();
        setError(data.error ?? 'Bir hata oluştu.');
        setState('error');
      }
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
      setState('error');
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--surface-base)] overflow-hidden">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-60 -top-20 h-[600px] w-[600px] rounded-full bg-[rgba(71,185,114,0.10)] blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-[rgba(87,184,199,0.07)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(52,111,73,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(52,111,73,0.022)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[rgba(246,251,247,0.88)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-primary)] shadow-[0_4px_14px_rgba(71,185,114,0.32)]">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22C6.5 22 2 17.5 2 12C2 8 4.5 4.5 8 3C8 3 7 8 12 8C17 8 16 3 16 3C19.5 4.5 22 8 22 12C22 17.5 17.5 22 12 22Z" />
              </svg>
            </div>
            <span className="text-[1.1rem] font-black tracking-tight text-[hsl(var(--foreground))]">MyDietitian</span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-white/60 px-4 py-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] backdrop-blur transition-all hover:border-[var(--border-emerald-dim)] hover:text-[hsl(var(--foreground))]"
            style={{ cursor: 'pointer' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Ana Sayfa
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 text-center fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-emerald-dim)] bg-[var(--brand-primary-softer)] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-emerald)]">
            <Mail className="h-3.5 w-3.5" />
            İletişim
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-[-0.04em] text-[hsl(var(--foreground))] sm:text-5xl lg:text-[3.5rem]">
            Nasıl yardımcı olabiliriz?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[hsl(var(--muted-foreground))]">
            Abonelik, panel kullanımı veya teknik konularda sorularınızı iletin.
            En kısa sürede size dönüş yapıyoruz.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          {/* Left info panel */}
          <div className="fade-in stagger-1 space-y-5">
            {[
              {
                icon: Mail,
                label: 'E-posta',
                value: 'info@mydietitian.com',
                sub: 'Genellikle 24 saat içinde yanıt',
              },
              {
                icon: Phone,
                label: 'Telefon',
                value: '+90 (555) 000 00 00',
                sub: 'Hafta içi 09:00–18:00',
              },
              {
                icon: MessageSquare,
                label: 'Destek',
                value: 'Panel içi mesaj',
                sub: 'Premium kullanıcılara öncelikli',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="card-sfcos p-6"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-primary-soft)]">
                  <item.icon className="h-4.5 w-4.5 text-[var(--brand-emerald)]" />
                </div>
                <div className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                  {item.label}
                </div>
                <div className="mt-1 font-bold text-[hsl(var(--foreground))]">{item.value}</div>
                <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{item.sub}</div>
              </div>
            ))}

            <div className="card-premium p-6">
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--brand-emerald)]">
                Yanıt Süresi
              </div>
              {[
                { label: 'Abonelik sorguları', time: '2–4 saat' },
                { label: 'Teknik destek', time: '4–12 saat' },
                { label: 'Genel bilgi', time: '24 saat' },
              ].map((r) => (
                <div key={r.label} className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">{r.label}</span>
                  <span className="font-bold text-[var(--brand-emerald)]">{r.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="fade-in stagger-2">
            {state === 'success' ? (
              <div className="card-premium flex h-full min-h-[480px] flex-col items-center justify-center gap-5 p-10 text-center scale-in">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--brand-primary-soft)]">
                  <CheckCircle2 className="h-10 w-10 text-[var(--brand-emerald)]" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-[hsl(var(--foreground))]">
                    Mesajınız alındı
                  </h2>
                  <p className="mt-3 text-[hsl(var(--muted-foreground))]">
                    En kısa sürede <strong>{form.email}</strong> adresinize dönüş yapacağız.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setForm({ name: '', email: '', phone: '', subject: '', message: '' });
                    setState('idle');
                  }}
                  className="btn-emerald-outline mt-2"
                  style={{ cursor: 'pointer' }}
                >
                  Yeni Mesaj Gönder
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="card-sfcos space-y-5 p-8 lg:p-10"
              >
                <h2 className="text-xl font-black tracking-tight text-[hsl(var(--foreground))]">
                  Mesaj Gönder
                </h2>

                {/* Name + Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                      <User className="h-3 w-3" /> Ad Soyad *
                    </span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={set('name')}
                      placeholder="Adınız Soyadınız"
                      required
                      className="input-sfcos"
                      style={{ cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text' }}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                      <Mail className="h-3 w-3" /> E-posta *
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      placeholder="ornek@mail.com"
                      required
                      className="input-sfcos"
                      style={{ cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text' }}
                    />
                  </label>
                </div>

                {/* Phone + Subject */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                      <Phone className="h-3 w-3" /> Telefon
                    </span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="+90 5xx xxx xx xx"
                      className="input-sfcos"
                      style={{ cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text' }}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                      <FileText className="h-3 w-3" /> Konu *
                    </span>
                    <select
                      value={form.subject}
                      onChange={set('subject')}
                      required
                      className="input-sfcos appearance-none"
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="">Konu seçin...</option>
                      {subjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Message */}
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                    <MessageSquare className="h-3 w-3" /> Mesajınız *
                  </span>
                  <textarea
                    value={form.message}
                    onChange={set('message')}
                    placeholder="Mesajınızı buraya yazın..."
                    required
                    rows={5}
                    className="input-sfcos resize-none"
                    style={{ cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text' }}
                  />
                </label>

                {state === 'error' && (
                  <div className="rounded-xl border border-[rgba(229,126,107,0.30)] bg-[rgba(229,126,107,0.08)] px-4 py-3 text-sm font-medium text-[var(--brand-coral)]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={state === 'loading'}
                  className="btn-primary w-full justify-center py-3.5 text-base font-bold"
                  style={{ cursor: state === 'loading' ? 'default' : 'pointer' }}
                >
                  {state === 'loading' ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Gönderiliyor...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Mesaj Gönder
                    </span>
                  )}
                </button>

                <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
                  Bilgileriniz yalnızca iletişim amacıyla kullanılır, üçüncü taraflarla paylaşılmaz.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="mt-16 border-t border-[var(--border-default)] py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        © 2026 MyDietitian. Tüm hakları saklıdır.
      </footer>
    </div>
  );
}
