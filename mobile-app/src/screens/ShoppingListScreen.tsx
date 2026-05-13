import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { useFeedback } from "../context/FeedbackContext";
import { Routes } from "../navigation/routes";
import { radii, spacing } from "../theme/tokens";
import { mapApiError } from "../utils/apiError";
import ProduceBubble from "../components/decor/ProduceBubble";
import DytopiaWatermark from "../components/decor/DytopiaWatermark";
import AppEmptyState from "../components/ui/AppEmptyState";
import DytopiaLoadingState from "../components/ui/DytopiaLoadingState";
import AnimatedCard from "../components/ui/AnimatedCard";
import PulseBadge from "../components/ui/PulseBadge";
import SuccessSettleWrapper from "../components/ui/SuccessSettleWrapper";
import {
  addShoppingListItem,
  clearCheckedShoppingListItems,
  deleteShoppingListItem,
  generateShoppingListFromTodayPlan,
  getShoppingList,
  type ShoppingListResponse,
  type ShoppingListItem,
  type ShoppingPlanRecipeCard,
  type ShoppingListSummary,
  toggleShoppingListItem,
} from "../api/shopping-list";

const EMPTY_SUMMARY: ShoppingListSummary = { total: 0, checkedCount: 0, activeCount: 0 };

function formatAmountValue(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return Number(value).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function formatMeasuredName(item: {
  title?: string;
  ingredientName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  displayAmount?: string | null;
}) {
  const name = item.ingredientName || item.title || "";
  const amount = item.displayAmount?.trim() || (item.quantity != null && item.unit ? `${formatAmountValue(item.quantity)} ${item.unit}` : "");
  return amount && name ? `${amount} ${name}` : name;
}

function marketAisleRank(title: string) {
  const normalized = title.toLocaleLowerCase("tr-TR");
  if (/(marul|domates|salatalık|brokoli|ıspanak|maydanoz|sebze|biber|soğan|patates|havuç)/.test(normalized)) return 1;
  if (/(elma|muz|portakal|çilek|meyve|limon|avokado)/.test(normalized)) return 2;
  if (/(süt|yoğurt|peynir|kefir|ayran)/.test(normalized)) return 3;
  if (/(tavuk|et|balık|ton|hindi|yumurta)/.test(normalized)) return 4;
  if (/(bulgur|pirinç|makarna|un|yulaf|ekmek)/.test(normalized)) return 5;
  if (/(zeytinyağı|yağ|baharat|tuz|karabiber|sos)/.test(normalized)) return 6;
  return 9;
}

export default function ShoppingListScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { showDialog, showToast } = useFeedback();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isPremium = user?.isPremium === true;

  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [summary, setSummary] = useState<ShoppingListSummary>(EMPTY_SUMMARY);
  const [generation, setGeneration] = useState<ShoppingListResponse["generation"] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "meal" | "market">("list");
  const [expandedPlanCardKey, setExpandedPlanCardKey] = useState<string | null>(null);

  const copy = language === "en"
    ? {
        back: "Back",
        eyebrow: "SMART GROCERY",
        title: "Shopping List",
        subtitle: "Missing ingredients from your plan and kitchen flow collect here.",
        heroNoteTitle: "Stays in sync with your plan",
        heroNoteBody: "Missing items from your meal flow and your own additions stay together in one place.",
        active: "active",
        checked: "checked",
        totalItems: "items",
        fromPlan: "from plan",
        quickAddTitle: "Quick add",
        quickAddHint: "Drop in pantry needs that are not in today plan.",
        actionsTitle: "Quick actions",
        addPlaceholder: "Add a custom item",
        add: "Add item",
        generate: "Generate from today plan",
        clearChecked: "Clear checked",
        aiTitle: "Smart grocery sweep",
        aiCountLabel: "items",
        emptyTitle: "Your list is fresh",
        emptyDesc: "Generate ingredients from your plan or add custom pantry needs.",
        activeSection: "To buy",
        completedSection: "Completed",
        listView: "List",
        mealView: "By meal",
        marketView: "Market",
        marketModeTitle: "Market mode",
        marketModeHint: "Bigger taps, calmer list, faster checkout.",
        mealBreakdown: "Meal breakdown",
        selectedRecipePrefix: "Selected recipe",
        mandatory: "Mandatory",
        optional: "Optional",
        flavoring: "Flavoring",
        moreMealsSuffix: "more meals",
        sourcePlan: "Plan",
        sourceKitchen: "Kitchen",
        sourceRecipe: "Recipe",
        sourceManual: "Manual",
        share: "Share list",
        planCardsTitle: "Today's plan cards",
        pantryCoveredTitle: "Skipped because it is in your pantry",
        missingTitle: "To buy for this recipe",
        noMissingForRecipe: "Your pantry already covers this recipe.",
      }
    : {
        back: "Geri",
        eyebrow: "AKILLI LİSTE",
        title: "Alışveriş Listesi",
        subtitle: "Plan ve mutfak akışında eksik kalan malzemeler burada toplanır.",
        heroNoteTitle: "Planınla senkron ilerler",
        heroNoteBody: "Planından gelen eksikler ve senin eklediğin maddeler aynı listede toplanır.",
        active: "aktif",
        checked: "tamam",
        totalItems: "ürün",
        fromPlan: "plandan",
        quickAddTitle: "Hızlı ekle",
        quickAddHint: "Plan dışında kalan ihtiyaçlarını da aynı listede tut.",
        actionsTitle: "Hızlı işlemler",
        addPlaceholder: "Listeye özel madde ekle",
        add: "Madde ekle",
        generate: "Bugünün planından üret",
        clearChecked: "Tamamlananları temizle",
        aiTitle: "Akıllı alışveriş özeti",
        aiCountLabel: "ürün",
        emptyTitle: "Listen hazır bekliyor",
        emptyDesc: "Planından malzeme üret veya kendi ihtiyaçlarını tek satırla ekle.",
        activeSection: "Alınacaklar",
        completedSection: "Tamamlananlar",
        listView: "Liste",
        mealView: "Öğün Bazlı",
        marketView: "Market",
        marketModeTitle: "Market modu",
        marketModeHint: "Daha büyük dokunuş alanı, daha sakin liste, daha hızlı alışveriş.",
        mealBreakdown: "Öğün kırılımı",
        selectedRecipePrefix: "Seçilen tarif",
        mandatory: "Zorunlu",
        optional: "Opsiyonel",
        flavoring: "Lezzetlendirici",
        moreMealsSuffix: "öğün daha",
        sourcePlan: "Plan",
        sourceKitchen: "Mutfak",
        sourceRecipe: "Tarif",
        sourceManual: "Elle",
        share: "Listeyi Paylaş",
        planCardsTitle: "Bugünün plan kartları",
        pantryCoveredTitle: "Dolabında var diye listeye eklenmedi",
        missingTitle: "Bu tarif için alınacaklar",
        noMissingForRecipe: "Dolabın bu tarifi şimdilik karşılıyor.",
      };

  const load = useCallback(async () => {
    try {
      const res = await getShoppingList();
      setItems(res.items);
      setSummary(res.summary);
      setGeneration(res.generation);
    } catch (error) {
      const mapped = mapApiError(error, language);
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      showToast({ variant: "error", title: mapped.title, message: mapped.message });
    } finally {
      setLoading(false);
      setGenerating(false);
      setAdding(false);
      setBusyId(null);
    }
  }, [language, showToast]);

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

  const activeItems = useMemo(
    () => items.filter((item) => !item.isChecked),
    [items],
  );

  const planLinkedCount = useMemo(
    () => items.filter((item) => item.sourceType === "TodayPlan" || item.sourceType === "Recipe").length,
    [items],
  );

  const categoryLabel = useCallback((category?: string | null) => {
    switch ((category ?? "").toLowerCase()) {
      case "mandatory":
        return copy.mandatory;
      case "optional":
        return copy.optional;
      case "flavoring":
        return copy.flavoring;
      default:
        return copy.mandatory;
    }
  }, [copy.flavoring, copy.mandatory, copy.optional]);

  const categoryTone = useCallback((category?: string | null) => {
    switch ((category ?? "").toLowerCase()) {
      case "optional":
        return { fg: theme.primary, bg: `${theme.primary}12`, border: `${theme.primary}2c` };
      case "flavoring":
        return { fg: theme.accentGold, bg: `${theme.accentGold}12`, border: `${theme.accentGold}2c` };
      default:
        return { fg: theme.emerald, bg: `${theme.emerald}12`, border: `${theme.emerald}2c` };
    }
  }, [theme.accentGold, theme.emerald, theme.primary]);

  const getRoleSummary = useCallback((item: ShoppingListItem) => {
    const roles = item.ingredientRoleSummary?.length
      ? item.ingredientRoleSummary
      : item.sourceMeals?.map((meal) => meal.category).filter(Boolean) ?? [];
    return Array.from(new Set(roles));
  }, []);

  const getMealCaption = useCallback((item: ShoppingListItem) => {
    if (!item.primaryMealTitle) return null;
    return item.primaryMealTime
      ? `${item.primaryMealTitle} • ${item.primaryMealTime}`
      : item.primaryMealTitle;
  }, []);

  const activeMealGroups = useMemo(() => buildMealGroups(activeItems), [activeItems, language]);
  const completedMealGroups = useMemo(() => buildMealGroups(completedItems), [completedItems, language]);
  const marketRouteItems = useMemo(
    () => [...activeItems].sort((a, b) => marketAisleRank(formatMeasuredName(a)) - marketAisleRank(formatMeasuredName(b)) || formatMeasuredName(a).localeCompare(formatMeasuredName(b), language === "tr" ? "tr" : "en")),
    [activeItems, language],
  );
  const recipeCards = generation?.recipeCards ?? [];

  const smartAssist = useMemo(() => {
    if (summary.activeCount >= 6) {
      return {
        title: language === "tr" ? "Tek koşuda markete hazırsın" : "You are ready for one clean run",
        body: language === "tr"
          ? `${summary.activeCount} aktif madde var. Önce plan kaynaklı eksikleri kapat, sonra dolabı güncelle.`
          : `${summary.activeCount} active items are waiting. Close plan-driven gaps first, then refresh the pantry.`,
      };
    }
    if (generation?.generatedCount) {
      return {
        title: language === "tr" ? "Plan odaklı alışveriş akışı açıldı" : "Plan-led grocery flow is open",
        body: language === "tr"
          ? `${generation.generatedCount} yeni madde eklendi. Şimdi dolabınla karşılaştırıp gereksizleri ayıklayabilirsin.`
          : `${generation.generatedCount} items were added. Now compare them with your pantry and trim the unnecessary ones.`,
      };
    }
    return {
      title: language === "tr" ? "Listeyi dolapla birlikte yönet" : "Run the list together with your pantry",
      body: language === "tr"
        ? "Evde olanlarla eksikleri ayırmak, mutfak tarafında daha temiz eşleşmeler verir."
        : "Separating what is at home from what is missing creates cleaner kitchen matches.",
    };
  }, [generation?.generatedCount, language, summary.activeCount]);

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
      showToast({
        variant: "success",
        title: language === "tr" ? "Listeye eklendi" : "Added to list",
        message: value,
      });
    } catch (error) {
      const mapped = mapApiError(error, language);
      showToast({ variant: "error", title: mapped.title, message: mapped.message });
    } finally {
      setAdding(false);
    }
  }

  async function handleGenerateFromPlan() {
    if (!isPremium) {
      showDialog({
        variant: "info",
        icon: "lock-closed-outline",
        eyebrow: language === "tr" ? "Premium plan" : "Premium plan",
        title: language === "tr" ? "Plan bazlı liste premium ile açılır" : "Plan-based list generation is premium",
        message: language === "tr"
          ? "Free modda manuel liste ve public tarif eksikleri açık. Bugünün klinik planından otomatik üretim için premium aktivasyon gerekir."
          : "Free mode supports manual lists and public recipe gaps. Automatic generation from today's clinic plan requires premium.",
        secondaryAction: { label: language === "tr" ? "Tamam" : "OK", tone: "muted" },
        primaryAction: {
          label: language === "tr" ? "Premium'u Aktive Et" : "Activate premium",
          tone: "primary",
          onPress: () => {
            const parent = (navigation as any).getParent?.();
            if (parent?.navigate) {
              parent.navigate(Routes.Modal.ActivatePremium);
              return;
            }
            (navigation as any).navigate(Routes.Modal.ActivatePremium);
          },
        },
      });
      return;
    }

    setGenerating(true);
    try {
      const res = await generateShoppingListFromTodayPlan();
      setItems(res.items);
      setSummary(res.summary);
      setGeneration(res.generation);
      showToast({
        variant: "success",
        title: language === "tr" ? "Plan listesi hazır" : "Plan list is ready",
        message: language === "tr" ? `${res.summary.activeCount} aktif madde listede.` : `${res.summary.activeCount} active items are on the list.`,
      });
    } catch (error) {
      const mapped = mapApiError(error, language);
      showToast({ variant: "error", title: mapped.title, message: mapped.message });
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
    } catch (error) {
      const mapped = mapApiError(error, language);
      showToast({ variant: "error", title: mapped.title, message: mapped.message });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: ShoppingListItem) {
    setBusyId(item.id);
    const deletedTitle = formatMeasuredName(item) || item.title;
    try {
      await deleteShoppingListItem(item.id);
      await load();
      showToast({
        variant: "warning",
        title: language === "tr" ? "Madde silindi" : "Item deleted",
        message: deletedTitle,
        durationMs: 5600,
        action: {
          label: language === "tr" ? "Geri al" : "Undo",
          icon: "return-up-back-outline",
          tone: "warning",
          onPress: async () => {
            try {
              const res = await addShoppingListItem(deletedTitle);
              setItems(res.items);
              setSummary(res.summary);
              setGeneration(res.generation);
              showToast({ variant: "success", title: language === "tr" ? "Geri alındı" : "Restored", message: deletedTitle });
            } catch {
              showToast({ variant: "error", title: language === "tr" ? "Geri alınamadı" : "Could not restore", message: deletedTitle });
            }
          },
        },
      });
    } catch (error) {
      const mapped = mapApiError(error, language);
      showToast({ variant: "error", title: mapped.title, message: mapped.message });
      setBusyId(null);
    }
  }

  async function handleClearChecked() {
    try {
      const res = await clearCheckedShoppingListItems();
      setItems(res.items);
      setSummary(res.summary);
      setGeneration(res.generation);
      showToast({
        variant: "success",
        title: language === "tr" ? "Tamamlananlar temizlendi" : "Checked items cleared",
      });
    } catch (error) {
      const mapped = mapApiError(error, language);
      showToast({ variant: "error", title: mapped.title, message: mapped.message });
    }
  }

  async function handleShare() {
    if (items.length === 0) return;
    const shareActiveItems = items.filter(i => !i.isChecked);
    const checkedItems = items.filter(i => i.isChecked);
    const lines: string[] = [];
    if (shareActiveItems.length > 0) {
      lines.push(language === "tr" ? "🛒 Alınacaklar:" : "🛒 To buy:");
      shareActiveItems.forEach(i => lines.push(`• ${i.title}`));
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

  function buildMealGroups(sourceItems: ShoppingListItem[]) {
    const orderMap = new Map<string, {
      key: string;
      mealTitle: string;
      mealTime: string;
      selectedRecipeName?: string | null;
      generatedFromSelectedRecipe?: boolean;
      mandatory: ShoppingListItem[];
      optional: ShoppingListItem[];
      flavoring: ShoppingListItem[];
    }>();

    sourceItems.forEach((item) => {
      const sourceMeals = item.sourceMeals?.length
        ? item.sourceMeals
        : [{
            mealItemId: `manual-${item.id}`,
            mealTitle: item.primaryMealTitle ?? copy.sourceManual,
            mealTime: item.primaryMealTime ?? "",
            category: item.ingredientRoleSummary?.[0] ?? "Mandatory",
            selectedRecipeName: null,
            generatedFromSelectedRecipe: item.generatedFromSelectedRecipe,
          }];

      sourceMeals.forEach((meal) => {
        const key = `${meal.mealItemId}:${meal.mealTitle}:${meal.mealTime}`;
        if (!orderMap.has(key)) {
          orderMap.set(key, {
            key,
            mealTitle: meal.mealTitle,
            mealTime: meal.mealTime,
            selectedRecipeName: meal.selectedRecipeName,
            generatedFromSelectedRecipe: meal.generatedFromSelectedRecipe,
            mandatory: [],
            optional: [],
            flavoring: [],
          });
        }

        const group = orderMap.get(key)!;
        const bucketName =
          meal.category === "Optional"
            ? "optional"
            : meal.category === "Flavoring"
              ? "flavoring"
              : "mandatory";
        const bucket = group[bucketName];
        if (!bucket.some((entry) => entry.id === item.id)) {
          bucket.push(item);
        }
      });
    });

    return Array.from(orderMap.values()).sort((a, b) => {
      if (!a.mealTime && !b.mealTime) return a.mealTitle.localeCompare(b.mealTitle, "tr");
      if (!a.mealTime) return 1;
      if (!b.mealTime) return -1;
      return a.mealTime.localeCompare(b.mealTime, "tr");
    });
  }

  function renderShoppingItem(item: ShoppingListItem) {
    const mealCaption = getMealCaption(item);
    const roleSummary = getRoleSummary(item);
    const additionalMeals = Math.max(0, (item.sourceMeals?.length ?? 0) - 1);

    return (
      <Animated.View
        key={item.id}
        entering={FadeInDown.duration(180)}
        exiting={FadeOutUp.duration(140)}
        layout={LinearTransition.duration(160)}
      >
        <TouchableOpacity
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
                {formatMeasuredName({ ...item, ingredientName: item.ingredientName ?? item.title })}
              </Text>
              <View style={[s.sourcePill, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
                <Text style={[s.sourcePillTxt, { color: theme.emerald }]}>{sourceLabel(item.sourceType)}</Text>
              </View>
            </View>
            <View style={s.itemMetaWrap}>
              {!!mealCaption && (
                <Text style={[s.itemMealCaption, { color: theme.textMuted }]} numberOfLines={1}>
                  {mealCaption}
                </Text>
              )}
              {additionalMeals > 0 && (
                <Text style={[s.itemMeta, { color: theme.primary }]}>
                  +{additionalMeals} {copy.moreMealsSuffix}
                </Text>
              )}
            </View>
            {roleSummary.length > 0 && (
              <View style={s.rolePillRow}>
                {roleSummary.map((role) => {
                  const tone = categoryTone(role);
                  return (
                    <View
                      key={`${item.id}-${role}`}
                      style={[s.rolePill, { backgroundColor: tone.bg, borderColor: tone.border }]}
                    >
                      <Text style={[s.rolePillTxt, { color: tone.fg }]}>{categoryLabel(role)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
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
      </Animated.View>
    );
  }

  function renderMarketItem(item: ShoppingListItem, index: number) {
    const mealCaption = getMealCaption(item);
    const roleSummary = getRoleSummary(item);
    const primaryRole = roleSummary[0] ?? "Mandatory";
    const tone = categoryTone(primaryRole);

    return (
      <Animated.View
        key={item.id}
        entering={FadeInDown.delay(Math.min(index * 18, 120)).duration(160)}
        exiting={FadeOutUp.duration(130)}
        layout={LinearTransition.duration(150)}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            s.marketItemCard,
            {
              backgroundColor: item.isChecked ? theme.surfaceElevated : theme.surface,
              borderColor: item.isChecked ? `${theme.emerald}36` : theme.border,
            },
          ]}
          onPress={() => void handleToggle(item)}
        >
          <View style={[
            s.marketCheck,
            {
              backgroundColor: item.isChecked ? theme.emerald : `${tone.fg}10`,
              borderColor: item.isChecked ? `${theme.emerald}22` : `${tone.fg}2e`,
            },
          ]}>
            <Ionicons
              name={item.isChecked ? "checkmark" : "ellipse-outline"}
              size={23}
              color={item.isChecked ? "#FFFFFF" : tone.fg}
            />
          </View>
          <View style={s.marketItemBody}>
            <Text
              style={[
                s.marketItemTitle,
                { color: theme.text },
                item.isChecked && { textDecorationLine: "line-through", color: theme.textMuted },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <View style={s.marketMetaRow}>
              {!!mealCaption && (
                <Text style={[s.marketMetaText, { color: theme.textMuted }]} numberOfLines={1}>
                  {mealCaption}
                </Text>
              )}
              <View style={[s.marketRolePill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                <Text style={[s.marketRoleText, { color: tone.fg }]}>{categoryLabel(primaryRole)}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={s.marketDelete}
            onPress={() => void handleDelete(item)}
            disabled={busyId === item.id}
            activeOpacity={0.72}
          >
            {busyId === item.id ? (
              <ActivityIndicator size="small" color={theme.textSub} />
            ) : (
              <Ionicons name="remove-circle-outline" size={22} color={theme.textSub} />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  function renderMealGroupedSections(sourceGroups: ReturnType<typeof buildMealGroups>, accentColor: string) {
    return sourceGroups.map((group, index) => (
      <AnimatedCard
        key={group.key}
        delay={120 + index * 40}
        style={[s.mealGroupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={s.mealGroupTop}>
          <View>
            <Text style={[s.mealGroupTitle, { color: theme.text }]}>{group.mealTitle}</Text>
            {!!group.mealTime && (
              <Text style={[s.mealGroupTime, { color: theme.textMuted }]}>{group.mealTime}</Text>
            )}
          </View>
          <View style={[s.mealGroupCount, { backgroundColor: `${accentColor}12`, borderColor: `${accentColor}2c` }]}>
            <Text style={[s.mealGroupCountTxt, { color: accentColor }]}>
              {group.mandatory.length + group.optional.length + group.flavoring.length}
            </Text>
          </View>
        </View>

        {!!group.selectedRecipeName && group.generatedFromSelectedRecipe && (
          <View style={[s.selectedRecipeHintCard, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}24` }]}>
            <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
            <Text style={[s.selectedRecipeHintText, { color: theme.primary }]}>
              {copy.selectedRecipePrefix}: {group.selectedRecipeName}
            </Text>
          </View>
        )}

        {([
          ["mandatory", group.mandatory],
          ["optional", group.optional],
          ["flavoring", group.flavoring],
        ] as const).map(([bucket, bucketItems]) => {
          if (bucketItems.length === 0) return null;
          const tone = categoryTone(bucket === "mandatory" ? "Mandatory" : bucket === "optional" ? "Optional" : "Flavoring");
          return (
            <View key={`${group.key}-${bucket}`} style={s.mealCategoryBlock}>
              <View style={[s.mealCategoryPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                <Text style={[s.mealCategoryPillTxt, { color: tone.fg }]}>
                  {bucket === "mandatory" ? copy.mandatory : bucket === "optional" ? copy.optional : copy.flavoring}
                </Text>
              </View>
              <View style={s.mealCategoryItems}>
                {bucketItems.map(renderShoppingItem)}
              </View>
            </View>
          );
        })}
      </AnimatedCard>
    ));
  }

  function renderIngredientGroup(
    label: string,
    category: "Mandatory" | "Optional" | "Flavoring",
    ingredients: ShoppingPlanRecipeCard["missingGroups"]["mandatory"],
  ) {
    if (ingredients.length === 0) return null;
    const tone = categoryTone(category);
    return (
      <View style={s.planCardGroup}>
        <View style={[s.planCardGroupPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text style={[s.planCardGroupPillText, { color: tone.fg }]}>{label}</Text>
        </View>
        <View style={s.planCardIngredientWrap}>
          {ingredients.map((ingredient) => (
            <View
              key={`${category}-${ingredient.ingredientId}`}
              style={[s.planCardIngredientChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            >
              <Text style={[s.planCardIngredientText, { color: theme.textSub }]}>{formatMeasuredName(ingredient)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderRecipePlanCard(card: ShoppingPlanRecipeCard, index: number) {
    const expanded = expandedPlanCardKey === card.mealItemId;
    const hasMissing = card.missingCount > 0;
    const hasCovered = card.pantryCoveredCount > 0;
    const sourceIsAlternative = card.selectedRecipeSource === "Alternative" || card.generatedFromSelectedRecipe;

    return (
      <AnimatedCard
        key={card.mealItemId}
        delay={300 + index * 35}
        style={[s.planRecipeCard, { backgroundColor: theme.surface, borderColor: sourceIsAlternative ? `${theme.accentGold}34` : theme.border }]}
      >
        <TouchableOpacity
          style={s.planRecipeCardHead}
          activeOpacity={0.86}
          onPress={() => setExpandedPlanCardKey(expanded ? null : card.mealItemId)}
        >
          <View style={[s.planRecipeIcon, { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}26` }]}>
            <Ionicons name={sourceIsAlternative ? "sparkles-outline" : "restaurant-outline"} size={17} color={sourceIsAlternative ? theme.accentGold : theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.planRecipeMeal, { color: theme.textMuted }]}>
              {card.mealTime ? `${card.mealTitle} • ${card.mealTime}` : card.mealTitle}
            </Text>
            <Text style={[s.planRecipeTitle, { color: theme.text }]} numberOfLines={2}>{card.recipeName}</Text>
            {sourceIsAlternative && !!card.plannedRecipeName && card.plannedRecipeName !== card.recipeName && (
              <Text style={[s.planRecipeSub, { color: theme.textMuted }]} numberOfLines={1}>
                {language === "tr" ? "Planlanan:" : "Planned:"} {card.plannedRecipeName}
              </Text>
            )}
          </View>
          <View style={[s.planCoveragePill, { backgroundColor: `${theme.emerald}12`, borderColor: `${theme.emerald}28` }]}>
            <Text style={[s.planCoverageText, { color: theme.emerald }]}>%{card.coveragePercent}</Text>
          </View>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textSub} />
        </TouchableOpacity>

        {expanded && (
          <View style={[s.planRecipeDetails, { borderTopColor: theme.border }]}>
            <View style={s.planRecipeSummaryRow}>
              <View style={[s.planRecipeMiniStat, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[s.planRecipeMiniStatValue, { color: theme.primary }]}>{card.missingCount}</Text>
                <Text style={[s.planRecipeMiniStatLabel, { color: theme.textMuted }]}>{language === "tr" ? "eksik" : "missing"}</Text>
              </View>
              <View style={[s.planRecipeMiniStat, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[s.planRecipeMiniStatValue, { color: theme.emerald }]}>{card.pantryCoveredCount}</Text>
                <Text style={[s.planRecipeMiniStatLabel, { color: theme.textMuted }]}>{language === "tr" ? "dolapta" : "in pantry"}</Text>
              </View>
            </View>

            <Text style={[s.planRecipeSectionTitle, { color: hasMissing ? theme.text : theme.emerald }]}>
              {hasMissing ? copy.missingTitle : copy.noMissingForRecipe}
            </Text>
            {renderIngredientGroup(copy.mandatory, "Mandatory", card.missingGroups.mandatory)}
            {renderIngredientGroup(copy.optional, "Optional", card.missingGroups.optional)}
            {renderIngredientGroup(copy.flavoring, "Flavoring", card.missingGroups.flavoring)}

            {hasCovered && (
              <View style={[s.coveredBox, { backgroundColor: `${theme.emerald}0D`, borderColor: `${theme.emerald}24` }]}>
                <Text style={[s.planRecipeSectionTitle, { color: theme.emerald }]}>{copy.pantryCoveredTitle}</Text>
                {renderIngredientGroup(copy.mandatory, "Mandatory", card.pantryCoveredGroups.mandatory)}
                {renderIngredientGroup(copy.optional, "Optional", card.pantryCoveredGroups.optional)}
                {renderIngredientGroup(copy.flavoring, "Flavoring", card.pantryCoveredGroups.flavoring)}
              </View>
            )}
          </View>
        )}
      </AnimatedCard>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <DytopiaWatermark position="center" size={300} opacity={0.036} />
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

        <AnimatedCard delay={40} style={[s.hero, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <View style={s.heroTop}>
            <View style={[s.eyebrow, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Text style={[s.eyebrowTxt, { color: theme.primaryDark }]}>{copy.eyebrow}</Text>
            </View>
            <SuccessSettleWrapper trigger={summary.total}>
              <PulseBadge
                active={summary.total > 0}
                color={theme.primary}
                backgroundColor={theme.surfaceElevated}
                borderColor={theme.border}
                textColor={theme.text}
                label={`${summary.total} ${copy.totalItems}`}
              />
            </SuccessSettleWrapper>
          </View>
          <Text style={[s.heroTitle, { color: theme.text }]}>{copy.title}</Text>
          <Text style={[s.heroSub, { color: theme.textSub }]}>{copy.subtitle}</Text>

          <View style={[s.heroNoteCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
            <View style={[s.heroNoteIcon, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroNoteTitle, { color: theme.text }]}>{copy.heroNoteTitle}</Text>
              <Text style={[s.heroNoteBody, { color: theme.textSub }]}>{copy.heroNoteBody}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.heroPantryLink, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            onPress={() => (navigation as any).navigate(Routes.App.Pantry)}
            activeOpacity={0.84}
          >
            <View style={[s.heroPantryIcon, { backgroundColor: `${theme.emerald}14`, borderColor: `${theme.emerald}28` }]}>
              <Ionicons name="basket-outline" size={16} color={theme.emerald} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroPantryTitle, { color: theme.text }]}>
                {language === "tr" ? "Dolabımı güncelle" : "Refresh pantry"}
              </Text>
              <Text style={[s.heroPantrySub, { color: theme.textSub }]}>
                {language === "tr"
                  ? "Evdeki malzemeleri aç, eksik listeni daha doğru yönet"
                  : "Open what is at home and keep your list more accurate"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSub} />
          </TouchableOpacity>

          <View style={s.summaryRow}>
            <View style={[s.metricCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricNum, { color: theme.primary }]}>{summary.activeCount}</Text>
              <Text style={[s.metricTxt, { color: theme.textMuted }]}>{copy.active}</Text>
            </View>
            <View style={[s.metricCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricNum, { color: theme.emerald }]}>{summary.checkedCount}</Text>
              <Text style={[s.metricTxt, { color: theme.textMuted }]}>{copy.checked}</Text>
            </View>
            <View style={[s.metricCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.metricNum, { color: theme.accentCyan }]}>{planLinkedCount}</Text>
              <Text style={[s.metricTxt, { color: theme.textMuted }]}>{copy.fromPlan}</Text>
            </View>
          </View>
        </AnimatedCard>

        <AnimatedCard delay={110} style={[s.smartAssistCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <View style={[s.smartAssistIcon, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
            <Ionicons name="bulb-outline" size={16} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.smartAssistTitle, { color: theme.text }]}>{smartAssist.title}</Text>
            <Text style={[s.smartAssistBody, { color: theme.textSub }]}>{smartAssist.body}</Text>
          </View>
        </AnimatedCard>

        <AnimatedCard delay={150} style={[s.composer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={s.composerHead}>
            <Text style={[s.composerTitle, { color: theme.text }]}>{copy.quickAddTitle}</Text>
            <Text style={[s.composerHint, { color: theme.textMuted }]}>{copy.quickAddHint}</Text>
          </View>
          <View style={s.composerRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={copy.addPlaceholder}
              placeholderTextColor={theme.textMuted}
              style={[s.input, { color: theme.text, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            />
            <TouchableOpacity
              style={[s.inlineBtn, { backgroundColor: theme.primary }]}
              onPress={handleAdd}
              disabled={adding || !draft.trim()}
            >
              {adding ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.inlineBtnTxt}>{copy.add}</Text>}
            </TouchableOpacity>
          </View>
        </AnimatedCard>

        <Text style={[s.blockTitle, { color: theme.textMuted }]}>{copy.actionsTitle}</Text>
        <AnimatedCard delay={210}>
        <TouchableOpacity
          style={[s.generateCard, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}
          onPress={handleGenerateFromPlan}
          disabled={generating}
          activeOpacity={0.86}
        >
          <View style={[s.generateIcon, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
            {generating ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="sparkles-outline" size={18} color={theme.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.generateTitle, { color: theme.text }]}>{copy.generate}</Text>
            <Text style={[s.generateHint, { color: theme.textSub }]}>
              {language === "tr"
                ? "Bugünkü tariflerinden eksik kalan malzemeleri tek akışta çıkar."
                : "Pull missing ingredients from today plan in one pass."}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.primary} />
        </TouchableOpacity>
        </AnimatedCard>

        <AnimatedCard delay={250} style={s.actionRow}>
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
        </AnimatedCard>

        <AnimatedCard delay={270} style={[s.viewModeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.viewModeTitle, { color: theme.textMuted }]}>{copy.mealBreakdown}</Text>
          {viewMode === "market" && (
            <View style={[s.marketModeNote, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
              <Ionicons name="bag-check-outline" size={16} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.marketModeTitle, { color: theme.text }]}>{copy.marketModeTitle}</Text>
                <Text style={[s.marketModeHint, { color: theme.textSub }]}>{copy.marketModeHint}</Text>
              </View>
            </View>
          )}
          <View style={s.viewModeRow}>
            <TouchableOpacity
              style={[
                s.viewModeBtn,
                {
                  backgroundColor: viewMode === "list" ? `${theme.primary}12` : theme.surfaceElevated,
                  borderColor: viewMode === "list" ? `${theme.primary}2c` : theme.border,
                },
              ]}
              onPress={() => setViewMode("list")}
              activeOpacity={0.8}
            >
              <Ionicons name="list-outline" size={15} color={viewMode === "list" ? theme.primary : theme.textMuted} />
              <Text style={[s.viewModeBtnTxt, { color: viewMode === "list" ? theme.primary : theme.textSub }]}>
                {copy.listView}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.viewModeBtn,
                {
                  backgroundColor: viewMode === "meal" ? `${theme.primary}12` : theme.surfaceElevated,
                  borderColor: viewMode === "meal" ? `${theme.primary}2c` : theme.border,
                },
              ]}
              onPress={() => setViewMode("meal")}
              activeOpacity={0.8}
            >
              <Ionicons name="grid-outline" size={15} color={viewMode === "meal" ? theme.primary : theme.textMuted} />
              <Text style={[s.viewModeBtnTxt, { color: viewMode === "meal" ? theme.primary : theme.textSub }]}>
                {copy.mealView}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.viewModeBtn,
                {
                  backgroundColor: viewMode === "market" ? `${theme.emerald}12` : theme.surfaceElevated,
                  borderColor: viewMode === "market" ? `${theme.emerald}2c` : theme.border,
                },
              ]}
              onPress={() => setViewMode("market")}
              activeOpacity={0.8}
            >
              <Ionicons name="bag-check-outline" size={15} color={viewMode === "market" ? theme.emerald : theme.textMuted} />
              <Text style={[s.viewModeBtnTxt, { color: viewMode === "market" ? theme.emerald : theme.textSub }]}>
                {copy.marketView}
              </Text>
            </TouchableOpacity>
          </View>
        </AnimatedCard>

        {!!generation && (
          <AnimatedCard delay={290} style={[s.aiCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
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
            <View style={s.generationStatsRow}>
              <View style={[s.generationStatChip, { backgroundColor: `${theme.emerald}12`, borderColor: `${theme.emerald}28` }]}>
                <Text style={[s.generationStatTxt, { color: theme.emerald }]}>{generation.mandatoryCount ?? 0} {copy.mandatory}</Text>
              </View>
              <View style={[s.generationStatChip, { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}28` }]}>
                <Text style={[s.generationStatTxt, { color: theme.primary }]}>{generation.optionalCount ?? 0} {copy.optional}</Text>
              </View>
              <View style={[s.generationStatChip, { backgroundColor: `${theme.accentGold}12`, borderColor: `${theme.accentGold}28` }]}>
                <Text style={[s.generationStatTxt, { color: theme.accentGold }]}>{generation.flavoringCount ?? 0} {copy.flavoring}</Text>
              </View>
            </View>
          </AnimatedCard>
        )}

        {recipeCards.length > 0 && (
          <View style={s.planRecipeSection}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>{copy.planCardsTitle}</Text>
              <View style={[s.sectionCountPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[s.sectionCountTxt, { color: theme.primary }]}>{recipeCards.length}</Text>
              </View>
            </View>
            {recipeCards.map(renderRecipePlanCard)}
          </View>
        )}

        {loading ? (
          <View style={s.loadingShell}>
            <DytopiaLoadingState
              title={language === "tr" ? "Liste hazırlanıyor" : "Preparing your list"}
              subtitle={language === "tr" ? "Dytopia planını, dolabını ve eksikleri birlikte kontrol ediyor." : "Dytopia is checking your plan, pantry, and missing items together."}
            />
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
            {activeItems.length > 0 && (
              <View style={s.sectionBlock}>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: theme.text }]}>{copy.activeSection}</Text>
                  <View style={[s.sectionCountPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                    <Text style={[s.sectionCountTxt, { color: theme.primary }]}>{activeItems.length}</Text>
                  </View>
                </View>
                {viewMode === "market"
                  ? marketRouteItems.map(renderMarketItem)
                  : viewMode === "meal"
                  ? renderMealGroupedSections(activeMealGroups, theme.primary)
                  : activeItems.map(renderShoppingItem)}
              </View>
            )}

            {completedItems.length > 0 && (
              <View style={s.sectionBlock}>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: theme.text }]}>{copy.completedSection}</Text>
                  <View style={[s.sectionCountPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                    <Text style={[s.sectionCountTxt, { color: theme.emerald }]}>{completedItems.length}</Text>
                  </View>
                </View>
                {viewMode === "market"
                  ? completedItems.map(renderMarketItem)
                  : viewMode === "meal"
                  ? renderMealGroupedSections(completedMealGroups, theme.emerald)
                  : completedItems.map(renderShoppingItem)}
              </View>
            )}
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
  heroNoteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.sm + 2,
    marginBottom: spacing.base,
  },
  heroNoteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroNoteTitle: { fontSize: 12, fontWeight: "800", marginBottom: 3 },
  heroNoteBody: { fontSize: 12, lineHeight: 17 },
  heroPantryLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.base,
  },
  heroPantryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heroPantryTitle: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  heroPantrySub: { fontSize: 12, lineHeight: 17 },
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
  smartAssistCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  smartAssistIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  smartAssistTitle: { fontSize: 13.5, fontWeight: "800", marginBottom: 3 },
  smartAssistBody: { fontSize: 11.5, lineHeight: 17 },
  composer: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  composerHead: { marginBottom: spacing.sm, gap: 2 },
  composerTitle: { fontSize: 14, fontWeight: "800" },
  composerHint: { fontSize: 12, lineHeight: 17 },
  composerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radii.xl,
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
  blockTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  generateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  generateIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  generateTitle: { fontSize: 15, fontWeight: "900", marginBottom: 4 },
  generateHint: { fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.base },
  viewModeCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  viewModeTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  viewModeRow: { flexDirection: "row", gap: spacing.sm },
  viewModeBtn: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  viewModeBtnTxt: { fontSize: 12, fontWeight: "800" },
  marketModeNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  marketModeTitle: { fontSize: 12.5, fontWeight: "900", marginBottom: 2 },
  marketModeHint: { fontSize: 11.5, lineHeight: 16 },
  aiCard: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: spacing.md,
    marginBottom: spacing.base,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
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
  generationStatsRow: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: spacing.xs,
  },
  generationStatChip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  generationStatTxt: { fontSize: 10.5, fontWeight: "800" },
  planRecipeSection: { gap: spacing.sm, marginBottom: spacing.base },
  planRecipeCard: {
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  planRecipeCardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  planRecipeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  planRecipeMeal: { fontSize: 11, fontWeight: "800", marginBottom: 2 },
  planRecipeTitle: { fontSize: 15, fontWeight: "900", lineHeight: 20 },
  planRecipeSub: { fontSize: 11.5, fontWeight: "700", marginTop: 3 },
  planCoveragePill: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  planCoverageText: { fontSize: 11.5, fontWeight: "900" },
  planRecipeDetails: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  planRecipeSummaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  planRecipeMiniStat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: 9,
    alignItems: "center",
  },
  planRecipeMiniStatValue: { fontSize: 17, fontWeight: "900" },
  planRecipeMiniStatLabel: { fontSize: 10.5, fontWeight: "800", marginTop: 2 },
  planRecipeSectionTitle: { fontSize: 12.5, fontWeight: "900", lineHeight: 17 },
  planCardGroup: { gap: 7 },
  planCardGroupPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  planCardGroupPillText: { fontSize: 10.5, fontWeight: "900" },
  planCardIngredientWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  planCardIngredientChip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  planCardIngredientText: { fontSize: 11.5, fontWeight: "700" },
  coveredBox: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.sm,
  },
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
  loadingShell: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  list: { gap: spacing.sm },
  sectionBlock: { gap: spacing.sm },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "900" },
  sectionCountPill: {
    minWidth: 36,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
  },
  sectionCountTxt: { fontSize: 11, fontWeight: "900" },
  itemCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  marketItemCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.045,
    shadowRadius: 8,
    elevation: 1,
  },
  marketCheck: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.4,
    alignItems: "center",
    justifyContent: "center",
  },
  marketItemBody: { flex: 1, gap: 6 },
  marketItemTitle: { fontSize: 17, fontWeight: "900", letterSpacing: -0.2 },
  marketMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  marketMetaText: { flexShrink: 1, fontSize: 11.5, fontWeight: "700" },
  marketRolePill: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  marketRoleText: { fontSize: 10.5, fontWeight: "900" },
  marketDelete: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
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
  itemMetaWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: "800" },
  itemMealCaption: { fontSize: 11.5, fontWeight: "700" },
  itemMeta: { fontSize: 12, lineHeight: 17 },
  rolePillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  rolePill: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  rolePillTxt: { fontSize: 10, fontWeight: "800" },
  sourcePill: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourcePillTxt: { fontSize: 10, fontWeight: "800" },
  mealGroupCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  mealGroupTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  mealGroupTitle: { fontSize: 15, fontWeight: "900" },
  mealGroupTime: { fontSize: 12, fontWeight: "700", marginTop: 3 },
  mealGroupCount: {
    minWidth: 34,
    borderWidth: 1,
    borderRadius: radii.full,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mealGroupCountTxt: { fontSize: 11, fontWeight: "900" },
  selectedRecipeHintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedRecipeHintText: { flex: 1, fontSize: 11.5, fontWeight: "700", lineHeight: 17 },
  mealCategoryBlock: { gap: 8 },
  mealCategoryPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mealCategoryPillTxt: { fontSize: 10.5, fontWeight: "800" },
  mealCategoryItems: { gap: spacing.xs },
  deleteTap: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
