import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { radii, spacing, type Theme } from "../../theme/tokens";

const PHASES = {
  tr: ["Malzemeler tencerede", "Aromalar yükseliyor", "Tarif servis ediliyor"],
  en: ["Ingredients in the pot", "Flavors are rising", "Recipe is plating"],
} as const;

const ACCENT_KEYS = ["primary", "emerald", "accentGold", "accentCyan", "accentCoral"] as const;
const INGREDIENT_LANES = [-66, -28, 18, 54, -46, 32] as const;

function compactIngredientName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 9)}...`;
}

function SteamPuff({
  active,
  delay,
  theme,
  offsetX,
  width,
  height,
}: {
  active: boolean;
  delay: number;
  theme: Theme;
  offsetX: number;
  width: number;
  height: number;
}) {
  const progress = useSharedValue(-1);

  useEffect(() => {
    if (!active) {
      progress.value = -1;
      return;
    }

    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
          withTiming(-1, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
  }, [active, delay, progress]);

  const style = useAnimatedStyle(() => {
    if (progress.value < 0) {
      return {
        opacity: 0,
        transform: [{ translateX: offsetX }, { translateY: 0 }, { scale: 0.82 }],
      };
    }

    return {
      opacity: 0.08 + (1 - progress.value) * 0.44,
      transform: [
        { translateX: offsetX + (offsetX >= 0 ? 1 : -1) * progress.value * 10 },
        { translateY: -progress.value * 126 },
        { scale: 0.84 + progress.value * 1.06 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        s.steamPuff,
        {
          width,
          height,
          backgroundColor: `${theme.surface}D9`,
          borderColor: `${theme.borderEmerald}55`,
        },
        style,
      ]}
    />
  );
}

function IngredientSpirit({
  active,
  ingredient,
  delay,
  theme,
  index,
}: {
  active: boolean;
  ingredient: string;
  delay: number;
  theme: Theme;
  index: number;
}) {
  const progress = useSharedValue(-1);
  const lane = INGREDIENT_LANES[index % INGREDIENT_LANES.length];
  const drift = lane >= 0 ? 1 : -1;
  const accentKey = ACCENT_KEYS[index % ACCENT_KEYS.length];
  const accent = theme[accentKey];
  const initial = ingredient.trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!active) {
      progress.value = -1;
      return;
    }

    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 1880, easing: Easing.out(Easing.cubic) }),
    );
  }, [active, delay, progress]);

  const style = useAnimatedStyle(() => {
    if (progress.value < 0) {
      return {
        opacity: 0,
        transform: [
          { translateX: lane },
          { translateY: 10 },
          { rotate: "0deg" },
          { scale: 0.76 },
        ],
      };
    }

    return {
      opacity: 0.12 + (1 - progress.value) * 0.84,
      transform: [
        { translateX: lane + drift * progress.value * 18 },
        { translateY: 18 - progress.value * 194 },
        { rotate: `${drift * (9 - progress.value * 16)}deg` },
        { scale: 0.76 + (1 - progress.value) * 0.18 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        s.ingredientSpirit,
        {
          backgroundColor: `${theme.surface}F2`,
          borderColor: `${accent}52`,
          shadowColor: accent,
        },
        style,
      ]}
    >
      <View style={[s.ingredientBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}52` }]}>
        <Text style={[s.ingredientBadgeTxt, { color: accent }]}>{initial}</Text>
      </View>
      <Text style={[s.ingredientSpiritTxt, { color: theme.text }]} numberOfLines={1}>
        {compactIngredientName(ingredient)}
      </Text>
    </Animated.View>
  );
}

