import { Platform } from 'react-native';

// Import Constants - expo-constants is included with Expo SDK
// Use dynamic import with fallback for safety
let Constants: any = null;
try {
  // @ts-ignore - expo-constants may not be in types but is available at runtime
  Constants = require('expo-constants');
} catch {
  // Constants not available (shouldn't happen in Expo, but handle gracefully)
  console.warn('expo-constants not available - device detection may be limited');
}

/**
 * Single source of truth for API base URL
 * Priority:
 * 1. process.env.EXPO_PUBLIC_API_BASE_URL
 * 2. Constants.expoConfig?.extra?.apiBaseUrl
 * 3. http://localhost:5000 (ONLY allowed on emulator/simulator)
 * 
 * Throws error if localhost is used on physical device
 */
// Track source for logging
let API_BASE_URL_SOURCE: string = 'unknown';

const getApiBaseUrl = (): string => {
  let resolvedUrl: string;
  let source: string;

  // Priority 1: Environment variable
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    resolvedUrl = envUrl;
    source = 'process.env.EXPO_PUBLIC_API_BASE_URL';
  } else {
    // Priority 2: Expo config extra
    const configUrl = Constants?.expoConfig?.extra?.apiBaseUrl;
    if (configUrl) {
      resolvedUrl = configUrl;
      source = 'Constants.expoConfig.extra.apiBaseUrl';
    } else {
      // Priority 3: Fallback to localhost (ONLY for emulator/simulator)
      resolvedUrl = __DEV__ ? 'http://localhost:5000' : 'https://api.mydietitian.com';
      source = 'fallback (localhost for dev, production URL for prod)';
    }
  }

  // Store source for logging
  API_BASE_URL_SOURCE = source;

  // Check if running on physical device
  // Note: Constants.isDevice is true for both physical devices and simulators
  // We need to check executionEnvironment to distinguish
  const isPhysicalDevice = Constants?.isDevice === true && 
    Constants?.executionEnvironment !== 'storeClient' && // Not Expo Go
    !Constants?.executionEnvironment?.includes('simulator') &&
    !Constants?.executionEnvironment?.includes('emulator');

  // CRITICAL: If physical device AND resolved URL contains localhost, throw error
  const isLocalhost = resolvedUrl.includes('localhost') || resolvedUrl.includes('127.0.0.1');
  if (isPhysicalDevice && isLocalhost) {
    const errorMessage = 
      'On device, localhost points to the phone. Set EXPO_PUBLIC_API_BASE_URL to your LAN IP.\n\n' +
      'Example: EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:5000\n\n' +
      'Find your PC\'s LAN IP:\n' +
      '- Windows: ipconfig\n' +
      '- Mac/Linux: ifconfig or ip addr';
    
    console.error('=== API CONFIGURATION ERROR ===');
    console.error('Resolved URL:', resolvedUrl);
    console.error('Source:', source);
    console.error('Is Physical Device: true');
    console.error(errorMessage);
    console.error('==============================');
    
    throw new Error(errorMessage);
  }

  // Only allow localhost on emulator/simulator
  // If Constants is not available, be lenient (might be web or other environment)
  if (!Constants && isLocalhost) {
    console.warn('expo-constants not available - allowing localhost fallback (may fail on physical device)');
  }
  
  return resolvedUrl;
};

export const API_BASE_URL = getApiBaseUrl();

// Log API base URL on app startup and before login
if (__DEV__) {
  const isPhysicalDevice = Constants?.isDevice === true && 
    Constants?.executionEnvironment !== 'storeClient' &&
    !Constants?.executionEnvironment?.includes('simulator') &&
    !Constants?.executionEnvironment?.includes('emulator');
  
  console.log('=== API Configuration ===');
  console.log('Resolved API_BASE_URL:', API_BASE_URL);
  console.log('Source:', API_BASE_URL_SOURCE);
  console.log('EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL || '(not set)');
  console.log('expoConfig.extra.apiBaseUrl:', Constants?.expoConfig?.extra?.apiBaseUrl || '(not set)');
  console.log('Is Physical Device:', isPhysicalDevice);
  console.log('Platform:', Platform.OS);
  console.log('Execution Environment:', Constants?.executionEnvironment || 'unknown');
  console.log('========================');
}

export default API_BASE_URL;
