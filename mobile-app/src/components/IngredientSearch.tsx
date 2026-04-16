import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
  SlideOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { spacing, radii, type Theme } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/I18nContext';
import { searchIngredients } from '../api/alternative';
import { logIngredientAcquisition } from '../api/acquisition';
import { dur, spring, useStaggerItem } from '../hooks/useAuraMotion';
import type { Ingredient } from '../types/alternative';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

export default function IngredientSearch({
  onSelect,
  initialQuery,
  initialQueryKey,
}: {
  onSelect: (i: Ingredient) => void;
  initialQuery?: string;
  initialQueryKey?: number;
}) {
  const { theme } = useTheme();
  const { language, t } = useTranslation();
  const copy = language === 'en'
    ? {
        placeholder: t.kitchen.searchPlaceholder,
        loading: 'Scanning ingredients with AI suggestions...',
        empty: 'No suggestions found, try another keyword',
      }
    : {
        placeholder: t.kitchen.searchPlaceholder,
        loading: 'AI önerileri malzemeleri tarıyor...',
        empty: 'Uygun öneri bulunamadı, farklı bir kelime dene',
      };

  const [q, setQ] = useState('');
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);

  const focusV = useSharedValue(0);
  const clearV = useSharedValue(0);

  const runSearch = useCallback(async (text: string) => {
    if (text.trim().length < MIN_CHARS) {
      setItems([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await searchIngredients(text.trim());
      setItems(res);
      setSearched(true);
    } catch {
      setItems([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  function onChange(text: string) {
    setQ(text);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (text.trim().length < MIN_CHARS) {
      setItems([]);
      setSearched(false);
      setLoading(false);
      clearV.value = withTiming(0, { duration: dur.fast });
      sessionStartedAtRef.current = null;
      return;
    }

    if (sessionStartedAtRef.current === null) {
      sessionStartedAtRef.current = Date.now();
    }

    clearV.value = withTiming(1, { duration: dur.fast });
    setLoading(true);
    debounceRef.current = setTimeout(() => void runSearch(text), DEBOUNCE_MS);
  }

  function onPick(item: Ingredient) {
    onSelect(item);

    const startedAt = sessionStartedAtRef.current;
    void logIngredientAcquisition({
      source: 'Text',
      rawInput: q.trim() || item.canonicalName,
      selectedIngredients: [
        {
          ingredientId: item.id,
          mappingType: 'ExactIngredient',
          confidence: 1,
        },
      ],
      mappingType: 'ExactIngredient',
      requiredConfirmation: false,
      confirmedByUser: true,
      interactionCount: 1,
      latencyMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
      startedAtUtc: startedAt ? new Date(startedAt).toISOString() : undefined,
      completedAtUtc: new Date().toISOString(),
    }).catch(() => undefined);

    setQ('');
    setItems([]);
    setSearched(false);
    setFocused(false);
    clearV.value = withTiming(0, { duration: dur.fast });
    sessionStartedAtRef.current = null;
  }

  function onClear() {
    setQ('');
    setItems([]);
    setSearched(false);
    setLoading(false);
    clearV.value = withTiming(0, { duration: dur.fast });
    sessionStartedAtRef.current = null;
  }

  useEffect(() => {
    if (!initialQuery?.trim()) {
      return;
    }

    onChange(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, initialQueryKey]);

  const showDropdown = loading || items.length > 0 || (searched && items.length === 0);

  const inputStyle = useAnimatedStyle(() => ({
    borderColor: focused ? theme.primary : theme.border,
    shadowOpacity: 0.08 + focusV.value * 0.16,
  }));

  const clearStyle = useAnimatedStyle(() => ({
    opacity: clearV.value,
    transform: [{ scale: clearV.value }],
  }));

  return (
    <View style={s.root}>
      <Animated.View
        style={[
          s.inputShell,
          { backgroundColor: theme.surface, shadowColor: theme.primaryGlow },
          inputStyle,
        ]}
      >
        <View
          style={[
            s.inputIconWrap,
            { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}2A` },
          ]}
        >
          <Ionicons name="search" size={14} color={focused ? theme.primary : theme.textMuted} />
        </View>

        <TextInput
          value={q}
          onChangeText={onChange}
          onFocus={() => {
            setFocused(true);
            focusV.value = withSpring(1, spring.snappy);
          }}
          onBlur={() => {
            setFocused(false);
            focusV.value = withSpring(0, spring.snappy);
          }}
          placeholder={copy.placeholder}
          placeholderTextColor={theme.textMuted}
          style={[s.input, { color: theme.text }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          selectionColor={theme.primary}
        />

        {q.length > 0 && (
          <Animated.View style={clearStyle}>
            <TouchableOpacity
              onPress={onClear}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[s.clearBtn, { backgroundColor: theme.borderLight }]}
            >
              <Ionicons name="close" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>

      {showDropdown && (
        <Animated.View
          entering={SlideInDown.duration(dur.fast)}
          exiting={SlideOutUp.duration(dur.fast)}
          style={[
            s.dropdown,
            { backgroundColor: theme.surface, borderColor: `${theme.border}D9` },
          ]}
        >
          {loading && (
            <Animated.View entering={FadeIn.duration(dur.fast)} style={s.stateRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[s.stateTxt, { color: theme.textMuted }]}>{copy.loading}</Text>
            </Animated.View>
          )}

          {!loading && searched && items.length === 0 && (
            <Animated.View entering={FadeIn.duration(dur.fast)} style={s.stateRow}>
              <Text style={[s.stateTxt, { color: theme.textMuted }]}>{copy.empty}</Text>
            </Animated.View>
          )}

          {!loading && items.length > 0 && (
            <ScrollView style={s.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              <View>
                {items.map((item, index) => (
                  <IngredientRow
                    key={item.id}
                    item={item}
                    index={index}
                    theme={theme}
                    onPress={() => onPick(item)}
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </Animated.View>
      )}
    </View>
  );
}

function IngredientRow({
  item,
  index,
  theme,
  onPress,
}: {
  item: Ingredient;
  index: number;
  theme: Theme;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const rowInStyle = useStaggerItem(index, 45, 34);

  return (
    <Animated.View style={[pressStyle, rowInStyle]} entering={FadeInDown.duration(dur.base)}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => {
          setPressed(true);
          scale.value = withSpring(0.985, spring.snappy);
        }}
        onPressOut={() => {
          setPressed(false);
          scale.value = withSpring(1, spring.snappy);
        }}
        activeOpacity={1}
        style={[
          s.row,
          {
            borderBottomColor: theme.borderLight,
            backgroundColor: pressed ? `${theme.primary}0F` : 'transparent',
          },
        ]}
      >
        <View style={[s.rowDot, { backgroundColor: theme.primary }]} />
        <View style={s.rowMain}>
          <Text style={[s.rowTitle, { color: theme.text }]}>{item.canonicalName}</Text>
          {!!item.aliases?.length && (
            <Text style={[s.rowAlias, { color: theme.textMuted }]} numberOfLines={1}>
              {item.aliases.slice(0, 2).join(' • ')}
            </Text>
          )}
        </View>
        <Ionicons name="add-circle" size={16} color={theme.primary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { zIndex: 60 },
  inputShell: {
    borderWidth: 1.4,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 15,
    elevation: 4,
  },
  inputIconWrap: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    padding: 0,
    lineHeight: 20,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 270,
  },
  list: { maxHeight: 270 },
  stateRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
  },
  stateTxt: { fontSize: 12.5, fontWeight: '500', textAlign: 'center', lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowDot: { width: 8, height: 8, borderRadius: 4 },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  rowAlias: { fontSize: 11.5, fontWeight: '500' },
});
