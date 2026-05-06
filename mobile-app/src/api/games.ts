import apiClient from "./client";

export type DailyGameType = "memory" | "quiz" | "word";
export type DailyGameStatus = "available" | "completed";

export interface DailyGamePack {
  date: string;
  completedCount: number;
  totalCount: number;
  badgeProgress: number;
  challenges: DailyGameChallenge[];
}

export interface DailyGameChallenge {
  id: string;
  type: DailyGameType;
  title: string;
  subtitle: string;
  difficulty: "easy" | string;
  estimatedSeconds: number;
  payload: any;
  status: DailyGameStatus | string;
  lastScore?: number | null;
  maxScore?: number | null;
}

export interface SubmitGameRequest {
  answers: any;
  moves?: number;
  durationSeconds?: number;
}

export interface SubmitGameResponse {
  score: number;
  maxScore: number;
  perfect: boolean;
  completedDailyCount: number;
  earnedBadgeIds: string[];
  explanation: string;
  review?: any;
}

export async function getDailyGames(language = "tr"): Promise<DailyGamePack> {
  const response = await apiClient.get<DailyGamePack>("/api/client/games/daily", {
    params: { language },
  });
  return response.data;
}

export async function submitDailyGame(
  challengeId: string,
  request: SubmitGameRequest,
): Promise<SubmitGameResponse> {
  const response = await apiClient.post<SubmitGameResponse>(
    `/api/client/games/${challengeId}/submit`,
    {
      answers: request.answers,
      moves: request.moves ?? 0,
      durationSeconds: request.durationSeconds ?? 0,
    },
  );
  return response.data;
}
