import React, { useRef } from "react";
import { View, PanResponder, StyleSheet, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";

interface Props {
  onSwipeUp: () => void;
}

export default function QuickKitchenHandle({ onSwipeUp }: Props) {
  const { theme } = useTheme();
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50 && Math.abs(gestureState.dx) < 30) {
          onSwipeUp();
        }
      },
    })
  ).current;

  return (
    <View
      style={s.handleZone}
      {...pan.panHandlers}
      hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
    >
      <View style={[s.handle, { backgroundColor: theme.primary + '30' }]} />
      <Text style={[s.hint, { color: theme.textMuted }]}>â†‘ Hızlı Mutfak</Text>
    </View>
  );
}

const s = StyleSheet.create({
  handleZone: {
    position: "absolute",
    bottom: 85,
    left: 0,
    right: 0,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  handle: {
    width: 54,
    height: 5,
    borderRadius: 3,
    marginBottom: 4,
  },
  hint: {
    fontSize: 10,
    fontWeight: "700",
  },
});

