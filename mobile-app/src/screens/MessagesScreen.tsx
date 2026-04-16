import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProduceBubble from "../components/decor/ProduceBubble";
import { useNotifications } from "../context/NotificationContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
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
import {
  addAppointmentToCalendarAsync,
  isAppointmentAddedToCalendarAsync,
} from "../services/appointment-support";

function sortItems(items: CareTimelineItem[]) {
  return [...items].sort(
    (a, b) => new Date(a.createdAtUtc).getTime() - new Date(b.createdAtUtc).getTime(),
  );
}

function formatSchedule(value: string, locale: "tr-TR" | "en-US") {
  return new Date(value).toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBubbleTime(value: string, locale: "tr-TR" | "en-US") {
  return new Date(value).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayLabel(value: string, locale: "tr-TR" | "en-US") {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (sameDay(date, today)) return locale === "tr-TR" ? "Bugün" : "Today";
  if (sameDay(date, yesterday)) return locale === "tr-TR" ? "Dün" : "Yesterday";

  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
  });
}

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

function canAnswerAppointmentAttendance(appointment?: AppointmentSummary | null, now = new Date()) {
  if (!appointment) return false;
  if (appointment.attendanceStatus && appointment.attendanceStatus !== "pending") return false;

  const scheduledAt = new Date(appointment.scheduledAtUtc);
  if (Number.isNaN(scheduledAt.getTime())) return false;

  return isSameLocalDay(scheduledAt, now) && now >= scheduledAt;
}

function pickPrimaryAppointment(items: AppointmentSummary[], now = new Date()) {
  // Bugün olan ve katılım onayı bekleyen görüşmeyi önce göster
  const pendingAttendance = items.find((item) => canAnswerAppointmentAttendance(item, now));
  if (pendingAttendance) {
    return pendingAttendance;
  }

  // Gelecekteki ilk görüşmeyi göster
  const upcoming = items.find((item) => new Date(item.scheduledAtUtc) > now);
  if (upcoming) {
    return upcoming;
  }

  // Zamanı geçmiş görüşmeleri gösterme — kart tamamen gizlenir
  return null;
}

