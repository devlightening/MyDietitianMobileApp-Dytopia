'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Droplets,
  Eye,
  Layers3,
  Maximize2,
  Ruler,
  ScanLine,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ClientMeasurement } from '@/lib/api/clients';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export type RegionId = 'chest' | 'waist' | 'hips' | 'fat' | 'water';
export type BodyProfile = 'neutral' | 'female' | 'male';
export type ClinicalTone = 'good' | 'watch' | 'empty';

export type RegionMetric = {
  id: RegionId;
  label: string;
  shortLabel: string;
  value: string;
  helper: string;
  tone: ClinicalTone;
  color: string;
  glow: string;
  intensity: number;
};

type BodyCompositionClinicalPanelProps = {
  measurement?: ClientMeasurement | null;
  gender?: 'female' | 'male' | string;
};

const ClinicalBody3DViewer = dynamic(
  () => import('@/components/clients/ClinicalBody3DViewer').then((mod) => mod.ClinicalBody3DViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center rounded-3xl border border-white/60 bg-white/45 text-sm font-semibold text-muted-foreground">
        3D klinik görünüm hazırlanıyor
      </div>
    ),
  },
);

const REGION_ORDER: RegionId[] = ['chest', 'waist', 'hips', 'fat', 'water'];

const LAYER_LEGEND: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Ruler, label: '3D çevre ölçüm halkaları' },
  { icon: Activity, label: 'Viseral yağ yoğunluğu' },
  { icon: Droplets, label: 'Hidrasyon hacmi' },
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function normalize(value: number | null | undefined, min: number, max: number) {
  if (value == null || max === min) return 0;
  return clamp((value - min) / (max - min));
}

function formatNumber(value: number | null | undefined, digits = 0) {
  return value == null ? null : value.toFixed(digits);
}

function formatCm(value: number | null | undefined) {
  const formatted = formatNumber(value, 0);
  return formatted == null ? 'Veri yok' : `${formatted} cm`;
}

function toneFromIntensity(hasValue: boolean, intensity: number): ClinicalTone {
  if (!hasValue) return 'empty';
  return intensity >= 0.68 ? 'watch' : 'good';
}

function metricTone(value: number | null | undefined, min?: number, max?: number): ClinicalTone {
  if (value == null) return 'empty';
  if ((min != null && value < min) || (max != null && value > max)) return 'watch';
  return 'good';
}

function clinicalColor(
  intensity: number,
  hasValue: boolean,
  mode: 'green' | 'warm' | 'aqua' | 'water' = 'green',
) {
  if (!hasValue) return 'rgb(139 160 150)';
  if (mode === 'water') return 'rgb(14 165 233)';
  if (mode === 'aqua') return intensity > 0.68 ? 'rgb(8 145 178)' : 'rgb(20 184 166)';
  if (mode === 'warm') {
    if (intensity > 0.76) return 'rgb(229 82 62)';
    if (intensity > 0.52) return 'rgb(245 158 11)';
    return 'rgb(46 168 116)';
  }
  if (intensity > 0.76) return 'rgb(230 94 63)';
  if (intensity > 0.52) return 'rgb(234 179 8)';
  return 'rgb(45 166 112)';
}

function sourceLabel(sourceType: ClientMeasurement['sourceType'] | undefined) {
  switch (sourceType) {
    case 'dietitian':
      return 'Klinik';
    case 'smart_scale':
      return 'Akıllı tartı';
    case 'system':
      return 'Sistem';
    case 'client':
      return 'Danışan';
    default:
      return 'Standby';
  }
}

function inferProfile(measurement: ClientMeasurement | null | undefined, gender?: string): BodyProfile {
  if (gender === 'female' || gender === 'male') return gender;
  if (!measurement?.chestCm || !measurement?.hipCm) return 'neutral';
  if (measurement.hipCm - measurement.chestCm > 5) return 'female';
  if (measurement.chestCm - measurement.hipCm > 6) return 'male';
  return 'neutral';
}

