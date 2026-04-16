'use client';

import { Card } from '@/components/ui/Card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  href?: string;
  trend?: { value: number; isPositive: boolean };
  loading?: boolean;
  colorVar?: 'sage' | 'coral' | 'forest' | 'oat';
}

const colorMap = {
  sage:   'kpi-sage',
  coral:  'kpi-coral',
  forest: 'kpi-forest',
  oat:    'kpi-oat',
};

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  trend,
  loading,
  colorVar = 'sage',
}: KPICardProps) {
  const tileColor = colorMap[colorVar];

  const content = (
    <Card
      interactive={!!href}
      className={cn(
        'p-6 group',
        href && 'cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', tileColor)}>
          <Icon className="w-6 h-6" />
        </div>
        {href && (
          <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-8 w-20 shimmer rounded-lg" />
          <div className="h-4 w-28 shimmer rounded" />
        </div>
      ) : (
        <div>
          <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 opacity-75">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              'text-xs font-medium mt-2',
              trend.isPositive ? 'text-action' : 'text-destructive'
            )}>
              {trend.isPositive ? '▲' : '▼'} {Math.abs(trend.value)}% vs geçen ay
            </p>
          )}
        </div>
      )}
    </Card>
  );

  if (href && !loading) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
