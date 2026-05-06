import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DytopiaWatermark from "../components/decor/DytopiaWatermark";
import ProduceBubble from "../components/decor/ProduceBubble";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { useFeedback } from "../context/FeedbackContext";
import { radii, spacing } from "../theme/tokens";

export interface CookingIngredient {
  id: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  displayAmount?: string | null;
  role?: "mandatory" | "optional" | "flavoring" | "missing";
}

export interface CookingModePayload {
  recipeId?: string;
  name: string;
  description?: string | null;
  steps: string[];
  ingredients: CookingIngredient[];
  missingIngredients?: CookingIngredient[];
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  baseServings?: number | null;
  source?: "plan" | "kitchen" | "favorite" | "recipe";
}

type CookingRoute = RouteProp<{ params: { recipe: CookingModePayload } }, "params">;
const DEFAULT_STEPS = [
  "Malzemeleri hazırlayın ve tezgâhta kolay ulaşılacak şekilde ayırın.",
  "Tarif notlarını kontrol edin, damak tadınıza göre küçük ayarlamaları yapın.",
  "Pişirme tamamlandığında porsiyonu servis edin ve kısa bir not bırakın.",
];

function parseStepSeconds(step: string): number {
  const normalized = step.toLowerCase();
  const minuteMatch = normalized.match(/(\d+)\s*(dakika|dk|minute|min)\b/);
  if (minuteMatch) return Math.max(30, Number(minuteMatch[1]) * 60);
  const secondMatch = normalized.match(/(\d+)\s*(saniye|sn|second|sec)\b/);
  if (secondMatch) return Math.max(10, Number(secondMatch[1]));
  return 0;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function scaleAmount(item: CookingIngredient, multiplier: number): string {
  if (typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0) {
    const scaled = item.quantity * multiplier;
    const rounded = scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
    return `${rounded}${item.unit ? ` ${item.unit}` : ""}`;
  }

  return item.displayAmount || "";
}

function noteKey(recipeId?: string, name?: string) {
  return `cooking_notes:${recipeId || name || "recipe"}`;
}

export default function CookingModeScreen() {
  const navigation = useNavigation();
  const route = useRoute<CookingRoute>();
  const { recipe } = route.params;
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { showDialog, startTimerBanner, pauseTimerBanner, clearTimerBanner } = useFeedback();
  const insets = useSafeAreaInsets();

  const steps = recipe.steps?.length ? recipe.steps : DEFAULT_STEPS;
  const baseServings = recipe.baseServings && recipe.baseServings > 0 ? recipe.baseServings : 2;
  const [servings, setServings] = useState(baseServings);
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [timerSeconds, setTimerSeconds] = useState(() => parseStepSeconds(steps[0]));
  const [timerRunning, setTimerRunning] = useState(false);
  const [note, setNote] = useState("");
  const [cinemaMode, setCinemaMode] = useState(false);
  const pulse = useRef(new RNAnimated.Value(0)).current;

  const copy = language === "en"
    ? {
        title: "Cooking Mode",
        close: "Close",
        portion: "servings",
        ingredients: "Ingredients",
        missing: "Missing",
        currentStep: "Current step",
        step: "Step",
        timer: "Timer",
        start: "Start",
        pause: "Pause",
        reset: "Reset",
        complete: "Done",
        previous: "Previous",
        next: "Next",
        finish: "Finish cooking",
        noteTitle: "Favorite note",
        notePlaceholder: "What would you change next time?",
        saved: "Cooking note saved.",
        finished: "Great work — recipe completed.",
        noTimer: "No timer detected",
      }
    : {
        title: "Pişirme Modu",
        close: "Kapat",
        portion: "porsiyon",
        ingredients: "Malzemeler",
        missing: "Eksik",
        currentStep: "Aktif adım",
        step: "Adım",
        timer: "Zamanlayıcı",
        start: "Başlat",
        pause: "Duraklat",
        reset: "Sıfırla",
        complete: "Tamam",
        previous: "Geri",
        next: "Sonraki",
        finish: "Pişirmeyi bitir",
        noteTitle: "Favori notun",
        notePlaceholder: "Bir dahaki sefere neyi değiştirmek istersin?",
        saved: "Pişirme notu kaydedildi.",
        finished: "Harika — tarif tamamlandı.",
        noTimer: "Bu adımda süre bulunamadı",
      };

  const multiplier = servings / baseServings;
  const progress = (completedSteps.size / steps.length) * 100;
  const currentDetectedSeconds = useMemo(() => parseStepSeconds(steps[activeStep]), [activeStep, steps]);
  const hasStepTimer = currentDetectedSeconds > 0;
  const stepProgress = ((activeStep + 1) / steps.length) * 100;
  const memoryHint = note.trim().length > 0
    ? note.trim().split(/[.!?\n]/).map((part) => part.trim()).filter(Boolean)[0]
    : "";

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(noteKey(recipe.recipeId, recipe.name)).then((stored) => {
      if (alive && stored) setNote(stored);
    });
    return () => { alive = false; };
  }, [recipe.recipeId, recipe.name]);

  useEffect(() => {
    const nextSeconds = parseStepSeconds(steps[activeStep]);
    setTimerSeconds(nextSeconds);
    setTimerRunning(false);
    clearTimerBanner();
  }, [activeStep, clearTimerBanner, steps]);

  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    const timer = setInterval(() => {
      setTimerSeconds((current) => {
        if (current <= 1) {
          setTimerRunning(false);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          clearTimerBanner();
          showDialog({
            variant: "success",
            icon: "timer-outline",
            eyebrow: language === "tr" ? "Zamanlayıcı" : "Timer",
            title: copy.timer,
            message: language === "tr" ? "Süre doldu, sıradaki adıma geçebilirsin." : "Time is up. You can move to the next step.",
            primaryAction: { label: language === "tr" ? "Tamam" : "OK" },
          });
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [clearTimerBanner, copy.timer, language, showDialog, timerRunning, timerSeconds]);

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 1, duration: 1300, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  async function saveNote(nextNote = note) {
    await SecureStore.setItemAsync(noteKey(recipe.recipeId, recipe.name), nextNote);
  }

  function markStepDone() {
    setCompletedSteps((current) => {
      const next = new Set(current);
      next.add(activeStep);
      return next;
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (activeStep < steps.length - 1) {
      setActiveStep((current) => current + 1);
    }
  }

  function goPreviousStep() {
    setTimerRunning(false);
    clearTimerBanner();
    setActiveStep((value) => Math.max(0, value - 1));
  }

  function finishCooking() {
    void saveNote().catch(() => undefined);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    clearTimerBanner();
    showDialog({
      variant: "success",
      icon: "sparkles-outline",
      eyebrow: language === "tr" ? "Afiyet olsun" : "Bon appétit",
      title: copy.finished,
      message: copy.saved,
      primaryAction: {
        label: language === "tr" ? "Tarife dön" : "Back to recipe",
        onPress: () => (navigation as any).goBack(),
      },
    });
  }

  function toggleStepTimer() {
    if (!hasStepTimer) return;
    if (timerRunning) {
      setTimerRunning(false);
      pauseTimerBanner();
      return;
    }

    const nextSeconds = timerSeconds > 0 ? timerSeconds : currentDetectedSeconds;
    setTimerSeconds(nextSeconds);
    setTimerRunning(true);
    startTimerBanner({
      id: `cooking-${recipe.recipeId ?? recipe.name}`,
      title: recipe.name,
      subtitle: `${copy.step} ${activeStep + 1}/${steps.length}`,
      seconds: nextSeconds,
      completeTitle: copy.timer,
      completeMessage: language === "tr" ? "Süre doldu, sıradaki adıma geçebilirsin." : "Time is up. You can move to the next step.",
    });
  }

  function resetStepTimer() {
    setTimerRunning(false);
    setTimerSeconds(currentDetectedSeconds);
    clearTimerBanner();
  }

  const pulseStyle = {
    transform: [
      {
        scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
      },
    ],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.18] }),
  };
  if (cinemaMode) {
    return (
      <View style={[s.cinemaRoot, { backgroundColor: isDark ? "#07150D" : "#F4FCF6" }]}>
        <StatusBar hidden />
        <DytopiaWatermark position="center" size={380} opacity={isDark ? 0.05 : 0.08} />
        <ProduceBubble icon="leaf" iconSize={44} iconColor={`${theme.primary}44`} style={[s.cinemaGlowA, { backgroundColor: theme.primaryGlow }]} />
        <ProduceBubble icon="corn" iconSize={40} iconColor={`${theme.accentGold}44`} style={[s.cinemaGlowB, { backgroundColor: `${theme.accentGold}1F` }]} />

        <View style={[s.cinemaTop, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={[s.cinemaExit, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setCinemaMode(false)}
            activeOpacity={0.84}
          >
            <Ionicons name="contract-outline" size={18} color={theme.text} />
            <Text style={[s.cinemaExitTxt, { color: theme.text }]}>{language === "tr" ? "Çık" : "Exit"}</Text>
          </TouchableOpacity>
          <Text style={[s.cinemaRecipe, { color: theme.text }]} numberOfLines={1}>{recipe.name}</Text>
        </View>

        <View style={[s.cinemaProgressTrack, { backgroundColor: theme.surfaceElevated }]}>
          <View style={[s.cinemaProgressFill, { width: `${stepProgress}%`, backgroundColor: theme.primary }]} />
        </View>

        <Animated.View key={`cinema-${activeStep}`} entering={FadeIn.duration(240)} style={[s.cinemaCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <View style={s.cinemaStepMeta}>
            <View style={[s.cinemaNumber, { backgroundColor: theme.primary, shadowColor: theme.shadowEmerald }]}>
              <Text style={s.cinemaNumberTxt}>{activeStep + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cinemaOverline, { color: theme.primary }]}>{copy.currentStep}</Text>
              <Text style={[s.cinemaHint, { color: theme.textMuted }]}>
                {copy.step} {activeStep + 1}/{steps.length} · {language === "tr" ? "yalnızca adıma odaklan" : "focus only on this step"}
              </Text>
            </View>
          </View>

          <Text style={[s.cinemaStepText, { color: theme.text }]}>{steps[activeStep]}</Text>

          {hasStepTimer && (
            <View style={[s.cinemaTimer, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
              <View>
                <Text style={[s.timerLabel, { color: theme.textMuted }]}>{copy.timer}</Text>
                <Text style={[s.cinemaTimerValue, { color: theme.primary }]}>
                  {formatDuration(timerSeconds > 0 ? timerSeconds : currentDetectedSeconds)}
                </Text>
              </View>
              <TouchableOpacity
                style={[s.cinemaTimerBtn, { backgroundColor: theme.primary }]}
                onPress={toggleStepTimer}
              >
                <Ionicons name={timerRunning ? "pause" : "play"} size={18} color="#fff" />
                <Text style={s.timerBtnTxt}>{timerRunning ? copy.pause : copy.start}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        <View style={[s.cinemaFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[s.cinemaGhost, { borderColor: theme.border, backgroundColor: theme.surface }]}
            disabled={activeStep === 0}
            onPress={goPreviousStep}
            activeOpacity={0.84}
          >
            <Ionicons name="chevron-back" size={22} color={activeStep === 0 ? theme.textMuted : theme.text} />
          </TouchableOpacity>
          {activeStep === steps.length - 1 && completedSteps.has(activeStep) ? (
            <TouchableOpacity style={[s.cinemaPrimary, { backgroundColor: theme.accentGold }]} onPress={finishCooking} activeOpacity={0.88}>
              <Ionicons name="sparkles-outline" size={20} color="#fff" />
              <Text style={s.cinemaPrimaryTxt}>{copy.finish}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.cinemaPrimary, { backgroundColor: theme.primary }]} onPress={markStepDone} activeOpacity={0.88}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={s.cinemaPrimaryTxt}>{activeStep === steps.length - 1 ? copy.complete : copy.next}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <DytopiaWatermark position="center" size={340} opacity={0.04} />
      <ProduceBubble icon="food-apple-outline" iconSize={34} iconColor={`${theme.primary}4A`} style={[s.glowA, { backgroundColor: theme.primaryGlow }]} />
      <ProduceBubble icon="carrot" iconSize={32} iconColor={`${theme.accentGold}50`} style={[s.glowB, { backgroundColor: `${theme.accentGold}22` }]} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 18) + 126 },
        ]}
      >
        <View style={s.navRow}>
          <TouchableOpacity
            style={[s.closeBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => (navigation as any).goBack()}
            activeOpacity={0.82}
          >
            <Ionicons name="chevron-down" size={18} color={theme.text} />
            <Text style={[s.closeTxt, { color: theme.text }]}>{copy.close}</Text>
          </TouchableOpacity>
          <View style={[s.modePill, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
            <MaterialCommunityIcons name="chef-hat" size={16} color={theme.primary} />
            <Text style={[s.modePillTxt, { color: theme.primary }]}>{copy.title}</Text>
          </View>
        </View>

        <Animated.View entering={FadeIn.duration(260)} style={[s.hero, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <RNAnimated.View style={[s.heroPulse, { backgroundColor: theme.primary }, pulseStyle]} />
          <View style={s.heroIcon}>
            <MaterialCommunityIcons name="pot-steam-outline" size={34} color="#fff" />
          </View>
          <Text style={[s.title, { color: theme.text }]}>{recipe.name}</Text>
          {!!recipe.description && <Text style={[s.desc, { color: theme.textSub }]} numberOfLines={3}>{recipe.description}</Text>}

          <View style={s.heroStats}>
            <View style={[s.statCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
              <Text style={[s.statValue, { color: theme.primary }]}>{steps.length}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}>{language === "tr" ? "adım" : "steps"}</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
              <Text style={[s.statValue, { color: theme.accentGold }]}>{Math.round(progress)}%</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}>{language === "tr" ? "ilerleme" : "progress"}</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
              <Text style={[s.statValue, { color: theme.accentCoral }]}>{servings}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}>{copy.portion}</Text>
            </View>
          </View>

          <View style={[s.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
            <View style={[s.progressFill, { width: `${progress}%`, backgroundColor: theme.primary }]} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(280)} style={[s.servingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>{language === "tr" ? "Porsiyon ölçekleme" : "Serving scale"}</Text>
          <View style={s.servingControls}>
            <TouchableOpacity
              style={[s.roundBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={() => setServings((value) => Math.max(1, value - 1))}
            >
              <Ionicons name="remove" size={18} color={theme.text} />
            </TouchableOpacity>
            <View style={[s.servingBubble, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
              <Text style={[s.servingValue, { color: theme.primary }]}>{servings}</Text>
              <Text style={[s.servingLabel, { color: theme.textMuted }]}>{copy.portion}</Text>
            </View>
            <TouchableOpacity
              style={[s.roundBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={() => setServings((value) => Math.min(12, value + 1))}
            >
              <Ionicons name="add" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(280)} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={s.cardHead}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>{copy.ingredients}</Text>
            {!!recipe.missingIngredients?.length && (
              <View style={[s.missingPill, { backgroundColor: `${theme.warning}14`, borderColor: `${theme.warning}28` }]}>
                <Text style={[s.missingPillTxt, { color: theme.warning }]}>{recipe.missingIngredients.length} {copy.missing}</Text>
              </View>
            )}
          </View>
          {(recipe.ingredients.length ? recipe.ingredients : recipe.missingIngredients ?? []).slice(0, 18).map((item, index) => {
            const amount = scaleAmount(item, multiplier);
            const isMissing = item.role === "missing";
            return (
              <View key={`${item.id}-${index}`} style={[s.ingredientRow, { borderColor: theme.borderLight }]}>
                <View style={[s.ingredientDot, { backgroundColor: isMissing ? `${theme.warning}18` : theme.primaryLight }]}>
                  <Ionicons name={isMissing ? "alert-outline" : "leaf-outline"} size={13} color={isMissing ? theme.warning : theme.primary} />
                </View>
                <Text style={[s.ingredientName, { color: theme.text }]}>{item.name}</Text>
                {!!amount && <Text style={[s.amountTxt, { color: isMissing ? theme.warning : theme.textMuted }]}>{amount}</Text>}
              </View>
            );
          })}
        </Animated.View>

        <Animated.View key={activeStep} entering={SlideInRight.duration(260)} exiting={SlideOutLeft.duration(180)} style={[s.stepCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <View style={s.stepHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.overline, { color: theme.primary }]}>{copy.currentStep}</Text>
              <Text style={[s.stepTitle, { color: theme.text }]}>{copy.step} {activeStep + 1}/{steps.length}</Text>
            </View>
            <TouchableOpacity
              style={[s.cinemaBtn, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}
              onPress={() => setCinemaMode(true)}
              activeOpacity={0.84}
            >
              <Ionicons name="expand-outline" size={16} color={theme.primary} />
              <Text style={[s.cinemaBtnTxt, { color: theme.primary }]}>{language === "tr" ? "Sinema" : "Cinema"}</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.stepBody, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}>
            <View style={[s.stepNumber, { backgroundColor: theme.primary, shadowColor: theme.shadowEmerald }]}>
              <Text style={s.stepNumberTxt}>{activeStep + 1}</Text>
            </View>
            <Text style={[s.stepText, { color: theme.text }]}>{steps[activeStep]}</Text>
          </View>

          {hasStepTimer && (
            <View style={[s.timerBox, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.timerLabel, { color: theme.textMuted }]}>{copy.timer}</Text>
                <Text style={[s.timerValue, { color: theme.primary }]}>
                  {formatDuration(timerSeconds > 0 ? timerSeconds : currentDetectedSeconds)}
                </Text>
              </View>
              <View style={s.timerActions}>
                <TouchableOpacity
                  style={[s.timerBtn, { backgroundColor: theme.primary }]}
                  onPress={toggleStepTimer}
                >
                  <Ionicons name={timerRunning ? "pause" : "play"} size={14} color="#fff" />
                  <Text style={s.timerBtnTxt}>{timerRunning ? copy.pause : copy.start}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.timerReset, { borderColor: theme.border }]}
                  onPress={resetStepTimer}
                >
                  <Ionicons name="refresh" size={14} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(280)} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>{copy.noteTitle}</Text>
          {!!memoryHint && (
            <View style={[s.memoryPill, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
              <Ionicons name="bulb-outline" size={15} color={theme.primary} />
              <Text style={[s.memoryTxt, { color: theme.primary }]}>{language === "tr" ? `Tarif hafızası: ${memoryHint}` : `Recipe memory: ${memoryHint}`}</Text>
            </View>
          )}
          <TextInput
            value={note}
            onChangeText={(value) => {
              setNote(value);
              void saveNote(value).catch(() => undefined);
            }}
            placeholder={copy.notePlaceholder}
            placeholderTextColor={theme.textMuted}
            multiline
            style={[s.noteInput, { color: theme.text, backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }]}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(170).duration(280)} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>{language === "tr" ? "Sesli asistan kısayolları" : "Voice assist shortcuts"}</Text>
          <Text style={[s.voiceSub, { color: theme.textMuted }]}>
            {language === "tr" ? "Gerçek ses paketi eklenene kadar mutfakta tek dokunuşla komut ver." : "Until native voice is added, use one-tap kitchen commands."}
          </Text>
          <View style={s.voiceRow}>
            <TouchableOpacity style={[s.voiceBtn, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]} onPress={markStepDone} activeOpacity={0.84}>
              <Ionicons name="play-forward-outline" size={16} color={theme.primary} />
              <Text style={[s.voiceBtnTxt, { color: theme.primary }]}>{language === "tr" ? "Sonraki adım" : "Next step"}</Text>
            </TouchableOpacity>
            {hasStepTimer && (
              <TouchableOpacity style={[s.voiceBtn, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]} onPress={toggleStepTimer} activeOpacity={0.84}>
                <Ionicons name="timer-outline" size={16} color={theme.primary} />
                <Text style={[s.voiceBtnTxt, { color: theme.primary }]}>{timerRunning ? copy.pause : copy.start}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14), backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
        <TouchableOpacity
          style={[s.footerGhost, { borderColor: theme.border }]}
          disabled={activeStep === 0}
          onPress={goPreviousStep}
        >
          <Ionicons name="chevron-back" size={16} color={activeStep === 0 ? theme.textMuted : theme.text} />
          <Text style={[s.footerGhostTxt, { color: activeStep === 0 ? theme.textMuted : theme.text }]}>{copy.previous}</Text>
        </TouchableOpacity>
        {activeStep === steps.length - 1 && completedSteps.has(activeStep) ? (
          <TouchableOpacity style={[s.footerPrimary, { backgroundColor: theme.accentGold }]} onPress={finishCooking}>
            <Ionicons name="sparkles-outline" size={17} color="#fff" />
            <Text style={s.footerPrimaryTxt}>{copy.finish}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.footerPrimary, { backgroundColor: theme.primary }]} onPress={markStepDone}>
            <Ionicons name="checkmark-circle-outline" size={17} color="#fff" />
            <Text style={s.footerPrimaryTxt}>{activeStep === steps.length - 1 ? copy.complete : copy.next}</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.base },
  glowA: { position: "absolute", top: 70, right: -66, width: 220, height: 220, borderRadius: 110, opacity: 0.55 },
  glowB: { position: "absolute", top: 420, left: -74, width: 180, height: 180, borderRadius: 90, opacity: 0.42 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  closeBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 13, paddingVertical: 10 },
  closeTxt: { fontSize: 13, fontWeight: "800" },
  modePill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 13, paddingVertical: 9 },
  modePillTxt: { fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
  hero: { borderWidth: 1, borderRadius: 34, padding: 20, overflow: "hidden", marginBottom: spacing.md },
  heroPulse: { position: "absolute", width: 138, height: 138, borderRadius: 69, top: -28, right: -20 },
  heroIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: "#47B972", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -0.7, lineHeight: 32 },
  desc: { fontSize: 14, lineHeight: 20, fontWeight: "600", marginTop: 8 },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 18 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 12 },
  statValue: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 99, overflow: "hidden", marginTop: 16 },
  progressFill: { height: "100%", borderRadius: 99 },
  servingCard: { borderWidth: 1, borderRadius: 28, padding: 16, marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  servingControls: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18 },
  roundBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  servingBubble: { minWidth: 112, borderWidth: 1, borderRadius: 26, paddingVertical: 11, alignItems: "center" },
  servingValue: { fontSize: 26, fontWeight: "900", lineHeight: 28 },
  servingLabel: { fontSize: 11, fontWeight: "800", marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 28, padding: 16, marginBottom: spacing.md },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  missingPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  missingPillTxt: { fontSize: 11, fontWeight: "900" },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  ingredientDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ingredientName: { flex: 1, fontSize: 14, fontWeight: "800" },
  amountTxt: { fontSize: 12, fontWeight: "900" },
  stepCard: { borderWidth: 1, borderRadius: 32, padding: 16, marginBottom: spacing.md },
  stepHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  overline: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  cinemaBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6 },
  cinemaBtnTxt: { fontSize: 11, fontWeight: "900" },
  stepBody: { borderWidth: 1, borderRadius: 26, padding: 14, gap: 13 },
  stepNumber: { width: 46, height: 46, borderRadius: 17, alignItems: "center", justifyContent: "center", elevation: 5, shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  stepNumberTxt: { color: "#fff", fontSize: 21, fontWeight: "900" },
  stepTitle: { fontSize: 15, fontWeight: "900" },
  stepText: { fontSize: 17, lineHeight: 25, fontWeight: "800", letterSpacing: -0.15 },
  timerBox: { marginTop: 12, borderWidth: 1, borderRadius: 24, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  timerLabel: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 },
  timerValue: { fontSize: 24, fontWeight: "900", marginTop: 2 },
  timerActions: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  timerBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10 },
  timerBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "900" },
  timerReset: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  memoryPill: { marginTop: 10, borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 7 },
  memoryTxt: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "800" },
  noteInput: { minHeight: 92, borderWidth: 1, borderRadius: 20, marginTop: 12, padding: 14, fontSize: 14, fontWeight: "600", textAlignVertical: "top" },
  voiceSub: { marginTop: 3, marginBottom: 12, fontSize: 12.5, lineHeight: 18, fontWeight: "700" },
  voiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  voiceBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  voiceBtnTxt: { fontSize: 12.5, fontWeight: "900" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 16, flexDirection: "row", gap: 10 },
  footerGhost: { minWidth: 112, borderWidth: 1, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  footerGhostTxt: { fontSize: 13, fontWeight: "900" },
  footerPrimary: { flex: 1, borderRadius: 999, paddingVertical: 15, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  footerPrimaryTxt: { color: "#fff", fontSize: 14, fontWeight: "900" },
  cinemaRoot: { flex: 1, paddingHorizontal: spacing.base, overflow: "hidden" },
  cinemaGlowA: { position: "absolute", top: 100, right: -74, width: 230, height: 230, borderRadius: 115, opacity: 0.48 },
  cinemaGlowB: { position: "absolute", bottom: 120, left: -84, width: 210, height: 210, borderRadius: 105, opacity: 0.42 },
  cinemaTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  cinemaExit: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  cinemaExitTxt: { fontSize: 12, fontWeight: "900" },
  cinemaRecipe: { flex: 1, fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  cinemaProgressTrack: { height: 8, borderRadius: 999, overflow: "hidden", marginBottom: 18 },
  cinemaProgressFill: { height: "100%", borderRadius: 999 },
  cinemaCard: { flex: 1, borderWidth: 1, borderRadius: 38, padding: 22, justifyContent: "center", shadowOpacity: 0.12, shadowRadius: 28, shadowOffset: { width: 0, height: 16 }, elevation: 8 },
  cinemaStepMeta: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  cinemaNumber: { width: 62, height: 62, borderRadius: 23, alignItems: "center", justifyContent: "center", shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  cinemaNumberTxt: { color: "#fff", fontSize: 27, fontWeight: "900" },
  cinemaOverline: { fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 4 },
  cinemaHint: { fontSize: 12, fontWeight: "800" },
  cinemaStepText: { fontSize: 27, lineHeight: 38, fontWeight: "900", letterSpacing: -0.7 },
  cinemaTimer: { marginTop: 24, borderWidth: 1, borderRadius: 28, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  cinemaTimerValue: { fontSize: 34, fontWeight: "900", marginTop: 2 },
  cinemaTimerBtn: { borderRadius: 999, paddingHorizontal: 17, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 8 },
  cinemaFooter: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16 },
  cinemaGhost: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cinemaPrimary: { flex: 1, minHeight: 58, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 18 },
  cinemaPrimaryTxt: { color: "#fff", fontSize: 16, fontWeight: "900" },
});
