'use client';

import { cn } from '@/lib/utils';
import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, className, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-semibold text-foreground/90">{label}</label>
        )}
        <select
          ref={ref}
          className={cn(
            'select-sfcos h-11',
            error && 'border-[var(--brand-coral)]',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <span className="text-xs text-destructive mt-0.5">{error}</span>
        ) : (
          helperText && (
            <span className="text-xs text-muted-foreground mt-0.5">{helperText}</span>
          )
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';
