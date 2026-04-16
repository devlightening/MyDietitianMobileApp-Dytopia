import api from '../api';

export interface MotivationPulse {
  clientId: string;
  clientName: string;
  currentStreak: number;
  bestStreak: number;
  streakAtRisk: boolean;
  earnedBadgeCount: number;
  primaryTrack: string;
  recentBadgeIds: string[];
  lastUnlockAtUtc?: string | null;
}

export interface DietitianGamificationSummary {
  clientsAtRiskCount: number;
  newUnlocksCount: number;
  activeStreaksCount: number;
  clients: MotivationPulse[];
}

export interface ClientGamificationSummary {
  primaryTrack: string;
  currentStreak: number;
  bestStreak: number;
  earnedBadgeCount: number;
  totalBadgeCount: number;
  nextMilestoneDays: number;
  streakAtRisk: boolean;
  atRiskReason?: string | null;
  recentUnlocks: string[];
}

export async function getDietitianGamificationSummary(limit: number = 8): Promise<DietitianGamificationSummary> {
  const res = await api.get('/api/dietitian/gamification/summary', { params: { limit } });
  return res.data;
}

export async function getClientGamificationSummary(clientId: string): Promise<ClientGamificationSummary> {
  const res = await api.get(`/api/dietitian/gamification/clients/${clientId}`);
  return res.data;
}
