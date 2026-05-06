import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppDialog from "../components/ui/AppDialog";
import { useTheme } from "./ThemeContext";
import { radii, spacing } from "../theme/tokens";

type FeedbackVariant = "success" | "warning" | "error" | "info";
type FeedbackMode = "full" | "haptic" | "silent";

interface FeedbackAction {
  label: string;
  onPress?: () => void;
  tone?: "primary" | "warning" | "danger" | "muted";
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}

interface ToastOptions {
  title: string;
  message?: string;
  variant?: FeedbackVariant;
  durationMs?: number;
  action?: FeedbackAction;
}

interface DialogOptions {
  title: string;
  message?: string;
  eyebrow?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  variant?: FeedbackVariant;
  primaryAction?: FeedbackAction;
  secondaryAction?: FeedbackAction;
  suggestions?: FeedbackAction[];
}

interface TimerOptions {
  id?: string;
  title: string;
  subtitle?: string;
  seconds: number;
  completeTitle?: string;
  completeMessage?: string;
}

interface FeedbackContextValue {
  feedbackMode: FeedbackMode;
  toastDurationMs: number;
  timerBannerEnabled: boolean;
  setFeedbackMode: (mode: FeedbackMode) => Promise<void>;
  setToastDurationMs: (durationMs: number) => Promise<void>;
  setTimerBannerEnabled: (enabled: boolean) => Promise<void>;
  showToast: (options: ToastOptions) => void;
  showUndoToast: (title: string, onUndo: () => void, message?: string) => void;
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;
  playFeedback: (variant: FeedbackVariant | "light" | "timer") => void;
  startTimerBanner: (options: TimerOptions) => void;
  pauseTimerBanner: () => void;
  resumeTimerBanner: () => void;
  clearTimerBanner: () => void;
}

type ToastState = ToastOptions & { id: string };
type TimerState = Required<Pick<TimerOptions, "id" | "title" | "seconds">> & {
  subtitle?: string;
  completeTitle?: string;
  completeMessage?: string;
  running: boolean;
  endsAtUtc?: number | null;
};

