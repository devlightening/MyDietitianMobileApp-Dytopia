import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type Theme } from "../../theme/tokens";
import type { MatchedMissingItem } from "../../api/kitchen";
import { useTranslation } from "../../context/I18nContext";
import {
  formatCompatibilityPercent,
  getScoreColor,
  getScoreTierLabel,
  normalizeCompatibilityPercent,
} from "../../utils/recipeMatchPresentation";

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

// â”€â”€ Score bar (animates from 0 â†’ percent on mount) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ScoreBar({ percent, color }: { percent: number; color: string }) {
  const [trackW, setTrackW] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (trackW > 0) {
      progress.value = withDelay(
        280,
        withTiming(percent / 100, { duration: 720, easing: Easing.out(Easing.cubic) }),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackW, percent]);

  const fillStyle = useAnimatedStyle(() => ({
    width: progress.value * trackW,
  }));

  return (
    <View
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      style={s.barTrack}
    >
      <Animated.View style={[s.barFill, fillStyle, { backgroundColor: color }]} />
    </View>
  );
}

// â”€â”€ Badge icon per matchType/score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function badgeIcon(matchType: MatchType, pct: number): React.ComponentProps<typeof Ionicons>["name"] {
  if (matchType === "clinic")   return "star";
  if (matchType === "catalog")  return "globe-outline";
  if (pct >= 100)               return "checkmark-circle";
  if (pct >= 70)                return "trending-up-outline";
  if (pct >= 40)                return "flash-outline";
  return "alert-circle-outline";
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
  const lang = language as "tr" | "en";

  const copy = lang === "en"
    ? {
        clinic: "CLINIC",
        catalog: "CATALOG",
        open: "Open Recipe",
        ready: "Ready to cook",
        missing: "missing",
        suggested: "BEST MATCH",
        noDescription: "A nutrition-friendly recipe matched to your current ingredients.",
        perfect: "PERFECT MATCH",
      }
    : {
        clinic: "KLİNİK",
        catalog: "KATALOG",
        open: "Tarifi İncele",
        ready: "Hemen yapılabilir",
        missing: "eksik",
        suggested: "EN GÜÇLÜ TARİF",
        noDescription: "Mevcut malzemelerine göre seçilmiş beslenme dostu tarif.",
        perfect: "TAM UYUM",
      };

  const pct = normalizeCompatibilityPercent({ compatibilityPercent, score });
  const scoreColor = getScoreColor(pct);
  const scoreLabel = formatCompatibilityPercent({ compatibilityPercent, score });
  const tierLabel =
    matchType === "clinic"
      ? copy.clinic
      : matchType === "catalog"
        ? copy.catalog
        : getScoreTierLabel(pct, lang);

  const icon = badgeIcon(matchType, pct);
  const note = motivationText || copy.noDescription;
  const isPerfect = pct >= 100;

  // â”€â”€ Featured variant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (featured) {
    return (
      <View
        style={[
          s.featured,
          {
            backgroundColor: theme.surface,
            borderColor: `${scoreColor}30`,
            // Subtle tinted background for perfect matches
            ...(isPerfect && { backgroundColor: `${scoreColor}06` }),
          },
        ]}
      >
        {/* Glow blob top-right */}
        <View style={[s.featureGlow, { backgroundColor: `${scoreColor}${isPerfect ? "1A" : "10"}` }]} />

        {/* Top row: badge + score pill */}
        <View style={s.featureTop}>
          <View style={[s.badge, { backgroundColor: `${scoreColor}15`, borderColor: `${scoreColor}28` }]}>
            <Ionicons name={icon} size={12} color={scoreColor} />
            <Text style={[s.badgeTxt, { color: scoreColor }]}>{tierLabel}</Text>
          </View>
          <View style={[s.scorePill, { backgroundColor: `${scoreColor}12`, borderColor: `${scoreColor}26` }]}>
            <Text style={[s.scoreTxt, { color: scoreColor }]}>{scoreLabel}</Text>
          </View>
        </View>

        <Text style={[s.featureEyebrow, { color: scoreColor }]}>{copy.suggested}</Text>
        <Text style={[s.featureTitle, { color: theme.text }]}>{name}</Text>
        <Text style={[s.featureDesc, { color: theme.textSub }]}>{description || copy.noDescription}</Text>

        {/* Motivation note box */}
        <View style={[s.noteBox, { backgroundColor: `${scoreColor}0E`, borderColor: `${scoreColor}22` }]}>
          <Text style={[s.noteTxt, { color: scoreColor }]}>{note}</Text>
        </View>

        {/* Missing ingredients */}
        {missing.length > 0 && (
          <Text style={[s.missingInline, { color: theme.textMuted }]}>
            {missing.length} {copy.missing}: {missing.slice(0, 2).map((x) => x.ingredient.name).join(", ")}
          </Text>
        )}

        {/* Animated progress bar */}
        <View style={s.featuredBarWrap}>
          <ScoreBar percent={pct} color={scoreColor} />
          <Text style={[s.barLabel, { color: scoreColor }]}>{scoreLabel}</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[s.cta, { backgroundColor: scoreColor }]}
          onPress={onOpen}
          activeOpacity={0.85}
        >
          <Text style={s.ctaTxt}>{copy.open}</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  }

  // â”€â”€ Standard card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onOpen}
      style={[
        s.card,
        {
          backgroundColor: `${scoreColor}06`,
          borderColor: `${scoreColor}28`,
        },
      ]}
    >
      {/* Left accent bar â€” color intensity reflects score */}
      <View style={[s.leftBar, { backgroundColor: scoreColor }]} />

      <View style={s.body}>
        {/* Badge + score */}
        <View style={s.topRow}>
          <View style={[s.badge, { backgroundColor: `${scoreColor}12`, borderColor: `${scoreColor}26` }]}>
            <Ionicons name={icon} size={10} color={scoreColor} />
            <Text style={[s.badgeTxt, { color: scoreColor }]}>{tierLabel}</Text>
          </View>
          <Text style={[s.smallScore, { color: scoreColor }]}>{scoreLabel}</Text>
        </View>

        <Text style={[s.title, { color: theme.text }]}>{name}</Text>
        <Text style={[s.desc, { color: theme.textSub }]} numberOfLines={2}>
          {description || copy.noDescription}
        </Text>
        <Text style={[s.note, { color: theme.textMuted }]} numberOfLines={2}>{note}</Text>

        {/* Footer: status + open button */}
        <View style={s.bottomRow}>
          {missing.length === 0 ? (
            <View style={s.readyRow}>
              <Ionicons name="checkmark-circle-outline" size={13} color={scoreColor} />
              <Text style={[s.statusTxt, { color: scoreColor }]}>{copy.ready}</Text>
            </View>
          ) : (
            <Text style={[s.statusTxt, { color: theme.warning }]}>
              {missing.length} {copy.missing}
            </Text>
          )}
          <View style={[s.openGhost, { backgroundColor: `${scoreColor}10`, borderColor: `${scoreColor}24` }]}>
            <Text style={[s.openGhostTxt, { color: scoreColor }]}>{copy.open}</Text>
          </View>
        </View>

        {/* Animated match progress bar */}
        <ScoreBar percent={pct} color={scoreColor} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  // â”€â”€ Featured â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  featured:       { borderWidth: 1.5, borderRadius: radii.xxl, padding: 18, overflow: "hidden", marginBottom: spacing.sm },
  featureGlow:    { position: "absolute", top: -28, right: -22, width: 130, height: 130, borderRadius: 65 },
  featureTop:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  featureEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9, marginBottom: 8 },
  featureTitle:   { fontSize: 20, fontWeight: "900", lineHeight: 25, marginBottom: 6 },
  featureDesc:    { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  noteBox:        { borderWidth: 1, borderRadius: radii.lg, padding: 12, marginBottom: 10 },
  noteTxt:        { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  missingInline:  { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  featuredBarWrap:{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  barLabel:       { fontSize: 12, fontWeight: "900", minWidth: 40, textAlign: "right" },
  cta:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radii.xl, paddingVertical: 14 },
  ctaTxt:         { color: "#FFF", fontSize: 14, fontWeight: "900" },

  // â”€â”€ Standard card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  card:       { borderWidth: 1, borderRadius: radii.xl, overflow: "hidden", flexDirection: "row", marginBottom: spacing.sm },
  leftBar:    { width: 5 },
  body:       { flex: 1, padding: 14, paddingBottom: 12 },
  topRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 },
  badge:      { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 9, paddingVertical: 5 },
  badgeTxt:   { fontSize: 10, fontWeight: "900" },
  scorePill:  { minWidth: 60, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  scoreTxt:   { fontSize: 14, fontWeight: "900" },
  smallScore: { fontSize: 13, fontWeight: "900" },
  title:      { fontSize: 17, fontWeight: "900", lineHeight: 22, marginBottom: 5 },
  desc:       { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  note:       { fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  bottomRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  readyRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  statusTxt:  { fontSize: 12, fontWeight: "800" },
  openGhost:  { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 8 },
  openGhostTxt: { fontSize: 11.5, fontWeight: "800" },

  // â”€â”€ Shared: score bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  barTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.08)", overflow: "hidden" },
  barFill:  { height: 4, borderRadius: 2 },
});

