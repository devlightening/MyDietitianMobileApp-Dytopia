'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export default function OwnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/owner/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push('/owner');
      } else {
        const data = await res.json();
        setError(data.error ?? 'Giriş yapılamadı.');
      }
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--surface-base)] p-4 overflow-hidden">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-[rgba(71,185,114,0.09)] blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[400px] w-[400px] rounded-full bg-[rgba(87,184,199,0.06)] blur-3xl" />
      </div>

      <div className="w-full max-w-md fade-in">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-primary)] shadow-[0_8px_28px_rgba(71,185,114,0.35)]">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22C6.5 22 2 17.5 2 12C2 8 4.5 4.5 8 3C8 3 7 8 12 8C17 8 16 3 16 3C19.5 4.5 22 8 22 12C22 17.5 17.5 22 12 22Z" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-[hsl(var(--foreground))]">
              Yönetici Paneli
            </h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Giriş bilgilerinizi girin
            </p>
          </div>
        </div>

        <div className="card-sfcos p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mydietitian.com"
                required
                autoComplete="email"
                className="input-sfcos"
                style={{ cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text' }}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Şifre
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="input-sfcos pr-11"
                  style={{ cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
                  style={{ cursor: 'pointer' }}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-[rgba(229,126,107,0.28)] bg-[rgba(229,126,107,0.08)] px-4 py-3 text-sm font-medium text-[var(--brand-coral)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3.5 font-bold"
              style={{ cursor: loading ? 'default' : 'pointer' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Giriş yapılıyor...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Giriş Yap
                </span>
              )}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-[hsl(var(--muted-foreground))]">
          Bu sayfa yalnızca yetkili yöneticiler içindir.
        </p>
      </div>
    </div>
  );
}
