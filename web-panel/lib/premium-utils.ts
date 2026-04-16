/**
 * Premium/Freemium UX utilities
 * Handles graceful degradation for free users
 */

export interface PremiumError {
  status: 403;
  code: 'PREMIUM_REQUIRED';
  message: string;
}

/**
 * Check if an API error is a premium requirement error
 */
export function isPremiumRequired(error: any): error is PremiumError {
  return error?.status === 403 && error?.code === 'PREMIUM_REQUIRED';
}

/**
 * Check if an API error is an authentication error
 */
export function isAuthError(error: any): boolean {
  return error?.status === 401 || error?.status === 403;
}

/**
 * Get user-friendly message for premium errors
 */
export function getPremiumErrorMessage(error: any): string {
  if (isPremiumRequired(error)) {
    return error.message || 'Bu özellik premium üyelik gerektirir';
  }
  return 'Bir hata oluştu';
}

/**
 * Safe wrapper for API calls that might return null for free users
 * Example: branding, dietitian info
 */
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    const result = await apiCall();
    // If result is null or undefined, return fallback
    return result ?? fallback;
  } catch (error) {
    // If it's a premium error, return fallback instead of throwing
    if (isPremiumRequired(error)) {
      return fallback;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Default branding for free users
 */
export const DEFAULT_BRANDING = {
  clinicName: 'MyDietitian',
  logoUrl: null,
  primaryColorHex: '#111111',
  accentColorHex: '#22C55E',
};

/**
 * Null dietitian info for free users
 */
export const NULL_DIETITIAN = null;
