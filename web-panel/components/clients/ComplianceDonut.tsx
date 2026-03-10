'use client';

import { cn } from '@/lib/utils';

interface ComplianceDonutProps {
  percentage: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ComplianceDonut({
  percentage,
  size = 120,
  strokeWidth = 12,
  className,
}: ComplianceDonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Determine color based on compliance rate
  const getColor = () => {
    if (percentage >= 80) return 'text-action'; // Green for good
    if (percentage >= 60) return 'text-accent'; // Orange for moderate
    return 'text-destructive'; // Red for poor
  };

  const colorClass = getColor();

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('transition-all duration-500', colorClass)}
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold', colorClass)}>
          {Math.round(percentage)}%
        </span>
        <span className="text-xs text-muted-foreground mt-1">Compliance</span>
      </div>
    </div>
  );
}