export default function RecipeSearchStage({
  theme,
  ingredientNames,
  language,
  phase = 0,
}: {
  theme: Theme;
  ingredientNames: string[];
  language: "tr" | "en";
  phase?: number;
}) {
  const phaseLabels = PHASES[language];
  const phaseLabelsResolved = language === "tr"
    ? ["Malzemeler tencerede", "Aromalar yükseliyor", "Tarif hazırlanıyor"]
    : phaseLabels;
  const activePhase = phaseLabelsResolved[Math.min(phase, phaseLabelsResolved.length - 1)];
  const sceneTitle = language === "tr" ? "Tarif kazanı ısınıyor" : "The recipe pot is simmering";
  const sceneDetail = language === "tr"
      ? `${ingredientNames.length} malzeme kapağın altında buluşuyor. Yapay zekâ şimdi en uyumlu tarifi hazırlıyor.`
    : `${ingredientNames.length} ingredients are blending under the lid while AI pulls out the best recipe.`;
  const sceneFooter = language === "tr"
    ? "Seçilen malzemeler buharla birlikte sırayla yükseliyor"
    : "Selected ingredients are rising with the steam";
  const ingredientCountLabelResolved = language === "tr"
    ? `${ingredientNames.length} malzeme kazanın içinde`
    : `${ingredientNames.length} ingredients in the pot`;
  const title = language === "tr" ? "Tarif kazanı kaynıyor" : "The recipe pot is simmering";
  const detail = language === "tr"
    ? `${ingredientNames.length} malzeme kapağın altında birleşiyor. AI şimdi en uyumlu tarifi çıkarıyor.`
    : `${ingredientNames.length} ingredients are blending under the lid while AI pulls out the best recipe.`;
  const footer = language === "tr"
    ? "Seçilen malzemeler buharla birlikte yükseliyor"
    : "Selected ingredients are rising with the steam";
  const ingredientCountLabel = language === "tr"
    ? `${ingredientNames.length} malzeme kazan içinde`
    : `${ingredientNames.length} ingredients in the pot`;

  const lidLift = useSharedValue(0);
  const brothWave = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const auraPulse = useSharedValue(0);
  const burnerGlow = useSharedValue(0);
  const flamePulse = useSharedValue(0);
  const flameFlicker = useSharedValue(0);
  const displayPhaseLabels = language === "tr"
    ? ["Malzemeler tencerede", "Aromalar y\u00FCkseliyor", "Tarif haz\u0131rlan\u0131yor"]
    : phaseLabels;
  const displayActivePhase = displayPhaseLabels[Math.min(phase, displayPhaseLabels.length - 1)];
  const displayTitle = language === "tr"
    ? "Tarif kazan\u0131 \u0131s\u0131n\u0131yor"
    : "The recipe pot is simmering";
  const displayDetail = language === "tr"
    ? `${ingredientNames.length} malzeme kapa\u011F\u0131n alt\u0131nda bulu\u015Fuyor. Yapay zek\u00E2 \u015Fimdi en uyumlu tarifi haz\u0131rl\u0131yor.`
    : `${ingredientNames.length} ingredients are blending under the lid while AI pulls out the best recipe.`;
  const displayFooter = language === "tr"
    ? "Se\u00E7ilen malzemeler buharla birlikte s\u0131rayla y\u00FCkseliyor"
    : "Selected ingredients are rising with the steam";
  const displayIngredientCountLabel = language === "tr"
    ? `${ingredientNames.length} malzeme kazan\u0131n i\u00E7inde`
    : `${ingredientNames.length} ingredients in the pot`;

  useEffect(() => {
    lidLift.value = 0;
    lidLift.value = withDelay(
      460,
      withSequence(
        withTiming(1, { duration: 1080, easing: Easing.out(Easing.cubic) }),
        withRepeat(
          withSequence(
            withTiming(0.93, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
            withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        ),
      ),
    );
    brothWave.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    auraPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [auraPulse, brothWave, glowPulse, lidLift]);

  useEffect(() => {
    const finalPhase = displayPhaseLabels.length - 1;
    const fireShouldBurn = phase < finalPhase;

    if (fireShouldBurn) {
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

    burnerGlow.value = withTiming(0, { duration: 820, easing: Easing.out(Easing.quad) });
    flamePulse.value = withTiming(0, { duration: 760, easing: Easing.out(Easing.quad) });
    flameFlicker.value = withTiming(0, { duration: 760, easing: Easing.out(Easing.quad) });
  }, [burnerGlow, displayPhaseLabels.length, flameFlicker, flamePulse, phase]);

  const lidStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -lidLift.value * 34 },
      { translateX: lidLift.value * 6 },
      { rotate: `${-lidLift.value * 9}deg` },
    ],
  }));

  const brothStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -8 + brothWave.value * 16 }],
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -4 + brothWave.value * 8 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + glowPulse.value * 0.18,
    transform: [{ scale: 0.96 + glowPulse.value * 0.16 }],
  }));

  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + auraPulse.value * 0.16,
    transform: [{ scale: 0.94 + auraPulse.value * 0.18 }],
  }));

  const burnerGlowStyle = useAnimatedStyle(() => ({
    opacity: burnerGlow.value * 0.76,
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

  return (
    <View style={s.root}>
      <View style={[s.ambientOrbA, { backgroundColor: `${theme.primary}1E` }]} />
      <View style={[s.ambientOrbB, { backgroundColor: `${theme.emerald}18` }]} />
      <Animated.View style={[s.centralGlow, { backgroundColor: `${theme.primary}12` }, glowStyle]} />

      <View style={[s.statusPill, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
        <View style={[s.statusDot, { backgroundColor: theme.emerald }]} />
        <Text style={[s.statusTxt, { color: theme.emerald }]}>{displayActivePhase}</Text>
      </View>

      <View style={s.sceneWrap}>
        <View style={[s.sceneSpark, s.sceneSparkA, { backgroundColor: `${theme.accentGold}78` }]} />
        <View style={[s.sceneSpark, s.sceneSparkB, { backgroundColor: `${theme.accentCyan}68` }]} />
        <View style={[s.counterGlow, { backgroundColor: `${theme.primary}16` }]} />
        <View style={[s.counterTop, { backgroundColor: `${theme.surfaceElevated}F0`, borderColor: `${theme.borderEmerald}72` }]} />
        <View style={[s.counterLip, { backgroundColor: `${theme.surface}E8` }]} />

        {ingredientNames.slice(0, 4).map((ingredient, index) => (
          <IngredientSpirit
            key={`${ingredient}-${index}`}
            active
            ingredient={ingredient}
            delay={1420 + index * 320}
            theme={theme}
            index={index}
          />
        ))}

        <Animated.View style={[s.auraHalo, { backgroundColor: `${theme.primary}14` }, auraStyle]} />

        <View style={s.steamLayer}>
          <SteamPuff active delay={1160} theme={theme} offsetX={-26} width={18} height={34} />
          <SteamPuff active delay={1480} theme={theme} offsetX={18} width={20} height={40} />
        </View>

        <Animated.View style={[s.lidWrap, lidStyle]}>
          <View style={[s.lidTop, { backgroundColor: theme.surface, borderColor: `${theme.borderEmerald}B5` }]} />
          <View style={[s.lidKnob, { backgroundColor: theme.accentGold, borderColor: `${theme.accentGold}55` }]} />
          <View style={[s.lidHighlight, { backgroundColor: `${theme.surfaceElevated}CC` }]} />
        </Animated.View>

        <View style={[s.potHandle, s.potHandleLeft, { borderColor: `${theme.borderEmerald}86` }]} />
        <View style={[s.potHandle, s.potHandleRight, { borderColor: `${theme.borderEmerald}86` }]} />
        <View style={[s.potShadow, { backgroundColor: `${theme.primary}18` }]} />
        <View style={[s.stovePlate, { backgroundColor: `${theme.surface}EC`, borderColor: `${theme.border}74` }]} />
        <Animated.View style={[s.stoveBurnerGlow, { backgroundColor: `${theme.warning}34` }, burnerGlowStyle]} />
        <Animated.View style={[s.stoveBurner, { borderColor: `${theme.borderEmerald}40`, backgroundColor: `${theme.surfaceElevated}D8` }, burnerRingStyle]} />
        <View style={s.stoveFlameTray}>
          <Animated.View style={[s.stoveFlame, s.stoveFlameLeft, { backgroundColor: theme.warning }, flameLeftStyle]} />
          <Animated.View style={[s.stoveFlame, s.stoveFlameCenter, { backgroundColor: theme.accentGold }, flameCenterStyle]} />
          <Animated.View style={[s.stoveFlame, s.stoveFlameRight, { backgroundColor: theme.warning }, flameRightStyle]} />
          <Animated.View style={[s.stoveFlame, s.stoveFlameOuterLeft, { backgroundColor: theme.warning }, flameLeftStyle]} />
          <Animated.View style={[s.stoveFlame, s.stoveFlameOuterRight, { backgroundColor: theme.warning }, flameRightStyle]} />
        </View>
        <View style={[s.potBase, { backgroundColor: `${theme.surfaceElevated}E6`, borderColor: `${theme.border}78` }]} />

        <View style={[s.potBody, { backgroundColor: theme.surface, borderColor: `${theme.borderEmerald}D2`, shadowColor: theme.shadowEmerald }]}>
          <View style={[s.potHighlight, { backgroundColor: `${theme.surfaceElevated}D4` }]} />
          <View style={[s.potRim, { borderColor: `${theme.borderEmerald}A6` }]} />
          <View style={[s.brothMask, { backgroundColor: `${theme.primary}14` }]}>
            <Animated.View style={[s.brothFill, { backgroundColor: `${theme.primary}2C` }, brothStyle]}>
              <Animated.View style={[s.brothSurface, { backgroundColor: `${theme.primary}8A` }, surfaceStyle]} />
              <View style={[s.brothBubble, s.brothBubbleA, { backgroundColor: `${theme.surface}D9` }]} />
              <View style={[s.brothBubble, s.brothBubbleB, { backgroundColor: `${theme.surface}C8` }]} />
              <View style={[s.brothBubble, s.brothBubbleC, { backgroundColor: `${theme.surface}BD` }]} />
            </Animated.View>
          </View>
        </View>
      </View>

      <View style={[s.ingredientCountPill, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
        <MaterialCommunityIcons name="basket-outline" size={14} color={theme.primary} />
        <Text style={[s.ingredientCountTxt, { color: theme.textSub }]}>{displayIngredientCountLabel}</Text>
      </View>

      <Text style={[s.title, { color: theme.text }]}>{displayTitle}</Text>
      <Text style={[s.detail, { color: theme.textSub }]}>{displayDetail}</Text>

      <View style={s.phaseRow}>
        {displayPhaseLabels.map((label, index) => {
          const isActive = index <= phase;
          return (
            <View
              key={label}
              style={[
                s.phaseDot,
                {
                  backgroundColor: isActive ? theme.primary : `${theme.border}A0`,
                  borderColor: isActive ? `${theme.primary}3A` : `${theme.border}50`,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={[s.footerPill, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
        <MaterialCommunityIcons name="pot-steam-outline" size={14} color={theme.emerald} />
        <Text style={[s.footerTxt, { color: theme.textSub }]}>{displayFooter}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  ambientOrbA: {
    position: "absolute",
    top: "18%",
    right: -26,
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  ambientOrbB: {
    position: "absolute",
    bottom: "20%",
    left: -30,
    width: 148,
    height: 148,
    borderRadius: 74,
  },
  centralGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 18,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTxt: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  sceneWrap: {
    width: 320,
    height: 330,
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 18,
  },
  sceneSpark: {
    position: "absolute",
    borderRadius: 999,
  },
  sceneSparkA: {
    top: 54,
    left: 52,
    width: 10,
    height: 10,
  },
  sceneSparkB: {
    top: 82,
    right: 58,
    width: 7,
    height: 7,
  },
  counterGlow: {
    position: "absolute",
    bottom: 26,
    width: 240,
    height: 42,
    borderRadius: 21,
  },
  counterTop: {
    position: "absolute",
    bottom: 16,
    width: 258,
    height: 34,
    borderRadius: 18,
    borderWidth: 1,
  },
  counterLip: {
    position: "absolute",
    bottom: 38,
    width: 226,
    height: 10,
    borderRadius: 5,
  },
  auraHalo: {
    position: "absolute",
    bottom: 42,
    width: 218,
    height: 218,
    borderRadius: 109,
  },
  steamLayer: {
    position: "absolute",
    top: 22,
    width: 210,
    height: 142,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  steamPuff: {
    position: "absolute",
    bottom: 0,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  lidWrap: {
    position: "absolute",
    bottom: 168,
    width: 158,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  lidTop: {
    width: 150,
    height: 42,
    borderWidth: 1.5,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  lidKnob: {
    position: "absolute",
    top: 6,
    width: 28,
    height: 18,
    borderRadius: 10,
    borderWidth: 1,
  },
  lidHighlight: {
    position: "absolute",
    left: 20,
    top: 18,
    width: 58,
    height: 8,
    borderRadius: 4,
    opacity: 0.9,
  },
  potHandle: {
    position: "absolute",
    bottom: 96,
    width: 34,
    height: 52,
    borderWidth: 6,
    borderRadius: 18,
  },
  potHandleLeft: {
    left: 38,
    borderRightWidth: 0,
  },
  potHandleRight: {
    right: 38,
    borderLeftWidth: 0,
  },
  potShadow: {
    position: "absolute",
    bottom: 42,
    width: 180,
    height: 30,
    borderRadius: 18,
  },
  stovePlate: {
    position: "absolute",
    bottom: 40,
    width: 216,
    height: 26,
    borderRadius: 12,
    borderWidth: 1,
  },
  stoveBurnerGlow: {
    position: "absolute",
    bottom: 38,
    width: 150,
    height: 42,
    borderRadius: 22,
    zIndex: 2,
  },
  stoveBurner: {
    position: "absolute",
    bottom: 44,
    width: 122,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.4,
    zIndex: 3,
  },
  stoveFlameTray: {
    position: "absolute",
    bottom: 38,
    width: 148,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },
  stoveFlame: {
    position: "absolute",
    bottom: 0,
    width: 20,
    height: 28,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
    shadowColor: "#FFB347",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  stoveFlameLeft: {
    left: 28,
  },
  stoveFlameCenter: {
    width: 24,
    height: 34,
  },
  stoveFlameRight: {
    right: 28,
  },
  stoveFlameOuterLeft: {
    left: 4,
    width: 18,
    height: 24,
  },
  stoveFlameOuterRight: {
    right: 4,
    width: 18,
    height: 24,
  },
  potBase: {
    position: "absolute",
    bottom: 52,
    width: 108,
    height: 14,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 5,
  },
  potBody: {
    position: "absolute",
    bottom: 60,
    width: 194,
    height: 128,
    borderWidth: 1.6,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    zIndex: 6,
  },
  potHighlight: {
    position: "absolute",
    top: 14,
    left: 18,
    width: 62,
    height: 10,
    borderRadius: 6,
  },
  potRim: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    height: 12,
    borderRadius: 7,
    borderWidth: 1.2,
  },
  brothMask: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    height: 76,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  brothFill: {
    position: "absolute",
    left: -10,
    right: -10,
    bottom: 0,
    top: 16,
  },
  brothSurface: {
    position: "absolute",
    top: 0,
    left: -10,
    right: -10,
    height: 10,
    borderRadius: 5,
  },
  brothBubble: {
    position: "absolute",
    borderRadius: 999,
  },
  brothBubbleA: {
    width: 10,
    height: 10,
    top: 18,
    left: 48,
  },
  brothBubbleB: {
    width: 8,
    height: 8,
    top: 30,
    right: 52,
  },
  brothBubbleC: {
    width: 6,
    height: 6,
    top: 16,
    right: 90,
  },
  ingredientSpirit: {
    position: "absolute",
    bottom: 132,
    minWidth: 92,
    maxWidth: 124,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  ingredientBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ingredientBadgeTxt: {
    fontSize: 10,
    fontWeight: "900",
  },
  ingredientSpiritTxt: {
    fontSize: 10.5,
    fontWeight: "800",
    flexShrink: 1,
  },
  title: {
    maxWidth: 286,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.7,
    lineHeight: 30,
    textAlign: "center",
  },
  ingredientCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: -2,
    marginBottom: 12,
  },
  ingredientCountTxt: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  detail: {
    maxWidth: 292,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
  },
  phaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 16,
  },
  phaseDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1,
  },
  footerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 18,
  },
  footerTxt: {
    fontSize: 11.5,
    fontWeight: "700",
  },
});

