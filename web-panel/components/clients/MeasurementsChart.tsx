'use client';

import { ClientMeasurement } from '@/lib/api/clients';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { ShieldCheck, User, Smartphone } from 'lucide-react';

interface MeasurementsChartProps {
  measurements: ClientMeasurement[];
}

function sourceLabel(sourceType: string) {
  switch (sourceType) {
    case 'dietitian': return 'Klinik';
    case 'smart_scale': return 'Akıllı tartı';
    default: return 'Kendi girişi';
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function DeltaChip({ value, unit = '' }: { value: number; unit?: string }) {
  const isDown = value < 0;
  const isUp = value > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold',
        isDown ? 'bg-emerald-500/12 text-emerald-600' : isUp ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
      )}
    >
      {isDown ? '↓' : isUp ? '↑' : '—'}
      {Math.abs(value).toFixed(1)}{unit}
    </span>
  );
}

export function MeasurementsChart({ measurements }: MeasurementsChartProps) {
  if (!measurements || measurements.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-muted-foreground">Henüz ölçüm kaydı yok</p>
      </Card>
    );
  }

  const sorted = [...measurements].sort(
    (a, b) => new Date(a.recordedAtUtc).getTime() - new Date(b.recordedAtUtc).getTime()
  );
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];

  const totalWeightChange =
    latest.weightKg != null && first.weightKg != null
      ? latest.weightKg - first.weightKg
      : null;

  // --- SVG weight chart ---
  const weightPoints = sorted.filter((m) => m.weightKg != null);
  const weights = weightPoints.map((m) => m.weightKg as number);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const wRange = maxW - minW || 1;
  const W = 800;
  const H = 180;
  const PAD = 10;

  const toX = (i: number) =>
    weightPoints.length === 1 ? W / 2 : (i / (weightPoints.length - 1)) * (W - PAD * 2) + PAD;
  const toY = (w: number) => H - PAD - ((w - minW) / wRange) * (H - PAD * 2);

  const polylinePoints = weightPoints
    .map((m, i) => `${toX(i)},${toY(m.weightKg as number)}`)
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Son kilo</p>
          <p className="text-2xl font-bold text-foreground">
            {latest.weightKg != null ? `${latest.weightKg.toFixed(1)} kg` : '—'}
          </p>
          {totalWeightChange !== null && (
            <div className="mt-1">
              <DeltaChip value={totalWeightChange} unit=" kg" />
              <span className="ml-1 text-[10px] text-muted-foreground">başlangıçtan</span>
            </div>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">BMI</p>
          <p className="text-2xl font-bold text-foreground">
            {latest.bmi != null ? latest.bmi.toFixed(1) : '—'}
          </p>
          {latest.bmiCategory && (
            <p className="text-xs text-muted-foreground mt-1">{latest.bmiCategory}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Bel</p>
          <p className="text-2xl font-bold text-foreground">
            {latest.waistCm != null ? `${latest.waistCm.toFixed(0)} cm` : '—'}
          </p>
          {latest.waistHipRatio != null && (
            <p className="text-xs text-muted-foreground mt-1">Bel/Kalça: {latest.waistHipRatio.toFixed(2)}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">BMR</p>
          <p className="text-2xl font-bold text-foreground">
            {latest.bmr != null ? `${Math.round(latest.bmr)} kcal` : '—'}
          </p>
          {latest.bodyFatPercent != null && (
            <p className="text-xs text-muted-foreground mt-1">Yağ: %{latest.bodyFatPercent.toFixed(1)}</p>
          )}
        </Card>
      </div>

      {/* Weight chart */}
      {weightPoints.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Kilo takibi</h3>
          <div className="relative h-44">
            <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              {[0, 1, 2, 3].map((i) => (
                <line
                  key={i}
                  x1="0" y1={i * (H / 3)} x2={W} y2={i * (H / 3)}
                  stroke="currentColor" strokeWidth="1" className="text-border" opacity="0.25"
                />
              ))}
              {weightPoints.length > 1 && (
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  className="text-primary"
                />
              )}
              {weightPoints.map((m, i) => (
                <circle
                  key={m.id}
                  cx={toX(i)}
                  cy={toY(m.weightKg as number)}
                  r="5"
                  fill="currentColor"
                  className="text-primary"
                />
              ))}
            </svg>
          </div>
        </Card>
      )}

      {/* History table */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Ölçüm geçmişi</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Tarih</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">Kilo</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">Değişim</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">BMI</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">Bel</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs hidden sm:table-cell">Yağ %</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().map((m, index, arr) => {
                const prev = arr[index + 1];
                const weightDelta =
                  m.weightKg != null && prev?.weightKg != null
                    ? m.weightKg - prev.weightKg
                    : null;
                return (
                  <tr key={m.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 text-foreground">{formatDate(m.recordedAtUtc)}</td>
                    <td className="py-2 px-3 text-right font-medium text-foreground">
                      {m.weightKg != null ? `${m.weightKg.toFixed(1)} kg` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {weightDelta !== null ? (
                        <DeltaChip value={weightDelta} unit=" kg" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground">
                      {m.bmi != null ? (
                        <span title={m.bmiCategory ?? undefined}>{m.bmi.toFixed(1)}</span>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground">
                      {m.waistCm != null ? `${m.waistCm.toFixed(0)} cm` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground hidden sm:table-cell">
                      {m.bodyFatPercent != null ? `%${m.bodyFatPercent.toFixed(1)}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {m.isClinicallyVerified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-label="Klinik doğrulandı" />
                        )}
                        {m.sourceType === 'dietitian' ? (
                          <User className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="text-[11px] text-muted-foreground">{sourceLabel(m.sourceType)}</span>
                      </div>
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
