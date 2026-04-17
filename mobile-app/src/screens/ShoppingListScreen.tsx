import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { radii, spacing } from "../theme/tokens";
import ProduceBubble from "../components/decor/ProduceBubble";
import AppEmptyState from "../components/ui/AppEmptyState";
import {
  addShoppingListItem,
  clearCheckedShoppingListItems,
  deleteShoppingListItem,
  generateShoppingListFromTodayPlan,
  getShoppingList,
  type ShoppingListResponse,
  type ShoppingListItem,
  type ShoppingListSummary,
  toggleShoppingListItem,
} from "../api/shopping-list";

const EMPTY_SUMMARY: ShoppingListSummary = { total: 0, checkedCount: 0, activeCount: 0 };

export default function ShoppingListScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [summary, setSummary] = useState<ShoppingListSummary>(EMPTY_SUMMARY);
  const [generation, setGeneration] = useState<ShoppingListResponse["generation"] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState("");

  const copy = language === "en"
    ? {
        back: "Back",
        eyebrow: "SMART GROCERY",
        title: "Shopping List",
        subtitle: "Missing ingredients from your plan and kitchen flow collect here.",
        active: "active",
        checked: "checked",
        addPlaceholder: "Add a custom item",
        add: "Add item",
        generate: "Generate from today plan",
        clearChecked: "Clear checked",
        aiTitle: "AI grocery sweep",
        aiCountLabel: "items",
        emptyTitle: "Your list is fresh",
        emptyDesc: "Generate ingredients from your plan or add custom pantry needs.",
        sourcePlan: "Plan",
        sourceKitchen: "Kitchen",
        sourceRecipe: "Recipe",
        sourceManual: "Manual",
        share: "Share list",
      }
    : {
        back: "Geri",
        eyebrow: "AKILLI LİSTE",
        title: "Alışveriş Listesi",
        subtitle: "Plan ve mutfak akışında eksik kalan malzemeler burada toplanır.",
        active: "aktif",
        checked: "tamam",
        addPlaceholder: "Listeye özel madde ekle",
        add: "Madde ekle",
        generate: "Bugünün planından üret",
        clearChecked: "Tamamlananları temizle",
        aiTitle: "AI alışveriş özeti",
        aiCountLabel: "ürün",
        emptyTitle: "Listen hazır bekliyor",
        emptyDesc: "Planından malzeme üret veya kendi ihtiyaçlarını tek satırla ekle.",
        sourcePlan: "Plan",
        sourceKitchen: "Mutfak",
        sourceRecipe: "Tarif",
        sourceManual: "Elle",
        share: "Listeyi Paylaş",
      };

  const load = useCallback(async () => {
    try {
      const res = await getShoppingList();
      setItems(res.items);
      setSummary(res.summary);
      setGeneration(res.generation);
    } catch {
      setItems([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
      setGenerating(false);
      setAdding(false);
      setBusyId(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const completedItems = useMemo(
    () => items.filter((item) => item.isChecked),
    [items],
  );

  async function handleAdd() {
    const value = draft.trim();
    if (!value) return;

    setAdding(true);
    try {
      const res = await addShoppingListItem(value);
      setItems(res.items);
      setSummary(res.summary);
      setGeneration(res.generation);
      setDraft("");
    } catch {
      Alert.alert(language === "tr" ? "Hata" : "Error", language === "tr" ? "Liste maddesi eklenemedi." : "Could not add item.");
    } finally {
      setAdding(false);
    }
  }

  async function handleGenerateFromPlan() {
    setGenerating(true);
    try {
      const res = await generateShoppingListFromTodayPlan();
      setItems(res.items);
      setSummary(res.summary);
      setGeneration(res.generation);
    } catch {
      Alert.alert(language === "tr" ? "Hata" : "Error", language === "tr" ? "Plan listesi oluşturulamadı." : "Could not generate plan list.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggle(item: ShoppingListItem) {
    setBusyId(item.id);
    try {
      const res = await toggleShoppingListItem(item.id, !item.isChecked);
      setItems(res.items);
      setSummary(res.summary);
      setGeneration(res.generation);
    } catch {
      Alert.alert(language === "tr" ? "Hata" : "Error", language === "tr" ? "Durum güncellenemedi." : "Could not update item.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: ShoppingListItem) {
    setBusyId(item.id);
    try {
      await deleteShoppingListItem(item.id);
      await load();
    } catch {
      Alert.alert(language === "tr" ? "Hata" : "Error", language === "tr" ? "Madde silinemedi." : "Could not delete item.");
      setBusyId(null);
    }
  }

  async function handleClearChecked() {
    try {
      const res = await clearCheckedShoppingListItems();
      setItems(res.items);
      setSummary(res.summary);
      setGeneration(res.generation);
    } catch {
      Alert.alert(language === "tr" ? "Hata" : "Error", language === "tr" ? "Temizleme işlemi başarısız." : "Could not clear checked items.");
    }
  }

  async function handleShare() {
    if (items.length === 0) return;
    const activeItems = items.filter(i => !i.isChecked);
    const checkedItems = items.filter(i => i.isChecked);
    const lines: string[] = [];
    if (activeItems.length > 0) {
      lines.push(language === "tr" ? "🛒 Alınacaklar:" : "🛒 To buy:");
      activeItems.forEach(i => lines.push(`• ${i.title}`));
    }
    if (checkedItems.length > 0) {
      lines.push("");
      lines.push(language === "tr" ? "✅ Alınanlar:" : "✅ Got:");
      checkedItems.forEach(i => lines.push(`• ${i.title}`));
    }
    try {
      await Share.share({ message: lines.join("\n") });
    } catch { /* user cancelled */ }
  }

  function sourceLabel(sourceType: string) {
    switch (sourceType) {
      case "TodayPlan":
        return copy.sourcePlan;
      case "Recipe":
        return copy.sourceRecipe;
      case "Kitchen":
        return copy.sourceKitchen;
      default:
        return copy.sourceManual;
    }
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={30}
        iconColor={`${theme.primary}42`}
        style={[s.glowA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="carrot"
        iconSize={26}
        iconColor={`${theme.emerald}40`}
        style={[s.glowB, { backgroundColor: theme.emeraldGlow }]}
      />

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 20) + 56 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => (navigation as any).goBack()}
        >
          <Ionicons name="chevron-back" size={16} color={theme.textSub} />
          <Text style={[s.backTxt, { color: theme.textSub }]}>{copy.back}</Text>
        </TouchableOpacity>

        <View style={[s.hero, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <View style={s.heroTop}>
            <View style={[s.eyebrow, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Text style={[s.eyebrowTxt, { color: theme.primaryDark }]}>{copy.eyebrow}</Text>
            </View>
            <View style={[s.counter, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.counterNum, { color: theme.text }]}>{summary.activeCount}</Text>
              <Text style={[s.counterTxt, { color: theme.textMuted }]}>{copy.active}</Text>
            </View>
          </View>
          <Text style={[s.heroTitle, { color: theme.text }]}>{copy.title}</Text>
          <Text style={[s.heroSub, { color: theme.textSub }]}>{copy.subtitle}</Text>

          <View style={s.summaryRow}>
            <View style={[s.metricCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricNum, { color: theme.primary }]}>{summary.total}</Text>
              <Text style={[s.metricTxt, { color: theme.textMuted }]}>{copy.active}</Text>
            </View>
            <View style={[s.metricCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricNum, { color: theme.emerald }]}>{summary.checkedCount}</Text>
              <Text style={[s.metricTxt, { color: theme.textMuted }]}>{copy.checked}</Text>
            </View>
          </View>
        </View>

        <View style={[s.composer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={copy.addPlaceholder}
            placeholderTextColor={theme.textMuted}
            style={[s.input, { color: theme.text }]}
          />
          <TouchableOpacity
            style={[s.inlineBtn, { backgroundColor: theme.primary }]}
            onPress={handleAdd}
            disabled={adding || !draft.trim()}
          >
            {adding ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.inlineBtnTxt}>{copy.add}</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={handleGenerateFromPlan}
            disabled={generating}
          >
            {generating ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="sparkles-outline" size={16} color={theme.primary} />}
            <Text style={[s.actionBtnTxt, { color: theme.text }]}>{copy.generate}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={handleClearChecked}
            disabled={completedItems.length === 0}
          >
            <Ionicons name="trash-outline" size={16} color={theme.textSub} />
            <Text style={[s.actionBtnTxt, { color: theme.text }]}>{copy.clearChecked}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => void handleShare()}
            disabled={items.length === 0}
          >
            <Ionicons name="share-outline" size={16} color={theme.accentCyan} />
            <Text style={[s.actionBtnTxt, { color: theme.text }]}>{copy.share}</Text>
          </TouchableOpacity>
        </View>

        {!!generation && (
          <View style={[s.aiCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
            <View style={[s.aiIconWrap, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.aiTitle, { color: theme.text }]}>{copy.aiTitle}</Text>
              <Text style={[s.aiDesc, { color: theme.textSub }]}>{generation.message}</Text>
            </View>
            <View style={[s.aiCount, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.aiCountNum, { color: theme.primary }]}>{generation.generatedCount}</Text>
              <Text style={[s.aiCountTxt, { color: theme.textMuted }]}>{copy.aiCountLabel}</Text>
            </View>
          </View>
        )}

        {loading ? (
          <View style={[s.stateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : items.length === 0 ? (
          <AppEmptyState
            icon="🛒"
            title={copy.emptyTitle}
            description={copy.emptyDesc}
            buttonLabel={copy.generate}
            onButtonPress={handleGenerateFromPlan}
          />
        ) : (
          <View style={s.list}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.88}
                style={[
                  s.itemCard,
                  {
                    backgroundColor: item.isChecked ? theme.surfaceElevated : theme.surface,
                    borderColor: item.isChecked ? `${theme.emerald}30` : theme.border,
                  },
                ]}
                onPress={() => void handleToggle(item)}
              >
                <View style={[s.checkWrap, { backgroundColor: item.isChecked ? theme.emerald : theme.surfaceElevated, borderColor: item.isChecked ? `${theme.emerald}22` : theme.border }]}>
                  <Ionicons
                    name={item.isChecked ? "checkmark" : "ellipse-outline"}
                    size={16}
                    color={item.isChecked ? "#FFFFFF" : theme.textMuted}
                  />
                </View>
                <View style={s.itemBody}>
                  <View style={s.itemTop}>
                    <Text
                      style={[
                        s.itemTitle,
                        { color: theme.text },
                        item.isChecked && { textDecorationLine: "line-through", color: theme.textMuted },
                      ]}
                    >
                      {item.title}
                    </Text>
                    <View style={[s.sourcePill, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
                      <Text style={[s.sourcePillTxt, { color: theme.emerald }]}>{sourceLabel(item.sourceType)}</Text>
                    </View>
                  </View>
                  {!!item.note && (
                    <Text style={[s.itemMeta, { color: theme.textMuted }]} numberOfLines={2}>
                      {item.note}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={s.deleteTap}
                  onPress={() => void handleDelete(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator size="small" color={theme.textSub} />
                  ) : (
                    <Ionicons name="close-outline" size={22} color={theme.textSub} />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  glowA: {
    position: "absolute",
    top: -48,
    right: -36,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.48,
  },
  glowB: {
    position: "absolute",
    bottom: 120,
    left: -70,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.32,
  },
  scroll: { paddingHorizontal: spacing.base },
  backBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: spacing.base,
  },
  backTxt: { fontSize: 13, fontWeight: "700" },
  hero: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  eyebrow: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eyebrowTxt: { fontSize: 11, fontWeight: "800" },
  counter: {
    minWidth: 66,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  counterNum: { fontSize: 20, fontWeight: "900" },
  counterTxt: { fontSize: 10, fontWeight: "700" },
  heroTitle: {
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  heroSub: { fontSize: 13, lineHeight: 19, marginBottom: spacing.base },
  summaryRow: { flexDirection: "row", gap: spacing.sm },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  metricNum: { fontSize: 22, fontWeight: "900", marginBottom: 2 },
  metricTxt: { fontSize: 11, fontWeight: "700" },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: "600",
  },
  inlineBtn: {
    minHeight: 48,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineBtnTxt: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.base },
  aiCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.base,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  aiIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  aiTitle: { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  aiDesc: { fontSize: 12, lineHeight: 18 },
  aiCount: {
    minWidth: 58,
    borderWidth: 1,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiCountNum: { fontSize: 20, fontWeight: "900" },
  aiCountTxt: { fontSize: 10, fontWeight: "700" },
  actionBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  actionBtnTxt: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  stateCard: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    paddingVertical: 36,
    alignItems: "center",
  },
  list: { gap: spacing.sm },
  itemCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: { flex: 1, gap: 4 },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: "800" },
  itemMeta: { fontSize: 12, lineHeight: 17 },
  sourcePill: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourcePillTxt: { fontSize: 10, fontWeight: "800" },
  deleteTap: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});

