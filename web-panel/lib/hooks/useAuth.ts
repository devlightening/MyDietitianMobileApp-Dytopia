import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClients } from '@/lib/api/clients';

export function useAuth() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Session check with lightweight endpoint
    getClients()
      .then(() => setIsAuthenticated(true))
      .catch((error) => {
        // Only redirect if it's an auth error (401/403)
        if (error.status === 401 || error.status === 403) {
          router.push('/auth/login');
        }
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  const logout = () => {
    // Clear local state (HttpOnly cookie will expire naturally)
    setIsAuthenticated(false);
    router.push('/auth/login');
  };

  return { isAuthenticated, isLoading, logout };
}
