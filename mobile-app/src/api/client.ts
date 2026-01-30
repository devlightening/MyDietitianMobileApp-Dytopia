import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

// Log API base URL on startup
if (__DEV__) {
  console.log('API Client initialized with baseURL:', API_BASE_URL);
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25000, // Increased to 25s for login timeout issues
});

// Request interceptor: Add auth token and debug logging
apiClient.interceptors.request.use(async (config: any) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

export default apiClient;
