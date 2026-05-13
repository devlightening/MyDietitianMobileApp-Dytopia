import React, { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Animated, Linking, Platform, Image } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../auth/AuthContext";
import { Routes } from "./routes";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { InAppNotificationProvider } from "../context/InAppNotificationContext";
import { FeedbackProvider } from "../context/FeedbackContext";
import { BRAND_LOGO } from "../assets/brandAssets";

import WelcomeScreen from "../screens/WelcomeScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";

import AppShell from "./AppShell";
import PremiumActivationScreen from "../screens/PremiumActivationScreen";
import CheckIngredientsScreen from "../screens/CheckIngredientsScreen";
import AlternativeResultScreen from "../screens/AlternativeResultScreen";
import KitchenResultScreen from "../screens/KitchenResultScreen";
import RecipeDetailScreen from "../screens/RecipeDetailScreen";
import CookingModeScreen from "../screens/CookingModeScreen";
import GameCenterScreen from "../screens/GameCenterScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import ProfileMeasurementsScreen from "../screens/ProfileMeasurementsScreen";
import ProfileNotificationsScreen from "../screens/ProfileNotificationsScreen";
import ProfileFeedbackScreen from "../screens/ProfileFeedbackScreen";
import ShoppingListScreen from "../screens/ShoppingListScreen";
import GoalPreferencesScreen from "../screens/GoalPreferencesScreen";
import PrivacyScreen from "../screens/PrivacyScreen";
import RateAppScreen from "../screens/RateAppScreen";
import IngredientScanScreen from "../screens/IngredientScanScreen";
import ReceiptScanScreen from "../screens/ReceiptScanScreen";
import BarcodeScanScreen from "../screens/BarcodeScanScreen";
import PantryScreen from "../screens/PantryScreen";
import TodayScreen from "../screens/TodayScreen";
import HydrationScreen from "../screens/HydrationScreen";
import WeeklySummaryScreen from "../screens/WeeklySummaryScreen";
import MealLogScreen from "../screens/MealLogScreen";
import BadgeVaultScreen from "../screens/BadgeVaultScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import OnboardingScreen, { ONBOARDING_DONE_KEY } from "../screens/OnboardingScreen";
import {
  parseWidgetDeepLink,
  type WidgetDeepLinkTarget,
} from "../widgets/deepLinks";

const Root = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<any>();

function Splash() {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[s.splash, { backgroundColor: theme.bg }]}>
      <Animated.View style={[s.splashContent, { opacity, transform: [{ scale }] }]}>
        <View style={[s.splashLogo, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <View style={[s.splashLogoBg, { backgroundColor: theme.primaryLight }]} />
          <Image source={BRAND_LOGO} style={s.splashLogoImage} resizeMode="contain" fadeDuration={0} />
        </View>
        <Text style={[s.splashTitle, { color: theme.text }]}>Dytopia</Text>
        <Text style={[s.splashSub, { color: theme.textMuted }]}>Sağlıklı yaşam rehberin</Text>
      </Animated.View>
      <ActivityIndicator
        size="small"
        color={theme.primary}
        style={s.splashSpinner}
      />
    </View>
  );
}

