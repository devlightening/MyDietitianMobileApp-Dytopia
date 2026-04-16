import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";

export type TabKey = "dashboard" | "plans" | "kitchen" | "messages" | "profile";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type SideTabKey = Exclude<TabKey, "kitchen">;

type TabConfig =
  | {
      key: SideTabKey;
      icon: IoniconName;
      activeIcon: IoniconName;
      center?: false;
    }
  | {
      key: "kitchen";
      center: true;
    };

const TABS: TabConfig[] = [
  { key: "dashboard", icon: "home-outline", activeIcon: "home" },
  { key: "plans", icon: "book-outline", activeIcon: "book" },
  { key: "kitchen", center: true },
  { key: "messages", icon: "chatbubble-ellipses-outline", activeIcon: "chatbubble-ellipses" },
  { key: "profile", icon: "person-outline", activeIcon: "person" },
];

// ─── Kitchen Button Geometry ───────────────────────────────────────────────
const KB_SIZE   = 68;   // main button diameter
const GLOW_SIZE = 86;   // soft glow ring diameter
const ORBIT_D   = 96;   // orbit path diameter
const DOT_SIZE  = 5.5;  // orbit dot size
const STEAM_R   = 4;    // steam wisp radius

// ─── Steam Wisp ───────────────────────────────────────────────────────────
function SteamWisp({
  delay,
  dx,
  color,
}: {
  delay: number;
  dx: number;
  color: string;
}) {
  const prog = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(prog, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(prog, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: STEAM_R * 2,
        height: STEAM_R * 2,
        borderRadius: STEAM_R,
        backgroundColor: color,
        // sits at top edge of button, offset horizontally
        top: 0,
        left: "50%",
        marginLeft: dx - STEAM_R,
        opacity: prog.interpolate({
          inputRange: [0, 0.12, 0.58, 1],
          outputRange: [0, 0.88, 0.45, 0],
        }),
        transform: [
          {
            translateY: prog.interpolate({
              inputRange: [0, 1],
              outputRange: [2, -32],
            }),
          },
          {
            scaleX: prog.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1.3, 0.8],
            }),
          },
        ],
      }}
    />
  );
}

