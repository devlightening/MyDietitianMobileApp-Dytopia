import React, { createContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { registerClient as registerClientAPI, loginClient as loginClientAPI, activatePremium as activatePremiumAPI } from '../api/auth';
import { getClientState } from '../api/client-state';
import { Gender } from '../types/auth';

interface User {
  publicUserId: string;
  isPremium: boolean;
  activeDietitianId: string | null;
  gender?: Gender;
  birthDate?: string;
  age?: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isStateLoaded: boolean; // True when /api/client/me has completed
  isPremium: boolean;
  register: (email: string, password: string, fullName: string, gender: Gender, birthDate: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  activatePremium: (accessKey: string) => Promise<{ success: boolean; message: string; dietitianName?: string }>;
  logout: () => Promise<void>;
  refreshUserState: () => Promise<void>; // Expose refresh function
  resetAppData?: () => Promise<void>; // Dev only: reset all app data
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const didInitialRefresh = React.useRef(false);

  useEffect(() => {
    loadToken();
  }, []);

  /**
   * Bootstrap auth: Single source of truth for authentication state
   * - Token yoksa: isAuthenticated=false, user=null, isStateLoaded=true
   * - Token varsa: token set et, mutlaka refreshUserState() çağır, sonra isAuthenticated=true
   */
  async function loadToken() {
    try {
      const storedToken = await SecureStore.getItemAsync('access_token');

      if (!storedToken) {
        // No token: user is not authenticated
        setToken(null);
        setUser(null);
        setIsStateLoaded(true);
        setIsLoading(false);
        return;
      }

      // Token exists: set token and fetch fresh state from server
      setToken(storedToken);

      // 🔥 CRITICAL: Always fetch fresh state from /api/client/me
      // This is the single source of truth for isPremium
      // Use ref guard to prevent multiple calls
      if (!didInitialRefresh.current) {
        didInitialRefresh.current = true;
        try {
          await refreshUserState();
        } catch (error: any) {
          // If refresh fails with 401, token is invalid - clear it
          if (error?.response?.status === 401 || error?.status === 401) {
            console.warn('Token invalid (401), clearing auth state');
            await SecureStore.deleteItemAsync('access_token');
            setToken(null);
            setUser(null);
            setIsStateLoaded(true);
            setIsLoading(false);
            return;
          }

          // Other errors (timeout, network): continue in offline mode
          console.warn('API unreachable, continuing in offline mode:', error.message || error);
          setUser(null); // Don't use stale user data
          setIsStateLoaded(true);
          setIsLoading(false);
          return;
        }
      }

      // Success: state loaded from server
      setIsStateLoaded(true);
    } catch (error) {
      console.error('Failed to load token:', error);
      setToken(null);
      setUser(null);
      setIsStateLoaded(true); // Mark as loaded even on error
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Refresh user state from /api/client/me
   * This is the SINGLE SOURCE OF TRUTH for isPremium
   * - Always overwrites existing user state
   * - 401 response triggers automatic logout
   * - Never falls back to JWT for isPremium (security)
   */
  async function refreshUserState() {
    try {
      const state = await getClientState();

      // 🔥 FORCE overwrite user state with server response
      // This ensures isPremium is always accurate
      setUser({
        publicUserId: state.publicUserId,
        isPremium: state.isPremium, // 🔥 Single source of truth
        activeDietitianId: state.activeDietitianId,
        gender: undefined, // Not returned by /api/client/me
        birthDate: undefined, // Not returned by /api/client/me
        age: undefined, // Not returned by /api/client/me
      });

      setIsStateLoaded(true);
    } catch (error: any) {
      // 401 = token invalid, clear auth state
      if (error?.response?.status === 401 || error?.status === 401) {
        console.warn('401 from /api/client/me, clearing auth state');
        await SecureStore.deleteItemAsync('access_token');
        setToken(null);
        setUser(null);
        setIsStateLoaded(true);
        return;
      }

      // Other errors (timeout, network): warn but don't crash
      console.warn('Failed to refresh user state:', error.message || error);

      // Don't use stale data, clear user
      // This prevents "premium" state from persisting when server is down
      setUser(null);
      setIsStateLoaded(true);
    }
  }

  async function register(email: string, password: string, fullName: string, gender: Gender, birthDate: string) {
    try {
      const response = await registerClientAPI({ email, password, fullName, gender, birthDate });
      await SecureStore.setItemAsync('access_token', response.token);
      setToken(response.token);

      // FREE-FIRST: Load state from server to get accurate premium status
      // New users are always free
      await refreshUserState();
    } catch (error: any) {
      // Rethrow for caller to handle
      throw error;
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await loginClientAPI({ email, password });
      await SecureStore.setItemAsync('access_token', response.token);
      setToken(response.token);

      // FREE-FIRST: Load state from server to get accurate premium status
      // This ensures we get the correct isPremium value from the backend
      await refreshUserState();
    } catch (error: any) {
      // Self-healing: If network error, try to fix baseURL and retry once
      if (__DEV__ && error.code === 'ERR_NETWORK') {
        console.log('🔧 Network error detected, attempting self-heal...');

        try {
          // Import helpers
          const { setApiBaseUrl } = await import('../api/client');

          // Get packager IP
          let Constants: any = null;
          try { Constants = require('expo-constants'); } catch { }

          const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest?.debuggerHost;
          if (hostUri) {
            const packagerIp = hostUri.split(':')[0];
            const healedUrl = `http://${packagerIp}:5000`;

            console.log('🔧 Attempting to heal baseURL to:', healedUrl);
            setApiBaseUrl(healedUrl);

            // Retry login once
            console.log('🔧 Retrying login with healed baseURL...');
            const retryResponse = await loginClientAPI({ email, password });
            await SecureStore.setItemAsync('access_token', retryResponse.token);
            setToken(retryResponse.token);
            await refreshUserState();

            console.log('✅ Self-heal successful! Login completed.');
            return; // Success!
          }
        } catch (retryError: any) {
          console.log('❌ Self-heal failed:', retryError.message);
          // Fall through to throw original error
        }
      }

      // Rethrow for caller to handle
      throw error;
    }
  }

  async function activatePremium(accessKey: string) {
    try {
      const response = await activatePremiumAPI({ accessKey });

      // Refresh user state from server to get updated premium status
      await refreshUserState();

      return {
        success: true,
        message: response.message,
        dietitianName: response.dietitianName,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Aktivasyon başarısız',
      };
    }
  }

  async function logout() {
    // ✅ Instant UI update - clear state first
    setToken(null);
    setUser(null);
    setIsStateLoaded(true); // ✅ token yok => state loaded sayılmalı

    // Clear React Query cache to prevent stale data
    try {
      const { queryClient } = await import('../queries/queryClient');
      queryClient.clear();
    } catch (err) {
      console.warn('Failed to clear query cache:', err);
    }

    // ✅ storage cleanup (doesn't block UI)
    try {
      await SecureStore.deleteItemAsync('access_token');
    } catch (e) {
      console.warn('Failed to delete token from SecureStore:', e);
    }
  }

  // Dev only: Reset app data
  async function resetAppData() {
    if (!__DEV__) {
      throw new Error('resetAppData is only available in development');
    }
    const { resetAppData: resetUtil } = await import('../utils/dev');
    await resetUtil();
  }

  function decodeJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return {};
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!token,
        isLoading,
        isStateLoaded,
        isPremium: user?.isPremium ?? false,
        register,
        login,
        activatePremium,
        logout,
        refreshUserState,
        resetAppData: __DEV__ ? resetAppData : undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
