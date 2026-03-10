import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  createDietPlan,
  getDietPlanByClient,
} from '@/lib/api/diet-plans';
import type { CreateDietPlanRequest, DietPlan } from '@/lib/types/diet-plan';

// Minimal local type — ClientWithPlanStatus was never exported from diet-plans.ts
interface ClientWithPlanStatus {
  clientId: string;
  fullName: string;
  hasActivePlan: boolean;
}


/**
 * Hook to create a new diet plan
 */
export function useCreateDietPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<CreateDietPlanRequest, 'dietitianId'>) => createDietPlan(data),
    onSuccess: (result, variables) => {
      if (result.success) {
        toast.success('Diet plan created successfully!');
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['diet-plan', variables.clientId] });
        queryClient.invalidateQueries({ queryKey: ['diet-plans'] });
      } else {
        toast.error(result.errorMessage || 'Failed to create diet plan');
      }
    },
    onError: (error: any) => {
      console.error('Error creating diet plan:', error);
      toast.error(error.response?.data?.message || 'Failed to create diet plan');
    },
  });
}

/**
 * Hook to fetch a diet plan for a specific client
 */
export function useDietPlan(clientId: string | undefined) {
  return useQuery({
    queryKey: ['diet-plan', clientId],
    queryFn: () => {
      if (!clientId) throw new Error('Client ID is required');
      return getDietPlanByClient(clientId);
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch all clients (we'll enhance this to include plan status)
 * For now, this is a placeholder that would need backend support
 */
export function useClientsWithPlans() {
  return useQuery<ClientWithPlanStatus[]>({
    queryKey: ['diet-plans'],
    queryFn: async () => {
      // This is a simplified version
      // In production, we'd want a dedicated endpoint that returns clients with plan status
      // For now, return empty array - will be implemented when we have the clients data
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
