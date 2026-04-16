import apiClient from "../api/client";

export interface GamificationSummaryDTO {
  primaryTrack: "plan_adherence" | "daily_rhythm" | string;
  currentStreak: number;
  bestStreak: number;
  earnedBadgeCount: number;
  totalBadgeCount: number;
  nextMilestoneDays: number;
  streakAtRisk: boolean;
  atRiskReason?: string | null;
  today: {
    primaryScore: number;
    adherenceScore: number;
    engagementScore: number;
    qualifiedForStreak: boolean;
    perfectDay: boolean;
    plannedMeals: number;
    doneMeals: number;
    alternativeMeals: number;
    skippedMeals: number;
    waterGlasses: number;
    waterGoalHit: boolean;
    kitchenEvents: number;
    measurementLogged: boolean;
    careMessageSent: boolean;
  };
  achievements: Array<{
    id: string;
    progressCurrent: number;
    progressTarget: number;
    unlocked: boolean;
    unlockedAtUtc?: string | null;
  }>;
  recentUnlocks: string[];
}

export async function getGamificationSummary(): Promise<GamificationSummaryDTO> {
  const response = await apiClient.get<GamificationSummaryDTO>("/api/client/gamification/summary");
  return response.data;
}

export async function pingGamification(): Promise<void> {
  await apiClient.post("/api/client/gamification/ping");
}
