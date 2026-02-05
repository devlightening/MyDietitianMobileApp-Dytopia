import { QueryClient } from '@tanstack/react-query';

/**
 * Centralized React Query client
 * AG-DASH-FIX-11: Smart retry logic to prevent spam on 404/401/403
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      // AG-DASH-FIX-17: Disable focus refetch in dev to prevent spam
      refetchOnWindowFocus: !__DEV__,
      refetchOnReconnect: true,
      refetchOnMount: false,

      // Smart retry logic: don't spam on 404/401/403
      retry: (failureCount, error: any) => {
        // Extract status from error
        const status = error?.status ?? error?.response?.status;

        // Don't retry on client errors (401, 403, 404)
        if (status === 401 || status === 403 || status === 404) {
          return false;
        }

        // Network errors: retry 2 times
        if (error?.type === 'NetworkError' || error?.code === 'ERR_NETWORK') {
          return failureCount < 2;
        }

        // Server errors (500+): retry once
        if (status && status >= 500) {
          return failureCount < 1;
        }

        // Other errors: don't retry
        return false;
      },
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});
