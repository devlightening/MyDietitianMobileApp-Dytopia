import axios, { AxiosError, AxiosResponse } from 'axios';

const api = axios.create({
  baseURL: 'https://localhost:7154',  // HTTPS required for Secure cookies
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

    // No navigation logic here - let pages/guards handle auth
    return Promise.reject(apiError);
  }
);

export default api;
