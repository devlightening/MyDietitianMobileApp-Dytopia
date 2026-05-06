import React from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../../context/ThemeContext";

const BRAND_LOGO = require("../../../assets/dytopia-logo.png");

type Position = "topRight" | "bottomRight" | "bottomLeft" | "center";

type Props = {
  position?: Position;
  opacity?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export default function DytopiaWatermark({
  position = "bottomRight",
  opacity = 0.045,
  size = 260,
  style,
}: Props) {
  const { isDark } = useTheme();
  const finalOpacity = isDark ? Math.min(opacity, 0.032) : opacity;

  return (
    <View
      pointerEvents="none"
      style={[
        s.base,
        getPositionStyle(position, size),
        { width: size, height: size, opacity: finalOpacity },
        style,
      ]}
    >
      <Image source={BRAND_LOGO} resizeMode="contain" style={s.logo} />
    </View>
  );
}

function getPositionStyle(position: Position, size: number): ViewStyle {
  switch (position) {
    case "topRight":
      return { top: -size * 0.22, right: -size * 0.18 };
    case "bottomLeft":
      return { bottom: -size * 0.24, left: -size * 0.22 };
    case "center":
      return {
        top: "50%",
        left: "50%",
        marginTop: -size / 2,
        marginLeft: -size / 2,
      };
    case "bottomRight":
    default:
      return { bottom: -size * 0.26, right: -size * 0.2 };
  }
}

const s = StyleSheet.create({
  base: {
    position: "absolute",
    zIndex: 0,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
});