function buildMetrics(measurement: ClientMeasurement | null | undefined): Record<RegionId, RegionMetric> {
  const bodyFat = measurement?.bodyFatPercent ?? null;
  const waistHip = measurement?.waistHipRatio ?? null;
  const fatIntensity = normalize(bodyFat, 18, 38);
  const waistIntensity = Math.max(
    normalize(measurement?.waistCm, 76, 104),
    normalize(waistHip, 0.78, 1.02),
    fatIntensity * 0.72,
  );
  const chestIntensity = Math.max(normalize(measurement?.chestCm, 86, 118), fatIntensity * 0.34);
  const hipsIntensity = Math.max(normalize(measurement?.hipCm, 92, 122), fatIntensity * 0.42);
  const hydrationDeviation = measurement?.waterPercent == null ? 0 : clamp(Math.abs(measurement.waterPercent - 55) / 18);

  return {
    chest: {
      id: 'chest',
      label: 'Göğüs çevresi',
      shortLabel: 'Göğüs',
      value: formatCm(measurement?.chestCm),
      helper: 'Üst gövde 3D ölçüm halkası',
      tone: toneFromIntensity(measurement?.chestCm != null, chestIntensity),
      color: clinicalColor(chestIntensity, measurement?.chestCm != null),
      glow: 'rgba(45,166,112,0.34)',
      intensity: measurement?.chestCm == null ? 0.14 : chestIntensity,
    },
    waist: {
      id: 'waist',
      label: 'Bel çevresi',
      shortLabel: 'Bel',
      value: formatCm(measurement?.waistCm),
      helper: `Bel/kalça ${waistHip != null ? waistHip.toFixed(2) : '-'}`,
      tone: toneFromIntensity(measurement?.waistCm != null, waistIntensity),
      color: clinicalColor(waistIntensity, measurement?.waistCm != null, 'warm'),
      glow: waistIntensity > 0.62 ? 'rgba(229,82,62,0.34)' : 'rgba(234,179,8,0.30)',
      intensity: measurement?.waistCm == null ? 0.16 : waistIntensity,
    },
    hips: {
      id: 'hips',
      label: 'Kalça çevresi',
      shortLabel: 'Kalça',
      value: formatCm(measurement?.hipCm),
      helper: 'Pelvis çevresi 3D ölçümü',
      tone: toneFromIntensity(measurement?.hipCm != null, hipsIntensity),
      color: clinicalColor(hipsIntensity, measurement?.hipCm != null, 'aqua'),
      glow: 'rgba(20,184,166,0.34)',
      intensity: measurement?.hipCm == null ? 0.15 : hipsIntensity,
    },
    fat: {
      id: 'fat',
      label: 'Yağ oranı',
      shortLabel: 'Yağ',
      value: bodyFat != null ? `%${bodyFat.toFixed(1)}` : 'Veri yok',
      helper: 'Abdomen çevresinde hacimsel heatmap',
      tone: toneFromIntensity(bodyFat != null, fatIntensity),
      color: clinicalColor(fatIntensity, bodyFat != null, 'warm'),
      glow: fatIntensity > 0.62 ? 'rgba(229,82,62,0.30)' : 'rgba(245,158,11,0.28)',
      intensity: bodyFat == null ? 0.14 : fatIntensity,
    },
    water: {
      id: 'water',
      label: 'Su oranı',
      shortLabel: 'Su',
      value: measurement?.waterPercent != null ? `%${measurement.waterPercent.toFixed(1)}` : 'Veri yok',
      helper: 'Gövde içinde soft hidrasyon hacmi',
      tone: metricTone(measurement?.waterPercent, 45, 65),
      color: clinicalColor(hydrationDeviation, measurement?.waterPercent != null, 'water'),
      glow: 'rgba(14,165,233,0.28)',
      intensity: measurement?.waterPercent == null ? 0.14 : Math.max(0.28, 1 - hydrationDeviation),
    },
  };
}

