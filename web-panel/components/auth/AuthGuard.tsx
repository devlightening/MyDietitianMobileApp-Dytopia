'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/Skeleton';
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
    // Prevent double-check in React StrictMode
    if (hasChecked.current) {
      return;
    }

    // SAFEGUARD: If already on auth page, don't check
    if (pathname.startsWith('/auth')) {
      console.log('[AuthGuard] Already on auth page, skipping check');
      setIsChecking(false);
      return;
    }

    async function checkAuth() {
      try {
        hasChecked.current = true;

        // Middleware already validated token, this is just for role checking
        // If we reach here, user is authenticated (middleware allowed access)
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (!response.ok) {
          // Middleware should have caught this, but just in case
          console.log('[AuthGuard] Unexpected auth failure, middleware should have redirected');
          setError('error');
          setIsChecking(false);
          return;
        }

        const data = await response.json();

        // Check role if required
        if (requiredRole && data.role !== requiredRole) {
          console.log('[AuthGuard] Forbidden - wrong role');
          setError('forbidden');
          setIsAuthorized(false);
          setIsChecking(false);
          return;
        }

        console.log('[AuthGuard] Authorized');
        setIsAuthorized(true);
        setIsChecking(false);
      } catch (err) {
        console.error('[AuthGuard] Auth check failed:', err);
        setError('error');
        setIsChecking(false);
      }
    }

    checkAuth();
  }, [pathname, router, requiredRole]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page. This area is restricted to dietitians only.
          </p>
          <Button variant="primary" onClick={() => router.replace('/auth/login')}>
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  if (error === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Authentication Error</h1>
          <p className="text-muted-foreground mb-6">
            There was a problem verifying your authentication. Please try logging in again.
          </p>
          <Button variant="primary" onClick={() => router.replace('/auth/login')}>
            Go to Login
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