// ─── Kitchen Button ────────────────────────────────────────────────────────
function KitchenButton({
  active,
  label,
  onPress,
  activeText,
  inactiveText,
  isDark,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  activeText: string;
  inactiveText: string;
  isDark: boolean;
}) {
  const pressScale  = useRef(new Animated.Value(1)).current;
  const glowScale   = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.18)).current;
  const orbitRotate = useRef(new Animated.Value(0)).current;
  const orbitOpacity = useRef(new Animated.Value(0)).current;
  const iconRotate  = useRef(new Animated.Value(0)).current;

  // Glow breathing — restarts when active state changes
  useEffect(() => {
    const peakOpacity = active ? (isDark ? 0.72 : 0.60) : (isDark ? 0.22 : 0.16);
    const baseOpacity = active ? (isDark ? 0.34 : 0.28) : (isDark ? 0.10 : 0.08);
    const peakScale   = active ? 1.20 : 1.05;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: peakScale,
            duration: 980,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: peakOpacity,
            duration: 980,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.0,
            duration: 980,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: baseOpacity,
            duration: 980,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, isDark]);

  // Orbit dots — fade in/out and spin continuously
  useEffect(() => {
    Animated.timing(orbitOpacity, {
      toValue: active ? 1 : 0,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [active]);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(orbitRotate, {
        toValue: 1,
        duration: 3800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Icon micro-spin on become-active
  useEffect(() => {
    if (active) {
      iconRotate.setValue(0);
      Animated.spring(iconRotate, {
        toValue: 1,
        speed: 10,
        bounciness: 10,
        useNativeDriver: true,
      }).start();
    }
  }, [active]);

  function handlePressIn() {
    Animated.spring(pressScale, {
      toValue: 0.87,
      speed: 40,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 12,
      bounciness: 16,
      useNativeDriver: true,
    }).start();
    onPress();
  }

  const rotateStr = orbitRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const iconRotateStr = iconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-12deg", "0deg"],
  });

  const glowColor  = isDark ? "#50C07A" : "#38A85E";
  const btnFill    = active
    ? (isDark ? "#4DBB74" : "#38A85E")
    : (isDark ? "#1C3D28" : "#255E38");
  const dotColorA  = isDark ? "#BBFFD4" : "#6FE0A4";
  const dotColorB  = isDark ? "#80EDB8" : "#4DC885";
  const steamColor = isDark ? "rgba(160,242,194,0.90)" : "rgba(48,160,86,0.72)";
  const labelColor = active ? activeText : inactiveText;

  return (
    <View style={kb.slot}>
      {/* Floating container — holds glow, orbit, steam, button */}
      <View style={kb.floatWrap}>

        {/* ① Soft glow ring */}
        <Animated.View
          pointerEvents="none"
          style={[
            kb.glow,
            {
              backgroundColor: glowColor,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        {/* ② Orbit ring with two opposite dots */}
        <Animated.View
          pointerEvents="none"
          style={[
            kb.orbit,
            {
              opacity: orbitOpacity,
              transform: [{ rotate: rotateStr }],
            },
          ]}
        >
          <View style={[kb.orbitDot, kb.orbitDotN, { backgroundColor: dotColorA }]} />
          <View style={[kb.orbitDot, kb.orbitDotS, { backgroundColor: dotColorB }]} />
        </Animated.View>

        {/* ③ Steam wisps (3 staggered, rise from button top) */}
        <SteamWisp delay={0}   dx={-10} color={steamColor} />
        <SteamWisp delay={370} dx={0}   color={steamColor} />
        <SteamWisp delay={740} dx={10}  color={steamColor} />

        {/* ④ Main button — circular, press-bounces */}
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          android_ripple={{ color: "transparent" }}
          hitSlop={{ top: 8, bottom: 0, left: 8, right: 8 }}
        >
          <Animated.View
            style={[
              kb.btn,
              { backgroundColor: btnFill, transform: [{ scale: pressScale }] },
            ]}
          >
            {/* Top-right shine cap */}
            <View style={kb.shineCap} />

            {/* Subtle bottom dark arc for depth */}
            <View style={kb.depthArc} />

            {/* Icon */}
            <Animated.View style={{ transform: [{ rotate: iconRotateStr }] }}>
              <Ionicons name="restaurant" size={27} color="#EFF9F3" />
            </Animated.View>

            {/* Label inside button */}
            <Text style={kb.btnLabel}>{label}</Text>
          </Animated.View>
        </Pressable>
      </View>

      {/* Active indicator pill below button */}
      <Animated.View
        style={[
          kb.indicator,
          {
            backgroundColor: glowColor,
            opacity: orbitOpacity,
          },
        ]}
      />
    </View>
  );
}

// ─── BottomBar ─────────────────────────────────────────────────────────────
export default function BottomBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
}) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const hideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const animateTo = (value: 0 | 1) => {
      Animated.timing(hideAnim, {
        toValue: value,
        duration: value === 1 ? 170 : 220,
        easing: value === 1 ? Easing.out(Easing.quad) : Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      animateTo(1);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      animateTo(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [hideAnim]);

  const bottomInset = Math.max(insets.bottom, Platform.OS === "ios" ? 10 : 8);
  const translateY = hideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });
  const opacity = hideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const shellSurface = isDark ? "rgba(14,28,21,0.96)" : "rgba(255,255,252,0.96)";
  const shellBorder  = isDark ? "rgba(223,245,229,0.08)" : "rgba(65,116,80,0.12)";
  const topLine      = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.70)";
  const activeTabSurface = isDark ? "rgba(97,210,136,0.14)" : "rgba(71,185,114,0.12)";
  const activeTabBorder  = isDark ? "rgba(130,224,163,0.14)" : "rgba(56,136,77,0.12)";
  const activeText  = isDark ? "#F3FBF4" : "#2B5B36";
  const inactiveText = isDark ? "rgba(231,245,235,0.62)" : "rgba(37,65,46,0.64)";
  const inactiveIcon = isDark ? "rgba(239,249,241,0.70)" : "rgba(46,78,57,0.70)";

  const labels: Record<TabKey, string> = {
    dashboard: t.tabs.dashboard,
    plans: t.tabs.plans,
    kitchen: t.tabs.kitchen.toUpperCase(),
    messages: t.tabs.messages,
    profile: t.tabs.profile,
  };

  function renderTab(tab: TabConfig) {
    if (tab.center) {
      return (
        <KitchenButton
          key={tab.key}
          active={active === "kitchen"}
          label={labels.kitchen}
          onPress={() => onChange("kitchen")}
          activeText={activeText}
          inactiveText={inactiveText}
          isDark={isDark}
        />
      );
    }

    const isActive = active === tab.key;

    return (
      <Pressable
        key={tab.key}
        onPress={() => onChange(tab.key)}
        style={s.slot}
        android_ripple={{ color: "transparent" }}
      >
        <View
          style={[
            s.sideChip,
            isActive && {
              backgroundColor: activeTabSurface,
              borderColor: activeTabBorder,
            },
          ]}
        >
          <Ionicons
            name={isActive ? tab.activeIcon : tab.icon}
            size={20}
            color={isActive ? activeText : inactiveIcon}
          />
        </View>
        <Text
          style={[
            s.sideLabel,
            {
              color: isActive ? activeText : inactiveText,
              fontWeight: isActive ? "800" : "700",
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {labels[tab.key]}
        </Text>
      </Pressable>
    );
  }

  return (
    <Animated.View
      style={[
        s.wrap,
        {
          bottom: Platform.OS === "ios" ? 8 : 10,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents={keyboardVisible ? "none" : "box-none"}
    >
      <View
        style={[
          s.shell,
          {
            backgroundColor: shellSurface,
            borderColor: shellBorder,
            paddingBottom: bottomInset,
          },
        ]}
      >
        <View pointerEvents="none" style={[s.topLine, { backgroundColor: topLine }]} />
        <View style={s.row}>{TABS.map(renderTab)}</View>
      </View>
    </Animated.View>
  );
}

// ─── Kitchen Button Styles ─────────────────────────────────────────────────
const kb = StyleSheet.create({
  slot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 2,
  },
  floatWrap: {
    width: ORBIT_D + 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,        // float above bar
  },
  glow: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    // centered on the button (button is KB_SIZE, glow is GLOW_SIZE)
    top: (KB_SIZE - GLOW_SIZE) / 2,
    left: ((ORBIT_D + 6) - GLOW_SIZE) / 2,
  },
  orbit: {
    position: "absolute",
    width: ORBIT_D,
    height: ORBIT_D,
    top: (KB_SIZE - ORBIT_D) / 2,
    left: ((ORBIT_D + 6) - ORBIT_D) / 2,
  },
  orbitDot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  orbitDotN: {
    top: 0,
    left: ORBIT_D / 2 - DOT_SIZE / 2,
  },
  orbitDotS: {
    bottom: 0,
    left: ORBIT_D / 2 - DOT_SIZE / 2,
  },
  btn: {
    width: KB_SIZE,
    height: KB_SIZE,
    borderRadius: KB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  shineCap: {
    position: "absolute",
    top: 9,
    right: 11,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  depthArc: {
    position: "absolute",
    bottom: -8,
    left: 8,
    right: 8,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  btnLabel: {
    color: "#EFF9F3",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginTop: 3,
  },
  indicator: {
    marginTop: 5,
    width: 22,
    height: 3,
    borderRadius: 2,
  },
});

// ─── Main Bar Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
    height: 98,
    justifyContent: "flex-end",
  },
  shell: {
    minHeight: 72,
    borderRadius: 28,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 8,
    overflow: "visible",
  },
  topLine: {
    position: "absolute",
    top: 0,
    left: 26,
    right: 26,
    height: 7,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    opacity: 0.45,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  slot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  sideChip: {
    width: 42,
    height: 42,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  sideLabel: {
    width: "100%",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: -0.1,
    paddingHorizontal: 1,
  },
});
