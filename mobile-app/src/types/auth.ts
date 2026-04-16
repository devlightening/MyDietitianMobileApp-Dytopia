export enum Gender {
  Male = 0,
  Female = 1,
  Other = 2,
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  gender: Gender;
  birthDate: string; // YYYY-MM-DD format
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  expiresAtUtc: string;
  role: string;
  userId: string;
  clientId?: string;
  publicUserId: string;
  isPremium: boolean;
}

export interface ActivatePremiumRequest {
  accessKey: string;
}

export interface ActivatePremiumResponse {
  message: string;
  dietitianId: string;
  dietitianName: string;
  programStartDate?: string;
  programEndDate?: string;
}

export interface UserProfile {
  fullName?: string;
  email?: string;
  publicUserId: string;
  clientId: string;
  isPremium: boolean;
  gender: Gender;
  birthDate: string;
  age: number;
  activeDietitianId?: string;
}
