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
import ProduceBubble from '../components/decor/ProduceBubble';
import KitchenStreakRail from '../components/gamification/KitchenStreakRail';
import { Routes } from '../navigation/routes';
import { getIngredientPacks, type IngredientPack } from '../api/kitchen';
import type { Ingredient } from '../types/alternative';
import { useTranslation } from '../context/I18nContext';
import { useGamification } from '../queries/useGamification';

const CHIP_COLLAPSE_AT = 8;
const BOTTOM_NAV_CLEARANCE = Platform.OS === 'ios' ? 112 : 96;

const MERGE_TEXTS = {
  tr: ['Malzemeler hazırlanıyor', 'Tarif motoru çalışıyor', 'Tarifler bulundu'],
  en: ['Ingredients getting ready', 'Recipe engine running', 'Recipes found'],
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
  const copy = language === 'en'
    ? {
        title: 'Recipes are being prepared',
        detail: `${selectedIngredients.length} ingredients are being matched with the strongest recipes.`,
        tip: 'AI is building the best recipe match for your kitchen.',
      }
    : {
        title: 'Tarifler hazırlanıyor',
        detail: `${selectedIngredients.length} malzeme en uygun tariflerle eşleştiriliyor.`,
        tip: 'AI mutfağındaki en iyi tarifi senin için hazırlıyor.',
      };

  const overlayOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.94);
  const cardTranslateY = useSharedValue(18);
  const textOpacity = useSharedValue(0);
  const spotlightOpacity = useSharedValue(0.2);
  const mergeTexts = MERGE_TEXTS[language];
  const reactorMerge = useReactorMerge(active);
  const sweepStyle = useSweepScan(active);
  const shimmerStyle = useShimmerBand(active);
  const orbitAStyle = useSoftOrbit(active, 0);
  const orbitBStyle = useSoftOrbit(active, 520);
  const orbitCStyle = useSoftOrbit(active, 980);
  const orbitDStyle = useSoftOrbit(active, 1380);
  const orbitChipRadii = [110, 92, 104, 86];
  const orbitChipAngles = [24, 118, 212, 308];

  useEffect(() => {
    if (!active) {
      overlayOpacity.value = withTiming(0, { duration: dur.fast });
      cardScale.value = 0.94;
      cardTranslateY.value = 18;
      textOpacity.value = 0;
      spotlightOpacity.value = 0.2;
      return;
    }

    overlayOpacity.value = withTiming(1, { duration: 220 });
    cardScale.value = withSpring(1, spring.gentle);
    cardTranslateY.value = withSpring(0, spring.standard);
    textOpacity.value = withTiming(1, { duration: 260 });
    spotlightOpacity.value = withTiming(0.5, { duration: 600 });
  }, [active, cardScale, cardTranslateY, overlayOpacity, spotlightOpacity, textOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }, { translateY: cardTranslateY.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));
  const spotlightStyle = useAnimatedStyle(() => ({
    opacity: spotlightOpacity.value,
  }));

  if (!active) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, po.overlay, overlayStyle]}>
      <View style={[po.overlayVeil, { backgroundColor: `${theme.bg}8F` }]} />
      <View style={[po.ambientOrbA, { backgroundColor: `${theme.primary}24` }]} />
      <View style={[po.ambientOrbB, { backgroundColor: `${theme.emerald}20` }]} />
      <Animated.View
        style={[
          po.card,
          {
            backgroundColor: `${theme.surface}F2`,
            borderColor: `${theme.borderEmerald}66`,
          },
          cardStyle,
        ]}
      >
        <Animated.View style={[po.statusRow, textStyle]}>
          <View style={[po.statusDot, { backgroundColor: theme.emerald }]} />
          <Text style={[po.statusText, { color: theme.emerald }]}>
            {mergeTexts[Math.min(mergePhase, mergeTexts.length - 1)]}
          </Text>
        </Animated.View>

        <View style={po.spotlightWrap}>
          <View style={[po.reactorShell, { borderColor: `${theme.borderEmerald}45` }]} />
          <Animated.View
            style={[
              po.spotlightGlow,
              { backgroundColor: `${theme.primary}1E` },
              spotlightStyle,
            ]}
          />
          <Animated.View
            style={[
              po.reactorHalo,
              { backgroundColor: `${theme.primary}12` },
              reactorMerge.haloStyle,
            ]}
          />
          <Animated.View style={[po.reactorRingOuter, { borderColor: `${theme.primary}42` }]} />
          <Animated.View
            style={[
              po.reactorRingMid,
              { borderColor: `${theme.primary}26` },
              reactorMerge.counterRingStyle,
            ]}
          />
          <Animated.View style={[po.reactorRingInner, { borderColor: `${theme.emerald}4C` }]} />
          <Animated.View
            style={[
              po.reactorSweep,
              { backgroundColor: `${theme.primary}38` },
              sweepStyle,
            ]}
          />
          <Animated.View
            style={[
              po.reactorRibbon,
              { backgroundColor: `${theme.surface}66` },
              shimmerStyle,
            ]}
          />
          <Animated.View style={[po.nodeA, orbitAStyle]}>
            <View style={[po.nodeRing, { borderColor: `${theme.primary}55` }]} />
            <View style={[po.nodeCoreA, { backgroundColor: theme.primary }]} />
          </Animated.View>
          <Animated.View style={[po.nodeB, orbitBStyle]}>
            <View style={[po.nodeRing, { borderColor: `${theme.emerald}55` }]} />
            <View style={[po.nodeCoreB, { backgroundColor: theme.emerald }]} />
          </Animated.View>
          <Animated.View style={[po.nodeC, orbitCStyle]}>
            <View style={[po.nodeRing, { borderColor: `${theme.accentCyan}55` }]} />
            <View style={[po.nodeCoreC, { backgroundColor: theme.accentCyan }]} />
          </Animated.View>
          <Animated.View style={[po.nodeD, orbitDStyle]}>
            <View style={[po.nodeRing, { borderColor: `${theme.warning}55` }]} />
            <View style={[po.nodeCoreC, { backgroundColor: theme.warning }]} />
          </Animated.View>
          {selectedIngredients.slice(0, 4).map((ingredient, index) => (
            <OrbitingIngredientChip
              key={`${ingredient.id}-${index}`}
              active={active}
              ingredient={ingredient}
              radius={orbitChipRadii[index]}
              startDeg={orbitChipAngles[index]}
              delay={index * 180}
              theme={theme}
              index={index}
            />
          ))}
          <Animated.View
            style={[
              po.reactorCoreAura,
              { backgroundColor: `${theme.primary}18` },
              spotlightStyle,
            ]}
          />
          <Animated.View
            style={[
              po.reactorCore,
              {
                backgroundColor: theme.surface,
                borderColor: `${theme.borderEmerald}CC`,
              },
              reactorMerge.coreStyle,
            ]}
          >
            <View style={[po.reactorCoreInner, { backgroundColor: theme.primary }]} />
          </Animated.View>
        </View>

        <Animated.View style={[po.copyBlock, textStyle]}>
          <Text style={[po.copyTitle, { color: theme.text }]}>{copy.title}</Text>
          <Text style={[po.copyDetail, { color: theme.textMuted }]}>{copy.detail}</Text>
          <Text style={[po.copyTip, { color: theme.emerald }]}>{copy.tip}</Text>
          <Text style={[po.phaseLabel, { color: theme.textMuted }]}>
            {mergeTexts[Math.min(mergePhase, mergeTexts.length - 1)]}
          </Text>
          <View style={po.phaseProgressRow}>
            {mergeTexts.map((label, index) => {
              const activeStep = index <= mergePhase;
              return (
                <View
                  key={label}
                  style={[
                    po.phaseProgressDot,
                    {
                      backgroundColor: activeStep ? theme.primary : `${theme.border}88`,
                      borderColor: activeStep ? `${theme.primary}40` : `${theme.border}44`,
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={po.loaderRow}>
            {[0, 1, 2].map(index => (
              <Animated.View
                key={index}
                entering={FadeIn.delay(index * 120).duration(dur.fast)}
                style={[
                  po.loaderDot,
                  { backgroundColor: index === 1 ? theme.primary : theme.emerald },
                ]}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

export default function KitchenScreen({
  selectedIngredients,
  onChangeSelected,
  openQuickSheet,
}: {
  selectedIngredients: Ingredient[];
  onChangeSelected: (v: Ingredient[]) => void;
  openQuickSheet: () => void;
}) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t, language } = useTranslation();
  const { data: gamification } = useGamification();

  const copy = language === 'en'
    ? {
        active: 'active',
        quick: 'Quick',
        search: 'INGREDIENT SEARCH',
        selectedIngredients: 'SELECTED INGREDIENTS',
        collapse: 'Collapse',
        more: 'more',
        clear: 'Clear',
        reactorTitle: 'AI Recipe Lab',
        reactorReady: `${selectedIngredients.length} ingredients ready for analysis`,
        reactorWaiting: 'Idle mode - add ingredients',
        reactorHintReady: 'Tap the pot to find recipes',
        reactorHintIdle: 'AI analyzes ingredient compatibility',
        reactorAction: 'Find Recipes',
        reactorActionSub: 'Tap to launch AI search',
        reactorModeLive: 'Live',
        reactorModeReady: 'AI ready',
        reactorModeIdle: 'Idle',
        reactorLocked: `${selectedIngredients.length} items ready`,
        reactorWaitingLabel: 'Waiting for ingredients',
        quickStart: 'Quick Start',
        quickStartSub: 'Add to your kitchen in one tap',
        packs: 'packs',
        add: 'Add',
      }
    : {
        active: 'aktif',
        quick: 'Hızlı',
        search: 'MALZEME SORGUSU',
        selectedIngredients: 'SEÇİLEN MALZEMELER',
        collapse: 'Daralt',
        more: 'daha',
        clear: 'Temizle',
        reactorTitle: 'AI Tarif Laboratuvari',
        reactorReady: `${selectedIngredients.length} malzeme analiz için hazır`,
        reactorWaiting: 'Beklemede - malzeme ekle',
        reactorHintReady: 'Tarif bulmak için tencereye dokun',
        reactorHintIdle: 'AI motoru malzeme uyumunu analiz eder',
        reactorAction: 'Tarif Bul',
        reactorActionSub: 'AI aramasını başlat',
        reactorModeLive: 'Canlı',
        reactorModeReady: 'AI hazır',
        reactorModeIdle: 'Beklemede',
        reactorLocked: `${selectedIngredients.length} malzeme hazır`,
        reactorWaitingLabel: 'Malzeme bekleniyor',
        quickStart: 'Hızlı Başlangıç',
        quickStartSub: 'Bir dokunuşla mutfağa ekle',
        packs: 'paket',
        add: 'Ekle',
      };

  const [packs, setPacks] = useState<IngredientPack[]>([]);
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergePhase, setMergePhase] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [searchPrefill, setSearchPrefill] = useState('');
  const [searchPrefillKey, setSearchPrefillKey] = useState(0);

  const hasIngredients = selectedIngredients.length > 0;
  const hiddenCount = Math.max(0, selectedIngredients.length - CHIP_COLLAPSE_AT);
  const compactMode = !chipsExpanded && selectedIngredients.length > CHIP_COLLAPSE_AT;
  const displayedIngredients = compactMode
    ? selectedIngredients.slice(0, CHIP_COLLAPSE_AT)
    : selectedIngredients;
  const headerStyle = useScaleSettle(20, 0.98);
  const workspaceStyle = useScaleSettle(70, 0.985);
  const packsStyle = useFadeRise(120, 12);

  const reactorIdle = useReactorIdle(!merging);
  const reactorMerge = useReactorMerge(merging);
  const sweepStyle = useSweepScan(true);          // always scanning
  const shimmerStyle = useShimmerBand(true);       // always shimmering
  const orbitAStyle = useIdleOrbit(hasIngredients || merging, 0);
  const orbitBStyle = useIdleOrbit(hasIngredients || merging, 620);
  const orbitCStyle = useIdleOrbit(hasIngredients || merging, 1080);
  const orbitDStyle = useIdleOrbit(hasIngredients || merging, 1480);
  const potFloatStyle = useFloating(0, merging ? 6 : 3, merging ? 1500 : 2400);
  const potAuraStyle = usePulseRing(hasIngredients || merging, merging ? 1.22 : 1.1, merging ? 900 : 1800);
  const coreTouchScale = useSharedValue(1);
  const corePulseScale = useSharedValue(hasIngredients ? 1 : 0.92);
  const corePulseOpacity = useSharedValue(hasIngredients ? 0.4 : 0.18);
  const lockRingOpacity = useSharedValue(hasIngredients ? 1 : 0.48);
  const coreTouchStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coreTouchScale.value }],
  }));
  const corePulseStyle = useAnimatedStyle(() => ({
    opacity: corePulseOpacity.value,
    transform: [{ scale: corePulseScale.value }],
  }));
  const lockRingStyle = useAnimatedStyle(() => ({
    opacity: lockRingOpacity.value,
  }));

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
    getIngredientPacks().then(setPacks);
  }, []);

  useEffect(() => {
    if (selectedIngredients.length <= CHIP_COLLAPSE_AT) {
      setChipsExpanded(false);
    }
  }, [selectedIngredients.length]);

  useEffect(() => {
    cancelAnimation(corePulseScale);
    cancelAnimation(corePulseOpacity);
    cancelAnimation(lockRingOpacity);

    if (merging) {
      corePulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 480 }),
          withTiming(0.98, { duration: 420 }),
        ),
        -1,
        false,
      );
      corePulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.64, { duration: 480 }),
          withTiming(0.24, { duration: 420 }),
        ),
        -1,
        false,
      );
      lockRingOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 360 }),
          withTiming(0.62, { duration: 360 }),
        ),
        -1,
        false,
      );
      return;
    }

    if (hasIngredients) {
      corePulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1200 }),
          withTiming(0.98, { duration: 1200 }),
        ),
        -1,
        false,
      );
      corePulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.46, { duration: 1200 }),
          withTiming(0.2, { duration: 1200 }),
        ),
        -1,
        false,
      );
      lockRingOpacity.value = withTiming(1, { duration: dur.medium });
      return;
    }

    corePulseScale.value = withTiming(0.92, { duration: dur.medium });
    corePulseOpacity.value = withTiming(0.16, { duration: dur.medium });
    lockRingOpacity.value = withTiming(0.42, { duration: dur.fast });
  }, [
    corePulseOpacity,
    corePulseScale,
    hasIngredients,
    lockRingOpacity,
    merging,
  ]);

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

  function addPack(pack: IngredientPack) {
    const toAdd = pack.items
      .filter(item => !selectedIngredients.some(selected => selected.id === item.id))
      .map<Ingredient>(item => ({ id: item.id, canonicalName: item.name }));

    if (toAdd.length > 0) {
      onChangeSelected([...selectedIngredients, ...toAdd]);
    }
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
      onConfirm: (ingredients: Ingredient[]) => {
        appendIngredients(ingredients);
      },
      onUseSearchTerm: handleSearchFallback,
    });
  }

  function handleMerge() {
    if (!hasIngredients || merging) return;

    setMerging(true);
    setMergePhase(0);

    const phaseTimer = setInterval(() => {
      setMergePhase(prev => Math.min(prev + 1, MERGE_TEXTS[language].length - 1));
    }, 760);

    setTimeout(() => {
      clearInterval(phaseTimer);
      setMerging(false);
      (nav as any).navigate(Routes.App.KitchenResult, {
        ingredientIds: selectedIngredients.map(item => item.id),
        ingredientNames: selectedIngredients.map(item => item.canonicalName),
      });
    }, 2500);
  }

  function handleCorePressIn() {
    coreTouchScale.value = withSpring(0.94, spring.snappy);
  }

  function handleCorePressOut() {
    coreTouchScale.value = withSpring(1, spring.playful);
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 16}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={32}
        iconColor={`${theme.primary}42`}
        style={[s.screenGlowA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="carrot"
        iconSize={28}
        iconColor={`${theme.emerald}42`}
        style={[s.screenGlowB, { backgroundColor: theme.emeraldGlow }]}
      />

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
          <ProduceBubble
            icon="fruit-pear"
            iconSize={22}
            iconColor={`${theme.primary}34`}
            style={[s.wsHeaderGlow, { backgroundColor: `${theme.primary}14` }]}
          />
          <ProduceBubble
            icon="leaf"
            iconSize={18}
            iconColor={`${theme.emerald}34`}
            style={[s.wsHeaderGlowB, { backgroundColor: `${theme.emerald}10` }]}
          />
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
                <Text style={[s.wsTitle, { color: theme.text }]}>{t.kitchen.title}</Text>
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
          <View style={[s.reactorSection, { borderTopColor: `${theme.border}88` }]}> 
            <View style={s.reactorHeader}>
              <View style={s.reactorHeaderText}>
                <Text style={[s.reactorTitle, { color: theme.text }]}>{copy.reactorTitle}</Text>
                <Text style={[s.reactorSub, { color: theme.textMuted }]}> 
                  {hasIngredients ? copy.reactorReady : copy.reactorWaiting}
                </Text>
              </View>

              <Animated.View
                entering={FadeIn.duration(dur.fast)}
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
              </Animated.View>
            </View>

            <View style={s.reactorActionShell}>
              <Animated.View
                style={[
                  s.reactorCanvas,
                  {
                    backgroundColor: `${theme.surfaceElevated}D8`,
                    borderColor: `${theme.borderEmerald}50`,
                  },
                ]}
              >
                <View style={[s.reactorCanvasGlowA, { backgroundColor: `${theme.primary}0E` }]} />
                <View style={[s.reactorCanvasGlowB, { backgroundColor: `${theme.emerald}10` }]} />

                <View style={s.reactorTopRow}>
                  <View
                    style={[
                      s.reactorSignalPill,
                      {
                        backgroundColor: `${theme.surface}D8`,
                        borderColor: `${theme.borderEmerald}42`,
                      },
                    ]}
                  >
                    <View style={[s.reactorSignalDot, { backgroundColor: theme.emerald }]} />
                    <Text style={[s.reactorSignalText, { color: theme.text }]} numberOfLines={1}>
                      {hasIngredients ? copy.reactorLocked : copy.reactorWaitingLabel}
                    </Text>
                  </View>
                </View>

                <Animated.View
                  style={[
                    s.reactorHalo,
                    { backgroundColor: `${theme.primary}14` },
                    reactorMerge.haloStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    s.reactorRingOuter,
                    { borderColor: hasIngredients ? `${theme.primary}58` : `${theme.primary}2E` },
                    reactorIdle.ringStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    s.reactorRingMid,
                    { borderColor: hasIngredients ? `${theme.primary}36` : `${theme.primary}1A` },
                    reactorMerge.counterRingStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    s.reactorRingInner,
                    { borderColor: hasIngredients ? `${theme.emerald}62` : `${theme.emerald}30` },
                    reactorIdle.ringStyle,
                  ]}
                />

                {/* Ghost orbit chips — always visible decorative orbs */}
                {GHOST_ITEMS.map((g, i) => (
                  <GhostOrbitChip
                    key={i}
                    icon={g.icon}
                    radius={g.radius}
                    startDeg={g.startDeg}
                    speed={g.speed}
                    hasIngredients={hasIngredients}
                    theme={theme}
                  />
                ))}
                <Animated.View
                  style={[
                    s.reactorSweep,
                    { backgroundColor: `${theme.primary}32` },
                    sweepStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    s.reactorShimmerRibbon,
                    { backgroundColor: `${theme.surface}66` },
                    shimmerStyle,
                  ]}
                />
                <Animated.View style={[s.reactorNodeA, orbitAStyle]}>
                  <View style={[s.nodeRing, { borderColor: `${theme.primary}50` }]} />
                  <View style={[s.nodeCoreA, { backgroundColor: theme.primary }]} />
                </Animated.View>
                <Animated.View style={[s.reactorNodeB, orbitBStyle]}>
                  <View style={[s.nodeRing, { borderColor: `${theme.emerald}50` }]} />
                  <View style={[s.nodeCoreB, { backgroundColor: theme.emerald }]} />
                </Animated.View>
                <Animated.View style={[s.reactorNodeC, orbitCStyle]}>
                  <View style={[s.nodeRing, { borderColor: `${theme.accentCyan}50` }]} />
                  <View style={[s.nodeCoreC, { backgroundColor: theme.accentCyan }]} />
                </Animated.View>
                <Animated.View style={[s.reactorNodeD, orbitDStyle]}>
                  <View style={[s.nodeRing, { borderColor: `${theme.warning}50` }]} />
                  <View style={[s.nodeCoreC, { backgroundColor: theme.warning }]} />
                </Animated.View>
                <Animated.View
                  style={[
                    s.reactorCorePulse,
                    { backgroundColor: `${theme.primary}16` },
                    corePulseStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    s.reactorLockRing,
                    { borderColor: `${theme.emerald}55` },
                    lockRingStyle,
                  ]}
                />

                <TouchableOpacity
                  activeOpacity={1}
                  disabled={!hasIngredients || merging}
                  onPress={handleMerge}
                  onPressIn={handleCorePressIn}
                  onPressOut={handleCorePressOut}
                  style={s.reactorCoreTouch}
                >
                  <Animated.View
                    style={[
                      s.reactorPotAura,
                      { backgroundColor: `${theme.primary}12` },
                      potAuraStyle,
                    ]}
                  />
                  <Animated.View
                    style={[
                      s.reactorSteamColumn,
                      s.reactorSteamColumnA,
                      { borderColor: `${theme.primary}30` },
                      orbitAStyle,
                    ]}
                  />
                  <Animated.View
                    style={[
                      s.reactorSteamColumn,
                      s.reactorSteamColumnB,
                      { borderColor: `${theme.emerald}30` },
                      orbitBStyle,
                    ]}
                  />
                  <Animated.View
                    style={[
                      s.reactorSteamColumn,
                      s.reactorSteamColumnC,
                      { borderColor: `${theme.accentCyan}30` },
                      orbitCStyle,
                    ]}
                  />
                  <Animated.View
                    style={[
                      s.reactorCore,
                      {
                        backgroundColor: theme.surface,
                        borderColor: hasIngredients
                          ? `${theme.borderEmerald}CC`
                          : `${theme.border}AA`,
                      },
                      hasIngredients ? reactorMerge.coreStyle : null,
                      reactorIdle.coreStyle,
                      coreTouchStyle,
                      potFloatStyle,
                    ]}
                  >
                    <View style={s.reactorPotStack}>
                      <View style={[s.reactorSteamRow, s.reactorSteamRowTop]}>
                        <View
                          style={[
                            s.reactorSteamPuff,
                            { backgroundColor: hasIngredients ? `${theme.primary}32` : `${theme.border}44` },
                          ]}
                        />
                        <View
                          style={[
                            s.reactorSteamPuff,
                            s.reactorSteamPuffTall,
                            { backgroundColor: hasIngredients ? `${theme.emerald}2A` : `${theme.border}40` },
                          ]}
                        />
                        <View
                          style={[
                            s.reactorSteamPuff,
                            { backgroundColor: hasIngredients ? `${theme.primary}26` : `${theme.border}3A` },
                          ]}
                        />
                      </View>
                      <MaterialCommunityIcons
                        name="pot-steam-outline"
                        size={58}
                        color={hasIngredients ? theme.primary : theme.textMuted}
                      />
                      <Text
                        style={[
                          s.reactorPotTitle,
                          { color: hasIngredients ? theme.text : theme.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        {copy.reactorAction}
                      </Text>
                      <Text
                        style={[
                          s.reactorCoreSub,
                          { color: hasIngredients ? theme.primary : `${theme.textMuted}BB` },
                        ]}
                        numberOfLines={2}
                      >
                        {hasIngredients ? copy.reactorActionSub : t.kitchen.noIngredients}
                      </Text>
                    </View>
                  </Animated.View>
                </TouchableOpacity>

                <View style={s.reactorFooter}>
                  <View
                    style={[
                      s.reactorFooterPill,
                      {
                        backgroundColor: `${theme.surface}C8`,
                        borderColor: `${theme.borderEmerald}44`,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="pot-steam-outline" size={14} color={theme.emerald} />
                    <Text style={[s.reactorFooterText, { color: theme.emerald }]} numberOfLines={1}>
                      {merging
                        ? copy.reactorModeLive
                        : hasIngredients
                          ? copy.reactorModeReady
                          : copy.reactorModeIdle}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            </View>

            <Text style={[s.reactorHint, { color: `${theme.textMuted}B8` }]}>
              {hasIngredients ? copy.reactorHintReady : copy.reactorHintIdle}
            </Text>
          </View>
        </Animated.View>

        {packs.length > 0 && (
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

              <View
                style={[
                  s.packSectionBadge,
                  {
                    backgroundColor: `${theme.warning}18`,
                    borderColor: `${theme.warning}35`,
                  },
                ]}
              >
                <Text style={[s.packSectionBadgeTxt, { color: theme.warning }]}>
                  {packs.length} {copy.packs}
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.packRow}
              decelerationRate="fast"
              snapToInterval={164}
              snapToAlignment="start"
            >
              {packs.map((pack, index) => (
                <PackTile
                  key={pack.id}
                  pack={pack}
                  index={index}
                  theme={theme}
                  addLabel={copy.add}
                  onPress={() => addPack(pack)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        <View style={s.scrollBottomPad} />
      </ScrollView>

      <ReactorSearchOverlay
        active={merging}
        mergePhase={mergePhase}
        selectedIngredients={selectedIngredients}
        theme={theme}
        language={language}
      />
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
      style={animatedStyle}
      entering={FadeInRight.delay(index * 22).duration(dur.base)}
      exiting={ZoomOut.duration(dur.fast)}
      layout={Layout.springify()}
    >
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
  );
}

const PACK_EMOJIS = ['??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '??'];

function PackTile({
  pack,
  index,
  theme,
  addLabel,
  onPress,
}: {
  pack: IngredientPack;
  index: number;
  theme: Theme;
  addLabel: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const shimmerStyle = useShimmerBand(true);

  const colors = [
    theme.primary,
    theme.emerald,
    theme.accentGold,
    theme.accentCoral,
    theme.accentCyan,
    theme.warning,
  ];
  const accent = colors[index % colors.length];
  const emoji = PACK_EMOJIS[index % PACK_EMOJIS.length];
  const preview = pack.items.slice(0, 3).map(item => item.name).join(', ');

  return (
    <Animated.View style={animatedStyle} entering={FadeInRight.delay(70 + index * 50).duration(dur.base)}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.96, spring.snappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, spring.snappy);
        }}
        activeOpacity={1}
        style={[
          s.packTile,
          {
            backgroundColor: theme.surface,
            borderColor: `${accent}30`,
          },
        ]}
      >
        <View style={[s.packHero, { backgroundColor: `${accent}12` }]}>
          <View style={[s.packAccentLine, { backgroundColor: accent }]} />
          <View style={[s.packCircleLg, { backgroundColor: `${accent}18` }]} />
          <View style={[s.packCircleSm, { backgroundColor: `${accent}10` }]} />
          <Animated.View style={[s.packShimmer, shimmerStyle]} pointerEvents="none" />
          <Text style={s.packEmoji}>{emoji}</Text>
          <View style={[s.packCountPill, { backgroundColor: accent }]}>
            <Text style={s.packCountTxt}>{pack.items.length}</Text>
          </View>
        </View>

        <View style={s.packContent}>
          <Text style={[s.packName, { color: theme.text }]} numberOfLines={2}>
            {pack.name}
          </Text>
          {!!preview && (
            <Text style={[s.packPreview, { color: theme.textMuted }]} numberOfLines={2}>
              {preview}
              {pack.items.length > 3 ? '...' : ''}
            </Text>
          )}
          <View
            style={[
              s.packCta,
              {
                backgroundColor: `${accent}12`,
                borderColor: `${accent}28`,
              },
            ]}
          >
            <Text style={[s.packCtaTxt, { color: accent }]}>{addLabel}</Text>
            <Ionicons name="add-circle" size={13} color={accent} />
          </View>
        </View>
      </TouchableOpacity>
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
  wsTitleBlock: { flex: 1 },
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
  packRow: { gap: 10, paddingBottom: 4, paddingRight: spacing.base },
  packTile: {
    width: 154,
    borderWidth: 1.2,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  packHero: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  packAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  packCircleLg: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    top: -28,
    right: -24,
  },
  packCircleSm: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    bottom: -16,
    left: -16,
  },
  packShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.32)',
    transform: [{ skewX: '-15deg' }],
  },
  packEmoji: { fontSize: 38, lineHeight: 46 },
  packCountPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    minWidth: 24,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  packCountTxt: { fontSize: 10, fontWeight: '900', color: '#fff' },
  packContent: { padding: 10, paddingTop: 9 },
  packName: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    marginBottom: 4,
  },
  packPreview: {
    fontSize: 10.5,
    fontWeight: '500',
    lineHeight: 14.5,
    marginBottom: 9,
  },
  packCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  packCtaTxt: { fontSize: 11.5, fontWeight: '800' },
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

