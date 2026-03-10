import axios, { AxiosError, AxiosResponse } from 'axios';
import { toast } from '@/components/ui/Toast';

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

    // Show toast notification for errors (except 401 which triggers redirect)
    if (errorType !== ApiErrorType.UNAUTHORIZED) {
      const friendlyMessage = getFriendlyErrorMessage(apiError);
      toast.error(friendlyMessage);
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
      return 'Network error. Please check your connection and try again.';
    case ApiErrorType.UNAUTHORIZED:
      return 'Your session has expired. Please log in again.';
    case ApiErrorType.FORBIDDEN:
      return 'You do not have permission to perform this action.';
    case ApiErrorType.NOT_FOUND:
      return 'The requested resource was not found.';
    case ApiErrorType.VALIDATION:
      return error.message || 'Please check your input and try again.';
    case ApiErrorType.SERVER:
      return 'A server error occurred. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
}

export default api;

