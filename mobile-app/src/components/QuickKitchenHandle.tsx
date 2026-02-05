import React, { useRef } from "react";
import { View, PanResponder, StyleSheet, Text } from "react-native";
import { colors, spacing } from "../theme";

interface Props {
  onSwipeUp: () => void;
}

export default function QuickKitchenHandle({ onSwipeUp }: Props) {
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gestureState) => {
        // Only trigger if clearly upward swipe
        // dy < -50 means swipe up at least 50px
        // abs(dx) < 30 means mostly vertical (not diagonal)
        if (gestureState.dy < -50 && Math.abs(gestureState.dx) < 30) {
          onSwipeUp();
        }
      },
    })
  ).current;

  return (
    <View
      style={styles.handleZone}
      {...pan.panHandlers}
      hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
    >
      <View style={styles.handle} />
      <Text style={styles.hint}>↑ Quick Kitchen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  handleZone: {
    position: "absolute",
    bottom: 85, // Above bottom bar (tab bar is ~80px)
    left: 0,
    right: 0,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100, // Above everything
  },
  handle: {
    width: 54,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(47, 82, 51, 0.25)",
    marginBottom: 4,
  },
  hint: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.subtle,
  },
});
