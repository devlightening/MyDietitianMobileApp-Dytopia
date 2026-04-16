"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ClientAccessPage() {
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAccessKey(e.target.value);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    setError("");

    if (!accessKey.trim()) {
      setError("Erişim anahtarı zorunludur.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/client/access-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessKey }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Giriş yapılamadı.");
      }

      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err?.toString() || "Giriş yapılamadı.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md space-y-6 p-8">
          <Skeleton className="mx-auto mb-4 h-7 w-2/3" />
          <Skeleton className="mb-3 h-10 w-full" />
          <Skeleton className="mb-3 h-10 w-full" />
          <Skeleton className="mx-auto h-6 w-1/2" />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md space-y-6 p-8 shadow-lg">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold">Erişim anahtarı ile giriş</h1>
          <p className="text-muted-foreground">
            Diyetisyeninizin sizinle paylaştığı erişim anahtarını girin.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Anahtarınız yoksa lütfen diyetisyeninizle iletişime geçin.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Erişim anahtarı"
            name="accessKey"
            value={accessKey}
            onChange={handleChange}
            required
            error={submitted && error ? error : ""}
          />
          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? "İşleniyor..." : "Devam et"}
          </Button>
        </form>

        {error ? (
          <div className="mt-4 flex flex-col items-center text-danger">
            <div className="mb-1 font-semibold">{error}</div>
            <div className="text-sm">Lütfen anahtarınızı kontrol edip tekrar deneyin.</div>
          </div>
        ) : null}

        <div className="text-center text-sm">
          <a href="/auth/login" className="font-medium text-primary hover:underline">
            Diyetisyen girişi
          </a>
        </div>
      </Card>
    </div>
  );
}
