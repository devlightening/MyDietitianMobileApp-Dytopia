import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'danger';
}

export function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  className,
  variant = 'default',
}: SettingsCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-6',
        variant === 'danger'
          ? 'border-red-200 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/20'
          : 'bg-card border-border',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-5">
        <Icon
          className={cn(
            'w-5 h-5',
            variant === 'danger' ? 'text-red-500' : 'text-primary'
          )}
        />
        <div>
          <h2
            className={cn(
              'text-base font-semibold',
              variant === 'danger' ? 'text-red-700 dark:text-red-400' : 'text-foreground'
            )}
          >
            {title}
          </h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
