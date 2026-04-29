import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

// Non-blocking startup connectivity probe (dev only).
// Probes GET /health on the configured API_BASE_URL so the developer sees
// connectivity status before the first real API call is attempted.
// Does NOT mutate any state â€” observe only.
if (__DEV__) {
  void (async () => {
    const { checkBackendHealth } = await import('./health');
    const result = await checkBackendHealth();

    if (result.reachable) {
      console.log(`âœ… Backend reachable in ${result.latencyMs}ms â†’ ${result.environment ?? '?'} | ${result.url}`);
    } else {
      const isForced = process.env.EXPO_PUBLIC_API_BASE_URL_FORCE === '1';
      console.error(`âŒ Backend NOT reachable at: ${result.url}`);
      console.error(`   Error: ${result.error}`);
      console.error('');
      console.error('   â”€â”€ Checklist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
      console.error('   Option A - Cloudflare Tunnel (physical device / any network):');
      console.error('     1. dotnet run --launch-profile http');
      console.error('     2. cloudflared tunnel --url http://localhost:5000');
      console.error('     3. Copy HTTPS URL â†’ set EXPO_PUBLIC_API_BASE_URL in .env');
      console.error('        EXPO_PUBLIC_API_BASE_URL_FORCE=1');
      console.error('');
      console.error('   Option B - Android emulator (adb reverse):');
      console.error('     1. dotnet run --launch-profile http');
      console.error('     2. adb reverse tcp:5000 tcp:5000');
      console.error('     3. EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:5000');
      console.error('        EXPO_PUBLIC_API_BASE_URL_FORCE=1');
      if (!isForced) {
        console.warn('   âš ï¸  FORCE=1 is not set â€” URL may have been auto-detected incorrectly.');
      }
      console.error('   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
    }
  })();
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 10000), // Configurable timeout, default 10s
});

// Request interceptor: Add auth token and debug logging
apiClient.interceptors.request.use(async (config: any) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Debug logging for dashboard requests (dev only)
  if (__DEV__ && config.url?.includes('/api/client/dashboard')) {
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log('=== Dashboard Request ===');
    console.log('Method:', config.method?.toUpperCase());
    console.log('Full URL:', fullUrl);
    console.log('Has Auth Header:', !!config.headers.Authorization);
    console.log('Token Present:', !!config.headers.Authorization ? 'YES' : 'NO');
    console.log('========================');
  }

  // Debug logging for plan requests (dev only)
  if (__DEV__ && config.url?.includes('/diet-plans/today')) {
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log('=== Plan Request ===');
    console.log('Method:', config.method?.toUpperCase());
    console.log('Full URL:', fullUrl);
    console.log('Base URL:', config.baseURL);
    console.log('Path:', config.url);
    console.log('Has Auth Header:', !!config.headers.Authorization);
    console.log('===================');
  }

  // Debug logging for login calls (dev only)
  if (__DEV__ && config.url?.includes('/auth/client/login')) {
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log('=== Login Request ===');
    console.log('Full URL:', fullUrl);
    console.log('Base URL:', config.baseURL);
    console.log('Path:', config.url);
    console.log('===================');
  }

  return config;
});

// Response interceptor: Handle 401 and detailed error logging
apiClient.interceptors.response.use(
  (response: any) => response,
  async (error: any) => {
    // Detailed logging for dashboard errors (dev only)
    if (__DEV__ && error.config?.url?.includes('/api/client/dashboard')) {
      console.log('=== Dashboard Error ===');
      console.log('HTTP Status:', error.response?.status ?? 'N/A');
      console.log('Response Data:', error.response?.data ?? 'N/A');
      console.log('Error Code:', error.code ?? 'N/A');
      console.log('Error Message:', error.message ?? 'N/A');
      console.log('=======================');
    }

    // Detailed logging for plan request errors (dev only)
    if (__DEV__ && error.config?.url?.includes('/diet-plans/today')) {
      console.log('=== Plan Request Error ===');
      console.log('HTTP Status:', error.response?.status || 'N/A');
      console.log('Response Data:', error.response?.data || 'N/A');
      console.log('Error Type:', error.code === 'ECONNABORTED' ? 'timeout' :
        error.code === 'ERR_NETWORK' ? 'network' :
          error.response ? 'http' : 'unknown');
      console.log('Error Message:', error.message || 'N/A');
      console.log('Full Error:', error);
      console.log('========================');
    }

    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('access_token');
    }
    return Promise.reject(error);
  }
);

/**
 * Changes the API base URL at runtime.
 * Exported for tooling / manual override in dev console only.
 * NEVER call this automatically â€” if FORCE=1 is set, the env URL is authoritative.
 */
export function setApiBaseUrl(newUrl: string) {
  apiClient.defaults.baseURL = newUrl;
  if (__DEV__) {
    console.log('ğŸ”§ API baseURL changed to:', newUrl);
  }
}

export { apiClient };
export default apiClient;

