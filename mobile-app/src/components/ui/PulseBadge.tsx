import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSignalPulse } from "../../hooks/useAuraMotion";

type PulseBadgeProps = {
  active?: boolean;
  color: string;
  backgroundColor: string;
  label: string;
  borderColor?: string;
  textColor?: string;
};

export default function PulseBadge({
  active = true,
  color,
  backgroundColor,
  label,
  borderColor,
  textColor,
}: PulseBadgeProps) {
  const pulseStyle = useSignalPulse(active);

  return (
    <Animated.View
      style={[
        s.wrap,
        {
          backgroundColor,
          borderColor: borderColor ?? `${color}33`,
        },
        pulseStyle,
      ]}
    >
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={[s.label, { color: textColor ?? color }]}>{label}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 11.5,
    fontWeight: "800",
  },
});
