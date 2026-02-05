import { NativeModules, Platform } from 'react-native';

let Constants: any = null;
try { Constants = require('expo-constants'); } catch { }

let Device: any = null;
try { Device = require('expo-device'); } catch { }

let API_BASE_URL_SOURCE = 'unknown';

/**
 * Extract hostname from HTTP URL
 */
function hostFromHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.hostname || null;
  } catch {
    return null;
  }
}

/**
 * Extract hostname from debugger host string (e.g., "192.168.1.36:8081")
 */
function hostFromDebuggerHost(raw: string): string | null {
  if (!raw) return null;
  const host = raw.split(':')[0];
  return host || null;
}

/**
 * Extract hostname from linking URI
 * e.g., exp+mobile-app://expo-development-client/?url=http%3A%2F%2F192.168.1.36%3A8081
 */
function hostFromLinkingUri(uri: string): string | null {
  if (!uri) return null;
  const qIndex = uri.indexOf('?');
  if (qIndex < 0) return null;
  const qs = uri.slice(qIndex + 1);
  const params = new URLSearchParams(qs);
  const encoded = params.get('url');
  if (!encoded) return null;
  const decoded = decodeURIComponent(encoded);
  return hostFromHttpUrl(decoded);
}

/**
 * Multi-source Metro host detection
 * Tries 5 different sources in priority order
 */
export function getMetroHostSync(): string | null {
  // Source 1: NativeModules.SourceCode.scriptURL (most reliable)
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  const h1 = scriptURL ? hostFromHttpUrl(scriptURL) : null;
  if (h1) return h1;

  // Source 2: Constants.expoConfig.hostUri
  const hostUri = Constants?.expoConfig?.hostUri;
  const h2 = hostUri ? hostFromDebuggerHost(hostUri) : null;
  if (h2) return h2;

  // Source 3: Constants.manifest.debuggerHost
  const dbg1 = Constants?.manifest?.debuggerHost;
  const h3 = dbg1 ? hostFromDebuggerHost(dbg1) : null;
  if (h3) return h3;

  // Source 4: Constants.manifest2.extra.expoClient.debuggerHost
  const dbg2 = Constants?.manifest2?.extra?.expoClient?.debuggerHost;
  const h4 = dbg2 ? hostFromDebuggerHost(dbg2) : null;
  if (h4) return h4;

  // Source 5: Constants.linkingUri (dev client golden source)
  const linkingUri = Constants?.linkingUri;
  const h5 = linkingUri ? hostFromLinkingUri(linkingUri) : null;
  if (h5) return h5;

  return null;
}

function resolveDevBaseUrl(): { url: string; source: string; metroHost?: string; envUrl?: string } {
  const forceEnv = process.env.EXPO_PUBLIC_API_BASE_URL_FORCE === '1';
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  // FORCE mode: env overrides everything
  if (forceEnv && envUrl) {
    return { url: envUrl, source: 'FORCED env', envUrl };
  }

  // Primary: Use Metro host (auto-detected)
  const metroHost = getMetroHostSync();
  if (metroHost) {
    const url = `http://${metroHost}:5000`;
    return { url, source: 'metroHost (multi-source detection)', metroHost };
  }

  // Metro detection failed - warn but don't crash
  console.warn('⚠️ Metro host detection failed - falling back to env or platform defaults');

  // Fallback to env if available
  if (envUrl) {
    return { url: envUrl, source: 'env (metro detection failed)', envUrl };
  }

  // Last resort: Platform defaults
  if (Platform.OS === 'android') {
    return { url: 'http://10.0.2.2:5000', source: 'android emulator fallback' };
  }
  return { url: 'http://localhost:5000', source: 'ios simulator fallback' };
}

function getApiBaseUrl(): string {
  if (__DEV__) {
    const result = resolveDevBaseUrl();
    API_BASE_URL_SOURCE = result.source;

    const isPhysical = Device?.isDevice ?? Constants?.isDevice ?? false;
    const isLocalhost = result.url.includes('localhost') || result.url.includes('127.0.0.1');

    // Don't throw - just warn and return fallback
    if (isPhysical && isLocalhost) {
      console.error('❌ API Configuration Error: localhost on physical device');
      console.error('Metro host detection failed. Set EXPO_PUBLIC_API_BASE_URL_FORCE=1');
      console.error('and EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:5000');
      // Return non-working but non-crashing URL - LoginScreen will show modal
      return result.url;
    }

    return result.url;
  }

  // Production
  return process.env.EXPO_PUBLIC_API_BASE_URL || Constants?.expoConfig?.extra?.apiBaseUrl || 'https://api.mydietitian.com';
}

export const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  const result = resolveDevBaseUrl();
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  const linkingUri = Constants?.linkingUri;

  console.log('=== API Configuration ===');
  console.log('Resolved API_BASE_URL:', API_BASE_URL);
  console.log('Source:', API_BASE_URL_SOURCE);
  console.log('Platform:', Platform.OS);
  console.log('Device.isDevice:', Device?.isDevice ?? Constants?.isDevice ?? '(unknown)');
  if (result.metroHost) console.log('Metro Host:', result.metroHost);
  if (result.envUrl) console.log('Env URL:', result.envUrl);
  console.log('Env EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL || '(not set)');
  console.log('Env FORCE:', process.env.EXPO_PUBLIC_API_BASE_URL_FORCE || '(not set)');
  console.log('SourceCode.scriptURL:', scriptURL || '(not available)');
  console.log('linkingUri:', linkingUri || '(not available)');
  console.log('========================');
}

export default API_BASE_URL;



