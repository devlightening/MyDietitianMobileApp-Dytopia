import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { useNotifications } from "../context/NotificationContext";
import { radii, spacing } from "../theme/tokens";
import type { NotificationPreferences } from "../api/notification-preferences";
import ProduceBubble from "../components/decor/ProduceBubble";

type TimeKey = "hydrationStartLocalTime" | "hydrationEndLocalTime" | "measurementReminderLocalTime";

const HYDRATION_INTERVALS = [60, 90, 120, 180];
const MEAL_LEAD_OPTIONS = [0, 10, 20, 30];
const REENGAGEMENT_OPTIONS = [24, 48, 72];

function timeStringToDate(value: string) {
  const date = new Date();
  const [hour, minute] = value.split(":").map(Number);
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date;
}

function dateToTimeString(date: Date) {
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${hour}:${minute}`;
}

function dayLabels(language: "tr" | "en") {
  return language === "tr"
    ? ["Pazar", "Pzt", "Sal", "Çar", "Per", "Cum", "Cts"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}

function formatTime(value: string) {
  return value;
}

export default function ProfileNotificationsScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const {
    preferences,
    isLoading,
    isSaving,
    permissionStatus,
    requestPermission,
    savePreferences,
    syncSchedules,
    sendPreviewNotification,
  } = useNotifications();

  const [draft, setDraft] = useState<NotificationPreferences>(preferences);
  const [pickerKey, setPickerKey] = useState<TimeKey | null>(null);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  const copy = useMemo(() => language === "tr" ? {
    back: "â† Geri",
    title: "Bildirimler",
    subtitle: "Su, öğün, ölçüm ve geri çağırma hatırlatıcılarını yönet.",
    permissionReady: "Bildirim izni aktif",
    permissionMissing: "Bildirim izni gerekli",
    permissionBodyReady: "Hatırlatıcılar cihazında çalışmaya hazır.",
    permissionBodyMissing: "Su ve plan bildirimlerinin çalışması için izin ver.",
    permissionButton: "İzin Ver",
    previewButton: "Test Bildirimi Gönder",
    global: "Tüm Bildirimler",
    hydration: "Su hatırlatmaları",
    hydrationSub: "Gün içi düzenli su içme akışı",
    hydrationWindow: "Aktif saat aralığı",
    meal: "Planım öğün bildirimleri",
    mealSub: "Saati yaklaşan öğünler için uyarı",
    measurement: "Ölçüm hatırlatmaları",
    measurementSub: "Haftalık bel, kalça, göğüs takibi",
    reengagement: "Uygulama geri çağırma",
    reengagementSub: "Uygulama uzun süre açılmazsa hatırlat",
    mealLead: "Önceden haber ver",
    measurementDay: "Hatırlatma günü",
    measurementTime: "Hatırlatma saati",
    save: "Bildirim Planını Kaydet",
    synced: "Bildirim ayarları kaydedildi ve zamanlandı.",
    permissionDenied: "Bildirim izni olmadan cihaz üzerinde hatırlatıcı planlanamaz.",
    saveError: "Bildirim ayarları kaydedilemedi.",
    resync: "Programı Yeniden Senkronize Et",
    timeStart: "Başlangıç",
    timeEnd: "Bitiş",
  } : {
    back: "â† Back",
    title: "Notifications",
    subtitle: "Manage water, meal, measurement, and re-engagement reminders.",
    permissionReady: "Notifications enabled",
    permissionMissing: "Permission required",
    permissionBodyReady: "Your reminders are ready to run on this device.",
    permissionBodyMissing: "Allow notifications so water and plan reminders can run.",
    permissionButton: "Allow notifications",
    previewButton: "Send Test Notification",
    global: "All Notifications",
    hydration: "Hydration reminders",
    hydrationSub: "Steady water check-ins during the day",
    hydrationWindow: "Active hours",
    meal: "Meal plan reminders",
    mealSub: "Alerts before your scheduled meals",
    measurement: "Measurement reminders",
    measurementSub: "Weekly waist, hip, and chest tracking",
    reengagement: "Come-back reminders",
    reengagementSub: "Nudge the user back if the app stays unopened",
    mealLead: "Notify before",
    measurementDay: "Reminder day",
    measurementTime: "Reminder time",
    save: "Save Reminder Plan",
    synced: "Notification settings saved and scheduled.",
    permissionDenied: "Without notification permission, reminders cannot be scheduled on this device.",
    saveError: "Notification settings could not be saved.",
    resync: "Resync schedule",
    timeStart: "Start",
    timeEnd: "End",
  }, [language]);

  async function handleSave() {
    try {
      await savePreferences(draft);
      if (permissionStatus !== "granted") {
        Alert.alert(copy.title, copy.permissionDenied);
        return;
      }
      Alert.alert(copy.title, copy.synced);
    } catch (error) {
      console.warn(error);
      Alert.alert(copy.title, copy.saveError);
    }
  }

  async function handlePermission() {
    const status = await requestPermission();
    if (status !== "granted") {
      Alert.alert(copy.title, copy.permissionDenied);
    }
  }

  function update<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function onTimePicked(event: DateTimePickerEvent, selected?: Date) {
    if (event.type !== "set" || !pickerKey || !selected) {
      setPickerKey(null);
      return;
    }
    update(pickerKey, dateToTimeString(selected) as NotificationPreferences[TimeKey]);
    setPickerKey(null);
  }

  if (isLoading) {
    return (
      <View style={[s.loadingRoot, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const days = dayLabels(language);

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={34}
        iconColor={`${theme.primary}42`}
        style={[s.topGlow, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="leaf"
        iconSize={36}
        iconColor={`${theme.primary}44`}
        style={[s.bottomGlow, { backgroundColor: theme.emeraldGlow }]}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => (navigation as any).goBack()} style={s.backRow}>
          <Text style={[s.backText, { color: theme.primary }]}>{copy.back}</Text>
        </TouchableOpacity>

        <Text style={[s.title, { color: theme.text }]}>{copy.title}</Text>
        <Text style={[s.subtitle, { color: theme.textSub }]}>{copy.subtitle}</Text>

        <View style={[s.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ProduceBubble
            icon="corn"
            iconSize={24}
            iconColor={`${theme.primary}40`}
            style={[s.heroGlow, { backgroundColor: theme.primaryGlow }]}
          />
          <View style={s.heroTopRow}>
            <View>
              <Text style={[s.heroTitle, { color: theme.text }]}>
                {permissionStatus === "granted" ? copy.permissionReady : copy.permissionMissing}
              </Text>
              <Text style={[s.heroBody, { color: theme.textSub }]}>
                {permissionStatus === "granted" ? copy.permissionBodyReady : copy.permissionBodyMissing}
              </Text>
            </View>
            <View style={[s.heroBadge, { backgroundColor: permissionStatus === "granted" ? theme.glassEmerald : theme.surfaceElevated }]}>
              <Ionicons
                name={permissionStatus === "granted" ? "notifications" : "notifications-off-outline"}
                size={16}
                color={permissionStatus === "granted" ? theme.emerald : theme.accentGold}
              />
            </View>
          </View>

          <View style={s.heroActions}>
            <TouchableOpacity
              style={[s.heroButton, { backgroundColor: theme.primary }]}
              onPress={handlePermission}
              activeOpacity={0.82}
            >
              <Text style={s.heroButtonText}>{copy.permissionButton}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.ghostButton, { borderColor: theme.border }]}
              onPress={() => void sendPreviewNotification()}
              activeOpacity={0.82}
            >
              <Text style={[s.ghostButtonText, { color: theme.text }]}>{copy.previewButton}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SettingsCard themeColor={theme.surface} borderColor={theme.border}>
          <ToggleRow
            themeColor={theme.text}
            accent={theme.primary}
            label={copy.global}
            value={draft.notificationsEnabled}
            onChange={(value) => update("notificationsEnabled", value)}
          />
        </SettingsCard>

        <SectionCard
          theme={theme}
          title={copy.hydration}
          subtitle={copy.hydrationSub}
          enabled={draft.notificationsEnabled && draft.hydrationRemindersEnabled}
          toggleValue={draft.hydrationRemindersEnabled}
          onToggle={(value) => update("hydrationRemindersEnabled", value)}
        >
          <ChoiceRow
            theme={theme}
            label={language === "tr" ? "Aralık" : "Interval"}
            options={HYDRATION_INTERVALS.map((item) => ({
              value: item,
              label: language === "tr" ? `${item} dk` : `${item} min`,
            }))}
            value={draft.hydrationIntervalMinutes}
            onChange={(value) => update("hydrationIntervalMinutes", value)}
            disabled={!draft.notificationsEnabled || !draft.hydrationRemindersEnabled}
          />
          <View style={s.timeRow}>
            <TimeField
              theme={theme}
              label={copy.timeStart}
              value={formatTime(draft.hydrationStartLocalTime)}
              onPress={() => setPickerKey("hydrationStartLocalTime")}
              disabled={!draft.notificationsEnabled || !draft.hydrationRemindersEnabled}
            />
            <TimeField
              theme={theme}
              label={copy.timeEnd}
              value={formatTime(draft.hydrationEndLocalTime)}
              onPress={() => setPickerKey("hydrationEndLocalTime")}
              disabled={!draft.notificationsEnabled || !draft.hydrationRemindersEnabled}
            />
          </View>
        </SectionCard>

        <SectionCard
          theme={theme}
          title={copy.meal}
          subtitle={copy.mealSub}
          enabled={draft.notificationsEnabled && draft.mealPlanRemindersEnabled}
          toggleValue={draft.mealPlanRemindersEnabled}
          onToggle={(value) => update("mealPlanRemindersEnabled", value)}
        >
          <ChoiceRow
            theme={theme}
            label={copy.mealLead}
            options={MEAL_LEAD_OPTIONS.map((item) => ({
              value: item,
              label: item === 0 ? (language === "tr" ? "Tam saatinde" : "On time") : `${item} ${language === "tr" ? "dk" : "min"}`,
            }))}
            value={draft.mealReminderLeadMinutes}
            onChange={(value) => update("mealReminderLeadMinutes", value)}
            disabled={!draft.notificationsEnabled || !draft.mealPlanRemindersEnabled}
          />
        </SectionCard>

        <SectionCard
          theme={theme}
          title={copy.measurement}
          subtitle={copy.measurementSub}
          enabled={draft.notificationsEnabled && draft.measurementRemindersEnabled}
          toggleValue={draft.measurementRemindersEnabled}
          onToggle={(value) => update("measurementRemindersEnabled", value)}
        >
          <ChoiceRow
            theme={theme}
            label={copy.measurementDay}
            options={days.map((label, index) => ({ value: index, label }))}
            value={draft.measurementReminderDayOfWeek}
            onChange={(value) => update("measurementReminderDayOfWeek", value)}
            disabled={!draft.notificationsEnabled || !draft.measurementRemindersEnabled}
          />
          <TimeField
            theme={theme}
            label={copy.measurementTime}
            value={formatTime(draft.measurementReminderLocalTime)}
            onPress={() => setPickerKey("measurementReminderLocalTime")}
            disabled={!draft.notificationsEnabled || !draft.measurementRemindersEnabled}
          />
        </SectionCard>

        <SectionCard
          theme={theme}
          title={copy.reengagement}
          subtitle={copy.reengagementSub}
          enabled={draft.notificationsEnabled && draft.reengagementRemindersEnabled}
          toggleValue={draft.reengagementRemindersEnabled}
          onToggle={(value) => update("reengagementRemindersEnabled", value)}
        >
          <ChoiceRow
            theme={theme}
            label={language === "tr" ? "Hatırlatma gecikmesi" : "Reminder delay"}
            options={REENGAGEMENT_OPTIONS.map((item) => ({
              value: item,
              label: item === 24
                ? (language === "tr" ? "1 gün" : "1 day")
                : item === 48
                  ? (language === "tr" ? "2 gün" : "2 days")
                  : (language === "tr" ? "3 gün" : "3 days"),
            }))}
            value={draft.reengagementDelayHours}
            onChange={(value) => update("reengagementDelayHours", value)}
            disabled={!draft.notificationsEnabled || !draft.reengagementRemindersEnabled}
          />
        </SectionCard>

        <TouchableOpacity
          style={[s.secondaryAction, { borderColor: theme.border }]}
          onPress={() => void syncSchedules()}
          activeOpacity={0.82}
        >
          <Text style={[s.secondaryActionText, { color: theme.text }]}>{copy.resync}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.primaryAction, { backgroundColor: theme.primary, opacity: isSaving ? 0.72 : 1 }]}
          disabled={isSaving}
          onPress={() => void handleSave()}
          activeOpacity={0.84}
        >
          {isSaving
            ? <ActivityIndicator color="#FFF" />
            : <Text style={s.primaryActionText}>{copy.save}</Text>}
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      {pickerKey && (
        <DateTimePicker
          value={timeStringToDate(draft[pickerKey])}
          mode="time"
          is24Hour
          onChange={onTimePicked}
        />
      )}
    </View>
  );
}

function SettingsCard({
  children,
  themeColor,
  borderColor,
}: {
  children: React.ReactNode;
  themeColor: string;
  borderColor: string;
}) {
  return (
    <View style={[s.card, { backgroundColor: themeColor, borderColor }]}>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  themeColor,
  accent,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  themeColor: string;
  accent: string;
}) {
  return (
    <View style={s.toggleRow}>
      <Text style={[s.toggleLabel, { color: themeColor }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: accent, false: "#CBD5D1" }} />
    </View>
  );
}

function SectionCard({
  theme,
  title,
  subtitle,
  enabled,
  toggleValue,
  onToggle,
  children,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  title: string;
  subtitle: string;
  enabled: boolean;
  toggleValue: boolean;
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, opacity: enabled ? 1 : 0.88 }]}>
      <View style={s.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[s.sectionSubtitle, { color: theme.textSub }]}>{subtitle}</Text>
        </View>
        <Switch value={toggleValue} onValueChange={onToggle} trackColor={{ true: theme.primary, false: "#CBD5D1" }} />
      </View>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function ChoiceRow({
  theme,
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  label: string;
  options: { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.choiceBlock}>
      <Text style={[s.choiceLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={s.choiceWrap}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <TouchableOpacity
              key={`${label}-${option.value}`}
              style={[
                s.choiceChip,
                {
                  backgroundColor: active ? theme.primary : theme.surfaceElevated,
                  borderColor: active ? theme.primary : theme.border,
                  opacity: disabled ? 0.55 : 1,
                },
              ]}
              onPress={() => !disabled && onChange(option.value)}
              activeOpacity={0.8}
              disabled={disabled}
            >
              <Text style={[s.choiceChipText, { color: active ? "#FFF" : theme.text }]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TimeField({
  theme,
  label,
  value,
  onPress,
  disabled,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        s.timeField,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.82}
      disabled={disabled}
    >
      <Text style={[s.timeFieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[s.timeFieldValue, { color: theme.text }]}>{value}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  topGlow: {
    position: "absolute",
    top: -76,
    right: -56,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.88,
  },
  bottomGlow: {
    position: "absolute",
    bottom: -92,
    left: -84,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.72,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 16,
  },
  backRow: { marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: "900" },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: {
    marginTop: 6,
    marginBottom: spacing.lg,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  heroCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
    opacity: 0.28,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroTitle: { fontSize: 16, fontWeight: "900", marginBottom: 4 },
  heroBody: { fontSize: 12.5, fontWeight: "600", lineHeight: 18, maxWidth: 240 },
  heroBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  heroActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radii.xl,
  },
  heroButtonText: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  ghostButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  ghostButtonText: { fontSize: 13, fontWeight: "800", textAlign: "center" },
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: { fontSize: 15, fontWeight: "900" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, fontWeight: "600", lineHeight: 18 },
  sectionBody: { marginTop: spacing.md, gap: spacing.md },
  choiceBlock: { gap: 8 },
  choiceLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  choiceChipText: { fontSize: 12, fontWeight: "800" },
  timeRow: { flexDirection: "row", gap: spacing.sm },
  timeField: {
    flex: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  timeFieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  timeFieldValue: { fontSize: 16, fontWeight: "900" },
  secondaryAction: {
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  secondaryActionText: { fontSize: 13, fontWeight: "800" },
  primaryAction: {
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  primaryActionText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
});

