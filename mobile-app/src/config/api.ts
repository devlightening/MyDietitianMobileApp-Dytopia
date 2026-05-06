import { Platform } from 'react-native';

let Constants: any = null;
try { Constants = require('expo-constants'); } catch { }

let Device: any = null;
try { Device = require('expo-device'); } catch { }

const LOCAL_API_PORT = '5000';
const PRODUCTION_API_BASE_URL = 'https://api.mydietitian.com';

// Populated during resolution; exported only for diagnostic reads.
export let API_BASE_URL_SOURCE = 'unknown';

// URL strategy:
// 1. EXPO_PUBLIC_API_BASE_URL_FORCE=1 + EXPO_PUBLIC_API_BASE_URL
// 2. EXPO_PUBLIC_API_BASE_URL
// 3. expo.extra.apiBaseUrl (injected by app.config.ts)
// 4. Dev auto-detect for emulators/simulators only
// 5. Production fallback
//
// Physical devices must use a device-reachable URL:
// - http://PC_HOTSPOT_OR_LAN_IPV4:5000
// - https://YOUR_TUNNEL.trycloudflare.com
// - https://api.mydietitian.com

function getExpoExtraApiBaseUrl(): string | undefined {
  const value =
    Constants?.expoConfig?.extra?.apiBaseUrl ??
    Constants?.manifest?.extra?.apiBaseUrl;

  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function validateAndNormalizeUrl(rawUrl: string, source: string): string {
  let url = rawUrl.trim().replace(/\/+$/, '');

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.error(`[API Config] Unexpected protocol from ${source}: ${url}`);
    }

    // HTTPS tunnel/production URLs usually omit the port. For local HTTP, missing
    // port almost always means the backend port was forgotten.
    if (parsed.protocol === 'http:' && !parsed.port) {
      parsed.port = LOCAL_API_PORT;
      url = parsed.toString().replace(/\/+$/, '');
      console.warn(`[API Config] Added :${LOCAL_API_PORT} to HTTP API URL from ${source}: ${url}`);
    }

    return url;
  } catch {
    console.error(`[API Config] Invalid URL from ${source}: ${rawUrl}`);
    return url;
  }
}

export function isLoopbackApiBaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

export function isPhysicalDeviceUnsafeApiBaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return isLoopbackApiBaseUrl(url) || host === '10.0.2.2';
  } catch {
    return true;
  }
}

function resolveConfiguredUrl(rawUrl: string | undefined, source: string): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  API_BASE_URL_SOURCE = source;
  return validateAndNormalizeUrl(rawUrl, source);
}

function resolveDevBaseUrl(): string {
  const isForced = process.env.EXPO_PUBLIC_API_BASE_URL_FORCE === '1';
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (isForced && envUrl) {
    return resolveConfiguredUrl(envUrl, 'FORCED env (EXPO_PUBLIC_API_BASE_URL)')!;
  }

  const configuredUrl =
    resolveConfiguredUrl(envUrl, 'env (EXPO_PUBLIC_API_BASE_URL)') ??
    resolveConfiguredUrl(getExpoExtraApiBaseUrl(), 'expo.extra.apiBaseUrl');

  if (configuredUrl) {
    return configuredUrl;
  }

  const isPhysicalDevice = Device?.isDevice === true;

  if (isPhysicalDevice) {
    API_BASE_URL_SOURCE = 'missing physical-device dev URL';
    console.error('[API Config] Physical device detected, but EXPO_PUBLIC_API_BASE_URL is not set.');
    console.error('[API Config] Set it to http://YOUR_PC_IPV4:5000 or a Cloudflare Tunnel URL, then restart Metro with --clear.');
    return PRODUCTION_API_BASE_URL;
  }

  if (Platform.OS === 'android') {
    API_BASE_URL_SOURCE = 'auto (Android emulator -> 10.0.2.2)';
    return `http://10.0.2.2:${LOCAL_API_PORT}`;
  }

  API_BASE_URL_SOURCE = 'auto (iOS simulator / local dev)';
  return `http://127.0.0.1:${LOCAL_API_PORT}`;
}

function getApiBaseUrl(): string {
  if (__DEV__) {
    return resolveDevBaseUrl();
  }

  const productionUrl =
    resolveConfiguredUrl(process.env.EXPO_PUBLIC_API_BASE_URL, 'env (production)') ??
    resolveConfiguredUrl(getExpoExtraApiBaseUrl(), 'expo.extra.apiBaseUrl') ??
    PRODUCTION_API_BASE_URL;

  if (API_BASE_URL_SOURCE === 'unknown') {
    API_BASE_URL_SOURCE = 'hardcoded production fallback';
  }

  return validateAndNormalizeUrl(productionUrl, API_BASE_URL_SOURCE);
}

export const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  const isForced = process.env.EXPO_PUBLIC_API_BASE_URL_FORCE === '1';
  const rawEnvUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const isPhysicalDevice = Device?.isDevice === true;

  console.log('=== API Configuration ===');
  console.log('Resolved URL  :', API_BASE_URL);
  console.log('Source        :', API_BASE_URL_SOURCE);
  console.log('Platform      :', Platform.OS);
  console.log('Physical      :', isPhysicalDevice);
  console.log('FORCE=1       :', isForced);
  console.log('Raw env URL   :', rawEnvUrl ?? '(not set; using fallback)');
  console.log('=========================');

  if (isPhysicalDevice && isPhysicalDeviceUnsafeApiBaseUrl(API_BASE_URL)) {
    console.error('[API Config] Physical device cannot reach localhost, 127.0.0.1, or 10.0.2.2 on the laptop.');
    console.error('[API Config] Use your current PC IPv4 or a Cloudflare Tunnel URL in mobile-app/.env.');
  }
}

export default API_BASE_URL;