export default function MessagesScreen() {
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { permissionStatus, preferences, requestPermission, syncSchedules } = useNotifications();
  const insets = useSafeAreaInsets();
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

  const copy = useMemo(() => (
    language === "en"
      ? {
          eyebrow: "Care Hub",
          title: "Dietitian chat",
          subtitle: "A calmer, direct thread for notes and replies.",
          pending: "Awaiting connection",
          upcoming: "Next session",
          noAppointment: "No session scheduled yet",
          clinicFallback: "Clinic connection active",
          you: "You",
          inboundTag: "Dietitian",
          emptyTitle: "No messages yet",
          emptyDesc: "When your dietitian writes or you send an update, the conversation will appear here.",
          composerPlaceholder: "Write a message",
          reminderReady: "Reminders are active for this session.",
          reminderPrompt: "Enable notifications so this session can remind you on time.",
          reminderAction: "Enable reminder",
          calendarAction: "Add to calendar",
          calendarDone: "Added to calendar",
          attendancePrompt: "Has this session happened?",
          attendanceDone: "Marked as attended",
          attendanceMissed: "Marked as missed",
          attendedButton: "I attended",
          missedButton: "I missed it",
          calendarError: "Calendar event could not be created.",
          attendanceError: "Session status could not be saved.",
          send: "Send",
          sendError: "Your message could not be sent.",
        }
      : {
          eyebrow: "Care Hub",
          title: "Diyetisyen sohbeti",
          subtitle: "Notlar ve cevaplar daha rahat bir sohbet akışında.",
          pending: "Bağlantı bekleniyor",
          upcoming: "Sıradaki görüşme",
          noAppointment: "Planlı görüşme henüz yok",
          clinicFallback: "Klinik bağlantısı aktif",
          you: "Sen",
          inboundTag: "Diyetisyen",
          emptyTitle: "Henüz mesaj yok",
          emptyDesc: "Diyetisyenin yazdığında veya sen mesaj gönderdiğinde sohbet burada akacak.",
          composerPlaceholder: "Mesaj yaz",
          reminderReady: "Bu görüşme için bildirimler hazır.",
          reminderPrompt: "Bu görüşme için bildirim aç ve hatırlatma al.",
          reminderAction: "Bildirimi aç",
          calendarAction: "Takvime ekle",
          calendarDone: "Takvime eklendi",
          attendancePrompt: "Bu görüşmeye gittin mi?",
          attendanceDone: "Gittim olarak kaydedildi",
          attendanceMissed: "Gitmedim olarak kaydedildi",
          attendedButton: "Gittim",
          missedButton: "Gitmedim",
          calendarError: "Takvim etkinliği oluşturulamadı.",
          attendanceError: "Görüşme durumu kaydedilemedi.",
          send: "Gönder",
          sendError: "Mesaj gönderilemedi.",
        }
  ), [language]);

  const scrollToConversationEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const scheduleScrollToEnd = useCallback((animated = true, delay = 0) => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }

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
    try {
      const [thread, nextAppointments] = await Promise.all([
        getCareThread(),
        getAppointments(),
      ]);

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
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!appointments.length || permissionStatus !== "granted" || !preferences.notificationsEnabled) {
      return;
    }

    void syncSchedules();
  }, [appointments, permissionStatus, preferences.notificationsEnabled, syncSchedules]);

  useEffect(() => {
    const appointment = pickPrimaryAppointment(appointments);
    if (!appointment) {
      setCalendarAdded(false);
      return;
    }

    let cancelled = false;
    void isAppointmentAddedToCalendarAsync(appointment.id)
      .then((value) => {
        if (!cancelled) {
          setCalendarAdded(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCalendarAdded(false);
        }
      });

    return () => {
      cancelled = true;
    };
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

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scheduleScrollToEnd]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    scheduleScrollToEnd(items.length > 0, keyboardVisible ? 36 : 0);
  }, [items.length, loading, scheduleScrollToEnd]);

  async function handleSend() {
    const value = draft.trim();
    if (!value) return;

    shouldRestoreOffsetRef.current = false;
    restoreOffsetRef.current = null;
    setSending(true);
    try {
      const item = await sendCareMessage(value);
      setItems((prev) => [...prev, item]);
      setDraft("");
      scrollToConversationEnd(true);
    } catch {
      Alert.alert("Error", copy.sendError);
    } finally {
      setSending(false);
    }
  }

  const nextAppointment = pickPrimaryAppointment(appointments);
  const nextAppointmentNeedsAttendance = canAnswerAppointmentAttendance(nextAppointment);
  const remindersEnabledForAppointment = permissionStatus === "granted" && preferences.notificationsEnabled;
  const composerBottomSpace = keyboardVisible
    ? Math.max(insets.bottom, 10) + 4
    : Math.max(insets.bottom, 12) + 104;

  async function handleEnableReminder() {
    const status = await requestPermission();
    if (status === "granted") {
      await syncSchedules();
    }
  }

  async function handleAddToCalendar() {
    if (!nextAppointment) return;

    setCalendaruusy(true);
    try {
      const saved = await addAppointmentToCalendarAsync(nextAppointment);
      setCalendarAdded(saved);

      if (!saved) {
        Alert.alert("Error", copy.calendarError);
      }
    } catch {
      Alert.alert("Error", copy.calendarError);
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
      if (newItem) {
        setItems((prev) => sortItems([...prev, newItem]));
      }
    } catch {
      Alert.alert("Error", copy.attendanceError);
    } finally {
      setAttendanceSavingId(null);
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
        iconColor={`${theme.emerald}3E`}
        style={[s.glowB, { backgroundColor: theme.emeraldGlow }]}
      />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 6 : 10}
      >
        <View style={[s.content, { paddingTop: insets.top + 8 }]}>
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
                  <Text style={[s.contactName, { color: theme.text }]}>
                    {dietitian?.name ?? copy.clinicFallback}
                  </Text>
                  <Text style={[s.contactSub, { color: theme.textMuted }]}>
                    {dietitian?.clinicName ?? copy.upcoming}
                  </Text>
                </View>
              </View>

              <View style={[s.sessionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[s.sessionLabel, { color: theme.textMuted }]}>{copy.upcoming}</Text>
                <Text style={[s.sessionValue, { color: theme.text }]}>
                  {nextAppointment ? nextAppointment.title : copy.noAppointment}
                </Text>
                {nextAppointment ? (
                  <>
                    <Text style={[s.sessionMeta, { color: theme.emerald }]}>
                      {formatSchedule(nextAppointment.scheduledAtUtc, locale)}
                    </Text>

                    <Text style={[s.sessionHint, { color: theme.textSub }]}>
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
                            {attendanceSavingId === nextAppointment.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={s.sessionActionButtonText}>{copy.attendedButton}</Text>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[s.sessionActionButtonGhost, { borderColor: theme.border, backgroundColor: theme.surface }]}
                            onPress={() => void handleAttendance("missed")}
                            disabled={attendanceSavingId === nextAppointment.id}
                            activeOpacity={0.86}
                          >
                            <Text style={[s.sessionActionButtonGhostText, { color: theme.text }]}>
                              {copy.missedButton}
                            </Text>
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
                              <Text style={[s.sessionActionButtonGhostText, { color: theme.primaryDark }]}>
                                {copy.reminderAction}
                              </Text>
                            </TouchableOpacity>
                          ) : null}

                          <TouchableOpacity
                            style={[
                              s.sessionActionButtonGhost,
                              {
                                borderColor: calendarAdded ? theme.borderEmerald : theme.border,
                                backgroundColor: calendarAdded ? theme.primaryLight : theme.surface,
                              },
                            ]}
                            onPress={() => void handleAddToCalendar()}
                            disabled={calendaruusy}
                            activeOpacity={0.86}
                          >
                            {calendaruusy ? (
                              <ActivityIndicator size="small" color={theme.primary} />
                            ) : (
                              <Text style={[s.sessionActionButtonGhostText, { color: calendarAdded ? theme.primaryDark : theme.text }]}>
                                {calendarAdded ? copy.calendarDone : copy.calendarAction}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          </View>

          <View
            style={[
              s.threadShell,
              {
                backgroundColor: isDark ? "rgba(18,31,23,0.92)" : "rgba(255,255,255,0.90)",
                borderColor: theme.border,
              },
            ]}
          >
            {loading ? (
              <View style={s.loadingState}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
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
                onScroll={(event) => {
                  scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                onContentSizeChange={() => {
                  if (keyboardVisible || sending) {
                    scheduleScrollToEnd(false, 0);
                  }
                }}
              >
                {items.map((item, index) => {
                  const inbound = item.direction === "inbound";
                  const currentDay = formatDayLabel(item.createdAtUtc, locale);
                  const previousDay = index > 0 ? formatDayLabel(items[index - 1].createdAtUtc, locale) : null;
                  const showDayLabel = currentDay !== previousDay;

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

                          <View
                            style={[
                              s.bubble,
                              inbound
                                ? {
                                    backgroundColor: theme.surface,
                                    borderColor: theme.border,
                                  }
                                : {
                                    backgroundColor: isDark ? theme.primary : theme.primaryDark,
                                    borderColor: isDark ? `${theme.primary}66` : `${theme.primaryDark}44`,
                                  },
                            ]}
                          >
                            <View
                              style={[
                                s.tail,
                                inbound
                                  ? [
                                      s.tailLeft,
                                      {
                                        backgroundColor: theme.surface,
                                        borderLeftColor: theme.border,
                                        borderBottomColor: theme.border,
                                      },
                                    ]
                                  : [
                                      s.tailRight,
                                      {
                                        backgroundColor: isDark ? theme.primary : theme.primaryDark,
                                        borderRightColor: isDark ? `${theme.primary}66` : `${theme.primaryDark}44`,
                                        borderBottomColor: isDark ? `${theme.primary}66` : `${theme.primaryDark}44`,
                                      },
                                    ],
                              ]}
                            />

                            <Text style={[s.bubbleText, { color: inbound ? theme.text : "#FFFFFF" }]}>
                              {item.text}
                            </Text>

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
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>

        <View
          style={[
            s.composerWrap,
            {
              paddingBottom: composerBottomSpace,
            },
          ]}
        >
          <View
            style={[
              s.composerCard,
              {
                backgroundColor: theme.surface,
                borderColor: composerFocused ? theme.borderEmerald : theme.border,
              },
            ]}
          >
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
              style={[
                s.sendButton,
                {
                  backgroundColor: draft.trim() ? theme.primary : theme.border,
                },
              ]}
              onPress={handleSend}
              disabled={sending || !draft.trim()}
              activeOpacity={draft.trim() ? 0.84 : 1}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
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
  glowA: {
    position: "absolute",
    top: 8,
    right: -62,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.68,
  },
  glowB: {
    position: "absolute",
    top: 310,
    left: -76,
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.42,
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 0,
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 10,
    marginBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 6,
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: "700",
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 7,
  },
  metaRow: {
    flexDirection: "row",
    gap: 7,
  },
  contactCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  contactAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  contactBody: {
    flex: 1,
  },
  contactName: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 1,
  },
  contactSub: {
    fontSize: 10,
    fontWeight: "600",
  },
  sessionCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
  },
  sessionLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.55,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sessionValue: {
    fontSize: 12.5,
    fontWeight: "800",
    marginBottom: 3,
  },
  sessionMeta: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  sessionHint: {
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 6,
  },
  sessionActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 9,
  },
  sessionActionButton: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionActionButtonGhost: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionActionButtonText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "800",
  },
  sessionActionButtonGhostText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  threadShell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: "center",
  },
  threadContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: 14,
    gap: 6,
  },
  dayRow: {
    alignItems: "center",
    marginVertical: 6,
  },
  dayChip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dayChipText: {
    fontSize: 10,
    fontWeight: "800",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  messageRowLeft: {
    justifyContent: "flex-start",
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  messageAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  messageCluster: {
    maxWidth: "86%",
    gap: 3,
  },
  clusterLeft: {
    alignItems: "flex-start",
  },
  clusterRight: {
    alignItems: "flex-end",
  },
  senderText: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
  },
  bubble: {
    minWidth: 80,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 11,
    paddingTop: 8,
    paddingBottom: 7,
    position: "relative",
  },
  tail: {
    position: "absolute",
    bottom: 5,
    width: 11,
    height: 11,
    transform: [{ rotate: "45deg" }],
    borderBottomWidth: 1,
  },
  tailLeft: {
    left: -5,
    borderLeftWidth: 1,
  },
  tailRight: {
    right: -5,
    borderRightWidth: 1,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    marginBottom: 4,
  },
  bubbleMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  bubbleMetaText: {
    fontSize: 10,
    fontWeight: "700",
  },
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: "transparent",
  },
  composerCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 26,
    maxHeight: 108,
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 6,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
});





