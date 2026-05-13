import React from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { BRAND_LOGO } from "../../assets/brandAssets";

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
  const finalOpacity = isDark ? Math.min(Math.max(opacity * 0.92, 0.14), 0.26) : opacity;
  const finalLogoOpacity = isDark ? Math.min(Math.max(logoOpacity * 1.08, 0.28), 0.46) : logoOpacity;

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
          backgroundColor: isDark ? theme.primaryLight : theme.primaryGlow,
          borderColor: theme.borderEmerald,
          opacity: finalOpacity,
        },
      ]}
    >
      <Image
        source={BRAND_LOGO}
        resizeMode="contain"
        fadeDuration={0}
        style={[
          s.logo,
          {
            width: size * 0.52,
            height: size * 0.52,
            opacity: finalLogoOpacity,
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