function formatRecordedAt(measurement: ClientMeasurement | null | undefined) {
  if (!measurement?.recordedAtUtc) return 'Ölçüm bekleniyor';
  return new Date(measurement.recordedAtUtc).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusPill({ tone }: { tone: ClinicalTone }) {
  const label = tone === 'watch' ? 'Takip' : tone === 'good' ? 'Normal' : 'Veri yok';
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        tone === 'good' && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
        tone === 'watch' && 'border-amber-500/25 bg-amber-500/12 text-amber-700',
        tone === 'empty' && 'border-border bg-muted/40 text-muted-foreground',
      )}
    >
      {label}
    </span>
  );
}

function RegionCard({
  active,
  metric,
  onSelect,
}: {
  active: boolean;
  metric: RegionMetric;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      onFocus={onSelect}
      onMouseEnter={onSelect}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        'group w-full rounded-2xl border p-4 text-left transition',
        active
          ? 'border-primary/45 bg-white/90 shadow-[0_18px_50px_rgba(47,114,77,0.16)] ring-2 ring-primary/15'
          : 'border-border/70 bg-white/70 hover:border-primary/25 hover:bg-white/90',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full transition group-hover:scale-110"
              style={{
                backgroundColor: metric.color,
                boxShadow: active ? `0 0 20px ${metric.glow}` : '0 0 0 4px rgba(255,255,255,0.78)',
              }}
            />
            <span className="truncate text-xs font-semibold text-muted-foreground">{metric.label}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-foreground">{metric.value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{metric.helper}</p>
        </div>
        <StatusPill tone={metric.tone} />
      </div>
    </motion.button>
  );
}

