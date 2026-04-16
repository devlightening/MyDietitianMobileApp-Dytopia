"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { dietitianLogin } from "@/lib/auth-api";

export default function DietitianLoginPage() {
  const [values, setValues] = useState({ email: "", password: "", remember: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setValues((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await dietitianLogin({ email: values.email.trim(), password: values.password });
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err?.message || "E-posta veya şifre hatalı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--surface-base)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: "rgba(71,185,114,0.16)" }} />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full blur-3xl" style={{ background: "rgba(0,191,179,0.10)" }} />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-[30px] border border-border/80 bg-white/88 p-8 shadow-[0_24px_80px_rgba(31,73,46,0.10)] backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 7v10M7 12h10" />
                <circle cx="12" cy="12" r="9" opacity="0.35" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Diyetisyen girişi</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Aktif aboneliği olan panel hesabınıza giriş yapın.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} method="POST">
            <Input
              id="email"
              name="email"
              type="email"
              label="E-posta"
              value={values.email}
              onChange={handleChange}
              required
              placeholder="isim@klinik.com"
              className="input-sfcos"
            />

            <Input
              id="password"
              name="password"
              type="password"
              label="Şifre"
              value={values.password}
              onChange={handleChange}
              required
              placeholder="Şifrenizi girin"
              className="input-sfcos"
            />

            <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 text-sm select-none text-muted-foreground">
              <input
                id="remember"
                type="checkbox"
                name="remember"
                checked={values.remember}
                onChange={handleChange}
                className="h-4 w-4 rounded accent-[#1A9D6C]"
              />
              Beni hatırla
            </label>

            {error ? (
              <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-2 h-12 w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Giriş yapılıyor..." : "Giriş yap"}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-border/70 bg-secondary/70 px-4 py-4 text-center">
            <p className="text-sm font-semibold text-foreground">
              Erişim yalnızca satın alma ve aktivasyon sonrası açılır.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Henüz aktif hesabınız yoksa önce satış sayfasındaki paketleri inceleyin veya size
              iletilen aktivasyon bağlantısını kullanın.
            </p>
            <a href="/" className="mt-3 inline-flex text-sm font-semibold text-primary transition hover:underline">
              Satış sayfasına dön
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
