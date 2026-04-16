import { useQuery } from "@tanstack/react-query";
import { getGamificationSummary, type GamificationSummaryDTO } from "../api/gamification";

export function useGamification() {
  const query = useQuery<GamificationSummaryDTO>({
    queryKey: ["gamification"],
    queryFn: getGamificationSummary,
    staleTime: 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}
