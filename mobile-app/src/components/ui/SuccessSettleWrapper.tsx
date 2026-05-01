import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { useQuietCountPop } from "../../hooks/useAuraMotion";

type SuccessSettleWrapperProps = {
  trigger: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function SuccessSettleWrapper({
  trigger,
  children,
  style,
}: SuccessSettleWrapperProps) {
  const settleStyle = useQuietCountPop(trigger);
  return <Animated.View style={[style, settleStyle]}>{children}</Animated.View>;
}
