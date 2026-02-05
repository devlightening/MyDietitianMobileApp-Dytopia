import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import { Routes } from "./routes";

import WelcomeScreen from "../screens/WelcomeScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";

import AppShell from "./AppShell";
import PremiumActivationScreen from "../screens/PremiumActivationScreen";
import CheckIngredientsScreen from "../screens/CheckIngredientsScreen";
import AlternativeResultScreen from "../screens/AlternativeResultScreen";
import ProfileMeasurementsScreen from "../screens/ProfileMeasurementsScreen";

const Root = createNativeStackNavigator();

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.sage} />
    </View>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, isLoading, isStateLoaded } = useAuth();

  const ready = !isLoading && isStateLoaded;

  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
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
        ) : (
          <Root.Screen name="App">
            {() =>
              ready ? (
                <Root.Navigator screenOptions={{ headerShown: false }}>
                  <Root.Screen name={Routes.App.Shell} component={AppShell} />
                  <Root.Screen name={Routes.App.CheckIngredients} component={CheckIngredientsScreen} />
                  <Root.Screen name={Routes.App.AlternativeResult} component={AlternativeResultScreen} />
                  <Root.Screen name={Routes.App.ProfileMeasurements} component={ProfileMeasurementsScreen} />
                </Root.Navigator>
              ) : (
                <Splash />
              )
            }
          </Root.Screen>
        )}

        {/* Modal group: Premium Activation is ALWAYS modal and NEVER forced */}
        <Root.Group screenOptions={{ presentation: "modal", headerShown: false }}>
          <Root.Screen name={Routes.Modal.ActivatePremium} component={PremiumActivationScreen} />
        </Root.Group>
      </Root.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.oat, justifyContent: "center", alignItems: "center" },
});
