import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { Routes } from './src/navigation/routes';

// Auth Screens
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';

// Free Mode
import FreeHomeScreen from './src/screens/FreeHomeScreen';
import PremiumActivationScreen from './src/screens/PremiumActivationScreen';

// Premium Screens
import TodayScreen from './src/screens/TodayScreen';
import CheckIngredientsScreen from './src/screens/CheckIngredientsScreen';
import AlternativeResultScreen from './src/screens/AlternativeResultScreen';

const Stack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();
const queryClient = new QueryClient();

function AppNavigator() {
  const { isAuthenticated, user, isLoading, isStateLoaded } = useAuth();

  // 🔥 Calculate isPremium explicitly - undefined means FREE
  const isPremium = user?.isPremium === true;

  // Debug logging (dev only)
  if (__DEV__) {
    console.log('=== AppNavigator State ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('isStateLoaded:', isStateLoaded);
    console.log('user?.isPremium:', user?.isPremium);
    console.log('calculated isPremium:', isPremium);
    console.log('========================');
  }

  // Rule: Token yoksa → AuthStack
  if (!isAuthenticated) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name={Routes.Auth.Welcome} component={WelcomeScreen} />
        <Stack.Screen name={Routes.Auth.Login} component={LoginScreen} />
        <Stack.Screen name={Routes.Auth.Register} component={RegisterScreen} />
      </Stack.Navigator>
    );
  }

  // Rule: Token var + userStateLoaded === false → Splash/Loading
  // CRITICAL: isStateLoaded false ise stack kararı verme
  if (!isStateLoaded || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Rule: Token var + isStateLoaded true → isPremium === true ? PremiumStack : FreeStack
  // CRITICAL: isPremium undefined ise FREE say
  if (isPremium) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name={Routes.Premium.Today} component={TodayScreen} />
        <Stack.Screen name={Routes.Premium.CheckIngredients} component={CheckIngredientsScreen} />
        <Stack.Screen name={Routes.Premium.AlternativeResult} component={AlternativeResultScreen} />
      </Stack.Navigator>
    );
  }

  // FreeStack - only rendered when isPremium === false (or undefined)
  // 🔥 initialRouteName ensures FreeHome is always the first screen
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName={Routes.Free.Home}
    >
      <Stack.Screen name={Routes.Free.Home} component={FreeHomeScreen} />
      <Stack.Screen name={Routes.Free.ActivatePremium} component={PremiumActivationScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppWithNavigation />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppWithNavigation() {
  const { isAuthenticated, user, isStateLoaded } = useAuth();
  
  // 🔥 Calculate isPremium explicitly - undefined means FREE
  const isPremium = user?.isPremium === true;
  
  // 🔥 Generate key based on auth state to force remount on stack switch
  // This prevents stale navigation state when switching between Free/Premium stacks
  const stackKey = !isAuthenticated 
    ? 'auth' 
    : !isStateLoaded 
      ? 'loading' 
      : isPremium 
        ? 'premium' 
        : 'free';

  return (
    <NavigationContainer key={stackKey}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {/* Main navigator (Auth/Free/Premium conditional) */}
        <RootStack.Screen name="Main" component={AppNavigator} />
        
        {/* Modal screens - accessible from anywhere */}
        <RootStack.Group screenOptions={{ presentation: 'modal' }}>
          <RootStack.Screen 
            name={Routes.Modal.ActivatePremium} 
            component={PremiumActivationScreen} 
          />
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
