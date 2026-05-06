import React, { useCallback, useState } from "react";
import { useMemo } from "react";
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
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  getTodayTracking,
  updateTodayTracking,
  type TodayTracking,
} from "../api/progress";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import { refreshWidgetsFromApp } from "../widgets/services/widgetSyncService";
import { DEFAULT_HYDRATION_GOAL_GLASSES } from "../widgets/types";
import AnimatedCard from "../components/ui/AnimatedCard";
import PulseBadge from "../components/ui/PulseBadge";
import ShimmerLine from "../components/ui/ShimmerLine";
import SuccessSettleWrapper from "../components/ui/SuccessSettleWrapper";

export default function HydrationScreen() {
  const { theme } = useTheme();
  const { language } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isPremium } = useAuth();
  const [tracking, setTracking] = useState<TodayTracking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const copy = language === "tr"
    ? {
        loadErrorTitle: "Su takibi kullanılamıyor",
        loadErrorBody: "Su verileri şu anda yüklenemedi.",
        updateErrorTitle: "Güncelleme başarısız",
        updateErrorBody: "Su takibi güncellenemedi.",
        title: "Su Takibi",
        subtitle: "Su tüketimini uygulama ve widget üzerinden güncel tut.",
        progressLabel: "bugün bardak",
        decrease: "-1 bardak",
        increase: "+1 bardak",
        saving: "Su güncellemesi kaydediliyor...",
        completed: "Hedef tamam",
        completedBody: "Bugünün su ritmi kapandı. İstersen koruma bardağı ekleyebilirsin.",
        strong: "Ritim güçleniyor",
        strongBody: "Az kaldı; birkaç küçük yudumla hedefe ulaşırsın.",
        start: "Mini seri başlat",
        startBody: "İlk 3 bardak günün en kolay kazanımı. Hadi ritmi açalım.",
        remaining: "kaldı",
        bonus: "bonus",
        mission: "Mini görev",
        nextReward: "Sıradaki eşik",
      }
    : {
        loadErrorTitle: "Hydration unavailable",
        loadErrorBody: "Could not load hydration data.",
        updateErrorTitle: "Update failed",
        updateErrorBody: "Could not update hydration.",
        title: "Hydration",
        subtitle: "Keep your water intake current from the app and the widget.",
        progressLabel: "glasses today",
        decrease: "-1 glass",
        increase: "+1 glass",
        saving: "Saving hydration update...",
        completed: "Goal complete",
        completedBody: "Today's hydration rhythm is done. Add a bonus glass if you want.",
        strong: "Rhythm is building",
        strongBody: "Almost there; a few small sips will close the goal.",
        start: "Start a mini streak",
        startBody: "The first 3 glasses are today's easiest win. Let's open the rhythm.",
        remaining: "left",
        bonus: "bonus",
        mission: "Mini mission",
        nextReward: "Next checkpoint",
      };

  const loadTracking = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const nextTracking = await getTodayTracking();
      setTracking(nextTracking);
    } catch (error: any) {
      Alert.alert(copy.loadErrorTitle, error?.message ?? copy.loadErrorBody);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [copy.loadErrorBody, copy.loadErrorTitle]);

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
      Alert.alert(copy.updateErrorTitle, error?.message ?? copy.updateErrorBody);
    } finally {
      setIsSaving(false);
    }
  }, [copy.updateErrorBody, copy.updateErrorTitle, isPremium, isSaving, tracking]);

  const goalGlasses = DEFAULT_HYDRATION_GOAL_GLASSES;
  const currentGlasses = tracking?.waterGlasses ?? 0;
  const remainingGlasses = Math.max(goalGlasses - currentGlasses, 0);
  const bonusGlasses = Math.max(currentGlasses - goalGlasses, 0);
  const progressPercent = Math.min(
    100,
    Math.round((currentGlasses / goalGlasses) * 100),
  );
  const gameState = useMemo(() => {
    if (currentGlasses >= goalGlasses) {
      return {
        title: copy.completed,
        body: copy.completedBody,
        icon: "trophy-outline" as const,
        accent: theme.emerald,
      };
    }

    if (currentGlasses >= Math.ceil(goalGlasses * 0.6)) {
      return {
        title: copy.strong,
        body: copy.strongBody,
        icon: "sparkles-outline" as const,
        accent: theme.primary,
      };
    }

    return {
      title: copy.start,
      body: copy.startBody,
      icon: "flag-outline" as const,
      accent: theme.accentGold,
    };
  }, [
    copy.completed,
    copy.completedBody,
    copy.start,
    copy.startBody,
    copy.strong,
    copy.strongBody,
    currentGlasses,
    goalGlasses,
    theme.accentGold,
    theme.emerald,
    theme.primary,
  ]);
  const glassSlots = useMemo(
    () => Array.from({ length: goalGlasses }, (_, index) => index < currentGlasses),
    [currentGlasses, goalGlasses],
  );
  const nextCheckpoint = Math.min(
    goalGlasses,
    currentGlasses < 3 ? 3 : currentGlasses < 6 ? 6 : goalGlasses,
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
        <AnimatedCard style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}14` }]}>
            <Ionicons name="water-outline" size={28} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {copy.subtitle}
          </Text>

          <SuccessSettleWrapper trigger={currentGlasses}>
            <Text style={[styles.progressValue, { color: theme.text }]}>
              {currentGlasses} / {goalGlasses}
            </Text>
          </SuccessSettleWrapper>
          <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
            {copy.progressLabel}
          </Text>

          <PulseBadge
            active={progressPercent < 100}
            color={progressPercent >= 100 ? theme.emerald : theme.primary}
            backgroundColor={progressPercent >= 100 ? `${theme.emerald}14` : `${theme.primary}12`}
            borderColor={progressPercent >= 100 ? `${theme.emerald}2C` : `${theme.primary}26`}
            label={language === "tr" ? `%${progressPercent} tamam` : `${progressPercent}% complete`}
          />

          <View style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
            {isSaving ? (
              <ShimmerLine active color={`${theme.primary}18`} style={styles.progressSweep} />
            ) : null}
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

          <View style={[styles.gameCard, { backgroundColor: `${gameState.accent}0F`, borderColor: `${gameState.accent}30` }]}>
            <View style={styles.gameHeader}>
              <View style={[styles.gameIcon, { backgroundColor: `${gameState.accent}18` }]}>
                <Ionicons name={gameState.icon} size={19} color={gameState.accent} />
              </View>
              <View style={styles.gameTextWrap}>
                <Text style={[styles.gameTitle, { color: theme.text }]}>{gameState.title}</Text>
                <Text style={[styles.gameBody, { color: theme.textMuted }]}>{gameState.body}</Text>
              </View>
              <View style={[styles.remainingPill, { backgroundColor: theme.surface, borderColor: `${gameState.accent}28` }]}>
                <Text style={[styles.remainingValue, { color: gameState.accent }]}>
                  {remainingGlasses > 0 ? remainingGlasses : `+${bonusGlasses}`}
                </Text>
                <Text style={[styles.remainingLabel, { color: theme.textMuted }]}>
                  {remainingGlasses > 0 ? copy.remaining : copy.bonus}
                </Text>
              </View>
            </View>

            <View style={styles.glassGrid}>
              {glassSlots.map((isFilled, index) => (
                <View
                  key={`glass-${index}`}
                  style={[
                    styles.glassToken,
                    {
                      backgroundColor: isFilled ? `${theme.primary}18` : theme.surface,
                      borderColor: isFilled ? `${theme.primary}55` : theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={isFilled ? "water" : "water-outline"}
                    size={15}
                    color={isFilled ? theme.primary : theme.textMuted}
                  />
                </View>
              ))}
            </View>

            <View style={styles.missionRow}>
              <View style={[styles.missionChip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="sparkles-outline" size={14} color={gameState.accent} />
                <Text style={[styles.missionChipText, { color: theme.text }]}>
                  {copy.mission}: {currentGlasses}/{nextCheckpoint}
                </Text>
              </View>
              <View style={[styles.missionChip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="ribbon-outline" size={14} color={theme.accentGold} />
                <Text style={[styles.missionChipText, { color: theme.text }]}>
                  {copy.nextReward}: {Math.max(nextCheckpoint - currentGlasses, 0)}
                </Text>
              </View>
            </View>
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
              <Text style={[styles.actionButtonText, { color: theme.text }]}>{copy.decrease}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={() => void updateHydration(1)}
              disabled={isSaving}
            >
              <Text style={styles.actionPrimaryText}>{copy.increase}</Text>
            </TouchableOpacity>
          </View>

          {isSaving ? (
            <Animated.View entering={FadeInDown.duration(220)} style={styles.syncRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.syncText, { color: theme.textMuted }]}>
                {copy.saving}
              </Text>
            </Animated.View>
          ) : null}
        </AnimatedCard>
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
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
  },
  progressSweep: {
    left: -40,
    top: 0,
    bottom: 0,
    opacity: 0.8,
  },
  gameCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginTop: 18,
  },
  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gameIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  gameTextWrap: {
    flex: 1,
  },
  gameTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  gameBody: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },
  remainingPill: {
    minWidth: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  remainingValue: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  remainingLabel: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: "800",
  },
  glassGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  glassToken: {
    width: 31,
    height: 31,
    borderRadius: 15.5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  missionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 13,
  },
  missionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  missionChipText: {
    fontSize: 10.5,
    fontWeight: "800",
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

