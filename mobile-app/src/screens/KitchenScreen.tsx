import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Keyboard,
  Alert,
  Image,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInRight,
  Layout,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { spacing, radii, type Theme } from '../theme/tokens';
import {
  dur,
  spring,
  useFadeRise,
  useFloating,
  useIdleOrbit,
  usePulseRing,
  useReactorIdle,
  useReactorMerge,
  useScaleSettle,
  useShimmerBand,
  useSoftOrbit,
  useSweepScan,
} from '../hooks/useAuraMotion';
import IngredientSearch from '../components/IngredientSearch';
import DytopiaWatermark from '../components/decor/DytopiaWatermark';
import DytopiaLogoBubble from '../components/decor/DytopiaLogoBubble';
import KitchenStreakRail from '../components/gamification/KitchenStreakRail';
import RecipeSearchStage from '../components/kitchen/RecipeSearchStage';
import { Routes } from '../navigation/routes';
import { getRecentPantryIngredients } from '../api/kitchen';
import type { Ingredient } from '../types/alternative';
import { useTranslation } from '../context/I18nContext';
import { useGamification } from '../queries/useGamification';
import { useCustomPacks, type CustomPack } from '../hooks/useCustomPacks';
import { useShakeDetector } from '../hooks/useShakeDetector';
import * as Haptics from 'expo-haptics';
import CreatePackSheet from '../components/CreatePackSheet';

const CHIP_COLLAPSE_AT = 8;
const BOTTOM_NAV_CLEARANCE = Platform.OS === 'ios' ? 112 : 96;
const BRAND_LOGO = require('../../assets/dytopia-logo.png');

const MERGE_TEXTS = {
  tr: ['Malzemeler tencerede', 'Aromalar yükseliyor', 'Tarif servis ediliyor'],
  en: ['Ingredients in the pot', 'Flavors are rising', 'Recipe is plating'],
} as const;

function shortIngredientLabel(name: string) {
  const compact = name.trim();
  if (compact.length <= 8) return compact;
  return `${compact.slice(0, 5)}...`;
}

// ─── Ghost Orbit Chip — always visible decorative food orbs ──────────────────
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const GHOST_ITEMS: { icon: MCIName; radius: number; startDeg: number; speed: number }[] = [
  { icon: 'food-apple-outline', radius: 108, startDeg: 18,  speed: 9200  },
  { icon: 'carrot',             radius: 90,  startDeg: 138, speed: 11800 },
  { icon: 'corn',               radius: 100, startDeg: 258, speed: 8100  },
];

function GhostOrbitChip({
  icon,
  radius,
  startDeg,
  speed,
  hasIngredients,
  theme,
}: {
  icon: MCIName;
  radius: number;
  startDeg: number;
  speed: number;
  hasIngredients: boolean;
  theme: Theme;
}) {
  const rotation = useSharedValue(startDeg);
  const opacity  = useSharedValue(0);

  // Kick off continuous orbit once
  useEffect(() => {
    opacity.value = withDelay(180, withTiming(hasIngredients ? 0.22 : 0.60, { duration: dur.medium }));
    rotation.value = withRepeat(
      withTiming(startDeg + 360, { duration: speed, easing: Easing.linear }),
      -1, false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dim when user has real ingredients, restore when they clear
  useEffect(() => {
    opacity.value = withTiming(hasIngredients ? 0.20 : 0.60, { duration: dur.medium });
  }, [hasIngredients]);

  const orbitStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }, { translateY: -radius }],
  }));

  const counterStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[s.ghostAnchor, orbitStyle]}>
      <Animated.View
        style={[
          s.ghostChip,
          {
            backgroundColor: `${theme.surface}E0`,
            borderColor:     `${theme.borderEmerald}60`,
            shadowColor:     theme.primary,
          },
          counterStyle,
        ]}
      >
        {/* Inner glow dot */}
        <View style={[s.ghostDot, { backgroundColor: `${theme.primary}40` }]} />
        <MaterialCommunityIcons name={icon} size={15} color={`${theme.primary}CC`} />
      </Animated.View>
    </Animated.View>
  );
}

const CHIP_ACCENTS = ['primary', 'emerald', 'accentCyan', 'accentGold'] as const;

function OrbitingIngredientChip({
  active,
  ingredient,
  radius,
  startDeg,
  delay,
  theme,
  index,
}: {
  active: boolean;
  ingredient: Ingredient;
  radius: number;
  startDeg: number;
  delay: number;
  theme: Theme;
  index: number;
}) {
  const rotation = useSharedValue(startDeg);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(rotation);
      rotation.value = startDeg;
      opacity.value = withTiming(0, { duration: dur.fast });
      return;
    }

    opacity.value = withDelay(delay, withTiming(1, { duration: dur.base }));
    rotation.value = withDelay(
      delay,
      withRepeat(
        withTiming(startDeg + 360, {
          duration: 7600,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );
  }, [active, delay, opacity, radius, rotation, startDeg]);

  const orbitStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }, { translateY: -radius }],
  }));

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-rotation.value}deg` }],
  }));

  const accentKey = CHIP_ACCENTS[index % CHIP_ACCENTS.length];
  const accent = theme[accentKey] as string;
  const initial = ingredient.canonicalName.charAt(0).toUpperCase();

  return (
    <Animated.View style={[po.orbitAnchor, orbitStyle]}>
      <Animated.View
        style={[
          po.overlayIngredientChip,
          {
            backgroundColor: `${theme.surface}F4`,
            borderColor: `${accent}44`,
            shadowColor: accent,
          },
          chipStyle,
        ]}
      >
        <View style={[po.chipAvatar, { backgroundColor: `${accent}20`, borderColor: `${accent}55` }]}>
          <Text style={[po.chipAvatarText, { color: accent }]}>{initial}</Text>
        </View>
        <Text style={[po.overlayIngredientText, { color: theme.text }]} numberOfLines={1}>
          {shortIngredientLabel(ingredient.canonicalName)}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

function ReactorSearchOverlay({
  active,
  mergePhase,
  selectedIngredients,
  theme,
  language,
}: {
  active: boolean;
  mergePhase: number;
  selectedIngredients: Ingredient[];
  theme: Theme;
  language: 'tr' | 'en';
}) {
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      overlayOpacity.value = withTiming(0, { duration: dur.fast });
      return;
    }

    overlayOpacity.value = withTiming(1, { duration: 220 });
  }, [active, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  if (!active) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, po.overlay, overlayStyle]}>
      <View style={[po.overlayVeil, { backgroundColor: `${theme.bg}8F` }]} />
      <RecipeSearchStage
        theme={theme}
        ingredientNames={selectedIngredients.map((ingredient) => ingredient.canonicalName)}
        language={language}
        phase={mergePhase}
      />
    </Animated.View>
  );
}

const POT_DROP_LANES = [-82, -40, 0, 40, 82] as const;
const POT_ACCENT_KEYS = ['primary', 'emerald', 'accentCyan', 'accentGold'] as const;

type KitchenPotComposerCopy = {
  reactorTitle: string;
  reactorReady: string;
  reactorWaiting: string;
  reactorHintReady: string;
  reactorHintIdle: string;
  reactorAction: string;
  reactorActionSub: string;
  reactorActionClosing: string;
  reactorActionClosingSub: string;
  reactorModeReady: string;
  reactorModeIdle: string;
  reactorLocked: string;
  reactorWaitingLabel: string;
  reactorFooterHint: string;
};

type PotDropCue = {
  key: string;
  label: string;
  lane: number;
  accent: string;
  spin: number;
};

function PotIngredientDropCue({
  cue,
  theme,
}: {
  cue: PotDropCue;
  theme: Theme;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1180, easing: Easing.inOut(Easing.quad) });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = progress.value < 0.82
      ? 0.96
      : Math.max(0, 1 - (progress.value - 0.82) / 0.18);
    const approach = Math.min(progress.value / 0.76, 1);

    return {
      opacity,
      transform: [
        { translateX: cue.lane * (1 - approach) },
        { translateY: progress.value * 154 },
        { scale: 1 - progress.value * 0.22 },
        { rotate: `${cue.spin * (1 - progress.value)}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.potDropCue,
        {
          backgroundColor: `${theme.surface}F3`,
          borderColor: `${cue.accent}42`,
          shadowColor: cue.accent,
        },
        animatedStyle,
      ]}
    >
      <View style={[s.potDropCueDot, { backgroundColor: cue.accent }]} />
      <Text style={[s.potDropCueText, { color: theme.text }]} numberOfLines={1}>
        {shortIngredientLabel(cue.label)}
      </Text>
    </Animated.View>
  );
}

