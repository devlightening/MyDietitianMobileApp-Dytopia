"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function DietitianLoginPage() {
  const [values, setValues] = useState({ email: '', password: '', remember: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setValues((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/dietitian/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: values.email.trim(), password: values.password })
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'E-posta veya şifre hatalı.');
      }
      const data = await res.json();

      // Store in localStorage for client-side axios interceptor
      localStorage.setItem("accessToken", data.token);

      // Store in cookie for ServerGuard
      document.cookie = `access_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days

      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err?.message || 'E-posta veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-2">Diyetisyen Girişi</h1>
        <p className="text-center text-muted-foreground mb-4 text-base">
          Klinik hesabınıza giriş yapın.
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="E-posta"
            name="email"
            type="email"
            value={values.email}
            onChange={handleChange}
            required
            className="text-base"
          />
          <Input
            label="Şifre"
            name="password"
            type="password"
            value={values.password}
            onChange={handleChange}
            required
            className="text-base"
          />
          <div className="flex items-center gap-2">
            <input
              id="remember"
              type="checkbox"
              name="remember"
              checked={values.remember}
              onChange={handleChange}
              className="accent-accent"
            />
            <label htmlFor="remember" className="text-sm text-muted-foreground select-none">
              Beni hatırla
            </label>
          </div>
          {error && <div className="text-danger text-sm font-medium">{error}</div>}
          <Button type="submit" className="w-full mt-2" loading={loading} disabled={loading}>
            Giriş Yap
          </Button>
        </form>
        <div className="text-center text-sm mt-4">
          Hesabınız yok mu? <a href="/auth/register" className="text-primary hover:underline font-medium">Kayıt Ol</a>
        </div>
      </Card>
    </div>
  );
}