function AppNavigator() {
  const { isAuthenticated, isLoading, isStateLoaded, isPremium } = useAuth();
  const { isDark, theme } = useTheme();
  const ready = !isLoading && isStateLoaded;
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const pendingWidgetTargetRef = useRef<WidgetDeepLinkTarget | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDING_DONE_KEY).then(val => {
      setOnboardingDone(val === 'true');
    });
  }, []);

  useEffect(() => {
    const consumeUrl = (url: string | null | undefined) => {
      if (!url) {
        return;
      }

      const target = parseWidgetDeepLink(url);
      if (!target) {
        return;
      }

      pendingWidgetTargetRef.current = target;
      flushPendingWidgetTarget();
    };

    void Linking.getInitialURL().then(consumeUrl);

    const subscription = Linking.addEventListener("url", (event) => {
      consumeUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [ready, isAuthenticated, isPremium, onboardingDone]);

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: theme.bg } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.bg } };
  const stackAnimation = Platform.OS === "ios" ? "simple_push" : "fade_from_bottom";
  const stackDuration = Platform.OS === "ios" ? 300 : 240;
  const modalDuration = Platform.OS === "ios" ? 320 : 280;

  function flushPendingWidgetTarget() {
    if (
      onboardingDone !== true ||
      !ready ||
      !isAuthenticated ||
      !isPremium ||
      !navigationRef.isReady()
    ) {
      return;
    }

    const target = pendingWidgetTargetRef.current;
    if (!target) {
      return;
    }

    pendingWidgetTargetRef.current = null;

    navigationRef.navigate("App", {
      screen: target === "hydration" ? Routes.App.Hydration : Routes.App.Today,
    });
  }

  useEffect(() => {
    flushPendingWidgetTarget();
  }, [ready, isAuthenticated, isPremium, onboardingDone]);

  if (onboardingDone === null) return <Splash />;

  if (!onboardingDone) {
    return (
      <NavigationContainer theme={navTheme}>
        <OnboardingScreen onDone={() => setOnboardingDone(true)} />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={flushPendingWidgetTarget}
    >
      <Root.Navigator screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 220 }}>
        {!isAuthenticated ? (
          /* â”€â”€ Unauthenticated: Auth stack â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
          <Root.Screen name="Auth">
            {() =>
              ready ? (
                <Root.Navigator screenOptions={{
                  headerShown: false,
                  animation: stackAnimation,
                  animationDuration: stackDuration,
                  gestureEnabled: true,
                  fullScreenGestureEnabled: true,
                }}>
                  <Root.Screen name={Routes.Auth.Welcome} component={WelcomeScreen} />
                  <Root.Screen name={Routes.Auth.Login} component={LoginScreen} />
                  <Root.Screen name={Routes.Auth.Register} component={RegisterScreen} />
                </Root.Navigator>
              ) : (
                <Splash />
              )
            }
          </Root.Screen>
        ) : (
          /* â”€â”€ Authenticated: Freemium app stack â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
          <Root.Screen name="App">
            {() =>
              ready ? (
                <Root.Navigator screenOptions={{
                  headerShown: false,
                  animation: stackAnimation,
                  animationDuration: stackDuration,
                  gestureEnabled: true,
                  fullScreenGestureEnabled: true,
                }}>
                  <Root.Screen name={Routes.App.Shell} component={AppShell} options={{ animation: 'none' }} />
                  <Root.Screen name={Routes.App.Today} component={TodayScreen} />
                  <Root.Screen name={Routes.App.Hydration} component={HydrationScreen} />
                  <Root.Screen name={Routes.App.CheckIngredients} component={CheckIngredientsScreen} />
                  <Root.Screen name={Routes.App.AlternativeResult} component={AlternativeResultScreen} />
                  <Root.Screen
                    name={Routes.App.KitchenResult}
                    component={KitchenResultScreen}
                    options={{ animation: 'fade', animationDuration: 320 }}
                  />
                  <Root.Screen name={Routes.App.RecipeDetail} component={RecipeDetailScreen} />
                  <Root.Screen
                    name={Routes.App.CookingMode}
                    component={CookingModeScreen}
                    options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: modalDuration }}
                  />
                  <Root.Screen name={Routes.App.GameCenter} component={GameCenterScreen} options={{ animation: 'fade_from_bottom', animationDuration: modalDuration }} />
                  <Root.Screen name={Routes.App.Favorites} component={FavoritesScreen} />
                  <Root.Screen name={Routes.App.ProfileMeasurements} component={ProfileMeasurementsScreen} />
                  <Root.Screen name={Routes.App.ProfileNotifications} component={ProfileNotificationsScreen} />
                  <Root.Screen name={Routes.App.ProfileFeedback} component={ProfileFeedbackScreen} />
                  <Root.Screen name={Routes.App.ShoppingList} component={ShoppingListScreen} />
                  <Root.Screen name={Routes.App.GoalPreferences} component={GoalPreferencesScreen} />
                  <Root.Screen name={Routes.App.Privacy} component={PrivacyScreen} />
                  <Root.Screen name={Routes.App.RateApp} component={RateAppScreen} />
                  <Root.Screen
                    name={Routes.App.IngredientScan}
                    component={IngredientScanScreen}
                    options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: modalDuration }}
                  />
                  <Root.Screen
                    name={Routes.App.ReceiptScan}
                    component={ReceiptScanScreen}
                    options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: modalDuration }}
                  />
                  <Root.Screen
                    name={Routes.App.BarcodeScan}
                    component={BarcodeScanScreen}
                    options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: modalDuration }}
                  />
                  <Root.Screen
                    name={Routes.App.Pantry}
                    component={PantryScreen}
                    options={{ animation: 'fade_from_bottom', animationDuration: modalDuration }}
                  />
                  <Root.Screen name={Routes.App.WeeklySummary} component={WeeklySummaryScreen} options={{ animation: 'fade_from_bottom', animationDuration: modalDuration }} />
                  <Root.Screen name={Routes.App.MealLog} component={MealLogScreen} options={{ animation: 'fade_from_bottom', animationDuration: modalDuration }} />
                  <Root.Screen name={Routes.App.BadgeVault} component={BadgeVaultScreen} />
                  <Root.Screen name={Routes.App.ChangePassword} component={ChangePasswordScreen} />
                </Root.Navigator>
              ) : (
                <Splash />
              )
            }
          </Root.Screen>
        )}
        {/* Modal: accessible from both Free and App stacks via navigation.getParent() */}
        <Root.Group screenOptions={{ presentation: "modal", headerShown: false, animation: 'slide_from_bottom', animationDuration: modalDuration }}>
          <Root.Screen name={Routes.Modal.ActivatePremium} component={PremiumActivationScreen} />
        </Root.Group>
      </Root.Navigator>
    </NavigationContainer>
  );
}

export default function RootNavigator() {
  return (
    <ThemeProvider>
      <FeedbackProvider>
        <InAppNotificationProvider>
          <AppNavigator />
        </InAppNotificationProvider>
      </FeedbackProvider>
    </ThemeProvider>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, justifyContent: "center", alignItems: "center" },
  splashContent: { alignItems: "center", marginBottom: 48 },
  splashLogo: {
    width: 106, height: 106, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  splashLogoBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.28 },
  splashLogoImage: { width: 96, height: 96, borderRadius: 28 },
  splashEmoji: { fontSize: 42 },
  splashTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5, marginBottom: 6 },
  splashSub: { fontSize: 14, fontWeight: "600" },
  splashSpinner: { position: "absolute", bottom: 60 },
});

