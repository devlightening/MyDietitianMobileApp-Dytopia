'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'dietitian' | 'admin';
}

export function AuthGuard({ children, requiredRole = 'dietitian' }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) {
      return;
    }

    if (pathname.startsWith('/auth')) {
      setIsChecking(false);
      return;
    }

    async function checkAuth() {
      try {
        hasChecked.current = true;

        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (!response.ok) {
          setError('error');
          setIsChecking(false);
          return;
        }

        const data = await response.json();

        if (requiredRole && data.role !== requiredRole) {
          setError('forbidden');
          setIsAuthorized(false);
          setIsChecking(false);
          return;
        }

        setIsAuthorized(true);
        setIsChecking(false);
      } catch {
        setError('error');
        setIsChecking(false);
      }
    }

    void checkAuth();
  }, [pathname, requiredRole, router]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 p-8 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-muted-foreground">Oturum doğrulanıyor...</p>
        </div>
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-md p-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Erişim engellendi</h1>
          <p className="mb-6 text-muted-foreground">
            Bu sayfayı görüntüleme yetkiniz bulunmuyor. Bu alan yalnızca diyetisyen hesaplarına açıktır.
          </p>
          <Button variant="primary" onClick={() => router.replace('/auth/login')}>
            Girişe dön
          </Button>
        </Card>
      </div>
    );
  }

  if (error === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-md p-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Doğrulama hatası</h1>
          <p className="mb-6 text-muted-foreground">
            Oturum doğrulanırken bir sorun oluştu. Lütfen tekrar giriş yapın.
          </p>
          <Button variant="primary" onClick={() => router.replace('/auth/login')}>
            Girişe dön
          </Button>
        </Card>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
