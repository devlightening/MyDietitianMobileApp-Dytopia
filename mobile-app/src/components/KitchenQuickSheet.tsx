import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Modal, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { radii, spacing } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import IngredientSearch from "./IngredientSearch";
import IngredientChip from "./IngredientChip";
import type { Ingredient } from "../types/alternative";

const { height: H } = Dimensions.get("window");
const SHEET_H = H * 0.72;
const DISMISS_THRESHOLD = 90;
const DISMISS_VEL = 0.5;

export default function KitchenQuickSheet({
  visible,
  onClose,
  selectedIngredients,
  onChangeSelected,
  onGoKitchen,
}: {
  visible: boolean;
  onClose: () => void;
  selectedIngredients: Ingredient[];
  onChangeSelected: (v: Ingredient[]) => void;
  onGoKitchen: () => void;
}) {
  const { theme } = useTheme();

  // Single animated value for Y offset (0 = fully visible)
  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  // Drag delta â€” only active during gesture
  const dragOffset = useRef(new Animated.Value(0)).current;
  // Combined: stable ref so it doesn't recreate on every render
  const combinedY = useRef(Animated.add(translateY, dragOffset)).current;

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (visible) {
      dragOffset.setValue(0);
      translateY.setValue(SHEET_H);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
        mass: 0.85,
      }).start();
    } else {
      Animated.timing(translateY, { toValue: SHEET_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  function dismiss() {
    dragOffset.setValue(0);
    Animated.timing(translateY, { toValue: SHEET_H, duration: 200, useNativeDriver: true }).start(() => {
      onCloseRef.current();
    });
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 4 && Math.abs(gs.dy) > Math.abs(gs.dx) * 0.8,
      onPanResponderMove: (_, gs) => {
        // Only allow dragging down
        if (gs.dy > 0) {
          dragOffset.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD || gs.vy > DISMISS_VEL) {
          dismiss();
        } else {
          // Snap back
          Animated.spring(dragOffset, {
            toValue: 0,
            damping: 16,
            stiffness: 200,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragOffset, { toValue: 0, damping: 16, stiffness: 200, useNativeDriver: true }).start();
      },
    })
  ).current;

  const chips = useMemo(() => selectedIngredients, [selectedIngredients]);

  function add(i: Ingredient) {
    if (chips.some((x) => x.id === i.id)) return;
    onChangeSelected([...chips, i]);
  }
  function remove(id: string) {
    onChangeSelected(chips.filter((x) => x.id !== id));
  }

  // Backdrop opacity tied to translateY
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SHEET_H],
    outputRange: [0.38, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <View style={s.root}>
        {/* Dimmed backdrop */}
        <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]} />
        <TouchableOpacity style={s.backdropTap} activeOpacity={1} onPress={dismiss} />

        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              transform: [{ translateY: combinedY }],
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -6 },
              shadowOpacity: 0.14,
              shadowRadius: 24,
              elevation: 20,
            },
          ]}
        >
          {/* Full-width drag handle area */}
          <View {...panResponder.panHandlers} style={s.handleArea}>
            <View style={[s.handle, { backgroundColor: theme.border }]} />
            <View style={[s.headerRow]}>
              <View>
                <Text style={[s.title, { color: theme.text }]}>Hızlı Mutfak</Text>
                <Text style={[s.sub, { color: theme.textMuted }]}>Malzeme seç · mutfağa git</Text>
              </View>
              <TouchableOpacity
                style={[s.closeBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                onPress={dismiss}
                activeOpacity={0.75}
              >
                <Text style={[s.closeTxt, { color: theme.textMuted }]}>âœ•</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* zIndex wrapper â€” dropdown must float above chips/actions below */}
          <View style={s.searchWrapper}>
            <IngredientSearch onSelect={add} />
          </View>

          <View style={s.chipsRow}>
            {chips.map((i) => (
              <IngredientChip key={i.id} ingredient={i} onRemove={() => remove(i.id)} />
            ))}
            {chips.length === 0 && (
              <Text style={[s.empty, { color: theme.textMuted }]}>Henüz malzeme seçilmedi.</Text>
            )}
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: theme.primaryLight }]}
            onPress={onGoKitchen}
            activeOpacity={0.85}
          >
            <Text style={[s.primaryText, { color: theme.primary }]}>ğŸ³ Mutfağa Git</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  backdropTap: { ...StyleSheet.absoluteFillObject },

  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },

  // Large drag handle zone â€” 60pt tall for easy grip
  handleArea: {
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 17, fontWeight: "900" },
  sub: { marginTop: 3, fontSize: 12, fontWeight: "700" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  closeTxt: { fontSize: 13, fontWeight: "800" },

  searchWrapper: {
    zIndex: 100,
    elevation: 10,
  },

  chipsRow: { marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, minHeight: 32 },
  empty: { fontSize: 12, fontWeight: "700" },

  primaryBtn: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { fontWeight: "900", fontSize: 15 },
});

