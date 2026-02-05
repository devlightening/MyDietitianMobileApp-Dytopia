/**
 * Development utilities for debugging and testing
 */
import * as SecureStore from 'expo-secure-store';

/**
 * Reset all app data (auth tokens, user state, etc.)
 * Only available in development mode
 */
export async function resetAppData(): Promise<void> {
  if (!__DEV__) {
    throw new Error('resetAppData is only available in development mode');
  }

  try {
    // Delete all auth-related keys from SecureStore
    await SecureStore.deleteItemAsync('access_token');
    
    // If using AsyncStorage for other data, clear it here
    // import AsyncStorage from '@react-native-async-storage/async-storage';
    // await AsyncStorage.clear();
    
    console.log('✅ App data reset complete');
    console.log('⚠️ Please manually reload the app (shake device → Reload)');
    
    // Note: expo-updates is optional, so we don't force reload
    // User can manually reload via Expo Go menu or dev menu
  } catch (error) {
    console.error('Failed to reset app data:', error);
    throw error;
  }
}
