'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (pathname === '/owner/giris') {
      setChecking(false);
      return;
    }

    fetch('/api/owner/messages')
      .then((res) => {
        if (res.status === 401) {
          router.push('/owner/giris');
        } else {
          setChecking(false);
        }
      })
      .catch(() => router.push('/owner/giris'));
  }, [pathname, router]);

  if (pathname === '/owner/giris') return <>{children}</>;

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-[var(--brand-emerald)]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Yetki kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
