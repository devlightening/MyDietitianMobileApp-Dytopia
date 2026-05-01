import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { useShimmerBand } from "../../hooks/useAuraMotion";

type ShimmerLineProps = {
  active?: boolean;
  color: string;
  style?: StyleProp<ViewStyle>;
};

export default function ShimmerLine({
  active = true,
  color,
  style,
}: ShimmerLineProps) {
  const shimmerStyle = useShimmerBand(active);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.base,
        { backgroundColor: color },
        shimmerStyle,
        style,
      ]}
    />
  );
}

const s = StyleSheet.create({
  base: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 120,
    borderRadius: 999,
  },
});
