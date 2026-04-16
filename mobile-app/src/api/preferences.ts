import apiClient from "./client";

export interface ClientGoalPreferences {
  primaryGoal: string;
  dietStyle: string;
  cookingTimePreference: string;
  reminderTone: string;
  updatedAtUtc?: string;
}

export async function getClientPreferences(): Promise<ClientGoalPreferences> {
  const res = await apiClient.get<ClientGoalPreferences>("/api/client/preferences");
  return res.data;
}

export async function updateClientPreferences(
  preferences: ClientGoalPreferences,
): Promise<ClientGoalPreferences> {
  const res = await apiClient.put<ClientGoalPreferences>("/api/client/preferences", preferences);
  return res.data;
}
