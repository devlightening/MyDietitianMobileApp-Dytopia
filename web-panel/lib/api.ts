import axios, { AxiosError, AxiosResponse } from 'axios';

// Use same-origin API calls via Next.js rewrites
// Next.js rewrites /api/* to backend, making requests same-origin
// This eliminates cookie policy issues (SameSite/Secure) in development
const api = axios.create({
  baseURL: '', // Empty baseURL = same-origin (Next.js rewrites handle routing)
  withCredentials: true,
});

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

// Request interceptor - Cookie-only auth (no header injection)
// JWT token is sent via HttpOnly cookie automatically with withCredentials: true
api.interceptors.request.use(config => {
  // No Authorization header needed - backend reads from cookie
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<any>) => {
    const status = error.response?.status;

    // Extract error information from backend response
    const apiError: ApiError = {
      status: status ?? 500,
      code: error.response?.data?.code ?? 'UNKNOWN_ERROR',
      message: error.response?.data?.message ?? error.message ?? 'An unexpected error occurred',
    };

    // Handle authentication/authorization errors
    if (status === 401 || status === 403) {
      // Only redirect if we're not already on auth pages
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth/login';
      }
    }

    return Promise.reject(apiError);
  }
);

export default api;
