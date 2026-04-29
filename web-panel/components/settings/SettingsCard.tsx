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
  const isDanger = variant === 'danger';

  return (
    <section
      className={cn(
        'overflow-hidden rounded-[30px] border p-6 shadow-[var(--shadow-card)] transition-colors',
        isDanger
          ? 'border-red-200 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/20'
          : 'bg-[var(--surface-raised)] border-[var(--border-default)]',
        className
      )}
    >
      <div className="mb-6 flex items-start gap-4">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
            isDanger
              ? 'border-red-200 bg-red-100/80 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400'
              : 'border-[var(--border-emerald-dim)] bg-[var(--brand-primary-soft)] text-[var(--brand-emerald)]'
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2
            className={cn(
              'text-[1.05rem] font-semibold tracking-[-0.02em]',
              isDanger ? 'text-red-700 dark:text-red-400' : 'text-foreground'
            )}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}
