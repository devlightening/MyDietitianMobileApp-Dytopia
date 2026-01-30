import { ConfigContext } from 'expo/config';

/**
 * Expo app configuration
 * Injects environment variables into expo.extra for runtime access
 * 
 * This ensures EXPO_PUBLIC_API_BASE_URL is available via Constants.expoConfig.extra.apiBaseUrl
 * even if process.env behavior differs across Expo versions
 */
export default ({ config }: ConfigContext) => {
  // Read API base URL from environment
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  // Log in build time (will appear when running expo start)
  if (apiBaseUrl) {
    console.log('[app.config.ts] EXPO_PUBLIC_API_BASE_URL found:', apiBaseUrl);
  } else {
    console.warn('[app.config.ts] EXPO_PUBLIC_API_BASE_URL not set - will use fallback or expo.extra');
  }

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      // Inject API base URL into expo.extra for reliable runtime access
      // This is the fallback if process.env.EXPO_PUBLIC_API_BASE_URL is not available at runtime
      apiBaseUrl: apiBaseUrl || undefined,
    },
  };
};
