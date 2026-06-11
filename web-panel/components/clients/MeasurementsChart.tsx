'use client';

import { type ReactNode, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Flame,
  Scale,
  ShieldCheck,
  Smartphone,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react';
import { ClientMeasurement } from '@/lib/api/clients';
import { Card } from '@/components/ui/Card';
import { BodyCompositionClinicalPanel } from '@/components/clients/BodyCompositionClinicalPanel';
import { cn } from '@/lib/utils';

interface MeasurementsChartProps {
  measurements: ClientMeasurement[];
}

type TrendMetric = 'weight' | 'fat' | 'muscle' | 'waist';

const trendOptions: Array<{ id: TrendMetric; label: string; unit: string }> = [
  { id: 'weight', label: 'Kilo', unit: 'kg' },
  { id: 'fat', label: 'Yağ', unit: '%' },
  { id: 'muscle', label: 'Kas', unit: '%' },
  { id: 'waist', label: 'Bel', unit: 'cm' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatNumber(value: number | null | undefined, digits = 1) {
  return value == null ? null : value.toFixed(digits);
}

function sourceLabel(sourceType: string) {
  switch (sourceType) {
    case 'dietitian':
      return 'Klinik';
    case 'smart_scale':
      return 'Akıllı tartı';
    case 'system':
      return 'Sistem';
    default:
      return 'Danışan';
  }
}

function sourceIcon(sourceType: string) {
  if (sourceType === 'dietitian') return <User className="h-3.5 w-3.5" />;
  if (sourceType === 'smart_scale') return <Smartphone className="h-3.5 w-3.5" />;
  return <Activity className="h-3.5 w-3.5" />;
}

function getMetricValue(m: ClientMeasurement, metric: TrendMetric) {
  switch (metric) {
    case 'weight':
      return m.weightKg ?? null;
    case 'fat':
      return m.bodyFatPercent ?? null;
    case 'muscle':
      return m.musclePercent ?? null;
    case 'waist':
      return m.waistCm ?? null;
  }
}

function DeltaChip({ value, unit = '' }: { value: number; unit?: string }) {
  const isDown = value < 0;
  const isUp = value > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold',
        isDown
          ? 'bg-emerald-500/12 text-emerald-700'
          : isUp
            ? 'bg-amber-500/14 text-amber-700'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {isDown ? <TrendingDown className="h-3 w-3" /> : isUp ? <TrendingUp className="h-3 w-3" /> : null}
      {isUp ? '+' : ''}
      {value.toFixed(1)}
      {unit}
    </span>
  );
}

function QualityPill({ label, tone }: { label: string; tone: 'good' | 'watch' | 'empty' }) {
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

function metricTone(value: number | null | undefined, min?: number, max?: number) {
  if (value == null) return 'empty' as const;
  if ((min != null && value < min) || (max != null && value > max)) return 'watch' as const;
  return 'good' as const;
}

function MetricTile({
  label,
  value,
  sub,
  icon,
  tone = 'good',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  tone?: 'good' | 'watch' | 'empty';
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-2xl',
            tone === 'good' && 'bg-primary/10 text-primary',
            tone === 'watch' && 'bg-amber-500/12 text-amber-700',
            tone === 'empty' && 'bg-muted text-muted-foreground',
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function TrendChart({
  data,
  metric,
}: {
  data: ClientMeasurement[];
  metric: TrendMetric;
}) {
  const option = trendOptions.find((item) => item.id === metric)!;
  const points = data
    .map((item) => ({ measurement: item, value: getMetricValue(item, metric) }))
    .filter((item): item is { measurement: ClientMeasurement; value: number } => item.value != null);

  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Bu metrik için henüz veri yok.
      </div>
    );
  }

  const values = points.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 820;
  const height = 220;
  const padX = 28;
  const padY = 24;
  const toX = (index: number) =>
    points.length === 1 ? width / 2 : padX + (index / (points.length - 1)) * (width - padX * 2);
  const toY = (value: number) => height - padY - ((value - min) / range) * (height - padY * 2);
  const polylinePoints = points.map((item, index) => `${toX(index)},${toY(item.value)}`).join(' ');

  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{option.label} trendi</p>
          <p className="text-xs text-muted-foreground">
            {points.length} ölçüm noktası, en düşük {min.toFixed(1)} {option.unit}, en yüksek {max.toFixed(1)} {option.unit}
          </p>
        </div>
      </div>
      <svg className="h-60 w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            x1={padX}
            x2={width - padX}
            y1={padY + line * ((height - padY * 2) / 3)}
            y2={padY + line * ((height - padY * 2) / 3)}
            stroke="currentColor"
            strokeWidth="1"
            className="text-border"
            opacity="0.38"
          />
        ))}
        {points.length > 1 && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="text-primary"
          />
        )}
        {points.map((item, index) => (
          <g key={item.measurement.id}>
            <circle cx={toX(index)} cy={toY(item.value)} r="6" fill="currentColor" className="text-primary" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function CompositionBar({
  label,
  value,
  unit,
  percent,
  helper,
}: {
  label: string;
  value: string;
  unit?: string;
  percent: number | null;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {helper && <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>}
        </div>
        <p className="text-lg font-semibold text-foreground">
          {value}
          {unit && value !== 'Veri yok' ? <span className="ml-1 text-xs text-muted-foreground">{unit}</span> : null}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(percent ?? 0, 100))}%` }} />
      </div>
    </div>
  );
}

export function MeasurementsChart({ measurements }: MeasurementsChartProps) {
  const [activeTrend, setActiveTrend] = useState<TrendMetric>('weight');

  const sorted = useMemo(
    () => [...(measurements ?? [])].sort((a, b) => new Date(a.recordedAtUtc).getTime() - new Date(b.recordedAtUtc).getTime()),
    [measurements],
  );
  const latest = sorted.at(-1) ?? null;
  const first = sorted[0] ?? null;

  const totalWeightChange =
    latest?.weightKg != null && first?.weightKg != null ? latest.weightKg - first.weightKg : null;

  const fatMass =
    latest?.weightKg != null && latest.bodyFatPercent != null
      ? (latest.weightKg * latest.bodyFatPercent) / 100
      : null;
  const leanMass = latest?.weightKg != null && fatMass != null ? latest.weightKg - fatMass : null;
  const muscleMass =
    latest?.weightKg != null && latest.musclePercent != null
      ? (latest.weightKg * latest.musclePercent) / 100
      : null;
  const waterMass =
    latest?.weightKg != null && latest.waterPercent != null
      ? (latest.weightKg * latest.waterPercent) / 100
      : null;

  const history = [...sorted].reverse();

  if (!latest) {
    return (
      <div className="space-y-6">
        <BodyCompositionClinicalPanel measurement={null} />
        <Card className="p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Scale className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Henüz ölçüm kaydı yok</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            İlk klinik ölçüm eklendiğinde vücut kompozisyonu, trend grafikleri ve ölçüm geçmişi bu panelde görünür.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Son kilo"
          value={latest.weightKg != null ? `${latest.weightKg.toFixed(1)} kg` : 'Veri yok'}
          sub={totalWeightChange != null ? `Başlangıçtan ${totalWeightChange > 0 ? '+' : ''}${totalWeightChange.toFixed(1)} kg` : undefined}
          icon={<Scale className="h-5 w-5" />}
          tone={latest.weightKg == null ? 'empty' : 'good'}
        />
        <MetricTile
          label="BMI"
          value={latest.bmi != null ? latest.bmi.toFixed(1) : 'Veri yok'}
          sub={latest.bmiCategory ?? undefined}
          icon={<BadgeCheck className="h-5 w-5" />}
          tone={metricTone(latest.bmi, 18.5, 30)}
        />
        <MetricTile
          label="Yağ / Kas"
          value={`${formatNumber(latest.bodyFatPercent) ?? '-'}% / ${formatNumber(latest.musclePercent) ?? '-'}%`}
          sub="Kompozisyon oranları"
          icon={<Activity className="h-5 w-5" />}
          tone={latest.bodyFatPercent == null && latest.musclePercent == null ? 'empty' : 'good'}
        />
        <MetricTile
          label="BMR"
          value={latest.bmr != null ? `${Math.round(latest.bmr)} kcal` : 'Veri yok'}
          sub={latest.waterPercent != null ? `Su: %${latest.waterPercent.toFixed(1)}` : undefined}
          icon={<Flame className="h-5 w-5" />}
          tone={latest.bmr == null ? 'empty' : 'good'}
        />
      </div>

      <BodyCompositionClinicalPanel measurement={latest} />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Vücut kompozisyonu</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">BIA özet paneli</h3>
            </div>
            <QualityPill label={sourceLabel(latest.sourceType)} tone="good" />
          </div>
          <div className="space-y-3">
            <CompositionBar
              label="Kilo"
              value={latest.weightKg != null ? latest.weightKg.toFixed(1) : 'Veri yok'}
              unit="kg"
              percent={latest.weightKg != null ? Math.min((latest.weightKg / 120) * 100, 100) : null}
              helper="Toplam vücut ağırlığı"
            />
            <CompositionBar
              label="Vücut yağ kütlesi"
              value={fatMass != null ? fatMass.toFixed(1) : 'Veri yok'}
              unit="kg"
              percent={latest.bodyFatPercent ?? null}
              helper={latest.bodyFatPercent != null ? `%${latest.bodyFatPercent.toFixed(1)} yağ oranı` : 'Yağ oranı girilmedi'}
            />
            <CompositionBar
              label="Yağsız kütle"
              value={leanMass != null ? leanMass.toFixed(1) : 'Veri yok'}
              unit="kg"
              percent={leanMass != null && latest.weightKg ? (leanMass / latest.weightKg) * 100 : null}
              helper="Kilo - yağ kütlesi"
            />
            <CompositionBar
              label="Kas kütlesi"
              value={muscleMass != null ? muscleMass.toFixed(1) : 'Veri yok'}
              unit="kg"
              percent={latest.musclePercent ?? null}
              helper={latest.musclePercent != null ? `%${latest.musclePercent.toFixed(1)} kas oranı` : 'Kas oranı girilmedi'}
            />
            <CompositionBar
              label="Toplam vücut suyu"
              value={waterMass != null ? waterMass.toFixed(1) : 'Veri yok'}
              unit="kg"
              percent={latest.waterPercent ?? null}
              helper={latest.waterPercent != null ? `%${latest.waterPercent.toFixed(1)} su oranı` : 'Su oranı girilmedi'}
            />
            <CompositionBar label="Protein / mineral" value="Veri yok" percent={null} helper="Cihaz entegrasyonu geldiğinde doldurulacak" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Trend analizi</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Ölçüm değişimi</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveTrend(option.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    activeTrend === option.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <TrendChart data={sorted} metric={activeTrend} />
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">Kayıtlar</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">Ölçüm geçmişi</h3>
          </div>
          <div className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {history.length} kayıt
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Tarih</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kilo</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Değişim</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">BMI</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Bel/Kalça</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Yağ</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kas/Su</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kaynak</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Not</th>
              </tr>
            </thead>
            <tbody>
              {history.map((m, index, arr) => {
                const prev = arr[index + 1];
                const weightDelta = m.weightKg != null && prev?.weightKg != null ? m.weightKg - prev.weightKg : null;
                return (
                  <tr key={m.id} className="border-b border-border/45 transition hover:bg-muted/20">
                    <td className="px-3 py-3 font-medium text-foreground">{formatDate(m.recordedAtUtc)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-foreground">
                      {m.weightKg != null ? `${m.weightKg.toFixed(1)} kg` : '-'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {weightDelta != null ? <DeltaChip value={weightDelta} unit=" kg" /> : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">
                      {m.bmi != null ? (
                        <span title={m.bmiCategory ?? undefined}>{m.bmi.toFixed(1)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">
                      {m.waistCm != null ? `${m.waistCm.toFixed(0)} cm` : '-'}
                      {m.waistHipRatio != null ? <span className="ml-1 text-xs">/ {m.waistHipRatio.toFixed(2)}</span> : null}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">
                      {m.bodyFatPercent != null ? `%${m.bodyFatPercent.toFixed(1)}` : '-'}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">
                      {m.musclePercent != null ? `%${m.musclePercent.toFixed(1)}` : '-'}
                      <span className="mx-1">/</span>
                      {m.waterPercent != null ? `%${m.waterPercent.toFixed(1)}` : '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {m.isClinicallyVerified && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1">
                          {sourceIcon(m.sourceType)}
                          {sourceLabel(m.sourceType)}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-muted-foreground">
                      <span className="line-clamp-1">{m.notes || '-'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
