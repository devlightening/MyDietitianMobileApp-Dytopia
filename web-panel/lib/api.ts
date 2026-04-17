import axios, { AxiosError, AxiosResponse } from 'axios';
import { toast } from '@/components/ui/Toast';

// Endpoints where a 404 means "no data yet" — not an error the user should see
const SILENT_NOT_FOUND_PATTERNS: RegExp[] = [
  /\/api\/dietitian\/clients\/[^/]+\/active-plan/,
  /\/api\/dietitian\/clients\/[^/]+\/activities/,
  /\/api\/dietitian\/clients\/[^/]+\/measurements/,
  /\/api\/dietitian\/clients\/[^/]+\/notes/,
];

// Background-refresh endpoints — errors are handled by per-widget UI fallbacks,
// not global toasts. Spamming a toast every 15-20 s would be disruptive.
const SILENT_BACKGROUND_PATTERNS: RegExp[] = [
  /\/api\/dietitian\/dashboard\/stats/,
  /\/api\/dietitian\/dashboard\/activity/,
  /\/api\/dietitian\/gamification/,
  /\/api\/care-hub/,
  /\/api\/dietitian\/appointments/,
];

// Deduplication: suppress identical toast messages within this window (ms).
const TOAST_DEDUPE_MS = 12_000;
const _recentToasts = new Map<string, number>();

function shouldShowToast(message: string): boolean {
  const now = Date.now();
  const last = _recentToasts.get(message) ?? 0;
  if (now - last < TOAST_DEDUPE_MS) return false;
  _recentToasts.set(message, now);
  return true;
}

// Use same-origin API calls via Next.js rewrites
// Next.js rewrites /api/* to backend, making requests same-origin
// This eliminates cookie policy issues (SameSite/Secure) in development
const api = axios.create({
  baseURL: '', // Empty baseURL = same-origin (Next.js rewrites handle routing)
  withCredentials: true,
});

export enum ApiErrorType {
  NETWORK = 'NETWORK',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  type: ApiErrorType;
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

    // Determine error type
    let errorType: ApiErrorType = ApiErrorType.UNKNOWN;
    if (!error.response) {
      errorType = ApiErrorType.NETWORK;
    } else if (status === 401) {
      errorType = ApiErrorType.UNAUTHORIZED;
    } else if (status === 403) {
      errorType = ApiErrorType.FORBIDDEN;
    } else if (status === 404) {
      errorType = ApiErrorType.NOT_FOUND;
    } else if (status === 400 || status === 422) {
      errorType = ApiErrorType.VALIDATION;
    } else if (status && status >= 500) {
      errorType = ApiErrorType.SERVER;
    }

    // Extract error information from backend response
    const apiError: ApiError = {
      status: status ?? 500,
      code: error.response?.data?.code ?? 'UNKNOWN_ERROR',
      message: error.response?.data?.message ?? error.message ?? 'An unexpected error occurred',
      type: errorType,
    };

    // Show toast notification for errors (except 401 which triggers redirect).
    // Suppress:
    //  - expected 404 empty-states (SILENT_NOT_FOUND_PATTERNS)
    //  - background auto-refresh endpoints that have per-widget fallback UI
    // Deduplicate identical messages within TOAST_DEDUPE_MS to prevent spam.
    if (errorType !== ApiErrorType.UNAUTHORIZED) {
      const reqUrl = error.config?.url ?? '';
      const isSilentNotFound =
        errorType === ApiErrorType.NOT_FOUND && SILENT_NOT_FOUND_PATTERNS.some(p => p.test(reqUrl));
      const isSilentBackground = SILENT_BACKGROUND_PATTERNS.some(p => p.test(reqUrl));
      if (!isSilentNotFound && !isSilentBackground) {
        const friendlyMessage = getFriendlyErrorMessage(apiError);
        if (shouldShowToast(friendlyMessage)) {
          toast.error(friendlyMessage);
        }
      }
    }

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

function getFriendlyErrorMessage(error: ApiError): string {
  switch (error.type) {
    case ApiErrorType.NETWORK:
      return 'Ağ bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edip tekrar deneyin.';
    case ApiErrorType.UNAUTHORIZED:
      return 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.';
    case ApiErrorType.FORBIDDEN:
      return 'Bu işlemi gerçekleştirmek için yetkiniz bulunmuyor.';
    case ApiErrorType.NOT_FOUND:
      return 'İstenen kayıt bulunamadı.';
    case ApiErrorType.VALIDATION:
      return error.message || 'Lütfen girdiğiniz bilgileri kontrol edip tekrar deneyin.';
    case ApiErrorType.SERVER:
      return 'Sunucuda bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
    default:
      return error.message || 'Beklenmeyen bir hata oluştu.';
  }
}

export default api;

