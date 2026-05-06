import React from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../../context/ThemeContext";

const BRAND_LOGO = require("../../../assets/dytopia-logo.png");

type Props = {
  size?: number;
  opacity?: number;
  logoOpacity?: number;
  style?: StyleProp<ViewStyle>;
};

export default function DytopiaLogoBubble({
  size = 150,
  opacity = 0.42,
  logoOpacity = 0.42,
  style,
}: Props) {
  const { theme, isDark } = useTheme();
  const finalOpacity = isDark ? Math.min(opacity, 0.22) : opacity;

  return (
    <View
      pointerEvents="none"
      style={[
        s.bubble,
        style,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.primaryGlow,
          borderColor: theme.borderEmerald,
          opacity: finalOpacity,
        },
      ]}
    >
      <Image
        source={BRAND_LOGO}
        resizeMode="contain"
        style={[
          s.logo,
          {
            width: size * 0.52,
            height: size * 0.52,
            opacity: logoOpacity,
            borderRadius: size * 0.16,
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  bubble: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  logo: {
    overflow: "hidden",
  },
});
