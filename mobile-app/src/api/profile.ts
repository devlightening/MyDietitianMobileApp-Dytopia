import apiClient from "./client";

export interface MyProfileResponse {
  fullName: string;
  email: string;
  isPremium: boolean;
  activeDietitianId?: string | null;
  premiumUntilUtc?: string | null;
}

export async function getMyProfile(): Promise<MyProfileResponse> {
  const response = await apiClient.get<MyProfileResponse>("/api/client/me");
  return response.data;
}

export async function updateMyProfile(payload: { fullName: string }): Promise<MyProfileResponse> {
  const response = await apiClient.put<MyProfileResponse>("/api/client/me", payload);
  return response.data;
}
