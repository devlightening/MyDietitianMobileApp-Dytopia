import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { radii, spacing } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import api from "../api/client";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Measurement {
  id: string;
  recordedAtUtc: string;
  sourceType: "client" | "dietitian" | "smart_scale" | "system";
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPercent: number | null;
  musclePercent: number | null;
  waterPercent: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  bmi: number | null;
  bmiCategory: string | null;
  bmr: number | null;
  waistHipRatio: number | null;
  notes: string | null;
  isClinicallyVerified: boolean;
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function delta(current: number | null, previous: number | null, unit: string): string | null {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (diff === 0) return null;
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)} ${unit}`;
}

function sourceBadge(sourceType: string): string {
  switch (sourceType) {
    case "dietitian": return "Klinik";
    case "smart_scale": return "Akıllı tartı";
    default: return "Kendi girişi";
  }
}

// â”€â”€ Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ProfileMeasurementsScreen() {
  const nav = useNavigation();
  const { theme, isDark } = useTheme();

  // â”€â”€ State: view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [tab, setTab] = useState<"quick" | "clinical">("quick");
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [latest, setLatest] = useState<Measurement | null>(null);
  const [history, setHistory] = useState<Measurement[]>([]);

  // â”€â”€ State: form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [musclePercent, setMusclePercent] = useState("");
  const [waterPercent, setWaterPercent] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipCm, setHipCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [notes, setNotes] = useState("");

  // â”€â”€ Data loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loadData = useCallback(async () => {
    try {
      const [latestRes, historyRes] = await Promise.all([
        api.get<{ measurement: Measurement | null }>("/api/client/measurements/latest"),
        api.get<{ measurements: Measurement[] }>("/api/client/measurements", {
          params: { page: 1, pageSize: 10 },
        }),
      ]);
      const m = latestRes.data?.measurement;
      setLatest(m ?? null);
      if (m) {
        if (m.weightKg) setWeightKg(String(m.weightKg));
        if (m.heightCm) setHeightCm(String(m.heightCm));
        if (m.waistCm)  setWaistCm(String(m.waistCm));
        if (m.hipCm)    setHipCm(String(m.hipCm));
        if (m.chestCm)  setChestCm(String(m.chestCm));
      }
      setHistory(historyRes.data?.measurements ?? []);
    } catch {
      // no prior measurements â€” that's fine
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handleSubmit() {
    const w   = parseFloat(weightKg) || null;
    const h   = parseFloat(heightCm) || null;
    const bf  = parseFloat(bodyFat) || null;
    const mu  = parseFloat(musclePercent) || null;
    const wa  = parseFloat(waterPercent) || null;
    const wst = parseFloat(waistCm) || null;
    const hip = parseFloat(hipCm) || null;
    const ch  = parseFloat(chestCm) || null;

    const hasAtLeastOne = w || h || bf || wst || hip || ch;
    if (!hasAtLeastOne) {
      Alert.alert("Geçersiz", "En az bir ölçüm değeri giriniz.");
      return;
    }

    const inRange = (v: number | null, min: number, max: number) =>
      v === null || (v >= min && v <= max);

    if (!inRange(w, 10, 500)) return Alert.alert("Geçersiz", "Kilo 10-500 kg arasında olmalı.");
    if (!inRange(h, 50, 300)) return Alert.alert("Geçersiz", "Boy 50-300 cm arasında olmalı.");
    if (!inRange(bf, 0, 70))  return Alert.alert("Geçersiz", "Yağ oranı 0-70% arasında olmalı.");
    if (!inRange(wst, 30, 300) || !inRange(hip, 30, 300) || !inRange(ch, 30, 300))
      return Alert.alert("Geçersiz", "Çevre ölçümleri 30-300 cm arasında olmalı.");

    setLoading(true);
    try {
      await api.post("/api/client/measurements", {
        weightKg:       w,
        heightCm:       h,
        bodyFatPercent: bf,
        musclePercent:  mu,
        waterPercent:   wa,
        waistCm:        wst,
        hipCm:          hip,
        chestCm:        ch,
        notes:          notes.trim() || null,
      });
      Alert.alert("Kaydedildi", "Ölçümünüz başarıyla kaydedildi.");
      setNotes("");
      await loadData();
    } catch (e: any) {
      Alert.alert("Hata", e.response?.data?.message || "Ölçüm kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (fetching) {
    return (
      <View style={[s.root, s.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const prevRecord = history.length >= 2 ? history[1] : null;

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <TouchableOpacity onPress={() => (nav as any).goBack()} style={s.backRow}>
          <Text style={[s.backText, { color: theme.primary }]}>← Geri</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Ölçümlerim</Text>
        <Text style={[s.sub, { color: theme.textSub }]}>
          Düzenli ölçüm planı ve hedef takibini güçlendirir.
        </Text>

        {/* Latest measurement summary card */}
        {latest ? (
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={s.cardHeaderRow}>
              <Text style={[s.cardTitle, { color: theme.text }]}>Son Ölçüm</Text>
              <View style={[s.badge, { backgroundColor: theme.primary + "18" }]}>
                <Text style={[s.badgeText, { color: theme.primary }]}>
                  {sourceBadge(latest.sourceType)}
                </Text>
              </View>
            </View>
            <Text style={[s.dateText, { color: theme.textMuted }]}>
              {formatDate(latest.recordedAtUtc)}
              {latest.isClinicallyVerified && " · Klinik onaylı"}
            </Text>

            {/* Primary metrics row */}
            <View style={s.metricsRow}>
              {latest.weightKg != null && (
                <MetricBox
                  value={`${latest.weightKg}`}
                  unit="kg"
                  label="Kilo"
                  delta={delta(latest.weightKg, prevRecord?.weightKg ?? null, "kg")}
                  color={theme.primary}
                />
              )}
              {latest.bmi != null && (
                <MetricBox
                  value={`${latest.bmi}`}
                  unit=""
                  label={`BMI${latest.bmiCategory ? ` · ${latest.bmiCategory}` : ""}`}
                  delta={delta(latest.bmi, prevRecord?.bmi ?? null, "")}
                  color={theme.accent}
                />
              )}
              {latest.waistCm != null && (
                <MetricBox
                  value={`${latest.waistCm}`}
                  unit="cm"
                  label="Bel"
                  delta={delta(latest.waistCm, prevRecord?.waistCm ?? null, "cm")}
                  color={theme.accentGold}
                />
              )}
            </View>

            {/* Secondary metrics */}
            <View style={s.secondaryRow}>
              {latest.bodyFatPercent != null && (
                <SecondaryMetric label="Yağ %" value={`${latest.bodyFatPercent}%`} theme={theme} />
              )}
              {latest.heightCm != null && (
                <SecondaryMetric label="Boy" value={`${latest.heightCm} cm`} theme={theme} />
              )}
              {latest.hipCm != null && (
                <SecondaryMetric label="Kalça" value={`${latest.hipCm} cm`} theme={theme} />
              )}
              {latest.chestCm != null && (
                <SecondaryMetric label="Göğüs" value={`${latest.chestCm} cm`} theme={theme} />
              )}
              {latest.waistHipRatio != null && (
                <SecondaryMetric label="B/K oranı" value={`${latest.waistHipRatio}`} theme={theme} />
              )}
              {latest.bmr != null && (
                <SecondaryMetric label="BMR" value={`${latest.bmr} kcal`} theme={theme} />
              )}
            </View>
          </View>
        ) : (
          <View style={[s.card, s.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.emptyTitle, { color: theme.text }]}>Henüz ölçüm yok</Text>
            <Text style={[s.emptyText, { color: theme.textMuted }]}>
              İlk ölçümünüzü ekleyin, zaman içindeki değişiminizi takip edin.
            </Text>
          </View>
        )}

        {/* Weight chart */}
        {history.filter(m => m.weightKg != null).length >= 2 && (
          <WeightChart history={history} theme={theme} />
        )}

        {/* Tab selector */}
        <View style={[s.tabRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[s.tabBtn, tab === "quick" && { backgroundColor: theme.primary + "22" }]}
            onPress={() => setTab("quick")}
          >
            <Text style={[s.tabBtnText, { color: tab === "quick" ? theme.primary : theme.textMuted }]}>
              Hızlı giriş
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === "clinical" && { backgroundColor: theme.primary + "22" }]}
            onPress={() => setTab("clinical")}
          >
            <Text style={[s.tabBtnText, { color: tab === "clinical" ? theme.primary : theme.textMuted }]}>
              Detaylı
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form card */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.cardTitle, { color: theme.text }]}>Yeni Ölçüm</Text>

          {/* Quick tab: weight + waist only */}
          <MeasurementField label="Kilo (kg)" value={weightKg} onChange={setWeightKg} placeholder="Örn: 72.5" theme={theme} />

          {tab === "clinical" && (
            <>
              <MeasurementField label="Boy (cm)" value={heightCm} onChange={setHeightCm} placeholder="Örn: 170" theme={theme} />
              <MeasurementField label="Yağ oranı (%)" value={bodyFat} onChange={setBodyFat} placeholder="Örn: 22.0" theme={theme} />
              <MeasurementField label="Kas oranı (%) — opsiyonel" value={musclePercent} onChange={setMusclePercent} placeholder="Örn: 35.0" theme={theme} />
              <MeasurementField label="Su oranı (%) — opsiyonel" value={waterPercent} onChange={setWaterPercent} placeholder="Örn: 55.0" theme={theme} />
            </>
          )}

          <MeasurementField label="Bel (cm)" value={waistCm} onChange={setWaistCm} placeholder="Örn: 80" theme={theme} />

          {tab === "clinical" && (
            <>
              <MeasurementField label="Kalça (cm)" value={hipCm} onChange={setHipCm} placeholder="Örn: 95" theme={theme} />
              <MeasurementField label="Göğüs (cm)" value={chestCm} onChange={setChestCm} placeholder="Örn: 90" theme={theme} />

              <Text style={[s.inputLabel, { color: theme.textMuted, marginTop: spacing.md }]}>Not (opsiyonel)</Text>
              <TextInput
                style={[s.input, s.inputMultiline, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Ölçüm koşulları, cihaz bilgisi..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={2}
              />
            </>
          )}

          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }, loading && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={s.submitBtnText}>Takibi Güncelle</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* History list */}
        {history.length > 1 && (
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardTitle, { color: theme.text }]}>Geçmiş</Text>
            {history.map((m, i) => {
              const prev = history[i + 1] ?? null;
              return (
                <View
                  key={m.id}
                  style={[s.historyRow, i < history.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border + "60" }]}
                >
                  <View>
                    <Text style={[s.historyDate, { color: theme.text }]}>{formatDate(m.recordedAtUtc)}</Text>
                    <Text style={[s.historySource, { color: theme.textMuted }]}>{sourceBadge(m.sourceType)}</Text>
                  </View>
                  <View style={s.historyMetrics}>
                    {m.weightKg != null && (
                      <View style={s.historyMetricItem}>
                        <Text style={[s.historyMetricVal, { color: theme.text }]}>{m.weightKg} kg</Text>
                        {delta(m.weightKg, prev?.weightKg ?? null, "kg") && (
                          <Text style={[s.historyDelta, { color: (m.weightKg - (prev?.weightKg ?? m.weightKg)) < 0 ? "#22c55e" : "#f87171" }]}>
                            {delta(m.weightKg, prev?.weightKg ?? null, "kg")}
                          </Text>
                        )}
                      </View>
                    )}
                    {m.waistCm != null && (
                      <View style={s.historyMetricItem}>
                        <Text style={[s.historyMetricVal, { color: theme.textSub }]}>{m.waistCm} cm bel</Text>
                      </View>
                    )}
                    {m.bmi != null && (
                      <View style={s.historyMetricItem}>
                        <Text style={[s.historyMetricVal, { color: theme.textSub }]}>BMI {m.bmi}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// â”€â”€ WeightChart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function WeightChart({ history, theme }: { history: Measurement[]; theme: any }) {
  const points = history.filter(m => m.weightKg != null).slice(0, 8).reverse();
  if (points.length < 2) return null;
  const weights = points.map(m => m.weightKg as number);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const BAR_H = 64;

  return (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[s.cardTitle, { color: theme.text }]}>Kilo Grafiği</Text>
      <View style={chartS.row}>
        {points.map((m, i) => {
          const h = Math.max(6, Math.round(((m.weightKg! - min) / range) * BAR_H));
          const isLast = i === points.length - 1;
          return (
            <View key={m.id} style={chartS.col}>
              <Text style={[chartS.val, { color: isLast ? theme.primary : theme.textMuted }]}>
                {m.weightKg}
              </Text>
              <View style={[chartS.barBg, { height: BAR_H }]}>
                <View style={[chartS.bar, { height: h, backgroundColor: isLast ? theme.primary : `${theme.primary}50` }]} />
              </View>
              <Text style={[chartS.date, { color: theme.textMuted }]}>
                {new Date(m.recordedAtUtc).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[chartS.range, { color: theme.textMuted }]}>
        {min.toFixed(1)} - {max.toFixed(1)} kg arası {points.length} ölçüm
      </Text>
    </View>
  );
}

const chartS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", marginTop: spacing.sm },
  col: { alignItems: "center", flex: 1, gap: 4 },
  val: { fontSize: 10, fontWeight: "800" },
  barBg: { width: 20, justifyContent: "flex-end", borderRadius: 4, overflow: "hidden", backgroundColor: "transparent" },
  bar: { width: "100%", borderRadius: 4 },
  date: { fontSize: 9, fontWeight: "700", textAlign: "center" },
  range: { fontSize: 11, fontWeight: "600", marginTop: spacing.sm, textAlign: "center" },
});

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MetricBox({ value, unit, label, delta: d, color }: {
  value: string; unit: string; label: string; delta?: string | null; color: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={s.metricBox}>
      <Text style={[s.metricValue, { color }]}>
        {value}<Text style={{ fontSize: 12 }}> {unit}</Text>
      </Text>
      <Text style={[s.metricLabel, { color: theme.textMuted }]}>{label}</Text>
      {d && <Text style={[s.metricDelta, { color: d.startsWith("-") ? "#22c55e" : "#f87171" }]}>{d}</Text>}
    </View>
  );
}

function SecondaryMetric({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={s.secMetric}>
      <Text style={[s.secMetricLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[s.secMetricValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function MeasurementField({ label, value, onChange, placeholder, theme }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; theme: any;
}) {
  return (
    <>
      <Text style={[s.inputLabel, { color: theme.textMuted, marginTop: spacing.md }]}>{label}</Text>
      <TextInput
        style={[s.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
      />
    </>
  );
}

// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const s = StyleSheet.create({
  root: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl + 16, paddingBottom: spacing.xl },

  backRow: { marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: "900" },
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -0.3 },
  sub: { marginTop: 6, fontSize: 13, fontWeight: "600", lineHeight: 18, marginBottom: spacing.lg },

  card: {
    borderRadius: radii.xl, borderWidth: 1,
    padding: spacing.lg, marginBottom: spacing.lg,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: "900", marginBottom: spacing.sm },
  dateText: { fontSize: 12, fontWeight: "700", marginBottom: spacing.md },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "800" },

  metricsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: spacing.md },
  metricBox: { alignItems: "center", flex: 1 },
  metricValue: { fontSize: 22, fontWeight: "900" },
  metricLabel: { fontSize: 11, fontWeight: "700", marginTop: 3, textAlign: "center" },
  metricDelta: { fontSize: 11, fontWeight: "800", marginTop: 2 },

  secondaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  secMetric: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(128,128,128,0.08)", alignItems: "center" },
  secMetricLabel: { fontSize: 10, fontWeight: "700" },
  secMetricValue: { fontSize: 13, fontWeight: "800", marginTop: 1 },

  emptyCard: { alignItems: "center", paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: "900", marginBottom: 6 },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 18 },

  tabRow: {
    flexDirection: "row", borderRadius: radii.xl, borderWidth: 1,
    overflow: "hidden", marginBottom: spacing.md,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radii.xl },
  tabBtnText: { fontSize: 13, fontWeight: "800" },

  inputLabel: { fontSize: 13, fontWeight: "800", marginBottom: 6 },
  input: {
    borderRadius: radii.lg, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    fontSize: 16, fontWeight: "700",
  },
  inputMultiline: { paddingTop: 12, minHeight: 72, textAlignVertical: "top" },

  submitBtn: {
    marginTop: spacing.lg, borderRadius: radii.xl, paddingVertical: 16,
    alignItems: "center", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30, shadowRadius: 10, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#FFF", fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },

  historyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: spacing.md },
  historyDate: { fontSize: 13, fontWeight: "800" },
  historySource: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  historyMetrics: { alignItems: "flex-end" },
  historyMetricItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  historyMetricVal: { fontSize: 13, fontWeight: "800" },
  historyDelta: { fontSize: 11, fontWeight: "800" },
});

