import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, StatusBar,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { useAuth } from "../auth/AuthContext";
import { radii, spacing } from "../theme/tokens";
import ProduceBubble from "../components/decor/ProduceBubble";
import { changePassword } from "../api/auth";

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { language } = useTranslation();
  const { refreshUserState } = useAuth();

  const [currentPassword, setCurrentPassword]   = useState("");
  const [newPassword, setNewPassword]           = useState("");
  const [confirmPassword, setConfirmPassword]   = useState("");
  const [showCurrent, setShowCurrent]           = useState(false);
  const [showNew, setShowNew]                   = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);
  const [loading, setLoading]                   = useState(false);

  const tr = language === "tr";

  // â”€â”€ inline validation errors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tooShort    = newPassword.length > 0 && newPassword.length < 8;
  const noMatch     = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const sameAsCur   = newPassword.length > 0 && newPassword === currentPassword;

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword &&
    !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await changePassword({
        currentPassword,
        newPassword,
        signOutOtherSessions: false,
      });
      await SecureStore.setItemAsync("access_token", res.token);
      await refreshUserState();
      Alert.alert(
        tr ? "Başarılı" : "Success",
        res.message || (tr ? "Şifreniz güncellendi." : "Password updated."),
        [{ text: "OK", onPress: () => (navigation as any).goBack() }]
      );
    } catch (e: any) {
      const status = e?.response?.status;
      const msg: string = e?.response?.data?.message ?? "";
      let errorText: string;
      if (status === 401) {
        errorText = tr ? "Mevcut şifreniz hatalı." : "Current password is incorrect.";
      } else if (msg.toLowerCase().includes("same")) {
        errorText = tr
          ? "Yeni şifre mevcut şifreyle aynı olamaz."
          : "New password must differ from current.";
      } else {
        errorText = msg || (tr ? "Bir hata oluştu." : "An error occurred.");
      }
      Alert.alert(tr ? "Hata" : "Error", errorText);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ProduceBubble
        icon="leaf"
        iconSize={36}
        iconColor={`${theme.accentCoral}30`}
        style={[s.bgGlow, { backgroundColor: `${theme.accentCoral}08` }]}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* â”€â”€ Header â”€â”€ */}
        <TouchableOpacity onPress={() => (navigation as any).goBack()} style={s.backRow}>
          <Ionicons name="chevron-back" size={18} color={theme.primary} />
          <Text style={[s.backText, { color: theme.primary }]}>
            {tr ? "Geri" : "Back"}
          </Text>
        </TouchableOpacity>

        <Text style={[s.title, { color: theme.text }]}>
          {tr ? "Şifre Değiştir" : "Change Password"}
        </Text>
        <Text style={[s.subtitle, { color: theme.textSub }]}>
          {tr
            ? "Güvenliğiniz için güçlü bir şifre seçin."
            : "Choose a strong password for your security."}
        </Text>

        {/* â”€â”€ Form card â”€â”€ */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>

          {/* Current password */}
          <Text style={[s.fieldLabel, { color: theme.textSub }]}>
            {tr ? "Mevcut Şifre" : "Current Password"}
          </Text>
          <View style={[s.inputRow, { borderColor: theme.borderEmerald, backgroundColor: theme.surfaceElevated }]}>
            <TextInput
              style={[s.input, { color: theme.text }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={tr ? "Mevcut şifreniz" : "Your current password"}
              placeholderTextColor={theme.textMuted}
            />
            <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={s.eyeBtn}>
              <Ionicons
                name={showCurrent ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.textMuted}
              />
            </TouchableOpacity>
          </View>

          <View style={[s.divider, { backgroundColor: theme.borderEmerald }]} />

          {/* New password */}
          <Text style={[s.fieldLabel, { color: theme.textSub }]}>
            {tr ? "Yeni Şifre" : "New Password"}
          </Text>
          <View style={[
            s.inputRow,
            { borderColor: (tooShort || sameAsCur) ? theme.accentCoral : theme.borderEmerald, backgroundColor: theme.surfaceElevated },
          ]}>
            <TextInput
              style={[s.input, { color: theme.text }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={tr ? "En az 8 karakter" : "At least 8 characters"}
              placeholderTextColor={theme.textMuted}
            />
            <TouchableOpacity onPress={() => setShowNew(v => !v)} style={s.eyeBtn}>
              <Ionicons
                name={showNew ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.textMuted}
              />
            </TouchableOpacity>
          </View>
          {tooShort && (
            <Text style={[s.hint, { color: theme.accentCoral }]}>
              {tr ? "En az 8 karakter olmalı." : "Must be at least 8 characters."}
            </Text>
          )}
          {sameAsCur && (
            <Text style={[s.hint, { color: theme.accentCoral }]}>
              {tr ? "Mevcut şifreden farklı olmalı." : "Must differ from current password."}
            </Text>
          )}

          <View style={[s.divider, { backgroundColor: theme.borderEmerald }]} />

          {/* Confirm password */}
          <Text style={[s.fieldLabel, { color: theme.textSub }]}>
            {tr ? "Yeni Şifre Tekrar" : "Confirm New Password"}
          </Text>
          <View style={[
            s.inputRow,
            { borderColor: noMatch ? theme.accentCoral : theme.borderEmerald, backgroundColor: theme.surfaceElevated },
          ]}>
            <TextInput
              style={[s.input, { color: theme.text }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={tr ? "Yeni şifrenizi tekrar girin" : "Repeat new password"}
              placeholderTextColor={theme.textMuted}
            />
            <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn}>
              <Ionicons
                name={showConfirm ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.textMuted}
              />
            </TouchableOpacity>
          </View>
          {noMatch && (
            <Text style={[s.hint, { color: theme.accentCoral }]}>
              {tr ? "Şifreler eşleşmiyor." : "Passwords do not match."}
            </Text>
          )}
        </View>

        {/* â”€â”€ Submit button â”€â”€ */}
        <TouchableOpacity
          style={[
            s.submitBtn,
            {
              backgroundColor: canSubmit ? theme.emerald : `${theme.emerald}40`,
              borderColor: canSubmit ? theme.emerald : `${theme.emerald}30`,
            },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={18} color="#fff" />
              <Text style={s.submitTxt}>
                {tr ? "Şifreyi Güncelle" : "Update Password"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* â”€â”€ Info note â”€â”€ */}
        <View style={[s.infoRow, { backgroundColor: `${theme.emerald}0A`, borderColor: `${theme.emerald}20` }]}>
          <Ionicons name="information-circle-outline" size={15} color={theme.emerald} />
          <Text style={[s.infoTxt, { color: theme.textSub }]}>
            {tr
              ? "Şifreniz güncellendikten sonra mevcut oturumunuz aktif kalmaya devam eder."
              : "Your current session will remain active after the password update."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bgGlow: {
    position: "absolute", width: 260, height: 260, borderRadius: 130,
    top: -60, right: -80, opacity: 0.6,
  },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 48, paddingTop: 16 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 20 },
  backText: { fontSize: 15, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 14, fontWeight: "500", marginBottom: 28, lineHeight: 20 },

  card: {
    borderRadius: radii.xl, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  fieldLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: radii.lg,
    paddingHorizontal: 14, marginBottom: 4,
  },
  input: {
    flex: 1, fontSize: 15, fontWeight: "500",
    paddingVertical: 14,
  },
  eyeBtn: { padding: 4 },
  hint: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  divider: { height: 1, marginVertical: 16, opacity: 0.5 },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: radii.xl, borderWidth: 1,
    paddingVertical: 16, marginBottom: 16,
  },
  submitTxt: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  infoRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: radii.lg, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  infoTxt: { flex: 1, fontSize: 12, fontWeight: "500", lineHeight: 18 },
});

