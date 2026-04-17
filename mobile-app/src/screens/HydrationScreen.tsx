import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getTodayTracking,
  updateTodayTracking,
  type TodayTracking,
} from "../api/progress";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { refreshWidgetsFromApp } from "../widgets/services/widgetSyncService";
import { DEFAULT_HYDRATION_GOAL_GLASSES } from "../widgets/types";

export default function HydrationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isPremium } = useAuth();
  const [tracking, setTracking] = useState<TodayTracking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadTracking = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const nextTracking = await getTodayTracking();
      setTracking(nextTracking);
    } catch (error: any) {
      Alert.alert("Hydration unavailable", error?.message ?? "Could not load hydration data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTracking();
    }, [loadTracking]),
  );

  const updateHydration = useCallback(async (delta: number) => {
    if (!tracking || isSaving) {
      return;
    }

    const nextValue = Math.max(0, tracking.waterGlasses + delta);
    setIsSaving(true);

    try {
      const updated = await updateTodayTracking(nextValue, tracking.steps, tracking.notes);
      setTracking(updated);
      void refreshWidgetsFromApp(isPremium);
    } catch (error: any) {
      Alert.alert("Update failed", error?.message ?? "Could not update hydration.");
    } finally {
      setIsSaving(false);
    }
  }, [isPremium, isSaving, tracking]);

  const goalGlasses = DEFAULT_HYDRATION_GOAL_GLASSES;
  const currentGlasses = tracking?.waterGlasses ?? 0;
  const progressPercent = Math.min(
    100,
    Math.round((currentGlasses / goalGlasses) * 100),
  );

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void loadTracking(true);
            }}
            tintColor={theme.primary}
          />
        }
      >
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}14` }]}>
            <Ionicons name="water-outline" size={28} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Hydration</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Keep your water intake current from the app and the widget.
          </Text>

          <Text style={[styles.progressValue, { color: theme.text }]}>
            {currentGlasses} / {goalGlasses}
          </Text>
          <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
            glasses today
          </Text>

          <View style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPercent}%` as const,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
              ]}
              onPress={() => void updateHydration(-1)}
              disabled={isSaving}
            >
              <Text style={[styles.actionButtonText, { color: theme.text }]}>-1 glass</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={() => void updateHydration(1)}
              disabled={isSaving}
            >
              <Text style={styles.actionPrimaryText}>+1 glass</Text>
            </TouchableOpacity>
          </View>

          {isSaving ? (
            <View style={styles.syncRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.syncText, { color: theme.textMuted }]}>
                Saving hydration update...
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  progressValue: {
    marginTop: 24,
    fontSize: 40,
    fontWeight: "900",
  },
  progressLabel: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
  },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 20,
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  actionPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  syncText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