function KitchenPotComposer({
  theme,
  selectedIngredients,
  hasIngredients,
  transitioning,
  copy,
  onPress,
}: {
  theme: Theme;
  selectedIngredients: Ingredient[];
  hasIngredients: boolean;
  transitioning: boolean;
  copy: KitchenPotComposerCopy;
  onPress: () => void;
}) {
  const [dropCues, setDropCues] = useState<PotDropCue[]>([]);
  const prevIdsRef = React.useRef<string[]>(selectedIngredients.map((ingredient) => ingredient.id));
  const dropIndexRef = React.useRef(0);
  const dropTimeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const lidOpen = useSharedValue(hasIngredients ? 0.24 : 0);
  const brothLevel = useSharedValue(hasIngredients ? 0.28 : 0);
  const steamOpacity = useSharedValue(hasIngredients ? 1 : 0);
  const ctaScale = useSharedValue(1);
  const brothWave = useSharedValue(0);
  const burnerGlow = useSharedValue(0);
  const flamePulse = useSharedValue(0);
  const flameFlicker = useSharedValue(0);
  const ctaGlowStyle = usePulseRing(hasIngredients && !transitioning, 1.03, 2400);

  useEffect(() => {
    brothWave.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [brothWave]);

  useEffect(() => {
    lidOpen.value = withSpring(
      transitioning ? 0 : hasIngredients ? Math.min(0.28 + selectedIngredients.length * 0.08, 0.96) : 0,
      spring.gentle,
    );
    brothLevel.value = withSpring(
      transitioning
        ? Math.min(0.22 + selectedIngredients.length * 0.06, 0.5)
        : hasIngredients
          ? Math.min(0.26 + selectedIngredients.length * 0.09, 0.78)
          : 0,
      spring.gentle,
    );
    steamOpacity.value = withTiming(transitioning ? 0 : hasIngredients ? 1 : 0, { duration: 320 });
  }, [brothLevel, hasIngredients, lidOpen, selectedIngredients.length, steamOpacity, transitioning]);

  useEffect(() => {
    cancelAnimation(flamePulse);
    cancelAnimation(flameFlicker);

    if (transitioning) {
      burnerGlow.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      flamePulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(0.76, { duration: 360, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      flameFlicker.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 170, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 210, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      return;
    }

    burnerGlow.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) });
    flamePulse.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
    flameFlicker.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [burnerGlow, flameFlicker, flamePulse, transitioning]);

  useEffect(() => {
    const previous = prevIdsRef.current;
    const additions = selectedIngredients.filter(
      (ingredient) => !previous.includes(ingredient.id),
    );

    if (additions.length > 0) {
      const nextCues = additions.map((ingredient, index) => {
        const laneIndex = (dropIndexRef.current + index) % POT_DROP_LANES.length;
        const accentKey = POT_ACCENT_KEYS[(dropIndexRef.current + index) % POT_ACCENT_KEYS.length];
        dropIndexRef.current += 1;

        return {
          key: `${ingredient.id}-${Date.now()}-${index}`,
          label: ingredient.canonicalName,
          lane: POT_DROP_LANES[laneIndex],
          accent: theme[accentKey],
          spin: laneIndex % 2 === 0 ? -8 : 8,
        };
      });

      setDropCues((current) => [...current, ...nextCues].slice(-6));

      nextCues.forEach((cue) => {
        const timeout = setTimeout(() => {
          setDropCues((current) => current.filter((item) => item.key !== cue.key));
        }, 1280);

        dropTimeoutsRef.current.push(timeout);
      });
    }

    prevIdsRef.current = selectedIngredients.map((ingredient) => ingredient.id);
  }, [selectedIngredients, theme]);

  useEffect(() => {
    return () => {
      dropTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    if (transitioning) {
      setDropCues([]);
    }
  }, [transitioning]);

  const lidStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -lidOpen.value * 34 },
      { translateX: lidOpen.value * 6 },
      { rotate: `${-lidOpen.value * 9}deg` },
    ],
  }));

  const brothStyle = useAnimatedStyle(() => ({
    height: 34 + brothLevel.value * 44,
  }));

  const brothSurfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -8 + brothWave.value * 16 }],
  }));

  const steamStyle = useAnimatedStyle(() => ({
    opacity: steamOpacity.value,
  }));

  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const burnerGlowStyle = useAnimatedStyle(() => ({
    opacity: burnerGlow.value * 0.78,
    transform: [{ scale: 0.92 + burnerGlow.value * 0.16 }],
  }));

  const burnerRingStyle = useAnimatedStyle(() => ({
    opacity: 0.34 + burnerGlow.value * 0.58,
    transform: [{ scale: 1 + burnerGlow.value * 0.06 }],
  }));

  const flameCenterStyle = useAnimatedStyle(() => ({
    opacity: burnerGlow.value * (0.72 + flameFlicker.value * 0.18),
    transform: [
      { translateY: -2 - flamePulse.value * 16 },
      { scaleY: 0.72 + flamePulse.value * 0.46 },
      { scaleX: 0.9 + flameFlicker.value * 0.08 },
    ],
  }));

  const flameLeftStyle = useAnimatedStyle(() => ({
    opacity: burnerGlow.value * (0.54 + flameFlicker.value * 0.14),
    transform: [
      { translateY: -1 - flamePulse.value * 10 },
      { scaleY: 0.66 + flamePulse.value * 0.32 },
      { scaleX: 0.82 + flameFlicker.value * 0.06 },
    ],
  }));

  const flameRightStyle = useAnimatedStyle(() => ({
    opacity: burnerGlow.value * (0.5 + flameFlicker.value * 0.16),
    transform: [
      { translateY: -1 - flamePulse.value * 11 },
      { scaleY: 0.68 + flamePulse.value * 0.34 },
      { scaleX: 0.8 + flameFlicker.value * 0.06 },
    ],
  }));

  const insideIngredients = selectedIngredients.slice(-3);
  const extraIngredients = Math.max(0, selectedIngredients.length - insideIngredients.length);
  const statusText = transitioning
    ? copy.reactorActionClosingSub
    : hasIngredients
      ? copy.reactorLocked
      : copy.reactorWaitingLabel;
  const ctaTitle = transitioning
    ? copy.reactorActionClosing
    : copy.reactorAction;
  const ctaSub = transitioning
    ? copy.reactorActionClosingSub
    : hasIngredients
      ? copy.reactorActionSub
      : copy.reactorWaitingLabel;

  return (
    <View style={[s.reactorSection, { borderTopColor: `${theme.border}88` }]}>
      <View style={s.reactorHeader}>
        <View style={s.reactorHeaderText}>
          <Text style={[s.reactorTitle, { color: theme.text }]}>{copy.reactorTitle}</Text>
          <Text style={[s.reactorSub, { color: theme.textMuted }]}>
            {hasIngredients ? copy.reactorReady : copy.reactorWaiting}
          </Text>
        </View>

        <View
          style={[
            s.reactorBadge,
            {
              backgroundColor: hasIngredients ? theme.glassEmerald : `${theme.border}22`,
              borderColor: hasIngredients ? theme.borderEmerald : `${theme.border}70`,
            },
          ]}
        >
          <Text
            style={[
              s.reactorBadgeTxt,
              { color: hasIngredients ? theme.emerald : theme.textMuted },
            ]}
          >
            {selectedIngredients.length}
          </Text>
        </View>
      </View>

      <View style={s.composerShell}>
        <View
          style={[
            s.composerCanvas,
            {
              backgroundColor: `${theme.surfaceElevated}DE`,
              borderColor: `${theme.borderEmerald}4A`,
            },
          ]}
        >
          <DytopiaLogoBubble size={168} opacity={0.18} logoOpacity={0.34} style={s.composerGlowA} />
          <DytopiaLogoBubble size={136} opacity={0.14} logoOpacity={0.32} style={s.composerGlowB} />
          <View style={[s.composerCounterGlow, { backgroundColor: `${theme.primary}14` }]} />

          <View
            style={[
              s.composerSignalPill,
              {
                backgroundColor: `${theme.surface}E2`,
                borderColor: hasIngredients ? `${theme.borderEmerald}58` : `${theme.border}60`,
              },
            ]}
          >
            <View
              style={[
                s.composerSignalDot,
                { backgroundColor: hasIngredients ? theme.emerald : theme.textMuted },
              ]}
            />
            <Text
              style={[
                s.composerSignalText,
                { color: hasIngredients ? theme.text : theme.textMuted },
              ]}
              numberOfLines={1}
            >
              {statusText}
            </Text>
          </View>

          {dropCues.map((cue) => (
            <PotIngredientDropCue key={cue.key} cue={cue} theme={theme} />
          ))}

          <Animated.View
            style={[
              s.composerAura,
              { backgroundColor: `${theme.primary}14` },
              ctaGlowStyle,
            ]}
          />

          <View
            style={[
              s.composerStoveDeck,
              {
                backgroundColor: `${theme.surface}EC`,
                borderColor: `${theme.border}86`,
              },
            ]}
          >
            <Animated.View
              style={[
                s.composerBurnerGlow,
                { backgroundColor: `${theme.warning}24` },
                burnerGlowStyle,
              ]}
            />
            <Animated.View
              style={[
                s.composerBurnerRing,
                { borderColor: `${theme.warning}88`, backgroundColor: `${theme.surfaceElevated}EA` },
                burnerRingStyle,
              ]}
            />
            <View style={[s.composerFlameTray, { opacity: transitioning ? 1 : 0.001 }]}>
              <Animated.View style={[s.composerFlame, s.composerFlameLeft, { backgroundColor: theme.warning }, flameLeftStyle]} />
              <Animated.View style={[s.composerFlame, s.composerFlameCenter, { backgroundColor: theme.accentGold }, flameCenterStyle]} />
              <Animated.View style={[s.composerFlame, s.composerFlameRight, { backgroundColor: theme.warning }, flameRightStyle]} />
            </View>
          </View>

          <Animated.View style={s.composerPotCluster}>
            <Animated.View style={[s.composerLidWrap, lidStyle]}>
              <View
                style={[
                  s.composerLid,
                  {
                    backgroundColor: `${theme.surface}F8`,
                    borderColor: `${theme.borderEmerald}A0`,
                  },
                ]}
              />
              <View
                style={[
                  s.composerLidKnob,
                  {
                    backgroundColor: theme.accentGold,
                    borderColor: `${theme.accentGold}5A`,
                  },
                ]}
              />
              <View
                style={[
                  s.composerLidHighlight,
                  { backgroundColor: `${theme.surfaceElevated}D0` },
                ]}
              />
              <View style={s.composerLidBrand}>
                <Image source={BRAND_LOGO} resizeMode="contain" style={s.composerLidBrandLogo} />
                <Text style={[s.composerLidBrandText, { color: theme.primaryDark }]}>DYTOPIA</Text>
              </View>
            </Animated.View>

            <Animated.View style={[s.composerSteamWrap, steamStyle]}>
              <View style={[s.composerSteamPuff, s.composerSteamPuffLeft, { backgroundColor: `${theme.primary}28` }]} />
              <View style={[s.composerSteamPuff, s.composerSteamPuffCenter, { backgroundColor: `${theme.emerald}2A` }]} />
              <View style={[s.composerSteamPuff, s.composerSteamPuffRight, { backgroundColor: `${theme.primary}22` }]} />
            </Animated.View>

            <View style={[s.composerHandle, s.composerHandleLeft, { borderColor: `${theme.borderEmerald}86` }]} />
            <View style={[s.composerHandle, s.composerHandleRight, { borderColor: `${theme.borderEmerald}86` }]} />
            <View style={[s.composerPotShadow, { backgroundColor: `${theme.primary}18` }]} />
            <View style={[s.composerPotBase, { backgroundColor: `${theme.surfaceElevated}E4`, borderColor: `${theme.border}72` }]} />

            <View
              style={[
                s.composerPot,
                {
                  backgroundColor: theme.surface,
                  borderColor: hasIngredients ? `${theme.borderEmerald}D0` : `${theme.border}AA`,
                  shadowColor: theme.shadowEmerald,
                },
              ]}
            >
              <View style={[s.composerPotHighlight, { backgroundColor: `${theme.surfaceElevated}D4` }]} />
              <View style={[s.composerPotRim, { borderColor: `${theme.borderEmerald}86` }]} />
              <View style={[s.composerBrothMask, { backgroundColor: `${theme.primary}12` }]}>
                <Animated.View style={[s.composerBroth, { backgroundColor: `${theme.primary}2A` }, brothStyle]}>
                  <Animated.View style={[s.composerBrothSurface, { backgroundColor: `${theme.primary}88` }, brothSurfaceStyle]} />
                  <View style={[s.composerBrothBubble, s.composerBrothBubbleA, { backgroundColor: `${theme.surface}D2` }]} />
                  <View style={[s.composerBrothBubble, s.composerBrothBubbleB, { backgroundColor: `${theme.surface}BE` }]} />
                </Animated.View>
              </View>

              <View style={s.composerIngredientWell}>
                {insideIngredients.map((ingredient, index) => (
                  <Animated.View
                    key={ingredient.id}
                    entering={FadeIn.duration(dur.base).delay(index * 80)}
                    style={[
                      s.composerIngredientPearl,
                      {
                        backgroundColor: `${theme.surface}F0`,
                        borderColor: `${theme.primary}30`,
                      },
                    ]}
                  >
                    <Text style={[s.composerIngredientPearlText, { color: theme.text }]}>
                      {shortIngredientLabel(ingredient.canonicalName)}
                    </Text>
                  </Animated.View>
                ))}
                {extraIngredients > 0 && (
                  <View
                    style={[
                      s.composerIngredientPearl,
                      {
                        backgroundColor: `${theme.primary}14`,
                        borderColor: `${theme.primary}30`,
                      },
                    ]}
                  >
                    <Text style={[s.composerIngredientPearlText, { color: theme.primary }]}>
                      +{extraIngredients}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>

          <Text style={[s.composerFooterText, { color: theme.textMuted }]}>
            {copy.reactorFooterHint}
          </Text>
        </View>

        <Animated.View style={[s.composerCtaWrap, ctaPressStyle]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={onPress}
            disabled={!hasIngredients || transitioning}
            onPressIn={() => {
              ctaScale.value = withSpring(0.98, spring.snappy);
            }}
            onPressOut={() => {
              ctaScale.value = withSpring(1, spring.gentle);
            }}
            style={[
              s.composerCta,
              {
                backgroundColor: hasIngredients ? theme.primary : `${theme.surface}F2`,
                borderColor: hasIngredients ? `${theme.primary}66` : theme.border,
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                s.composerCtaGlow,
                { backgroundColor: hasIngredients ? `${theme.primary}28` : 'transparent' },
                ctaGlowStyle,
              ]}
            />
            <View style={s.composerCtaTextBlock}>
              <Text style={[s.composerCtaTitle, { color: hasIngredients ? '#FFFFFF' : theme.textMuted }]}>
                {ctaTitle}
              </Text>
              <Text style={[s.composerCtaSub, { color: hasIngredients ? '#F2FFFA' : theme.textMuted }]}>
                {ctaSub}
              </Text>
            </View>
            <View
              style={[
                s.composerCtaIcon,
                {
                  backgroundColor: hasIngredients ? 'rgba(255,255,255,0.18)' : `${theme.primary}12`,
                  borderColor: hasIngredients ? 'rgba(255,255,255,0.24)' : `${theme.primary}18`,
                },
              ]}
            >
              <Ionicons
                name={transitioning ? 'hourglass-outline' : hasIngredients ? 'sparkles' : 'add-circle-outline'}
                size={16}
                color={hasIngredients ? '#FFFFFF' : theme.primary}
              />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Text style={[s.reactorHint, { color: `${theme.textMuted}B8` }]}>
        {hasIngredients ? copy.reactorHintReady : copy.reactorHintIdle}
      </Text>
    </View>
  );
}

export default function KitchenScreen({
  selectedIngredients,
  onChangeSelected,
  pantryIngredients = [],
  onChangePantry,
  openQuickSheet,
  isActive = true,
  onTabSwipeEnabledChange,
}: {
  selectedIngredients: Ingredient[];
  onChangeSelected: (v: Ingredient[]) => void;
  pantryIngredients?: Ingredient[];
  onChangePantry?: (v: Ingredient[]) => void;
  openQuickSheet: () => void;
  isActive?: boolean;
  onTabSwipeEnabledChange?: (enabled: boolean) => void;
}) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t, language } = useTranslation();
  const { data: gamification } = useGamification();
  const lockTabSwipe = React.useCallback(() => {
    onTabSwipeEnabledChange?.(false);
  }, [onTabSwipeEnabledChange]);
  const releaseTabSwipe = React.useCallback(() => {
    onTabSwipeEnabledChange?.(true);
  }, [onTabSwipeEnabledChange]);

  const copy = language === 'en'
    ? {
        active: 'active',
        quick: 'Quick',
        pantry: 'Pantry',
        search: 'INGREDIENT SEARCH',
        selectedIngredients: 'SELECTED INGREDIENTS',
        collapse: 'Collapse',
        more: 'more',
        clear: 'Clear',
        reactorTitle: 'AI Recipe Pot',
        reactorReady: `${selectedIngredients.length} ingredients are simmering in the pot`,
        reactorWaiting: 'Choose ingredients and watch them fall into the pot',
        reactorHintReady: 'The lid is open. Tap Find Recipes when you are ready.',
        reactorHintIdle: 'Each ingredient drops into the pot and wakes the AI gently.',
        reactorAction: 'Find Recipes',
        reactorActionSub: 'The pot is warm and ready for tasting',
        reactorActionClosing: 'Sealing the pot',
        reactorActionClosingSub: 'The lid is closing before the recipe story begins',
        reactorModeLive: 'Live',
        reactorModeReady: 'Pot ready',
        reactorModeIdle: 'Pot waiting',
        reactorLocked: `${selectedIngredients.length} ingredients in the pot`,
        reactorWaitingLabel: 'Pot waiting for ingredients',
        reactorFooterHint: 'Selected ingredients slide into the pot one by one',
        quickStart: 'My Packs',
        quickStartSub: 'Your custom ingredient bundles',
        packs: 'packs',
        add: 'Add',
        newPack: 'New Pack',
        emptyPackTitle: 'No packs yet',
        emptyPackSub: 'Create a pack to quickly add your favourite ingredients',
      }
    : {
        active: 'aktif',
        quick: 'Hızlı',
        pantry: 'Dolabım',
        search: 'MALZEME SORGUSU',
        selectedIngredients: 'SEÇİLEN MALZEMELER',
        collapse: 'Daralt',
        more: 'daha',
        clear: 'Temizle',
        reactorTitle: 'AI Tarif Kazanı',
        reactorReady: `${selectedIngredients.length} malzeme kazanda demleniyor`,
        reactorWaiting: 'Malzeme seç, tencereye yumuşakça düşsün',
        reactorHintReady: 'Kapak aralandı. Hazırsan Tarif Bul’a dokun.',
        reactorHintIdle: 'Her malzeme seçimi tencereye düşer ve kapağı biraz daha açar.',
        reactorAction: 'Tarif Bul',
        reactorActionSub: 'Kazan ısındı, AI tadım için hazır',
        reactorActionClosing: 'Kazan kapanıyor',
        reactorActionClosingSub: 'Kapak kapanıyor, tarif hikâyesi şimdi başlıyor',
        reactorModeLive: 'Canlı',
        reactorModeReady: 'Kazan hazır',
        reactorModeIdle: 'Kazan bekliyor',
        reactorLocked: `${selectedIngredients.length} malzeme kazanda`,
        reactorWaitingLabel: 'Kazan malzeme bekliyor',
        reactorFooterHint: 'Seçilen malzemeler tek tek kazana iner',
        quickStart: 'Paketlerim',
        quickStartSub: 'Özel malzeme paketlerin',
        packs: 'paket',
        add: 'Ekle',
        newPack: 'Yeni Paket',
        emptyPackTitle: 'Henüz paket yok',
        emptyPackSub: 'Favori malzemelerini hızlıca eklemek için paket oluştur',
      };

  const { packs, createPack, updatePack, removePack, maxReached } = useCustomPacks();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingPack, setEditingPack] = useState<CustomPack | null>(null);
  const [activePack, setActivePack] = useState<string | null>(null);
  const [recentIngredients, setRecentIngredients] = useState<Ingredient[]>([]);
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const [searchTransitioning, setSearchTransitioning] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [searchPrefill, setSearchPrefill] = useState('');
  const [searchPrefillKey, setSearchPrefillKey] = useState(0);
  const searchTransitionTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasIngredients = selectedIngredients.length > 0;
  const hiddenCount = Math.max(0, selectedIngredients.length - CHIP_COLLAPSE_AT);
  const compactMode = !chipsExpanded && selectedIngredients.length > CHIP_COLLAPSE_AT;
  const displayedIngredients = compactMode
    ? selectedIngredients.slice(0, CHIP_COLLAPSE_AT)
    : selectedIngredients;
  const headerStyle = useScaleSettle(20, 0.98);
  const workspaceStyle = useScaleSettle(70, 0.985);
  const packsStyle = useFadeRise(120, 12);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    getRecentPantryIngredients(8).then(setRecentIngredients);
  }, []);

  useEffect(() => {
    if (selectedIngredients.length <= CHIP_COLLAPSE_AT) {
      setChipsExpanded(false);
    }
  }, [selectedIngredients.length]);

  useEffect(() => {
    return () => {
      if (searchTransitionTimeoutRef.current) {
        clearTimeout(searchTransitionTimeoutRef.current);
      }
    };
  }, []);

  function addIngredient(ingredient: Ingredient) {
    if (selectedIngredients.some(item => item.id === ingredient.id)) return;
    onChangeSelected([...selectedIngredients, ingredient]);
  }

  function handleSearchFallback(term: string) {
    setSearchPrefill(term);
    setSearchPrefillKey(value => value + 1);
  }

  function removeIngredient(id: string) {
    onChangeSelected(selectedIngredients.filter(item => item.id !== id));
  }

  function addPack(pack: CustomPack) {
    const toAdd = pack.items
      .filter(item => !selectedIngredients.some(selected => selected.id === item.id))
      .map<Ingredient>(item => ({ id: item.id, canonicalName: item.name }));

    if (toAdd.length > 0) {
      onChangeSelected([...selectedIngredients, ...toAdd]);
    }
  }

  function openCreateSheet() {
    setEditingPack(null);
    setSheetVisible(true);
  }

  function openEditSheet(pack: CustomPack) {
    setEditingPack(pack);
    setSheetVisible(true);
  }

  async function handleSheetSave(name: string, items: import('../hooks/useCustomPacks').CustomPackItem[]) {
    if (editingPack) {
      await updatePack(editingPack.id, name, items);
    } else {
      await createPack(name, items);
    }
    setSheetVisible(false);
    setEditingPack(null);
  }

  function handlePackLongPress(pack: CustomPack) {
    setActivePack(prev => (prev === pack.id ? null : pack.id));
  }

  function dismissActivePack() {
    setActivePack(null);
  }

  function handleActionEdit() {
    const pack = packs.find(p => p.id === activePack);
    if (pack) { openEditSheet(pack); }
    setActivePack(null);
  }

  function handleActionDelete() {
    const pack = packs.find(p => p.id === activePack);
    if (!pack) return;
    Alert.alert(
      language === 'en' ? 'Delete Pack' : 'Paketi Sil',
      language === 'en' ? `Delete "${pack.name}"?` : `"${pack.name}" silinsin mi?`,
      [
        { text: language === 'en' ? 'Cancel' : 'İptal', style: 'cancel' },
        {
          text: language === 'en' ? 'Delete' : 'Sil',
          style: 'destructive',
          onPress: () => { void removePack(pack.id); setActivePack(null); },
        },
      ],
    );
  }

  function appendIngredients(ingredients: Ingredient[]) {
    const toAdd = ingredients.filter(
      ingredient => !selectedIngredients.some(selected => selected.id === ingredient.id),
    );
    if (toAdd.length > 0) {
      onChangeSelected([...selectedIngredients, ...toAdd]);
    }
  }

  function handlePhotoScanPress() {
    (nav as any).navigate(Routes.App.IngredientScan, {
      onConfirm: (ingredients: Ingredient[]) => {
        appendIngredients(ingredients);
      },
      onUseSearchTerm: handleSearchFallback,
    });
  }

  function handleBarcodeScanPress() {
    (nav as any).navigate(Routes.App.BarcodeScan, {
      usageContext: 'kitchen',
      onConfirm: (ingredients: Ingredient[]) => {
        appendIngredients(ingredients);
      },
      onUseSearchTerm: handleSearchFallback,
    });
  }

  function handleMerge() {
    if (!hasIngredients || searchTransitioning) return;

    setSearchTransitioning(true);

    if (searchTransitionTimeoutRef.current) {
      clearTimeout(searchTransitionTimeoutRef.current);
    }

    searchTransitionTimeoutRef.current = setTimeout(() => {
      (nav as any).navigate(Routes.App.KitchenResult, {
        ingredientIds: selectedIngredients.map(item => item.id),
        ingredientNames: selectedIngredients.map(item => item.canonicalName),
      });

      searchTransitionTimeoutRef.current = setTimeout(() => {
        setSearchTransitioning(false);
      }, 620);
    }, 920);
  }

  useShakeDetector(() => {
    if (!hasIngredients || searchTransitioning) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleMerge();
  }, isActive && hasIngredients && !searchTransitioning);

  function handlePantryPress() {
    (nav as any).navigate(Routes.App.Pantry, {
      selectedIngredients: pantryIngredients,
      onConfirm: (ingredients: Ingredient[]) => {
        onChangePantry?.(ingredients);
        onChangeSelected(ingredients);
      },
    });
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 16}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <DytopiaWatermark position="center" size={315} opacity={0.036} />
      <DytopiaLogoBubble size={158} opacity={0.34} logoOpacity={0.42} style={s.screenGlowA} />
      <DytopiaLogoBubble size={150} opacity={0.28} logoOpacity={0.38} style={s.screenGlowB} />

      <ScrollView
        style={s.scrollFlex}
        contentContainerStyle={[
          s.scroll,
          {
            paddingTop: insets.top + 22,
            paddingBottom: keyboardVisible ? insets.bottom + 220 : BOTTOM_NAV_CLEARANCE + 138,
          },
        ]}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            {
              backgroundColor: `${theme.surface}F6`,
              borderColor: `${theme.border}D0`,
            },
            s.wsHeader,
            headerStyle,
          ]}
        >
          <DytopiaLogoBubble size={84} opacity={0.18} logoOpacity={0.5} style={s.wsHeaderGlow} />
          <DytopiaLogoBubble size={68} opacity={0.16} logoOpacity={0.48} style={s.wsHeaderGlowB} />
          <View style={[s.wsBar, { backgroundColor: theme.emerald }]} />
          <View style={s.wsHeaderPad}>
            <View style={s.wsHeaderRow}>
              <View style={s.wsTitleBlock}>
                <View style={s.wsEyebrowRow}>
                  <View style={[s.wsEyebrowDot, { backgroundColor: theme.emerald }]} />
                  <Text style={[s.wsEyebrow, { color: theme.emerald }]}>
                    {language === 'en' ? 'AI KITCHEN' : 'AI MUTFAK'}
                  </Text>
                </View>
                <Text
                  style={[s.wsTitle, { color: theme.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.76}
                >
                  {t.kitchen.title}
                </Text>
                <Text style={[s.wsSubtitle, { color: theme.textMuted }]}>
                  {t.kitchen.subtitle}
                </Text>
              </View>

              <View style={s.wsHeaderRight}>
                {hasIngredients && (
                  <Animated.View
                    entering={ZoomIn.duration(dur.fast).springify()}
                    style={[
                      s.wsCountBadge,
                      {
                        backgroundColor: theme.glassEmerald,
                        borderColor: theme.borderEmerald,
                      },
                    ]}
                  >
                    <View style={[s.wsCountDot, { backgroundColor: theme.emerald }]} />
                    <Text style={[s.wsCountTxt, { color: theme.emerald }]}>
                      {selectedIngredients.length} {copy.active}
                    </Text>
                  </Animated.View>
                )}

                <TouchableOpacity
                  onPress={handlePantryPress}
                  activeOpacity={0.82}
                  style={[
                    s.quickBtn,
                    {
                      borderColor: `${theme.emerald}2F`,
                      backgroundColor: `${theme.emerald}12`,
                    },
                  ]}
                >
                  <Ionicons name="basket-outline" size={13} color={theme.emerald} />
                  <Text style={[s.quickBtnTxt, { color: theme.emerald }]}>{copy.pantry}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={openQuickSheet}
                  activeOpacity={0.82}
                  style={[
                    s.quickBtn,
                    {
                      borderColor: `${theme.primary}2F`,
                      backgroundColor: `${theme.primary}12`,
                    },
                  ]}
                >
                  <Ionicons name="sparkles-outline" size={13} color={theme.primary} />
                  <Text style={[s.quickBtnTxt, { color: theme.primary }]}>{copy.quick}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>

        <KitchenStreakRail
          theme={theme}
          language={language}
          summary={gamification}
          onTabSwipeEnabledChange={onTabSwipeEnabledChange}
        />

        <Animated.View
          style={[
            s.workspace,
            {
              backgroundColor: theme.surface,
              borderColor: `${theme.border}D0`,
            },
            workspaceStyle,
          ]}
        >
          <View style={[s.wsSection, { borderTopColor: `${theme.border}88` }]}> 
            <View style={s.wsSectionLabel}>
              <View style={[s.sectionDot, { backgroundColor: theme.primary }]} />
              <Text style={[s.sectionLabelTxt, { color: theme.textMuted }]}>{copy.search}</Text>
            </View>

            <View style={s.searchRow}>
              <View style={s.searchFlex}>
                <IngredientSearch
                  onSelect={addIngredient}
                  initialQuery={searchPrefill}
                  initialQueryKey={searchPrefillKey}
                />
              </View>

              <TouchableOpacity
                onPress={handleBarcodeScanPress}
                activeOpacity={0.82}
                style={[
                  s.scanBtn,
                  {
                    backgroundColor: `${theme.emerald}12`,
                    borderColor: `${theme.emerald}28`,
                  },
                ]}
              >
                <Ionicons name="barcode-outline" size={20} color={theme.emerald} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePhotoScanPress}
                activeOpacity={0.82}
                style={[
                  s.scanBtn,
                  {
                    backgroundColor: `${theme.primary}12`,
                    borderColor: `${theme.primary}28`,
                  },
                ]}
              >
                <Ionicons name="camera-outline" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[s.wsSection, { borderTopColor: `${theme.border}88` }]}> 
            <View style={s.selectedHead}>
              <View style={s.wsSectionLabel}>
                <View
                  style={[
                    s.sectionDot,
                    { backgroundColor: hasIngredients ? theme.emerald : theme.textMuted },
                  ]}
                />
                <Text style={[s.sectionLabelTxt, { color: theme.textMuted }]}>
                  {copy.selectedIngredients}
                </Text>
              </View>

              <View style={s.selectedActions}>
                {selectedIngredients.length > CHIP_COLLAPSE_AT && (
                  <TouchableOpacity onPress={() => setChipsExpanded(value => !value)} activeOpacity={0.82}>
                    <Text style={[s.actionTxt, { color: theme.primary }]}>
                      {chipsExpanded ? copy.collapse : `+${hiddenCount} ${copy.more}`}
                    </Text>
                  </TouchableOpacity>
                )}

                {hasIngredients && (
                  <TouchableOpacity onPress={() => onChangeSelected([])} activeOpacity={0.82}>
                    <Text style={[s.actionTxt, { color: theme.textMuted }]}>{copy.clear}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {hasIngredients ? (
              <Animated.View layout={Layout.springify()} style={s.capsuleWrap}>
                {displayedIngredients.map((ingredient, index) => (
                  <IngredientCapsule
                    key={ingredient.id}
                    ingredient={ingredient}
                    index={index}
                    theme={theme}
                    onRemove={() => removeIngredient(ingredient.id)}
                  />
                ))}
                {compactMode && (
                  <View
                    style={[
                      s.overflowCapsule,
                      {
                        backgroundColor: `${theme.primary}14`,
                        borderColor: `${theme.primary}30`,
                      },
                    ]}
                  >
                    <Text style={[s.overflowTxt, { color: theme.primary }]}>+{hiddenCount}</Text>
                  </View>
                )}
              </Animated.View>
            ) : (
              <Text style={[s.emptyHint, { color: theme.textMuted }]}>
                {t.kitchen.noIngredientsDesc}
              </Text>
            )}
          </View>
          <KitchenPotComposer
            theme={theme}
            selectedIngredients={selectedIngredients}
            hasIngredients={hasIngredients}
            transitioning={searchTransitioning}
            copy={copy}
            onPress={handleMerge}
          />
        </Animated.View>

        {recentIngredients.length > 0 && (
          <Animated.View style={packsStyle}>
            <View style={s.packSectionHeader}>
              <View style={s.packSectionLeft}>
                <View style={[s.packSectionBar, { backgroundColor: theme.primary }]} />
                <View>
                  <Text style={[s.packSectionTitle, { color: theme.text }]}>
                    {language === 'en' ? 'Recent' : 'Son Kullandıklarım'}
                  </Text>
                  <Text style={[s.packSectionSub, { color: theme.textMuted }]}>
                    {language === 'en' ? 'Your last used ingredients' : 'Son kullandığın malzemeler'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => appendIngredients(recentIngredients)}
                style={[
                  s.recentAddAllBtn,
                  { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}35` },
                ]}
              >
                <Text style={[s.recentAddAllTxt, { color: theme.primary }]}>
                  {language === 'en' ? '+ Add All' : '+ Tümünü Ekle'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.recentChipRow}
              onTouchStart={lockTabSwipe}
              onTouchEnd={releaseTabSwipe}
              onTouchCancel={releaseTabSwipe}
              onScrollBeginDrag={lockTabSwipe}
              onScrollEndDrag={releaseTabSwipe}
              onMomentumScrollEnd={releaseTabSwipe}
            >
              {recentIngredients.map(ingredient => {
                const isSelected = selectedIngredients.some(sel => sel.id === ingredient.id);
                return (
                  <TouchableOpacity
                    key={ingredient.id}
                    onPress={() => isSelected ? removeIngredient(ingredient.id) : addIngredient(ingredient)}
                    style={[
                      s.recentChip,
                      {
                        backgroundColor: isSelected ? `${theme.primary}18` : theme.surface,
                        borderColor: isSelected ? `${theme.primary}55` : theme.border,
                      },
                    ]}
                  >
                    <Text style={[s.recentChipTxt, { color: isSelected ? theme.primary : theme.text }]}>
                      {ingredient.canonicalName}
                    </Text>
                    {isSelected
                      ? <Ionicons name="checkmark-circle" size={13} color={theme.primary} />
                      : <Ionicons name="add-circle-outline" size={13} color={theme.textMuted} />
                    }
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        <Animated.View style={packsStyle}>
          <View style={s.packSectionHeader}>
            <View style={s.packSectionLeft}>
              <View style={[s.packSectionBar, { backgroundColor: theme.warning }]} />
              <View>
                <Text style={[s.packSectionTitle, { color: theme.text }]}>{copy.quickStart}</Text>
                <Text style={[s.packSectionSub, { color: theme.textMuted }]}>
                  {copy.quickStartSub}
                </Text>
              </View>
            </View>

            {!maxReached && (
              <TouchableOpacity
                onPress={openCreateSheet}
                style={[
                  s.packSectionBadge,
                  {
                    backgroundColor: `${theme.warning}18`,
                    borderColor: `${theme.warning}35`,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  },
                ]}
              >
                <Ionicons name="add" size={13} color={theme.warning} />
                <Text style={[s.packSectionBadgeTxt, { color: theme.warning }]}>
                  {copy.newPack}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {packs.length === 0 ? (
            <TouchableOpacity
              onPress={openCreateSheet}
              style={[s.packEmpty, { borderColor: `${theme.warning}35`, backgroundColor: `${theme.warning}08` }]}
            >
              <View style={[s.packEmptyIcon, { backgroundColor: `${theme.warning}18` }]}>
                <Ionicons name="albums-outline" size={26} color={theme.warning} />
              </View>
              <Text style={[s.packEmptyTitle, { color: theme.text }]}>{copy.emptyPackTitle}</Text>
              <Text style={[s.packEmptySub, { color: theme.textMuted }]}>{copy.emptyPackSub}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.packRow}
                decelerationRate="fast"
                snapToInterval={148}
                snapToAlignment="start"
                onTouchStart={lockTabSwipe}
                onTouchEnd={releaseTabSwipe}
                onTouchCancel={releaseTabSwipe}
                onScrollBeginDrag={() => {
                  lockTabSwipe();
                  dismissActivePack();
                }}
                onScrollEndDrag={releaseTabSwipe}
                onMomentumScrollEnd={releaseTabSwipe}
              >
                {packs.map((pack, index) => (
                  <PackTile
                    key={pack.id}
                    pack={pack}
                    index={index}
                    theme={theme}
                    addLabel={copy.add}
                    isActive={activePack === pack.id}
                    onPress={() => { dismissActivePack(); addPack(pack); }}
                    onLongPress={() => handlePackLongPress(pack)}
                  />
                ))}
                {!maxReached && (
                  <TouchableOpacity
                    onPress={() => { dismissActivePack(); openCreateSheet(); }}
                    style={[s.packAddTile, { borderColor: `${theme.warning}35`, backgroundColor: `${theme.warning}08` }]}
                  >
                    <Ionicons name="add-circle-outline" size={28} color={theme.warning} />
                    <Text style={[s.packAddTxt, { color: theme.warning }]}>{copy.newPack}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
              {activePack !== null && (
                <PackActionBar
                  packName={packs.find(p => p.id === activePack)?.name ?? ''}
                  theme={theme}
                  editLabel={language === 'en' ? 'Edit' : 'Düzenle'}
                  deleteLabel={language === 'en' ? 'Delete' : 'Sil'}
                  onEdit={handleActionEdit}
                  onDelete={handleActionDelete}
                  onDismiss={dismissActivePack}
                />
              )}
            </>
          )}
        </Animated.View>

        <CreatePackSheet
          visible={sheetVisible}
          editPack={editingPack}
          onSave={(name, items) => void handleSheetSave(name, items)}
          onClose={() => { setSheetVisible(false); setEditingPack(null); }}
          language={language as 'tr' | 'en'}
        />

        <View style={s.scrollBottomPad} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function IngredientCapsule({
  ingredient,
  index,
  theme,
  onRemove,
}: {
  ingredient: Ingredient;
  index: number;
  theme: Theme;
  onRemove: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 22).duration(dur.base)}
      exiting={ZoomOut.duration(dur.fast)}
      layout={Layout.springify()}
    >
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={onRemove}
          onPressIn={() => {
            scale.value = withSpring(0.94, spring.snappy);
          }}
          onPressOut={() => {
            scale.value = withSpring(1, spring.snappy);
          }}
          activeOpacity={1}
          style={[
            s.capsule,
            {
              backgroundColor: `${theme.primary}14`,
              borderColor: `${theme.primary}30`,
            },
          ]}
        >
          <View style={[s.capsuleDot, { backgroundColor: theme.primary }]} />
          <Text style={[s.capsuleTxt, { color: theme.text }]} numberOfLines={1}>
            {ingredient.canonicalName}
          </Text>
          <Ionicons name="close" size={11} color={theme.textMuted} />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const PACK_ACCENT_COLORS = (theme: Theme) => [
  theme.primary,
  theme.emerald,
  theme.accentGold,
  theme.accentCoral,
  theme.accentCyan,
  theme.warning,
];

const PACK_ICONS: React.ComponentProps<typeof Ionicons>['name'][] = [
  'nutrition-outline',
  'leaf-outline',
  'fast-food-outline',
  'restaurant-outline',
  'pizza-outline',
  'cafe-outline',
  'fish-outline',
  'flame-outline',
  'basket-outline',
  'heart-outline',
];

function PackTile({
  pack,
  index,
  theme,
  addLabel,
  isActive,
  onPress,
  onLongPress,
}: {
  pack: CustomPack;
  index: number;
  theme: Theme;
  addLabel: string;
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shakeX.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  useEffect(() => {
    glowOpacity.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive, glowOpacity]);

  const accent = PACK_ACCENT_COLORS(theme)[index % PACK_ACCENT_COLORS(theme).length];
  const icon = PACK_ICONS[index % PACK_ICONS.length];
  const preview = pack.items.slice(0, 4).map(item => item.name).join(' · ');

  function triggerShakeAndLongPress() {
    shakeX.value = withSequence(
      withTiming(-7, { duration: 40 }),
      withTiming(7, { duration: 40 }),
      withTiming(-5, { duration: 40 }),
      withTiming(5, { duration: 40 }),
      withTiming(-3, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
    onLongPress();
  }

  return (
    <Animated.View style={[animatedStyle, { position: 'relative' }]} entering={FadeInRight.delay(60 + index * 45).duration(dur.base)}>
      {/* active glow ring */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.packActiveRing,
          { borderColor: accent },
          glowStyle,
        ]}
      />
      <TouchableOpacity
        onPress={onPress}
        onLongPress={triggerShakeAndLongPress}
        delayLongPress={380}
        onPressIn={() => { scale.value = withSpring(0.96, spring.snappy); }}
        onPressOut={() => { scale.value = withSpring(1, spring.snappy); }}
        activeOpacity={1}
        style={[
          s.packTile,
          {
            backgroundColor: isActive ? `${accent}10` : theme.surface,
            borderColor: isActive ? `${accent}55` : `${accent}22`,
          },
        ]}
      >
        {/* left accent rail */}
        <View style={[s.packRail, { backgroundColor: accent }]} />

        <View style={s.packBody}>
          {/* top row: icon + count */}
          <View style={s.packTopRow}>
            <View style={[s.packIconWrap, { backgroundColor: `${accent}16` }]}>
              <Ionicons name={icon} size={15} color={accent} />
            </View>
            <View style={[s.packCountPill, { backgroundColor: `${accent}18`, borderColor: `${accent}30` }]}>
              <Text style={[s.packCountTxt, { color: accent }]}>{pack.items.length}</Text>
            </View>
          </View>

          {/* name */}
          <Text style={[s.packName, { color: theme.text }]} numberOfLines={2}>
            {pack.name}
          </Text>

          {/* preview */}
          {!!preview && (
            <Text style={[s.packPreview, { color: theme.textMuted }]} numberOfLines={2}>
              {preview}{pack.items.length > 4 ? '...' : ''}
            </Text>
          )}

          {/* add button */}
          <View style={[s.packCta, { backgroundColor: `${accent}12`, borderColor: `${accent}28` }]}>
            <Text style={[s.packCtaTxt, { color: accent }]}>{addLabel}</Text>
            <Ionicons name="add-circle" size={13} color={accent} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function PackActionBar({
  packName,
  theme,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
  onDismiss,
}: {
  packName: string;
  theme: Theme;
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onDismiss: () => void;
}) {
  const translateY = useSharedValue(18);
  const opacity = useSharedValue(0);
  const editScale = useSharedValue(1);
  const deleteScale = useSharedValue(1);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));
  const editBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: editScale.value }] }));
  const deleteBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: deleteScale.value }] }));

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 18, stiffness: 260 });
    opacity.value = withTiming(1, { duration: 180 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[s.actionBar, { backgroundColor: theme.surface, borderColor: theme.border }, barStyle]}>
      <TouchableOpacity onPress={onDismiss} style={s.actionDismiss} hitSlop={10}>
        <Ionicons name="close" size={15} color={theme.textMuted} />
      </TouchableOpacity>
      <Text style={[s.actionBarName, { color: theme.textMuted }]} numberOfLines={1}>
        {packName}
      </Text>
      <View style={s.actionBtns}>
        <Animated.View style={editBtnStyle}>
          <TouchableOpacity
            onPress={onEdit}
            onPressIn={() => { editScale.value = withSpring(0.93, spring.snappy); }}
            onPressOut={() => { editScale.value = withSpring(1, spring.snappy); }}
            activeOpacity={1}
            style={[s.actionBtn, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}35` }]}
          >
            <Ionicons name="pencil" size={14} color={theme.primary} />
            <Text style={[s.actionBtnTxt, { color: theme.primary }]}>{editLabel}</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={deleteBtnStyle}>
          <TouchableOpacity
            onPress={onDelete}
            onPressIn={() => { deleteScale.value = withSpring(0.93, spring.snappy); }}
            onPressOut={() => { deleteScale.value = withSpring(1, spring.snappy); }}
            activeOpacity={1}
            style={[s.actionBtn, { backgroundColor: `${theme.error}14`, borderColor: `${theme.error}35` }]}
          >
            <Ionicons name="trash" size={14} color={theme.error} />
            <Text style={[s.actionBtnTxt, { color: theme.error }]}>{deleteLabel}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 },
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.base },
  scrollBottomPad: { height: 72 },
  screenGlowA: {
    position: 'absolute',
    top: 20,
    right: -68,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.72,
  },
  screenGlowB: {
    position: 'absolute',
    top: 360,
    left: -84,
    width: 190,
    height: 190,
    borderRadius: 95,
    opacity: 0.42,
  },
  stickyHeaderShell: {
    position: 'absolute',
    zIndex: 40,
    elevation: 16,
  },
  wsHeader: {
    borderWidth: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    shadowColor: '#0c2016',
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  wsBar: { height: 3 },
  wsHeaderPad: { padding: spacing.md + 2 },
  wsHeaderGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -54,
    right: -42,
  },
  wsHeaderGlowB: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    bottom: -20,
    left: -18,
  },
  wsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  wsTitleBlock: { flex: 1, minWidth: 0, paddingRight: 8 },
  wsEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  wsEyebrowDot: { width: 5, height: 5, borderRadius: 2.5 },
  wsEyebrow: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  wsTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 34,
    flexShrink: 1,
  },
  wsSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 4,
  },
  wsHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
  wsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  wsCountDot: { width: 5, height: 5, borderRadius: 2.5 },
  wsCountTxt: { fontSize: 11, fontWeight: '800' },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickBtnTxt: { fontSize: 10.5, fontWeight: '800' },
  workspace: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    marginBottom: spacing.xl + 8,
  },
  wsSection: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  wsSectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionDot: { width: 5, height: 5, borderRadius: 2.5 },
  sectionLabelTxt: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  searchFlex: { flex: 1 },
  scanBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  selectedHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionTxt: { fontSize: 11, fontWeight: '700' },
  capsuleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  capsule: {
    height: 36,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: 172,
  },
  capsuleDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  capsuleTxt: { fontSize: 12.5, fontWeight: '700', maxWidth: 114 },
  overflowCapsule: {
    height: 34,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowTxt: { fontSize: 11, fontWeight: '800' },
  emptyHint: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  reactorSection: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md + 2,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  reactorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 8,
  },
  reactorHeaderText: { flex: 1, paddingRight: 12 },
  reactorTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  reactorSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  reactorBadge: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  reactorBadgeTxt: { fontSize: 12, fontWeight: '900' },
  reactorActionShell: {
    width: '100%',
    alignItems: 'center',
  },
  reactorCanvas: {
    marginTop: 14,
    width: 276,
    height: 326,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ghostAnchor: {
    position: 'absolute',
    left: '50%',
    top:  '50%',
  },
  ghostChip: {
    width:          34,
    height:         34,
    marginLeft:    -17,
    marginTop:     -17,
    borderRadius:   17,
    borderWidth:    1,
    alignItems:    'center',
    justifyContent:'center',
    shadowOpacity:  0.10,
    shadowRadius:   8,
    shadowOffset:  { width: 0, height: 3 },
    elevation:      2,
  },
  ghostDot: {
    position:     'absolute',
    width:         26,
    height:        26,
    borderRadius:  13,
  },
  reactorCanvasGlowA: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -34,
    right: -28,
  },
  reactorCanvasGlowB: {
    position: 'absolute',
    width: 144,
    height: 144,
    borderRadius: 72,
    bottom: 18,
    left: -28,
  },
  reactorTopRow: {
    position: 'absolute',
    top: 14,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  reactorSignalPill: {
    maxWidth: 148,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reactorSignalDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  reactorSignalText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
  },
  reactorHalo: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 107,
  },
  reactorRingOuter: {
    position: 'absolute',
    width: 224,
    height: 224,
    borderRadius: 112,
    borderWidth: 1.2,
  },
  reactorRingMid: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 1,
  },
  reactorRingInner: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 1.2,
  },
  reactorSweep: {
    position: 'absolute',
    width: 90,
    height: 2,
    borderRadius: 1,
  },
  reactorShimmerRibbon: {
    position: 'absolute',
    top: 82,
    width: 64,
    height: 170,
    borderRadius: 26,
    transform: [{ skewX: '-16deg' }],
  },
  reactorNodeA: {
    position: 'absolute',
    width: 18,
    height: 18,
    top: 34,
    left: 178,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactorNodeB: {
    position: 'absolute',
    width: 16,
    height: 16,
    top: 180,
    left: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactorNodeC: {
    position: 'absolute',
    width: 13,
    height: 13,
    top: 105,
    left: 209,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactorNodeD: {
    position: 'absolute',
    width: 13,
    height: 13,
    top: 61,
    left: 89,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  nodeCoreA: { width: 8, height: 8, borderRadius: 4 },
  nodeCoreB: { width: 7, height: 7, borderRadius: 3.5 },
  nodeCoreC: { width: 5, height: 5, borderRadius: 2.5 },
  reactorIngredientTag: {
    position: 'absolute',
    minWidth: 68,
    maxWidth: 92,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactorIngredientTag0: {
    top: 82,
    left: 22,
  },
  reactorIngredientTag1: {
    top: 120,
    right: 24,
  },
  reactorIngredientTag2: {
    bottom: 96,
    left: 34,
  },
  reactorIngredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reactorIngredientText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '700',
  },
  reactorCorePulse: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  reactorLockRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
  },
  reactorPotAura: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  reactorSteamColumn: {
    position: 'absolute',
    width: 18,
    height: 80,
    borderRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  reactorSteamColumnA: {
    top: 8,
    left: 42,
  },
  reactorSteamColumnB: {
    top: -2,
    left: 67,
    height: 92,
  },
  reactorSteamColumnC: {
    top: 10,
    right: 42,
  },
  reactorCoreTouch: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9,
  },
  reactorCore: {
    width: 134,
    height: 134,
    borderRadius: 67,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#32a66c',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  reactorCoreInnerAura: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  reactorPotStack: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: 100,
    marginTop: 6,
  },
  reactorSteamRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  reactorSteamRowTop: {
    marginBottom: -4,
  },
  reactorSteamPuff: {
    width: 12,
    height: 24,
    borderRadius: 12,
  },
  reactorSteamPuffTall: {
    height: 32,
  },
  reactorPotTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: -0.1,
    marginTop: -1,
    lineHeight: 18,
    textAlign: 'center',
  },
  reactorCoreSub: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'center',
  },
  reactorFooter: {
    position: 'absolute',
    bottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactorFooterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reactorFooterText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  reactorHint: {
    marginTop: 16,
    maxWidth: 220,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  potDropCue: {
    position: 'absolute',
    top: 58,
    left: '50%',
    marginLeft: -46,
    minWidth: 92,
    maxWidth: 112,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  potDropCueDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  potDropCueText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  composerShell: {
    width: '100%',
    alignItems: 'center',
  },
  composerCanvas: {
    width: 286,
    height: 342,
    borderRadius: 38,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 22,
  },
  composerGlowA: {
    position: 'absolute',
    top: -28,
    right: -22,
    width: 168,
    height: 168,
    borderRadius: 84,
  },
  composerGlowB: {
    position: 'absolute',
    bottom: 32,
    left: -24,
    width: 134,
    height: 134,
    borderRadius: 67,
  },
  composerCounterGlow: {
    position: 'absolute',
    bottom: 22,
    width: 220,
    height: 38,
    borderRadius: 19,
  },
  composerSignalPill: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    zIndex: 4,
  },
  composerSignalDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  composerSignalText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '800',
  },
  composerAura: {
    position: 'absolute',
    bottom: 54,
    width: 214,
    height: 214,
    borderRadius: 107,
  },
  composerStoveDeck: {
    position: 'absolute',
    bottom: 26,
    width: 214,
    height: 64,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerBurnerGlow: {
    position: 'absolute',
    bottom: 18,
    width: 132,
    height: 34,
    borderRadius: 18,
  },
  composerBurnerRing: {
    width: 116,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  composerFlameTray: {
    position: 'absolute',
    bottom: 20,
    width: 88,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerFlame: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    height: 22,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  composerFlameLeft: {
    left: 14,
  },
  composerFlameCenter: {
    width: 20,
    height: 28,
  },
  composerFlameRight: {
    right: 14,
  },
  composerPotCluster: {
    width: 210,
    height: 232,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 42,
  },
  composerLidWrap: {
    position: 'absolute',
    top: 54,
    width: 156,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  composerLid: {
    width: 144,
    height: 40,
    borderWidth: 1.5,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  composerLidKnob: {
    position: 'absolute',
    top: 4,
    width: 28,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  composerLidHighlight: {
    position: 'absolute',
    top: 16,
    left: 30,
    width: 54,
    height: 7,
    borderRadius: 4,
    opacity: 0.9,
  },
  composerLidBrand: {
    position: 'absolute',
    top: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    opacity: 0.55,
    zIndex: 8,
  },
  composerLidBrandLogo: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  composerLidBrandText: {
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  composerSteamWrap: {
    position: 'absolute',
    top: 22,
    width: 120,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSteamPuff: {
    position: 'absolute',
    bottom: 0,
    width: 16,
    borderRadius: 16,
  },
  composerSteamPuffLeft: {
    left: 18,
    height: 30,
  },
  composerSteamPuffCenter: {
    height: 42,
    width: 18,
  },
  composerSteamPuffRight: {
    right: 20,
    height: 28,
  },
  composerHandle: {
    position: 'absolute',
    bottom: 48,
    width: 32,
    height: 48,
    borderWidth: 6,
    borderRadius: 18,
  },
  composerHandleLeft: {
    left: 18,
    borderRightWidth: 0,
  },
  composerHandleRight: {
    right: 18,
    borderLeftWidth: 0,
  },
  composerPotShadow: {
    position: 'absolute',
    bottom: 28,
    width: 156,
    height: 30,
    borderRadius: 15,
  },
  composerPotBase: {
    position: 'absolute',
    bottom: 26,
    width: 98,
    height: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  composerPot: {
    width: 154,
    height: 120,
    borderRadius: 32,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  composerPotHighlight: {
    position: 'absolute',
    top: 12,
    left: 20,
    width: 60,
    height: 14,
    borderRadius: 7,
    opacity: 0.82,
  },
  composerPotRim: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    height: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  composerBrothMask: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    top: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  composerBroth: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  composerBrothSurface: {
    position: 'absolute',
    top: 0,
    left: -10,
    right: -10,
    height: 4,
    borderRadius: 2,
  },
  composerBrothBubble: {
    position: 'absolute',
    borderRadius: 999,
  },
  composerBrothBubbleA: {
    width: 8,
    height: 8,
    left: 34,
    top: 14,
  },
  composerBrothBubbleB: {
    width: 6,
    height: 6,
    right: 30,
    top: 26,
  },
  composerIngredientWell: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  composerIngredientPearl: {
    minHeight: 24,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerIngredientPearlText: {
    fontSize: 10,
    fontWeight: '800',
  },
  composerFooterText: {
    position: 'absolute',
    bottom: 16,
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  composerCtaWrap: {
    width: '100%',
    marginTop: 14,
    alignItems: 'center',
  },
  composerCta: {
    width: '100%',
    minHeight: 72,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  composerCtaGlow: {
    position: 'absolute',
    top: -24,
    left: 18,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  composerCtaTextBlock: {
    flex: 1,
  },
  composerCtaTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  composerCtaSub: {
    marginTop: 4,
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 16,
  },
  composerCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl + 6,
    marginBottom: spacing.md,
  },
  packSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  packSectionBar: { width: 3, height: 38, borderRadius: 2 },
  packSectionTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  packSectionSub: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  packSectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  packSectionBadgeTxt: { fontSize: 11, fontWeight: '800' },
  // ── Son Kullandıklarım ──────────────────────────────────────────────────────
  recentAddAllBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  recentAddAllTxt: { fontSize: 11, fontWeight: '800' },
  recentChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    paddingRight: spacing.base,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  recentChipTxt: { fontSize: 12.5, fontWeight: '700' },
  // ───────────────────────────────────────────────────────────────────────────
  packRow: { gap: 10, paddingBottom: 8, paddingRight: spacing.base },
  // ── Pack Tile (new flat design) ─────────────────────────────────────────────
  packTile: {
    width: 148,
    borderWidth: 1.2,
    borderRadius: radii.xl,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  packActiveRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: radii.xl + 3,
    borderWidth: 2,
    zIndex: 10,
  },
  packRail: {
    width: 4,
    borderTopLeftRadius: radii.xl,
    borderBottomLeftRadius: radii.xl,
  },
  packBody: {
    flex: 1,
    padding: 11,
    paddingLeft: 10,
    gap: 5,
  },
  packTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packCountPill: {
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packCountTxt: { fontSize: 10, fontWeight: '900' },
  packName: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    letterSpacing: -0.2,
  },
  packPreview: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    flexShrink: 1,
  },
  packCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: 2,
  },
  packCtaTxt: { fontSize: 11, fontWeight: '800' },
  // ── Pack Action Bar ──────────────────────────────────────────────────────────
  actionBar: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actionDismiss: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBarName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  actionBtnTxt: { fontSize: 12.5, fontWeight: '800' },
  packEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radii.xl,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  packEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  packEmptyTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  packEmptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center', maxWidth: 220, lineHeight: 17 },
  packAddTile: {
    width: 100,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  packAddTxt: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
});

const po = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    paddingHorizontal: 24,
  },
  overlayVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientOrbA: {
    position: 'absolute',
    top: '16%',
    right: -28,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  ambientOrbB: {
    position: 'absolute',
    bottom: '18%',
    left: -34,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  card: {
    width: '100%',
    maxWidth: 352,
    borderRadius: 36,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 26,
    alignItems: 'center',
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  spotlightWrap: {
    width: 236,
    height: 236,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 18,
  },
  reactorShell: {
    position: 'absolute',
    width: 244,
    height: 244,
    borderRadius: 122,
    borderWidth: 1,
  },
  spotlightGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  reactorHalo: {
    position: 'absolute',
    width: 212,
    height: 212,
    borderRadius: 106,
  },
  reactorRingOuter: {
    position: 'absolute',
    width: 224,
    height: 224,
    borderRadius: 112,
    borderWidth: 1.2,
  },
  reactorRingMid: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 1,
  },
  reactorRingInner: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 1.2,
  },
  reactorSweep: {
    position: 'absolute',
    width: 92,
    height: 2,
    borderRadius: 1,
  },
  reactorRibbon: {
    position: 'absolute',
    top: 70,
    width: 64,
    height: 154,
    borderRadius: 24,
    transform: [{ skewX: '-16deg' }],
  },
  nodeA: {
    position: 'absolute',
    width: 18,
    height: 18,
    top: 26,
    left: 177,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeB: {
    position: 'absolute',
    width: 16,
    height: 16,
    top: 178,
    left: 51,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeC: {
    position: 'absolute',
    width: 13,
    height: 13,
    top: 107,
    left: 211,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeD: {
    position: 'absolute',
    width: 13,
    height: 13,
    top: 59,
    left: 89,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  nodeCoreA: { width: 8, height: 8, borderRadius: 4 },
  nodeCoreB: { width: 7, height: 7, borderRadius: 3.5 },
  nodeCoreC: { width: 5, height: 5, borderRadius: 2.5 },
  overlayIngredientChip: {
    width: 90,
    marginLeft: -45,
    marginTop: -15,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  chipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipAvatarText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
  },
  orbitAnchor: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  overlayIngredientText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  reactorCore: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactorCoreAura: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  reactorCoreInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  copyBlock: {
    alignItems: 'center',
    width: '100%',
  },
  copyTitle: {
    maxWidth: 252,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 24,
    textAlign: 'center',
  },
  copyDetail: {
    marginTop: 8,
    maxWidth: 262,
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 19,
    textAlign: 'center',
  },
  copyTip: {
    marginTop: 9,
    maxWidth: 248,
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'center',
  },
  phaseLabel: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  phaseProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  phaseProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  loaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