const MODE_KEY = "feedback_mode";
const TOAST_DURATION_KEY = "feedback_toast_duration";
const TIMER_BANNER_KEY = "feedback_timer_banner_enabled";
const TIMER_STATE_KEY = "feedback_active_timer";
const DEFAULT_TOAST_DURATION = 3200;
const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(Math.max(0, totalSeconds) % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function iconForVariant(variant: FeedbackVariant) {
  if (variant === "success") return "checkmark-circle-outline";
  if (variant === "warning") return "alert-circle-outline";
  if (variant === "error") return "close-circle-outline";
  return "information-circle-outline";
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [feedbackMode, setFeedbackModeState] = useState<FeedbackMode>("full");
  const [toastDurationMs, setToastDurationMsState] = useState(DEFAULT_TOAST_DURATION);
  const [timerBannerEnabled, setTimerBannerEnabledState] = useState(true);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    SecureStore.getItemAsync(MODE_KEY).then((stored) => {
      if (stored === "full" || stored === "haptic" || stored === "silent") {
        setFeedbackModeState(stored);
      }
    });
    SecureStore.getItemAsync(TOAST_DURATION_KEY).then((stored) => {
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed >= 1800 && parsed <= 7000) {
        setToastDurationMsState(parsed);
      }
    });
    SecureStore.getItemAsync(TIMER_BANNER_KEY).then((stored) => {
      if (stored === "0") setTimerBannerEnabledState(false);
      if (stored === "1") setTimerBannerEnabledState(true);
    });
    SecureStore.getItemAsync(TIMER_STATE_KEY).then((stored) => {
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as TimerState;
        const remaining = parsed.running && parsed.endsAtUtc
          ? Math.max(0, Math.ceil((parsed.endsAtUtc - Date.now()) / 1000))
          : Math.max(0, parsed.seconds);
        if (remaining > 0) {
          setTimer({ ...parsed, seconds: remaining });
        } else {
          void SecureStore.deleteItemAsync(TIMER_STATE_KEY);
        }
      } catch {
        void SecureStore.deleteItemAsync(TIMER_STATE_KEY);
      }
    });
  }, []);

  useEffect(() => () => {
    toastTimers.current.forEach((timeout) => clearTimeout(timeout));
    toastTimers.current.clear();
  }, []);

  const playFeedback = useCallback((variant: FeedbackVariant | "light" | "timer") => {
    if (feedbackMode === "silent") return;
    const run = async () => {
      if (variant === "success") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (variant === "warning" || variant === "timer") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      else if (variant === "error") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };
    void run().catch(() => undefined);
  }, [feedbackMode]);

  const removeToast = useCallback((id: string) => {
    const timeout = toastTimers.current.get(id);
    if (timeout) clearTimeout(timeout);
    toastTimers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next = { ...options, id, variant: options.variant ?? "info" };
    setToasts((current) => [next, ...current].slice(0, 3));
    playFeedback(next.variant);
    const timeout = setTimeout(() => removeToast(id), options.durationMs ?? toastDurationMs);
    toastTimers.current.set(id, timeout);
  }, [playFeedback, removeToast, toastDurationMs]);

  const showUndoToast = useCallback((title: string, onUndo: () => void, message?: string) => {
    showToast({
      title,
      message,
      variant: "warning",
      durationMs: 5200,
      action: { label: "Geri al", icon: "return-up-back-outline", onPress: onUndo, tone: "warning" },
    });
  }, [showToast]);

  const showDialog = useCallback((options: DialogOptions) => {
    setDialog(options);
    playFeedback(options.variant ?? "info");
  }, [playFeedback]);

  const hideDialog = useCallback(() => setDialog(null), []);

  const setFeedbackMode = useCallback(async (mode: FeedbackMode) => {
    setFeedbackModeState(mode);
    await SecureStore.setItemAsync(MODE_KEY, mode);
  }, []);

  const setToastDurationMs = useCallback(async (durationMs: number) => {
    const safeDuration = Math.max(1800, Math.min(7000, Math.round(durationMs)));
    setToastDurationMsState(safeDuration);
    await SecureStore.setItemAsync(TOAST_DURATION_KEY, String(safeDuration));
  }, []);

  const setTimerBannerEnabled = useCallback(async (enabled: boolean) => {
    setTimerBannerEnabledState(enabled);
    await SecureStore.setItemAsync(TIMER_BANNER_KEY, enabled ? "1" : "0");
    if (!enabled) {
      setTimer(null);
      await SecureStore.deleteItemAsync(TIMER_STATE_KEY);
    }
  }, []);

  const startTimerBanner = useCallback((options: TimerOptions) => {
    if (!timerBannerEnabled) {
      playFeedback("light");
      return;
    }

    const seconds = Math.max(0, Math.round(options.seconds));
    const nextTimer: TimerState = {
      id: options.id ?? "cooking",
      title: options.title,
      subtitle: options.subtitle,
      seconds,
      completeTitle: options.completeTitle,
      completeMessage: options.completeMessage,
      running: true,
      endsAtUtc: Date.now() + seconds * 1000,
    };
    setTimer(nextTimer);
    void SecureStore.setItemAsync(TIMER_STATE_KEY, JSON.stringify(nextTimer)).catch(() => undefined);
    playFeedback("light");
  }, [playFeedback, timerBannerEnabled]);

  const pauseTimerBanner = useCallback(() => setTimer((current) => {
    if (!current) return current;
    const paused = { ...current, running: false, endsAtUtc: null };
    void SecureStore.setItemAsync(TIMER_STATE_KEY, JSON.stringify(paused)).catch(() => undefined);
    return paused;
  }), []);
  const resumeTimerBanner = useCallback(() => setTimer((current) => {
    if (!current || current.seconds <= 0) return current;
    const resumed = { ...current, running: true, endsAtUtc: Date.now() + current.seconds * 1000 };
    void SecureStore.setItemAsync(TIMER_STATE_KEY, JSON.stringify(resumed)).catch(() => undefined);
    return resumed;
  }), []);
  const clearTimerBanner = useCallback(() => {
    setTimer(null);
    void SecureStore.deleteItemAsync(TIMER_STATE_KEY).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!timer?.running || timer.seconds <= 0) return;
    const interval = setInterval(() => {
      setTimer((current) => {
        if (!current?.running) return current;
        if (current.seconds <= 1) {
          playFeedback("timer");
          showToast({
            title: current.completeTitle ?? "Zamanlayıcı bitti",
            message: current.completeMessage ?? current.title,
            variant: "success",
            durationMs: 4200,
          });
          void SecureStore.deleteItemAsync(TIMER_STATE_KEY).catch(() => undefined);
          return null;
        }
        return { ...current, seconds: current.seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [playFeedback, showToast, timer?.running, timer?.seconds]);

  const value = useMemo<FeedbackContextValue>(() => ({
    feedbackMode,
    toastDurationMs,
    timerBannerEnabled,
    setFeedbackMode,
    setToastDurationMs,
    setTimerBannerEnabled,
    showToast,
    showUndoToast,
    showDialog,
    hideDialog,
    playFeedback,
    startTimerBanner,
    pauseTimerBanner,
    resumeTimerBanner,
    clearTimerBanner,
  }), [clearTimerBanner, feedbackMode, hideDialog, pauseTimerBanner, playFeedback, resumeTimerBanner, setFeedbackMode, setTimerBannerEnabled, setToastDurationMs, showDialog, showToast, showUndoToast, startTimerBanner, timerBannerEnabled, toastDurationMs]);

  const activeDialog = dialog;

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View pointerEvents="box-none" style={[s.toastStack, { paddingTop: insets.top + 10 }]}>
          {timer && (
            <Animated.View
              layout={LinearTransition.springify().damping(18)}
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(180)}
              style={[s.timerBanner, { backgroundColor: theme.surface, borderColor: theme.borderEmerald, shadowColor: theme.shadowEmerald }]}
            >
              <View style={[s.timerIcon, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name="timer-outline" size={18} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.timerTitle, { color: theme.text }]} numberOfLines={1}>{timer.title}</Text>
                {!!timer.subtitle && <Text style={[s.timerSub, { color: theme.textMuted }]} numberOfLines={1}>{timer.subtitle}</Text>}
              </View>
              <Text style={[s.timerValue, { color: theme.primary }]}>{formatDuration(timer.seconds)}</Text>
              <TouchableOpacity
                style={[s.timerAction, { backgroundColor: theme.primaryLight }]}
                onPress={timer.running ? pauseTimerBanner : resumeTimerBanner}
                activeOpacity={0.84}
              >
                <Ionicons name={timer.running ? "pause" : "play"} size={14} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.timerClose} onPress={clearTimerBanner} activeOpacity={0.84}>
                <Ionicons name="close" size={14} color={theme.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {toasts.map((toast) => {
            const variant = toast.variant ?? "info";
            const accent = variant === "success" ? theme.success : variant === "warning" ? theme.warning : variant === "error" ? theme.error : theme.primary;
            return (
              <Animated.View
                key={toast.id}
                layout={LinearTransition.springify().damping(18)}
                entering={FadeInDown.duration(240)}
                exiting={FadeOutUp.duration(180)}
                style={[s.toast, { backgroundColor: theme.surface, borderColor: `${accent}32`, shadowColor: isDark ? "#000" : theme.shadowCard }]}
              >
                <View style={[s.toastIcon, { backgroundColor: `${accent}18` }]}>
                  <Ionicons name={iconForVariant(variant)} size={19} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.toastTitle, { color: theme.text }]}>{toast.title}</Text>
                  {!!toast.message && <Text style={[s.toastMessage, { color: theme.textSub }]} numberOfLines={2}>{toast.message}</Text>}
                </View>
                {!!toast.action && (
                  <TouchableOpacity
                    style={[s.toastAction, { backgroundColor: `${accent}16` }]}
                    onPress={() => {
                      removeToast(toast.id);
                      toast.action?.onPress?.();
                    }}
                    activeOpacity={0.84}
                  >
                    <Text style={[s.toastActionTxt, { color: accent }]}>{toast.action.label}</Text>
                  </TouchableOpacity>
                )}
                <Pressable style={s.toastDismiss} onPress={() => removeToast(toast.id)}>
                  <Ionicons name="close" size={13} color={theme.textMuted} />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>

      <AppDialog
        visible={!!activeDialog}
        variant={activeDialog?.variant ?? "info"}
        icon={activeDialog?.icon}
        eyebrow={activeDialog?.eyebrow}
        title={activeDialog?.title ?? ""}
        message={activeDialog?.message}
        onDismiss={hideDialog}
        suggestions={activeDialog?.suggestions?.map((action) => ({
          ...action,
          onPress: () => {
            hideDialog();
            action.onPress?.();
          },
        }))}
        secondaryAction={activeDialog?.secondaryAction ? {
          ...activeDialog.secondaryAction,
          onPress: () => {
            hideDialog();
            activeDialog.secondaryAction?.onPress?.();
          },
        } : undefined}
        primaryAction={{
          label: activeDialog?.primaryAction?.label ?? "Tamam",
          tone: activeDialog?.primaryAction?.tone,
          icon: activeDialog?.primaryAction?.icon,
          onPress: () => {
            hideDialog();
            activeDialog?.primaryAction?.onPress?.();
          },
        }}
      />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback must be used within FeedbackProvider");
  return context;
}

const s = StyleSheet.create({
  toastStack: {
    position: "absolute",
    left: spacing.base,
    right: spacing.base,
    gap: 9,
  },
  toast: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 9,
  },
  toastIcon: {
    width: 38,
    height: 38,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  toastTitle: { fontSize: 13.5, fontWeight: "900", letterSpacing: -0.1 },
  toastMessage: { fontSize: 12, lineHeight: 16, fontWeight: "700", marginTop: 2 },
  toastAction: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  toastActionTxt: { fontSize: 11.5, fontWeight: "900" },
  toastDismiss: { width: 24, height: 34, alignItems: "center", justifyContent: "center" },
  timerBanner: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  timerIcon: { width: 36, height: 36, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  timerTitle: { fontSize: 13, fontWeight: "900" },
  timerSub: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  timerValue: { fontSize: 18, fontWeight: "900", minWidth: 54, textAlign: "right" },
  timerAction: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  timerClose: { width: 28, height: 32, alignItems: "center", justifyContent: "center" },
});
