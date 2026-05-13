import React from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type Theme } from "../../theme/tokens";
import { BRAND_LOGO } from "../../assets/brandAssets";

type Props = {
  theme: Theme;
  language: "tr" | "en";
  fullName: string;
  email: string;
  initials: string;
  hasInitials: boolean;
  photoUri?: string | null;
  saving: boolean;
  saveDisabled: boolean;
  onChangeFullName: (value: string) => void;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
  onSave: () => void;
};

export default function ProfileEditCard({
  theme,
  language,
  fullName,
  email,
  initials,
  hasInitials,
  photoUri,
  saving,
  saveDisabled,
  onChangeFullName,
  onPickPhoto,
  onRemovePhoto,
  onSave,
}: Props) {
  const copy = language === "tr"
    ? {
        eyebrow: "KİŞİSEL STÜDYO",
        title: "Profil stüdyosu",
        subtitle: "Adını, fotoğrafını ve temel hesap görünümünü tek yüzeyde yenile.",
        photoTitle: "Görsel kimlik",
        photoHint: "Profil fotoğrafı yalnızca bu cihazda saklanır ve istediğin zaman güncellenebilir.",
        nameLabel: "Ad soyad",
        emailLabel: "E-posta",
        pickPhoto: photoUri ? "Fotoğrafı yenile" : "Fotoğraf ekle",
        removePhoto: "Fotoğrafı kaldır",
        save: "Profili kaydet",
      }
    : {
        eyebrow: "PERSONAL STUDIO",
        title: "Profile studio",
        subtitle: "Refresh your name, photo and core account appearance in one surface.",
        photoTitle: "Visual identity",
        photoHint: "Your profile photo is stored on this device and can be updated anytime.",
        nameLabel: "Full name",
        emailLabel: "Email",
        pickPhoto: photoUri ? "Refresh photo" : "Add photo",
        removePhoto: "Remove photo",
        save: "Save profile",
      };

  return (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={s.header}>
        <View style={[s.eyebrow, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
          <Ionicons name="create-outline" size={13} color={theme.primaryDark} />
          <Text style={[s.eyebrowText, { color: theme.primaryDark }]}>{copy.eyebrow}</Text>
        </View>
        <Text style={[s.title, { color: theme.text }]}>{copy.title}</Text>
        <Text style={[s.subtitle, { color: theme.textSub }]}>{copy.subtitle}</Text>
      </View>

      <View style={[s.photoCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={[s.previewOuter, { borderColor: theme.borderEmerald }]}>
          <View style={[s.previewInner, { backgroundColor: photoUri ? theme.surface : theme.surface }]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.photo} />
            ) : (
              <>
                <View style={[s.previewAura, { backgroundColor: theme.primaryGlow, borderColor: theme.borderEmerald }]} />
                <Image source={BRAND_LOGO} resizeMode="contain" fadeDuration={0} style={s.defaultLogo} />
                {hasInitials ? (
                  <View style={[s.previewInitialBadge, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
                    <Text style={s.previewInitialText}>{initials.slice(0, 1)}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>

        <View style={s.photoBody}>
          <Text style={[s.photoTitle, { color: theme.text }]}>
            {copy.photoTitle}
          </Text>
          <Text style={[s.photoHint, { color: theme.textMuted }]}>{copy.photoHint}</Text>

          <View style={s.photoActions}>
            <TouchableOpacity
              style={[s.photoButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={onPickPhoto}
              activeOpacity={0.82}
            >
              <Ionicons name="image-outline" size={14} color="#FFFFFF" />
              <Text style={s.photoButtonText}>{copy.pickPhoto}</Text>
            </TouchableOpacity>

            {photoUri ? (
              <TouchableOpacity
                style={[s.photoButtonAlt, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={onRemovePhoto}
                activeOpacity={0.82}
              >
                <Ionicons name="trash-outline" size={14} color={theme.textSub} />
                <Text style={[s.photoButtonAltText, { color: theme.textSub }]}>{copy.removePhoto}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      <View style={s.form}>
        <Text style={[s.label, { color: theme.textMuted }]}>{copy.nameLabel}</Text>
        <TextInput
          value={fullName}
          onChangeText={onChangeFullName}
          placeholder={copy.nameLabel}
          placeholderTextColor={theme.textMuted}
          style={[
            s.input,
            {
              color: theme.text,
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
            },
          ]}
        />

        <Text style={[s.label, { color: theme.textMuted }]}>{copy.emailLabel}</Text>
        <View style={[s.readonlyField, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[s.readonlyText, { color: theme.textSub }]}>{email}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          s.saveButton,
          {
            backgroundColor: saveDisabled ? theme.border : theme.primary,
            borderColor: saveDisabled ? theme.border : theme.primary,
          },
        ]}
        onPress={onSave}
        activeOpacity={saveDisabled ? 1 : 0.82}
        disabled={saveDisabled}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
            <Text style={s.saveButtonText}>{copy.save}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
  photoCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.base,
    flexDirection: "row",
    gap: spacing.base,
    marginBottom: spacing.lg,
  },
  previewOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    padding: 4,
  },
  previewInner: {
    flex: 1,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  initials: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  previewAura: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    opacity: 0.28,
  },
  defaultLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  previewInitialBadge: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  previewInitialText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  photoBody: {
    flex: 1,
    justifyContent: "center",
  },
  photoTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  photoHint: {
    fontSize: 11.5,
    lineHeight: 17,
    marginBottom: 14,
  },
  photoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  photoButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  photoButtonAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  photoButtonAltText: {
    fontSize: 12,
    fontWeight: "800",
  },
  form: {
    gap: 11,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 54,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
  },
  readonlyField: {
    minHeight: 54,
    borderRadius: radii.lg,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  readonlyText: {
    fontSize: 14,
    fontWeight: "600",
  },
  saveButton: {
    minHeight: 54,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});

