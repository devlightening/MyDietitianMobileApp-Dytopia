import React, { useRef } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

interface PressableScaleProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
}

export default function PressableScale({ children, style, pressedScale = 0.97, onPressIn, onPressOut, ...props }: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        Animated.spring(scale, { toValue: pressedScale, useNativeDriver: true, speed: 28, bounciness: 7 }).start();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 8 }).start();
        onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
