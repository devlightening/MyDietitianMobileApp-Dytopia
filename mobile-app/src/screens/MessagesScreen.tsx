import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import ProduceBubble from "../components/decor/ProduceBubble";
import { useAuth } from "../auth/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { Routes } from "../navigation/routes";
import { radii, spacing } from "../theme/tokens";
import {
  getAppointments,
  getCareThread,
  markAppointmentAttendance,
  sendCareMessage,
  type AppointmentSummary,
  type CareDietitianInfo,
  type CareTimelineItem,
} from "../api/care";
import { parseCoachTask, runCoachTaskAction, isCoachTaskActionSupported } from "../features/coachTasks";
import {
  addAppointmentToCalendarAsync,
  isAppointmentAddedToCalendarAsync,
} from "../services/appointment-support";
import { useCareSignalR } from "../hooks/useCareSignalR";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function sortItems(items: CareTimelineItem[]) {
  return [...items].sort(
    (a, b) => new Date(a.createdAtUtc).getTime() - new Date(b.createdAtUtc).getTime(),
  );
}

function formatSchedule(value: string, locale: "tr-TR" | "en-US") {
  return new Date(value).toLocaleString(locale, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function formatCompactSchedule(value: string, locale: "tr-TR" | "en-US") {
  return new Date(value).toLocaleString(locale, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function formatAppointmentDate(value: string, locale: "tr-TR" | "en-US") {
  return new Date(value).toLocaleDateString(locale, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatAppointmentTime(value: string, locale: "tr-TR" | "en-US") {
  return new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function formatAppointmentMode(value: string, language: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "online" || normalized === "remote") return language === "tr" ? "Online" : "Online";
  if (["in-person", "in_person", "face-to-face", "face_to_face", "yuz-yuze", "yüz yüze"].includes(normalized)) {
    return language === "tr" ? "Yüz yüze" : "In person";
  }
  return value || (language === "tr" ? "Online" : "Online");
}

function formatBubbleTime(value: string, locale: "tr-TR" | "en-US") {
  return new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(value: string, locale: "tr-TR" | "en-US") {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (l: Date, r: Date) =>
    l.getFullYear() === r.getFullYear() && l.getMonth() === r.getMonth() && l.getDate() === r.getDate();

  if (sameDay(date, today)) return locale === "tr-TR" ? "Bugün" : "Today";
  if (sameDay(date, yesterday)) return locale === "tr-TR" ? "Dün" : "Yesterday";
  return date.toLocaleDateString(locale, { day: "numeric", month: "long" });
}

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function canAnswerAppointmentAttendance(appointment?: AppointmentSummary | null, now = new Date()) {
  if (!appointment) return false;
  if (appointment.attendanceStatus && appointment.attendanceStatus !== "pending") return false;
  const scheduledAt = new Date(appointment.scheduledAtUtc);
  if (Number.isNaN(scheduledAt.getTime())) return false;
  return isSameLocalDay(scheduledAt, now) && now >= scheduledAt;
}

function pickPrimaryAppointment(items: AppointmentSummary[], now = new Date()) {
  const pendingAttendance = items.find((item) => canAnswerAppointmentAttendance(item, now));
  if (pendingAttendance) return pendingAttendance;
  const upcoming = items.find((item) => new Date(item.scheduledAtUtc) > now);
  if (upcoming) return upcoming;
  return null;
}

// â”€â”€ Swipeable bubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SWIPE_TRIGGER = 48;

function SwipeableBubble({
  item,
  inbound,
  onReply,
  children,
}: {
  item: CareTimelineItem;
  inbound: boolean;
  onReply: () => void;
  children: React.ReactNode;
}) {
  const pan = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderGrant: () => { triggered.current = false; },
      onPanResponderMove: (_, gs) => {
        // Inbound (left bubble): swipe right; outbound (right bubble): swipe left
        const dx = inbound ? Math.max(0, Math.min(gs.dx, 68)) : Math.min(0, Math.max(gs.dx, -68));
        pan.setValue(dx);
        if (!triggered.current && Math.abs(dx) >= SWIPE_TRIGGER) {
          triggered.current = true;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderRelease: (_, gs) => {
        const dx = inbound ? Math.max(0, gs.dx) : Math.min(0, gs.dx);
        if (Math.abs(dx) >= SWIPE_TRIGGER) onReply();
        Animated.spring(pan, { toValue: 0, useNativeDriver: true, tension: 140, friction: 14 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: 0, useNativeDriver: true, tension: 140, friction: 14 }).start();
      },
    }),
  ).current;

  const iconOpacity = pan.interpolate({
    inputRange: inbound ? [0, SWIPE_TRIGGER] : [-SWIPE_TRIGGER, 0],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={s.swipeOuter}>
      {/* Reply icon behind the bubble */}
      {inbound ? (
        <Animated.View style={[s.replyIconLeft, { opacity: iconOpacity }]}>
          <Ionicons name="return-up-forward" size={18} color="#10B981" />
        </Animated.View>
      ) : (
        <Animated.View style={[s.replyIconRight, { opacity: iconOpacity }]}>
          <Ionicons name="return-up-back" size={18} color="#10B981" />
        </Animated.View>
      )}
      <Animated.View style={{ transform: [{ translateX: pan }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

// â”€â”€ Reply quote inside bubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReplyQuote({ snippet, inbound, theme }: { snippet: string; inbound: boolean; theme: any }) {
  return (
    <View style={[
      s.replyQuote,
      {
        borderLeftColor: inbound ? theme.primary : "rgba(255,255,255,0.7)",
        backgroundColor: inbound ? `${theme.primary}12` : "rgba(255,255,255,0.15)",
      },
    ]}>
      <Text style={[s.replyQuoteTxt, { color: inbound ? theme.textSub : "rgba(255,255,255,0.85)" }]} numberOfLines={2}>
        {snippet}
      </Text>
    </View>
  );
}

function AppointmentDetailRow({
  label,
  value,
  theme,
  multiline = false,
}: {
  label: string;
  value?: string | null;
  theme: any;
  multiline?: boolean;
}) {
  if (!value?.trim()) return null;
  return (
    <View style={[s.sessionDetailRow, { borderColor: theme.borderLight }]}>
      <Text style={[s.sessionDetailLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text
        style={[s.sessionDetailValue, { color: theme.text }]}
        numberOfLines={multiline ? 4 : 2}
      >
        {value.trim()}
      </Text>
    </View>
  );
}

// â”€â”€ Reply preview bar (above composer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReplyBar({
  item,
  dietitianName,
  onCancel,
  theme,
  language,
}: {
  item: CareTimelineItem;
  dietitianName?: string;
  onCancel: () => void;
  theme: any;
  language: string;
}) {
  const isOutbound = item.direction === "outbound";
  const author = isOutbound
    ? (language === "tr" ? "Sen" : "You")
    : (dietitianName ?? (language === "tr" ? "Diyetisyen" : "Dietitian"));
  return (
    <View style={[s.replyBar, { backgroundColor: `${theme.primary}10`, borderTopColor: `${theme.primary}20` }]}>
      <View style={[s.replyBarLine, { backgroundColor: theme.primary }]} />
      <View style={s.replyBarBody}>
        <Text style={[s.replyBarAuthor, { color: theme.primary }]}>{author}</Text>
        <Text style={[s.replyBarText, { color: theme.textSub }]} numberOfLines={1}>{item.text}</Text>
      </View>
      <TouchableOpacity onPress={onCancel} hitSlop={10}>
        <Ionicons name="close-circle" size={20} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// â”€â”€ Main Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function MessagesScreen({ isActive = true }: { isActive?: boolean } = {}) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { permissionStatus, preferences, requestPermission, syncSchedules } = useNotifications();
  const insets = useSafeAreaInsets();
  const isPremium = user?.isPremium === true;
  const locale = language === "tr" ? "tr-TR" : "en-US";
  const scrollRef = useRef<ScrollView>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollOffsetRef = useRef(0);
  const restoreOffsetRef = useRef<number | null>(null);
  const shouldRestoreOffsetRef = useRef(false);

  const [dietitian, setDietitian] = useState<CareDietitianInfo | null>(null);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [items, setItems] = useState<CareTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attendanceSavingId, setAttendanceSavingId] = useState<string | null>(null);
  const [calendaruusy, setCalendaruusy] = useState(false);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [draft, setDraft] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CareTimelineItem | null>(null);
  const [appointmentCardExpanded, setAppointmentCardExpanded] = useState(false);
  const appointmentCardAnim = useRef(new Animated.Value(0)).current;

  const copy = useMemo(() => (
    language === "en"
      ? {
          eyebrow: "Care Hub", title: "Dietitian chat",
          subtitle: "A calmer, direct thread for notes and replies.",
          pending: "Awaiting connection", upcoming: "Next session",
          noAppointment: "No session scheduled yet", clinicFallback: "Clinic connection active",
          you: "You", inboundTag: "Dietitian", emptyTitle: "No messages yet",
          emptyDesc: "When your dietitian writes or you send an update, the conversation will appear here.",
          composerPlaceholder: "Write a message",
          reminderReady: "Reminders are active for this session.",
          reminderPrompt: "Enable notifications so this session can remind you on time.",
          reminderAction: "Enable reminder", calendarAction: "Add to calendar",
          calendarDone: "Added to calendar", attendancePrompt: "Has this session happened?",
          attendanceDone: "Marked as attended", attendanceMissed: "Marked as missed",
          attendedButton: "I attended", missedButton: "I missed it",
          holdForDetails: "Hold for details", closeDetails: "Close details",
          detailsTitle: "Session details",
          detailDate: "Date", detailTime: "Time", detailMode: "Type",
          detailLocation: "Location", detailNote: "Note", detailStatus: "Status",
          calendarError: "Calendar event could not be created.",
          attendanceError: "Session status could not be saved.", send: "Send",
          sendError: "Your message could not be sent.", replyCancel: "Cancel reply",
          lockedTitle: "Dietitian chat unlocks with premium",
          lockedBody: "Activate your clinic connection to use messages, appointments and care notes.",
          lockedAction: "Activate premium",
        }
      : {
          eyebrow: "Care Hub", title: "Diyetisyen sohbeti",
          subtitle: "Notlar ve cevaplar daha rahat bir sohbet akışında.",
          pending: "Bağlantı bekleniyor", upcoming: "Sıradaki görüşme",
          noAppointment: "Planlı görüşme henüz yok", clinicFallback: "Klinik bağlantısı aktif",
          you: "Sen", inboundTag: "Diyetisyen", emptyTitle: "Henüz mesaj yok",
          emptyDesc: "Diyetisyenin yazdığında veya sen mesaj gönderdiğinde sohbet burada akacak.",
          composerPlaceholder: "Mesaj yaz",
          reminderReady: "Bu görüşme için bildirimler hazır.",
          reminderPrompt: "Bu görüşme için bildirim aç ve hatırlatma al.",
          reminderAction: "Bildirimi aç", calendarAction: "Takvime ekle",
          calendarDone: "Takvime eklendi", attendancePrompt: "Bu görüşmeye gittin mi?",
          attendanceDone: "Gittim olarak kaydedildi", attendanceMissed: "Gitmedim olarak kaydedildi",
          attendedButton: "Gittim", missedButton: "Gitmedim",
          holdForDetails: "Detaylar için basılı tut", closeDetails: "Detayları kapat",
          detailsTitle: "Görüşme detayları",
          detailDate: "Tarih", detailTime: "Saat", detailMode: "Tür",
          detailLocation: "Konum", detailNote: "Not", detailStatus: "Durum",
          calendarError: "Takvim etkinliği oluşturulamadı.",
          attendanceError: "Görüşme durumu kaydedilemedi.", send: "Gönder",
          sendError: "Mesaj gönderilemedi.", replyCancel: "Yanıtı iptal et",
          lockedTitle: "Diyetisyen sohbeti premium ile açılır",
          lockedBody: "Mesajlar, randevular ve klinik notları için premium klinik bağlantını aktive et.",
          lockedAction: "Premium'u Aktive Et",
        }
  ), [language]);


  const scrollToConversationEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => { scrollRef.current?.scrollToEnd({ animated }); });
  }, []);

  const scheduleScrollToEnd = useCallback((animated = true, delay = 0) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    if (delay > 0) {
      scrollTimerRef.current = setTimeout(() => {
        scrollTimerRef.current = null;
        scrollToConversationEnd(animated);
      }, delay);
      return;
    }
    scrollToConversationEnd(animated);
  }, [scrollToConversationEnd]);

  const load = useCallback(async () => {
    if (!isPremium) {
      setDietitian(null);
      setAppointments([]);
      setItems([]);
      setLoading(false);
      setSending(false);
      return;
    }

    try {
      const [thread, nextAppointments] = await Promise.all([getCareThread(), getAppointments()]);
      setDietitian(thread.activeDietitian ?? null);
      setAppointments(nextAppointments);
      setItems(sortItems(thread.items ?? []));
    } catch {
      setDietitian(null);
      setAppointments([]);
      setItems([]);
    } finally {
      setLoading(false);
      setSending(false);
    }
  }, [isPremium]);

  // Real-time refresh via SignalR
  const handleSignalRUpdate = useCallback(() => {
    void load();
  }, [load]);

  useCareSignalR(handleSignalRUpdate, isActive && isPremium);

  useEffect(() => {
    if (!isActive || !isPremium) return;
    setLoading(true);
    void load();
  }, [isActive, isPremium, load]);

  useEffect(() => {
    if (!appointments.length || permissionStatus !== "granted" || !preferences.notificationsEnabled) return;
    void syncSchedules();
  }, [appointments, permissionStatus, preferences.notificationsEnabled, syncSchedules]);

  useEffect(() => {
    const appointment = pickPrimaryAppointment(appointments);
    if (!appointment) { setCalendarAdded(false); return; }
    let cancelled = false;
    void isAppointmentAddedToCalendarAsync(appointment.id)
      .then((value) => { if (!cancelled) setCalendarAdded(value); })
      .catch(() => { if (!cancelled) setCalendarAdded(false); });
    return () => { cancelled = true; };
  }, [appointments]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      scheduleScrollToEnd(true, Platform.OS === "ios" ? 40 : 140);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setComposerFocused(false);
      if (shouldRestoreOffsetRef.current && restoreOffsetRef.current !== null) {
        const restoreY = restoreOffsetRef.current;
        shouldRestoreOffsetRef.current = false;
        restoreOffsetRef.current = null;
        requestAnimationFrame(() => {
          setTimeout(() => {
            scrollRef.current?.scrollTo({ y: restoreY, animated: false });
          }, Platform.OS === "ios" ? 30 : 80);
        });
      }
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [scheduleScrollToEnd]);

  useEffect(() => {
    return () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); };
  }, []);

  useEffect(() => {
    if (loading) return;
    scheduleScrollToEnd(items.length > 0, keyboardVisible ? 36 : 0);
  }, [items.length, loading, scheduleScrollToEnd]);

  async function handleSend() {
    const value = draft.trim();
    if (!value) return;

    const replyId = replyingTo?.id ?? null;
    const replySnippet = replyingTo?.text ?? null;

    shouldRestoreOffsetRef.current = false;
    restoreOffsetRef.current = null;
    setSending(true);
    setReplyingTo(null);
    try {
      const item = await sendCareMessage(value, replyId, replySnippet);
      setItems((prev) => sortItems([...prev, item]));
      setDraft("");
      scrollToConversationEnd(true);
    } catch {
      Alert.alert(language === "tr" ? "Hata" : "Error", copy.sendError);
    } finally {
      setSending(false);
    }
  }

  const nextAppointment = pickPrimaryAppointment(appointments);
  const nextAppointmentNeedsAttendance = canAnswerAppointmentAttendance(nextAppointment);
  const remindersEnabledForAppointment = permissionStatus === "granted" && preferences.notificationsEnabled;
  const openAppointmentCard = useCallback(() => {
    if (!nextAppointment) return;
    setAppointmentCardExpanded(true);
    appointmentCardAnim.stopAnimation();
    appointmentCardAnim.setValue(0);
    Animated.spring(appointmentCardAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 16,
    }).start();
  }, [appointmentCardAnim, nextAppointment]);

  const closeAppointmentCard = useCallback(() => {
    appointmentCardAnim.stopAnimation();
    Animated.timing(appointmentCardAnim, {
      toValue: 0,
      duration: 170,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setAppointmentCardExpanded(false);
    });
  }, [appointmentCardAnim]);

  const appointmentCardStyle = {
    opacity: appointmentCardAnim,
    transform: [
      {
        translateY: appointmentCardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 0],
        }),
      },
      {
        scale: appointmentCardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };
  const bottomBarClearance = (Platform.OS === "ios" ? 72 : 68) + Math.max(insets.bottom, Platform.OS === "ios" ? 10 : 8);
  const composerBottomSpace = keyboardVisible
    ? Math.max(insets.bottom, 8) + 2
    : bottomBarClearance;

  const openPremiumGate = useCallback(() => {
    const parent = (navigation as any).getParent?.();
    if (parent?.navigate) {
      parent.navigate(Routes.Modal.ActivatePremium);
      return;
    }
    (navigation as any).navigate(Routes.Modal.ActivatePremium);
  }, [navigation]);

  async function handleEnableReminder() {
    const status = await requestPermission();
    if (status === "granted") await syncSchedules();
  }

  async function handleAddToCalendar() {
    if (!nextAppointment) return;
    setCalendaruusy(true);
    try {
      const saved = await addAppointmentToCalendarAsync(nextAppointment);
      setCalendarAdded(saved);
      if (!saved) Alert.alert(language === "tr" ? "Hata" : "Error", copy.calendarError);
    } catch {
      Alert.alert(language === "tr" ? "Hata" : "Error", copy.calendarError);
    } finally {
      setCalendaruusy(false);
    }
  }

  async function handleAttendance(status: "attended" | "missed") {
    if (!nextAppointment) return;
    setAttendanceSavingId(nextAppointment.id);
    try {
      const result = await markAppointmentAttendance(nextAppointment.id, status);
      setAppointments((prev) => prev.map((appointment) =>
        appointment.id === nextAppointment.id ? result.appointment : appointment,
      ));
      const newItem = result.item;
      if (newItem) setItems((prev) => sortItems([...prev, newItem]));
    } catch {
      Alert.alert(language === "tr" ? "Hata" : "Error", copy.attendanceError);
    } finally {
      setAttendanceSavingId(null);
    }
  }

  if (!isPremium) {
    return (
      <View style={[s.root, { backgroundColor: theme.bg, paddingTop: insets.top + 24 }]}>
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
          iconColor={`${theme.emerald}3E`}
          style={[s.glowB, { backgroundColor: theme.emeraldGlow }]}
        />
        <View style={s.lockedRoot}>
          <View style={[s.lockedCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
            <View style={[s.lockedIcon, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
              <Ionicons name="lock-closed-outline" size={24} color={theme.primary} />
            </View>
            <Text style={[s.lockedTitle, { color: theme.text }]}>{copy.lockedTitle}</Text>
            <Text style={[s.lockedBody, { color: theme.textSub }]}>{copy.lockedBody}</Text>
            <TouchableOpacity
              style={[s.lockedButton, { backgroundColor: theme.primary }]}
              activeOpacity={0.86}
              onPress={openPremiumGate}
            >
              <Text style={s.lockedButtonText}>{copy.lockedAction}</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      <ProduceBubble
        icon="food-apple-outline" iconSize={30}
        iconColor={`${theme.primary}42`}
        style={[s.glowA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="carrot" iconSize={26}
        iconColor={`${theme.emerald}3E`}
        style={[s.glowB, { backgroundColor: theme.emeraldGlow }]}
      />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 6 : 0}
      >
        <View style={[s.content, { paddingTop: insets.top + 8 }]}>
          {/* â”€â”€ Header card â”€â”€ */}
          <View style={[s.headerCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
            <View style={s.headerTop}>
              <View style={[s.eyebrow, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={12} color={theme.primaryDark} />
                <Text style={[s.eyebrowText, { color: theme.primaryDark }]}>{copy.eyebrow}</Text>
              </View>
              <View style={[s.liveChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={[s.liveDot, { backgroundColor: dietitian ? theme.emerald : theme.accentGold }]} />
                <Text style={[s.liveText, { color: theme.textSub }]}>
                  {dietitian ? copy.inboundTag : copy.pending}
                </Text>
              </View>
            </View>

            <Text style={[s.title, { color: theme.text }]}>{copy.title}</Text>
            <Text style={[s.subtitle, { color: theme.textSub }]}>{copy.subtitle}</Text>

            <View style={s.metaRow}>
              <View style={[s.contactCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={[s.contactAvatar, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
                  <Ionicons name="leaf-outline" size={13} color={theme.primary} />
                </View>
                <View style={s.contactBody}>
                  <Text style={[s.contactName, { color: theme.text }]}>{dietitian?.name ?? copy.clinicFallback}</Text>
                  <Text style={[s.contactSub, { color: theme.textMuted }]}>{dietitian?.clinicName ?? copy.upcoming}</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.92}
                delayLongPress={320}
                onLongPress={openAppointmentCard}
                style={[s.sessionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              >
                <Text style={[s.sessionLabel, { color: theme.textMuted }]}>{copy.upcoming}</Text>
                {nextAppointment ? (
                  <>
                    <Text style={[s.sessionDateOnly, { color: theme.text }]}>
                      {formatCompactSchedule(nextAppointment.scheduledAtUtc, locale)}
                    </Text>
                    <View style={s.sessionCompactFooter}>
                      <Text style={[s.sessionHintCompact, { color: theme.textSub }]}>
                        {copy.holdForDetails}
                      </Text>
                      <Ionicons name="expand-outline" size={15} color={theme.textMuted} />
                    </View>
                  </>
                ) : (
                  <Text style={[s.sessionDateOnly, { color: theme.textSub }]}>
                    {copy.noAppointment}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {appointmentCardExpanded ? (
              <>
                <Pressable style={s.sessionOverlayBackdrop} onPress={closeAppointmentCard} />
                <Animated.View
                  style={[
                    s.sessionPopover,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.borderEmerald,
                      shadowColor: isDark ? "#000000" : "#0B1A13",
                    },
                    appointmentCardStyle,
                  ]}
                >
                  <View style={s.sessionPopoverHeader}>
                    <View style={s.sessionPopoverHeaderText}>
                      <Text style={[s.sessionPopoverLabel, { color: theme.textMuted }]}>{copy.detailsTitle}</Text>
                      <Text style={[s.sessionPopoverTitle, { color: theme.text }]}>
                        {nextAppointment ? nextAppointment.title : copy.noAppointment}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={closeAppointmentCard}
                      style={[s.sessionCloseBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={14} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {nextAppointment ? (
                    <>
                      <Text style={[s.sessionPopoverMeta, { color: theme.emerald }]}>
                        {formatSchedule(nextAppointment.scheduledAtUtc, locale)}
                      </Text>
                      <ScrollView
                        style={s.sessionDetailScroll}
                        contentContainerStyle={s.sessionDetailList}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                      >
                        <AppointmentDetailRow
                          label={copy.detailDate}
                          value={formatAppointmentDate(nextAppointment.scheduledAtUtc, locale)}
                          theme={theme}
                        />
                        <AppointmentDetailRow
                          label={copy.detailTime}
                          value={formatAppointmentTime(nextAppointment.scheduledAtUtc, locale)}
                          theme={theme}
                        />
                        <AppointmentDetailRow
                          label={copy.detailMode}
                          value={formatAppointmentMode(nextAppointment.mode, language)}
                          theme={theme}
                        />
                        <AppointmentDetailRow
                          label={copy.detailLocation}
                          value={nextAppointment.location}
                          theme={theme}
                          multiline
                        />
                        <AppointmentDetailRow
                          label={copy.detailNote}
                          value={nextAppointment.note}
                          theme={theme}
                          multiline
                        />
                        <AppointmentDetailRow
                          label={copy.detailStatus}
                          value={
                            nextAppointment.attendanceStatus === "attended"
                              ? copy.attendanceDone
                              : nextAppointment.attendanceStatus === "missed"
                                ? copy.attendanceMissed
                                : nextAppointmentNeedsAttendance
                                  ? copy.attendancePrompt
                                  : remindersEnabledForAppointment
                                    ? copy.reminderReady
                                    : copy.reminderPrompt
                          }
                          theme={theme}
                          multiline
                        />
                      </ScrollView>
                      <Text style={[s.sessionPopoverHint, { color: theme.textSub }]}>
                        {nextAppointment.attendanceStatus === "attended"
                          ? copy.attendanceDone
                          : nextAppointment.attendanceStatus === "missed"
                            ? copy.attendanceMissed
                            : nextAppointmentNeedsAttendance
                              ? copy.attendancePrompt
                              : remindersEnabledForAppointment
                                ? copy.reminderReady
                                : copy.reminderPrompt}
                      </Text>
                      <View style={s.sessionActionRow}>
                        {nextAppointmentNeedsAttendance ? (
                          <>
                            <TouchableOpacity
                              style={[s.sessionActionButton, { backgroundColor: theme.primary }]}
                              onPress={() => void handleAttendance("attended")}
                              disabled={attendanceSavingId === nextAppointment.id}
                              activeOpacity={0.86}
                            >
                              {attendanceSavingId === nextAppointment.id
                                ? <ActivityIndicator size="small" color="#FFFFFF" />
                                : <Text style={s.sessionActionButtonText}>{copy.attendedButton}</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.sessionActionButtonGhost, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                              onPress={() => void handleAttendance("missed")}
                              disabled={attendanceSavingId === nextAppointment.id}
                              activeOpacity={0.86}
                            >
                              <Text style={[s.sessionActionButtonGhostText, { color: theme.text }]}>{copy.missedButton}</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            {!remindersEnabledForAppointment ? (
                              <TouchableOpacity
                                style={[s.sessionActionButtonGhost, { borderColor: theme.borderEmerald, backgroundColor: theme.primaryLight }]}
                                onPress={() => void handleEnableReminder()}
                                activeOpacity={0.86}
                              >
                                <Text style={[s.sessionActionButtonGhostText, { color: theme.primaryDark }]}>{copy.reminderAction}</Text>
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                              style={[s.sessionActionButtonGhost, { borderColor: calendarAdded ? theme.borderEmerald : theme.border, backgroundColor: calendarAdded ? theme.primaryLight : theme.surfaceElevated }]}
                              onPress={() => void handleAddToCalendar()}
                              disabled={calendaruusy}
                              activeOpacity={0.86}
                            >
                              {calendaruusy
                                ? <ActivityIndicator size="small" color={theme.primary} />
                                : <Text style={[s.sessionActionButtonGhostText, { color: calendarAdded ? theme.primaryDark : theme.text }]}>
                                    {calendarAdded ? copy.calendarDone : copy.calendarAction}
                                  </Text>}
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </>
                  ) : (
                    <Text style={[s.sessionPopoverHint, { color: theme.textSub }]}>{copy.noAppointment}</Text>
                  )}
                </Animated.View>
              </>
            ) : null}
          </View>

          {/* â”€â”€ Thread â”€â”€ */}
          <View style={[s.threadShell, { backgroundColor: isDark ? "rgba(18,31,23,0.92)" : "rgba(255,255,255,0.90)", borderColor: theme.border }]}>
            {loading ? (
              <View style={s.loadingState}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : items.length === 0 ? (
              <View style={s.emptyState}>
                <View style={[s.emptyIcon, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
                  <Ionicons name="chatbox-ellipses-outline" size={22} color={theme.primary} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.text }]}>{copy.emptyTitle}</Text>
                <Text style={[s.emptyDesc, { color: theme.textSub }]}>{copy.emptyDesc}</Text>
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.threadContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                onScroll={(event) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
                onContentSizeChange={() => {
                  if (keyboardVisible || sending) scheduleScrollToEnd(false, 0);
                }}
              >
                {items.map((item, index) => {
                  const inbound = item.direction === "inbound";
                  const currentDay = formatDayLabel(item.createdAtUtc, locale);
                  const previousDay = index > 0 ? formatDayLabel(items[index - 1].createdAtUtc, locale) : null;
                  const showDayLabel = currentDay !== previousDay;
                  const coachTask = item.kind === "dietitian_note" ? parseCoachTask(item.text) : null;
                  const canOpenTask = coachTask ? isCoachTaskActionSupported(coachTask.actionKey) : false;

                  return (
                    <React.Fragment key={item.id}>
                      {showDayLabel ? (
                        <View style={s.dayRow}>
                          <View style={[s.dayChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                            <Text style={[s.dayChipText, { color: theme.textMuted }]}>{currentDay}</Text>
                          </View>
                        </View>
                      ) : null}

                      <View style={[s.messageRow, inbound ? s.messageRowLeft : s.messageRowRight]}>
                        {inbound ? (
                          <View style={[s.messageAvatar, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
                            <Ionicons name="leaf-outline" size={11} color={theme.primary} />
                          </View>
                        ) : null}

                        <View style={[s.messageCluster, inbound ? s.clusterLeft : s.clusterRight]}>
                          <Text style={[s.senderText, { color: theme.textMuted }]}>
                            {inbound ? (dietitian?.name ?? copy.inboundTag) : copy.you}
                          </Text>

                          <SwipeableBubble
                            item={item}
                            inbound={inbound}
                            onReply={() => setReplyingTo(item)}
                          >
                            <View style={[
                              s.bubble,
                              inbound
                                ? { backgroundColor: theme.surface, borderColor: theme.border }
                                : { backgroundColor: isDark ? theme.primary : theme.primaryDark, borderColor: isDark ? `${theme.primary}66` : `${theme.primaryDark}44` },
                            ]}>
                              <View style={[
                                s.tail,
                                inbound
                                  ? [s.tailLeft, { backgroundColor: theme.surface, borderLeftColor: theme.border, borderBottomColor: theme.border }]
                                  : [s.tailRight, { backgroundColor: isDark ? theme.primary : theme.primaryDark, borderRightColor: isDark ? `${theme.primary}66` : `${theme.primaryDark}44`, borderBottomColor: isDark ? `${theme.primary}66` : `${theme.primaryDark}44` }],
                              ]} />

                              {/* Reply quote */}
                              {item.replyToSnippet ? (
                                <ReplyQuote snippet={item.replyToSnippet} inbound={inbound} theme={theme} />
                              ) : null}

                              {coachTask ? (
                                <View style={s.taskBubbleBody}>
                                  <Text style={[s.taskBubbleTitle, { color: inbound ? theme.text : "#FFFFFF" }]}>
                                    {coachTask.title}
                                  </Text>
                                  <Text style={[s.bubbleText, { color: inbound ? theme.text : "#FFFFFF" }]}>
                                    {coachTask.body}
                                  </Text>
                                  {canOpenTask ? (
                                    <TouchableOpacity
                                      style={[
                                        s.taskBubbleButton,
                                        inbound
                                          ? { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}28` }
                                          : { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.24)" },
                                      ]}
                                      onPress={() => void runCoachTaskAction(navigation as any, coachTask.actionKey)}
                                      activeOpacity={0.82}
                                    >
                                      <Text style={[s.taskBubbleButtonText, { color: inbound ? theme.primary : "#FFFFFF" }]}>
                                        {coachTask.cta}
                                      </Text>
                                      <Ionicons name="arrow-forward" size={12} color={inbound ? theme.primary : "#FFFFFF"} />
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                              ) : (
                                <Text style={[s.bubbleText, { color: inbound ? theme.text : "#FFFFFF" }]}>
                                  {item.text}
                                </Text>
                              )}

                              <View style={s.bubbleMetaRow}>
                                <Text style={[s.bubbleMetaText, { color: inbound ? theme.textMuted : "rgba(255,255,255,0.74)" }]}>
                                  {formatBubbleTime(item.createdAtUtc, locale)}
                                </Text>
                                {!inbound ? (
                                  <Ionicons
                                    name={item.isRead ? "checkmark-done" : "checkmark"}
                                    size={14}
                                    color={item.isRead ? "#DDFDE7" : "rgba(255,255,255,0.72)"}
                                  />
                                ) : null}
                              </View>
                            </View>
                          </SwipeableBubble>
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>

        {/* â”€â”€ Composer â”€â”€ */}
        <View style={[s.composerWrap, { paddingBottom: composerBottomSpace }]}>
          {/* Reply bar */}
          {replyingTo ? (
            <ReplyBar
              item={replyingTo}
              dietitianName={dietitian?.name}
              onCancel={() => setReplyingTo(null)}
              theme={theme}
              language={language}
            />
          ) : null}

          <View style={[s.composerCard, { backgroundColor: theme.surface, borderColor: composerFocused ? theme.borderEmerald : theme.border }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={copy.composerPlaceholder}
              placeholderTextColor={theme.textMuted}
              multiline
              style={[s.input, { color: theme.text }]}
              selectionColor={theme.primary}
              textAlignVertical="top"
              onFocus={() => {
                restoreOffsetRef.current = scrollOffsetRef.current;
                shouldRestoreOffsetRef.current = true;
                setComposerFocused(true);
                scheduleScrollToEnd(true, Platform.OS === "ios" ? 24 : 90);
              }}
              onBlur={() => setComposerFocused(false)}
            />

            <TouchableOpacity
              style={[s.sendButton, { backgroundColor: draft.trim() ? theme.primary : theme.border }]}
              onPress={() => void handleSend()}
              disabled={sending || !draft.trim()}
              activeOpacity={draft.trim() ? 0.84 : 1}
            >
              {sending
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Ionicons name="send" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  lockedRoot: { flex: 1, paddingHorizontal: 18, justifyContent: "center" },
  lockedCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
    alignItems: "center",
  },
  lockedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  lockedTitle: { fontSize: 19, lineHeight: 24, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  lockedBody: { fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 18 },
  lockedButton: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  lockedButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  glowA: { position: "absolute", top: 8, right: -62, width: 200, height: 200, borderRadius: 100, opacity: 0.68 },
  glowB: { position: "absolute", top: 310, left: -76, width: 170, height: 170, borderRadius: 85, opacity: 0.42 },
  content: { flex: 1, paddingHorizontal: 14, paddingBottom: 0 },
  headerCard: { borderWidth: 1, borderRadius: 20, padding: 10, marginBottom: 8, position: "relative", overflow: "visible" },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: 6 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 9, paddingVertical: 4 },
  eyebrowText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  liveChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 10, fontWeight: "700" },
  title: { fontSize: 16, lineHeight: 20, fontWeight: "900", letterSpacing: -0.3, marginBottom: 2 },
  subtitle: { fontSize: 11, lineHeight: 15, marginBottom: 7 },
  metaRow: { flexDirection: "row", gap: 7, alignItems: "stretch" },
  contactCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 8, flexDirection: "row", alignItems: "center", gap: 7 },
  contactAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  contactBody: { flex: 1 },
  contactName: { fontSize: 12, fontWeight: "800", marginBottom: 1 },
  contactSub: { fontSize: 10, fontWeight: "600" },
  sessionCard: { flex: 0.72, borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 9, minHeight: 72, justifyContent: "space-between" },
  sessionLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.55, textTransform: "uppercase", marginBottom: 4 },
  sessionValue: { fontSize: 12.5, fontWeight: "800", marginBottom: 3 },
  sessionMeta: { fontSize: 10.5, fontWeight: "700" },
  sessionDateOnly: { fontSize: 11.5, lineHeight: 15, fontWeight: "800" },
  sessionHint: { fontSize: 10.5, lineHeight: 15, marginTop: 6 },
  sessionCompactFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 8 },
  sessionHintCompact: { fontSize: 9.5, lineHeight: 13, fontWeight: "600", flex: 1 },
  sessionActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  sessionActionButton: { minHeight: 30, borderRadius: 15, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" },
  sessionActionButtonGhost: { minHeight: 30, borderRadius: 15, paddingHorizontal: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sessionActionButtonText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "800" },
  sessionActionButtonGhostText: { fontSize: 11.5, fontWeight: "800" },
  sessionOverlayBackdrop: {
    position: "absolute",
    top: -20,
    left: -14,
    right: -14,
    bottom: -12,
    zIndex: 9,
  },
  sessionPopover: {
    position: "absolute",
    top: 88,
    right: 10,
    left: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    zIndex: 10,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 12,
  },
  sessionPopoverHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  sessionPopoverHeaderText: { flex: 1 },
  sessionPopoverLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
  sessionPopoverTitle: { fontSize: 15, lineHeight: 20, fontWeight: "900" },
  sessionPopoverMeta: { fontSize: 12, fontWeight: "800", marginBottom: 6 },
  sessionDetailScroll: { maxHeight: 230, marginBottom: 8 },
  sessionDetailList: { gap: 6, marginBottom: 8 },
  sessionDetailRow: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 8 },
  sessionDetailLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.55, textTransform: "uppercase", marginBottom: 3 },
  sessionDetailValue: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  sessionPopoverHint: { fontSize: 11.5, lineHeight: 17 },
  sessionCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  threadShell: { flex: 1, borderWidth: 1, borderRadius: 22, overflow: "hidden" },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: "900", marginBottom: 8 },
  emptyDesc: { fontSize: 12.5, lineHeight: 19, textAlign: "center" },
  threadContent: { paddingHorizontal: 10, paddingVertical: 10, paddingBottom: 14, gap: 6 },
  dayRow: { alignItems: "center", marginVertical: 6 },
  dayChip: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 5 },
  dayChipText: { fontSize: 10, fontWeight: "800" },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  messageRowLeft: { justifyContent: "flex-start" },
  messageRowRight: { justifyContent: "flex-end" },
  messageAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  messageCluster: { maxWidth: "86%", gap: 3 },
  clusterLeft: { alignItems: "flex-start" },
  clusterRight: { alignItems: "flex-end" },
  senderText: { fontSize: 10, fontWeight: "700", paddingHorizontal: 6 },
  // Swipeable
  swipeOuter: { position: "relative" },
  replyIconLeft: { position: "absolute", left: -28, top: "50%", marginTop: -10, zIndex: 0 },
  replyIconRight: { position: "absolute", right: -28, top: "50%", marginTop: -10, zIndex: 0 },
  // Bubble
  bubble: { minWidth: 80, borderWidth: 1, borderRadius: 17, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 7, position: "relative" },
  tail: { position: "absolute", bottom: 5, width: 11, height: 11, transform: [{ rotate: "45deg" }], borderBottomWidth: 1 },
  tailLeft: { left: -5, borderLeftWidth: 1 },
  tailRight: { right: -5, borderRightWidth: 1 },
  // Reply quote inside bubble
  replyQuote: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6 },
  replyQuoteTxt: { fontSize: 11.5, lineHeight: 16 },
  taskBubbleBody: { gap: 6, marginBottom: 4 },
  taskBubbleTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: "800" },
  taskBubbleButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, marginTop: 2 },
  taskBubbleButtonText: { fontSize: 12, fontWeight: "800" },
  bubbleText: { fontSize: 13, lineHeight: 18, fontWeight: "500", marginBottom: 4 },
  bubbleMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3 },
  bubbleMetaText: { fontSize: 10, fontWeight: "700" },
  // Reply bar
  replyBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1 },
  replyBarLine: { width: 3, height: 36, borderRadius: 2 },
  replyBarBody: { flex: 1 },
  replyBarAuthor: { fontSize: 11, fontWeight: "800", marginBottom: 1 },
  replyBarText: { fontSize: 12, lineHeight: 16 },
  // Composer
  composerWrap: { paddingHorizontal: 14, paddingTop: 0, backgroundColor: "transparent" },
  composerCard: { borderWidth: 1, borderRadius: 26, paddingLeft: 16, paddingRight: 8, paddingVertical: 8, flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: { flex: 1, minHeight: 26, maxHeight: 108, paddingTop: 8, paddingBottom: 8, paddingRight: 6, fontSize: 15, lineHeight: 20, textAlignVertical: "top" },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 1 },
});
