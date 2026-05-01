import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { motionDurations } from "../../motion/presets";

type AnimatedCardProps = {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

export default function AnimatedCard({
  children,
  delay = 0,
  distance = 14,
  style,
}: AnimatedCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motionDurations.cardEnter).delay(delay).springify().damping(16).withInitialValues({
        opacity: 0,
        transform: [{ translateY: distance }, { scale: 0.985 }],
      })}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