function FocusOverlay({
  activeRegion,
  metrics,
  onClose,
  onRegionChange,
  open,
  profile,
  standby,
}: {
  activeRegion: RegionId;
  metrics: Record<RegionId, RegionMetric>;
  onClose: () => void;
  onRegionChange: (region: RegionId) => void;
  open: boolean;
  profile: BodyProfile;
  standby: boolean;
}) {
  const activeMetric = metrics[activeRegion];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(18,38,27,0.34)] p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="grid max-h-[92vh] w-full max-w-[1280px] overflow-hidden rounded-[2rem] border border-white/45 bg-white/90 shadow-[0_34px_110px_rgba(25,71,44,0.30)] backdrop-blur-2xl lg:grid-cols-[minmax(0,1fr)_390px]"
            initial={{ opacity: 0, y: 26, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 180, damping: 24 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="relative min-h-[680px] overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(45,166,112,0.18),transparent_30%),linear-gradient(135deg,rgba(236,250,242,0.96),rgba(255,255,255,0.80))] p-5 sm:p-7">
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/75">X-Ray klinik görünüm</p>
                  <h3 className="mt-1 text-xl font-semibold text-foreground">3D vücut kompozisyon haritası</h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-white/85 text-muted-foreground shadow-sm transition hover:text-foreground"
                  aria-label="Kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="pt-3">
                <ClinicalBody3DViewer
                  activeRegion={activeRegion}
                  expanded
                  metrics={metrics}
                  onRegionChange={onRegionChange}
                  profile={profile}
                  standby={standby}
                />
              </div>
            </div>

            <aside className="flex min-h-[680px] flex-col gap-4 overflow-y-auto bg-white/75 p-5 sm:p-6">
              <div className="rounded-3xl border border-border/70 bg-white/85 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Ruler className="h-4 w-4 text-primary" />
                  Aktif klinik bölge
                </div>
                <p className="mt-4 text-3xl font-semibold text-foreground">{activeMetric.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{activeMetric.label}</p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: activeMetric.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(10, Math.round(activeMetric.intensity * 100))}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-3">
                {REGION_ORDER.map((id) => {
                  const metric = metrics[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onRegionChange(id)}
                      onMouseEnter={() => onRegionChange(id)}
                      className={cn(
                        'rounded-2xl border p-4 text-left transition',
                        activeRegion === id
                          ? 'border-primary/40 bg-primary/10 shadow-[0_14px_36px_rgba(47,114,77,0.14)]'
                          : 'border-border/70 bg-white/70 hover:border-primary/25',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: metric.color }} />
                          <span className="truncate">{metric.label}</span>
                        </span>
                        <StatusPill tone={metric.tone} />
                      </div>
                      <p className="mt-3 text-xl font-semibold text-foreground">{metric.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{metric.helper}</p>
                    </button>
                  );
                })}
              </div>
            </aside>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function BodyCompositionClinicalPanel({ measurement, gender }: BodyCompositionClinicalPanelProps) {
  const [activeRegion, setActiveRegion] = useState<RegionId>('waist');
  const [focusOpen, setFocusOpen] = useState(false);
  const metrics = useMemo(() => buildMetrics(measurement), [measurement]);
  const profile = useMemo(() => inferProfile(measurement, gender), [measurement, gender]);
  const activeMetric = metrics[activeRegion];
  const standby = !measurement;
  const source = sourceLabel(measurement?.sourceType);
  const recordedAt = formatRecordedAt(measurement);

  useEffect(() => {
    if (!focusOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocusOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusOpen]);

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[minmax(520px,0.95fr)_1.05fr]">
          <section className="relative overflow-hidden border-b border-border/60 bg-[radial-gradient(circle_at_48%_18%,rgba(71,185,114,0.22),transparent_32%),linear-gradient(145deg,rgba(237,250,243,0.96),rgba(255,255,255,0.80))] p-5 sm:p-6 xl:border-b-0 xl:border-r">
            <div className="relative z-10 mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/75">X-Ray klinik görünüm</p>
                <h3 className="mt-1 text-xl font-semibold text-foreground">3D vücut kompozisyon haritası</h3>
              </div>
              <button
                type="button"
                onClick={() => setFocusOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 text-xs font-semibold text-primary shadow-sm backdrop-blur transition hover:border-primary/40 hover:bg-white"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Detaylı incele
              </button>
            </div>

            <ClinicalBody3DViewer
              activeRegion={activeRegion}
              metrics={metrics}
              onRegionChange={setActiveRegion}
              profile={profile}
              standby={standby}
            />
          </section>

          <section className="bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(249,253,250,0.76))] p-5 sm:p-6 lg:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/75">Klinik katmanlar</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">Ölçüm ve BIA senkronizasyonu</h3>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
                  standby
                    ? 'border-border bg-muted/40 text-muted-foreground'
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
                )}
              >
                {measurement?.isClinicallyVerified ? <ShieldCheck className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                {standby ? 'Standby' : `${source} ölçümü`}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
              {REGION_ORDER.map((id) => (
                <RegionCard
                  key={id}
                  active={activeRegion === id}
                  metric={metrics[id]}
                  onSelect={() => setActiveRegion(id)}
                />
              ))}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-3xl border border-border/70 bg-white/65 p-4 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Eye className="h-4 w-4 text-primary" />
                    Ölçüm okuması
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-white/75 px-3 py-1 text-xs font-semibold text-primary">
                    <ScanLine className="h-3.5 w-3.5" />
                    {activeMetric.label}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {standby
                    ? 'Klinik ölçüm bekleniyor. İlk kayıt geldiğinde 3D katman yoğunlukları otomatik oluşur.'
                    : `${recordedAt} tarihli ${source.toLowerCase()} kaydı üzerinden 3D klinik görünüm oluşturuldu.`}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-white/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Aktif değer</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{activeMetric.value}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-white/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Katman</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{activeMetric.shortLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-white/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Yoğunluk</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">%{Math.round(activeMetric.intensity * 100)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-white/65 p-4 shadow-sm backdrop-blur">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Layers3 className="h-4 w-4 text-primary" />
                  Fizyoloji katmanları
                </p>
                <div className="mt-3 space-y-2.5 text-xs text-muted-foreground">
                  {LAYER_LEGEND.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </Card>

      <FocusOverlay
        activeRegion={activeRegion}
        metrics={metrics}
        onClose={() => setFocusOpen(false)}
        onRegionChange={setActiveRegion}
        open={focusOpen}
        profile={profile}
        standby={standby}
      />
    </>
  );
}
