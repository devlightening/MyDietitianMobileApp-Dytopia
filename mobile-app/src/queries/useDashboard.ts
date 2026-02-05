import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { getDashboardData, type DashboardDTO, type DashboardError } from '../data/dashboardRepo';

/**
 * React Query hook for Dashboard data
 * Features:
 * - Auto-refetch on screen focus
 * - Pull-to-refresh support via refetch()
 * - Error retry logic
 * - Cache management
 */
export function useDashboard() {
  const navigation = useNavigation();

  const query = useQuery<DashboardDTO, DashboardError>({
    queryKey: ['dashboard'],
    queryFn: getDashboardData,
    // Refetch when data is older than 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  // Refetch on navigation focus (when user returns to Dashboard)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Only refetch if data is stale
      if (query.isStale) {
        query.refetch();
      }
    });

    return unsubscribe;
  }, [navigation, query]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
