'use client';

import { ClientMeasurement } from '@/lib/api/clients';
import { Card } from '@/components/ui/Card';

interface MeasurementsChartProps {
  measurements: ClientMeasurement[];
}

export function MeasurementsChart({ measurements }: MeasurementsChartProps) {
  if (!measurements || measurements.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No measurements recorded yet</p>
      </Card>
    );
  }

  // Sort by date
  const sortedMeasurements = [...measurements].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Calculate min and max for scaling
  const weights = sortedMeasurements.map((m) => m.weightKg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight || 1;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-6">Weight Progress</h3>

      {/* Simple line chart using SVG */}
      <div className="relative h-64 mb-6">
        <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="0"
              y1={i * 50}
              x2="800"
              y2={i * 50}
              stroke="currentColor"
              strokeWidth="1"
              className="text-border"
              opacity="0.3"
            />
          ))}

          {/* Line path */}
          <polyline
            points={sortedMeasurements
              .map((m, i) => {
                const x = (i / (sortedMeasurements.length - 1)) * 800;
                const y = 200 - ((m.weightKg - minWeight) / range) * 180 - 10;
                return `${x},${y}`;
              })
              .join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-action"
          />

          {/* Data points */}
          {sortedMeasurements.map((m, i) => {
            const x = (i / (sortedMeasurements.length - 1)) * 800;
            const y = 200 - ((m.weightKg - minWeight) / range) * 180 - 10;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="5"
                fill="currentColor"
                className="text-action"
              />
            );
          })}
        </svg>
      </div>

      {/* Data table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Weight (kg)</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {sortedMeasurements.map((measurement, index) => {
              const prevWeight = index > 0 ? sortedMeasurements[index - 1].weightKg : null;
              const change = prevWeight ? measurement.weightKg - prevWeight : null;

              return (
                <tr key={measurement.id} className="border-b border-border/50">
                  <td className="py-2 px-3 text-foreground">
                    {new Date(measurement.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-foreground">
                    {measurement.weightKg.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {change !== null && (
                      <span
                        className={
                          change > 0
                            ? 'text-destructive'
                            : change < 0
                              ? 'text-action'
                              : 'text-muted-foreground'
                        }
                      >
                        {change > 0 ? '+' : ''}
                        {change.toFixed(1)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
