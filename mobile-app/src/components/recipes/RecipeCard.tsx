import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type Theme } from "../../theme/tokens";
import type { MatchedMissingItem } from "../../api/kitchen";
import { useTranslation } from "../../context/I18nContext";
import { formatCompatibilityPercent } from "../../utils/recipeMatchPresentation";

export type MatchType = "full" | "partial" | "clinic" | "catalog";

export interface RecipeCardProps {
  recipeId: string;
  name: string;
  description?: string;
  motivationText?: string;
  matchType: MatchType;
  missing: MatchedMissingItem[];
  compatibilityPercent?: number;
  score?: number;
  theme: Theme;
  onOpen?: () => void;
  onSave?: () => void;
  featured?: boolean;
}

export default function RecipeCard({
  name,
  description,
  motivationText,
  matchType,
  missing,
  compatibilityPercent,
  score,
  theme,
  onOpen,
  featured,
}: RecipeCardProps) {
  const { language } = useTranslation();
  const copy = language === "en" ? {
    full: "FULL MATCH",
    partial: "ALMOST READY",
    clinic: "CLINIC",
    catalog: "CATALOG",
    open: "Open Recipe",
    ready: "Ready",
    missing: "missing",
    suggested: "BEST MATCH",
    noDescription: "A clearer nutrition-friendly recipe suggestion based on your current ingredients.",
  } : {
    full: "TAM UYUM",
    partial: "EKSİKLE",
    clinic: "KLİNİK",
    catalog: "KATALOG",
    open: "Tarifi İncele",
    ready: "Hazır",
    missing: "eksik",
    suggested: "EN GÜÇLÜ TARİF",
    noDescription: "Mevcut malzemelerine göre seçilmiş daha okunaklı bir tarif önerisi.",
  };

  const accent =
    matchType === "clinic"
      ? theme.accentGold
      : matchType === "catalog"
        ? theme.accentCyan
        : matchType === "full"
          ? theme.emerald
          : theme.warning;
  const label =
    matchType === "clinic"
      ? copy.clinic
      : matchType === "catalog"
        ? copy.catalog
        : matchType === "full"
          ? copy.full
          : copy.partial;
  const scoreLabel = formatCompatibilityPercent({ compatibilityPercent, score });
  const note = motivationText || copy.noDescription;

  if (featured) {
    return (
      <View style={[s.featured, { backgroundColor: theme.surface, borderColor: `${accent}2A` }]}>
        <View style={[s.featureGlow, { backgroundColor: `${accent}12` }]} />
        <View style={s.featureTop}>
          <View style={[s.badge, { backgroundColor: `${accent}12`, borderColor: `${accent}24` }]}>
            <Ionicons
              name={matchType === "clinic" ? "star" : matchType === "catalog" ? "globe-outline" : matchType === "full" ? "checkmark-circle" : "flash"}
              size={12}
              color={accent}
            />
            <Text style={[s.badgeTxt, { color: accent }]}>{label}</Text>
          </View>
          {scoreLabel !== null && (
            <View style={[s.scorePill, { backgroundColor: `${accent}10`, borderColor: `${accent}22` }]}>
              <Text style={[s.scoreTxt, { color: accent }]}>{scoreLabel}</Text>
            </View>
          )}
        </View>
        <Text style={[s.featureEyebrow, { color: accent }]}>{copy.suggested}</Text>
        <Text style={[s.featureTitle, { color: theme.text }]}>{name}</Text>
        <Text style={[s.featureDesc, { color: theme.textSub }]}>{description || copy.noDescription}</Text>
        <View style={[s.noteBox, { backgroundColor: `${accent}0F`, borderColor: `${accent}24` }]}>
          <Text style={[s.noteTxt, { color: accent }]}>{note}</Text>
        </View>
        {missing.length > 0 && (
          <Text style={[s.missingInline, { color: theme.textMuted }]}>
            {missing.length} {copy.missing}: {missing.slice(0, 2).map((x) => x.ingredient.name).join(", ")}
          </Text>
        )}
        <TouchableOpacity style={[s.cta, { backgroundColor: theme.primary }]} onPress={onOpen} activeOpacity={0.85}>
          <Text style={s.ctaTxt}>{copy.open}</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onOpen} style={[s.card, { backgroundColor: theme.surface, borderColor: `${accent}22` }]}>
      <View style={[s.leftBar, { backgroundColor: accent }]} />
      <View style={s.body}>
        <View style={s.topRow}>
          <View style={[s.badge, { backgroundColor: `${accent}10`, borderColor: `${accent}24` }]}>
            <Text style={[s.badgeTxt, { color: accent }]}>{label}</Text>
          </View>
          {scoreLabel !== null && <Text style={[s.smallScore, { color: accent }]}>{scoreLabel}</Text>}
        </View>
        <Text style={[s.title, { color: theme.text }]}>{name}</Text>
        <Text style={[s.desc, { color: theme.textSub }]} numberOfLines={2}>{description || copy.noDescription}</Text>
        <Text style={[s.note, { color: theme.textMuted }]} numberOfLines={2}>{note}</Text>
        <View style={s.bottomRow}>
          {missing.length === 0 ? (
            <Text style={[s.statusTxt, { color: theme.emerald }]}>{copy.ready}</Text>
          ) : (
            <Text style={[s.statusTxt, { color: theme.warning }]}>{missing.length} {copy.missing}</Text>
          )}
          <View style={[s.openGhost, { backgroundColor: `${accent}10`, borderColor: `${accent}24` }]}>
            <Text style={[s.openGhostTxt, { color: accent }]}>{copy.open}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  featured: { borderWidth: 1, borderRadius: radii.xxl, padding: 18, overflow: "hidden", marginBottom: spacing.sm },
  featureGlow: { position: "absolute", top: -30, right: -24, width: 120, height: 120, borderRadius: 60 },
  featureTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  featureEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9, marginBottom: 8 },
  featureTitle: { fontSize: 20, fontWeight: "900", lineHeight: 25, marginBottom: 6 },
  featureDesc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  noteBox: { borderWidth: 1, borderRadius: radii.lg, padding: 12, marginBottom: 10 },
  noteTxt: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  missingInline: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radii.xl, paddingVertical: 14 },
  ctaTxt: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  card: { borderWidth: 1, borderRadius: radii.xl, overflow: "hidden", flexDirection: "row", marginBottom: spacing.sm },
  leftBar: { width: 4 },
  body: { flex: 1, padding: 14 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 9, paddingVertical: 5 },
  badgeTxt: { fontSize: 10, fontWeight: "900" },
  scorePill: { minWidth: 56, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  scoreTxt: { fontSize: 13, fontWeight: "900" },
  smallScore: { fontSize: 13, fontWeight: "900" },
  title: { fontSize: 17, fontWeight: "900", lineHeight: 22, marginBottom: 5 },
  desc: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  note: { fontSize: 12.5, lineHeight: 18, marginBottom: 12 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  statusTxt: { fontSize: 12, fontWeight: "800" },
  openGhost: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 8 },
  openGhostTxt: { fontSize: 11.5, fontWeight: "800" },
});
