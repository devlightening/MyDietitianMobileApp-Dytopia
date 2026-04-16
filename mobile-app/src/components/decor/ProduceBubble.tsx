import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type ProduceIcon =
  | 'food-apple-outline'
  | 'carrot'
  | 'fruit-pear'
  | 'leaf'
  | 'corn';

export default function ProduceBubble({
  icon,
  iconSize,
  iconColor,
  style,
}: {
  icon: ProduceIcon;
  iconSize: number;
  iconColor: string;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={[s.wrap, style]}>
      <MaterialCommunityIcons name={icon} size={iconSize} color={iconColor} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
