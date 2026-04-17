import React, { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Animated, Linking } from "react-native";
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

import WelcomeScreen from "../screens/WelcomeScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import FreeHomeScreen from "../screens/FreeHomeScreen";

import AppShell from "./AppShell";
import PremiumActivationScreen from "../screens/PremiumActivationScreen";
import CheckIngredientsScreen from "../screens/CheckIngredientsScreen";
import AlternativeResultScreen from "../screens/AlternativeResultScreen";
import KitchenResultScreen from "../screens/KitchenResultScreen";
import RecipeDetailScreen from "../screens/RecipeDetailScreen";
import ProfileMeasurementsScreen from "../screens/ProfileMeasurementsScreen";
import ProfileNotificationsScreen from "../screens/ProfileNotificationsScreen";
import ShoppingListScreen from "../screens/ShoppingListScreen";
import GoalPreferencesScreen from "../screens/GoalPreferencesScreen";
import PrivacyScreen from "../screens/PrivacyScreen";
import RateAppScreen from "../screens/RateAppScreen";
import IngredientScanScreen from "../screens/IngredientScanScreen";
import BarcodeScanScreen from "../screens/BarcodeScanScreen";
import TodayScreen from "../screens/TodayScreen";
import HydrationScreen from "../screens/HydrationScreen";
import WeeklySummaryScreen from "../screens/WeeklySummaryScreen";
import MealLogScreen from "../screens/MealLogScreen";
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
        <View style={[s.splashLogo, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '40' }]}>
          <View style={[s.splashLogoBg, { backgroundColor: theme.primary }]} />
          <Text style={s.splashEmoji}>🥗</Text>
        </View>
        <Text style={[s.splashTitle, { color: theme.text }]}>MyDietitian</Text>
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
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          /* ── Unauthenticated: Auth stack ─────────────────────────── */
          <Root.Screen name="Auth">
            {() =>
              ready ? (
                <Root.Navigator screenOptions={{ headerShown: false }}>
                  <Root.Screen name={Routes.Auth.Welcome} component={WelcomeScreen} />
                  <Root.Screen name={Routes.Auth.Login} component={LoginScreen} />
                  <Root.Screen name={Routes.Auth.Register} component={RegisterScreen} />
                </Root.Navigator>
              ) : (
                <Splash />
              )
            }
          </Root.Screen>
        ) : !isPremium ? (
          /* ── Authenticated, Free user: FreeHome stack ────────────── */
          <Root.Screen name="Free">
            {() =>
              ready ? (
                <Root.Navigator screenOptions={{ headerShown: false }}>
                  <Root.Screen name={Routes.Free.Home} component={FreeHomeScreen} />
                </Root.Navigator>
              ) : (
                <Splash />
              )
            }
          </Root.Screen>
        ) : (
          /* ── Authenticated, Premium: Full App stack ──────────────── */
          <Root.Screen name="App">
            {() =>
              ready ? (
                <Root.Navigator screenOptions={{ headerShown: false }}>
                  <Root.Screen name={Routes.App.Shell} component={AppShell} />
                  <Root.Screen name={Routes.App.Today} component={TodayScreen} />
                  <Root.Screen name={Routes.App.Hydration} component={HydrationScreen} />
                  <Root.Screen name={Routes.App.CheckIngredients} component={CheckIngredientsScreen} />
                  <Root.Screen name={Routes.App.AlternativeResult} component={AlternativeResultScreen} />
                  <Root.Screen name={Routes.App.KitchenResult} component={KitchenResultScreen} />
                  <Root.Screen name={Routes.App.RecipeDetail} component={RecipeDetailScreen} />
                  <Root.Screen name={Routes.App.ProfileMeasurements} component={ProfileMeasurementsScreen} />
                  <Root.Screen name={Routes.App.ProfileNotifications} component={ProfileNotificationsScreen} />
                  <Root.Screen name={Routes.App.ShoppingList} component={ShoppingListScreen} />
                  <Root.Screen name={Routes.App.GoalPreferences} component={GoalPreferencesScreen} />
                  <Root.Screen name={Routes.App.Privacy} component={PrivacyScreen} />
                  <Root.Screen name={Routes.App.RateApp} component={RateAppScreen} />
                  <Root.Screen
                    name={Routes.App.IngredientScan}
                    component={IngredientScanScreen}
                    options={{ presentation: 'modal' }}
                  />
                  <Root.Screen
                    name={Routes.App.BarcodeScan}
                    component={BarcodeScanScreen}
                    options={{ presentation: 'modal' }}
                  />
                  <Root.Screen name={Routes.App.WeeklySummary} component={WeeklySummaryScreen} />
                  <Root.Screen name={Routes.App.MealLog} component={MealLogScreen} />
                </Root.Navigator>
              ) : (
                <Splash />
              )
            }
          </Root.Screen>
        )}
        {/* Modal: accessible from both Free and App stacks via navigation.getParent() */}
        <Root.Group screenOptions={{ presentation: "modal", headerShown: false }}>
          <Root.Screen name={Routes.Modal.ActivatePremium} component={PremiumActivationScreen} />
        </Root.Group>
      </Root.Navigator>
    </NavigationContainer>
  );
}

export default function RootNavigator() {
  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, justifyContent: "center", alignItems: "center" },
  splashContent: { alignItems: "center", marginBottom: 48 },
  splashLogo: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  splashLogoBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.12 },
  splashEmoji: { fontSize: 42 },
  splashTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5, marginBottom: 6 },
  splashSub: { fontSize: 14, fontWeight: "600" },
  splashSpinner: { position: "absolute", bottom: 60 },
});
