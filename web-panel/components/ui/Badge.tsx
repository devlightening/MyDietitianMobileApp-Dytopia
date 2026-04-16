import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

type BadgeVariant = 'primary' | 'secondary' | 'danger';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'primary', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'badge-base',
        variant === 'primary' && 'badge-premium',
        variant === 'secondary' && 'badge-free',
        variant === 'danger' && 'bg-danger/10 text-danger border border-danger/20',
        className
      )}
    >
      {children}
    </span>
  );
}
