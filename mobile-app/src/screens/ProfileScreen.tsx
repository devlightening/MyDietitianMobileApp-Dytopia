import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Alert, Share, Image,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withRepeat, withSequence, withDelay,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../auth/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { Routes } from "../navigation/routes";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import type { Language } from "../context/I18nContext";
import { radii, spacing } from "../theme/tokens";
import type { Theme } from "../theme/tokens";
import { useDashboard } from "../queries/useDashboard";
import { useGamification } from "../queries/useGamification";
import apiClient from "../api/client";
import { getMyProfile, updateMyProfile } from "../api/profile";
import { useHeroEntrance, useFadeRise, dur, spring } from "../hooks/useAuraMotion";
import ProduceBubble from "../components/decor/ProduceBubble";
import ProfileEditCard from "../components/profile/ProfileEditCard";
import { mapGamificationToMotivation } from "../motivation/streaks";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  fullName: string;
  email: string;
  gender?: string;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  activeDietitianId?: string | null;
  dietitianName?: string;
  clinicName?: string;
  premiumExpiresAt?: string;
}

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function getProfilePhotoStorageKey(publicUserId?: string) {
  return `profile_photo_uri_${publicUserId ?? "anonymous"}`;
}

function getProfileNameStorageKey(publicUserId?: string) {
  return `profile_full_name_${publicUserId ?? "anonymous"}`;
}

// ─── Avatar with animated premium halo ────────────────────────────────────────

