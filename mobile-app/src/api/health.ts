import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface HealthCheckResult {
  reachable: boolean;
  status?: string;
  environment?: string;
  latencyMs: number;
  url: string;
  error?: string;
}

/**
 * Probes GET /health on the backend and returns a structured result.
 *
 * Uses a standalone axios call (not the shared apiClient) so it carries no
 * auth interceptors and has its own timeout — safe to call before any token
 * is loaded.
 *
 * Backend endpoint is mapped in Program.cs as GET /health.
 */
export async function checkBackendHealth(timeoutMs = 5000): Promise<HealthCheckResult> {
  const url = `${API_BASE_URL}/health`;
  const start = Date.now();

  try {
    const response = await axios.get(url, {
      timeout: timeoutMs,
      headers: { Accept: 'application/json' },
      validateStatus: (s) => s < 500,
    });
    const latencyMs = Date.now() - start;

    if (response.status === 200) {
      return {
        reachable: true,
        status: response.data?.status,
        environment: response.data?.environment,
        latencyMs,
        url,
      };
    }

    return {
      reachable: false,
      latencyMs,
      url,
      error: `Unexpected HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      reachable: false,
      latencyMs: Date.now() - start,
      url,
      error: err.message ?? 'Unknown error',
    };
  }
}
