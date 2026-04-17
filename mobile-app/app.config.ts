import { ConfigContext, ExpoConfig } from 'expo/config';
import { withAndroidManifest } from '@expo/config-plugins';

/**
 * Expo app configuration
 * Injects environment variables into expo.extra for runtime access.
 *
 * Priority at runtime (src/config/api.ts):
 *   1. process.env.EXPO_PUBLIC_API_BASE_URL  (set in .env for dev, eas.json for builds)
 *   2. Constants.expoConfig.extra.apiBaseUrl  (this file injects it here as fallback)
 *   3. Auto-detect (Android emulator → 10.0.2.2, iOS → 127.0.0.1)
 *   4. https://api.mydietitian.com            (production hardcoded fallback)
 *
 * For APK device test builds: edit EXPO_PUBLIC_API_BASE_URL in eas.json preview.env
 */
export default ({ config }: ConfigContext) => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const isForced   = process.env.EXPO_PUBLIC_API_BASE_URL_FORCE === '1';

  if (apiBaseUrl) {
    console.log(`[app.config.ts] API base URL: ${apiBaseUrl}${isForced ? ' (FORCED)' : ''}`);
  } else {
    console.warn('[app.config.ts] EXPO_PUBLIC_API_BASE_URL not set — auto-detect or fallback will apply at runtime');
  }

  const base = {
    ...config,
    name: config.name ?? "MyDietitian",
    slug: config.slug ?? "mydietitian-mobile",
    extra: {
      ...(config.extra || {}),
      apiBaseUrl: apiBaseUrl ?? undefined,

      // ✅ EKLENEN KISIM (EAS için gerekli)
      eas: {
        projectId: "b5768f53-107b-41a4-a8e5-741f7e94c51a"
      }
    },
  } satisfies ExpoConfig;

  // Ensure android:usesCleartextTraffic="true" for HTTP API access
  return withAndroidManifest(base, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:usesCleartextTraffic'] = 'true';
    }
    return cfg;
  });
};
