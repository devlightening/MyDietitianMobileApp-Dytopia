import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { spacing, radii } from '../theme/tokens';
import { searchIngredients } from '../api/alternative';
import type { CustomPackItem } from '../hooks/useCustomPacks';

const MAX_ITEMS = 20;

interface Props {
  visible: boolean;
  editPack?: { id: string; name: string; items: CustomPackItem[] } | null;
  onSave: (name: string, items: CustomPackItem[]) => void;
  onClose: () => void;
  language: 'tr' | 'en';
}

export default function CreatePackSheet({ visible, editPack, onSave, onClose, language }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [packName, setPackName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomPackItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<CustomPackItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEdit = !!editPack;
  const copy = language === 'en'
    ? {
        titleCreate: 'New Pack',
        titleEdit: 'Edit Pack',
        namePlaceholder: 'Pack name (e.g. Breakfast)',
        searchPlaceholder: 'Search ingredient...',
        selected: 'Selected',
        noResults: 'No results found',
        typeToSearch: 'Type to search ingredients',
        save: 'Save',
        cancel: 'Cancel',
        maxItems: `Max ${MAX_ITEMS} items`,
      }
    : {
        titleCreate: 'Yeni Paket',
        titleEdit: 'Paketi Düzenle',
        namePlaceholder: 'Paket adı (örn. Kahvaltılıklar)',
        searchPlaceholder: 'Malzeme ara...',
        selected: 'Seçilenler',
        noResults: 'Sonuç bulunamadı',
        typeToSearch: 'Malzeme aramak için yaz',
        save: 'Kaydet',
        cancel: 'İptal',
        maxItems: `Maks ${MAX_ITEMS} malzeme`,
      };

  useEffect(() => {
    if (visible) {
      setPackName(editPack?.name ?? '');
      setSelectedItems(editPack?.items ?? []);
      setQuery('');
      setResults([]);
    }
  }, [visible, editPack]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setResults([]); return; }
    setSearching(true);
    try {
      const found = await searchIngredients(q.trim());
      setResults(found.map(i => ({ id: i.id, name: i.canonicalName })));
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(text: string) {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void doSearch(text), 350);
  }

  function toggleItem(item: CustomPackItem) {
    setSelectedItems(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, item];
    });
  }

  function handleSave() {
    const trimmed = packName.trim();
    if (!trimmed || selectedItems.length === 0) return;
    onSave(trimmed, selectedItems);
  }

  const canSave = packName.trim().length > 0 && selectedItems.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sh.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={sh.kavContainer}
      >
        <View
          style={[
            sh.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Handle */}
          <View style={[sh.handle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={sh.header}>
            <TouchableOpacity onPress={onClose} style={sh.cancelBtn} hitSlop={12}>
              <Text style={[sh.cancelTxt, { color: theme.textMuted }]}>{copy.cancel}</Text>
            </TouchableOpacity>
            <Text style={[sh.title, { color: theme.text }]}>
              {isEdit ? copy.titleEdit : copy.titleCreate}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              style={[
                sh.saveBtn,
                {
                  backgroundColor: canSave ? theme.primary : `${theme.primary}30`,
                },
              ]}
            >
              <Text style={[sh.saveTxt, { color: canSave ? '#fff' : `${theme.primary}80` }]}>
                {copy.save}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Pack Name Input */}
          <View style={[sh.nameWrap, { borderColor: theme.border, backgroundColor: theme.bg }]}>
            <Ionicons name="folder-outline" size={17} color={theme.primary} />
            <TextInput
              style={[sh.nameInput, { color: theme.text }]}
              placeholder={copy.namePlaceholder}
              placeholderTextColor={theme.textMuted}
              value={packName}
              onChangeText={setPackName}
              maxLength={40}
              returnKeyType="done"
            />
          </View>

          {/* Selected Items Row */}
          {selectedItems.length > 0 && (
            <View style={sh.selectedSection}>
              <View style={sh.selectedHeader}>
                <Text style={[sh.selectedLabel, { color: theme.textMuted }]}>
                  {copy.selected}
                </Text>
                <Text style={[sh.selectedCount, { color: theme.primary }]}>
                  {selectedItems.length}/{MAX_ITEMS}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={sh.chipRow}
              >
                {selectedItems.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => toggleItem(item)}
                    style={[sh.chip, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}40` }]}
                  >
                    <Text style={[sh.chipTxt, { color: theme.primary }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Ionicons name="close-circle" size={14} color={theme.primary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Search */}
          <View style={[sh.searchWrap, { borderColor: theme.border, backgroundColor: theme.bg }]}>
            <Ionicons name="search-outline" size={16} color={theme.textMuted} />
            <TextInput
              style={[sh.searchInput, { color: theme.text }]}
              placeholder={copy.searchPlaceholder}
              placeholderTextColor={theme.textMuted}
              value={query}
              onChangeText={handleQueryChange}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={theme.primary} />}
          </View>

          {/* Results */}
          <ScrollView
            style={sh.results}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {results.length === 0 && query.trim().length === 0 && (
              <Text style={[sh.hint, { color: theme.textMuted }]}>{copy.typeToSearch}</Text>
            )}
            {results.length === 0 && query.trim().length > 0 && !searching && (
              <Text style={[sh.hint, { color: theme.textMuted }]}>{copy.noResults}</Text>
            )}
            {results.map(item => {
              const selected = selectedItems.some(i => i.id === item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggleItem(item)}
                  style={[
                    sh.resultRow,
                    {
                      borderColor: selected ? `${theme.primary}30` : theme.border,
                      backgroundColor: selected ? `${theme.primary}08` : theme.surface,
                    },
                  ]}
                >
                  <Text style={[sh.resultTxt, { color: theme.text }]}>{item.name}</Text>
                  <View
                    style={[
                      sh.checkCircle,
                      {
                        backgroundColor: selected ? theme.primary : 'transparent',
                        borderColor: selected ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    {selected && <Ionicons name="checkmark" size={11} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sh = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kavContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '88%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cancelBtn: { padding: 4 },
  cancelTxt: { fontSize: 14, fontWeight: '500' },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  saveTxt: { fontSize: 13, fontWeight: '800' },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  selectedSection: {
    marginBottom: 10,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: 8,
  },
  selectedLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  selectedCount: { fontSize: 11, fontWeight: '800' },
  chipRow: {
    paddingHorizontal: spacing.md,
    gap: 7,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    maxWidth: 140,
  },
  chipTxt: { fontSize: 12, fontWeight: '700', maxWidth: 100 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  results: {
    maxHeight: 280,
    paddingHorizontal: spacing.md,
  },
  hint: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 24,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: radii.md,
    marginBottom: 6,
  },
  resultTxt: { fontSize: 14, fontWeight: '600', flex: 1 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});

