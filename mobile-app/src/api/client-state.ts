import apiClient from './client';

export type SubscriptionTier = 'free' | 'premium';

export interface ClientCapabilities {
  manualPantry: boolean;
  manualKitchen: boolean;
  publicRecipes: boolean;
  recipeDetail: boolean;
  cookingMode: boolean;
  publicRecipeShoppingList: boolean;
  plans: boolean;
  messages: boolean;
  favorites: boolean;
  clinicRecipes: boolean;
  aiScans: boolean;
  appointments: boolean;
  careNotes: boolean;
  todayPlanShoppingList: boolean;
}

export interface ClientStateResponse {
  userId: string;
  clientId?: string;
  publicUserId: string;
  isPremium: boolean;
  subscriptionTier?: SubscriptionTier;
  capabilities?: ClientCapabilities;
  premiumUntilUtc: string | null;
  activeDietitianId: string | null;
  fullName: string;
  email: string;
}

export async function getClientState(): Promise<ClientStateResponse> {
  const response = await apiClient.get<ClientStateResponse>('/api/client/me');
  return response.data;
}
