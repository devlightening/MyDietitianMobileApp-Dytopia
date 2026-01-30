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
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  useEffect(() => {
    loadToken();
  }, []);

  async function loadToken() {
    try {
      const storedToken = await SecureStore.getItemAsync('access_token');
      if (storedToken) {
        setToken(storedToken);
        // Load user state from server to get accurate premium status
        await refreshUserState();
      } else {
        setIsStateLoaded(true); // No token, state is "loaded" (no user)
      }
    } catch (error) {
      console.error('Failed to load token:', error);
      setIsStateLoaded(true); // Mark as loaded even on error
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshUserState() {
    try {
      const state = await getClientState();
      setUser({
        publicUserId: state.publicUserId,
        isPremium: state.isPremium,
        activeDietitianId: state.activeDietitianId,
        gender: undefined, // Not returned by /api/client/me
        birthDate: undefined, // Not returned by /api/client/me
        age: undefined, // Not returned by /api/client/me
      });
      setIsStateLoaded(true);
    } catch (error) {
      console.error('Failed to refresh user state:', error);
      // Fallback to JWT if server call fails
      const storedToken = await SecureStore.getItemAsync('access_token');
      if (storedToken) {
        const payload = decodeJWT(storedToken);
        setUser({
          publicUserId: payload.publicUserId || '',
          isPremium: false, // Default to free if we can't verify
          activeDietitianId: null,
          gender: payload.gender as Gender,
          birthDate: payload.birthDate,
          age: payload.age ? parseInt(payload.age) : undefined,
        });
      }
      setIsStateLoaded(true); // Still mark as loaded even on error
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
    await SecureStore.deleteItemAsync('access_token');
    setToken(null);
    setUser(null);
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