function ProfileAvatar({
  initials, hasInitials, isPremium, theme, photoUri,
}: {
  initials: string;
  hasInitials: boolean;
  isPremium: boolean;
  theme: Theme;
  photoUri?: string | null;
}) {
  const haloA = useSharedValue(1);
  const haloB = useSharedValue(1);
  const opaA  = useSharedValue(0);
  const opaB  = useSharedValue(0);

  useEffect(() => {
    if (!isPremium) return;
    opaA.value = withTiming(0.45, { duration: dur.medium });
    opaB.value = withDelay(400, withTiming(0.22, { duration: dur.medium }));
    haloA.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
    haloB.value = withDelay(450, withRepeat(
      withSequence(
        withTiming(1.38, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    ));
  }, [isPremium]);

  const ring1 = useAnimatedStyle(() => ({ transform: [{ scale: haloA.value }], opacity: opaA.value }));
  const ring2 = useAnimatedStyle(() => ({ transform: [{ scale: haloB.value }], opacity: opaB.value }));

  return (
    <View style={av.wrap}>
      {isPremium && (
        <>
          <Animated.View style={[av.halo, av.halo1, { borderColor: theme.emerald }, ring1]} />
          <Animated.View style={[av.halo, av.halo2, { borderColor: theme.emerald }, ring2]} />
        </>
      )}
      <View style={[av.outer, {
        borderColor:  isPremium ? theme.emerald     : theme.border,
        shadowColor:  isPremium ? theme.emeraldGlow : "#000",
      }]}>
        <View style={[av.inner, { backgroundColor: hasInitials ? theme.primary : theme.surfaceElevated }]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={av.photo} />
          ) : (
            <>
              <View style={[av.innerGlow, { backgroundColor: theme.primaryGlow }]} />
              {hasInitials
                ? <Text style={av.letter}>{initials}</Text>
                : <Ionicons name="person" size={38} color={theme.textMuted} />
              }
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const av = StyleSheet.create({
  wrap: {
    width: 124, height: 124,
    alignItems: "center", justifyContent: "center",
    marginBottom: 0,
  },
  halo: {
    position: "absolute", alignSelf: "center",
    borderWidth: 1.5,
  },
  halo1: { width: 116, height: 116, borderRadius: 58 },
  halo2: { width: 136, height: 136, borderRadius: 68 },
  outer: {
    width: 104, height: 104, borderRadius: 52,
    borderWidth: 2.2, padding: 3,
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.45, shadowRadius: 22, elevation: 14,
  },
  inner: {
    flex: 1, borderRadius: 44,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  innerGlow: {
    position: "absolute", top: 0, right: 0,
    width: 36, height: 36, borderRadius: 18, opacity: 0.3,
  },
  letter: { color: "#FFF", fontSize: 34, fontWeight: "900" },
});

// ─── Premium status card ───────────────────────────────────────────────────────

function PremiumStatusCard({
  profile, daysLeft, theme, language,
}: {
  profile: ProfileData | null;
  daysLeft: number | null;
  theme: Theme;
  language: Language;
}) {
  const urgency = daysLeft !== null && daysLeft < 14;
  const accent  = urgency ? theme.accentCoral : theme.emerald;
  const copy = language === "tr"
    ? {
        title: "Premium aktif",
        dayLabel: "gün",
        expiresOn: "tarihinde sona eriyor",
      }
    : {
        title: "Premium active",
        dayLabel: "days",
        expiresOn: "expires on",
      };

  return (
    <View style={[pc.card, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
      <ProduceBubble
        icon="leaf"
        iconSize={18}
        iconColor={`${theme.primary}30`}
        style={[pc.glow, { backgroundColor: theme.primaryGlow }]}
      />

      <View style={pc.top}>
        <View style={[pc.iconWrap, { backgroundColor: `${accent}16`, borderColor: `${accent}28` }]}>
          <Ionicons name="star" size={17} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[pc.title, { color: theme.text }]}>{copy.title}</Text>
          {profile?.clinicName && (
            <Text style={[pc.clinic, { color: theme.textSub }]}>{profile.clinicName}</Text>
          )}
          {profile?.dietitianName && (
            <Text style={[pc.dyt, { color: theme.textMuted }]}>Dyt. {profile.dietitianName}</Text>
          )}
        </View>
        {daysLeft !== null && (
          <View style={[pc.counter, { backgroundColor: `${accent}12`, borderColor: `${accent}24` }]}>
            <Text style={[pc.counterNum, { color: accent }]}>{daysLeft}</Text>
            <Text style={[pc.counterLabel, { color: theme.textMuted }]}>{copy.dayLabel}</Text>
          </View>
        )}
      </View>

      {profile?.premiumExpiresAt && (
        <View style={[pc.expiry, { borderTopColor: theme.borderEmerald }]}>
          <Ionicons name="time-outline" size={11} color={theme.textMuted} />
          <Text style={[pc.expiryTxt, { color: theme.textMuted }]}>
            {new Date(profile.premiumExpiresAt).toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", {
              day: "numeric", month: "long", year: "numeric",
            })} {copy.expiresOn}
          </Text>
        </View>
      )}
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    borderRadius: radii.xl, borderWidth: 1.2,
    marginBottom: spacing.md, overflow: "hidden",
  },
  glow: {
    position: "absolute", top: -40, right: -40,
    width: 120, height: 120, borderRadius: 60, opacity: 0.22,
  },
  top: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.md,
    padding: spacing.md,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  title:   { fontSize: 15, fontWeight: "900", marginBottom: 2 },
  clinic:  { fontSize: 13, fontWeight: "700" },
  dyt:     { fontSize: 11, fontWeight: "500", marginTop: 1 },
  counter: {
    alignItems: "center", borderRadius: radii.md, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 8, minWidth: 52,
  },
  counterNum:   { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  counterLabel: { fontSize: 9, fontWeight: "700", marginTop: 1 },
  expiry: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderTopWidth: 1, marginHorizontal: spacing.md, paddingVertical: 10,
  },
  expiryTxt: { fontSize: 11, fontWeight: "600", flex: 1 },
});

// ─── Free upgrade CTr ──────────────────────────────────────────────────────────

function FreeUpgradeCard({
  onPress,
  theme,
  language,
}: {
  onPress: () => void;
  theme: Theme;
  language: Language;
}) {
  const copy = language === "tr"
    ? {
        title: "Premium erişimini aç",
        subtitle: "Diyetisyen kodunu girerek kişisel plan ve bakım alanına bağlan.",
      }
    : {
        title: "Unlock premium access",
        subtitle: "Use your dietitian code to connect your plan and care space.",
      };
  return (
    <TouchableOpacity
      style={[fu.card, { backgroundColor: theme.surfaceOverlay, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[fu.icon, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
        <Ionicons name="key-outline" size={22} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[fu.title, { color: theme.text }]}>{copy.title}</Text>
        <Text style={[fu.sub,   { color: theme.textSub }]}>{copy.subtitle}</Text>
      </View>
      <View style={[fu.arrow, { backgroundColor: theme.primary }]}>
        <Ionicons name="arrow-forward" size={16} color="#FFF" />
      </View>
    </TouchableOpacity>
  );
}

const fu = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderRadius: radii.xl, borderWidth: 1.2,
    padding: spacing.md + 2, marginBottom: spacing.md,
  },
  icon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  title: { fontSize: 15, fontWeight: "900", marginBottom: 3 },
  sub:   { fontSize: 12, fontWeight: "500" },
  arrow: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
});

// ─── Identity card (public ID) ─────────────────────────────────────────────────

function IdentityCard({
  publicId, copied, onCopy, onShare, theme, language,
}: {
  publicId?: string; copied: boolean;
  onCopy: () => void; onShare: () => void; theme: Theme; language: Language;
}) {
  const copy = language === "tr"
    ? {
        label: "Kimlik Kartı",
        description: "Diyetisyeninle paylaş; seni doğru hesabınla eşleştirsin.",
        copied: "Kopyalandı",
        copy: "Kopyala",
        share: "Paylaş",
      }
    : {
        label: "Identity Card",
        description: "Share this with your dietitian so they can match the right account.",
        copied: "Copied",
        copy: "Copy",
        share: "Share",
      };
  return (
    <View style={[id.card, { backgroundColor: theme.surfaceOverlay, borderColor: theme.border }]}>
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={16}
        iconColor={`${theme.primary}2E`}
        style={[id.cornerBlob, { backgroundColor: theme.primaryGlow }]}
      />

      <View style={id.header}>
        <View style={[id.chip, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
          <Ionicons name="finger-print-outline" size={13} color={theme.emerald} />
        </View>
        <Text style={[id.label, { color: theme.textMuted }]}>{copy.label}</Text>
        <View style={[id.activeDot, { backgroundColor: theme.emerald }]} />
      </View>

      <Text style={[id.value, { color: theme.text }]} numberOfLines={1} selectable>
        {publicId ?? "————————————"}
      </Text>
      <Text style={[id.desc, { color: theme.textMuted }]}>
        {copy.description}
      </Text>

      <View style={id.actions}>
        <TouchableOpacity
          style={[id.action, {
            backgroundColor: copied ? theme.emerald : theme.primaryLight,
            borderColor:     copied ? theme.emerald : theme.borderEmerald,
          }]}
          onPress={onCopy}
          activeOpacity={0.75}
        >
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={copied ? theme.bg : theme.emerald} />
          <Text style={[id.actionTxt, { color: copied ? theme.bg : theme.emerald }]}>
            {copied ? copy.copied : copy.copy}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[id.action, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          onPress={onShare}
          activeOpacity={0.75}
        >
          <Ionicons name="share-social-outline" size={14} color={theme.textSub} />
          <Text style={[id.actionTxt, { color: theme.textSub }]}>{copy.share}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const id = StyleSheet.create({
  card: {
    borderRadius: radii.xl, borderWidth: 1,
    marginBottom: spacing.md, overflow: "hidden",
    padding: spacing.md,
  },
  cornerBlob: {
    position: "absolute", top: -24, right: -24,
    width: 80, height: 80, borderRadius: 40, opacity: 0.28,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  chip: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  label:     { flex: 1, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  value: {
    fontSize: 15, fontWeight: "700",
    fontVariant: ["tabular-nums"], letterSpacing: 0.8, marginBottom: 6,
  },
  desc:    { fontSize: 11, fontWeight: "500", lineHeight: 16, marginBottom: 12 },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 5,
    paddingVertical: 9, borderRadius: radii.lg, borderWidth: 1,
  },
  actionTxt: { fontSize: 12, fontWeight: "700" },
});

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ title, theme }: { title: string; theme: Theme }) {
  return (
    <View style={sl.row}>
      <View style={[sl.dot, { backgroundColor: theme.primary }]} />
      <Text style={[sl.txt, { color: theme.textMuted }]}>{title.toUpperCase()}</Text>
    </View>
  );
}

const sl = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: spacing.lg, paddingBottom: 10 },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  txt: { fontSize: 10, fontWeight: "900", letterSpacing: 1.6, textTransform: "uppercase" as const },
});

// ─── Glass tile group + tile ───────────────────────────────────────────────────

function GlassTileGroup({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return (
    <View style={[gt.group, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
      {children}
    </View>
  );
}

function GlassTile({
  theme, icon, iconColor, label, sub, onPress, isLast, badge, disabled,
}: {
  theme: Theme; icon: IoniconName; iconColor?: string;
  label: string; sub?: string;
  onPress?: () => void; isLast?: boolean;
  badge?: string; disabled?: boolean;
}) {
  const ic = iconColor ?? theme.primary;
  return (
    <TouchableOpacity
      style={[
        gt.tile,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.borderLight },
        disabled && { opacity: 0.45 },
      ]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[gt.icon, { backgroundColor: `${ic}13`, borderColor: `${ic}20` }]}>
        <Ionicons name={icon} size={17} color={ic} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[gt.label, { color: theme.text }]}>{label}</Text>
        {sub && <Text style={[gt.sub, { color: theme.textMuted }]}>{sub}</Text>}
      </View>
      {badge ? (
        <View style={[gt.badge, { backgroundColor: theme.borderLight }]}>
          <Text style={[gt.badgeTxt, { color: theme.textMuted }]}>{badge}</Text>
        </View>
      ) : !disabled ? (
        <Ionicons name="chevron-forward" size={13} color={theme.textMuted} style={{ opacity: 0.35 }} />
      ) : null}
    </TouchableOpacity>
  );
}

const gt = StyleSheet.create({
  group: {
    borderRadius: radii.xl, borderWidth: 1,
    overflow: "hidden", marginBottom: spacing.md,
  },
  tile: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: 15, paddingHorizontal: spacing.md,
  },
  icon: {
    width: 40, height: 40, borderRadius: 13,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  label:    { fontSize: 14, fontWeight: "700" },
  sub:      { fontSize: 11.5, fontWeight: "500", marginTop: 2 },
  badge:    { borderRadius: radii.sm, paddingHorizontal: 7, paddingVertical: 3 },
  badgeTxt: { fontSize: 10, fontWeight: "800" },
});

// ─── Theme picker ──────────────────────────────────────────────────────────────

function ThemePicker({ mode, setMode, theme, labels }: {
  mode: ThemeMode; setMode: (m: ThemeMode) => void; theme: Theme;
  labels?: { light: string; dark: string; system: string };
}) {
  const options: { m: ThemeMode; label: string; icon: IoniconName; iconActive: IoniconName }[] = [
    { m: "light",  label: labels?.light  ?? "Açık",   icon: "sunny-outline",    iconActive: "sunny"    },
    { m: "dark",   label: labels?.dark   ?? "Koyu",   icon: "moon-outline",     iconActive: "moon"     },
    { m: "system", label: labels?.system ?? "Sistem", icon: "settings-outline", iconActive: "settings" },
  ];
  return (
    <View style={tp.row}>
      {options.map(({ m, label, icon, iconActive }) => {
        const active = mode === m;
        return (
          <TouchableOpacity
            key={m}
            style={[
              tp.pill,
              { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
              active && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => setMode(m)}
          >
            <Ionicons name={active ? iconActive : icon} size={16} color={active ? "#FFF" : theme.textSub} />
            <Text style={[tp.txt, { color: active ? "#FFF" : theme.textSub }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tp = StyleSheet.create({
  row:  { flexDirection: "row", gap: spacing.sm },
  pill: {
    flex: 1, flexDirection: "column", alignItems: "center",
    paddingVertical: 10, borderRadius: radii.lg, borderWidth: 1.5, gap: 4,
  },
  txt:  { fontSize: 10, fontWeight: "700" },
});

// ─── Language picker ───────────────────────────────────────────────────────────

function LanguagePicker({ language, setLanguage, theme }: {
  language: Language; setLanguage: (l: Language) => void; theme: Theme;
}) {
  const options: { l: Language; label: string; flag: string }[] = [
    { l: "tr", label: "Türkçe", flag: "🇹🇷" },
    { l: "en", label: "English", flag: "🇬🇧" },
  ];
  return (
    <View style={lp.row}>
      {options.map(({ l, label, flag }) => {
        const active = language === l;
        return (
          <TouchableOpacity
            key={l}
            style={[
              lp.pill,
              { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
              active && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => setLanguage(l)}
          >
            <Text style={lp.flag}>{flag}</Text>
            <Text style={[lp.txt, { color: active ? "#FFF" : theme.textSub }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const lp = StyleSheet.create({
  row:  { flexDirection: "row", gap: spacing.sm },
  pill: {
    flex: 1, flexDirection: "column", alignItems: "center",
    paddingVertical: 10, borderRadius: radii.lg, borderWidth: 1.5, gap: 4,
  },
  flag: { fontSize: 20 },
  txt:  { fontSize: 10, fontWeight: "700" },
});

// ─── Stat bar — compact stat row for profile ─────────────────────────────────
// Shows real data if available; hides stat section entirely when no data exists
// (gap-analysis: placeholder "—" must not be shown — use proper empty state)

function StatBar({
  theme,
  streakDays,
  compliancePct,
  badgeCount,
  language,
}: {
  theme: Theme;
  streakDays?: number;
  compliancePct?: number;
  badgeCount?: number;
  language: Language;
}) {
  // Only render if at least one real value exists
  const hasData = streakDays !== undefined || compliancePct !== undefined || badgeCount !== undefined;
  if (!hasData) return null;

  const stats = [
    {
      label: language === "tr" ? "Seri" : "Streak",
      value: streakDays !== undefined ? `${streakDays}g` : null,
      icon: "flame-outline" as const,
      color: theme.accentCoral,
    },
    {
      label: language === "tr" ? "Uyum" : "Match",
      value: compliancePct !== undefined ? `%${Math.round(compliancePct)}` : null,
      icon: "checkmark-circle-outline" as const,
      color: theme.emerald,
    },
    {
      label: language === "tr" ? "Rozet" : "Badges",
      value: badgeCount !== undefined ? `${badgeCount}` : null,
      icon: "trophy-outline" as const,
      color: theme.accentGold,
    },
  ].filter(s => s.value !== null);

  if (stats.length === 0) return null;

  return (
    <View style={[sb.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      {stats.map((st, i) => (
        <React.Fragment key={st.label}>
          <View style={sb.item}>
            <View style={[sb.iconWrap, { backgroundColor: `${st.color}10` }]}>
              <Ionicons name={st.icon} size={16} color={st.color} />
            </View>
            <Text style={[sb.value, { color: theme.text }]}>{st.value}</Text>
            <Text style={[sb.label, { color: theme.textMuted }]}>{st.label}</Text>
          </View>
          {i < stats.length - 1 && (
            <View style={[sb.divider, { backgroundColor: theme.border }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const sb = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radii.xl, borderWidth: 1,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  item: {
    flex: 1, alignItems: "center", gap: 4,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  value: { fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  divider: { width: 1, alignSelf: "stretch" },
});

function HubHero({
  theme,
  language,
  profile,
  initials,
  hasInitials,
  photoUri,
  isPremium,
  daysLeft,
  streakDays,
  compliancePct,
  badgeCount,
}: {
  theme: Theme;
  language: Language;
  profile: ProfileData | null;
  initials: string;
  hasInitials: boolean;
  photoUri?: string | null;
  isPremium: boolean;
  daysLeft: number | null;
  streakDays?: number;
  compliancePct?: number;
  badgeCount?: number;
}) {
  const copy = language === "tr"
    ? {
        eyebrow: "Profil Merkezi",
        title: "Hesabın, ritmin ve tercihlerin tek yerde.",
        subtitle: "Diyetisyen bağlantını, görünümünü ve günlük akışını profesyonel bir merkezden yönet.",
        premium: "Premium aktif",
        free: "Serbest hesap",
        clinic: "Klinik bağlı",
        member: "üye",
        streak: "Seri",
        compliance: "Uyum",
        badges: "Rozet",
      }
    : {
        eyebrow: "Profile Hub",
        title: "Your account, rhythm and preferences in one place.",
        subtitle: "Manage your dietitian connection, appearance and daily flow from one polished space.",
        premium: "Premium active",
        free: "Free account",
        clinic: "Clinic linked",
        member: "member",
        streak: "Streak",
        compliance: "Match",
        badges: "Badges",
      };

  const metrics = [
    { label: copy.streak, value: streakDays ?? 0, suffix: language === "tr" ? "gün" : "days", color: theme.accentCoral, icon: "flame-outline" as const },
    { label: copy.compliance, value: compliancePct ?? 0, suffix: "%", color: theme.emerald, icon: "checkmark-circle-outline" as const },
    { label: copy.badges, value: badgeCount ?? 0, suffix: "", color: theme.accentGold, icon: "ribbon-outline" as const },
  ];

  return (
    <Animated.View style={[ps.heroShell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ProduceBubble
        icon="leaf"
        iconSize={22}
        iconColor={`${theme.primary}30`}
        style={[ps.heroShellGlowA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="fruit-pear"
        iconSize={18}
        iconColor={`${theme.emerald}34`}
        style={[ps.heroShellGlowB, { backgroundColor: theme.emeraldGlow }]}
      />
      <View style={[ps.heroShellBar, { backgroundColor: theme.primary }]} />

      <View style={ps.heroShellBody}>
        <View style={ps.heroTopRow}>
          <View style={[ps.heroEyebrow, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
            <Ionicons name="sparkles-outline" size={13} color={theme.primaryDark} />
            <Text style={[ps.heroEyebrowText, { color: theme.primaryDark }]}>{copy.eyebrow}</Text>
          </View>
          {daysLeft !== null && isPremium ? (
            <View style={[ps.heroDaysCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderEmerald }]}>
              <Text style={[ps.heroDaysNum, { color: theme.emerald }]}>{daysLeft}</Text>
              <Text style={[ps.heroDaysLabel, { color: theme.textMuted }]}>{language === "tr" ? "gün" : "days"}</Text>
            </View>
          ) : null}
        </View>

        <View style={ps.heroIdentityRow}>
          <ProfileAvatar
            initials={initials}
            hasInitials={hasInitials}
            isPremium={isPremium}
            theme={theme}
            photoUri={photoUri}
          />
          <View style={ps.heroIdentityText}>
            <Text style={[ps.heroHeadline, { color: theme.text }]}>{copy.title}</Text>
            <Text style={[ps.heroSubtitleText, { color: theme.textSub }]}>{copy.subtitle}</Text>

            <View style={ps.heroMetaRow}>
              <View style={[
                ps.heroMetaPill,
                {
                  backgroundColor: isPremium ? theme.glassEmerald : theme.primaryLight,
                  borderColor: isPremium ? theme.borderEmerald : theme.border,
                },
              ]}>
                <View style={[ps.badgeDot, { backgroundColor: isPremium ? theme.emerald : theme.primary }]} />
                <Text style={[ps.heroMetaText, { color: isPremium ? theme.emerald : theme.primary }]}>
                  {isPremium ? copy.premium : copy.free}
                </Text>
              </View>
              {profile?.clinicName ? (
                <View style={[ps.heroMetaPill, { backgroundColor: `${theme.accentCyan}10`, borderColor: `${theme.accentCyan}24` }]}>
                  <Ionicons name="business-outline" size={12} color={theme.accentCyan} />
                  <Text style={[ps.heroMetaText, { color: theme.accentCyan }]}>{profile.clinicName}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[ps.heroProfileStrip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <View style={ps.heroProfileTextWrap}>
            <Text style={[ps.heroProfileName, { color: theme.text }]}>{profile?.fullName ?? (language === "tr" ? "Kullanıcı" : "User")}</Text>
            <Text style={[ps.heroProfileEmail, { color: theme.textMuted }]} numberOfLines={1}>
              {profile?.email ?? ""}
            </Text>
          </View>
          <View style={[ps.heroProfileStatus, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
            <Ionicons name="shield-checkmark-outline" size={15} color={theme.primary} />
            <Text style={[ps.heroProfileStatusText, { color: theme.textSub }]}>
              {profile?.activeDietitianId ? copy.clinic : copy.member}
            </Text>
          </View>
        </View>

        <View style={ps.heroMetricRow}>
          {metrics.map((metric) => (
            <View
              key={metric.label}
              style={[ps.heroMetricCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            >
              <View style={[ps.heroMetricIcon, { backgroundColor: `${metric.color}14`, borderColor: `${metric.color}22` }]}>
                <Ionicons name={metric.icon} size={15} color={metric.color} />
              </View>
              <Text style={[ps.heroMetricValue, { color: theme.text }]}>
                {metric.value}
                {metric.suffix ? <Text style={[ps.heroMetricSuffix, { color: theme.textMuted }]}>{metric.suffix}</Text> : null}
              </Text>
              <Text style={[ps.heroMetricLabel, { color: theme.textMuted }]}>{metric.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

function QuickAccessGrid({
  theme,
  language,
  onMeasurements,
  onNotifications,
  onGoals,
  onShopping,
}: {
  theme: Theme;
  language: Language;
  onMeasurements: () => void;
  onNotifications: () => void;
  onGoals: () => void;
  onShopping: () => void;
}) {
  const items = language === "tr"
    ? [
        { key: "measurements", icon: "analytics-outline" as const, label: "Ölçümler", sub: "Takibini gör", color: theme.accentCyan, onPress: onMeasurements },
        { key: "notifications", icon: "notifications-outline" as const, label: "Bildirimler", sub: "Ritmi yönet", color: theme.accentGold, onPress: onNotifications },
        { key: "goals", icon: "options-outline" as const, label: "Hedefler", sub: "Akışı şekillendir", color: theme.primary, onPress: onGoals },
        { key: "shopping", icon: "cart-outline" as const, label: "Alışveriş", sub: "Eksikleri topla", color: theme.emerald, onPress: onShopping },
      ]
    : [
        { key: "measurements", icon: "analytics-outline" as const, label: "Measurements", sub: "Track progress", color: theme.accentCyan, onPress: onMeasurements },
        { key: "notifications", icon: "notifications-outline" as const, label: "Notifications", sub: "Manage rhythm", color: theme.accentGold, onPress: onNotifications },
        { key: "goals", icon: "options-outline" as const, label: "Goals", sub: "Shape your flow", color: theme.primary, onPress: onGoals },
        { key: "shopping", icon: "cart-outline" as const, label: "Shopping", sub: "Collect missing items", color: theme.emerald, onPress: onShopping },
      ];

  return (
    <View style={ps.quickGrid}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[ps.quickCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          activeOpacity={0.82}
          onPress={item.onPress}
        >
          <View style={[ps.quickIconWrap, { backgroundColor: `${item.color}14`, borderColor: `${item.color}24` }]}>
            <Ionicons name={item.icon} size={18} color={item.color} />
          </View>
          <Text style={[ps.quickLabel, { color: theme.text }]}>{item.label}</Text>
          <Text style={[ps.quickSub, { color: theme.textMuted }]}>{item.sub}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, logout }              = useAuth();
  const navigation                    = useNavigation();
  const { theme, isDark, mode, setMode } = useTheme();
  const { t, language, setLanguage }  = useTranslation();
  const { data: dashboardData }       = useDashboard();
  const { data: gamification }        = useGamification();
  const motivation                    = mapGamificationToMotivation(gamification);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [fullNameDraft, setFullNameDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const headerStyle = useHeroEntrance(0, 18);
  const section0    = useFadeRise(180, 10);
  const section1    = useFadeRise(250, 10);
  const section2    = useFadeRise(320, 10);
  const section3    = useFadeRise(390, 10);
  const section4    = useFadeRise(460, 10);
  const section5    = useFadeRise(530, 10);
  const section6    = useFadeRise(600, 10);

  useEffect(() => { void loadProfile(); }, []);
  useEffect(() => { void loadProfilePhoto(); }, [user?.publicUserId]);
  useEffect(() => { setFullNameDraft(profile?.fullName ?? ""); }, [profile?.fullName]);

  async function loadProfile() {
    const locallySavedName = await SecureStore.getItemAsync(getProfileNameStorageKey(user?.publicUserId));

    try {
      const me = await getMyProfile();

      const data: ProfileData = {
        fullName: locallySavedName?.trim() || me.fullName,
        email:    me.email,
        activeDietitianId: me.activeDietitianId,
        premiumExpiresAt:  me.premiumUntilUtc ?? undefined,
      };

      if (me.isPremium && me.activeDietitianId) {
        try {
          const brandRes = await apiClient.get<{ branding: { clinicName?: string } }>("/api/client/branding");
          data.clinicName = brandRes.data?.branding?.clinicName;
        } catch { /* non-critical */ }
      }

      setProfile(data);
    } catch {
      setProfile((current) => {
        if (!current && !locallySavedName) return null;

        return {
          fullName: locallySavedName?.trim() || current?.fullName || "",
          email: current?.email || "",
          activeDietitianId: current?.activeDietitianId,
          clinicName: current?.clinicName,
          dietitianName: current?.dietitianName,
          premiumExpiresAt: current?.premiumExpiresAt,
        };
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadProfilePhoto() {
    try {
      const storedUri = await SecureStore.getItemAsync(getProfilePhotoStorageKey(user?.publicUserId));
      setPhotoUri(storedUri ?? null);
    } catch {
      setPhotoUri(null);
    }
  }

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        language === "tr" ? "İzin gerekli" : "Permission required",
        language === "tr"
          ? "Profil fotoğrafı seçmek için galeri izni vermelisin."
          : "Please allow photo library access to choose a profile photo.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    const nextUri = result.assets[0].uri;
    await SecureStore.setItemAsync(getProfilePhotoStorageKey(user?.publicUserId), nextUri);
    setPhotoUri(nextUri);
  }

  async function handleRemovePhoto() {
    await SecureStore.deleteItemAsync(getProfilePhotoStorageKey(user?.publicUserId));
    setPhotoUri(null);
  }

  async function handleSaveProfile() {
    const normalizedName = fullNameDraft.trim();
    if (!normalizedName) {
      Alert.alert(
        language === "tr" ? "Eksik bilgi" : "Missing information",
        language === "tr" ? "Ad soyad alanı boş bırakılamaz." : "Full name cannot be empty.",
      );
      return;
    }

    setSavingProfile(true);
    try {
      await SecureStore.setItemAsync(getProfileNameStorageKey(user?.publicUserId), normalizedName);
      setProfile((current) => (current
        ? { ...current, fullName: normalizedName }
        : {
            fullName: normalizedName,
            email: "",
          }));
      setFullNameDraft(normalizedName);

      try {
        const updated = await updateMyProfile({ fullName: normalizedName });
        await SecureStore.setItemAsync(getProfileNameStorageKey(user?.publicUserId), updated.fullName);
        setProfile((current) => (current
          ? { ...current, fullName: updated.fullName, email: updated.email }
          : {
              fullName: updated.fullName,
              email: updated.email,
              activeDietitianId: updated.activeDietitianId ?? undefined,
              premiumExpiresAt: updated.premiumUntilUtc ?? undefined,
            }));
        setFullNameDraft(updated.fullName);
      } catch (error) {
        console.warn("Profile sync skipped, local profile update kept.", error);
      }

      Alert.alert(
        language === "tr" ? "Profil güncellendi" : "Profile updated",
        language === "tr"
          ? "Ad soyad bilgin başarıyla kaydedildi."
          : "Your profile details were saved successfully.",
      );
    } catch (error: any) {
      Alert.alert(
        language === "tr" ? "Kaydedilemedi" : "Could not save",
        error?.response?.data?.message ??
          (language === "tr" ? "Profil bilgileri güncellenemedi." : "Profile details could not be updated."),
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function copyPublicId() {
    if (!user?.publicUserId) return;
    await Clipboard.setStringAsync(user.publicUserId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function sharePublicId() {
    if (!user?.publicUserId) return;
    await Share.share({
      message: language === "tr"
        ? `MyDietitian kullanıcı kimliğim: ${user.publicUserId}`
        : `MyDietitian user ID: ${user.publicUserId}`,
      title: language === "tr" ? "Kullanıcı kimliğimi paylaş" : "Share my user ID",
    });
  }

  const isPremium = user?.isPremium === true;

  function getInitials(name?: string): string {
    if (!name?.trim()) return "__icon__";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  const initials    = getInitials(profile?.fullName);
  const hasInitials = initials !== "__icon__";

  function getDaysRemaining(): number | null {
    if (!profile?.premiumExpiresAt) return null;
    const diff = new Date(profile.premiumExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  const daysLeft = getDaysRemaining();
  const copy = language === "tr"
    ? {
        quickAccess: "Hızlı Erişim",
        personalStudio: "Kişisel Alan",
        personalStudioSub: "Kimliğini ve hesap görünümünü düzenle.",
        connectedCare: "Bağlı Hesap",
        connectedCareSub: "Premium durumu, klinik bilgisi ve kullanıcı kimliği burada.",
        appearance: "Görünüm ve Dil",
        appearanceSub: "Tema ve dil tercihlerini tek merkezden yönet.",
        tools: "Günlük Araçlar",
        app: "Uygulama",
      }
    : {
        quickAccess: "Quick Access",
        personalStudio: "Personal Studio",
        personalStudioSub: "Refine your identity and account appearance.",
        connectedCare: "Connected Account",
        connectedCareSub: "Premium status, clinic details and user identity live here.",
        appearance: "Appearance & Language",
        appearanceSub: "Control theme and language from one place.",
        tools: "Daily Tools",
        app: "App",
      };

  if (loading) {
    return (
      <View style={[ps.root, ps.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[ps.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <ProduceBubble
        icon="food-apple-outline"
        iconSize={32}
        iconColor={`${theme.primary}42`}
        style={[ps.screenGlowA, { backgroundColor: theme.primaryGlow }]}
      />
      <ProduceBubble
        icon="carrot"
        iconSize={28}
        iconColor={`${theme.emerald}42`}
        style={[ps.screenGlowB, { backgroundColor: theme.emeraldGlow }]}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ps.scroll}>
        <Animated.View style={headerStyle}>
          <HubHero
            theme={theme}
            language={language}
            profile={profile}
            initials={initials}
            hasInitials={hasInitials}
            photoUri={photoUri}
            isPremium={isPremium}
            daysLeft={daysLeft}
            streakDays={gamification?.currentStreak ?? dashboardData?.summary?.streak}
            compliancePct={dashboardData?.compliancePercent}
            badgeCount={gamification?.earnedBadgeCount ?? dashboardData?.summary?.badgeCount ?? motivation?.earnedBadgeCount}
          />
        </Animated.View>

        <Animated.View style={section0}>
          <SectionLabel title={copy.quickAccess} theme={theme} />
          <QuickAccessGrid
            theme={theme}
            language={language}
            onMeasurements={() => (navigation as any).navigate(Routes.App.ProfileMeasurements)}
            onNotifications={() => (navigation as any).navigate(Routes.App.ProfileNotifications)}
            onGoals={() => (navigation as any).navigate(Routes.App.GoalPreferences)}
            onShopping={() => (navigation as any).navigate(Routes.App.ShoppingList)}
          />
        </Animated.View>

        <Animated.View style={section1}>
          <SectionLabel title={copy.personalStudio} theme={theme} />
          <Text style={[ps.sectionLead, { color: theme.textMuted }]}>{copy.personalStudioSub}</Text>
          <ProfileEditCard
            theme={theme}
            language={language}
            fullName={fullNameDraft}
            email={profile?.email ?? ""}
            initials={initials}
            hasInitials={hasInitials}
            photoUri={photoUri}
            saving={savingProfile}
            saveDisabled={
              savingProfile ||
              !fullNameDraft.trim() ||
              fullNameDraft.trim() === (profile?.fullName ?? "").trim()
            }
            onChangeFullName={setFullNameDraft}
            onPickPhoto={handlePickPhoto}
            onRemovePhoto={handleRemovePhoto}
            onSave={handleSaveProfile}
          />
        </Animated.View>

        <Animated.View style={section2}>
          <SectionLabel title={copy.connectedCare} theme={theme} />
          <Text style={[ps.sectionLead, { color: theme.textMuted }]}>{copy.connectedCareSub}</Text>
          {isPremium ? (
            <PremiumStatusCard profile={profile} daysLeft={daysLeft} theme={theme} language={language} />
          ) : (
            <FreeUpgradeCard
              onPress={() => (navigation as any).navigate(Routes.Modal.ActivatePremium)}
              theme={theme}
              language={language}
            />
          )}
          <IdentityCard
            publicId={user?.publicUserId}
            copied={copied}
            onCopy={copyPublicId}
            onShare={sharePublicId}
            theme={theme}
            language={language}
          />
          {profile?.activeDietitianId && (
            <GlassTileGroup theme={theme}>
              {profile.dietitianName && (
                <GlassTile
                  theme={theme}
                  icon="person-circle-outline"
                  iconColor={theme.accentCyan}
                  label={profile.dietitianName}
                  sub={t.profile.dietitian}
                  isLast={!profile.clinicName}
                  disabled
                />
              )}
              {profile.clinicName && (
                <GlassTile
                  theme={theme}
                  icon="business-outline"
                  iconColor={theme.emerald}
                  label={profile.clinicName}
                  sub={t.profile.clinic}
                  isLast
                  disabled
                />
              )}
            </GlassTileGroup>
          )}
        </Animated.View>

        <Animated.View style={section3}>
          <SectionLabel title={copy.appearance} theme={theme} />
          <Text style={[ps.sectionLead, { color: theme.textMuted }]}>{copy.appearanceSub}</Text>
          <GlassTileGroup theme={theme}>
            <View style={ps.preferenceIntro}>
              <View style={[ps.preferenceMiniCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Ionicons name="contrast-outline" size={16} color={theme.accentGold} />
                <View style={{ flex: 1 }}>
                  <Text style={[ps.preferenceMiniLabel, { color: theme.text }]}>
                    {t.profile.theme}
                  </Text>
                  <Text style={[ps.preferenceMiniValue, { color: theme.textMuted }]}>
                    {mode === "light" ? t.profile.themeLight : mode === "dark" ? t.profile.themeDark : t.profile.themeSystem}
                  </Text>
                </View>
              </View>
              <View style={[ps.preferenceMiniCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Ionicons name="language-outline" size={16} color={theme.accentCyan} />
                <View style={{ flex: 1 }}>
                  <Text style={[ps.preferenceMiniLabel, { color: theme.text }]}>
                    {t.profile.language}
                  </Text>
                  <Text style={[ps.preferenceMiniValue, { color: theme.textMuted }]}>
                    {language === "tr" ? t.profile.languageTR : t.profile.languageEN}
                  </Text>
                </View>
              </View>
            </View>
            <View style={[ps.themePickerRow, { borderTopColor: theme.borderLight }]}>
              <ThemePicker
                mode={mode}
                setMode={setMode}
                theme={theme}
                labels={{ light: t.profile.themeLight, dark: t.profile.themeDark, system: t.profile.themeSystem }}
              />
            </View>
            <View style={[ps.themePickerRow, { borderTopColor: theme.borderLight }]}>
              <LanguagePicker language={language} setLanguage={setLanguage} theme={theme} />
            </View>
          </GlassTileGroup>
        </Animated.View>

        <Animated.View style={section4}>
          <SectionLabel title={copy.tools} theme={theme} />
          <GlassTileGroup theme={theme}>
            <GlassTile
              theme={theme}
              icon="analytics-outline"
              iconColor={theme.accentCyan}
              label={t.profile.measurements}
              sub={t.profile.measurementsDesc}
              onPress={() => (navigation as any).navigate(Routes.App.ProfileMeasurements)}
            />
            <GlassTile
              theme={theme}
              icon="notifications-outline"
              iconColor={theme.accentGold}
              label={language === "tr" ? "Bildirimler" : "Notifications"}
              sub={language === "tr" ? "Öğün, seri ve hatırlatıcı ayarları" : "Meal, streak and reminder settings"}
              onPress={() => (navigation as any).navigate(Routes.App.ProfileNotifications)}
            />
            <GlassTile
              theme={theme}
              icon="cart-outline"
              iconColor={theme.primary}
              label={language === "tr" ? "Alışveriş Listesi" : "Shopping List"}
              sub={language === "tr" ? "Plan ve tarif eksiklerini yönet" : "Manage missing plan and recipe items"}
              onPress={() => (navigation as any).navigate(Routes.App.ShoppingList)}
            />
            <GlassTile
              theme={theme}
              icon="options-outline"
              iconColor={theme.emerald}
              label={language === "tr" ? "Hedef Tercihleri" : "Goal Preferences"}
              sub={language === "tr" ? "Rutin, mutfak ve hedef akışını şekillendir" : "Shape your routine, kitchen and target flow"}
              onPress={() => (navigation as any).navigate(Routes.App.GoalPreferences)}
            />
            <GlassTile
              theme={theme}
              icon="lock-closed-outline"
              iconColor={theme.accentCoral}
              label={language === "tr" ? "Şifre Değiştir" : "Change Password"}
              sub={language === "tr" ? "Hesap şifrenizi güncelleyin" : "Update your account password"}
              onPress={() => (navigation as any).navigate(Routes.App.ChangePassword)}
            />
            <GlassTile
              theme={theme}
              icon="shield-checkmark-outline"
              iconColor={theme.textMuted}
              label={language === "tr" ? "Gizlilik" : "Privacy"}
              sub={language === "tr" ? "Veri ve güvenlik tercihlerini yönet" : "Manage data and security preferences"}
              isLast
              onPress={() => (navigation as any).navigate(Routes.App.Privacy)}
            />
          </GlassTileGroup>
        </Animated.View>

        <Animated.View style={section5}>
          <SectionLabel title={copy.app} theme={theme} />
          <GlassTileGroup theme={theme}>
            <GlassTile
              theme={theme}
              icon="star-outline"
              iconColor={theme.accentGold}
              label={language === "tr" ? "Uygulamayı Değerlendir" : "Rate App"}
              sub={language === "tr" ? "Deneyimini paylaş ve ürünü güçlendir" : "Share your experience and strengthen the product"}
              onPress={() => (navigation as any).navigate(Routes.App.RateApp)}
            />
            <GlassTile
              theme={theme}
              icon="information-circle-outline"
              iconColor={theme.textMuted}
              label={t.profile.version}
              sub="1.0.0 · Build 1"
              isLast
              disabled
            />
          </GlassTileGroup>
        </Animated.View>

        {/* ══ ÇIKIŞ ════════════════════════════════════════════════════════ */}
        <Animated.View style={section6}>
          <TouchableOpacity
            style={[ps.logoutBtn, {
              backgroundColor: `${theme.accentCoral}0C`,
              borderColor:     `${theme.accentCoral}30`,
            }]}
            onPress={() =>
              Alert.alert(
                t.profile.logout,
                t.profile.logoutConfirm,
                [
                  { text: t.common.cancel, style: "cancel"      },
                  { text: t.profile.logout, style: "destructive", onPress: logout },
                ],
              )
            }
            activeOpacity={0.75}
          >
            <Ionicons name="log-out-outline" size={17} color={theme.accentCoral} />
            <Text style={[ps.logoutTxt, { color: theme.accentCoral }]}>{t.profile.logout}</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={ps.bottomPad} />
      </ScrollView>
    </View>
  );
}

// ─── Screen-level styles ──────────────────────────────────────────────────────

const ps = StyleSheet.create({
  root:      { flex: 1 },
  centered:  { justifyContent: "center", alignItems: "center" },
  scroll:    { paddingHorizontal: spacing.lg, paddingTop: spacing.xl + 18 },
  bottomPad: { height: 148 },
  sectionLead: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  screenGlowA: {
    position: "absolute",
    top: 20,
    right: -56,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.72,
  },
  screenGlowB: {
    position: "absolute",
    top: 360,
    left: -72,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.5,
  },

  heroShell: {
    borderRadius: radii.xxl,
    borderWidth: 1.2,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  heroShellGlowA: {
    position: "absolute",
    top: -52,
    right: -46,
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.28,
  },
  heroShellGlowB: {
    position: "absolute",
    bottom: 34,
    left: -34,
    width: 110,
    height: 110,
    borderRadius: 55,
    opacity: 0.22,
  },
  heroShellBar: {
    height: 4,
  },
  heroShellBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg + 2,
    gap: spacing.md,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  heroEyebrowText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  heroDaysCard: {
    minWidth: 58,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  heroDaysNum: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 26,
  },
  heroDaysLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  heroIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroIdentityText: {
    flex: 1,
    gap: 10,
  },
  heroHeadline: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  heroSubtitleText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
    maxWidth: "96%",
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  heroMetaText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  heroProfileStrip: {
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroProfileTextWrap: {
    flex: 1,
  },
  heroProfileName: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 3,
  },
  heroProfileEmail: {
    fontSize: 12.5,
    fontWeight: "500",
  },
  heroProfileStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroProfileStatusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  heroMetricRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  heroMetricCard: {
    flex: 1,
    minHeight: 98,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    justifyContent: "space-between",
  },
  heroMetricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroMetricValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroMetricSuffix: {
    fontSize: 11,
    fontWeight: "700",
  },
  heroMetricLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickCard: {
    width: "48.5%",
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: 108,
    justifyContent: "space-between",
  },
  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  quickSub: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "500",
    marginTop: 2,
  },

  // Theme picker row (inside GlassTile group)
  themePickerRow: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  preferenceIntro: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  preferenceMiniCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  preferenceMiniLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  preferenceMiniValue: {
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
  },

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
    borderWidth: 1.5, borderRadius: radii.xl,
    paddingVertical: 16,
    marginTop: spacing.md, marginBottom: spacing.xl,
  },
  logoutTxt: { fontSize: 14, fontWeight: "900", letterSpacing: 0.1 },
});






