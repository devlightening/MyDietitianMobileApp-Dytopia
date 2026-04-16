import { Platform } from 'react-native';

let Constants: any = null;
try { Constants = require('expo-constants'); } catch { }

let Device: any = null;
try { Device = require('expo-device'); } catch { }

// Populated during resolution; exported only for diagnostic reads (never mutate externally).
export let API_BASE_URL_SOURCE = 'unknown';

// ─────────────────────────────────────────────────────────────────────────────
// URL STRATEGY
//
// Priority order:
//   1. EXPO_PUBLIC_API_BASE_URL_FORCE=1 + EXPO_PUBLIC_API_BASE_URL → use as-is
//   2. EXPO_PUBLIC_API_BASE_URL (no force) → use as-is
//   3. Auto-detect (dev only):
//      • Android emulator  → http://10.0.2.2:5000
//        (10.0.2.2 is Android's special alias for the host machine loopback.)
//      • iOS simulator     → http://127.0.0.1:5000
//      • Physical device   → warns; must set FORCE + URL in .env or eas.json
//
// Supported URL forms:
//   • http://10.0.2.2:5000            — Android emulator / adb reverse
//   • http://192.168.x.x:5000         — LAN (same Wi-Fi)
//   • https://xxx.trycloudflare.com   — Cloudflare Tunnel (no port needed)
//   • https://api.mydietitian.com     — production
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates and normalises a URL.
 * - HTTPS URLs without an explicit port are left untouched (port 443 is implicit).
 * - HTTP URLs without an explicit port are auto-corrected to :5000 so the app
 *   never silently connects to :80 during local development.
 */
function validateAndNormalizeUrl(rawUrl: string, source: string): string {
  let url = rawUrl.replace(/\/+$/, '');

  try {
    const u = new URL(url);

    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      console.error(`❌ [API Config] Unexpected protocol in URL from "${source}": ${url}`);
    }

    // HTTPS without an explicit port is valid (implicit 443). Only auto-correct HTTP.
    if (!u.port && u.protocol === 'http:') {
      console.error(`❌ [API Config] HTTP URL from "${source}" has no explicit port: ${url}`);
      console.error(`   HTTP defaults to :80 — almost certainly wrong for local dev.`);
      url = `http://${u.hostname}:5000`;
      console.warn(`⚠️  [API Config] Auto-corrected URL → ${url} (added :5000)`);
    }

    return url;
  } catch {
    console.error(`❌ [API Config] Invalid URL from "${source}": ${rawUrl}`);
    return url;
  }
}

function resolveDevBaseUrl(): string {
  const isForced = process.env.EXPO_PUBLIC_API_BASE_URL_FORCE === '1';
  const envUrl   = process.env.EXPO_PUBLIC_API_BASE_URL;

  // ── FORCE mode ────────────────────────────────────────────────────────────
  // Use the env URL exactly as configured.  No auto-detection, no runtime
  // override.  This is the authoritative path for adb reverse dev workflow.
  if (isForced && envUrl) {
    API_BASE_URL_SOURCE = 'FORCED env (EXPO_PUBLIC_API_BASE_URL)';
    return validateAndNormalizeUrl(envUrl, 'EXPO_PUBLIC_API_BASE_URL (FORCED)');
  }

  // ── Non-force: env URL if provided ────────────────────────────────────────
  if (envUrl) {
    API_BASE_URL_SOURCE = 'env (EXPO_PUBLIC_API_BASE_URL)';
    return validateAndNormalizeUrl(envUrl, 'EXPO_PUBLIC_API_BASE_URL');
  }

  // ── Auto-detect by platform ───────────────────────────────────────────────
  // Physical device check: if running on a real device, localhost will not work.
  const isPhysicalDevice = Device?.isDevice ?? false;

  if (Platform.OS === 'android' && !isPhysicalDevice) {
    // Android emulator: 10.0.2.2 routes to the host machine's 127.0.0.1.
    // No adb reverse needed — works immediately after `expo run:android`.
    API_BASE_URL_SOURCE = 'auto (Android emulator → 10.0.2.2)';
    return 'http://10.0.2.2:5000';
  }

  // iOS simulator shares the host network — localhost works directly.
  API_BASE_URL_SOURCE = 'auto (iOS simulator / default)';
  return 'http://127.0.0.1:5000';
}

function getApiBaseUrl(): string {
  if (__DEV__) {
    return resolveDevBaseUrl();
  }

  // Production
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    Constants?.expoConfig?.extra?.apiBaseUrl ||
    'https://api.mydietitian.com'
  );
}

export const API_BASE_URL = getApiBaseUrl();

// ── Startup log ──────────────────────────────────────────────────────────────
if (__DEV__) {
  const isForced  = process.env.EXPO_PUBLIC_API_BASE_URL_FORCE === '1';
  const rawEnvUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  console.log('=== API Configuration ===');
  console.log('Resolved URL  :', API_BASE_URL);
  console.log('Source        :', API_BASE_URL_SOURCE);
  console.log('Platform      :', Platform.OS);
  console.log('FORCE=1       :', isForced);
  console.log('Raw env URL   :', rawEnvUrl ?? '(not set — using auto-detect)');
  console.log('=========================');

  // Warn about missing port only for HTTP URLs — HTTPS tunnel URLs have no port by design.
  if (rawEnvUrl && rawEnvUrl.startsWith('http://') && !rawEnvUrl.match(/:\d+\/?$/)) {
    console.error('❌ EXPO_PUBLIC_API_BASE_URL is HTTP but has no port — stale bundle? Run: npx expo start --clear');
  }
}

export default API_BASE_URL;
